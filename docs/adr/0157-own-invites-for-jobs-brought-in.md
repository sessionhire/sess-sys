# ADR 0157: Crew get their own invite for a job brought in from Google Calendar

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who answered the seven
  questions of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  with "Go with yours". This is question 3 ("Should an offer on a job
  brought in from Google Calendar send the person their own invite?":
  yes) with the rest of finding 1: the first part of batch 6 in the
  audit's order.
- **Builds on:** [ADR 0009](0009-crew-invites.md) (each person's own
  invite, a copy of the day on the connected account's own calendar since
  1.164.0), [ADR 0011](0011-calendar-import.md) (the organisers' calendars
  keep the jobs brought in from them),
  [ADR 0149](0149-the-office-is-told-what-the-app-sent.md) (the office is
  told what a press sends), [ADR 0151](0151-notes-for-the-crew-and-office-notes.md),
  [ADR 0152](0152-a-yes-counts-for-its-own-day.md) and
  [ADR 0153](0153-crew-invites-tell-what-happens-next.md) (what each
  person's own copy says).
- **Changes:** ADR 0011's "the app doesn't put these jobs on the jobs
  calendar" still holds for the day everyone sees, but each person the
  office offers one of these jobs from now on gets their own copy of its
  days.

## Context

Most jobs in the app came in from the two organisers' calendars (903 on
16 October). The app writes nothing for them, so that their days don't
show twice and their crew aren't invited a second time (ADR 0011). So an
offer the office made on one reached nobody: with messages and WhatsApp
off, the person heard nothing unless someone rang them (finding 1). Since
1.165.0 the Offer form and the offer's row have said so ("Nothing is sent
for this job from the app: it came from Google Calendar, so its days are
the organiser's."), but saying so doesn't reach the person.

Since 1.164.0 each person's invite has been their own copy of the day, on
the connected account's own calendar. A copy like that needs no day of
the app's on the jobs calendar, and doesn't touch the organiser's event.

The third case in finding 1: someone who said No in Google to every day
of an offer, and was offered those days again, got nothing. Their copies
stayed as they had left them, declined, no email went, and the office's
row read their old No against the new offer ("No new invite went: their
No to an earlier offer still stands in Google Calendar.", since 1.165.0).

## Decision

1. **Their own invite, from now on.** On a job brought in from Google
   Calendar, each person the office offers gets their own copy of each day
   they're asked for, on the connected account's own calendar, as on a job
   made in the app: HOLD while the client hasn't said yes, the short invite
   until they say yes (ADR 0151), a Yes for its own day (ADR 0152) and,
   with "Tell crew what happens next" on, being booked, a call time that
   moves and why a day comes off (ADR 0153). The organiser's event is left
   alone, and the app still writes no day of its own on the jobs calendar
   for these jobs: the organiser's event is that day. What a copy says
   after a yes comes from the job, whose notes came from the calendar its
   crew already read.
2. **The offers already there keep none, and say why.** When this is
   deployed, the offers on these jobs are marked as having no invite of
   their own (`offers.no_own_invite`), each with its reason, on its row:
   - brought in with the job, from the guests the organiser invited, who
     have the organiser's own invite: "No invite from the app: the
     organiser invited them in Google Calendar." The same goes for guests
     brought in with a job from now on.
   - made by the office's Offer while the form said nothing would be sent,
     whom someone may have told another way: "No invite from the app: it
     was offered before jobs from Google Calendar sent their own."
   An offer is the office's when its Offer is in the history; anything
   else on these jobs came in with the job.
3. **Asked again after a No, a fresh invitation.** When someone who said
   No in Google to their own copy of a day is offered that day again,
   their copy comes off without an email and a new one goes, which Google
   sends as an invitation. Their answer starts again, and the office's row
   says "Invited by email". This holds on every job, not only these.
4. **The office is told, from the same rule.** The Offer form's promise,
   the panel after a press and each offer's row read the server's rule
   (`invitePlan`), so on these jobs the form now says "Pressing it emails
   Aoife a calendar invite for each day." The person's page says invites
   go to their address under an offer that has one, as on any job.

## What this sends

Deploying it sends nothing for the offers already on jobs brought in from
Google Calendar. From then on, with crew invites on, as they are on live,
pressing Offer on one of these jobs emails each person picked a calendar
invite for each day, as it already does on the app's own jobs, and the
form says so before the press. Someone who said No in Google and is asked
for the same days again gets a fresh invitation. Anyone already asked
again that way before this is deployed, whose new offer is still on, gets
theirs on the first run after it: the invitation the Offer form said would
go when the office pressed it.

## Considered

- **Inviting the offers already there as well.** Rejected: deploying it
  would email everyone the organiser invited a second invite for days they
  already have, and people the office was told would get nothing.
- **Writing these jobs' days on the jobs calendar too.** Rejected, as in
  ADR 0011: anyone with both calendars would see every day twice.
- **Handing the job over to the app** (ADR 0011's "comes later"), so the
  app writes its days and the organiser's events go. Not this: the
  organiser's event stays theirs, and only each person's own copy is the
  app's.
- **One line for both kinds of old offer.** A line true of both ("it came
  in with the job, or was offered before…") says neither clearly, and the
  guests the organiser invited are most of the offers on these jobs.

## Consequences

- An offer on one of these jobs reads like one on the app's own:
  "Calendar invite on its way.", then "Invited by email, 2 days. No answer
  yet."
- An answer given in Google to a person's own copy is picked up, as on any
  job. One given to the organiser's own invite still isn't (ADR 0011).
- The mark stays with the offer. A job that stops being brought in, handed
  over or combined into one of the app's own, plans its offers as any
  other.
- Asking again after a No is two writes where it was one: the quiet
  removal, then the invitation.
- Calls that aren't part of a job still get no invite. Whether the office
  can still make them is the open question of #313 ("Crew for something
  not in Jobs"); until then the form and the row say no invite goes for
  them (ADR 0149).
