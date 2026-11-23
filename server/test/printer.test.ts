import type { AddressInfo } from 'node:net'
import { X509Certificate } from 'node:crypto'
import { rootCertificates } from 'node:tls'
import { readSystemStatus, printerWords, type PrinterSetup, type PrinterState } from '@sh/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { caDownload, rootFor, setupFile } from '../src/printer/setup.ts'
import { serialFromDiscovery } from '../src/printer/weblink.ts'
import { discoveryPacket, FakeZt411 } from './fake-zt411.ts'
import { server, staff, WINDOWS } from './people.ts'

/**
 * The label printer over the internet (ADR 0191): the ZT411 connects out to the app with Zebra's WebLink, with the
 * password from the setup file Admin makes, and the app sends it labels and asks how it is. Tested against a pretend
 * printer that keeps to WebLink as Zebra describes it (fake-zt411.ts).
 */

const printers: FakeZt411[] = []
afterEach(() => {
  for (const p of printers.splice(0)) p.close()
})

const ROOT = rootCertificates[0]!
const LABEL = '^XA^FO10,10^FDSH-000123^FS^XZ\n'

async function setUp() {
  const { app, db } = await server({ printer: { findCa: async () => ({ pem: ROOT, name: 'Test root' }), answerWaitMs: 2_000 } })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const port = (app.server.address() as AddressInfo).port
  const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
  const call = async <T,>(method: 'GET' | 'POST', url: string, payload?: object) => {
    const res = await app.inject({ method, url, cookies: colly.cookies, ...(payload === undefined ? {} : { payload }) } as const)
    return { status: res.statusCode, body: res.json() as T }
  }
  const location = `http://127.0.0.1:${port}/api/printer/weblink/`
  const printer = (password: string, serial?: string) => {
    const p = new FakeZt411({ location, password, serial })
    printers.push(p)
    return p
  }
  const state = async () => (await call<PrinterState>('GET', '/api/printer')).body
  const until = async (test: (s: PrinterState) => boolean) => {
    for (let i = 0; i < 100; i++) {
      const s = await state()
      if (test(s)) return s
      await new Promise((r) => setTimeout(r, 30))
    }
    throw new Error(`Never came: ${JSON.stringify(await state())}`)
  }
  const pair = async () => {
    await call('POST', '/api/printer/use', { on: true })
    const { body } = await call<PrinterSetup>('POST', '/api/printer/pair')
    const password = /authentication\.add" "\S+ zt411 (\S+)"/.exec(body.file)![1]!
    return { setup: body, password }
  }
  return { app, db, call, printer, state, until, pair }
}

