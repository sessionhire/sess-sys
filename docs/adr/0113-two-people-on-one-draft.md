# ADR 0113: Two people on one draft keep both their changes

- **Status:** accepted
- **Date:** 8 November 2026
- **Asked for by:** Colly, 8 November 2026, picking "Six small ones + draft
  fix" from the [quoting research](../research/quoting.md) (feature 7).
- **Amends:** [ADR 0080](0080-a-quote-that-saves-itself-and-keeps-up-with-the-job.md)
  (a draft that saves itself), [ADR 0049](0049-holding-up-at-real-size.md)
  (an edit made against an old copy is turned down, for `quote.save`).
- **Keeps:** [ADR 0042](0042-quotes-prices-and-a-money-view.md) (a sent quote
  never changes), the device's queue (saving works with no signal).

## Context

A draft saves itself a moment after typing stops (ADR 0080), and a save
carries every line. The draft on screen never took in a change made on
another device: it kept the lines it opened with. So with one draft open in
two places, the one that saved last put back whatever it had, and the other
person's change was gone, without a word. A draft left open on a desk while
someone changed it on a phone was enough; nobody had to be typing.

ADR 0049's check caught part of it: a save made from an older copy, such
as one queued with no signal, was turned down whole as a conflict, so the
person who'd been working offline lost theirs instead.

## Decision

**A save says what it began from.** `quote.save` takes an optional `base`:
each line's mark (a short hash of the line, a field left out read as its
default) and the terms as they were when this device's changes began.

**The server keeps what the save didn't change** (`mergeDraft`, in
`shared/src/draft-merge.ts`):

- a line this save didn't change takes the draft's line as it now stands,
  or stays off if someone took it off;
- a line this save changed is the save's, the later word, even if someone
  else changed it too or took it off;
- a line added elsewhere stays, after the line it followed there; one added
  here stays where it was put; one taken off here stays off;
- each term (discount, notes, valid for, deposit, agreed total, meals,
  distance) the same way;
- travel and subsistence lines are the save's, as the device works them out
  from the rest (ADR 0086).

A save with a base isn't turned down by ADR 0049's check, since nothing in it
is saved over anyone's change. A save without one, from an app older than
this, is the draft as it says, and still checked, as before. The device's own
view of a save merges the same way, so what shows before the server answers
is what the server makes of it; the parity tests cover it.

**The open draft takes in changes from elsewhere.** When the draft changes
on another device, each line and term not touched here takes the change,
and what's being typed here is kept, open as it was. Where a line was
changed on both, this device keeps its own and says so once: "Someone else
changed “d&b Y10P” while you were on it. Yours is kept, and the rest of
their changes are in."

## Consequences

- Two people can build one quote at once, and work done with no signal comes
  back into the draft alongside what others did meanwhile.
- A line changed on both is decided by which save arrives last, line by
  line, not field by field. Two people changing the same line's price and
  quantity keep one person's line. Field-level merging was left out: it
  rarely helps on a quote, and a line that's half one person's and half
  another's is harder to trust.
- The notice is only on the device that had typed. The device whose change
  was replaced sees the other's line arrive, as any change from elsewhere.
- The base is a few dozen bytes a line; no column is added and nothing new
  is stored.
