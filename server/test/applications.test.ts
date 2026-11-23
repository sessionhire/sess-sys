import { afterEach, describe, expect, it, vi } from 'vitest'
import { server, staff, WINDOWS } from './people.ts'

/**
 * Applications to join the crew (ADR 0190): anyone can send one from /join while the office has it on; it waits for the
 * office, which takes the person on as an applicant or turns them down, which deletes what they sent. Bots are shown
 * the same thank-you and nothing is kept; nothing is ever sent to the person who applied.
 */

const FORM = { 'content-type': 'application/x-www-form-urlencoded' }
const PERSON = { phone: null, skills: [], dayRateCents: null, notes: '' }

afterEach(() => vi.useRealTimers())

const FILLED = {
  firstName: 'Aoife',
  lastName: 'Ní Bhriain',
  email: 'Aoife.NiBhriain@example.com',
  phone: '087 123 4567',
  department: 'Audio',
  skills: 'FOH, monitors / RF',
  rate: '€250',
  tradesAs: 'sole-trader',
  basedIn: 'Galway',
  about: 'Ten years on festivals.',
  agree: 'yes',
}

async function setUp() {
  const { app, db } = await server()
  const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
  /** The time the page was opened, as the form carries it: a minute ago, so a person's pace. */
  const opened = () => String(Date.now() - 60_000)
  const apply = async (fields: Record<string, string>) =>
    app.inject({ method: 'POST', url: '/join', headers: FORM, payload: new URLSearchParams({ t: opened(), ...fields }).toString() })
  const waiting = async () => (await db.query<{ id: string; email: string; phone: string; skills: string[]; day_rate_cents: number | null }>('SELECT id, email, phone, skills, day_rate_cents FROM applications ORDER BY applied_at')).rows
  return { app, db, colly, apply, waiting }
}

