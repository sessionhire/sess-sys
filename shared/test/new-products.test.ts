import { describe, expect, it } from 'vitest'
import { addArgsOf, alikeProducts, blankDraft, draftOf, productReading, withoutLength } from '../src/index.ts'

const product = (id: string, name: string, extra: { lengthM?: number | null; aliases?: string[]; mistake?: boolean } = {}) => ({
  id,
  name,
  department: 'audio' as const,
  category: 'Microphones',
  aliases: extra.aliases ?? [],
  mistake: extra.mistake ?? false,
  lengthM: extra.lengthM ?? null,
})

describe('adding products from a photo (ADR 0203)', () => {
  it('takes a length out of a name, as ADR 0202 reads one', () => {
    expect(withoutLength('XLR 10m')).toBe('XLR')
    expect(withoutLength('Powercon 1.5 metre cable')).toBe('Powercon cable')
    expect(withoutLength('16mm truss pin')).toBe('16mm truss pin')
    expect(withoutLength('Shure SM58')).toBe('Shure SM58')
  })

  it('reads what Claude says leniently, numbers rounded and out-of-range ones dropped', () => {
    const r = productReading.parse({ name: 'Shure SM58', department: 'sound', weightKg: 0.2999, powerW: -5, lengthM: 10, sources: [{ title: 'Shure', url: 'http://shure.com' }, { title: 'Shure', url: 'https://shure.com' }] })
    expect(r.department).toBe('other')
    expect(r.weightKg).toBe(0.3)
    expect(r.powerW).toBeNull()
    expect(r.sources).toEqual([{ title: 'Shure', url: 'https://shure.com' }])
  })

  it('fills the form from a reading, the length in its own box and the category as the list spells it', () => {
    const d = draftOf(productReading.parse({ name: 'Neutrik NL4 Speakon 10m', department: 'audio', category: 'cables', lengthM: 10, valueEuro: 35 }), ['Cables'])
    expect(d.name).toBe('Neutrik NL4 Speakon')
    expect(d.length).toBe('10')
    expect(d.category).toBe('Cables')
    expect(d.value).toBe('35')
  })

  it('turns the form into a new product, or says why not', () => {
    const ok = addArgsOf({ ...blankDraft(), name: 'Shure SM58', category: 'Microphones', value: '99.50', weight: '0.3', pat: true, otherNames: 'SM58, Shure SM58' }, 'abcdefgh')
    expect(ok.reason).toBeUndefined()
    if (ok.reason === undefined) {
      expect(ok.args).toMatchObject({ name: 'Shure SM58', valueCents: 9950, weightKg: 0.3, patMonths: 12, aliases: ['SM58'], lengthM: null })
    }
    expect(addArgsOf({ ...blankDraft(), name: '' }, 'abcdefgh').reason).toMatch(/name/)
    expect(addArgsOf({ ...blankDraft(), name: 'XLR 10m' }, 'abcdefgh').reason).toMatch(/Length box/)
    expect(addArgsOf({ ...blankDraft(), name: 'XLR', length: '10' }, 'abcdefgh').reason).toBeUndefined()
    expect(addArgsOf({ ...blankDraft(), name: 'XLR', weight: 'heavy' }, 'abcdefgh').reason).toMatch(/number/)
  })

  it('finds what is already on the list: the one Claude named, by name, by model number, never a cable of another length', () => {
    const list = [product('sm58', 'Shure SM58 vocal mic'), product('beta', 'Shure Beta 58A'), product('xlr5', 'XLR', { lengthM: 5 }), product('xlr10', 'XLR', { lengthM: 10 }), product('gone', 'SM58 spare', { mistake: true })]
    expect(alikeProducts(list, { name: 'SM58', model: 'SM58' }).map((p) => p.id)).toEqual(['sm58'])
    expect(alikeProducts(list, { name: 'Something', sameAs: 'Shure Beta 58A' })[0]!.id).toBe('beta')
    expect(alikeProducts(list, { name: 'XLR', lengthM: 10 }).map((p) => p.id)).toEqual(['xlr10'])
  })
})
