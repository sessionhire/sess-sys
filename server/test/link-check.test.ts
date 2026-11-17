import { afterEach, describe, expect, it, vi } from 'vitest'
import { server, staff, WINDOWS } from './people.ts'

/**
 * Freelancers' links, made safer (ADR 0114): every phone a link opens on is
 * remembered; with checking on, a new phone needs a code by email, and a
 * lost link can be emailed. Off, the link works as it always did and
 * nothing is sent.
 */

const PERSON = { phone: null, skills: [], dayRateCents: null, notes: '' }
const FORM = { 'content-type': 'application/x-www-form-urlencoded' }
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

afterEach(() => vi.restoreAllMocks())

async function setUp({ mailbox = true }: { mailbox?: boolean } = {}) {
  const { app, db } = await server()
  const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
  await colly.send('person.upsert', { id: 'dara', name: 'Dara Kelly', kind: 'freelancer', email: 'dara@example.com', ...PERSON })
  await colly.send('person.upsert', { id: 'noel', name: 'Noel Byrne', kind: 'freelancer', email: null, ...PERSON })
  const token = async (id: string) => (await db.query<{ link_token: string }>('SELECT link_token FROM people WHERE id = $1', [id])).rows[0]!.link_token
  const sent: { raw: string }[] = []
  if (mailbox) {
    vi.spyOn(app.assistantMailbox, 'sender').mockResolvedValue({ ok: true, token: 'key', account: 'operations@sessionhire.com' })
    vi.spyOn(app.assistantMailbox.gmail, 'send').mockImplementation(async (_t, raw) => {
      sent.push({ raw: raw.toString('utf8') })
      return { id: 'm1', threadId: 't1' }
    })
  }
  /** One phone: keeps the cookie the server gives it, as a browser does. */
  const phone = () => {
    let cookie: string | undefined
    const keep = <R extends { headers: Record<string, unknown> }>(res: R): R => {
      const set = res.headers['set-cookie']
      const line = Array.isArray(set) ? set[0] : (set as string | undefined)
      if (line?.startsWith('sh_link=')) cookie = line.split(';')[0]
      return res
    }
    return {
      get: async (url: string) => keep(await app.inject({ url, headers: { 'user-agent': PHONE, ...(cookie ? { cookie } : {}) } })),
      post: async (url: string, fields: Record<string, string> = {}) =>
        keep(await app.inject({ method: 'POST', url, headers: { ...FORM, 'user-agent': PHONE, ...(cookie ? { cookie } : {}) }, payload: new URLSearchParams(fields).toString() })),
      get cookie() {
        return cookie
      },
    }
  }
  /** The code in the last email sent. */
  const lastCode = () => {
    const raw = sent.at(-1)!.raw
    const body = Buffer.from(raw.split('\r\n\r\n').slice(1).join('').replace(/\r\n/g, ''), 'base64').toString('utf8')
    return { subject: raw.match(/^Subject: (.*)$/m)![1]!, body, code: body.match(/\b(\d{6})\b/)?.[1] }
  }
  return { app, db, colly, token, sent, phone, lastCode }
}

