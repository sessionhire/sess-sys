import { irishToday } from './day.ts'
import { irishClock } from './late.ts'

/**
 * What changed on someone's booking since they said yes to it, as their link says it (UX sweep, 6 November 2026, move 6).
 * Moving a call sends nothing (ADR 0048), so the page says it the next time it's opened. Three facts are watched, the ones
 * that get someone to the right place on the right day at the right time: the days they hold, the call time and the venue.
 * One that moved reads as it is now with what they said yes to in brackets, "07:30 (was 09:00)". A change that can't be
 * said that way, a call time or venue that wasn't there or has gone, or a change the log holds in a shape this can't read,
 * reads "Changed since you said yes · check the call" with no bracket, rather than guessing.
 */

/**
 * How long a change is news on the link, at most: a week from it, or until the booking's first call after it, whichever
 * comes first (Colly's question 10). A booking that ended is said on its card for as long.
 */
export const CHANGE_SHOWN_DAYS = 7

/** What the link watches on a booking: the days they hold, the call time and the venue. */
export interface Watched {
  days: readonly string[]
  callTime: string | null
  venue: string
}

/** One change to a booking from the log: when the server made it, and the booking after it; nothing where the log holds a shape this can't read. */
export interface WatchedStep {
  at: Date
  after: Watched | undefined
}

/** What the link says of a booking's changes: each moved fact as it was when they said yes, and whether something changed that can't be said that way. */
export interface SinceYes {
  was: { days?: string[]; callTime?: string; venue?: string }
  unclear: boolean
}

/** A moment as Ireland's day and time, 2026-11-14 07:30, to set beside a call's day and time. */
const irishMinute = (at: Date) => `${irishToday(at)} ${irishClock(at)}`

/**
 * Until when a change made at `at` is news, as Ireland's day and time: a week on, or the booking's first call after it,
 * whichever comes first. A booking with no call time has its call at the end of its day, so the day itself still says it;
 * one with no call left after the change has nothing to say.
 */
export function newsUntil(at: Date, booking: Pick<Watched, 'days' | 'callTime'>): string {
  const made = irishMinute(at)
  const call = [...booking.days]
    .sort()
    .map((d) => `${d} ${booking.callTime ?? '24:00'}`)
    .find((c) => c > made)
  const week = irishMinute(new Date(at.getTime() + CHANGE_SHOWN_DAYS * 86_400_000))
  return call === undefined ? made : call < week ? call : week
}

/** Whether a change made at `at` is still news to the booking's person. */
export const isNews = (at: Date, booking: Pick<Watched, 'days' | 'callTime'>, now = new Date()) => irishMinute(now) < newsUntil(at, booking)

const FACTS = ['days', 'callTime', 'venue'] as const
type Fact = (typeof FACTS)[number]

/** A fact as one string to compare, empty when it isn't there. */
const valueOf = (w: Watched, f: Fact) => (f === 'days' ? [...w.days].sort().join() : (w[f] ?? ''))

/**
 * What the link says of a booking's changes since its yes, `now`. `yes` is the booking as they said yes to it, `before`
 * as it stood a week ago, or at the yes if that's since, and `steps` the changes since then, in order: older ones are no
 * longer news. A fact is said while its last change is news, against what they said yes to, so two changes in a row
 * read as one, and a fact moved back to it says nothing. Nothing when there's nothing to say.
 */
export function sinceYes(yes: Watched, before: Watched, steps: readonly WatchedStep[], now = new Date()): SinceYes | undefined {
  const last = new Map<Fact, Date>()
  const unread: Date[] = []
  let state = before
  for (const s of steps) {
    if (!s.after) {
      unread.push(s.at)
      continue
    }
    for (const f of FACTS) if (valueOf(s.after, f) !== valueOf(state, f)) last.set(f, s.at)
    state = s.after
  }
  const was: SinceYes['was'] = {}
  let unclear = unread.some((at) => isNews(at, state, now))
  for (const f of FACTS) {
    const at = last.get(f)
    if (!at || !isNews(at, state, now) || valueOf(state, f) === valueOf(yes, f)) continue
    if (!valueOf(yes, f) || !valueOf(state, f)) unclear = true
    else if (f === 'days') was.days = [...yes.days]
    else if (f === 'venue') was.venue = yes.venue
    else if (yes.callTime) was.callTime = yes.callTime
  }
  return unclear || Object.keys(was).length ? { was, unclear } : undefined
}
