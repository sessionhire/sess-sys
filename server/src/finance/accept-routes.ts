import { ACCEPT_NAME_LENGTH, irishToday, validUntil, type Quote } from '@sh/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Db, Queryable } from '../db.ts'
import { describeDevice } from '../devices.ts'
import { QUOTE_ONLINE_ACTION } from '../history-words.ts'
import { SIGN_IN_LIMIT } from '../http.ts'
import { emit, serverChange } from '../kernel.ts'
import { officeFor } from '../office/store.ts'
import { renderAcceptClosed, renderAcceptPage, type AcceptPage, type Standing } from './accept-page.ts'
import { fileNameFor, sheetFor } from './quote-email.ts'
import { quotePdf } from './quote-pdf.ts'
import { getQuote, getQuoteSettings, quoteByToken, quotesOf } from './store.ts'

/**
 * The client accepts a quote online (ADR 0121). Each version has a key of
 * its own, given when it's started, and its link, /q/<key>, is the only
 * credential, as a freelancer's is (ADR 0002). The link shows the quote as
 * it is now, and while it's with the client, its prices hold and nothing
 * newer has gone, a name and a tick accept it: the quote is marked
 * accepted as the office would mark it, with who typed their name and
 * when, in the history and on the quote.
 *
 * Off until the office turns it on under Admin (ADR 0048): until then the
 * link shows nothing of any quote, and takes nothing. The app sends
 * nothing here: the link reaches the client only in an email the office
 * sends, or pastes.
 */

class NotOpen extends Error {}

type Req = FastifyRequest<{ Params: { token: string } }>

/** Where a version stands for its client: accepted or turned down, replaced by a newer one, its prices run out, or open. */
export async function standingOf(q: Queryable, quote: Quote, today: string): Promise<Standing> {
  if (quote.status === 'draft') return 'draft'
  const versions = await quotesOf(q, quote.projectId)
  const current = versions.find((v) => v.invoicedOn) ?? versions.find((v) => v.status !== 'draft') ?? versions[0]
  if (current && current.id !== quote.id) return 'replaced'
  if (quote.status === 'accepted') return 'accepted'
  if (quote.status === 'declined') return 'declined'
  return validUntil(quote, today) < today ? 'lapsed' : 'open'
}

export function registerAcceptRoutes(app: FastifyInstance, db: Db, { onChange, now = () => new Date(), logo }: { onChange?: () => void; now?: () => Date; logo?: () => Promise<{ data: Buffer; type: string } | undefined> } = {}) {
  const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store').header('x-robots-tag', 'noindex')
  const html = (reply: FastifyReply, body: string, code = 200) => noStore(reply).code(code).type('text/html').send(body)

  /** The quote the link opens, while the office takes answers online; undefined for a link that opens nothing. */
  async function opened(req: Req): Promise<{ quote: Quote } | { closed: boolean }> {
    const quote = await quoteByToken(db.reads, req.params.token)
    if (!quote) return { closed: false }
    if (!(await getQuoteSettings(db.reads))?.acceptOnline) return { closed: true }
    return { quote }
  }

  async function show(req: Req, reply: FastifyReply, quote: Quote, extra: Pick<AcceptPage, 'typed' | 'wrong'> = {}, code = 200) {
    const today = irishToday(now())
    const [sheet, standing, office] = await Promise.all([sheetFor(db.reads, quote, today), standingOf(db.reads, quote, today), officeFor(db.reads)])
    return html(reply, renderAcceptPage({ sheet, standing, base: `/q/${req.params.token}`, office, ...extra }, validUntil(quote, today)), code)
  }

  app.get('/q/:token', async (req: Req, reply) => {
    const found = await opened(req)
    if (!('quote' in found)) return html(reply, renderAcceptClosed(await officeFor(db.reads), found.closed), 404)
    return show(req, reply, found.quote)
  })

  /** The company's logo on the client's PDF too (ADR 0139), when there is one. */
  const logoOrNot = async () => {
    const l = await logo?.().catch(() => undefined)
    return l ? { logo: l } : {}
  }

  /** The quote as the PDF the office would send, as it stands now. */
  app.get('/q/:token/pdf', async (req: Req, reply) => {
    const found = await opened(req)
    if (!('quote' in found) || found.quote.status === 'draft') return html(reply, renderAcceptClosed(await officeFor(db.reads), 'quote' in found || found.closed), 404)
    const sheet = await sheetFor(db.reads, found.quote, irishToday(now()))
    const name = fileNameFor(found.quote.number ?? null, sheet.job.name)
    const plain = name.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\x20-\x7e]|["\\]/g, '_')
    return noStore(reply)
      .type('application/pdf')
      .header('content-disposition', `inline; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name)}`)
      .send(await quotePdf({ ...sheet, ...(await logoOrNot()) }))
  })

  app.post<{ Params: { token: string }; Body: URLSearchParams }>('/q/:token', { config: { rateLimit: SIGN_IN_LIMIT } }, async (req, reply) => {
    const found = await opened(req)
    if (!('quote' in found)) return html(reply, renderAcceptClosed(await officeFor(db.reads), found.closed), 404)
    const form = req.body instanceof URLSearchParams ? req.body : new URLSearchParams()
    const name = (form.get('name') ?? '').replace(/\s+/g, ' ').trim().slice(0, ACCEPT_NAME_LENGTH)
    const agreed = form.get('agree') === 'yes'
    const today = irishToday(now())
    const typed = { name, agreed }
    // Two letters at least, as a name is; the tick is the yes.
    if (name.replace(/[^\p{L}]/gu, '').length < 2) return show(req, reply, found.quote, { typed, wrong: 'name' }, 422)
    if (!agreed) return show(req, reply, found.quote, { typed, wrong: 'agree' }, 422)

    const quote = found.quote
    const took = await serverChange(
      db,
      { name: QUOTE_ONLINE_ACTION, args: { id: quote.id, projectId: quote.projectId, name }, clientId: 'server', device: describeDevice(req.headers['user-agent']) },
      async (ctx) => {
        // Looked at again inside the change, as two presses or the office's own answer could have come first.
        const now = await getQuote(ctx.tx, quote.id, true)
        // Thrown, so the history's line goes back with it: nothing was accepted.
        if (!now || (await standingOf(ctx.tx, now, today)) !== 'open') throw new NotOpen()
        await ctx.tx.query(`UPDATE quotes SET status = 'accepted', answered_on = $2, accepted_name = $3, accepted_at = now() WHERE id = $1`, [quote.id, today, name])
        await emit(ctx, 'quote', quote.id, await getQuote(ctx.tx, quote.id))
        return true
      }
    ).catch((err: unknown) => {
      if (err instanceof NotOpen) return false
      throw err
    })
    if (!took) {
      // Already accepted on this link (a second press) is a yes; anything else, the page as it stands, saying so.
      const again = await getQuote(db.reads, quote.id)
      if (again?.status === 'accepted') return reply.redirect(`/q/${req.params.token}`, 303)
      return show(req, reply, again ?? quote, { typed, wrong: 'gone' }, 409)
    }
    onChange?.()
    return reply.redirect(`/q/${req.params.token}`, 303)
  })
}
