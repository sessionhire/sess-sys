import { describe, expect, it } from 'vitest'
import { aliasesOf, countedFind, findProducts, KitMatcher, leadingCount } from '../src/index.ts'

const p = (id: string, name: string, department: 'audio' | 'lighting' | 'power', category = '', aliases: string[] = []) => ({
  id,
  name,
  department,
  category,
  aliases,
})
const STOCK = [
  p('sm58', 'Shure SM58', 'audio', 'Mics', ['Beta 58', 'Fifty-eight']),
  p('sm57', 'Shure SM57', 'audio', 'Mics'),
  p('y10p', 'd&b Y10P', 'audio', 'Speakers', ['Wedge']),
  p('xlr10', 'XLR 10 m', 'audio', 'Cables'),
  p('spiider', 'Robe Spiider', 'lighting', 'Fixtures', ['Spider']),
  p('16a', '16A extension 10 m', 'power', 'Cables'),
]
const names = (typed: string) => findProducts(STOCK, typed).map((f) => f.product.id)

describe('finding a product as it is typed', () => {
  it('finds what is typed anywhere in the name, the name starting with it first', () => {
    expect(names('58')).toEqual(['sm58'])
    expect(names('shure')).toEqual(['sm57', 'sm58'])
    expect(names('sm 58')).toEqual(['sm58'])
    expect(names('SM-58')).toEqual(['sm58'])
    expect(names('ext')).toEqual(['16a'])
  })

  it('finds by another name, and says which', () => {
    expect(findProducts(STOCK, 'beta')).toEqual([{ product: STOCK[0], via: 'Beta 58' }])
    expect(findProducts(STOCK, 'spider')[0]).toEqual({
      product: STOCK[4],
      via: 'Spider',
    })
    expect(names('wedge')).toEqual(['y10p'])
  })

  it('needs every word, found in any field and any order', () => {
    expect(names('58 shure')).toEqual(['sm58'])
    expect(names('cable 10')).toEqual(['16a', 'xlr10'])
    expect(names('lighting')).toEqual(['spiider'])
    expect(names('shure wedge')).toEqual([])
  })

  it('puts a name before a word of a name, before a name holding it, before another name', () => {
    const list = [p('a', 'Wedge monitor', 'audio'), p('b', 'Floor wedge', 'audio'), p('c', 'Sidewedges', 'audio'), p('d', 'd&b M4', 'audio', '', ['Wedge M4'])]
    expect(findProducts(list, 'wedge').map((f) => f.product.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(findProducts(list, '')).toEqual([])
  })

  it('takes a few letters as the start of a word, so "das" is DAS and not Midas', () => {
    const list = [p('m32', 'Midas M32', 'audio', 'Desks'), p('das', 'DAS Altea 415', 'audio', 'Speakers'), p('vari', 'Das Vario', 'audio')]
    expect(findProducts(list, 'das').map((f) => f.product.id)).toEqual(['das', 'vari'])
    expect(countedFind('1 das', (t) => findProducts(list, t), (f) => f.product.name).found.map((f) => f.product.id)).toEqual(['das', 'vari'])
    expect(findProducts(list, 'midas m3').map((f) => f.product.id)).toEqual(['m32'])
    expect(findProducts(list, 'idas').map((f) => f.product.id)).toEqual(['m32'])
  })
})

describe('other names as typed', () => {
  it('splits at commas, trims, keeps each once and leaves out the name', () => {
    expect(aliasesOf(' 58,  Beta   58, beta 58,, Shure SM58 ', 'Shure SM58')).toEqual(['58', 'Beta 58'])
  })
})

describe('Kit from the notes and other names', () => {
  const matcher = new KitMatcher(STOCK)
  it('matches a line written as another name as surely as the name', () => {
    expect(matcher.match('Beta 58')).toEqual({
      how: 'name',
      modelId: 'sm58',
      likely: ['sm58'],
    })
    expect(matcher.match('spider')).toEqual({
      how: 'name',
      modelId: 'spiider',
      likely: ['spiider'],
    })
  })
  it('never lets another name take the place of a product so named', () => {
    const m = new KitMatcher([p('a', 'Wedge', 'audio'), ...STOCK])
    expect(m.match('wedge').modelId).toBe('a')
  })
})

describe('how many, typed before the product (research/quoting.md, feature 1)', () => {
  it('reads a number and a space, or a number and x, × or *, as how many of what follows', () => {
    expect(leadingCount('12 y10')).toEqual({ count: 12, rest: 'y10' })
    expect(leadingCount(' 12x y10 ')).toEqual({ count: 12, rest: 'y10' })
    expect(leadingCount('12 × spiider')).toEqual({ count: 12, rest: 'spiider' })
    expect(leadingCount('4 * 16a extension')).toEqual({ count: 4, rest: '16a extension' })
  })

  it('leaves a name that only starts with a number, a number alone, and counts out of range', () => {
    expect(leadingCount('12xlr')).toBeUndefined()
    expect(leadingCount('16a extension')).toBeUndefined()
    expect(leadingCount('12 ')).toBeUndefined()
    expect(leadingCount('0 y10')).toBeUndefined()
    expect(leadingCount('10001 y10')).toBeUndefined()
  })

  it("finds nothing with the number, so the picker takes it as a count; a name with the number in it still finds by it", () => {
    expect(names('12 y10')).toEqual([])
    expect(names('10 m xlr')).toEqual(['xlr10'])
  })
})

describe('a count read first, before a name with digits in it (audit of the quote flow, 8 November 2026, finding 2)', () => {
  const stock = [...STOCK, p('d20', 'd&b D20', 'audio', 'Amps'), p('way4', '4 way box', 'power', 'Distro'), p('split', '72-way split', 'audio', 'Splits')]
  const read = (typed: string) => {
    const r = countedFind(typed, (t) => findProducts(stock, t), (f) => f.product.name)
    return { count: r.count, ids: r.found.map((f) => f.product.id) }
  }

  it('takes the number as how many even when the whole text finds a name by it', () => {
    expect(names('8 sm58')).toEqual(['sm58'])
    expect(read('8 sm58')).toEqual({ count: 8, ids: ['sm58'] })
    expect(read('2 d20')).toEqual({ count: 2, ids: ['d20'] })
    expect(read('12 y10')).toEqual({ count: 12, ids: ['y10p'] })
  })

  it('leaves the number in the name when a name it finds starts with it, or the rest finds nothing', () => {
    expect(read('4 way box')).toEqual({ count: undefined, ids: ['way4'] })
    expect(read('72 way')).toEqual({ count: undefined, ids: ['split'] })
    expect(read('10 m xlr')).toEqual({ count: undefined, ids: ['xlr10'] })
    expect(read('sm58')).toEqual({ count: undefined, ids: ['sm58'] })
  })
})
