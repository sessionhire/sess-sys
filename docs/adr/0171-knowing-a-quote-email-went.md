# ADR 0171: Knowing a quote's email went

- **Status:** accepted
- **Date:** 13 November 2026
- **Asked for by:** Colly, 13 November 2026 ("On the quote send button we
  need to put in the maximum level of feedback to ensure that the quote
  was actually sent and to give confidence through visual feedback as to
  the current state"); stages 1 and 2 picked from the investigation the
  same morning
- **Builds on:** [ADR 0101](0101-sending-a-quote-to-the-client-by-email.md) (sending a quote
  from operations@), [ADR 0130](0130-a-quote-is-sent-once-gmail-has-it.md)
  (numbered as it goes, sent once Gmail takes it) and
  [ADR 0166](0166-send-the-quote-from-next.md) (Send from Next)
- **Changes:** what the email's Send does and says while it goes and after.

## Context

Pressing Send on the email to the client was one request of up to a
minute: save the device's changes, number the quote, draw the PDF, hand it
to Gmail, record it. The button said "Sending…" and, when it worked, the
box closed and a quiet line said when it was emailed. Nothing said it had
reached the mailbox's Sent folder, and a phone that lost signal while
Gmail had already taken it showed an error: pressing Send again emailed
the client a second time.

What can be known about an email is limited. Gmail taking it, and it
being in the mailbox's Sent folder, are certain. A bounce or a client's
reply comes back into the same conversation in the mailbox (stage 2).
Whether it reached the inbox rather than spam, and whether it was opened,
can't be known honestly: tracking pixels are opened by Apple Mail and
Gmail's image proxy for the reader, and ask for consent under the
ePrivacy rules, so the app doesn't use them.

## Decision

1. **One press, one email.** The compose box makes a key when it opens and
   sends it with Send. The server holds the key while the email goes and
   keeps it on the record after: the same key asked again gives back the
   email it made, or says it's still going, and never sends again. Gmail
   turning it down lets the key go, so Send can be pressed again.
2. **No answer is asked about, not repeated.** When the phone gets no
   answer (no signal, the minute ran out), Send says "Checking whether it
   went…" and asks the server by the key every few seconds: gone (shown as
   gone), not gone ("It didn't go: … Press Send to try again"), or not
   known because the server stopped part way (look in Sent first).
3. **Each step said.** Send is busy at once and, past a second, says
   "Saving your changes…", "Sending…" or "Checking whether it went…"; the
   job's Next says the same. The fields can't change while it goes.
4. **Gone is said plainly.** The box closes and a toast says "Quote 1115
   sent to anna@client.ie", from which mailbox and whether a copy went.
   The email's line on the quote leads with a tick and "Sent".
5. **Read back from Sent.** Once Gmail takes it, the server reads the
   message back; when Gmail has filed it under Sent, the record says so
   ("In the Sent folder of operations@…"), looked at again ten seconds on
   if Gmail is slow. This needs only the reading the mailbox connection
   already has.
6. **A copy to whoever sends it.** "Send me a copy" is on by default
   (Default Effect): the copy goes as a Bcc, so the client doesn't see it,
   and the sender has the proof in their own inbox. It's not offered when
   the sender is the mailbox itself.
7. **Addresses checked before Send.** As the box opens and as To is left,
   each address's domain is asked of the DNS (an MX record, or the
   domain's own address; a "null MX" takes no mail). A domain that can't
   take email stops Send with the reason under To, rather than bouncing
   later. A slip in a common domain ("gmial.com", ".con") is suggested with
   a one-press fix, and doesn't stop Send. No signal, or a DNS that doesn't
   answer, stops nothing.
8. **Not a form in a form.** The email opens under the draft, which is a
   form; the email's own Send pressed the browser into sending the outer
   page, which reloaded the app. The email is now a group with
   `role="form"` and its Send a plain button.

## Consequences

- The server keeps `send_key`, `copy_to` and `in_sent_at` on each quote
  email, and a small `quote_email_sends` table of presses being sent. A
  press the server stopped part way through stays there and is said as
  "can't tell whether it went".
- `GET /api/quotes/:id/email/sends/:key` says where a press is;
  `POST /api/quotes/email/check` checks addresses.
- Stage 2, watching each email's conversation for a bounce, a delay or a
  reply, builds on the same record.
