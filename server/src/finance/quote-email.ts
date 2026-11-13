import { randomBytes } from 'node:crypto'
import { Resolver } from 'node:dns/promises'
import { acceptPath, likelyAddress, depositCents, irishToday, letterDay, money, newId, OFFICE_SETTING_ID, quoteTotals, spanLabel, validUntil, type Quote, type QuoteEmail, type QuoteEmailPrefill, type QuoteEmailSend, type QuoteAddressCheck, type QuoteSendState, type StaffUser } from '@sh/shared'
import { GoogleError } from '../calendar/google.ts'
import { applyMutation, type From } from '../commands.ts'
import { numberIt } from './handlers.ts'
import type { Db, Queryable } from '../db.ts'
import { QUOTE_EMAIL_ACTION } from '../history.ts'
import { emit, serverChange } from '../kernel.ts'
import type { Mailbox } from '../assistant/mailbox.ts'
import { getSetting } from '../office/store.ts'
import { getClient, getProject, getVenue } from '../projects/store.ts'
import { quotePdf, type Sheet } from './quote-pdf.ts'
import { getQuote, getQuoteEmail, getQuoteEmailByKey, getQuoteSettings, highestNumber, quotesOf } from './store.ts'

/**
 * Sending a quote to the client by email (ADR 0101), from the operations
 * mailbox the office connected (ADR 0098), with the quote as a PDF
 * attached. The office opens a compose box filled in from the quote and
 * the client's contacts, changes what it likes and presses Send; the
 * server gives the quote its number, draws the PDF, sends through Gmail as
 * operations@, and only once Gmail has taken it marks the quote sent
 * (ADR 0130) and keeps a record of what went,
 * which every device sees on the quote. Replies go to whoever sent it and
 * to operations@, so the thread stays in the mailbox Claude reads.
 *
 * Nothing goes until the office has turned it on under Admin, as with
 * every way the app reaches anyone outside it (ADR 0048).
 */

export interface Mailer {
  db: Db
  mailbox: Mailbox
  /** Told once a record is written, so devices come for it. */
  onChange?: () => void
  now?: () => Date
  /** The company's logo for the top of the PDF (ADR 0128), if there is one. */
  logo?: () => Promise<{ data: Buffer; type: string } | undefined>
  /** Whether a domain takes email (ADR 0171): true, false, or undefined when it couldn't be told. The DNS by default. */
  mx?: (domain: string) => Promise<boolean | undefined>
  /** How long after a read-back finds nothing it's tried again; 0 doesn't. */
  recheckMs?: number
}

/** Who pressed Send, as the push route knows them, and the device code for the history. */
export interface Sender extends From {
  staff?: StaffUser | null
  clientId?: string
}

export type SendResult = { ok: true; email: QuoteEmail } | { ok: false; code: number; error: string }

/** The company's own address the quotes go out from, until the mailbox says otherwise. */
export const OPERATIONS_ADDRESS = 'operations@sessionhire.com'
const COMPANY = 'Session Hire'

/** Everything the PDF shows, read for a quote. */
export async function sheetFor(q: Queryable, quote: Quote, today: string): Promise<Sheet> {
  const project = await getProject(q, quote.projectId)
  const [client, venue, office, quoting, span] = await Promise.all([
    project?.clientId ? getClient(q, project.clientId) : undefined,
    project?.venueId ? getVenue(q, project.venueId) : undefined,
    getSetting(q, OFFICE_SETTING_ID),
    getQuoteSettings(q),
    spanOf(q, quote.projectId),
  ])
  return {
    q: quote,
    totals: quoteTotals(quote),
    job: { name: project?.name ?? 'Job', span, venue: venue ?? undefined, client: client ?? undefined },
    office,
    quoting: { terms: quoting?.terms ?? '', bank: quoting?.bank ?? '' },
    today,
  }
}

async function spanOf(q: Queryable, projectId: string): Promise<{ start: string; end: string } | undefined> {
  const { rows } = await q.query<{ a: string | null; b: string | null }>('SELECT min(start_day)::text AS a, max(end_day)::text AS b FROM phases WHERE project_id = $1', [projectId])
  const r = rows[0]
  return r?.a && r.b ? { start: r.a.slice(0, 10), end: r.b.slice(0, 10) } : undefined
}

