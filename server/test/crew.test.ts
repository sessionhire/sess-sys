import { addDays, dayLabel, daysLabel, feedCodeFor, feedPath, irishToday, MemoryStorage, newId, SyncClient, type CommandInput, type CommandName, type CrewCall, type HistoryPage, type MutationResult, type Offer, type Person } from '@sh/shared'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.ts'
import { readApp } from '../src/calendar/import.ts'
import { pgliteDb, type Db } from '../src/db.ts'
import { flashOf, IPHONE, server as signedIn, staff } from './people.ts'

/**
 * Crew booking, as the people involved see it: ops send offers from the
 * app, freelancers answer from their private link with no app or login,
 * and the server keeps anyone from being double booked or a call from
 * being over-filled.
 */

// The calls here are on fixed days in October 2026; the clock stays before them, so they're never in the past.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T09:00:00Z'))
})

let cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  vi.useRealTimers()
  for (const fn of cleanup.reverse()) await fn()
  cleanup = []
})

/** The last test server's database, to read what it recorded. */
let lastDb: Awaited<ReturnType<typeof pgliteDb>>

async function server() {
  const db = await pgliteDb()
  lastDb = db
  const app = await buildApp({ db })
  cleanup.push(async () => {
    await app.close()
    await db.close()
  })
  return app
}

async function send<N extends CommandName>(app: FastifyInstance, name: N, args: CommandInput<N>): Promise<MutationResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    payload: { clientId: 'ops-laptop', mutations: [{ id: newId(), name, args, createdAt: new Date().toISOString() }] },
  })
  return res.json().results[0]
}

async function entity<T>(app: FastifyInstance, kind: string, id: string): Promise<T> {
  const res = await app.inject({ method: 'GET', url: '/api/sync/pull?after=0' })
  const changes = res.json().changes.filter((c: { entity: string; id: string }) => c.entity === kind && c.id === id)
  return changes[changes.length - 1].data
}

async function person(app: FastifyInstance, name: string): Promise<Person> {
  const id = newId()
  await send(app, 'person.upsert', { id, name, kind: 'freelancer', email: null, phone: '+353871234567', skills: ['audio'], dayRateCents: null, notes: '' })
  return entity<Person>(app, 'person', id)
}

async function call(app: FastifyInstance, over: Partial<CommandInput<'call.create'>> = {}) {
  const id = newId()
  const r = await send(app, 'call.create', {
    id,
    project: 'Electric Picnic',
    phase: 'Build',
    venue: 'Stradbally Hall',
    role: 'Audio tech',
    start: '2026-10-02',
    end: '2026-10-04',
    callTime: '08:00',
    needed: 1,
    dayRateCents: 25000,
    details: 'Food on site. Parking at gate C.',
    replyBy: null,
    ...over,
  })
  expect(r.status).toBe('applied')
  return id
}

async function offer(app: FastifyInstance, callId: string, personId: string, override = false) {
  const id = newId()
  const result = await send(app, 'offer.send', { id, callId, personId, override })
  return { id, result }
}

/** Post a form from a freelancer's link page, as their phone would. */
async function answer(app: FastifyInstance, token: string, offerId: string, fields: Record<string, string | string[]>) {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) body.append(k, x)
  const res = await app.inject({
    method: 'POST',
    url: `/f/${token}/offers/${offerId}`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: body.toString(),
  })
  // A refusal is drawn at once, with what was typed still in the form (rule 11); it lands at the address posted to.
  if (res.statusCode === 422) return { ...flashOf(res.body), to: new URL(`/f/${token}/offers/${offerId}`, 'http://x'), page: res.body }
  expect(res.statusCode).toBe(303)
  const to = new URL(res.headers.location as string, 'http://x')
  // The message is read from the page the address leads to: the address carries only a code (audit finding 21).
  const page = await app.inject({ url: to.pathname + to.search })
  return { ...flashOf(page.body), to, page: page.body }
}

/** One offer's card, as the page draws it. */
function cardOf(html: string, offerId: string) {
  const from = html.indexOf(`id="o-${offerId}"`)
  expect(from).toBeGreaterThan(-1)
  return html.slice(from, html.indexOf('</article>', from))
}

/** A page as it reads, whichever of its spaces a line never breaks at. */
const said = (html: string) => html.replace(/ /g, ' ')

/**
 * Where a refused post's page lands: the forms post to an address ending in #refused, and the page drawn again gives
 * that id to one place, the field the refusal is about or the refusal itself. Its opening tag, and what follows it.
 */
function landing(html: string) {
  expect(html.match(/ id="refused"/g)).toHaveLength(1)
  const at = html.search(/<[^<>]* id="refused"[^<>]*>/)
  return html.slice(at)
}

