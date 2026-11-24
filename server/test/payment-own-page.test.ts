import { describe, expect, it } from 'vitest'
import { IPHONE, server, staff, WINDOWS } from './people.ts'

/**
 * The rest of the security check of 24 November 2026 (ADR 0193): crew give and correct their own payment details on
 * their page, only ever seeing them masked there; PPS numbers asked only while the office says the company uses them;
 * a public privacy page; and the Status page saying whether error reports stay in the EU.
 */

const FORM = { 'content-type': 'application/x-www-form-urlencoded' }
const PERSON = { phone: null, skills: [], dayRateCents: null, notes: '' }
const PAY = { ppsn: '1234567 t', vatNumber: '', accountName: 'Aoife Byrne', iban: 'IE29 AIBK 9311 5212 3456 78', bic: '' }

async function setUp() {
  const { app, db } = await server({ paymentKey: 'a test key' })
  const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
  await colly.send('person.upsert', { id: 'colly', name: 'Colly Hewson', kind: 'staff', email: 'colly@sessionhire.com', ...PERSON })
  await colly.send('person.role', { id: 'colly', role: 'director' })
  await colly.send('person.upsert', { id: 'aoife', name: 'Aoife Byrne', kind: 'freelancer', email: null, ...PERSON })
  const { rows } = await db.query<{ link_token: string }>(`SELECT link_token FROM people WHERE id = 'aoife'`)
  const link = `/f/${rows[0]!.link_token}`
  const post = (path: string, fields: Record<string, string>) =>
    app.inject({ method: 'POST', url: `${link}${path}`, headers: { ...FORM, 'user-agent': IPHONE }, payload: new URLSearchParams(fields).toString() })
  return { app, db, colly, link, post }
}

describe('payment details on their own page (ADR 0193)', () => {
  it('lets them give, correct and take off their own, shown only masked, and the office is told', async () => {
    const { app, db, colly, link, post } = await setUp()
    const page = (await app.inject({ url: link })).body
    expect(page).toContain('For paying you')
    expect(page).toContain('Not given yet')

    // A wrong IBAN is said under it, with what they typed kept.
    const wrong = await post('/payment', { ...PAY, iban: 'IE29 AIBK 9311 5212 3456 79' })
    expect(wrong.statusCode).toBe(422)
    expect(wrong.body).toContain('id="pay-iban-error"')
    expect(wrong.body).toContain('Aoife Byrne')
    // Nothing typed is not a way to take them off.
    expect((await post('/payment', {})).body).toContain('Type your details first')
    expect((await db.query('SELECT 1 FROM payment_details')).rows).toEqual([])

    const saved = await post('/payment', PAY)
    expect(saved.statusCode).toBe(303)
    const after = (await app.inject({ url: saved.headers.location as string })).body
    expect(after).toContain('Saved. They')
    expect(after).toContain('•••••67T')
    expect(after).not.toMatch(/value="1234567T"|>1234567T<|93115212/)
    const data = (await app.inject({ url: `${link}/data.json` })).body
    expect(data).toContain('•••••67T')
    expect(data).not.toMatch(/1234567T|93115212/)

    // The office's card says who changed them and where, and the history has it as theirs.
    const card = (await app.inject({ url: '/api/people/aoife/payment', cookies: colly.cookies })).json()
    expect(card).toMatchObject({ kept: true, changedBy: 'Aoife Byrne on their own page' })
    expect(JSON.stringify(await colly.history())).toContain("Changed Aoife Byrne's payment details")

    // Where the paying is done is told too (user flows of 24 November 2026, gap 8): that they're held, when they
    // changed and that it was on their own page, never the details; and it's on the bell of a director, about her.
    const standing = await app.inject({ url: '/api/payment/standing', cookies: colly.cookies })
    expect(standing.json()).toEqual({ people: [{ personId: 'aoife', changedAt: card.changedAt, own: true }] })
    expect(standing.body).not.toMatch(/1234567|AIBK|9311/)
    const bell = (await app.inject({ url: '/api/notices', cookies: colly.cookies })).json() as { notices: { forYou?: string; why: string; about: { entity: string; id: string } }[] }
    expect(bell.notices.filter((n) => n.forYou).map((n) => [n.forYou, n.why, n.about])).toEqual([
      ['Aoife Byrne changed their payment details on their own page. Ring them before paying to a new account.', 'turn', { entity: 'person', id: 'aoife' }],
    ])

    expect((await post('/payment/remove', {})).statusCode).toBe(303)
    expect((await db.query('SELECT 1 FROM payment_details')).rows).toEqual([])
  })

  it("isn't drawn, or kept, without a key", async () => {
    const { app, db } = await server()
    const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
    await colly.send('person.upsert', { id: 'aoife', name: 'Aoife Byrne', kind: 'freelancer', email: null, ...PERSON })
    const { rows } = await db.query<{ link_token: string }>(`SELECT link_token FROM people WHERE id = 'aoife'`)
    expect((await app.inject({ url: `/f/${rows[0]!.link_token}` })).body).not.toContain('For paying you')
  })
})

