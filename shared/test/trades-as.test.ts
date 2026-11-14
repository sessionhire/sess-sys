import { describe, expect, it } from 'vitest'
import { companyAfter, companyLine, isVatRegistered, tradesAs, type Company } from '../src/crew.ts'

/** Sole trader or company (ADR 0184). */
describe('how a freelancer trades', () => {
  const sole = (vatRegistered: boolean | null, vatNumber: string | null = null): Company => ({ as: 'sole-trader', name: '', vatNumber, croNumber: null, vatRegistered })
  const ltd: Company = { as: 'company', name: 'Quinn Audio Ltd', vatNumber: 'IE0000001A', croNumber: '000001' }

  it('says it in a line', () => {
    expect(companyLine({ company: sole(true, 'IE1234567T') })).toBe('Sole trader, VAT-registered')
    expect(companyLine({ company: sole(true) })).toBe('Sole trader, VAT-registered')
    expect(companyLine({ company: sole(false) })).toBe('Sole trader, not VAT-registered')
    expect(companyLine({ company: sole(null) })).toBe('Sole trader')
    expect(companyLine({ company: ltd })).toBe('Trades as Quinn Audio Ltd, VAT-registered')
    expect(companyLine({ company: null })).toBe('')
  })

  it('reads a record from before it was asked as a company, VAT-registered by its number', () => {
    const old: Company = { name: 'Old Ltd', vatNumber: null, croNumber: '12' }
    expect(tradesAs({ company: old })).toBe('company')
    expect(isVatRegistered({ company: old })).toBe(false)
    expect(isVatRegistered({ company: { ...old, vatNumber: 'IE1' } })).toBe(true)
    expect(tradesAs({ company: null })).toBeNull()
  })

  it('keeps what was said when an edit leaves it out, and takes what an edit says', () => {
    expect(companyAfter(sole(true), undefined)).toEqual(sole(true))
    expect(companyAfter(sole(true), null)).toBeNull()
    // An older version sends the three fields only: sole trader and the yes stay.
    expect(companyAfter(sole(true), { name: '', vatNumber: 'IE9', croNumber: null })).toEqual(sole(true, 'IE9'))
    // Changed to a company, the sole trader's answer goes.
    expect(companyAfter(sole(true), { ...ltd, vatRegistered: null })).toEqual(ltd)
  })
})
