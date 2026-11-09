# ADR 0131: An admin can delete a quote, and put it back from the history

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("make a way I can delete a
  quote, make it difficult with a popover and have to type in something to
  delete. Only available to admins").
- **Builds on:** [ADR 0042](0042-quotes-prices-and-a-money-view.md) (quotes),
  [ADR 0034](0034-roles-and-what-each-can-change.md) and [ADR 0060](0060-system-admins.md) (roles,
  system admins), [ADR 0006](0006-audit-trail-and-export.md) (the history),
  [ADR 0084](0084-the-printed-quote.md) (quote numbers),
  [ADR 0121](0121-the-client-accepts-a-quote-online.md) (the client's link).

## Context

A quote couldn't be taken away. One started on the wrong job, a test, or a
version made by mistake stayed on the job, on Quotes and in the money
figures for good. Every version a job has is a record of what the client
was shown, so taking one away has to be rare, deliberate and recoverable.

## Decision

1. **One version at a time.** Delete is on the quote page, at its foot,
   for the version shown. Deleting the only version leaves the job with no
   quote; deleting the newest makes the one before it the one that counts.
2. **Admins only.** It needs the company ability, a director's, which a
   system admin has too. The server checks it; the button isn't drawn for
   anyone else. While roles are off everyone can, as for everything else.
3. **Hard on purpose.** The button opens a dialog (the design system's, a
   blocking decision, with Keep it focused, a sheet on a phone) that lists
   what makes this version matter: paid, invoiced, accepted or turned
   down, sent and on what day, its client link, its emails, a confirmed
   job, the job's only version. Delete stays off until the quote number is
   typed, or the word "delete" for a version never sent and so never
   numbered. The server checks what was typed too.
4. **Kept, out of sight.** The server marks it deleted rather than
   removing it. It goes from every device with the emails it went in; its
   link to the client stops; anything done to it is refused as gone; a
   phone that still had its draft open can't save it back. The history
   says who deleted which, and there an admin can **Put the quote back**,
   as it was, unless the job has a draft of its own since (a job has one at
   a time) or a draft would come back to a settled job.
5. **Numbers stay given.** A new version is numbered after a deleted one,
   so putting it back never finds its version taken. The job keeps its
   quote number for its next version, and no deleted number goes to
   another job.

## Consequences

- Backups and Download everything keep deleted versions, with the day.
- The design system's rule is to undo rather than ask. This asks, and
  makes the person type, because Colly wanted it hard and because what
  goes is a record the client may have; the history is its undo.
