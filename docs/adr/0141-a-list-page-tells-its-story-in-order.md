# ADR 0141: A list page tells its story in order

- **Status:** accepted
- **Date:** 10 November 2026
- **Asked for by:** Colly ("The order of information on this page can be made
  more clear in terms of telling the narrative of the page", on the Jobs list on
  a phone, 10 November 2026)
- **Changes:** [ADR 0082](0082-one-page-head-and-calmer-pages.md) (the page head:
  the area's row moves under the title), [ADR 0099](0099-filter-and-sort-on-long-lists.md)
  (list tools: a list's main choice can be pills inside Filter),
  [ADR 0137](0137-filter-jobs-by-department.md) (on the Jobs list the
  departments row moves into Filter).

## Context

On a phone the Jobs list opened on the area's row of views (List, Board,
Calendar, Week, Month…), then the title, then New job on a line of its own, a
line about bringing jobs in from Google Calendar, the search, three rows of
toggles (Coming up / Past / Not going ahead, the five departments, Mine), and
only then Sort and Filter. The first jobs were below the fold. The row of views
above the title read as the page's title; the calendar line is for the few who
set the app up, once.

## Decision

1. **Title, and the add on its line.** A list page's add sits right of its
   title: New job, New product, New place, New person, New vehicle, New rack.
   Its form opens at the top of the list (beside the list on a laptop, for
   jobs) with the cursor in its first field; Close puts it away and the focus
   goes back to the title's button. `pageAdd.ts` joins the two by the list's
   name; `Fold`'s `from` is the form's side.
2. **Search next.** On Jobs the search sits straight under the title, before
   the views, as finding a job is what most people come to the list for.
3. **Views, under a heading.** Every area's row of pages now comes after the
   title (and the search), under a small "Views" heading, on every page that
   has one, so it reads as a choice of how to see the page.
4. **The list's choices inside Filter, as pills.** On Jobs, When (Coming up,
   Past, Not going ahead, one at a time), the five departments (as many as
   wanted) and Mine are pills at the top of the filter panel, each with its
   count, above the panel's selects. Anything away from the list's start shows
   twice, as every filter does: in the button's count and as a chip that takes
   it off ("Past ✕", "Lighting ✕"). Clear filters puts the list back to
   Coming up and all departments.
5. **Bringing jobs in from Google Calendar** is no longer on the Jobs list. It
   stays under Menu and Admin › Connections.

~~The departments row stays a row on the calendar, the week planner and the
Board, where it is the one choice those views have.~~ Changed the same day
(1.150.0, below).

## Consequences

- The jobs start a third of a phone higher.
- The list's when is one press further away (Filter, then Past). It is said as
  a chip whenever it isn't Coming up, so a list of past jobs never looks like
  the list.
- The search on Jobs is kept for the tab's life, so Back from a job finds the
  list as it was searched.

## Addendum, 10 November 2026 (1.150.0): every view of the jobs alike

Colly asked that the Board, Calendar, Week and Month filter the same way as
the list, and that the add sit in the same place on each.

- **Filter on every view.** The Board's which jobs (Next 8 weeks, All coming
  up), the calendar's (Everything, Confirmed, Potential) and the departments
  are pills in a Filter panel, each one on a chip above the view, with Clear
  filters. No sort: each view orders itself by time or stage. The Filter
  button shares its row with what the view already had there: the calendar's
  Today and arrows, the planner's Jobs, People and Vans (which say how the
  rows are drawn, not which jobs, so they stay on the page). The departments
  aren't offered while the planner's rows are people or vans.
- **New job on every view's title line.** On the Board, Calendar, Week and
  Month it goes to the list with the New job form open and the first field
  ready (`askToAddOn` in pageAdd.ts).
- **Clients and Venues have their own add**: New client and New venue, a name
  (and a venue's address), then its own page to fill in the rest. A name
  already there is said rather than made twice. Money has no add.
