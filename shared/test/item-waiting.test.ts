import { describe, expect, it } from 'vitest'
import type { Mutation } from '../src/commands.ts'
import type { Phase, Project } from '../src/jobs.ts'
import type { Movement } from '../src/moves.ts'
import { type Asset, type Model, PLAIN_PRODUCT } from '../src/stock.ts'
import { jobsView } from '../src/sync/jobs-view.ts'
import { kitView } from '../src/sync/kit-view.ts'
import { movesView } from '../src/sync/pick-view.ts'
import { warehouseView } from '../src/sync/stock-view.ts'

/**
 * An item's row and a scan's answer say "Waiting to sync" while a scan of
 * the item, or of a case it's in, is still on this device (UX sweep,
 * 6 November 2026, move 3): where the item is said to be comes from this
 * phone until the server has it and the copy has read it back. Counted kit
 * makes no item wait; its own count's answer waits on it instead.
 */

const TODAY = '2026-11-06'
const table = <T extends { id: string }>(rows: readonly T[]): Record<string, T> => Object.fromEntries(rows.map((r) => [r.id, r]))

const model = (id: string, name: string, extra: Partial<Model> = {}): Model => ({
  ...PLAIN_PRODUCT,
  aliases: [],
  id,
  name,
  department: 'audio',
  category: '',
  tracking: 'serialised',
  isCase: false,
  valueCents: null,
  notes: '',
  patMonths: null,
  liftingMonths: null,
  mistake: false,
  ...extra,
})
const asset = (id: string, modelId: string, caseId: string | null = null): Asset => ({
  id,
  modelId,
  number: `SH-${id.padStart(6, '0')}`,
  formerNumbers: [],
  serial: '',
  oldNumber: '',
  patDue: null,
  placeId: caseId ? null : 'bay',
  caseId,
  status: 'active',
  retiredReason: null,
  retiredNote: null,
  notes: '',
})
const project: Project = { id: 'j1', name: 'Corporate AGM', clientId: null, venueId: null, status: 'confirmed', notes: '' }
const phase: Phase = { id: 'ph1', projectId: 'j1', name: 'Show', start: '2026-11-06', end: '2026-11-07', venueId: null, notes: '' }

/** A mic case with two mics in it, a mic on its own, and counted cable. */
const models = [model('mic', 'Shure SM58'), model('case', 'Mic case', { isCase: true }), model('xlr', 'XLR 10 m', { tracking: 'bulk' })]
const assets = [asset('1', 'case'), asset('2', 'mic', '1'), asset('3', 'mic', '1'), asset('4', 'mic')]

const scan = (id: string, assetId: string | null, modelId: string, extra: Partial<Movement> = {}): Movement => ({
  id,
  projectId: 'j1',
  direction: 'out',
  assetId,
  modelId,
  qty: assetId ? 1 : 12,
  at: '2026-11-06T09:00:00.000Z',
  ...extra,
})
const sent = (m: Movement, appliedSeq?: number): Mutation & { appliedSeq?: number } => ({
  id: `mut-${m.id}`,
  name: 'move.record',
  args: { ...m, undoes: null },
  createdAt: m.at,
  ...(appliedSeq === undefined ? {} : { appliedSeq }),
})

function movesOf(movements: Movement[], outbox: (Mutation & { appliedSeq?: number })[], cursor: number) {
  const warehouse = warehouseView({ model: table(models), asset: table(assets), place: table([{ id: 'bay', name: 'Bay C3', notes: '' }]) }, [], 0)
  const jobs = jobsView({ project: table([project]), phase: table([phase]) }, [], 0, [])
  const kit = kitView({}, [], 0, jobs, warehouse, TODAY)
  return movesView({ movement: table(movements) }, outbox, cursor, jobs, warehouse, kit, TODAY)
}

const waitingOf = (moves: ReturnType<typeof movesOf>) => ['1', '2', '3', '4'].filter((id) => moves.waiting(id))

describe('an item waiting to sync', () => {
  it('is one scanned on this device and not sent, and nothing else', () => {
    const moves = movesOf([], [sent(scan('a', '4', 'mic'))], 0)
    expect(waitingOf(moves)).toEqual(['4'])
    // It reads as out with the job already: the row says so, and that it's this phone's word for now.
    expect(moves.outOf('4')?.projectId).toBe('j1')
  })

  it('is everything in a case scanned on this device, as the case took them along', () => {
    expect(waitingOf(movesOf([], [sent(scan('a', '1', 'case'))], 0))).toEqual(['1', '2', '3'])
    // One item scanned out of the case waits on its own; the case and the other item don't.
    expect(waitingOf(movesOf([], [sent(scan('a', '2', 'mic'))], 0))).toEqual(['2'])
  })

  it('still waits once the server has taken the scan, until the copy has read it back', () => {
    const m = scan('a', '4', 'mic')
    // Applied as change 7, with the copy read only to 6: the scan is still this phone's word.
    expect(waitingOf(movesOf([], [sent(m, 7)], 6))).toEqual(['4'])
    // Read back: the scan is in the copy, and nothing waits.
    const synced = movesOf([m], [sent(m, 7)], 7)
    expect(waitingOf(synced)).toEqual([])
    expect(synced.outOf('4')?.projectId).toBe('j1')
  })

  it('is no item for counted kit, or for a scan that came from the server', () => {
    expect(waitingOf(movesOf([], [sent(scan('a', null, 'xlr'))], 0))).toEqual([])
    expect(waitingOf(movesOf([scan('a', '1', 'case'), scan('b', '4', 'mic')], [], 0))).toEqual([])
  })
})

describe('a count waiting to sync', () => {
  it('is the product counted for the job on this device, until the copy has read it back', () => {
    const count = scan('a', null, 'xlr')
    const moves = movesOf([], [sent(count)], 0)
    expect(moves.countWaiting('j1', 'xlr')).toBe(true)
    expect(moves.countWaiting('j1', 'mic')).toBe(false)
    expect(moves.countWaiting('j2', 'xlr')).toBe(false)
    expect(movesOf([count], [sent(count, 3)], 3).countWaiting('j1', 'xlr')).toBe(false)
    // An item scanned is no count.
    expect(movesOf([], [sent(scan('b', '4', 'mic'))], 0).countWaiting('j1', 'mic')).toBe(false)
  })
})
