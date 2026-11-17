import { describe, expect, it } from 'vitest'
import { byBoardOrder, moved, rankedAfterDrop } from '../src/board-order.ts'

/** The Board's order (ADR 0143): hand-ordered cards first, the rest soonest first, and a drop keeps what was seen. */

const card = (name: string, start: string | undefined, rank?: number) => ({ rank, job: { name, ...(start ? { span: { start } } : {}) } })

describe('the order of a column', () => {
  it('puts the cards put in order first, then the rest soonest first', () => {
    const cards = [card('Late', '2026-12-01'), card('Ranked two', '2026-11-20', 2), card('Soon', '2026-11-12'), card('Ranked one', '2027-01-01', 1), card('No dates', undefined)]
    expect(cards.sort(byBoardOrder).map((c) => c.job.name)).toEqual(['Ranked one', 'Ranked two', 'No dates', 'Soon', 'Late'])
  })

  it('goes by the days between two with the same place', () => {
    expect([card('B', '2026-11-20', 1), card('A', '2026-11-12', 1)].sort(byBoardOrder).map((c) => c.job.name)).toEqual(['A', 'B'])
  })
})

describe('dropping a card', () => {
  it('moves a card up or down a group', () => {
    expect(moved(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moved(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moved(['a', 'b'], 0, 9)).toEqual(['b', 'a'])
  })

  it('puts the dropped card and every card above it in order', () => {
    // A and B were put in order; C, D and E go by their days. E dropped second from the top.
    expect(rankedAfterDrop([['a', 'e', 'b', 'c', 'd']], 0, 'e', new Set(['a', 'b']))).toEqual(['a', 'e', 'b'])
    // A dropped below D: B, C and D now sit above it as they're seen, so they join it.
    expect(rankedAfterDrop([['b', 'c', 'd', 'a', 'e']], 0, 'a', new Set(['a', 'b']))).toEqual(['b', 'c', 'd', 'a'])
  })

  it('keeps the cards in order in the other groups of the column, where they are', () => {
    const groups = [['t1', 't2'], ['n2', 'n1', 'n3'], ['l1']]
    expect(rankedAfterDrop(groups, 1, 'n2', new Set(['t1', 'l1']))).toEqual(['t1', 'n2', 'l1'])
  })
})
