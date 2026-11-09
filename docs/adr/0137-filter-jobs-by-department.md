# ADR 0137: Filter jobs by department

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly ("Can you add a filter to the jobs and calendars to
  filter by jobs that have different departments involved? So if there's no
  LX on it then they hide with the LX filter involved. Need for Audio,
  Lighting, Video, Lasers, Staging.", 9 November 2026)
- **Builds on:** [ADR 0046](0046-departments-on-calls-and-what-each-role-reads.md)
  (departments on calls), [ADR 0099](0099-filter-and-sort-on-long-lists.md) (list
  tools), [ADR 0123](0123-a-master-calendar-of-jobs-and-enquiries.md) (the
  master calendar), [ADR 0134](0134-open-current-rms-quotes-on-the-calendar.md)
  (Current RMS quotes on it).

## Context

The company sells its work in departments: audio, lighting, video, lasers and
staging. Someone planning lighting wants the jobs with lighting on them, and
the calendar, the planner and the Board showed every job. The app had two
lists of departments: the stock list's (audio, lighting, video, staging,
rigging, power, other), with no lasers, so laser kit was filed under
lighting; and crew's, typed freely (Audio, LX, Laser, Video…), with no
Staging. The Jobs list had a Crew department filter for heads of department,
one at a time, behind Filter.

## Decision

1. **Five departments, in a row of their own.** All departments, Audio,
   Lighting, Video, Lasers, Staging, as toggles under the view's own row on the
   Jobs list, Jobs › Calendar, the planner (job rows only) and the Board. One
   pressed shows the jobs involving it; several show the jobs involving any
   of them; All departments (pressed when none are) clears them. The Jobs list
   counts each one.
2. **A job involves a department** when one of its open crew calls is that
   department's (LX is Lighting, Laser is Lasers, LED Tech is Video, Backline
   is Audio), or, with no department on the call, its role's words say so
   ("Sound No.1" is Audio); or when a line of its kit is in that department's
   stock. Rigging, power, production and transport aren't in the row: Colly
   named five.
3. **Lasers get a stock department of their own**, between video and
   staging, so laser kit can be told from lighting. Products already filed
   under Lighting stay there until someone moves them on the product's page;
   nothing is moved for them. A head of the Laser department now sees lasers
   kit as theirs, not lighting. **Staging** joins crew's departments.
4. **One choice for every view, kept on this device** (`sh.jobDepartments`),
   so Lighting picked on the calendar still holds on the Board. The row is on
   every view it narrows, pressed, so nothing is hidden unseen, and each
   view's line under its heading or its empty words name the departments
   ("with Lighting or Lasers").
5. **Current RMS quotes are left out while a department is picked**, since
   what's on them isn't known here, and the calendar's key says so.
6. The old one-at-a-time filter stays behind Filter, renamed Crew department,
   for the departments the row doesn't have (Production, Transport…), and a
   head's list still opens on it.

## Consequences

- A job with no calls and no kit yet involves no department, so it hides
  whichever is picked: an enquiry with nothing on it shows under All
  departments.
- Laser products filed under Lighting before today show under Lighting until
  moved.
