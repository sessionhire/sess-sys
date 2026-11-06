import { describe, expect, it } from 'vitest'
import type { Project, ProjectStatus } from '../src/jobs.ts'
import type { Entities, EntityName } from '../src/model.ts'
import type { Change, PullResponse, PushRequest, PushResponse } from '../src/protocol.ts'
import { stepId } from '../src/steps.ts'
import { PLAIN_PRODUCT } from '../src/stock.ts'
import { MemoryStorage, SyncClient, type Transport, type View } from '../src/sync/client.ts'
import { answersHeading, listHeading, standing, STANDING_HEADINGS, type StandingKey } from '../src/sync/standing.ts'
import { kitToCheckBackIn } from '../src/sync/steps-view.ts'

/**
 * One count, one list (Move 3 of the sweep of 6 November 2026): every count
 * Home and the areas' rows show is the length of a list worked out in one
 * place, and the list it opens is that same list, under the same words.
 * Kit to check back in is ADR 0109's Back in rule: lines out and not
 * scanned back, or on the pick list and never scanned out, with the days
 * since the job ended. The lists of a whole company, each with something in
 * it, are checked against the screens they open on the server's own
 * records (server/test/standing.test.ts), and each count on Home is tapped
 * in the browser (e2e/home.spec.ts).
 */

const TODAY = new Date('2026-10-20T09:00:00Z')
const today = '2026-10-20'
/** A day this many days from today. */
const day = (n: number) => new Date(Date.UTC(2026, 9, 20 + n)).toISOString().slice(0, 10)

class Server implements Transport {
  seq = 0
  changes: Change[] = []
  /** A record as the server sends it, checked against its entity's own type. */
  give<E extends EntityName>(entity: E, data: Entities[E] & { id: string }) {
    this.changes.push({ seq: ++this.seq, entity, id: data.id, op: 'put', data })
  }
  async push(req: PushRequest): Promise<PushResponse> {
    return { results: req.mutations.map((m) => ({ id: m.id, status: 'applied', seq: ++this.seq })) }
  }
  async pull(after: number): Promise<PullResponse> {
    return { changes: this.changes.filter((c) => c.seq > after), cursor: this.seq, more: false }
  }
}

/** How much kit a job has, how much of it was scanned out and how much back, and what kind of job it is. */
interface Kit {
  kit?: number
  out?: number
  back?: number
  kind?: Project['kind']
}

/** A job over the days given, from and to, or with no dates at all. */
function job(server: Server, id: string, name: string, status: ProjectStatus, days: readonly [number, number] | undefined, { kit = 0, out = 0, back = 0, kind }: Kit = {}) {
  server.give('project', { id, name, clientId: null, venueId: null, status, notes: '', ...(kind ? { kind } : {}) })
  if (days) server.give('phase', { id: `${id}-show`, projectId: id, name: 'Show', start: day(days[0]), end: day(days[1]), venueId: null, notes: '' })
  if (kit) server.give('kitLine', { id: `${id}-xlr`, projectId: id, phaseId: null, modelId: 'xlr', qty: kit, subhireQty: 0, supplier: '', notes: '' })
  const [from, to] = days ?? [-5, -5]
  const move = (direction: 'out' | 'in', qty: number, at: number) =>
    server.give('movement', { id: `${id}-${direction}`, projectId: id, direction, assetId: null, modelId: 'xlr', qty, at: `${day(at)}T08:00:00Z` })
  if (out) move('out', out, from - 1)
  if (back) move('in', back, Math.min(to + 1, 0))
}

/** Back in ticked by hand on a job, yesterday evening. */
const ticked = (server: Server, projectId: string) =>
  server.give('jobStep', { id: stepId(projectId, 'back'), projectId, step: 'back', ownerId: null, dueOn: null, doneAt: `${day(-1)}T17:00:00Z`, doneBy: null })

