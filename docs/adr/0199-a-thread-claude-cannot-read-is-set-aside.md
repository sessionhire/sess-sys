# ADR 0199: A thread Claude can't read is set aside

- **Status:** accepted
- **Date:** 26 November 2026
- **Asked for by:** Colly, 26 November 2026, "The integration is quite opaque
  at the moment. Can you look into ways to improve that." Looking into it
  found this first.
- **Amends:** [ADR 0098](0098-claude-drafts-quotes-from-the-mailbox.md)
  (point 2: how a look at the mailbox goes)

## Context

Each look at the operations mailbox reads up to six threads, oldest first.
When one of them failed (Claude didn't answer, its answer was too long to
finish or couldn't be read, or the app turned down the job or quote it
made), the whole look stopped. The same thread was first in line five
minutes later and failed again: each try was paid for, and the mail behind
it was never read. The last look's time stayed old, nothing was set as the
problem, and Admin › Status still showed the mailbox as fine.

## Decision

1. **A thread that fails is that thread's problem.** The look carries on
   with the rest. Only Google turning the app away (a key it no longer
   accepts, or no access) still stops the look, as before.
2. **Three tries, then set aside.** A thread is tried at most three times in
   a row at the same mail. After the third its mail is marked read, so it
   isn't asked about or paid for again. New mail on the thread starts it
   again from one try, and a thread that reads is forgotten.
3. **Kept in `mail_failures`:** the thread's Gmail id, how many mails it had,
   the tries, why in words (Claude's own reason, or "The app turned down
   what Claude made from it"), when, and whether it was set aside. No
   subject, sender or text, so there is nothing of anyone's to erase.
4. **Admin › Status says so.** The mailbox check warns while a thread failed
   in the last week, says how many were set aside or will be tried again,
   and gives the latest reason, with what to do: quote it by hand or paste
   it into New quote.

## Consequences

- One stubborn thread costs at most three asks, not one every five minutes.
- An enquiry set aside isn't drafted. Status says that it happened, but not
  which mail, since no subject is kept; a log of what Claude read, if built,
  would show it.
