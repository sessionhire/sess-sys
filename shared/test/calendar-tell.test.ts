import { describe, expect, it } from 'vitest'
import { endedTitle, tells, toldNews, toldOf, toldTitle } from '../src/calendar.ts'

/**
 * A person's own invite telling them what happens next (ADR 0153; audit of 12 November 2026, findings 4 and 8): its title
 * says where they stand and their call time, so being booked or a call time that moves is a change Google emails, and a
 * day that comes off says why. Made-up jobs throughout.
 */

describe("a person's own invite telling them what happens next", () => {
  it('reaches nobody while off, everyone invited when on, and only the addresses listed while being tried', () => {
    expect(tells(undefined, 'aoife@example.com')).toBe(false)
    expect(tells({ tell: 'off', tellTo: ['aoife@example.com'] }, 'aoife@example.com')).toBe(false)
    expect(tells({}, 'aoife@example.com')).toBe(false)
    expect(tells({ tell: 'on' }, 'aoife@example.com')).toBe(true)
    expect(tells({ tell: 'on' }, '')).toBe(false)
    expect(tells({ tell: 'on' }, null)).toBe(false)
    expect(tells({ tell: 'test', tellTo: ['aoife@example.com'] }, ' Aoife@Example.COM')).toBe(true)
    expect(tells({ tell: 'test', tellTo: ['aoife@example.com'] }, 'tommo@example.com')).toBe(false)
    expect(tells({ tell: 'test' }, 'aoife@example.com')).toBe(false)
  })

  it('titles the day with "Booked:" once booked, and the call time while there is one', () => {
    expect(toldTitle('Harbour Lights Festival - Show 1/2', 'booked', '06:00')).toBe('Booked: Harbour Lights Festival - Show 1/2, call 06:00')
    expect(toldTitle('Harbour Lights Festival - Show 1/2', 'asked', '06:00')).toBe('Harbour Lights Festival - Show 1/2, call 06:00')
    expect(toldTitle('Harbour Lights Festival - Show 1/2', 'yes', null)).toBe('Harbour Lights Festival - Show 1/2')
    // Picked for a job the client hasn't said yes to: still HOLD, short for hold the day, and never "Booked".
    expect(toldTitle('HOLD Harbour Lights Festival - Show', 'picked', '08:00')).toBe('HOLD Harbour Lights Festival - Show, call 08:00')
  })

  it('counts being booked or picked, and a call time that moves, as news; their own yes, or telling just turned on, is not', () => {
    const asked = toldOf('asked', '08:00')
    expect(toldNews(asked, toldOf('booked', '08:00'))).toBe(true)
    expect(toldNews(toldOf('yes', '08:00'), toldOf('booked', '08:00'))).toBe(true)
    expect(toldNews(toldOf('yes', null), toldOf('picked', null))).toBe(true)
    expect(toldNews(toldOf('booked', '08:00'), toldOf('booked', '06:00'))).toBe(true)
    expect(toldNews(asked, toldOf('asked', '07:00'))).toBe(true)
    expect(toldNews(toldOf('booked', null), toldOf('booked', '08:00'))).toBe(true)
    // Not news: their own yes, the client's yes to someone already picked, and anything said before the invite told them.
    expect(toldNews(asked, toldOf('yes', '08:00'))).toBe(false)
    expect(toldNews(toldOf('picked', '08:00'), toldOf('booked', '08:00'))).toBe(false)
    expect(toldNews(toldOf('booked', '08:00'), toldOf('booked', '08:00'))).toBe(false)
    expect(toldNews(null, toldOf('booked', '08:00'))).toBe(false)
    expect(toldNews(toldOf('booked', '08:00'), undefined)).toBe(false)
  })

  it('says why a day comes off in its last title, without HOLD', () => {
    expect(endedTitle('Harbour Lights Festival - Show 1/2', 'filled')).toBe('Filled by someone else: Harbour Lights Festival - Show 1/2')
    expect(endedTitle('HOLD Harbour Lights Festival - Show', 'withdrawn')).toBe('Withdrawn by the office: Harbour Lights Festival - Show')
    expect(endedTitle('Harbour Lights Festival - Show 1/2', 'job-cancelled')).toBe('The job was cancelled: Harbour Lights Festival - Show 1/2')
    expect(endedTitle('Harbour Lights Festival - Show 1/2', 'job-lost')).toBe("The job didn't go ahead: Harbour Lights Festival - Show 1/2")
    expect(endedTitle('Harbour Lights Festival - Show 1/2', 'declined')).toBe('You declined: Harbour Lights Festival - Show 1/2')
    expect(endedTitle('Harbour Lights Festival - Show 1/2', 'pulled-out')).toBe("Can't make it: Harbour Lights Festival - Show 1/2")
  })
})
