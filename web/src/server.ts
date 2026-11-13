import { markSignedOut } from './auth.ts'
import { client } from './sync.ts'

/**
 * Asking the server for something outside the sync: the Google Calendar
 * connection (ADR 0008) and bringing jobs in from a calendar (ADR 0011).
 * These need signal; what goes wrong comes back in words to show.
 */

const base = import.meta.env.VITE_API_BASE ?? ''

/** How long to wait for an answer: a minute, or longer for work the server is asked to do in one go, such as bringing a season in. */
export const A_MINUTE = 60_000
export const AS_LONG_AS_IT_TAKES = 10 * 60_000

/** No answer came: no signal, or the wait ran out. What was asked may still have been done, so it's asked about, not done again. */
export class NoAnswer extends Error {}

/** The server's answer, or an error saying in words what went wrong. */
export async function ask<T>(path: string, init?: RequestInit, waitMs = A_MINUTE): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${base}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(waitMs), ...init })
  } catch (err) {
    // Giving up on a slow answer is not the same as no signal: the server may well finish what it was asked.
    if ((err as Error).name === 'TimeoutError') throw new NoAnswer("The server hasn't answered yet. It may still be working on it: give it a minute, then look again.")
    throw new NoAnswer("Couldn't reach the server. Try again when you have signal.")
  }
  if (res.status === 401) {
    markSignedOut()
    throw new Error('Signed out.')
  }
  if (res.status === 413) throw new Error('That is too big to send: up to 5 MB.')
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(error ?? `The server answered ${res.status}. Try again in a minute.`)
  }
  return (await res.json()) as T
}

/** The same, sending `body`, with this device's code for the history. */
export const post = <T,>(path: string, body?: unknown, waitMs?: number) =>
  ask<T>(
    `${path}?client=${encodeURIComponent(client.clientId)}`,
    {
      method: 'POST',
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    },
    waitMs
  )

/** The server's own address for a path, to send the browser to. */
export const serverUrl = (path: string) => `${base}${path}`
