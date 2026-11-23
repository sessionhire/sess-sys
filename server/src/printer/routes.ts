import { WEBLINK_PATH, type PrinterSetup, type PrinterState } from '@sh/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { IncomingMessage } from 'node:http'
import type { Db } from '../db.ts'
import { publicOrigin } from '../http.ts'
import { basicPassword, findRootCa, hashSecret, newSecret, secretMatches, setupFile, weblinkAddress } from './setup.ts'
import { forgetPrinter, getPrinter, lockSerial, pairPrinter, printerSeen, setPrinterUsed } from './store.ts'
import { PrinterAway, WebLink } from './weblink.ts'

/**
 * The label printer over the internet (ADR 0191). Admin › Connections ›
 * Label printer turns it on and makes the printer's setup file; anyone signed
 * in sees how the printer is beside Print, and whoever looks after stock
 * prints. The printer itself connects at WEBLINK_PATH, which is open to the
 * internet the way the trackers' address is, and lets in only a request
 * carrying the password from the setup file, only while printing over the
 * internet is on, and, once a printer has connected, only that printer.
 */

/** As many connections a minute as the printer makes when it's struggling (one every 10 seconds, and its channels), with room. */
const WEBLINK_LIMIT = { max: 120, timeWindow: 60_000 }
/** The most labels' worth of ZPL in one request: what the app sends is a hundred labels a job, a few jobs a request. */
const MAX_JOBS = 20

export interface PrinterOptions {
  db: Db
  log: FastifyInstance['log']
  /** Finds the certificate authority behind the app's address; tests give their own. */
  findCa?: typeof findRootCa
  /** For tests: how long to wait for the printer. */
  answerWaitMs?: number
  statusEveryMs?: number
}

export function registerPrinterRoutes(app: FastifyInstance, { db, log, findCa = findRootCa, answerWaitMs, statusEveryMs }: PrinterOptions): WebLink {
  const hub = new WebLink({
    allowed: async () => (await getPrinter(db.reads)).serial ?? undefined,
    lock: async (serial) => {
      if (await lockSerial(db, serial)) return
      const kept = (await getPrinter(db)).serial
      if (kept !== serial) throw new Error(`Printer ${serial} is not the paired one`)
    },
    seen: (serial, name) => printerSeen(db, serial, name),
    log,
    answerWaitMs,
    statusEveryMs,
  })
  app.addHook('onClose', async () => hub.close())

  // The printer wants Content-Length: 0 on the answer that turns its request into a WebSocket, or it drops the
  // connection; the subprotocol it asked for (v1.weblink.zebra.com, or a channel's) is said back by the library itself.
  app.websocketServer?.on('headers', (headers: string[], req: IncomingMessage) => {
    if (req.url?.split('?')[0] === WEBLINK_PATH) headers.push('Content-Length: 0')
  })

  const state = async (req: FastifyRequest): Promise<PrinterState> => {
    const row = await getPrinter(db.reads)
    const live = hub.snapshot()
    const connected = row.used && live.connected
    const serial = live.serial ?? row.serial ?? undefined
    const name = live.name ?? row.name ?? undefined
    const lastSeen = live.lastSeen ?? row.lastSeen ?? undefined
    return {
      on: row.used,
      paired: !!row.secretHash,
      address: weblinkAddress(publicOrigin(req)),
      ...(row.pairedOrigin ? { pairedAddress: weblinkAddress(row.pairedOrigin) } : {}),
      ...(serial ? { serial } : {}),
      ...(name ? { name } : {}),
      connected,
      ...(lastSeen ? { lastSeen } : {}),
      ...(connected && live.status ? { status: live.status } : {}),
    }
  }

  // The printer's way in. A request without the password is asked for it (401), as the printer expects; it answers
  // with the user name and password from its setup file.
  const letIn = async (req: FastifyRequest, reply: FastifyReply) => {
    const row = await getPrinter(db.reads)
    if (!row.used) return reply.code(503).send({ error: 'Printing over the internet is off in the app.' })
    if (!secretMatches(basicPassword(req.headers.authorization) ?? '', row.secretHash))
      return reply.code(401).header('www-authenticate', 'Basic realm="Session Hire label printer"').send({ error: 'The printer needs its password.' })
  }
  app.get(WEBLINK_PATH, { websocket: true, preValidation: letIn, config: { public: true, rateLimit: WEBLINK_LIMIT } }, (socket) => hub.take(socket))

  app.get('/api/printer', async (req): Promise<PrinterState> => state(req))

  app.post<{ Body: { on?: unknown } }>('/api/printer/use', { config: { needs: 'settings' } }, async (req, reply) => {
    if (typeof req.body?.on !== 'boolean') return reply.code(400).send({ error: 'Say on or off.' })
    await setPrinterUsed(db, req.body.on)
    if (!req.body.on) hub.dropAll()
    return state(req)
  })

  // A new setup file, with a new password: the printer's old one stops working, and the next printer to connect with
  // the new one is the paired printer. The password is in the answer and nowhere else.
  app.post('/api/printer/pair', { config: { needs: 'settings' } }, async (req, reply): Promise<PrinterSetup | undefined> => {
    const origin = publicOrigin(req)
    const url = new URL(origin)
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
      return reply.code(400).send({ error: `The app's address (${origin}) isn't https, and the printer only connects securely. Set PUBLIC_URL.` })
    const secret = newSecret()
    const ca = await findCa(origin)
    await pairPrinter(db, hashSecret(secret), origin)
    hub.dropAll('Paired again')
    return {
      file: setupFile({ origin, secret, ...('pem' in ca ? { ca: ca.pem } : {}) }),
      ...('pem' in ca ? { certificate: ca.pem } : { noCertificate: ca.problem }),
      state: await state(req),
    }
  })

  app.post('/api/printer/forget', { config: { needs: 'settings' } }, async (req) => {
    await forgetPrinter(db)
    hub.dropAll('Forgotten')
    return state(req)
  })

  // How it is now, asked of the printer rather than remembered.
  app.post('/api/printer/check', async (req) => {
    await hub.check().catch(() => undefined)
    return state(req)
  })

  app.post<{ Body: { jobs?: unknown } }>('/api/printer/print', { config: { needs: 'stock' } }, async (req, reply) => {
    const jobs = req.body?.jobs
    if (!Array.isArray(jobs) || jobs.length === 0 || jobs.length > MAX_JOBS || !jobs.every((j) => typeof j === 'string' && j.includes('^XA')))
      return reply.code(400).send({ error: 'Those are not labels for the printer.' })
    const row = await getPrinter(db.reads)
    if (!row.used) return reply.code(409).send({ error: 'Printing over the internet is off: turn it on under Admin › Connections › Label printer.' })
    try {
      await hub.print(jobs as string[])
    } catch (err) {
      if (err instanceof PrinterAway) return reply.code(503).send({ error: err.message })
      throw err
    }
    return state(req)
  })

  return hub
}
