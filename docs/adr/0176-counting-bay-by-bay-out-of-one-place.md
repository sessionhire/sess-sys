# ADR 0176: Counting bay by bay out of one place

- **Status:** accepted
- **Date:** 13 November 2026
- **Asked for by:** Colly, 13 November 2026, the third of the six
  stocktake improvements ("Start from the start - continue through them
  all").
- **Builds on:** [ADR 0030](0030-stocktakes-and-rolling-counts.md)
  (counts), [ADR 0056](0056-bringing-the-stock-in-from-current-rms.md) and
  [ADR 0061](0061-one-place-for-a-whole-stock-list.md) (a whole stock list
  at one place), [ADR 0175](0175-labelling-as-the-count-goes.md)
  (labelling as the count goes).

## Context

Current RMS has no locations, so the whole stock list comes in at one
place ("Warehouse"). The first full count then walks the real bays. Tried
on a test copy, counting Bay A1 found 20 XLRs that the record had at
Warehouse: the count said "20 over" and its fix set Bay A1 to 20, leaving
all 250 at Warehouse, so the warehouse owned 270. Splitting it out by
hand meant moving each product's count from its page. And the bays
themselves were typed one at a time.

## Decision

- **Kit found at a place, recorded at a place never counted, moves from
  there.** On a count's page, counted kit over at a place, of which some is
  recorded at another place that has never been counted, says so ("50 are
  recorded at Warehouse, never counted") and its fix is **Move 20 here
  from Warehouse** (`stock.move`), or, if there isn't enough there, **Move
  6 here from Warehouse, and set to 20**. Where more than one place could
  give, the one holding most does. A place counted already is never taken
  from: its count says what's there. Set all does the same for each line.
- **A label put on at a bay takes its item off that place too.** Labelling
  on a count ([ADR 0175](0175-labelling-as-the-count-goes.md)) a product
  none of which is recorded here without a label takes one from the place
  never counted ("One of the 24 at Warehouse without a label: it comes off
  there and is kept here"): `stock.move` of one, then `asset.add` from the
  count, as labelling always has.
- **Emptying the place it all came in at.** Once the bays have their share,
  counting Warehouse itself lists everything still recorded there. **None
  of the other 309 here** fills 0 into every field left blank, so what's
  left is put right in one press of Set all, rather than 309 noughts typed.
  It only fills blanks, and each can still be changed before Finish.
- **Many places at once.** New place reads a range: "Bay A1 to A20",
  "Bay A1 to Bay A20", "Shelf 1-12", "Rack 01 – 10" (keeping its noughts).
  The button says how many ("Add 20 places"), the line under it the first,
  second and last, and those already here are left as they are and said.
  At most 200 at a time, and numbers alone ("1-3") are a name, not a range.

## Consequences

- The baseline stocktake runs as the office walks it: make the bays, count
  each bay (labelling as it goes), move what's found there out of
  Warehouse, and count Warehouse last to clear what's left.
- A place stays "never counted" until its first count is finished, so the
  rule needs no new setting. The one stock list place is that place until
  it's counted at the end.
- The comparison and the record of a count are unchanged: only the fixes
  offered on its page differ.
