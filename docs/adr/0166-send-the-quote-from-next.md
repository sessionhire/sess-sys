# ADR 0166: Send the quote from Next

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, from a phone, with two
  screenshots of a job's Quote tab (version 2 a draft, "Get the PDF to send"
  in the quote's card, and the dock over the bar saying "Record the client's
  answer below, under What happened."): "this is the right place on mobile
  for the cta/next with the progress pie", and "can we default that to just
  send quote when it's completed? With a jump to the email cover letter with
  the pdf already attached that the system sends through the operations
  mailbox. Leave a separate link to download the pdf locally".
- **Builds on:** [ADR 0104](0104-stages-tasks-and-one-next-button.md) (the
  one Next button, docked over the bar on a phone),
  [ADR 0101](0101-send-a-quote-by-email.md) (the quote by email from the
  operations mailbox, behind its switch),
  [ADR 0140](0140-one-job-one-path.md) (Send never leaves the strip; the
  quote is the job's Quote tab) and
  [ADR 0161](0161-the-job-heads-right-hand-column.md) (Next with its pie).
- **Changes:** ADR 0140 part 4's "with the Quote tab open during Quoting,
  Next says what to do in words, so the quote's Build or Send is the page's
  one red". Next is now the Send, and the draft's own Send in its strip is
  plain.

## Context

On a phone the dock over the bar is where the thumb is and where every other
stage's press lives. On the Quote tab it held only words, and the one red was
the draft's Send, in the sticky strip at the top of the quote, which scrolls
in and out of view with the card. With a new version drafted after one has
gone, it was worse: the job's task is the client's answer, so the dock said
to record it below, while what was actually next was sending the new
version.

## Decision

**A finished quote is sent from Next.** While the job is being sold (its
task is the quote, or the client's answer), and a draft version has lines:

- On the Quote tab, Next *is* the draft's Send. It says what a press does,
  **Send quote**, or what stops it ("Send: 1 line to finish", "Send: a term
  to put right"), and a press does exactly what the strip's button does:
  the last look before it goes, then the email. The draft tells Next
  through a small store (`web/src/jobs/quoteSend.ts`), as a call's Offer
  tells Next who's picked (`offerPicks.ts`).
- From another tab, Next says **Send quote** and opens the Quote tab, and
  the draft sends as it opens.
- A new version drafted after one went leads the client's answer, until
  the client has said yes to one.

**Send quote jumps to the cover email,** the compose box ADR 0101 made,
from operations@ with the numbered PDF named as attached and Look at the
PDF beside it. While it's open its own Send is the press, so Next says in
words that the email is below, to read over and send. Nothing goes until
that Send is pressed.

**Download the PDF sits apart,** as Next's quiet second link on the phone
and beside Print a draft in the draft's Send section, so the PDF can be
kept or sent another way without marking anything. It is the PDF as it
stands (a draft's says it's a draft), saved as a file
(`/api/quotes/:id/pdf?download=1`).

**While quotes don't go by email,** as now until launch (the switch under
Admin › Connections stays off, and the app contacts nobody), Next says
**Get the PDF to send** instead, and does what that has done since the
quote flow audit (finding 14): marks the quote sent, which numbers it, and
opens the numbered PDF to print or save. Next never says Send quote when a
press couldn't send. A press made from another tab waits until the server
has said whether quotes go by email, so it never marks a quote sent while
it was meant to open the email.

A job past Quoting keeps its own Next (crew, kit, the pick): a draft made
then is sent from the draft's own Send, as before.

## Design

- **One job of the view:** get this version of the quote to the client.
- **Behaviour:** Default Effect: the usual next step is the button already
  under the thumb, and it reads as a verb and its object. The office stays
  in control (the email is read before it goes), and the old way is kept
  as a quiet link, never a second red.
- **Heuristics:** visibility of status (Next names what stops sending, and
  its press leads there); consistency (every stage's press in one place);
  error prevention (the last look before it goes, unchanged; never Send
  quote when it can't send).
- **Departure:** none from the design system; ADR 0140's words-only dock on
  the Quote tab is undone, as above.

## Consequences

- The strip's Send is plain everywhere; on a desk Next sits at the top of
  the head's right-hand column (ADR 0161), and the strip still says what
  stops it.
- Nothing about who is contacted changes: quote email stays behind its
  switch, off on live.
