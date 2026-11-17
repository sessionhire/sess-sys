# ADR 0111: Staff answer their own offers in the app

- **Status:** accepted
- **Date:** 7 November 2026
- **Asked for by:** Colly, 7 November 2026 ("move on to the next batch"),
  batch 5 of the [UX sweep of 6 November](../ux-sweep-2026-11-06.md),
  question 2 of section 9: answered *yes, as its own ADR*.
- **Amends:** [ADR 0034](0034-roles-and-what-each-can-change.md) (the link
  as the one place to answer), [ADR 0046](0046-departments-on-calls-and-what-each-role-reads.md)
  (which made the revisit due).
- **Keeps:** [ADR 0002](0002-crew-booking-links.md) (the link is the whole
  credential and works with no script), [ADR 0051](0051-freelancer-in-place-of-warehouse.md)
  (a freelancer's offers go through their link), [ADR 0048](0048-messages-to-crew-off-until-said.md)
  (nothing is sent to anyone), [ADR 0090](0090-timesheets-off-until-used.md).

## Context

Staff sign in with Google ([ADR 0052](0052-google-only-for-staff.md)) and spend their day in the app.
Every offer they get, though, has to be answered on their private link.
Home › Me, their own page and "You on this job" (move 9) all said "Answer it
on your page ›" and opened a second page in a new tab. The sweep's
finding staff-1 found a staff member's own things split between Home › Me
and her link, and its reviewer sketched answering in the app with an
own-offer check on the server.

ADR 0034 kept answering on the link deliberately. The link is the one
thing every person has, works with no sign-in and no script, and is what
freelancers use. Staff have a second door, though, and the link stays.

## Decision

1. **A new ability, `answer`: "answer their own offers in the app".**
   Directors, the office, heads and staff crew have it. Freelancers don't:
   their offers keep going through their link, as ADR 0051 says, where they
   can also counter on rate.
2. **`offer.respond` needs `answer` instead of `crew`.** Its handler holds
   anyone without `crew` to offers that are theirs, matched by the email
   they signed in with ("You can only answer your own offers. The office
   answers for someone else."). The office and heads answer for anyone, as
   before. The link calls the same command with no role, so nothing about
   it changes. Every check the link has (filled, withdrawn, declined is
   over, can't hold two jobs on a day) applies unchanged, because it is
   the same command.
3. **"You on this job" answers it:** "Yes, I can do it" (every day, one
   press, the card's one filled button) and "No, I can't", which asks first
   in the link's words ("It comes off your bookings, and only the office
   can offer it to you again."). Saying yes to only some of the days, and
   pulling out of a booking, stay on their page. Both are rarer, and the
   link already says the consequences of each. The card links there
   ("Only some of the days? On your page ›", "Can't make it any more? ›").
4. **An offer's row on Home › Me and on their own page opens the job**
   ("Answer it ›") for anyone with `answer`, when the call is on a job. A
   call with no job (asked for from Crew) has no job page, so it still
   opens the link.
5. **Timesheets are not in this decision.** They are off until used
   (ADR 0090). When the switch goes on, sending one's own timesheet in the
   app follows the same pattern: the link's command, an own-person check,
   and a new ability or this one widened.

## Consequences

- Staff answer where they already are. The answer goes through the app's
  own queue, so it works with no signal and is said in "Not done" if
  refused.
- The answer reads the same in History as one on the link ("Seán Ó
  Briain accepted …"), with the account and device it came from beside
  it, as for any change made in the app.
- Nobody is contacted. An answer sends nothing to anyone, in the app or on
  the link (ADR 0048).
- The role's description says it ("Their own leave and days in lieu,
  answering their own offers, …").
