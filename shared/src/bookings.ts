import { dayLabel, daysBetween, daysLabel, eachDay, type CrewCall, type Offer } from './crew.ts'
import { plural } from './stock.ts'

/**
 * A person's own bookings and offers, said the same way on their link, on Home › Me and on their own page in the app
 * (UX sweep, 6 November 2026, move 6): one row, the job, then role · phase · days · call, then where it stands; and one
 * line at a glance of what's waiting on them and what's next, each part a way to it.
 */

/** The days a row says, as the booking's card says them: the call's while it's still an offer, then the ones they hold. */
export function bookingDays(o: Pick<Offer, 'status' | 'days'>, c: Pick<CrewCall, 'start' | 'end'>): string[] {
  return o.status === 'offered' ? eachDay(c.start, c.end) : o.days
}

/**
 * A fact kept whole on its line, its spaces ones a line never breaks at: a phone wraps a row between its facts, so it
 * never leaves "09:00" or "Nov" alone at the start of a line.
 */
export const wholeFact = (fact: string) => fact.replace(/ /g, '\u00a0')

/** Each date of a days label kept whole, "Thu 19 Nov"; a span or a list still wraps between its dates. */
const wholeDates = (label: string) => label.replace(/[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}(?: \d{4})?/g, wholeFact)

/** Between the facts of a row: a line breaks after the dot, never before it, so no line starts with one. */
export const FACT_GAP = '\u00a0· '

/** "Audio tech · Build · Sat 17 Oct · call 08:00": what a row says under the job's name. */
export function bookingLine(o: Pick<Offer, 'status' | 'days'>, c: Pick<CrewCall, 'role' | 'phase' | 'start' | 'end' | 'callTime'>, today: string): string {
  return [c.role, c.phase, wholeDates(daysLabel(bookingDays(o, c), today)), c.callTime && wholeFact(`call ${c.callTime}`)].filter(Boolean).join(FACT_GAP)
}

/**
 * A booking's next day: the first of the days it holds from today on or, holding none at all, of its call's. None once the
 * days it holds are over, though the call runs on for others: it isn't what they're on next.
 */
export function nextDayOf(o: Pick<Offer, 'days'>, c: Pick<CrewCall, 'start' | 'end'>, today: string): string | undefined {
  return (o.days.length ? [...o.days].sort() : eachDay(c.start, c.end)).find((d) => d >= today)
}

/** One of someone's bookings or offers in a surface's list: its offer and its call, whatever else the surface keeps with them. */
export type BookingOf<T> = (t: T) => readonly [Pick<Offer, 'id' | 'days'>, Pick<CrewCall, 'start' | 'end' | 'callTime'>]

/** Ascending, with anything missing after everything there. */
function ascending(a: string | null | undefined, b: string | null | undefined): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Someone's bookings and offers in the order their link, Home › Me and their page in the app all list them, soonest first:
 * by the next day each holds, the earlier call first on the same day, then any whose days are over while the call runs on.
 * The offer settles a tie, so no two surfaces order the same list differently.
 */
export function soonestFirst<T>(list: readonly T[], today: string, of: BookingOf<T>): T[] {
  return list
    .map((t) => {
      const [o, c] = of(t)
      return { t, day: nextDayOf(o, c, today), call: c.callTime, id: o.id }
    })
    .sort((a, b) => ascending(a.day, b.day) || ascending(a.call, b.call) || ascending(a.id, b.id))
    .map(({ t }) => t)
}

/**
 * The booking they're on next, and its day: the first in that order, while it holds a day from today on. One rule, so the
 * glance line on their link and on Home › Me names the same job.
 */
export function nextBooking<T>(list: readonly T[], today: string, of: BookingOf<T>): { booking: T; day: string } | undefined {
  const [first] = soonestFirst(list, today, of)
  if (first === undefined) return undefined
  const [o, c] = of(first)
  const day = nextDayOf(o, c, today)
  return day === undefined ? undefined : { booking: first, day }
}

/** "today" and "tomorrow" by their words, as the link's card for the day says them (audit, 5 November 2026, finding 91); other days as dates. */
export function dayWord(day: string, today: string): string {
  return day === today ? 'today' : daysBetween(today, day) === 1 ? 'tomorrow' : dayLabel(day, today)
}

/** What a glance line is made of: the offers waiting on them, the timesheets to send, and the booking they're on next. */
export interface Glance {
  offers: number
  timesheets?: number
  next?: Pick<CrewCall, 'project' | 'callTime'> & { day: string }
}

export interface GlancePart {
  /** Which part it is, for the surface to say where it goes. */
  key: 'offers' | 'timesheets' | 'next'
  text: string
}

/**
 * The glance line, part by part, in order: "2 offers to answer · Next: Harbour Lights, tomorrow, call 08:00". A part with
 * nothing to say isn't there, so the line is empty while nothing waits and nothing is booked (ADR 0033).
 */
export function glanceParts(g: Glance, today: string): GlancePart[] {
  const parts: GlancePart[] = []
  if (g.offers) parts.push({ key: 'offers', text: `${plural(g.offers, 'offer')} to answer` })
  if (g.timesheets) parts.push({ key: 'timesheets', text: `${plural(g.timesheets, 'timesheet')} to send` })
  if (g.next) parts.push({ key: 'next', text: `Next: ${g.next.project}, ${wholeFact(dayWord(g.next.day, today))}${g.next.callTime ? `, ${wholeFact(`call ${g.next.callTime}`)}` : ''}` })
  return parts
}
