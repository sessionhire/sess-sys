import { describe, expect, it } from 'vitest'
import { marginMark, marginTargetOf, type QuoteLine } from '../src/index.ts'

// A line of own kit: one at €30 a day for a day, from a product worth €200.
const line = (c: Partial<QuoteLine> = {}): QuoteLine => ({ id: 'l', kind: 'kit', what: 'Amp', ref: null, group: 'Audio', qty: 1, days: 1, unitCents: 3_000, vat: '23', per: 'day', ...c }) as QuoteLine

describe('the margin target on a quote line (ADR 0188)', () => {
  it('measures what the line makes after its discount against a share of the value, a day', () => {
    // 10% of €200 is €20 a day.
    expect(marginMark(line(), 20_000, 10)).toBe('good')
    expect(marginMark(line({ discountPct: 33 }), 20_000, 10)).toBe('good')
    expect(marginMark(line({ discountPct: 40 }), 20_000, 10)).toBe('short')
    expect(marginMark(line({ discountPct: 66 }), 20_000, 10)).toBe('short')
    expect(marginMark(line({ discountPct: 70 }), 20_000, 10)).toBe('bad')
  })
  it('counts each one and each day charged, and once for a line charged once', () => {
    expect(marginMark(line({ qty: 2, days: 3, unitCents: 2_000 }), 20_000, 10)).toBe('good')
    expect(marginMark(line({ qty: 2, days: 3, unitCents: 1_500 }), 20_000, 10)).toBe('short')
    expect(marginMark(line({ per: 'once', days: 5, unitCents: 2_000 }), 20_000, 10)).toBe('good')
  })
  it('takes off what own kit costs to run', () => {
    expect(marginMark(line({ unitCents: 2_000 }), 20_000, 10)).toBe('good')
    expect(marginMark(line({ unitCents: 2_000 }), 20_000, 10, 20)).toBe('short')
  })
  it('leaves out what has nothing to measure by', () => {
    expect(marginMark(line(), null, 10)).toBeUndefined()
    expect(marginMark(line(), 20_000, null)).toBeUndefined()
    expect(marginMark(line({ subhireQty: 1 }), 20_000, 10)).toBeUndefined()
    expect(marginMark(line({ kind: 'crew' }), 20_000, 10)).toBeUndefined()
    expect(marginMark(line({ included: true }), 20_000, 10)).toBeUndefined()
  })
  it("takes the product's own target only when it's above the office's", () => {
    expect(marginTargetOf(10, 20)).toBe(20)
    expect(marginTargetOf(10, 5)).toBe(10)
    expect(marginTargetOf(null, 5)).toBe(5)
    expect(marginTargetOf(undefined, null)).toBeNull()
  })
})
