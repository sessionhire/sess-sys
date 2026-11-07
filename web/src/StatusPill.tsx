import type { ReactNode } from 'react'

/**
 * The one status pill (audit finding 24): amber when someone has to act
 * (or something is fit but not right: a van off the road, kit damaged but
 * fit to go out), settled drawn quiet with its word kept (healthy is quiet),
 * grey when it's off or over, and the bad tone for what stops work (kit
 * that can't go out, a clash). Its word always says the state, so the tone
 * is never the only sign. A record's pill sits beside its name in the page
 * head; a row's goes where the row isn't already in a group named for its
 * state (Move 11 of the sweep of 6 November 2026). Anything this device has
 * changed but the server hasn't yet taken says so, whatever its status, in
 * a quiet dashed grey: nobody has to act on it, so it isn't amber.
 */

export const WAITING_TO_SYNC = 'Waiting to sync'

export type PillTone = 'pending' | 'confirmed' | 'cancelled' | 'bad'

export function StatusPill({ tone, pending = false, children }: { tone: PillTone; pending?: boolean; children?: ReactNode }) {
  return <span className={`pill ${pending ? 'waiting' : tone}`}>{pending ? WAITING_TO_SYNC : children}</span>
}

/** The pill only while a change is still on its way; nothing otherwise. */
export function Pending({ pending }: { pending: boolean }) {
  return pending ? <StatusPill tone="pending" pending /> : null
}
