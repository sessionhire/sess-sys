import { findNamed, kitKey, namedExactly, type FoundNamed, type Named } from '@sh/shared'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

/** Offers shown at once; past these a line says how many more, so the list never scrolls inside the page on a phone. */
const SHOWN = 8

/**
 * A name that is one of the company's own records or a new one: a client, a
 * venue, who asked for a quote. The design system's combobox with one value
 * (components.md, combobox), where a `<datalist>` was: it finds what's typed
 * anywhere in the name, every word in any order, and in what else the record
 * is known by (`also`, such as a venue's address), with a second line to tell
 * two alike apart (`meta`). The last row adds what's typed as a new one, in
 * words, so it's plain before saving that it will be new; saving the form
 * adds it to the list. While something is typed one row is highlighted, the
 * one Enter takes: the name spelt as typed, else the first starting with it,
 * else the new one, so "verv" and Enter is Verve, never a new client called
 * "verv". The first arrow key goes to that name, never past it. Leaving the
 * field with the start of one name here, "bright" for Brightwater
 * Conferences, takes that one and says so, with a press to keep what was
 * typed as new (audit of the quote flow, 8 November 2026, finding 3); a name
 * already here in another case takes the list's spelling. Otherwise what's
 * typed is the value. With nothing typed it offers `first`, the most used,
 * with nothing highlighted.
 */