describe('freelancer link', () => {
  it('shows the full offer without a login and accepts from a plain form', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app)
    const o = await offer(app, c, aoife.id)
    expect(o.result.status).toBe('applied')

    const page = await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}` })
    expect(page.statusCode).toBe(200)
    expect(page.headers['cache-control']).toBe('no-store')
    expect(page.body).toContain('Hi Aoife')
    expect(page.body).toContain('Electric Picnic')
    expect(page.body).toContain('Stradbally Hall')
    expect(page.body).toContain('€250 a day')
    expect(page.body).toContain('Waiting on you')
    // The one piece of script is the Copy button beside the calendar address; everything else works without any.
    expect(page.body.match(/<script/g)).toHaveLength(1)

    const r = await answer(app, aoife.linkToken, o.id, { answer: 'accept', picker: '1', days: ['2026-10-02', '2026-10-03', '2026-10-04'] })
    expect(r).toMatchObject({ ok: true })
    const after = await entity<Offer>(app, 'offer', o.id)
    expect(after).toMatchObject({ status: 'accepted', respondedVia: 'link' })
  })

  it('refuses unknown links and other people’s offers', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const o = await offer(app, await call(app), aoife.id)

    expect((await app.inject({ method: 'GET', url: '/f/not-a-real-token-at-all' })).statusCode).toBe(404)
    const r = await answer(app, niall.linkToken, o.id, { answer: 'decline' })
    expect(r.ok).toBe(false)
    expect((await entity<Offer>(app, 'offer', o.id)).status).toBe('offered')
  })

  it('stops working once ops issue a new link', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    await send(app, 'person.newLink', { id: aoife.id })
    expect((await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}` })).statusCode).toBe(404)
    const fresh = await entity<Person>(app, 'person', aoife.id)
    expect((await app.inject({ method: 'GET', url: `/f/${fresh.linkToken}` })).statusCode).toBe(200)
  })

  it('takes some days of a multi-day job, and a counter-offer', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const c = await call(app)
    const a = await offer(app, c, aoife.id)
    const n = await offer(app, c, niall.id)

    // No day ticked: said under the days, which the refused page lands on, not at the top of the card.
    const none = await answer(app, aoife.linkToken, a.id, { answer: 'accept', picker: '1', days: [] })
    expect(none).toMatchObject({ ok: false, message: 'Tick at least one day, or press Decline.' })
    expect(landing(none.page)).toMatch(new RegExp(`^<fieldset class="days" aria-describedby="days-error-${a.id}" id="refused"><legend>Your days</legend>[^]*?</fieldset><p class="field-error" id="days-error-${a.id}" role="alert">Tick at least one day`))
    expect(cardOf(none.page, a.id)).not.toContain('class="flash')
    expect(await answer(app, aoife.linkToken, a.id, { answer: 'accept', picker: '1', days: ['2026-10-02', '2026-10-03'] })).toMatchObject({ ok: true })
    // Niall only asks for more money on the day still open.
    expect(await answer(app, niall.linkToken, n.id, { answer: 'counter', picker: '1', days: ['2026-10-04'], rate: '300' })).toMatchObject({ ok: true })
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'countered', counterRateCents: 30000, days: ['2026-10-04'] })

    const confirmed = await send(app, 'offer.confirm', { id: n.id })
    expect(confirmed.status).toBe('applied')
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'confirmed', dayRateCents: 30000 })

    // A page from before the office confirmed it sends Update my days with none ticked, or a rate: the confirmed card has
    // no days or rate to say it under, so it's said at the top of the card, which the page lands on.
    const stale: [Record<string, string | string[]>, string][] = [
      [{ answer: 'accept', picker: '1', days: [] }, "Tick at least one day, or use Can't make it."],
      [{ answer: 'counter', picker: '1', days: ['2026-10-04'], rate: 'lots' }, 'Put in a price like 250 or 1,250.50.'],
    ]
    for (const [fields, message] of stale) {
      const late = await answer(app, niall.linkToken, n.id, fields)
      expect(late).toMatchObject({ ok: false, message })
      expect(cardOf(late.page, n.id)).toContain(`<p class="flash bad" role="alert" id="refused">${message.replace(/'/g, '&#39;')}</p>`)
      expect(landing(late.page)).toMatch(/^<p class="flash bad" role="alert" id="refused">/)
      expect(late.page).not.toContain('class="field-error')
      expect(late.page).toContain('<title>Error: Session Hire: your work</title>')
    }
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'confirmed', dayRateCents: 30000 })
  })

  it('after a counter, names the rate Accept agrees to and says the asked rate is withdrawn (audit, 20 October 2026, finding 6)', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const o = await offer(app, await call(app), aoife.id)
    const before = cardOf((await app.inject({ url: `/f/${aoife.linkToken}` })).body, o.id)
    expect(before).toContain('<button class="yes" name="answer" value="accept">Accept these days</button>')

    expect(await answer(app, aoife.linkToken, o.id, { answer: 'counter', picker: '1', days: ['2026-10-02', '2026-10-03'], rate: '300' })).toMatchObject({ ok: true })
    const countered = cardOf((await app.inject({ url: `/f/${aoife.linkToken}` })).body, o.id)
    // Sending a rate is the one filled button; Accept is plain, and says the rate it agrees to.
    expect(countered).toContain('<button name="answer" value="accept">Accept these days at €250 a day instead</button>')
    expect(countered).toContain('<button class="yes" name="answer" value="counter">Send rate</button>')

    const accepted = await answer(app, aoife.linkToken, o.id, { answer: 'accept', picker: '1', days: ['2026-10-02', '2026-10-03'] })
    expect(accepted).toMatchObject({ ok: true, message: "You're down for it at the rate offered, shown here; the rate you asked for is withdrawn. The office will confirm." })
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'accepted', counterRateCents: null, dayRateCents: 25000 })
  })

  it('takes Enter in the rate field as Send rate, or asks for a tap: never as Accept', async () => {
    // Enter presses the form's out-of-sight first button, which answers "implicit": a rate is a counter, and nothing else happens.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const o = await offer(app, await call(app), aoife.id)

    const blank = await answer(app, aoife.linkToken, o.id, { answer: 'implicit', picker: '1', days: ['2026-10-02', '2026-10-03'], rate: '' })
    expect(blank).toMatchObject({ ok: false, message: 'Tap Accept, Decline or Send rate.' })
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'offered', counterRateCents: null })

    expect(await answer(app, aoife.linkToken, o.id, { answer: 'implicit', picker: '1', days: ['2026-10-02', '2026-10-03'], rate: '350' })).toMatchObject({ ok: true })
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'countered', counterRateCents: 35000, days: ['2026-10-02', '2026-10-03'] })
  })

  it('reads the rate as the freelancer means it, and says what to put in when it is not a price', async () => {
    // "€1,250" was read as €1.25 and "€250" as nothing at all (audit finding 15).
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const o = await offer(app, await call(app), aoife.id)
    const rate = (typed: string) => answer(app, aoife.linkToken, o.id, { answer: 'counter', picker: '1', days: ['2026-10-02'], rate: typed })

    const lots = await rate('lots')
    expect(lots).toMatchObject({ ok: false, message: 'Put in a price like 250 or 1,250.50.' })
    // Said under the rate field, which is marked and joined to it, not at the top of the card (audit, 20 October 2026, finding 90),
    // and the page drawn again lands on the field, with "Error: " first in its title.
    const refusedCard = cardOf(lots.page, o.id)
    expect(refusedCard).not.toContain('class="flash')
    expect(refusedCard).toMatch(new RegExp(`<input name="rate" inputmode="decimal" aria-invalid="true" aria-describedby="rate-error-${o.id}" value="lots"></span></label><p class="field-error" id="rate-error-${o.id}" role="alert">`))
    expect(landing(lots.page)).toMatch(/^<label id="refused">Day rate you'd do it for/)
    expect(lots.page).toContain('<title>Error: Session Hire: your work</title>')
    expect(await rate('0')).toMatchObject({ ok: false, message: 'Put in the day rate you would do it for.' })
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'offered', counterRateCents: null })

    expect(await rate('€1,250')).toMatchObject({ ok: true })
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'countered', counterRateCents: 125000 })
    expect(await rate('1 250,50')).toMatchObject({ ok: true })
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'countered', counterRateCents: 125050 })
    expect(await rate('€ 300')).toMatchObject({ ok: true })
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'countered', counterRateCents: 30000 })

    // The field itself lets those through: a pattern on it would have the browser refuse "€300" in its own words before the page saw it.
    const card = cardOf((await app.inject({ url: `/f/${aoife.linkToken}` })).body, o.id)
    const field = /<input name="rate"[^>]*>/.exec(card)?.[0]
    expect(field).toContain('inputmode="decimal"')
    expect(field).not.toContain('pattern=')
    // The euro is drawn in the box, before the number, and is in the field's name, not "(€)" after the words.
    expect(card).toContain(`<label>Day rate you'd do it for<span class="sr-only">, €</span> <span class="unit-box"><span class="unit" aria-hidden="true">€</span><input name="rate"`)
    expect(card).not.toContain('(€)')
    expect(card).toContain(`/offers/${o.id}#refused"`)
  })

  it('puts the message in the offer’s card, where the page lands after an answer', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const picnic = await offer(app, await call(app), aoife.id)
    const gig = await offer(app, await call(app, { project: 'Vicar Street', phase: 'Show', start: '2026-10-04', end: '2026-10-04' }), aoife.id)

    const thanks = await answer(app, aoife.linkToken, picnic.id, { answer: 'accept', picker: '1', days: ['2026-10-02', '2026-10-03', '2026-10-04'] })
    expect(thanks.to.searchParams.get('o')).toBe(picnic.id)
    expect(thanks.to.hash).toBe(`#o-${picnic.id}`)
    let page = (await app.inject({ method: 'GET', url: thanks.to.pathname + thanks.to.search })).body
    expect(cardOf(page, picnic.id)).toContain('<p class="flash ok" role="status">Thanks, you&#39;re down for it.')
    expect(page.match(/class="flash/g)).toHaveLength(1)
    expect(page).toContain('<title>Session Hire: your work</title>')

    // A refusal is an alert, in the card of the offer it's about, drawn at once with the note still in it (rule 11).
    const refused = await answer(app, aoife.linkToken, gig.id, { answer: 'accept', note: 'Can bring my own desk' })
    page = refused.page
    expect(cardOf(page, gig.id)).toContain('>Can bring my own desk</textarea>')
    expect(cardOf(page, gig.id)).toContain('<p class="flash bad" role="alert" id="refused">Already booked on Electric Picnic (Build)')
    expect(landing(page)).toMatch(/^<p class="flash bad" role="alert" id="refused">Already booked/)
    expect(page.match(/class="flash/g)).toHaveLength(1)
    expect(page).toContain('<title>Error: Session Hire: your work</title>')

    // A declined offer has no card any more, so its message goes at the top.
    const off = await answer(app, aoife.linkToken, gig.id, { answer: 'decline' })
    page = (await app.inject({ method: 'GET', url: off.to.pathname + off.to.search })).body
    expect(page).not.toContain(`id="o-${gig.id}"`)
    expect(page.indexOf('<p class="flash ok" role="status">Thanks for letting us know.')).toBeLessThan(page.indexOf('<section>'))
  })

  it('folds Decline away, as it cannot be taken back from the page', async () => {
    // Proves: Decline is never a tap beside Accept (rule 1): it's behind "Can't do this one?", and names the job.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const o = await offer(app, await call(app), aoife.id)
    const card = cardOf((await app.inject({ url: `/f/${aoife.linkToken}` })).body, o.id)
    const fold = card.indexOf('<details class="decline"><summary>Can\'t do this one?</summary>')
    expect(fold).toBeGreaterThan(-1)
    expect(card.indexOf('value="decline">Decline Electric Picnic</button>')).toBeGreaterThan(fold)
    expect(card.match(/value="decline"/g)).toHaveLength(1)
  })

  it('lets a freelancer mark days off, which ops then need to override', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const res = await app.inject({
      method: 'POST',
      url: `/f/${aoife.linkToken}/away`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'start=2026-10-03&end=2026-10-05&note=On+tour',
    })
    expect(res.statusCode).toBe(303)
    // Back at the list, with the thank-you drawn over it rather than at the top of the page (audit, 5 November 2026, finding 31).
    expect(res.headers.location).toMatch(/[?&]s=away.*#away$/)
    const added = (await app.inject({ url: String(res.headers.location).replace(/#.*/, '') })).body
    expect(added.indexOf('<p class="flash')).toBeGreaterThan(added.indexOf('<section id="away">'))
    const removeAt = added.match(/action="([^"]*\/away\/[^"]+\/remove)[^"]*"/)![1]!
    const removed = await app.inject({ method: 'POST', url: removeAt, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: '' })
    expect(removed.headers.location).toMatch(/[?&]s=away.*#away$/)
    expect((await app.inject({ method: 'POST', url: `/f/${aoife.linkToken}/away`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: 'start=2026-10-03&end=2026-10-05&note=On+tour' })).statusCode).toBe(303)

    // Dates it can't read are turned down beside the form, with what was typed still in it (rule 11).
    const bad = await app.inject({
      method: 'POST',
      url: `/f/${aoife.linkToken}/away`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'start=someday&note=At+a+wedding',
    })
    expect(bad.statusCode).toBe(422)
    expect(flashOf(bad.body)).toMatchObject({ ok: false, message: "The first day off isn't a real date. Pick it again." })
    expect(bad.body.indexOf('<p class="field-error"')).toBeGreaterThan(bad.body.indexOf('<section id="away">'))
    expect(bad.body).toContain('value="At a wedding"')
    // From and Until are a pair, the note under them, and the form is drawn again landing on the pair, with the date refused in it.
    expect(bad.body).toContain('<div class="pair" id="refused"><div><label>From <input type="date" name="start" required')
    expect(bad.body).toContain('<label>Until <input type="date" name="end"')
    expect(bad.body).toContain('action="http://localhost:80/f/' + aoife.linkToken + '/away#refused"')

    // Each error says which date (audit, P3: words), under that date, which is marked and joined to it; the page lands on
    // the pair, so From is in sight with Until.
    const away = (payload: string) =>
      app.inject({ method: 'POST', url: `/f/${aoife.linkToken}/away`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload })
    const under = async (payload: string, name: 'start' | 'end', message: string) => {
      const page = (await away(payload)).body
      expect(flashOf(page)).toMatchObject({ ok: false, message })
      expect(landing(page)).toMatch(/^<div class="pair" id="refused"><div><label>From <input type="date" name="start"/)
      expect(page).toMatch(new RegExp(`<input type="date" name="${name}"[^>]* aria-invalid="true" aria-describedby="away-${name}-error"[^>]*></label><p class="field-error" id="away-${name}-error" role="alert">`))
      expect(page.match(/aria-invalid="true"/g)).toHaveLength(1)
      expect(page).not.toContain('<p class="flash')
    }
    await under('note=Gig', 'start', 'Put in the first day off.')
    await under('start=2026-10-03&end=2026-02-30', 'end', "The last day off isn't a real date. Pick it again, or leave it empty for one day.")
    await under('start=2026-10-05&end=2026-10-03', 'end', 'The days off end before they start.')
    // A page left open over midnight: the first day has gone by, but the rules say first that the last is before it.
    await under('start=2026-09-27&end=2026-09-26', 'end', 'The days off end before they start.')

    // The same form sent twice (a double tap, or the browser sending it again) adds the days once.
    const formId = (await app.inject({ url: `/f/${aoife.linkToken}` })).body.match(/name="id" value="([a-z0-9]+)"/)![1]!
    for (let i = 0; i < 2; i++) expect((await away(`id=${formId}&start=2026-11-10&end=2026-11-12&note=Holiday`)).statusCode).toBe(303)
    const { rows } = await lastDb.query("SELECT 1 FROM unavailability WHERE start_day = '2026-11-10'")
    expect(rows).toHaveLength(1)

    const c = await call(app)
    const refused = await offer(app, c, aoife.id)
    expect(refused.result).toMatchObject({ status: 'rejected', reason: { code: 'clash' } })
    expect(refused.result.status === 'rejected' && refused.result.reason.message).toContain('On tour')
    const forced = await offer(app, c, aoife.id, true)
    expect(forced.result.status).toBe('applied')
    expect(await entity<Offer>(app, 'offer', forced.id)).toMatchObject({ override: true })
  })

  it('checks days off from the link: none gone by, none past a year, overlaps as one row, and a booking said beside them', async () => {
    // Proves (audit, 20 October 2026, finding 50): the link refuses a first day already gone and a span past a year, while
    // the office can still backdate; overlapping days off become one row with both notes; and days off over a booking they
    // hold say beside the row that they're still booked and where to say they can't make it, the booking staying as it was.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const away = (payload: string) =>
      app.inject({ method: 'POST', url: `/f/${aoife.linkToken}/away`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload })
    const past = await away('start=2020-01-01&end=2020-01-03')
    expect(past.statusCode).toBe(422)
    expect(flashOf(past.body)).toMatchObject({ ok: false, message: 'The first day off has gone by. Pick today or a day after it.' })
    expect(past.body).toContain('value="2020-01-01"')
    // Said under the date it's about: the first day, gone by; the last, too far after it.
    expect(landing(past.body)).toMatch(/^<div class="pair" id="refused"><div><label>From <input type="date" name="start"[^>]* aria-invalid="true"/)
    const long = (await away('start=2026-10-01&end=2999-12-31')).body
    expect(flashOf(long)).toMatchObject({ ok: false, message: 'Days off can be at most 366 days at a time.' })
    expect(landing(long)).toMatch(/^<div class="pair" id="refused">/)
    expect(long).toMatch(/<label>Until <input type="date" name="end"[^>]* aria-invalid="true"/)
    // The office's own path can still backdate, but not for ever either.
    expect(await send(app, 'unavailability.add', { id: newId(), personId: aoife.id, start: '2026-09-01', end: '2026-09-02', note: '' })).toMatchObject({ status: 'applied' })
    expect(await send(app, 'unavailability.add', { id: newId(), personId: aoife.id, start: '2020-01-01', end: '2025-08-01', note: '' })).toMatchObject({ status: 'rejected' })

    expect((await away('start=2026-10-10&end=2026-10-14&note=On+tour')).statusCode).toBe(303)
    expect((await away('start=2026-10-13&end=2026-10-16&note=Wedding')).statusCode).toBe(303)
    const { rows } = await lastDb.query<{ start_day: string; end_day: string; note: string }>(
      "SELECT start_day::text, end_day::text, note FROM unavailability WHERE start_day >= '2026-10-01'"
    )
    expect(rows).toEqual([{ start_day: '2026-10-10', end_day: '2026-10-16', note: 'On tour; Wedding' }])

    // Booked on a job, then days off over one of its days: added, said beside the row, and the booking still holds.
    const o = await offer(app, await call(app, { start: '2026-10-20', end: '2026-10-21' }), aoife.id)
    await answer(app, aoife.linkToken, o.id, { answer: 'accept', picker: '1', days: ['2026-10-20', '2026-10-21'] })
    await send(app, 'offer.confirm', { id: o.id })
    expect((await away('start=2026-10-21&end=2026-10-22')).statusCode).toBe(303)
    const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    const list = page.slice(page.indexOf('<section id="away">'), page.indexOf('class="add-away"'))
    expect(list).toContain(`You're booked on <a href="#o-${o.id}">Electric Picnic</a> that day. Days off don't take you off it: use Can't make it on that booking.`)
    expect(list.match(/class="clash"/g)).toHaveLength(1)
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'confirmed' })
  })

  it('says the year on a date in another year, and not on one this autumn (audit, 20 October 2026, finding 89)', async () => {
    // Proves: the link page's dates carry the year where it isn't plain from today, so "5 Jan" is never a guess.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    await offer(app, await call(app, { project: 'New Year Gig', start: '2027-01-05', end: '2027-01-05' }), aoife.id)
    await offer(app, await call(app), aoife.id)
    const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    expect(page).toContain('<dt>Dates</dt><dd>Tue 5 Jan 2027</dd>')
    expect(page).toContain('<dt>Dates</dt><dd>Fri 2 Oct to Sun 4 Oct</dd>')
  })

  it('draws the next three bookings in full and the rest as a line each, opening in place (audit, 20 October 2026, finding 48)', async () => {
    // Proves: at volume the page doesn't draw every booking as a full card; the soonest three are, and the rest fold to
    // the row the app draws, the job, then role · phase · days · call, then the status, opening with no script; one a
    // refused post is about opens by itself.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const booked: string[] = []
    // Made out of order, so the page has to put them soonest first.
    for (const n of [9, 3, 7, 1, 5]) {
      const dayOf = `2026-10-${String(10 + n).padStart(2, '0')}`
      const o = await offer(app, await call(app, { project: `Gig ${n}`, start: dayOf, end: dayOf }), aoife.id)
      await answer(app, aoife.linkToken, o.id, { answer: 'accept' })
      await send(app, 'offer.confirm', { id: o.id })
      booked[n] = o.id
    }
    const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    const section = page.slice(page.indexOf('<section id="bookings">'), page.indexOf('<section id="away">'))
    const full = [...section.matchAll(/<article class="offer confirmed" id="o-(\w+)">/g)].map((m) => m[1])
    expect(full.slice(0, 3)).toEqual([booked[1], booked[3], booked[5]])
    expect(section).toContain('2 more bookings after these, a line each: tap one to open it.')
    expect(section.match(/<details class="later">/g)).toHaveLength(2)
    // As it reads; the spaces a line never breaks at are the shared row's own (shared/test/bookings.test.ts).
    expect(said(section)).toContain('<summary><b>Gig 7</b><span class="line">Audio tech · Build · Sat 17 Oct · call 08:00 <span class="tag confirmed">Booked</span></span></summary>')
    expect(section.indexOf('Gig 7')).toBeLessThan(section.indexOf('Gig 9'))
    // The glance line stays in view as the page scrolls.
    expect(page).toMatch(/\.glance\{[^}]*position:sticky/)
  })

  it('draws the three offers to answer soonest in full and the rest as a line each with the reply-by day (audit, 5 November 2026, finding 32)', async () => {
    // Proves: at volume the offers fold as bookings do, soonest reply-by first, so the bookings aren't five screens down.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const made: string[] = []
    for (const n of [9, 3, 7, 1, 5]) {
      const dayOf = `2026-10-${String(10 + n).padStart(2, '0')}`
      made[n] = (await offer(app, await call(app, { project: `Gig ${n}`, start: dayOf, end: dayOf, replyBy: dayOf }), aoife.id)).id
    }
    const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    const section = page.slice(page.indexOf('<section id="offers">'), page.indexOf('<section id="bookings">'))
    const full = [...section.matchAll(/<article class="offer offered" id="o-(\w+)">/g)].map((m) => m[1])
    expect(full.slice(0, 3)).toEqual([made[1], made[3], made[5]])
    expect(section).toContain('2 more offers after these, a line each: tap one to answer it.')
    expect(section.match(/<details class="later">/g)).toHaveLength(2)
    expect(said(section)).toContain('<summary><b>Gig 7</b><span class="line">Audio tech · Build · Sat 17 Oct · call 08:00 · reply by Sat 17 Oct <span class="tag offered">')
  })

  it('publishes bookings as a calendar feed any calendar app can subscribe to', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const o = await offer(app, await call(app), aoife.id)
    await answer(app, aoife.linkToken, o.id, { answer: 'accept', picker: '1', days: ['2026-10-02', '2026-10-04'] })
    await send(app, 'offer.confirm', { id: o.id })

    const ics = await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}/calendar.ics` })
    expect(ics.headers['content-type']).toContain('text/calendar')
    const body = ics.body
    // Two separate blocks, because she took the 2nd and the 4th only.
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(body).toContain('DTSTART;VALUE=DATE:20261002')
    expect(body).toContain('DTEND;VALUE=DATE:20261003')
    expect(body).toContain('SUMMARY:Electric Picnic - Build 1/2')
    expect(body).toContain('STATUS:CONFIRMED')
    for (const line of body.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
  })

  it('exports what is held on the person, without the link secret', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const res = await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}/data.json` })
    expect(res.json().profile.name).toBe('Aoife Byrne')
    expect(res.body).not.toContain(aoife.linkToken)
  })
})

