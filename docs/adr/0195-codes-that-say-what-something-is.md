# ADR 0195: Codes that say what something is

- **Status:** accepted
- **Date:** 24 November 2026
- **Asked for by:** Colly, 24 November 2026: "can we add some semantic meaning to the stock numbers? something that
  still works with barcode readers/qr codes etc still. Something like a code for the department - the stock code - and
  then code increments for counting the individual items."
- **Builds on:** [ADR 0013](0013-warehouse-catalogue.md) (items and their numbers), [ADR 0015](0015-printing-labels.md)
  (labels set aside and claimed on scan), [ADR 0095](0095-cable-labels.md) (cable labels),
  [ADR 0175](0175-labelling-as-the-count-goes.md) (labelling as the count goes) and
  [ADR 0178](0178-printing-on-the-zebra-zt411.md) (the ZT411).

## Context

An item's number was SH- and six digits, SH-000123: unique and short, but it says nothing. Someone holding a case or
reading a list can't tell a speaker from a light without the app. Nothing is stickered yet (the first stock count labels
as it counts, ADR 0175), so the scheme can change now at no cost.

## Decision

- **A code is three parts: `AUD-0123-004`.** The department's letters (AUD audio, LGT lighting, VID video, LAS lasers,
  STG staging, RIG rigging, PWR power, GEN other), the product's number, four digits, and the item's, three digits,
  counting up from 001 for that product. Capitals, digits and hyphens only, always the same width: a QR code holds it
  in its alphanumeric mode (25 modules a side at the highest error correction, against 21 for an SH- number), Code 128
  holds it, and a keyboard scanner types it as printed. Typed by hand it reads however it's written: `aud 123 4`,
  `AUD0123004`. Letters that aren't a department's aren't read as a code, so another firm's tag isn't mistaken for one.
- **Every product has a number**, given in turn by the server. The products there already were numbered department by
  department, then by name, so each department's run together to start with; new ones take the next number. The
  product's part on its own, `AUD-0123`, is its **product code**: on its page, found by the Stock search, scanned to
  open it, and on a cable label or bag when it has no stock code of its own.
- **A new item takes its product's next code**, after every one given out or set aside, so none is given twice. A code
  goes only on its own product: scanning `AUD-0001-005` to put it on a Mac Aura is refused. A code typed off a label
  printed elsewhere, past the last given, moves the next one past it.
- **A label must be printed for its product.** Because the code names the product, its labels can't be pre-printed blank
  on a roll. A product's Items tab has **Labels**: how many (as many as are still without a label, to start), Set codes
  aside, and the run opens to print on the ZT411, another printer, or a label maker, with the product's name on each.
  Scanning one then puts it on its item with no question about the product: on a count it's a scan and a press from the
  first label of a shelf.
- **Letters stay as printed** (put to Colly, 24 November 2026). They follow the product's department until its first
  code is given out or set aside; after that they're fixed, so a label on kit never goes out of date. The letters then
  say where it was first filed.
- **SH- numbers keep working.** Every SH- number scans, types and finds its item as before, and runs of SH- numbers can
  still be set aside for blank rolls. An item put down as the wrong product, whose code named the old one, takes the next
  code of the right one; the old code stays as a former number and still finds it. A product with every code used (999),
  or past product 9999, takes SH- numbers.
- **On the label**, a code is three characters longer than an SH- number, so its type is a little smaller on the
  50 × 25 mm, 25 × 25 mm and A4 sheet layouts, and on the ZT411's.

## Consequences

- Storage: `models` gains `code_number` (unique), `code_letters` and `code_last` (the highest item number given out or
  set aside); `identifiers` takes a second kind, `code`, still one current label to an item; `label_runs` gains
  `model_id` and `prefix`. A product with labels set aside can't be removed, only marked as added by mistake.
- Kit already labelled with SH- numbers can move to codes one at a time: New label on its page, empty, gives it its
  product's next code.
- The free "stock code" on a product (such as RK-MON-A) stays as it was, beside the product code.
