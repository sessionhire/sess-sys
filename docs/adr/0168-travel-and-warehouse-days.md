# ADR 0168: Travel and warehouse days, at a share of the day rate

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026: "Can travel day be included…
  With a place in the admin to set the standard rate?", then "that should
  have been add travel day as a phase. Not a type", "Also can you add
  warehouse day as a phase also similar to travel day. For crew booked on
  these can you automatically set their rate to half of the standard rate,
  or if they have one, half of their personalised rate", and "Can you have
  that percentage available as a setting in the admin section too?"
- **Builds on:** [ADR 0086](0086-travel-and-subsistence-on-quotes.md) (travel and
  subsistence on quotes), [ADR 0156](0156-crew-accommodation-on-quotes.md)
  (accommodation) and the crew's own day rates (ADR 0167, PR "Give crew their
  own day rates").

## Decision

- **Travel and Warehouse are phases**, not kinds of job. They're offered with
  Build, Show and the rest wherever a phase is named. A phase whose name starts
  with "Travel" ("Travel", "Travel day", "Travel home") or "Warehouse"
  ("Warehouse day") counts, so the office can name the way and the day.
- **Crew on one are paid a share of the day rate**, half unless the office sets
  another share under **Admin › Company › Travel and warehouse days** (10% to
  100%, a whole number). On a call asked for on such a phase the office types
  the standard rate, which the form calls "Standard day rate", and the call is
  saved at its share: €250 standard is a €125 call. The form says so as it's
  typed. Everything that reads a call's rate, the offer, the invite, the
  WhatsApp, the timesheet and the margin, reads the share without knowing why.
- **Someone with their own day rate** (ADR 0167) is offered the same share of
  it, so an own rate never beats the halved call at its full value. This is the
  optional share passed to the offer's rate, added once the own rates are in.
- **On the quote**, a crew line built from a call on such a phase is charged
  the same share of its role's price; with no price for the role, the call's
  rate, already the share, as before. Lines added by hand are as they were.
- **One share for paying and charging.** Colly asked for one percentage. A
  fixed travel day price for the client is easy to add if it's wanted.

## Consequences

- A call's rate on a travel or warehouse day is the reduced one. Changing the
  call afterwards changes that figure directly: the office types what's paid.
- A call asked for across several phases counts by what's typed for it: one
  called "Travel" is a travel day.
- Changing the share changes calls asked for from then on, not calls already
  made, nor offers already out.
