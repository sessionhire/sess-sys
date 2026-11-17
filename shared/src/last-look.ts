import { dayLabel, daysBetween } from './crew-days.ts'

/**
 * "2 more since Tuesday" on Home's counts (Move 10 of the sweep of 6
 * November 2026): what changed since the last look on this phone. Nothing is
 * pushed to anyone (ADR 0058 keeps the bell personal), so the mark is the
 * device's own, said as such. It moves a day at a time: all through today a
 * count is held against the last look on an earlier day, so going back and
 * forth to Home doesn't wipe what moved overnight.
 */
export interface Look {
  day: string
  counts: Record<string, number>
}

/** What a device keeps: the last look on an earlier day, held against all today, and the latest. */
export interface Looks {
  base?: Look
  last?: Look
}

/** Looking again today: the look the counts are held against, and what to keep. */
export function lookAgain(stored: Looks | undefined, today: string, counts: Record<string, number>): { base: Look | undefined; next: Looks } {
  const earlier = (l: Look | undefined) => (l && l.day < today ? l : undefined)
  const base = earlier(stored?.last) ?? earlier(stored?.base)
  return { base, next: { base, last: { day: today, counts } } }
}

/** How many more of a count there are than at the look it's held against: none when it fell, held or there's no look. */
export function moreSince(base: Look | undefined, key: string, count: number): number {
  if (!base) return 0
  return Math.max(0, count - (base.counts[key] ?? 0))
}

/** "since yesterday", "since Tuesday" within the week, "since Tue 27 Oct" before it. */
export function sinceLabel(day: string, today: string): string {
  const ago = daysBetween(day, today)
  if (ago <= 1) return 'since yesterday'
  if (ago < 7) return `since ${new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IE', { weekday: 'long', timeZone: 'UTC' })}`
  return `since ${dayLabel(day, today)}`
}
