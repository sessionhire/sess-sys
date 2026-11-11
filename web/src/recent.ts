import { useSyncExternalStore } from 'react'

/**
 * What was opened lately on this device, for the search palette's Recent (ADR 0148): the jobs, clients, venues, people,
 * products and pieces of kit whose pages were looked at, newest first. Only what it is and its id are kept, never its name,
 * so the palette shows each as it is now, drops one that's gone, and shows only what the role signed in is sent (ADR 0042).
 * Signing out forgets them, as it forgets the rest of the company's data.
 */

export type OpenedKind = 'job' | 'client' | 'venue' | 'person' | 'product' | 'item'
export interface Opened {
  kind: OpenedKind
  id: string
}

/** This app's own localStorage key. */
const KEY = 'sh.recent'
/** Kept: more than are shown, so one that's since gone or isn't this role's doesn't leave the list short. */
const KEPT = 12

/** The screens under #jobs/ that aren't a job. */
const JOBS_SCREENS = new Set(['plan', 'board', 'calendar', 'import', 'tidy', 'clients', 'venues', 'money', 'notes-kit'])

const record = (kind: OpenedKind, raw: string | undefined): Opened | undefined => {
  if (!raw) return undefined
  try {
    const id = decodeURIComponent(raw)
    return id ? { kind, id } : undefined
  } catch {
    return undefined
  }
}

/** The record an address opens, if it opens one: a job on any of its tabs, a client, a venue, a person, a product or an item. */
export function openedAt(hash: string): Opened | undefined {
  const [area, a, b] = hash.replace(/^#/, '').split('/')
  if (area === 'jobs' && a === 'clients') return record('client', b)
  if (area === 'jobs' && a === 'venues') return record('venue', b)
  if (area === 'jobs' && a && !JOBS_SCREENS.has(a)) return record('job', a)
  if (area === 'crew' && a === 'person') return record('person', b)
  if (area === 'stock' && a === 'product') return record('product', b)
  if (area === 'stock' && a === 'item') return record('item', b)
  return undefined
}

const same = (x: Opened, y: Opened) => x.kind === y.kind && x.id === y.id

function read(): Opened[] {
  try {
    const was: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(was) ? was.filter((o): o is Opened => typeof o?.kind === 'string' && typeof o?.id === 'string').slice(0, KEPT) : []
  } catch {
    return []
  }
}

let list: readonly Opened[] = []
const listeners = new Set<() => void>()
function set(next: readonly Opened[]) {
  list = next
  try {
    if (next.length) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // Private browsing or a full store: Recent lasts while the app is open.
  }
  for (const fn of listeners) fn()
}

/** Puts what an address opens at the top, once. */
export function noteOpened(hash: string) {
  const opened = openedAt(hash)
  if (!opened) return
  if (list[0] && same(list[0], opened)) return
  set([opened, ...list.filter((o) => !same(o, opened))].slice(0, KEPT))
}

/** Starts keeping them; called once, before the first screen is drawn. */
export function keepRecent() {
  list = read()
  noteOpened(location.hash)
  addEventListener('hashchange', () => noteOpened(location.hash))
}

/** On signing out: a shared or handed-back phone shouldn't say what the last person looked at. */
export const forgetRecent = () => set([])

export function useRecent(): readonly Opened[] {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => list,
  )
}
