import { describe, expect, it } from 'vitest'
import { anyLineDiscount, lineCents, lineDiscountCents } from '../src/quotes.ts'

/** What a line's own discount takes off, for the printed quote's Discount column (Colly, 26 November 2026). */

const base = { qty: 2, days: 3, unitCents: 7_500, per: 'day' as const }

describe('lineDiscountCents', () => {
  it('is the amount before the discount less the amount after it', () => {
    const l = { ...base, discountPct: 10 }
    expect(lineDiscountCents(l)).toBe(4_500)
    expect(lineCents({ ...l, discountPct: undefined }) - lineDiscountCents(l)).toBe(lineCents(l))
  })
  it('is nothing with no discount, at no charge, with no price, or for words', () => {
    expect(lineDiscountCents(base)).toBe(0)
    expect(lineDiscountCents({ ...base, discountPct: 10, included: true })).toBe(0)
    expect(lineDiscountCents({ ...base, discountPct: 10, unitCents: 0 })).toBe(0)
    expect(lineDiscountCents({ ...base, discountPct: 10, words: true })).toBe(0)
  })
  it('counts a line charged once only once', () => {
    expect(lineDiscountCents({ ...base, per: 'once', discountPct: 50 })).toBe(7_500)
  })
  it('gives the column only when a line has a discount to show', () => {
    expect(anyLineDiscount([base, { ...base, discountPct: 10, included: true }])).toBe(false)
    expect(anyLineDiscount([base, { ...base, discountPct: 12.5 }])).toBe(true)
  })
})
