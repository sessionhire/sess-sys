# ADR 0172: Watching a quote's email for a week

- **Status:** accepted
- **Date:** 13 November 2026
- **Asked for by:** Colly, 13 November 2026 (stage 2 of the investigation
  into the quote's Send, picked with stage 1)
- **Builds on:** [ADR 0171](0171-knowing-a-quote-email-went.md) (knowing a
  quote's email went) and [ADR 0101](0101-sending-a-quote-to-the-client-by-email.md)
  (sending a quote from operations@)
- **Changes:** what the app hears back after a quote's email has gone.

## Context

After ADR 0171 the office knows the email left: Gmail took it and it's in
the Sent folder. What happens next is where quotes get lost. An address
with a typo the DNS check can't see (`anna@` for `ana@`) bounces minutes
later into the operations mailbox, where nobody is looking, and the office
waits days for an answer that was never going to come. A delay notice says
the client's server is struggling. A reply from the client sits in the
mailbox until someone opens it.

All three come back into the same Gmail conversation the quote started, so
the app can see them by reading that one conversation, without reading
anything else in the mailbox.

## Decision

1. **A watcher on each email for seven days.** The server looks at each
   quote email's Gmail conversation: every five minutes in its first hour
   (when bounces come), every half hour on its first day, then every six
   hours until it's a week old. At most ten a minute, so a busy week is
   caught up over a few minutes. Only the headers and Gmail's one-line
   preview are read, never a reply's body. It runs whether Claude-in-app
   is on or not, and needs only the reading the mailbox connection already
   has.
2. **What it hears.** A delivery report from the mail system (from
   mailer-daemon or postmaster, or a delivery-status report) is a bounce,
   said with the address it failed for and why in the office's words
   ("the address doesn't exist", "their mailbox is full", "their mail server
   turned it away"); one that says it's still trying is a delay. Anything
   else that came after the email, and isn't the office's own mail, is the
   client's reply. Each is said once.
3. **Where it's said.** On the quote's email, as a line under it: Bounced
   (bad), Delayed (amber), Replied with Open in Gmail, or "Watching for a
   bounce or a reply until Thursday". In the history as the app's own
   change, so the person who sent it is told in their notifications
   ("Something you sent"). A bounce also turns the job's Next into "Fix
   address and resend", which opens the email with the address that failed
   ready to put right; is a card on Home for money roles ("A quote email
   bounced"); and is the line on the job's Board card.
4. **Healthy is quiet.** An email that went and is being watched shows a
   tick and a plain line; only a bounce or delay uses colour, so the office
   isn't trained to ignore it (principles: colour means something).

## Consequences

- `quote_emails` keeps when it was last looked at, the messages already
  read, and the bounce, delay and reply it heard.
- A delay that is followed by a bounce shows only the bounce.
- Opens and inbox-versus-spam still can't be known, as ADR 0171 says.