describe('the freelancer page (audit finding 21)', () => {
  it('shows the reply-by day the office set when asking for crew, and the one it changes it to', async () => {
    // Proves: a reply-by day sent with a new call (both office forms send call.create) reaches the page, follows call.update, and goes when cleared.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const today = irishToday()
    const c = await call(app, { start: addDays(today, 7), end: addDays(today, 9), replyBy: addDays(today, 5) })
    const o = await offer(app, c, aoife.id)
    let page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    expect(cardOf(page, o.id)).toContain(`<dt>Reply by</dt><dd>${dayLabel(addDays(today, 5))}</dd>`)

    expect((await send(app, 'call.update', { id: c, replyBy: addDays(today, 3) })).status).toBe('applied')
    page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    expect(cardOf(page, o.id)).toContain(`<dt>Reply by</dt><dd>${dayLabel(addDays(today, 3))}</dd>`)

    // Cleared, it leaves the page.
    expect((await send(app, 'call.update', { id: c, replyBy: null })).status).toBe('applied')
    page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    expect(cardOf(page, o.id)).not.toContain('Reply by')

    // A day after the job's last is turned down in words, whether the call is made with it or changed to it; the last day itself is fine.
    const late = { message: "The reply-by day is after the job's last day." }
    expect(await send(app, 'call.update', { id: c, replyBy: addDays(today, 10) })).toMatchObject({ status: 'rejected', reason: late })
    expect(await send(app, 'call.update', { id: c, replyBy: addDays(today, 9) })).toMatchObject({ status: 'applied' })
    const made = { id: newId(), projectId: null, phaseId: null, project: 'Vicar Street', phase: '', venue: '', role: 'Audio tech', callTime: null, needed: 1, dayRateCents: null, details: '' }
    expect(await send(app, 'call.create', { ...made, start: addDays(today, 7), end: addDays(today, 8), replyBy: addDays(today, 9) })).toMatchObject({ status: 'rejected', reason: late })
  })

  it('leaves a day they hold on another job unticked, and says which job, before the server has to refuse it', async () => {
    // Proves: the day picker never ticks a day held on another job, even one they picked when sending a rate, and names the job beside it; a one-day offer says it in words; accepting as the page offers it goes through.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const [d1, d2, d3, d4] = [7, 8, 9, 10].map((n) => addDays(irishToday(), n)) as [string, string, string, string]
    const picnic = await offer(app, await call(app, { start: d1, end: d3 }), aoife.id)
    const gig = await offer(app, await call(app, { project: 'Vicar Street', phase: 'Show', start: d3, end: d4 }), aoife.id)
    // A rate sent for both days of the gig, then the picnic taken, which holds the first of them.
    expect(await answer(app, aoife.linkToken, gig.id, { answer: 'counter', picker: '1', days: [d3, d4], rate: '300' })).toMatchObject({ ok: true })
    expect(await answer(app, aoife.linkToken, picnic.id, { answer: 'accept', picker: '1', days: [d1, d2, d3] })).toMatchObject({ ok: true })
    await send(app, 'offer.confirm', { id: picnic.id })
    // Offered anyway by the office, over the clash.
    const oneDay = await offer(app, await call(app, { project: 'Olympia', phase: 'Show', start: d2, end: d2 }), aoife.id, true)
    expect(oneDay.result.status).toBe('applied')

    const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    const card = cardOf(page, gig.id)
    expect(card).toContain(`<input type="checkbox" name="days" value="${d3}"> <span class="day">${dayLabel(d3)}</span> <small>booked on Electric Picnic (Build)</small></label>`)
    expect(card).toContain(`<input type="checkbox" name="days" value="${d4}" checked> <span class="day">${dayLabel(d4)}</span></label>`)
    expect(cardOf(page, oneDay.id)).toContain("<p class=\"clash\">You're booked on Electric Picnic (Build) that day.</p>")
    expect(cardOf(page, picnic.id)).not.toContain('booked on')
    // Accepting as the page offers it, with the clashing day left out, goes through first time.
    expect(await answer(app, aoife.linkToken, gig.id, { answer: 'accept', picker: '1', days: [d4] })).toMatchObject({ ok: true })
  })

  it('works out the days held on other jobs from the offers it has read, so five jobs cost it no more reads of the offers than one', async () => {
    // Proves: the page reads the offers table the same number of times however many jobs a person has, not once for each, and still says which days are held elsewhere.
    const db = await pgliteDb()
    const sql: string[] = []
    const app = await buildApp({ db: { ...db, query: (s, p) => (sql.push(s), db.query(s, p)) } })
    cleanup.push(async () => {
      await app.close()
      await db.close()
    })
    const aoife = await person(app, 'Aoife Byrne')
    const [d1, d2] = [addDays(irishToday(), 7), addDays(irishToday(), 8)]
    const held = await offer(app, await call(app, { start: d1, end: d1 }), aoife.id)
    expect(await answer(app, aoife.linkToken, held.id, { answer: 'accept' })).toMatchObject({ ok: true })
    const first = await offer(app, await call(app, { project: 'Vicar Street', start: d1, end: d2 }), aoife.id, true)
    const reads = async () => {
      sql.length = 0
      const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
      return { page, offers: sql.filter((s) => /\boffers\b/.test(s)).length }
    }
    const one = await reads()
    for (let i = 1; i <= 4; i++) await offer(app, await call(app, { project: `Olympia ${i}`, start: d1, end: d2 }), aoife.id, true)
    const five = await reads()
    expect(five.offers).toBe(one.offers)
    for (const page of [one.page, five.page])
      expect(cardOf(page, first.id)).toContain(`<input type="checkbox" name="days" value="${d1}"> <span class="day">${dayLabel(d1)}</span> <small>booked on Electric Picnic (Build)</small></label>`)
  })

  it('shows the message after a post from a short code, or as the refusal the server recorded, never from words in the address', async () => {
    // Proves: the address names a message by a code the server maps to its own words, or by the change it turned down; words typed into it, a code it doesn't know and another person's change all show nothing.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const o = await offer(app, await call(app), aoife.id)
    const asked = await answer(app, aoife.linkToken, o.id, { answer: 'implicit', picker: '1', days: ['2026-10-02'], rate: '' })
    expect(asked).toMatchObject({ ok: false, message: 'Tap Accept, Decline or Send rate.' })

    // A refusal by the rules names the day, in the words the server recorded; a later visit reads it by the change's id.
    const refused = await answer(app, aoife.linkToken, o.id, { answer: 'accept', picker: '1', days: ['2027-01-01'] })
    expect(refused).toMatchObject({ ok: false, message: `${dayLabel('2027-01-01')} is not part of this job.` })
    const change = (await lastDb.query<{ id: string }>(`SELECT id FROM mutations WHERE client_id = $1 AND status = 'rejected'`, [`link:${aoife.id}`])).rows[0]!.id
    expect(flashOf((await app.inject({ url: `/f/${aoife.linkToken}?r=${change}` })).body).message).toBe(`${dayLabel('2027-01-01')} is not part of this job.`)

    const shows = async (token: string, query: string) => (await app.inject({ url: `/f/${token}?${query}` })).body
    const forged = await shows(aoife.linkToken, `m=${encodeURIComponent('<b>Pay me</b> now')}&o=${o.id}`)
    expect(forged).not.toContain('class="flash')
    expect(forged).not.toContain('Pay me')
    for (const query of [`m=not-a-code&o=${o.id}`, 'm=constructor', 'm=__proto__', `r=${encodeURIComponent('Pay me')}`, 'r=0000000000000000000000'])
      expect(flashOf(await shows(aoife.linkToken, query)).message, query).toBe('')
    expect(flashOf(await shows(niall.linkToken, `r=${change}`)).message).toBe('')
  })

  it('shows staff no rate at all, since they are paid through payroll', async () => {
    // Proves: a member of staff's page has no rate line, no "rate to agree" and no rate to send, only a note to go with the answer, and "Call time" as the forms say; nor does their timesheet page.
    const app = await server()
    const id = newId()
    await send(app, 'person.upsert', { id, name: 'Orla Hayes', kind: 'staff', email: null, phone: null, skills: ['LX'], dayRateCents: null, notes: '' })
    const orla = await entity<Person>(app, 'person', id)
    const [d1, d3] = [addDays(irishToday(), 7), addDays(irishToday(), 9)]
    const paid = await offer(app, await call(app, { start: d1, end: d3 }), orla.id)
    const unpaid = await offer(app, await call(app, { project: 'Vicar Street', start: d3, end: d3, dayRateCents: null }), orla.id)

    const page = (await app.inject({ url: `/f/${orla.linkToken}` })).body
    expect(cardOf(page, paid.id)).not.toContain('<dt>Rate</dt>')
    expect(cardOf(page, paid.id)).toContain('<dt>Call time</dt><dd>08:00</dd>')
    expect(cardOf(page, paid.id)).toContain('<summary>Add a note for the office</summary>')
    expect(cardOf(page, unpaid.id)).not.toContain('<dt>Rate</dt>')
    for (const words of ['€250', 'rate to agree', 'name="rate"', 'Send rate', 'different rate']) expect(page).not.toContain(words)
    // Enter can only ask for the two buttons there are, and a post that sends a rate anyway is asked the same, with nothing sent to the office.
    expect(await answer(app, orla.linkToken, paid.id, { answer: 'implicit' })).toMatchObject({ ok: false, message: 'Tap Accept or Decline.' })
    expect(await answer(app, orla.linkToken, paid.id, { answer: 'counter', rate: '300' })).toMatchObject({ ok: false, message: 'Tap Accept or Decline.' })
    expect(await entity<Offer>(app, 'offer', paid.id)).toMatchObject({ status: 'offered', counterRateCents: null })

    // Nor on the timesheet page, which says why there's none, once the company uses timesheets (ADR 0090).
    await send(app, 'timesheets.use', { on: true })
    await answer(app, orla.linkToken, paid.id, { answer: 'accept' })
    await send(app, 'offer.confirm', { id: paid.id })
    const timesheet = (await app.inject({ url: `/f/${orla.linkToken}/timesheet/${paid.id}` })).body
    expect(timesheet).toContain('Staff are paid through payroll')
    expect(timesheet).not.toContain('€250')
    expect(timesheet).not.toContain('to agree')
  })

  it("gives a member of staff Leave in place of days off, with no form, and turns a days-off post down in the app's words", async () => {
    // Proves (UX sweep, 6 November 2026, move 6): a staff link lists their leave to come, approved and waiting, from the
    // requests, and the way to ask for more in the app, where it's approved (ADR 0024); it draws no Add days off, and a
    // page kept from before that posts one anyway is turned down with nothing marked. Days off marked before stay, to read
    // and take back, until they've passed. A freelancer's page keeps Days you can't work and its form.
    const app = await server()
    const id = newId()
    await send(app, 'person.upsert', { id, name: 'Orla Hayes', kind: 'staff', email: null, phone: null, skills: ['LX'], dayRateCents: null, notes: '' })
    const orla = await entity<Person>(app, 'person', id)
    const today = irishToday()
    // 2031, opened for leave as a migration opens a year, for its fixed weekdays: Monday 3 to Friday 7 March, and Tuesday the 18th.
    await lastDb.query('INSERT INTO leave_years (year) VALUES (2031) ON CONFLICT DO NOTHING')
    await send(app, 'person.upsert', { id: 'eoin', name: 'Eoin Byrne', kind: 'staff', email: null, phone: null, skills: [], dayRateCents: null, notes: '', approvesLeave: true })
    expect(await send(app, 'leave.request', { id: 'away-week', personId: id, type: 'annual', start: '2031-03-03', end: '2031-03-07', note: 'Family wedding' })).toMatchObject({ status: 'applied' })
    expect(await send(app, 'leave.request', { id: 'one-day', personId: id, type: 'annual', start: '2031-03-18', end: '2031-03-18', note: '' })).toMatchObject({ status: 'applied' })
    expect(await send(app, 'leave.decide', { id: 'away-week', approved: true, reason: '', by: 'eoin' })).toMatchObject({ status: 'applied' })
    // Days off marked before staff time off was leave, and a run of them already over.
    await send(app, 'unavailability.add', { id: 'course', personId: id, start: addDays(today, 3), end: addDays(today, 3), note: 'First aid course' })
    await send(app, 'unavailability.add', { id: 'over', personId: id, start: addDays(today, -9), end: addDays(today, -8), note: 'Old course' })

    const page = (await app.inject({ url: `/f/${orla.linkToken}` })).body
    const leave = page.slice(page.indexOf('<section id="away">'), page.indexOf('</section>', page.indexOf('<section id="away">')))
    expect(leave).toContain('<h2>Leave</h2>')
    expect(leave).not.toContain("Days you can't work")
    expect(leave).not.toContain('Add days off')
    expect(leave).not.toContain(`/f/${orla.linkToken}/away#refused`)
    // Soonest first: the days off marked before and still to come, the approved week, then the day still waiting.
    const rows = [...leave.matchAll(/<li><span>([^<]*) <small>([^<]*)<\/small><\/span>/g)].map((m) => [m[1], m[2]])
    expect(rows).toEqual([
      [dayLabel(addDays(today, 3), today), 'Days off · First aid course'],
      ['Mon 3 Mar 2031 to Fri 7 Mar 2031', 'Annual leave · Family wedding'],
      ['Tue 18 Mar 2031', 'Annual leave'],
    ])
    expect(leave.match(/<span class="tag (approved|waiting)">(Approved|Waiting for approval)<\/span>/g)).toEqual(['<span class="tag approved">Approved</span>', '<span class="tag waiting">Waiting for approval</span>'])
    // Approved leave marks its days off too, and isn't said twice; the days off marked before keep their Remove.
    expect(leave).not.toContain('Approved leave')
    expect(leave).toContain(`/f/${orla.linkToken}/away/course/remove#away`)
    expect(leave).not.toContain('Old course')
    expect(leave).toMatch(/<a class="sheet-link" href="http:\/\/localhost[:\d]*\/#crew\/leave">Ask for leave in the app ›<\/a>/)
    // Nor does sharing their own calendar offer itself in place of marking days here.
    expect(page).toContain("You can let us see when you're busy in the calendar you already use")
    expect(page).not.toContain('Rather than marking days here')

    // A page kept from before, posting days off anyway: turned down in the app's words, over the list, and nothing marked.
    const posted = await app.inject({
      method: 'POST',
      url: `/f/${orla.linkToken}/away`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `start=${addDays(today, 40)}&end=${addDays(today, 41)}&note=Gig`,
    })
    expect(posted.statusCode).toBe(422)
    expect(flashOf(posted.body)).toMatchObject({ ok: false, message: 'Staff ask for leave in the app, under Leave, where whoever approves time off sees it.' })
    expect(posted.body.indexOf('<p class="flash bad" role="alert" id="refused">')).toBeGreaterThan(posted.body.indexOf('<h2>Leave</h2>'))
    const { rows: marked } = await lastDb.query('SELECT 1 FROM unavailability WHERE person_id = $1 AND start_day = $2', [id, addDays(today, 40)])
    expect(marked).toHaveLength(0)

    // A freelancer's page is as it was.
    const aoife = await person(app, 'Aoife Byrne')
    const hers = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    expect(hers).toContain("<h2>Days you can't work</h2>")
    expect(hers).toContain('<button>Add days off</button>')
    expect(hers).toContain("Rather than marking days here, you can let us see when you're busy")
    expect(hers).not.toContain('Ask for leave in the app')
  })

  it('splits what is over into past work and offers that ended another way, each with its days and the day it ended', async () => {
    // Proves: "Earlier" is now "Past work" and "Offers that ended", and each line says the job, the role, the days and how it ended, with the day: declined, withdrawn or filled.
    // An offer that ended on the office's side, withdrawn or filled, is first news at the top of her offers (ADR 0153), and joins the list after.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const today = irishToday()
    const galaDays = [addDays(today, -10), addDays(today, -9)]
    const worked = await offer(app, await call(app, { project: 'Autumn Gala', phase: 'Show', start: galaDays[0], end: galaDays[1] }), aoife.id)
    await answer(app, aoife.linkToken, worked.id, { answer: 'accept' })
    await send(app, 'offer.confirm', { id: worked.id })
    const said = await offer(app, await call(app), aoife.id)
    await answer(app, aoife.linkToken, said.id, { answer: 'decline' })
    const withdrawn = await offer(app, await call(app, { project: 'Vicar Street', start: '2026-10-06', end: '2026-10-06' }), aoife.id)
    await send(app, 'offer.cancel', { id: withdrawn.id })
    // A shortlist of two for one place: Niall answers first.
    const olympia = await call(app, { project: 'Olympia', phase: 'Show', start: '2026-10-08', end: '2026-10-08' })
    const lost = await offer(app, olympia, aoife.id)
    await answer(app, niall.linkToken, (await offer(app, olympia, niall.id)).id, { answer: 'accept' })
    expect(await entity<Offer>(app, 'offer', lost.id)).toMatchObject({ status: 'filled' })

    const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    expect(page).not.toContain('<h2>Earlier</h2>')
    const past = page.slice(page.indexOf('<h2>Work done</h2>'), page.indexOf('<h2>Offers that ended</h2>'))
    expect(past).toContain(`<li>Autumn Gala (Show) · Audio tech · ${daysLabel(galaDays)} <small>Booked</small></li>`)
    expect(past).not.toContain('Electric Picnic')
    const turned = page.slice(page.indexOf('<h2>Offers that ended</h2>'))
    expect(turned).toContain(`<li>Electric Picnic (Build) · Audio tech · ${daysLabel(['2026-10-02', '2026-10-03', '2026-10-04'])} <small>You declined on ${dayLabel(today)}</small></li>`)
    expect(turned).not.toContain('Autumn Gala')
    // Withdrawn and filled are the office's doing, so news: each a card at the top of her offers, saying how it ended.
    const top = page.slice(page.indexOf('<h2>Offers waiting on you</h2>'), page.indexOf('</section>', page.indexOf('<h2>Offers waiting on you</h2>')))
    expect(cardOf(top, withdrawn.id)).toContain('<h3><span class="news">Withdrawn by the office</span> Vicar Street</h3>')
    expect(cardOf(top, lost.id)).toContain('<h3><span class="news">Filled by someone else</span> Olympia</h3>')
    expect(top).toContain('Nothing else waiting right now.')
    expect(turned).not.toContain('Vicar Street')
    expect(turned).not.toContain('Olympia')

    // A week on, they're in the list, in the same words, with the day each ended.
    vi.setSystemTime(new Date('2026-10-05T09:00:00Z'))
    // As it reads, whichever of its spaces a line never breaks at ("said" is the declined offer here).
    const after = (await app.inject({ url: `/f/${aoife.linkToken}` })).body.replace(/\u00a0/g, ' ')
    expect(after).not.toContain('class="offer ended"')
    const list = after.slice(after.indexOf('<h2>Offers that ended</h2>'))
    expect(list).toMatch(new RegExp(`<li>Vicar Street \\(Build\\) · Audio tech · [^<]* <small>Withdrawn by the office on ${dayLabel(today, '2026-10-05')}</small></li>`))
    expect(list).toMatch(new RegExp(`<li>Olympia \\(Show\\) · Audio tech · [^<]* <small>Filled by someone else on ${dayLabel(today, '2026-10-05')}</small></li>`))
  })

  it('marks what changed on a booking since the yes, for a week or until its call, reading the log once a page and writing nothing', async () => {
    // Proves (UX sweep, 6 November 2026, move 6): nothing is sent when the office moves a call (ADR 0048), so the card says it
    // the next time the page is opened: the call time, the days and the venue as they are now, with what she said yes to in
    // brackets, until the call after the change; a change it can't put in brackets is said plainly; and drawing the page
    // reads the log once, whatever the number of bookings, and writes nothing.
    const db = await pgliteDb()
    const read: string[] = []
    const counted: Db = { ...db, query: (sql, params) => (read.push(sql), db.query(sql, params)) }
    const app = await buildApp({ db: counted })
    cleanup.push(async () => {
      await app.close()
      await db.close()
    })
    const aoife = await person(app, 'Aoife Byrne')
    const picnic = await call(app, { callTime: '09:00' })
    const o = await offer(app, picnic, aoife.id)
    await answer(app, aoife.linkToken, o.id, { answer: 'accept' })
    await send(app, 'offer.confirm', { id: o.id })
    const later = await call(app, { project: 'Vicar Street', venue: 'Vicar Street', start: '2026-10-20', end: '2026-10-20', callTime: '10:00' })
    const v = await offer(app, later, aoife.id)
    await answer(app, aoife.linkToken, v.id, { answer: 'accept' })
    const page = async () => (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    // Confirming it is no change to say.
    expect(await page()).not.toContain('class="was"')

    // The office moves Electric Picnic a day later, to 07:30 and to Punchestown, and drops Vicar Street's call time.
    await send(app, 'call.update', { id: picnic, start: '2026-10-03', end: '2026-10-05', callTime: '07:30', venue: 'Punchestown' })
    await send(app, 'call.update', { id: later, callTime: null })
    const [{ n: logged }] = (await db.query<{ n: string }>('SELECT count(*) AS n FROM changes')).rows as [{ n: string }]
    read.length = 0
    let card = cardOf(said(await page()), o.id)
    expect(card).toContain(`<dt>Dates</dt><dd>${said(daysLabel(['2026-10-03', '2026-10-04', '2026-10-05']))} <span class="was">(was ${said(daysLabel(['2026-10-02', '2026-10-03', '2026-10-04']))})</span></dd>`)
    expect(card).toContain('<dt>Call time</dt><dd>07:30 <span class="was">(was 09:00)</span></dd>')
    expect(card).toContain('>Punchestown</a> <span class="was">(was Stradbally Hall)</span></dd>')
    expect(card).not.toContain('Changed since you said yes')
    // A call time taken away has no row to put a bracket on: said plainly, with no bracket.
    const vicar = cardOf(said(await page()), v.id)
    expect(vicar).toContain('<p class="news">Changed since you said yes · check the call</p>')
    expect(vicar).not.toContain('class="was"')
    // One read of the log for both bookings on each drawing, and nothing written by opening the page.
    expect(read.filter((sql) => /\bchanges\b/.test(sql))).toHaveLength(2)
    expect((await db.query<{ n: string }>('SELECT count(*) AS n FROM changes')).rows[0]!.n).toBe(logged)

    // News until the call after the change, Saturday's at 07:30 in Ireland, then the page says it plainly.
    vi.setSystemTime(new Date('2026-10-03T06:29:00Z'))
    expect(cardOf(await page(), o.id)).toContain('(was 09:00)')
    vi.setSystemTime(new Date('2026-10-03T06:30:00Z'))
    card = cardOf(await page(), o.id)
    expect(card).toContain('<dt>Call time</dt><dd>07:30</dd>')
    expect(card).not.toContain('class="was"')
    // Vicar Street's is news for a week, its call being further off: until 10:00 in Ireland a week after the change.
    vi.setSystemTime(new Date('2026-10-05T08:59:00Z'))
    expect(cardOf(await page(), v.id)).toContain('Changed since you said yes')
    vi.setSystemTime(new Date('2026-10-05T09:00:00Z'))
    expect(cardOf(await page(), v.id)).not.toContain('Changed since you said yes')
  })

  it("says a change it can't put in brackets on the day's card too, as on the booking's", async () => {
    // Proves (UX sweep, 6 November 2026, move 6): from 6pm the evening before, the card at the top is the one they look at, so a
    // change that can't be said as now and was, a call time set where there was none, is said there as on the booking's card.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app, { callTime: null })
    const o = await offer(app, c, aoife.id)
    await answer(app, aoife.linkToken, o.id, { answer: 'accept' })
    await send(app, 'call.update', { id: c, callTime: '07:00' })
    // The evening before its first day, Friday 2 October: after 6pm in Ireland on Thursday.
    vi.setSystemTime(new Date('2026-10-01T17:30:00Z'))
    const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    expect(page).toContain('<h2>Tomorrow</h2>')
    const from = page.indexOf(`id="late-${o.id}"`)
    const tomorrow = page.slice(from, page.indexOf('</article>', from))
    expect(tomorrow).toContain('call 07:00')
    expect(tomorrow).toContain('<p class="news">Changed since you said yes · check the call</p>')
    expect(tomorrow).not.toContain('class="was"')
    expect(cardOf(page, o.id)).toContain('<p class="news">Changed since you said yes · check the call</p>')
  })

  it("says how a booking ended as its card's first line, in its place, while that's news, then in Offers that ended", async () => {
    // Proves (UX sweep, 6 November 2026, move 6): the client cancelling, a job not going ahead and the office taking her off
    // are three different news, each its booking card's first line, and its heading's, where the booking was among the rest,
    // in place of "Withdrawn" far down the page; a stopped job is said as it stands now, so one cancelled and then marked
    // lost didn't go ahead, and one started again since is the office's doing; an offer she never answered is news at the top
    // of her offers the same way (ADR 0153); after a week they all join the list, in the same words.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    // On days of their own, as nobody holds two jobs on a day.
    const booked = async (name: string, day: string) => {
      const job = newId()
      await send(app, 'project.create', { id: job, name, clientId: null, venueId: null, status: 'confirmed', notes: '' })
      const c = await call(app, { projectId: job, project: name, start: day, end: day })
      const o = await offer(app, c, aoife.id)
      await answer(app, aoife.linkToken, o.id, { answer: 'accept' })
      return { job, c, o, name }
    }
    const gala = await booked('Autumn Gala', '2026-10-20')
    const olympia = await booked('Olympia', '2026-10-21')
    const fair = await booked('Craft Fair', '2026-10-22')
    const vicar = await booked('Vicar Street', '2026-10-23')
    const harvest = await booked('Harvest Fair', '2026-10-24')
    const stagehand = await offer(app, await call(app, { projectId: gala.job, project: 'Autumn Gala', role: 'Stagehand', start: '2026-10-26', end: '2026-10-26' }), aoife.id)
    await send(app, 'project.update', { id: gala.job, status: 'cancelled' })
    await send(app, 'project.update', { id: fair.job, status: 'cancelled' })
    await send(app, 'project.update', { id: fair.job, status: 'lost' })
    await send(app, 'offer.cancel', { id: vicar.o.id })
    await send(app, 'project.update', { id: harvest.job, status: 'cancelled' })
    await send(app, 'project.update', { id: harvest.job, status: 'confirmed' })

    const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    const bookings = page.slice(page.indexOf('<h2>Your bookings</h2>'), page.indexOf('</section>', page.indexOf('<h2>Your bookings</h2>')))
    // In date order with the booking still on, as her page in the app lists them.
    const order = [gala, olympia, fair, vicar, harvest].map(({ o }) => bookings.indexOf(`id="o-${o.id}"`))
    expect(order[0]).toBeGreaterThan(-1)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    for (const [{ o, name }, first] of [
      [gala, 'The job was cancelled'],
      [fair, "The job didn't go ahead"],
      [vicar, 'Withdrawn by the office'],
      [harvest, 'Withdrawn by the office'],
    ] as const) {
      const card = cardOf(bookings, o.id)
      expect(card, first).toContain(`<h3><span class="news">${first.replaceAll("'", '&#39;')}</span> ${name}</h3>`)
      // Nothing to answer on it, and no call sheet for a job that isn't going ahead.
      expect(card).not.toContain('<form')
      expect(card).not.toContain('Call sheet')
    }
    const offers = page.slice(page.indexOf('<h2>Offers waiting on you</h2>'), page.indexOf('</section>', page.indexOf('<h2>Offers waiting on you</h2>')))
    expect(cardOf(offers, stagehand.id)).toContain('<h3><span class="news">The job was cancelled</span> Autumn Gala</h3>')
    expect(page).not.toContain('<h2>Offers that ended</h2>')

    // A week on, they're over as news: each in the list, in its card's words, with the day it ended.
    vi.setSystemTime(new Date('2026-10-05T09:00:00Z'))
    const after = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    expect(after).not.toContain('class="offer ended"')
    const list = said(after.slice(after.indexOf('<h2>Offers that ended</h2>')))
    expect(list).toContain(`<small>The job was cancelled on ${dayLabel('2026-09-28', '2026-10-05')}</small>`)
    expect(list).toContain(`<small>The job didn&#39;t go ahead, as of ${dayLabel('2026-09-28', '2026-10-05')}</small>`)
    expect(list).toContain(`<small>Withdrawn by the office on ${dayLabel('2026-09-28', '2026-10-05')}</small>`)
    expect(list).toMatch(new RegExp(`<li>Autumn Gala \\(Build\\) · Stagehand · [^<]* <small>The job was cancelled on ${dayLabel('2026-09-28', '2026-10-05')}</small></li>`))
  })

  it('folds what is over after the latest three under Earlier, with its count, never cutting it off', async () => {
    // Proves (UX sweep, 6 November 2026, move 6): Past work and Offers that ended stopped silently at eight; now every
    // one is there, the latest three in full and the rest under "Earlier (n)", shut until opened.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']) {
      const o = await offer(app, await call(app, { project: `Gig ${day}`, phase: '', start: day, end: day }), aoife.id)
      await answer(app, aoife.linkToken, o.id, { answer: 'accept' })
    }
    for (const day of ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']) {
      const o = await offer(app, await call(app, { project: `Show ${day}`, phase: '', start: day, end: day }), aoife.id)
      await answer(app, aoife.linkToken, o.id, { answer: 'decline' })
    }
    const page = said((await app.inject({ url: `/f/${aoife.linkToken}` })).body)
    const past = page.slice(page.indexOf('<h2>Work done</h2>'), page.indexOf('<h2>Offers that ended</h2>'))
    const [shown, folded] = past.split('<details class="later">') as [string, string]
    expect(shown.match(/<li>/g)).toHaveLength(3)
    expect(shown.indexOf('Gig 2026-09-05')).toBeLessThan(shown.indexOf('Gig 2026-09-03'))
    expect(folded).toMatch(/^<summary><b>Earlier \(2\)<\/b><\/summary>/)
    expect(folded).toContain('Gig 2026-09-02')
    expect(folded).toContain('Gig 2026-09-01')
    const turned = page.slice(page.indexOf('<h2>Offers that ended</h2>'))
    expect(turned).toContain('<summary><b>Earlier (1)</b></summary><ul class="closed"><li>Show 2026-10-10')
  })
})

