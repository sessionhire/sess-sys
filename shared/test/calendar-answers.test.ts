import { describe, expect, it } from 'vitest'
import { answerFromCalendar, COUNTERED_YES, offerOnCalendar, YES_WHILE_ASKING, type CalendarDay, type DayAnswer } from '../src/calendar.ts'
import { ratesClosedBy, type Offer } from '../src/crew.ts'

// A Yes in Google Calendar counts for the day it was pressed on (ADR 0152; audit of 12 November 2026, finding 3).

const FRI = '2026-11-27'
const SAT = '2026-11-28'
const SUN = '2026-11-29'
const CALL = [FRI, SAT, SUN]

const offer = (status: Offer['status'], days: string[] = CALL, asked?: string[]) => ({ status, days, ...(asked ? { asked } : {}) })
const said = (answers: Record<string, DayAnswer>) => answers

describe('answerFromCalendar: a Yes counts for its own day', () => {
  it('takes a Yes on one day for that day, and keeps the days not answered asked', () => {
    expect(answerFromCalendar(offer('offered'), CALL, said({ [FRI]: 'yes', [SAT]: 'none', [SUN]: 'maybe' }), [FRI])).toEqual({ answer: 'accept', days: [FRI], asked: [SAT, SUN] })
  })

  it('takes a Yes on every day for all of them, with nothing left asked', () => {
    expect(answerFromCalendar(offer('offered'), CALL, said({ [FRI]: 'yes', [SAT]: 'yes', [SUN]: 'yes' }), CALL)).toEqual({ answer: 'accept', days: CALL, asked: [] })
  })

  it('leaves a day said No to out of both', () => {
    expect(answerFromCalendar(offer('offered'), CALL, said({ [FRI]: 'yes', [SAT]: 'no', [SUN]: 'none' }), [FRI])).toEqual({ answer: 'accept', days: [FRI], asked: [SUN] })
  })

  it('declines on a No to every day, and does nothing on a No to some with no Yes', () => {
    expect(answerFromCalendar(offer('offered'), CALL, said({ [FRI]: 'no', [SAT]: 'no', [SUN]: 'no' }), [SUN])).toEqual({ answer: 'decline' })
    expect(answerFromCalendar(offer('offered'), CALL, said({ [FRI]: 'no', [SAT]: 'none', [SUN]: 'none' }), [FRI])).toBeUndefined()
  })

  it('adds a day still asked when they say Yes to it later, and drops it from asked', () => {
    expect(answerFromCalendar(offer('accepted', [FRI], [SAT, SUN]), CALL, said({ [FRI]: 'yes', [SAT]: 'yes', [SUN]: 'none' }), [SAT])).toEqual({
      answer: 'accept',
      days: [FRI, SAT],
      asked: [SUN],
    })
  })

  it('stops asking for a day they then say No to, keeping the days they said yes to', () => {
    expect(answerFromCalendar(offer('accepted', [FRI], [SAT, SUN]), CALL, said({ [FRI]: 'yes', [SAT]: 'no', [SUN]: 'none' }), [SAT])).toEqual({
      answer: 'accept',
      days: [FRI],
      asked: [SUN],
    })
  })

  it('opens the offer again for the days not answered when they say No to every day they said yes to', () => {
    expect(answerFromCalendar(offer('accepted', [FRI], [SAT, SUN]), CALL, said({ [FRI]: 'no', [SAT]: 'none', [SUN]: 'none' }), [FRI])).toEqual({
      answer: 'undecided',
      days: [SAT, SUN],
    })
  })

  it('declines when they say No to their last yes with nothing left asked', () => {
    expect(answerFromCalendar(offer('accepted', [FRI]), CALL, said({ [FRI]: 'no', [SAT]: 'no', [SUN]: 'no' }), [FRI])).toEqual({ answer: 'decline' })
  })

  it('does nothing for a Maybe on a day still asked, or a Yes again on a day already theirs', () => {
    expect(answerFromCalendar(offer('accepted', [FRI], [SAT]), [FRI, SAT], said({ [FRI]: 'yes', [SAT]: 'maybe' }), [SAT])).toBeUndefined()
    expect(answerFromCalendar(offer('accepted', [FRI, SAT]), [FRI, SAT], said({ [FRI]: 'yes', [SAT]: 'yes' }), [SAT])).toBeUndefined()
  })

  it('leaves a rate asked for and a booking to the office', () => {
    expect(answerFromCalendar(offer('countered', [FRI, SAT]), CALL, said({ [FRI]: 'yes', [SAT]: 'yes', [SUN]: 'none' }), [FRI, SAT])).toBeUndefined()
    expect(answerFromCalendar(offer('confirmed', [FRI]), CALL, said({ [FRI]: 'no', [SAT]: 'none', [SUN]: 'none' }), [FRI])).toBeUndefined()
  })

  it("takes only the Yes just pressed, not one before that couldn't be taken", () => {
    // Saturday's Yes was turned down (the day had filled) and still reads Yes in Google; Sunday's is new. Saturday stays asked.
    expect(answerFromCalendar(offer('offered'), CALL, said({ [FRI]: 'none', [SAT]: 'yes', [SUN]: 'yes' }), [SUN])).toEqual({ answer: 'accept', days: [SUN], asked: [FRI, SAT] })
    // A No to another day with that old Yes standing changes nothing.
    expect(answerFromCalendar(offer('offered'), CALL, said({ [FRI]: 'no', [SAT]: 'yes', [SUN]: 'none' }), [FRI])).toBeUndefined()
  })

  it('opens a declined offer again only for a Yes just pressed, for that day', () => {
    expect(answerFromCalendar(offer('declined'), CALL, said({ [FRI]: 'no', [SAT]: 'yes', [SUN]: 'none' }), [SAT])).toEqual({ answer: 'accept', days: [SAT], asked: [SUN] })
    expect(answerFromCalendar(offer('declined'), CALL, said({ [FRI]: 'no', [SAT]: 'yes', [SUN]: 'none' }), [FRI])).toBeUndefined()
  })
})

