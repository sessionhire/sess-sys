import { addDays, irishToday, newId, readingFor, type CommandInput, type CommandName, type MutationResult, type PullResponse, type Tracker, type TrackerSettings } from '@sh/shared'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { pgliteDb } from '../src/db.ts'
import { readHistory } from '../src/history.ts'
import { asRead } from '../src/reading.ts'
import { readDigitalMatter } from '../src/trackers/digital-matter.ts'

/**
 * Trackers on kit (ADR 0107): Digital Matter's server posts each report,
 * with the key; the server keeps it, makes the tracker the first time it's
 * heard from, and says where it is against where its item should be. Kit
 * away on no job, and kit out after its job, are what's put in front of
 * the office; anywhere a job could have it is left alone.
 */

let cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn()
  cleanup = []
})

const KEY = 'tracker-key-for-tests'
const BEARER = { authorization: `Bearer ${KEY}` }
/** The warehouse, in Dublin 12, and a venue across the city. */
const WAREHOUSE = { lat: 53.3249, lng: -6.3368 }
const VICAR_ST = { lat: 53.3434, lng: -6.2775 }
/** Twenty-odd km away, in Naas. */
const NAAS = { lat: 53.2159, lng: -6.6669 }

async function server(key: string | undefined = KEY) {
  const db = await pgliteDb()
  const app = await buildApp({ db, trackersKey: key })
  cleanup.push(async () => {
    await app.close()
    await db.close()
  })
  return { app, db }
}

async function send<N extends CommandName>(app: FastifyInstance, name: N, args: CommandInput<N>): Promise<MutationResult> {
  const res = await app.inject({ method: 'POST', url: '/api/sync/push', payload: { clientId: 'office-laptop', mutations: [{ id: newId(), name, args, createdAt: new Date().toISOString() }] } })
  return res.json().results[0]
}
async function ok<N extends CommandName>(app: FastifyInstance, name: N, args: CommandInput<N>) {
  const r = await send(app, name, args)
  expect(r, `${name} ${JSON.stringify(args)}`).toMatchObject({ status: 'applied' })
}

async function latest<T>(app: FastifyInstance, entity: string): Promise<Map<string, T>> {
  const res = await app.inject({ url: '/api/sync/pull?after=0' })
  const out = new Map<string, T>()
  for (const c of (res.json() as PullResponse).changes) if (c.entity === entity) out.set(c.id, c.data as T)
  return out
}
const tracker = async (app: FastifyInstance, serial: string) => (await latest<Tracker>(app, 'tracker')).get(`digital-matter:${serial}`)!

/** A Location Engine report, as a Yabby Edge's arrive. */
const edge = (sn: string, at: Date, where: { lat: number; lng: number } | null, sqn = 1, mv = 3600) => ({
  date: at.toISOString(),
  device: { sn, prod: 85, rev: 1, fw: '1.12', iccid: '89011702278612797427', imei: '351358810439486' },
  sqn,
  reason: 11,
  ...(where ? { lat: where.lat, lng: where.lng, posAcc: 25.5, posInfo: { GDOP: 4.68, Src: 1 } } : {}),
  analogues: [
    { id: 1, val: mv },
    { id: 3, val: 3800 },
  ],
})

const post = (app: FastifyInstance, body: unknown, headers: Record<string, string> = BEARER) => app.inject({ method: 'POST', url: '/api/trackers/digital-matter', headers, payload: body as object })

async function product(app: FastifyInstance, name: string) {
  const id = newId()
  await ok(app, 'model.create', { id, name, department: 'audio', category: '', tracking: 'serialised', isCase: true, valueCents: 4_000_000, notes: '' })
  return id
}
async function item(app: FastifyInstance, modelId: string) {
  const id = newId()
  await ok(app, 'asset.add', { id, modelId, number: null, serial: '', placeId: null, caseId: null, notes: '', fromCount: false })
  return id
}
async function job(app: FastifyInstance, name: string, start: string, end: string, venue?: { lat: number; lng: number }) {
  const id = newId()
  let venueId: string | null = null
  if (venue) {
    venueId = newId()
    await ok(app, 'venue.upsert', { id: venueId, name: 'Vicar Street', address: '', notes: '' })
    await ok(app, 'venue.pin', { id: venueId, pin: venue })
  }
  await ok(app, 'project.create', { id, name, clientId: null, venueId, status: 'confirmed', notes: '' })
  await ok(app, 'phase.add', { id: newId(), projectId: id, name: 'Show', start, end, venueId: null, notes: '' })
  return id
}
const kitLine = (projectId: string, modelId: string): CommandInput<'kit.add'> => ({ id: newId(), projectId, phaseId: null, modelId, qty: 1, subhireQty: 0, supplier: '', notes: '' })

