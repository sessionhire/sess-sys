import { describe, expect, it } from 'vitest'
import { bookingDays, bookingLine, dayWord, glanceParts, nextBooking, nextDayOf, soonestFirst } from '../src/bookings.ts'

/**
 * A person's own bookings, said one way on their link, Home › Me and their own page (UX sweep, 6 November 2026, move
 * 6): the row under the job's name, and the glance line of what's waiting on them and what's next.
 */

const today = '2026-10-14'
/** As it reads, whichever spaces are kept from breaking. */
const said = (line: string) => line.replace(/\u00a0/g, ' ')
const call = { role: 'Audio tech', phase: 'Build', start: '2026-10-16', end: '2026-10-18', callTime: '08:00' }

describe('one booking row', () => {
  it('says the role, the phase, the days and the call, in that order, leaving out what the call has none of', () => {
    // Proves: the same words on every surface, the job's name above them and the pill beside them.
    expect(said(bookingLine({ status: 'confirmed', days: ['2026-10-16', '2026-10-17'] }, call, today))).toBe('Audio tech · Build · Fri 16 Oct to Sat 17 Oct · call 08:00')
    expect(said(bookingLine({ status: 'accepted', days: ['2026-10-18'] }, { ...call, phase: '', callTime: null }, today))).toBe('Audio tech · Sun 18 Oct')
    // A date far from today says its year, as the link's dates do (audit, 20 October 2026, finding 89).
    expect(said(bookingLine({ status: 'confirmed', days: ['2027-05-04'] }, { ...call, start: '2027-05-04', end: '2027-05-04' }, today))).toBe('Audio tech · Build · Tue 4 May 2027 · call 08:00')
  })

  it('wraps on a narrow screen after a dot, never before one, and keeps each date and the call whole', () => {
    // Proves: a phone never starts a line with a dot or leaves "Oct" or "08:00" alone at the start of one; a span can still
    // wrap between its dates, and a long role between its words.
    expect(bookingLine({ status: 'confirmed', days: ['2026-10-16'] }, call, today)).toBe('Audio tech\u00a0· Build\u00a0· Fri\u00a016\u00a0Oct\u00a0· call\u00a008:00')
    expect(bookingLine({ status: 'confirmed', days: ['2026-10-16', '2026-10-17'] }, call, today)).toContain('Fri\u00a016\u00a0Oct to Sat\u00a017\u00a0Oct')
  })

  it("says an offer's days as its card does, the call's own, and a booking's as the days they hold", () => {
    expect(bookingDays({ status: 'offered', days: ['2026-10-16'] }, call)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18'])
    expect(bookingDays({ status: 'confirmed', days: ['2026-10-16', '2026-10-18'] }, call)).toEqual(['2026-10-16', '2026-10-18'])
  })

  it("finds a booking's next day from the days it holds, none once they're over, and the call's while it holds none", () => {
    expect(nextDayOf({ days: ['2026-10-18', '2026-10-12', '2026-10-15'] }, call, today)).toBe('2026-10-15')
    // They took the first two days of a call that runs on: theirs are over, so it isn't next, though the call's last day is to come.
    expect(nextDayOf({ days: ['2026-10-12', '2026-10-13'] }, { start: '2026-10-12', end: '2026-10-18' }, today)).toBeUndefined()
    // Holding no days at all: the call's, from today on, never one gone.
    expect(nextDayOf({ days: [] }, call, today)).toBe('2026-10-16')
    expect(nextDayOf({ days: [] }, { start: '2026-10-12', end: '2026-10-18' }, today)).toBe(today)
  })
})

describe('the booking they are on next', () => {
  // On 6 November: a conference running 2 to 8 November of which they took the 2nd and 3rd, and a gig on the 7th.
  const now = '2026-11-06'
  type Row = { o: { id: string; days: string[] }; c: { project: string; start: string; end: string; callTime: string | null } }
  const parts = ({ o, c }: Row) => [o, c] as const
  const conference: Row = { o: { id: 'o-conf', days: ['2026-11-02', '2026-11-03'] }, c: { project: 'Conference', start: '2026-11-02', end: '2026-11-08', callTime: '08:00' } }
  const gig: Row = { o: { id: 'o-gig', days: ['2026-11-07'] }, c: { project: 'Gig', start: '2026-11-07', end: '2026-11-07', callTime: '09:00' } }

  it('is the soonest holding a day from today on, never one whose days are over while its call runs on', () => {
    // Proves: the glance line never names a day gone by and hides the real next booking; the list puts the one that's over last.
    const next = nextBooking([conference, gig], now, parts)
    expect(next).toEqual({ booking: gig, day: '2026-11-07' })
    expect(glanceParts({ offers: 0, next: { project: next!.booking.c.project, callTime: next!.booking.c.callTime, day: next!.day } }, now).map((p) => said(p.text))).toEqual([
      'Next: Gig, tomorrow, call 09:00',
    ])
    expect(soonestFirst([conference, gig], now, parts)).toEqual([gig, conference])
    expect(nextBooking([conference], now, parts)).toBeUndefined()
    expect(nextBooking([], now, parts)).toBeUndefined()
  })

  it('is the earlier call of two on the same day, whichever way round a surface holds them', () => {
    // Proves: their link and Home › Me, which hold their bookings in different orders, name the same job, and list them alike.
    const late: Row = { o: { id: 'o-late', days: ['2026-11-07'] }, c: { project: 'Late show', start: '2026-11-07', end: '2026-11-07', callTime: '17:00' } }
    const early: Row = { o: { id: 'o-early', days: ['2026-11-07'] }, c: { ...late.c, project: 'Early load-in', callTime: '07:30' } }
    const noCall: Row = { o: { id: 'o-none', days: ['2026-11-07'] }, c: { ...late.c, project: 'No call time yet', callTime: null } }
    expect(soonestFirst([late, noCall, early], now, parts)).toEqual([early, late, noCall])
    expect(soonestFirst([noCall, early, late], now, parts)).toEqual([early, late, noCall])
    expect(nextBooking([late, early], now, parts)?.booking).toBe(early)
    expect(nextBooking([early, late], now, parts)?.booking).toBe(early)
    // The same day and call: the offer settles it.
    const twin: Row = { o: { id: 'o-a', days: ['2026-11-07'] }, c: { ...early.c, project: 'Twin' } }
    expect(nextBooking([early, twin], now, parts)?.booking).toBe(twin)
    expect(nextBooking([twin, early], now, parts)?.booking).toBe(twin)
  })
})

describe('the glance line', () => {
  it('says what waits on them and what is next, each only when there is something to say', () => {
    // Proves: "2 offers to answer · Next: …" on the link and on Home › Me alike, and nothing at all while nothing waits or is booked.
    const next = { project: 'Harbour Lights', callTime: '08:00', day: '2026-10-15' }
    expect(glanceParts({ offers: 2, timesheets: 1, next }, today)).toEqual([
      { key: 'offers', text: '2 offers to answer' },
      { key: 'timesheets', text: '1 timesheet to send' },
      { key: 'next', text: 'Next: Harbour Lights, tomorrow, call\u00a008:00' },
    ])
    expect(glanceParts({ offers: 1, next: { ...next, callTime: null, day: '2026-10-20' } }, today).map((p) => said(p.text))).toEqual(['1 offer to answer', 'Next: Harbour Lights, Tue 20 Oct'])
    expect(glanceParts({ offers: 0, timesheets: 0 }, today)).toEqual([])
  })

  it('says today and tomorrow by their words, and other days as dates', () => {
    expect(dayWord(today, today)).toBe('today')
    expect(dayWord('2026-10-15', today)).toBe('tomorrow')
    expect(dayWord('2026-10-13', today)).toBe('Tue 13 Oct')
  })
})
