# ADR 0108: The purchase list on a freelancer's link

- **Status:** accepted
- **Date:** 3 November 2026
- **Asked for by:** Colly, 3 November 2026 ("I'd like them to use it, but
  how do they sign in if they don't have Sessionhire.com email
  addresses?"), then, of three ways in, "On their booking link".
- **Builds on:** [ADR 0002](0002-crew-booking-links.md) (the private link),
  [ADR 0077](0077-the-purchase-list.md) (the purchase list),
  [ADR 0052](0052-google-only-for-staff.md) (staff links need Google).

## Context

The purchase list is open to every role, freelancers included, but only
inside the app, and the app lets in sessionhire.com Workspace accounts and
the few outside Google addresses listed in `STAFF_EMAILS`. Freelancers have
neither: they get their work through their private link, which needs no
sign-in. So the people the company books most, who use the kit on every
job, couldn't ask for any.

Three ways were put to Colly: the list on the private link; letting any
Google account on the Crew tab sign in; or listing a few addresses in
`STAFF_EMAILS` by hand. The second opens the whole app (read-only, but
jobs, clients and the planner) to every freelancer and needs each to have
a Google account under the address the office has for them; the third
does the same, one person at a time. Colly chose the link.

## Decision

- **A page of its own, `/f/<token>/buy`,** linked from a "Kit to buy"
  section on their page with how many are still asked for. Its one job is
  the list: what's asked for, most votes first; what's ordered; and,
  folded, what arrived or won't be bought, each with who asked, when, the
  department, a link to it and the office's notes.
- **Ask:** what to buy, how many and details, a link. Plain form, like the
  rest of the page; its own id so a double tap asks once. It goes through
  `purchase.ask` as the link's person (`by`), with their department from
  the Crew tab so a head's department view picks it up. A refusal (a link
  that isn't a web address) is said above the form with everything typed
  kept (rule 11).
- **Vote:** one button a request, `aria-pressed`, the count in figures,
  pressed again to take the vote back, as the app's vote is. Only what's
  still to decide or to buy takes a vote; a vote can always be taken back.
- **Nothing else.** Changing or taking back a request, and saying where
  one is at, stay in the app with the office. Nobody is told anything
  outside the app.
- **Download everything** from the link now carries what they asked for
  and what they voted for.
- A member of staff's link page needs their Google sign-in already
  (ADR 0052), and that holds for `/buy` too.

## Consequences

- Anyone with a freelancer's link can ask and vote as them, as they can
  already answer offers as them; the footer says so. Low stakes: a vote,
  or a request the office can take off.
- Freelancers see everyone's requests and names, as the app's list shows
  every role; no money or contact details are on it.
