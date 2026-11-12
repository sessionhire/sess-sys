# ADR 0165: Your own offers said to you, and waiting on you on every Home view

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who answered the seven
  questions of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  with "Go with yours". This is finding 17, the last part of batch 6 in the
  audit's order; it needed no question of its own.
- **Builds on:** [ADR 0058](0058-notifications.md) (notifications, read
  from the history), [ADR 0033](0033-home-and-finding-your-way-around.md) (Home
  for whoever is looking), [ADR 0073](0073-a-jobs-steps-and-who-has-each.md) (your tasks on
  top of whichever view), [ADR 0111](0111-staff-answer-offers-in-the-app.md)
  (staff answer an offer on its job) and
  [ADR 0150](0150-hold-means-hold-the-day.md) (Hold the day).
- **Changes:** ADR 0058's list says what follows an offer to its person, not
  only the offer itself; ADR 0033's Home shows an offer waiting on you on
  every view, not only on Me.

## Context

A member of staff who books crew, in the office or heading a department,
can be offered work too. Their Home opens on Company or Department, where
nothing said an offer was waiting on them: it was under Me ("1 offer to
answer") and in the bell. In the bell the offer itself was said to them,
"You've been offered Audio tech on Castle Yard Sessions" (UX sweep of 6
November 2026, move 6), but what followed was the history's words, which
name them as anyone else would: "Confirmed Dara Kelly for Audio tech on
Castle Yard Sessions", "Withdrew the offer of Audio tech on Riverside
Sessions to Dara Kelly". Only one later change was said to them: someone
else's yes that closed their offer (#316, 1.152.1).

## Decision

1. **What others do to your own offer is said to you, first**, with the
   history's words under it, as #316 did. One table of sentences
   (`offerNews` in `shared/src/words.ts`), worked out on the server from
   the log (`offerNewsFor` in `server/src/notices.ts`):
   - booked: "You're booked as Audio tech on Castle Yard Sessions", with
     ", at the rate you asked for" when the office agreed their rate;
   - picked on a job the client hasn't said yes to: "Hold the day: you're
     down as Audio tech on …" (ADR 0150), and when the client does, "Castle
     Yard Sessions is confirmed, so you're booked as Audio tech";
   - a rate not agreed: "Your rate for … wasn't agreed, so the offer stands
     at the rate offered";
   - withdrawn: "Your offer of … was withdrawn", "You're no longer booked
     as …" or "You no longer need to hold the day for …", by where they
     stood;
   - their call cancelled: "… was cancelled, so your offer is closed", or
     "so you're no longer booked", or "so you no longer need to hold the
     day";
   - their job stopped: "Castle Yard Sessions was cancelled, so you're no
     longer booked as Audio tech", "… didn't go ahead, so your offer of
     Audio tech is closed";
   - someone else's yes: "… went to Dara Kelly, so your offer is closed",
     as before.

   Each is read as things stood at that change: where they stood before
   it and the job's status before it, so an old row still says what
   happened then, not what is so now. One change that ends several of
   their offers, a job stopped with two of their calls on it, says the one
   that mattered most: booked, then holding the day, then asked.
2. **An offer to you is said to you inside a folded line too**, where
   several changes at once are one line, and opens your own page as its
   own line does.
3. **"Offers waiting on you" on top of Home's Company, Department and
   Warehouse views**, as your tasks are (ADR 0073), under the name your own
   page gives the list. The same rows as Me's, soonest first, each opening
   its job, whose "You on this job" answers it (ADR 0111), or your page for
   someone who answers there. Me keeps them in Your bookings, so they
   aren't said twice. Nothing while there are none.

## What this sends

Nothing. Notifications are in the app only, as they always were (ADR
0058).

## Considered

- **Leaving the history's words out from under these,** as they name the
  reader again. Rejected for now: #316 put them under, and the list is the
  history narrowed to what's yours, so a row keeps its record. An offer
  made to you keeps move 6's form, said with nothing under it.
- **A count on the views' tiles** ("1 offer to answer") rather than rows.
  Rejected: a row says which job and when, and answers in one press.
- **Telling everyone on a job that it's confirmed.** Rejected: only those
  holding the day are booked by it; someone only asked isn't, so nothing
  more is said to them.

## Consequences

- The sentences are the server's, but for an offer made to you, which the
  app says as before, as it knows where it's answered.
- A row about a job is yours while you're on the job (ADR 0058): once your
  place ends, "… is confirmed, so you're booked" goes from the list with
  the job's other rows. The rows about your offer itself stay.
- A change to the call's days, time or rate keeps the history's words,
  which name the call, not you.
