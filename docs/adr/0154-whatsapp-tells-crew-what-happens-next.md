# ADR 0154: WhatsApp tells crew what happens next

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who answered the seven
  questions of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  with "Go with yours". This is question 4 ("Tell people when they're
  booked, their call time changes, or they're no longer needed?": yes, by
  calendar email, and on WhatsApp once that's on) and question 7 ("When
  WhatsApp is turned on, do people already asked or booked get the
  confirmed and cancelled messages?": yes, for anyone it can reach), with
  findings 4, 8 and 12: batch 3 in the audit's order, its WhatsApp part.
  The calendar part is [ADR 0153](0153-crew-invites-tell-what-happens-next.md).
- **Builds on:** [ADR 0125](0125-offers-go-on-whatsapp-by-themselves.md)
  (offers on WhatsApp, HOLD and what follows a job's own change),
  [ADR 0149](0149-the-office-is-told-what-the-app-sent.md) (the office is
  told what a press sends) and [ADR 0150](0150-hold-means-hold-the-day.md)
  (HOLD is hold the day).
- **Changes:** ADR 0125's "Offers on hold, and what follows": who the
  confirmed and cancelled messages reach, and a person picked to hold the
  day hears they're booked rather than that the job is confirmed.

## Context

Once an offer had gone on WhatsApp, nothing more came that way unless the
job itself changed (finding 4). The office's Confirm sent nothing; nor did
a call time moved three hours earlier. When an offer ended because the
place went to someone else, the office withdrew it or released them, or
the call was cancelled, the only word was Google's cancellation, with no
reason (finding 8). And the two messages that did follow a job, confirmed
and cancelled, went only to people whose own offer had gone on WhatsApp
(finding 12): on the day WhatsApp is turned on for real, everyone already
asked or booked would be left out of them for the life of those offers.

## Decision

1. **Three more templates, for what follows an offer.** `job_booked`
   ("Hi Aoife, you're booked for Harbour Lights (Show)." with the role,
   their days, the call time, the venue, and See the details),
   `job_call_time` ("Hi Aoife, the call time for Harbour Lights (Show)
   has changed." with the new call time and their days, and See the
   details) and `job_not_needed` ("Hi Dara, sorry: you're no longer
   needed for Harbour Lights (Show) on Sat 21 Nov (filled by someone
   else). Those days are free again."). Their words, examples and buttons
   are in [whatsapp-setup.md](../whatsapp-setup.md), step 9, to approve in
   Meta beside the three already there. No rate in any of them (question
   5): it's on their page.
2. **Booked.** The office's Confirm, or Agree on a rate, on a job the
   client has said yes to, or on a call that isn't part of a job. Someone
   picked for a job the client hasn't said yes to only holds the day, so
   nothing goes then; when the client says yes, each person picked hears
   they're booked, and each still asked hears it's going ahead
   (`job_confirmed`, as before). Once for each offer: a job that goes back
   to a quote and is confirmed again sends nothing new.
3. **A new call time.** When a call's call time changes, everyone asked or
   booked on it hears the new one, with HOLD before the job's name while
   the day is still theirs to hold. One already waiting to go for someone
   says the call time as it is when it goes, so a second change doesn't
   add another beside it. Nothing for any other change.
4. **No longer needed, and why.** When an offer is filled by someone else,
   withdrawn, a booking released, or its call cancelled, its person hears
   they're no longer needed, and why, in their page's words ("filled by
   someone else", "withdrawn by the office"), without HOLD. Not for a job
   that stopped, whose own message says it isn't going ahead, once per
   person however many of its calls they're on; and not for their own No
   or Can't make it, which they gave.
5. **Who.** Each of these, and the job's confirmed and cancelled, goes to
   anyone WhatsApp reaches who heard of the offer: whether or not the
   offer itself went on WhatsApp (question 7), so people offered before it
   was turned on are told too. "Heard of" means its WhatsApp went, none
   was made, or they answered another way; someone whose offer is still
   waiting to go, or that Meta turned down, and who hasn't answered, is
   told nothing about an offer they never saw. Nothing goes about a call
   whose days are all past: it's a record then, not news.
6. **Under WhatsApp's own switch.** Off, as on live, nothing goes. "Only
   to the numbers below" reaches only those numbers. There's no switch of
   its own: these are the follow-ups of an offer that already went there.
7. **Checked again as it goes.** Each is queued in the change that makes
   it news and sent just after, as an offer is, and checked again then: a
   booking released before its message went, a call time on an offer that
   ended, an offer that is open again, or a job no longer confirmed, sends
   nothing, and the message's own record says why. One that waits more
   than a day isn't sent.
8. **The office is told, before and after.** Confirm's question adds "A
   WhatsApp tells them they're booked." (never while they only hold the
   day); Withdraw and Release add "A WhatsApp tells them they're no longer
   needed."; cancelling a call says how many of its people a WhatsApp
   tells; stopping a job, how many it tells "it's off". The panel after
   each press says it in the past: "A WhatsApp saying they're booked is
   going to Aoife.", "A WhatsApp with the new call time is going to Aoife
   and Dara." The Offer form's line about a shortlist says the rest hear
   it's filled on WhatsApp too. Each says it only of the people it
   reaches, by the same rule as the server.

## What this sends

With WhatsApp off, as on live when this is deployed: nothing. Being tried:
only to the numbers listed. On: for each person it reaches, one message
when they're booked, one each time their call's call time changes, one
when their offer ends on the office's side, and one when a job they're on
is confirmed after they were asked to hold the day, or stopped.

## Trying it first

Under Admin › Connections › Offers on WhatsApp, with your own mobile under
"Numbers to try it on" and "Only to the numbers below": offer yourself a
call on a confirmed test job, say yes, confirm yourself, move the call
time, then release yourself. Check that "you're booked", the new call time
and "no longer needed (withdrawn by the office)" arrive. The three
templates must be approved in Meta first; until they are, Meta turns each
down and nothing arrives.

## Considered

- **A switch of its own, as the calendar's has.** Rejected: WhatsApp's
  switch, with its numbers to try it on, already keeps it from reaching
  anyone until launch, and these are the same conversation as the offer.
- **Only to people whose offer went on WhatsApp.** As ADR 0125 had it.
  Rejected on Colly's answer to question 7.
- **Telling someone picked to hold the day that they're booked.**
  Rejected: they aren't until the client says yes (ADR 0150), and then
  they hear it.
- **A message for their own No or Can't make it.** Rejected: they gave
  it, and the reply to a No on WhatsApp already says it's declined.
- **A message for every change of a call.** Rejected: only the call time
  changes what they do on the day; the rest is on their page.

## Consequences

- WhatsApp messages have three more kinds: booked, call time and not
  needed. Each is kept with its offer, as the offer's message is.
- Meta must approve `job_booked`, `job_call_time` and `job_not_needed`
  before WhatsApp is turned on.
- On the day WhatsApp is turned on, people already asked or booked hear
  what follows their offers from then on.
- An offer's row says where the offer's own message got to ("On WhatsApp:
  read"), not the ones that followed it. The panel after a press says one
  "is going"; whether it arrived isn't shown yet.
