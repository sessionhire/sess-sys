import { readSystemStatus, type PrinterStatus } from '@sh/shared'
import type { WebSocket } from 'ws'

/**
 * The printer's side of WebLink (ADR 0191), as Zebra's application note
 * "Weblink / WebSocket Endpoint Configuration" and the Programming Guide's
 * "Using Weblink" set it out. The printer opens a secure WebSocket to the app
 * (its "main channel", subprotocol v1.weblink.zebra.com) and says who it is
 * with its discovery packet. The app asks on the main channel for two more
 * connections when it needs them, each opened by the printer:
 *
 * - **raw** (v1.raw.zebra.com), which takes ZPL as the printer's port 9100
 *   would: the labels go down it;
 * - **config** (v1.config.zebra.com), which takes settings to read as JSON,
 *   `{}{"setting":null}`, and answers in JSON: how it is comes back on it.
 *
 * Each of those first says which printer and channel it is,
 * `{"unique_id":"…","channel_name":"v1.raw.zebra.com","channel_id":"2"}`.
 * The printer only takes binary frames (a text frame closes the connection
 * with 1003), so everything the app sends is sent as bytes. It pings about
 * once a minute and gives up after three pings with no pong, which the
 * WebSocket library answers by itself.
 *
 * One printer at a time: the one whose password is in its setup file, and,
 * once it has connected, only that serial number. A second connection from
 * it (after it lost the first without saying) takes over from the first.
 */

export const MAIN = 'v1.weblink.zebra.com'
export const RAW = 'v1.raw.zebra.com'
export const CONFIG = 'v1.config.zebra.com'

/** What's asked of the printer to know how it is: its status (as ~HQES), its name, and its serial number. */
export const STATUS_QUERY = { 'zpl.system_status': null, 'device.friendly_name': null, 'device.unique_id': null } as const

/** Sent once the main channel is up, so the printer says on it when anything changes: the head opening, labels out, a job done. */
export const ALERTS = { configure_alert: 'ALL MESSAGES,SDK,Y,Y,,,N' }

/** Where the serial number sits in the discovery packet: twelve bytes, 188 in. Read from what printers send; checked against what the channels say. */
const SERIAL_AT = 188
const SERIAL_LENGTH = 12

/** The serial number in a discovery packet, when it looks like one. */
export function serialFromDiscovery(b64: string): string | undefined {
  try {
    const bytes = Buffer.from(b64, 'base64')
    if (bytes.length < SERIAL_AT + SERIAL_LENGTH) return undefined
    const serial = bytes.subarray(SERIAL_AT, SERIAL_AT + SERIAL_LENGTH).toString('latin1').replace(/\0.*$/s, '').trim()
    return /^[A-Za-z0-9]{6,20}$/.test(serial) ? serial : undefined
  } catch {
    return undefined
  }
}

/** Something to tell the person: the printer isn't connected, or didn't answer. */
export class PrinterAway extends Error {}

export interface WebLinkOptions {
  /** The serial number the printer was paired to, if it has connected before: any other is turned away. */
  allowed: () => Promise<string | undefined>
  /** The first serial number seen after pairing, kept so no other printer gets in with the same file. */
  lock: (serial: string) => Promise<void>
  /** Heard from, with its name once it's said. */
  seen: (serial: string, name: string | undefined) => Promise<void>
  log: { info(o: object, m: string): void; warn(o: object, m: string): void }
  /** How long to wait for the printer to open a channel or answer. */
  answerWaitMs?: number
  /** How often to ask how it is while it's connected, besides whenever it says something changed. */
  statusEveryMs?: number
  /** How long a connection may stay without saying what it is. */
  introWaitMs?: number
}

type Kind = 'raw' | 'config'