async function company(): Promise<View> {
  const server = new Server()
  server.give('model', {
    ...PLAIN_PRODUCT,
    aliases: [],
    id: 'xlr',
    name: 'XLR 10m',
    department: 'audio',
    category: 'Cable',
    tracking: 'bulk',
    isCase: false,
    valueCents: null,
    notes: '',
    patMonths: null,
    liftingMonths: null,
    mistake: false,
  })
  server.give('place', { id: 'bay', name: 'Bay A1', notes: '' })
  server.give('stock', { id: 'xlr:bay', modelId: 'xlr', placeId: 'bay', caseId: null, qty: 200 })
  job(server, 'liffey', 'Liffey Swim', 'confirmed', [-5, -4], { kit: 27, out: 27, back: 24 })
  job(server, 'vartry', 'Vartry Fair', 'confirmed', [-2, -1], { kit: 5 })
  job(server, 'fergus', 'Fergus Regatta', 'confirmed', [-3, -3], { kit: 23 })
  // Never scanned, and over a fortnight ago: through (ADR 0109).
  job(server, 'inny', 'Inny Gala', 'confirmed', [-21, -20], { kit: 56 })
  // Scanned out and never back: it never settles.
  job(server, 'owenmore', 'Owenmore Ball', 'confirmed', [-21, -20], { kit: 4, out: 4 })
  // Kit out with a job since cancelled, or lost, or with no dates: still out, with no Back to be in, and nothing to say when it's due.
  job(server, 'slaney', 'Slaney Dinner', 'cancelled', [-6, -6], { kit: 2, out: 2 })
  job(server, 'lagan', 'Lagan Dinner', 'lost', [-8, -8], { kit: 3, out: 3 })
  job(server, 'erne', 'Erne Fair', 'confirmed', undefined, { kit: 2, out: 2 })
  // Over with no kit: nothing to check back in.
  job(server, 'moy', 'Moy Talk', 'confirmed', [-2, -2])
  // An errand has no Back, so kit on it never scanned out isn't asked after; kit scanned out and not back still is.
  job(server, 'bann', 'Bann Errand', 'confirmed', [-3, -3], { kit: 4, kind: 'errand' })
  job(server, 'lee', 'Lee Errand', 'confirmed', [-3, -3], { kit: 2, out: 2, kind: 'errand' })
  // Back in ticked by hand: done, unless the scans say kit is still out.
  job(server, 'foyle', 'Foyle Gig', 'confirmed', [-2, -2], { kit: 6 })
  ticked(server, 'foyle')
  job(server, 'shannon', 'Shannon Gig', 'confirmed', [-6, -6], { kit: 4, out: 4 })
  ticked(server, 'shannon')
  job(server, 'boyne', 'Boyne Run', 'confirmed', [-4, -3], { kit: 6, out: 6, back: 6 })
  job(server, 'suir', 'Suir Week', 'confirmed', [-1, 2], { kit: 8, out: 8 })
  job(server, 'tay', 'Tay Launch', 'confirmed', [1, 1], { kit: 6 })
  job(server, 'tamar', 'Tamar Show', 'confirmed', [3, 3], { kit: 6 })
  // Still being sold after their dates (ADR 0109).
  job(server, 'nore', 'Nore Concert', 'enquiry', [-10, -10])
  job(server, 'barrow', 'Barrow Talk', 'quoted', [-2, -2])
  const phone = await new SyncClient({ storage: new MemoryStorage(), transport: server, clientId: 'phone', now: () => TODAY }).open()
  await phone.sync()
  return phone.view()
}

