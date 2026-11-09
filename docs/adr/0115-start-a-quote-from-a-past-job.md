# ADR 0115: Start a quote from a past job

- **Status:** accepted
- **Date:** 8 November 2026
- **Asked for by:** Colly, 8 November 2026: "re use old quotes as templates
  for new ones that may be related. Such as for the same venue or client, or
  ideally the both. Can these be based on the post gig pick list, including
  items that were included as additional where they weren't on the quote
  that were needed. Or subsequent additions to the gig that were found to be
  needed on site." This answers feature 8 of the
  [quoting research](../research/quoting.md).
- **Builds on:** [ADR 0081](0081-starting-a-quote-and-following-it-up.md) (New
  quote), [ADR 0096](0096-claude-inside-the-app.md) (lines offered on New
  quote, ticked to take), [ADR 0017](0017-pick-lists-and-scanning-out-and-in.md)
  (movements), [ADR 0087](0087-packages.md) (packages).

## Context

The same client keeps coming back to the same venues, and each quote is
written from nothing or from memory. The quote a past job went out on is
not the best guide to what the next one needs: kit was added on the day,
and some of what was quoted never left the warehouse. What went out is
already known, from the scans and counts on the job (ADR 0017), and the
kit list holds what was hired in.

## Decision

1. **New quote offers the jobs like this one** once the client or the venue
   typed is one already here: the same client and venue first, then the
   same venue, then the same client, latest first, up to six. Only jobs that
   are over and went ahead (not cancelled or lost), with a quote or a kit
   list to start from. Each says how it matches, its days, how many lines it
   gives and how many of those went beyond its quote.
2. **Picking one fills "Lines for the quote"**, the same ticked list an
   enquiry read by Claude fills, to change, untick or add to before the
   quote is started. Picking it again clears them.
3. **Kit is taken at what went out**: its own scanned or counted out (what
   came back and what went missing included), plus what the kit list hired
   in. A job with nothing scanned out at all is taken at its kit list.
4. **Each kit line says where it came from**: "As quoted", "4 quoted, 6 went
   out", "Not on the quote: 2 went out" (in amber, as something to look at),
   or "2 quoted, none went out", which is offered unticked. What went beyond
   the quote comes after the quote's own lines, by department.
5. **The past quote's other lines come as they were**: crew, typed lines and
   packages (with what they held, and their products not offered again
   beside them). Travel and subsistence are left out, since they're worked
   out again for the new job.
6. **Priced from today's price list**; a product or role with no price there
   keeps what it was charged. Kit is for the new job's days, as is any line
   that was for all of the past job's days; others keep their days.
7. The quote that counts is the one sent or invoiced; a job whose quote was
   never sent gives its newest draft.

## Consequences

- No new data or commands: it reads the device's jobs, quotes, kit lists
  and movements, so it works with no signal and costs nothing to keep.
- Quotes from Current RMS are not offered here: they have no pick list. A
  job made from one (ADR 0102) is, once it's over.
- "Quote it again" from a job's own page is left for later, if asked for.