interface Waiting<T> {
  resolve: (value: T) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

const asText = (data: unknown): string => {
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (Array.isArray(data)) return Buffer.concat(data as Buffer[]).toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  return String(data)
}

const parse = (text: string): Record<string, unknown> | undefined => {
  try {
    const v = JSON.parse(text) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** Bytes, as the printer takes them. */
const send = (socket: WebSocket, text: string) =>
  new Promise<void>((resolve, reject) => socket.send(Buffer.from(text, 'utf8'), { binary: true }, (err) => (err ? reject(err) : resolve())))

export class WebLink {
  private main: WebSocket | undefined
  private raw: WebSocket | undefined
  private serial: string | undefined
  private name: string | undefined
  private status: PrinterStatus | undefined
  private lastSeen: Date | undefined
  private waiting: Record<Kind, Waiting<WebSocket>[]> = { raw: [], config: [] }
  private checking: Promise<PrinterStatus | undefined> | undefined
  private everyTimer: NodeJS.Timeout | undefined
  private soonTimer: NodeJS.Timeout | undefined
  private readonly answerWaitMs: number
  private readonly statusEveryMs: number
  private readonly introWaitMs: number
  /** Printing waits its turn, so two runs sent at once go one after the other, not mixed. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly opts: WebLinkOptions) {
    this.answerWaitMs = opts.answerWaitMs ?? 10_000
    this.statusEveryMs = opts.statusEveryMs ?? 60_000
    this.introWaitMs = opts.introWaitMs ?? 15_000
  }

  /** How it is, as Admin and the Print buttons see it. */
  snapshot(): { connected: boolean; serial?: string; name?: string; status?: PrinterStatus; lastSeen?: string } {
    const connected = !!this.main && this.main.readyState === this.main.OPEN
    return {
      connected,
      ...(this.serial ? { serial: this.serial } : {}),
      ...(this.name ? { name: this.name } : {}),
      ...(connected && this.status ? { status: this.status } : {}),
      ...(this.lastSeen ? { lastSeen: this.lastSeen.toISOString() } : {}),
    }
  }

  get connected() {
    return this.snapshot().connected
  }

  /** A connection the printer has just opened, with its password checked. What it is comes in its first message. */
  take(socket: WebSocket) {
    let known = false
    const intro = setTimeout(() => !known && socket.close(1008, 'Say who you are'), this.introWaitMs)
    socket.on('message', (data) => {
      const text = asText(data)
      if (!known) {
        const first = parse(text)
        if (!first) {
          clearTimeout(intro)
          socket.close(1008, 'Not a printer')
          return
        }
        known = true
        clearTimeout(intro)
        void this.introduced(socket, first).catch((err: Error) => {
          this.opts.log.warn({ err: err.message }, 'Label printer: a connection was turned away')
          socket.close(1008, 'Not this printer')
        })
        return
      }
      if (socket === this.main) this.onMain(text)
    })
    socket.on('error', () => undefined)
    socket.on('close', () => {
      clearTimeout(intro)
      if (socket === this.main) this.lost()
      if (socket === this.raw) this.raw = undefined
    })
  }

  private async introduced(socket: WebSocket, first: Record<string, unknown>) {
    if (typeof first.discovery_b64 === 'string') {
      const serial = serialFromDiscovery(first.discovery_b64)
      if (serial) await this.admit(serial)
      this.becomeMain(socket, serial)
      return
    }
    const channel = first.channel_name
    const id = typeof first.unique_id === 'string' ? first.unique_id.trim() : ''
    if ((channel === RAW || channel === CONFIG) && id) {
      if (!this.main) throw new Error('A channel with no main connection')
      if (this.serial && this.serial !== id) throw new Error(`A channel from ${id}, not ${this.serial}`)
      if (!this.serial) {
        await this.admit(id)
        this.serial = id
      }
      this.heard()
      const kind: Kind = channel === RAW ? 'raw' : 'config'
      if (kind === 'raw') {
        if (this.raw && this.raw !== socket) this.raw.close(1000)
        this.raw = socket
      }
      const next = this.waiting[kind].shift()
      if (next) {
        clearTimeout(next.timer)
        next.resolve(socket)
      } else if (kind === 'config') socket.close(1000)
      return
    }
    throw new Error('Not a discovery packet or a channel')
  }

  /** Let in only the printer that's paired: the first one to connect after pairing becomes it. */
  private async admit(serial: string) {
    const allowed = await this.opts.allowed()
    if (allowed && allowed !== serial) throw new Error(`Printer ${serial} is not the paired one`)
    if (!allowed) await this.opts.lock(serial)
  }

  private becomeMain(socket: WebSocket, serial: string | undefined) {
    if (this.main && this.main !== socket) {
      const old = this.main
      this.main = undefined
      old.close(1000, 'Connected again')
      this.raw?.close(1000)
      this.raw = undefined
    }
    this.main = socket
    if (serial) this.serial = serial
    this.status = undefined
    this.heard()
    this.opts.log.info({ serial: this.serial }, 'Label printer connected')
    void send(socket, JSON.stringify(ALERTS)).catch(() => undefined)
    clearInterval(this.everyTimer)
    this.everyTimer = setInterval(() => void this.check().catch(() => undefined), this.statusEveryMs)
    void this.check().catch(() => undefined)
  }

  private onMain(text: string) {
    this.heard()
    const msg = parse(text)
    const alert = msg?.alert as Record<string, unknown> | undefined
    if (!alert) return
    // Anything it says changed (the head opened or closed, labels out, a job done): ask how it is now, once things settle.
    clearTimeout(this.soonTimer)
    this.soonTimer = setTimeout(() => void this.check().catch(() => undefined), 500)
  }

  /** Heard from now. Kept in the database at most once a minute, or when its name is first known. */
  private heard() {
    this.lastSeen = new Date()
    if (!this.serial) return
    const stale = !this.wrote || this.lastSeen.getTime() - this.wrote.at >= 60_000 || this.wrote.name !== this.name
    if (!stale) return
    this.wrote = { at: this.lastSeen.getTime(), name: this.name }
    void this.opts.seen(this.serial, this.name).catch(() => undefined)
  }

  private wrote: { at: number; name: string | undefined } | undefined

  private lost() {
    this.main = undefined
    this.raw?.close(1000)
    this.raw = undefined
    this.status = undefined
    clearInterval(this.everyTimer)
    clearTimeout(this.soonTimer)
    for (const kind of ['raw', 'config'] as const)
      for (const w of this.waiting[kind].splice(0)) {
        clearTimeout(w.timer)
        w.reject(new PrinterAway('The ZT411 lost its connection.'))
      }
    this.opts.log.info({ serial: this.serial }, 'Label printer disconnected')
  }

  /** Ask the printer, on the main channel, to open a channel, and wait for it to. */
  private open(kind: Kind): Promise<WebSocket> {
    const main = this.main
    if (!main) return Promise.reject(new PrinterAway("The ZT411 isn't connected."))
    return new Promise<WebSocket>((resolve, reject) => {
      const w: Waiting<WebSocket> = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiting[kind] = this.waiting[kind].filter((x) => x !== w)
          reject(new PrinterAway("The ZT411 didn't answer. Check it's on and online, and try again."))
        }, this.answerWaitMs),
      }
      this.waiting[kind].push(w)
      send(main, JSON.stringify({ open: kind === 'raw' ? RAW : CONFIG })).catch((err: Error) => {
        clearTimeout(w.timer)
        this.waiting[kind] = this.waiting[kind].filter((x) => x !== w)
        reject(new PrinterAway(`The ZT411 couldn't be reached: ${err.message}`))
      })
    })
  }

