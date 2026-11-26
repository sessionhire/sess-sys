# ADR 0200: Seeing what Claude read and did

- **Status:** accepted
- **Date:** 26 November 2026
- **Asked for by:** Colly, 26 November 2026, the day Claude was turned on on
  live: "The integration is quite opaque at the moment. Can you look into ways
  to improve that." Of four ways offered, Colly chose all four: a log, a
  status line on the switch, a mark on what Claude made, and a notification.
- **Builds on:** [ADR 0098](0098-claude-drafts-quotes-from-the-mailbox.md)
  (Claude drafts quotes from the operations mailbox),
  [ADR 0199](0199-a-thread-claude-cannot-read-is-set-aside.md) (a thread it
  can't read is set aside), [ADR 0058](0058-notifications.md)
  (notifications)

## Context

Once Claude was on, the office could see a thread only after Claude had made
it into a job, and only under Money › To follow up. A thread Claude took to
be nothing to quote vanished with no reason given, so a missed enquiry
couldn't be found. Spend was one total for the month. The switch said "On"
whether or not the mailbox was connected and being read. A job Claude made
was marked only in its notes and its history, and nobody was told it had
come.

## Decision

1. **Admin › Claude** is a part of Admin of its own, for those who change
   settings and see money. It holds the switch, moved from Company, and the
   log.
2. **The switch says what Claude is doing now,** in a pill and a sentence, as
   Admin › Status would: Reading (the account, and when it last looked),
   Needs a look (threads it couldn't read this week), Not reading (the
   mailbox isn't connected, or Google stopped it), Stopped (the month's limit
   is used), or Waiting (no key on the server).
3. **Claude's log, "What Claude read":** each time a thread is read, a line
   in `mail_reads` with the subject, the sender, how many mails, what Claude
   decided (a new enquiry, about a job, not for a quote; or, from the app,
   not sent to Claude, couldn't read, set aside), why in one sentence, what
   it made or changed (the job, a client or venue it added, the job's days,
   the quote drafted or brought up to date, changes offered, the thread
   linked to a job), what the read cost, and any problem. It shows
   Everything, Made something, Not for a quote, and Problems, with counts.
4. **Claude gives the reason in the same answer.** The mail schema gains
   `reason`, so seeing why costs no second ask. A reply without one is read
   as "".
5. **What it made is marked** "Drafted by Claude" (a job, on its row, Board
   card and head) or "Added by Claude" (a client or venue, on its row and
   page) while only Claude has touched it. For a job, that means the job and
   all its quotes. This is read from the history, so nothing new is kept.
   The mark is quiet muted text beside the status, with no colour of its
   own: it says whose the first draft was, not that anything is wrong.
6. **Directors and the office are told on their bell** of each new enquiry
   Claude made: "New enquiry from the operations mailbox: Nissan launch.
   Claude drafted the job and its quote; check both." Claude isn't anyone's
   account, so its new jobs reached nobody's list before. It's in the app
   only, like every notification.
7. **Kept 90 days, and erased with anyone.** A subject, a sender or a reason
   can name anyone, so erasing anyone empties the log, as it empties
   `mail_notes` ([ADR 0027](0027-erasing-a-person-on-request.md)). No mail text is kept. It's in the export.

## Consequences

- A mail Claude took to be nothing to quote can be found, with why, and
  quoted by hand or pasted into New quote.
- Each thread's cost shows beside it. The month's total stays on the switch
  and on Status.
- "Claude is turned off" messages now point to Admin › Claude.
