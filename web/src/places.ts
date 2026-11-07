import { arrival, partHeading } from './arrival.ts'

/**
 * Where each screen was scrolled to (audit finding 8). A move to a new
 * screen starts at its top, where its title and the strip that says where
 * you are can be seen, or at the part of it that was asked for: a count on
 * Home names one (arrival.ts), and an address can (landOn); the browser's
 * Back and Forward come back to the place the screen was left at. Kept per
 * step in the browser's history, as the browser itself keeps it for pages,
 * under a number in the step's state: a step with none is a new move. The
 * browser's own restoring is off, as it puts the place back before the
 * screen is drawn, on a page too short to hold it. Kept for the tab's life
 * in session storage, so a reload keeps its place too.
 *
 * A long list's rows (marked `data-place`) are drawn only near the screen,
 * the rest standing in at the height they were last drawn at or a guess
 * (windowed.ts, ADR 0050), so the same distance down a newly drawn list may
 * be a different row. A place on such
 * a list is kept by the row in the middle of the screen as well, and Back
 * puts that row back where it was on the screen.
 */

const STORE = 'session-hire-places'

/** A part of a screen landed on: what comes to the top, under the bar, and what takes the focus. */
export interface Landing {
  top: HTMLElement
  focus: HTMLElement
}

/** A part to land on: by its heading, as a count on Home names it (arrival.ts), or as the screen whose address names it finds it (landOn). */
type Part = string | (() => Landing | undefined)

/** How far down the page, and the long list's row in the middle of the screen, with how far it was from the top of the screen. */
interface Place {
  y: number
  row?: string
  top?: number
  /** A part of the screen to land on, only ever gone to and never kept. */
  part?: Part
}

/** A step's place, by its number. A plain number is a place kept before rows were. */
let places: Record<string, Place | number> = {}
try {
  places = JSON.parse(sessionStorage.getItem(STORE) ?? '{}') as Record<string, Place | number>
} catch {
  // Storage that's off or full keeps the places for this page only.
}

/** Whether moving the page moves this, rather than a column scrolled on its own (a list beside an open job on a laptop). */
function movesWithPage(el: Element): boolean {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return false
  return true
}

/** The place now: a few points down the middle of the screen are tried for a long list's row, as a gap between rows has none. */
function placeNow(): Place {
  const y = scrollY
  for (const at of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    const row = document.elementFromPoint(innerWidth / 2, innerHeight * at)?.closest<HTMLElement>('[data-place]')
    if (row?.dataset.place !== undefined && movesWithPage(row)) return { y, row: row.dataset.place, top: Math.round(row.getBoundingClientRect().top) }
  }
  return { y }
}

/** A part once it's drawn: a card's heading brings its card, under the bar that stays at the top, and a heading inside a card itself. */
function landingOf(part: Part): Landing | undefined {
  if (typeof part !== 'string') return part()
  const heading = partHeading(part)
  return heading && { top: heading.tagName === 'H2' ? (heading.parentElement ?? heading) : heading, focus: heading }
}

/** Where the page goes for a place: its row back where it was on the screen, or the same distance down if the row isn't drawn. */
function yOf(place: Place | number): number {
  if (typeof place === 'number') return place
  if (place.part !== undefined) {
    const at = landingOf(place.part)?.top
    const bar = document.querySelector('main .top')?.getBoundingClientRect().bottom ?? 0
    // And the On this screen strip that sticks under the bar, which covered most of the heading landed on (audit, 5 November 2026,
    // finding 95): OnThisScreen keeps its height as --on-screen.
    const strip = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--on-screen')) || 0
    return at ? Math.max(0, Math.round(scrollY + at.getBoundingClientRect().top - bar - strip - 8)) : place.y
  }
  const row = place.row === undefined ? null : document.querySelector(`[data-place="${CSS.escape(place.row)}"]`)
  return row ? Math.max(0, Math.round(scrollY + row.getBoundingClientRect().top - (place.top ?? 0))) : place.y
}

const numberOf = (state: unknown): string | undefined => {
  const n = (state as { place?: unknown } | null)?.place
  return typeof n === 'string' ? n : undefined
}

/** Gives the browser's current step a number of its own, keeping whatever else its state holds. */
function number(): string {
  const n = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const state = history.state as object | null
  history.replaceState({ ...(state && typeof state === 'object' ? state : {}), place: n }, '')
  return n
}

let current = ''

/**
 * The long lists opened with Show all, by step (audit, 5 November 2026, finding 9): Back to a list opens it again, so the row that
 * was opened is there to come back to. A new move to the same screen is a new step, which starts with its lists short.
 */
