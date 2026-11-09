# ADR 0127: The quote due today comes first, and sending is getting the PDF

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("Work on all of these in order
  overnight", then "Go"), batch 3 of the
  [audit of the quote flow](../audit-quote-flow-2026-11-08.md): findings 7,
  14 and 18.
- **Builds on:** [ADR 0081](0081-starting-a-quote-and-following-it-up.md) (To follow up),
  [ADR 0073](0073-a-jobs-steps-and-who-has-each.md) (the job's tasks, with a due day and
  someone on each), [ADR 0033](0033-home-and-finding-your-way-around.md)
  (Home's counts).

## Context

"Quote wanted by" on New quote became the due day of the job's Quote sent
task. Nobody was on that task, a task shows as late only once its day has
passed, and Quotes listed drafts last, in "Not sent yet", by how long since
they were saved. So the quote that mattered today was found by memory,
with a median of three days between an enquiry and its show.

With email off, as it is in live, the draft's one red press was "Mark as
sent", whose hint said to print it and send it yourself. The office had to
say it was sent to get the numbered PDF it then sent, and the sent quote's
one red press was then "Client accepted", with Print plain below. And
"Accepted already, by phone?" recorded a yes without the last look that
sending gets.

## Decision

1. **Drafts in the order they're wanted.** To follow up lists drafts by
   the day the client wants each (the Quote sent task's due day, while
   it's open), then by the job's first day, those with neither last. Each
   row says "Wanted today", "Wanted Tue 11 Nov" or "Was wanted Mon 10 Nov".
2. **Wanted today leads.** Drafts wanted today or already are their own
   group, "Wanted today (N)", at the top of To follow up, the late ones in
   amber, and Home counts them for the office ("N quotes wanted today"),
   opening that group.
3. **A draft for a job that's over** moves to "Not sent, the job is over",
   under the rest, so it doesn't crowd the ones there's still time for.
4. **Whoever starts the quote is on its task**, from New quote and from a
   planner day's card, so the task isn't down to nobody.
5. **Sending is getting the PDF.** With email off, the draft's red press is
   "Get the PDF to send". It marks the quote sent on the day given, which
   gives it its number, and opens it to print or save as a PDF. While the
   quote was sent today and hasn't been printed on this page, Print is the
   quote's red press and Client accepted is plain. After that the client's
   answer is the red one again. With email on, nothing changes: Send to the
   client, or "Sent another way? Mark as sent".
6. **Accepted by phone gets the last look.** "Record it as accepted" asks
   the same "Before it goes" questions as sending, with "Record it anyway".

## Consequences

- The quote due today is the first thing on Quotes and a count on Home.
- No quote is marked sent without its numbered PDF being opened.
- Nothing stored changes. "Printed on this page" is the page's own memory
  and goes when it's left, so a quote sent today and printed earlier shows
  Print as the red press once more if the page is opened again that day.
  That's the safe way round.

## Not done

- A number given before the quote is marked sent, so the office could
  print first and say it's sent after, as the audit suggests. That needs a
  numbered-but-not-sent state on the server. Getting the PDF in the same
  press as marking it sent closes most of the gap without one.
