import { newId, type CommandInput, type CommandName, type Mutation, type RmsClientStats, type RmsLastCharged, type RmsMatches } from '@sh/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { pgliteDb } from '../src/db.ts'

/**
 * Current RMS's history put to use (ADR 0092), from the server's copy:
 * each opportunity's likeliest job, linked by the office and taken off
 * again; a job's past quotes and how its client's went; and what a line was
 * last charged, to the client and to anyone.
 */

let cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn()
  cleanup = []
})

const m = <N extends CommandName>(name: N, args: CommandInput<N>): Mutation => ({ id: newId(), name, args, createdAt: new Date().toISOString() }) as Mutation

async function setup() {
  const db = await pgliteDb()
  const app = await buildApp({ db })
  cleanup.push(async () => {
    await app.close()
    await db.close()
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    payload: {
      clientId: 'office',
      mutations: [
        m('client.upsert', { id: 'bw', name: 'Brightwater Events', contacts: [], notes: '' }),
        m('project.create', { id: 'gala', name: 'Autumn Gala', clientId: 'bw', venueId: null, status: 'confirmed', notes: '' }),
        m('phase.add', { id: 'show', projectId: 'gala', name: 'Show', start: '2026-03-01', end: '2026-03-02', venueId: null, notes: '' }),
      ],
    },
  })
  expect(res.json().results.every((r: { status: string }) => r.status === 'applied')).toBe(true)
  const opp = (id: number, number: string, subject: string, client: string, state: string, status: string, start: string, net: number, before = net) =>
    db.query(
      `INSERT INTO rms_opportunities (id, number, subject, client, state, status, starts_at, ends_at, net_cents, undiscounted_cents) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)`,
      [id, number, subject, client, state, status, `${start}T10:00:00Z`, net, before]
    )
  await opp(1, '1043', 'Autumn Gala', 'Brightwater Events Ltd', 'Order', 'Completed', '2026-03-01', 90000, 100000)
  await opp(2, '0990', 'Spring do', 'Brightwater Events', 'Quotation', 'Lost', '2025-04-01', 50000)
  await opp(3, '1001', 'Expo', 'Other Co', 'Order', 'Active', '2026-02-01', 20000)
  const line = (id: number, opportunityId: number, name: string, price: number, discount = 0) =>
    db.query(`INSERT INTO rms_lines (id, opportunity_id, kind, name, price_cents, unit_cents, discount_pct, rate_definition) VALUES ($1, $2, 'Principal', $3, $4, $5, $6, 'Weekly Rate')`, [
      id,
      opportunityId,
      name,
      price,
      Math.round(price * (1 - discount / 100)),
      discount,
    ])
  await line(1, 1, 'Robe Spiider', 6000, 10)
  await line(2, 2, 'Robe Spiider', 5500)
  await line(3, 3, 'Robe Spiider ', 7000)
  await line(4, 3, 'Audio technician', 40000)
  return { app, db }
}

