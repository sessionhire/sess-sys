import { plural, quoteNumberLabel, spanLabel, type View } from '@sh/shared'
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from 'react'
import { personHref } from './crew/PersonScreen.tsx'
import { plain, wordsOf } from './crew/People.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { openedAt, useRecent, type Opened, type OpenedKind } from './recent.ts'
import { useAccess } from './role.ts'
import { paletteKeys } from './searchOpen.ts'
import { SHORTCUTS } from './shortcuts.tsx'
import { useView } from './view.ts'

/**
 * One search for everything (review of 11 November 2026, finding 13; ADR 0146): jobs, quotes by number, clients, venues,
 * people, products and numbered kit. Each list keeps its own Find for narrowing that list; this is for "where is it", when you
 * don't yet know which area it lives in. It reads what's on the device, so it works with no signal, and a role sees what it's
 * sent (ADR 0042): no quotes without money, say.
 *
 * As a command palette (Colly, 11 November 2026; ADR 0147): it opens over the screen you're on, which blurs and dims behind
 * it, from the magnifier in the top bar, Ctrl K (Command K on a Mac) anywhere, or / at a desk. With nothing typed it offers
 * the places to go; as you type, the places and the records that match, one highlighted for Enter. Up and Down move, Escape
 * or a press outside closes it, and nothing is lost: what's typed is kept while the app is open, so opening it again comes
 * back to the same results, selected so new typing replaces it.
 *
 * With nothing typed, Recent comes first (Colly, 11 November 2026; ADR 0148): the jobs, clients, venues, people, products and
 * kit opened lately on this device, newest first, five of them, so getting back to what you were just in is Down and Enter.
 */

let typed = ''
const listeners = new Set<() => void>()
function useTyped(): [string, (next: string) => void] {
  const now = useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => typed,
  )
  return [
    now,
    (next) => {
      typed = next
      for (const fn of listeners) fn()
    },
  ]
}

interface Found {
  key: string
  href: string
  /** The place's own picture, for a place to go; records take their group's. */
  icon?: IconName
  /** Its keys at a desk, for a place that has them. */
  keys?: readonly string[]
  title: string
  /** What else it is, on the line under: "Sat 2 Nov · Aviva Stadium", "Lighting", "SH-000123 · in Bay A3". */
  line: string
  /** Its name starts with what was typed: these come first. */
  first: boolean
}

interface Group {
  key: string
  label: string
  icon: IconName
  found: Found[]
}

/** How many of a group show before "Show all": a screen's worth across the groups. */
const SHOWN = 5

/** Every word typed is somewhere in what's searched, fadas and apostrophes aside, as each list's Find matches. */
const matches = (words: readonly string[], ...fields: (string | null | undefined)[]) => {
  const hay = plain(fields.filter(Boolean).join(' '))
  return words.every((w) => hay.includes(w))
}
const startsWith = (words: readonly string[], name: string) => plain(name).startsWith(words[0] ?? '')
const ordered = (found: Found[]) => found.sort((a, b) => Number(b.first) - Number(a.first))

type JobsView = View['jobs']
type Job = JobsView['jobs'][number]
type Client = JobsView['clients'][number]
type Venue = JobsView['venues'][number]
type Person = View['crew']['people'][number]
type Product = View['warehouse']['models'][number]
type Item = View['warehouse']['assets'] extends ReadonlyMap<string, infer A> ? A : never

