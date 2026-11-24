# ADR 0194: A sent quote holds its kit for twice its valid days

- **Status:** accepted
- **Date:** 24 November 2026
- **Asked for by:** Colly, 24 November 2026, on gap 10 of the review of user flows: "after double the quote period or if
  the quote is cancelled. Add a task for the assignee to follow up on the quote the day before the quote is due to lapse,
  and the day before the gear is due to be released."
- **Amends:** [ADR 0183](0183-the-quote-questions-answered.md) (a sent quote holds its stock). **Builds on:**
  [ADR 0104](0104-stages-tasks-and-one-next-button.md) (tasks and their due days), [ADR 0144](0144-who-has-a-stage-on-the-board.md) (who has the Quoting
  stage), [ADR 0042](0042-quotes-prices-and-a-money-view.md) (roles sent no money).

## Context

Since 1.202.0 a sent quote holds its kit as a confirmed job does, so another quote for the same days sees it gone. The
hold had no end: a quote nobody answered kept the kit for its dates until someone marked the job lost, and a later quote
for the same days read as short, which risks turning down work for kit that was never going out.

## Decision

- **Held for twice the quote's valid days.** A quote's prices hold for its valid days from the day it was sent (30 unless
  changed). Its kit is held for as long again: until the day sent plus twice the valid days. After that it is pencilled
  in, as an enquiry's is: still on the job's list, warned of where it would be short, but free for another job.
- **Or until the quote is cancelled.** Turned down, or taken back (the versions sent deleted), the job's quote holds no
  kit at once. A cancelled or lost job holds nothing, as before. Said yes to, the hold has no end. A version amended and
  not yet sent leaves the hold with the version the client has; sent, the new one counts from its own day.
- **On the job, from the server.** The days are worked out on the server from the job's newest version sent, each time
  the job is read, and carried on the job as `quoteHold` (`validUntil`, `heldUntil`). Kit, availability and the Quoting
  task read them from the job, not the quote, so a role that is sent no money (a head of department, staff crew) holds the
  same kit for the same days as the office. Whatever changes a quote's standing sends the job again; saving a draft
  doesn't. Every job with a quote sent before this was sent once with its days when the server started.
- **A job marked quoted with no quote sent in the app** (one from the calendars) holds as before: there is no day it was
  sent to count from.
- **The follow-up is the Quoting stage's Confirmed task, on its holder's list.** Rather than two new tasks, the task the
  assignee already has for the client's yes is due the day before the prices lapse (the quote's valid-until day), and,
  once they've lapsed, the day before the kit is let go. Its line says which: "Follow up: its prices hold until Sun 1
  Nov", then "its prices have lapsed, and its kit is held until …", then "its kit was let go after …, so it's only
  pencilled in". A day set on the task by hand wins. It is on Home in due order like any task, and late once the day
  has passed. The quote's starter has the stage from the start (1.210.0), so there is always an assignee to follow up
  unless the stage was left with nobody.
- **The job's Kit tab says it**: how long the quote holds the kit, or that it was let go and why.

## Consequences

- A quote that is chased and answered never notices any of this. One that isn't stops keeping stock from the next.
- The day before each day is when the follow-up is due; nothing is sent to the client or the assignee by email or
  text: the task is on their list in the app, as every task is ([ADR 0048](0048-messages-to-crew-off-until-said.md)).
- Twice the valid days is fixed. If the office wants a different multiple, it is one number in the server's reading of
  the job and its first sending.
