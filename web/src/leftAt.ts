/**
 * Where each area was left (Colly, 23 November 2026: "remember the screen
 * you were on before"). Jobs can be seen five ways along its row (List,
 * Board, Calendar, Week, Month), Stock three and Crew two (Views.tsx). The
 * way you were looking at an area is the way you go back to it: the way up
 * from a job (Up.tsx), and the area's own tab or sidebar link, take you to
 * the view you left it on, at the days you were looking at, rather than
 * always to the list. The list's search, filters and order are kept for the
 * tab's life already (ListTools.tsx), and the departments picked too
 * (jobs/Departments.tsx), so they come back with it.
 *
 * Kept for the tab's life in session storage, as those are, so a reload
 * keeps it and the app opened another day starts on each area's first view.
 * Only the area's own views are kept, never a record or a page under it:
 * coming back from a job goes to where you were looking from, not to the job.
 *
 * Imports nothing from @sh/shared, as main.tsx starts it before the Shell
 * (start-screen gotcha: a value import there pulls Zod in before noEval.ts).
 */

const STORE = 'session-hire-left-at'

/** Each area's own screen, and the addresses of the ways of seeing it along its row. */
const VIEWS: Readonly<Record<string, RegExp>> = {
  '#jobs': /^#jobs(\/board|\/calendar(\/[^/]+)*|\/plan(\/[^/]+)*)?$/,
  '#stock': /^#stock(\/places|\/racks)?$/,
  '#crew': /^#crew(\/people)?$/,
}

let left: Record<string, string> = {}
try {
  left = JSON.parse(sessionStorage.getItem(STORE) ?? '{}') as Record<string, string>
} catch {
  // Storage that's off keeps it for this page only.
}

/** The area this address is one of the views of, if it is one. */
export function areaViewed(hash: string): string | undefined {
  return Object.keys(VIEWS).find((area) => VIEWS[area]!.test(hash))
}

/** The area an address is under, view or not: #jobs for a client, #stock for the labels. */
export function areaOf(hash: string): string | undefined {
  return Object.keys(VIEWS).find((area) => hash === area || hash.startsWith(`${area}/`))
}

function note(hash: string) {
  const area = areaViewed(hash)
  if (!area || left[area] === hash) return
  left = { ...left, [area]: hash }
  try {
    sessionStorage.setItem(STORE, JSON.stringify(left))
  } catch {
    // As above.
  }
}

/** Starts noting where each area is left; called once, before the first screen is drawn. */
export function noteViews() {
  note(location.hash)
  addEventListener('hashchange', () => note(location.hash))
}

/** Where a link to an area's own screen goes: the view it was left on. Any other address stays as it is. */
export function leftAt(href: string): string {
  return (href in VIEWS && left[href]) || href
}
