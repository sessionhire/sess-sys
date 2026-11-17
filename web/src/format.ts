/** How the app writes sizes and times, the same on every screen. */

export function size(bytes = 0) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** "today at 03:02", "yesterday at 03:01", "tomorrow at 03:00", or "28 Sept at 03:00". */
export function when(iso: string) {
  return `${dayOf(iso)} at ${new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * "today", "yesterday", "tomorrow", or "28 Sept": the day `when` says, for a row with no room for the time. With `year`, a day
 * in another year says which, "14 Oct 2025", as a crew day does (audit, 20 October 2026, finding 89).
 */
export function dayOf(iso: string, year = false) {
  const at = new Date(iso)
  const dayOffset = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return d.toDateString()
  }
  if (at.toDateString() === dayOffset(0)) return 'today'
  if (at.toDateString() === dayOffset(-1)) return 'yesterday'
  if (at.toDateString() === dayOffset(1)) return 'tomorrow'
  return at.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: year && at.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
}

/** What a screen says where a rate this device isn't sent would be (ADR 0046). */
export const RATE_HIDDEN = 'rate hidden for your role'

/** "€320", "rate to agree", or that it's hidden for this role (ADR 0046), never "€0" or "€NaN". */
export function rateText(cents: number | null | undefined, hidden: boolean | undefined): string {
  if (hidden) return RATE_HIDDEN
  if (cents === null || cents === undefined) return 'rate to agree'
  return `€${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}
