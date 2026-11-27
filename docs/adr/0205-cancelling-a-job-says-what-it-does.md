# ADR 0205: Cancelling a job says what it does

- **Status:** accepted
- **Date:** 27 November 2026
- **Asked for by:** Colly, 27 November 2026, with a screenshot of the form: "This UI for cancelling a gig can be improved
  a lot. Can you have a look at this too?"
- **Amends:** [ADR 0149](0149-the-office-is-told-what-the-app-sent.md), decision 7, for Cancel this job on a job's own
  page: there is no question after the press, as the form says before it everything the question did. The other places
  a job is marked cancelled or lost keep their question.
- **Builds on:** [ADR 0149](0149-the-office-is-told-what-the-app-sent.md) (what a press sends crew by itself is said
  before it and after it), [ADR 0164](0164-ask-for-the-same-crew-again.md) (a job taken up again offers its crew calls
  back) and [ADR 0162](0162-undo-just-after-offer.md) (nothing goes for half a minute after Offer).

## Context

"Cancel this job…" came out of the user flows of 13 November (finding 6): a button beside Change details that opened
a small form in the same row, with two radio buttons, "Why, in a line", Mark cancelled and Keep the job. Pressing Mark
cancelled then asked the question of ADR 0149: "Marking Harbour Lights cancelled also cancels its crew calls: 4 people
offered or booked will see the job was cancelled", with Yes and No.

Colly's screenshot, and a walk through it on a phone and at a desk, found:

- **It had the width of a button.** Drawn in the buttons' row, each radio button sat centred above its own words, the
  example in the reason box was cut off ("Optional: kept in the office not"), and the box opened holding the focus,
  whose ring is the brand red, so an empty optional box read as a mistake.
- **The buttons read backwards.** The press that stops a gig was a plain button; the way out, Keep the job, was red.
- **It said what the press does only after the press, and then only about crew.** Stopping a job also frees its kit and
  vehicles for other jobs, takes its days off the jobs calendar and sets its quote aside. It doesn't bring kit home
  that's already out, and it tells a supplier nothing about kit hired in. None of that was said anywhere.
- **Two steps with two looks**, and the reason typed before knowing what the press would set off.

Stopping a job is one of the few presses here that reaches people outside the office and can't be fully taken back:
Google emails each person a cancellation at once. It is also rare, done on a bad day, and often on a phone.

## Decision

1. **A card of its own, in the page.** "Cancel this job…" opens it where the details' buttons were, as wide as the
   details. It is headed "Cancel this job" with the job's name and dates under it, as on a phone the job's own head has
   scrolled off by then. The form takes the focus at its heading, so it's read from the top.
2. **What happened is two choices, each with a line of what it is**, under the status's own word: "Cancelled. It was
   called off." and "Lost. The client said no or went elsewhere." It opens on Cancelled for a confirmed job and on Lost
   for one the client hasn't said yes to, as that is the likelier of the two. An errand or a meeting is only ever
   cancelled, so it isn't asked.
