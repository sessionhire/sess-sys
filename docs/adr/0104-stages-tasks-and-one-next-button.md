# ADR 0104: Stages, the tasks inside them, and one Next button

- **Status:** accepted
- **Date:** 1 November 2026
- **Asked for by:** Colly ("The multistep flow (of the enquiry to quote, to
  quote confirmed, to crew booking, to logistics planning, pick lists, to
  preshow production, to build, show, break, logistics back, warehouse
  checking back in and deprep) doesn't feel like it is a consistent strong
  flow through the app", and "Can you investigate a nicer way to present the
  next step button? On mobile and desktop it seems inconsistent. That should
  be one of the most reliable buttons in the app", 1 November 2026). Colly
  chose option A first, then D, then B, from the research write-up.
- **Builds on:** [ADR 0073](0073-a-jobs-steps-and-who-has-each.md) (a job's
  steps and who has each), [ADR 0103](0103-how-a-job-moves-on.md) (the
  Confirmed step is the client's answer), [ADR 0082](0082-one-page-head-and-calmer-pages.md)
  (one page head).

## Context

The research and audit (the write-up "Job flow from enquiry to deprep",
1 November 2026, with its sources) found four things wrong with the eight
steps in a line:

1. **The line wasn't the company's process.** Colly's own list has twelve
   stations; the strip had eight, with no enquiry, no logistics and no
   production in it.
2. **A serial line over parallel work misreported.** Crew, kit and vans are
   planned together, in any order, but the strip named one step "the step
   the job is at", so "at Crew booked" was said of a job whose kit was the
   thing short.
3. **Where a job was lived in five records** (status, quote, calls, kit,
   scans) and only the job page put them together.
4. **The Next button moved about.** On a desk it sat at the far right of the
   Steps card's head; on a phone under the head above the dots; it vanished
   for the show itself and for roles that couldn't act; and its words changed
   shape ("Open Crew", "Make a quote", "Record the client's answer").

What the theory says, in short: Kanban (the Kanban Guide; Ahmad, Markkula and
Oivo's 2013 review) separates the *stages work flows through* from the
*items of work*, and asks that where an item is be visible and its age
known. Stage-gate (Cooper, 1990) puts a decision only where one is really
made. Checklists and task lists (Haynes et al., NEJM 2009; the GOV.UK task
list pattern) work because each line is a plain state and the lines are done
in any order. On buttons: Nielsen's "OK-Cancel or Cancel-OK" (consistency of
placement beats local optimisation), Apple's HIG and Shopify's Polaris (one
prominent action per view, in the page header, a verb and its object),
GOV.UK's button guidance (one main call to action, avoid disabled buttons),
Hoober's 2013 observation of one-handed phone use and Bergstrom-Lehtovirta
and Oulasvirta's 2014 thumb reach (the bottom of the screen is where the
thumb is).

## Decision

1. **Five stages, worked out from the records, never ticked:** Selling,
   Planning, Going out, On the job, Back. An enquiry or a quoted job is in
   Selling. Confirmed, it is in Planning until its kit starts going out (the
   first scan out) or its first day comes; Going out until its first day;
   On the job until its last; then Back until everything is in and
   deprepped, after which it is through. The one gate is the client's
   answer (ADR 0103): confirming the job is what moves it out of Selling.
   Cancelled and lost jobs are stopped as before; errands and meetings have
   no stages.
2. **The eight steps become the tasks inside the stages,** under the same
   stored keys (`job_steps.step`), so nothing given or ticked moves: Selling
   holds Quote sent and Confirmed; Planning holds Crew booked and Kit and
   vans settled; Going out holds Picked and loaded; On the job holds Out on
   the job; Back holds Back in and Checked and deprepped. Tasks are done in
   any order. A task left open when the job moves on is listed with the
   stage the job is in, under "Left open from before", so nothing is lost.
   What the app ticks for itself is as in ADR 0073, with three more "Not
   needed" cases once a job is under way with no kit: kit and vans, picking
   and back in on a crew-only job.