const LISTS = 'session-hire-lists'
let opened: Record<string, string[]> = {}
try {
  opened = JSON.parse(sessionStorage.getItem(LISTS) ?? '{}') as Record<string, string[]>
} catch {
  // As for the places.
}

/** Whether this list was opened in full on this step. */
export const listOpened = (name: string): boolean => opened[current]?.includes(name) ?? false

/** Says this list was opened in full on this step. */
export function openedList(name: string) {
  if (!current || listOpened(name)) return
  opened[current] = [...(opened[current] ?? []), name]
  // Kept to the latest steps, so a long visit doesn't fill the storage.
  const steps = Object.keys(opened)
  for (const old of steps.slice(0, Math.max(0, steps.length - 50))) delete opened[old]
  try {
    sessionStorage.setItem(LISTS, JSON.stringify(opened))
  } catch {
    // As above.
  }
}
/** What to do once the next screen is drawn: go to a place, or nothing. */
let next: Place | number | undefined
/** Whether the screen being drawn was reached anew, by a move or a link opened anew, rather than by Back, Forward or a reload. */
let anew = false

function keep() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(places))
  } catch {
    // As above.
  }
}

/** Starts keeping places; called once, before the first screen is drawn. */
export function keepPlaces() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  const known = numberOf(history.state)
  current = known ?? number()
  // A reload comes back where it was.
  next = known ? places[known] : undefined
  anew = !known
  let frame = 0
  addEventListener('scroll', () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      places[current] = placeNow()
      keep()
    })
  })
  // Runs before the screens draw the new address, so a shorter screen pulling the page up isn't taken for the last one's place.
  addEventListener('hashchange', () => {
    cancelAnimationFrame(frame)
    const back = numberOf(history.state)
    current = back ?? number()
    const part = arrival()?.part
    next = back ? (places[back] ?? 0) : part ? { y: 0, part } : 0
    anew = !back && !part
  })
}

/**
 * A screen whose address names a part of it lands on that part, as a count
 * on Home does (UX sweep, 6 November 2026, move 8): it comes to the top
 * under the bar and takes the focus, as a job's Next does with its tab (ADR
 * 0109). Said by the screen as it's drawn, before its place is settled, and
 * taken for a new move or a link opened anew, whatever it came from: a row
 * on Home, the planner, Crew or a typed address. Back, Forward and a
 * reload come back to where the screen was left instead.
 */
export function landOn(find: () => Landing | undefined) {
  if (anew) next = { y: 0, part: find }
}

/**
 * Once the new screen is drawn: to its top for a new move, or the part it
 * asked for, or back to its place for Back and Forward. `stay` keeps the
 * page where it is, for a toggle kept in the address that changes what's
 * shown, not the screen. No smooth scrolling, so nothing moves under a
 * person who asked for less motion, nor under anyone else.
 */
export function settlePlace(stay = false) {
  const to = next
  next = undefined
  anew = false
  if (to === undefined) return
  if (stay) {
    places[current] = placeNow()
    return
  }
  // A screen still filling in may be too short at first, and the strip of its parts under the title comes a frame after it,
  // which the browser would scroll past to keep the same rows in view: the place is held for a few frames, until a hand moves the page.
  let frames = 12
  // A part to land on may be on a screen still loading: it's waited for, a second and a half at most, then held as any place is.
  let waiting = typeof to === 'object' && to.part !== undefined ? 90 : 0
  const moved = () => (frames = waiting = 0)
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
  for (const e of events) addEventListener(e, moved, { once: true, passive: true })
  const hold = () => {
    if (waiting > 0 && typeof to === 'object' && to.part !== undefined) {
      const landing = landingOf(to.part)
      if (landing) {
        waiting = 0
        // Focus goes with the eye, as the strip of parts does, so a keyboard and a screen reader start at the part. A heading found by
        // its words takes it without joining the Tab order; what a screen finds for itself takes it already (a tab, a task's heading).
        if (typeof to.part === 'string') landing.focus.tabIndex = -1
        landing.focus.focus({ preventScroll: true })
      } else {
        waiting--
        requestAnimationFrame(hold)
        return
      }
    }
    if (frames-- <= 0) {
      for (const e of events) removeEventListener(e, moved)
      return
    }
    // Found again each frame: rows drawn as they come near the screen take their own height, moving the one kept.
    const y = yOf(to)
    if (Math.abs(scrollY - y) > 1) scrollTo(0, y)
    requestAnimationFrame(hold)
  }
  hold()
}
