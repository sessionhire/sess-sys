import type { View } from '@sh/shared'
import { useMemo } from 'react'
import { useAuth } from './auth.ts'
import { Icon } from './Icon.tsx'
import { unreadCount, useNotices } from './notices.ts'
import { openSearch, paletteKeys, useSearchOpen } from './searchOpen.ts'

/** Top right, before dark and light: the count is of things waiting for you, so it's the accent, and said in words to a screen reader. */
export function NoticesButton({ view }: { view: View }) {
  const auth = useAuth()
  const notices = useNotices()
  // Not looked for here: drawn on every screen's bar, it would look again at every move. notices.ts looks on signing in.
  // Lines, not changes (audit, 20 October 2026, finding 68): a bulk change, or a day's changes to one job, count once.
  const n = useMemo(() => unreadCount(notices, view), [notices, view])
  if (auth.status !== 'signed-in' && auth.status !== 'open') return null
  const words = n === 0 ? 'Notifications' : `Notifications, ${n} new`
  return (
    <a
      className="notices-button"
      href="#notifications"
      aria-label={words}
      title={words}
      aria-current={location.hash === '#notifications' ? 'page' : undefined}
    >
      <Icon name="notifications" />
      {n > 0 && (
        <span className="badge" aria-hidden="true">
          {n > 99 ? '99+' : n}
        </span>
      )}
    </a>
  )
}

/**
 * One search for everything (review of 11 November 2026, finding 13), beside the bell on every screen's bar: a magnifier, on a
 * phone and at a desk, that opens the search palette over the screen (ADR 0147). Ctrl K, or Command K on a Mac, opens it too,
 * and / at a desk.
 */
export function SearchButton() {
  const open = useSearchOpen()
  const words = `Search everything (${paletteKeys.join(' ')})`
  return (
    <button type="button" className="notices-button search-button" onClick={openSearch} aria-label="Search" aria-haspopup="dialog" aria-expanded={open} title={words}>
      <Icon name="search" />
    </button>
  )
}
