# ADR 0151: Notes for the crew, office notes, and a short invite until someone says yes

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who answered the seven
  questions of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  with "Go with yours". This is question 1, "Who are a job's notes for?",
  and finding 2, batch 5 in the audit's order.
- **Builds on:** [ADR 0008](0008-calendar-sync.md) (the calendar day carries
  the day's sheet, notes included), [ADR 0009](0009-crew-invites.md) (each
  person's own invite), [ADR 0021](0021-call-sheets.md) (the call sheet, for
  people who have said yes), [ADR 0062](0062-what-crew-and-freelancers-read-of-other-people.md)
  (what staff crew and freelancers read) and
  [ADR 0086](0086-travel-and-subsistence-on-quotes.md) (the quote's travel
  and subsistence lines, where each day's per diems and fuel come from).

## Context

A job had one Notes box under Change details, with nothing to say who reads
it. Everything in it went into the description of each day's invite, under
"Job notes", and since each person got their own invite (1.163.0) that
meant an email to everyone **asked**, before any of them had said yes, on
jobs the client hadn't agreed yet too. The audit's made-up festival had
"Client is price sensitive: hold the margin at 30%, do not discount crew."
in it, and every freelancer offered a place got it. The rest of the day's
sheet went with it: the client, the crew list, the phase's notes and the
pick list.

By decision a job's notes are part of what crew read: they are on the call
sheet (ADR 0021) and the calendar day (ADR 0008). That was written when the
day was one shared event for people already on the job. Nobody typing a
note could know it would be emailed to people who might never work it, and
an email can't be unsent.

## Decision

1. **Two boxes, each saying who reads it.** Under Change details:
   - **Notes for the crew**, with the line "On the call sheet and the jobs
     calendar, and in each person's invite once they've said yes." This is
     the box that was "Notes": what is in it today stays where crew read it.
     A phase's Notes box is "Notes for the crew" too, with the same line.
   - **Office notes**, with the line "Only in the app, for the office: never
     on the calendar, a call sheet or a message." They are never written
     to Google, a call sheet, a message, WhatsApp or a person's page.
   On the job's page each says what it is: "For the crew: ...", "Office
   notes: ...", beside "At the venue: ...".

2. **Office notes reach the office, directors and heads of department**,
   who read clients' documents (ADR 0062). Staff crew and freelancers
   signed in are sent the job without them. While no one has been made a
   director, roles are off and everyone signed in reads everything, these
   too, as with the rest (ADR 0034). The history says "the office notes"
   changed, never what they say. Combining two jobs joins each kind of
   note with its own.

3. **Someone only asked gets the short invite.** Their own copy of each day
   opens with its question and the way to their page, as before (ADR 0150),
   then the job's stage (with what HOLD asks of them), the day, the venue's
   name and address, and the per diems and fuel, then: "Once you've said
   yes, this invite fills in with the day's sheet: the client, the crew,
   the notes and the pick list." Once they say yes, or the office books
   them, their copy is the whole sheet, as everyone on the job sees it. A
   rate request is not a yes, so it keeps the short copy.

## What this sends

Nothing new. The invites of people only asked have their description
shortened once on the first run after this is deployed, and a description
that changes is never emailed (ADR 0009). When someone says yes their copy
fills in, quietly, the same way.

## Considered

- **Making everything in Notes today office notes**, so nothing typed
  before reaches anyone. Rejected: most jobs' notes were brought in from
  the calendars crew read (903 jobs on 16 October), and the running order
  and the access notes on a call sheet would go missing the day before a
  show. With the short invite, nothing in them reaches someone who has
  only been asked; the box now says who reads it, and the office can move
  anything private across.
- **Leaving the per diems and fuel out of the short invite**, as the audit
  listed it. Kept in: they went on each day in 1.161.0 so that crew know
  them before they say yes (ADR 0008), they are about the crew's own money
  and not the client's, and neither their page nor the call sheet shows
  them.
- **The venue's own notes** ("At the venue: ...") are on the call sheet for
  everyone on the job; someone only asked gets the venue's name and address.

## Consequences

- A person deciding reads less, and what they need to decide (their rate,
  the call's own details, the day to answer by) is on their page, a line
  down (ADR 0150).
- The office has a place for what isn't for the crew, and each of a job's
  boxes for notes says who reads it where it's typed. A venue's Notes box
  (access, load-in, power, parking) goes on the same sheet and doesn't say
  so yet.
