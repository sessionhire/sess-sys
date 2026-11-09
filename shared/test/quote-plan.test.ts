import { describe, expect, it } from 'vitest'
import { callsFromQuote, FROM_THE_QUOTE, kitToMatch, workDays } from '../src/sync/quote-plan.ts'

/** The quote is the job's plan (ADR 0126): its kit pencilled on the job, its crew as calls, its days the days worked. */

describe('workDays', () => {
  it('counts each day of the phases once, leaving out the gap between them', () => {
    const build = { start: '2026-11-13', end: '2026-11-13' }
    const show = { start: '2026-11-20', end: '2026-11-21' }
    expect(workDays({ phases: [build, show], span: { start: '2026-11-13', end: '2026-11-21' } })).toBe(3)
  })
  it('counts days two phases share once', () => {
    expect(workDays({ phases: [{ start: '2026-11-10', end: '2026-11-12' }, { start: '2026-11-12', end: '2026-11-13' }] })).toBe(4)
  })
  it('is 1 for a job with no days yet', () => {
    expect(workDays({ phases: [] })).toBe(1)
  })
})

const kit = (id: string, modelId: string, qty: number, notes = FROM_THE_QUOTE, phaseId: string | null = null, subhireQty = 0) => ({ id, modelId, qty, subhireQty, phaseId, notes })
const line = (modelId: string, qty: number) => ({ kind: 'kit', modelId, qty })
const none = () => undefined

describe('kitToMatch', () => {
  it('adds what the quote wants that the list has not got', () => {
    expect(kitToMatch([line('d20', 4)], none, [kit('a', 'd20', 1)])).toEqual({ add: [{ modelId: 'd20', qty: 3, subhireQty: 0, supplier: '' }], change: [], remove: [] })
  })
  it('takes back what the quote put on and no longer wants', () => {
    expect(kitToMatch([], none, [kit('a', 'd20', 4)])).toEqual({ add: [], change: [], remove: ['a'] })
  })
  it('brings a line down when the quote wants fewer', () => {
    expect(kitToMatch([line('d20', 2)], none, [kit('a', 'd20', 4, FROM_THE_QUOTE, null, 3)])).toEqual({ add: [], change: [{ id: 'a', qty: 2, subhireQty: 2 }], remove: [] })
  })
  it('never touches kit added by hand or for a phase', () => {
    expect(kitToMatch([], none, [kit('a', 'd20', 4, ''), kit('b', 'd20', 2, FROM_THE_QUOTE, 'show')])).toEqual({ add: [], change: [], remove: [] })
  })
  it('takes from its own lines before anything else, newest first', () => {
    const r = kitToMatch([line('d20', 3)], none, [kit('hand', 'd20', 2, ''), kit('q1', 'd20', 2), kit('q2', 'd20', 2)])
    expect(r).toEqual({ add: [], change: [{ id: 'q1', qty: 1, subhireQty: 0 }], remove: ['q2'] })
  })
  it("counts a package's kit as the quote's", () => {
    const items = (id: string) => (id === 'pack' ? [{ modelId: 'sm58', qty: 4 }] : undefined)
    expect(kitToMatch([{ kind: 'kit', packageId: 'pack', qty: 2 }], items, [kit('a', 'sm58', 8)])).toEqual({ add: [], change: [], remove: [] })
  })
})

describe('callsFromQuote', () => {
  const crew = (what: string, qty: number) => ({ kind: 'crew', what, qty })
  it('makes a call for each role on the quote that the job has not asked for', () => {
    expect(callsFromQuote([crew('Sound No.1', 2), crew('Lighting tech', 1), { kind: 'kit', what: 'D20', qty: 4 }], [])).toEqual([
      { role: 'Sound No.1', needed: 2 },
      { role: 'Lighting tech', needed: 1 },
    ])
  })
  it('counts the calls already made for the role, in any case, and not cancelled ones', () => {
    const calls = [
      { role: 'sound no.1', needed: 1, status: 'open' },
      { role: 'Sound No.1', needed: 5, status: 'cancelled' },
    ]
    expect(callsFromQuote([crew('Sound No.1', 2), crew('Sound No.1 ', 1)], calls)).toEqual([{ role: 'Sound No.1', needed: 2 }])
  })
  it('asks for nothing once the calls cover the quote', () => {
    expect(callsFromQuote([crew('Rigger', 2)], [{ role: 'Rigger', needed: 3, status: 'open' }])).toEqual([])
  })
})
