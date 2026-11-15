# ADR 0185: One notice a gig

- **Status:** accepted
- **Date:** 15 November 2026
- **Asked for by:** Colly, 15 November 2026, passing on a freelancer's word: "he was sent 4 updates when the gig was
  cancelled for the 4 days he was working, but it really should just send one update to people if possible to save
  spamming them", and then: "Same for the other notices though, I'd rather sent 1 notice for 1 gig rather than spamming
  loads if someone is on a gig which multiple changes happening all at once".
- **Builds on:** [ADR 0009](0009-crew-invites.md) (crew invites), the personal invites of 1.164.0 (each person's own copy
  of each day), [ADR 0153](0153-crew-invites-tell-what-happens-next.md) (telling crew what happens next) and
  [ADR 0157](0157-own-invites-for-jobs-brought-in.md).

## Context

Since 1.164.0 each person offered or booked has their own copy of each day of a job on Google Calendar, with them as its
only guest. Every change Google emails about (the day coming off, being booked, a call time that moves, a new name or
place) was written to each copy with `sendUpdates=all`, so a person on a four-day gig got four emails for one change.
Cancelling the job sent four cancellations.

## Decision

In one run of the calendar sync (changes made together settle for two seconds, then go in one run), each person hears
from Google **once a gig**: the first of their days to change carries the email, and the rest of that job's days change
with `sendUpdates=none`.

- **Days coming off go first.** When some of a person's days come off and others change in the same run, the
  cancellation is the email: losing days is the bigger news, and an update to a day that's left shouldn't hide them.
- **The one cancellation names every day going.** Before it is deleted, the first copy is retitled, quietly, to the
  phase (or the job, when the days are more than one phase's) and the days: "Nissan - Build, Sat 2 Mar to Sun 3 Mar",
  with ADR 0153's reason in front when telling is on ("The job was cancelled: …"). Without this, "Nissan - Build 1/4"
  would read as only the first day being off. One day going keeps its own title, as before.
- **New invitations still go one a day.** A copy that is new to the person (offered, or asked again) is still emailed:
  it is a question they answer on Google, and a quietly added event may never reach their calendar (Gmail's unknown-sender
  protection, other calendars). An invitation counts as the gig's notice, so the rest of that run is quiet.
- Guests added by hand to the shared day in Google are told as before.

Considered and not taken:

- **One event a person spanning the gig** (multi-day or recurring). Fewer events, but a per-day Yes or No (ADR 0152) and
  per-day call times would no longer fit, and moving to it would send everyone already invited a cancellation and a new
  invite at once, on the live calendar.
- **A separate summary email.** The app sends no email of its own about calendars, and a second channel would arrive
  beside Google's, not instead of it.

## Consequences

- Google Calendar users see every day change on their calendar, emailed or not: Google keeps an attendee's copy in step
  with the organiser's whatever `sendUpdates` says.
- People whose calendar isn't Google's (Outlook, Apple) only get what's emailed, so the quiet days stay as they were on
  their calendar. The cancellation names every day going, and their page is always current; this is the trade-off for
  not spamming the many on Gmail.
- The count is per run: changes made a minute apart are two runs and two notices, each about something new.
- Tested in `server/test/calendar.test.ts` against the fake Google, which logs every email it would send.