/** Trackers on, the warehouse on the map, and one tracker heard from at the warehouse and put on a desk's case. */
async function company() {
  const s = await server()
  await ok(s.app, 'trackers.use', { on: true })
  await ok(s.app, 'trackers.home', { home: WAREHOUSE, radiusM: 300 })
  const desk = await product(s.app, 'Allen & Heath dLive S5000 case')
  const caseId = await item(s.app, desk)
  expect((await post(s.app, edge('416581', new Date(), WAREHOUSE))).statusCode).toBe(200)
  await ok(s.app, 'tracker.attach', { id: 'digital-matter:416581', assetId: caseId })
  return { ...s, desk, caseId }
}

describe('reports coming in', () => {
  it('are taken only with the key, while trackers are on, in a shape Digital Matter sends', async () => {
    const none = await server(undefined)
    expect((await post(none.app, edge('1', new Date(), WAREHOUSE))).statusCode).toBe(503)

    const { app } = await server()
    expect((await post(app, edge('1', new Date(), WAREHOUSE), {})).statusCode).toBe(401)
    expect((await post(app, edge('1', new Date(), WAREHOUSE), { authorization: 'Bearer nope' })).statusCode).toBe(401)
    // Off until the office says, and nothing kept: Digital Matter holds on to what isn't taken.
    const off = await post(app, edge('1', new Date(), WAREHOUSE))
    expect(off.statusCode).toBe(503)
    expect(off.json().error).toMatch(/off in the app/)
    expect((await latest(app, 'tracker')).size).toBe(0)

    await ok(app, 'trackers.use', { on: true })
    expect((await post(app, { hello: 'there' })).statusCode).toBe(400)
    // Basic sign-in with the key as the password works as well as a bearer token.
    const basic = { authorization: `Basic ${Buffer.from(`digital-matter:${KEY}`).toString('base64')}` }
    expect((await post(app, edge('1', new Date(), WAREHOUSE), basic)).json()).toMatchObject({ ok: true, reports: 1, kept: 1 })
  })

  it('makes a tracker the first time it is heard from, with its newest fix and battery, and keeps a report sent twice once', async () => {
    const { app } = await server()
    await ok(app, 'trackers.use', { on: true })
    const t0 = new Date(Date.now() - 2 * 3_600_000)
    const t1 = new Date(Date.now() - 3_600_000)
    expect((await post(app, edge('416581', t1, VICAR_ST, 2, 3550))).json()).toMatchObject({ kept: 1 })
    // An older report arriving late is kept, and moves nothing on.
    expect((await post(app, edge('416581', t0, NAAS, 1, 3600))).json()).toMatchObject({ kept: 1 })
    expect((await post(app, edge('416581', t1, VICAR_ST, 2, 3550))).json()).toMatchObject({ kept: 0 })
    const t = await tracker(app, '416581')
    expect(t).toMatchObject({
      maker: 'digital-matter',
      serial: '416581',
      name: '',
      assetId: null,
      position: { ...VICAR_ST, accuracyM: 25.5, at: t1.toISOString() },
      batteryMv: 3550,
      archived: false,
      // No warehouse on the map yet, so nothing can be said.
      place: { kind: 'unknown', why: 'noHome' },
    })
    // A report with no fix says it's still there, and keeps the fix it had.
    await post(app, edge('416581', new Date(), null, 3))
    expect((await tracker(app, '416581')).position).toMatchObject(VICAR_ST)
  })

  it('reads Device Manager posts, several records at once, and leaves out a fix that is no good', () => {
    const read = readDigitalMatter({
      SerNo: 131693,
      IMEI: '356692063643328',
      ProdId: 33,
      Records: [
        { SeqNo: 125, Reason: 11, DateUTC: '2026-10-31 05:58:44', Fields: [{ GpsUTC: '2026-10-31 05:58:40', Lat: 53.3249, Long: -6.3368, PosAcc: 37, GpsStat: 7, FType: 0 }, { AnalogueData: { '1': 14641, '3': 2484 }, FType: 6 }] },
        { SeqNo: 126, Reason: 9, DateUTC: '2026-10-31 06:10:00', Fields: [{ GpsUTC: '2026-10-31 06:09:00', Lat: 0, Long: 0, PosAcc: 0, GpsStat: 0, FType: 0 }] },
      ],
    })
    expect(read).toEqual({
      reports: [
        { serial: '131693', at: '2026-10-31T05:58:44.000Z', seq: 125, fix: { lat: 53.3249, lng: -6.3368, accuracyM: 37, at: '2026-10-31T05:58:40.000Z' }, batteryMv: 14641, reason: 11 },
        { serial: '131693', at: '2026-10-31T06:10:00.000Z', seq: 126, fix: null, batteryMv: null, reason: 9 },
      ],
    })
    expect(readDigitalMatter({ device: {}, date: 'x' })).toMatchObject({ problem: expect.stringMatching(/serial/) })
  })
})

