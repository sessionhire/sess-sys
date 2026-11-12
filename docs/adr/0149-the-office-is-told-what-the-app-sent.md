# ADR 0149: The office is told what the app sent crew by itself

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who picked "The two batches
  with no decisions" from the
  [audit of crew offers](../audit-crew-offers-2026-11-12.md). This is the
  first, "Say what was sent": findings 1, 5, 14, 16, 18 and 20.
- **Amends:** [ADR 0048](0048-messages-to-crew-off-until-said.md), decision
  3 (the card in the Send panel's place) for offers and what happens to
  them, and closes its open point about two switches.
- **Builds on:** [ADR 0009](0009-crew-invites.md) (crew invites) and
  [ADR 0125](0125-offers-go-on-whatsapp-by-themselves.md) (offers on
  WhatsApp).

## Context

There are three ways out of the app to a crew member, each with its own
switch:

1. **A Google Calendar invite**, which Google emails to each person offered
   or booked (ADR 0009). On, on the live app, since 11 November.
2. **The offer on WhatsApp**, sent by the app when the office presses Offer
   (ADR 0125). Off until Meta is set up.
3. **A message the office sends by hand**, opened with the words filled in
   (ADR 0048). Off until the office says so.

The screens knew only of the third. With invites on and messages off, the
audit found the office told "Messages to crew are off. Nothing opened to
send 3 people the offer. Their links already say so" seconds after Google
had emailed four invitations, and asked "Withdraw the offer to Dara Kelly?
Their link says it's withdrawn at once" before Google emailed him three
cancellations. The other way round, the Offer form promised an invite
wherever invites were on, when none goes for a job brought in from Google
Calendar, a call that isn't part of a job, a day outside the job's phases,
or a second offer after a No. Afterwards the row said nothing, so an offer
nobody had heard of read the same as one that had been emailed.

ADR 0048 noted the two switches as an open point and rated it 1, "both
off". With one on and one off it is a 3: the office learns from the screen
that nothing leaves the app, and then presses Withdraw to tidy up.

## Decision

1. **One rule, read from both sides.** Who gets a calendar invite is the
   server's rule (a job of the app's own that isn't stopped, a day from
   today on inside a phase the call covers, an email address). A device
   can work the same rule out from what it already holds, so it is written
   once more as a reading of it in `shared/src/reach.ts`, and a server test
   checks that reading against who the server really made a guest, case by
   case, so the two can't drift. Who an offer goes to on WhatsApp was the
   server's own function; it moved to the same file, and the server now
   sends by the very function the device reads.
2. **Before a press, the Offer form says what the press sends by itself**,
   for the people picked: "Pressing it emails Aoife a calendar invite for
   each day. Nothing goes to Seán: no email address for a calendar invite,
   and WhatsApp is off." A job's or a call's own reason is said once for
   everyone: "Nothing is sent for this job from the app: it came from
   Google Calendar, so its days are the organiser's." A press that tells
   nobody anything says "puts the offer on their page" rather than "doesn't
   know until you press".
3. **After it, each offer's row says how its person was reached**, from
   what the server read back from Google and Meta, not from the switches:
   "Invited by email, 2 days. No answer yet.", "Calendar invite on its
   way.", "Read on WhatsApp.", "Answered on their page." once they have, or
   that nothing has reached them and why. Its tone follows the colour
   grammar:
   - plain for how things stand, which includes a job brought in from
     Google Calendar ("No invite from the app…"): the organiser's own
     invite may well have gone, and most of what the app holds is such a
     job;
   - amber where it is this person's or this call's own gap and the
     office's to act on: no email address, a call that isn't part of a
     job, days outside the phases, a No to an earlier offer still standing
     in Google, a calendar that has a problem;
   - the bad colour for something that failed: Google turned the invite
     down, or the WhatsApp wasn't sent.
4. **With every way out switched off, the call says so once**, over the
   people it's true of: "Nothing was sent to Conor, Niamh and Seán:
   calendar invites, WhatsApp and messages to crew are all off." That is
   the office's own choice, so it is plain, never amber, and not repeated
   under each name.
5. **A row nothing reached offers Ring and WhatsApp** (Email when there's
   no number) where Send would be: the plain contact ADR 0048 keeps, with
   nothing written in it. **Send is there only while messages are on.**
   Off, it opened a panel saying nothing had opened.
6. **The panel after a press is headed by what was done** ("Offered to 3
   people", "Offer to Dara Kelly withdrawn", "Niamh Doyle is booked"), then
   says in a sentence each who Google emailed, who it went to on WhatsApp
   and who nothing reached and why, with their number a press away. It
   reads the call as it stands, so "on its way" becomes "was emailed" as
   the server writes each day. That no message opened for the office to
   send, and where that's turned on, is said last. "Their link says so"
   became "whenever they open it": a link nobody was sent says nothing to
   them. The card "Messages to crew are off" stays for what isn't about an
   offer: a call sheet, a certificate reminder, a timesheet.
7. **A question before a press that takes something away names the email
   Google sends**, with how many days or people: Withdraw, Release, Say no
   to a rate, Cancel crew call, and marking a job cancelled or lost. Where
   nothing goes it says "Nothing is sent to them." Two cases get their own
   words, because the plain promise would be wrong in each:
   - **Crew invites switched off since the person was invited.** The server
     leaves their days as they are and sends nothing, so the question and
     the panel say "Crew invites are off, so Google sends no cancellation:
     the 2 days stay in their calendar." After a booking or a change, the
     panel says what's in their calendar stays as it was. The office then
     knows to ring.
   - **A calendar that has a problem.** Nothing is written until it is put
     right, so an invite or a cancellation is promised "once the calendar
     is working again", on the Offer form as well as in the questions.
8. **On the person's own page**, "We also send a Google Calendar invite for
   each day" shows only when one has gone for an offer waiting on them,
   and the last list is headed "Offers that ended", which covers filled
   and withdrawn as well as their own no.

## What a device can't know, and so doesn't say

- Whether the organiser's own invite reached someone on a job brought in
  from Google Calendar. The line is about the app only.
- Whether anyone rang them. "Nothing has reached Seán" is about the app.
- Whether WhatsApp is set up on the server. The promise goes by the switch
  and the person; the row then shows what Meta said, or that it wasn't
  sent.
- What Google does with an email once sent.

## Considered

- **The same line on every row when everything is off.** Eight people
  offered would read the same sentence eight times. Once, over them.
- **Keeping Send while messages are off, opening the new panel.** A button
  that says Send and sends nothing. The panel opens after the press that
  made the offer, which is where the mode bites.
- **Amber for a job brought in from Google Calendar.** It would light up
  nearly every call there is, for people who mostly have the organiser's
  invite already. Amber is kept for what is real.
- **Having the server work out "what was sent" and send it down.** It
  would be one more synced record for something the device can already
  read from the guests the server syncs back. The test in decision 1 holds
  the two readings together instead.

## Consequences

- Nothing about what is sent changed here: only what the office and the
  crew member are told about it.
- The panel after Confirm says "Nothing was sent to Aoife: their link and
  their calendar invite say they're booked, and no email goes with that",
  and after a changed call time that Google emails nothing unless the days
  move. Both are true today and are the audit's finding 4; sending that
  news waits on Colly's answer to its question 4.
- A fresh invitation after a No, and a person's own invite on a job
  brought in from Google Calendar, are not built: the row and the form say
  that none went. They wait on question 3.
