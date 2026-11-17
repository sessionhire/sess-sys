# ADR 0153: Crew's own invites tell them what happens next

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who answered the seven
  questions of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  with "Go with yours". This is question 4 ("Tell people when they're
  booked, their call time changes, or they're no longer needed?": yes, by
  calendar email, and on WhatsApp once that's on) with findings 4 and 8:
  batch 3 in the audit's order, its calendar part. The WhatsApp part,
  three more messages and question 7, follows in its own change, under
  WhatsApp's own switch.
- **Builds on:** [ADR 0009](0009-crew-invites.md) (each person's own
  invite, and Google emailing a change of title but never of the
  description), [ADR 0149](0149-the-office-is-told-what-the-app-sent.md)
  (the office is told what a press sends),
  [ADR 0150](0150-hold-means-hold-the-day.md) (HOLD is hold the day),
  [ADR 0151](0151-notes-for-the-crew-and-office-notes.md) and
  [ADR 0152](0152-a-yes-counts-for-its-own-day.md) (what each invite's
  first line says), and the UX sweep of 6 November 2026, move 6 (a
  booking that ended says so in its place on their page).
- **Changes:** nothing in ADR 0009's rule. A change of description is
  still never emailed; with this on, being booked and a call time are in
  the title of a person's own copy, whose changes Google emails.

## Context

Once the invite had gone, nothing told a person the office had booked
them, or that their call time had moved (finding 4). Their page, their
invite and the WhatsApp reply all said "the office will confirm", and
when the office pressed Confirm, the only change was the first line of
their invite, which Google never emails. A call moved three hours earlier
reached them only if they opened their page. On a calendar that isn't
Google's (Outlook, iCloud), a change that isn't emailed never arrives at
all.

When an offer ended, the only word the person got was Google's
cancellation, one a day, with no reason (finding 8). "Cancelled", about
days a freelancer had kept free, read as the job being off, whether the
place had gone to someone else, the office had withdrawn it, or the
person had said no themselves. The reason was on their page, as one line
at the bottom for an offer that was only waiting.

## Decision

1. **A switch, off to start.** Admin › Connections › Google Calendar,
   under Crew invites: "Tell crew what happens next", with Off, "Only to
   the addresses below" (up to 5, for trying it on the office's own
   addresses first) and On. On asks first: "Tell crew what happens next?
   From now on Google emails each person invited when they're booked or
   their call time moves, and a day that comes off says why. Nothing is
   sent now: their invites' titles change quietly." Each change is in the
   history. It shows while crew invites are on, and keeps its setting
   while they're off.
2. **The title of a person's own day says where they stand and their
   call time.** "Booked: Harbour Lights Festival - Show 1/2, call 06:00"
   once booked; "Harbour Lights Festival - Show 1/2, call 06:00" while
   they're asked, or their yes waits on the office. Someone picked for a
   job the client hasn't said yes to keeps HOLD, short for hold the day,
   and is never "Booked": "HOLD Harbour Lights Festival - Show, call
   08:00". The day everyone sees, and the copies of people it doesn't
   reach, keep their titles.
3. **Being booked and a call time that moves are news, and Google emails
   them.** Booked changes the title. Picked changes only the first line,
   so it's sent as news too. A call time that moves changes the title of
   everyone on the call it reaches. Not news, and so quiet: their own yes,
   a change of the description (notes, the crew list), and the title
   changing because the switch was turned on or off. What each copy told
   its person is kept (`calendar_days.told`), so news goes once, and a copy
   that told nothing before tells nothing new by itself. Someone who said
   No to a day in Google hears no more about that day.
4. **A day that comes off says why.** Before a person's own copy comes off
   because their offer ended, its title changes, without an email, to say
   why, so Google's cancellation carries it: "Filled by someone else: …",
   "Withdrawn by the office: …" (also a booking released, or a call
   cancelled), "The job was cancelled: …", "The job didn't go ahead: …",
   and for their own doing "You declined: …" and "Can't make it: …", in
   their page's own words, without HOLD. A day that comes off an offer
   still going, such as days changed or Confirm ending the days still
   asked, keeps its title.
5. **The office is told, before and after.** Confirm's question adds
   "Google emails them that they're booked." (or "to hold the day"), and
   the panel after it says "Google is emailing Aoife that they're booked,
   and their link says so." Withdraw, Release, a cancelled call and a
   stopped job say Google emails them that their days are cancelled "and
   why". After a call change: "Google is emailing Aoife the new call
   time." The Offer form's line about a shortlist says Google emails
   anyone invited that it's cancelled, "filled by someone else". Each says
   it only of the people the switch reaches.
6. **Their page says an offer ended where it was.** An offer that was
   waiting on them and ended on the office's side (filled, withdrawn, or
   the job stopped) is a card at the top of "Offers waiting on you",
   saying how ("Filled by someone else Olympia"), while that's news: a
   week, or until its call. Then it joins "Offers that ended", in the same
   words. This is how a booking that ended has shown among their bookings
   since the UX sweep. Their own No or Can't make it goes straight to the
   list. The page reads the same whatever the switch.

## What this sends

With the switch off, as on live when this is deployed: nothing new.
Being tried: only to the addresses listed. On: for each person it reaches,
one update email a day for being booked or picked and for a call time
that moves; the cancellations that already go carry the reason in their
title. Turning it on or off sends nothing.

## Trying it first

On the test calendar, with staff as the crew: put your own address under
"Only to the addresses below", offer yourself a day on a test job, say yes
in Google, confirm yourself, move the call time, then withdraw the offer.
Check what arrived in Gmail and on a phone: an update for the booking and
for the call time, and a cancellation titled "Withdrawn by the office:".
How Google shows the last title of a cancelled event wasn't seen in the
audit, so look at that before turning it on for everyone.

## Considered

- **Emailing every change of the description.** Rejected: the crew list
  and notes change often, and each would email everyone on the day.
- **A separate email from the operations mailbox.** Rejected: a second
  sender for the same news, behind the quote email's switch, and on top
  of Google's own update.
- **On for everyone with no switch.** Rejected: it would reach every
  freelancer the day it's deployed. Every new way of reaching crew starts
  off until launch, and can be tried on the office's own addresses first,
  as WhatsApp is.
- **"Thanks for letting us know:" for their own No** (the audit's
  wording). Chose "You declined:", the words their page and the office
  already use, one name on both sides.

## Consequences

- The connection keeps the switch and the addresses (`calendar_link.tell`,
  `calendar_link.tell_to`), and each day what its title last told its
  person.
- Outlook and iCloud users hear about being booked and a moved call time,
  as these are changes of title.
- Taking a person's day off while it tells them is two writes, the quiet
  retitle then the cancellation, where it was one.
- Telling on WhatsApp ("you're booked", "your call time changed", "no
  longer needed") needs three more templates approved by Meta, and follows
  under WhatsApp's own switch.
