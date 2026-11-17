/**
 * An area's pages, side by side in one row under its header (ADR 0041's
 * tidy-up of where things live). The row holds only ways of seeing the
 * area's list (review of 11 November 2026, finding 8): Jobs' List, Board,
 * Calendar, Week and Month; Stock's Catalogue, Places and Racks (ADR 0074);
 * Crew's Calls and People (crew/CrewViews.tsx, as its counts are the Crew
 * tab's). The area's other places are on a quieter line under it, "Also
 * here": Clients, Venues and Money for the roles that see it (ADR 0042);
 * Labels, Counting, Testing, Repairs, Vehicles and the Purchase list (ADR
 * 0077); Leave and Timesheets. Moving along the row is lateral, so
 * these pages have no way up: the row is how to get between them, and the
 * current one is marked. The row comes first under the bar, before the
 * page's title (Top's `views`). A row longer than the screen, as on a phone,
 * stays one line and scrolls sideways: the current page is brought into
 * view, and the edge with more past it fades, so no page is hidden off the
 * edge with nothing to say so (audit P2 23).
 */

import { standing, type View } from '@sh/shared'
import { useLayoutEffect, useRef } from 'react'
import { useMoreEdges } from './more.tsx'
import { useMyKitDepartment } from './Narrowed.tsx'
import { useAccess } from './role.ts'
import { useToday } from './view.ts'

export interface AreaPage {
  key: string
  href: string
  label: string
  /** Things waiting there, said after its name: repairs open, tests due. */
  count?: number
}

export function Views({ label, pages, more, current }: { label: string; pages: readonly AreaPage[]; more?: readonly AreaPage[]; current: string }) {
  const row = useRef<HTMLDivElement>(null)
  // The current page brought into view; the edge with more past it fades (more.tsx).
  useLayoutEffect(() => {
    const el = row.current
    const at = el?.querySelector<HTMLElement>('[aria-current]')
    if (el && at && (at.offsetLeft < el.scrollLeft || at.offsetLeft + at.offsetWidth > el.scrollLeft + el.clientWidth))
      el.scrollLeft = at.offsetLeft - (el.clientWidth - at.offsetWidth) / 2
  }, [current])
  useMoreEdges(row)
  const link = (p: AreaPage) => (
    <a key={p.key} href={p.href} aria-current={p.key === current ? 'page' : undefined}>
      {p.label}
      {!!p.count && <span className="views-count"> {p.count}</span>}
    </a>
  )
  return (
    <nav className="views-nav" aria-label={label}>
      <div className="views more-edges" ref={row}>
        {pages.map(link)}
      </div>
      {/* The area's other places, not ways of seeing its list (review of 11 November 2026, finding 8): on a line of their own
          under the row, quieter, so the row holds only the views and fits a phone, and none of them is hidden behind a press. */}
      {!!more?.length && (
        <p className="views-more">
          <span className="views-more-word">Also here</span>
          {more.map(link)}
        </p>
      )}
    </nav>
  )
}

/**
 * The same row when the views are one page seen for someone else rather than pages of their own: Home's Company,
 * Department, Warehouse and Me (Colly, 10 November 2026: "the same component as the others"). Drawn, sized and
 * scrolled as the area's row is, the chosen one filled; they're toggles, not links, as the page stays where it is,
 * and a press keeps the focus where it was (audit finding 22).
 */
export function ViewChoice<K extends string>({ label, choices, current, onChoose }: { label: string; choices: readonly (readonly [K, string])[]; current: K; onChoose: (k: K) => void }) {
  const row = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = row.current
    const at = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (el && at && (at.offsetLeft < el.scrollLeft || at.offsetLeft + at.offsetWidth > el.scrollLeft + el.clientWidth))
      el.scrollLeft = at.offsetLeft - (el.clientWidth - at.offsetWidth) / 2
  }, [current])
  useMoreEdges(row)
  return (
    <div className="views more-edges" role="group" aria-label={label} ref={row}>
      {choices.map(([k, name]) => (
        <button
          key={k}
          type="button"
          aria-pressed={k === current}
          onClick={(e) => {
            e.currentTarget.focus()
            onChoose(k)
          }}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

/**
 * Stock's row: what the warehouse looks at, each a page, with the tests overdue, the repairs open and the places to count
 * this week counted on theirs, each the list Home counts and the page lists (shared/src/sync/standing.ts). Counted only
 * for a role that can act on them (ADR 0034), as Crew's row is: to anyone else they'd be a to-do list that isn't theirs.
 * A head's are their own kit's, as Testing and Repairs start on it and Crew's row counts their people (Move 3 of the
 * sweep of 6 November 2026); the places to count are nobody's department, so they're everyone's.
 */
export function StockViews({ view, current }: { view: View; current: string }) {
  const department = useMyKitDepartment()
  const lists = standing(view, useToday(), { department: department || undefined })
  const mayStock = useAccess().can('stock')
  const count = (n: number) => (mayStock ? n : 0)
  // Vehicles whose road checks have run out: they can't be booked until someone updates them (ADR 0047).
  const vehicles = new Set(view.vehicles.reminders.filter((r) => r.ranOut && r.kind !== 'service').map((r) => r.vehicle.id)).size
  return (
    <Views
      label="Stock pages"
      current={current}
      pages={[
        { key: 'catalogue', href: '#stock', label: 'Catalogue' },
        { key: 'places', href: '#stock/places', label: 'Places' },
        { key: 'racks', href: '#stock/racks', label: 'Racks' },
      ]}
      more={[
        { key: 'labels', href: '#stock/labels', label: 'Labels' },
        { key: 'count', href: '#stock/count', label: 'Counting', count: count(lists.counts.length) },
        { key: 'testing', href: '#stock/testing', label: 'Testing', count: count(lists['cant-go'].length) },
        { key: 'repairs', href: '#stock/repairs', label: 'Repairs', count: count(lists.faults.length) },
        { key: 'vehicles', href: '#stock/vehicles', label: 'Vehicles', count: count(vehicles) },
        { key: 'buy', href: '#stock/buy', label: 'Purchase list' },
      ]}
    />
  )
}
