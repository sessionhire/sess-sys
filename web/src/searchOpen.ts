import { useSyncExternalStore } from 'react'

/**
 * Whether the search palette is open (ADR 0147): the magnifier, Ctrl K or Command K, / at a desk and an old #search link all
 * open the same one, over whatever screen is showing, so it's held here rather than in the address.
 */

let open = false
const listeners = new Set<() => void>()

function set(next: boolean) {
  if (open === next) return
  open = next
  for (const fn of listeners) fn()
}

export const openSearch = () => set(true)
export const closeSearch = () => set(false)
export const toggleSearch = () => set(!open)

export function useSearchOpen(): boolean {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => open,
  )
}

/** A Mac, iPhone or iPad says Command where the rest say Ctrl. */
export const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

/** The keys that open it, as this device's keyboard has them: "⌘ K" or "Ctrl K". */
export const paletteKeys: readonly string[] = [apple ? '⌘' : 'Ctrl', 'K']
