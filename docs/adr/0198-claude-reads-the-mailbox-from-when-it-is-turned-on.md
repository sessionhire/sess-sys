# ADR 0198: Claude reads the mailbox from when it's turned on

- **Status:** accepted
- **Date:** 26 November 2026
- **Asked for by:** Colly, 26 November 2026 ("Start from now please"), before
  turning Claude on for the first time on live.
- **Amends:** [ADR 0098](0098-claude-drafts-quotes-from-the-mailbox.md)
  (point 2: reading started a week before the mailbox was first connected).

## Context

operations@ was connected on 9 November 2026 and Claude stayed off. Under
ADR 0098 the first read started a week before connecting, so turning Claude
on would have worked through every mail copied to operations@ since about 2
November, six threads every five minutes, making an enquiry job and a draft
quote for each enquiry: most of them already quoted by hand by then.
Disconnecting and connecting the same mailbox again kept the old starting
point.

## Decision

1. **Turning Claude on starts the mailbox from that moment.** When
   `assistant.use` goes from off to on, the mailbox's `read_after` is set to
   now, in the same change. Mail that came before, or while Claude was off,
   is left alone. Saying on while it's already on moves nothing.
2. **A mailbox connected for the first time also reads from now,** not a
   week back. Connecting the same account again still carries on where it
   was.
3. A thread that began before is read once a new mail comes on it, whole,
   as before: a reply is new mail.

## Consequences

- An enquiry that came in while Claude was off is quoted by hand, or pasted
  into New quote's "Or paste an enquiry for Claude to read".
- Turning Claude off and on loses nothing Claude made, but skips the mail
  between. Admin › Company says so beside the switch.