/** The number the quote has, or the one it will get when it goes, worked out as the handler will (finance/handlers.ts, numberIt). */
export async function numberFor(q: Queryable, quote: Quote): Promise<number> {
  if (quote.number) return quote.number
  const had = (await quotesOf(q, quote.projectId)).find((v) => v.number)?.number
  if (had) return had
  const settings = await getQuoteSettings(q)
  return Math.max(settings?.nextNumber ?? 1, (await highestNumber(q)) + 1)
}

/** "Quote 1115 - Liffey Brands Launch.pdf": the file as the client saves it, in characters every system takes. */
export function fileNameFor(number: number | null, jobName: string): string {
  const safe = jobName.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\w .()&'-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'quote'
  return `${number ? `Quote ${number}` : 'Draft quote'} - ${safe}.pdf`
}

/** The compose box as it opens: the client's contacts, a subject with the number, a message that says what the quote comes to. */
export async function prefillFor(m: Mailer, quote: Quote, staff: StaffUser | null | undefined, origin?: string): Promise<QuoteEmailPrefill> {
  const today = irishToday(m.now?.())
  const sheet = await sheetFor(m.db.reads, quote, today)
  const number = await numberFor(m.db.reads, quote)
  const settings = await getQuoteSettings(m.db.reads)
  const sender = await m.mailbox.sender().catch((err: unknown) => ({ ok: false as const, why: err instanceof GoogleError ? googleWords(err) : 'The mailbox can’t be reached just now.' }))
  const off = !settings?.emailQuotes
  const to = [...new Set((sheet.job.client?.contacts ?? []).map((c) => c.email?.trim() ?? '').filter(Boolean))].slice(0, 10)
  const contact = sheet.job.client?.contacts.find((c) => c.email?.trim())?.name ?? sheet.job.client?.contacts[0]?.name
  const first = contact?.trim().split(/\s+/)[0]
  const when = sheet.job.span ? ` on ${spanLabel(sheet.job.span)}` : ''
  const holds = `, with prices held until ${letterDay(validUntil({ sentOn: quote.sentOn, validDays: quote.validDays }, today))}`
  const deposit = quote.depositPct ? `A deposit of ${money(depositCents(sheet.totals.gross, quote.depositPct))} confirms the booking.\n\n` : ''
  // The client's link (ADR 0121), only while the office takes answers online and the version has its key.
  const online = settings?.acceptOnline && quote.acceptToken && origin ? `To accept it, use this link: ${origin}${acceptPath(quote.acceptToken)}\n\n` : ''
  const signed = [staff?.name, `${COMPANY}${sheet.office?.phone ? ` · ${sheet.office.phone}` : ''}`].filter(Boolean).join('\n')
  return {
    to,
    subject: `Quote ${number} from ${COMPANY}: ${sheet.job.name}`.slice(0, 200),
    message: `Hi ${first || 'there'},\n\nPlease find our quote for ${sheet.job.name}${when} attached: quote ${number}, ${money(sheet.totals.gross)} including VAT${holds}.\n\n${deposit}${online}Any questions, just reply to this email.\n\nKind regards,\n${signed}`.slice(0, 4000),
    from: sender.ok ? sender.account : null,
    fileName: fileNameFor(number, sheet.job.name),
    number,
    canSend: !off && sender.ok,
    why: off ? 'Sending quotes by email is off. Turn it on under Admin › Connections › The operations mailbox.' : sender.ok ? null : sender.why,
    me: staff?.email && (!sender.ok || staff.email.toLowerCase() !== sender.account.toLowerCase()) ? staff.email : null,
  }
}

/** A press of Send not heard of for this long, with no email from it, stopped part way: whether it went can't be told. */
export const SEND_HELD_MS = 2 * 60_000

