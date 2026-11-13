# ADR 0175: Labelling as the count goes

- **Status:** accepted
- **Date:** 13 November 2026
- **Asked for by:** Colly, 13 November 2026 ("We'll be getting ready to do
  the first full stock count once the new system goes live. Nothing is
  currently stickered either so we'll have to label stock as we count
  too"), who then picked all six improvements from the review, starting
  with this one.
- **Builds on:** [ADR 0015](0015-printing-labels.md) (labels claimed on
  scan) and [ADR 0030](0030-stocktakes-and-rolling-counts.md) (counts).

## Context

The first full stocktake is also when the kit gets its labels: everything
from Current RMS came in counted ([ADR 0056](0056-bringing-the-stock-in-from-current-rms.md)),
the numbered products "not labelled yet". Trying it on a test copy showed
two things in the way.

- **Counting and labelling were two passes.** A new label scanned on a
  count was only noted ("put the label on its item from the Stock search
  afterwards"), so every label was scanned twice, once on the count and
  again in the Stock search, with the product and place said there.
- **"How many" meant two things.** For a numbered product part labelled,
  the field counts only those without a label, but said only "Not labelled
  yet" beside its name. Labelling 3 of 24 speakers and typing 24 said "3
  over" and offered Set to 24, which would have made 27; and the 3 put on
  from the Stock search, not scanned on the count, were "not found".

## Decision

- **A new label on a count is put on there.** Scanning a Session Hire label
  no item has (written "SH-000123" or "sh 123", or all six digits as a
  scanner reads a label) opens, under the scan field, "SH-000123 isn't on
  anything yet": which product it's on. Kept at the place or in the case
  being counted, it becomes that product's item there, one of those
  counted there without a label when there are some (taken off that count,
  as claiming always has), and is counted as found. A short run of digits
  could be a maker's serial, so it is only noted, as before.
- **The product carries over**, kept with the count on the phone: the next
  label opens with it named and the button focused, so labelling a shelf
  is a scan and a press, as in the Stock search. The button names the
  product ("Put SH-000124 on a d&b Y10P"), so a shelf of something else
  shows before it's pressed.
- **Not now** leaves the label noted on the count, as any number no item
  has. Under Not as recorded, a noted label from a run set aside has **Put
  it on its item**, which opens the same question.
- **Those without a label, said as such.** On a count, a numbered product's
  field says "Without a label only", and once some here are labelled, "the
  5 labelled here are scanned instead"; its placeholder is "No label". The
  count's page names it "d&b Y10P without a label". A number typed before a
  label went on comes down by one as each label goes on from that count, so
  what was typed stays true.
- **A label put on from the Stock search** while a count of where it's kept
  is under way on this phone is found on that count too, and comes off the
  number typed in the same way.
- The count's page and its record are unchanged: an item labelled on a
  count is an item found. The count says "4 labels put on during this
  count" while it's under way.

## Consequences

- Labelling the warehouse is part of the baseline count, a bay at a time:
  scan, say the product for the first of a shelf, press for the rest, and
  type how many are left without a label.
- Putting a label on still needs the item to be numbered: a counted
  product refuses, with how to change it.
- Kit recorded at another place (the one place everything came in at from
  Current RMS) is the next step: labelled here, it's added here, not taken
  off that place.