3. **Why is optional, and says where its words go before any are typed.** Its label sits outside the box ("Why
   (optional)"), the box holds an example that follows the choice ("e.g. The venue double-booked", "e.g. Went with a
   cheaper PA"), and under it: "Kept at the top of the office notes: only in the app, for the office." It is kept as
   before, as the first line of the office notes: "Cancelled Fri 27 Nov: The venue double-booked".
4. **"What this does" lists what the press changes, a line for each part of the job, worked out from the job as it
   stands and only where it applies** (`shared/src/stop-job.ts`; `stopFacts` in `web/src/jobs/jobStatus.ts`):
   - **Crew:** how many calls are cancelled; who will see it, by name (the first five "and 12 more" once there are
     more than six), in their link's own words; and what Google emails them and WhatsApp tells them, by the same
     reading of the server's rule as ADR 0149's decision 1. With every way out off it says the app sends them nothing
     and their links say so. With nobody on the calls it says nobody is told.
   - **Kit:** how many of our own items are free for other jobs again (or no longer pencilled in, for a job that held
     nothing); how many are already out and still need checking back in; and how many are hired in and from whom, which
     the app doesn't tell the supplier about, so the office cancels those.
   - **Transport:** the vehicles free for other jobs again.
   - **Calendar:** how many days come off which calendar; or, for a job brought in from Google Calendar, that it stays
     there, as the app doesn't change the calendar a job came from ([ADR 0011](0011-calendar-import.md)).
   - **Quote:** that it's set aside and counts in no totals unless it's invoiced; or that, invoiced, it still counts.

   A line is amber where it leaves the app or leaves the office something to do: people who'll see it, kit still out,
   kit to cancel with a supplier. The rest are plain, as they're only how things will stand. A job with none of these
   says so: "Only its status changes: nobody is told, and no kit or transport is held for it." Each line uses the words
   its own tab uses ("free for other jobs", "hired in", "set aside"), and the list follows the choice as it's changed.
5. **Under the list, the way back and the one thing that has none:** "It can be taken up again under Change details,
   and its crew calls brought back with the same people picked, ready to ask again. What they've already been told
   can't be taken back."
6. **One press does it, and the press is named for what it does.** "Cancel the job" or "Mark lost" takes the bad fill;
   "Keep the job" beside it is a plain button. There is no second question: the form has said all the question did and
   more, before the press and not after it, and a question asked on every press is soon answered without being read.
   What guards the press instead: Enter in the Why box does nothing, so only the button itself stops a job; the form
   doesn't open with the focus on a button; and the list is the button's description, so a screen reader says what the
   press does as the focus reaches it.
7. **After it, as before.** Where anyone was on the job, "Crew calls cancelled: what was sent" opens under the details
   and takes the focus (ADR 0149, decision 6); otherwise the focus goes to Change details. Keep the job closes the form
   and gives the focus back to "Cancel this job…". A job stopped from somewhere else while the form is open closes it.
8. **One column on a phone**, with the two buttons the card's width, one above the other, and the page scrolling as
   one. The two choices sit side by side where there's room for them, and at a desk what's asked sits beside what it
   does, with the buttons under both.

## Considered

- **A dialog over the page**, which is where a press that does several things is usually asked about, with the safe
  answer holding the focus. Rejected for this one: it has a box to type in and a list that follows the choice, and on a
  phone it is taller than the screen, which in a dialog is a scroll inside the page's own. In the page, the job's facts
  stay in sight above it, and it is where the app's other forms open.
- **Keeping the question after the press.** It would say again what the form has just said, a second later.
- **Typing the job's name to confirm.** Too much for something that can be taken up again in two presses, and worst on
  a phone.
- **Holding what's sent for half a minute with Undo,** as Offer does (ADR 0162). This is the right next step and is
  not here: it changes when the server takes people off a calendar that is live, so it wants a decision of its own.
- **Escape closing the form.** No form in the page does that today, and one that did would be a rule of its own.
- **The same list at the other doors:** Change details › Status, the client's answer (on the Confirmed task, on Next
  and on the quote), and the quotes to follow up. There the status is one field among many or one press on a row of a
  list, with no form to say it in. They keep ADR 0149's question, which speaks of crew only.

## Consequences

- Nothing about what stopping a job does has changed: the same change is made, and the server cancels the calls, takes
  the days off the calendar and queues what's sent exactly as before. Only what the office is told, and when, is new.
- What the list says is read off the device's own view by the rules its screens already go by, so the form and the
  tabs can't disagree. What the device can't know (a calendar write that fails, say) is still said by the panel after.
- Open, and the one thing rated serious when this was checked: what's sent goes at once and can't be recalled. The
  form says so; it doesn't change it. See the hold with Undo above.
- The other doors say less than this one does. If the list proves its worth here, they are next.