/** Where one press of Send is (ADR 0171), by its key: for a phone that stopped waiting for the answer. */
export async function sendState(q: Queryable, quoteId: string, key: string, now: Date): Promise<QuoteSendState> {
  const email = await getQuoteEmailByKey(q, quoteId, key)
  if (email) return { state: 'sent', email }
  const { rows } = await q.query<{ started_at: Date }>('SELECT started_at FROM quote_email_sends WHERE key = $1 AND quote_id = $2', [key, quoteId])
  if (!rows[0]) return { state: 'none' }
  return now.getTime() - new Date(rows[0].started_at).getTime() < SEND_HELD_MS ? { state: 'sending' } : { state: 'unsure' }
}

/**
 * Reads a sent email back from the mailbox (ADR 0171): once Gmail has filed it in Sent, the record says when, and every
 * device is told. Says whether it's there. Trouble reading is no harm: it's only looked at again.
 */
export async function confirmSent(m: Mailer, emailId: string, token: string, gmailId: string): Promise<boolean> {
  let labels: string[]
  try {
    labels = await m.mailbox.gmail.labels(token, gmailId)
  } catch {
    return false
  }
  if (!labels.includes('SENT')) return false
  const at = m.now?.() ?? new Date()
  await serverChange(m.db, undefined, async (ctx) => {
    const { rows } = await ctx.tx.query('UPDATE quote_emails SET in_sent_at = $2 WHERE id = $1 AND in_sent_at IS NULL RETURNING id', [emailId, at])
    if (rows.length) await emit(ctx, 'quoteEmail', emailId, await getQuoteEmail(ctx.tx, emailId))
  })
  m.onChange?.()
  return true
}

/** Each address as the mail system sees it (ADR 0171): its domain asked once, and a likely spelling for a slip. */
export async function checkAddresses(m: Pick<Mailer, 'mx'>, addresses: string[]): Promise<QuoteAddressCheck[]> {
  const ask = m.mx ?? takesMail
  const domains = [...new Set(addresses.map((a) => a.slice(a.lastIndexOf('@') + 1).toLowerCase()).filter(Boolean))]
  const answers = new Map(await Promise.all(domains.map(async (d) => [d, await ask(d).catch(() => undefined)] as const)))
  return addresses.map((address) => {
    const domain = address.slice(address.lastIndexOf('@') + 1).toLowerCase()
    const suggest = likelyAddress(address)
    return {
      address,
      problem: answers.get(domain) === false ? `${domain} can’t receive email, so it would bounce. Check the spelling.` : null,
      suggest,
    }
  })
}

/** What the DNS says about a domain, kept a while: whether it takes mail, as a sending server would decide. */
const heard = new Map<string, { at: number; takes: boolean | undefined }>()
async function takesMail(domain: string): Promise<boolean | undefined> {
  const known = heard.get(domain)
  if (known && Date.now() - known.at < 60 * 60_000) return known.takes
  const takes = await lookUp(domain)
  if (takes !== undefined) heard.set(domain, { at: Date.now(), takes })
  return takes
}
async function lookUp(domain: string): Promise<boolean | undefined> {
  const r = new Resolver({ timeout: 3000, tries: 1 })
  try {
    const mx = await r.resolveMx(domain)
    // A "null MX" (RFC 7505), one record pointing nowhere, says the domain takes no mail at all.
    return !(mx.length === 1 && (mx[0]!.exchange === '' || mx[0]!.exchange === '.'))
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'ENOTFOUND') return false
    if (code !== 'ENODATA') return undefined
  }
  // No MX record: mail goes to the domain's own address, if it has one (RFC 5321).
  try {
    return (await r.resolve4(domain)).length > 0
  } catch (err) {
    const code = (err as { code?: string }).code
    return code === 'ENOTFOUND' || code === 'ENODATA' ? false : undefined
  }
}

