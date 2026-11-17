import { describe, expect, it } from 'vitest'
import { offerNews, type OfferNews } from '../src/words.ts'

/**
 * Someone else's change to a person's own offer, said to them (audit of 12 November 2026, finding 17): where they stood
 * before it decides what's over for them, booked, holding the day on a job the client hasn't said yes to (ADR 0150), or
 * only asked, in the words their invite, their page and Home use.
 */

const say = (n: OfferNews) => offerNews(n, 'Audio tech', 'Castle Yard Sessions')

describe('news of their own offer', () => {
  it('says being booked, or down to hold the day, to them', () => {
    expect(say({ kind: 'offered' })).toBe("You've been offered Audio tech on Castle Yard Sessions")
    expect(say({ kind: 'booked', hold: false, theirRate: false })).toBe("You're booked as Audio tech on Castle Yard Sessions")
    expect(say({ kind: 'booked', hold: false, theirRate: true })).toBe("You're booked as Audio tech on Castle Yard Sessions, at the rate you asked for")
    // Hold is short for "hold the day", never the job "on hold" (Colly, 12 November 2026).
    expect(say({ kind: 'booked', hold: true, theirRate: false })).toBe("Hold the day: you're down as Audio tech on Castle Yard Sessions")
    expect(say({ kind: 'job-confirmed' })).toBe("Castle Yard Sessions is confirmed, so you're booked as Audio tech")
    expect(say({ kind: 'rate-not-agreed' })).toBe("Your rate for Audio tech on Castle Yard Sessions wasn't agreed, so the offer stands at the rate offered")
  })

  it('says what is over for them by where they stood: booked, holding the day, or asked', () => {
    expect(say({ kind: 'withdrawn', was: 'asked' })).toBe('Your offer of Audio tech on Castle Yard Sessions was withdrawn')
    expect(say({ kind: 'withdrawn', was: 'booked' })).toBe("You're no longer booked as Audio tech on Castle Yard Sessions")
    expect(say({ kind: 'withdrawn', was: 'hold' })).toBe('You no longer need to hold the day for Audio tech on Castle Yard Sessions')
    expect(say({ kind: 'call-cancelled', was: 'asked' })).toBe('Audio tech on Castle Yard Sessions was cancelled, so your offer is closed')
    expect(say({ kind: 'call-cancelled', was: 'booked' })).toBe("Audio tech on Castle Yard Sessions was cancelled, so you're no longer booked")
    expect(say({ kind: 'call-cancelled', was: 'hold' })).toBe('Audio tech on Castle Yard Sessions was cancelled, so you no longer need to hold the day')
    expect(say({ kind: 'job-stopped', job: 'cancelled', was: 'booked' })).toBe("Castle Yard Sessions was cancelled, so you're no longer booked as Audio tech")
    expect(say({ kind: 'job-stopped', job: 'cancelled', was: 'hold' })).toBe('Castle Yard Sessions was cancelled, so you no longer need to hold the day for Audio tech')
    expect(say({ kind: 'job-stopped', job: 'lost', was: 'asked' })).toBe("Castle Yard Sessions didn't go ahead, so your offer of Audio tech is closed")
    expect(say({ kind: 'filled', taker: 'Dara Kelly' })).toBe('Audio tech on Castle Yard Sessions went to Dara Kelly, so your offer is closed')
    expect(say({ kind: 'filled', taker: null })).toBe('Audio tech on Castle Yard Sessions is filled, so your offer is closed')
  })
})
