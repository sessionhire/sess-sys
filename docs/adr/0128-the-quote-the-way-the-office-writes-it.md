# ADR 0128: The quote the way the office writes it, and a dry hire as its own shape

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("Work on all of these in order
  overnight", then "Go"), batch 4 of the
  [audit of the quote flow](../audit-quote-flow-2026-11-08.md): findings 6,
  10, 11 and 16, and sections 4 and 6 of its from-scratch part.
- **Builds on:** [ADR 0084](0084-the-printed-quote.md) (the printed quote),
  [ADR 0106](0106-logo-length-and-colour-on-labels.md) (the company's logo,
  uploaded under Admin › Company › Labels),
  [ADR 0116](0116-a-package-is-a-shortcut-for-its-kit.md) (a package's kit
  under its line).

## Context

The quote the client got didn't read the way the office has always written
one. Its lines were grouped only by department (Audio, Lighting…), crew
under Crew, and nothing could be moved or named, where the office groups by
part or place ("FOH", "Monitors", a stage) and by cables, power and rigging,
with headings and notes among the lines (28% of the lines on the 1,072
Current RMS quotes are words). It was addressed to the client's first
contact, not to whoever asked. The printed page and the emailed PDF had the
company's name in type, never its logo, though the logo was uploaded for
labels. And every quote was a show: a dry hire, collected and brought back,
was asked for a venue, given a Show day, travel rows and a crew task it
would never need.

## Decision

1. **Groups are the office's.** Each line says what it's "Under": the kit's
   department until it's changed, picked from the quote's groups or typed
   new. Lines move up and down their group, and a group up and down among
   its kind, a press each, the same on a phone as at a desk. Kit groups
   still come first, then crew, then the rest, so the order of a quote that
   nobody has moved is what it was.
2. **A line can be words only.** "Add words" puts a heading or a note on the
   quote, "All cabling and power included", printed as written across the
   row with no numbers. It's kept as one at nothing, charged once, so
   totals and older devices read it as nothing, and it never needs a price.
   Words count as kit for where their group sits, so a heading can lead.
3. **The quote is for who asked.** Who asked on New quote becomes who the
   quote is for, and the draft's terms have a For box with the client's
   contacts. The printed page, the PDF and the email's PDF print that
   person under the client's name; none chosen prints the first contact, as
   before. A new version is for the same person.
4. **The logo is on the quote.** The logo from Admin › Company › Labels
   heads the printed page and the PDF in place of the name in type. The PDF
   can carry a PNG or a JPEG; any other kind, or a file it can't read,
   prints the name as before.
5. **A dry hire is its own shape.** New quote asks first: a show, or a dry
   hire. A dry hire asks for no venue, its days are when it's collected and
   brought back, as one Hire, and it takes no crew from an enquiry or a past
   job. The job is made as a dry hire, so its crew task is skipped, and its
   draft shows no travel or subsistence unless crew are put on it after all.
6. **The client's page lists the lines as the PDF does**, in the same groups
   and order, words included.

## Consequences

- The quote reads as the office would write it, for the person who asked,
  under the company's logo, so the big quotes don't need a second way of
  being written.
- Moving lines changes the order they're kept in; that's a change to the
  draft like any other, merged with another device's as ADR 0113 says.
- One new field is stored: who a quote is for, on the quote. Words and
  groups are part of the lines as they were.
- Nothing is sent to anyone.

## Not done

- Dragging lines on a desk: Move up and Move down work everywhere and are
  what a keyboard and a screen reader need. Dragging can come once the
  office says the presses are too slow.
- Moving crew above kit, or one group's lines into the middle of another's
  kind: kit, crew and the rest keep their order, which matches every quote
  in the RMS history counted.
- A dry hire's deposit and collection times: the quote's deposit is there
  already; times wait for the warehouse's say.
