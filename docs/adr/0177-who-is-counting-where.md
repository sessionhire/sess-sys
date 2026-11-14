# ADR 0177: Who's counting where, and how far the stocktake has got

- **Status:** accepted
- **Date:** 13 November 2026
- **Asked for by:** Colly, 13 November 2026, the fourth of the six
  stocktake improvements.
- **Builds on:** [ADR 0030](0030-stocktakes-and-rolling-counts.md)
  (counts kept on the phone until Finish),
  [ADR 0176](0176-counting-bay-by-bay-out-of-one-place.md) (bays).

## Context

The first full count is done by several people at once, each on their own
phone. A count lives on its phone until it's finished, so nobody else knew
a bay was being counted: two people could count the same bay, and each
count's fixes would put the record right by what that one found. And there
was nothing that said how far the whole stocktake had got, beyond "28 of
40 places counted in the last 13 weeks" on the week's list.

Merging two counts of one place into one was weighed and left: what each
found would have to be joined item by item and number by number, and two
people typing a number for the same shelf would each count what the other
did. Sharing the work out by bay, made easy by
[ADR 0176](0176-counting-bay-by-bay-out-of-one-place.md), does it without
that.

## Decision

- **A count begun is said to every phone.** Starting a count sends
  `count.begin` (its id, where, who, when); discarding it sends
  `count.end`; finishing it ends it, since its record has the same id. A
  count begun more than 18 hours ago and never finished or discarded is
  left behind on some phone and no longer said. Kept in `count_starts`,
  in the export, the history ("Cian Murphy started counting Bay A3") and
  the backups; who points at a person, as a count does, kept when they're
  erased.
- **Said where it matters.** On the week's list, a place being counted
  says "Cian Murphy is counting it, since 10:12" (or "Being counted on this
  phone"). Pressing Count on a place someone else is counting asks first:
  "Cian Murphy has been counting Bay A3 since 10:12. Two counts of one
  place each put it right by what they found, so share it out by bay rather
  than both counting it. Count it as well?", with **Leave it to them**
  beside it. It doesn't refuse: the other phone may have been left on a
  shelf.
- **The stocktake card** on the Counting page (Stock › Counting, when no
  count is under way on this phone): who's counting where now, from any
  phone, each opening the place; how many places have been counted at
  least once, with a bar; and how many numbered items have their label of
  all there are (labelled, and still counted without one), with a bar and
  a line a department. Bars use the chart mark, not the brand red, as
  progress isn't "you".

## Consequences

- Counting a bay without signal still works: its start is said once the
  phone has signal, or not at all if it finishes first.
- Two counts of one place still happen when someone chooses to; each is
  kept, as before.
