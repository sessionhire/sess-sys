import { describe, expect, it } from 'vitest'
import { CHANGE_SHOWN_DAYS, isNews, newsUntil, sinceYes, type Watched } from '../src/since-yes.ts'

/**
 * What the link says changed on a booking since its person said yes (UX sweep, 6 November 2026, move 6): the days, the
 * call time and the venue, each as it is now with what they said yes to in brackets, for a week or until the call,
 * whichever is sooner; anything it can't say that way, said plainly with no bracket.
 */

const yes: Watched = { days: ['2026-11-14'], callTime: '09:00', venue: 'Stradbally Hall' }
/** The change the office made, Friday 6 November at 10:00 in Ireland (GMT in November). */
const at = new Date('2026-11-06T10:00:00Z')
const step = (after: Partial<Watched> | undefined, when = at) => ({ at: when, after: after && { ...yes, ...after } })

describe('a booking changed since the yes', () => {
  it('says a moved call time, day or venue against what they said yes to', () => {
    // Proves: "Call 07:30 (was 09:00)", and the same shape for the days and the venue.
    const now = new Date('2026-11-06T12:00:00Z')
    expect(sinceYes(yes, yes, [step({ callTime: '07:30' })], now)).toEqual({ was: { callTime: '09:00' }, unclear: false })
    expect(sinceYes(yes, yes, [step({ days: ['2026-11-15'] })], now)).toEqual({ was: { days: ['2026-11-14'] }, unclear: false })
    expect(sinceYes(yes, yes, [step({ venue: 'Punchestown' })], now)).toEqual({ was: { venue: 'Stradbally Hall' }, unclear: false })
    // Two moves in a row read as one, against the yes; a move back says nothing; a change to anything else says nothing.
    const later = new Date('2026-11-06T11:00:00Z')
    expect(sinceYes(yes, yes, [step({ callTime: '08:00' }), step({ callTime: '07:30' }, later)], now)?.was).toEqual({ callTime: '09:00' })
    expect(sinceYes(yes, yes, [step({ callTime: '07:30' }), step({ callTime: '09:00' }, later)], now)).toBeUndefined()
    expect(sinceYes(yes, yes, [step({})], now)).toBeUndefined()
    expect(sinceYes(yes, yes, [], now)).toBeUndefined()
  })

  it('says it for a week from the change, or until the call after it, whichever is sooner', () => {
    // Proves: one constant, a week (Colly's question 10); the call ends it sooner; a change made after the last call says nothing.
    expect(CHANGE_SHOWN_DAYS).toBe(7)
    const moved = [step({ callTime: '07:30' })]
    expect(sinceYes(yes, yes, moved, new Date('2026-11-13T09:59:00Z'))).toBeDefined()
    expect(sinceYes(yes, yes, moved, new Date('2026-11-13T10:00:00Z'))).toBeUndefined()
    // Sunday's call, sooner than a week: news until 07:30 that morning.
    const sunday = { ...yes, days: ['2026-11-08'] }
    const soon = [{ at, after: { ...sunday, callTime: '07:30' } }]
    expect(sinceYes(sunday, sunday, soon, new Date('2026-11-08T07:29:00Z'))?.was).toEqual({ callTime: '09:00' })
    expect(sinceYes(sunday, sunday, soon, new Date('2026-11-08T07:30:00Z'))).toBeUndefined()
    // Two days, changed after the first day's call: news until the second day's.
    const two = { ...yes, days: ['2026-11-07', '2026-11-08'] }
    const afterFirst = [{ at: new Date('2026-11-07T12:00:00Z'), after: { ...two, venue: 'Punchestown' } }]
    expect(sinceYes(two, two, afterFirst, new Date('2026-11-08T08:59:00Z'))?.was).toEqual({ venue: 'Stradbally Hall' })
    expect(sinceYes(two, two, afterFirst, new Date('2026-11-08T09:00:00Z'))).toBeUndefined()
    const done = [{ at: new Date('2026-11-14T12:00:00Z'), after: { ...yes, venue: 'Punchestown' } }]
    expect(sinceYes(yes, yes, done, new Date('2026-11-14T12:01:00Z'))).toBeUndefined()
  })

  it("reads the call in Ireland's time, and a booking with no call time keeps it through its day", () => {
    // Proves: 08:00 in July is 07:00 GMT, so the call ends the news then; with no call time the day itself still says it.
    const july = { days: ['2026-07-04'], callTime: '08:00', venue: 'Marlay Park' }
    const change = new Date('2026-07-01T10:00:00Z')
    expect(newsUntil(change, july)).toBe('2026-07-04 08:00')
    expect(isNews(change, july, new Date('2026-07-04T06:59:00Z'))).toBe(true)
    expect(isNews(change, july, new Date('2026-07-04T07:00:00Z'))).toBe(false)
    const noCall = { days: ['2026-11-08'], callTime: null }
    expect(isNews(at, noCall, new Date('2026-11-08T23:59:00Z'))).toBe(true)
    expect(isNews(at, noCall, new Date('2026-11-09T00:00:00Z'))).toBe(false)
  })

  it("says a change it can't put in brackets plainly, never guessing", () => {
    // Proves: a call time or venue that wasn't there, or has gone, and a change the log holds in a shape it can't read, are
    // "Changed since you said yes · check the call", for as long as any other change would be.
    const now = new Date('2026-11-06T12:00:00Z')
    const noTime = { ...yes, callTime: null }
    expect(sinceYes(noTime, noTime, [{ at, after: { ...noTime, callTime: '07:30' } }], now)).toEqual({ was: {}, unclear: true })
    expect(sinceYes(yes, yes, [step({ venue: '' })], now)).toEqual({ was: {}, unclear: true })
    expect(sinceYes(yes, yes, [step(undefined), step({ callTime: '07:30' })], now)).toEqual({ was: { callTime: '09:00' }, unclear: true })
    expect(sinceYes(yes, yes, [step(undefined)], new Date('2026-11-13T10:00:00Z'))).toBeUndefined()
  })

  it('says nothing of a change that stopped being news before the week began', () => {
    // Proves: the booking as it stood a week ago is the start; only what moved since is said, against the yes.
    const now = new Date('2026-11-16T12:00:00Z')
    const weekAgo = { ...yes, days: ['2026-11-21'], callTime: '08:00' }
    expect(sinceYes(yes, weekAgo, [], now)).toBeUndefined()
    expect(sinceYes(yes, weekAgo, [{ at: new Date('2026-11-16T10:00:00Z'), after: { ...weekAgo, venue: 'Punchestown' } }], now)).toEqual({
      was: { venue: 'Stradbally Hall' },
      unclear: false,
    })
  })
})
