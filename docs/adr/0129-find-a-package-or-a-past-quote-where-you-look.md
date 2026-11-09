# ADR 0129: A package or a past quote is found where you'd look for it

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("Work on all of these in order
  overnight", then "Go"), batch 5 of the
  [audit of the quote flow](../audit-quote-flow-2026-11-08.md): findings 12
  and 17, and the start of section 2 of its from-scratch part.
- **Builds on:** [ADR 0087](0087-packages.md) and
  [ADR 0116](0116-a-package-is-a-shortcut-for-its-kit.md) (packages),
  [ADR 0115](0115-start-a-quote-from-a-past-job.md) (start from a past job),
  [ADR 0092](0092-current-rms-history-on-quotes.md) (Current RMS's quotes,
  kept on the server).

## Context

A package was added from its own button, a plain list of 41 in name order
that couldn't be searched and didn't say what each held. Typing "Axient"
in Add kit found nothing, so the office had to know a package was there
before looking for it.

"Start from a past job" appeared only once the client or venue matched a
known one exactly, and offered only this app's jobs. Four in five quotes
are for repeat clients, and for the next year most of their history is the
1,072 quotes read from Current RMS, reachable only one at a time from
Quotes › Past quotes.

## Decision

1. **Packages are found in Add kit.** They're searched with the products,
   by any word of their name, marked "Package", with their price and what
   they hold: "€90.00 a day · holds 4 × Shure SM58". A count typed first
   is that many packages, their kit that many times over. The picker stays
   open for the next, as for any kit. A rack says what's built into it.
   "Add a package" stays for browsing the list.
2. **One Start from on New quote.** It's a search box with what to start
   from under it. With nothing typed it offers this app's jobs like the new
   one (same client and venue first, as before) and the client's last three
   quotes in Current RMS. Typing two letters or more finds past jobs by
   their name, client or venue, and Current RMS's quotes by number, name,
   client or venue. Picking a Current RMS quote reads its lines as "Job
   from a Current RMS quote" does (ADR 0102): products matched to the stock
   list, services as crew, lines charged nothing there offered unticked.
3. Current RMS's quotes need signal, since they're kept on the server; with
   none, Start from says so and still offers this app's jobs.

## Consequences

- A package is used the way kit is found, so the office doesn't have to
  remember there is one.
- The quickest start, the client's last quote, is there whether it was
  made here or in Current RMS.
- Nothing stored changes, and Current RMS is only read.

## Not done

- One Add box that also finds crew roles, transport and the client's past
  lines, as the from-scratch section has it: kit and packages share one
  box now; crew and the rest keep their buttons until the office has used
  this.
- Matching the client's name in Current RMS loosely: it's searched as
  typed, so a client spelt differently there is found by typing a part of
  the name.