describe('the setup file', () => {
  it('turns WebLink off a moment, sets the password and the address, loads the certificate and restarts', () => {
    const file = setupFile({ origin: 'https://server.letissier.ie', secret: 'abc_DEF-123', ca: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----' })
    expect(file.split('\r\n')).toEqual([
      '! U1 setvar "weblink.ip.conn1.location" ""',
      '! U1 setvar "weblink.ip.conn1.authentication.remove" "server.letissier.ie"',
      '! U1 setvar "weblink.ip.conn1.authentication.add" "server.letissier.ie zt411 abc_DEF-123"',
      '! U1 setvar "weblink.ip.conn1.retry_interval" "10"',
      '! U1 setvar "weblink.logging.max_entries" "100"',
      '! U1 setvar "weblink.ip.conn1.location" "https://server.letissier.ie/api/printer/weblink/"',
      '~DYE:WEBLINK1_CA,B,NRD,59,,-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n! U1 do "device.reset" ""',
      '',
    ])
  })

  it('takes its address from the app, so a new domain gives a new file', () => {
    expect(setupFile({ origin: 'https://app.sessionhire.com/', secret: 's' })).toContain('"https://app.sessionhire.com/api/printer/weblink/"')
    expect(setupFile({ origin: 'https://app.sessionhire.com', secret: 's' })).toContain('"app.sessionhire.com zt411 s"')
  })

  it('counts the certificate in bytes, as ~DY wants', () => {
    expect(caDownload('é\r\n')).toBe('~DYE:WEBLINK1_CA,B,NRD,3,,é\n')
  })

  it('finds the trusted root behind a certificate, or says it can’t', () => {
    const root = new X509Certificate(ROOT)
    expect(rootFor(root)).toEqual({ pem: root.toString(), name: expect.any(String) })
    const other = new X509Certificate(rootCertificates[1]!)
    expect(rootFor(other, [ROOT])).toMatchObject({ problem: expect.stringContaining("isn't one Node trusts") })
  })
})

describe('reading the printer', () => {
  it('reads the serial number from its discovery packet', () => {
    expect(serialFromDiscovery(discoveryPacket('99J204700123'))).toBe('99J204700123')
    expect(serialFromDiscovery(Buffer.alloc(50).toString('base64'))).toBeUndefined()
  })

  it('reads its status as ~HQES gives it, in words', () => {
    const at = new Date('2026-11-23T10:00:00Z')
    expect(readSystemStatus('0,0,00000000,00000000,0,00000000,00000000', at)).toEqual({ ready: true, problems: [], warnings: [], at: at.toISOString() })
    expect(readSystemStatus('"1","1","00000000","00000005","1","00000000","00000008"', at)).toMatchObject({ ready: false, problems: ['mediaOut', 'headOpen', 'paused'], warnings: ['mediaLow'] })
    const ready = { on: true, paired: true, connected: true }
    expect(printerWords({ ...ready, status: readSystemStatus('0,0,00000000,00000000,0,00000000,00000000') })).toEqual({ tone: 'confirmed', pill: 'Ready' })
    expect(printerWords({ ...ready, status: readSystemStatus('0,1,00000000,00000004,0,00000000,00000000') })).toMatchObject({ tone: 'bad', pill: 'Head open', help: expect.stringContaining('Close the print head') })
    expect(printerWords({ ...ready, status: readSystemStatus('0,0,00000000,00000000,1,00000000,00000008') })).toEqual({ tone: 'pending', pill: 'Ready', help: 'Labels running low.' })
    expect(printerWords({ ...ready, connected: false })).toMatchObject({ tone: 'cancelled', pill: 'Not connected' })
  })
})

describe('the printer over WebLink (ADR 0191)', () => {
  it('lets nothing connect while it is off, or without the password', async () => {
    const { printer, pair, call } = await setUp()
    await expect(printer('anything').connect()).rejects.toThrow('HTTP 503')
    await pair()
    const wrong = printer('not-the-password')
    await expect(wrong.connect()).rejects.toThrow('HTTP 401')
    expect(wrong.askedForPassword).toBe(true)
    // Anyone signed in sees how it is; making the file or turning it on is for settings.
    expect((await call('GET', '/api/printer')).status).toBe(200)
  })

  it('connects with the setup file’s password, says how it is, and prints', async () => {
    const { printer, pair, until, call } = await setUp()
    const { setup, password } = await pair()
    expect(setup.certificate).toBe(ROOT)
    expect(setup.file).toContain('~DYE:WEBLINK1_CA,B,NRD,')
    const zt = printer(password)
    await zt.connect()
    const s = await until((s) => !!s.status)
    expect(s).toMatchObject({ on: true, paired: true, connected: true, serial: zt.serial, name: 'ZT411 warehouse', status: { ready: true, problems: [] } })
    expect(zt.askedForPassword).toBe(true)
    expect(zt.log).toEqual([])
    // It asked to be told of every change, in bytes as the printer wants them.
    expect(zt.onMain).toContainEqual({ configure_alert: 'ALL MESSAGES,SDK,Y,Y,,,N' })
    expect(zt.asked[0]).toEqual(['zpl.system_status', 'device.friendly_name', 'device.unique_id'])

    const printed = await call<PrinterState>('POST', '/api/printer/print', { jobs: [LABEL, LABEL] })
    expect(printed.status).toBe(200)
    await until(() => zt.zpl === LABEL + LABEL)
    expect(zt.log).toEqual([])
  })

  it('shows the head open as soon as the printer says, and ready again once it is shut', async () => {
    const { printer, pair, until } = await setUp()
    const zt = printer((await pair()).password)
    await zt.connect()
    await until((s) => s.status?.ready === true)
    zt.systemStatus = '0,1,00000000,00000004,0,00000000,00000000'
    zt.alert('HEAD OPEN', 'SET')
    expect((await until((s) => s.status?.ready === false)).status!.problems).toEqual(['headOpen'])
    zt.systemStatus = '0,0,00000000,00000000,0,00000000,00000000'
    zt.alert('HEAD OPEN', 'CLEAR')
    await until((s) => s.status?.ready === true)
  })

  it('keeps to the first printer that connects after pairing', async () => {
    const { printer, pair, until } = await setUp()
    const { password } = await pair()
    const first = printer(password, '99J204700123')
    await first.connect()
    await until((s) => s.serial === '99J204700123' && s.connected)
    const other = printer(password, '11A111111111')
    await other.connect()
    expect(await other.closed()).toBe(1008)
    expect((await until((s) => s.connected)).serial).toBe('99J204700123')
  })

  it('turns the printer away when printing over the internet is turned off, forgotten, or paired again', async () => {
    const { printer, pair, until, call } = await setUp()
    const { password } = await pair()
    const zt = printer(password)
    await zt.connect()
    await until((s) => s.connected)
    const gone = zt.closed()
    expect((await call<PrinterState>('POST', '/api/printer/use', { on: false })).body).toMatchObject({ on: false, connected: false })
    expect(await gone).toBe(1008)
    expect((await call('POST', '/api/printer/print', { jobs: [LABEL] })).status).toBe(409)

    const again = await pair()
    await expect(printer(password).connect()).rejects.toThrow('HTTP 401')
    const zt2 = printer(again.password, '55B555555555')
    await zt2.connect()
    expect((await until((s) => s.connected)).serial).toBe('55B555555555')
    await call('POST', '/api/printer/forget')
    expect(await zt2.closed()).toBe(1008)
    expect(await (async () => (await call<PrinterState>('GET', '/api/printer')).body)()).toMatchObject({ on: true, paired: false, connected: false })
  })

  it('says the printer is away rather than pretending to print', async () => {
    const { pair, call } = await setUp()
    await pair()
    const res = await call<{ error: string }>('POST', '/api/printer/print', { jobs: [LABEL] })
    expect(res).toEqual({ status: 503, body: { error: "The ZT411 isn't connected." } })
    expect((await call('POST', '/api/printer/print', { jobs: ['hello'] })).status).toBe(400)
  })
})