/** Each kind of record as a row, the same in the results and in Recent. */
const jobFound = (j: Job): Omit<Found, 'first'> => ({
  key: j.id,
  href: `#jobs/${encodeURIComponent(j.id)}`,
  title: j.name,
  line: [j.span ? spanLabel(j.span) : 'No dates yet', j.client?.name, j.venue?.name].filter(Boolean).join(' · '),
})
const clientFound = (c: Client, jobs: readonly Job[]): Omit<Found, 'first'> => ({
  key: c.id,
  href: `#jobs/clients/${encodeURIComponent(c.id)}`,
  title: c.name,
  line: plural(jobs.filter((j) => j.clientId === c.id).length, 'job', 'jobs'),
})
const venueFound = (v: Venue): Omit<Found, 'first'> => ({
  key: v.id,
  href: `#jobs/venues/${encodeURIComponent(v.id)}`,
  title: v.name,
  line: v.address ?? '',
})
const personFound = (p: Person): Omit<Found, 'first'> => ({
  key: p.id,
  href: personHref(p.id),
  title: p.name,
  line: [p.kind === 'staff' ? 'Staff' : 'Freelancer', p.skills.slice(0, 3).join(', ')].filter(Boolean).join(' · '),
})
const productFound = (m: Product): Omit<Found, 'first'> => ({
  key: m.id,
  href: `#stock/product/${encodeURIComponent(m.id)}`,
  title: m.name,
  line: [m.department, m.category].filter(Boolean).join(' · '),
})
const itemFound = (a: Item): Omit<Found, 'first'> => ({
  key: a.id,
  href: `#stock/item/${encodeURIComponent(a.id)}`,
  title: `${a.number || 'No number yet'} · ${a.model?.name ?? 'Unknown product'}`,
  line: [a.serial ? `Serial ${a.serial}` : '', a.oldNumber ? `Old tag ${a.oldNumber}` : '', a.at ? `at ${a.at.name}` : ''].filter(Boolean).join(' · '),
})

export function search(view: View, query: string, can: { money: boolean }): Group[] {
  const words = wordsOf(query)
  if (!words.length) return []
  const groups: Group[] = []
  const { jobs, clients, venues } = view.jobs

  // Jobs, newest first after a name match: the one being worked on is usually the latest of its name.
  const quotes = can.money ? jobs.flatMap((job) => view.money.quotesOf(job.id).map((quote) => ({ job, quote }))) : []
  const quoteNumbers = new Map<string, string[]>()
  for (const { job, quote } of quotes) if (quote.number) quoteNumbers.set(job.id, [...(quoteNumbers.get(job.id) ?? []), quoteNumberLabel(quote)])
  const byNewest = [...jobs].sort((a, b) => (b.span?.start ?? '9999').localeCompare(a.span?.start ?? '9999'))
  groups.push({
    key: 'jobs',
    label: 'Jobs',
    icon: 'calendar',
    found: ordered(
      byNewest
        .filter((j) => matches(words, j.name, j.client?.name, j.venue?.name, ...(quoteNumbers.get(j.id) ?? [])))
        .map((j) => ({ ...jobFound(j), first: startsWith(words, j.name) })),
    ),
  })

  // A quote by its number ("Q1042", "1042"): straight to the job's Quote tab.
  if (can.money) {
    const numbered = quotes.filter(
      ({ quote }) => quote.number && quote.latest && words.every((w) => plain(quoteNumberLabel(quote)).includes(w) || String(quote.number) === w),
    )
    groups.push({
      key: 'quotes',
      label: 'Quotes',
      icon: 'document',
      found: numbered.map(({ job, quote }) => ({
        key: quote.id,
        href: `#jobs/${encodeURIComponent(job.id)}/quote`,
        title: `${quoteNumberLabel(quote)} · ${job.name}`,
        line: [job.client?.name, job.span ? spanLabel(job.span) : ''].filter(Boolean).join(' · '),
        first: true,
      })),
    })
  }

  groups.push({
    key: 'clients',
    label: 'Clients',
    icon: 'company',
    found: ordered(
      clients
        .filter((c) => matches(words, c.name, ...c.contacts.map((x) => x.name)))
        .map((c) => ({ ...clientFound(c, jobs), first: startsWith(words, c.name) })),
    ),
  })

  groups.push({
    key: 'venues',
    label: 'Venues',
    icon: 'venue',
    found: ordered(
      venues
        .filter((v) => matches(words, v.name, v.address))
        .map((v) => ({ ...venueFound(v), first: startsWith(words, v.name) })),
    ),
  })

  groups.push({
    key: 'people',
    label: 'People',
    icon: 'people',
    found: ordered(
      view.crew.people
        .filter((p) => matches(words, p.name, p.email, p.phone, ...p.skills))
        .map((p) => ({ ...personFound(p), first: startsWith(words, p.name) })),
    ),
  })

  const w = view.warehouse
  groups.push({
    key: 'products',
    label: 'Products',
    icon: 'kit',
    found: ordered(
      w.models
        .filter((m) => matches(words, m.name, m.category, m.department))
        .map((m) => ({ ...productFound(m), first: startsWith(words, m.name) })),
    ),
  })

  // Kit by its number, old tag or serial: only when what's typed has a digit in it, so a word doesn't list every item of a product.
  const number = query.trim()
  if (/\d/.test(number) && number.length >= 2) {
    const n = plain(number).replace(/\s+/g, '')
    const items = [...w.assets.values()].filter((a) =>
      [a.number, a.oldNumber, a.serial, ...a.formerNumbers].some((x) => x && plain(x).replace(/\s+/g, '').includes(n)),
    )
    groups.push({
      key: 'items',
      label: 'Kit by number',
      icon: 'label',
      found: items
        .map((a) => ({ ...itemFound(a), first: plain(a.number).replace(/\s+/g, '') === n }))
        .sort((a, b) => Number(b.first) - Number(a.first) || a.title.localeCompare(b.title)),
    })
  }
  return groups.filter((g) => g.found.length)
}

