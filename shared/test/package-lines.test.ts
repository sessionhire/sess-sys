import { describe, expect, it } from 'vitest'
import { inRacks, kitFromQuote, linesByGroup, linesUnder, lineSaving, needsPrice, packageSaving, packageWorth, quoteWants, setCents, withNewIds, type QuoteLine } from '../src/index.ts'

/**
 * A package is a shortcut for its kit (ADR 0116): its line on the quote with each product a line under it, and a rack
 * with what's built into it under it.
 */

const line = (l: Partial<QuoteLine> & { id: string }): QuoteLine => ({ kind: 'kit', what: l.id, ref: null, group: 'Audio', qty: 1, days: 1, unitCents: 0, vat: '23', per: 'day', modelId: null, ...l }) as QuoteLine

describe('a package with its kit under it', () => {
  const byKit = [
    line({ id: 'pkg', what: 'Mic package', packageId: 'mics' }),
    line({ id: 'sm58', modelId: 'sm58', qty: 4, unitCents: 1_000, under: 'pkg' }),
    line({ id: 'di', modelId: 'di', qty: 2, unitCents: 500, under: 'pkg' }),
    line({ id: 'desk', modelId: 'desk', unitCents: 20_000 }),
  ]
  it('lists its kit under its line, not in a group of its own', () => {
    expect(linesByGroup(byKit).map((g) => g.lines.map((l) => l.id))).toEqual([['pkg', 'desk']])
    expect(linesUnder(byKit, 'pkg').map((l) => l.id)).toEqual(['sm58', 'di'])
  })
  it('comes to what its kit comes to when it has no price of its own', () => {
    expect(setCents(byKit[0]!, byKit)).toBe(5_000)
    expect(byKit.filter((l) => needsPrice(l, byKit))).toEqual([])
  })
  it('includes its kit in its price when it has one', () => {
    const whole = [line({ id: 'pkg', packageId: 'mics', unitCents: 8_000 }), line({ id: 'sm58', modelId: 'sm58', qty: 4, under: 'pkg' })]
    expect(setCents(whole[0]!, whole)).toBe(8_000)
    expect(whole.filter((l) => needsPrice(l, whole))).toEqual([])
  })
  it('wants its kit as lines, not what the package holds now', () => {
    const now = () => [{ modelId: 'other', qty: 9 }]
    expect([...quoteWants(byKit, now)]).toEqual([
      ['sm58', 4],
      ['di', 2],
      ['desk', 1],
    ])
    expect(kitFromQuote(byKit, now, []).map((k) => [k.modelId, k.qty])).toEqual([
      ['sm58', 4],
      ['di', 2],
      ['desk', 1],
    ])
  })
  it('keeps each line under its package when the lines get new ids', () => {
    let n = 0
    const fresh = withNewIds(byKit, () => `n${++n}`)
    expect(fresh.map((l) => [l.id, l.under])).toEqual([
      ['n1', undefined],
      ['n2', 'n1'],
      ['n3', 'n1'],
      ['n4', undefined],
    ])
  })
  it('lists a line whose package line has gone as a line of its own', () => {
    expect(linesByGroup([byKit[1]!]).map((g) => g.lines.length)).toEqual([1])
  })
})

describe('a rack with what is built into it under it', () => {
  const lines = [line({ id: 'rack', modelId: 'monitor-rack', unitCents: 15_000 }), line({ id: 'amp', modelId: 'amp', qty: 2, under: 'rack' })]
  it('wants the rack, not what is built into it, which goes with it', () => {
    expect([...inRacks(lines)].map((l) => l.id)).toEqual(['amp'])
    expect([...quoteWants(lines, () => undefined)]).toEqual([['monitor-rack', 1]])
    expect(kitFromQuote(lines, () => undefined, []).map((k) => k.modelId)).toEqual(['monitor-rack'])
  })
  it('needs no price for what is built into it, whatever the rack’s', () => {
    const unpriced = [{ ...lines[0]!, unitCents: 0 }, lines[1]!]
    expect(unpriced.filter((l) => needsPrice(l, unpriced)).map((l) => l.id)).toEqual(['rack'])
  })
})

describe('a package starts at its items’ total, and its own price is a discount from it', () => {
  const prices: Record<string, { cents?: number; rate?: 'daily' | 'week3' | 'weekly' }> = {
    sm58: { cents: 1_000 },
    di: { cents: 500, rate: 'week3' },
    sub: { cents: 20_000, rate: 'weekly' },
    gaff: {},
  }
  const priceOf = (id: string) => prices[id] ?? {}
  it('adds up its items for its own unit, a day or a week', () => {
    expect(packageWorth({ items: [{ modelId: 'sm58', qty: 4 }, { modelId: 'di', qty: 2 }] }, priceOf)).toEqual({ cents: 5_000, unpriced: 0 })
    expect(packageWorth({ rate: 'weekly', items: [{ modelId: 'sub', qty: 2 }, { modelId: 'sm58', qty: 1 }] }, priceOf)).toEqual({ cents: 40_000, unpriced: 1 })
    expect(packageWorth({ items: [{ modelId: 'gaff', qty: 1 }, { modelId: 'sub', qty: 1 }] }, priceOf)).toEqual({ cents: 0, unpriced: 2 })
  })
  it('says what a lower price takes off, and nothing for one at or above the total', () => {
    expect(packageSaving(5_000, 4_000)).toEqual({ cents: 1_000, pct: 20 })
    expect(packageSaving(3_000, 2_000)).toEqual({ cents: 1_000, pct: 33.3 })
    expect(packageSaving(5_000, 5_000)).toBeUndefined()
    expect(packageSaving(5_000, 0)).toBeUndefined()
  })
  it('saves on its line for its days and how many, before the line’s own discount', () => {
    const l = line({ id: 'pkg', packageId: 'mics', unitCents: 4_000, fullCents: 5_000, qty: 2, days: 3 })
    expect(lineSaving(l)).toBe(6_000)
    expect(lineSaving({ ...l, per: 'once' })).toBe(2_000)
    expect(lineSaving({ ...l, unitCents: 6_000 })).toBe(0)
    expect(lineSaving({ ...l, fullCents: undefined })).toBe(0)
  })
})
