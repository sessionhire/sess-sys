# ADR 0106: The logo, stock code, cable length and its colour on labels

- **Status:** accepted
- **Date:** 1 November 2026
- **Asked for by:** Colly, 1 November 2026 ("On the print template can the
  labels also include a stock code, the company logo - for cables can we
  include the length and a colour code for the cable length."; then "Does
  the ZT411 printer selected print in colour?")
- **Builds on:** [ADR 0015](0015-printing-labels.md) (item labels),
  [ADR 0095](0095-cable-labels.md) (cable labels),
  [ADR 0083](0083-product-photos-and-the-rack-sheet.md) (a picture kept as a product's photo is)

## Context

Labels said "Session Hire" in words and, on an item's own label, its
product. Cable labels said what the cable is and carried its stock code as
a barcode or QR code, but not its length on its own, nor any colour.

Rental houses tell cable lengths apart by colour: tape or heat-shrink at
each end, one colour per length, so a 10 m and a 15 m are sorted on the
truck without reading. There is no one standard; many follow the order of
the colours on a resistor. The Zebra ZT411 the office is buying prints
black only, so a colour on the label itself needs a colour printer.

## Decision

1. **A company logo**, put up under Admin › Company › Labels by whoever
   changes settings, kept on the "logo" setting as a product's photo is
   (the storage bucket, read through the server, a new address each time).
   The device makes it a PNG on white, 1200 px at most, so a see-through
   logo doesn't print black and its edges stay sharp. Every signed-in
   person reads it, as anyone prints labels. Labels print it in grey
   scale; until there is one they say the company's name in words.
2. **Item labels** carry the logo and, on an item's own label, its
   product's stock code under the product.
3. **A length on each product**, in metres to a tenth ("Length, in m, for
   a cable" with the size fields). Until one is given, a cable label reads
   it from the name ("XLR 10m") and says so.
4. **A colour for each length**, a company setting ("cables"): a list of
   up-to lengths and colours, shortest first, edited under Admin. It
   starts from the resistor order: up to 1 m brown, 2 m red, 3 m orange,
   5 m yellow, 10 m green, 15 m blue, 20 m violet, 30 m grey, 50 m white,
   then 100 m pink and 150 m light blue (Colly's ask); longer has none.
5. **Cable labels** put the length in big type with its colour as a word
   in a black band ("10 m [GREEN]"), so the label reads in black alone, and
   the logo beside them. The colour itself is the tape or sleeve put on
   with it, and the tab says which. A device ticked "This printer prints
   colour" prints the band in the colour, for a colour label printer such
   as an Epson ColorWorks.

## Consequences

- `models.length_m`; `settings.cable_colours`, and `photo_*` columns on
  `settings` for the logo. Commands `model.update` (lengthM) and
  `cables.colours`; the logo is put up and taken down at
  `/api/settings/logo/photo`, recorded in the history as `logo.put` and
  `logo.remove`.
- A printer that prints black only can't show colour, so the word is the
  colour code on the label; the colour a crew member sees from across the
  room is the tape. Colour label stock per length was not chosen: it means
  changing rolls per length.
- The printed quote (ADR 0084) can use the same logo later.
