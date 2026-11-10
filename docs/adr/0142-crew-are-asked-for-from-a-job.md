# ADR 0142: Crew are asked for from a job

- **Status:** accepted
- **Date:** 10 November 2026
- **Asked for by:** Colly, who found the card at the foot of Crew › Calls,
  "Crew for something not in Jobs", and couldn't tell what it was for
  (10 November 2026)
- **Follows:** [ADR 0140](0140-one-job-one-path.md) (one job, one path)

## Context

Crew › Calls ended with a card, "Crew for something not in Jobs", holding a
form that made a crew call with no job: project, phase, venue and days typed
by hand. It dates from the first crew booking (ADR 0002), before Jobs existed,
and was kept for one-offs once calls came from a job's Crew tab.

A call made there belongs to no job. Its venue, phases and any change to them
never reach the crew; it isn't on the job's page, its show pack or the Board;
and the card's own hint sent people back to Jobs. Since one job, one path
(ADR 0140), it was the one place work could start outside a job, and the
person running the office couldn't say what it did.

## Decision

The card and its form are gone. Crew are asked for from a job's Crew tab. For
a day that isn't a show (a warehouse day, crew lent to another company) the
office makes a quick job for it, which then has a place on the calendar, the
planner and the Board like any other.

Calls already made that way stay as they are: they show on Crew › Calls under
their typed name, and can be offered, confirmed and cancelled as before. The
server still takes a call with no job, for those and for the import.

Crew › Calls' empty line now says where to go: "Ask for crew from a job: open
it in Jobs and go to its Crew tab."

## Consequences

- A call no longer stays in view on Calls because it was "made here"; a call
  past the next fortnight is under Show all, as every other one is.
- The browser tests that made calls on Crew make a job and ask on its Crew tab
  (`e2e/ask.ts`).
- Crew › Calls has two parts now (the answers and the calls), so on a phone
  it no longer has an "On this screen" strip, which starts at three (ADR
  0033). The strip's tests use Admin › Company instead.
