import { dayLabel, irishToday, newId, type CommandInput, type CommandName, type HistoryPage, type Mutation, type QuoteEmail, type QuoteEmailPrefill } from '@sh/shared'
import { describe, expect, it } from 'vitest'
import { GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE, Gmail } from '../src/assistant/gmail.ts'
import { seal } from '../src/calendar/crypto.ts'
import { encodedWord, mime } from '../src/finance/quote-email.ts'
import { WINDOWS, server, staff } from './people.ts'

/**
 * Sending a quote to the client by email (ADR 0101): from the operations
 * mailbox, with the quote as a PDF, once the office has turned it on and
 * connected the mailbox with sending allowed. Gmail and Google are stood in
 * for; what the app hands Gmail is read back as the client would get it.
 */

const SECRET = 'google-secret'
const today = irishToday()
const year = new Date().getFullYear() + 1

function m<N extends CommandName>(name: N, args: CommandInput<N>): Mutation {
  return { id: newId(), name, args, createdAt: new Date().toISOString() } as Mutation
}

/** Google's token endpoint and Gmail's send, with what was handed over kept to read. */
function fakeGmail() {
  const sent: { raw: Buffer; auth: string | null }[] = []
  let answer = 200
  /** Whether Gmail has filed what was sent in Sent yet, as a read-back finds it. */
  let filed = true
  /** Held: each send waits until let go, as a slow Gmail would. */
  let hold: Promise<void> | undefined
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'access', expires_in: 3600 })
    if (url.startsWith('https://oauth2.googleapis.com/revoke')) return json({})
    if (url === 'https://gmail.test/messages/send') {
      if (hold) await hold
      if (answer !== 200) return json({ error: { message: 'no' } }, answer)
      const { raw } = JSON.parse(String(init?.body)) as { raw: string }
      sent.push({ raw: Buffer.from(raw, 'base64url'), auth: new Headers(init?.headers).get('authorization') })
      return json({ id: `g${sent.length}`, threadId: `t${sent.length}` })
    }
    const one = url.match(/^https:\/\/gmail\.test\/messages\/(g\d+)\?format=minimal$/)
    if (one) return json({ id: one[1], labelIds: filed ? ['SENT'] : [] })
    if (url.startsWith('https://gmail.test/messages')) return json({ messages: [] })
    return new Response('{}', { status: 404 })
  }) as typeof globalThis.fetch
  return {
    fetch,
    sent,
    fail: (status: number) => (answer = status),
    file: (on: boolean) => (filed = on),
    holdSends: () => {
      let go!: () => void
      hold = new Promise((r) => (go = r))
      return () => ((hold = undefined), go())
    },
  }
}

/** The email as the client's mail program reads it: the headers, the text, and the PDF. */
function readMail(raw: Buffer) {
  const text = raw.toString('utf8')
  const [head, ...rest] = text.split('\r\n\r\n')
  const headers = Object.fromEntries(
    head!
      .replace(/\r\n[ \t]/g, ' ')
      .split('\r\n')
      .map((l) => [l.slice(0, l.indexOf(':')).toLowerCase(), l.slice(l.indexOf(':') + 1).trim()])
  )
  const boundary = headers['content-type']!.match(/boundary="([^"]+)"/)![1]!
  const parts = rest
    .join('\r\n\r\n')
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((p) => {
      const [h, ...b] = p.replace(/^\r\n/, '').split('\r\n\r\n')
      return { head: h!, body: Buffer.from(b.join('\r\n\r\n').replace(/\s/g, ''), 'base64') }
    })
  return { headers, parts }
}