describe('a freelancer’s link, made safer (ADR 0114)', () => {
  it('remembers each phone quietly while checking is off, and opens on any phone as before', async () => {
    const { db, token, phone, sent } = await setUp()
    const dara = `/f/${await token('dara')}`
    const mine = phone()
    const first = await mine.get(dara)
    expect(first.statusCode).toBe(200)
    expect(String(first.headers['set-cookie'])).toContain(`Path=${dara}`)
    expect(String(first.headers['set-cookie'])).toContain('HttpOnly')
    // Back with its cookie: now it's a phone, not a preview.
    expect((await mine.get(dara)).statusCode).toBe(200)
    const { rows } = await db.query<{ seen: boolean; device: string }>('SELECT seen, device FROM link_devices WHERE person_id = $1', ['dara'])
    expect(rows).toEqual([{ seen: true, device: expect.stringContaining('iPhone') }])
    // Another phone still opens it: nothing is checked, and nothing is sent.
    expect((await phone().get(dara)).statusCode).toBe(200)
    expect(sent).toEqual([])
  })

  it('lets the first phone in once on, and asks a new one for a code by email', async () => {
    const { colly, token, phone, sent, lastCode } = await setUp()
    expect(await colly.send('links.check', { on: true })).toMatchObject({ status: 'applied' })
    const dara = `/f/${await token('dara')}`
    const mine = phone()
    expect((await mine.get(dara)).statusCode).toBe(200)
    expect((await mine.get(dara)).statusCode).toBe(200)

    const other = phone()
    const asked = await other.get(dara)
    expect(asked.statusCode).toBe(401)
    expect(asked.body).toContain('Is this you, Dara?')
    expect(asked.body).toContain('d•••@example.com')
    expect(asked.body).not.toContain('dara@example.com')
    // A post from it is checked too: nothing can be answered from a phone that isn't let in.
    expect((await other.post(`${dara}/details`, { phone: '+353 87 000 0000' })).statusCode).toBe(401)

    const send = await other.post(`${dara}/code/send`)
    expect(send.statusCode).toBe(200)
    expect(send.body).toContain('The code from the email')
    expect(sent).toHaveLength(1)
    const { subject, code } = lastCode()
    expect(subject).toMatch(/^Your Session Hire code: \d{6}$/)
    expect(sent[0]!.raw).toContain('To: dara@example.com')

    const wrong = await other.post(`${dara}/code`, { code: code === '000000' ? '111111' : '000000' })
    expect(wrong.statusCode).toBe(422)
    expect(wrong.body).toContain("That isn't the code we sent")
    const right = await other.post(`${dara}/code`, { code: code! })
    expect(right.statusCode).toBe(303)
    expect(right.headers.location).toBe(dara)
    expect((await other.get(dara)).statusCode).toBe(200)
    // The code is spent.
    expect((await phone().post(`${dara}/code`, { code: code! })).body).toContain('That code has run out')
  })

  it('stops a code after five wrong tries, and won’t send another inside a minute', async () => {
    const { colly, token, phone, sent, lastCode } = await setUp()
    await colly.send('links.check', { on: true })
    const dara = `/f/${await token('dara')}`
    const mine = phone()
    await mine.get(dara)
    await mine.get(dara)
    const other = phone()
    await other.post(`${dara}/code/send`)
    expect((await other.post(`${dara}/code/send`)).body).toContain('Give it a minute')
    expect(sent).toHaveLength(1)
    const { code } = lastCode()
    const bad = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 4; i++) expect((await other.post(`${dara}/code`, { code: bad })).body).toContain("That isn't the code")
    expect((await other.post(`${dara}/code`, { code: bad })).body).toContain('That code has run out')
    expect((await other.post(`${dara}/code`, { code: code! })).body).toContain('That code has run out')
  })

  it('sends the office’s way back when there is no email or no mailbox, and a new link opens on the next phone', async () => {
    const { colly, token, phone, sent } = await setUp({ mailbox: false })
    await colly.send('links.check', { on: true })
    const noel = `/f/${await token('noel')}`
    const mine = phone()
    await mine.get(noel)
    await mine.get(noel)
    const page = await phone().get(noel)
    expect(page.statusCode).toBe(401)
    expect(page.body).toContain("We can't send you a code just now")
    expect(page.body).not.toContain('Email me a code')
    expect(sent).toEqual([])
    // The office makes a new link: every phone is forgotten, and the first to open the new one is let in.
    expect(await colly.send('person.newLink', { id: 'noel' })).toMatchObject({ status: 'applied' })
    const fresh = `/f/${await token('noel')}`
    expect((await phone().get(fresh)).statusCode).toBe(200)
  })

  it('leaves the calendar feed to the calendar apps that fetch it', async () => {
    const { colly, token, phone } = await setUp()
    await colly.send('links.check', { on: true })
    const dara = `/f/${await token('dara')}`
    const mine = phone()
    await mine.get(dara)
    await mine.get(dara)
    expect((await phone().get(`${dara}/calendar.ics`)).statusCode).toBe(200)
  })

  it('emails a lost link only while checking is on, and answers the same for any address', async () => {
    const { app, colly, token, sent, lastCode } = await setUp()
    const ask = (email: string) => app.inject({ method: 'POST', url: '/link', headers: FORM, payload: new URLSearchParams({ email }).toString() })
    const off = await app.inject({ url: '/link' })
    expect(off.body).toContain('Ask the office to send it to you again')
    expect((await ask('dara@example.com')).body).toContain('Ask the office')
    expect(sent).toEqual([])

    await colly.send('links.check', { on: true })
    expect((await app.inject({ url: '/link' })).body).toContain('Send me my link')
    expect((await ask('not an email')).statusCode).toBe(422)
    const nobody = await ask('someone@example.com')
    const dara = await ask(' Dara@Example.com ')
    expect(nobody.body).toContain('Check your email')
    expect(dara.body).toBe(nobody.body)
    expect(sent).toHaveLength(1)
    expect(lastCode().body).toContain(`/f/${await token('dara')}`)
    // Asked again straight away: nothing more goes.
    await ask('dara@example.com')
    expect(sent).toHaveLength(1)
  })

  it('points a dead link at the lost-link page', async () => {
    const { app } = await setUp()
    const gone = await app.inject({ url: '/f/this-is-not-a-link-at-all' })
    expect(gone.statusCode).toBe(404)
    expect(gone.body).toContain('href="/link"')
  })
})