describe('booking rules', () => {
  it('gives a shortlisted role to whoever accepts first and tells the rest', async () => {
    const app = await server()
    const people = await Promise.all(['Aoife Byrne', 'Niall Kerr', 'Siobhán Doyle'].map((n) => person(app, n)))
    const c = await call(app, { needed: 1, start: '2026-10-10', end: '2026-10-10' })
    const offers = []
    for (const p of people) offers.push(await offer(app, c, p.id))

    expect(await answer(app, people[1]!.linkToken, offers[1]!.id, { answer: 'accept' })).toMatchObject({ ok: true })
    expect((await entity<Offer>(app, 'offer', offers[0]!.id)).status).toBe('filled')
    expect((await entity<Offer>(app, 'offer', offers[2]!.id)).status).toBe('filled')

    const late = await answer(app, people[0]!.linkToken, offers[0]!.id, { answer: 'accept' })
    expect(late.ok).toBe(false)
    // The refusal names the job (audit, 20 October 2026, finding 49), in the card that now says it's filled, at the top of her
    // offers while that's news (ADR 0153), where the page lands.
    expect(late.message).toBe('Sorry, Electric Picnic, Audio tech, Sat 10 Oct has just been filled by someone else.')
    const card = cardOf(late.page, offers[0]!.id)
    expect(card).toContain('<h3><span class="news">Filled by someone else</span> Electric Picnic</h3>')
    expect(card).toContain('has just been filled by someone else.</p>')
    expect(card).toContain('id="refused"')
    expect(late.page.indexOf(`id="o-${offers[0]!.id}"`)).toBeGreaterThan(late.page.indexOf('<h2>Offers waiting on you</h2>'))
  })

  it('never double books a person, however the two acceptances arrive', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const picnic = await call(app, { start: '2026-10-02', end: '2026-10-04' })
    const gig = await call(app, { project: 'Vicar Street', phase: 'Show', start: '2026-10-04', end: '2026-10-04' })
    const a = await offer(app, picnic, aoife.id)
    const b = await offer(app, gig, aoife.id)
    // Both offers were fine to send; she was free when they went out.
    expect(a.result.status).toBe('applied')
    expect(b.result.status).toBe('applied')

    expect(await answer(app, aoife.linkToken, a.id, { answer: 'accept', picker: '1', days: ['2026-10-02', '2026-10-03', '2026-10-04'] })).toMatchObject({ ok: true })
    const second = await answer(app, aoife.linkToken, b.id, { answer: 'accept' })
    expect(second.ok).toBe(false)
    expect(second.message).toContain('Already booked on Electric Picnic (Build)')

    // Dropping the clashing day from the first job frees her for the second.
    await answer(app, aoife.linkToken, a.id, { answer: 'accept', picker: '1', days: ['2026-10-02', '2026-10-03'] })
    expect(await answer(app, aoife.linkToken, b.id, { answer: 'accept' })).toMatchObject({ ok: true })
  })

  it('warns ops before offering someone already booked', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const picnic = await call(app)
    const a = await offer(app, picnic, aoife.id)
    await answer(app, aoife.linkToken, a.id, { answer: 'accept', picker: '1', days: ['2026-10-02', '2026-10-03', '2026-10-04'] })
    const gig = await call(app, { project: 'Vicar Street', start: '2026-10-03', end: '2026-10-03' })
    const b = await offer(app, gig, aoife.id)
    expect(b.result).toMatchObject({ status: 'rejected', reason: { code: 'clash' } })
  })

  it('keeps a declined offer declined, and one person to one place', async () => {
    // Proves: an Accept or a counter from an old tab on a declined offer is refused in the page's own words, so a re-offer can't book the same person twice (audit, 20 October 2026, finding 25).
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const c = await call(app, { needed: 2, start: '2026-10-10', end: '2026-10-10' })
    const old = await offer(app, c, aoife.id)
    expect(await answer(app, aoife.linkToken, old.id, { answer: 'decline' })).toMatchObject({ ok: true })
    const again = await offer(app, c, aoife.id)
    expect(again.result.status).toBe('applied')
    const stale = await send(app, 'offer.respond', { id: old.id, answer: 'accept', days: null, note: '' })
    expect(stale).toMatchObject({ status: 'rejected', reason: { message: expect.stringContaining('only the office can offer it to you again') } })
    const counter = await send(app, 'offer.respond', { id: old.id, answer: 'counter', counterRateCents: 30000, days: null, note: '' })
    expect(counter.status).toBe('rejected')
    expect((await entity<Offer>(app, 'offer', old.id)).status).toBe('declined')
    expect(await answer(app, aoife.linkToken, again.id, { answer: 'accept' })).toMatchObject({ ok: true })
    // The second place is still Niall's to take.
    const n = await offer(app, c, niall.id)
    expect(await answer(app, niall.linkToken, n.id, { answer: 'accept' })).toMatchObject({ ok: true })
  })

  it('counts people, not offers, on a day', async () => {
    // Proves: two offers held by one person, however they came about, take one place, and a second accept by the same person is refused (audit, 20 October 2026, finding 25).
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app, { needed: 2, start: '2026-10-10', end: '2026-10-10' })
    const a = await offer(app, c, aoife.id)
    expect(await answer(app, aoife.linkToken, a.id, { answer: 'accept' })).toMatchObject({ ok: true })
    // An offer row made by hand, as an old bug might have left: the same person offered twice.
    const b = newId()
    await lastDb.query(`INSERT INTO offers (id, call_id, person_id, status, days, day_rate_cents, override) VALUES ($1, $2, $3, 'offered', $4, 25000, false)`, [b, c, aoife.id, JSON.stringify(['2026-10-10'])])
    const twice = await send(app, 'offer.respond', { id: b, answer: 'accept', days: null, note: '' })
    expect(twice).toMatchObject({ status: 'rejected', reason: { message: expect.stringContaining('already booked on this job') } })
  })

  it('withdraws every open offer when a job is cancelled', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app)
    const o = await offer(app, c, aoife.id)
    await send(app, 'call.cancel', { id: c })
    expect((await entity<Offer>(app, 'offer', o.id)).status).toBe('cancelled')
    const page = await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}` })
    // Said where it was, while that's news (ADR 0153), with nothing to answer.
    expect(cardOf(page.body, o.id)).toContain('<h3><span class="news">Withdrawn by the office</span> Electric Picnic</h3>')
    expect(cardOf(page.body, o.id)).not.toContain('<form')
    expect(page.body).toContain('Nothing else waiting right now')
  })
})

/**
 * The answers the office settles (ADR 0152): a Yes in Google Calendar counts for the day it was pressed on, with the days
 * it didn't answer still asked; a rate asked for waits for the office, whose Confirm or Agree closes it once the call is
 * full; and saying no to a rate keeps the offer open at the rate offered.
 */
describe('answers the office settles (ADR 0152)', () => {
  const history = async (app: FastifyInstance) => ((await app.inject({ url: '/api/history' })).json() as HistoryPage).entries.map((e) => e.what)

  it("leaves a rate asked for with the office when someone's yes fills the call, and the office's Confirm closes it", async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const siobhan = await person(app, 'Siobhán Doyle')
    const c = await call(app, { start: '2026-10-10', end: '2026-10-10' })
    const a = await offer(app, c, aoife.id)
    const n = await offer(app, c, niall.id)
    const s = await offer(app, c, siobhan.id)
    expect(await answer(app, niall.linkToken, n.id, { answer: 'counter', rate: '300' })).toMatchObject({ ok: true })
    expect(await answer(app, aoife.linkToken, a.id, { answer: 'accept' })).toMatchObject({ ok: true })
    // Siobhán, only asked, is told it's filled; Niall's rate is still the office's to answer, which Aoife's yes doesn't do for it.
    expect((await entity<Offer>(app, 'offer', s.id)).status).toBe('filled')
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'countered', counterRateCents: 30000 })
    expect(cardOf((await app.inject({ url: `/f/${niall.linkToken}` })).body, n.id)).toContain('€300 a day asked')

    expect(await send(app, 'offer.confirm', { id: a.id })).toMatchObject({ status: 'applied' })
    expect((await entity<Offer>(app, 'offer', a.id)).status).toBe('confirmed')
    expect((await entity<Offer>(app, 'offer', n.id)).status).toBe('filled')
  })

  it('closes the other rates asked for when agreeing one fills the call', async () => {
    const app = await server()
    const niall = await person(app, 'Niall Kerr')
    const siobhan = await person(app, 'Siobhán Doyle')
    const c = await call(app, { start: '2026-10-10', end: '2026-10-10' })
    const n = await offer(app, c, niall.id)
    const s = await offer(app, c, siobhan.id)
    await answer(app, niall.linkToken, n.id, { answer: 'counter', rate: '300' })
    await answer(app, siobhan.linkToken, s.id, { answer: 'counter', rate: '320' })
    expect(await send(app, 'offer.confirm', { id: n.id })).toMatchObject({ status: 'applied' })
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'confirmed', dayRateCents: 30000 })
    expect(await entity<Offer>(app, 'offer', s.id)).toMatchObject({ status: 'filled', counterRateCents: 32000 })
  })

  it('says no to a rate, keeping the offer open at the rate offered for the days it was asked for', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app)
    const a = await offer(app, c, aoife.id)
    await answer(app, aoife.linkToken, a.id, { answer: 'counter', picker: '1', days: ['2026-10-03', '2026-10-04'], rate: '300' })

    expect(await send(app, 'offer.refuse', { id: a.id })).toMatchObject({ status: 'applied' })
    // The rate asked for is kept, so the page can say it wasn't agreed; no day comes back that she left out.
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'offered', days: ['2026-10-03', '2026-10-04'], dayRateCents: 25000, counterRateCents: 30000 })
    expect((await history(app))[0]).toBe('Said no to the rate Aoife Byrne asked for Audio tech on Electric Picnic: the offer stands at the rate offered')
    const card = said(cardOf((await app.inject({ url: `/f/${aoife.linkToken}` })).body, a.id))
    expect(card).toContain("<p class=\"news\">The office can't do €300 a day, so the offer stands at €250 a day.</p>")
    // Accept is the answer again, and the rate box is empty for a new ask, not filled with the one turned down.
    expect(card).toContain('<button class="yes" name="answer" value="accept">Accept these days</button>')
    expect(card).toContain('<input name="rate" inputmode="decimal" value="">')

    // Her yes is at the rate offered, which clears the rate asked for.
    expect(await answer(app, aoife.linkToken, a.id, { answer: 'accept', picker: '1', days: ['2026-10-03', '2026-10-04'] })).toMatchObject({
      ok: true,
      message: "Thanks, you're down for it. The office will confirm.",
    })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'accepted', days: ['2026-10-03', '2026-10-04'], counterRateCents: null })
    expect(cardOf((await app.inject({ url: `/f/${aoife.linkToken}` })).body, a.id)).not.toContain("can't do")
  })

  it('closes an offer whose rate is said no to when the call filled while it waited', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const c = await call(app, { start: '2026-10-10', end: '2026-10-10' })
    const a = await offer(app, c, aoife.id)
    const n = await offer(app, c, niall.id)
    await answer(app, aoife.linkToken, a.id, { answer: 'counter', rate: '300' })
    await answer(app, niall.linkToken, n.id, { answer: 'accept' })
    expect((await entity<Offer>(app, 'offer', a.id)).status).toBe('countered')
    expect(await send(app, 'offer.refuse', { id: a.id })).toMatchObject({ status: 'applied' })
    expect((await entity<Offer>(app, 'offer', a.id)).status).toBe('filled')
  })

  it('says no to a rate once, and only to a rate', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app)
    const a = await offer(app, c, aoife.id)
    // Already only asked, as after a Say no from another device: nothing more to do.
    expect(await send(app, 'offer.refuse', { id: a.id })).toMatchObject({ status: 'applied' })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'offered', counterRateCents: null })
    await answer(app, aoife.linkToken, a.id, { answer: 'accept' })
    expect(await send(app, 'offer.refuse', { id: a.id })).toMatchObject({
      status: 'rejected',
      reason: { code: 'conflict', message: "There's no rate to say no to: this offer is accepted." },
    })
    expect(await send(app, 'offer.refuse', { id: newId() })).toMatchObject({ status: 'rejected', reason: { code: 'not-found' } })
    expect((await entity<Offer>(app, 'offer', a.id)).status).toBe('accepted')
  })

  it("counts a Yes in Google for its own day, keeps the days it didn't answer asked, and Confirm ends the ask", async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const c = await call(app)
    const a = await offer(app, c, aoife.id)
    const n = await offer(app, c, niall.id)
    // As the calendar sends it, for a Yes on the Friday's invite alone.
    expect(await send(app, 'offer.respond', { id: a.id, answer: 'accept', days: ['2026-10-02'], asked: ['2026-10-03', '2026-10-04'], note: '' })).toMatchObject({ status: 'applied' })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'accepted', days: ['2026-10-02'], asked: ['2026-10-03', '2026-10-04'] })
    expect((await history(app))[0]).toBe('Aoife Byrne accepted Audio tech on Electric Picnic, Fri 2 Oct; no answer yet for Sat 3 Oct to Sun 4 Oct')
    expect(said(cardOf((await app.inject({ url: `/f/${aoife.linkToken}` })).body, a.id))).toContain(
      "<p class=\"small\">You haven't answered for Sat 3 Oct to Sun 4 Oct yet. Tick them if you can do them, or leave them unticked, and press Update my days.</p>"
    )
    // The days she hasn't answered hold nothing, so the call is still open for them.
    expect((await entity<Offer>(app, 'offer', n.id)).status).toBe('offered')

    expect(await send(app, 'offer.confirm', { id: a.id })).toMatchObject({ status: 'applied' })
    const booked = await entity<Offer>(app, 'offer', a.id)
    expect(booked).toMatchObject({ status: 'confirmed', days: ['2026-10-02'] })
    expect(booked.asked).toBeUndefined()
    expect(cardOf((await app.inject({ url: `/f/${aoife.linkToken}` })).body, a.id)).not.toContain("You haven't answered")
    expect((await entity<Offer>(app, 'offer', n.id)).status).toBe('offered')
  })

  it('ends the ask for the days someone else takes, once every day has its people', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const c = await call(app)
    const a = await offer(app, c, aoife.id)
    const n = await offer(app, c, niall.id)
    await send(app, 'offer.respond', { id: a.id, answer: 'accept', days: ['2026-10-02'], asked: ['2026-10-03', '2026-10-04'], note: '' })
    expect(await answer(app, niall.linkToken, n.id, { answer: 'accept', picker: '1', days: ['2026-10-03', '2026-10-04'] })).toMatchObject({ ok: true })
    const aoifes = await entity<Offer>(app, 'offer', a.id)
    expect(aoifes).toMatchObject({ status: 'accepted', days: ['2026-10-02'] })
    expect(aoifes.asked).toBeUndefined()
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'accepted', days: ['2026-10-03', '2026-10-04'] })
  })

  it('asks only about days of the call, and never about a day already said yes to', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app)
    const a = await offer(app, c, aoife.id)
    expect(await send(app, 'offer.respond', { id: a.id, answer: 'accept', days: ['2026-10-02'], asked: ['2026-10-09'], note: '' })).toMatchObject({
      status: 'rejected',
      reason: { code: 'invalid', message: 'Fri 9 Oct is not part of this job.' },
    })
    expect(await send(app, 'offer.respond', { id: a.id, answer: 'accept', days: ['2026-10-02'], asked: ['2026-10-02', '2026-10-03'], note: '' })).toMatchObject({ status: 'applied' })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ days: ['2026-10-02'], asked: ['2026-10-03'] })
    // A day that goes from the call goes from what is asked.
    expect(await send(app, 'call.update', { id: c, end: '2026-10-02' })).toMatchObject({ status: 'applied' })
    const after = await entity<Offer>(app, 'offer', a.id)
    expect(after).toMatchObject({ status: 'accepted', days: ['2026-10-02'] })
    expect(after.asked).toBeUndefined()
  })

  it("takes a No in Google to every day they'd said yes to as asked again for the rest, only before Confirm", async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app)
    const a = await offer(app, c, aoife.id)
    // Only a yes not yet confirmed goes back: on an offer only asked, nothing changes.
    expect(await send(app, 'offer.respond', { id: a.id, answer: 'undecided', days: ['2026-10-03'], note: '' })).toMatchObject({ status: 'applied' })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'offered', days: ['2026-10-02', '2026-10-03', '2026-10-04'] })

    await send(app, 'offer.respond', { id: a.id, answer: 'accept', days: ['2026-10-02'], asked: ['2026-10-03', '2026-10-04'], note: '' })
    expect(await send(app, 'offer.respond', { id: a.id, answer: 'undecided', days: ['2026-10-09'], note: '' })).toMatchObject({ status: 'rejected', reason: { code: 'invalid' } })
    expect(await send(app, 'offer.respond', { id: a.id, answer: 'undecided', days: ['2026-10-03', '2026-10-04'], note: '' })).toMatchObject({ status: 'applied' })
    const asked = await entity<Offer>(app, 'offer', a.id)
    expect(asked).toMatchObject({ status: 'offered', days: ['2026-10-03', '2026-10-04'] })
    expect(asked.asked).toBeUndefined()
    expect((await history(app))[0]).toBe("Aoife Byrne said no to the days they'd said yes to for Audio tech on Electric Picnic; still asked for Sat 3 Oct to Sun 4 Oct")

    await send(app, 'offer.respond', { id: a.id, answer: 'accept', days: ['2026-10-03'], asked: ['2026-10-04'], note: '' })
    await send(app, 'offer.confirm', { id: a.id })
    // Once confirmed, it's the office's to change, as with any answer to a booking.
    expect(await send(app, 'offer.respond', { id: a.id, answer: 'undecided', days: ['2026-10-04'], note: '' })).toMatchObject({ status: 'rejected', reason: { code: 'conflict' } })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'confirmed', days: ['2026-10-03'] })
  })
})

describe('changing a call', () => {
  it("changes a call's time, rate and details, and the freelancer's page, feed and call sheet read the new values", async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const c = await call(app, { needed: 2 })
    const a = await offer(app, c, aoife.id)
    const n = await offer(app, c, niall.id)
    await answer(app, aoife.linkToken, a.id, { answer: 'accept' })
    await send(app, 'offer.confirm', { id: a.id })

    const r = await send(app, 'call.update', { id: c, callTime: '09:00', dayRateCents: 28000, details: 'Food on site. Parking at gate B.', replyBy: '2026-09-30' })
    expect(r.status).toBe('applied')
    expect(await entity<CrewCall>(app, 'crewCall', c)).toMatchObject({ callTime: '09:00', dayRateCents: 28000, details: 'Food on site. Parking at gate B.', replyBy: '2026-09-30' })
    // The new rate reaches Niall, still deciding; Aoife keeps the rate she was confirmed at.
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'offered', dayRateCents: 28000 })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'confirmed', dayRateCents: 25000 })

    const nialls = (await app.inject({ url: `/f/${niall.linkToken}` })).body
    expect(nialls).toContain('<dt>Call time</dt><dd>09:00</dd>')
    expect(nialls).toContain('€280 a day')
    expect(nialls).toContain('<dt>Reply by</dt><dd>Wed 30 Sep</dd>')
    const aoifes = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    // Aoife said yes at 08:00, so her card says what moved since (UX sweep, 6 November 2026, move 6); Niall's offer just reads as it is.
    expect(aoifes).toContain('<dt>Call time</dt><dd>09:00 <span class="was">(was 08:00)</span></dd>')
    expect(aoifes).toContain('€250 a day')
    expect(aoifes).toContain('Parking at gate B.')
    const sheet = (await app.inject({ url: `/f/${aoife.linkToken}/sheet/${c}` })).body
    expect(sheet).toContain('call <b>09:00</b>')
    expect(sheet).toContain('Parking at gate B.')
    const feed = (await app.inject({ url: `/f/${aoife.linkToken}/calendar.ics` })).body
    expect(feed).toContain('09:00')

    const history: HistoryPage = (await app.inject({ url: '/api/history' })).json()
    expect(history.entries[0]!.what).toBe('Changed the call for Audio tech on Electric Picnic: call time to 09:00, day rate to €280, the details and reply by Wed 30 Sep')
  })

  it("moves a call's days with the days its offers hold, and never strands anyone booked", async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const dara = await person(app, 'Dara Walsh')
    const c = await call(app, { needed: 2 })
    const a = await offer(app, c, aoife.id)
    const n = await offer(app, c, niall.id)
    const d = await offer(app, c, dara.id)
    await answer(app, aoife.linkToken, a.id, { answer: 'accept' })
    await send(app, 'offer.confirm', { id: a.id })
    await answer(app, niall.linkToken, n.id, { answer: 'accept', picker: '1', days: ['2026-10-04'] })

    // A day later: Aoife, who held every day, holds every new day; Niall keeps the 4th; Dara is offered the new days.
    expect(await send(app, 'call.update', { id: c, start: '2026-10-03', end: '2026-10-05' })).toMatchObject({ status: 'applied' })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'confirmed', days: ['2026-10-03', '2026-10-04', '2026-10-05'] })
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'accepted', days: ['2026-10-04'] })
    expect(await entity<Offer>(app, 'offer', d.id)).toMatchObject({ status: 'offered', days: ['2026-10-03', '2026-10-04', '2026-10-05'] })
    expect((await app.inject({ url: `/f/${aoife.linkToken}` })).body).toContain('Sat 3 Oct to Mon 5 Oct')
    const ics = (await app.inject({ url: `/f/${aoife.linkToken}/calendar.ics` })).body
    expect(ics).toContain('DTSTART;VALUE=DATE:20261003')
    expect(ics).not.toContain('DTSTART;VALUE=DATE:20261002')

    // Past the one day Niall holds: refused by name, and nothing changes.
    const refused = await send(app, 'call.update', { id: c, start: '2026-10-05', end: '2026-10-06' })
    expect(refused).toMatchObject({ status: 'rejected', reason: { code: 'conflict', message: 'Niall Kerr is booked for days that would go. Release them or keep those days.' } })
    expect(await entity<CrewCall>(app, 'crewCall', c)).toMatchObject({ start: '2026-10-03', end: '2026-10-05' })
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'accepted', days: ['2026-10-04'] })
  })

  it("won't move someone booked onto a day they hold on another job", async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const picnic = await call(app)
    const gig = await call(app, { project: 'Vicar Street', phase: 'Show', start: '2026-10-05', end: '2026-10-05' })
    const a = await offer(app, picnic, aoife.id)
    const g = await offer(app, gig, aoife.id)
    await answer(app, aoife.linkToken, a.id, { answer: 'accept' })
    await answer(app, aoife.linkToken, g.id, { answer: 'accept' })
    const refused = await send(app, 'call.update', { id: picnic, start: '2026-10-03', end: '2026-10-05' })
    expect(refused).toMatchObject({
      status: 'rejected',
      reason: { code: 'clash', message: 'Aoife Byrne is already booked on Vicar Street (Show) Mon 5 Oct. Release them or keep those days.' },
    })
  })

  it("won't move someone booked onto a day they marked off, which an offer would need an override for", async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app)
    const a = await offer(app, c, aoife.id)
    await answer(app, aoife.linkToken, a.id, { answer: 'accept' })
    await send(app, 'unavailability.add', { id: newId(), personId: aoife.id, start: '2026-10-05', end: '2026-10-05', note: 'Dentist' })
    const refused = await send(app, 'call.update', { id: c, end: '2026-10-05' })
    expect(refused).toMatchObject({
      status: 'rejected',
      reason: { code: 'clash', message: 'Aoife Byrne is marked unavailable Mon 5 Oct (Dentist). Release them or keep those days.' },
    })
    expect(await entity<CrewCall>(app, 'crewCall', c)).toMatchObject({ end: '2026-10-04' })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ days: ['2026-10-02', '2026-10-03', '2026-10-04'] })
  })

  it("won't need fewer people than are booked, and opens the call again when it needs more", async () => {
    const app = await server()
    const [aoife, niall, dara, eimear] = await Promise.all(['Aoife Byrne', 'Niall Kerr', 'Dara Walsh', 'Eimear Nolan'].map((n) => person(app, n)))
    const c = await call(app, { needed: 2, start: '2026-10-10', end: '2026-10-10' })
    const a = await offer(app, c, aoife!.id)
    const n = await offer(app, c, niall!.id)
    const d = await offer(app, c, dara!.id)
    await answer(app, aoife!.linkToken, a.id, { answer: 'accept' })
    await answer(app, niall!.linkToken, n.id, { answer: 'accept' })
    expect((await entity<Offer>(app, 'offer', d.id)).status).toBe('filled')

    const refused = await send(app, 'call.update', { id: c, needed: 1 })
    expect(refused).toMatchObject({ status: 'rejected', reason: { code: 'conflict', message: '2 people are booked; release one first.' } })
    expect((await offer(app, c, eimear!.id)).result).toMatchObject({ status: 'rejected', reason: { code: 'filled' } })

    // Needing one more opens it again. Dara was told it had filled, so a new offer goes out.
    expect(await send(app, 'call.update', { id: c, needed: 3 })).toMatchObject({ status: 'applied' })
    expect((await entity<Offer>(app, 'offer', d.id)).status).toBe('filled')
    const again = await offer(app, c, dara!.id)
    expect(again.result.status).toBe('applied')
    expect(await answer(app, dara!.linkToken, again.id, { answer: 'accept' })).toMatchObject({ ok: true })
  })

  it('shows a change made with no signal at once, with the offers it reaches', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const c = await call(app, { needed: 2 })
    const a = await offer(app, c, aoife.id)
    const n = await offer(app, c, niall.id)
    await answer(app, aoife.linkToken, a.id, { answer: 'accept', picker: '1', days: ['2026-10-02', '2026-10-03', '2026-10-04'] })
    let online = true
    const client = await new SyncClient({
      storage: new MemoryStorage(),
      transport: {
        push: async (req) => {
          if (!online) throw new Error('offline')
          return (await app.inject({ method: 'POST', url: '/api/sync/push', payload: req })).json()
        },
        pull: async (after) => {
          if (!online) throw new Error('offline')
          return (await app.inject({ method: 'GET', url: `/api/sync/pull?after=${after}` })).json()
        },
      },
    }).open()
    await client.sync()
    online = false
    await client.mutate('call.update', { id: c, start: '2026-10-03', end: '2026-10-05', dayRateCents: 30000 })
    await expect(client.sync()).rejects.toThrow('offline')
    const view = client.view().crew.calls[0]!
    expect(view).toMatchObject({ pending: true, start: '2026-10-03', end: '2026-10-05', dayRateCents: 30000 })
    expect(view.offers.find((o) => o.id === a.id)).toMatchObject({ days: ['2026-10-03', '2026-10-04', '2026-10-05'], dayRateCents: 25000, pending: true })
    expect(view.offers.find((o) => o.id === n.id)).toMatchObject({ days: ['2026-10-03', '2026-10-04', '2026-10-05'], dayRateCents: 30000, pending: true })

    online = true
    await client.sync()
    expect(client.view().crew.calls[0]).toMatchObject({ pending: false, start: '2026-10-03', end: '2026-10-05' })
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ days: ['2026-10-03', '2026-10-04', '2026-10-05'], dayRateCents: 30000 })
  })
})

describe('telling the office', () => {
  it('keeps a decline for the office to note, and says so in the history', async () => {
    // A decline leaves a call short; it waits in "Answers to check" (seenAt null) until the office taps Noted.
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app, { needed: 2 })
    const o = await offer(app, c, aoife.id)
    expect(await answer(app, aoife.linkToken, o.id, { answer: 'decline', note: 'At a wedding that weekend.' })).toMatchObject({ ok: true })
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'declined', note: 'At a wedding that weekend.', seenAt: null })

    expect((await send(app, 'offer.seen', { id: o.id })).status).toBe('applied')
    const noted = await entity<Offer>(app, 'offer', o.id)
    expect(noted.seenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    // Noted again, from another device: nothing changes.
    expect((await send(app, 'offer.seen', { id: o.id })).status).toBe('applied')
    expect((await entity<Offer>(app, 'offer', o.id)).seenAt).toBe(noted.seenAt)
    expect((await send(app, 'offer.seen', { id: 'nope' })).status).toBe('rejected')

    const history = (await app.inject({ url: '/api/history' })).json() as { entries: { what: string; outcome: string }[] }
    expect(history.entries.map((e) => [e.what, e.outcome]).slice(0, 4)).toEqual([
      ["Noted someone's answer on a role on a job", 'turned-down'],
      ['Noted that Aoife Byrne declined Audio tech on Electric Picnic', 'done'],
      ['Noted that Aoife Byrne declined Audio tech on Electric Picnic', 'done'],
      ['Aoife Byrne declined Audio tech on Electric Picnic', 'done'],
    ])
  })

  it('lets someone booked say they can’t make it: the place is free again, and the office hears of it', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const c = await call(app, { needed: 1 })
    const o = await offer(app, c, aoife.id)
    await answer(app, aoife.linkToken, o.id, { answer: 'accept' })
    await send(app, 'offer.confirm', { id: o.id })
    await send(app, 'offer.seen', { id: o.id })
    // Full, so Niall's offer is turned down.
    expect((await offer(app, c, niall.id)).result).toMatchObject({ status: 'rejected', reason: { code: 'filled' } })

    // Her page offers the way out on a booking, folded away, and takes the pull-out from its own form.
    let page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    // One name for it on both sides (UX sweep, 6 November 2026, move 6): the fold, the button, the pill after and the office's pill.
    expect(cardOf(page, o.id)).toContain("<summary>Can't make it?</summary>")
    expect(cardOf(page, o.id)).toContain(`<button class="no" name="answer" value="pullOut">Can't make it</button>`)
    expect(cardOf(page, o.id)).toContain('name="answer" value="pullOut"')
    expect(cardOf(page, o.id)).not.toContain('value="decline"')
    const out = await answer(app, aoife.linkToken, o.id, { answer: 'pullOut', note: 'Double booked, sorry.' })
    expect(out).toMatchObject({ ok: true, message: "Thanks for telling us you can't make it. You're off this one, and the office will find cover." })
    // A pull-out is new to the office, so it waits to be noted even though the booking had been.
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'pulled-out', note: 'Double booked, sorry.', respondedVia: 'link', seenAt: null })

    // The card has gone to "Offers that ended", with the message at the top; the place is free, so Niall can be offered it and the sheet leaves her out.
    page = (await app.inject({ url: out.to.pathname + out.to.search })).body
    expect(page).toContain(`<small>Can&#39;t make it: you told us on ${dayLabel(irishToday())}</small>`)
    expect(page).not.toContain(`id="o-${o.id}"`)
    expect(page.indexOf('class="flash ok"')).toBeLessThan(page.indexOf('<section>'))
    const n = await offer(app, c, niall.id)
    expect(n.result.status).toBe('applied')
    // And she can be offered the same call again, afresh, while it's still open.
    const again = await offer(app, c, aoife.id)
    expect(again.result.status).toBe('applied')
    expect(await answer(app, niall.linkToken, n.id, { answer: 'accept' })).toMatchObject({ ok: true })
    expect((await entity<Offer>(app, 'offer', again.id)).status).toBe('filled')
    expect((await app.inject({ url: `/f/${aoife.linkToken}/sheet/${c}` })).statusCode).toBe(404)
    expect((await app.inject({ url: `/f/${niall.linkToken}/sheet/${c}` })).body).not.toContain('Aoife Byrne')

    const history = (await app.inject({ url: '/api/history' })).json() as { entries: { what: string; who: { kind: string; name: string } }[] }
    expect(history.entries.find((e) => e.what.startsWith('Aoife Byrne can'))).toMatchObject({
      what: "Aoife Byrne can't make it: Audio tech on Electric Picnic (Double booked, sorry.)",
      who: { kind: 'link', name: 'Aoife Byrne' },
    })
  })

  it('takes a pull-out only from someone who said yes, from the link or the app', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app)
    const o = await offer(app, c, aoife.id)
    const early = await answer(app, aoife.linkToken, o.id, { answer: 'pullOut' })
    expect(early).toMatchObject({ ok: false, message: "You can only say you can't make it to a job you've said yes to." })
    expect((await entity<Offer>(app, 'offer', o.id)).status).toBe('offered')

    // Accepted, not yet confirmed: the office records a pull-out that came by phone.
    await answer(app, aoife.linkToken, o.id, { answer: 'accept' })
    expect((await send(app, 'offer.respond', { id: o.id, answer: 'pullOut', note: 'Rang to say so.' })).status).toBe('applied')
    expect(await entity<Offer>(app, 'offer', o.id)).toMatchObject({ status: 'pulled-out', respondedVia: 'app' })
    // Can't make it is over: no answering it again.
    expect(await answer(app, aoife.linkToken, o.id, { answer: 'accept' })).toMatchObject({ ok: false, message: "You've told us you can't make this one. Ask the office if you can do it after all." })
    const history = (await app.inject({ url: '/api/history' })).json() as { entries: { what: string }[] }
    expect(history.entries[1]!.what).toBe("Aoife Byrne can't make it: Audio tech on Electric Picnic (Rang to say so.)")
    await send(app, 'offer.seen', { id: o.id })
    expect((await app.inject({ url: '/api/history' })).json().entries[0].what).toBe("Noted that Aoife Byrne can't make Audio tech on Electric Picnic")
    // A Withdraw queued on another device changes nothing: the pull-out stays for the office to see.
    expect((await send(app, 'offer.cancel', { id: o.id })).status).toBe('applied')
    expect((await entity<Offer>(app, 'offer', o.id)).status).toBe('pulled-out')

    // A page left open from before still has the button on a booking the office has since taken her off: said so, not that
    // she never said yes; and on a job that isn't going ahead, that its call is off, whichever way it stopped.
    const gone = await offer(app, await call(app, { project: 'Vicar Street', start: '2026-10-20', end: '2026-10-20' }), aoife.id)
    await answer(app, aoife.linkToken, gone.id, { answer: 'accept' })
    await send(app, 'offer.cancel', { id: gone.id })
    expect(await answer(app, aoife.linkToken, gone.id, { answer: 'pullOut' })).toMatchObject({ ok: false, message: "The office has already taken you off this one, so there's nothing to do." })
    const fair = newId()
    await send(app, 'project.create', { id: fair, name: 'Craft Fair', clientId: null, venueId: null, status: 'confirmed', notes: '' })
    const lost = await offer(app, await call(app, { projectId: fair, project: 'Craft Fair', start: '2026-10-21', end: '2026-10-21' }), aoife.id)
    await answer(app, aoife.linkToken, lost.id, { answer: 'accept' })
    await send(app, 'project.update', { id: fair, status: 'lost' })
    expect(await answer(app, aoife.linkToken, lost.id, { answer: 'pullOut' })).toMatchObject({ ok: false, message: 'Audio tech on Craft Fair is off.' })

    // Once the job has happened the page shows no way out, and a crafted post is refused, so the timesheet stays.
    const past = await call(app, { start: '2026-09-01', end: '2026-09-02' })
    const done = await offer(app, past, aoife.id)
    await answer(app, aoife.linkToken, done.id, { answer: 'accept' })
    await send(app, 'offer.confirm', { id: done.id })
    expect(await answer(app, aoife.linkToken, done.id, { answer: 'pullOut' })).toMatchObject({ ok: false, message: 'That job has already happened; talk to the office.' })
    expect((await entity<Offer>(app, 'offer', done.id)).status).toBe('confirmed')
  })
})