async function setup() {
  const gmail = fakeGmail()
  const { app, db } = await server({
    calendar: { clientId: 'client', clientSecret: SECRET, fetch: gmail.fetch, gapMs: 0, settleMs: 3_600_000, pollMs: 0 },
    gmail: new Gmail(gmail.fetch, 'https://gmail.test'),
    // No real DNS: "nomail.ie" takes no email, everything else does.
    mx: async (d: string) => d !== 'nomail.ie',
    recheckMs: 0,
  })
  const adam = await staff(app, db, 'Adam Byrne', WINDOWS, 'office')
  const send = async (...mutations: Mutation[]) => {
    const res = await app.inject({ method: 'POST', url: '/api/sync/push', cookies: adam.cookies, headers: { 'user-agent': WINDOWS }, payload: { clientId: 'office', mutations } })
    for (const r of res.json().results) expect(r).toMatchObject({ status: 'applied' })
  }
  await send(
    m('office.update', { name: 'Session Hire office', phone: '+353 1 234 5678', email: 'office@sessionhire.com', vatNumber: 'IE 1234567T', address: 'Unit 4, Docklands Business Park\nDublin 3' }),
    m('client.upsert', { id: 'liffey', name: 'Liffey Brands', contacts: [{ name: 'Ruairí Kelly', role: 'Producer', email: 'ruairi@example.com', phone: null }, { name: 'Accounts', role: 'Accounts', email: null, phone: null }], notes: '', address: '14 Ormond Quay\nDublin 7' }),
    m('project.create', { id: 'launch', name: 'Liffey Brands Launch', clientId: 'liffey', venueId: null, status: 'enquiry', kind: 'gig', notes: '' } as never),
    m('phase.add', { id: 'show', projectId: 'launch', name: 'Show', start: `${year}-03-04`, end: `${year}-03-05`, venueId: null, notes: '' } as never),
    m('quoting.update', { nextNumber: 1115, terms: 'Payment within 30 days of the invoice.', bank: 'Session Hire Ltd\nIBAN IE00 BANK 0000 0000 0000 00' }),
    m('quote.save', { id: 'q1', projectId: 'launch', lines: [{ id: 'l1', kind: 'other', what: 'Delivery to the venue', ref: null, group: '', qty: 1, days: 1, per: 'once', unitCents: 18000, vat: '13.5', discountPct: 0 }], discountPct: 0, notes: 'Load in from 8am.', depositPct: 50 } as never)
  )
  const mailbox = app.assistantMailbox
  const connect = (scopes: string[]) => mailbox.connected({ email: 'operations@sessionhire.com', sub: 'ops-sub', sealedKey: seal(SECRET, 'refresh', 'ops-sub'), by: adam.id, scopes })
  const prefill = (id = 'q1') => app.inject({ url: `/api/quotes/${id}/email`, cookies: adam.cookies })
  const post = (body: Record<string, unknown>, id = 'q1') => app.inject({ method: 'POST', url: `/api/quotes/${id}/email?client=office`, cookies: adam.cookies, headers: { 'user-agent': WINDOWS }, payload: body })
  return { app, db, adam, gmail, send, connect, prefill, post }
}

