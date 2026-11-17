import { useSyncExternalStore } from 'react'

/**
 * Who has been picked in a call's Offer and not yet sent it, by call, so the job's Next button can send to them rather than
 * land on the form they're already in (crew offer that wouldn't send, 11 November 2026): with people picked, the filled
 * button on the page is the one that offers it, never a second press that only opens the same form again.
 */
const picks = new Map<string, readonly string[]>()
const heard = new Set<() => void>()
const none: readonly string[] = []

export function setOfferPicks(callId: string, names: readonly string[]) {
  const was = picks.get(callId) ?? none
  if (was.length === names.length && was.every((n, i) => n === names[i])) return
  if (names.length) picks.set(callId, names)
  else picks.delete(callId)
  for (const f of heard) f()
}

/** The names picked in a call's Offer and not yet sent, in the order picked. */
export function useOfferPicks(callId: string | undefined): readonly string[] {
  return useSyncExternalStore(
    (f) => (heard.add(f), () => void heard.delete(f)),
    () => (callId && picks.get(callId)) || none
  )
}

/** The id of a call's Offer form, for the Next button to send it. */
export const offerFormId = (callId: string) => `offer-form-${callId}`

/**
 * People to pick when a call's Offer next opens (ADR 0164): the crew on it before its job was stopped, once it's asked for
 * again. Picked, not offered: nothing goes to them until Offer is pressed.
 */
const waiting = new Map<string, readonly string[]>()

/** The people, by id, a call's Offer starts with when it next opens. */
export function pickWhenOpened(callId: string, personIds: readonly string[]) {
  if (personIds.length) waiting.set(callId, personIds)
  else waiting.delete(callId)
}

/** Who a call's Offer starts with, by id. */
export const picksWaiting = (callId: string): readonly string[] => waiting.get(callId) ?? none

/** Once its Offer has opened with them: they're the form's own picks from then on. */
export function forgetPicksWaiting(callId: string) {
  waiting.delete(callId)
}
