import { describe, expect, it } from 'vitest'
import { draftBase, lineMark, mergeDraft, type QuoteLine } from '../src/index.ts'

const line = (id: string, what: string, qty = 1): QuoteLine => ({ id, kind: 'kit', what, ref: null, group: 'Audio', qty, days: 1, unitCents: 1000, vat: '23' })
const draft = (lines: QuoteLine[], more: Partial<{ discountPct: number; notes: string; agreedCents: number | null }> = {}) => ({
  lines,
  discountPct: 0,
  notes: '',
  validDays: 30,
  depositPct: null,
  agreedCents: null,
  mealsProvided: false,
  travelKm: null,
  ...more,
})

describe('two people on one draft (ADR 0113)', () => {
  const a = line('a', 'Y10P', 4)
  const b = line('b', 'SM58', 2)
  const c = line('c', 'DI box', 1)
  const base = draftBase(draft([a, b, c]))

  it('reads a line left out as its default the same as one that says it', () => {
    expect(lineMark({ ...a, per: 'day', discountPct: 0 })).toBe(lineMark(a))
    expect(lineMark({ ...a, qty: 5 })).not.toBe(lineMark(a))
  })

  it("keeps a line changed elsewhere that this save didn't touch, and the line this save changed", () => {
    const now = draft([{ ...a, qty: 8 }, b, c])
    const { save, both } = mergeDraft(now, draft([a, { ...b, qty: 3 }, c]), base)
    expect(save.lines.map((l) => [l.id, l.qty])).toEqual([
      ['a', 8],
      ['b', 3],
      ['c', 1],
    ])
    expect(both).toEqual([])
  })

  it('keeps a line added elsewhere where it was put, and one added here', () => {
    const now = draft([a, line('x', 'Hazer'), b, c])
    const { save } = mergeDraft(now, draft([a, b, c, line('y', 'Smoke fluid')]), base)
    expect(save.lines.map((l) => l.id)).toEqual(['a', 'x', 'b', 'c', 'y'])
  })

  it("leaves off a line taken off elsewhere, unless it was changed here, and a line taken off here stays off", () => {
    const now = draft([a, c])
    expect(mergeDraft(now, draft([a, b, c]), base).save.lines.map((l) => l.id)).toEqual(['a', 'c'])
    expect(mergeDraft(now, draft([a, { ...b, qty: 6 }, c]), base).save.lines.map((l) => l.id)).toEqual(['a', 'b', 'c'])
    expect(mergeDraft(draft([a, b, { ...c, qty: 2 }]), draft([a, b]), base).save.lines.map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('a line changed on both is the later save, and is named', () => {
    const { save, both } = mergeDraft(draft([{ ...a, qty: 8 }, b, c]), draft([{ ...a, qty: 6 }, b, c]), base)
    expect(save.lines[0]!.qty).toBe(6)
    expect(both).toEqual(['a'])
  })

  it('takes terms changed elsewhere that the save left as they were', () => {
    const now = draft([a, b, c], { discountPct: 10, notes: 'Doors at 7' })
    const { save } = mergeDraft(now, draft([a, b, c], { agreedCents: 50000 }), base)
    expect(save).toMatchObject({ discountPct: 10, notes: 'Doors at 7', agreedCents: 50000 })
  })
})