/** Marks the quote sent if it's a draft, draws the PDF, sends it through Gmail from operations@, and records what went. */
export async function sendQuote(m: Mailer, quoteId: string, body: QuoteEmailSend, who: Sender): Promise<SendResult> {
  const now = m.now?.() ?? new Date()
  const today = irishToday(now)
  const settings = await getQuoteSettings(m.db.reads)
  if (!settings?.emailQuotes) return { ok: false, code: 409, error: 'Sending quotes by email is off. Turn it on under Admin › Connections › The operations mailbox.' }
  let sender: Awaited<ReturnType<Mailbox['sender']>>
  try {
    sender = await m.mailbox.sender()
  } catch (err) {
    return { ok: false, code: 502, error: err instanceof GoogleError ? googleWords(err) : 'The mailbox can’t be reached just now. Try again in a minute.' }
  }
  if (!sender.ok) return { ok: false, code: 409, error: sender.why }
  const quote = await getQuote(m.db.reads, quoteId)
  if (!quote) return { ok: false, code: 404, error: 'That quote is no longer here.' }
  if (quote.lines.length === 0) return { ok: false, code: 422, error: 'This quote has no lines yet. Add what it is for first.' }

  // The same press asked again (ADR 0171): what it made, or that it's still going, never a second email.
  const key = body.key
  if (key) {
    const state = await sendState(m.db.reads, quote.id, key, now)
    if (state.state === 'sent') return { ok: true, email: state.email }
    if (state.state === 'sending') return { ok: false, code: 409, error: 'That Send is still going. Give it a moment: it shows here once Gmail has it.' }
    if (state.state === 'unsure')
      return { ok: false, code: 409, error: 'The server stopped while sending this, so it can’t tell whether it went. Look in the operations mailbox’s Sent folder; if it isn’t there, start the email again.' }
    const held = await m.db.query('INSERT INTO quote_email_sends (key, quote_id, started_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING RETURNING key', [key, quote.id, now])
    if (!held.rows.length) return { ok: false, code: 409, error: 'That Send is still going. Give it a moment: it shows here once Gmail has it.' }
  }
  try {
    return await sendHeld(m, quote, body, who, sender, now)
  } finally {
    // Gone or not, the press is no longer held: its email answers for it, or there is none and it can go again.
    if (key) await m.db.query('DELETE FROM quote_email_sends WHERE key = $1', [key]).catch(() => undefined)
  }
}

