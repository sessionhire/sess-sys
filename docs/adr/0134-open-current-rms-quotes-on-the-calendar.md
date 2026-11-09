# ADR 0134: Open Current RMS quotes on the calendar

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly ("Is there a way to clean up the quotes from
  current RMS so they show on the calendar as potentials?", 9 November
  2026). Colly chose "Show them as they are, tidy by a press" over making
  each one an enquiry job here.
- **Builds on:** [ADR 0123](0123-a-master-calendar-of-jobs-and-enquiries.md)
  (the master calendar), [ADR 0092](0092-current-rms-history-on-quotes.md)
  (Current RMS's history, its rule for what went ahead, and Match to jobs),
  [ADR 0102](0102-a-job-from-a-past-quote.md) (a job from a past quote).

## Context

The master calendar shows jobs here: confirmed solid, enquiries and quotes
dashed. Quotes still open in Current RMS, for jobs that may yet happen, were
not on it unless someone had made a job from them, so the calendar said less
about how full a day could get than the office knew. Current RMS's own
statuses can't be trusted to say which are still live (ADR 0092: hundreds are
still "provisional" long after their days).

## Decision

1. **The calendar shows the open ones as potentials.** An open quote is ADR
   0092's: not an order, not lost, dead or cancelled, and its days not past.
   It's drawn dashed like an enquiry, one bar over its days, saying "Current
   RMS quote" with its number and client, and opens its past quote, where
   "Make a job from this" is a press away. The key says so when there are
   any. "Confirmed" leaves them out.
2. **None is shown twice.** One linked to a job here (Match to jobs, or made
   into one) is left out, and so is one that looks like a job here: the same
   client or most of its name, on its days give or take one (a score of 3 or
   more by `matchOpportunities`).
3. **"Not going ahead" takes one off.** On an open past quote with no job
   here, the office can say it isn't going ahead, which takes it off the
   calendar, and put it back. That's kept in `rms_set_aside` (server only, in
   Download everything). Nothing in Current RMS changes.
4. **For those who see money, with signal.** The server answers from its copy
   (`GET /api/rms/calendar?from&to`, the weeks shown); offline, the key says
   they'll show when there's signal. Crew see the calendar as before.

Not chosen: making every open quote an enquiry job in one go. It would put
them on the planner and availability too, but it makes many jobs at once
from statuses that can't be trusted, each one then to be cancelled by hand.

## Consequences

- The calendar shows the work that might come from Current RMS without a job
  being made for each.
- A quote for a job here under another client and name isn't matched and
  shows twice until it's linked on Match to jobs.
- Quotes read from Current RMS only change when it's read again (Admin ›
  Current RMS).
