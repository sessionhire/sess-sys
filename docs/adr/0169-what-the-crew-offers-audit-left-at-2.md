# ADR 0169: What the audit of crew offers left at 2

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026: "Finish the audits work",
  after the batches of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  were built. These are the three problems their heuristic checks rated 2
  and left open.
- **Builds on:** [ADR 0152](0152-a-yes-counts-for-its-own-day.md) (a
  Confirm or Agree that fills the call says what it closes),
  [ADR 0154](0154-whatsapp-tells-crew-what-happens-next.md) (WhatsApp
  tells crew what happens next) and
  [ADR 0159](0159-a-crew-call-keeps-to-its-phase.md) (a call keeps to its
  phase's days).
- **Changes:** what ADR 0154 and ADR 0159 left open.

## Context

ADR 0154's check left two problems at 2:

- An offer's row said where the offer's own WhatsApp got to ("Read on
  WhatsApp"), but not the ones that followed it. The panel after a press
  said one "is going to Aoife", and nothing said afterwards whether it
  arrived or why it didn't.
- Agreeing a rate, or confirming a yes, that fills a call closes the
  offers still waiting on an answer as well as the other rates asked for:
  the server marks them filled by someone else, Google emails each person
  that their days are cancelled, and WhatsApp tells them they're no longer
  needed. The question before the press named the rates only.

ADR 0159 left one: a call's days are one run, so a call across a job's
phases holds every day from its first to its last. With a free day
between two phases, its crew are asked for that day too, and nobody gets
a calendar invite for it, as the calendar has no day for it. Nothing said
so. A quote's crew make calls like this by themselves on a job with more
than one phase (ADR 0140).

## Decision

1. **The row says where the newest WhatsApp after the offer got to,**
   in the words the panel uses: "A WhatsApp saying they're booked was
   read.", "A WhatsApp with the new call time is going.", "A WhatsApp
   saying they're no longer needed was sent." Not sent, it says why, in
   the bad colour, as the offer's own does: "A WhatsApp saying they're
   booked wasn't sent: Not on WhatsApp". It shows on an offer that's over
   too, as "no longer needed" follows the offer's end. The server reads it
   with the offer (`whatsappAfter`), and Meta's receipts update it as they
   do the offer's own.
2. **The question names everyone the press closes:** "Agreeing it fills
   the call, so Conor's ask for €300 a day closes unanswered, and Niamh's
   offer closes: their link says it's filled by someone else. Google
   emails Niamh that their days are cancelled. A WhatsApp tells Niamh
   they're no longer needed." (`waitingClosedBy` in `shared/src/crew.ts`,
   `fillingWords` in `shared/src/reach.ts`). The panel after says what
   went to each of them, from the row and from Next, whether or not there
   was a question: a Confirm that fills the call over offers still
   waiting, and nothing else, still goes in one press.
3. **A call across phases that holds a day no phase has says so on its
   card,** at rest, while the day is to come: "The call holds Thu 12 Dec,
   which no phase of the job has: crew on it are asked for that day too,
   with no calendar invite for it. Add a phase for that day, or ask for
   crew for each phase on its own." A day past the job's first or last
   phase, left by a phase that moved, can be taken off the call, so that
   one says "Change the call's days or add a phase." (`daysInNoPhase` and
   `noPhaseLine` in `shared/src/crew-days.ts`).

## What this sends

Nothing new. Each says what was already sent, or what a press already
did.

## Considered

- **Asking before every Confirm that fills the call over offers still
  waiting.** Rejected: that's how every call with more people asked than
  it needs ends, and it's what the office expects. A question on the most
  common press would be pressed through unread; the panel after says who
  was told. The question stays for what the office might not expect: a
  rate left unanswered, or days still asked.
- **Every WhatsApp that followed, on the row.** Rejected: the newest is
  the one that's news; the rest are in the person's History.
- **A call's days with gaps,** so a call across phases holds only their
  days. Rejected for now: every part of crew booking reads a call's days
  as a run from its first to its last, and a phase for the free day, or a
  call for each phase, does it with what's there.
- **Splitting a quote's crew into a call for each phase.** Left: a call
  across phases is one ask for the same people on every phase, which is
  how most jobs are crewed. The card now says when that ask holds a day
  it shouldn't.

## Consequences

- A row can carry one more line, while WhatsApp is on or has been.
- A quote's crew on a job with a free day between its phases show the
  line until a phase covers the day or the call is asked for by phase.
