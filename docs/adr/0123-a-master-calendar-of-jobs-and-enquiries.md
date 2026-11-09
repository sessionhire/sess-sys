# ADR 0123: A master calendar of jobs and enquiries

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026: "Can you add a calendar view that
  shows jobs and potential jobs/enquiries all together as a master view?"
- **Builds on:** [ADR 0010](0010-planner.md) (the planner, which already draws
  enquiries and quotes dashed), [ADR 0104](0104-stages-tasks-and-one-next-button.md)
  (Quoting as the first stage), [ADR 0042](0042-quotes-prices-and-a-money-view.md) (who is sent money).

## Context

The planner's Week and Month lay jobs out a row each, a timeline: good for
crew and clashes, but it isn't a calendar. Nowhere showed a month the way
the office thinks of one, a box a day, with what's confirmed and what might
come in side by side, so that "can we take this enquiry on the 14th?" is
answered by a look. Google Calendar has only the confirmed jobs (ADR 0008:
enquiries and quotes stay off it), and the app must not write to it anyway.

## Decision

1. **Jobs › Calendar** (`#jobs/calendar/<first of month>`), between Board and
   Week in the Jobs row. A month, Monday to Sunday, every job still going
   ahead on each of its phases' days, cancelled and lost ones left out.
2. **Confirmed solid, potential dashed**, the planner's grammar, with the
   words on it too ("Enquiry", "Quoted"), so it never rests on the line alone.
   For those sent money (ADR 0042), a quoted job also says where its newest
   quote stands ("quote sent", "quote not sent"); never an amount. No colour
   of its own: healthy is quiet.
3. **Everything, Confirmed or Potential**, a toggle kept in the address
   (`/confirmed`, `/potential`) so a shared link opens the same view.
4. **Jobs with no dates yet** are listed under the month, so an enquiry isn't
   lost for not having days.
5. **A day opens its week on the planner; a job, its page.** The calendar reads
   only, and is worked out on the device from the jobs it holds, like the
   planner: no server change, nothing written to Google.
6. **On a phone, a list**: only this month's days with something on, and
   today, one under another, adding to the page's height (no box that scrolls
   inside the page). From 900px across, the grid, growing with what's on.

## Considered

- **Making the planner's Month the calendar.** It is a timeline by job, which
  crew booking needs; changing it would lose that.
- **Adding enquiries to Google Calendar.** ADR 0008 keeps them off, the real
  calendar has real jobs only, and the app must not write to it.
- **Enquiries read from the mailbox by Claude (ADR 0098) that aren't jobs
  yet.** They have no dates of their own until made into a job; once made,
  they show.

## Consequences

- Office and directors see how full a month is and could get, at a glance.
- Everyone who sees Jobs sees the calendar; only money roles see quote states.

## Later: drawn like Google Calendar (9 November 2026, 1.132.1)

Colly asked for it to "look a bit more like google calendar", with smaller
type and shows drawn joined over their days. The month is now a row a week:
each job is one bar across its run of days in that week, square-ended where
it carries on into the next, laid out in lines so bars never overlap
(confirmed first, then the earliest, then the longest: `weekBars`). Day
numbers are small and centred, "1 Mar" on a month's first, and today's is in
a filled accent circle (now is the accent, as on the system's charts).
Confirmed bars are filled in ink and potential ones a dashed ink outline, so
the solid and dashed grammar holds. Today, back and next sit at the top as
Google has them. On a phone it is Google's schedule: the weekday and date on
the left, today circled, the jobs to the right, still in the page.
