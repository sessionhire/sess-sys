# ADR 0189: Coming back to the view you left, and a way back from every page

- **Status:** accepted
- **Date:** 23 November 2026
- **Asked for by:** Colly, 23 November 2026: "When we're moving from pages like jobs into the individual screens can it be
  set to remember the screen you were on before (I had moved views to the week view before and it defaults back to the
  list)." And: "sometimes there isn't a clear 'back' function as there is no back button. Sometimes i can do this through
  the breadcrumbs, but breadcrumbs aren't there always."
- **Builds on:** [ADR 0039](0039-the-way-up-and-breadcrumbs.md) (the way up), [ADR 0041](0041-where-things-live.md)
  (where things live), the review of 11 November 2026 finding 8 (the "Also here" line), ADR 0099 (filters kept for the
  tab's life).

## Context

Every page under an area has a way up (ADR 0039), and it always went to the area's own address: `#jobs`, the list. A
person who was looking at Jobs as Week, opened a job and pressed "‹ All jobs" (or Jobs in the breadcrumbs, or the Jobs
tab) landed on the list, and had to find their week again. On the phone app added to the Home Screen there is no
browser Back button, so the way up is the only way back.

The list's search, filters, order and the departments picked were already kept for the tab's life; the view itself and
the place down the page were not, unless the browser's Back was used.

The pages on an area's quieter "Also here" line (Clients, Venues, Photos, Money; Labels, Counting, Testing, Repairs,
Vehicles, Purchase list; Leave, Timesheets) showed the area's row but no way up, so they had no "back" of their own.

## Decision

- **An area is remembered at the view it was left on** (`web/src/leftAt.ts`): Jobs' List, Board, Calendar, Week or
  Month with its days, Stock's Catalogue, Places or Racks, Crew's Calls or People. Kept in session storage, as the filters
  are, so a reload keeps it and the app opened afresh starts each area on its first view.
- **Every way to an area goes there**: the way up and the breadcrumbs (Up.tsx), the area's tab and sidebar link, and the
  G J / G S / G C keys. Choosing List again makes List the one remembered.
- **The way up is Back when it goes to the screen just left.** Each step moved to within the app notes the address it
  came from (places.ts); when the way up goes there, it uses the browser's Back, so the screen comes back as it was left,
  at the same place down the list, and Forward still goes to the job. If Back were to land anywhere else, it goes on to
  the way up's address.
- **"Also here" pages have their area's way up** ("‹ All jobs", or Jobs › Clients on a desk), to the view the area was
  left on. The area's own views still have none: they are the top, and the row moves between them.

## Consequences

- The way up still goes to the same parent from the same page (ADR 0039); the parent is the area as it was left.
- A Week left last week comes back at those days within the same visit; a new visit starts on the list.
- e2e/left-at.spec.ts covers Week on a phone, Board and Stock on a desk, and an "Also here" page; e2e/up.spec.ts now
  expects Clients to have Jobs' way up.
