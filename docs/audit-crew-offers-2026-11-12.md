# Audit, 12 November 2026: crew offers, from the office's press to what the crew member sees

Colly asked on 12 November for "an audit on the crew offers from the app
to the system and how the crew sees this". This is that audit. It follows
one offer from the moment the office picks a person on a job's Crew tab,
through what the app then sends by itself (the Google Calendar invite, and
the WhatsApp message when that is on), to what the person receives, what
they can press, and what they are told afterwards: booked, changed, filled,
withdrawn, cancelled. It is told from both ends: the office person
pressing, and the freelancer or member of staff receiving.

It audits main at **f8ac69d, app 1.164.2**, the day after the work it
mostly looks at: who an invite reaches is listed before invites are turned
on (#328), the unknown-sender line (#330), what each calendar day says
(#331, #332), HOLD on WhatsApp and the follow-ups when a job is confirmed
or stopped (#333, #334, [ADR 0125](adr/0125-offers-go-on-whatsapp-by-themselves.md)),
each person's own invite (#335, [ADR 0009](adr/0009-crew-invites.md)), and
the Offer form's one clear button (#336). Each of those was built and
tested on its own. This is the first time they were walked together, as
one journey with a person at each end.

**How it was done.** A local copy of the app at 1.164.2: the real server
and the real web app, with a database in memory. Google Calendar and Meta
were stand-ins. The Google one is the stand-in the app's own tests use: it
keeps every calendar event and records every call the app makes with "tell
the guests" on. The Meta one records each WhatsApp it is asked to send. So
"Google emailed 4 invitations" below means the app asked Google to send
them: it was counted, not guessed. How Gmail or Outlook then words each
email was not seen, because nothing real was sent, and that is said where
it matters.

The copy was set as live was last known to be set (11 November): the
calendar connected and writing, crew invites on, messages to crew off
([ADR 0048](adr/0048-messages-to-crew-off-until-said.md)), WhatsApp off.
Then WhatsApp was turned on, and messages on once, to see those paths.
Eight made-up jobs and one call outside any job were walked by script in a
real browser: as the office on a phone (390×844) and at a desk, as four
freelancers on their own pages on a phone, as three people answering inside
Google, as one answering on WhatsApp, and as a member of staff signed in.
Among them: a two-phase festival on hold that is offered, answered five
different ways, filled, confirmed and then cancelled; a three-day confirmed
show; a job brought in from Google Calendar; a call that isn't part of a
job; a job on hold whose call time and days move after someone is booked,
and which is then cancelled and set going again; and two jobs on one day,
to see a clash. After every press the script read what the office's screen
said, what Google and Meta had been asked to send, and what each person's
page and invite then said. The code each step runs was read to find where
it decides, and the design system's heuristics and behaviour rules were
the yardstick. *Reproduced* means it was seen happening; *inferred* means
it was read from the code.

Nothing live was read or changed. Nothing went near the real Google
Calendar, Gmail, WhatsApp, Railway or Neon, and nobody was contacted.
Every name below is made up. Screenshots are in the project folder under
`screens/audit-crew-offers/`.

## The short version

**20 findings: no P0, 6 P1, 7 P2, 7 P3.**

What works is in [What held up](#what-held-up). In short: the offer itself
is sound. The form says plainly that picking isn't offering, and names who
the one button offers to. The invite and the WhatsApp both say HOLD while
the client hasn't said yes, and the HOLD comes off both the moment the job
is confirmed. A freelancer's page does what it should on a phone: the
facts, the days to tick, a different rate, a No that asks twice, a way out
after a yes. The first to say yes has the place, nobody is booked twice on
a day, and the office is told when a Yes in Google couldn't be taken.

What gets in the way is that **the app sends one thing and says another**,
to the office and to the crew. Four patterns:

1. **The office isn't told the truth about what was sent, in either
   direction.** Before the press, the form promises a calendar invite that
   never goes for any job brought in from Google Calendar, any call that
   isn't part of a job, or a second offer after a No (finding 1). After
   the press, a panel says "Messages to crew are off. Nothing opened to
   send 3 people the offer" while Google has just emailed four invitations;
   and Withdraw, Release and Cancel crew call each ask a question that
   mentions only "their link", then email the person a cancellation for
   every day (5).
2. **The person is asked, and then never told again.** The offer reaches
   them by email, and on WhatsApp when that's on. After it, the app tells
   them nothing: not that the office has booked them, though three
   different places promise "the office will confirm" (4); not that their
   call time moved from 09:00 to 06:00 (4); and when the place goes to
   someone else, or the offer is withdrawn, the only word is Google's
   cancellation, with no reason (8).
3. **The invite and their own page disagree.** The invite says ON HOLD and
   their page says Booked (6). The invite asks about one named day and
   takes a Yes as every day (3). Someone who asked for a different rate is
   still asked to "Press Yes or No", and their Yes is dropped (7). The
   invite greets "Tomás" where their page greets "Tommo" (15), and has no
   rate, no day to answer by and none of the notes for crew (10).
4. **Words written for the office reach the crew.** A job's Notes box goes,
   whole, in the email to every person asked, before they have said yes;
   the box doesn't say so (2).

One idea sits under most of it: **the app should know, for each person on
each offer, what actually reached them and what they have been told since,
and say so in one line on their row**: "Invited by email, two days",
"On WhatsApp: read", "Nothing reached them: no email address, and WhatsApp
is off", "Not told they're booked yet". The office would stop having to
guess, and every gap below would show itself the day it happens.

Crew invites were tried on live on 11 November, with one real invite to
one person. Everything under P1 is what a real freelancer would meet from
the first real offer.

## The flow, step by step

What each press does, with invites on, messages to crew off, and WhatsApp
first off and then on. "Emails" are what the app asks Google to send.

| The office or the person does | What the app tells the office | What Google emails | On WhatsApp (when on) | What their page says |
|---|---|---|---|---|
| Office: picks three people for a two-day call (one has no email) | "Not offered yet. Aoife, Seán and Tommo don't know until you press Offer to 3 people. Pressing it also adds each of them to the day in Google Calendar, which emails them an invite. Seán has no email address, so no invite." | nothing yet | nothing yet | nothing yet |
| Office: **Offer to 3 people** | "Messages to crew are off. Nothing opened to send 3 people the offer. Their links already say so." (5) | 4 invitations, one a person a day, about two seconds later; none to Seán | `job_offer` to each mobile, the job named "HOLD …" while it's a quote, with Yes, No and See the details | "Offers waiting on you": role, dates, call time, venue, rate, reply by, the notes for crew, days to tick |
| Person: Yes in Google, on one day's invite | "To confirm. On Google Calendar: yes to Fri 27 Nov; no answer yet for Sat 28 Nov." Read within two minutes | nothing | nothing | "Nothing waiting right now", with the job listed as their next: both days are taken as a yes (3) |
| Person: Yes on their page | "To confirm" | nothing | nothing | "Thanks, you're down for it. The office will confirm." |
| Person: Yes on WhatsApp | "To confirm" | nothing | "Thanks, Niamh. You're down for … The office will confirm it with you." | the same |
| Person: asks for a different rate on their page | "Asked for more" | nothing; their invite still asks "Press Yes or No" (7) | nothing | "Rate sent to the office. €320 a day asked (offered €280)" |
| Office: **Confirm** a yes (Crew › Answers to check, or Next on a confirmed job) | "Messages to crew are off. Nothing opened to send Aoife Byrne the confirmation. Their link already says so." | nothing: the invite's first line changes without an email (4) | nothing (4) | "Booked" |
| Someone else's yes fills the call | Before: "whoever says yes first has it, and the rest are told it's filled" | a cancellation for each day to everyone still waiting, no reason given (8) | nothing | "Filled by someone else", in the last list on the page |
| Office: Withdraw an offer, or Release someone booked | "Withdraw the offer to Dara Kelly? Their link says it's withdrawn at once." Then, for a release: "Nothing opened to send Tomás Doyle the release." | a cancellation for each day (5, 8) | nothing | "Withdrawn by the office" |
| Person: declines, or says they can't make it, on their page | Answers to check: "Ciara Nolan can't make it. Was down for 2 days; the call is 1 short" | a cancellation for each day, to the person who just said no (8) | nothing | "Thanks for telling us you can't make it. You're off this one, and the office will find cover." |
| Person: No in Google, on every day | "Declined" | nothing: their No stays as a No | nothing | gone from their page |
| Office: moves a call time earlier, in the call's Change form | "Messages to crew are off. Nothing opened to send 4 people the change. Their links already say so." | nothing (4) | nothing (4) | "Call time 06:00 (was 09:00)" on the card, and under "Since you said yes" for a week |
| Client says yes: job from quoted to confirmed | nothing about crew | an update for each day to each guest: the title loses HOLD | `job_confirmed`, only to people whose own offer went on WhatsApp saying HOLD (12) | no change: it never said on hold (6) |
| Office: marks the job cancelled or lost | "Marking Quay Street Sessions cancelled also cancels its crew calls: 1 person offered or booked will see the job was cancelled." Then "Nothing opened to send Ciara Nolan the cancellation." | a cancellation for each day to each guest | `job_cancelled`, only to people whose own offer went on WhatsApp (12) | "The job was cancelled" |
| Office: Cancel crew call | "Cancel the call for 2 × Audio tech on Riverside Sessions? Everyone offered is told it's withdrawn." | a cancellation for each day | nothing | "Withdrawn by the office" |

### What five people got, start to finish

The made-up festival, on hold, a two-day Show call for two audio techs at
€280 a day, then confirmed, then cancelled.

| Person | What reached them | What never reached them |
|---|---|---|
| **Aoife**, answers in Google Calendar | 2 invitations. Later 2 updates when the HOLD came off. Later 2 cancellations when the job was cancelled | That her Yes to Friday was taken as Saturday too (her Saturday invite then read "Thanks Aoife, you said yes…"). That the office had booked her. Why the days were cancelled |
| **Tomás**, answers on his page | 2 invitations. Later 2 cancellations, no reason | Any answer to the €320 he asked for: the call filled first and closed it. That his later Yes in Google counted for nothing |
| **Seán**, no email address | Nothing, at any point | The offer, and that it was filled. He was never told; nothing on the office's screen said to ring him |
| **Ciara**, answers on her page | 2 invitations. 2 updates when the HOLD came off. 2 cancellations after she pulled out herself | Any word from the office after her yes, though her page said "The office will confirm" |
| **Niamh**, offered once WhatsApp was on | 1 invitation and the `job_offer` WhatsApp. 1 update and `job_confirmed` when the client said yes. A reply to her Yes on WhatsApp. `job_cancelled` and 1 cancellation at the end | That the office had booked her, after her Yes |

And one press on the confirmed three-day show, offering four people:
**12 invitation emails**. One invite a day is by decision
([Already decided](#already-decided-and-kept)); the count is here so it is
known.

### One invite, in full

What one person's own invite says, as Google holds it, for a job on hold.
This is Tomás's, after he asked for €320 on his page: it still asks.

```
HOLD Castle Yard Sessions - Show 1/2
East Pier, Dún Laoghaire Harbour, East Pier, Dún Laoghaire, Co. Dublin, A96 X0X0

Hi Tomás, are you available to work as Audio tech on Wed 2 Dec, call 08:00? Press Yes or No on this invite to let us know.

ON HOLD: the client hasn't said yes yet, so keep the day free but it isn't booked.
Job stage: Quoting (1 of 5)

Client: Harbour Events Ltd
Show, day 1 of 2: Wed 2 Dec to Thu 3 Dec

Venue: East Pier, Dún Laoghaire Harbour
East Pier, Dún Laoghaire, Co. Dublin, A96 X0X0
At the venue: Load-in by the east gate only. No vehicles on the pier after 10:00.

Crew
Audio tech, call 08:00: Dara Kelly, 2 TBC

Job notes
Client is price sensitive: hold the margin at 30%, do not discount crew. PO still to come from Mary.

Show notes
Doors 18:00. Curfew 23:00.

Your page, to answer or see your offers: (their own link)
```

With kit on the job and a quote, the day's pick list and the per diem and
fuel lines come before the link too (#331; read in the code, since the
made-up jobs had no kit).

## Findings

Each finding has a priority (P0: the office can't offer work, or an answer
is lost; P1: fix before real offers go to freelancers through the app; P2:
worth doing; P3: polish) and a severity from 0 to 4 on the usability scale
the design system uses (1 cosmetic, 2 minor, 3 major, 4 catastrophe). Each
names the heuristic or rule it breaks, what happens, what it costs, the
fix, and where the app decides it.

| # | Priority | Severity | Finding |
|---|---|---|---|
| 1 | P1 | 3 | The office is told a calendar invite will go when none does: jobs brought in from Google Calendar, calls that aren't part of a job, a second offer after a No. Afterwards nothing says so |
| 2 | P1 | 3 | A job's Notes box goes by email to everyone asked, before they've said yes, and the box doesn't say so |
| 3 | P1 | 3 | A Yes on one day's invite is taken for every day, and the other days' invites then thank the person for a yes they didn't give |
| 4 | P1 | 3 | Once the invite has gone, nothing tells a person the office has booked them, or that their call time has moved |
| 5 | P1 | 3 | The office is told "nothing opened to send" and "their link says so" while Google emails invitations and cancellations |
| 6 | P1 | 3 | On hold is said on the invite and on WhatsApp, but their page says "Booked", and the call sheet and the office's own message don't mention it |
| 7 | P2 | 2 | Someone who asks for a different rate is still asked "Press Yes or No", their Yes is dropped, their ask can be closed by someone else's yes, and "Say no" withdraws the whole offer |
| 8 | P2 | 2 | When an offer ends, the only word the person gets is Google's cancellation, with no reason; their own No reads as the office cancelling |
| 9 | P2 | 2 | On the job's own Crew tab, a yes waiting for the office and a rate asked for have nothing to press |
| 10 | P2 | 2 | The invite asks for a Yes without the rate, the day to answer by or the notes for crew, and the way to them is its last line |
| 11 | P2 | 2 | A crew call's days can be moved off its phase's days: anyone booked gets a cancellation, no new invite, and stays booked |
| 12 | P2 | 2 | The "confirmed" and "cancelled" WhatsApps reach only people whose own offer went on WhatsApp |
| 13 | P2 | 2 | An offer can't be taken back: the invites leave about two seconds after the press, and a wrong pick is followed by a cancellation for each day |
| 14 | P3 | 2 | Someone with no email address can't be reached from the app while messages are off, and "Send" on their row opens nothing |
| 15 | P3 | 1 | The invite greets people by their first name where their page and the office use the name they go by |
| 16 | P3 | 2 | An answer given on their page leaves the Google invite unanswered, so the office reads "Booked" beside "no answer yet"; a Yes the app couldn't take leaves the person believing they said yes |
| 17 | P3 | 1 | For staff, the offer is under Home › Me and the bell, and what follows is said about them, not to them |
| 18 | P3 | 2 | An invite Google refuses for one person is kept as failed and shown to nobody |
| 19 | P3 | 1 | A job cancelled and then set going again has no crew, and no way to ask the same people again |
| 20 | P3 | 1 | Small wording slips |

### P1: before real offers go to freelancers through the app

#### 1. The office is told a calendar invite will go when none does

**P1, severity 3** · 1 Visibility of system status; 5 Error prevention; principles rule 10 ("say what will happen, then show what did") · Offer form, the call's card, the freelancer's page · Seen: phone · Reproduced

- **What happens:** With invites on, the Offer form always ends "Pressing it also adds them to the day in Google Calendar, which emails them an invite." That is true only for a job made in the app, on days inside one of its phases, from today on. It was pressed for a job brought in from Google Calendar (every job from the two calendars is one: 903 on 16 October), and for a call that isn't part of a job (the kind made under "Crew for something not in Jobs" on Crew). Both times the form made the promise, the offer was made, and **no event was written and no email went**. Afterwards the call's card reads "Ciara Nolan · Offered · Send · Withdraw" with no line about the calendar at all: the line that would say "Invited on Google Calendar" is simply missing, which is easy to miss. Her own page still says, under that offer, "We also send a Google Calendar invite for each day to" her address. A third case: Aoife said No in Google to all three days, and the office offered her again. No email went, her three invites stayed as she left them, declined, and the office's card shows the new offer as "Offered · Said no on Google Calendar": her answer to the old offer, against the new one.
- **What it costs:** The office believes the person has been asked, and they haven't. With messages off and WhatsApp off, nothing else reaches them either, so the offer sits "Offered" until someone notices the silence. Jobs brought in from the two calendars are most of what the app holds, so for any of them still to come this is the usual case, not the odd one (live wasn't read to count them).
- **Fix:** Work the promise out per person from the same rule the server uses, and say the other half: "Aoife and Tommo get a calendar invite by email. Nothing is sent for this job from the app: it came from Google Calendar, so its days are the organiser's." After the press, every offer row says how the person was reached, or that they weren't ([the order to fix things](#the-order-to-fix-things), batch 1). The page's note shows only under offers that have an invite. A second offer after a No sends a fresh invitation and starts with no answer. Whether a brought-in job should send each person their own invite is [question 3](#questions-for-colly). An open change (#313, waiting on Colly's pick) takes "Crew for something not in Jobs" off Crew; calls already made without a job stay, so the form still has to tell the truth about them.
- **Where it is decided:** `web/src/crew/Calls.tsx:654` and `:697` (the promise follows the switch alone), `server/src/calendar/events.ts:341` (brought-in jobs are left out) and `:407` (only days inside a phase, from today), `shared/src/calendar.ts:251` (`offerOnCalendar` says nothing when there is no guest row), `server/src/crew/links.ts:300` and `server/src/crew/page.ts:698` (the page's note follows the switch and an email address alone)
- **Screenshots:** `41-office-offer-form-brought-in-job-phone.png`, `42-office-card-brought-in-job-phone.png`, `43-office-offer-form-loose-call-phone.png`, `30-office-card-mixed-answers-phone.png`

#### 2. A job's Notes box goes by email to everyone asked, before they've said yes, and the box doesn't say so

**P1, severity 3** · 5 Error prevention; 2 Match between the system and the real world; behaviour: a one-way door (an email can't be unsent) · Change details › Notes, the invite, the call sheet · Seen: phone · Reproduced

- **What happens:** A job's "Notes" box under Change details has no hint about who reads it. The made-up festival's said "Client is price sensitive: hold the margin at 30%, do not discount crew. PO still to come from Mary." Every person offered a place got it, under "Job notes", in each day's invitation email ([the invite in full](#one-invite-in-full)), before any of them had answered. It is also on the call sheet of anyone who has said yes, under "About the job". The invite carries the rest of the day's sheet too: the client's name, the crew line, the phase's notes, and with kit and a quote on the job, the pick list and the per diem and fuel lines (those two read in the code).
- **What it costs:** By decision the job's notes are part of what crew read ([ADR 0008](adr/0008-calendar-sync.md), [ADR 0021](adr/0021-call-sheets.md)), and that was written when the day was one shared event for people already on the job. Since 1.162.0 and 1.164.0 the same text is emailed to each freelancer who is merely asked, on jobs the client hasn't agreed yet. The office person typing a note about a price, a client or a colleague has no way to know that. The app's own rule for the call sheet is stricter: only people who have said yes can open it. This was offered to Colly on 11 November as "keep office-only notes out of invites"; it is shown here with the words a freelancer would read.
- **Fix:** Two boxes: "Notes for the crew", with the line "On the invite and the call sheet", and "Office notes", which never leave the app. Whether what is in Notes today stays where crew can read it, or all becomes office notes, is part of the question. And someone only asked gets the short invite (the question, the hold line, the day, the venue, the link to their page), with the full sheet once they have said yes. [Question 1](#questions-for-colly).
- **Where it is decided:** `server/src/calendar/events.ts:154` to `:166` (the description, "Job notes"), `web/src/jobs/JobScreen.tsx:580` (the box), `server/src/crew/sheet.ts:19` (the call sheet is only for a yes or a booking) and `:148` ("About the job")
- **Screenshots:** `55-freelancer-call-sheet-job-notes-phone.png`, `01-job-page-phone.png`

#### 3. A Yes on one day's invite is taken for every day, and the other days' invites then thank the person for a yes they didn't give

**P1, severity 3** · 2 Match between the system and the real world; 1 Visibility of system status · The invite, Answers to check · Seen: Google's side by script, the office on a phone · Reproduced

- **What happens:** Each invite now asks about one named day: "are you available to work as Audio tech on Fri 27 Nov, call 08:00? Press Yes or No on this invite to let us know." Aoife pressed Yes on Friday's and left Saturday's alone. The app took it as a yes to both days: her offer became accepted for Fri 27 and Sat 28. Her Saturday invite, still unanswered in Google, changed to "Thanks Aoife, you said yes to Audio tech on Sat 28 Nov, call 08:00. We'll confirm it with you soon." Her page says "Next: Harbour Lights Festival" and "Nothing waiting right now". The office's row is honest ("On Google Calendar: yes to Fri 27 Nov; no answer yet for Sat 28 Nov"), but Answers to check offers one button: "Aoife Byrne accepted on Google Calendar · Fri 27 Nov to Sat 28 Nov · Confirm".
- **What it costs:** A person is booked for a day they never agreed to, and their own invite tells them they did. The rule is the one decided on 30 September (ADR 0009: "A Yes to any day is a yes to the offer, for all its days except any they said No to"), when a day was a shared event with no question in it. Since 1.164.0 the invite asks a narrower question than the answer it takes.
- **Fix:** A Yes in Google counts for the day it was pressed on; days not answered stay asked, and each invite's first line follows that day's own answer. Confirm then books the days answered, and says which are still open. If the old rule is kept instead, each invite has to say it: "Yes on any day's invite means yes to both Fri 27 and Sat 28; press No on a day you can't do." [Question 2](#questions-for-colly).
- **Where it is decided:** `shared/src/calendar.ts:216` (`answerFromCalendar`), `server/src/calendar/events.ts:484` (the first line follows the offer, not the day's answer)
- **Screenshots:** `08-office-card-after-google-yes-one-day-phone.png`, `09-freelancer-page-after-google-yes-phone.png`, `13-office-answers-to-check-phone.png`

#### 4. Once the invite has gone, nothing tells a person the office has booked them, or that their call time has moved

**P1, severity 3** · 1 Visibility of system status; behaviour: Feedback Loops ("we look for information that provides clarity on our actions") · Confirm, Change a call · Seen: both sides · Reproduced

- **What happens:** Three places promise a confirmation. Their page: "Thanks, you're down for it. The office will confirm." Their invite: "We'll confirm it with you soon." The WhatsApp reply: "The office will confirm it with you." When the office then presses Confirm, **nothing is sent**: no email, no WhatsApp. The invite's first line changes to "Hi Aoife, you're booked as Audio tech…" without an email, because a change to the description is never sent (ADR 0009: "The greeting is description, so it changes quietly"). The office's panel says "Nothing opened to send Aoife Byrne the confirmation. Their link already says so." The same when a booked person's call time moved to 06:00: no email and no WhatsApp, and the office is told "Nothing opened to send 4 people the change. Their links already say so." Their page does say "Call time 06:00 (was 09:00)", which is good, if they open it.
- **What it costs:** A freelancer holding a day for a yes they gave has no word that it's theirs, and may take other work or ring the office to ask. One whose call moved three hours earlier finds out only by opening their page. On a calendar that isn't Google's (Outlook, iCloud), a change that isn't emailed never arrives at all, so their calendar entry keeps asking "are you available?" and keeps the old call time (*inferred* from ADR 0009's own note that those calendars only hear by email). The rule not to email description changes was made for crew lists and notes, which change often; being booked and a new call time are not that.
- **Fix:** Being booked, and a changed call time, are news to that person and are sent. On the calendar: their own copy's title carries their standing and call time ("Booked: Harbour Lights Festival - Show 1/2, call 06:00"), so either change is a title change, which Google already emails; to be tried on the test calendar first. On WhatsApp: two more templates, "you're booked" and "your call time changed", for anyone WhatsApp reaches. And the office's panel says what went. This widens "emails only when they matter": [question 4](#questions-for-colly).
- **Where it is decided:** `server/src/crew/handlers.ts:639` (`offer.confirm` changes the offer and queues nothing), `server/src/calendar/sync-guests.ts:91` (`withGuests`: title, day and place are sent, the description isn't), `server/src/whatsapp/follow-ups.ts:17` (only a job's own change of status queues a follow-up), `web/src/jobs/NextDock.tsx:171`
- **Screenshots:** `14-office-after-confirm-phone.png`, `36-office-after-next-confirm-phone.png`, `15-freelancer-page-confirmed-phone.png`, `61-office-after-call-time-change-phone.png`, `46-freelancer-page-call-time-moved-phone.png`

#### 5. The office is told "nothing opened to send" and "their link says so" while Google emails invitations and cancellations

**P1, severity 3** · 1 Visibility of system status; 4 Consistency and standards; principles rule 10 · The panel after Offer, Confirm, Release and Cancel; the questions before Withdraw, Release and Cancel crew call · Seen: phone · Reproduced

- **What happens:** There are two switches for two ways out of the app: messages to crew (off) and crew invites (on). The panel that follows every press knows only about the first. Right after "Offer to 3 people" sent four invitation emails it read: "Messages to crew are off. Nothing opened to send 3 people the offer. Their links already say so." The questions before the presses that take something away mention only the link: "Withdraw the offer to Dara Kelly? Their link says it's withdrawn at once." (Google then emailed him 3 cancellations.) "Release Tomás Doyle from this call? The days they're booked for go back to it, and their link says so at once." (2 cancellations, then "Nothing opened to send Tomás Doyle the release.") "Cancel the call for 2 × Audio tech on Riverside Sessions? Everyone offered is told it's withdrawn." (3 cancellations.) "Send" on an offered row opens the same "Nothing opened" panel.
- **What it costs:** The office learns from the screen that nothing leaves the app, and then presses Withdraw or Release to tidy up, each of which emails a real person. The reverse too: "their link already says so" is said even about someone no invite or message has reached, who has never been sent their link. [ADR 0048](adr/0048-messages-to-crew-off-until-said.md) noted the two switches as an open point and rated it 1 "both off"; with one on and one off it is this.
- **Fix:** One sentence, built from what happened to those people, in place of the panel: "Aoife and Tommo were emailed a calendar invite for each day. Nothing reached Seán: he has no email address, and WhatsApp is off." And each question names the email: "Withdraw the offer to Dara Kelly? Google emails him that his three days are cancelled." No decision needed; it is wording and one worked-out line.
- **Where it is decided:** `web/src/crew/Messages.tsx:143` (the panel), `web/src/crew/Calls.tsx:281`, `:282` and `:330`, `web/src/crew/CrewScreen.tsx:512` and `:513` (the questions)
- **Screenshots:** `03-office-offer-form-three-picked-phone.png`, `04-office-after-offer-messages-off-phone.png`, `32-office-withdraw-question-phone.png`, `37-office-release-question-phone.png`, `38-office-after-release-phone.png`, `40-office-cancel-call-question-phone.png`, `31-office-send-while-messages-off-phone.png`

#### 6. On hold is said on the invite and on WhatsApp, but their page says "Booked", and the call sheet and the office's own message don't mention it

**P1, severity 3** · 4 Consistency and standards; 2 Match between the system and the real world; behaviour: Loss Aversion (a freelancer turns down other work for a day they believe is theirs) · The freelancer's page, the call sheet, the Send panel, the invite · Seen: phone · Reproduced

- **What happens:** On a job the client hasn't said yes to, the invite's title starts HOLD and its second line is "ON HOLD: the client hasn't said yes yet, so keep the day free but it isn't booked." The WhatsApp names the job "HOLD …". Nothing else does. The person's page shows the same offer with no word about it, and once the office confirms them it says **"Booked"**. Their call sheet says "(the office will confirm)" or nothing. With messages on, the words the office is handed to send by WhatsApp, text or email are "Hi Tommo, are you free for Quay Street Sessions (Show)? Audio tech, Sat 12 Dec, call 09:00…", with no hold. And the invite of someone the office has confirmed on a held job reads, under a title starting HOLD: "Hi Dara, you're booked as Audio tech on Wed 2 Dec, call 08:00. Here's the info for the day." followed by "ON HOLD: … keep the day free but it isn't booked."
- **What it costs:** "Booked" and "it isn't booked" about the same day, depending on where the person looks. The app's own word table keeps "Booked" for the person and "Confirmed" for the client's yes (`shared/src/words.ts:10`), so the person's standing is said without the job's. Colly asked on 11 November for HOLD on the invite and the WhatsApp; the page, the call sheet and the hand-sent message were not in that work.
- **Fix:** Wherever a person reads their standing on a job that's on hold, the hold is said with it: on their page a line on the card, "On hold: the client hasn't said yes yet. Keep the day free; we'll tell you when it's confirmed", and the pill reads "Booked, on hold" (or "Pencilled in", the planner's word for the same thing); the same line heads the call sheet; the office's message opens "HOLD: are you free for…"; and the invite's first line for someone the office has picked on a held job says "you're pencilled in as Audio tech…: we'll book you the moment the client says yes" rather than "you're booked". Small, and no decision needed beyond the wording.
- **Where it is decided:** `server/src/crew/page.ts:157` (the page's words) and `:253`, `server/src/crew/sheet.ts:44`, `shared/src/crew.ts:515` (`offerMessage`; `jobOnHold` is at `:537` and is used only for WhatsApp), `server/src/calendar/events.ts:124`
- **Screenshots:** `49-freelancer-booking-card-hold-job-phone.png`, `47-freelancer-call-sheet-hold-job-phone.png`, `44-office-send-panel-messages-on-phone.png`, `06-freelancer-page-offer-waiting-phone.png`

### P2: worth doing

#### 7. Someone who asks for a different rate is still asked "Press Yes or No", their Yes is dropped, their ask can be closed by someone else's yes, and "Say no" withdraws the whole offer

**P2, severity 2** · 1 Visibility of system status; 3 User control and freedom · The invite, the call's card, Answers to check · Seen: both sides · Reproduced

- **What happens:** Tomás asked for €320 on his page, which says "Rate sent to the office. €320 a day asked (offered €280)" and offers "Accept these days at €280 a day instead". His invites went on saying "Hi Tomás, are you available…? Press Yes or No on this invite to let us know." He pressed Yes on both. The app read both answers and did nothing with them: by rule a counter waits for the office (ADR 0009). The office's card read "Tomás Doyle · Asked for more · Said yes on Google Calendar", with nothing to say the Yes didn't count. Then another person's yes filled the call, and his ask was closed as "Filled by someone else" without the office having answered it. Separately, the office's "Say no" to a rate asks "Say no to Tomás Doyle at €350? The offer is withdrawn…": saying no to the rate takes the whole offer away, though he might have done it for €280.
- **What it costs:** The person believes they have said yes twice. The office reads a yes beside a rate request and can't tell which stands. A freelancer worth paying €40 more for can be lost to a faster yes with no one deciding it.
- **Fix:** The invite's first line for a counter: "Thanks Tomás, your rate request is with the office. Nothing is agreed yet: we'll come back to you." A Yes in Google after a counter shows on the office's row as "Pressed Yes in Google after asking for more: ring them", not as a plain yes. A call about to fill while a rate is unanswered says so before the confirm that fills it. "Say no" keeps the offer open at the rate offered, with Withdraw as its own choice ([question 6](#questions-for-colly)).
- **Where it is decided:** `server/src/calendar/events.ts:122` (no words for a counter), `shared/src/calendar.ts:225` (answers are taken only for an offer that is open, declined or accepted), `server/src/crew/handlers.ts:120` (`closeIfFull` closes counters too), `web/src/crew/CrewScreen.tsx:512`
- **Screenshots:** `11-freelancer-page-after-counter-phone.png`, `12-office-card-counter-and-google-yes-phone.png`, `45-office-say-no-to-rate-phone.png`, `17-freelancer-page-filled-phone.png`

#### 8. When an offer ends, the only word the person gets is Google's cancellation, with no reason; their own No reads as the office cancelling

**P2, severity 2** · 9 Help users recognise, diagnose and recover from errors; behaviour: bad news said plainly, once · Filled, withdrawn, released, call cancelled, declined, pulled out · Seen: Google's side by script, their page on a phone · Reproduced (that the emails go; how Google words them was not seen)

- **What happens:** When a place goes to someone else, an offer is withdrawn, a booked person is released, a crew call is cancelled, or the person declines or pulls out on their own page, their own copy of each day is deleted and Google tells them it is cancelled: one email a day. The app adds no reason, and nothing goes on WhatsApp. The reason is on their page: for a booking, at the top under "Since you said yes"; for an offer that was only waiting, as one line in the last list on the page, "Declined and withdrawn": "Filled by someone else on Thu 12 Nov". Ciara declined a three-day offer on her page and was sent three cancellations for it; pulled out of a two-day one and was sent two.
- **What it costs:** "Cancelled" in an inbox, about a job a freelancer had kept days free for, reads as the job being off. They can't tell filled from withdrawn from cancelled without opening their page and scrolling to the end. Someone who said no themselves gets what looks like the office cancelling on them.
- **Fix:** Before a copy is deleted, change its title and first line without an email, then delete it, so the one notice they get carries the reason in its title: "No longer needed (filled): Harbour Lights Festival - Show 1/2", "Thanks for letting us know: …" for their own no. To be tried on the test calendar, since how Google shows a cancelled event's last title wasn't seen. On WhatsApp, one more template for "this one's gone to someone else" and "the office has withdrawn this". On their page, an offer that ended since they last looked says so at the top, once.
- **Where it is decided:** `server/src/calendar/sync.ts:741` (a person's copy is deleted with "tell the guests" on), `server/src/crew/page.ts:920` (the last list), `server/src/crew/page.ts:658` ("Since you said yes" is only for bookings)
- **Screenshots:** `17-freelancer-page-filled-phone.png`, `39-freelancer-page-released-phone.png`, `25-freelancer-page-decline-phone.png`, `18-freelancer-page-cant-make-it-phone.png`

#### 9. On the job's own Crew tab, a yes waiting for the office and a rate asked for have nothing to press

**P2, severity 2** · 6 Recognition rather than recall; 7 Flexibility and efficiency of use · Job › Crew, the call's card · Seen: phone and desk · Reproduced

- **What happens:** On a call's card, an "Offered" row has Send and Withdraw, and a "Booked" row has Withdraw. A "To confirm" row and an "Asked for more" row have nothing. Confirming a yes, or agreeing or refusing a rate, is done on another page: Crew › Answers to check. On a confirmed job the Next button says "Confirm Tommo's yes", which is good; on a job still being quoted, where early offers now go out on HOLD, Next says "Make a quote" and nothing on the job points to the answer.
- **What it costs:** The office sees "Aoife Byrne · To confirm" on the job they're working on and has to remember where confirming lives. Since 1.162.0 that is the usual place to be standing: crew are asked while the job is a quote.
- **Fix:** The same actions Answers to check has, on the row: Confirm and Release on a yes; "Agree €320" and "Say no" on a rate. Next on a held job can still lead with the quote, with "1 answer to check" beside it.
- **Where it is decided:** `web/src/crew/Calls.tsx:266` and `:271`, `web/src/jobs/NextDock.tsx:156` to `:197`
- **Screenshots:** `57-office-card-one-of-each-phone.png`, `58-office-crew-tab-one-of-each-desk.png`, `59-office-crew-answers-to-check-desk.png`

#### 10. The invite asks for a Yes without the rate, the day to answer by or the notes for crew, and the way to them is its last line

**P2, severity 2** · 6 Recognition rather than recall; 8 Aesthetic and minimalist design · The invite · Seen: Google's side by script · Reproduced

- **What happens:** The invite's first line asks for a Yes or No. What a freelancer needs to decide is on their page, not in the invite: the day rate, "Reply by Tue 17 Nov", and the call's own notes ("Bring your own tools and hi-vis"). The link to their page is the last line, under the client, venue, crew, notes and, with kit on the job, the whole pick list. A Yes in Google is a full acceptance.
- **What it costs:** A person can accept from the email without having seen what they are paid, and the office gets a yes at a rate the person may then dispute. The rate was left out of calendar days by rule ("never rates or phone numbers") when a day was one event shared by everyone on it.
- **Fix:** The second line of a person's own invite: "Your rate, the details and how to answer by Tue 17 Nov: (their link)". The rate itself can stay out, since each person's copies sit on the connected account's own calendar, where anyone with that calendar open would read it ([question 5](#questions-for-colly)).
- **Where it is decided:** `server/src/calendar/events.ts:153` to `:176` (`description`: the link is added last)
- **Screenshots:** none: [the invite in full](#one-invite-in-full); the page beside it is `06-freelancer-page-offer-waiting-phone.png`

#### 11. A crew call's days can be moved off its phase's days: anyone booked gets a cancellation, no new invite, and stays booked

**P2, severity 2** · 5 Error prevention · Change a call · Seen: by command and Google's side · Reproduced

- **What happens:** A call that belongs to a job's phase has free From and To dates in its Change form, with no check against the phase. Ciara was booked on a Show call on Sat 12 Dec; the call was moved to Sun 13 Dec while the Show phase stayed on the 12th. She was emailed a cancellation for the 12th and nothing for the 13th, because calendar days exist only for a phase's days, and she is still booked, for the 13th, with no entry in her calendar.
- **What it costs:** A booked person with a cancellation in their inbox and a booking they can't see. Rare, since a day that moves is usually moved on the phase, but nothing stops it and nothing says it happened.
- **Fix:** For a call on a phase, the days are picked from the phase's own days (tick them), or the form says "The Show is on Sat 12 Dec: move the phase to move its crew". A call left outside its phase's days says so on its card.
- **Where it is decided:** `web/src/crew/Calls.tsx:395` (the form), `server/src/crew/handlers.ts:512` (`call.update` checks only that the end isn't before the start), `server/src/calendar/events.ts:408`
- **Screenshots:** none

#### 12. The "confirmed" and "cancelled" WhatsApps reach only people whose own offer went on WhatsApp

**P2, severity 2** · 4 Consistency and standards · Job confirmed, job cancelled or lost · Seen: Meta's side by script · Reproduced

- **What happens:** When the festival was confirmed, and later cancelled, the follow-ups went to Niamh alone: she was offered after WhatsApp was turned on. Aoife, booked on the same job and offered before the switch, got only Google's updates and cancellations. This is as decided ([ADR 0125](adr/0125-offers-go-on-whatsapp-by-themselves.md): "Everyone asked or booked on it who had an offer on WhatsApp").
- **What it costs:** On the day WhatsApp is turned on for real, everyone already asked or booked is outside it for the life of those offers. A booked freelancer hears a job is off from a bare calendar cancellation while the person beside them gets "sorry: … isn't going ahead, so you're not needed".
- **Fix:** A job's "confirmed" and "cancelled" messages go to everyone asked or booked whom WhatsApp can reach, whether or not their offer went that way. [Question 7](#questions-for-colly).
- **Where it is decided:** `server/src/whatsapp/follow-ups.ts:32` to `:52`
- **Screenshots:** none

#### 13. An offer can't be taken back: the invites leave about two seconds after the press, and a wrong pick is followed by a cancellation for each day

**P2, severity 2** · 3 User control and freedom; principles rule 1 (undo beats asking) · Offer · Seen: phone; the delay *inferred* from the code

- **What happens:** After "Offer to 3 people" there is no Undo. The calendar is written about two seconds after the last change, and each person is emailed one invitation a day. Withdrawing a wrong pick sends them a cancellation for each of those days.
- **What it costs:** With a hundred freelancers, two with the same first name are one slip apart, and the form's list stays open for picking several. The form does say what the press will send, which is the right first half; there is no second half.
- **Fix:** Hold an offer's invites for 30 seconds: "Offered to Aoife, Seán and Tommo. Invites go in 30 seconds. Undo." The offer itself is made at once, as now.
- **Where it is decided:** `server/src/calendar/sync.ts:139` (two seconds), `web/src/crew/Calls.tsx` (the form: no undo)
- **Screenshots:** `03-office-offer-form-three-picked-phone.png`

### P3: polish

#### 14. Someone with no email address can't be reached from the app while messages are off, and "Send" on their row opens nothing

**P3, severity 2** · 1 Visibility of system status · The call's card · Seen: phone · Reproduced

- **What happens:** Seán has a mobile and no email. The form says "Seán has no email address, so no invite" before the press, and his row says "No email address, so no calendar invite" after it: both good. But his row's one way forward is "Send", which with messages off answers "Nothing opened to send Seán Murphy the offer. Their link already says so." He has never been sent his link. On the festival he was offered, and later "filled", and never heard of either.
- **Fix:** A row nothing reached offers the plain contact that ADR 0048 keeps: "Ring" and "WhatsApp", his number a press away, with "Nothing has reached Seán" beside it. With WhatsApp on, he is reached that way.
- **Where it is decided:** `web/src/crew/Calls.tsx:266`, `web/src/crew/Messages.tsx:143`
- **Screenshots:** `60-office-send-no-email-person-phone.png`, `07-freelancer-page-no-email-phone.png`, `57-office-card-one-of-each-phone.png`

#### 15. The invite greets people by their first name where their page and the office use the name they go by

**P3, severity 1** · 4 Consistency and standards · The invite · Reproduced

- **What happens:** The invite says "Hi Tomás"; his page says "Hi Tommo" and the office's form says "Tommo".
- **Fix:** The invite uses the same name as everything else.
- **Where it is decided:** `server/src/calendar/events.ts:354` (reads the first name) against `shared/src/crew.ts:198` (`firstName`: the name they go by first)

#### 16. An answer given on their page leaves the Google invite unanswered, so the office reads "Booked" beside "no answer yet"; a Yes the app couldn't take leaves the person believing they said yes

**P3, severity 2** · 1 Visibility of system status · The call's card, the invite · Seen: phone and desk · Reproduced

- **What happens:** Dara said yes in the app and was booked; his row reads "Booked · Invited on Google Calendar; no answer yet." The same for anyone who answers on their page: the invite's first line follows their answer, but in Google it still shows as unanswered. The other way round: Niamh pressed Yes in Google for a day she was already booked on elsewhere. The office is told well ("Said yes on Google Calendar, but the app couldn't take it: Already booked on Bandstand Sunday (Show) Tue 22 Dec", and a row in Answers to check). Niamh is told nothing: her Google shows her Yes.
- **Fix:** Once a person has answered another way, the row says "Answered on their page" rather than "no answer yet". When a Yes can't be taken, the invite's first line says so: "Thanks Niamh, but you're already down for another job that day: ring the office."
- **Where it is decided:** `shared/src/calendar.ts:251` to `:293`, `server/src/calendar/sync.ts:617` (the office is told; the invite isn't changed)
- **Screenshots:** `57-office-card-one-of-each-phone.png`, `54-office-card-yes-not-taken-phone.png`

#### 17. For staff, the offer is under Home › Me and the bell, and what follows is said about them, not to them

**P3, severity 1** · 2 Match between the system and the real world · Home, Notifications · Seen: phone · Reproduced

- **What happens:** A member of staff who can book crew opens Home on its Company or Department view, where nothing mentions their own offer; it is under Me ("1 offer to answer") and in the bell. The first notice is said to them: "You've been offered Audio tech on Castle Yard Sessions". The ones after it are the history's words: "Confirmed Dara Kelly for Audio tech on Castle Yard Sessions", "Withdrew the offer of Audio tech on Riverside Sessions to Dara Kelly". Answering on the job page ("You on this job": "Yes, I can do it", "No, I can't") works well.
- **Fix:** "You're booked as Audio tech on…", "Your offer of Audio tech on… was withdrawn", as #316 did for a closed offer. An offer waiting on you shows on Home whichever view is open.
- **Where it is decided:** `web/src/notices.ts:178` (only the offer itself is reworded), `server/src/history-words.ts:325`, `web/src/home/HomeScreen.tsx:76`
- **Screenshots:** `26-staff-home-phone.png`, `34-staff-home-me-phone.png`, `56-staff-notifications-confirmed-phone.png`, `28-staff-you-on-this-job-phone.png`

#### 18. An invite Google refuses for one person is kept as failed and shown to nobody

**P3, severity 2** · 9 Help users recognise, diagnose and recover from errors · The call's card, the job's Phases tab · Seen: phone · Reproduced, with the stand-in made to refuse one person's invite

- **What happens:** When Google turned down one person's own copy, the app kept it as failed with "Google turned this day down (invalid). It is tried again when the job changes, and each night." The office's card for that person read "Offered · Send · Withdraw" and nothing else; the job's calendar line and Home said nothing, because they read only the shared day.
- **Fix:** The person's row says "Invite not sent: Google turned it down. Check the address." Part of the one line in batch 1.
- **Where it is decided:** `shared/src/calendar.ts:166` (`phaseOnCalendar` reads the shared day only) and `:251`
- **Screenshots:** `53-office-card-invite-refused-phone.png`

#### 19. A job cancelled and then set going again has no crew, and no way to ask the same people again

**P3, severity 1** · 3 User control and freedom · Change details › Status · Seen: phone · Reproduced

- **What happens:** Marking a job cancelled cancels its crew calls, and the question before it says who will see that, which is good. Setting it back to Confirmed leaves the calls cancelled, by design ("starting it again doesn't bring them back"). The Crew tab then shows "2 × Audio tech · Cancelled" and "No crew asked for yet", and nobody is told the job is back.
- **Fix:** On a job set going again: "Its crew calls were cancelled on 12 Nov. Ask for the same crew again", which makes the calls again and opens Offer with the same people picked, not yet offered.
- **Where it is decided:** `server/src/projects/handlers.ts:184` to `:197`
- **Screenshots:** `50-office-cancel-job-question-phone.png`, `52-office-crew-tab-after-restart-phone.png`

#### 20. Small wording slips

**P3, severity 1** · 2 Match between the system and the real world · Reproduced

- "whoever says yes first has it, and the rest are told it's filled" and "Everyone offered is told it's withdrawn": they are told only by Google's cancellation (8), or not at all with no email address (14). Say what happens.
- "adds each of them to the day in Google Calendar": since 1.164.0 each person gets their own invite; nobody is added to the shared day.
- "Their link already says so", even about someone no invite or message has reached.
- "Filled by someone else" and "Withdrawn by the office" sit under the heading "Declined and withdrawn" on the person's page, though they did neither. "Offers that ended" covers all four.
- "Invited on Google Calendar; no answer yet" beside "To confirm" or "Booked" (16).
- Where they are decided: `web/src/crew/Calls.tsx:697`, `:712` and `:330`, `web/src/crew/Messages.tsx:143`, `server/src/crew/page.ts:920`

## Already decided, and kept

These were looked at and are not findings. Each is Colly's decision, and
the audit found nothing that argues against it.

- **Invites go when the office presses Offer**, not when the person is
  booked (1 October, again 9 November), and a Yes in Google is one way to
  agree.
- **One invite a day** (11 November). A three-day call offered to four
  people is twelve emails from one press; a two-day call to three people
  with an email is six. Counted here so it's known, and kept.
- **Each person's own invite, opening with a line for them** (11 November).
  The copies sit on the connected account's own calendar: one two-day call
  with three people invited put six entries there. Fine while nobody reads
  that calendar day to day; worth knowing if operations@'s own calendar is
  one people look at.
- **HOLD while the client hasn't said yes**, and the "confirmed" WhatsApp
  the moment the job is confirmed (11 November).
- **WhatsApp on for everyone, theirs to turn off** (9 November).
- **A No in Google stays a No** and isn't followed by a cancellation.
- **A booking the office has confirmed isn't undone by an answer in
  Google**: the office is shown it and decides.
- **The day to answer by is information.** Nothing closes when it passes;
  the office gets a "no reply" row in Answers to check (read in the code).
- **The first invite from a sender Google doesn't know** is held back until
  the person presses Add to calendar; their page says so (#330). The same
  line belongs in the WhatsApp template's words when it's set up in Meta.

## Earlier findings, re-checked

- **The two switches** ([ADR 0048](adr/0048-messages-to-crew-off-until-said.md),
  18 October, "Open", rated 1: "both are on Admin, both off, and each says
  what it does when on"). With invites on and messages off it is finding 5,
  rated 3.
- **Office-only notes in invites** (offered to Colly on 11 November, not
  yet answered). Finding 2, now with the words a freelancer would read, and
  found on the call sheet too.
- **Limits noted when invites were built** (30 September). "A second offer
  after a No carries the old answer": still true, and part of finding 1.
  "A bad address makes that day fail": the app now refuses a malformed
  address when a person is saved, and since 1.164.0 a refusal touches only
  that person's own copy, but nobody is told (18). "A guest removed by hand
  in Google is put back at the next check": not re-checked.
- **A refusal names the job** (20 October, finding 49). Held: "Already
  booked on Bandstand Sunday (Show) Tue 22 Dec."
- **Their link says how a booking ended, in its own words** (UX sweep,
  6 November, move 6). Held for a job cancelled or lost, a release and a
  place filled. Where it falls short is that the page is the only place
  that says it (8).

## The order to fix things

Six batches. The first two need no decision and are mostly words.

**Built so far.** Colly picked the first two on 12 November 2026. Batch 1
is in 1.165.0 ([ADR 0149](adr/0149-the-office-is-told-what-the-app-sent.md))
and batch 2 in 1.166.0 ([ADR 0150](adr/0150-hold-means-hold-the-day.md)).
Two things differ from what is written below. Colly put the meaning of
HOLD right before batch 2 was built: it is short for "hold the day", the
ask of the crew, and never the job being on hold. So where this audit says
"on hold", "Booked, on hold" or "Pencilled in", what was built says "Hold
the day". And the second half of finding 16, saying on the invite that a
Yes pressed in Google couldn't be taken, moved to batch 4: it needs the
invite to be written from the answers Google holds, which is a change to
how the calendar is kept in step rather than to its words.

Colly answered the seven questions the same day with "Go with yours": each
takes the recommended answer below, and batches 3 to 6 are being built in
the order 5, 4, 3, 6, notes first because an email can't be unsent. Batch 5
is in 1.167.0 ([ADR 0151](adr/0151-notes-for-the-crew-and-office-notes.md)).
It differs from what is written below in one thing: the short invite keeps
the per diems and fuel, which are about the crew's own money and are on
neither their page nor the call sheet. Batch 4 is in 1.169.0
([ADR 0152](adr/0152-a-yes-counts-for-its-own-day.md)). It differs in one
thing too: Say no keeps the offer for the days the rate was asked for,
not every day of the call, so nobody is invited again to a day they had
left out. Batch 3's calendar part is in 1.170.0
([ADR 0153](adr/0153-crew-invites-tell-what-happens-next.md)), behind its
own switch, "Tell crew what happens next", which starts off and can be
tried on the office's own addresses first. It differs in two things: a
person's own No is titled "You declined:", the words their page and the
office already use, rather than "Thanks for letting us know:"; and an
offer that ended on the office's side is shown in its place at the top of
their offers while that's news, as an ended booking is, rather than once.
The WhatsApp part, three more templates and question 7, is in 1.172.0
([ADR 0154](adr/0154-whatsapp-tells-crew-what-happens-next.md)), under
WhatsApp's own switch rather than one of its own. It differs in two
things: someone picked to hold the day hears nothing until the client
says yes, then that they're booked; and nothing follows an offer to
someone who never heard of it, whose offer is still waiting to go or was
turned down by Meta and who hasn't answered another way. Batch 6's first
part, each person's own invite on a job brought in from Google Calendar
(question 3) and a fresh invitation after a No, is in 1.173.0
([ADR 0157](adr/0157-own-invites-for-jobs-brought-in.md)). It differs in
two things: the offers already on those jobs keep none, so deploying it
emails nobody, and each row says why, the organiser's guest or offered
before; and calls that aren't part of a job wait on #313, which asks
whether new ones can still be made. Finding 11, a call's days tied to its
phase, is in 1.174.1
([ADR 0159](adr/0159-a-crew-call-keeps-to-its-phase.md)). It differs in
one thing: the days are picked with From and To among the phase's days
rather than ticked, as a call's days are one run, and a phase that moves
takes its crew along when keeping their dates would leave them out.
Finding 13, Undo on an offer, is in 1.178.0
([ADR 0162](adr/0162-undo-just-after-offer.md)). It differs in one thing:
the WhatsApp waits with the invites, as it reaches the person too.

1. **Say what was sent** (findings 5, 1, 14, 18, 16, 20). One line on every
   offer row, worked out from what happened: "Invited by email, 2 days",
   "On WhatsApp: read", "Nothing reached them: no email address, and
   WhatsApp is off", "Invite not sent: Google turned it down", "Answered on
   their page". The Offer form's promise, the panel after each press and
   the questions before Withdraw, Release and Cancel are built from the
   same facts. Small to medium. **Done in 1.165.0**, bar the invite's
   line for a Yes that couldn't be taken (now in batch 4).
2. **On hold everywhere, and the invite's first lines** (6, 7's first
   line, 15, 10). The hold on the page, the call sheet and the office's
   message; words for a rate request; the name they go by; the link to
   their page second. Small. **Done in 1.166.0**, as "Hold the day".
3. **Tell people what happens next** (4, 8, 12). Booked, a changed call
   time and "no longer needed" reach the person: by a calendar update whose
   title says it, tried on the test calendar first, and by WhatsApp
   templates once Meta is set up. Medium. Needs question 4, and 7 for who
   the WhatsApps reach. **Calendar part done in 1.170.0**, behind a switch
   that starts off. **WhatsApp part done in 1.172.0**, under WhatsApp's
   own switch.
4. **Answers** (3, the rest of 7, 9, the rest of 16). A Yes counts for
   its own day; a Yes after a rate request is flagged; a Yes that couldn't
   be taken is said on the invite; a call doesn't fill over an unanswered
   rate without saying so; "Say no" keeps the offer; Confirm and Agree on
   the job's own rows. Medium. Needs questions 2 and 6. **Done in
   1.169.0.**
5. **Notes** (2). Notes for the crew and office notes; the short invite
   until someone has said yes. Medium. Needs question 1. **Done in
   1.167.0.**
6. **Reach and recovery** (the rest of 1, then 11, 13, 19, 17). Each
   person's own invite for jobs brought in from Google Calendar and for
   calls with no job; a call's days tied to its phase; Undo on an offer;
   asking the same crew again; staff notices said to them. Larger. Needs
   question 3. **First part done in 1.173.0**: the invites for jobs
   brought in, and a fresh invitation after a No. **A call's days tied to
   its phase done in 1.174.1. Undo on an offer done in 1.178.0.**

## Questions for Colly

1. **Who are a job's notes for?** Recommended: two boxes, "Notes for the
   crew" (on the invite and the call sheet) and "Office notes" (never leave
   the app), and someone only asked gets the short invite until they say
   yes.
2. **A Yes on one day's invite: that day, or every day?** Recommended:
   that day. Each invite now asks about one day by name.
3. **Should an offer on a job brought in from Google Calendar send the
   person their own invite?** Recommended: yes. Their copy sits on the
   connected account's calendar and doesn't touch the organiser's event.
   Until then the form must say that nothing is sent (finding 1).
4. **Should the app tell a person when they're booked, when their call
   time changes, and when they're no longer needed?** Recommended: yes, by
   an email from the calendar and, when it's on, a WhatsApp. This widens
   the 30 September rule that only a change of title, day or place is
   emailed, and needs three more templates approved in Meta beside the
   three already listed.
5. **Should a person's own invite name their rate?** Recommended: no,
   because the copies sit on the connected account's calendar; move the
   link to their page up to the second line and say the rate is there.
6. **Saying no to a rate: should the offer stay open at the rate
   offered?** Recommended: yes, with Withdraw as a separate choice.
7. **When WhatsApp is turned on, do people already asked or booked get
   the "confirmed" and "cancelled" messages?** Recommended: yes, for anyone
   it can reach.

## What held up

- **The Offer form** (#336): "Not offered yet", who doesn't know, what the
  press sends, who has no email address, one filled button that names
  them, and more people than places said before it goes.
- **HOLD**: on the invite's title and second line and in the WhatsApp's
  job name; it comes off both the moment the job is confirmed, with one
  update a day to each guest and the `job_confirmed` WhatsApp.
- **The freelancer's page, on a phone**: role, dates, call time, venue,
  rate, the day to answer by and the notes for crew; days to tick; "Ask
  for a different rate or add a note"; a No that asks again ("Once
  declined, it's off your page: only the office can offer it to you
  again"); "Can't make it?" after a yes, with the office's number; taking
  two days of three takes them off the third.
- **What changed since a yes**: "Call time 06:00 (was 09:00)" on the card
  and under "Since you said yes" for a week; "the job was cancelled" and
  "withdrawn by the office" in their own words.
- **First to say yes has the place** (seen on the page; the same rule
  serves Google and WhatsApp); nobody is booked on two jobs on one day,
  and the refusal names the other job.
- **Answers to check**: every yes, rate, pull-out and odd answer in one
  list with Confirm, Release and Noted, and the per-day line from Google
  ("yes to Fri 27 Nov; no answer yet for Sat 28 Nov").
- **A No in Google** declines without an email back (a Maybe waiting was
  read in the code, not pressed).
- **WhatsApp**: the offer's eight facts and three buttons, and the reply
  to a Yes, were seen. The No's second question, STOP, and only the
  offer's own number counting, were read in the code.
- **Emails only for what changed**: a new crew line, job stage or note on
  the day emails nobody, so a busy job doesn't flood anyone. The same rule
  is what finding 4 asks to widen, for two changes only.
- **Guests can't see each other**: each invite has one guest, and no
  address is shown to another freelancer.
- **Stopping a job** asks first and says how many people will see it.
- **Staff answer in the app**, from the job page, without a link.
- **Turning invites on lists who it reaches** before it does (#328; read
  in the code, since the local copy started with them on).
