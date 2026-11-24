import { addDays, irishToday, newId, type CommandInput, type CommandName, type Mutation, type Project, type Quote, type QuoteLine } from '@sh/shared'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { pgliteDb } from '../src/db.ts'

/**
 * How long a job's quote holds (ADR 0194; Colly, 24 November 2026: "after double the quote period or if the quote is
 * cancelled"): the job carries it, worked out from its newest version sent, and is sent again whenever that changes, so
 * every device, sent money or not, holds the same kit for the same days.
 */

let cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn()
  cleanup = []
})

const today = irishToday()
const day = (n: number) => addDays(today, n)
const m = <N extends CommandName>(name: N, args: CommandInput<N>): Mutation => ({ id: newId(), name, args, createdAt: new Date().toISOString() }) as Mutation
const line = (): QuoteLine => ({ id: newId(), kind: 'kit', what: 'd&b Y10P', ref: null, group: 'Audio', qty: 8, days: 2, unitCents: 4500, vat: '23' })

async function ok(app: FastifyInstance, ...mutations: Mutation[]) {
  const res = await app.inject({ method: 'POST', url: '/api/sync/push', payload: { clientId: 'office', mutations } })
  for (const r of res.json().results) expect(r, JSON.stringify(r)).toMatchObject({ status: 'applied' })
}

async function company() {
  const db = await pgliteDb()
  const app = await buildApp({ db })
  cleanup.push(async () => {
    await app.close()
    await db.close()
  })
  await ok(
    app,
    m('client.upsert', { id: 'bw', name: 'Brightwater Events', contacts: [], notes: '' }),
    m('project.create', { id: 'gala', name: 'Autumn Gala', clientId: 'bw', venueId: null, status: 'quoted', notes: '' }),
    m('phase.add', { id: 'show', projectId: 'gala', name: 'Show', start: day(40), end: day(41), venueId: null, notes: '' })
  )
  const changes = async () => (await app.inject({ url: '/api/sync/pull?after=0' })).json().changes as { entity: string; id: string; data: unknown }[]
  const job = async (): Promise<Project> => (await changes()).filter((c) => c.entity === 'project' && c.id === 'gala').at(-1)!.data as Project
  const jobsSent = async () => (await changes()).filter((c) => c.entity === 'project' && c.id === 'gala').length
  const quote = async (id: string): Promise<Quote> => (await changes()).filter((c) => c.entity === 'quote' && c.id === id).at(-1)!.data as Quote
  return { app, job, jobsSent, quote }
}

describe("a job's quote hold (ADR 0194)", () => {
  it('holds nothing of its own until a quote is sent, and saving a draft sends no job', async () => {
    const { app, job, jobsSent } = await company()
    expect((await job()).quoteHold).toBeUndefined()
    const before = await jobsSent()
    await ok(app, m('quote.save', { id: 'v1', projectId: 'gala', lines: [line()], discountPct: 0, notes: '' }))
    await ok(app, m('quote.save', { id: 'v1', projectId: 'gala', lines: [line(), line()], discountPct: 0, notes: '' }))
    expect(await jobsSent()).toBe(before)
    expect((await job()).quoteHold).toBeUndefined()
  })

  it('sent, its prices hold for its valid days and its kit for twice as long, from the day it was sent', async () => {
    const { app, job } = await company()
    await ok(
      app,
      m('quote.save', { id: 'v1', projectId: 'gala', lines: [line()], discountPct: 0, notes: '', validDays: 14 }),
      m('quote.sent', { id: 'v1', on: day(-3) })
    )
    expect((await job()).quoteHold).toEqual({ validUntil: day(11), heldUntil: day(25) })
  })

  it('turned down holds nothing; the answer taken back holds again; a yes holds with no end', async () => {
    const { app, job } = await company()
    await ok(app, m('quote.save', { id: 'v1', projectId: 'gala', lines: [line()], discountPct: 0, notes: '' }), m('quote.sent', { id: 'v1', on: today }))
    await ok(app, m('quote.answer', { id: 'v1', answer: 'declined', on: today }))
    expect((await job()).quoteHold).toEqual({})
    await ok(app, m('quote.answer', { id: 'v1', answer: 'none', on: today }))
    expect((await job()).quoteHold).toEqual({ validUntil: day(30), heldUntil: day(60) })
    await ok(app, m('quote.answer', { id: 'v1', answer: 'accepted', on: today }))
    expect((await job()).quoteHold).toBeUndefined()
  })

  it('an amendment holds by the version the client has until it is sent itself, and taken back holds nothing', async () => {
    const { app, job, quote } = await company()
    await ok(app, m('quote.save', { id: 'v1', projectId: 'gala', lines: [line()], discountPct: 0, notes: '' }), m('quote.sent', { id: 'v1', on: day(-10) }))
    await ok(app, m('quote.save', { id: 'v2', projectId: 'gala', lines: [line()], discountPct: 0, notes: '', validDays: 10 }))
    expect((await job()).quoteHold).toEqual({ validUntil: day(20), heldUntil: day(50) })
    await ok(app, m('quote.sent', { id: 'v2', on: today }))
    expect((await job()).quoteHold).toEqual({ validUntil: day(10), heldUntil: day(20) })
    // An admin deletes both versions sent: the job's quote is taken back, so it holds no kit.
    for (const id of ['v2', 'v1']) await ok(app, m('quote.delete', { id, typed: String((await quote(id)).number) }))
    expect((await job()).quoteHold).toEqual({})
  })
})
