/**
 * The way up from a page to the one above it, in the top bar so it stays in
 * view however far down the page is scrolled (the design system's Up,
 * navigation.md). It always goes to the same parent from the same page,
 * however the person got there; the browser's own Back is history. An
 * area's own screen is the parent as it was left: Jobs is Week if Week is
 * where you were looking (leftAt.ts).
 *
 * On a phone it is one link to the parent, "‹ All jobs". On a desk (900px
 * and up, where the places are a sidebar) there is room to say the whole
 * way down as breadcrumbs, "Jobs › Vicar Street › Pick list", each a link
 * but the page itself. An area's own screen has neither: it is the top.
 */

import type { MouseEvent, ReactNode } from 'react'
import { leftAt } from './leftAt.ts'
import { cameFrom } from './places.ts'

export interface Step {
  href: string
  /** Its name in the breadcrumbs: "Jobs". */
  label: string
  /** Its name as the one way up on a phone, where that reads better: "All jobs". */
  up?: string
}

/** The areas' own screens, where most trails start. */
export const JOBS: Step = { href: '#jobs', label: 'Jobs', up: 'All jobs' }
export const STOCK: Step = { href: '#stock', label: 'Stock', up: 'All stock' }
export const CREW: Step = { href: '#crew', label: 'Crew' }
export const MENU: Step = { href: '#menu', label: 'Menu' }
export const ADMIN: Step = { href: '#admin', label: 'Admin' }

/** Pages along an area's row (Views.tsx) that have pages of their own beneath them. */
export const CLIENTS: Step = { href: '#jobs/clients', label: 'Clients', up: 'All clients' }
export const VENUES: Step = { href: '#jobs/venues', label: 'Venues', up: 'All venues' }
export const MONEY: Step = { href: '#jobs/money', label: 'Money' }
export const PLACES: Step = { href: '#stock/places', label: 'Places', up: 'All places' }
export const VEHICLES: Step = { href: '#stock/vehicles', label: 'Vehicles', up: 'All vehicles' }
export const RACKS: Step = { href: '#stock/racks', label: 'Racks', up: 'All racks' }
export const BUY: Step = { href: '#stock/buy', label: 'Purchase list' }
export const LABELS: Step = { href: '#stock/labels', label: 'Labels' }
export const PEOPLE: Step = { href: '#crew/people', label: 'People', up: 'All people' }
export const TIMESHEETS: Step = { href: '#crew/timesheets', label: 'Timesheets' }

export interface Trail {
  /** From the area down to the parent: [Jobs, Vicar Street]. */
  steps: readonly Step[]
  /** The page itself, the breadcrumbs' last word; left out where its title says it at once. */
  here?: string
}

/**
 * A step's link. An area's own screen is the view it was left on (leftAt.ts), so the way up from a job opened from Week is Week, at
 * those days, with the filters picked. And when that's the screen this one was opened from, the link is Back, so it comes back as it
 * was left, at the same place down the list, as the browser's Back would (Colly, 23 November 2026: a home-screen app has no Back
 * button of its own). Should Back land anywhere else, it goes on to the step after all.
 */
function StepLink({ step, className, children }: { step: Step; className?: string; children: ReactNode }) {
  const href = leftAt(step.href)
  const back = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || cameFrom() !== href) return
    e.preventDefault()
    addEventListener('hashchange', () => location.hash !== href && location.assign(href), { once: true })
    history.back()
  }
  return (
    <a className={className} href={href} onClick={back}>
      {children}
    </a>
  )
}

export function Up({ steps, here }: Trail) {
  const parent = steps.at(-1)
  if (!parent) return null
  return (
    <div className="up">
      <StepLink step={parent} className="up-link">
        ‹ {parent.up ?? parent.label}
      </StepLink>
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          {steps.map((s) => (
            <li key={s.href}>
              <StepLink step={s}>{s.label}</StepLink>
            </li>
          ))}
          {here && (
            <li>
              <span aria-current="page">{here}</span>
            </li>
          )}
        </ol>
      </nav>
    </div>
  )
}
