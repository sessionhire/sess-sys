import type { IncomingMessage } from 'node:http'
import { WebSocket } from 'ws'

/**
 * A pretend Zebra ZT411 for the tests (ADR 0191), behaving as the real one
 * does over WebLink, as far as Zebra's notes say:
 *
 * - it connects out to its location with the subprotocol
 *   v1.weblink.zebra.com, first with no password, and gives the user name
 *   and password from its setup file only when the server answers 401;
 * - it wants Content-Length: 0 on the server's 101, and leaves if it isn't;
 * - its first message is its discovery packet, its serial number in it;
 * - asked on the main channel to {"open":"v1.raw.zebra.com"} (or config), it
 *   opens a new connection with that subprotocol and says
 *   {"unique_id","channel_name","channel_id"};
 * - raw takes ZPL; config takes `{}{"setting":null,…}` and answers in JSON,
 *   then closes, as printers are seen to;
 * - a text frame from the server is refused with 1003, as the printer does;
 * - alerts it was asked for come on the main channel.
 *
 * Run on its own against a running app with `npm run printer:pretend -w server`.
 */

export interface FakeOptions {
  /** The location, as in its setup file: https://…/api/printer/weblink/ (ws:// or http:// for a local app). */
  location: string
  user?: string
  password: string
  serial?: string
  name?: string
}

export function discoveryPacket(serial: string): string {
  const bytes = Buffer.alloc(400)
  bytes.write(':,.', 0, 'latin1')
  bytes.write('ZT411-300dpi', 12, 'latin1')
  bytes.write(serial.padEnd(12, '\0'), 188, 'latin1')
  return bytes.toString('base64')
}

export class FakeZt411 {
  readonly serial: string
  name: string
  /** As zpl.system_status gives it: paused flag, error flag, errors (group 2, 1), warning flag, warnings (group 2, 1). */
  systemStatus = '0,0,00000000,00000000,0,00000000,00000000'
  /** Every byte sent down a raw channel, as text. */
  readonly printed: string[] = []
  /** Every message sent on the main channel. */
  readonly onMain: unknown[] = []
  /** What went wrong, as the printer's WebLink log would say it. */
  readonly log: string[] = []
  /** Settings asked for on config channels. */
  readonly asked: string[][] = []
  /** Whether the server asked for a password before letting it in. */
  askedForPassword = false
  private main: WebSocket | undefined
  private channels = 1
  private sockets = new Set<WebSocket>()

  constructor(private readonly opts: FakeOptions) {
    this.serial = opts.serial ?? '99J204700123'
    this.name = opts.name ?? 'ZT411 warehouse'
  }

  private url() {
    return this.opts.location.replace(/^http/, 'ws')
  }

  private auth() {
    return `Basic ${Buffer.from(`${this.opts.user ?? 'zt411'}:${this.opts.password}`).toString('base64')}`
  }

  /** Channels the server asked for but then wouldn't let in, as when it is turned off a moment after asking. */
  refused: string[] = []

