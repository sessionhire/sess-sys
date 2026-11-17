# ADR 0164: Ask for the same crew again

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who answered the seven
  questions of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  with "Go with yours". This is finding 19, part of batch 6 in the audit's
  order; it needed no question of its own.
- **Builds on:** [ADR 0007](0007-jobs.md) (stopping a
  job takes its crew calls with it), [ADR 0140](0140-one-job-one-path.md)
  (Next does what the card says, and lands where the work is) and
  [ADR 0162](0162-undo-just-after-offer.md) (nothing goes for half a minute
  after Offer).
- **Changes:** "Starting a job again doesn't bring its crew back" stays true
  of the press that starts it; one more press now does.

## Context

Marking a job cancelled or lost cancels its crew calls, and the question
before it says who will see that. Setting it back to Confirmed left the
calls cancelled, by design, as nobody should be offered a job again without
the office choosing to. But nothing then said what had gone or who had been
on it: the Crew tab showed "2 × Audio tech · Cancelled" and "No crew asked
for yet", and the office had to find the same people again by hand, one
call at a time, from memory. A client cancelling and coming back a day
later is ordinary; the crew they'd lined up are usually the crew they want.

## Decision

1. **A call cancelled along with its job is marked with the day.** Stopping
   a job writes `stopped_on` on each of its open calls and on each offer
   still open or booked on them. A call the office cancelled on its own, or
   an offer withdrawn, declined or filled before, isn't marked: those were
   choices, and stay as they are.
2. **Once the job is going again, its Crew tab says so first.** A card,
   "Cancelled with the job", says what was cancelled, when and who was on
   it: "Its crew call was cancelled with the job on Thu 12 Nov: 2 × Rigger.
   Colm and Fergal were offered it or booked." Then what asking again does:
   "It comes back with nobody offered, and its Offer has the same people
   picked, ready to send. Nothing goes to anyone until you press Offer."
   It's the latest stop's calls whose days haven't all passed, and only
   while the job has asked for no crew since; once a call is open, the
   office has gone its own way and the card goes.
3. **One press asks for the same crew again, from Next or the card.** The
   job's Next button says "Ask for the same crew again" and does what the
   card's button does: each call comes back open (`call.reopen`), with its
   days, time, rate and notes as they were, and nobody on it; its Offer
   opens on the first call with the same people picked, and the other
   calls' Offer has theirs when opened. Nothing is sent by the press. The
   office presses Offer as for any offer, which waits half a minute for
   Undo before anything goes.
4. **The old offers stay as they ended,** each row on the call reading
   "Cancelled with the job" rather than "Withdrawn by the office", which
   nobody did, so the office sees who was on it beside who is asked now.
   The new offers are new: a fresh invite, a fresh answer. A person's page
   in the app is unchanged: while the job is stopped, a booking on it says
   "Job cancelled" or "Job lost" beside its state, as before.
5. **The server keeps the rule.** It refuses `call.reopen` for a job still
   cancelled or lost ("Harbour Lights is still cancelled: set it going
   again first."), for a call cancelled on its own ("…was cancelled on its
   own, so it stays cancelled. Ask for crew afresh.") and for a call whose
   days have all passed. Pressed twice, or from a second device, it's done
   once.
6. **A stopped call goes with its phase.** While the job is stopped nobody
   is on its cancelled calls, so a phase that moves takes them along
   whether or not "move the crew" was asked, and they come back on the
   phase's days as they are then.

## What this sends

Nothing. Bringing calls back sends nothing to anyone; only Offer does, as
before. Stopping a job sends what it sent before.

## Considered

- **Making the calls again,** as the audit put it. Rejected: bringing the
  same calls back keeps their days, call time, rate, notes and department
  without asking for them again, and keeps their old rows beside the new
  offers, so the office sees who was on each.
- **Bringing the crew back with the job, as offers.** Rejected: it would
  send invites and WhatsApps to people who'd been told the job was off,
  with no chance to see who first. Picked, not offered, they're one press
  from it.
- **A card that stays until the days pass.** Rejected: once the office has
  asked for crew its own way, a second way to bring the old calls back
  would make two calls for one role.

## Consequences

- Calls and offers cancelled before this have no day marked, so a job
  stopped before deploying has no card; its calls can be asked for afresh
  as before.
- Each call keeps the latest stop's day only; a job stopped twice asks for
  the second stop's crew.
- The person's own page is unchanged: the old booking says the job was
  cancelled, or "Withdrawn by the office" once the job is going again, and
  the new offer is a new card waiting on them.
