import { irishToday, quoteEmailSend, type QuoteEmail, type QuoteEmailPrefill } from '@sh/shared'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { describeDevice } from '../devices.ts'
import { publicOrigin } from '../http.ts'
import { fileNameFor, prefillFor, sendQuote, sheetFor, type Mailer } from './quote-email.ts'
import { quotePdf } from './quote-pdf.ts'
import { getQuote, getQuoteEmailPdf } from './store.ts'
import { Refused, serverChange } from '../kernel.ts'
import { QUOTE_PUT_BACK_ACTION } from '../history-words.ts'
import { restoreQuote } from './handlers.ts'

/**
 * Sending a quote by email (ADR 0101), and the quote as a PDF: for those
 * who see money, as the quote itself is. What the compose box starts with,
 * the send, the PDF of a quote as it stands, and the PDF that went in an
 * earlier email.
 */
export function registerQuoteEmailRoutes(app: FastifyInstance, m: Mailer) {
  const id = (s: string) => s.slice(0, 64)
  const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store')

  app.get<{ Params: { id: string } }>('/api/quotes/:id/email', { config: { needs: 'money' } }, async (req, reply): Promise<QuoteEmailPrefill | void> => {
    noStore(reply)
    const quote = await getQuote(m.db.reads, id(req.params.id))
    if (!quote) return reply.code(404).send({ error: 'That quote is no longer here.' })
    return prefillFor(m, quote, req.user, publicOrigin(req))
  })

  app.post<{ Params: { id: string }; Querystring: { client?: string } }>('/api/quotes/:id/email', { config: { needs: 'money' } }, async (req, reply): Promise<{ email: QuoteEmail } | void> => {
    noStore(reply)
    const body = quoteEmailSend.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Check the addresses, the subject and the message.' })
    const sent = await sendQuote(m, id(req.params.id), body.data, {
      userId: req.user?.id,
      ...(req.user ? { user: { id: req.user.id, email: req.user.email }, staff: req.user } : {}),
      ...(req.role ? { role: req.role, reader: req.reader ?? {} } : {}),
      device: describeDevice(req.headers['user-agent']),
      clientId: typeof req.query.client === 'string' ? req.query.client : undefined,
    })
    if (!sent.ok) return reply.code(sent.code).send({ error: sent.error })
    return { email: sent.email }
  })

  /** The quote as it stands, as the PDF that would go: to look at before sending, or to save and send another way. */
  /**
   * Put a deleted version back (ADR 0131), from the history: an admin's, as deleting it was. Recorded in the history as
   * the server's own change, by whoever asked; every device is sent it back.
   */
  app.post<{ Params: { id: string }; Querystring: { client?: string } }>('/api/quotes/:id/restore', { config: { needs: 'company' } }, async (req, reply) => {
    noStore(reply)
    const quoteId = id(req.params.id)
    const clientId = typeof req.query.client === 'string' ? req.query.client : undefined
    try {
      const q = await serverChange(
        m.db,
        { name: QUOTE_PUT_BACK_ACTION, args: { id: quoteId }, clientId, userId: req.user?.id, device: describeDevice(req.headers['user-agent']) },
        (ctx) => restoreQuote(ctx, quoteId)
      )
      m.onChange?.()
      return { id: q.id, projectId: q.projectId, version: q.version }
    } catch (err) {
      if (err instanceof Refused) return reply.code(err.reason.code === 'not-found' ? 404 : 409).send({ error: err.reason.message })
      throw err
    }
  })

  app.get<{ Params: { id: string } }>('/api/quotes/:id/pdf', { config: { needs: 'money' } }, async (req, reply) => {
    const quote = await getQuote(m.db.reads, id(req.params.id))
    if (!quote) return reply.code(404).send({ error: 'That quote is no longer here.' })
    const sheet = await sheetFor(m.db.reads, quote, irishToday(m.now?.()))
    return sendPdf(reply, await quotePdf(sheet), fileNameFor(quote.number ?? null, sheet.job.name), 'inline')
  })

  /** The PDF that went in an email, as the client got it. */
  app.get<{ Params: { emailId: string } }>('/api/quotes/emails/:emailId/pdf', { config: { needs: 'money' } }, async (req, reply) => {
    const found = await getQuoteEmailPdf(m.db.reads, id(req.params.emailId))
    if (!found) return reply.code(404).send({ error: 'That email is no longer here.' })
    const { rows } = await m.db.reads.query<{ name: string }>('SELECT name FROM projects WHERE id = $1', [found.projectId])
    return sendPdf(reply, found.bytes, fileNameFor(found.number, rows[0]?.name ?? 'Job'), 'attachment')
  })
}

function sendPdf(reply: FastifyReply, data: Buffer, name: string, how: 'inline' | 'attachment') {
  const plain = name.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\x20-\x7e]|["\\]/g, '_')
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return reply
    .type('application/pdf')
    .header('content-disposition', `${how}; filename="${plain}"; filename*=UTF-8''${encoded}`)
    .header('x-content-type-options', 'nosniff')
    .header('cache-control', 'no-store')
    .send(data)
}

