# ADR 0152: A Yes counts for its own day, and saying no to a rate keeps the offer

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who answered the seven
  questions of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  with "Go with yours". This is question 2 ("A Yes on one day's invite:
  that day, or every day?") and question 6 ("Saying no to a rate: should
  the offer stay open at the rate offered?"), with findings 3, 9 and the
  rest of 7 and 16: batch 4 in the audit's order.
- **Builds on:** [ADR 0009](0009-crew-invites.md) (each person's own
  invite, and their answer in Google counting as on their link),
  [ADR 0046](0046-departments-on-calls-and-what-each-role-reads.md) (who reads rates),
  [ADR 0140](0140-one-job-one-path.md) (where Next lands),
  [ADR 0149](0149-the-office-is-told-what-the-app-sent.md) (the panel
  after a press), [ADR 0150](0150-hold-means-hold-the-day.md) (crew asked
  while the job is a quote) and
  [ADR 0151](0151-notes-for-the-crew-and-office-notes.md) (the short
  invite until a yes).
- **Changes:** ADR 0009's rule that "A Yes to any day is a yes to the
  offer, for all its days except any they said No to".

## Context

Since 1.164.0 each person has their own copy of each day, and each asks
one question about one named day: "can you hold Fri 27 Nov for us...?
Press Yes or No on this invite to let us know." The rule for reading the
answer was written on 30 September, when a day was a shared event with no
question in it: a Yes to any day was a yes to every day of the offer. So
a Yes on Friday's invite booked the person for Saturday too, and
Saturday's invite thanked them for a yes they never gave (finding 3).

Someone who asked for a different rate was still asked to press Yes or
No, and their Yes did nothing. Another person's yes that filled the call
closed their ask without the office answering it. The office's Say no
withdrew the whole offer, though they might have done it at the rate
offered (finding 7).

On the job's own Crew tab, a yes waiting for the office and a rate asked
for had nothing to press: that was on Crew's Answers to check. On a job
still being quoted, where crew are now asked first (ADR 0150), Next said
"Make a quote" and nothing on the job pointed to the answer (finding 9).

A Yes the app couldn't take, because the day had just filled or they were
on another job that day, was said to the office but not to the person,
whose Google still showed their Yes (finding 16).

## Decision

1. **A Yes in Google counts for the day it was pressed on.** The offer is
   accepted for the days they've said yes to, and the days they haven't
   answered stay asked: they hold nothing, their invites still ask, and
   their page says "You haven't answered for Sat 28 Nov yet. Tick it if
   you can do it, or leave it unticked, and press Update my days." Until
   the office confirms, a later Yes adds its day and a later No drops it.
   A No to every day they'd said yes to, with days still unanswered, makes
   it an offer for those days again, as before their yes; a No to every
   day declines, as before. The history says it: "Aoife Byrne accepted
   Audio tech on Harbour Lights Festival, Fri 27 Nov; no answer yet for
   Sat 28 Nov". A Yes the app couldn't take isn't tried again with a later
   one. An answer on their page or in the app is for the days ticked, as
   before.
2. **Each invite's first line follows that day's own answer.** A day
   still asked keeps asking. A No to a day still asked: "Thanks Aoife, you
   said no to Sat 28 Nov. If that changes, press Yes on this invite." A
   Yes the app couldn't take says why, in their page's own words: "Thanks
   Niamh, but we couldn't take your yes. Sat 28 Nov has just been filled.
   Still open: Fri 27 Nov." "Still open" names only days they could still
   take. These change the description, so no email goes (ADR 0009).
3. **Confirm books the days they said yes to, and ends the ask for the
   rest.** Where days are still asked, the office's button names the days
   it books ("Confirm Fri 27 Nov"), and the question before it says the
   rest: "Aoife Byrne hasn't answered for Sat 28 Nov, so confirming books
   Fri 27 Nov only. Google emails them that Sat 28 Nov is cancelled." Once
   every day of the call has the people it needs, the days still asked of
   anyone are no longer asked, as anyone only asked is told it's filled.
4. **A rate asked for waits for the office.** Someone else's yes that
   fills the call no longer closes it. The office's own Confirm or Agree
   that fills the call does, and says so first: "Confirming them fills the
   call, so Tomás Doyle's ask for €320 a day closes unanswered." In that
   case, and for a yes with days still asked, Next opens the row ("Check
   Aoife's yes") rather than confirming in one press. A Yes pressed in
   Google after asking settles nothing; the office's row says "Pressed Yes
   on Google Calendar after asking for a different rate: ring them to see
   which stands."
5. **Saying no to a rate keeps the offer.** Say no puts the offer back to
   asked, at the rate offered, for the days the rate was asked for, for
   them to take or turn down. Withdraw is its own choice beside it. Their
   page says "The office can't do €320 a day, so the offer stands at €280
   a day.", the rate box is empty for a new ask, and Accept is the filled
   button again. Their invite asks again ("we can't agree the rate you
   asked for, but can you hold Fri 27 Nov for us...?"), naming no rate
   (question 5). A Yes they pressed in Google while asking doesn't count:
   Google still shows it, so their invite asks them to say yes on their
   page, and the office's row says "Pressed Yes on Google Calendar while
   asking for a different rate, so it doesn't count: their invite asks
   them to answer on their page." If the call filled while they waited,
   Say no closes the offer as filled, and the question says so first. A
   head of department who doesn't read a call's rates can say no to a rate
   on it, as that names none, but can't agree one (ADR 0046).
6. **The same presses on the job's own rows.** A yes has Confirm and
   Release; a rate has "Agree €320", "Say no" and "Withdraw", with the
   same questions as on Crew's Answers to check, from one part of the
   app. On a job still being quoted or waiting on the client, Next leads
   with the quote and says "2 answers to check" beside it, which opens the
   call's rows; "Answer Tomás's rate" opens the row too, rather than Crew.

## What this sends

Nothing new by itself. Invites' first lines change quietly. Confirm with
days still asked takes those days' invites off, and Google emails the
person that they are cancelled, as the question says before the press
and the panel after it ("Google is emailing Aoife that Sat 28 Nov is
cancelled. Nothing else went to Aoife: ..."); the same goes for days
still asked when the call fills, as it does today for anyone only asked,
and for a rate asked for that the office's own Confirm closes, named in
both. Say no sends nothing: no day comes back that they
had left out, so nobody is invited to a day again. The panel after it
says "Nothing was sent to Tomás: their link and their calendar invite say
the offer stands at the rate offered, and no email goes with that." With
messages to crew on, the message opens for the office to send: "Hi Tomás,
we can't do €320 a day for Harbour Lights Festival (Show), but the offer
stands at €280 a day: ..."

## Considered

- **A Yes for every day, with each invite saying so** (the audit's other
  answer to question 2). Not chosen: each invite asks about one day by
  name, and the answer should mean what was asked.
- **Saying no to a rate offering every day of the call again.** Rejected:
  the person had left the other days out, and putting them back invites
  them to those days by email, which reads as a new offer they never
  asked about.
- **Someone's yes closing a rate asked for, with a warning.** Rejected:
  nobody would have decided it. The office's own press closes it, with the
  names said first.
- **Counting a Yes pressed while a rate was asked for, once the office
  says no to the rate.** Rejected: it was pressed while asking for more,
  so it isn't a yes at the rate offered.

## Consequences

- The office can book someone for the days they answered in Google, and
  the call stays open for the rest.
- A rate asked for can wait on a call that is already full until the
  office answers it; Answers to check and the job's Next say it's there.
- Each person's copy of a day reads what they last pressed in Google, so
  writing the calendar reads those answers too.
- An offer keeps the days still asked (`offers.asked`), and a device shows
  them before the next sync. An offer back to asked with a rate on it is
  one whose rate the office said no to.
