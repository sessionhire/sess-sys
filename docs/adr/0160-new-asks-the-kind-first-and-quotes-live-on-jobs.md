# ADR 0160: New asks the kind first, and quotes live on their jobs

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026: "Can we simplify the New Job
  flow", in six parts: "+ New" on the button, as a job can be a gig, an
  errand or a meeting; "get rid of the quotes screen as quotes are
  generated within the context of a Job, and the quote is just a status of
  it"; the jobs list's headings sort ascending and descending; an assignee
  on the list; "Where it stands" said as "Status"; and the New job form
  asking the kind first, with the questions after it changing to suit.
- **Builds on:** [ADR 0037](0037-job-kinds-and-days-gone-as-history.md)
  (a job's kind), [ADR 0088](0088-quotes-in-the-sidebar.md) (Quotes as a place),
  [ADR 0099](0099-filter-and-sort-on-long-lists.md) (filter and sort),
  [ADR 0140](0140-one-job-one-path.md) (the quote is the job's Quote tab),
  [ADR 0141](0141-a-list-page-tells-its-story-in-order.md) (the add on the title's line) and
  [ADR 0144](0144-who-has-a-stage-on-the-board.md) (who has a job's stage).
- **Changes:** ADR 0088: Quotes is no longer a place. Its addresses still
  work.

## Decision

- **The add on Jobs says "New"**, with the plus, on every view of the jobs.
  What it adds is chosen first in the form.
- **The form asks what kind it is first** (Gig, Dry hire, Errand, Meeting,
  each with a line on what it means), then only what that kind needs:
  - *Gig:* name, client, venue, status, and its phases with their days, as
    before.
  - *Dry hire:* name, client, status, and the day the kit goes out and the
    day it comes back, saved as one Hire phase. No venue: the client takes it.
  - *Errand:* what it is, the day, where to, and a note for whoever goes. No
    client and no status: it's going ahead, so it's added confirmed, and the
    form says it goes on the jobs calendar.
  - *Meeting:* what it is, the day, who with (a client), where, and a note.
    Added confirmed, as an errand is.

  What's typed is kept when the kind changes. The button says what it adds:
  Add gig, Add dry hire, Add errand, Add meeting.
- **Quotes isn't a page of its own.** It leaves the sidebar, the Menu and the
  places search offers. Each quote is still its job's Quote tab. Jobs finds
  jobs by their quote under Filter › Quote (Not sent, Sent, Accepted, Turned
  down, No quote yet), for whoever reads the money. What was Quotes' first
  view, To follow up, is a part of Money (#jobs/money/follow-up), with New
  quote on Money's title line. Home's quote counts land there. #quotes and
  its views go on there (or to Jobs for a role without money), and
  #quotes/new is still New quote, under Jobs' tab. A start screen of Quotes
  becomes To follow up. G then Q goes to To follow up. The quotes from
  Current RMS stay on Money › Past quotes.
- **The table's heads all sort**, one way on the first press, the other way
  on the second (Job, When, Client, Venue, Status, Assignee, Crew). The way
  round is kept with the sort on the device, as "name:desc". The Sort select
  offers the new orders too and always picks the first way round.
- **Assignee** is a column: whoever has the stage the job is in, as its
  Board card says (ADR 0144), "Split" when it's shared, "Nobody yet" when
  nobody has it, and blank for errands, meetings and jobs through.
- **"Where it stands" and "Where it is" are "Status"**: the table's column
  and the stage card on a job's page.

## Consequences

- The Quotes list's own views (Sent, Accepted and the rest, with the last
  word on each quote) and its Current RMS rows are gone. Jobs' Quote filter
  and Money › Past quotes cover them.
- A job's page now has "Status" twice in different senses: the stage card,
  and Change details › Status (enquiry, confirmed…). Worth watching.
