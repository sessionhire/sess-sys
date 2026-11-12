# ADR 0155: The company logo in one place, with what works best

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026 ("Can you add a section in the
  admin section to upload a logo, with suggested formats/resolutions etc.")
- **Builds on:** [ADR 0106](0106-logo-length-and-colour-on-labels.md) (the
  logo, kept as a product's photo is), [ADR 0128](0128-the-quote-the-way-the-office-writes-it.md)
  and [ADR 0139](0139-a-quote-that-looks-like-the-company.md) (the logo
  heads the quote and its PDF)
- **Changes:** where the logo is put up. Nothing about how it is kept,
  who may change it, or where it prints.

## Context

The logo already printed on stock and cable labels and headed every
printed quote and its PDF, but it was put up inside Admin › Company ›
Labels, under a hint about label printers. Someone looking for "the logo"
would not think to look under Labels, and nothing said what file to send,
how big, or what shape fits the quote's head. Only a JPEG, PNG or WebP
could be sent, though most logos come from a designer as an SVG.

## Decision

1. **A Logo card of its own** in Admin › Company, straight after the
   office's details, for whoever changes settings. Labels keeps the cable
   colours and says where the logo comes from.
2. **It shows the logo as each place has it:** in colour on white, at the
   quote head's shape (67 by 19 mm), and in black as a label printer prints
   it, so a pale logo that drops out on a label is seen before printing.
3. **It says what works best, before anyone goes looking for a file:** SVG
   or PNG; at least 1200 pixels across (the app keeps 1200 on the longer
   side, sharp at 300 dpi across a 100 mm label); wide, about three or
   four to one; dark on see-through or white, as it always sits on white
   paper; cropped close.
4. **An SVG can be sent.** The device draws it out to 1200 pixels and sends
   a PNG on white, as it does any logo, so the server, the PDF and the
   labels are unchanged. Its shape is read from its width and height, or
   its viewBox when it gives only that.
5. **Advice, not refusal.** A file under 600 pixels across (67 mm at about
   200 dpi), or one nearly square or tall, still goes up; the card then
   says why it may print soft or small, and what would fill it.

One version only: everywhere the logo goes is white paper, so a light
version for a dark background has nowhere to be used yet. If the app's own
head or a dark document ever carries it, that is when a second one comes in.

## Consequences

- Admin › Company › Logo is the one place to put up, change or take down
  the logo; the address of the file and the history's actions are as they
  were.
- The end-to-end test of labels puts the logo up through the new card,
  an SVG first and then a small square PNG to see the advice.