describe('offline ops device', () => {
  it('queues people, calls and offers with no signal and shows them as pending', async () => {
    const app = await server()
    let online = false
    const client = await new SyncClient({
      storage: new MemoryStorage(),
      transport: {
        push: async (req) => {
          if (!online) throw new Error('offline')
          return (await app.inject({ method: 'POST', url: '/api/sync/push', payload: req })).json()
        },
        pull: async (after) => {
          if (!online) throw new Error('offline')
          return (await app.inject({ method: 'GET', url: `/api/sync/pull?after=${after}` })).json()
        },
      },
    }).open()

    const pid = newId()
    const cid = newId()
    await client.mutate('person.upsert', { id: pid, name: 'Aoife Byrne', kind: 'freelancer', email: null, phone: null, skills: [], dayRateCents: null, notes: '' })
    await client.mutate('call.create', {
      id: cid, project: 'Electric Picnic', phase: 'Build', venue: '', role: 'Audio tech',
      start: '2026-10-02', end: '2026-10-03', callTime: null, needed: 2, dayRateCents: 25000, details: '', replyBy: null,
    })
    await client.mutate('offer.send', { id: newId(), callId: cid, personId: pid, override: false })
    await expect(client.sync()).rejects.toThrow('offline')

    let view = client.view().crew
    expect(view.people[0]).toMatchObject({ name: 'Aoife Byrne', pending: true })
    expect(view.calls[0]!.offers[0]).toMatchObject({ status: 'offered', pending: true })
    expect(view.calls[0]!.openDays).toEqual(['2026-10-02', '2026-10-03'])

    online = true
    await client.sync()
    view = client.view().crew
    expect(view.people[0]!.pending).toBe(false)
    expect(view.people[0]!.linkToken.length).toBeGreaterThanOrEqual(24)
    expect(view.calls[0]!.offers[0]).toMatchObject({ status: 'offered', pending: false })
  })
})

