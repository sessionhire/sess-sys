# ADR 0130: A quote emailed is marked sent only once Gmail has it

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("Work on all of these in order
  overnight", then "Go"), batch 6 of the
  [audit of the quote flow](../audit-quote-flow-2026-11-08.md): finding 5,
  which was to be fixed before sending quotes by email is turned on in live.
- **Changes:** [ADR 0101](0101-sending-a-quote-to-the-client-by-email.md)
  (sending a quote by email), where the server marked the quote sent before
  handing it to Gmail.

## Context

Pressing Send marked the draft sent, which gave it its number and moved an
enquiry to quoted, and only then drew the PDF and handed it to Gmail. When
Gmail turned it down, the office was told "Nothing was sent; try again in a
minute", while the quote showed as Sent, numbered, with the follow-up clock
running: a quote that never reached the client would be chased as if it
had. A number taken by another quote in between was only found after
marking. And the PDF was drawn from the server's copy, so a change still
waiting on the device could be left off it, then refused once it was sent.

## Decision

1. **The number first, then Gmail, then sent.** The server gives the draft
   its number (the one the compose box showed, or it says another quote
   took it, before anything is given), draws the PDF as the sent quote with
   that number and today's date, and hands it to Gmail. Only once Gmail has
   taken it is the quote marked sent, as the person's own change, the
   enquiry moved to quoted and the email recorded.
2. **Turned down, it says where the quote stands.** "Gmail is busy… Nothing
   was sent. It keeps number 1043 and is still a draft: send it again, or
   print it." The number stays, so sending again or printing it uses the
   same one.
3. **The device's changes go first.** Send waits for what's typed on the
   device to reach the server; if it can't, it says so and sends nothing,
   so the PDF never leaves out a change.

## Consequences

- A quote shows as sent only when it went.
- A draft can now hold a number while it's still a draft, after a send that
  didn't go. It prints with that number and keeps it when it's sent.
- Sending by email is still off in live, and nothing here sends anything.

## Not done

- A number given on Print, before marking sent, for the office without
  email: Get the PDF to send (ADR 0127) marks it sent and opens it in one
  press, which closes most of that gap.
