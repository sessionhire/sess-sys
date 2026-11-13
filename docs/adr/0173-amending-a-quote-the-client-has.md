# ADR 0173: Amending a quote the client has

- **Status:** accepted
- **Date:** 13 November 2026
- **Asked for by:** Colly, 13 November 2026, from a phone at a job's
  Confirmed task ("can we add another button to amend quote which
  generates another draft?")
- **Builds on:** [ADR 0084](0084-the-printed-quote.md) (the printed quote and its versions),
  [ADR 0103](0103-how-a-job-moves-on.md) (the client's
  answer on the Confirmed task), [ADR 0135](0135-an-admin-can-delete-a-quote.md)
  (deleting a version) and [ADR 0166](0166-send-the-quote-from-next.md)
  (Next sends the draft)
- **Changes:** what the Confirmed task offers, where the job stands while a
  new version is drafted, and how a draft made by mistake is undone.

## Context

A quote that's gone has three answers, not two: yes, no, and "can you
change it". The Confirmed task offered Confirm job and Client said no. The
third lived on the Quote tab as **New version**, out of reach from the task
the office was on, and named for what the app does rather than what the
office is doing.

Once a new version was made, the job still said its quote was sent: the
stage line ticked "Quote sent", the job opened on the client's answer, and
the Jobs list said the quote had been with the client for days. Next
already led with sending the new draft (ADR 0166), but nothing else agreed.

A draft made by a slip could only be deleted by an admin (ADR 0135), and
until then it held the job back.

## Decision

1. **Amend quote, beside the other two answers.** The Confirmed task's
   buttons are Confirm job, Client said no and Amend quote, while the
   version with the client has no yes. It copies that version as the next
   draft (the same copy the Quote tab makes) and opens it on the Quote tab.
   With an amendment already started it reads "Open version 2". The Quote
   tab's New version is renamed Amend quote, so there is one name and one
   way.
2. **Sending is the task again.** While the newest version is a draft
   made after one went, and nobody has said yes, the Quote task is not
   done: "Version 2 is an amendment, not sent yet". So the job opens on
   the Quote tab, Next sends it, and the Jobs list and Board say "Version 2
   being amended". The version the client has still takes their answer
   meanwhile, so a yes to it can be recorded. After a yes, a new version
   doesn't take the job back.
3. **The draft says what it is, and can be dropped.** Under its heading:
   "Amending version 1, which the client has. It stays the quote until
   this one is sent." and Drop changes, which asks first and removes the
   draft. Dropping is the office's (the money roles), unlike deleting:
   the server refuses it for a version that went, or for a job's only
   quote. It's kept out of sight like a deleted one, so an admin can put
   it back from the history.

## Consequences

- A new command, `quote.drop`, for money roles; history reads "Dropped the
  changes in version 2 of the quote for …, never sent".
- A dropped version's number isn't reused: the next amendment is version 3.
- Behaviours designed for: Default Effect (the answer's buttons now hold
  the common third outcome, so the office doesn't record a no or a yes to
  get to changes) and user control and freedom (a slip on Amend quote is
  undone in place, not by asking an admin).
