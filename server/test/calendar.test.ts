import {
  calendarDayId,
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
} from '@sh/shared'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.ts'
import type { IdentityProvider } from '../src/auth/google.ts'
import { seal } from '../src/calendar/crypto.ts'
import { allowancesText } from '../src/calendar/events.ts'
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
}

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
    expect(held.description).toMatch(/^ON HOLD: the client hasn't said yes yet, so keep the day free but it isn't booked\.\nJob stage: Quoting \(1 of 5\)\n/)
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
    // isn't part of a job, a day outside the job's phases, a job brought in from a calendar or someone with no address. The rule a
    // device reads (shared/src/reach.ts) is checked here against who the server really made a guest, case by case.
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
      'brought in': { ...(await ask({ projectId: theirs, phaseId: theirShow, project: 'Brought in', phase: 'Show', start: '2030-03-07', end: '2030-03-07' })), why: 'brought-in' },
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
    // Orla was emailed one invite, for the show; her other three offers sent nothing.
    expect(emails(s, sentBefore).filter((m) => m.includes('orla@example.com'))).toEqual(['invited orla@example.com 2030-03-04 Nissan - Show'])
    // Her page says invites come too, as one of the offers waiting on her has one.
    const page = async (id: string) => (await s.app.inject({ url: `/f/${f.get<Person>('person', id).linkToken}` })).body
    expect(await page(orla)).toContain('We also send a Google Calendar invite for each day to orla@example.com, from ')
    // With that one withdrawn, the three left get none, and the page no longer says they do.
    await send(s, 'offer.cancel', { id: cases['on the show']!.offer })
    await s.sync()
    const after = await page(orla)
    expect(after).toContain('A one-off')
    expect(after).not.toContain('Google Calendar invite for each day')
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

  it('a Yes in Google takes the place, as on their link, and the rest of the shortlist come off', async () => {
    const s = await setup()
    const job = await invited(s)
    s.later(2)
    s.google.respond(TEST_CAL, job.events.build1, 'niamh@example.com', 'accepted', 'Can bring the van.')
    expect(await s.poll()).toBe(1)

    // A Yes to one day is a yes to all of them, with what they wrote in Google as their note.
    expect(await offer(s, job.offers.niamh)).toMatchObject({
      status: 'accepted',
      days: ['2030-03-02', '2030-03-03'],
      respondedVia: 'calendar',
      note: 'Can bring the van.',
    })
    // The first to say yes gets the place, as on the links.
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'filled' })
    expect(await onCalendar(s, job.offers.niamh)).toMatchObject({ line: 'On Google Calendar: yes to Sat 2 Mar; no answer yet for Sun 3 Mar.', warning: null })

    // In the history as Niamh's own answer, on Google Calendar.
    const entry = (await s.colly.history()).entries[0]!
    expect(entry).toMatchObject({ who: { kind: 'calendar', name: 'Niamh Kelly', key: `link:${job.people.niamh}` }, outcome: 'done' })
    expect(entry.what).toBe('Niamh Kelly accepted Audio tech on Nissan, Sat 2 Mar to Sun 3 Mar')
    expect(entry.deviceCode).toBeUndefined()
    const hers = await s.colly.history(`?who=link:${job.people.niamh}`)
    expect(hers.entries.map((e: HistoryEntry) => e.what)).toEqual(['Niamh Kelly accepted Audio tech on Nissan, Sat 2 Mar to Sun 3 Mar'])
    expect((await s.colly.history()).people).toContainEqual({ key: `link:${job.people.niamh}`, name: 'Niamh Kelly' })

    // Next run: the crew list goes on quietly, and Conor is told he's off.
    const before = s.google.sent.length
    await s.sync()
    expect(s.google.visible(TEST_CAL)[0]!.description).toContain('Audio tech, call 08:00: Aoife Byrne, 2 TBC')
    expect(s.google.guests(TEST_CAL, job.events.build1).sort()).toEqual(['aoife@example.com needsAction', 'niamh@example.com accepted'])
    expect(emails(s, before)).toEqual([
      'cancelled Conor.Walsh@example.ie 2030-03-02 Nissan - Build 1/2',
      'cancelled Conor.Walsh@example.ie 2030-03-03 Nissan - Build 2/2',
    ])
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
      warning: "Said yes on Google Calendar, but the app couldn't take it: Sun 3 Mar has just been filled. Still open: Sat 2 Mar.",
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
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'accepted', days: ['2030-03-02', '2030-03-03'] })
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
    expect(await offer(s, job.offers.niamh)).toMatchObject({ status: 'accepted' })
    expect(await offer(s, job.offers.conor)).toMatchObject({ status: 'filled' })
    const answers = (await s.colly.history()).entries.filter((e: HistoryEntry) => e.who.kind === 'calendar')
    expect(answers.map((e: HistoryEntry) => e.what)).toEqual(['Niamh Kelly accepted Audio tech on Nissan, Sat 2 Mar to Sun 3 Mar'])
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

  it('never loses an answer given while the app is changing the event', async () => {
    const s = await setup()
    const job = await invited(s)
    // Her own copy of Saturday is the one she answers.
    const hers = s.google.copies(TEST_CAL, job.events.build1).find((e) => e.attendees?.some((g) => g.email === 'niamh@example.com'))!
    s.google.replaceOnly = hers.id
    s.google.beforeNextReplace = () => s.google.respond(TEST_CAL, job.events.build1, 'niamh@example.com', 'accepted')
    const before = s.google.calls.length
    await send(s, 'phase.update', { id: job.phases.build, notes: 'Bring the long ladder.' })
    await s.sync()
    // Google turned the first replace down, as the event had changed since it was read: read again, and replace that.
    const build1 = `/calendar/v3/calendars/${encodeURIComponent('ops@sessionhire.com')}/events/${hers.id}`
    expect(s.google.calls.slice(before).filter((c) => c.endsWith(build1))).toEqual([`GET ${build1}`, `PUT ${build1}`, `GET ${build1}`, `PUT ${build1}`])
    expect(s.google.visible(TEST_CAL)[0]!.description).toContain('Bring the long ladder.')
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