/** The send itself, once the press is held: number, PDF, Gmail, then the record. */
async function sendHeld(m: Mailer, quoteIn: Quote, body: QuoteEmailSend, who: Sender, sender: { token: string; account: string }, now: Date): Promise<SendResult> {
  const today = irishToday(now)
  let quote = quoteIn
  const quoteId = quote.id
  const { clientId = 'server', staff: _staff, ...from } = who
  const device = /^[a-z0-9]{1,64}$/.test(clientId) ? clientId : 'server'
  const draft = quote.status === 'draft'
  // The number it goes with, checked against the one the compose box showed before anything is given (ADR 0130).
  const number = await numberFor(m.db.reads, quote)
  if (body.number != null && body.number !== number)
    return { ok: false, code: 409, error: `It would go as quote ${number}, not ${body.number}: another quote took that number first. Check the subject and the message, then press Send again.` }
  // Numbered before it's drawn, so the client gets it with its number on it, but not yet sent: that waits for Gmail. The
  // number is kept if Gmail turns it down, so sending again, or printing it, uses the same one.
  if (draft && !quote.number) {
    await serverChange(m.db, undefined, async (ctx) => {
      const q = await getQuote(ctx.tx, quote!.id, true)
      if (!q || q.status !== 'draft') return
      await numberIt(ctx, q)
      await emit(ctx, 'quote', q.id, await getQuote(ctx.tx, q.id))
    })
    quote = (await getQuote(m.db.reads, quoteId)) ?? quote
    if (body.number != null && quote.number !== body.number)
      return { ok: false, code: 409, error: `It would go as quote ${quote.number}, not ${body.number}: another quote took that number first. Check the subject and the message, then press Send again.` }
  }
  const going: Quote = draft ? { ...quote, status: 'sent', sentOn: today } : quote

  const sheet = await sheetFor(m.db.reads, going, today)
  const logo = await m.logo?.().catch(() => undefined)
  const pdf = await quotePdf({ ...sheet, ...(logo ? { logo } : {}) })
  const fileName = fileNameFor(quote.number ?? null, sheet.job.name)
  const staff = who.staff ?? undefined
  // A copy to whoever pressed Send (ADR 0171), unless it's the mailbox itself or they're already on it.
  const copyTo = body.copy && staff?.email && staff.email.toLowerCase() !== sender.account.toLowerCase() && !body.to.some((a) => a.toLowerCase() === staff.email.toLowerCase()) ? staff.email : null
  const raw = mime({
    from: { name: COMPANY, address: sender.account },
    to: body.to,
    // Replies reach whoever sent it, and operations@, so the thread stays where Claude reads it.
    replyTo: staff && staff.email.toLowerCase() !== sender.account.toLowerCase() ? [{ name: staff.name, address: staff.email }, { address: sender.account }] : [],
    ...(copyTo ? { bcc: [copyTo] } : {}),
    subject: body.subject,
    text: body.message,
    attachment: { name: fileName, type: 'application/pdf', bytes: pdf },
    date: now,
  })
  let sent: { id: string; threadId: string }
  try {
    sent = await m.mailbox.gmail.send(sender.token, raw)
  } catch (err) {
    await m.mailbox.stopped(err, 'send')
    m.onChange?.()
    // Said as it stands (ADR 0130): numbered, still a draft, nothing gone.
    const kept = draft && quote.number ? ` It keeps number ${quote.number} and is still a draft: send it again, or print it.` : ''
    return { ok: false, code: 502, error: `${err instanceof GoogleError ? googleWords(err) : 'Gmail didn’t take it. Nothing was sent; try again in a minute.'}${kept}` }
  }

  // Gmail has it: now it's sent, as the person's own change, so the history reads as it would had they pressed Mark as
  // sent, and an enquiry becomes quoted (ADR 0081).
  if (draft) {
    const marked = await applyMutation(m.db, device, { id: newId(), name: 'quote.sent', args: { id: quote.id, on: today }, createdAt: now.toISOString() }, from)
    if (marked.status === 'applied') {
      const project = await getProject(m.db.reads, quote.projectId)
      if (project?.status === 'enquiry') await applyMutation(m.db, device, { id: newId(), name: 'project.update', args: { id: project.id, status: 'quoted' }, createdAt: now.toISOString() }, from)
      quote = (await getQuote(m.db.reads, quoteId)) ?? quote
    }
  }

  const before = await m.db.reads.query<{ n: number }>('SELECT count(*)::int AS n FROM quote_emails WHERE quote_id = $1', [quote.id])
  const id = newId()
  const email = await serverChange(
    m.db,
    { name: QUOTE_EMAIL_ACTION, args: { id: quote.id, projectId: quote.projectId, to: body.to.length, again: (before.rows[0]?.n ?? 0) > 0 }, clientId: device, userId: who.userId, device: who.device },
    async (ctx) => {
      await ctx.tx.query(
        `INSERT INTO quote_emails (id, quote_id, project_id, version, number, sent_at, sent_by, from_address, to_addresses, subject, message, gmail_id, thread_id, pdf_base64, send_key, copy_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [id, quote.id, quote.projectId, quote.version, quote.number ?? null, now, who.userId ?? null, sender.account, body.to, body.subject, body.message, sent.id, sent.threadId, pdf.toString('base64'), body.key ?? null, copyTo]
      )
      const record = (await getQuoteEmail(ctx.tx, id))!
      await emit(ctx, 'quoteEmail', id, record)
      return record
    }
  )
  m.onChange?.()
  // Read back from Sent before answering, so the office sees it there at once; Gmail can take a moment, so once more later.
  if (await confirmSent(m, id, sender.token, sent.id)) return { ok: true, email: (await getQuoteEmail(m.db.reads, id)) ?? email }
  const later = m.recheckMs ?? 10_000
  if (later > 0) setTimeout(() => void confirmSent(m, id, sender.token, sent.id).catch(() => undefined), later).unref?.()
  return { ok: true, email }
}

/** Gmail's trouble in the words the person sees. Nothing has gone when these are said. */
function googleWords(err: GoogleError): string {
  switch (err.problem) {
    case 'busy':
      return 'Gmail is busy or can’t be reached just now. Nothing was sent; try again in a minute.'
    case 'access':
      return 'Google won’t let the app send from the mailbox. Nothing was sent. Check the Gmail API is on, then connect operations@ again under Admin › Connections and allow sending.'
    case 'expired':
    case 'revoked':
      return 'Google no longer accepts the app’s key for the mailbox. Nothing was sent. Connect operations@ again under Admin › Connections.'
    default:
      return `Gmail turned it down (${err.message}). Nothing was sent.`
  }
}

// The email itself, as the bytes Gmail is handed.

interface Address {
  name?: string
  address: string
}

export interface Message {
  from: Address
  to: string[]
  replyTo: Address[]
  /** Sent a copy without the others seeing (ADR 0171); Gmail takes the header off before it goes. */
  bcc?: string[]
  subject: string
  text: string
  /** Left out for a plain email, such as a freelancer's code (ADR 0114). */
  attachment?: { name: string; type: string; bytes: Buffer }
  date: Date
}

/** An email with a text part and, when there is one, an attachment, headers folded and encoded as the standards ask. */
export function mime(msg: Message): Buffer {
  if (!msg.attachment) return plainMime(msg)
  const boundary = `sh-${randomBytes(12).toString('hex')}`
  const headers = [
    `From: ${addressLine(msg.from)}`,
    fold('To: ', msg.to.map((a) => addressLine({ address: a }))),
    msg.replyTo.length ? fold('Reply-To: ', msg.replyTo.map(addressLine)) : '',
    msg.bcc?.length ? fold('Bcc: ', msg.bcc.map((a) => addressLine({ address: a }))) : '',
    `Subject: ${encodedWord(msg.subject)}`,
    `Date: ${msg.date.toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean)
  const plainName = msg.attachment.name.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\x20-\x7e]|["\\]/g, '_')
  const starName = encodeURIComponent(msg.attachment.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  const parts = [
    ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', lines(Buffer.from(msg.text.replace(/\r?\n/g, '\r\n'), 'utf8'))].join('\r\n'),
    [
      `Content-Type: ${msg.attachment.type}; name="${plainName}"`,
      `Content-Disposition: attachment; filename="${plainName}"; filename*=UTF-8''${starName}`,
      'Content-Transfer-Encoding: base64',
      '',
      lines(msg.attachment.bytes),
    ].join('\r\n'),
  ]
  return Buffer.from([...headers, '', `--${boundary}`, parts.join(`\r\n--${boundary}\r\n`), `--${boundary}--`, ''].join('\r\n'), 'utf8')
}

/** An email with only text in it. */
function plainMime(msg: Message): Buffer {
  const headers = [
    `From: ${addressLine(msg.from)}`,
    fold('To: ', msg.to.map((a) => addressLine({ address: a }))),
    msg.replyTo.length ? fold('Reply-To: ', msg.replyTo.map(addressLine)) : '',
    `Subject: ${encodedWord(msg.subject)}`,
    `Date: ${msg.date.toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean)
  return Buffer.from([...headers, '', lines(Buffer.from(msg.text.replace(/\r?\n/g, '\r\n'), 'utf8')), ''].join('\r\n'), 'utf8')
}

/** "Session Hire <operations@sessionhire.com>", the name encoded when it needs to be. */
function addressLine(a: Address): string {
  const name = a.name?.trim()
  if (!name) return a.address
  const plain = /^[\w .'-]+$/.test(name)
  return `${plain ? name : encodedWord(name)} <${a.address}>`
}

/** Text as a header takes it: as it is when it's plain ASCII, else in UTF-8 encoded words no longer than a header line allows. */
export function encodedWord(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s) && !/[=?]/.test(s)) return s
  const words: string[] = []
  let chunk = ''
  for (const c of s) {
    if (Buffer.byteLength(chunk + c, 'utf8') > 45) {
      words.push(`=?UTF-8?B?${Buffer.from(chunk, 'utf8').toString('base64')}?=`)
      chunk = ''
    }
    chunk += c
  }
  if (chunk) words.push(`=?UTF-8?B?${Buffer.from(chunk, 'utf8').toString('base64')}?=`)
  return words.join('\r\n ')
}

/** A header with a list in it, one entry a line after the first, so no line runs long. */
const fold = (name: string, entries: string[]) => `${name}${entries.join(',\r\n ')}`

/** Base64 in lines of 76, as a body part is written. */
const lines = (b: Buffer) => b.toString('base64').replace(/(.{76})/g, '$1\r\n')
