# ADR 0109: Next and the stages tell the truth

- **Status:** accepted
- **Date:** 5 November 2026
- **Asked for by:** Colly, 5 November 2026 ("Start with batch 1"), batch 1
  of the [5 November audit](../audit-ux-2026-11-05.md#the-order-to-fix-things):
  findings 1, 2, 3, 4, 16, 18, 19, 22 and 25.
- **Builds on:** [ADR 0073](0073-a-jobs-steps-and-who-has-each.md) (the
  tasks and who has each), [ADR 0103](0103-how-a-job-moves-on.md) (the
  client's answer is the job's own), [ADR 0104](0104-stages-tasks-and-one-next-button.md)
  (five stages and one Next button), [ADR 0034](0034-roles-and-what-each-can-change.md)
  (a button a role can't use isn't offered).

## Context

ADR 0104 gave every job five stages worked out from its own records and
one Next button, meant to be "one of the most reliable buttons in the
app". The audit found that what feeds them still disagrees with itself,
and that Next sometimes does its work out of sight:

- On a phone, Next switched a tab about 1,000 px below the dock, so
  nothing seemed to happen (finding 1).
- Staff crew were offered Book crew, Sort the kit, Pick the kit and Scan
  it back, which their role can't do (finding 2).
- A past job nobody ticked as deprepped stayed in Back for good. That was
  about 108 jobs on the audit's copy and would be 300 or more on live,
  where most jobs came in from the calendars before the stages existed
  (finding 3).
- A show whose kit was never scanned said "Back in: not needed" next to
  "Picked 0 of 14" (finding 4).
- Kit and vans settled was only ever ticked by hand, so every job past
  Planning carried it as "left open from before" (finding 22).
- After the client's yes, Next still said "Record the client's answer"
  (finding 25). While the answer was open, the card and the dock both had
  a filled red button (finding 19).
- On a new enquiry, Next's first press opened a quote page that said to
  add kit and crew first (finding 16).
- Enquiries and quotes whose dates had passed still said "Waiting on the
  client" and sat at the top of Selling and To follow up (finding 18).

## Decision

**Next does what it says, where it can be seen, for who can do it.**

- When Next or a task's Open picks a part of the job, the tab row comes to
  the top under the bar and the focus goes to the tab. A tab picked from
  the row itself is already in view, so it doesn't move.
- Each task asks for the ability its work needs:
  - crew needs `crew`;
  - kit needs `kit`;
  - picking and scanning back need `stock`;
  - adding the kit needs `kit`.

  Anyone else gets the existing line saying whose the task is.
- Once the current quote is accepted, the Confirmed task's button is
  **Confirm the job**, and it confirms in one press. Before that it is
  still "Record the client's answer".
- The Confirmed card's own buttons are plain, so the dock keeps the page's
  one filled red.
- On an enquiry with no quote, no kit and no crew, Next is **Add the kit to
  quote**, which opens Kit and vans. The quote page's empty state links to
  Kit and vans and to Crew.

**The stages read the records more honestly.**

- **Kit and vans settled ticks itself** once the job is under way with
  nothing short, with the words "Settled: the kit went out", "the job is
  under way" or "the job is over". While the job is in Planning, it is
  still ticked by hand, as ADR 0073 had it. A job with kit short keeps it
  open.
- **Kit on the pick list that was never scanned** is no longer "Nothing
  went out". Back in stays open with "N never scanned out: check they're
  back". Only a job with no kit to pick is "Not needed".
- **A job is taken as through a fortnight after its last day**
  (`SETTLED_AFTER_DAYS`, 14) if nothing is still out and no fault is open.
  Its open tasks after Selling count as done by the app: "Taken as done: it
  ended … with nothing still out". A tick given by hand still shows as
  given. Back then holds only the jobs with something to sort (kit still
  out, a fault open, or a show in the last fortnight). The Board's Through
  column shows these jobs as "Through: nothing still out".
- **A stage passed with a task still open** draws its tick hollow on the
  strip, and a screen reader hears "passed with N left open". A finished
  stage keeps its filled tick.

**A sale whose dates passed asks what happened.**

- A job still an enquiry or quoted after its last day is *lapsed*
  (`JobSteps.lapsed`). Its Confirmed task's hint is "Its dates have passed
  with no answer". That is the task Next goes to, labelled **Record what
  happened**, which opens the client's answer (yes, or no and lost).
- On the Board, lapsed jobs leave Selling's main list for a fold under it,
  **Dates passed, no answer (n)**. Each card there reads "Dates passed, no
  answer: mark it lost?" in the bad tone.
- Home's company view counts them as housekeeping: "jobs whose dates
  passed with no answer". The count opens the Board with the fold open.
  It needs the `jobs` ability.
- On Quotes › To follow up, a sent quote whose job's dates have passed
  moves out of "Waiting for an answer" into **Dates passed with no
  answer**, with Mark the job lost beside it. It is no longer counted as a
  call to make in Notifications.

## Consequences

- On live, the first open after this ships moves hundreds of imported past
  jobs from Back to through. No records change: it is read afresh on each
  device, as ADR 0104's stages are, so the change can be undone by
  changing the rule.
- A job that went out unscanned is through a fortnight after it ended,
  unless the warehouse finds something missing and reports it. The
  fortnight is the window for checking. A fault reported against the job
  keeps it in Back.
- Kit and vans settled is ticked by hand only while a job is being
  planned. A tick already given stays.
- A job's lapsed state goes when the job is confirmed or lost, or when its
  dates move into the future.

## The heuristic check

- **1, visibility of status:** fixed for Next on a phone, and for the
  strip on past jobs.
- **2, match with the real world:** fixed for past sales, unscanned kit
  and past jobs.
- **4, consistency:** the job page, the Board, the stage line, Home and
  Quotes read one record.
- **5, error prevention:** fixed for staff crew pressing what they can't
  do.
- **8, healthy is quiet:** Back and "Left open from before" mean something
  again.

None is left at 3.
