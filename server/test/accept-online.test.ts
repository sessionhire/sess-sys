import { addDays, irishToday, newId, type CommandInput, type CommandName, type HistoryPage, type Mutation, type Quote, type QuoteLine } from '@sh/shared'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { pgliteDb } from '../src/db.ts'

/**
 * The client accepts a quote online (ADR 0121): each version's own link,
 * which shows nothing and takes nothing until the office turns it on, then
 * shows the quote and takes a name and a tick, once, on the version with
 * the client while its prices hold.
 */

let cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn()
  cleanup = []
})

const today = irishToday()
const day = (n: number) => addDays(today, n)
const m = <N extends CommandName>(name: N, args: CommandInput<N>): Mutation => ({ id: newId(), name, args, createdAt: new Date().toISOString() }) as Mutation
const line = (l: Partial<QuoteLine> = {}): QuoteLine => ({ id: newId(), kind: 'kit', what: 'd&b Y10P', ref: null, group: 'Audio', qty: 8, days: 2, unitCents: 4500, vat: '23', ...l })

async function ok(app: FastifyInstance, ...mutations: Mutation[]) {
  const res = await app.inject({ method: 'POST', url: '/api/sync/push', payload: { clientId: 'office', mutations } })
  for (const r of res.json().results) expect(r, JSON.stringify(r)).toMatchObject({ status: 'applied' })
}

async function sent() {
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
    m('phase.add', { id: 'show', projectId: 'gala', name: 'Show', start: day(20), end: day(21), venueId: null, notes: '' }),
    m('quote.save', { id: 'v1', projectId: 'gala', lines: [line()], discountPct: 0, notes: '' }),
    m('quote.sent', { id: 'v1', on: today })
  )
  const quote = async (id: string): Promise<Quote> =>
    (await app.inject({ url: '/api/sync/pull?after=0' })).json().changes.filter((c: { entity: string; id: string }) => c.entity === 'quote' && c.id === id).at(-1).data
  const accept = (token: string, form: Record<string, string>) =>
    app.inject({ method: 'POST', url: `/q/${token}`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams(form).toString() })
  return { app, quote, accept }
}

describe("a quote's own link for the client (ADR 0121)", () => {
  it('has a key from the start, and shows nothing and takes nothing while the office has it off', async () => {
    const { app, quote, accept } = await sent()
    const token = (await quote('v1')).acceptToken!
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/)
    const page = await app.inject({ url: `/q/${token}` })
    expect(page.statusCode).toBe(404)
    expect(page.body).toContain("Quotes can't be accepted online just now")
    expect(page.body).not.toContain('Autumn Gala')
    expect((await app.inject({ url: `/q/${token}/pdf` })).statusCode).toBe(404)
    expect((await accept(token, { name: 'Aoife Byrne', agree: 'yes' })).statusCode).toBe(404)
    expect(await quote('v1')).toMatchObject({ status: 'sent' })
    // A key that isn't one says nothing of whether the switch is on.
    expect((await app.inject({ url: '/q/not-a-real-key-at-all-here' })).body).toContain("This link doesn't open a quote")
  })

  it('once on, shows the quote and takes a name and a tick, once, into the history', async () => {
    const { app, quote, accept } = await sent()
    await ok(app, m('quoting.online', { on: true }))
    const token = (await quote('v1')).acceptToken!
    const page = await app.inject({ url: `/q/${token}` })
    expect(page.statusCode).toBe(200)
    expect(page.headers['cache-control']).toBe('no-store')
    expect(page.body).toContain('Autumn Gala')
    expect(page.body).toContain('Accept the quote')
    expect((await app.inject({ url: `/q/${token}/pdf` })).headers['content-type']).toBe('application/pdf')

    // Said under the field, with what was typed kept.
    const noName = await accept(token, { name: ' x ', agree: 'yes' })
    expect(noName.statusCode).toBe(422)
    expect(noName.body).toContain('Type your full name')
    const noTick = await accept(token, { name: 'Aoife Byrne' })
    expect(noTick.statusCode).toBe(422)
    expect(noTick.body).toContain('Tick the box')
    expect(noTick.body).toContain('value="Aoife Byrne"')
    expect(await quote('v1')).toMatchObject({ status: 'sent' })

    const yes = await accept(token, { name: '  Aoife   Byrne ', agree: 'yes' })
    expect(yes.statusCode).toBe(303)
    expect(await quote('v1')).toMatchObject({ status: 'accepted', answeredOn: today, acceptedOnline: { name: 'Aoife Byrne' } })
    const after = await app.inject({ url: `/q/${token}` })
    expect(after.body).toContain('Accepted by Aoife Byrne')
    expect(after.body).not.toContain('Accept the quote</button>')
    // A second press is a yes, and changes nothing.
    expect((await accept(token, { name: 'Someone Else', agree: 'yes' })).statusCode).toBe(303)
    expect((await quote('v1')).acceptedOnline).toMatchObject({ name: 'Aoife Byrne' })

    const history: HistoryPage = (await app.inject({ url: '/api/history?limit=10' })).json()
    expect(history.entries.map((e) => e.what)).toContain('Aoife Byrne accepted version 1 of the quote for Autumn Gala online, for the client')
    expect(history.entries.filter((e) => e.command === 'quote.acceptedOnline')).toHaveLength(1)

    // The office taking the answer back takes the name with it, and the link asks again.
    await ok(app, m('quote.answer', { id: 'v1', answer: 'none', on: today }))
    expect((await quote('v1')).acceptedOnline).toBeUndefined()
    expect((await app.inject({ url: `/q/${token}` })).body).toContain('Accept the quote')
  })

  it('takes nothing on a version replaced by a newer one, or whose prices have stopped holding', async () => {
    const { app, quote, accept } = await sent()
    await ok(app, m('quoting.online', { on: true }))
    const old = (await quote('v1')).acceptToken!
    await ok(app, m('quote.save', { id: 'v2', projectId: 'gala', lines: [line({ qty: 10 })], discountPct: 0, notes: '' }), m('quote.sent', { id: 'v2', on: today }))
    const page = await app.inject({ url: `/q/${old}` })
    expect(page.body).toContain("There's a newer version of this quote")
    expect((await accept(old, { name: 'Aoife Byrne', agree: 'yes' })).statusCode).toBe(409)
    expect(await quote('v1')).toMatchObject({ status: 'sent' })

    // Version 2, sent 40 days ago with 30 days' hold, has run out.
    await ok(app, m('quote.save', { id: 'v3', projectId: 'gala', lines: [line({ qty: 12 })], discountPct: 0, notes: '' }), m('quote.sent', { id: 'v3', on: day(-40) }))
    const lapsed = (await quote('v3')).acceptToken!
    expect((await app.inject({ url: `/q/${lapsed}` })).body).toContain('The prices on this quote held until')
    expect((await accept(lapsed, { name: 'Aoife Byrne', agree: 'yes' })).statusCode).toBe(409)
  })
})
