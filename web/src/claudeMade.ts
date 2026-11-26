import type { ClaudeMade } from '@sh/shared'
import { useEffect, useSyncExternalStore } from 'react'
import { getJson } from './jobs/rms.ts'

/**
 * What Claude made from the operations mailbox that nobody has changed since (ADR 0200), for the marks on jobs, clients
 * and venues: "Drafted by Claude" until someone changes the job or its quote, "Added by Claude" until someone edits the
 * client or venue. Asked of the server once for every screen that shows a mark, and again each minute while one does,
 * so the rows of a list don't each ask.
 */

const NONE: ClaudeMade = { jobs: [], clients: [], venues: [] }
const AGAIN_MS = 60_000

const EMPTY = { jobs: new Set<string>(), clients: new Set<string>(), venues: new Set<string>() }
let made: { jobs: Set<string>; clients: Set<string>; venues: Set<string> } = { jobs: new Set(), clients: new Set(), venues: new Set() }
let askedAt = 0
let asking: Promise<void> | undefined
const listeners = new Set<() => void>()

function ask(): void {
  if (asking || Date.now() - askedAt < AGAIN_MS / 2) return
  asking = getJson<ClaudeMade>('/api/assistant/made')
    .then((l) => {
      askedAt = Date.now()
      const m = l.state === 'ready' ? l.data : l.state === 'gone' ? NONE : undefined
      if (!m) return
      made = { jobs: new Set(m.jobs), clients: new Set(m.clients), venues: new Set(m.venues) }
      for (const fn of listeners) fn()
    })
    .finally(() => (asking = undefined))
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** The marks, while Claude is offered here (turned on, and money to see); nothing otherwise. */
export function useClaudeMade(offered: boolean) {
  const now = useSyncExternalStore(subscribe, () => made)
  useEffect(() => {
    if (!offered) return
    ask()
    // Each screen asks each minute; asks within half a minute of the last are left, so many rows still mean one ask.
    const t = setInterval(ask, AGAIN_MS)
    return () => clearInterval(t)
  }, [offered])
  return offered ? now : EMPTY
}
