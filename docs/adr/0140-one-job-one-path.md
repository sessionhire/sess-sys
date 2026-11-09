# ADR 0140: One job, one path

- **Status:** accepted; parts 1 to 3 built (1.142.0 to 1.142.2), parts 4 to 8 to follow
- **Date:** 9 November 2026
- **Asked for by:** Colly, after walking the quote flow and on through crewing
  and the pick list: "very confusing to go through the steps and particularly
  when moving between steps", "lots of options but unclear as to what was
  next and the visibility of what was happening was hard to discern"
  (9 November 2026). Colly chose this approach over tidying each page in
  place.
- **Builds on:** [ADR 0104](0104-stages-tasks-and-one-next-button.md) (the Next button),
  [ADR 0126](0126-the-quote-is-the-job-s-plan.md) (crew on the quote made calls
  in one press), [ADR 0131](0131-colour-on-the-stage-line.md) (the five stages).

## Context

A walk of the whole journey as the office, on a phone and a desk, found ten
places where it loses the thread (the proposal, with screens:
https://claude.ai/artifact/D9cXTUpDZPSoMBz5RoNzDP). The cause under most of
them is that a job has two homes. The quote is a page with its own ending: no
Next, no stage, and once the job is confirmed its one red press is Mark
invoiced, weeks away. The job page says where the job stands four times, and
several of its Next presses only change the tab, leaving the real button,
plain, further down: "Make the calls from the quote" opened Crew, where "Make
the call" was; "Book 5 more crew" opened four Offer buttons across three
phases; "Settle the kit and vans" opened a tab with nothing that settled them.

## Decision

The job page becomes the one path through a job: the stage it's in and its
Next at the top, said once; the stage's own work beneath it; the quote as the
Quoting stage's work. Every Next press does what it says, or opens the exact
thing to do, already open. Rarer controls fold behind More; nothing is
removed. Built in eight parts, one pull request each:

1. **Next does what it says.** (Built, 1.142.0.)
   - "Make the call for 2 × Audio tech" (or "Make the 3 crew calls from the
     quote") makes them, then lands on Crew showing them. The Crew card's own
     button and Next share one function (`makeCallsFromQuote`).
   - "Book 3 more crew" lands on the first call with a place to fill, its
     Offer open with the cursor in it. A `Fold` takes an `opened` count, so
     a second press opens it again.
   - "Settle the kit and vans" lands on a card at the top of Kit and vans,
     "Is the kit list final?", with the tick that settles it, while the task
     is open on a confirmed job with kit and nothing short. Short kit is
     sorted first, on the Kit card under it, as before.
   - The quote page shows the job's own Next once the job is past Quoting,
     so it no longer ends there. While it does, the invoice and payment
     records, sending and printing are plain: the job's next step holds the
     page's one red.
2. Send never disappears from the quote: it stays in the figures strip and
   says what stops it ("1 line to finish"), taking you there. (Built, 1.142.1.)
3. The job's head says where it stands once: the stage line and Next; Where
   it is folds to its stepper, its tasks a tap away. (Built, 1.142.2: on a
   confirmed job Next's line says only Next; the tasks fold under "N tasks to
   do in <stage>", opened by it, a stage, or a task from Next or Home; the
   invoice row stays folded until it's invoiced or due. The crew and kit
   facts stay in the head: they hold a department's own count and the pick
   list link, which the stage line doesn't.)
4. The quote as the Quoting stage on the job page (its address still works);
   accept and confirm in one press; terms in one line with Change; one Add
   box with the rarer adds under More.
5. Crew and kit steps that move their count on with each press.
6. The pick list opens on the first thing to pick, its switches in one Show
   by; the stage said from what was scanned, not only the date.
7. New quote as a sheet of its own, client first with their last jobs to
   start from.
8. The job's tabs in stage order, opening on the stage the job is in.

Assumed until Colly says otherwise: the client's yes is the moment the job is
confirmed; crew may be pencilled before the yes, so Crew shows in Quoting,
not lit; the warehouse picks, starting from the pick list; invoicing stays
out of the path while it's paused.

## Consequences

- A press of Next on the job page now changes the job (makes calls) where it
  used to only move. It is a change that can be undone (each call can be
  cancelled) and it contacts nobody: a call is made with nobody offered.
- The quote page's red after confirming is the job's Next, not Mark invoiced.
- A step-by-step wizard was considered and rejected: jobs don't run in a
  straight line, and a wizard punishes going back.