/** A form posted from a freelancer's page, as their phone would, and where it lands. */
async function post(app: FastifyInstance, path: string, fields: Record<string, string>) {
  const res = await app.inject({
    method: 'POST',
    url: path,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams(fields).toString(),
  })
  // A refusal is drawn at once, with what was typed still in the form (rule 11); it lands at the address posted to.
  if (res.statusCode === 422) return { ...flashOf(res.body), to: new URL(path, 'http://x'), page: res.body }
  expect(res.statusCode).toBe(303)
  const to = new URL(res.headers.location as string, 'http://x')
  const page = await app.inject({ url: to.pathname + to.search })
  return { ...flashOf(page.body), to, page: page.body }
}

describe('correcting people (audit finding 7)', () => {
  it('edits a person with person.upsert, keeping their link and whether they are archived', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const edited = await send(app, 'person.upsert', { ...aoife, name: 'Aoife Byrne-Walsh', phone: '+353871234568', email: 'aoife@example.com', notes: 'Has a van' })
    expect(edited.status).toBe('applied')
    const after = await entity<Person>(app, 'person', aoife.id)
    expect(after).toMatchObject({ name: 'Aoife Byrne-Walsh', phone: '+353871234568', email: 'aoife@example.com', notes: 'Has a van', archived: false })
    // The link is the server's, not the device's: an edit never replaces it.
    expect(after.linkToken).toBe(aoife.linkToken)
    expect((await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}` })).body).toContain('Hi Aoife')

    // Nor does an edit from a device that doesn't know they were archived bring them back.
    expect((await send(app, 'person.archive', { id: aoife.id, archived: true })).status).toBe('applied')
    expect((await send(app, 'person.upsert', { ...aoife, notes: 'Moved to Galway' })).status).toBe('applied')
    expect(await entity<Person>(app, 'person', aoife.id)).toMatchObject({ notes: 'Moved to Galway', archived: true, linkToken: aoife.linkToken })
  })

  it('archives someone who holds nothing, which stops their link and feed and keeps them off offers, and brings them back', async () => {
    const { app, db } = await signedIn()
    const colly = await staff(app, db, 'Colly Hewson', IPHONE, 'phone-c0ffee')
    await colly.send('person.upsert', { id: 'p1', name: 'Aoife Byrne', kind: 'freelancer', email: null, phone: '+353871234567', skills: ['audio'], dayRateCents: null, notes: '' })
    const aoife = await colly.record<Person>('person', 'p1')
    const feed = feedPath(await feedCodeFor(aoife.linkToken))
    expect((await app.inject({ method: 'GET', url: feed })).statusCode).toBe(200)

    expect((await colly.send('person.archive', { id: 'p1', archived: true })).status).toBe('applied')
    expect(await colly.record<Person>('person', 'p1')).toMatchObject({ archived: true, linkToken: aoife.linkToken })
    const gone = await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}` })
    expect(gone.statusCode).toBe(404)
    expect(gone.body).toContain("This link doesn't work any more")
    expect((await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}/data.json` })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: feed })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}/calendar.ics` })).statusCode).toBe(404)
    const c = newId()
    await colly.send('call.create', { id: c, project: 'Electric Picnic', phase: 'Build', venue: '', role: 'Audio tech', start: '2030-10-02', end: '2030-10-04', callTime: null, needed: 1, dayRateCents: 25000, details: '', replyBy: null })
    const refused = await colly.send('offer.send', { id: newId(), callId: c, personId: 'p1', override: false })
    expect(refused).toMatchObject({ status: 'rejected', reason: { code: 'conflict', message: 'Aoife Byrne has been archived. Bring them back on the Crew tab to offer them work.' } })
    // Archiving twice changes nothing.
    expect((await colly.send('person.archive', { id: 'p1', archived: true })).status).toBe('applied')

    expect((await colly.send('person.archive', { id: 'p1', archived: false })).status).toBe('applied')
    expect(await colly.record<Person>('person', 'p1')).toMatchObject({ archived: false })
    expect((await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}` })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: feed })).statusCode).toBe(200)
    expect((await colly.send('offer.send', { id: newId(), callId: c, personId: 'p1', override: false })).status).toBe('applied')

    const page = await colly.history()
    expect(page.entries.filter((e) => e.command === 'person.archive').map((e) => e.what)).toEqual(['Brought Aoife Byrne back', 'Archived Aoife Byrne', 'Archived Aoife Byrne'])
  })

  it("keeps an archived person off the contact-on-the-day list and out of the calendar import's matching", async () => {
    // Being the contact isn't a booking, so archiving goes through; but nobody can name them as a contact afterwards,
    // a phase that already does keeps them until it's changed, and the import stops matching their email.
    const db = await pgliteDb()
    const app = await buildApp({ db })
    cleanup.push(async () => {
      await app.close()
      await db.close()
    })
    const aoife = await person(app, 'Aoife Byrne')
    await send(app, 'project.create', { id: 'j1', name: 'Nissan launch', clientId: null, venueId: null, status: 'confirmed', notes: '' })
    await send(app, 'phase.add', { id: 'ph1', projectId: 'j1', name: 'Show', start: '2030-10-02', end: '2030-10-02', venueId: null, notes: '', contactId: aoife.id })
    await send(app, 'phase.add', { id: 'ph2', projectId: 'j1', name: 'Build', start: '2030-10-01', end: '2030-10-01', venueId: null, notes: '', contactId: null })
    expect((await send(app, 'person.archive', { id: aoife.id, archived: true })).status).toBe('applied')

    const refusal = { status: 'rejected', reason: { code: 'conflict', message: 'Aoife Byrne has been archived; pick someone else as the contact.' } }
    expect(await send(app, 'phase.update', { id: 'ph2', contactId: aoife.id })).toMatchObject(refusal)
    expect(await send(app, 'phase.add', { id: 'ph3', projectId: 'j1', name: 'Out', start: '2030-10-03', end: '2030-10-03', venueId: null, notes: '', contactId: aoife.id })).toMatchObject(refusal)
    expect((await entity<{ contactId: string | null }>(app, 'phase', 'ph1')).contactId).toBe(aoife.id)
    expect((await readApp(db, '2030-10-01', '2030-10-31')).people.map((p) => p.id)).not.toContain(aoife.id)
  })

  it('refuses to archive someone with an open offer or a booking from today on, naming the job', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const c = await call(app, { start: '2030-10-02', end: '2030-10-04' })
    const o = await offer(app, c, aoife.id)
    const archive = () => send(app, 'person.archive', { id: aoife.id, archived: true })

    expect(await archive()).toMatchObject({ status: 'rejected', reason: { code: 'conflict', message: 'Aoife Byrne has an open offer for Electric Picnic (Build); withdraw it first.' } })
    await answer(app, aoife.linkToken, o.id, { answer: 'accept' })
    expect(await archive()).toMatchObject({ status: 'rejected', reason: { message: 'Aoife Byrne has accepted Electric Picnic (Build); release them first.' } })
    await send(app, 'offer.confirm', { id: o.id })
    expect(await archive()).toMatchObject({ status: 'rejected', reason: { message: "Aoife Byrne is booked on Electric Picnic (Build); withdraw their booking on the job's crew first." } })
    expect((await entity<Person>(app, 'person', aoife.id)).archived).toBe(false)

    // Released, nothing holds them. A job long over never did.
    await send(app, 'offer.cancel', { id: o.id })
    const old = await offer(app, await call(app, { project: 'Ploughing 2020', start: '2020-09-15', end: '2020-09-17' }), aoife.id)
    await answer(app, aoife.linkToken, old.id, { answer: 'accept' })
    await send(app, 'offer.confirm', { id: old.id })
    expect((await archive()).status).toBe('applied')
    expect((await entity<Person>(app, 'person', aoife.id)).archived).toBe(true)
  })

  it('lets a freelancer fix their own phone on their link, not their email, and tells the history which changed, never what', async () => {
    const { app, db } = await signedIn()
    const colly = await staff(app, db, 'Colly Hewson', IPHONE, 'phone-c0ffee')
    await colly.send('person.upsert', { id: 'p1', name: 'Aoife Byrne', kind: 'freelancer', email: 'aoife@example.com', phone: '+353871234567', skills: [], dayRateCents: null, notes: '' })
    const aoife = await colly.record<Person>('person', 'p1')
    const details = `/f/${aoife.linkToken}/details`

    // Folded away until wanted, with what we hold filled in.
    let page = (await app.inject({ method: 'GET', url: `/f/${aoife.linkToken}` })).body
    expect(page).toContain('<details id="details">')
    expect(page).toContain('value="+353871234567"')
    // Their email is shown, not offered: it's how an account finds a person, so only the office changes it (audit finding 12).
    expect(page).toContain('with the email <b>aoife@example.com</b>')
    expect(page).not.toContain('name="email"')

    // A new number, the email as it was: only the number is sent, and named.
    const saved = await post(app, details, { phone: '+353 87 999 8888', email: 'aoife@example.com' })
    expect(saved).toMatchObject({ ok: true, message: 'Saved. The office has your new details.' })
    expect(saved.to.searchParams.get('s')).toBe('details')
    expect(saved.to.hash).toBe('#details')
    page = (await app.inject({ method: 'GET', url: saved.to.pathname + saved.to.search })).body
    const open = page.indexOf('<details id="details" open>')
    expect(open).toBeGreaterThan(-1)
    const message = page.indexOf('<p class="flash ok" role="status">Saved. The office has your new details.</p>')
    expect(message).toBeGreaterThan(open)
    expect(message).toBeLessThan(page.indexOf('</details>', open))
    expect(page.match(/class="flash/g)).toHaveLength(1)
    expect(await colly.record<Person>('person', 'p1')).toMatchObject({ phone: '+353 87 999 8888', email: 'aoife@example.com', linkToken: aoife.linkToken })
    let history = await colly.history()
    expect(history.entries[0]).toMatchObject({ who: { kind: 'link', name: 'Aoife Byrne' }, command: 'person.contact', what: 'Aoife Byrne changed their phone number' })
    expect(JSON.stringify(history.entries[0])).not.toContain('999 8888')

    // An email from a page from before is refused in plain words, with the number typed beside it kept, and nothing changed.
    const email = await post(app, details, { phone: '', email: 'aoife.byrne@example.com' })
    expect(email).toMatchObject({ ok: false, message: "Your email can't be changed here. Ask the office to change it." })
    expect(email.page).toContain('<details id="details" open>')
    // The page has no email field to say it under, so it's said above the form, and landed on there.
    expect(landing(email.page)).toMatch(/^<p class="flash bad" role="alert" id="refused">Your email can&#39;t be changed here/)
    expect(await colly.record<Person>('person', 'p1')).toMatchObject({ phone: '+353 87 999 8888', email: 'aoife@example.com' })
    // A number alone; then nothing, which sends nothing.
    expect(await post(app, details, { phone: '' })).toMatchObject({ ok: true })
    expect(await colly.record<Person>('person', 'p1')).toMatchObject({ phone: null, email: 'aoife@example.com' })
    expect(await post(app, details, { phone: '', email: 'aoife@example.com' })).toMatchObject({ ok: true, message: 'Nothing to change: those are the details we have.' })
    expect((await colly.history()).entries.filter((e) => e.outcome !== 'turned-down')).toHaveLength(3)
    // A post with no fields at all, as a half-formed one would be, clears nothing.
    expect(await post(app, details, {})).toMatchObject({ ok: true, message: 'Nothing to change: those are the details we have.' })
    expect(await colly.record<Person>('person', 'p1')).toMatchObject({ phone: null, email: 'aoife@example.com' })

    // The same checks as the office's form, with the reason in the section.
    const badPhone = await post(app, details, { phone: 'ring me' })
    expect(badPhone).toMatchObject({ ok: false, message: 'Phone numbers need digits only, ideally starting with +353.' })
    // Drawn at once in the section, open, with what was typed still in it (rule 11), said under the number, which is
    // described by its hint and then the refusal, and landed on.
    expect(badPhone.page).toContain('<details id="details" open>')
    expect(badPhone.page).toContain('value="ring me"')
    expect(landing(badPhone.page)).toMatch(/^<div class="field" id="refused"><label for="phone">Mobile<\/label>\s*<small class="hint" id="phone-hint">Write your mobile with the country code/)
    expect(badPhone.page).toMatch(/<input type="tel" id="phone" name="phone" aria-invalid="true" aria-describedby="phone-hint phone-error" value="ring me"[^>]*><\/div>\s*<p class="field-error" id="phone-error" role="alert">Phone numbers need digits only/)
    expect(badPhone.page).not.toContain('<p class="flash')
    expect(await colly.record<Person>('person', 'p1')).toMatchObject({ phone: null, email: 'aoife@example.com' })

    // The office can run it from the app too, in its own words. A change with nothing in it is turned down, not quietly applied.
    expect((await colly.send('person.contact', { id: 'p1', phone: '+353871234567' })).status).toBe('applied')
    history = await colly.history()
    expect(history.entries[0]).toMatchObject({ who: { kind: 'staff', name: 'Colly Hewson' }, what: "Changed Aoife Byrne's phone number" })
    expect(await colly.send('person.contact', { id: 'p1' })).toMatchObject({ status: 'rejected', reason: { code: 'invalid', message: 'Nothing to change.' } })
    expect((await colly.history()).entries[0]).toMatchObject({ command: 'person.contact', outcome: 'turned-down', reason: 'Nothing to change.' })
    expect(await colly.record<Person>('person', 'p1')).toMatchObject({ phone: '+353871234567', email: 'aoife@example.com' })
  })
})

describe("a freelancer's page", () => {
  it('reads the offers table three times however many jobs they were ever offered, and still says which days are filled', async () => {
    // Proves: the places still open on each call come from one query for all the calls, not one per job (audit finding 20).
    const db = await pgliteDb()
    const sql: string[] = []
    const app = await buildApp({ db: { ...db, query: (s, p) => (sql.push(s), db.query(s, p)) } })
    cleanup.push(async () => {
      await app.close()
      await db.close()
    })
    const aoife = await person(app, 'Aoife Byrne')
    const brian = await person(app, 'Brian Walsh')
    const mine: string[] = []
    let first = ''
    for (let i = 1; i <= 4; i++) {
      const c = await call(app, { start: `2026-11-0${i}`, end: `2026-11-0${i + 1}` })
      if (i === 1) first = c
      mine.push((await offer(app, c, aoife.id)).id)
    }
    // Brian holds the first call's first day, so for Aoife that day is filled.
    const { id: brians } = await offer(app, first, brian.id, true)
    await send(app, 'offer.respond', { id: brians, answer: 'accept', days: ['2026-11-01'], note: '' })

    sql.length = 0
    const page = await app.inject({ url: `/f/${aoife.linkToken}` })
    expect(page.statusCode).toBe(200)
    // Every query that names the table, a join included, as the five-jobs test above counts them: their offers with the calls, the places
    // held on all of those calls, and their timesheets. The days they hold on other jobs come from the first, so they cost no read of their own.
    expect(sql.filter((s) => /\boffers\b/.test(s))).toHaveLength(3)
    const card = cardOf(page.body, mine[0]!)
    expect(card).toContain('value="2026-11-01" disabled')
    expect(card).toContain('value="2026-11-02" checked')
  })
})

/**
 * Asking for the same crew again (ADR 0164; audit of 12 November 2026, finding 19): a job cancelled takes its crew calls
 * and their offers, marked with the day, and once it's going again each call can be brought back, open with nobody on it,
 * for the office to offer the same people again. Nothing goes to anyone until they do.
 */
describe('asking for the same crew again (ADR 0164)', () => {
  const history = async (app: FastifyInstance) => ((await app.inject({ url: '/api/history' })).json() as HistoryPage).entries.map((e) => e.what)

  /** Harbour Lights, confirmed, with a Build on 2 to 4 October and an Audio tech call on it for two. */
  async function harbourLights(app: FastifyInstance) {
    const job = newId()
    const build = newId()
    await send(app, 'project.create', { id: job, name: 'Harbour Lights', clientId: null, venueId: null, status: 'confirmed', notes: '' })
    await send(app, 'phase.add', { id: build, projectId: job, name: 'Build', start: '2026-10-02', end: '2026-10-04', venueId: null, notes: '' })
    const c = await call(app, { projectId: job, phaseId: build, project: 'Harbour Lights', needed: 2 })
    return { job, build, c }
  }

  it('marks the calls and offers a cancelled job took with the day, and brings a call back once the job is going again', async () => {
    const app = await server()
    const aoife = await person(app, 'Aoife Byrne')
    const niall = await person(app, 'Niall Kerr')
    const { job, build, c } = await harbourLights(app)
    const a = await offer(app, c, aoife.id)
    await answer(app, aoife.linkToken, a.id, { answer: 'accept' })
    await send(app, 'offer.confirm', { id: a.id })
    const n = await offer(app, c, niall.id)
    // A call the office cancelled itself, before the job was: that was a choice, so it stays cancelled.
    const rigger = await call(app, { projectId: job, phaseId: build, project: 'Harbour Lights', role: 'Rigger' })
    await send(app, 'call.cancel', { id: rigger })

    await send(app, 'project.update', { id: job, status: 'cancelled' })
    expect(await entity<CrewCall>(app, 'crewCall', c)).toMatchObject({ status: 'cancelled', stoppedOn: '2026-09-28' })
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'cancelled', stoppedOn: '2026-09-28' })
    expect(await entity<Offer>(app, 'offer', n.id)).toMatchObject({ status: 'cancelled', stoppedOn: '2026-09-28' })
    expect(await entity<CrewCall>(app, 'crewCall', rigger)).not.toHaveProperty('stoppedOn')

    // Not while the job is still cancelled, or marked as lost.
    const early = await send(app, 'call.reopen', { id: c })
    expect(early).toMatchObject({ status: 'rejected', reason: { code: 'conflict', message: 'Harbour Lights is still cancelled: set it going again first.' } })
    await send(app, 'project.update', { id: job, status: 'lost' })
    expect(await send(app, 'call.reopen', { id: c })).toMatchObject({ status: 'rejected', reason: { message: 'Harbour Lights is still marked as lost: set it going again first.' } })

    // Going again brings nobody back by itself.
    await send(app, 'project.update', { id: job, status: 'confirmed' })
    expect(await entity<CrewCall>(app, 'crewCall', c)).toMatchObject({ status: 'cancelled', stoppedOn: '2026-09-28' })
    expect(await send(app, 'call.reopen', { id: rigger })).toMatchObject({
      status: 'rejected',
      reason: { code: 'conflict', message: 'The Rigger call on Harbour Lights was cancelled on its own, so it stays cancelled. Ask for crew afresh.' },
    })

    expect((await send(app, 'call.reopen', { id: c })).status).toBe('applied')
    const back = await entity<CrewCall>(app, 'crewCall', c)
    expect(back).toMatchObject({ status: 'open', start: '2026-10-02', end: '2026-10-04', needed: 2 })
    expect(back).not.toHaveProperty('stoppedOn')
    // Pressed twice, or from a second device: once is enough.
    expect((await send(app, 'call.reopen', { id: c })).status).toBe('applied')
    expect((await history(app))[0]).toBe('Brought back the call for Audio tech on Harbour Lights, cancelled with its job')
    // The old offers stay as they ended, so nothing goes to anyone, and Aoife has nothing to answer until she's asked.
    expect(await entity<Offer>(app, 'offer', a.id)).toMatchObject({ status: 'cancelled', stoppedOn: '2026-09-28' })
    const page = (await app.inject({ url: `/f/${aoife.linkToken}` })).body
    expect(page).toContain('<p class="empty">Nothing waiting right now.</p>')

    // Offered again, as the office does next: a new offer, which she answers as any other.
    const again = await offer(app, c, aoife.id)
    expect(again.result.status).toBe('applied')
    expect(await entity<Offer>(app, 'offer', again.id)).toMatchObject({ status: 'offered', days: ['2026-10-02', '2026-10-03', '2026-10-04'] })
    expect(await entity<Offer>(app, 'offer', again.id)).not.toHaveProperty('stoppedOn')
  })

  it('keeps a call cancelled with its job to its phase while the job is stopped, and not one whose days have passed', async () => {
    const app = await server()
    const { job, build, c } = await harbourLights(app)
    const rigger = await call(app, { projectId: job, phaseId: build, project: 'Harbour Lights', role: 'Rigger' })
    await send(app, 'call.cancel', { id: rigger })
    await send(app, 'project.update', { id: job, status: 'cancelled' })

    // The Build moves a week while the job is off: the call goes with it, though nobody asked for crew to move, as nobody is on
    // it; the one cancelled on its own stays where it was.
    await send(app, 'phase.update', { id: build, start: '2026-10-09', end: '2026-10-11' })
    expect(await entity<CrewCall>(app, 'crewCall', c)).toMatchObject({ status: 'cancelled', start: '2026-10-09', end: '2026-10-11' })
    expect(await entity<CrewCall>(app, 'crewCall', rigger)).toMatchObject({ start: '2026-10-02', end: '2026-10-04' })
    await send(app, 'project.update', { id: job, status: 'confirmed' })
    expect((await send(app, 'call.reopen', { id: c })).status).toBe('applied')
    expect(await entity<CrewCall>(app, 'crewCall', c)).toMatchObject({ status: 'open', start: '2026-10-09', end: '2026-10-11' })

    // Cancelled again, and going again only once its days have gone: there's nothing left to ask for.
    await send(app, 'project.update', { id: job, status: 'cancelled' })
    await send(app, 'project.update', { id: job, status: 'confirmed' })
    vi.setSystemTime(new Date('2026-10-12T09:00:00Z'))
    expect(await send(app, 'call.reopen', { id: c })).toMatchObject({
      status: 'rejected',
      reason: { code: 'conflict', message: `The Audio tech call on Harbour Lights was for ${daysLabel(['2026-10-09', '2026-10-10', '2026-10-11'])}, which has passed.` },
    })
  })
})

describe('own day rates (ADR 0167)', () => {
  async function rated(app: FastifyInstance, name: string, dayRateCents: number | null, kind: 'freelancer' | 'staff' = 'freelancer') {
    const id = newId()
    await send(app, 'person.upsert', { id, name, kind, email: null, phone: null, skills: [], dayRateCents, notes: '' })
    return id
  }

  it('offers at the call rate, or at a freelancer’s own rate where it is above it or the call has none', async () => {
    // Proves: offer.send stores the rate they'll be paid; an own rate lower than the call's never lowers it; staff never get one.
    const app = await server()
    const c = await call(app, { needed: 4 })
    const above = await offer(app, c, await rated(app, 'Aoife Byrne', 30000))
    const below = await offer(app, c, await rated(app, 'Brian Kelly', 20000))
    const none = await offer(app, c, await rated(app, 'Ciara Walsh', null))
    const staff = await offer(app, c, await rated(app, 'Dara Nolan', 40000, 'staff'))
    expect((await entity<Offer>(app, 'offer', above.id)).dayRateCents).toBe(30000)
    expect((await entity<Offer>(app, 'offer', below.id)).dayRateCents).toBe(25000)
    expect((await entity<Offer>(app, 'offer', none.id)).dayRateCents).toBe(25000)
    expect((await entity<Offer>(app, 'offer', staff.id)).dayRateCents).toBe(25000)

    const open = await call(app, { dayRateCents: null })
    const toAgree = await offer(app, open, await rated(app, 'Eoin Ryan', 32000))
    expect((await entity<Offer>(app, 'offer', toAgree.id)).dayRateCents).toBe(32000)
  })

  it('keeps an unanswered offer at their own rate when the call’s rate changes, until the call’s goes above it', async () => {
    const app = await server()
    const c = await call(app)
    const o = await offer(app, c, await rated(app, 'Aoife Byrne', 30000))
    expect((await send(app, 'call.update', { id: c, dayRateCents: 26000 })).status).toBe('applied')
    expect((await entity<Offer>(app, 'offer', o.id)).dayRateCents).toBe(30000)
    expect((await send(app, 'call.update', { id: c, dayRateCents: 35000 })).status).toBe('applied')
    expect((await entity<Offer>(app, 'offer', o.id)).dayRateCents).toBe(35000)
  })
})