3. **A task can have a day it's due by** (`job_steps.due_on`, `dueOn` on
   `jobStep.set`), set by anyone who can change the task. A task past its
   day and still open is late, shown in the bad tone on the job page, on
   Home and in the Next line. Your tasks on Home sort the ones to do now
   first, then by due day, then by the job's first day. The deprep task says
   how many faults are open on the job's kit.
4. **The job page's card is "Where it is":** five named stages joined by a
   rule, at every width (the names stay on a phone, smaller), the stage the
   job is in ringed in ink; under it the open stage's tasks as rows in the
   task-list shape: a tick, the name, how it stands, whose it is and when
   it's due, and a plain tag (Done, Not needed, Next, To do, Late). A task
   opens below the list as before, with Due by beside Down to.
5. **One Next button, in one place** (`NextDock.tsx`), rendered by the job
   page into its page head: on a desk to the right of the title, on a phone
   docked above the bottom bar, full width with its words centred, staying
   put while the page scrolls (it steps aside with the bar when the keyboard
   is up). It is the only filled red on the page. A line over it says where
   the job is and how far: "Next · Planning · 5 of 10 booked · Cian · by
   Wed 4 Nov". Its label is a verb and its object, with the number when
   there is one: Make a quote, Finish the quote, Open the quote, Record the
   client's answer, Ask for crew, Book 5 more crew, Add the kit, Sort 1 short
   on the kit, Settle the kit and vans, Pick the kit, Scan the kit back, Tick
   off the deprep. A quiet second choice, Hand it to someone (Hand it on,
   once it has someone), opens the task. **It is never greyed and never
   gone:** when there is nothing for this person to press, the same place
   says why in plain words in a dashed box ("Nothing to press: on the job
   until Sun 8 Nov", "Next is quote sent, for the office. Nothing here for
   you to press", "All done: deprepped Mon 27 Oct").
6. **The task to do next** is the first open task in the stage the job is
   in that can be acted on, else one left open from before, else picking
   (which can start while the job is still being planned), else the show
   itself when it is on.

## Design

- One job of the view: where is this job, what is next, and whose turn is it.
- Behaviour: Default Effect (one filled button, one place, so the next thing
  is the thing pressed), Goal Gradient (the rule filling in across five
  stages), Loss Aversion kept honest (a task left behind is listed, not
  dropped), and the thumb zone on a phone.
- The system's parts: the infographic steps (`ds-info__steps`) as the
  stages, the current one in ink rather than the accent (red is "you"); a
  task list in the GOV.UK shape, which the system has no part for yet (a
  learning); the page head's actions slot is new to sess-sys.
- Departures: the dock is fixed on a phone, which the system's layout page
  does not cover for a page action; it follows the app's own precedent
  (the sticky "Bring in" on the import screens).
- Heuristic check: no 3s left open. A 2: a task's own tick ("Mark it done")
  is a plain button beside the dock's filled one, so two actions sit on the
  page while a task is open; the dock's is the next thing, the task's is
  the record.
- Learnings for the design system: a task-list part (rows with a plain
  state tag, done in any order); a rule for a page's one primary action
  (where it sits on a desk and a phone, and what it says when there is
  nothing to do); a stage strip that is worked out, not ticked.

## Consequences

- `job_steps` gains `due_on`; the export's words for the table say so.
  Jobs made one carry the due day.
- Part 2 (the stage line on the jobs list, Home and a person's page) and
  part 3 (Jobs › Board, a column per stage, read only) follow as their own
  changes.
- The stage names and the lack of a gate at the end of Planning are the
  write-up's assumptions, open for Colly to change; renaming a stage is one
  line in `shared/src/steps.ts`.

## Part 2, 1 November 2026

The stage line on list rows (`StageLine.tsx`): five segments and the stage's name with what is short in it, under the dates on every jobs-list row, and compact (segments and name) on Home's Today and week-ahead rows. Nothing on a stopped job, an errand or a meeting. A person's page keeps its rows as they are: they are calls, not jobs.
