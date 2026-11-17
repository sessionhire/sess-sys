# ADR 0139: A quote that looks like the company's own document

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly ("Can you make the Quote PDF better? It is very
  plain, it has website details etc. which makes it look like a print out",
  9 November 2026).
- **Builds on:** [ADR 0084](0084-the-printed-quote.md) (the printed quote),
  [ADR 0101](0101-sending-a-quote-to-the-client-by-email.md) (the PDF made on the server),
  [ADR 0116](0116-a-package-is-a-shortcut-for-its-kit.md) (a package's kit
  printed under it), [ADR 0128](0128-the-quote-the-way-the-office-writes-it.md) (the logo on the quote).

## Context

The quote is the one thing a client sees, and it came out two ways: the
browser's print of the page (Print or save as PDF), and the PDF the server
draws for the email and the client's link. Both were plain black type with
one weight. The browser's copy carried the browser's own header and footer:
the tab's title, the date and time, the app's address and a page count, so
it read as a web page printed out. The server's copy, in Helvetica, didn't
carry the logo when the office opened it from the quote, only when emailed.

## Decision

1. **One layout, drawn twice to match.** Both copies follow it: a band of
   the brand's red along the top edge; the logo (or "Session Hire" in
   Archivo) at the left and "Quote" with its number in red at the right;
   then three columns, Prepared for, The job, and the date and Valid
   until; the lines under a shaded head, each group headed in small red
   capitals; the deposit and payment terms in a shaded box beside the
   totals; the total in a red block, in Archivo; terms and bank details side
   by side in small type; and the company's name, address, phone, email and
   VAT number as a letterhead at the foot.
2. **The design system's type on paper**: IBM Plex Sans to read, Archivo
   for the title and the total. The server reads them from the same
   @fontsource files the app bundles, and falls back to Helvetica if it
   can't, so a quote always goes.
3. **No browser header or footer.** The printed page puts something in the
   page's top margin (the red band) and its bottom margin (the quote number
   and "Page 1 of 2"), which tells Chrome and Edge to leave out their own.
   While it prints, the tab's title is the quote's file name ("Quote 1115 -
   Job"), so Save as PDF offers that name.
4. **The logo on every copy**: the PDF opened from the quote and from the
   client's link now carry it, as the emailed one did.
5. **Words unchanged.** Every line, figure and sentence of ADR 0084 is
   still printed; only the company's details move from the top left to the
   foot, as letterhead. The server's PDF repeats the letterhead and the
   table's head on every page; the browser's repeats the head and the page
   count, and the letterhead closes the last page.

## Considered

- **Sending Print to the server's PDF.** One copy only, but it needs a
  signal and the latest edits on the server; the browser's print works
  with no signal, so both stay and look the same.
- **Brand red only on the logo.** The page read as grey again; red marks
  the three things a client looks for (which quote, what's in each group,
  what it comes to) and nothing on screen, where red stays "you".

## Consequences

- `server/src/finance/quote-pdf.ts` draws the table itself (pdfkit's table
  can't repeat its head); the server depends on @fontsource/ibm-plex-sans
  and @fontsource/archivo.
- Safari and Firefox print without the band's margin trick where they don't
  support page margin boxes; Safari has no header or footer unless asked for.
