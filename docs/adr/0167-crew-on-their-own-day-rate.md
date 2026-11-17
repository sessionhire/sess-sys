# ADR 0167: Crew on their own day rate

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026: "Can certain crew have a
  personalised rate for them… some have negotiated with us that they have a
  higher day rate. When a gig is offered to them, the listed rate is still
  charged to the client on the quote, but we pay the higher rate if
  applicable coming out of margin. Can a small note flag when choosing crew
  with a higher than quote crew rate that margin may be affected."
- **Builds on:** [ADR 0002](0002-crew-booking-links.md) (offers),
  [ADR 0046](0046-departments-on-calls-and-what-each-role-reads.md) (who reads rates),
  [ADR 0089](0089-availability-subhire-and-margin-on-quotes.md) (margin on
  quotes), [ADR 0152](0152-a-yes-counts-for-its-own-day.md) (a rate asked for and
  said no to).

## Context

Every person already had a day rate on their record ("Usual day rate"),
filled by hand or from the crew list brought in, but nothing read it: an
offer was always made at the call's rate. A freelancer who had agreed a
higher rate with the company was offered the call's, and the office had to
remember to agree their rate by hand, or they countered it each time.

## Decision

1. **The person's day rate is their own rate.** It is now called "Own day
   rate", with a line under it saying it's for a freelancer who has agreed a
   rate, that offers pay it where it's above the call's rate, and that the
   client is still charged the quote's price. One field, not a second one
   beside it: two rates on a person would leave the office guessing which
   one pays.
2. **An offer is made at the higher of the call's rate and their own**
   (`offerRateFor`), or at their own when the call has none ("rate to
   agree", as calls made from a quote are). An own rate below the call's
   never lowers it, so a usual rate typed long ago can't cut anyone's pay.
   Staff are paid through payroll, so an own rate never applies to them.
   The offer's rate is what their page, their message and WhatsApp say, and
   what their timesheet pays, as before.
3. **A change of the call's rate** still reaches an offer not yet answered,
   kept up to their own rate where that is above the new one.
4. **The quote is unchanged.** It charges the client the role's price. Its
   margin (ADR 0089) now costs a crew line at the rates of those holding a
   place on its call, with the places still open at the call's rate, so an
   own rate shows as less margin.
5. **Picking someone above what the job allowed for says so.** On the offer
   form, under a person picked whose own rate is above the call's rate, or
   above what the quote charges for the role when the call has no rate:
   "Aoife's own rate is €300 a day, above this call's €250, so the margin
   may be less. The client is still charged the quote's price." A note, not
   a stop: the office has agreed the rate.
6. **On the call's card**, someone offered at their own rate has "own rate
   €300" beside their name, so the call's rate isn't taken for theirs.
7. **Private as every rate is** (ADR 0046): only those who read rates
   (office, directors, system admins and heads a director lets) see an own
   rate or the margin note. A freelancer sees only the rate they're offered,
   never that it's an own rate or anyone else's.

## Consequences

- Anyone who already has a usual day rate above a call's rate is offered
  theirs from now on. Offers made before stay as they were made.
- Travel and warehouse days at a share of the rate (being built separately)
  take the same share of an own rate, through `offerRateFor`.
