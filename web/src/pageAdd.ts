import { useSyncExternalStore } from 'react'

/**
 * A list page's add (Colly, 10 November 2026): "New job", "New product" or
 * "New person" sits on the title's line, right of it, where the page says
 * what it is; its form opens in the list under it (Fold.tsx's `from`). The
 * title and the form are drawn by different parts of the screen, so they
 * meet here, by the list's name: each press is counted, and the form opens
 * on every new count.
 */

const listeners = new Set<() => void>()
const asked = new Map<string, number>()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** The title's button pressed: open the form named `key`. */
export function askToAdd(key: string) {
  asked.set(key, (asked.get(key) ?? 0) + 1)
  for (const fn of listeners) fn()
}

/** How many times the add named `key` has been asked for: a new number opens its form. */
export function useAddAsked(key: string | undefined): number {
  return useSyncExternalStore(subscribe, () => (key ? (asked.get(key) ?? 0) : 0))
}

/** The title's button for `key`, for the focus to go back to once its form closes. */
export const addButton = (key: string) => document.querySelector<HTMLElement>(`.page-add[data-add="${key}"]`)
