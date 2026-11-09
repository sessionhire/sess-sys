# ADR 0138: Correcting the days of a Current RMS quote

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly ("On the previous quotes imported form RMS some of
  them have come in with the wrong dates, how do I correct/amend this?",
  9 November 2026).
- **Builds on:** [ADR 0078](0078-reading-current-rms-through-its-api.md) (the
  read-only copy of Current RMS), [ADR 0092](0092-current-rms-history-on-quotes.md)
  (its history and Match to jobs), [ADR 0134](0134-open-current-rms-quotes-on-the-calendar.md)
  (open quotes on the calendar).

## Context

The copy of Current RMS is read only: each read writes every quote's details
again, so there was no way to put a wrong date right here, and the only fix
was to change it in Current RMS and read it again. Now that open quotes are on
the calendar, a wrong date puts a potential job on the wrong days.

Two things in the app made dates look wrong too. Current RMS gives times in
UTC, and a few places took the date part of that as the day, so anything from
midnight to 1am in Irish summer time fell on the day before: whether a quote
was still open, matching quotes to jobs (the "starts the same day" point),
the Quotes page's day, the day on past jobs, a client's last quote, and the
spreadsheet download. And the app read only the quote's own start and end
(the whole hire, usually from going out to coming back), not the show days
Current RMS keeps beside them.

## Decision

1. **Days are Irish days everywhere.** A time from Current RMS is taken as
   its day in Ireland (`rmsDay`), as the past quote's page and the calendar
   already did.
2. **The show days are read too** (`show_starts_at`, `show_ends_at`) and said
   on the past quote's page when they aren't the days shown. They don't
   replace the quote's days: the hire's days are what the kit is out for.
3. **"Correct the days" on a past quote's page.** The office gives the first
   and last day; from then on they are the days to go by everywhere (the
   page, the calendar, Match to jobs, a job made from it), from midnight on
   the first to 23:59 on the last in Ireland. Kept in `rms_dates_fixed`
   (server only, in Download everything), and in the history as the
   person's ("Corrected the days of Current RMS quote 1200 to …, here
   only").
4. **Reading Current RMS again keeps the correction.** What Current RMS says
   is kept beside it (`rms_starts_at`, `rms_ends_at`) and the page says
   "Days corrected here. Current RMS has …", so a difference is never
   hidden. "Use Current RMS's days" drops the correction and takes Current
   RMS's latest, also in the history.
5. **Nothing in Current RMS changes.** For those who see money, with signal,
   as the past quotes are.

## Consequences

- Fixing a date in Current RMS and reading it again still works, and is
  better when the quote will be used there again.
- A quote made into a job here has its own days on the job; correcting the
  past quote doesn't move the job.
