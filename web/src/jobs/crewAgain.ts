import { stoppedCrew, type CallView } from '@sh/shared'
import { forgetPicksWaiting, pickWhenOpened } from '../crew/offerPicks.ts'
import { client } from '../sync.ts'

/** A job's crew calls cancelled with it the last time it stopped, with who was on each (ADR 0164). */
export type CrewAgain = NonNullable<ReturnType<typeof stoppedCrew<CallView>>>

/**
 * Asks for them again (ADR 0164; audit of 12 November 2026, finding 19): each call comes back open with nobody offered,
 * and its Offer opens with the same people picked, so the office sees who before anything is sent. The same from the
 * job's Crew tab and from its Next button (ADR 0140), so the button does what the card says. Gives the call to land on:
 * the first with anyone to pick.
 */
export async function askForCrewAgain(again: CrewAgain): Promise<string | undefined> {
  // Picked before the calls come back, so each one's Offer has them whenever it first opens.
  for (const { call, people } of again.calls) pickWhenOpened(call.id, people.map((p) => p.id))
  try {
    for (const { call } of again.calls) await client.mutate('call.reopen', { id: call.id })
  } catch (err) {
    for (const { call } of again.calls) forgetPicksWaiting(call.id)
    throw err
  }
  return (again.calls.find((c) => c.people.length) ?? again.calls[0])?.call.id
}