  /** Ask how it is, on a config channel opened for the purpose and closed after. One question at a time. */
  check(): Promise<PrinterStatus | undefined> {
    if (!this.main) return Promise.resolve(undefined)
    this.checking ??= this.ask().finally(() => (this.checking = undefined))
    return this.checking
  }

  private async ask(): Promise<PrinterStatus | undefined> {
    const config = await this.open('config')
    try {
      const answer = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new PrinterAway("The ZT411 didn't say how it is.")), this.answerWaitMs)
        const onMessage = (data: unknown) => {
          const msg = parse(asText(data))
          if (!msg || !('zpl.system_status' in msg)) return
          clearTimeout(timer)
          config.off('message', onMessage)
          resolve(msg)
        }
        config.on('message', onMessage)
        config.once('close', () => {
          clearTimeout(timer)
          reject(new PrinterAway('The ZT411 closed the connection before answering.'))
        })
        send(config, `{}${JSON.stringify(STATUS_QUERY)}`).catch(reject)
      })
      const value = answer['zpl.system_status']
      if (typeof answer['device.friendly_name'] === 'string' && answer['device.friendly_name']) this.name = answer['device.friendly_name']
      if (typeof value === 'string') this.status = readSystemStatus(value)
      this.heard()
      return this.status
    } finally {
      if (config.readyState === config.OPEN) config.close(1000)
    }
  }

  /**
   * Labels to the printer, down the raw channel (opened the first time and kept), a job at a time, each sent whole
   * before the next. Two runs sent at once go one after the other. How it is is asked again a moment after.
   */
  print(jobs: readonly string[]): Promise<void> {
    const run = this.queue.then(async () => {
      if (!this.main) throw new PrinterAway("The ZT411 isn't connected.")
      const raw = this.raw && this.raw.readyState === this.raw.OPEN ? this.raw : await this.open('raw')
      for (const job of jobs) await send(raw, job)
      this.heard()
      clearTimeout(this.soonTimer)
      this.soonTimer = setTimeout(() => void this.check().catch(() => undefined), 1_500)
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Turned off, unpaired or paired again: every connection goes, and the printer is forgotten here. */
  dropAll(reason = 'Turned off') {
    const main = this.main
    this.lost()
    main?.close(1008, reason)
    this.serial = undefined
    this.name = undefined
    this.lastSeen = undefined
  }

  close() {
    this.dropAll('The app is stopping')
  }
}
