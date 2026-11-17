# ADR 0150: HOLD means "hold the day", and it is said wherever a person reads where they stand

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who picked "The two batches
  with no decisions" from the
  [audit of crew offers](../audit-crew-offers-2026-11-12.md). This is the
  second, findings 6, 10 and 15 and the first line of 7. The wording is
  Colly's, the same morning: "the HOLD is short for 'Hold the day' rather
  than the job being on hold."
- **Builds on:** [ADR 0008](0008-calendar-sync.md) (a job not yet confirmed
  goes on the calendar as HOLD once crew are asked),
  [ADR 0009](0009-crew-invites.md) (each person's own invite and its first
  line), [ADR 0125](0125-offers-go-on-whatsapp-by-themselves.md) (HOLD on
  WhatsApp) and [ADR 0149](0149-the-office-is-told-what-the-app-sent.md)
  (the office is told what the app sent).

## Context

Since 11 November, a job the client hasn't said yes to goes on the calendar
as soon as crew are asked for it, with HOLD at the front of each day's
title, and the WhatsApp offer names the job "HOLD ...". The audit found
that nothing else said it:

- A person's own page showed the same offer with no word about it, and once
  the office picked them it said **Booked**. Their invite for the same day
  said, under a title starting HOLD, "you're booked as Audio tech" and then
  "it isn't booked".
- Their call sheet, and the message the office is handed to send by
  WhatsApp, text or email, didn't mention it.
- The invite went on asking someone who had asked for a different rate to
  "Press Yes or No", when neither settles anything.
- The invite greeted people by their first name where their page and the
  office use the name they go by, and the way to their page, which has
  their rate and the day to answer by, was its last line, under the crew,
  the notes and the pick list.

A freelancer turns down other work for a day they believe is theirs, so
"Booked" and "it isn't booked" about one day is the costly kind of
inconsistency.

The audit proposed "on hold" for the line and "Booked, on hold" or
"Pencilled in" for the pill. Colly corrected the meaning before any of it
was built: HOLD is the trade's short way of saying **hold the day**. It is
an ask of the crew member. It does not mean the job is paused, which is
what "on hold" says.

## Decision

1. **One meaning, in one place.** `HOLD_WORDS` in `shared/src/words.ts`
   holds every sentence that explains it. HOLD stays at the front of a
   calendar day's title and of the job's name on WhatsApp, as Colly asked
   for on 11 November. Anything that explains it, or tells a person where
   they stand on such a job, says "hold the day". Nothing a person reads
   says "on hold".

2. **What a person reads on a job the client hasn't said yes to** (an
   enquiry, or quoted):

   | Where | Before | Now |
   | --- | --- | --- |
   | The calendar day, under its title | "ON HOLD: the client hasn't said yes yet, so keep the day free but it isn't booked." | "HOLD means hold the day: the client hasn't said yes yet, so please keep it free. Nothing is booked until they do." |
   | Their page, the pill of someone the office has picked | Booked | **Hold the day**, in the tone of something not settled yet |
   | Their page, each card | nothing | "Hold the day: the client hasn't said yes yet, so please keep it free. Nothing is booked until they do." Before they answer: "A yes from you means you'll keep the day free; nothing is booked until the client says yes." Under the pill that already reads Hold the day, the line starts at "The client hasn't said yes yet", so the words aren't said twice. |
   | Their call sheet, and the office's | nothing | The same line, first, under the days. The office's is about the crew: "Crew are asked to keep it free". |
   | Home › Me, their page in the app, "You on this job" | Booked | Hold the day, with the same line on the job; the count reads "1 booked, 1 to hold", and "Your weeks" draws the day as waiting to confirm, not confirmed |
   | The office's offer message | "Hi Tommo, are you free for Quay Street Sessions (Show)?" | "Hi Tommo, can you hold the day for Quay Street Sessions (Show)? The client hasn't said yes yet, so nothing is booked until they do." |
   | The office's message after it picks someone | "Hi Tommo, you're confirmed for ..." | "Hi Tommo, we have you down for ..., so please hold the day. The client hasn't said yes yet: it's booked once they do." The email's subject is "Hold the day: ...". |
   | The panel after Confirm (ADR 0149) | "their link says they're booked" | "their link says to hold the day, as the client hasn't said yes yet" |

   When the client says yes, every one of these reads as any booking does,
   with no change needed from anyone.