  /** One connection, as the printer makes it: without a password, then with it when asked. */
  private dial(protocol: string): Promise<WebSocket> {
    const attempt = (withPassword: boolean) =>
      new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(this.url(), protocol, withPassword ? { headers: { authorization: this.auth() } } : {})
        ws.on('upgrade', (res: IncomingMessage) => {
          if (res.headers['content-length'] !== '0') {
            this.log.push('Content-Length was not 0 on the upgrade')
            ws.terminate()
          }
          if (res.headers['sec-websocket-protocol'] !== protocol) this.log.push(`Server said protocol ${String(res.headers['sec-websocket-protocol'])}`)
        })
        ws.on('unexpected-response', (_req, res) => {
          if (res.statusCode === 401 && !withPassword) {
            this.askedForPassword = /basic/i.test(String(res.headers['www-authenticate']))
            resolve(attempt(true))
          } else reject(new Error(`HTTP ${res.statusCode}`))
          res.resume()
        })
        ws.on('open', () => {
          this.sockets.add(ws)
          ws.on('close', () => this.sockets.delete(ws))
          resolve(ws)
        })
        ws.on('error', (err) => reject(err))
      })
    return attempt(false)
  }

  /** Connect as it does when it starts: the main channel, then its discovery packet. Resolves once it's sent. */
  async connect(): Promise<void> {
    const main = await this.dial('v1.weblink.zebra.com')
    this.main = main
    main.on('message', (data, isBinary) => {
      if (!isBinary) {
        this.log.push('Text frame on the main channel')
        main.close(1003)
        return
      }
      const msg = JSON.parse(data.toString()) as Record<string, unknown>
      this.onMain.push(msg)
      // A channel asked for just as the server turns the printer away is refused (503 or 401), as on a real printer.
      const open = (kind: 'raw' | 'config') => this.channel(kind).catch((err: Error) => this.refused.push(`${kind}: ${err.message}`))
      if (msg.open === 'v1.raw.zebra.com') void open('raw')
      if (msg.open === 'v1.config.zebra.com') void open('config')
    })
    main.send(JSON.stringify({ discovery_b64: discoveryPacket(this.serial) }))
  }

  private async channel(kind: 'raw' | 'config') {
    const protocol = kind === 'raw' ? 'v1.raw.zebra.com' : 'v1.config.zebra.com'
    const ws = await this.dial(protocol)
    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        this.log.push(`Text frame on the ${kind} channel`)
        ws.close(1003)
        return
      }
      const text = data.toString()
      if (kind === 'raw') {
        this.printed.push(text)
        return
      }
      const json = JSON.parse(text.replace(/^\{\}/, '')) as Record<string, null>
      const keys = Object.keys(json)
      this.asked.push(keys)
      const values: Record<string, string> = { 'zpl.system_status': this.systemStatus, 'device.friendly_name': this.name, 'device.unique_id': this.serial }
      ws.send(JSON.stringify(Object.fromEntries(keys.map((k) => [k, values[k] ?? null]))))
      setTimeout(() => ws.close(1000), 5)
    })
    this.channels += 1
    ws.send(JSON.stringify({ unique_id: this.serial, channel_name: protocol, channel_id: String(this.channels) }))
  }

  /** Something happened at the printer, said on the main channel as an alert. */
  alert(condition: string, state: 'SET' | 'CLEAR') {
    this.main?.send(
      JSON.stringify({ alert: { unique_id: this.serial, time_stamp: '2026-11-23 10:00:00', type_id: 'ERROR', condition_id: condition, condition_state: state, type: 'ERROR CONDITION', condition } })
    )
  }

  /** The labels as one string, everything sent down raw channels so far. */
  get zpl() {
    return this.printed.join('')
  }

  get connected() {
    return this.main?.readyState === WebSocket.OPEN
  }

  /** Waits for the main connection to close, as when the server turns it away. */
  closed(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.main || this.main.readyState === WebSocket.CLOSED) return resolve(0)
      this.main.once('close', (code) => resolve(code))
    })
  }

  close() {
    for (const ws of this.sockets) ws.terminate()
  }
}

// On its own: npm run printer:pretend -w server -- <location> <password> [serial]
if (process.argv[1]?.endsWith('fake-zt411.ts') && process.argv[2]) {
  const [, , location, password = '', serial] = process.argv
  const printer = new FakeZt411({ location: location!, password, serial })
  printer
    .connect()
    .then(() => console.log(`Pretend ZT411 ${printer.serial} connected to ${location}. Labels it's sent are shown here; Ctrl+C to stop.`))
    .catch((err: Error) => {
      console.error(`Couldn't connect: ${err.message}`)
      process.exit(1)
    })
  setInterval(() => {
    while (printer.printed.length) console.log(printer.printed.shift())
  }, 500)
}
