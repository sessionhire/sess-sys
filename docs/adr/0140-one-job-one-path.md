# ADR 0140: One job, one path

- **Status:** accepted; all eight parts built (1.142.0 to 1.148.0)
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
   box with the rarer adds under More. (First half built, 1.143.0: the quote
   is the job's Quote tab, #jobs/<id>/quote and the old /money open it, and
   its own page has gone. With the tab open during Quoting, Next says what
   to do in words, so the quote's Build or Send is the page's one red,
   rather than a second red that only goes where the page already is.
   Second half, 1.144.0: "Client accepted: confirm the job" records the yes
   and confirms a job still being sold in one press, as the Confirmed task's
   Yes already did, saying first that it goes on the jobs calendar and holds
   the kit; a job already confirmed or stopped just takes the answer. The
   terms read as one line with Change, open while one needs putting right.
   Add kit (which finds packages) and Add crew stay in front; the rest is
   under More to add, all shown on an empty quote. One search box for kit
   and crew together was left for later: the kit picker already finds
   packages, and crew are a role and a count, not a product.)
5. Crew and kit steps that move their count on with each press. (Built,
   1.145.0: Next's crew press goes, in order, to the calls still to make from
   the quote; a yes to confirm, confirmed in the press and landed on its call
   ("Confirm Aoife's yes · 1 of 2 booked"); the first call with places nobody
   has been offered, its Offer open ("Offer the Rigger · 1 of 2 offered");
   someone asking another rate, on Crew's answers where the rate is in view;
   and, every place offered, words saying how many answers are out. "Sort 1
   short on the kit" opens the Kit card's Subhire with the short lines ticked
   and the first in focus. The quote's crew lines made from the job, named
   "Rigger (Load in)" and carrying the call's id, now count against that call,
   so they no longer read as "not asked for yet" beside it (finding 8). The
   count is in the button, as the pick list's "0 of 122 out" is, so a press is
   seen to move it.)
6. The pick list opens on the first thing to pick, its switches in one Show
   by; the stage said from what was scanned, not only the date. (Built,
   1.146.0: a confirmed job on its days with kit to pick and none scanned out
   is in Going out, not On the job, and the pick list's dock says "Due out
   today · 0 of 6 out". Whose kit and the order are one Show choice, a select
   so it takes one line on a phone, each department saying how much is left;
   Going out or Coming back is drawn only once something has gone out.
   Opened partway through, the list glides to the first row still to pick,
   to the middle of the screen so the docked scan box doesn't cover it; a
   list not started opens at its top, where Before you start is. Next's
   "Pick the kit" carries the count, as the dock does.)
7. New quote as a sheet of its own, client first with their last jobs to
   start from. (Built, 1.147.0: a page of its own at #quotes/new, under
   Quotes, rather than a form opened inside To follow up. The client field
   comes first, with the cursor in it, and the past jobs and Current RMS
   quotes to start from straight under it; picking one fills the job's name
   and venue while they're empty. Then the name, venue and days, and Start.
   Who asked, how it came, the day it's wanted by and the kind of job fold
   under "More about the enquiry", opened by itself when Claude read any of
   them from an enquiry. A page rather than an overlay sheet: on a phone the
   two look the same, and a page keeps the address, Back and the shortcut
   working as they did.)
8. The job's tabs in stage order, opening on the stage the job is in.
   (Built, 1.148.0: Quote, Crew, Kit and vans, Phases, Show pack. With no
   part named in the address and no task opened, the job opens on the part
   its next task is in: the quote while selling, crew or kit while planning,
   kit (where the pick list's link is) while going out and back, phases
   while on. A job with no task left, or with no stages, opens on the part
   last looked at, as it did, so moving from job to job on one part still
   works there. 1.168.0, Colly's ask: Kit and vans became two tabs, Kit
   and Vans, after Kit, so the vans aren't under a long kit list on a
   phone; the "kit list final?" tick and its task stay with Kit, and the
   planner's van clashes open Vans. 1.171.1: the Vans tab is called
   Transport, Colly's word; its address stays `…/vans`.)

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
