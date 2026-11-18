import { useEffect, useState } from 'react'
import type { Auth } from './auth.ts'
import { Icon } from './Icon.tsx'

/**
 * A 4px grid over the whole app, for checking that things line up with the
 * design system's space steps (18 November 2026, Colly's ask). It is a
 * looking tool for whoever designs the app, not part of the app: only the
 * account named here gets the switch, from who the server says is signed in
 * (/api/me), and the grid can't be pressed: every press goes through it to
 * the page. On or off is kept on this device.
 */
const DESIGNERS = new Set(['colly@sessionhire.com'])
const KEY = 'sh.grid'

export function canSeeGrid(auth: Auth): boolean {
  return auth.status === 'signed-in' && DESIGNERS.has(auth.user.email.trim().toLowerCase())
}

function kept(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function useGrid(allowed: boolean): [boolean, () => void] {
  const [on, setOn] = useState(kept)
  const toggle = () =>
    setOn((was) => {
      const next = !was
      try {
        if (next) localStorage.setItem(KEY, 'on')
        else localStorage.removeItem(KEY)
      } catch {
        // Storage refused: the grid still shows until the page is reloaded.
      }
      return next
    })
  return [allowed && on, toggle]
}

/** The switch, at the foot of the sidebar on a desk. */
export function GridButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="grid-button" aria-pressed={on} onClick={onToggle} title="Show a 4px grid over the app, to check things line up">
      <Icon name="pattern" />
      <span>4px grid</span>
    </button>
  )
}

/**
 * The grid itself: fixed over the screen, under nothing, pressed through. Its lines follow the page as it scrolls, so a part
 * on the grid stays on it at any scroll, not only at the top. A finer line every 4px, a firmer one every 16px.
 */
export function GridOverlay() {
  const [y, setY] = useState(0)
  useEffect(() => {
    let frame = 0
    const on = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setY(-(Math.round(scrollY) % 16)))
    }
    on()
    addEventListener('scroll', on, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('scroll', on)
    }
  }, [])
  return <div className="grid-overlay" aria-hidden="true" style={{ backgroundPositionY: `${y}px` }} />
}
