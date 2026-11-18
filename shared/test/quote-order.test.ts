import { describe, expect, it } from 'vitest'
import { groupBands, groupCents, linesByGroup, orderGroups, moveGroup, moveLine, needsPrice, quoteContact } from '../src/quotes.ts'

/** The office's own groups and order, words-only lines, and who a quote is for (ADR 0128). */

type L = { id: string; kind: 'kit' | 'crew' | 'other'; group: string; under?: string | null; words?: true }
const kit = (id: string, group: string, under?: string): L => ({ id, kind: 'kit', group, ...(under ? { under } : {}) })
const crew = (id: string): L => ({ id, kind: 'crew', group: 'Crew' })
const words = (id: string, group: string): L => ({ id, kind: 'other', group, words: true })
const ids = (ls: readonly L[] | undefined) => ls?.map((l) => l.id)
const shape = (ls: readonly L[]) => linesByGroup(ls).map((g) => `${g.group}: ${g.lines.map((l) => l.id).join(' ')}`)

describe('linesByGroup', () => {
  it('puts kit groups first, then crew, then the rest, each in the order the office put them', () => {
    expect(shape([crew('c1'), kit('a', 'Monitors'), { id: 't', kind: 'other', group: 'Transport' }, kit('b', 'FOH'), kit('a2', 'Monitors')])).toEqual([
      'Monitors: a a2',
      'FOH: b',
      'Crew: c1',
      'Transport: t',
    ])
  })
  it('keeps a group that starts with words among the kit', () => {
    expect(shape([crew('c1'), words('w', 'Stage 2'), kit('a', 'Stage 2')])).toEqual(['Stage 2: w a', 'Crew: c1'])
  })
})

describe('moveLine', () => {
  const ls = [kit('a', 'FOH'), kit('p', 'FOH'), kit('p1', 'FOH', 'p'), kit('b', 'FOH'), crew('c1')]
  it('moves a line up its group, a package with its kit', () => {
    expect(ids(moveLine(ls, 'p', -1))).toEqual(['p', 'p1', 'a', 'b', 'c1'])
    expect(ids(moveLine(ls, 'b', -1))).toEqual(['a', 'b', 'p', 'p1', 'c1'])
  })
  it("won't move past the top or bottom of its group", () => {
    expect(moveLine(ls, 'a', -1)).toBeUndefined()
    expect(moveLine(ls, 'b', 1)).toBeUndefined()
    expect(moveLine(ls, 'c1', -1)).toBeUndefined()
  })
})

describe('moveGroup', () => {
  const ls = [kit('a', 'FOH'), kit('m', 'Monitors'), crew('c1'), kit('a2', 'FOH')]
  it('moves a group past the one beside it, its lines together', () => {
    expect(ids(moveGroup(ls, 'Monitors', -1))).toEqual(['m', 'a', 'a2', 'c1'])
    expect(shape(moveGroup(ls, 'Monitors', -1)!)).toEqual(['Monitors: m', 'FOH: a a2', 'Crew: c1'])
  })
  it('keeps crew after the kit', () => {
    expect(moveGroup(ls, 'Crew', -1)).toBeUndefined()
    expect(moveGroup(ls, 'Monitors', 1)).toBeUndefined()
  })
})

describe('words only', () => {
  it('never wants a price', () => {
    const w = { id: 'w', unitCents: 0, words: true as const }
    expect(needsPrice(w, [w])).toBe(false)
  })
})

describe('quoteContact', () => {
  const contacts = [
    { name: 'Aoife', role: 'Producer' },
    { name: 'Ciarán', role: 'Accounts' },
  ]
  it('is the first contact when nobody is named', () => {
    expect(quoteContact(contacts)).toEqual(contacts[0])
    expect(quoteContact(contacts, ' ')).toEqual(contacts[0])
  })
  it('is the one named, with their role', () => {
    expect(quoteContact(contacts, 'Ciarán')).toEqual(contacts[1])
  })
  it('is the name alone once they have gone from the client', () => {
    expect(quoteContact(contacts, 'Seán')).toEqual({ name: 'Seán' })
  })
})

describe('groupCents', () => {
  it("adds up a group's lines, a package's kit with it, and leaves words out", () => {
    const at = (id: string, unitCents: number, more: Record<string, unknown> = {}) =>
      ({ id, kind: 'kit', group: 'Audio', what: id, qty: 2, days: 1, unitCents, vat: 'standard', per: 'day', ...more }) as unknown as Parameters<typeof groupCents>[0][number]
    const all = [at('a', 6000), at('p', 0, { packageId: 'x' }), at('u', 1000, { under: 'p' }), at('w', 0, { words: true }), at('other', 500, { group: 'Video' })]
    const audio = linesByGroup(all).find((g) => g.group === 'Audio')!.lines
    expect(groupCents(audio, all)).toBe(12000 + 2000)
  })
})

describe('groupBands and orderGroups', () => {
  const ls = [kit('a', 'Monitors'), kit('b', 'FOH'), crew('c1'), kit('a2', 'Monitors', 'a'), { id: 't', kind: 'other' as const, group: 'Transport' }]
  it('splits the groups into kit, crew and the rest', () => {
    expect(groupBands(ls).map((b) => b.map((g) => g.group))).toEqual([['Monitors', 'FOH'], ['Crew'], ['Transport']])
  })
  it('puts groups in the order given, inside their band, with what is under a line kept with it', () => {
    expect(shape(orderGroups(ls, ['FOH', 'Monitors']))).toEqual(['FOH: b', 'Monitors: a', 'Crew: c1', 'Transport: t'])
    expect(ids(orderGroups(ls, ['FOH', 'Monitors']))).toEqual(['b', 'a', 'a2', 'c1', 't'])
    // A crew group can't be put among the kit.
    expect(shape(orderGroups(ls, ['Crew', 'FOH', 'Monitors']))).toEqual(['FOH: b', 'Monitors: a', 'Crew: c1', 'Transport: t'])
  })
})
