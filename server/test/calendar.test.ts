import {
  askEndingWords,
  calendarDayId,
  COUNTERED_YES,
  daysToCancel,
  invitePlan,
  invitesHeld,
  newId,
  offerOnCalendar,
  phaseOnCalendar,
  type CalendarDay,
  type CalendarLink,
  type CommandInput,
  type CommandName,
  type CrewCall,
  type HistoryEntry,
  type NoInvite,
  type Offer,
  type Person,
  type Phase,
  type Project,
  type ReachContext,
  YES_WHILE_ASKING,
} from '@sh/shared'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.ts'
import type { IdentityProvider } from '../src/auth/google.ts'
import { seal } from '../src/calendar/crypto.ts'
import { allowancesText, greeting, pageLine, SHEET_LATER } from '../src/calendar/events.ts'
import { CREW, migrateCrew } from '../src/crew/schema.ts'
import { pgliteDb, type Db } from '../src/db.ts'
import { everythingJson, readEverything } from '../src/export.ts'
import { FakeGoogle } from './fake-google-calendar.ts'
import { staff, WINDOWS } from './people.ts'

/**
 * Confirmed jobs on Google Calendar (ADR 0008), as ops and crew would see
 * it: connecting an account from Admin, picking a calendar, and
 * the calendar then holding every day of every confirmed job from today on,
 * in the shape crew know, whatever happens to the job, to Google, or to the
 * server in between. Google is played by a stand-in that answers as the
 * real one does (fake-google-calendar.ts).
 */

const TEST_CAL = 'test-cal@group.calendar.google.com'
const GIGS = 'gigs@group.calendar.google.com'
const TODAY = '2030-03-02'

let cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn()
  cleanup = []
})

async function setup(opts: { settleMs?: number; pollMs?: number; calendar?: boolean; retryMs?: number[]; writes?: boolean | null } = {}) {
  const db = await pgliteDb()
  const google = new FakeGoogle()
  let now = new Date(`${TODAY}T10:00:00Z`)
  google.clock = () => now
  // Counts what reaches the database, to show looking for answers leaves it asleep.
  const queries = { count: 0 }
  // Made to fail on the next few reads of the connection, to play the database faltering as a run starts.
  const fault = { times: 0 }
  const counted: Db = {
    ...db,
    query: (sql, params) => {
      queries.count++
      if (fault.times > 0 && sql.includes('FROM calendar_link')) {
        fault.times--
        return db.query('SELECT 1/0')
      }
      return db.query(sql, params)
    },
    transaction: (fn, o) => (queries.count++, db.transaction(fn, o)),
  }
  const app = await buildApp({
    db: counted,
    auth: { provider: {} as IdentityProvider, domains: ['sessionhire.com'], emails: [] },
    ...(opts.calendar === false
      ? {}
      : {
          calendar: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            fetch: google.fetch,
            gapMs: 0,
            // Runs and looks for answers happen when a test asks, unless it is testing the automatic ones.
            settleMs: opts.settleMs ?? 3_600_000,
            pollMs: opts.pollMs ?? 0,
            retryMs: opts.retryMs,
            // These tests write to the fake calendar unless they say not to; the server itself writes only when asked (finding 107).
            // null leaves the option out, as a caller that forgets it would.
            ...(opts.writes === null ? {} : { writes: opts.writes ?? true }),
            now: () => now,
          },
        }),
  })
  cleanup.push(async () => {
    await app.close()
    await db.close()
  })
  const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'collylaptop')
  return {
    app,
    db,
    google,
    colly,
    queries,
    fault,
    sync: () => app.calendar!.run(),
    check: () => app.calendar!.run(true),
    poll: () => app.calendar!.poll(),
    clock: () => now,
    setToday: (day: string) => (now = new Date(`${day}T10:00:00Z`)),
    /** Time passes, as between two looks for answers. */
    later: (minutes: number) => (now = new Date(now.getTime() + minutes * 60_000)),
  }
}

type Setup = Awaited<ReturnType<typeof setup>>

/** Connect Google Calendar from Admin: off to Google, allow, and back. */
async function connect({ app, google, colly }: Setup, answer?: (authorizeUrl: string) => string): Promise<LightMyRequestResponse> {
  const start = await app.inject({ url: '/api/calendar/connect?client=collylaptop', cookies: colly.cookies })
  expect(start.statusCode).toBe(302)
  const attempt = start.cookies.find((c) => c.name === 'sh_calendar')!
  const authorizeUrl = start.headers.location as string
  let query = answer?.(authorizeUrl)
  if (!query) {
    const { code, state } = google.consent(authorizeUrl)
    query = `code=${code}&state=${state}`
  }
  return app.inject({ url: `/api/calendar/callback?${query}`, cookies: { ...colly.cookies, sh_calendar: attempt.value } })
}

async function use(s: Setup, calendarId: string) {
  return s.app.inject({ method: 'POST', url: '/api/calendar/use?client=collylaptop', cookies: s.colly.cookies, payload: { calendarId } })
}

async function connectTo(s: Setup, calendarId = TEST_CAL) {
  expect((await connect(s)).headers.location).toBe('/?calendar=connected#admin/connections')
  expect((await use(s, calendarId)).statusCode).toBe(200)
  await s.sync()
}

/** What the devices have been told, record by record. */
async function feed(s: Setup) {
  const res = await s.app.inject({ url: '/api/sync/pull?after=0', cookies: s.colly.cookies })
  const all = new Map<string, Map<string, unknown>>()
  for (const c of res.json().changes as { entity: string; id: string; op: string; data: unknown }[]) {
    const table = all.get(c.entity) ?? new Map<string, unknown>()
    all.set(c.entity, table)
    if (c.op === 'delete') table.delete(c.id)
    else table.set(c.id, c.data)
  }
  return {
    text: res.body,
    link: all.get('calendarLink')?.get('main') as CalendarLink | undefined,
    days: Object.fromEntries(all.get('calendarDay') ?? []) as Record<string, CalendarDay>,
    get: <T>(entity: string, id: string) => all.get(entity)?.get(id) as T,
    list: <T>(entity: string) => [...(all.get(entity)?.values() ?? [])] as T[],
  }
}

const titles = (google: FakeGoogle, calendarId = TEST_CAL) => google.visible(calendarId).map((e) => `${e.start.date} ${e.summary}`)
/** The calls that changed events: adding, replacing and deleting, not reading. */
const eventWrites = (calls: string[]) => calls.filter((c) => c.includes('/events') && !c.startsWith('GET'))

async function send<N extends CommandName>(s: Setup, name: N, args: CommandInput<N>) {
  const r = await s.colly.send(name, args)
  expect(r.status, JSON.stringify(r)).toBe('applied')
  // An offer's invites wait half a minute so it can be undone (ADR 0161): here they go at once, as half a minute on.
  if (name === 'offer.send') await waitOver(s, (args as CommandInput<'offer.send'>).id)
}

/** Half a minute after Offer (ADR 0161): the offer's wait for Undo is over. */
const waitOver = (s: Setup, id: string) => s.db.query(`UPDATE offers SET goes_at = now() - interval '1 second' WHERE id = $1`, [id])

/** Nissan, confirmed: Prep yesterday at the warehouse, Build today and tomorrow, Show the day after, with crew on Build. */
async function nissan(s: Setup) {
  const clientId = newId()
  const venueId = newId()
  const jobId = newId()
  const phases = { prep: newId(), build: newId(), show: newId() }
  await send(s, 'client.upsert', { id: clientId, name: 'Nissan Ireland', contacts: [{ name: 'Mary Walsh', role: 'Producer', email: 'mary@nissan.example', phone: '+353 1 555 0100' }], notes: '' })
  await send(s, 'venue.upsert', {
    id: venueId,
    name: 'The Convention Centre Dublin',
    address: 'Spencer Dock, North Wall Quay\nDublin 1, D01 T1W6',
    notes: 'Load-in via Mayor Street.',
  })
  await send(s, 'project.create', { id: jobId, name: 'Nissan', clientId, venueId, status: 'confirmed', notes: 'Launch of the new Leaf.' })
  await send(s, 'phase.add', { id: phases.prep, projectId: jobId, name: 'Prep', start: '2030-03-01', end: '2030-03-01', venueId: null, notes: '' })
  await send(s, 'phase.add', { id: phases.build, projectId: jobId, name: 'Build', start: '2030-03-02', end: '2030-03-03', venueId: null, notes: '' })
  await send(s, 'phase.add', { id: phases.show, projectId: jobId, name: 'Show', start: '2030-03-04', end: '2030-03-04', venueId: null, notes: 'Doors 19:00.' })

  // Two audio techs wanted for Build out of three: Aoife confirmed, Seán said yes and waits on the office.
  const aoife = newId()
  const sean = newId()
  const callId = newId()
  await send(s, 'person.upsert', { id: aoife, name: 'Aoife Byrne', kind: 'freelancer', email: 'aoife@example.com', phone: '+353 87 123 4567', skills: ['audio'], dayRateCents: 25000, notes: '' })
  await send(s, 'person.upsert', { id: sean, name: 'Seán Murphy', kind: 'freelancer', email: null, phone: '+353 86 765 4321', skills: ['audio'], dayRateCents: 26000, notes: '' })
  await send(s, 'call.create', {
    id: callId,
    projectId: jobId,
    phaseId: phases.build,
    project: 'Nissan',
    phase: 'Build',
    venue: '',
    role: 'Audio tech',
    start: '2030-03-02',
    end: '2030-03-03',
    callTime: '08:00',
    needed: 3,
    dayRateCents: 25000,
    details: '',
    replyBy: null,
  })
  const offerA = newId()
  const offerS = newId()
  await send(s, 'offer.send', { id: offerA, callId, personId: aoife, override: false })
  await send(s, 'offer.send', { id: offerS, callId, personId: sean, override: false })
  await send(s, 'offer.respond', { id: offerA, answer: 'accept', days: null, note: '' })
  await send(s, 'offer.confirm', { id: offerA })
  await send(s, 'offer.respond', { id: offerS, answer: 'accept', days: null, note: '' })
  return { jobId, clientId, venueId, phases, callId, offers: { aoife: offerA, sean: offerS } }
}

describe('connecting a calendar', () => {
  it('asks Google for only what it needs, and writes nothing until a calendar is picked', async () => {
    const s = await setup()
    const early = await s.app.inject({ url: '/api/calendar/calendars', cookies: s.colly.cookies })
    expect(early.statusCode).toBe(409)
    expect(early.json().error).toBe('Connect a Google account first.')
    await nissan(s)

    const back = await connect(s, (url) => {
      const q = new URL(url).searchParams
      expect(url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/)
      expect(q.get('scope')!.split(' ').sort()).toEqual([
        'email',
        'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'openid',
      ])
      expect(q.get('access_type')).toBe('offline')
      expect(q.get('prompt')).toBe('consent')
      expect(q.get('login_hint')).toBe('colly@sessionhire.com')
      expect(q.get('code_challenge_method')).toBe('S256')
      expect(q.get('redirect_uri')).toBe('http://localhost:80/api/calendar/callback')
      return ''
    })
    expect(back.statusCode).toBe(303)
    expect(back.headers.location).toBe('/?calendar=connected#admin/connections')

    const { link } = await feed(s)
    expect(link).toMatchObject({ state: 'choosing', account: 'ops@sessionhire.com', calendarId: null, connectedBy: 'Colly Hewson', problem: null })

    // Only calendars the account can change, its own first.
    const list = await s.app.inject({ url: '/api/calendar/calendars', cookies: s.colly.cookies })
    expect(list.json()).toEqual([
      { id: 'ops@sessionhire.com', name: 'ops@sessionhire.com', primary: true, access: 'owner' },
      { id: GIGS, name: 'Session Hire Gigs', primary: false, access: 'writer' },
      { id: TEST_CAL, name: 'Test calendar', primary: false, access: 'owner' },
    ])

    await s.sync()
    expect(s.google.calls.filter((c) => c.includes('/events'))).toEqual([])

    const readOnly = await use(s, 'holidays@group.v.calendar.google.com')
    expect(readOnly.statusCode).toBe(400)
    expect(readOnly.json().error).toContain("ops@sessionhire.com can't change that calendar")

    const chosen = await use(s, TEST_CAL)
    expect(chosen.json()).toMatchObject({ state: 'on', calendarId: TEST_CAL, calendarName: 'Test calendar' })
  })

  it('keeps the key Google gives locked, out of the export, and away from devices', async () => {
    const s = await setup()
    await connectTo(s)
    const { rows } = await s.db.query<{ refresh_token: string }>('SELECT refresh_token FROM calendar_link')
    expect(rows[0]!.refresh_token).toMatch(/^v1\./)
    expect(rows[0]!.refresh_token).not.toContain('refresh-')

    const everything = JSON.stringify(everythingJson(await readEverything(s.db)))
    expect(everything).toContain('"calendar_link"')
    expect(everything).not.toContain('refresh_token')
    expect(everything).not.toContain(rows[0]!.refresh_token)
    expect((await feed(s)).text).not.toMatch(/refresh|v1\./)
  })

  it('says why when connecting goes wrong, and connects nothing', async () => {
    const s = await setup()
    const cancelled = await connect(s, () => 'error=access_denied')
    expect(cancelled.headers.location).toBe('/?calendar=cancelled#admin/connections')

    const forged = await connect(s, (url) => {
      const { code } = s.google.consent(url)
      return `code=${code}&state=someone-elses`
    })
    expect(forged.headers.location).toBe('/?calendar=failed#admin/connections')

    // Without a lasting key the app could only write for an hour.
    s.google.grant.refresh = false
    expect((await connect(s)).headers.location).toBe('/?calendar=failed#admin/connections')
    s.google.grant.refresh = true

    // Google lets people untick the calendar on its consent page.
    s.google.grant.scopes = 'openid https://www.googleapis.com/auth/userinfo.email'
    expect((await connect(s)).headers.location).toBe('/?calendar=missing#admin/connections')
    expect(s.google.revokedFor('ops@sessionhire.com')).toBe(true)
    expect((await feed(s)).link).toBeUndefined()
  })

  it('without the Google key, says the calendar needs it', async () => {
    const s = await setup({ calendar: false })
    const start = await s.app.inject({ url: '/api/calendar/connect', cookies: s.colly.cookies })
    expect(start.headers.location).toBe('/?calendar=off#admin/connections')
    const list = await s.app.inject({ url: '/api/calendar/calendars', cookies: s.colly.cookies })
    expect(list.statusCode).toBe(409)
    expect(s.app.calendar).toBeUndefined()
  })

  it('sends too many tries at connecting back to Admin in words, not a page of raw JSON', async () => {
    const s = await setup({ calendar: false })
    const visits = []
    for (let i = 0; i < 22; i++) visits.push(await s.app.inject({ url: '/api/calendar/connect', cookies: s.colly.cookies }))
    expect(visits.at(-1)!.statusCode).toBe(303)
    expect(visits.at(-1)!.headers.location).toBe('/?calendar=busy#admin/connections')
  })

  it('needs someone signed in, like the rest of the app', async () => {
    const s = await setup()
    for (const url of ['/api/calendar/connect', '/api/calendar/calendars', '/api/calendar/callback?code=x&state=y']) expect((await s.app.inject({ url })).statusCode).toBe(401)
    for (const url of ['/api/calendar/use', '/api/calendar/check', '/api/calendar/disconnect']) expect((await s.app.inject({ method: 'POST', url })).statusCode).toBe(401)
  })
})

