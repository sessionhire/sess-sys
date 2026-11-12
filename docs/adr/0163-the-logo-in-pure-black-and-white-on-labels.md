# ADR 0163: The logo in pure black and white on labels

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026 ("For the logo version - Can you
  add a toggle to increase the contrast so that the logo is pure black and
  white.")
- **Builds on:** [ADR 0155](0155-the-company-logo-in-one-place.md) (the Logo
  card, and its preview of the logo as a label prints it) and
  [ADR 0106](0106-logo-length-and-colour-on-labels.md) (the logo on labels,
  printed in grey, made on the device at full size since 1.175.0, PR #352)

## Context

Labels printed the logo in greys. A label printer has only black dots, so
it dithers a grey into a pattern, and a colour logo's soft edges and pale
parts come out speckled or faint.

## Decision

1. **A switch on the Logo card,** "Pure black and white on labels", off
   until the office turns it on. It is a company setting on the logo's own
   row (`logo.blackWhite { on }`, column `logo_black_white`), for whoever
   changes settings, so every device prints the same way, and it is in the
   history.
2. **Labels only.** With it on, each label's logo is drawn in greys and then
   pushed to solid black or white at the middle grey. Quotes and their PDFs
   keep the logo in colour.
3. **Done on the device, not to the file, and not with a CSS filter.** The
   label's grey copy is already made on a canvas at the logo's full size
   (`useLabelLogo`), because Chrome prints a filtered picture at the size
   of its box, as a blur of big pixels. Pure mode is one more step in that
   same pass. The logo as put up is untouched, so turning the switch off
   brings the greys straight back, and a new logo needs no second step.
4. **The card's label preview follows the switch,** so a part that drops out
   is seen before anything is printed.

## Consequences

- A logo with pale colours can lose those parts on labels with this on; the
  switch's own line says so.
- Item, case and cable labels, on screen and printed, all follow it.
