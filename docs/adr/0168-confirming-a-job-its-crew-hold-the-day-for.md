# ADR 0168: Confirming a job its crew hold the day for

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026: "Finish the audits work",
  after answering the seven questions of the
  [audit of crew offers](../audit-crew-offers-2026-11-12.md) with "Go with
  yours". This is what the audit's batches left open on the office's side.
- **Builds on:** [ADR 0009](0009-crew-invites.md) (crew invites),
  [ADR 0149](0149-the-office-is-told-what-the-app-sent.md) (the office is
  told what a press sends), [ADR 0150](0150-hold-means-hold-the-day.md)
  (Hold the day), [ADR 0153](0153-crew-invites-tell-what-happens-next.md)
  and [ADR 0154](0154-whatsapp-tells-crew-what-happens-next.md) (crew are
  told what happens next).
- **Changes:** ADR 0150's words reach the office's own call card; ADR
  0149's asking first and saying after covers confirming a job, and
  marking it lost from a quote.

## Context

On a job the client hasn't said yes to, crew are asked to hold the day
(ADR 0150). Their page, their invite, Home and the call sheet said so, but
the office's own call card still said "Booked" of someone it had picked,
and drew the call green, settled, as if the client had said yes.

Confirming such a job reaches everyone asked to hold the day. Their days
lose HOLD from the title, a change Google emails each person invited (ADR
0009), and WhatsApp tells those picked that they're booked and the rest
that it's going ahead (ADR 0154). Nothing said so before the press or
after it: ADR 0154's heuristic check left it at 3. It could be pressed
from six places: Change details' Status, the Confirmed task, the Next
dock, a quote's "Client accepted: confirm the job", and "Confirm the job"
on a quote's What happened and on Money's To follow up.

Marking a job lost asks first when it has crew calls open, saying what
their links will say (ADR 0149), from Change details and the Confirmed
task. From a quote's What happened and Money's To follow up it didn't.

## Decision

1. **The call card says Hold the day.** Someone picked on a job the
   client hasn't said yes to reads "Hold the day" in amber where a booking
   reads "Booked", in their row's pill and in the line under the call
   ("Orla Byrne (hold the day)"). A call filled that way stays amber until
   the client says yes. Releasing them asks about "the days they're
   holding". The words are `HOLD_WORDS.name`, the ones their page uses.
2. **Confirming asks first, wherever it's pressed,** when anyone was asked
   to hold the day: "Confirm Harbour Lights? The 3 people asked to hold the
   day will see it's going ahead: Google emails each of them that HOLD is
   off their days, and a WhatsApp tells them so." With no invite and no
   WhatsApp: "… will see it's going ahead on their links. Nothing is sent
   to them." With invites switched off since: "Crew invites are off, so
   HOLD stays on the days in their calendars." Nothing is asked when nobody
   was asked to hold the day, as nothing goes to anyone then
   (`confirmingWords` in `shared/src/reach.ts`, `confirmQuestion` in
   `web/src/jobs/jobStatus.ts`).
   - The Next dock's "Confirm the job" opens the Confirmed task with the
     question already asked and its safe answer, "Keep it as it is", in
     focus: the question is asked where the answer is (ADR 0152), not in
     the dock.
   - A quote's "Client accepted: confirm the job" and the "Confirm the job"
     on What happened and To follow up ask in their own place.
3. **The panel after says what went**, under "Harbour Lights is
   confirmed": "Google is emailing Aoife and Dara that HOLD is off their
   days", and "has emailed" once the server has written them; "A WhatsApp
   saying they're booked is going to Dara"; "Nothing was sent to Seán:
   their link says it's going ahead"; with invites switched off since, that
   HOLD stays on their days; with the calendar in trouble, that they still
   have HOLD on their days (`toldOfConfirm`). With messages to crew on, the
   panel opens a message for each instead: "… is confirmed: the client has
   said yes, so you're booked" for those picked, "… is going ahead" for the
   rest (`tellMessage('job-confirmed')`).
4. **Marking a job lost from a quote or To follow up asks first** when it
   has crew calls open, in the words its details and task use, and says
   after what went (ADR 0149).
5. **A press that ends its own card says what went at the screen's
   level:** on the job's page, as a quote's buttons go with the answer;
   above Money's list, as the row goes with the press.

## What this sends

Nothing new. Confirming took HOLD off the days and sent the WhatsApps
before (ADR 0150, ADR 0154); this says so before and after. The question
can only keep a job as it is.

## Considered

- **Asking only on the job's own details and task.** Rejected: most
  answers are recorded on the quote, and a press that reaches crew asks
  first wherever it is (ADR 0149).
- **Saying it only after.** Rejected: Google's email can't be unsent.
- **Confirming from the dock in one press, with the question in the
  dock.** Rejected: the dock is one line under the thumb; the task card
  has the room, and is where the job's answer is recorded.
- **"Booked (hold the day)" on the card.** Rejected: one word for a state
  on every surface (`shared/src/words.ts`), the one their own page uses.

## Consequences

- On a job with crew holding the day, the dock's "Confirm the job" takes
  two presses: to the question, then the answer. With nobody asked it
  still confirms in one.
- A call filled by people holding the day is amber until the client says
  yes. Only the colour changes: counts and Next read as before.
