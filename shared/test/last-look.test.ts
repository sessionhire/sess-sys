import { describe, expect, it } from 'vitest'
import { lookAgain, moreSince, sinceLabel } from '../src/last-look.ts'

describe("Home's last look on this phone", () => {
  it('holds today against the last look on an earlier day, however often Home is opened today', () => {
    const first = lookAgain(undefined, '2026-11-03', { answers: 3 })
    expect(first.base).toBeUndefined()
    const sameDay = lookAgain(first.next, '2026-11-03', { answers: 4 })
    expect(sameDay.base).toBeUndefined()
    const thursday = lookAgain(sameDay.next, '2026-11-05', { answers: 6 })
    expect(thursday.base).toEqual({ day: '2026-11-03', counts: { answers: 4 } })
    const later = lookAgain(thursday.next, '2026-11-05', { answers: 7 })
    expect(later.base?.day).toBe('2026-11-03')
    expect(moreSince(later.base, 'answers', 7)).toBe(3)
  })

  it('says more only when a count rose, and counts a new kind of count from nothing', () => {
    const base = { day: '2026-11-03', counts: { answers: 4 } }
    expect(moreSince(base, 'answers', 2)).toBe(0)
    expect(moreSince(base, 'answers', 4)).toBe(0)
    expect(moreSince(base, 'faults', 2)).toBe(2)
    expect(moreSince(undefined, 'answers', 9)).toBe(0)
  })

  it('names the day plainly', () => {
    expect(sinceLabel('2026-11-06', '2026-11-07')).toBe('since yesterday')
    expect(sinceLabel('2026-11-03', '2026-11-07')).toBe('since Tuesday')
    expect(sinceLabel('2026-10-27', '2026-11-07')).toBe('since Tue 27 Oct')
  })
})
