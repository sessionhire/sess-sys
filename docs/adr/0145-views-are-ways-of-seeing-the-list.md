# ADR 0145: Views are ways of seeing the list

- **Status:** accepted
- **Date:** 11 November 2026
- **Asked for by:** Colly ("Good for all", on the app review of 11 November
  2026, finding 8)
- **Changes:** [ADR 0041](0041-where-things-live.md) (each area's row of
  pages), [ADR 0141](0141-a-list-page-tells-its-story-in-order.md) (the row
  under a "Views" heading)

## Context

Since ADR 0141 every area's row of pages sits under a heading that calls it
"Views". But the rows held more than views. Jobs had List, Board, Calendar,
Week and Month, which are the same jobs seen five ways, and then Clients,
Venues and Money, which are not. Stock had nine, from Catalogue to the
Purchase list, and Crew had Leave and Timesheets beside Calls and People. On a
phone Jobs' row was cut at Month, so the places past it were off the edge
behind a fade.

## Decision

1. **The row holds the views.** Jobs: List, Board, Calendar, Week, Month.
   Stock: Catalogue, Places, Racks. Crew: Calls, People.
2. **The area's other places go on a quieter line under the row**, headed
   "Also here", as plain links that wrap rather than scroll: Clients, Venues
   and Money (for the roles that see it); Labels, Counting, Testing, Repairs,
   Vehicles and the Purchase list; Leave and Timesheets. Each keeps its
   count, and the one you're on is in the ink and underlined.
3. **Nothing moves address, and nothing is hidden behind a press.** Both
   lines are in the same "Jobs pages", "Stock pages" or "Crew pages"
   navigation, so a screen reader still hears every page of the area in one
   list, and the Menu still lists them all.

## Why a line and not a "More" menu

A menu hides the counts on Counting, Testing, Repairs and Leave behind a
press, and these are the counts that say whether a page needs a look. A
second line costs one short line on a phone and keeps every place one press
away, as before.

## Consequences

- On a phone Jobs' five views fit the width; Stock's three and Crew's two
  do with room to spare.
- On Clients, Venues, Money and Stock's and Crew's other places, no view is
  marked in the row: the line under it marks where you are.