describe('asking for PPS numbers (ADR 0193)', () => {
  it('stops everywhere once the office turns it off, and anything posted is not kept', async () => {
    const { app, db, colly, link, post } = await setUp()
    await colly.send('applications.use', { on: true })
    expect((await app.inject({ url: '/join' })).body).toContain('PPS number')
    expect(await colly.send('applications.ppsn', { on: false })).toMatchObject({ status: 'applied' })
    const join = (await app.inject({ url: '/join' })).body
    expect(join).not.toContain('name="ppsn"')
    expect(join).toContain('Your bank details are kept locked')
    expect((await app.inject({ url: link })).body).not.toContain('name="ppsn"')
    await post('/payment', PAY)
    const card = (await app.inject({ url: '/api/people/aoife/payment?full=1', cookies: colly.cookies })).json()
    expect(card).toMatchObject({ kept: true, details: { ppsn: '', iban: 'IE29AIBK93115212345678' } })
    expect(JSON.stringify(await colly.history())).toContain('Turned off asking for PPS numbers')
    expect((await db.query(`SELECT no_ppsn FROM settings WHERE id = 'applications'`)).rows).toEqual([{ no_ppsn: true }])
  })
})

describe('the privacy page (ADR 0193)', () => {
  it('is open to anyone and says where details are kept and for how long', async () => {
    const { app } = await setUp()
    const res = await app.inject({ url: '/privacy' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('How we look after your details')
    expect(res.body).toContain('European Union')
    expect(res.body).toContain('12 months')
    expect(res.body).toContain('dataprotection.ie')
  })
})

describe('signing a member of staff out everywhere (the breach plan)', () => {
  it('ends every session of theirs, is a director’s alone, and is in the history', async () => {
    const { app, db, colly } = await setUp()
    await colly.send('person.upsert', { id: 'orla', name: 'Orla Kenny', kind: 'staff', email: 'orla@sessionhire.com', ...PERSON })
    await colly.send('person.role', { id: 'orla', role: 'office' })
    const phone = await staff(app, db, 'Orla Kenny', IPHONE, 'orla-phone')
    const laptop = await staff(app, db, 'Orla Kenny', WINDOWS, 'orla-laptop')
    expect((await app.inject({ url: '/api/me', cookies: phone.cookies })).json()).toMatchObject({ user: { email: 'orla@sessionhire.com' } })
    // The office can't sign anyone out.
    expect((await app.inject({ method: 'POST', url: '/api/people/colly/sign-out', cookies: laptop.cookies })).statusCode).toBe(403)
    const res = await app.inject({ method: 'POST', url: '/api/people/orla/sign-out', cookies: colly.cookies })
    expect(res.json()).toEqual({ ended: 2 })
    for (const s of [phone, laptop]) expect((await app.inject({ url: '/api/me', cookies: s.cookies })).json().user ?? null).toBeNull()
    expect(JSON.stringify(await colly.history())).toContain('Signed Orla Kenny out of the app on every phone and computer (2 devices)')
    // A freelancer has no sign-in to end.
    expect((await app.inject({ method: 'POST', url: '/api/people/aoife/sign-out', cookies: colly.cookies })).statusCode).toBe(422)
  })
})
