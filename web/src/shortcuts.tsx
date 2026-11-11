import { useEffect, useRef, useState } from 'react'

/**
 * Keys at a desk (ADR 0120): the office does the same few things all day, so the places and New quote are two letters away
 * (G then J for Jobs, N then Q for a new quote), / searches everything (review of 11 November 2026, finding 13), F finds on the
 * page and ? lists them all. Only from 900px across, where
 * there's a keyboard; a phone never has them. A key is a shortcut only when nothing is taking typing: not in a field, not
 * held with Ctrl, Alt or the Command key, and not on a screen made for scanning, whose keyboard scanner types letters too
 * (scanKeys.ts). Each is shown where the slow way is: on the sidebar's places and on New quote, as the browser's hint.
 */

export interface Shortcut {
  keys: readonly string[]
  what: string
  /** Where it goes, or what it does. */
  go: string | 'find' | 'help'
  /** Only for those who see money: quotes. */
  money?: boolean
}

export const SHORTCUTS: readonly Shortcut[] = [
  { keys: ['G', 'H'], what: 'Home', go: '#home' },
  { keys: ['G', 'J'], what: 'Jobs', go: '#jobs' },
  { keys: ['G', 'P'], what: 'The planner', go: '#jobs/plan' },
  { keys: ['G', 'Q'], what: 'Quotes', go: '#quotes', money: true },
  { keys: ['G', 'S'], what: 'Stock', go: '#stock' },
  { keys: ['G', 'C'], what: 'Crew', go: '#crew' },
  { keys: ['G', 'M'], what: 'Menu', go: '#menu' },
  { keys: ['N', 'Q'], what: 'New quote', go: '#quotes/new', money: true },
  { keys: ['/'], what: 'Search everything', go: '#search' },
  { keys: ['F'], what: 'Find on this page', go: 'find' },
  { keys: ['?'], what: 'These shortcuts', go: 'help' },
]

/** "G then J", for the browser's hint on what it opens. */
export function shortcutHint(go: string): string | undefined {
  const s = SHORTCUTS.find((x) => x.go === go)
  return s ? `Shortcut: ${s.keys.join(' then ')}` : undefined
}

/** How long after G or N the second key still counts. */
const SECOND_KEY_MS = 1500

/** Someone typing, or a scanner's read: the key is theirs, not a shortcut. */
function typing(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return true
  const at = e.target instanceof Element ? e.target : null
  if (at?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog:not(.shortcuts)')) return true
  return !!document.querySelector('.scan-row input:not(:disabled)')
}

/** The keys, on a desk; `go` moves to a place, given how the Shell reaches it (Crew on People for a role without crew). */
export function useShortcuts({ on, money, go }: { on: boolean; money: boolean; go: (hash: string) => void }) {
  const [help, setHelp] = useState(false)
  const first = useRef<{ key: string; at: number } | undefined>(undefined)
  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.key.length !== 1) return
      const key = e.key.toUpperCase()
      const before = first.current && Date.now() - first.current.at < SECOND_KEY_MS ? first.current.key : undefined
      first.current = undefined
      const found = SHORTCUTS.find((s) => (!s.money || money) && (s.keys.length === 2 ? s.keys[0] === before && s.keys[1] === key : !before && (s.keys[0] === e.key || s.keys[0] === key)))
      if (found) {
        e.preventDefault()
        if (found.go === 'help') setHelp(true)
        else if (found.go === 'find') document.querySelector<HTMLInputElement>('main input[type="search"]:not(:disabled)')?.focus()
        else go(found.go)
        return
      }
      if (!before && (key === 'G' || key === 'N')) first.current = { key, at: Date.now() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [on, money, go])
  return { help, close: () => setHelp(false) }
}

/** The list of them, as the design system's dialog: Escape or Close shuts it and focus goes back where it was. */
export function ShortcutsSheet({ money, onClose }: { money: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog className="shortcuts" ref={ref} aria-labelledby="shortcuts-title" onClose={onClose}>
      <h2 id="shortcuts-title">Keyboard shortcuts</h2>
      <p className="hint">Press the keys one after the other, with nothing typed into a box. On a desk only.</p>
      <dl>
        {SHORTCUTS.filter((s) => !s.money || money).map((s) => (
          <div key={s.keys.join('')}>
            <dt>
              {s.keys.map((k, i) => (
                <span key={i}>
                  {i > 0 && ' then '}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </dt>
            <dd>{s.what}</dd>
          </div>
        ))}
      </dl>
      <form method="dialog">
        <button type="submit" autoFocus>
          Close
        </button>
      </form>
    </dialog>
  )
}
