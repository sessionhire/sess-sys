# ADR 0161: Undo just after Offer

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, who answered the seven
  questions of the [audit of crew offers](../audit-crew-offers-2026-11-12.md)
  with "Go with yours". This is finding 13, part of batch 6 in the audit's
  order; it needed no question of its own.
- **Builds on:** [ADR 0009](0009-crew-invites.md) (each person's own invite,
  one for each day), [ADR 0125](0125-offers-go-on-whatsapp-by-themselves.md)
  (an offer goes on WhatsApp by itself, just after it's made) and
  [ADR 0149](0149-the-office-is-told-what-the-app-sent.md) (the panel after a
  press says what the app sent).
- **Changes:** ADR 0125's "just after" becomes "once the wait is over" for
  an offer made by Offer.

## Context

After "Offer to 3 people" there was no way back. The calendar was written
about two seconds after the press, and each person was emailed an
invitation for each day; withdrawing a wrong pick then emailed them a
cancellation for each of those days. With a hundred freelancers, two of
the same first name are one slip apart, and the form's list stays open for
picking several. The form already says what the press will send; nothing
let the office take it back before it went.

The design system's rule is that undo beats asking: a reversible action
happens at once and offers Undo. An offer isn't reversible once its
invites have gone, so the way to make it reversible is to hold what it
sends for long enough to see the slip.

## Decision

1. **Nothing of the app's goes for 30 seconds after Offer.** The offer is
   made at once, as before: it's on the call, its person's page and the
   office's notices, and the call counts it. Its calendar invites and its
   WhatsApp wait until 30 seconds after the server took it
   (`OFFER_WAIT_SECONDS`), measured by the database's clock, and 5 seconds
   more (`OFFER_WAIT_GRACE_SECONDS`), so an Undo pressed in the panel's
   last second on a slow connection still arrives before anything goes. A job not yet
   confirmed doesn't come onto the calendar as "Hold the day" for an offer
   still waiting either. As the soonest wait ends the server wakes the
   calendar and WhatsApp, so what was held goes then rather than at their
   next look; at start-up it does the same for waits a restart cut across.
2. **The panel after the press says when, and offers Undo.** Over what the
   press sent it says "The invites go in 27 seconds.", "The invite and
   WhatsApp go in 12 seconds." or, when nothing would go by itself, "They
   can be undone for 8 seconds.", counting down from the press, with an
   Undo button beside it. The count starts at the press and the server's
   wait as it takes the offer, and the server's runs on past the panel's,
   so the panel never offers Undo past the server's wait. The line goes when the wait is over; focus on Undo moves
   to the panel rather than nowhere.
3. **Undo takes the offers back as if never made.** Those the press made
   that nobody has answered are deleted, with any WhatsApp still waiting
   for them, and the panel says so: "Aoife and Tommo weren't offered it
   after all: the app sent them nothing, and it's off their pages." When
   the office sends offer messages by hand, it adds "If you sent them a
   message yourself, tell them it's off." History says "Took back the
   offer of Rigger on Harbour Lights to Aoife before it went".
4. **After the wait, or an answer, it's Withdraw.** The server refuses
   Undo once the wait is over ("The offer has already gone to Aoife, so it
   can't be undone. Withdraw it instead.") or once they've answered on
   their page ("Aoife has already answered, so it can't be undone. Withdraw
   it instead."). Withdraw during the wait still works and sends nothing,
   as nothing went.

## What this sends

Nothing new. An offer's invites and WhatsApp go up to half a minute later
than before, and an offer undone sends nothing at all, where withdrawing
it sent a cancellation for each day.

## Considered

- **A toast with Undo for 9 seconds** (the design system's toast).
  Rejected: the panel after Offer is already where the press is said, and
  a toast over it would say the same twice. Nine seconds is enough to
  undo a press, but not to notice the wrong name in a list of people sent.
- **Holding only the invites, as the audit put it.** WhatsApp is held too,
  as it's the other thing that reaches the person; the offer itself is
  made at once, so the office's own message, sent by hand, can go
  straight away.
- **Pausing the count while Undo has focus,** as a toast's timer does.
  Rejected: the wait is the server's, which sends when it's over whatever
  the screen shows; Withdraw stays after it.
- **Keeping the offer out of the person's page until the wait ends.**
  Rejected: the office may share the link by hand at once, and nothing is
  sent by the page; Undo takes it off.

## Consequences

- Offers made before this, and any not made by Offer, never wait.
- An answer given in the first half minute, on the person's page, is
  taken at once, and Undo is then refused; their invite goes as the wait
  ends.
