# ADR 0159: A crew call on a phase keeps to the phase's days

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who answered the seven
  questions of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  with "Go with yours". This is finding 11, part of batch 6 in the audit's
  order; it needed no question of its own.
- **Builds on:** [ADR 0007](0007-jobs.md) (a job's calls take their names
  from the job and the phase), [ADR 0009](0009-crew-invites.md) (each person's
  own invite, one for each day of the phase) and
  [ADR 0023](0023-audit-round-two-the-loops.md) (a phase that moves asks
  "Move them" or "Keep their dates").
- **Changes:** ADR 0023's "Keep their dates leaves the calls where they
  were" now holds only while the phase still has their days.
- **Changed by:** [ADR 0169](0169-what-the-crew-offers-audit-left-at-2.md):
  a call across phases that holds a day no phase has says so on its card.

## Context

The calendar has a day for each day of a phase, and a person's own invite
is their copy of one of those days. A crew call's days were free: its
Change form had a From and a To with no check against its phase, and so
did the form that asks for crew. So a call could hold its crew for a day
its phase didn't have. In the audit, Ciara was booked on a Show call on
Sat 12 Dec; the call was moved to Sun 13 Dec while the Show stayed on the
12th. She was emailed a cancellation for the 12th, nothing for the 13th,
and stayed booked, for the 13th, with nothing in her calendar.

The same happened another way: moving a phase and pressing "Keep their
dates" left its calls on days the phase no longer had.

## Decision

1. **A call on a phase is for the phase's days, or some of them.** The
   server refuses a call asked for, or changed to, a day its phase doesn't
   have: "Show is Sat 12 Dec: crew on it are asked for that day." followed
   by the way on, "For another day, add a phase." when asking, and "To
   move the call, move the phase: its crew go with it." when changing it.
   Calls across several phases, and calls with no job, are as they were.
2. **The forms keep to it before the press.** On the job's Ask for crew
   form with a phase picked, and on a call's Change form, From and To are
   picked among the phase's days, and the rule is said under them. A day
   typed outside them is refused on its field in the app's words ("From
   can be Sat 12 Dec at the latest."), as a number out of its bounds
   already was.
3. **A phase that moves takes its crew where keeping their dates would
   leave them out.** The server refuses "Keep their dates" when it would
   leave a day of one of its calls outside the phase that was inside it:
   "Build would be Fri 9 Oct to Sat 10 Oct, leaving Audio tech on Thu 8
   Oct outside it: move its crew with it." The question before it says so
   and offers only Move them: "Its crew call moves with it, as Sat 12 Dec
   won't be one of its days." Keep their dates stays where the phase still
   has every day its calls hold.
4. **A call already outside its phase says so.** One left outside before
   this keeps its days until they're changed, and its other details can
   still change. Its card says what it costs, while the days are still to
   come: "Show is Sat 12 Dec, so nobody on the call has a calendar invite
   for Sun 13 Dec. Change the call's days or move the phase."

## What this sends

Nothing by itself: it refuses changes that would have sent a cancellation
with no invite to follow, and moves nobody's days.

## Considered

- **Ticking the phase's days** (the audit's first suggestion). A call's
  days are one run from its first to its last, so ticks could ask for a
  gap the call can't hold. From and To picked among the phase's days give
  the same choice for a run.
- **Inviting people for a call's day outside its phase.** Rejected: the
  day would be on nobody's jobs calendar and have no phase to name it, so
  the invite would be for a day the job doesn't have.
- **Fitting calls already outside their phase on deploy.** Rejected:
  cutting their days could un-book people, which the app never does
  quietly. Each one is said on its card for the office to settle.

## Consequences

- Crew wanted the day before a show are asked for on a phase for that day,
  such as a Build or a Load in, which also puts the day on the calendar.
- A call across several phases can still hold a day between two phases
  that no phase has, and nobody gets an invite for it. Left open: it needs
  a call's days to have gaps, which they can't.