/** Each kind's picture in Recent, where kinds are mixed: its group's in the results. */
const KIND_ICONS: Record<OpenedKind, IconName> = {
  job: 'calendar',
  client: 'company',
  venue: 'venue',
  person: 'people',
  product: 'kit',
  item: 'label',
}

/**
 * Recent, with nothing typed: what was opened lately on this device, as it is now. One that's gone, or that this role isn't
 * sent, is left out, and so is the one on the screen behind, as you're already there.
 */
export function recentGroup(view: View, opened: readonly Opened[], here?: Opened): Group | undefined {
  const { jobs, clients, venues } = view.jobs
  const find = (o: Opened): Omit<Found, 'first'> | undefined => {
    if (o.kind === 'job') {
      const j = jobs.find((x) => x.id === o.id)
      return j && jobFound(j)
    }
    if (o.kind === 'client') {
      const c = clients.find((x) => x.id === o.id)
      return c && clientFound(c, jobs)
    }
    if (o.kind === 'venue') {
      const v = venues.find((x) => x.id === o.id)
      return v && venueFound(v)
    }
    if (o.kind === 'person') {
      const p = view.crew.people.find((x) => x.id === o.id)
      return p && personFound(p)
    }
    if (o.kind === 'product') {
      const m = view.warehouse.models.find((x) => x.id === o.id)
      return m && productFound(m)
    }
    const a = view.warehouse.assets.get(o.id)
    return a && itemFound(a)
  }
  const found: Found[] = []
  for (const o of opened) {
    if (found.length === SHOWN) break
    if (here && here.kind === o.kind && here.id === o.id) continue
    const f = find(o)
    if (f) found.push({ ...f, key: `${o.kind}-${o.id}`, icon: KIND_ICONS[o.kind], first: false })
  }
  return found.length ? { key: 'recent', label: 'Recent', icon: 'history', found } : undefined
}

/** Each place's picture: the bar's own for the areas (home/icons.tsx), and the planner's and New's for the rest. */
const PLACE_ICONS: Record<string, IconName> = {
  '#home': 'home',
  '#jobs': 'calendar',
  '#jobs/plan': 'planner',
  '#jobs/money/follow-up': 'document',
  '#quotes/new': 'add',
  '#stock': 'warehouse',
  '#crew': 'people',
  '#menu': 'menu',
}

