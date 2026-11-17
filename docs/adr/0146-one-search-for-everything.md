# ADR 0146: One search for everything

- **Status:** accepted
- **Date:** 11 November 2026
- **Asked for by:** Colly ("Good for all", on the app review of 11 November
  2026, finding 13)
- **Changes:** [ADR 0120](0120-a-quote-from-a-planner-day-and-keys-at-a-desk.md) (the / key)

## Context

Each list has its own Find: Jobs, Quotes, Clients, Venues, People, the
catalogue. To look up a person, a client, a kit number or a job you first had
to know which area it lives in, go there, then search. Nothing on Home or in
the top bar searched across them.

## Decision

1. **A magnifier beside the bell** on every screen's top bar opens Search
   (`#search`), on a phone and at a desk. Its field has the cursor as it opens.
2. **It searches what's on the device**, so it works with no signal: jobs (by
   name, client, venue, and quote number for those who see money), quotes by
   number, clients (and their contacts), venues (and addresses), people (name,
   email, phone, skills), products, and numbered kit by its label number, old
   tag or serial when what's typed has a digit in it. A role finds only what
   it's sent (ADR 0042).
3. **Results by kind**, each under its own heading with its count, the names
   that start with what was typed first, five shown and the rest a press away.
   Each opens its own page; Back comes to the same results, as what was typed
   is kept while the app is open.
4. **At a desk / opens Search**, and **F** finds on the page, which is what /
   did before. The shortcuts sheet lists both.

## Consequences

- Each list keeps its own Find, for narrowing that list.
- Search keeps the Menu's tab lit on a phone, as Notifications does.