describe('what goes on the calendar', () => {
  it('puts every day of a confirmed job on it from today on, as crew know it', async () => {
    const s = await setup()
    const job = await nissan(s)
    // Not confirmed, so not on the calendar.
    const pencilled = newId()
    await send(s, 'project.create', { id: pencilled, name: 'Pencilled', clientId: null, venueId: null, status: 'enquiry', notes: '' })
    await send(s, 'phase.add', { id: newId(), projectId: pencilled, name: 'Show', start: '2030-03-03', end: '2030-03-03', venueId: null, notes: '' })
    // Kit for the whole job and for the build, grouped by department on each build day; the show gets only the job's.
    const product = (id: string, name: string, department: 'audio' | 'lighting', category: string) =>
      send(s, 'model.create', { id, name, department, category, tracking: 'bulk', isCase: false, valueCents: 99900, notes: '' })
    await product('y10p', 'd&b Y10P', 'audio', 'Speakers')
    await product('sm58', 'Shure SM58', 'audio', 'Microphones')
    await product('mac', 'Robe MegaPointe', 'lighting', 'Moving heads')
    const kit = (modelId: string, phaseId: string | null, qty: number, subhireQty = 0) =>
      send(s, 'kit.add', { id: newId(), projectId: job.jobId, phaseId, modelId, qty, subhireQty, supplier: subhireQty ? 'Hire Co' : '', notes: '' })
    await kit('mac', job.phases.build, 12, 4)
    await kit('y10p', null, 8)
    await kit('sm58', null, 6)
    await kit('sm58', job.phases.build, 2)
    // Asked and not answered yet: a TBC on the crew line, as is Seán's yes until the office confirms it.
    const ciara = newId()
    await send(s, 'person.upsert', { id: ciara, name: 'Ciara Doyle', kind: 'freelancer', email: null, phone: null, skills: ['audio'], dayRateCents: null, notes: '' })
    await send(s, 'offer.send', { id: newId(), callId: job.callId, personId: ciara, override: false })
    // The quote's per diem and fuel, which crew see; nothing else it charges.
    const extra = (what: string, unitCents: number, kind: 'travel' | 'subsistence') =>
      ({ id: newId(), kind: 'other', what, ref: null, group: 'Travel and subsistence', qty: 4, days: 1, unitCents, vat: '23', per: 'once', extra: kind }) as const
    await send(s, 'quote.save', {
      id: newId(),
      projectId: job.jobId,
      lines: [extra('Crew travel, 160 km each way from Dublin, 4 car trips', 4810, 'travel'), extra('Crew subsistence, 4 crew days', 3500, 'subsistence')],
      discountPct: 0,
      notes: '',
    })
    await connectTo(s)

    // Yesterday's Prep is left alone.
    expect(titles(s.google)).toEqual(['2030-03-02 Nissan - Build 1/2', '2030-03-03 Nissan - Build 2/2', '2030-03-04 Nissan - Show'])
    const [build1, , show] = s.google.visible(TEST_CAL)
    expect(build1).toMatchObject({
      start: { date: '2030-03-02' },
      end: { date: '2030-03-03' },
      location: 'The Convention Centre Dublin, Spencer Dock, North Wall Quay, Dublin 1, D01 T1W6',
      extendedProperties: { private: { shJob: job.jobId, shPhase: job.phases.build, shDay: '2030-03-02' } },
    })
    expect(build1!.description).toBe(
      [
        // Its first day, with kit to pick and none gone yet: Going out, as the job page has it.
        'Job stage: Going out (3 of 5)',
        '',
        'Client: Nissan Ireland',
        'Build, day 1 of 2: Sat 2 Mar to Sun 3 Mar',
        '',
        'Venue: The Convention Centre Dublin',
        'Spencer Dock, North Wall Quay, Dublin 1, D01 T1W6',
        'At the venue: Load-in via Mayor Street.',
        '',
        'Crew',
        'Audio tech, call 08:00: Aoife Byrne, 2 TBC',
        '',
        'Job notes',
        'Launch of the new Leaf.',
        '',
        'Per diems and fuel',
        'Per diems: approved, €35 a day each',
        'Fuel: covered, about €48.10 a car there and back (160 km each way)',
        '',
        'Pick list',
        '',
        'Audio',
        '• 8 × Shure SM58',
        '• 8 × d&b Y10P',
        '',
        'Lighting',
        '• 12 × Robe MegaPointe (4 hired in)',
        '',
        `The job in the Session Hire app: http://localhost:80/#jobs/${job.jobId}`,
      ].join('\n')
    )
    expect(show!.description).toContain('Pick list\n\nAudio\n• 6 × Shure SM58\n• 8 × d&b Y10P\n\nThe job')
    expect(show!.description).not.toContain('Written by')
    expect(allowancesText({ perDiemCents: null, mealsProvided: true, fuelCents: null, km: null })).toBe(
      'Per diems and fuel\nPer diems: not approved, as meals are provided\nFuel: not covered'
    )
    // The crew's rooms (ADR 0156), said only on a job they stay over for.
    expect(allowancesText({ perDiemCents: 3500, mealsProvided: false, fuelCents: 4810, km: 223, rooms: true })).toBe(
      'Per diems, fuel and accommodation\nPer diems: approved, €35 a day each\nFuel: covered, about €48.10 a car there and back (223 km each way)\nAccommodation: covered'
    )
    expect(allowancesText({ perDiemCents: null, mealsProvided: true, fuelCents: null, km: null, accommodationProvided: true })).toContain('Accommodation: provided by the job')
    expect(show!.description).toContain('Show, Mon 4 Mar')
    expect(show!.description).toContain('Show notes\nDoors 19:00.')
    // Names only: no rates, phone numbers or emails (the per diem and fuel are the only money).
    for (const ev of s.google.visible(TEST_CAL)) expect(ev.description).not.toMatch(/250|260|\+353|@/)

    // Devices see each day, and the job page what it means.
    const f = await feed(s)
    expect(Object.keys(f.days).sort()).toEqual(
      [calendarDayId(job.phases.build, '2030-03-02'), calendarDayId(job.phases.build, '2030-03-03'), calendarDayId(job.phases.show, '2030-03-04')].sort()
    )
    expect(f.days[calendarDayId(job.phases.build, '2030-03-02')]).toMatchObject({ state: 'on', title: 'Nissan - Build 1/2', calendarId: TEST_CAL, problem: null })
    const project = f.get<Project>('project', job.jobId)
    const phase = (id: string) => f.get<Phase>('phase', id)
    expect(phaseOnCalendar(project, phase(job.phases.build), f.link, f.days, TODAY)).toMatchObject({ state: 'on', calendar: 'Test calendar', days: 2 })
    expect(phaseOnCalendar(project, phase(job.phases.prep), f.link, f.days, TODAY)).toEqual({ state: 'past' })
    expect(phaseOnCalendar({ name: 'Pencilled', status: 'enquiry' }, phase(job.phases.show), f.link, f.days, TODAY)).toEqual({ state: 'waiting' })

    // A second run with nothing changed writes nothing.
    const before = s.google.calls.length
    expect(await s.sync()).toEqual({ written: 0, removed: 0, failed: 0 })
    expect(s.google.calls.slice(before).filter((c) => !c.startsWith('POST /token'))).toEqual([])
  })

  it('keeps the calendar in step as the job changes, touching only what changed', async () => {
    const s = await setup()
    const job = await nissan(s)
    await connectTo(s)
    const ids = s.google.visible(TEST_CAL).map((e) => e.id)

    await send(s, 'project.update', { id: job.jobId, name: 'Nissan Leaf' })
    await s.sync()
    expect(titles(s.google)).toEqual(['2030-03-02 Nissan Leaf - Build 1/2', '2030-03-03 Nissan Leaf - Build 2/2', '2030-03-04 Nissan Leaf - Show'])
    expect(s.google.visible(TEST_CAL).map((e) => e.id)).toEqual(ids)

    // A note on Show changes Show's event only, read first so nothing added in Google is lost.
    let before = s.google.calls.length
    await send(s, 'phase.update', { id: job.phases.show, notes: 'Doors 19:30.' })
    await s.sync()
    const show = `/calendar/v3/calendars/${encodeURIComponent(TEST_CAL)}/events/${ids[2]}`
    expect(s.google.calls.slice(before).filter((c) => c.includes('/events'))).toEqual([`GET ${show}`, `PUT ${show}`])

    // Show moves a day later; Build grows to three days.
    await send(s, 'phase.update', { id: job.phases.show, start: '2030-03-05', end: '2030-03-05' })
    await send(s, 'phase.update', { id: job.phases.build, end: '2030-03-04' })
    await s.sync()
    expect(titles(s.google)).toEqual([
      '2030-03-02 Nissan Leaf - Build 1/3',
      '2030-03-03 Nissan Leaf - Build 2/3',
      '2030-03-04 Nissan Leaf - Build 3/3',
      '2030-03-05 Nissan Leaf - Show',
    ])

    // Booking crew changes the days they are on.
    before = s.google.calls.length
    await send(s, 'offer.confirm', { id: job.offers.sean })
    await s.sync()
    expect(s.google.visible(TEST_CAL)[0]!.description).toContain('Audio tech, call 08:00: Aoife Byrne, Seán Murphy, TBC')
    expect(eventWrites(s.google.calls.slice(before))).toHaveLength(2)

    // Cancelled: off the calendar, and off the devices' list.
    await send(s, 'project.update', { id: job.jobId, status: 'cancelled' })
    await s.sync()
    expect(titles(s.google)).toEqual([])
    expect((await feed(s)).days).toEqual({})

    // Confirmed again: back, in the same events.
    await send(s, 'project.update', { id: job.jobId, status: 'confirmed' })
    await s.sync()
    expect(titles(s.google)).toEqual(['2030-03-02 Nissan Leaf - Build 1/3', '2030-03-03 Nissan Leaf - Build 2/3', '2030-03-04 Nissan Leaf - Build 3/3', '2030-03-05 Nissan Leaf - Show'])
    expect(s.google.visible(TEST_CAL).map((e) => e.id).slice(0, 2)).toEqual(ids.slice(0, 2))

    // A phase removed takes its days with it.
    await send(s, 'phase.remove', { id: job.phases.show })
    await s.sync()
    expect(titles(s.google)).toHaveLength(3)
  })

  it('leaves days that have gone alone', async () => {
    const s = await setup()
    const job = await nissan(s)
    await connectTo(s)
    s.setToday('2030-03-04')
    await send(s, 'project.update', { id: job.jobId, name: 'Nissan Leaf' })
    await s.sync()
    // Build is over: its events keep the old name. Show is today.
    expect(titles(s.google)).toEqual(['2030-03-02 Nissan - Build 1/2', '2030-03-03 Nissan - Build 2/2', '2030-03-04 Nissan Leaf - Show'])
    await send(s, 'project.update', { id: job.jobId, status: 'cancelled' })
    await s.sync()
    expect(titles(s.google)).toEqual(['2030-03-02 Nissan - Build 1/2', '2030-03-03 Nissan - Build 2/2'])
  })

  it('an answer lost on the way back from Google makes no second event', async () => {
    const s = await setup()
    await nissan(s)
    await connect(s)
    await use(s, TEST_CAL)
    s.google.loseReplies = 1
    await s.sync()
    await s.sync()
    expect(titles(s.google)).toEqual(['2030-03-02 Nissan - Build 1/2', '2030-03-03 Nissan - Build 2/2', '2030-03-04 Nissan - Show'])
    expect([...s.google.events.get(TEST_CAL)!.values()]).toHaveLength(3)
  })
})

describe('with writing switched off (CALENDAR_WRITES)', () => {
  it('connects and reads calendars, but writes nothing, invites nobody, and says why', async () => {
    const s = await setup({ writes: false })
    await nissan(s)
    await connectTo(s)
    expect(await s.check()).toMatchObject({ written: 0, removed: 0, failed: 0, problem: expect.stringContaining('switched off') })
    expect(eventWrites(s.google.calls)).toEqual([])
    expect(s.google.visible(TEST_CAL)).toEqual([])
    expect((await feed(s)).link?.problem).toContain('CALENDAR_WRITES')

    // Crew invites can't be turned on.
    const invites = await s.app.inject({ method: 'POST', url: '/api/calendar/invites?client=collylaptop', cookies: s.colly.cookies, payload: { on: true } })
    expect(invites.statusCode).toBe(409)
    expect((await feed(s)).link?.invites).toBe(false)

    // The calendars can still be listed, to bring jobs in.
    expect((await s.app.inject({ url: '/api/calendar/import/calendars', cookies: s.colly.cookies })).statusCode).toBe(200)
    const health = await s.app.inject({ url: '/api/health' })
    expect(health.json().calendar).toBe('read-only')

    // Disconnecting still finishes, without touching Google's events.
    const off = await s.app.inject({ method: 'POST', url: '/api/calendar/disconnect?client=collylaptop', cookies: s.colly.cookies })
    expect(off.statusCode).toBe(200)
    await s.sync()
    expect((await feed(s)).link?.state).toBe('off')
    expect(eventWrites(s.google.calls)).toEqual([])
  })
})

describe('with nothing said about writing', () => {
  it('writes nothing, as for a caller that forgets the switch (audit, 20 October 2026, finding 107)', async () => {
    const s = await setup({ writes: null })
    await nissan(s)
    await connectTo(s)
    expect(await s.check()).toMatchObject({ written: 0, problem: expect.stringContaining('switched off') })
    expect(eventWrites(s.google.calls)).toEqual([])
    expect((await s.app.inject({ url: '/api/health' })).json().calendar).toBe('read-only')
  })
})

