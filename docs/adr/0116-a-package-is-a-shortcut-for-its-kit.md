# ADR 0116: A package is a shortcut for its kit

- **Status:** accepted
- **Date:** 8 November 2026
- **Asked for by:** Colly, 8 November 2026: named sets of kit for common
  situations, as templates to refine for each gig; then "Can the package be
  truly a shortcut for just adding the gear. On the quote the package can
  show as the title item but the contents of the package are still
  itemised as sub items on a reveal for the digital version and pre
  expanded on the paper one. Similar also for racks, however these are
  physically grouped items not just semantically grouped."
- **Amends:** [ADR 0087](0087-packages.md) (a package was one line at one
  price, with what it held written on it).
- **Builds on:** [ADR 0074](0074-racks.md) (racks and their layouts),
  [ADR 0113](0113-two-people-on-one-draft.md) (two people on one draft).

## Context

Packages already were named sets of products, but on a quote one was a
single line at a single price with its contents as words. Its kit could
not be changed for one gig, wasn't checked for availability line by line,
and a package with no deal price made no sense. Racks went on a quote as
one line with nothing to say what was built into them.

## Decision

1. **Adding a package adds its kit.** Its line goes on, named for it, with
   each product it holds as a line under it (`under` on the quote line,
   the package line's id), to change, add to or take off for this job.
2. **Price.** A package with a price of its own is charged at that, and
   its kit is included ("Included"). A package with no price is its kit at
   the price list's prices, and its line comes to what they do. The price
   on a package is now optional. Which way to take it was put to Colly; this
   is the recommended option, built while he decides.
3. **On screen** a package's kit is folded under its line, "What's in it
   (n lines)" a press away; it's shown as it's added. **On paper**, and in
   the emailed PDF, it's printed under its line, smaller, always.
4. **A rack** added to a quote brings what its layout has built into it as
   lines under it, included in the rack's price. They're not kit of their
   own: availability, the job's kit list and "keeps up with the job" count
   the rack, which takes them along (ADR 0017).
5. **A package's line goes with its kit** when taken off, and comes back
   with it on Undo. A new version or a copy keeps each line under its
   package (`withNewIds`).
6. **Save the kit as a package** on a draft: a new package holding the
   quote's products, each once with how many, named by the office.
7. **Add a package** on a job's Kit: its products on the kit list in one
   press, added to lines already there. Packages are on the devices of
   those who see money, so only they are offered it.
8. **Tolerant, not refused.** A line under a package line that has gone
   (two people on one draft) is kept and listed as a line of its own. A
   line is marked for merging with `under` only when it has one, so lines
   marked before read the same.

## Consequences

- Package lines from before (no lines under them) still read, price and
  print as they did, with what they held in words.
- A quote started from a past job (ADR 0115) takes a package charged by its
  kit as that kit, and one charged as a whole as its line.
- A package line's own number (how many packages) doesn't multiply its kit
  after it's added: change the kit's lines instead.
