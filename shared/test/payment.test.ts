import { describe, expect, it } from 'vitest'
import { ibanShown, isBic, isIban, isPpsn, maskPaymentDetails, readPaymentDetails } from '../src/payment.ts'

describe('payment details (ADR 0193)', () => {
  it('checks a PPS number by its check letter, old and new', () => {
    expect(isPpsn('1234567T')).toBe(true)
    expect(isPpsn('1234567 fa')).toBe(true)
    expect(isPpsn('1234567TA')).toBe(false)
    expect(isPpsn('1234567X')).toBe(false)
    expect(isPpsn('123456T')).toBe(false)
  })
  it('checks an IBAN by its check digits, and a BIC by its shape', () => {
    expect(isIban('IE29 AIBK 9311 5212 3456 78')).toBe(true)
    expect(isIban('GB82 WEST 1234 5698 7654 32')).toBe(true)
    expect(isIban('IE29 AIBK 9311 5212 3456 79')).toBe(false)
    expect(isBic('AIBKIE2D')).toBe(true)
    expect(isBic('aibk ie2d xxx')).toBe(true)
    expect(isBic('AIBK')).toBe(false)
    expect(ibanShown('ie29aibk93115212345678')).toBe('IE29 AIBK 9311 5212 3456 78')
  })
  it('reads nothing as nothing, tidies what is given, and says what is wrong in each', () => {
    expect(readPaymentDetails({})).toEqual({ ok: true, details: { ppsn: '', vatNumber: '', accountName: '', iban: '', bic: '' } })
    expect(readPaymentDetails({ ppsn: '1234567 fa', iban: 'ie29 aibk 9311 5212 3456 78', accountName: ' Aoife  Ní Bhriain ', bic: 'aibkie2d', vatNumber: 'ie 1234567t' })).toEqual({
      ok: true,
      details: { ppsn: '1234567FA', vatNumber: 'IE1234567T', accountName: 'Aoife Ní Bhriain', iban: 'IE29AIBK93115212345678', bic: 'AIBKIE2D' },
    })
    const wrong = readPaymentDetails({ ppsn: '1234567X', iban: 'IE29AIBK93115212345679' })
    expect(wrong.ok).toBe(false)
    if (!wrong.ok) expect(Object.keys(wrong.errors).sort()).toEqual(['accountName', 'iban', 'ppsn'])
    const half = readPaymentDetails({ accountName: 'Aoife' })
    expect(!half.ok && half.errors.iban).toMatch(/IBAN as well/)
  })
  it('masks the PPS number and IBAN, leaving enough to tell which', () => {
    expect(maskPaymentDetails({ ppsn: '1234567FA', vatNumber: '', accountName: 'Aoife', iban: 'IE29AIBK93115212345678', bic: 'AIBKIE2D' })).toEqual({
      ppsn: '••••••7FA',
      vatNumber: '',
      accountName: 'Aoife',
      iban: 'IE•• •••• … 5678',
      bic: 'AIBKIE2D',
    })
  })
})