describe('where kit is against where it should be', () => {
  it('is at the warehouse, then away on no job, which is put in front of the office', async () => {
    const { app } = await company()
    expect((await tracker(app, '416581')).place).toEqual({ kind: 'home' })
    await post(app, edge('416581', new Date(), NAAS, 2))
    const t = await tracker(app, '416581')
    expect(t.place).toEqual({ kind: 'away', km: expect.any(Number) })
    expect((t.place as { km: number }).km).toBeGreaterThan(20)
  })

  it('leaves kit alone while a job holds its product, wherever it is, and says the venue when it is there', async () => {
    const { app, desk } = await company()
    const today = irishToday()
    const gig = await job(app, 'Nissan launch', addDays(today, 1), addDays(today, 2), VICAR_ST)
    await ok(app, 'kit.add', kitLine(gig, desk))
    // The day before is its prep day: on the road is fine.
    await post(app, edge('416581', new Date(), NAAS, 2))
    expect((await tracker(app, '416581')).place).toEqual({ kind: 'withJob', jobId: gig, job: 'Nissan launch' })
    await post(app, edge('416581', new Date(), VICAR_ST, 3))
    expect((await tracker(app, '416581')).place).toEqual({ kind: 'venue', jobId: gig, job: 'Nissan launch', venue: 'Vicar Street' })
  })

  it('says kit scanned out with a job that is over is not back', async () => {
    const { app, desk, caseId } = await company()
    const today = irishToday()
    const gig = await job(app, 'Harbour Lights', addDays(today, -6), addDays(today, -4), VICAR_ST)
    await ok(app, 'kit.add', kitLine(gig, desk))
    await ok(app, 'move.record', { id: newId(), projectId: gig, direction: 'out', assetId: caseId, modelId: desk, qty: 1, at: new Date(Date.now() - 7 * 86_400_000).toISOString() })
    await post(app, edge('416581', new Date(), NAAS, 2))
    expect((await tracker(app, '416581')).place).toEqual({ kind: 'notBack', jobId: gig, job: 'Harbour Lights', ended: addDays(today, -3), km: expect.any(Number) })
    // Scanned back in and home, it's home.
    await ok(app, 'move.record', { id: newId(), projectId: gig, direction: 'in', assetId: caseId, modelId: desk, qty: 1, at: new Date().toISOString() })
    await post(app, edge('416581', new Date(), WAREHOUSE, 3))
    expect((await tracker(app, '416581')).place).toEqual({ kind: 'home' })
  })

  it('works its place out again when the warehouse moves, keeping "since" while the place is the same', async () => {
    const { app } = await company()
    await post(app, edge('416581', new Date(), NAAS, 2))
    const away = await tracker(app, '416581')
    // The warehouse "moved" to Naas: the case is home.
    await ok(app, 'trackers.home', { home: NAAS, radiusM: 500 })
    expect((await tracker(app, '416581')).place).toEqual({ kind: 'home' })
    await ok(app, 'trackers.home', { home: WAREHOUSE, radiusM: 300 })
    const again = await tracker(app, '416581')
    expect(again.place.kind).toBe('away')
    expect(Date.parse(again.placeSince)).toBeGreaterThanOrEqual(Date.parse(away.placeSince))
    expect((await latest<TrackerSettings>(app, 'trackerSettings')).get('trackers')).toEqual({ id: 'trackers', on: true, home: WAREHOUSE, address: '', radiusM: 300 })
  })

  it('keeps the warehouse address from Admin, and a change that leaves it out keeps it (ADR 0180)', async () => {
    const { app } = await company()
    await ok(app, 'trackers.home', { home: WAREHOUSE, radiusM: 300, address: ' Unit 4, Park West\nDublin 12 ' })
    expect((await latest<TrackerSettings>(app, 'trackerSettings')).get('trackers')).toMatchObject({ home: WAREHOUSE, address: 'Unit 4, Park West\nDublin 12' })
    await ok(app, 'trackers.home', { home: WAREHOUSE, radiusM: 400 })
    expect((await latest<TrackerSettings>(app, 'trackerSettings')).get('trackers')).toMatchObject({ address: 'Unit 4, Park West\nDublin 12', radiusM: 400 })
  })
})

