# ADR 0121: The client accepts a quote online

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 8 November 2026, picking idea 6 from
  [Rentdeck, set beside the app](../research/competitor-rentdeck.md)
  ("1, 2, 3, 4, 6"), behind a switch that stays off until launch.
- **Builds on:** [ADR 0101](0101-sending-a-quote-to-the-client-by-email.md)
  (sending a quote by email), [ADR 0048](0048-messages-to-crew-off-until-said.md)
  (nothing reaches anyone outside until the office says),
  [ADR 0002](0002-crew-booking-links.md) (a private link as the only
  credential).

## Context

Rentdeck's clients accept a quote online, with a typed name or a drawn
signature, and the booking moves on by itself. In the app the client
answers by email or phone, and someone in the office records it by hand
under What happened. That's a step the office can forget, and a yes that
can sit in an inbox for a day.

Colly's standing rule is that the app contacts nobody until launch. A
link to a page contacts nobody by itself, but putting it in the email is
the app speaking to a client, so it waits behind a switch.

## Decision

1. **Each version of a quote has its own link, `/q/<key>`.** The key is
   144 random bits, given when the version is started (or as it goes, for
   one started before this), and is the only credential, as a
   freelancer's link is. Stored as `quotes.accept_token`, sent to devices
   as `acceptToken`, which only those who see money are sent.
2. **One switch, "Let clients accept quotes online"**, under Admin ›
   Company, the command `quoting.online { on }`, money's to change. Off
   is the default. While it's off the link shows nothing of any quote
   ("Quotes can't be accepted online just now") and takes nothing, and
   the email doesn't carry it.
3. **On, the link shows the quote as it stands**: the lines, totals,
   deposit, when the client pays (ADR 0119), the notes and the terms,
   with the PDF a press away. While the version is the one with the
   client, and its prices still hold, it has one form: their full name,
   a tick for "I accept this quote, €X including VAT, and its terms, for
   <client>", and **Accept the quote**.
4. **An accept marks the version accepted**, as the office's What
   happened would, with the name typed and when kept on it
   (`accepted_name`, `accepted_at`, sent as `acceptedOnline`). The
   history says "Aoife Byrne accepted version 2 of the quote for X
   online, for the client". The quote's page says "Accepted online by
   Aoife Byrne, Mon 9 Nov at 10:14". Taking the answer back takes the
   name with it.
5. **Not on a version that's moved on.** A newer version sent, a quote
   turned down or already accepted, or prices past their day: the page
   says which, and takes nothing. Two presses, or the office answering
   first, are checked inside the change, so only one yes is kept.
6. **The email carries it.** With the switch on, the compose box's
   message has "To accept it, use this link: …". For a quote sent another
   way, its page has **Copy the client's link** and **Open it as they see
   it**.

## Considered

- **A drawn signature.** Rentdeck offers one. A typed name and a tick is
  what Irish e-signature law treats as a simple electronic signature, the
  same weight as a drawn squiggle on a phone, and it works with no script.
- **Turning the job confirmed on an accept.** Confirming moves crew and
  kit (ADR 0103), which the office should do on purpose. The accept is
  news on the job, and the job moves on from its Next dock as it does
  today.
- **Turning down online.** Left out: a client who says no usually says
  why, by email or phone, and the office records why (research
  quoting.md, feature 5). The page says to get in touch instead.

## Consequences

- At launch, one switch: the link starts working for every quote out with
  a client, and every quote emailed from then carries it.
- Download everything carries who accepted and when, in the quotes file,
  and leaves the links' keys out, as it does freelancers' links.