describe('kit to check back in', () => {
  it("lists the jobs whose Back in is open, kit out and not scanned back or never scanned out, the latest ended first, late past their days and two more", async () => {
    const view = await company()
    const rows = kitToCheckBackIn(view.jobs, view.steps, view.moves, today).map((k) => [k.job.name, k.said, k.when, k.late])
    expect(rows).toEqual([
      ['Vartry Fair', "5 never scanned out: check they're back", 'ended yesterday', false],
      ['Fergus Regatta', "23 never scanned out: check they're back", 'ended 3 days ago', false],
      ['Lee Errand', '2 of 2 not scanned back', 'ended 3 days ago', false],
      ['Liffey Swim', '3 of 27 not scanned back', 'ended 4 days ago', true],
      ['Shannon Gig', '4 of 4 not scanned back', 'ended 6 days ago', true],
      ['Slaney Dinner', '2 of 2 not scanned back', 'job cancelled', true],
      ['Lagan Dinner', '3 of 3 not scanned back', 'job lost', true],
      ['Owenmore Ball', '4 of 4 not scanned back', 'ended 20 days ago', true],
      ['Erne Fair', '2 of 2 not scanned back', 'no dates', true],
    ])
    // Each job in Back with its Back in task to do is on it, so the Board and Home agree on which.
    const backIn = view.jobs.jobs.filter((j) => {
      const at = view.steps.of(j.id)
      return at?.stage?.key === 'back' && at.steps.some((s) => s.key === 'back' && !s.done && !s.skipped)
    })
    expect(backIn.map((j) => j.id).sort()).toEqual(['fergus', 'liffey', 'owenmore', 'vartry'])
    // Kit scanned out and not back by the old reading is on it too, whatever the job: cancelled, lost, an errand, no dates, or ticked by hand.
    const ids = rows.map(([name]) => view.jobs.jobs.find((j) => j.name === name)!.id)
    for (const p of view.moves.stillOut) expect(ids).toContain(p.job.id)
    expect(view.moves.stillOut.map((p) => p.job.id).sort()).toEqual(['erne', 'lagan', 'lee', 'liffey', 'owenmore', 'shannon', 'slaney'])
  })
})

describe('how things stand', () => {
  it("is one list for each count, read alike wherever it's drawn, and a department's leaves out the jobs' own", async () => {
    const view = await company()
    const lists = standing(view, today)
    // Home's tile, Home › Warehouse, Stock's list and the Board's Back column all read this one.
    expect(lists['still-out'].map((k) => k.job.id)).toEqual(kitToCheckBackIn(view.jobs, view.steps, view.moves, today).map((k) => k.job.id))
    expect(lists['still-out']).toBe(lists['still-out'])
    // Home's count of dates passed is the Board's fold, the most recent first.
    expect(lists['no-answer'].map((s) => s.job.id)).toEqual(['barrow', 'nore'])
    // To pick: today's or tomorrow's with kit still to go out, not a job on now with all of it out, nor one later in the fortnight.
    expect(view.moves.soon.map((p) => p.job.id)).toEqual(['suir', 'tay', 'tamar'])
    expect(lists['to-pick'].map((p) => p.job.id)).toEqual(['tay'])
    // Being planned with the next task down to nobody: the jobs to come, not those over.
    expect(lists['tasks-nobody'].map((s) => s.job.id)).toEqual(['tay', 'tamar'])
    // A department's counts leave out the jobs' own: kit still out, tasks and dates passed are the job's, not a department's.
    const lx = standing(view, today, { department: 'LX' })
    expect([lx['still-out'].length, lx['no-answer'].length, lx['tasks-nobody'].length, lx['tasks-late'].length]).toEqual([0, 0, 0, 0])
  })

  it('heads each list a count lands on with its words and the same number', () => {
    expect(listHeading(STANDING_HEADINGS.faults, 15)).toBe('Repairs open (15)')
    expect(listHeading(STANDING_HEADINGS['to-pick'], 1_204)).toBe('To pick for today or tomorrow (1,204)')
    // Answers to check carries both counts that open it, the answers' first; with none, whoever is running late, the rows under it.
    expect(answersHeading(73, 1)).toBe('Answers to check (73) · 1 running late')
    expect(answersHeading(73, 0)).toBe('Answers to check (73)')
    expect(answersHeading(0, 2)).toBe('Answers to check (2)')
    expect(answersHeading(0, 0)).toBe('Answers to check (0)')
    // Every count lands on a heading of its own but the jobs' tasks, which open the Jobs list on its filters.
    const unheaded = (Object.keys(STANDING_HEADINGS) as StandingKey[]).filter((k) => !STANDING_HEADINGS[k])
    expect(unheaded).toEqual(['tasks-late', 'tasks-nobody'])
  })
})