3. **The first line of a person's own invite says where they stand.**

   | They are | The client has said yes | Not yet |
   | --- | --- | --- |
   | asked | "Hi Nim, are you available to work as LX on Wed 6 Mar, call 09:00? Press Yes or No on this invite to let us know." | "Hi Nim, can you hold Wed 6 Mar for us, to work as LX, call 09:00? Press Yes or No on this invite to let us know." |
   | have said yes | "Thanks Nim, you said yes to ... We'll confirm it with you soon. Here's the info for the day." | "Thanks Nim, you said yes to ... Please hold the day: it isn't booked yet, and we'll confirm it with you." |
   | picked by the office | "Hi Nim, you're booked as ... Here's the info for the day." | "Hi Nim, we have you down as ... Please hold the day: it's booked once the client says yes." |
   | have asked for a rate | "Thanks Nim, your rate request for ... is with the office. Nothing is agreed yet: we'll come back to you." | the same |

   A rate request has words of its own because a Yes or No pressed on the
   invite settles nothing while the office hasn't answered it (ADR 0009),
   so the invite stops asking for one. It names no figure.

4. **By the name they go by.** The invite uses `firstName`, as their page
   and the office's messages do: the name they go by, then their first
   name, then the first word of their name.

5. **Their page is the second line.** "Please answer by Mon 4 Mar. Your
   rate and the details are on your page, where you can answer too:
   (their link)". Staff are paid through payroll, so theirs names no rate.
   Once they have answered: "Your rate, the call sheet and the details are
   on your page: ...". After a rate request: "To change your answer or see
   the details, use your page: ...". The day to answer by is said only
   while an answer is wanted and the day hasn't passed. The link is no
   longer repeated as the last line. The rate itself stays out of the
   invite, as each person's copies sit on the connected account's own
   calendar (question 5 of the audit is still Colly's to answer).

## What this sends

Nothing new. Every change here is to an event's description or to words on
a screen, and a change of description is never emailed (ADR 0009: only a
title, a day or a place that changes is). A test holds that an answer, a
rate request, the office's pick and the day to answer by passing each
rewrite the first lines and email nobody.

On the first run after this is deployed, every person's own invite and
every HOLD day from today on is rewritten once with the new lines, quietly,
with no email.

## Considered

- **"On hold", "Booked, on hold" or "Pencilled in"**, as the audit
  proposed. Rejected on Colly's word: it is the day that is held, not the
  job. "Pencilled in" stays the planner's word for a job, which is a
  different thing from a person's place on one.
- **Changing HOLD in the title to "HOLD THE DAY".** No: a title is read in
  a calendar's month grid, where every character counts, HOLD is what the
  trade writes, and Colly asked for it by name. The line under the title
  says what it is short for.
- **"Hold the day" on the office's own card for the call**, where it says
  Booked. Left as it is: that pill is the office's own account of its
  offer, and the same word as on every other job. The job's page says what
  the HOLD on its calendar days means, and the panel after Confirm says
  what the person is told.
- **Naming the rate in the invite.** Left for question 5.

## Left for later, on purpose

- **The invite doesn't yet say when a Yes pressed in Google couldn't be
  taken** (the second half of finding 16). The office is told, as before.
  Saying it to the person means writing the invite from the answers Google
  holds, which is a change to how the calendar is kept in step rather than
  to its words, so it goes with the Answers batch (batch 4 in the audit's
  order).
- **The replies the app sends on WhatsApp** after a Yes or No there say
  nothing about HOLD and were left alone.
- **The WhatsApp templates** aren't set up in Meta yet, so
  `docs/whatsapp-setup.md` now gives `job_confirmed` as "the client has
  said yes, so it's going ahead" in place of "it's no longer on hold".
  Once a template is approved, its words can only change by approving it
  again.

## Consequences

- A new sentence that explains HOLD goes in `HOLD_WORDS`, never inline.
- A surface that shows a person's place on a job and can know the job's
  status says "Hold the day" for someone picked on a job the client hasn't
  agreed. One that can't know (a call that isn't part of a job) says
  Booked, as now: such a call has no client to wait for.
- The server reads the job's status once more for a person's page (one
  small query for all their jobs).