describe("Current RMS's history (ADR 0092)", () => {
  it('suggests each opportunity its job, links it and takes it off, and shows a job its past quotes and how its client went', async () => {
    const { app } = await setup()
    const matches = (await app.inject({ url: '/api/rms/matches' })).json() as RmsMatches
    const gala = matches.rows.find((r) => r.opportunity.id === 1)!
    expect(gala).toMatchObject({ linked: null, suggested: { projectId: 'gala', sure: true } })
    expect(matches.jobs.gala).toMatchObject({ name: 'Autumn Gala', client: 'Brightwater Events', start: '2026-03-01' })

    const link = (links: unknown) => app.inject({ method: 'POST', url: '/api/rms/matches', payload: { links } })
    expect((await link([{ opportunityId: 1, projectId: 'gala' }, { opportunityId: 99, projectId: 'gala' }, { opportunityId: 3, projectId: 'gone' }])).json()).toEqual({ linked: 1 })
    expect((await link([{ opportunityId: 'x', projectId: 'gala' }])).statusCode).toBe(400)
    expect(((await app.inject({ url: '/api/rms/matches' })).json() as RmsMatches).rows.find((r) => r.opportunity.id === 1)!.linked).toBe('gala')

    expect((await app.inject({ url: '/api/rms/opportunities/1' })).json().job).toEqual({ id: 'gala', name: 'Autumn Gala' })
    const job = (await app.inject({ url: '/api/rms/jobs/gala' })).json()
    expect(job.opportunities.map((o: { number: string }) => o.number)).toEqual(['1043'])
    expect(job.client).toMatchObject({ quotes: 2, ahead: 1, decided: 2, winPct: 50, discountPct: 10 })

    await link([{ opportunityId: 1, projectId: null }])
    expect((await app.inject({ url: '/api/rms/jobs/gala' })).json().opportunities).toEqual([])
    expect((await app.inject({ url: '/api/rms/jobs/nope' })).statusCode).toBe(404)
  })

  it('says what a line was last charged to the job’s client and to anyone, by the names it goes by, and how each client went', async () => {
    const { app } = await setup()
    const asked = (await app.inject({ method: 'POST', url: '/api/rms/last-charged', payload: { projectId: 'gala', names: ['Robe Spiider', 'Audio Technician', 'Nothing like it'] } })).json() as RmsLastCharged
    expect(asked['robe spiider']).toMatchObject({ client: { priceCents: 6000, unitCents: 5400, discountPct: 10, number: '1043', on: '2026-03-01' }, any: { number: '1043' } })
    expect(asked['audio technician']).toMatchObject({ client: null, any: { priceCents: 40000, client: 'Other Co' } })
    expect(asked['nothing like it']).toBeUndefined()

    const clients = (await app.inject({ url: '/api/rms/clients' })).json() as RmsClientStats[]
    expect(clients.map((c) => [c.client, c.quotes, c.winPct])).toEqual([
      ['Brightwater Events Ltd', 2, 50],
      ['Other Co', 1, 100],
    ])
  })

  it('lists the past quotes by whether they went ahead, each with the job it’s linked to, for the Quotes page', async () => {
    const { app, db } = await setup()
    // Still to come, so open; and a quote whose days are past with no order, which didn't go ahead.
    await db.query(`INSERT INTO rms_opportunities (id, number, subject, client, state, status, starts_at, ends_at) VALUES (4, '1100', 'Next year', 'Other Co', 'Quotation', 'Provisional', '2099-01-01T10:00:00Z', '2099-01-01T10:00:00Z')`)
    await db.query(`INSERT INTO rms_opportunities (id, number, subject, client, state, status, starts_at, ends_at) VALUES (5, '0900', 'Long ago', 'Other Co', 'Quotation', 'Provisional', '2024-01-01T10:00:00Z', '2024-01-01T10:00:00Z')`)
    await app.inject({ method: 'POST', url: '/api/rms/matches', payload: { links: [{ opportunityId: 1, projectId: 'gala' }] } })
    const page = async (went = '') => {
      const res = await app.inject({ url: `/api/rms/opportunities?q=${went ? `&went=${went}` : ''}` })
      if (res.statusCode !== 200) throw new Error(res.body)
      return res.json()
    }
    const numbers = (p: { opportunities: { number: string }[] }) => p.opportunities.map((o) => o.number)
    expect(numbers(await page())).toEqual(['1100', '1043', '1001', '0990', '0900'])
    expect((await page()).links).toEqual({ 1: 'gala' })
    expect(numbers(await page('ahead'))).toEqual(['1043', '1001'])
    expect(numbers(await page('not'))).toEqual(['0990', '0900'])
    expect(numbers(await page('open'))).toEqual(['1100'])
    expect((await page('open')).total).toBe(1)
    expect(numbers(await page('sideways'))).toHaveLength(5)
  })

  it('puts the open quotes with no job here on the master calendar, and the office takes one off and puts it back (ADR 0134)', async () => {
    const { app, db } = await setup()
    const push = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      payload: {
        clientId: 'office',
        mutations: [
          m('project.create', { id: 'ball', name: 'Brightwater ball', clientId: 'bw', venueId: null, status: 'enquiry', notes: '' }),
          m('phase.add', { id: 'ball-show', projectId: 'ball', name: 'Show', start: '2099-02-01', end: '2099-02-01', venueId: null, notes: '' }),
        ],
      },
    })
    expect(push.json().results.every((r: { status: string }) => r.status === 'applied')).toBe(true)
    const opp = (id: number, subject: string, client: string, state: string, status: string, start: string, end = start) =>
      db.query(`INSERT INTO rms_opportunities (id, number, subject, client, state, status, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        id,
        `0000001${id}`,
        subject,
        client,
        state,
        status,
        `${start}T10:00:00Z`,
        `${end}T22:00:00Z`,
      ])
    await opp(10, 'Winter party', 'Nobody Ltd', 'Quotation', 'Provisional', '2099-01-10', '2099-01-11')
    await opp(11, 'Lost one', 'Nobody Ltd', 'Quotation', 'Lost', '2099-01-12')
    await opp(12, 'An order', 'Nobody Ltd', 'Order', 'Active', '2099-01-13')
    await opp(13, 'Long past', 'Nobody Ltd', 'Quotation', 'Provisional', '2024-01-14')
    await opp(14, 'Spring ball', 'Brightwater Events', 'Quotation', 'Provisional', '2099-02-01')
    await opp(15, 'Linked one', 'Nobody Ltd', 'Quotation', 'Reserved', '2099-01-15')
    await opp(16, 'Next year', 'Nobody Ltd', 'Quotation', 'Provisional', '2100-01-15')
    await app.inject({ method: 'POST', url: '/api/rms/matches', payload: { links: [{ opportunityId: 15, projectId: 'gala' }] } })

    const shown = async (from = '2020-01-01', to = '2099-12-31') => {
      const res = await app.inject({ url: `/api/rms/calendar?from=${from}&to=${to}` })
      if (res.statusCode !== 200) throw new Error(res.body)
      return res.json() as { id: number; start: string; end: string }[]
    }
    // Only the open one with no job like it: not lost, not an order, not past, not linked, not the ball we have, not outside the days asked.
    expect(await shown()).toEqual([{ id: 10, number: '000000110', subject: 'Winter party', client: 'Nobody Ltd', status: 'Provisional', start: '2099-01-10', end: '2099-01-11' }])
    expect(await shown('2099-01-11', '2099-01-11')).toHaveLength(1)
    expect(await shown('2099-01-12', '2099-01-31')).toEqual([])
    expect((await app.inject({ url: '/api/rms/calendar?from=2099-02-01&to=2099-01-01' })).statusCode).toBe(400)

    const aside = (id: number, to: unknown) => app.inject({ method: 'POST', url: `/api/rms/opportunities/${id}/aside`, payload: { aside: to } })
    expect((await aside(10, true)).json()).toEqual({ aside: true })
    expect(await shown()).toEqual([])
    expect((await app.inject({ url: '/api/rms/opportunities/10' })).json().aside).toBe(true)
    expect((await aside(10, 'yes')).statusCode).toBe(400)
    expect((await aside(999, true)).statusCode).toBe(404)
    expect((await aside(10, false)).json()).toEqual({ aside: false })
    expect((await shown()).map((q) => q.id)).toEqual([10])
    expect((await app.inject({ url: '/api/rms/opportunities/10' })).json().aside).toBe(false)
  })
})
