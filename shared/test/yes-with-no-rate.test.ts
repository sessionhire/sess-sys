import { describe, expect, it } from 'vitest'
import { yesWithNoRate } from '../src/crew.ts'

/** A freelancer's yes with no day rate agreed is asked about before it's confirmed (user flows of 13 November 2026, finding 3). */
describe('a yes with no rate', () => {
  it("asks first for a freelancer's yes with no rate agreed, and not otherwise", () => {
    const freelancer = { kind: 'freelancer' as const }
    expect(yesWithNoRate({ status: 'accepted', dayRateCents: null, person: freelancer })).toBe(true)
    expect(yesWithNoRate({ status: 'accepted', dayRateCents: 32000, person: freelancer })).toBe(false)
    // Staff aren't paid by the day, and a rate this device isn't sent is set, just not shown here.
    expect(yesWithNoRate({ status: 'accepted', dayRateCents: null, person: { kind: 'staff' } })).toBe(false)
    expect(yesWithNoRate({ status: 'accepted', dayRateCents: null, rateHidden: true, person: freelancer })).toBe(false)
    // Only a yes is confirmed.
    expect(yesWithNoRate({ status: 'offered', dayRateCents: null, person: freelancer })).toBe(false)
  })
})
