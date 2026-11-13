import { describe, expect, it } from 'vitest'
import { offerRateFor, ownRateAbove } from '../src/crew.ts'
import { quotedRateFor } from '../src/sync/quote-plan.ts'

/** A freelancer's own day rate (ADR 0167): paid where it's above the call's, the margin flagged where it's above what the job allowed. */
describe('own day rates', () => {
  const free = (dayRateCents: number | null) => ({ kind: 'freelancer' as const, dayRateCents })
  it('pays the higher of the call’s rate and their own, and never an own rate to staff', () => {
    expect(offerRateFor(25000, free(30000))).toBe(30000)
    expect(offerRateFor(25000, free(20000))).toBe(25000)
    expect(offerRateFor(25000, free(null))).toBe(25000)
    expect(offerRateFor(null, free(30000))).toBe(30000)
    expect(offerRateFor(null, free(null))).toBe(null)
    expect(offerRateFor(25000, { kind: 'staff', dayRateCents: 40000 })).toBe(25000)
  })
  it('flags an own rate above the call’s, or above the quote’s when the call has none', () => {
    expect(ownRateAbove(25000, 40000, free(30000))).toEqual({ own: 30000, allowed: 25000, against: 'call' })
    expect(ownRateAbove(25000, undefined, free(25000))).toBeUndefined()
    expect(ownRateAbove(null, 28000, free(30000))).toEqual({ own: 30000, allowed: 28000, against: 'quote' })
    expect(ownRateAbove(null, 35000, free(30000))).toBeUndefined()
    expect(ownRateAbove(null, undefined, free(30000))).toBeUndefined()
  })
  it('reads the quote’s price for a call: the line built from it, else one named for its role', () => {
    const lines = [
      { kind: 'crew', what: 'Audio tech (Show)', unitCents: 35000, ref: null },
      { kind: 'crew', what: 'Lighting tech', unitCents: 30000, ref: 'c2' },
      { kind: 'crew', what: 'Subsistence', unitCents: 4000, extra: 'subsistence' },
    ]
    expect(quotedRateFor(lines, { id: 'c1', role: 'Audio tech', phase: 'Show' })).toBe(35000)
    expect(quotedRateFor(lines, { id: 'c2', role: 'Anything' })).toBe(30000)
    expect(quotedRateFor(lines, { id: 'c3', role: 'Rigger' })).toBeUndefined()
  })
})