export function NameField<T extends Named>({
  label,
  optional,
  value,
  onChange,
  records,
  what,
  also,
  meta,
  first = [],
  firstLabel = 'Most used',
  onPick,
  disabled,
  placeholder,
  maxLength = 200,
  className,
  autoFocus,
}: {
  label: string
  /** Says "(optional)" after the label, as the form's other optional fields do. */
  optional?: boolean
  value: string
  onChange: (name: string) => void
  records: readonly T[]
  /** What a new one is, for "Add “Verve” as a new client". */
  what: string
  /** What else a record is found by, such as a venue's address. */
  also?: (record: T) => string | undefined
  /** The small line under an offer. */
  meta?: (offer: FoundNamed<T>) => string
  first?: readonly T[]
  firstLabel?: string
  /** A record taken from the list, after `onChange` has its name. */
  onPick?: (record: T) => void
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  className?: string
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [moved, setMoved] = useState<number | null>(null)
  const [heard, setHeard] = useState('')
  // A name taken on leaving the field, with what was typed, so it can be kept as new instead; and a name kept as new.
  const [took, setTook] = useState<{ typed: string; name: string }>()
  const [keptNew, setKeptNew] = useState('')
  const list = useRef<HTMLUListElement>(null)
  // The cursor put here on arrival doesn't open the list over the rest of the form: a tap, an arrow or a letter does (review of
  // 11 November 2026, finding 18).
  const arrived = useRef(!!autoFocus)
  const id = useId()

  const key = kitKey(value)
  const typed = key !== ''
  const found: FoundNamed<T>[] = typed ? findNamed(records, value, also) : first.map((record) => ({ record }))
  const offers = found.slice(0, SHOWN)
  const more = found.length - offers.length
  const exact = typed ? namedExactly(records, value) : undefined
  const fresh = typed && !exact
  const rows = offers.length + (fresh ? 1 : 0)
  const shown = open && !disabled && rows > 0
  // The row Enter takes: the name as typed, else the first starting with it, else the new one; none with nothing typed.
  const starting = offers.findIndex((f) => kitKey(f.record.name).startsWith(key))
  const highlight = !typed ? -1 : exact ? offers.findIndex((f) => f.record === exact) : starting >= 0 ? starting : fresh ? offers.length : -1
  const active = shown ? (moved ?? highlight) : -1
  // The names here that start with what's typed, or have a word that does: one of them is taken on leaving the field.
  const starters = fresh && key.length >= 3 && keptNew !== key ? startingWith(records, key) : []

  useEffect(() => {
    if (active >= 0) list.current?.querySelector(`[id="${id}-${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, id])

  const close = () => {
    setOpen(false)
    setMoved(null)
  }
  const take = (i: number) => {
    close()
    const f = offers[i]
    if (f) {
      onChange(f.record.name)
      onPick?.(f.record)
      setHeard(`Chose ${f.record.name}.`)
    } else if (fresh) {
      const name = value.trim().replace(/\s+/g, ' ')
      onChange(name)
      setKeptNew(kitKey(name))
      setHeard(`${name} is added as a new ${what} when this is saved.`)
    }
  }
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!shown) return setOpen(true)
      // The first arrow goes to a highlighted name, so "bright", down and Enter is Brightwater, never past it to a new one.
      if (moved === null && highlight >= 0 && highlight < offers.length) return setMoved(highlight)
      const last = rows - 1
      setMoved(e.key === 'ArrowDown' ? (active >= last ? 0 : active + 1) : active <= 0 ? last : active - 1)
      return
    }
    if (e.key === 'Enter' && shown && active >= 0) {
      // Takes the highlighted row; with the list closed Enter does what it does in any field.
      e.preventDefault()
      return take(active)
    }
    if (e.key === 'Escape' && shown) {
      // Closes the list and keeps what's typed; the next Escape is left to whatever holds the field.
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  return (
    <div className={`picker-field name-field${className ? ` ${className}` : ''}`}>
      <span id={`${id}-label`}>
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </span>
      <div className="skills-anchor">
        <input
          role="combobox"
          aria-labelledby={`${id}-label`}
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={`${id}-list`}
          aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          onChange={(e) => {
            onChange(e.target.value)
            setMoved(null)
            setOpen(true)
            setTook(undefined)
          }}
          onKeyDown={keys}
          onFocus={() => {
            if (arrived.current) arrived.current = false
            else setOpen(true)
          }}
          onClick={() => setOpen(true)}
          onBlur={() => {
            // A name already here, typed in another case or spacing, takes the list's spelling.
            if (exact && exact.name !== value) onChange(exact.name)
            // The start of one name here is that one, said under the field with a way to keep what was typed.
            const one = starters.length === 1 ? starters[0]! : undefined
            if (one) {
              onChange(one.name)
              onPick?.(one)
              setTook({ typed: value.trim().replace(/\s+/g, ' '), name: one.name })
              setHeard(`Took ${one.name}, the one ${what} starting “${value.trim()}”.`)
            }
            close()
          }}
        />
        <ul ref={list} className="skill-options picker-options" id={`${id}-list`} role="listbox" aria-label={typed ? 'Found' : firstLabel} hidden={!shown}>
          {!typed && offers.length > 0 && (
            <li className="note" role="presentation">
              {firstLabel}
            </li>
          )}
          {offers.map((f, i) => {
            const line = meta?.(f) ?? ''
            return (
              <li
                key={i}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                // Chosen on the press, before the field loses focus.
                onMouseDown={(e) => {
                  e.preventDefault()
                  take(i)
                }}
              >
                <span>{f.record.name}</span>
                {line && <small>{line}</small>}
              </li>
            )
          })}
          {more > 0 && (
            <li className="note" role="presentation">
              {more.toLocaleString('en-IE')} more: type more to narrow it down
            </li>
          )}
          {fresh && (
            <li
              id={`${id}-${offers.length}`}
              role="option"
              aria-selected={active === offers.length}
              className="new"
              onMouseDown={(e) => {
                e.preventDefault()
                take(offers.length)
              }}
            >
              <span>
                Add “{value.trim()}” as a new {what}
              </span>
            </li>
          )}
        </ul>
      </div>
      {took && took.name === value && (
        <small className="hint name-took">
          Took {took.name}, the one {what} starting “{took.typed}”.{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              onChange(took.typed)
              setKeptNew(kitKey(took.typed))
              setTook(undefined)
              setHeard(`${took.typed} is added as a new ${what} when this is saved.`)
            }}
          >
            Keep “{took.typed}” as a new {what}
          </button>
        </small>
      )}
      <span className="sr-only" aria-live="polite">
        {heard}
      </span>
    </div>
  )
}

/** The records whose name starts with what's typed, or has a word that does, one to a name. */
function startingWith<T extends Named>(records: readonly T[], key: string): T[] {
  const squashed = key.replace(/ /g, '')
  const out = new Map<string, T>()
  for (const r of records) {
    const name = kitKey(r.name)
    if (!name || out.has(name)) continue
    if (name.startsWith(key) || name.replace(/ /g, '').startsWith(squashed) || name.includes(` ${key}`)) out.set(name, r)
  }
  return [...out.values()]
}