describe('applying to join the crew (ADR 0190)', () => {
  it('is closed until the office turns it on, and keeps nothing sent while closed', async () => {
    const { app, colly, apply, waiting } = await setUp()
    const page = await app.inject({ url: '/join' })
    expect(page.statusCode).toBe(200)
    expect(page.body).toContain("We're not taking applications here just now")
    expect(page.body).not.toContain('<form')
    expect((await apply(FILLED)).body).toContain("We're not taking applications here just now")
    expect(await waiting()).toEqual([])
    expect(await colly.send('applications.use', { on: true })).toMatchObject({ status: 'applied' })
    const open = await app.inject({ url: '/join' })
    expect(open.body).toContain('Send my application')
    expect(open.headers['cache-control']).toBe('no-store')
  })

  it('keeps an application as the office will read it, and says thanks', async () => {
    const { colly, apply, waiting } = await setUp()
    await colly.send('applications.use', { on: true })
    const sent = await apply(FILLED)
    expect(sent.statusCode).toBe(303)
    expect(sent.headers.location).toBe('/join/thanks')
    const [a] = await waiting()
    expect(a).toMatchObject({ email: 'aoife.nibhriain@example.com', phone: '+353871234567', skills: ['FOH', 'monitors', 'RF'], day_rate_cents: 25000 })
    const seen = await colly.record<Record<string, unknown>>('application', a!.id)
    expect(seen).toMatchObject({ firstName: 'Aoife', lastName: 'Ní Bhriain', department: 'Audio', tradesAs: 'sole-trader', basedIn: 'Galway', about: 'Ten years on festivals.' })
    // The history says one came in, and keeps none of what they sent.
    const history = JSON.stringify(await colly.history())
    expect(history).toContain('An application to join came in from the Apply page')
    expect(history).not.toContain('Aoife')
  })

  it('says what to fix under each field, keeping what was typed', async () => {
    const { colly, apply, waiting } = await setUp()
    await colly.send('applications.use', { on: true })
    const res = await apply({ ...FILLED, email: 'not an email', phone: '12', rate: 'lots', agree: '' })
    expect(res.statusCode).toBe(422)
    expect(res.body).toContain('<title>Error: Apply to join our crew</title>')
    expect(res.body).toContain('4 things to fix before it can go')
    expect(res.body).toContain('id="email-error"')
    expect(res.body).toContain('id="phone-error"')
    expect(res.body).toContain('id="rate-error"')
    expect(res.body).toContain('id="agree-error"')
    expect(res.body).toContain('value="Ní Bhriain"')
    expect(await waiting()).toEqual([])
  })

  it('shows a bot the same thanks and keeps nothing: the hidden field filled, or sent too fast', async () => {
    const { app, colly, apply, waiting } = await setUp()
    await colly.send('applications.use', { on: true })
    expect((await apply({ ...FILLED, website: 'https://spam.example' })).body).toContain('Thanks for applying')
    const fast = await app.inject({ method: 'POST', url: '/join', headers: FORM, payload: new URLSearchParams({ t: String(Date.now()), ...FILLED }).toString() })
    expect(fast.body).toContain('Thanks for applying')
    const none = await app.inject({ method: 'POST', url: '/join', headers: FORM, payload: new URLSearchParams(FILLED).toString() })
    expect(none.body).toContain('Thanks for applying')
    expect(await waiting()).toEqual([])
  })

  it('keeps one application an email: sent again, the newer replaces it', async () => {
    const { colly, apply, waiting } = await setUp()
    await colly.send('applications.use', { on: true })
    await apply(FILLED)
    await apply({ ...FILLED, email: 'aoife.nibhriain@EXAMPLE.com', rate: '300' })
    const all = await waiting()
    expect(all).toHaveLength(1)
    expect(all[0]!.day_rate_cents).toBe(30000)
  })

  it('takes someone on as an applicant at Level 0 with what they sent, and the application goes', async () => {
    const { db, colly, apply, waiting } = await setUp()
    await colly.send('applications.use', { on: true })
    await apply(FILLED)
    const [a] = await waiting()
    expect(await colly.send('application.take', { id: a!.id, personId: 'aoife' })).toMatchObject({ status: 'applied' })
    const person = await colly.record<Record<string, unknown>>('person', 'aoife')
    expect(person).toMatchObject({
      name: 'Aoife Ní Bhriain',
      kind: 'freelancer',
      email: 'aoife.nibhriain@example.com',
      phone: '+353871234567',
      department: 'Audio',
      level: 0,
      skills: ['FOH', 'monitors', 'RF'],
      dayRateCents: 25000,
      company: { as: 'sole-trader', name: '' },
    })
    expect(String(person.notes)).toContain('Based in Galway.')
    expect(String(person.notes)).toContain('Ten years on festivals.')
    expect(await waiting()).toEqual([])
    // Gone from the feed too: no device ever gets what they sent as an application again.
    const { rows } = await db.query<{ n: string }>(`SELECT count(*) AS n FROM changes WHERE entity = 'application' AND data IS NOT NULL`)
    expect(Number(rows[0]!.n)).toBe(0)
    // Taken on twice, from a second device that hadn't heard: refused, in words.
    expect(await colly.send('application.take', { id: a!.id, personId: 'aoife-2' })).toMatchObject({ status: 'rejected', reason: { message: 'That application has already been taken on or turned down.' } })
    expect(JSON.stringify(await colly.history())).toContain('Took Aoife Ní Bhriain on from their application, as an applicant')
  })

  it('deletes what someone turned down sent, everywhere the app reads it', async () => {
    const { db, colly, apply, waiting } = await setUp()
    await colly.send('applications.use', { on: true })
    await apply(FILLED)
    const [a] = await waiting()
    expect(await colly.send('application.drop', { id: a!.id })).toMatchObject({ status: 'applied' })
    expect(await waiting()).toEqual([])
    const { rows } = await db.query<{ data: string }>(`SELECT data::text FROM changes WHERE data IS NOT NULL`)
    expect(rows.map((r) => r.data).join(' ')).not.toContain('Galway')
    expect(JSON.stringify(await colly.history())).toContain('Turned down an application to join; what they sent was deleted')
  })

  it('is read by the office, and not by staff crew once roles are on', async () => {
    const { app, db, colly, apply } = await setUp()
    await colly.send('person.upsert', { id: 'colly', name: 'Colly Hewson', kind: 'staff', email: 'colly@sessionhire.com', ...PERSON })
    await colly.send('person.upsert', { id: 'sean', name: 'Seán Ó Briain', kind: 'staff', email: 'sean@sessionhire.com', ...PERSON })
    await colly.send('person.role', { id: 'colly', role: 'director' })
    await colly.send('applications.use', { on: true })
    await apply(FILLED)
    const sean = await staff(app, db, 'Sean Briain', WINDOWS, 'crew-0001')
    const pulled = async (who: { cookies: Record<string, string> }) =>
      (await app.inject({ url: '/api/sync/pull?after=0', cookies: who.cookies })).json().changes.filter((c: { entity: string }) => c.entity === 'application')
    expect(await pulled(colly)).toHaveLength(1)
    expect(await pulled(sean)).toEqual([])
    expect(await sean.send('application.drop', { id: 'anything' })).toMatchObject({ status: 'rejected', reason: { code: 'forbidden' } })
  })

  it('turns a flood away once there are too many waiting', async () => {
    const { db, colly, apply } = await setUp()
    await colly.send('applications.use', { on: true })
    await db.query(
      `INSERT INTO applications (id, first_name, last_name, email, phone) SELECT 'a' || i, 'A', 'B', 'a' || i || '@example.com', '+353871234567' FROM generate_series(1, 300) AS i`
    )
    expect((await apply(FILLED)).body).toContain('We have more applications than we can read just now')
  })
})
