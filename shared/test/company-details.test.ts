import { describe, expect, it } from 'vitest'
import { legalLine, tradingNameOf } from '../src/office.ts'

describe('the company along the foot of a quote (ADR 0181)', () => {
  it('names the company as the law asks: trading name, registered name and number, registered office and directors', () => {
    expect(
      legalLine({ tradingName: 'Session Hire', legalName: 'Session Hire Productions Limited', croNumber: '612345', registeredAddress: 'Unit 4, Park West\nDublin 12', directors: 'Aoife Byrne\nSam Lee (British)' })
    ).toBe(
      'Session Hire is a trading name of Session Hire Productions Limited, registered in Ireland, number 612345. Registered office: Unit 4, Park West, Dublin 12. Directors: Aoife Byrne, Sam Lee (British).'
    )
  })
  it('leaves out what is not set, and says nothing when nothing is', () => {
    expect(legalLine(undefined)).toBe('')
    expect(legalLine({ croNumber: '612345' })).toBe('Session Hire, registered in Ireland, number 612345.')
    expect(legalLine({ tradingName: 'Session Hire', legalName: 'session hire' })).toBe('session hire.')
    expect(legalLine({ directors: 'Aoife Byrne' })).toBe('Directors: Aoife Byrne.')
    expect(tradingNameOf({ tradingName: '  ' })).toBe('Session Hire')
  })
})
