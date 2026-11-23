import { describe, expect, it } from 'vitest'
import { GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE, Gmail } from '../src/assistant/gmail.ts'
import { seal } from '../src/calendar/crypto.ts'
import { applicantEmail } from '../src/applications/emails.ts'
import { WINDOWS, server, staff } from './people.ts'

/**
 * Emails to people who applied (ADR 0193): off until the office turns them on; then one goes from the operations
 * mailbox when someone is taken on, with their own page's address, and a polite one when they're turned down. What
 * the app hands Gmail is read back as the person would get it, and the address it went to isn't kept after.
 */

const SECRET = 'google-secret'
const FORM = { 'content-type': 'application/x-www-form-urlencoded' }

function fakeGmail() {
  const sent: string[] = []
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'access', expires_in: 3600 })
    if (url === 'https://gmail.test/messages/send') {
      const { raw } = JSON.parse(String(init?.body)) as { raw: string }
      sent.push(Buffer.from(raw, 'base64url').toString('utf8'))
      return json({ id: `g${sent.length}`, threadId: `t${sent.length}` })
    }
    return json({ messages: [] })
  }) as typeof globalThis.fetch
  return { fetch, sent }
}

/** The email as read: its headers, and its text decoded. */
function read(raw: string) {
  const [head, body] = raw.split('\r\n\r\n')
  return { head: head!, text: Buffer.from(body!.replace(/\s/g, ''), 'base64').toString('utf8') }
}

async function setUp() {
  const gmail = fakeGmail()
  const { app, db } = await server({
    calendar: { clientId: 'client', clientSecret: SECRET, fetch: gmail.fetch, gapMs: 0, settleMs: 3_600_000, pollMs: 0, appUrl: 'https://app.example' },
    gmail: new Gmail(gmail.fetch, 'https://gmail.test'),
  })
  const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
  await app.assistantMailbox.connected({ email: 'operations@sessionhire.com', sub: 'ops-sub', sealedKey: seal(SECRET, 'refresh', 'ops-sub'), by: colly.id, scopes: [GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE] })
  await colly.send('applications.use', { on: true })
  const apply = (first: string, email: string) =>
    app.inject({
      method: 'POST',
      url: '/join',
      headers: FORM,
      payload: new URLSearchParams({ t: String(Date.now() - 60_000), firstName: first, lastName: 'Test', email, phone: '087 123 4567', skills: 'Rigger', agree: 'yes' }).toString(),
    })
  const idOf = async (email: string) => (await db.query<{ id: string }>('SELECT id FROM applications WHERE email = $1', [email])).rows[0]!.id
  return { app, db, colly, gmail, apply, idOf }
}

describe('emailing people who apply (ADR 0193)', () => {
  it('sends nothing while it is off, and the Apply page says nothing about an email', async () => {
    const { app, db, colly, gmail, apply, idOf } = await setUp()
    expect((await app.inject({ url: '/join' })).body).not.toContain("We'll email you here")
    await apply('Aoife', 'aoife@example.com')
    await colly.send('application.take', { id: await idOf('aoife@example.com'), personId: 'aoife' })
    await app.applicantEmails.kick()
    expect(gmail.sent).toEqual([])
    expect((await db.query('SELECT 1 FROM applicant_emails')).rows).toEqual([])
  })

  it('says so before they send, then emails their own page on taking them on, and a polite word on turning them down', async () => {
    const { app, db, colly, gmail, apply, idOf } = await setUp()
    expect(await colly.send('applications.email', { on: true })).toMatchObject({ status: 'applied' })
    const page = (await app.inject({ url: '/join' })).body
    expect(page).toContain("We'll email you here once we've read your application")
    expect(page).toContain("you'll get an email from us")

    await apply('Aoife', 'aoife@example.com')
    await apply('Cian', 'cian@example.com')
    await colly.send('application.take', { id: await idOf('aoife@example.com'), personId: 'aoife' })
    await colly.send('application.drop', { id: await idOf('cian@example.com') })
    await app.applicantEmails.kick()

    expect(gmail.sent).toHaveLength(2)
    const taken = read(gmail.sent[0]!)
    expect(taken.head).toContain('To: aoife@example.com')
    expect(taken.head).toContain('From: Session Hire <operations@sessionhire.com>')
    expect(taken.text).toContain('Hi Aoife,')
    const { rows } = await db.query<{ link_token: string }>(`SELECT link_token FROM people WHERE id = 'aoife'`)
    expect(taken.text).toContain(`https://app.example/f/${rows[0]!.link_token}`)
    const declined = read(gmail.sent[1]!)
    expect(declined.head).toContain('To: cian@example.com')
    expect(declined.text).toContain("we don't have work that suits it just now, so we haven't kept your details")

    // Gone, and nothing of who they were for kept.
    const kept = (await db.query<{ state: string; to_email: string | null; first_name: string | null }>('SELECT state, to_email, first_name FROM applicant_emails')).rows
    expect(kept).toEqual([
      { state: 'sent', to_email: null, first_name: null },
      { state: 'sent', to_email: null, first_name: null },
    ])
    expect(JSON.stringify(await colly.history())).toContain('Turned on emailing people who apply')
  })

  it('does not send one queued before the office turned it off again', async () => {
    const { app, db, colly, gmail } = await setUp()
    await colly.send('applications.email', { on: false })
    await db.query(`INSERT INTO applicant_emails (id, kind, to_email, first_name, state) VALUES ('e1', 'declined', 'aoife@example.com', 'Aoife', 'queued')`)
    await app.applicantEmails.kick()
    expect(gmail.sent).toEqual([])
    expect((await db.query('SELECT state, to_email FROM applicant_emails')).rows).toEqual([{ state: 'failed', to_email: null }])
  })

  it('writes as the office, with how to reach it', () => {
    const e = applicantEmail('taken', 'Aoife', 'https://app.example/f/abc', { name: 'Session Hire office', phone: '+353 1 234 5678', email: 'office@sessionhire.com' })
    expect(e.subject).toBe("You're on the Session Hire crew list")
    expect(e.text).toContain('ring +353 1 234 5678 or email office@sessionhire.com')
  })
})
