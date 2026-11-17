# ADR 0178: Printing on the Zebra ZT411

- **Status:** accepted
- **Date:** 13 November 2026
- **Asked for by:** Colly, 13 November 2026, the sixth of the six stocktake
  improvements, with the printer confirmed ("The printer will be the Zebra
  ZT411").
- **Builds on:** [ADR 0015](0015-printing-labels.md) (printing labels),
  [ADR 0106](0106-logo-length-and-colour-on-labels.md) and [ADR 0163](0163-the-logo-in-pure-black-and-white-on-labels.md) (the logo on
  labels, pure black and white), [ADR 0175](0175-labelling-as-the-count-goes.md)
  (labelling as the count goes).

## Context

The first full stocktake labels the whole warehouse, thousands of labels.
Labels printed through the browser's print dialog: a page the label's
size, "actual size, not fitted to the page" to get right on each computer,
and at most 500 at a time. The rest went to a label maker as a
spreadsheet. The ZT411 is a 300 dpi thermal transfer printer that speaks
ZPL, and a browser can't reach a printer on the network by itself.

## Decision

- **Labels are written in ZPL** (`shared/src/zpl.ts`), the printer's own
  language, in the same three label-printer layouts as the browser's
  (50 × 25, 100 × 25 bigger type, 25 × 25): the QR code drawn by the
  printer from the number at the most error correction, the number in
  large type, the logo as a pure black-and-white graphic when there is one
  (the company name in words when not), and on an item's own label its
  product and stock code. Checked by rendering at 300 dpi and reading each
  QR code back.
- **One tap from the computer it's set up on, through Zebra Browser
  Print**, Zebra's own free program, which answers only on that computer
  (127.0.0.1, port 9100, or 9101 secure) and asks the first time whether
  this app may use its printer. The app asks it for its default printer
  and, when there is one, offers **Print N labels**, sending them in parts
  of 100 so the printer starts at once, with how far it's got. The app's
  content security policy lets in those two addresses and nothing else.
- **Anywhere else, Download for the ZT411**: the same labels as a `.zpl`
  file, which Zebra's own tools print, and Zebra's printing app does from a
  phone. Without Browser Print, the card says how to set it up.
- **The whole run at once.** On the ZT411 there's no 500 cap: From and How
  many default to the whole run. The browser's printing stays as **On
  another printer**, for A4 sheets and other label printers, with its cap.
- An item's own label prints on the ZT411 from its page in the same way.
- The label size is kept on the device, apart from the browser's layout.

## Consequences

- The warehouse computer needs Zebra Browser Print installed with the
  ZT411 as its default printer, and the printer's media set to the label
  size chosen (its own calibration). Nothing is set up on the server.
- Phones can't run Browser Print, so on the floor a run is printed from the
  warehouse computer, or downloaded. A queue that a phone adds to and the
  warehouse computer prints is a possible next step.
- Cable labels ([ADR 0106](0106-logo-length-and-colour-on-labels.md)) still print
  through the browser.