/** The places to go, as the keys at a desk name them (shortcuts.tsx): with nothing typed, all of them; typed, those that match. */
export function places(query: string, can: { money: boolean }): Group | undefined {
  const words = wordsOf(query)
  const found = SHORTCUTS.filter((s) => s.go.startsWith('#') && (!s.money || can.money))
    .filter((s) => !words.length || matches(words, s.what))
    .map((s) => ({
      key: `go-${s.go}`,
      href: s.go,
      icon: PLACE_ICONS[s.go],
      keys: s.keys,
      title: s.what,
      line: '',
      first: !words.length || startsWith(words, s.what),
    }))
  return found.length ? { key: 'places', label: 'Go to', icon: 'next', found } : undefined
}

/** One row the highlight can land on: a result or place, or the "Show all" under a group cut short. */
type Row = { id: string; found: Found; group: Group } | { id: string; more: Group }

/** The palette itself, drawn while open: the design system's dialog, with a combobox's keys in its field. */
export function SearchPalette({ onGo, onClose, desk }: { onGo: (hash: string) => void; onClose: () => void; desk: boolean }) {
  const view = useView()
  const access = useAccess()
  const [query, setQuery] = useTyped()
  const dialog = useRef<HTMLDialogElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const id = useId()
  const money = access.can('money')
  const [all, setAll] = useState<ReadonlySet<string>>(new Set())
  const asked = wordsOf(query).length > 0
  const opened = useRecent()

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
    // What was typed last time is there and selected, so typing starts afresh and Down goes back to the same results.
    field.current?.select()
  }, [])

  // On a phone the keyboard takes the bottom of the screen: the palette fits in what's left, so its last row isn't under it.
  useEffect(() => {
    const seen = window.visualViewport
    const d = dialog.current
    if (!seen || !d) return
    const fit = () => d.style.setProperty('--palette-room', `${Math.round(seen.height)}px`)
    fit()
    seen.addEventListener('resize', fit)
    return () => seen.removeEventListener('resize', fit)
  }, [])

  const groups = useMemo(() => {
    const found = search(view, query, { money })
    const go = places(query, { money })
    // Nothing typed: Recent first, its own short group above the places (design system, behavioural.md, Availability Bias).
    if (!asked) return [recentGroup(view, opened, openedAt(location.hash)), go].filter((g): g is Group => !!g)
    if (!go) return found
    // A place whose name starts with what's typed ("jobs") comes first; one that only has the word in it, after the records.
    return asked && !go.found.some((f) => f.first) ? [...found, go] : [go, ...found]
  }, [view, query, money, asked, opened])

  const rows: Row[] = useMemo(
    () =>
      groups.flatMap((g) => {
        const open = g.key === 'places' || g.key === 'recent' || all.has(g.key)
        const shown: Row[] = (open ? g.found : g.found.slice(0, SHOWN)).map((f) => ({ id: `${id}-${g.key}-${f.key}`, found: f, group: g }))
        return !open && g.found.length > SHOWN ? [...shown, { id: `${id}-${g.key}-more`, more: g }] : shown
      }),
    [groups, all, id],
  )

  // While something is typed one row is always highlighted, the one Enter takes (the combobox's rule); with nothing typed, none
  // until Down is pressed. A new search starts at the top.
  const [at, setAt] = useState(asked ? 0 : -1)
  useEffect(() => {
    setAt(wordsOf(query).length ? 0 : -1)
    setAll(new Set())
  }, [query])
  const active = at >= 0 && at < rows.length ? rows[at] : undefined
  useEffect(() => {
    if (active) document.getElementById(active.id)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // Said shut at once, not when the dialog's close event comes a moment later, so a quick Ctrl K after it opens it again.
  const close = () => {
    dialog.current?.close()
    onClose()
  }
  const take = (row: Row) => {
    if ('more' in row) {
      setAll((before) => new Set(before).add(row.more.key))
      field.current?.focus()
      return
    }
    // Shut first, so focus goes back where it came from, then move: the new screen's heading takes it from there.
    close()
    onGo(row.found.href)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!rows.length) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setAt((now) => (now < 0 ? (step > 0 ? 0 : rows.length - 1) : (now + step + rows.length) % rows.length))
    } else if (e.key === 'Escape') {
      // A search box's own Escape empties it; here Escape shuts the palette and keeps what's typed for next time.
      e.preventDefault()
      close()
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (active) take(active)
    }
  }
  // A press on the veil, outside the box, closes it, as a press outside any command palette does.
  const outside = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialog.current) close()
  }

  const total = groups.filter((g) => g.key !== 'places' && g.key !== 'recent').reduce((n, g) => n + g.found.length, 0)
  const list = `${id}-list`
  return (
    <dialog className="palette" ref={dialog} aria-labelledby={`${id}-title`} onClose={onClose} onClick={outside}>
      <div className="palette-box">
        <h2 id={`${id}-title`} className="sr-only">
          Search
        </h2>
        <div className="palette-field">
          <Icon name="search" />
          <input
            ref={field}
            type="search"
            enterKeyHint="go"
            placeholder="A name, a quote number, a kit number or a place"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            aria-label="Search everything"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={rows.length > 0}
            aria-controls={list}
            aria-activedescendant={active?.id}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="palette-close icon-button" onClick={close} aria-label="Close search">
            {desk ? <kbd>Esc</kbd> : <Icon name="close" />}
          </button>
        </div>
        <p className="sr-only" role="status">
          {asked ? (total ? plural(total, 'result', 'results') : 'Nothing found') : ''}
        </p>
        <div className="palette-list" id={list} role="listbox" aria-label="Results">
          {groups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`${id}-${g.key}`}>
              <div className="palette-group" id={`${id}-${g.key}`} role="presentation">
                <Icon name={g.icon} />
                {g.key === 'places' || g.key === 'recent' ? g.label : `${g.label} (${g.found.length})`}
              </div>
              {rows
                .filter((r) => ('more' in r ? r.more : r.group) === g)
                .map((r) => (
                  <div
                    key={r.id}
                    id={r.id}
                    role="option"
                    aria-selected={r === active}
                    className={'more' in r ? 'palette-row more' : 'palette-row'}
                    // Chosen on the press, so the field keeps the cursor (the combobox's rule).
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => take(r)}
                  >
                    {'more' in r ? (
                      <span>Show all {r.more.found.length}</span>
                    ) : (
                      <>
                        {r.found.icon && <Icon name={r.found.icon} />}
                        <span className="palette-words">
                          <b>{r.found.title}</b>
                          {r.found.line && <small>{r.found.line}</small>}
                        </span>
                        {desk && r.found.keys && (
                          <span className="palette-keys" aria-hidden="true">
                            {r.found.keys.map((k) => (
                              <kbd key={k}>{k}</kbd>
                            ))}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
        {asked && rows.length === 0 && <p className="palette-note">Nothing called “{query.trim()}” on this device.</p>}
        {!asked && (
          <p className="palette-note">
            Every job, client, venue, person and product on this device{money ? ', and quotes by number' : ''}. Type a label's number to
            find that piece of kit.
          </p>
        )}
        {desk && (
          <p className="palette-foot" aria-hidden="true">
            <span>
              <kbd>↑</kbd> <kbd>↓</kbd> to move
            </span>
            <span>
              <kbd>Enter</kbd> to open
            </span>
            <span>
              <kbd>{paletteKeys.join(' ')}</kbd> or <kbd>Esc</kbd> to close
            </span>
          </p>
        )}
      </div>
    </dialog>
  )
}