describe('putting trackers on items', () => {
  it('keeps one tracker to an item, refuses a retired item, and says each change in the history', async () => {
    const { app, db, desk, caseId } = await company()
    await post(app, edge('500001', new Date(), WAREHOUSE))
    await ok(app, 'tracker.name', { id: 'digital-matter:500001', name: '  Spare tracker ' })
    // The new one goes on the case; the first comes off it.
    await ok(app, 'tracker.attach', { id: 'digital-matter:500001', assetId: caseId })
    expect((await tracker(app, '416581')).assetId).toBeNull()
    expect((await tracker(app, '500001'))).toMatchObject({ assetId: caseId, name: 'Spare tracker' })

    const old = await item(app, desk)
    await ok(app, 'asset.retire', { id: old, reason: 'scrapped', note: '' })
    const r = await send(app, 'tracker.attach', { id: 'digital-matter:416581', assetId: old })
    expect(r).toMatchObject({ status: 'rejected', reason: { message: expect.stringMatching(/is retired/) } })
    expect(await send(app, 'tracker.attach', { id: 'digital-matter:999', assetId: caseId })).toMatchObject({ status: 'rejected', reason: { code: 'not-found' } })

    // Put away comes off its item, and can't go on one until it's back.
    await ok(app, 'tracker.archive', { id: 'digital-matter:500001', archived: true })
    expect(await tracker(app, '500001')).toMatchObject({ archived: true, assetId: null })
    expect(await send(app, 'tracker.attach', { id: 'digital-matter:500001', assetId: caseId })).toMatchObject({ status: 'rejected' })

    const said = (await readHistory(db, {})).entries.filter((e) => e.command.startsWith('tracker') && e.outcome === 'done').map((e) => e.what)
    expect(said).toEqual([
      'Put Spare tracker away',
      expect.stringMatching(/^Put Spare tracker on \S+ \(Allen & Heath dLive S5000 case\)$/),
      'Called Spare tracker “Spare tracker”',
      expect.stringMatching(/^Put tracker 416581 on \S+ \(Allen & Heath dLive S5000 case\)$/),
      'Put the warehouse on the map, 300 m around it',
      'Turned on trackers',
    ])
  })
})

describe('who reads them', () => {
  it('sends trackers to the office, directors and heads, and not to staff crew or freelancers', async () => {
    const { db } = await company()
    const { rows } = await db.query<{ entity: string; op: 'put' | 'delete'; data: unknown }>(`SELECT entity, op, data FROM changes WHERE entity IN ('tracker', 'trackerSettings')`)
    expect(rows.length).toBeGreaterThan(0)
    for (const role of ['office', 'director', 'head'] as const) expect(await asRead(db, rows, readingFor(role, {}))).toHaveLength(rows.length)
    for (const role of ['crew', 'freelancer'] as const) expect(await asRead(db, rows, readingFor(role, { personId: 'p1' }))).toHaveLength(0)
  })
})
