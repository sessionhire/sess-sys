import { describe, expect, it } from 'vitest'
import type { ProjectStatus } from '../src/jobs.ts'
import type { Entities, EntityName } from '../src/model.ts'
import type { Change, PullResponse, PushRequest, PushResponse } from '../src/protocol.ts'
import type { QuoteStatus } from '../src/quotes.ts'
import { MONEY_ENTITY_NAMES } from '../src/quotes.ts'
import { MemoryStorage, SyncClient, type Transport, type View } from '../src/sync/client.ts'
import { sellingLine } from '../src/sync/steps-view.ts'

/**
 * A job's quote task as a device reads it (ADR 0104), on one that's sent
 * money and on one that isn't (Move 3 of the sweep of 6 November 2026). A
 * role the server sends no money (ADR 0042) holds no quote, so it can't
 * tell a quote started from none: the task says the quote is with the
 * office rather than that there isn't one (ADR 0046 §8). The Jobs list's
 * line, the Board's card and the job's steps all read it from here.
 */

const TODAY = new Date('2026-10-20T09:00:00Z')
/** A day this many days from today. */
const day = (n: number) => new Date(Date.UTC(2026, 9, 20 + n)).toISOString().slice(0, 10)

/** A company's server, which leaves money out of what it sends a role that doesn't see it, as the real one does (ADR 0042). */
class Server implements Transport {
  seq = 0
  changes: Change[] = []
  constructor(private readonly sendsMoney: boolean) {}
  give<E extends EntityName>(entity: E, data: Entities[E] & { id: string }) {
    this.changes.push({ seq: ++this.seq, entity, id: data.id, op: 'put', data })
  }
  async push(req: PushRequest): Promise<PushResponse> {
    return { results: req.mutations.map((m) => ({ id: m.id, status: 'applied', seq: ++this.seq })) }
  }
  async pull(after: number): Promise<PullResponse> {
    const changes = this.changes.filter((c) => c.seq > after && (this.sendsMoney || !MONEY_ENTITY_NAMES.includes(c.entity)))
    return { changes, cursor: this.seq, more: false, ...(this.sendsMoney ? {} : { money: false }) }
  }
}

/** A job in ten days' time, with a quote in the state given, or none. */
function job(server: Server, id: string, status: ProjectStatus, quote?: QuoteStatus) {
  server.give('project', { id, name: id, clientId: null, venueId: null, status, notes: '' })
  server.give('phase', { id: `${id}-show`, projectId: id, name: 'Show', start: day(10), end: day(10), venueId: null, notes: '' })
  if (quote)
    server.give('quote', {
      id: `${id}-quote`,
      projectId: id,
      version: 1,
      status: quote,
      lines: [],
      discountPct: 0,
      notes: '',
      madeAt: `${day(-3)}T10:00:00Z`,
      savedAt: `${day(-3)}T10:00:00Z`,
      sentOn: quote === 'draft' ? null : day(-2),
      answeredOn: null,
      invoicedOn: null,
      invoiceRef: '',
      paidOn: null,
    })
}

/** The same company, as a device that's sent money and one that isn't sees it. */
async function phone(sendsMoney: boolean): Promise<View> {
  const server = new Server(sendsMoney)
  job(server, 'drafted', 'enquiry', 'draft')
  job(server, 'bare', 'enquiry')
  job(server, 'quoted', 'quoted', 'sent')
  const device = await new SyncClient({ storage: new MemoryStorage(), transport: server, clientId: 'phone', now: () => TODAY }).open()
  await device.sync()
  return device.view()
}

/** The quote's task: done in words, or how it stands. */
const quoteTask = (view: View, id: string) => {
  const quote = view.steps.of(id)!.steps.find((s) => s.key === 'quote')!
  return quote.auto ?? quote.hint
}

describe("a job's quote task", () => {
  it("says what the office has started, on a device that's sent the quotes", async () => {
    const office = await phone(true)
    expect(['drafted', 'bare', 'quoted'].map((id) => quoteTask(office, id))).toEqual(['A draft is started', 'No quote yet', 'Sent Sun 18 Oct'])
    expect(office.steps.of('bare')!.stage?.hint).toBe('No quote yet')
  })

  it("says it's with the office, never missing, on a device that isn't sent them", async () => {
    const head = await phone(false)
    // The quote started and the one not started read alike: this device can't tell them apart, and isn't meant to (ADR 0062).
    expect(head.money.quotesOf('drafted')).toEqual([])
    expect(['drafted', 'bare'].map((id) => quoteTask(head, id))).toEqual(['Quote: with the office', 'Quote: with the office'])
    // The line on the Jobs list and the Board's card, which read the stage's hint: the client's answer is still the job's own.
    expect(head.steps.of('bare')!.stage?.hint).toBe('Quote: with the office')
    expect(head.steps.of('drafted')!.current).toMatchObject({ key: 'quote', hint: 'Quote: with the office' })
    // A quoted job is done by its own status, never "Sent …", which the Board reads as the day the client was sent it.
    expect(quoteTask(head, 'quoted')).toBe('The job is quoted')
  })
})

describe('the selling line', () => {
  it('reads one sentence for where the quote stands, wherever the job is listed (Move 7 of the sweep of 6 November 2026)', async () => {
    const office = await phone(true)
    expect(office.steps.of('drafted')!.selling).toBe('Draft started')
    // Sent two days ago: with the client, not yet worth a call.
    expect(office.steps.of('quoted')!.selling).toBe('Quote with the client 2 days')
    expect(office.steps.of('quoted')!.stage?.hint).toBe('Quote with the client 2 days')
    expect(sellingLine({ lapsed: false, quoteHidden: false, answered: false, sentDays: 12, draft: false, unpriced: 0 })).toBe('Quote with the client 12 days · worth a call')
    expect(sellingLine({ lapsed: false, quoteHidden: false, answered: false, sentDays: undefined, draft: true, unpriced: 1 })).toBe('Draft started · 1 line needs a price')
    expect(sellingLine({ lapsed: true, quoteHidden: true, answered: false, sentDays: 3, draft: false, unpriced: 0 })).toBe('Dates passed, no answer')
    expect((await phone(false)).steps.of('quoted')!.selling).toBe('Quote: with the office')
  })
})
