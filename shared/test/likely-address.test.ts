import { describe, expect, it } from 'vitest'
import { likelyAddress } from '../src/index.ts'

/** A slip in a common email domain, caught before a quote bounces (ADR 0171). */
describe('likely address', () => {
  it('spells a common domain right when it is a letter or two off', () => {
    expect(likelyAddress('anna@gmial.com')).toBe('anna@gmail.com')
    expect(likelyAddress('anna@gmail.con')).toBe('anna@gmail.com')
    expect(likelyAddress('anna@hotmial.com')).toBe('anna@hotmail.com')
    expect(likelyAddress('anna@eircom.ne')).toBe('anna@eircom.net')
    expect(likelyAddress('anna@liffeybrands.con')).toBe('anna@liffeybrands.com')
  })
  it('leaves a right one, and a company domain that only looks like one, alone', () => {
    expect(likelyAddress('anna@gmail.com')).toBeNull()
    expect(likelyAddress('anna@liffeybrands.ie')).toBeNull()
    expect(likelyAddress('anna@mail.com')).toBeNull()
    expect(likelyAddress('not-an-address')).toBeNull()
  })
})
