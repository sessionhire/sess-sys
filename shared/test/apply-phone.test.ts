import { describe, expect, it } from 'vitest'
import { DIAL_CODES, phoneWithCountry } from '../src/phone.ts'

/** The mobile on the Apply page, read with the country picked beside it (ADR 0190), in the form WhatsApp and the crew list use. */
describe('a mobile read with its country code', () => {
  it('puts the picked code before a number typed as at home, less the 0 dialled only there', () => {
    expect(phoneWithCountry('353', '086 831 9330')).toEqual({ phone: '+353868319330' })
    expect(phoneWithCountry('353', '86 831 9330')).toEqual({ phone: '+353868319330' })
    expect(phoneWithCountry('44', '07700 900123')).toEqual({ phone: '+447700900123' })
    expect(phoneWithCountry('48', '512 345 678')).toEqual({ phone: '+48512345678' })
    expect(phoneWithCountry('1', '(212) 555-0142')).toEqual({ phone: '+12125550142' })
  })

  it("keeps Italy's 0, which is dialled from abroad too", () => {
    expect(phoneWithCountry('39', '06 1234 5678')).toEqual({ phone: '+390612345678' })
  })

  it('takes a number typed with its own code as it is, whatever is picked', () => {
    expect(phoneWithCountry('353', '+44 7700 900123')).toEqual({ phone: '+447700900123' })
    expect(phoneWithCountry('44', '00353 86 831 9330')).toEqual({ phone: '+353868319330' })
  })

  it('reads a missing or unknown code as Ireland', () => {
    expect(phoneWithCountry('', '087 123 4567')).toEqual({ phone: '+353871234567' })
    expect(phoneWithCountry('999', '087 123 4567')).toEqual({ phone: '+353871234567' })
  })

  it("says what it can't read", () => {
    expect(phoneWithCountry('353', 'call me').problem).toBeDefined()
    expect(phoneWithCountry('353', '12').problem).toBeDefined()
    expect(phoneWithCountry('353', '')).toEqual({ phone: null })
  })

  it('offers Ireland first, then the United Kingdom, then the rest by name, each once', () => {
    expect(DIAL_CODES.slice(0, 2).map(([, c]) => c)).toEqual(['Ireland', 'United Kingdom'])
    const rest = DIAL_CODES.slice(2).map(([, c]) => c)
    expect(rest).toEqual([...rest].sort())
    expect(new Set(DIAL_CODES.map(([c]) => c)).size).toBe(DIAL_CODES.length)
  })
})

describe('a kept number shown and split for its form', () => {
  it('shows it grouped as people say it', async () => {
    const { phoneShown } = await import('../src/phone.ts')
    expect(phoneShown('+353868319330')).toBe('+353 86 831 9330')
    expect(phoneShown('+35312345678')).toBe('+353 1 234 5678')
    expect(phoneShown('+353912345678')).toBe('+353 91 234 5678')
    expect(phoneShown('+447700900123')).toBe('+44 7700 900123')
    expect(phoneShown('+12125550142')).toBe('+1 212 555 0142')
    expect(phoneShown('087 123 4567')).toBe('+353 87 123 4567')
    expect(phoneShown('ring the office')).toBe('ring the office')
    expect(phoneShown(null)).toBe('')
  })

  it('splits it into its country and the rest, Ireland for one it can’t read', async () => {
    const { splitPhone } = await import('../src/phone.ts')
    expect(splitPhone('+353868319330')).toEqual({ country: '353', national: '86 831 9330' })
    expect(splitPhone('+447700900123')).toEqual({ country: '44', national: '7700 900123' })
    expect(splitPhone('+35699123456')).toEqual({ country: '356', national: '99123456' })
    expect(splitPhone('ring the office')).toEqual({ country: '353', national: 'ring the office' })
    expect(splitPhone(null)).toEqual({ country: '353', national: '' })
  })

  it('reads back what it split', async () => {
    const { splitPhone } = await import('../src/phone.ts')
    for (const kept of ['+353868319330', '+447700900123', '+390612345678', '+12125550142', '+48512345678']) {
      const { country, national } = splitPhone(kept)
      expect(phoneWithCountry(country, national)).toEqual({ phone: kept })
    }
  })
})