describe('when the calendar and the app disagree', () => {
  it('the nightly check puts back what was changed or deleted in Google, and clears up strays', async () => {
    const s = await setup()
    await nissan(s)
    await connectTo(s)
    const [build1, build2, show] = s.google.visible(TEST_CAL)
    s.google.edit(TEST_CAL, build1!.id, { summary: 'Nissan - Build (moved?)' })
    s.google.edit(TEST_CAL, build2!.id, { status: 'cancelled' })
    // Deleted long ago enough that Google has forgotten it.
    s.google.events.get(TEST_CAL)!.delete(show!.id)
    s.google.purged.add(show!.id)
    // One of the app's own events it has lost track of (a restored database, say), and someone's own event.
    const appKey = build1!.extendedProperties!.private!.sh!
    const store = s.google.events.get(TEST_CAL)!
    const stray = { ...build1!, id: 'straystraystray1', summary: 'Old - Show', start: { date: '2030-03-06' }, end: { date: '2030-03-07' }, extendedProperties: { private: { sh: appKey, shDay: '2030-03-06' } } }
    store.set(stray.id, stray)
    const own = { ...build1!, id: 'mineminemine1', summary: 'Dentist', extendedProperties: undefined }
    store.set(own.id, own)

    // Without looking, the app doesn't know.
    expect(await s.sync()).toEqual({ written: 0, removed: 0, failed: 0 })
    expect(await s.check()).toEqual({ written: 3, removed: 1, failed: 0 })
    expect(titles(s.google)).toEqual(['2030-03-02 Dentist', '2030-03-02 Nissan - Build 1/2', '2030-03-03 Nissan - Build 2/2', '2030-03-04 Nissan - Show'])
    // The forgotten one could only be made again, with a new id.
    expect(s.google.visible(TEST_CAL).find((e) => e.summary === 'Nissan - Show')!.id).not.toBe(show!.id)
    expect(await s.check()).toEqual({ written: 0, removed: 0, failed: 0 })
  })

  it('Google being busy only delays things, and says so if it goes on', async () => {
    const s = await setup()
    await nissan(s)
    await connect(s)
    await use(s, TEST_CAL)
    s.google.busyFor = 1
    expect(await s.sync()).toEqual({ written: 0, removed: 0, failed: 0 })
    expect((await feed(s)).link!.problem).toBeNull()
    s.google.busyFor = 2
    await s.sync()
    await s.sync()
    expect((await feed(s)).link!.problem).toMatch(/^Google Calendar isn't answering, so some days are still on their way\. Trying again at \d\d:\d\d\.$/)
    await s.sync()
    expect(titles(s.google)).toHaveLength(3)
    expect((await feed(s)).link!.problem).toBeNull()
  })

  it('a run that fails on something unexpected tries again by itself a little later, without waiting for the next change', async () => {
    // Proves: nothing is written by the run that failed, and a retry on the sync's own timer finishes the job with nobody asking.
    const s = await setup({ retryMs: [40, 40, 40] })
    const { phases } = await nissan(s)
    await connectTo(s)
    expect(titles(s.google)).toHaveLength(3)
    await send(s, 'phase.update', { id: phases.show, end: '2030-03-05' })
    s.fault.times = 1
    await expect(s.sync()).rejects.toThrow('division by zero')
    expect(titles(s.google)).toHaveLength(3)
    await expect.poll(() => titles(s.google).length, { timeout: 5_000 }).toBe(4)
  })

  it('tries again three times at most, saying so in the log each time, then waits for the next change', async () => {
    // Proves: a fault that lasts is not tried for ever on the sync's own timer, and no failure goes unlogged.
    const s = await setup({ retryMs: [20, 20, 20] })
    await nissan(s)
    await connectTo(s)
    const logged = vi.spyOn(s.app.log, 'error')
    try {
      s.fault.times = 10
      await expect(s.sync()).rejects.toThrow('division by zero')
      await expect.poll(() => logged.mock.calls.length, { timeout: 5_000 }).toBe(4)
      // Time enough for a fifth try, had one been coming.
      await new Promise((r) => setTimeout(r, 200))
      expect(s.fault.times).toBe(6)
      expect(logged.mock.calls.map((c) => c[1])).toEqual([
        'Calendar sync failed; trying again later',
        'Calendar sync failed; trying again later',
        'Calendar sync failed; trying again later',
        'Calendar sync failed again; it waits for the next change now',
      ])
    } finally {
      logged.mockRestore()
    }
  })

  it('a day Google turns down shows on the job page, and the rest still go on', async () => {
    const s = await setup()
    const job = await nissan(s)
    s.google.refuse.add('Nissan - Show')
    await connectTo(s)
    expect(titles(s.google)).toEqual(['2030-03-02 Nissan - Build 1/2', '2030-03-03 Nissan - Build 2/2'])
    const f = await feed(s)
    const project = f.get<Project>('project', job.jobId)
    expect(phaseOnCalendar(project, f.get<Phase>('phase', job.phases.show), f.link, f.days, TODAY)).toMatchObject({
      state: 'failed',
      problem: 'Google turned this day down (badRequest). It is tried again when the job changes, and each night.',
    })
    // Not tried again on every change to anything else.
    const before = s.google.calls.length
    await send(s, 'phase.update', { id: job.phases.build, notes: 'Bring the long ladder.' })
    await s.sync()
    expect(eventWrites(s.google.calls.slice(before))).toHaveLength(2)
    s.google.refuse.clear()
    await s.check()
    expect(titles(s.google)).toHaveLength(3)
  })
})

describe('when access goes wrong', () => {
  it('asks to connect again when Google stops accepting the key, then carries on', async () => {
    const s = await setup()
    const job = await nissan(s)
    await connectTo(s)
    s.google.revokeAll()
    await send(s, 'project.update', { id: job.jobId, name: 'Nissan Leaf' })
    await s.sync()
    const f = await feed(s)
    expect(f.link).toMatchObject({ state: 'reconnect', problem: expect.stringContaining('Connect again to carry on') })
    expect(phaseOnCalendar(f.get<Project>('project', job.jobId), f.get<Phase>('phase', job.phases.build), f.link, f.days, TODAY)).toEqual({ state: 'paused' })

    // The same account again: the calendar is kept, and the calendar catches up.
    expect((await connect(s)).headers.location).toBe('/?calendar=connected#admin/connections')
    expect((await feed(s)).link).toMatchObject({ state: 'on', calendarId: TEST_CAL })
    await s.sync()
    expect(titles(s.google)).toEqual(['2030-03-02 Nissan Leaf - Build 1/2', '2030-03-03 Nissan Leaf - Build 2/2', '2030-03-04 Nissan Leaf - Show'])
  })

  it('asks to connect again when the Google secret has changed since', async () => {
    const s = await setup()
    await nissan(s)
    await connectTo(s)
    await s.db.query(`UPDATE calendar_link SET refresh_token = $1`, [seal('an-older-secret', 'refresh-1', 'sub-ops@sessionhire.com')])
    s.google.expireAccess()
    await s.check()
    expect((await feed(s)).link).toMatchObject({ state: 'reconnect', problem: expect.stringContaining("The app's Google key has changed") })
  })

  it('explains a Calendar API that is switched off, and waits for Check the calendar', async () => {
    const s = await setup()
    const job = await nissan(s)
    await connect(s)
    await use(s, TEST_CAL)
    s.google.apiEnabled = false
    await s.sync()
    expect((await feed(s)).link).toMatchObject({ state: 'on', problem: expect.stringContaining('The Google Calendar API is switched off') })

    // Changes don't keep knocking on Google's door.
    const before = s.google.calls.length
    await send(s, 'project.update', { id: job.jobId, notes: 'Changed.' })
    s.app.calendar!.kick()
    await new Promise((r) => setTimeout(r, 50))
    expect(s.google.calls.length).toBe(before)

    s.google.apiEnabled = true
    const res = await s.app.inject({ method: 'POST', url: '/api/calendar/check', cookies: s.colly.cookies })
    expect(res.json()).toEqual({ written: 3, removed: 0, failed: 0 })
    expect((await feed(s)).link!.problem).toBeNull()
  })

  it('explains a calendar that has been unshared', async () => {
    const s = await setup()
    const job = await nissan(s)
    await connectTo(s)
    s.google.unshare('ops@sessionhire.com', TEST_CAL)
    await send(s, 'project.update', { id: job.jobId, name: 'Nissan Leaf' })
    await s.sync()
    expect((await feed(s)).link!.problem).toBe(
      "ops@sessionhire.com can't change Test calendar any more: it may have been deleted, or its sharing changed. Choose another calendar, or give that account permission to change it again."
    )
  })
})

describe('changing calendar and disconnecting', () => {
  it('moves the days to a new calendar, takes them off when disconnecting, and hands the key back', async () => {
    const s = await setup()
    await nissan(s)
    await connectTo(s)
    s.setToday('2030-03-03')
    expect((await use(s, GIGS)).statusCode).toBe(200)
    await s.sync()
    // Yesterday stays where it was.
    expect(titles(s.google, TEST_CAL)).toEqual(['2030-03-02 Nissan - Build 1/2'])
    expect(titles(s.google, GIGS)).toEqual(['2030-03-03 Nissan - Build 2/2', '2030-03-04 Nissan - Show'])

    const off = await s.app.inject({ method: 'POST', url: '/api/calendar/disconnect?client=collylaptop', cookies: s.colly.cookies })
    expect(off.json()).toMatchObject({ state: 'stopping' })
    await s.sync()
    expect(titles(s.google, GIGS)).toEqual([])
    expect(titles(s.google, TEST_CAL)).toEqual(['2030-03-02 Nissan - Build 1/2'])
    expect(s.google.revokedFor('ops@sessionhire.com')).toBe(true)
    const f = await feed(s)
    expect(f.link).toMatchObject({ state: 'off', account: null, calendarId: null, problem: null })
    // Devices still know where yesterday went.
    expect(Object.values(f.days).map((d) => [d.day, d.calendarId])).toEqual([['2030-03-02', TEST_CAL]])

    // All in the history, as Colly's.
    const history = (await s.colly.history()).entries.filter((e: HistoryEntry) => e.command.startsWith('calendar.'))
    expect(history.map((e: HistoryEntry) => [e.who.name, e.what, e.deviceCode])).toEqual([
      ['Colly Hewson', "Disconnected Google Calendar (ops@sessionhire.com), taking the app's days off Session Hire Gigs", 'laptop'],
      ['Colly Hewson', 'Chose Session Hire Gigs as the calendar for jobs', 'laptop'],
      ['Colly Hewson', 'Chose Test calendar as the calendar for jobs', 'laptop'],
      ['Colly Hewson', 'Connected Google Calendar as ops@sessionhire.com', 'laptop'],
    ])
  })

  it('disconnecting when Google no longer accepts the key says what was left behind', async () => {
    const s = await setup()
    await nissan(s)
    await connectTo(s)
    s.google.revokeAll()
    await s.sync()
    await s.app.inject({ method: 'POST', url: '/api/calendar/disconnect', cookies: s.colly.cookies })
    await s.sync()
    expect((await feed(s)).link).toMatchObject({
      state: 'off',
      problem: "3 days were left on Test calendar, because Google no longer accepts the app's access. Delete them in Google Calendar if they aren't wanted.",
    })
    expect(titles(s.google)).toHaveLength(3)

    // Connecting again later picks the same days back up rather than doubling them.
    await connectTo(s)
    expect(titles(s.google)).toHaveLength(3)
    expect([...s.google.events.get(TEST_CAL)!.values()]).toHaveLength(3)
  })
})

describe('running by itself', () => {
  it('a change in the app reaches the calendar a moment later, with nobody asking', async () => {
    const s = await setup({ settleMs: 10 })
    const job = await nissan(s)
    await connectTo(s)
    await send(s, 'project.update', { id: job.jobId, name: 'Nissan Leaf' })
    for (let i = 0; i < 100 && !titles(s.google)[0]?.includes('Leaf'); i++) await new Promise((r) => setTimeout(r, 20))
    expect(titles(s.google)[0]).toBe('2030-03-02 Nissan Leaf - Build 1/2')
  })
})

describe('crew invites (ADR 0009)', () => {
  /** Nissan, with two more audio techs who have email addresses, Niamh and Conor, offered the last place on Build as a shortlist. */
  async function withCrew(s: Setup) {
    const job = await nissan(s)
    const niamh = newId()
    const conor = newId()
    await send(s, 'person.upsert', { id: niamh, name: 'Niamh Kelly', kind: 'freelancer', email: 'niamh@example.com', phone: null, skills: ['audio'], dayRateCents: 25000, notes: '' })
    await send(s, 'person.upsert', { id: conor, name: 'Conor Walsh', kind: 'freelancer', email: 'Conor.Walsh@example.ie', phone: null, skills: ['audio'], dayRateCents: 25000, notes: '' })
    const offers = { ...job.offers, niamh: newId(), conor: newId() }
    await send(s, 'offer.send', { id: offers.niamh, callId: job.callId, personId: niamh, override: false })
    await send(s, 'offer.send', { id: offers.conor, callId: job.callId, personId: conor, override: false })
    return { ...job, people: { niamh, conor }, offers }
  }

  async function invites(s: Setup, on: boolean) {
    const res = await s.app.inject({ method: 'POST', url: '/api/calendar/invites?client=collylaptop', cookies: s.colly.cookies, payload: { on } })
    expect(res.statusCode, res.body).toBe(200)
    return res.json() as CalendarLink
  }

  /** Connected, invites on and sent, and the app has had its first look for answers. */
  async function invited(s: Setup) {
    const job = await withCrew(s)
    await connectTo(s)
    await invites(s, true)
    await s.sync()
    await s.poll()
    const [build1, build2, show] = s.google.visible(TEST_CAL)
    return { ...job, events: { build1: build1!.id, build2: build2!.id, show: show!.id } }
  }

  const emails = (s: Setup, from = 0) => s.google.sent.slice(from).map((m) => `${m.what} ${m.to} ${m.event}`)
  const offer = async (s: Setup, id: string) => (await feed(s)).get<Offer>('offer', id)
  const onCalendar = async (s: Setup, id: string) => {
    const f = await feed(s)
    return offerOnCalendar(f.get<Offer>('offer', id), f.days, TODAY)
  }

  it('starts off, says what it would send, then invites everyone offered or booked, once', async () => {
    const s = await setup()
    const job = await withCrew(s)
    // A job not confirmed yet, with crew asked for it, goes on on hold (1.162.0): its crew are asked for the day as HOLD.
    const pencilled = newId()
    const pencilledCall = newId()
    await send(s, 'project.create', { id: pencilled, name: 'Pencilled', clientId: null, venueId: null, status: 'enquiry', notes: '' })
    const phase = newId()
    await send(s, 'phase.add', { id: phase, projectId: pencilled, name: 'Show', start: '2030-03-05', end: '2030-03-05', venueId: null, notes: '' })
    await send(s, 'call.create', {
      id: pencilledCall,
      projectId: pencilled,
      phaseId: phase,
      project: 'Pencilled',
      phase: 'Show',
      venue: '',
      role: 'LX',
      start: '2030-03-05',
      end: '2030-03-05',
      callTime: null,
      needed: 1,
      dayRateCents: null,
      details: '',
      replyBy: null,
    })
    await send(s, 'offer.send', { id: newId(), callId: pencilledCall, personId: job.people.niamh, override: false })
    await connectTo(s)

    // Off until someone turns it on: nobody is a guest, and nobody has heard from Google.
    expect((await feed(s)).link!.invites).toBe(false)
    expect(s.google.visible(TEST_CAL).flatMap((e) => e.attendees ?? [])).toEqual([])
    const before = await feed(s)
    expect((await s.app.inject({ url: `/f/${before.get<Person>('person', job.people.niamh).linkToken}` })).body).not.toContain('Google Calendar invite for each day')
    const preview = await s.app.inject({ url: '/api/calendar/invites', cookies: s.colly.cookies })
    // Who they'd go to, by name and address, with the days' events, so the office can check before turning invites on.
    const builds = [
      { day: '2030-03-02', title: 'Nissan - Build 1/2' },
      { day: '2030-03-03', title: 'Nissan - Build 2/2' },
    ]
    expect(preview.json()).toEqual({
      on: false,
      invites: 7,
      people: 3,
      noEmail: ['Seán Murphy'],
      guests: [
        { name: 'Aoife Byrne', email: 'aoife@example.com', days: builds },
        { name: 'Conor Walsh', email: 'Conor.Walsh@example.ie', days: builds },
        { name: 'Niamh Kelly', email: 'niamh@example.com', days: [...builds, { day: '2030-03-05', title: 'HOLD Pencilled - Show' }] },
      ],
    })

    expect(await invites(s, true)).toMatchObject({ invites: true })
    await s.sync()
    const [build1, build2, show] = s.google.visible(TEST_CAL)
    const everyone = ['Conor.Walsh@example.ie needsAction', 'aoife@example.com needsAction', 'niamh@example.com needsAction']
    expect(s.google.guests(TEST_CAL, build1!.id).sort()).toEqual(everyone)
    expect(s.google.guests(TEST_CAL, build2!.id).sort()).toEqual(everyone)
    expect(s.google.guests(TEST_CAL, show!.id)).toEqual([])
    // Crew can't see each other's addresses, or invite anyone.
    expect(build1).toMatchObject({ guestsCanSeeOtherGuests: false, guestsCanInviteOthers: false })
    expect(emails(s).sort()).toEqual([
      'invited Conor.Walsh@example.ie 2030-03-02 Nissan - Build 1/2',
      'invited Conor.Walsh@example.ie 2030-03-03 Nissan - Build 2/2',
      'invited aoife@example.com 2030-03-02 Nissan - Build 1/2',
      'invited aoife@example.com 2030-03-03 Nissan - Build 2/2',
      'invited niamh@example.com 2030-03-02 Nissan - Build 1/2',
      'invited niamh@example.com 2030-03-03 Nissan - Build 2/2',
      'invited niamh@example.com 2030-03-05 HOLD Pencilled - Show',
    ])
    const held = s.google.visible(TEST_CAL).find((e) => e.summary === 'HOLD Pencilled - Show')!
    // HOLD is short for "hold the day" (ADR 0150), and the day says so in those words: it is never the job that is "on hold".
    expect(held.description).toMatch(/^HOLD means hold the day: the client hasn't said yes yet, so please keep it free\. Nothing is booked until they do\.\nJob stage: Quoting \(1 of 5\)\n/)
    expect(held.description).not.toMatch(/on hold/i)
    expect(held.description).toContain('LX: TBC')
    // The job page says it's on, as HOLD; a job with nobody asked waits for the yes.
    const onHoldFeed = await feed(s)
    const pencilledJob = onHoldFeed.get<Project>('project', pencilled)
    const pencilledPhase = onHoldFeed.get<Phase>('phase', phase)
    expect(phaseOnCalendar(pencilledJob, pencilledPhase, onHoldFeed.link, onHoldFeed.days, TODAY, true)).toMatchObject({ state: 'on', days: 1 })
    expect(phaseOnCalendar(pencilledJob, pencilledPhase, onHoldFeed.link, onHoldFeed.days, TODAY, false)).toEqual({ state: 'waiting' })

    // Confirmed, the hold comes off: the same event, its title changed, which Google tells the guest about.
    const heldId = held.id
    const told = emails(s).length
    await send(s, 'project.update', { id: pencilled, status: 'confirmed' })
    await s.sync()
    const booked = s.google.visible(TEST_CAL).find((e) => e.id === heldId)!
    expect(booked.summary).toBe('Pencilled - Show')
    expect(booked.description).toMatch(/^Job stage: Planning \(2 of 5\)\n/)
    expect(emails(s).slice(told)).toEqual(['updated niamh@example.com 2030-03-05 Pencilled - Show'])

    // Devices see who is invited and their answers, never their addresses.
    const f = await feed(s)
    // The shared day has no guests: each person is on their own copy of it (1.163.0).
    expect(f.days[calendarDayId(job.phases.build, '2030-03-02')]!.guests).toEqual([])
    const onBuild1 = Object.values(f.days).filter((d) => d.phaseId === job.phases.build && d.day === '2030-03-02').flatMap((d) => d.guests ?? [])
    expect(onBuild1.map((g) => g.offerId).sort()).toEqual([job.offers.aoife, job.offers.conor, job.offers.niamh].sort())
    expect(onBuild1.every((g) => g.response === 'needsAction' && g.problem === null)).toBe(true)
    expect(JSON.stringify(Object.values(f.days))).not.toMatch(/niamh@|aoife@|conor\.walsh@/i)
    expect(offerOnCalendar(f.get<Offer>('offer', job.offers.niamh), f.days, TODAY)).toEqual({
      answers: { '2030-03-02': 'none', '2030-03-03': 'none' },
      line: 'Invited on Google Calendar; no answer yet.',
      warning: null,
    })
    // Seán has no email address, so nothing on Google Calendar for him.
    expect(offerOnCalendar(f.get<Offer>('offer', job.offers.sean), f.days, TODAY)).toBeUndefined()

    // Their own page says the invites come too, from whom, and what to do when Google holds the first one back as from an unknown sender.
    const page = async (id: string) => (await s.app.inject({ url: `/f/${f.get<Person>('person', id).linkToken}` })).body
    const niamhPage = await page(job.people.niamh)
    expect(niamhPage).toContain('We also send a Google Calendar invite for each day to niamh@example.com, from ')
    expect(niamhPage).toContain('unknown sender, press <b>Add to calendar</b>')
    // Seán has no address, so nothing is said.
    expect(await page(f.get<Offer>('offer', job.offers.sean).personId)).not.toContain('Google Calendar invite for each day')

    // All sent, once: running again sends nothing more.
    expect((await s.app.inject({ url: '/api/calendar/invites', cookies: s.colly.cookies })).json()).toEqual({ on: true, invites: 0, people: 0, noEmail: ['Seán Murphy'], guests: [] })
    const sent = s.google.sent.length
    expect(await s.sync()).toEqual({ written: 0, removed: 0, failed: 0 })
    expect(await s.check()).toEqual({ written: 0, removed: 0, failed: 0 })
    expect(s.google.sent.length).toBe(sent)

    const entry = (await s.colly.history()).entries.find((e: HistoryEntry) => e.command === 'calendar.invites')!
    expect([entry.who.name, entry.what, entry.deviceCode]).toEqual(['Colly Hewson', 'Turned on crew invites on Google Calendar (7 invites to 3 people)', 'laptop'])
  })

  it("a device works out who gets an invite by the server's own rule, so the Offer form's promise is what happens (ADR 0149)", async () => {
    // Proves: audit of 12 November 2026, finding 1. The form promised an invite wherever invites were on; none goes for a call that
    // isn't part of a job, a day outside the job's phases, or someone with no address. The rule a device reads
    // (shared/src/reach.ts) is checked here against who the server really made a guest, case by case. A job brought in from a
    // calendar sends each person offered now their own copy (ADR 0157); the offers already on it, below, send none.
    const s = await setup()
    const job = await withCrew(s)
    const orla = newId()
    await send(s, 'person.upsert', { id: orla, name: 'Orla Brennan', kind: 'freelancer', email: 'orla@example.com', phone: null, skills: ['lx'], dayRateCents: 25000, notes: '' })
    const ask = async (over: Partial<CommandInput<'call.create'>>) => {
      const id = newId()
      const offer = newId()
      await send(s, 'call.create', { id, projectId: null, phaseId: null, project: 'A one-off', phase: '', venue: '', role: 'LX', start: '2030-03-04', end: '2030-03-04', callTime: null, needed: 1, dayRateCents: null, details: '', replyBy: null, ...over })
      await send(s, 'offer.send', { id: offer, callId: id, personId: orla, override: false })
      return { call: id, offer }
    }
    // A job that came from a Google calendar keeps the organiser's own events (ADR 0011).
    const theirs = newId()
    const theirShow = newId()
    await send(s, 'project.create', { id: theirs, name: 'Brought in', clientId: null, venueId: null, status: 'confirmed', notes: '' })
    await send(s, 'phase.add', { id: theirShow, projectId: theirs, name: 'Show', start: '2030-03-07', end: '2030-03-07', venueId: null, notes: '' })
    await s.db.query(`UPDATE projects SET source_calendar = 'gigs@sessionhire.com' WHERE id = $1`, [theirs])
    const cases: Record<string, { call: string; offer: string; why: NoInvite | undefined }> = {
      'on the show': { ...(await ask({ projectId: job.jobId, phaseId: job.phases.show, project: 'Nissan', phase: 'Show' })), why: undefined },
      'not part of a job': { ...(await ask({})), why: 'no-job' },
      'outside the phases': { ...(await ask({ projectId: job.jobId, project: 'Nissan', phase: 'Build, Show', start: '2030-03-06', end: '2030-03-06' })), why: 'outside-phases' },
      'brought in': { ...(await ask({ projectId: theirs, phaseId: theirShow, project: 'Brought in', phase: 'Show', start: '2030-03-07', end: '2030-03-07' })), why: undefined },
      'no address': { call: job.callId, offer: job.offers.sean, why: 'no-email' },
      'on the build': { call: job.callId, offer: job.offers.niamh, why: undefined },
    }
    await connectTo(s)
    const sentBefore = s.google.sent.length
    await invites(s, true)
    await s.sync()

    const f = await feed(s)
    const guestBy = new Set(Object.values(f.days).flatMap((d) => d.guests ?? []).map((g) => g.offerId))
    const phases = f.list<Phase>('phase')
    const ctx: ReachContext = {
      calendar: { link: f.link, days: f.days },
      job: (id) => {
        const p = f.get<Project>('project', id)
        // The mark of a brought-in job is the server's own, set here by hand as the import sets it.
        return p && { status: p.status, ...(id === theirs ? { sourceCalendar: 'gigs@sessionhire.com' } : {}), phases: phases.filter((ph) => ph.projectId === id) }
      },
      whatsapp: { mode: 'off', testTo: [] },
      messages: false,
      today: TODAY,
    }
    for (const [name, c] of Object.entries(cases)) {
      const offer = f.get<Offer>('offer', c.offer)
      const plan = invitePlan(ctx, f.get<CrewCall>('crewCall', c.call), f.get<Person>('person', offer.personId), offer.days)
      expect(plan.why, name).toBe(c.why)
      expect(guestBy.has(c.offer), name).toBe(c.why === undefined)
    }
    // Orla was emailed two invites, for the show and the brought-in job's day; her other two offers sent nothing.
    expect(
      emails(s, sentBefore)
        .filter((m) => m.includes('orla@example.com'))
        .sort()
    ).toEqual(['invited orla@example.com 2030-03-04 Nissan - Show', 'invited orla@example.com 2030-03-07 Brought in - Show'])
    // Her page says invites come too, as offers waiting on her have them.
    const page = async (id: string) => (await s.app.inject({ url: `/f/${f.get<Person>('person', id).linkToken}` })).body
    expect(await page(orla)).toContain('We also send a Google Calendar invite for each day to orla@example.com, from ')
    // With those two withdrawn, the two left get none, and the page no longer says they do.
    await send(s, 'offer.cancel', { id: cases['on the show']!.offer })
    await send(s, 'offer.cancel', { id: cases['brought in']!.offer })
    await s.sync()
    const after = await page(orla)
    expect(after).toContain('A one-off')
    expect(after).not.toContain('Google Calendar invite for each day')
  })

  it("a job brought in from Google Calendar sends each person offered now their own invite, and the offers already on it none (ADR 0157)", async () => {
    // Proves: question 3 and the rest of finding 1 of the audit of 12 November 2026. A job brought in from a Google calendar keeps
    // the organiser's event as its day, so nothing the app offered on one reached anybody, though most jobs are such jobs. Now
    // each person offered from now on gets their own copy of each day on the connected account's own calendar, as on the app's
    // own jobs, and the organiser's event is left alone. The offers already there, brought in with the job from the organiser's
    // guests or made while the office was told nothing would be sent, keep none, so deploying this emails nobody. And someone
    // asked again after a No gets a fresh invitation, where before their No stood against the new offer and nothing went.
    const s = await setup()
    await connectTo(s)
    await invites(s, true)
    const job = newId()
    const show = newId()
    await send(s, 'project.create', { id: job, name: 'Castle Yard', clientId: null, venueId: null, status: 'confirmed', notes: '' })
    await send(s, 'phase.add', { id: show, projectId: job, name: 'Show', start: '2030-03-07', end: '2030-03-08', venueId: null, notes: '' })
    // The mark of a brought-in job is the server's own, set here by hand as the import sets it.
    await s.db.query(`UPDATE projects SET source_calendar = $2 WHERE id = $1`, [job, GIGS])
    const call = newId()
    await send(s, 'call.create', {
      id: call,
      projectId: job,
      phaseId: show,
      project: 'Castle Yard',
      phase: 'Show',
      venue: '',
      role: 'Audio tech',
      start: '2030-03-07',
      end: '2030-03-08',
      callTime: '09:00',
      needed: 2,
      dayRateCents: 25000,
      details: '',
      replyBy: null,
    })
    const orla = newId()
    const dara = newId()
    await send(s, 'person.upsert', { id: orla, name: 'Orla Brennan', kind: 'freelancer', email: 'orla@example.com', phone: null, skills: ['audio'], dayRateCents: 25000, notes: '' })
    await send(s, 'person.upsert', { id: dara, name: 'Dara Quinn', kind: 'freelancer', email: 'dara@example.com', phone: null, skills: ['audio'], dayRateCents: 25000, notes: '' })
    // Orla was offered before this was deployed, when the app sent nothing for such a job.
    const earlier = newId()
    await send(s, 'offer.send', { id: earlier, callId: call, personId: orla, override: false })
    // Kieran came in with the job, a guest the organiser invited: the import's own row, which no Offer of the office's made.
    const kieran = newId()
    await send(s, 'person.upsert', { id: kieran, name: 'Kieran Doyle', kind: 'freelancer', email: 'kieran@example.com', phone: null, skills: ['audio'], dayRateCents: 25000, notes: '' })
    const guest = newId()
    await s.db.query(`INSERT INTO offers (id, call_id, person_id, status, days) VALUES ($1, $2, $3, 'offered', $4)`, [guest, call, kieran, JSON.stringify(['2030-03-07', '2030-03-08'])])
    // Deployed: the step that marks the offers already on brought-in jobs runs, as it will on the live database.
    const step = CREW.migrations.findIndex((m) => m.includes('no_own_invite'))
    expect(step).toBeGreaterThan(0)
    await s.db.query('UPDATE crew_schema_version SET version = $1', [step])
    await migrateCrew(s.db)
    const from = s.google.sent.length
    await s.sync()
    expect(emails(s, from)).toEqual([])
    // Each says why it has none, and devices hear of it.
    expect((await offer(s, earlier)).noOwnInvite).toBe('before')
    const { rows: marks } = await s.db.query<{ id: string; no_own_invite: string }>('SELECT id, no_own_invite FROM offers WHERE call_id = $1', [call])
    expect(Object.fromEntries(marks.map((m) => [m.id, m.no_own_invite]))).toEqual({ [earlier]: 'before', [guest]: 'organiser' })

    // Dara, offered now, is emailed an invite for each day: her own copies, on the connected account's own calendar. The jobs
    // calendar has nothing of this job's, and Orla still nothing.
    const now = newId()
    await send(s, 'offer.send', { id: now, callId: call, personId: dara, override: false })
    await s.sync()
    expect(emails(s, from)).toEqual(['invited dara@example.com 2030-03-07 Castle Yard - Show 1/2', 'invited dara@example.com 2030-03-08 Castle Yard - Show 2/2'])
    expect(s.google.visible(TEST_CAL)).toEqual([])
    const copies = () => s.google.visible('ops@sessionhire.com').filter((e) => e.extendedProperties?.private?.shJob === job)
    expect(copies().map((e) => `${e.start.date} ${e.attendees?.filter((a) => !a.organizer).map((a) => `${a.email} ${a.responseStatus}`)}`)).toEqual([
      '2030-03-07 dara@example.com needsAction',
      '2030-03-08 dara@example.com needsAction',
    ])
    expect((await offer(s, now)).noOwnInvite).toBeUndefined()
    expect(await onCalendar(s, now)).toMatchObject({ answers: { '2030-03-07': 'none', '2030-03-08': 'none' } })
    // A device reads the same: Dara's offer has its invites, Orla's none, and a new offer would have them.
    const f = await feed(s)
    const ctx: ReachContext = {
      calendar: { link: f.link, days: f.days },
      job: (id) => (id === job ? { status: 'confirmed', sourceCalendar: GIGS, phases: f.list<Phase>('phase').filter((p) => p.projectId === job) } : undefined),
      whatsapp: { mode: 'off', testTo: [] },
      messages: false,
      today: TODAY,
    }
    const plan = (o: Offer) => invitePlan(ctx, f.get<CrewCall>('crewCall', call), f.get<Person>('person', o.personId), o.days, o)
    expect(plan(f.get<Offer>('offer', earlier)).why).toBe('before')
    expect(plan(f.get<Offer>('offer', now))).toMatchObject({ why: undefined, days: ['2030-03-07', '2030-03-08'] })
    expect(invitePlan(ctx, f.get<CrewCall>('crewCall', call), f.get<Person>('person', orla), ['2030-03-07']).why).toBeUndefined()

    // Dara says No to both days in Google: her copies stay, as her No, and nothing is emailed to her.
    s.later(2)
    for (const c of copies()) s.google.respond('ops@sessionhire.com', c.id, 'dara@example.com', 'declined')
    expect(await s.poll()).toBe(2)
    expect((await offer(s, now)).status).toBe('declined')
    const said = s.google.sent.length
    await s.sync()
    expect(emails(s, said)).toEqual([])
    expect(copies().map((e) => `${e.start.date} ${e.attendees?.filter((a) => !a.organizer).map((a) => `${a.email} ${a.responseStatus}`)}`)).toEqual([
      '2030-03-07 dara@example.com declined',
      '2030-03-08 dara@example.com declined',
    ])

    // Asked again: the copies she turned down come off quietly and a fresh invitation goes for each day, her answer starting again.
    const again = newId()
    await send(s, 'offer.send', { id: again, callId: call, personId: dara, override: false })
    await s.sync()
    expect(emails(s, said)).toEqual(['invited dara@example.com 2030-03-07 Castle Yard - Show 1/2', 'invited dara@example.com 2030-03-08 Castle Yard - Show 2/2'])
    expect(copies().map((e) => `${e.start.date} ${e.attendees?.filter((a) => !a.organizer).map((a) => `${a.email} ${a.responseStatus}`)}`)).toEqual([
      '2030-03-07 dara@example.com needsAction',
      '2030-03-08 dara@example.com needsAction',
    ])
    expect(await onCalendar(s, again)).toMatchObject({ answers: { '2030-03-07': 'none', '2030-03-08': 'none' } })
    // Nothing more when nothing more happens.
    const settled = s.google.sent.length
    await s.check()
    expect(emails(s, settled)).toEqual([])
  })

  it("asked again after a No, a person gets a fresh invitation and their answer starts again (the audit's finding 1)", async () => {
    // Proves: finding 1 of the audit of 12 November 2026, its third case. Someone who said No in Google to every day was offered
    // again: their own copies stayed as they'd left them, declined, nothing was emailed, and the office read their old No against
    // the new offer. Now the copies they turned down come off quietly and new ones go, which Google sends as invitations.
    const s = await setup()
    const job = await invited(s)
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'Conor.Walsh@example.ie', 'declined')
    s.google.respond(TEST_CAL, job.events.build2, 'Conor.Walsh@example.ie', 'declined')
    expect(await s.poll()).toBe(2)
    expect((await offer(s, job.offers.conor)).status).toBe('declined')
    const from = s.google.sent.length
    await s.sync()
    expect(emails(s, from)).toEqual([])

    const again = newId()
    await send(s, 'offer.send', { id: again, callId: job.callId, personId: job.people.conor, override: false })
    await s.sync()
    expect(emails(s, from)).toEqual(['invited Conor.Walsh@example.ie 2030-03-02 Nissan - Build 1/2', 'invited Conor.Walsh@example.ie 2030-03-03 Nissan - Build 2/2'])
    expect(s.google.guests(TEST_CAL, job.events.build1)).toContain('Conor.Walsh@example.ie needsAction')
    expect(s.google.guests(TEST_CAL, job.events.build1)).not.toContain('Conor.Walsh@example.ie declined')
    expect(await onCalendar(s, again)).toMatchObject({ answers: { '2030-03-02': 'none', '2030-03-03': 'none' } })
    // His Yes now counts for the new offer.
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'Conor.Walsh@example.ie', 'accepted')
    s.google.respond(TEST_CAL, job.events.build2, 'Conor.Walsh@example.ie', 'accepted')
    expect(await s.poll()).toBe(2)
    expect((await offer(s, again)).status).toBe('accepted')
  })

  it('sends nothing for half a minute after Offer, and nothing at all for an offer undone meanwhile (ADR 0161)', async () => {
    // Proves: finding 13 of the audit of 12 November 2026. An offer is on the calendar only once its wait for Undo is over, so a
    // wrong pick taken back is never emailed an invite, nor a cancellation for one; and a job not confirmed yet, asked for only by
    // an offer still waiting, isn't put on the calendar as HOLD until then.
    const s = await setup()
    const job = await invited(s)
    const dara = newId()
    const orla = newId()
    await send(s, 'person.upsert', { id: dara, name: 'Dara Quinn', kind: 'freelancer', email: 'dara@example.com', phone: null, skills: ['audio'], dayRateCents: 25000, notes: '' })
    await send(s, 'person.upsert', { id: orla, name: 'Orla Byrne', kind: 'freelancer', email: 'orla@example.com', phone: null, skills: ['lx'], dayRateCents: 25000, notes: '' })
    const pencilled = newId()
    const show = newId()
    const lx = newId()
    await send(s, 'project.create', { id: pencilled, name: 'Pencilled', clientId: null, venueId: null, status: 'enquiry', notes: '' })
    await send(s, 'phase.add', { id: show, projectId: pencilled, name: 'Show', start: '2030-03-05', end: '2030-03-05', venueId: null, notes: '' })
    await send(s, 'call.create', { id: lx, projectId: pencilled, phaseId: show, project: 'Pencilled', phase: 'Show', venue: '', role: 'LX', start: '2030-03-05', end: '2030-03-05', callTime: null, needed: 1, dayRateCents: null, details: '', replyBy: null })
    await s.sync()
    const from = s.google.sent.length
    const before = titles(s.google)

    // Offered, as the office presses Offer: nothing goes while each waits.
    const wrong = newId()
    const kept = newId()
    expect((await s.colly.send('offer.send', { id: wrong, callId: job.callId, personId: dara, override: false })).status).toBe('applied')
    expect((await s.colly.send('offer.send', { id: kept, callId: lx, personId: orla, override: false })).status).toBe('applied')
    await s.sync()
    expect(emails(s, from)).toEqual([])
    expect(titles(s.google)).toEqual(before)
    expect(s.google.guests(TEST_CAL, job.events.build1).join()).not.toContain('dara@example.com')

    // Dara was the wrong pick: undone, his offer is gone, and nothing ever goes to him.
    expect((await s.colly.send('offer.undo', { id: wrong })).status).toBe('applied')
    expect(await offer(s, wrong)).toBeUndefined()
    await waitOver(s, kept)
    await s.sync()
    expect(emails(s, from)).toEqual(['invited orla@example.com 2030-03-05 HOLD Pencilled - Show'])
    expect(titles(s.google)).toEqual([...before, '2030-03-05 HOLD Pencilled - Show'].sort())
    expect(s.google.guests(TEST_CAL, job.events.build1).join()).not.toContain('dara@example.com')
    // Too late for Undo once it has gone: withdrawing it is the way, which tells her.
    const late = await s.colly.send('offer.undo', { id: kept })
    expect(late).toMatchObject({ status: 'rejected', reason: { code: 'conflict', message: 'The offer has already gone to Orla Byrne, so it can\'t be undone. Withdraw it instead.' } })
    const history = await s.app.inject({ url: '/api/history', cookies: s.colly.cookies })
    expect(history.json().entries.map((e: { what: string }) => e.what)).toContain('Took back the offer of Audio tech on Nissan to Dara Quinn before it went')
  })

  it('needs a calendar to turn on, and a plain yes or no', async () => {
    const s = await setup()
    const early = await s.app.inject({ method: 'POST', url: '/api/calendar/invites', cookies: s.colly.cookies, payload: { on: true } })
    expect(early.statusCode).toBe(409)
    expect(early.json().error).toBe('Choose a calendar for jobs first.')
    await connectTo(s)
    const vague = await s.app.inject({ method: 'POST', url: '/api/calendar/invites', cookies: s.colly.cookies, payload: { on: 'yes' } })
    expect(vague.statusCode).toBe(400)
    for (const method of ['GET', 'POST'] as const) expect((await s.app.inject({ method, url: '/api/calendar/invites' })).statusCode).toBe(401)
  })

  it('a Yes in Google counts for the day it was pressed on, and the days it left unanswered are still asked (ADR 0152)', async () => {
    // Proves: finding 3 of the audit of 12 November 2026. A Yes on one day's invite was taken for every day of the call, and the
    // other days' invites then thanked the person for a yes they hadn't given. Now each day's Yes is that day's: the others stay
    // asked, on their link and in their own invites, until they answer them or the office confirms what they said yes to.
    const s = await setup()
    const job = await invited(s)
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'niamh@example.com', 'accepted', 'Can bring the van.')
    expect(await s.poll()).toBe(1)

    // Saturday is hers, with what she wrote in Google as her note; Sunday is still asked of her.
    expect(await offer(s, job.offers.niamh)).toMatchObject({
      status: 'accepted',
      days: ['2030-03-02'],
      asked: ['2030-03-03'],
      respondedVia: 'calendar',
      note: 'Can bring the van.',
    })
    // Saturday is full now and Sunday isn't, so Conor's offer stands, for Sunday.
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'offered' })
    expect(await onCalendar(s, job.offers.niamh)).toMatchObject({ line: 'On Google Calendar: yes to Sat 2 Mar; no answer yet for Sun 3 Mar.', warning: null })

    // In the history as Niamh's own answer, on Google Calendar, with the day she hasn't answered.
    const entry = (await s.colly.history()).entries[0]!
    expect(entry).toMatchObject({ who: { kind: 'calendar', name: 'Niamh Kelly', key: `link:${job.people.niamh}` }, outcome: 'done' })
    expect(entry.what).toBe('Niamh Kelly accepted Audio tech on Nissan, Sat 2 Mar; no answer yet for Sun 3 Mar')
    expect(entry.deviceCode).toBeUndefined()
    const hers = await s.colly.history(`?who=link:${job.people.niamh}`)
    expect(hers.entries.map((e: HistoryEntry) => e.what)).toEqual(['Niamh Kelly accepted Audio tech on Nissan, Sat 2 Mar; no answer yet for Sun 3 Mar'])
    expect((await s.colly.history()).people).toContainEqual({ key: `link:${job.people.niamh}`, name: 'Niamh Kelly' })

    // Her page asks about Sunday in its own words.
    const f = await feed(s)
    const page = (await s.app.inject({ url: `/f/${f.get<Person>('person', job.people.niamh).linkToken}` })).body
    expect(page.replace(/\u00a0/g, ' ')).toContain("You haven't answered for Sun 3 Mar 2030 yet. Tick it if you can do it, or leave it unticked, and press Update my days.")

    // Next run: her Saturday thanks her and fills in with the day's sheet; her Sunday still asks, in short. Nobody is emailed.
    const before = s.google.sent.length
    await s.sync()
    expect(s.google.visible(TEST_CAL)[0]!.description).toContain('Audio tech, call 08:00: Aoife Byrne, 2 TBC')
    expect(s.google.guests(TEST_CAL, job.events.build1).sort()).toEqual(['Conor.Walsh@example.ie needsAction', 'aoife@example.com needsAction', 'niamh@example.com accepted'])
    const copy = (event: string, email: string) => s.google.copies(TEST_CAL, event).find((e) => e.attendees?.some((g) => g.email === email))!.description!
    expect(copy(job.events.build1, 'niamh@example.com')).toMatch(/^Thanks Niamh, you said yes to Audio tech on Sat 2 Mar, call 08:00\. We'll confirm it with you soon\./)
    expect(copy(job.events.build1, 'niamh@example.com')).not.toContain(SHEET_LATER)
    expect(copy(job.events.build2, 'niamh@example.com')).toMatch(/^Hi Niamh, are you available to work as Audio tech on Sun 3 Mar, call 08:00\? Press Yes or No/)
    expect(copy(job.events.build2, 'niamh@example.com')).toContain(SHEET_LATER)
    expect(emails(s, before)).toEqual([])

    // A Yes to Sunday later takes it too. The call is full then: Conor's offer closes, and Google tells him.
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build2, 'niamh@example.com', 'accepted')
    expect(await s.poll()).toBe(1)
    const both = await offer(s, job.offers.niamh)
    expect(both).toMatchObject({ status: 'accepted', days: ['2030-03-02', '2030-03-03'] })
    expect(both.asked).toBeUndefined()
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'filled' })
    await s.sync()
    expect(copy(job.events.build2, 'niamh@example.com')).toMatch(/^Thanks Niamh, you said yes to Audio tech on Sun 3 Mar/)
    expect(emails(s, before)).toEqual([
      'cancelled Conor.Walsh@example.ie 2030-03-02 Nissan - Build 1/2',
      'cancelled Conor.Walsh@example.ie 2030-03-03 Nissan - Build 2/2',
    ])
  })

  it('confirming a Yes with a day still asked books the day they said yes to, and Google tells them the other is off, as the question said', async () => {
    const s = await setup()
    const job = await invited(s)
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'niamh@example.com', 'accepted')
    expect(await s.poll()).toBe(1)
    await s.sync()

    // What the question before Confirm says, worked out on a device from what it holds.
    const f = await feed(s)
    const reach = { calendar: { link: f.link, days: f.days }, today: TODAY }
    expect(askEndingWords(reach, job.offers.niamh, ['2030-03-03'])).toBe('Google emails them that Sun 3 Mar is cancelled.')

    const before = s.google.sent.length
    await send(s, 'offer.confirm', { id: job.offers.niamh })
    const booked = await offer(s, job.offers.niamh)
    expect(booked).toMatchObject({ status: 'confirmed', days: ['2030-03-02'] })
    expect(booked.asked).toBeUndefined()
    await s.sync()
    // Saturday's invite says she's booked, quietly; Sunday's comes off with word from Google, as promised.
    const copy = (event: string) => s.google.copies(TEST_CAL, event).find((e) => e.attendees?.some((g) => g.email === 'niamh@example.com'))
    expect(copy(job.events.build1)!.description).toMatch(/^Hi Niamh, you're booked as Audio tech on Sat 2 Mar/)
    expect(copy(job.events.build2)).toBeUndefined()
    expect(emails(s, before)).toEqual(['cancelled niamh@example.com 2030-03-03 Nissan - Build 2/2'])
    expect((await s.colly.history()).entries[0]!.what).toBe('Confirmed Niamh Kelly for Audio tech on Nissan')
  })

  it("writes each person's own invite from that day's answer: a Yes the app couldn't take says why, and a No stands, with no email", async () => {
    // Proves: the second half of finding 16 of the audit of 12 November 2026 (ADR 0152). A Yes pressed on a day that had filled
    // left the invite saying yes, and its person believing the day was theirs; only the office was told.
    const s = await setup()
    const job = await invited(s)
    // Conor takes Saturday's last place in Google; Niamh presses Yes on Saturday a moment later, and No on Sunday.
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'Conor.Walsh@example.ie', 'accepted')
    expect(await s.poll()).toBe(1)
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'niamh@example.com', 'accepted')
    expect(await s.poll()).toBe(1)
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'offered' })
    expect(await onCalendar(s, job.offers.niamh)).toMatchObject({
      warning: "Said yes on Google Calendar, but the app couldn't take it: Sat 2 Mar has just been filled. Still open: Sun 3 Mar.",
    })
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build2, 'niamh@example.com', 'declined')
    expect(await s.poll()).toBe(1)

    const before = s.google.sent.length
    await s.sync()
    const lead = (event: string) => s.google.copies(TEST_CAL, event).find((e) => e.attendees?.some((g) => g.email === 'niamh@example.com'))!.description!.split('\n')[0]
    expect(lead(job.events.build1)).toBe("Thanks Niamh, but we couldn't take your yes. Sat 2 Mar has just been filled. Still open: Sun 3 Mar.")
    expect(lead(job.events.build2)).toBe('Thanks Niamh, you said no to Sun 3 Mar. If that changes, press Yes on this invite.')
    // Conor's Sunday is still asked of him, in its own words.
    const conors = s.google.copies(TEST_CAL, job.events.build2).find((e) => e.attendees?.some((g) => g.email === 'Conor.Walsh@example.ie'))!.description!
    expect(conors.split('\n')[0]).toBe('Hi Conor, are you available to work as Audio tech on Sun 3 Mar, call 08:00? Press Yes or No on this invite to let us know.')
    expect(emails(s, before)).toEqual([])

    // She changes her mind about Sunday: a Yes there is taken, and the call is full.
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build2, 'niamh@example.com', 'accepted')
    expect(await s.poll()).toBe(1)
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'accepted', days: ['2030-03-03'] })
    const after = s.google.sent.length
    await s.sync()
    expect(lead(job.events.build2)).toMatch(/^Thanks Niamh, you said yes to Audio tech on Sun 3 Mar/)
    // With the call full, the days nobody is asked about any more come off, with word from Google: her Saturday, his Sunday.
    expect(emails(s, after).sort()).toEqual(['cancelled Conor.Walsh@example.ie 2030-03-03 Nissan - Build 2/2', 'cancelled niamh@example.com 2030-03-02 Nissan - Build 1/2'])
  })

  it('leaves a Yes after asking for a different rate to the office, and saying no to the rate keeps the offer, said on the invite with no email', async () => {
    // Proves: question 6 of the audit of 12 November 2026 (ADR 0152). Saying no to a rate asked for keeps the offer at the rate
    // offered, for the days it was asked for; withdrawing it is its own choice. A Yes pressed in Google meanwhile settles nothing.
    const s = await setup()
    const job = await invited(s)
    await send(s, 'offer.respond', { id: job.offers.conor, answer: 'counter', counterRateCents: 30000, days: null, note: '' })
    await s.sync()
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'Conor.Walsh@example.ie', 'accepted')
    expect(await s.poll()).toBe(1)
    // His rate is with the office: the Yes changes nothing, and the job page says to ring him.
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'countered', counterRateCents: 30000, days: ['2030-03-02', '2030-03-03'] })
    expect((await onCalendar(s, job.offers.conor))!.warning).toBe(COUNTERED_YES)

    // The office says no to the rate: the offer stands at the rate offered, with the rate he asked for kept.
    const before = s.google.sent.length
    await send(s, 'offer.refuse', { id: job.offers.conor })
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'offered', days: ['2030-03-02', '2030-03-03'], counterRateCents: 30000, dayRateCents: 25000 })
    expect((await s.colly.history()).entries[0]!.what).toBe('Said no to the rate Conor Walsh asked for Audio tech on Nissan: the offer stands at the rate offered')
    expect((await onCalendar(s, job.offers.conor))!.warning).toBe(YES_WHILE_ASKING)
    await s.sync()
    const lead = (event: string) => s.google.copies(TEST_CAL, event).find((e) => e.attendees?.some((g) => g.email === 'Conor.Walsh@example.ie'))!.description!.split('\n')[0]
    // Saturday, where his Yes from before still stands in Google: pressing it again would do nothing, so his page takes the yes.
    const saturday = "Hi Conor, we can't agree the rate you asked for, but the offer stands: if you can work as Audio tech on Sat 2 Mar, call 08:00 at the rate offered, say yes on your page."
    expect(lead(job.events.build1)).toBe(saturday)
    expect(lead(job.events.build2)).toBe("Hi Conor, we can't agree the rate you asked for, but the offer stands: are you available to work as Audio tech on Sun 3 Mar, call 08:00? Press Yes or No on this invite to let us know.")
    expect(emails(s, before)).toEqual([])
    // His page says it with the figures.
    const f = await feed(s)
    const page = (await s.app.inject({ url: `/f/${f.get<Person>('person', job.people.conor).linkToken}` })).body
    expect(page.replace(/\u00a0/g, ' ')).toContain("The office can't do €300 a day, so the offer stands at €250 a day.")

    // A Yes in Google now is a yes at the rate offered, for the day it's pressed on; Saturday's from before stays asked.
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build2, 'Conor.Walsh@example.ie', 'accepted')
    expect(await s.poll()).toBe(1)
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'accepted', days: ['2030-03-03'], asked: ['2030-03-02'], counterRateCents: null, dayRateCents: 25000 })
    await s.sync()
    expect(lead(job.events.build1)).toBe(saturday)
    expect(emails(s, before)).toEqual([])
  })

  it("a Yes on one of a day's two invites is no answer yet, and that invite asks as before, naming no rate (ADR 0152)", async () => {
    // A call for the whole job covers each of its phases on a day that has two, so its person has two invites that day, and a
    // day's Yes needs a Yes on both (dayAnswer). A Yes on one that the offer doesn't follow isn't one pressed while asking for
    // a different rate, so it mustn't read as one.
    const s = await setup()
    const job = await withCrew(s)
    const rehearsal = newId()
    const callId = newId()
    const conors = newId()
    await send(s, 'phase.add', { id: rehearsal, projectId: job.jobId, name: 'Rehearsal', start: '2030-03-04', end: '2030-03-04', venueId: null, notes: '' })
    await send(s, 'call.create', { id: callId, projectId: job.jobId, phaseId: null, project: 'Nissan', phase: '', venue: '', role: 'LX', start: '2030-03-04', end: '2030-03-04', callTime: null, needed: 1, dayRateCents: 25000, details: '', replyBy: null })
    await send(s, 'offer.send', { id: conors, callId, personId: job.people.conor, override: false })
    await connectTo(s)
    await invites(s, true)
    await s.sync()
    await s.poll()
    const monday = s.google.visible(TEST_CAL).filter((e) => e.start.date === '2030-03-04')
    expect(monday).toHaveLength(2)
    const mine = (event: string) => s.google.copies(TEST_CAL, event).find((e) => e.attendees?.some((g) => g.email === 'Conor.Walsh@example.ie'))!
    const asks = 'Hi Conor, are you available to work as LX on Mon 4 Mar? Press Yes or No on this invite to let us know.'
    expect(monday.map((e) => mine(e.id).description!.split('\n')[0])).toEqual([asks, asks])

    s.later(2)
    s.google.respond(TEST_CAL, monday[0]!.id, 'Conor.Walsh@example.ie', 'accepted')
    await s.poll()
    expect(await offer(s, conors)).toMatchObject({ status: 'offered', days: ['2030-03-04'] })
    await s.sync()
    expect(monday.map((e) => mine(e.id).description!.split('\n')[0])).toEqual([asks, asks])
    expect((await onCalendar(s, conors))!.warning).toBeNull()

    // A Yes on the other is the day's: taken.
    s.later(2)
    s.google.respond(TEST_CAL, monday[1]!.id, 'Conor.Walsh@example.ie', 'accepted')
    await s.poll()
    expect(await offer(s, conors)).toMatchObject({ status: 'accepted', days: ['2030-03-04'] })
  })

  it('a No to some days leaves them out, and they stay on those days as a No', async () => {
    const s = await setup()
    const job = await invited(s)
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'Conor.Walsh@example.ie', 'accepted')
    s.google.respond(TEST_CAL, job.events.build2, 'conor.walsh@example.ie', 'declined')
    expect(await s.poll()).toBe(2)
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'accepted', days: ['2030-03-02'] })
    expect(await onCalendar(s, job.offers.conor)).toMatchObject({ line: 'On Google Calendar: yes to Sat 2 Mar; no to Sun 3 Mar.', warning: null })

    // Sunday's place is still open, so Niamh's offer stands; nobody is told anything, Conor included.
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'offered' })
    const before = s.google.sent.length
    await s.sync()
    expect(s.google.guests(TEST_CAL, job.events.build2).sort()).toEqual(['Conor.Walsh@example.ie declined', 'aoife@example.com needsAction', 'niamh@example.com needsAction'])
    expect(emails(s, before)).toEqual([])

    // Niamh takes Sunday on her link, saying no to Saturday there: she comes off Saturday.
    await send(s, 'offer.respond', { id: job.offers.niamh, answer: 'accept', days: ['2030-03-03'], note: '' })
    await s.sync()
    expect(s.google.guests(TEST_CAL, job.events.build1).sort()).toEqual(['Conor.Walsh@example.ie accepted', 'aoife@example.com needsAction'])
    expect(emails(s, before)).toEqual(['cancelled niamh@example.com 2030-03-02 Nissan - Build 1/2'])

    // Conor changes his mind about Sunday, but it has gone: the job page says why, and his offer is as it was.
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build2, 'Conor.Walsh@example.ie', 'accepted')
    expect(await s.poll()).toBe(1)
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'accepted', days: ['2030-03-02'] })
    expect(await onCalendar(s, job.offers.conor)).toEqual({
      answers: { '2030-03-02': 'yes', '2030-03-03': 'yes' },
      line: 'Said yes on Google Calendar.',
      // "Still open" is what he could still take: Saturday is his already.
      warning: "Said yes on Google Calendar, but the app couldn't take it: Sun 3 Mar has just been filled.",
    })
    const entry = (await s.colly.history()).entries[0]!
    expect(entry).toMatchObject({ who: { kind: 'calendar', name: 'Conor Walsh' }, outcome: 'turned-down' })
  })

  it("Maybe isn't an answer yet, and a No to every day declines", async () => {
    const s = await setup()
    const job = await invited(s)
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'niamh@example.com', 'tentative')
    s.google.respond(TEST_CAL, job.events.build1, 'Conor.Walsh@example.ie', 'declined')
    s.google.respond(TEST_CAL, job.events.build2, 'Conor.Walsh@example.ie', 'declined')
    expect(await s.poll()).toBe(3)
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'offered', respondedVia: null })
    expect(await onCalendar(s, job.offers.niamh)).toMatchObject({ line: 'On Google Calendar: maybe to Sat 2 Mar; no answer yet for Sun 3 Mar.' })
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'declined', respondedVia: 'calendar' })
    expect(await onCalendar(s, job.offers.conor)).toMatchObject({ line: 'Said no on Google Calendar.', warning: null })
    expect((await s.colly.history()).entries[0]!.what).toBe('Conor Walsh declined Audio tech on Nissan')

    // Conor stays on as a No: no cancellation for something he turned down.
    const before = s.google.sent.length
    await s.sync()
    expect(s.google.guests(TEST_CAL, job.events.build1)).toContain('Conor.Walsh@example.ie declined')
    expect(emails(s, before)).toEqual([])
  })

  it("a No from someone booked doesn't unbook them, but the job page says so", async () => {
    const s = await setup()
    const job = await invited(s)
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build2, 'aoife@example.com', 'declined')
    expect(await s.poll()).toBe(1)
    expect(await offer(s, job.offers.aoife)).toMatchObject({ status: 'confirmed', days: ['2030-03-02', '2030-03-03'] })
    expect(await onCalendar(s, job.offers.aoife)).toMatchObject({
      warning: 'Said no to Sun 3 Mar on Google Calendar, but is booked for it. Call them to sort it out.',
    })
    // Nothing done for her: the office decides.
    expect((await s.colly.history()).entries.filter((e: HistoryEntry) => e.who.kind === 'calendar')).toEqual([])
  })

  it('looks for answers without waking the database until one has changed', async () => {
    const s = await setup()
    const job = await invited(s)
    const quiet = async () => {
      const before = s.queries.count
      s.later(2)
      expect(await s.poll()).toBe(0)
      return s.queries.count - before
    }
    expect(await quiet()).toBe(0)
    // Changes in Google that aren't answers from the app's guests.
    s.google.edit(TEST_CAL, job.events.show, { description: 'Edited by hand.' })
    s.google.setGuest(TEST_CAL, job.events.build1, 'mary@nissan.example', true)
    s.google.respond(TEST_CAL, job.events.build1, 'mary@nissan.example', 'accepted')
    expect(await quiet()).toBe(0)
    // An answer does.
    s.google.respond(TEST_CAL, job.events.build2, 'niamh@example.com', 'tentative')
    const before = s.queries.count
    expect(await s.poll()).toBe(1)
    expect(s.queries.count).toBeGreaterThan(before)
    expect(await quiet()).toBe(0)

    // After the first look, Google is asked only about events changed since the last, with a few minutes to spare.
    // Each look asks about both calendars: the jobs calendar and the account's own, where everyone's copies are.
    const [first, second, ...rest] = s.google.lists
    expect([first!.get('timeMin'), second!.get('timeMin')]).toEqual(['2030-03-01T00:00:00.000Z', '2030-03-01T00:00:00.000Z'])
    expect(rest.map((q) => [q.get('timeMin'), q.get('updatedMin')])).toEqual(
      ['2030-03-02T09:55:00.000Z', '2030-03-02T09:57:00.000Z', '2030-03-02T09:59:00.000Z', '2030-03-02T09:59:00.000Z'].flatMap((t) => [
        [null, t],
        [null, t],
      ])
    )
  })

  it('looks for answers on its own while invites are on, and stops looking when they go off', async () => {
    const s = await setup({ pollMs: 20 })
    const job = await withCrew(s)
    await connectTo(s)
    const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
    await pause(100)
    expect(s.google.lists).toEqual([])

    await invites(s, true)
    for (let i = 0; i < 100 && s.google.sent.length === 0; i++) await pause(20)
    const [build1, build2] = s.google.visible(TEST_CAL)
    s.google.respond(TEST_CAL, build1!.id, 'niamh@example.com', 'accepted')
    // Nobody in the app does anything: the next look finds her answer.
    for (let i = 0; i < 100 && (await offer(s, job.offers.niamh)).status !== 'accepted'; i++) await pause(20)
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'accepted', respondedVia: 'calendar' })

    await invites(s, false)
    await pause(60)
    const looks = s.google.lists.length
    s.google.respond(TEST_CAL, build2!.id, 'niamh@example.com', 'declined')
    await pause(100)
    expect(s.google.lists.length).toBe(looks)
    // Her Yes was to Saturday (ADR 0152); her No to Sunday, given with invites off, isn't read.
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'accepted', days: ['2030-03-02'], asked: ['2030-03-03'] })
  })

  it('takes each answer once when two servers look at the same time, as during a deploy', async () => {
    const s = await setup()
    const job = await invited(s)
    // The next version of the server starting up alongside, on the same database and calendar.
    const next = await buildApp({
      db: s.db,
      auth: { provider: {} as IdentityProvider, domains: ['sessionhire.com'], emails: [] },
      calendar: { clientId: s.google.clientId, clientSecret: s.google.clientSecret, fetch: s.google.fetch, gapMs: 0, settleMs: 3_600_000, pollMs: 0, now: s.clock },
    })
    cleanup.push(() => next.close())
    await next.calendar!.start()
    expect(await next.calendar!.poll()).toBe(0)

    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'niamh@example.com', 'accepted')
    s.google.respond(TEST_CAL, job.events.build2, 'Conor.Walsh@example.ie', 'declined')
    const [here, there] = await Promise.all([s.poll(), next.calendar!.poll()])
    expect(here + there).toBe(2)
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'accepted', days: ['2030-03-02'], asked: ['2030-03-03'] })
    // Conor's No to Sunday alone isn't an answer to the offer, and Sunday still has a place: his offer stands.
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'offered' })
    const answers = (await s.colly.history()).entries.filter((e: HistoryEntry) => e.who.kind === 'calendar')
    expect(answers.map((e: HistoryEntry) => e.what)).toEqual(['Niamh Kelly accepted Audio tech on Nissan, Sat 2 Mar; no answer yet for Sun 3 Mar'])
  })

  it('keeps guests added by hand in Google, with invites on or off, and tells guests only what matters', async () => {
    const s = await setup()
    const job = await withCrew(s)
    await connectTo(s)
    const [build1] = s.google.visible(TEST_CAL)
    s.google.setGuest(TEST_CAL, build1!.id, 'mary@nissan.example', true)

    // Off: the app's changes keep Mary on, and tell nobody.
    await send(s, 'project.update', { id: job.jobId, notes: 'Launch of the new Leaf. Press at 11.' })
    await s.sync()
    expect(s.google.guests(TEST_CAL, build1!.id)).toEqual(['mary@nissan.example needsAction'])
    expect(emails(s)).toEqual([])

    // On: crew join her, and only crew are invited.
    await invites(s, true)
    await s.sync()
    expect(s.google.guests(TEST_CAL, build1!.id).sort()).toEqual([
      'Conor.Walsh@example.ie needsAction',
      'aoife@example.com needsAction',
      'mary@nissan.example needsAction',
      'niamh@example.com needsAction',
    ])
    expect(emails(s).filter((m) => m.includes('mary'))).toEqual([])

    // Notes change often: nobody hears about them.
    let before = s.google.sent.length
    await send(s, 'phase.update', { id: job.phases.build, notes: 'Bring the long ladder.' })
    await s.sync()
    expect(emails(s, before)).toEqual([])

    // A new name is news for everyone on the event, Mary too.
    before = s.google.sent.length
    await send(s, 'project.update', { id: job.jobId, name: 'Nissan Leaf' })
    await s.sync()
    expect(emails(s, before).filter((m) => m.includes('Build 1/2')).sort()).toEqual([
      'updated Conor.Walsh@example.ie 2030-03-02 Nissan Leaf - Build 1/2',
      'updated aoife@example.com 2030-03-02 Nissan Leaf - Build 1/2',
      'updated mary@nissan.example 2030-03-02 Nissan Leaf - Build 1/2',
      'updated niamh@example.com 2030-03-02 Nissan Leaf - Build 1/2',
    ])

    // Cancelled: everyone is told.
    before = s.google.sent.length
    await send(s, 'project.update', { id: job.jobId, status: 'cancelled' })
    await s.sync()
    expect(emails(s, before).filter((m) => m.includes('Build 1/2')).sort()).toEqual([
      'cancelled Conor.Walsh@example.ie 2030-03-02 Nissan Leaf - Build 1/2',
      'cancelled aoife@example.com 2030-03-02 Nissan Leaf - Build 1/2',
      'cancelled mary@nissan.example 2030-03-02 Nissan Leaf - Build 1/2',
      'cancelled niamh@example.com 2030-03-02 Nissan Leaf - Build 1/2',
    ])
  })

  it("opens a person's own copy with where they stand, by the name they go by, and their page second", async () => {
    // Proves: findings 6, 7, 10 and 15 of the audit of 12 November 2026 (ADR 0150). A person's own copy of a day greets them by the
    // name they go by; while the client hasn't said yes it asks them to hold the day and never says "booked"; a rate they asked
    // for has words of its own; and the way to their page is the second line, not the last. None of it is emailed, as it is all
    // description.
    const s = await setup()
    const job = await withCrew(s)
    // Niamh goes by Nim, and Dara is staff.
    await send(s, 'person.upsert', { id: job.people.niamh, name: 'Niamh Kelly', knownAs: 'Nim', kind: 'freelancer', email: 'niamh@example.com', phone: null, skills: ['audio'], dayRateCents: 25000, notes: '' })
    const dara = newId()
    await send(s, 'person.upsert', { id: dara, name: 'Dara Kelly', kind: 'staff', email: 'dara@sessionhire.com', phone: null, skills: ['lighting'], dayRateCents: null, notes: '' })
    // A job the client hasn't said yes to: one show day, an answer wanted two days before.
    const quoted = newId()
    const phase = newId()
    const call = newId()
    await send(s, 'project.create', { id: quoted, name: 'Harbour Lights', clientId: null, venueId: null, status: 'quoted', notes: '' })
    await send(s, 'phase.add', { id: phase, projectId: quoted, name: 'Show', start: '2030-03-06', end: '2030-03-06', venueId: null, notes: '' })
    await send(s, 'call.create', {
      id: call,
      projectId: quoted,
      phaseId: phase,
      project: 'Harbour Lights',
      phase: 'Show',
      venue: '',
      role: 'LX',
      start: '2030-03-06',
      end: '2030-03-06',
      callTime: '09:00',
      needed: 4,
      dayRateCents: 30000,
      details: '',
      replyBy: '2030-03-04',
    })
    const asked = { niamh: newId(), conor: newId(), dara: newId() }
    await send(s, 'offer.send', { id: asked.niamh, callId: call, personId: job.people.niamh, override: false })
    await send(s, 'offer.send', { id: asked.conor, callId: call, personId: job.people.conor, override: false })
    await send(s, 'offer.send', { id: asked.dara, callId: call, personId: dara, override: false })
    await connectTo(s)
    await invites(s, true)
    await s.sync()

    const f = await feed(s)
    const link = (personId: string) => `http://localhost:80/f/${f.get<Person>('person', personId).linkToken}`
    /** What a person's own copy of a day says, as they'd read it in Google Calendar. */
    const copy = (summary: string, email: string) => {
      const shared = s.google.visible(TEST_CAL).find((e) => e.summary === summary)!
      return s.google.copies(TEST_CAL, shared.id).find((e) => e.attendees?.some((g) => g.email === email))!
    }
    const lines = (summary: string, email: string) => copy(summary, email).description!.split('\n')
    const aoifeId = f.get<Offer>('offer', job.offers.aoife).personId

    // A confirmed job, as before: asked, or told they're booked, by the name they go by. Their page comes second.
    expect(lines('Nissan - Build 1/2', 'niamh@example.com').slice(0, 4)).toEqual([
      'Hi Nim, are you available to work as Audio tech on Sat 2 Mar, call 08:00? Press Yes or No on this invite to let us know.',
      `Your rate and the details are on your page, where you can answer too: ${link(job.people.niamh)}`,
      '',
      'Job stage: On the job (4 of 5)',
    ])
    expect(lines('Nissan - Build 1/2', 'aoife@example.com').slice(0, 3)).toEqual([
      "Hi Aoife, you're booked as Audio tech on Sat 2 Mar, call 08:00. Here's the info for the day.",
      `Your rate, the call sheet and the details are on your page: ${link(aoifeId)}`,
      '',
    ])
    // The link is said once, at the top: the job's own link, which a freelancer can't open, isn't on their copy at all.
    for (const email of ['niamh@example.com', 'aoife@example.com']) {
      const text = copy('Nissan - Build 1/2', email).description!
      expect(text.match(/http:\/\/localhost:80\//g)).toHaveLength(1)
      expect(text).not.toContain('#jobs/')
    }

    // The client hasn't said yes: asked to hold the day, with the day to answer by and their page, then what HOLD means.
    const held = 'HOLD Harbour Lights - Show'
    expect(lines(held, 'niamh@example.com').slice(0, 5)).toEqual([
      'Hi Nim, can you hold Wed 6 Mar for us, to work as LX, call 09:00? Press Yes or No on this invite to let us know.',
      `Please answer by Mon 4 Mar. Your rate and the details are on your page, where you can answer too: ${link(job.people.niamh)}`,
      '',
      "HOLD means hold the day: the client hasn't said yes yet, so please keep it free. Nothing is booked until they do.",
      'Job stage: Quoting (1 of 5)',
    ])
    // Staff are paid through payroll, so their second line names no rate.
    expect(lines(held, 'dara@sessionhire.com')[1]).toBe(`Please answer by Mon 4 Mar. The details are on your page, where you can answer too: ${link(dara)}`)

    // Yes on their page, a rate asked for, and the office's pick: each changes the first lines, and none of it is emailed.
    let before = s.google.sent.length
    await send(s, 'offer.respond', { id: asked.niamh, answer: 'accept', days: null, note: '' })
    await send(s, 'offer.respond', { id: asked.conor, answer: 'counter', counterRateCents: 35000, days: null, note: '' })
    await s.sync()
    expect(lines(held, 'niamh@example.com').slice(0, 2)).toEqual([
      "Thanks Nim, you said yes to LX on Wed 6 Mar, call 09:00. Please hold the day: it isn't booked yet, and we'll confirm it with you.",
      `Your rate, the call sheet and the details are on your page: ${link(job.people.niamh)}`,
    ])
    // A rate asked for is with the office: the invite stops asking for a Yes or No, which would settle nothing, and names no figure.
    const conors = copy(held, 'Conor.Walsh@example.ie').description!
    expect(conors.split('\n').slice(0, 2)).toEqual([
      "Thanks Conor, your rate request for LX on Wed 6 Mar, call 09:00 is with the office. Nothing is agreed yet: we'll come back to you.",
      `To change your answer or see the details, use your page: ${link(job.people.conor)}`,
    ])
    expect(conors).not.toMatch(/Press Yes or No|350|€/)
    await send(s, 'offer.confirm', { id: asked.niamh })
    await s.sync()
    // Picked by the office, on a job the client hasn't agreed: down for it, and asked to hold the day. Never "booked".
    expect(lines(held, 'niamh@example.com')[0]).toBe("Hi Nim, we have you down as LX on Wed 6 Mar, call 09:00. Please hold the day: it's booked once the client says yes.")
    for (const email of ['niamh@example.com', 'Conor.Walsh@example.ie', 'dara@sessionhire.com']) {
      expect(copy(held, email).description).not.toMatch(/you're booked|on hold/i)
    }
    expect(emails(s, before)).toEqual([])

    // The day to answer by has gone: it isn't asked for again.
    s.setToday('2030-03-05')
    await s.sync()
    expect(lines(held, 'dara@sessionhire.com')[1]).toBe(`The details are on your page, where you can answer too: ${link(dara)}`)
    expect(emails(s, before)).toEqual([])

    // The client says yes: HOLD comes off the title, which Google tells each guest about, and the words are the booked ones.
    before = s.google.sent.length
    await send(s, 'project.update', { id: quoted, status: 'confirmed' })
    await s.sync()
    expect(lines('Harbour Lights - Show', 'niamh@example.com').slice(0, 4)).toEqual([
      "Hi Nim, you're booked as LX on Wed 6 Mar, call 09:00. Here's the info for the day.",
      `Your rate, the call sheet and the details are on your page: ${link(job.people.niamh)}`,
      '',
      'Job stage: Planning (2 of 5)',
    ])
    expect(copy('Harbour Lights - Show', 'dara@sessionhire.com').description).not.toContain('hold the day')
    expect(emails(s, before).sort()).toEqual([
      'updated Conor.Walsh@example.ie 2030-03-06 Harbour Lights - Show',
      'updated dara@sessionhire.com 2030-03-06 Harbour Lights - Show',
      'updated niamh@example.com 2030-03-06 Harbour Lights - Show',
    ])
  })

  it('words the first two lines for every standing, with or without a page to point at', () => {
    const base = { first: 'Nim', role: 'LX', callTime: null, day: '2030-03-06' }
    // No call time: nothing about one.
    expect(greeting({ ...base, status: 'offered' })).toBe('Hi Nim, are you available to work as LX on Wed 6 Mar? Press Yes or No on this invite to let us know.')
    expect(greeting({ ...base, status: 'offered', hold: true })).toBe('Hi Nim, can you hold Wed 6 Mar for us, to work as LX? Press Yes or No on this invite to let us know.')
    // A rate asked for reads the same whether or not the client has said yes: it is the rate that is open.
    expect(greeting({ ...base, status: 'countered', hold: true })).toBe(greeting({ ...base, status: 'countered' }))
    // HOLD is "hold the day": none of the words a person reads says the job is "on hold".
    for (const status of ['offered', 'countered', 'accepted', 'confirmed']) expect(greeting({ ...base, status, hold: true })).not.toMatch(/on hold/i)

    // No address for the app (it isn't set until the calendar is connected from it): only the day to answer by, or nothing.
    expect(pageLine({ status: 'offered', replyBy: '2030-03-04', staff: false, link: null })).toBe('Please answer by Mon 4 Mar.')
    expect(pageLine({ status: 'accepted', replyBy: '2030-03-04', staff: false, link: null })).toBe('')
    // The day to answer by is for an offer still waiting on them, never for someone who has answered.
    expect(pageLine({ status: 'accepted', replyBy: '2030-03-04', staff: false, link: 'https://app.example/f/abc' })).toBe(
      'Your rate, the call sheet and the details are on your page: https://app.example/f/abc'
    )
    expect(pageLine({ status: 'confirmed', replyBy: null, staff: true, link: 'https://app.example/f/abc' })).toBe('The call sheet and the details are on your page: https://app.example/f/abc')
  })

  it('gives someone only asked the short invite until they say yes, and puts the office notes on nothing Google holds', async () => {
    // Proves: finding 2 of the audit of 12 November 2026 (ADR 0151). Everything in a job's notes went into the invite of everyone
    // asked, before any of them had said yes, and the office had nowhere else to write what wasn't for crew. Someone only asked
    // now reads the stage, the day, where, and what the quote covers for crew; the client, the crew, the notes and the pick list
    // come once they've said yes. Office notes are on no event. Each copy filling in is a change of description: nobody is emailed.
    const s = await setup()
    const job = await withCrew(s)
    const office = 'Client is price sensitive: hold the margin at 30%, do not discount crew.'
    await send(s, 'project.update', { id: job.jobId, officeNotes: office })
    await send(s, 'model.create', { id: 'sm58', name: 'Shure SM58', department: 'audio', category: 'Microphones', tracking: 'bulk', isCase: false, valueCents: 9900, notes: '' })
    await send(s, 'kit.add', { id: newId(), projectId: job.jobId, phaseId: null, modelId: 'sm58', qty: 6, subhireQty: 0, supplier: '', notes: '' })
    const extra = (what: string, unitCents: number, kind: 'travel' | 'subsistence') =>
      ({ id: newId(), kind: 'other', what, ref: null, group: 'Travel and subsistence', qty: 4, days: 1, unitCents, vat: '23', per: 'once', extra: kind }) as const
    await send(s, 'quote.save', {
      id: newId(),
      projectId: job.jobId,
      lines: [extra('Crew travel, 160 km each way from Dublin, 4 car trips', 4810, 'travel'), extra('Crew subsistence, 4 crew days', 3500, 'subsistence')],
      discountPct: 0,
      notes: '',
    })
    // Conor asks for a different rate: that's not a yes, so his copy stays short too.
    await send(s, 'offer.respond', { id: job.offers.conor, answer: 'counter', counterRateCents: 30000, days: null, note: '' })
    await connectTo(s)
    await invites(s, true)
    await s.sync()

    const f = await feed(s)
    const link = (personId: string) => `http://localhost:80/f/${f.get<Person>('person', personId).linkToken}`
    const copy = (email: string) => s.google.copies(TEST_CAL, s.google.visible(TEST_CAL)[0]!.id).find((e) => e.attendees?.some((g) => g.email === email))!.description!
    const later = "Once you've said yes, this invite fills in with the day's sheet: the client, the crew, the notes and the pick list."
    expect(copy('niamh@example.com')).toBe(
      [
        'Hi Niamh, are you available to work as Audio tech on Sat 2 Mar, call 08:00? Press Yes or No on this invite to let us know.',
        `Your rate and the details are on your page, where you can answer too: ${link(job.people.niamh)}`,
        '',
        'Job stage: Going out (3 of 5)',
        '',
        'Build, day 1 of 2: Sat 2 Mar to Sun 3 Mar',
        '',
        'Venue: The Convention Centre Dublin',
        'Spencer Dock, North Wall Quay, Dublin 1, D01 T1W6',
        '',
        'Per diems and fuel',
        'Per diems: approved, €35 a day each',
        'Fuel: covered, about €48.10 a car there and back (160 km each way)',
        '',
        later,
      ].join('\n')
    )
    expect(copy('Conor.Walsh@example.ie').endsWith(`\n\n${later}`)).toBe(true)
    // Aoife is booked: the whole sheet, as on the shared day.
    const sheet = ['Client: Nissan Ireland', 'At the venue: Load-in via Mayor Street.', 'Crew\nAudio tech, call 08:00: Aoife Byrne', 'Job notes\nLaunch of the new Leaf.', 'Pick list\n\nAudio\n• 6 × Shure SM58']
    for (const part of sheet) {
      expect(copy('aoife@example.com')).toContain(part)
      for (const email of ['niamh@example.com', 'Conor.Walsh@example.ie']) expect(copy(email)).not.toContain(part)
    }
    expect(copy('aoife@example.com')).not.toContain(later)

    // Niamh says yes: her copy fills in, quietly. (Her yes fills the call; Conor's rate request stays with the office, ADR 0152.)
    const before = s.google.sent.length
    await send(s, 'offer.respond', { id: job.offers.niamh, answer: 'accept', days: null, note: '' })
    await s.sync()
    for (const part of sheet) expect(copy('niamh@example.com')).toContain(part)
    expect(copy('niamh@example.com')).not.toContain(later)
    expect(emails(s, before).filter((m) => m.includes('niamh@'))).toEqual([])

    // The office notes are on no day and no copy of one, whoever it's for.
    for (const day of s.google.visible(TEST_CAL)) {
      for (const ev of [day, ...s.google.copies(TEST_CAL, day.id)]) expect(ev.description).not.toContain('price sensitive')
    }
    // And they're the office's: the job page has them.
    expect((await feed(s)).get<Project>('project', job.jobId)).toMatchObject({ notes: 'Launch of the new Leaf.', officeNotes: office })
  })

  async function tell(s: Setup, mode: string, to: string[] = []) {
    return s.app.inject({ method: 'POST', url: '/api/calendar/tell?client=collylaptop', cookies: s.colly.cookies, payload: { mode, to } })
  }
  /** The title of a person's own copy of a day, by their address; undefined once it's off their calendar. */
  const titleFor = (s: Setup, eventId: string, email: string) =>
    s.google.copies(TEST_CAL, eventId).find((e) => e.attendees?.some((g) => g.email.toLowerCase() === email.toLowerCase()))?.summary

  it('tells people what happens next once it is on: booked, a call time that moves, and why a day comes off (ADR 0153)', async () => {
    // Proves: findings 4 and 8 of the audit of 12 November 2026. Once the invite had gone, nothing told a person the office had
    // booked them or moved their call time: both were changes to the description, which Google never emails. And when an offer
    // ended, Google's cancellation said only "cancelled", so a place filled read as the job being off. With telling on, a
    // person's own copy is titled with where they stand and their call time, so either change is a title change Google emails,
    // and a day that comes off is first retitled with why, quietly, so the cancellation carries it.
    const s = await setup()
    const job = await invited(s)
    const { build1, build2 } = job.events
    // Off to start, and off on a connection made before it existed.
    expect((await feed(s)).link).toMatchObject({ tell: 'off', tellTo: [] })
    expect(titleFor(s, build1, 'aoife@example.com')).toBe('Nissan - Build 1/2')

    // Turned on: every copy says where its person stands and their call time, and nobody hears about it.
    const before = s.google.sent.length
    expect((await tell(s, 'on')).json()).toMatchObject({ tell: 'on', tellTo: [] })
    await s.sync()
    expect(titleFor(s, build1, 'aoife@example.com')).toBe('Booked: Nissan - Build 1/2, call 08:00')
    expect(titleFor(s, build2, 'aoife@example.com')).toBe('Booked: Nissan - Build 2/2, call 08:00')
    expect(titleFor(s, build1, 'niamh@example.com')).toBe('Nissan - Build 1/2, call 08:00')
    expect(titleFor(s, build1, 'Conor.Walsh@example.ie')).toBe('Nissan - Build 1/2, call 08:00')
    expect(emails(s, before)).toEqual([])
    // The shared days, which nobody is invited to, keep their titles.
    expect(s.google.visible(TEST_CAL).map((e) => e.summary)).toEqual(['Nissan - Build 1/2', 'Nissan - Build 2/2', 'Nissan - Show'])
    // It's in the history, in words.
    const told = (await s.colly.history()).entries.filter((e: HistoryEntry) => e.command === 'calendar.tell')
    expect(told.map((e: HistoryEntry) => [e.who.name, e.what])).toEqual([
      ['Colly Hewson', "Turned on telling crew what happens next on Google Calendar: they're booked, their call time moved, or why a day is off"],
    ])

    // Niamh says yes: that's her own doing, so nothing is emailed to her. Her yes fills the call, so Conor's offer is filled,
    // and Google's cancellation of each of his days says so.
    let from = s.google.sent.length
    await send(s, 'offer.respond', { id: job.offers.niamh, answer: 'accept', days: null, note: '' })
    await s.sync()
    expect(titleFor(s, build1, 'niamh@example.com')).toBe('Nissan - Build 1/2, call 08:00')
    expect(emails(s, from).sort()).toEqual([
      'cancelled Conor.Walsh@example.ie 2030-03-02 Filled by someone else: Nissan - Build 1/2',
      'cancelled Conor.Walsh@example.ie 2030-03-03 Filled by someone else: Nissan - Build 2/2',
    ])

    // The office confirms her: Google emails her that she's booked, for each day.
    from = s.google.sent.length
    await send(s, 'offer.confirm', { id: job.offers.niamh })
    await s.sync()
    expect(emails(s, from).sort()).toEqual([
      'updated niamh@example.com 2030-03-02 Booked: Nissan - Build 1/2, call 08:00',
      'updated niamh@example.com 2030-03-03 Booked: Nissan - Build 2/2, call 08:00',
    ])
    // Nothing more when nothing more happens.
    from = s.google.sent.length
    await s.check()
    expect(emails(s, from)).toEqual([])

    // The call time moves: both booked are emailed the new one.
    await send(s, 'call.update', { id: job.callId, callTime: '07:00' })
    await s.sync()
    expect(emails(s, from).sort()).toEqual([
      'updated aoife@example.com 2030-03-02 Booked: Nissan - Build 1/2, call 07:00',
      'updated aoife@example.com 2030-03-03 Booked: Nissan - Build 2/2, call 07:00',
      'updated niamh@example.com 2030-03-02 Booked: Nissan - Build 1/2, call 07:00',
      'updated niamh@example.com 2030-03-03 Booked: Nissan - Build 2/2, call 07:00',
    ])

    // A change that isn't news to them, the details for crew, still goes quietly.
    from = s.google.sent.length
    await send(s, 'call.update', { id: job.callId, details: 'Black clothes, please.' })
    await s.sync()
    expect(emails(s, from)).toEqual([])

    // The office releases Aoife: her days are retitled with why, without an email, and then cancelled with word from Google.
    from = s.google.sent.length
    const hers = s.google.copies(TEST_CAL, build1).find((e) => e.attendees?.some((g) => g.email === 'aoife@example.com'))!.id
    const calls = s.google.calls.length
    await send(s, 'offer.cancel', { id: job.offers.aoife })
    await s.sync()
    expect(emails(s, from).sort()).toEqual([
      'cancelled aoife@example.com 2030-03-02 Withdrawn by the office: Nissan - Build 1/2',
      'cancelled aoife@example.com 2030-03-03 Withdrawn by the office: Nissan - Build 2/2',
    ])
    expect(eventWrites(s.google.calls.slice(calls)).filter((c) => c.endsWith(`/${hers}`)).map((c) => c.split(' ')[0])).toEqual(['PUT', 'DELETE'])
    expect(titleFor(s, build1, 'aoife@example.com')).toBeUndefined()

    // The job is cancelled: Niamh's days say so.
    from = s.google.sent.length
    await send(s, 'project.update', { id: job.jobId, status: 'cancelled' })
    await s.sync()
    expect(emails(s, from).filter((m) => m.includes('niamh@')).sort()).toEqual([
      'cancelled niamh@example.com 2030-03-02 The job was cancelled: Nissan - Build 1/2',
      'cancelled niamh@example.com 2030-03-03 The job was cancelled: Nissan - Build 2/2',
    ])
  })

  it('is tried on the addresses listed first, says why a declined day comes off, and turns off quietly (ADR 0153)', async () => {
    const s = await setup()
    const job = await invited(s)
    const { build1 } = job.events
    // Only the switch's own three, a short list of addresses, and an address to try it on.
    expect((await tell(s, 'loud')).statusCode).toBe(400)
    expect((await tell(s, 'test')).json()).toEqual({ error: 'List an address to try it on first.' })
    expect((await tell(s, 'test', ['niamh@example.com', 'not an address'])).json()).toEqual({ error: "not an address doesn't look like an email address." })
    expect((await tell(s, 'test', ['a@x.ie', 'b@x.ie', 'c@x.ie', 'd@x.ie', 'e@x.ie', 'f@x.ie'])).json()).toEqual({ error: 'Up to 5 addresses to try it on.' })
    expect((await feed(s)).link).toMatchObject({ tell: 'off', tellTo: [] })

    // Tried on Niamh's address alone, written the way Google may not: only her copies change, and quietly.
    const before = s.google.sent.length
    expect((await tell(s, 'test', [' Niamh@Example.com '])).json()).toMatchObject({ tell: 'test', tellTo: ['niamh@example.com'] })
    await s.sync()
    expect(titleFor(s, build1, 'niamh@example.com')).toBe('Nissan - Build 1/2, call 08:00')
    expect(titleFor(s, build1, 'aoife@example.com')).toBe('Nissan - Build 1/2')
    expect(titleFor(s, build1, 'Conor.Walsh@example.ie')).toBe('Nissan - Build 1/2')
    expect(emails(s, before)).toEqual([])

    // She declines on her page: the cancellation says it was her own No, not the office cancelling on her.
    let from = s.google.sent.length
    await send(s, 'offer.respond', { id: job.offers.niamh, answer: 'decline', note: '' })
    await s.sync()
    expect(emails(s, from).sort()).toEqual([
      'cancelled niamh@example.com 2030-03-02 You declined: Nissan - Build 1/2',
      'cancelled niamh@example.com 2030-03-03 You declined: Nissan - Build 2/2',
    ])
    // Conor isn't on the list: his days come off as before, with a bare cancellation.
    from = s.google.sent.length
    await send(s, 'offer.cancel', { id: job.offers.conor })
    await s.sync()
    expect(emails(s, from).sort()).toEqual(['cancelled Conor.Walsh@example.ie 2030-03-02 Nissan - Build 1/2', 'cancelled Conor.Walsh@example.ie 2030-03-03 Nissan - Build 2/2'])

    // On for everyone, then off: Aoife's copies say she's booked and then go back, without an email either way.
    from = s.google.sent.length
    await tell(s, 'on', ['niamh@example.com'])
    await s.sync()
    expect(titleFor(s, build1, 'aoife@example.com')).toBe('Booked: Nissan - Build 1/2, call 08:00')
    expect((await tell(s, 'off', ['niamh@example.com'])).json()).toMatchObject({ tell: 'off', tellTo: ['niamh@example.com'] })
    await s.sync()
    expect(titleFor(s, build1, 'aoife@example.com')).toBe('Nissan - Build 1/2')
    expect(emails(s, from)).toEqual([])
    // Off, a call time that moves is on her page, and Google emails nothing, as before.
    await send(s, 'call.update', { id: job.callId, callTime: '07:00' })
    await s.sync()
    expect(emails(s, from)).toEqual([])
    // Each change is in the history, in words; a press that changes nothing isn't.
    const told = (await s.colly.history()).entries.filter((e: HistoryEntry) => e.command === 'calendar.tell')
    expect(told.map((e: HistoryEntry) => e.what).reverse()).toEqual([
      'Turned on telling crew what happens next on Google Calendar, only to 1 address, to try it',
      "Turned on telling crew what happens next on Google Calendar: they're booked, their call time moved, or why a day is off",
      'Turned off telling crew what happens next on Google Calendar',
    ])
  })

  it("tells someone picked for a job the client hasn't said yes to that they hold the day, never that they're booked (ADR 0153)", async () => {
    const s = await setup()
    const job = await withCrew(s)
    const pencilled = newId()
    const phase = newId()
    const callId = newId()
    const offerId = newId()
    await send(s, 'project.create', { id: pencilled, name: 'Pencilled', clientId: null, venueId: null, status: 'enquiry', notes: '' })
    await send(s, 'phase.add', { id: phase, projectId: pencilled, name: 'Show', start: '2030-03-05', end: '2030-03-05', venueId: null, notes: '' })
    await send(s, 'call.create', {
      id: callId,
      projectId: pencilled,
      phaseId: phase,
      project: 'Pencilled',
      phase: 'Show',
      venue: '',
      role: 'LX',
      start: '2030-03-05',
      end: '2030-03-05',
      callTime: null,
      needed: 1,
      dayRateCents: null,
      details: '',
      replyBy: null,
    })
    await send(s, 'offer.send', { id: offerId, callId, personId: job.people.niamh, override: false })
    await connectTo(s)
    await invites(s, true)
    await tell(s, 'on')
    await s.sync()
    const show = s.google.visible(TEST_CAL).find((e) => e.summary === 'HOLD Pencilled - Show')!.id
    // No call time yet, so none in the title.
    expect(titleFor(s, show, 'niamh@example.com')).toBe('HOLD Pencilled - Show')
    await send(s, 'offer.respond', { id: offerId, answer: 'accept', days: null, note: '' })
    await s.sync()
    // Picked: the title stays HOLD, as nothing is booked, but it's news, so Google emails her the invite as it now reads.
    const from = s.google.sent.length
    await send(s, 'offer.confirm', { id: offerId })
    await s.sync()
    expect(titleFor(s, show, 'niamh@example.com')).toBe('HOLD Pencilled - Show')
    expect(emails(s, from)).toEqual(['updated niamh@example.com 2030-03-05 HOLD Pencilled - Show'])
    const copy = s.google.copies(TEST_CAL, show).find((e) => e.attendees?.some((g) => g.email === 'niamh@example.com'))!
    expect(copy.description!.split('\n')[0]).toBe("Hi Niamh, we have you down as LX on Tue 5 Mar. Please hold the day: it's booked once the client says yes.")
    // The client says yes: now she's booked, and told so.
    const later = s.google.sent.length
    await send(s, 'project.update', { id: pencilled, status: 'confirmed' })
    await s.sync()
    expect(emails(s, later)).toEqual(['updated niamh@example.com 2030-03-05 Booked: Pencilled - Show'])
  })

  it('needs a connected calendar to tell crew anything, and the right to change settings', async () => {
    const s = await setup()
    expect((await tell(s, 'on')).json()).toEqual({ error: 'Google Calendar is not connected.' })
    const signedOut = await s.app.inject({ method: 'POST', url: '/api/calendar/tell', payload: { mode: 'on', to: [] } })
    expect(signedOut.statusCode).toBe(401)
  })

  it('never loses an answer given while the app is changing the event', async () => {
    const s = await setup()
    const job = await invited(s)
    // Her own copy of Saturday is the one she answers.
    const hers = s.google.copies(TEST_CAL, job.events.build1).find((e) => e.attendees?.some((g) => g.email === 'niamh@example.com'))!
    s.google.replaceOnly = hers.id
    s.google.beforeNextReplace = () => s.google.respond(TEST_CAL, job.events.build1, 'niamh@example.com', 'accepted')
    const before = s.google.calls.length
    // A change to what her copy says while she's only asked: the day to answer by. (The notes aren't on it until she says yes, ADR 0151.)
    await send(s, 'call.update', { id: job.callId, replyBy: '2030-03-02' })
    await s.sync()
    // Google turned the first replace down, as the event had changed since it was read: read again, and replace that.
    const build1 = `/calendar/v3/calendars/${encodeURIComponent('ops@sessionhire.com')}/events/${hers.id}`
    expect(s.google.calls.slice(before).filter((c) => c.endsWith(build1))).toEqual([`GET ${build1}`, `PUT ${build1}`, `GET ${build1}`, `PUT ${build1}`])
    expect(s.google.copies(TEST_CAL, job.events.build1).find((e) => e.id === hers.id)!.description).toContain('Please answer by Sat 2 Mar.')
    expect(s.google.guests(TEST_CAL, job.events.build1)).toContain('niamh@example.com accepted')
    s.later(2)
    expect(await s.poll()).toBe(1)
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'accepted' })
  })

  it('takes someone erased on request off the days still to come, even when the calendar had not caught up', async () => {
    // Proves: withdrawn, archived and erased before the calendar's next run, Niamh still comes off the events (ADR 0027), and then the app holds her address nowhere.
    const s = await setup()
    const job = await invited(s)
    expect(s.google.guests(TEST_CAL, job.events.build1)).toContain('niamh@example.com needsAction')
    await send(s, 'offer.cancel', { id: job.offers.niamh })
    await send(s, 'person.archive', { id: job.people.niamh, archived: true })
    await send(s, 'person.erase', { id: job.people.niamh })

    await s.sync()
    for (const event of [job.events.build1, job.events.build2]) expect(s.google.guests(TEST_CAL, event).join()).not.toContain('niamh')
    expect((await s.db.query(`SELECT * FROM calendar_guests WHERE person_id = $1`, [job.people.niamh])).rows).toEqual([])
  })

  it('an address changed in the app moves the invite to it', async () => {
    const s = await setup()
    const job = await invited(s)
    const before = s.google.sent.length
    await send(s, 'person.upsert', { id: job.people.niamh, name: 'Niamh Kelly', kind: 'freelancer', email: 'niamh.kelly@example.com', phone: null, skills: ['audio'], dayRateCents: 25000, notes: '' })
    await s.sync()
    expect(s.google.guests(TEST_CAL, job.events.build1).sort()).toEqual([
      'Conor.Walsh@example.ie needsAction',
      'aoife@example.com needsAction',
      'niamh.kelly@example.com needsAction',
    ])
    expect(emails(s, before).sort()).toEqual([
      'cancelled niamh@example.com 2030-03-02 Nissan - Build 1/2',
      'cancelled niamh@example.com 2030-03-03 Nissan - Build 2/2',
      'invited niamh.kelly@example.com 2030-03-02 Nissan - Build 1/2',
      'invited niamh.kelly@example.com 2030-03-03 Nissan - Build 2/2',
    ])
  })

  it('switched off, sends nothing and reads no answers; the guests already invited stay', async () => {
    const s = await setup()
    const job = await invited(s)
    expect(await invites(s, false)).toMatchObject({ invites: false })
    const before = s.google.sent.length
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'niamh@example.com', 'accepted')
    const calls = s.google.calls.length
    expect(await s.poll()).toBe(0)
    expect(s.google.calls.length).toBe(calls)
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'offered' })

    // Conor's offer is withdrawn: with invites off he stays on, and hears nothing.
    await send(s, 'offer.cancel', { id: job.offers.conor })
    await send(s, 'phase.update', { id: job.phases.build, notes: 'Bring the long ladder.' })
    await s.sync()
    expect(s.google.guests(TEST_CAL, job.events.build1)).toContain('Conor.Walsh@example.ie needsAction')
    expect(emails(s, before)).toEqual([])
    // A device reads the same (ADR 0149): no cancellation to promise before the press, and the days still in his calendar after it.
    const f = await feed(s)
    const reach = { calendar: { link: f.link, days: f.days }, today: TODAY }
    expect(daysToCancel(reach, job.offers.conor)).toEqual([])
    expect(invitesHeld(reach, job.offers.conor)).toEqual(['2030-03-02', '2030-03-03'])
    expect((await s.colly.history()).entries.find((e: HistoryEntry) => e.command === 'calendar.invites')!.what).toBe('Turned off crew invites on Google Calendar')
  })

  it('the nightly check takes in answers it missed, without rewriting the events for them', async () => {
    const s = await setup()
    const job = await withCrew(s)
    await connectTo(s)
    await invites(s, true)
    await s.sync()
    s.google.respond(TEST_CAL, s.google.visible(TEST_CAL)[0]!.id, 'niamh@example.com', 'tentative')
    const before = s.google.calls.length
    expect(await s.check()).toEqual({ written: 0, removed: 0, failed: 0 })
    expect(eventWrites(s.google.calls.slice(before))).toEqual([])
    expect(await onCalendar(s, job.offers.niamh)).toMatchObject({ answers: { '2030-03-02': 'maybe', '2030-03-03': 'none' } })
    // The answer's new version of the event is noted, so the next check has nothing to do either.
    const [build1] = s.google.visible(TEST_CAL)
    const { rows } = await s.db.query<{ etag: string }>('SELECT etag FROM calendar_days WHERE event_id = $1', [build1!.id])
    expect(rows[0]!.etag).toBe(build1!.etag)
    expect(await s.check()).toEqual({ written: 0, removed: 0, failed: 0 })
  })

  it('disconnecting tells guests the days are off, and turns invites off', async () => {
    const s = await setup()
    await invited(s)
    const before = s.google.sent.length
    await s.app.inject({ method: 'POST', url: '/api/calendar/disconnect', cookies: s.colly.cookies })
    await s.sync()
    expect(emails(s, before).filter((m) => m.startsWith('cancelled'))).toHaveLength(6)
    expect((await feed(s)).link).toMatchObject({ state: 'off', invites: false })
    expect(await s.poll()).toBe(0)
  })
})

/** Keep TypeScript honest about the helpers' shapes. */
export type { Db, FastifyInstance }