describe('offerOnCalendar: a Yes after asking for a different rate', () => {
  const day = (d: string, response: 'accepted' | 'needsAction'): CalendarDay => ({
    id: `ph/${d}/p1`,
    phaseId: 'ph',
    projectId: 'j',
    day: d,
    calendarId: 'cal',
    title: 'Job',
    state: 'on',
    problem: null,
    link: null,
    guests: [{ personId: 'p1', offerId: 'o1', response, problem: null }],
  })
  const days = { a: day(FRI, 'accepted'), b: day(SAT, 'needsAction') }

  it('tells the office to ring them, rather than read it as a yes', () => {
    expect(offerOnCalendar({ id: 'o1', status: 'countered', days: [FRI, SAT] }, days, FRI)?.warning).toBe(COUNTERED_YES)
  })

  it("says that Yes doesn't count once the office has said no to the rate, as the offer is only asked again", () => {
    // A Yes on an offer only asked again, with no reason the app couldn't take it, was pressed while the rate was with the office.
    expect(offerOnCalendar({ id: 'o1', status: 'offered', days: [FRI, SAT], counterRateCents: 30000 }, days, FRI)?.warning).toBe(YES_WHILE_ASKING)
    // With no rate asked for, it says nothing of one.
    expect(offerOnCalendar({ id: 'o1', status: 'offered', days: [FRI, SAT], counterRateCents: null }, days, FRI)?.warning).toBeNull()
    // Once they say yes on their page, it stands.
    expect(offerOnCalendar({ id: 'o1', status: 'accepted', days: [FRI, SAT] }, days, FRI)?.warning).toBeNull()
  })
})

describe('ratesClosedBy: a Confirm that fills the call over a rate still asked for', () => {
  const call = { start: FRI, end: SAT, needed: 1 }
  const o = (id: string, personId: string, status: Offer['status'], days: string[] = [FRI, SAT]) => ({ id, personId, status, days })

  it("names the rate asked for when confirming someone's yes leaves no day short", () => {
    const offers = [o('a', 'aoife', 'accepted'), o('t', 'tommo', 'countered'), o('n', 'niamh', 'offered')]
    expect(ratesClosedBy(call, offers, 'a').map((x) => x.id)).toEqual(['t'])
  })

  it('names none when a day is still short after it', () => {
    const offers = [o('a', 'aoife', 'accepted', [FRI]), o('t', 'tommo', 'countered')]
    expect(ratesClosedBy(call, offers, 'a')).toEqual([])
  })

  it('counts the rate being agreed as taking its place, and closes the others', () => {
    const offers = [o('t', 'tommo', 'countered'), o('s', 'sean', 'countered')]
    expect(ratesClosedBy(call, offers, 't').map((x) => x.id)).toEqual(['s'])
  })

  it('names none for an offer that is not a yes or a rate', () => {
    expect(ratesClosedBy(call, [o('a', 'aoife', 'offered'), o('t', 'tommo', 'countered')], 'a')).toEqual([])
  })
})