describe('sending a quote to the client by email (ADR 0101)', () => {
  it('fills the compose box in, then sends from operations@ with the PDF, numbering the quote and keeping a record', async () => {
    const s = await setup()
    await s.send(m('quoting.email', { on: true }))
    await s.connect([GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE])

    // The compose box: the client's contacts that have an address, the number the quote will get, and the sums in words.
    const first = (await s.prefill()).json() as QuoteEmailPrefill
    expect(first).toMatchObject({ to: ['ruairi@example.com'], subject: 'Quote 1115 from Session Hire: Liffey Brands Launch', from: 'operations@sessionhire.com', fileName: 'Quote 1115 - Liffey Brands Launch.pdf', number: 1115, canSend: true, why: null })
    expect(first.message).toContain('Hi Ruairí,')
    expect(first.message).toContain(`quote 1115, €204.30 including VAT`)
    expect(first.message).toContain('A deposit of €102.15 confirms the booking.')
    expect(first.message).toContain('Adam Byrne\nSession Hire · +353 1 234 5678')
    // No link for the client to accept while that's off (ADR 0121); once on, the version's own link, on the app's address.
    expect(first.message).not.toContain('/q/')
    await s.send(m('quoting.online', { on: true }))
    expect(((await s.prefill()).json() as QuoteEmailPrefill).message).toMatch(/To accept it, use this link: http:\/\/[^/]+\/q\/[A-Za-z0-9_-]{24}\n/)

    const res = await s.post({ to: ['ruairi@example.com', 'accounts@example.com'], subject: first.subject, message: 'Hi Ruairí,\n\nQuote attached as discussed.\n\nAdam', number: 1115 })
    expect(res.statusCode, res.body).toBe(200)
    const { email } = res.json() as { email: QuoteEmail }
    expect(email).toMatchObject({ quoteId: 'q1', projectId: 'launch', version: 1, number: 1115, by: 'Adam Byrne', from: 'operations@sessionhire.com', to: ['ruairi@example.com', 'accounts@example.com'], subject: first.subject })

    // What Gmail was handed: from operations@, replies to Adam and operations@, the message, and the quote as a PDF.
    expect(s.gmail.sent).toHaveLength(1)
    expect(s.gmail.sent[0]!.auth).toBe('Bearer access')
    const mail = readMail(s.gmail.sent[0]!.raw)
    expect(mail.headers).toMatchObject({
      from: 'Session Hire <operations@sessionhire.com>',
      to: 'ruairi@example.com, accounts@example.com',
      'reply-to': 'Adam Byrne <adam@sessionhire.com>, operations@sessionhire.com',
      subject: 'Quote 1115 from Session Hire: Liffey Brands Launch',
      'mime-version': '1.0',
    })
    expect(mail.parts).toHaveLength(2)
    expect(mail.parts[0]!.head).toContain('text/plain; charset=UTF-8')
    expect(mail.parts[0]!.body.toString('utf8')).toBe('Hi Ruairí,\r\n\r\nQuote attached as discussed.\r\n\r\nAdam')
    expect(mail.parts[1]!.head).toContain('application/pdf; name="Quote 1115 - Liffey Brands Launch.pdf"')
    expect(mail.parts[1]!.head).toContain('Content-Disposition: attachment; filename="Quote 1115 - Liffey Brands Launch.pdf"')
    expect(mail.parts[1]!.body.subarray(0, 5).toString()).toBe('%PDF-')
    expect(mail.parts[1]!.body.toString('latin1')).toContain('(Quote 1115 for Liffey Brands Launch)\nendobj')

    // The quote went: sent today, as quote 1115, and the enquiry is quoted; the record is on the feed for every device that sees money.
    expect(await s.adam.record('quote', 'q1')).toMatchObject({ status: 'sent', sentOn: today, number: 1115 })
    expect(await s.adam.record('project', 'launch')).toMatchObject({ status: 'quoted' })
    expect(await s.adam.record('quoteEmail', email.id)).toMatchObject({ id: email.id, to: ['ruairi@example.com', 'accounts@example.com'] })
    const history = (await s.adam.history()) as HistoryPage
    const words = history.entries.map((e) => e.what)
    expect(words).toContain(`Marked version 1 of the quote for Liffey Brands Launch as sent to the client on ${dayLabel(today)}`)
    expect(words).toContain('Emailed version 1 of the quote for Liffey Brands Launch to the client, to 2 addresses')
    expect(history.entries.find((e) => e.command === 'quote.email')?.who).toMatchObject({ kind: 'staff', name: 'Adam Byrne' })
    // The office's record: the PDF that went, and the message, kept on the server; the export leaves the PDF out.
    const { rows } = await s.db.query<{ message: string; gmail_id: string; sent_by: string; size: number }>('SELECT message, gmail_id, sent_by, length(pdf_base64) AS size FROM quote_emails')
    expect(rows).toEqual([expect.objectContaining({ message: 'Hi Ruairí,\n\nQuote attached as discussed.\n\nAdam', gmail_id: 'g1', sent_by: s.adam.id })])
    expect(rows[0]!.size).toBeGreaterThan(1000)

    // Sent again, to one more address: another record, the quote as it is, and the history says again.
    const again = await s.post({ to: ['md@example.com'], subject: 'Quote 1115, again', message: 'For your files.' })
    expect(again.statusCode, again.body).toBe(200)
    expect(s.gmail.sent).toHaveLength(2)
    expect((await s.adam.history()).entries.map((e) => e.what)).toContain('Emailed version 1 of the quote for Liffey Brands Launch to the client again')
    // Sent again from the box that showed the number 1115, after a quote elsewhere could have taken it: the number stands.
    expect((await s.prefill()).json()).toMatchObject({ number: 1115, subject: 'Quote 1115 from Session Hire: Liffey Brands Launch' })
  })

  it('sends nothing until it is turned on and the mailbox is connected with sending allowed, and says why', async () => {
    const s = await setup()
    const body = { to: ['ruairi@example.com'], subject: 'Quote', message: 'Hi' }
    expect((await s.prefill()).json()).toMatchObject({ canSend: false, why: expect.stringContaining('Sending quotes by email is off') })
    expect((await s.post(body)).json()).toMatchObject({ error: expect.stringContaining('off. Turn it on under Admin') })

    await s.send(m('quoting.email', { on: true }))
    expect((await s.prefill()).json()).toMatchObject({ canSend: false, from: null, why: expect.stringContaining('isn’t connected') })
    expect((await s.post(body)).statusCode).toBe(409)

    // Connected before sending was asked for: it reads, and says to connect again to send.
    await s.connect([GMAIL_READ_SCOPE])
    expect(await (await s.app.inject({ url: '/api/assistant/mailbox', cookies: s.adam.cookies })).json()).toMatchObject({ state: 'on', canSend: false })
    const readOnly = await s.post(body)
    expect(readOnly.statusCode).toBe(409)
    expect(readOnly.json().error).toContain('connected to read only')

    await s.connect([GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE])
    expect((await s.post({ ...body, to: ['not an address'] })).json()).toMatchObject({ error: 'That email address doesn’t look right.' })
    expect((await s.post({ ...body, to: [] })).json()).toMatchObject({ error: 'Say who it goes to.' })
    expect((await s.post({ ...body, subject: '  ' })).json()).toMatchObject({ error: 'A subject is needed.' })
    expect((await s.post(body, 'nothing')).statusCode).toBe(404)
    // Nothing went, and the quote is still a draft.
    expect(s.gmail.sent).toHaveLength(0)
    expect(await s.adam.record('quote', 'q1')).toMatchObject({ status: 'draft', number: null })

    // Gmail down (ADR 0130): the quote has its number but is still a draft, nothing went and no record is kept, and it says
    // so, so Send again or printing it uses the same number.
    s.gmail.fail(503)
    const down = await s.post(body)
    expect(down.statusCode).toBe(502)
    expect(down.json().error).toContain('Nothing was sent')
    expect(down.json().error).toContain('It keeps number 1115 and is still a draft')
    expect(await s.adam.record('quote', 'q1')).toMatchObject({ status: 'draft', number: 1115 })
    expect((await s.prefill()).json()).toMatchObject({ number: 1115 })
    expect((await s.db.query('SELECT 1 FROM quote_emails')).rows).toHaveLength(0)
    // Google no longer lets the app at the mailbox: said so until it's connected again.
    s.gmail.fail(403)
    expect((await s.post(body)).json().error).toContain('Google won’t let the app send')
    expect(await (await s.app.inject({ url: '/api/assistant/mailbox', cookies: s.adam.cookies })).json()).toMatchObject({ state: 'reconnect', canSend: false })
    expect((await s.post(body)).statusCode).toBe(409)
  })

  it('sends one email for one press however often it is asked, copies the sender, and reads it back from Sent (ADR 0171)', async () => {
    const s = await setup()
    await s.send(m('quoting.email', { on: true }))
    await s.connect([GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE])
    const start = (await s.prefill()).json() as QuoteEmailPrefill
    // The copy goes to whoever is sending: Adam, not the mailbox.
    expect(start.me).toBe('adam@sessionhire.com')
    const body = { to: ['ruairi@example.com'], subject: start.subject, message: 'Attached.', number: start.number, key: 'press-one-1234', copy: true }

    // Gmail is slow: while the first ask is going, the same press asked again waits rather than sends, and says so.
    const go = s.gmail.holdSends()
    const first = s.post(body)
    await new Promise((r) => setTimeout(r, 300))
    expect((await s.app.inject({ url: '/api/quotes/q1/email/sends/press-one-1234', cookies: s.adam.cookies })).json()).toEqual({ state: 'sending' })
    const meanwhile = await s.post(body)
    expect(meanwhile.statusCode).toBe(409)
    expect(meanwhile.json().error).toContain('still going')
    go()
    const res = await first
    expect(res.statusCode, res.body).toBe(200)
    const { email } = res.json() as { email: QuoteEmail }
    // Gmail filed it in Sent, read back before the answer; the copy went to Adam, hidden from the client.
    expect(email).toMatchObject({ copyTo: 'adam@sessionhire.com' })
    expect(email.inSentAt).toEqual(expect.any(String))
    const mail = readMail(s.gmail.sent[0]!.raw)
    expect(mail.headers.bcc).toBe('adam@sessionhire.com')
    expect(mail.headers.to).toBe('ruairi@example.com')

    // Asked again after a lost signal: the same email back, and nothing more sent.
    const again = await s.post(body)
    expect(again.statusCode).toBe(200)
    expect((again.json() as { email: QuoteEmail }).email.id).toBe(email.id)
    expect(s.gmail.sent).toHaveLength(1)
    expect((await s.app.inject({ url: '/api/quotes/q1/email/sends/press-one-1234', cookies: s.adam.cookies })).json()).toMatchObject({ state: 'sent', email: { id: email.id } })
    // A press the server never heard of: not gone, so it can go.
    expect((await s.app.inject({ url: '/api/quotes/q1/email/sends/never-pressed-1', cookies: s.adam.cookies })).json()).toEqual({ state: 'none' })

    // A new press without the copy, Gmail slow to file it: sent, not yet in Sent, and no Bcc.
    s.gmail.file(false)
    const second = await s.post({ ...body, key: 'press-two-1234', copy: false })
    expect(second.statusCode).toBe(200)
    expect((second.json() as { email: QuoteEmail }).email).toMatchObject({ copyTo: null, inSentAt: null })
    expect(readMail(s.gmail.sent[1]!.raw).headers.bcc).toBeUndefined()
    expect(s.gmail.sent).toHaveLength(2)

    // A press the server stopped part way through (held long ago, no email): it can't say whether it went.
    await s.db.query(`INSERT INTO quote_email_sends (key, quote_id, started_at) VALUES ('press-lost-1234', 'q1', now() - interval '10 minutes')`)
    expect((await s.app.inject({ url: '/api/quotes/q1/email/sends/press-lost-1234', cookies: s.adam.cookies })).json()).toEqual({ state: 'unsure' })
    const lost = await s.post({ ...body, key: 'press-lost-1234' })
    expect(lost.statusCode).toBe(409)
    expect(lost.json().error).toContain('Sent folder')
    expect(s.gmail.sent).toHaveLength(2)
  })

  it('a press Gmail turns down can be pressed again, and goes once', async () => {
    const s = await setup()
    await s.send(m('quoting.email', { on: true }))
    await s.connect([GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE])
    const start = (await s.prefill()).json() as QuoteEmailPrefill
    const body = { to: ['ruairi@example.com'], subject: start.subject, message: 'Attached.', number: start.number, key: 'press-retry-12' }
    s.gmail.fail(503)
    expect((await s.post(body)).statusCode).toBe(502)
    expect((await s.app.inject({ url: '/api/quotes/q1/email/sends/press-retry-12', cookies: s.adam.cookies })).json()).toEqual({ state: 'none' })
    s.gmail.fail(200)
    expect((await s.post(body)).statusCode).toBe(200)
    expect(s.gmail.sent).toHaveLength(1)
  })

  it('checks the addresses before Send: a domain that takes no email, and a slip in a common one', async () => {
    const s = await setup()
    const res = await s.app.inject({ method: 'POST', url: '/api/quotes/email/check', cookies: s.adam.cookies, payload: { to: ['anna@gmial.com', 'bob@nomail.ie', 'ruairi@example.com', 'not an address'] } })
    expect(res.statusCode).toBe(200)
    expect(res.json().addresses).toEqual([
      { address: 'anna@gmial.com', problem: null, suggest: 'anna@gmail.com' },
      { address: 'bob@nomail.ie', problem: 'nomail.ie can’t receive email, so it would bounce. Check the spelling.', suggest: null },
      { address: 'ruairi@example.com', problem: null, suggest: null },
    ])
  })

  it('gives the quote as a PDF to look at, and the PDF that went', async () => {
    const s = await setup()
    const draft = await s.app.inject({ url: '/api/quotes/q1/pdf', cookies: s.adam.cookies })
    expect(draft.statusCode).toBe(200)
    expect(draft.headers['content-type']).toBe('application/pdf')
    expect(draft.headers['content-disposition']).toBe(`inline; filename="Draft quote - Liffey Brands Launch.pdf"; filename*=UTF-8''Draft%20quote%20-%20Liffey%20Brands%20Launch.pdf`)
    expect(draft.rawPayload.subarray(0, 5).toString()).toBe('%PDF-')
    expect(draft.rawPayload.toString('latin1')).toContain('(Draft quote for Liffey Brands Launch)\nendobj')
    // Next's Download the PDF (ADR 0166) saves it as a file instead.
    const saved = await s.app.inject({ url: '/api/quotes/q1/pdf?download=1', cookies: s.adam.cookies })
    expect(saved.headers['content-disposition']).toMatch(/^attachment; filename="Draft quote - Liffey Brands Launch.pdf"/)

    await s.send(m('quoting.email', { on: true }))
    await s.connect([GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE])
    const { email } = (await s.post({ to: ['ruairi@example.com'], subject: 'Quote', message: 'Hi' })).json() as { email: QuoteEmail }
    const went = await s.app.inject({ url: `/api/quotes/emails/${email.id}/pdf`, cookies: s.adam.cookies })
    expect(went.statusCode).toBe(200)
    expect(went.headers['content-disposition']).toContain('attachment; filename="Quote 1115 - Liffey Brands Launch.pdf"')
    expect(went.rawPayload.equals(readMail(s.gmail.sent[0]!.raw).parts[1]!.body)).toBe(true)
    expect((await s.app.inject({ url: '/api/quotes/emails/nothing/pdf', cookies: s.adam.cookies })).statusCode).toBe(404)
    // The quote itself is money: a freelancer's device is sent none of it.
    const outsider = await s.app.inject({ url: '/api/quotes/q1/pdf' })
    expect(outsider.statusCode).toBe(401)
  })

  it('writes the email as the standards ask: folded addresses, encoded words, base64 parts', () => {
    expect(encodedWord('Quote 1115: Launch')).toBe('Quote 1115: Launch')
    expect(encodedWord('Céad míle fáilte')).toBe('=?UTF-8?B?Q8OpYWQgbcOtbGUgZsOhaWx0ZQ==?=')
    const long = encodedWord('Fáilte '.repeat(20))
    expect(long.split('\r\n ').every((w) => w.length <= 75)).toBe(true)
    const raw = mime({
      from: { name: 'Session Hire', address: 'operations@sessionhire.com' },
      to: ['a@example.com', 'b@example.com'],
      replyTo: [{ name: 'Órla Ní Bhriain', address: 'orla@sessionhire.com' }],
      subject: 'Quote 1',
      text: 'Hi\nthere',
      attachment: { name: 'Quote 1 - Fáilte.pdf', type: 'application/pdf', bytes: Buffer.from('%PDF-1.7') },
      date: new Date('2026-10-30T12:00:00Z'),
    })
    const mail = readMail(raw)
    expect(mail.headers['to']).toBe('a@example.com, b@example.com')
    expect(mail.headers['reply-to']).toBe('=?UTF-8?B?w5NybGEgTsOtIEJocmlhaW4=?= <orla@sessionhire.com>')
    expect(mail.headers['date']).toBe('Fri, 30 Oct 2026 12:00:00 GMT')
    expect(raw.toString('utf8')).toContain('To: a@example.com,\r\n b@example.com')
    expect(mail.parts[0]!.body.toString()).toBe('Hi\r\nthere')
    expect(mail.parts[1]!.head).toContain(`filename="Quote 1 - Failte.pdf"; filename*=UTF-8''Quote%201%20-%20F%C3%A1ilte.pdf`)
    expect(mail.parts[1]!.body.toString()).toBe('%PDF-1.7')
  })
})

