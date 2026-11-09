# ADR 0136: Clients and venues are filled in from Current RMS

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("1 and 2 would be good", on
  being offered clients with their contacts, and venues with their
  addresses, as what else Current RMS could fill in).
- **Builds on:** [ADR 0078](0078-reading-current-rms-through-its-api.md) (the read-only Current
  RMS connection), [ADR 0132](0132-hire-prices-from-current-rms.md) (hire prices filled in
  the same way), [ADR 0084](0084-the-printed-quote.md) (a client's address), [ADR 0119](0119-when-a-client-pays-and-who-to-ask-for-at-a-venue.md)
  (a venue's contact).

## Context

Clients and venues here came in from the Google calendars (ADR 0011) as
names only, or were typed as jobs came in. Current RMS, which the office
quoted from for years, has the organisations and venues with their
addresses, and the people at each with an email and a phone. Quotes need a
client's address, and a call sheet needs who to ask for at a venue.

## Decision

1. **The server reads them itself**, through the Current RMS connection:
   organisations, venues and contacts, a hundred a request, one kind after
   another, each with its primary address, its work email and phone (else
   the first), and which contacts belong to which organisation or venue.
   It runs in the background with progress and Stop, from Admin ›
   Connections, at a request a second. Only a read that finishes replaces
   the copy kept (`rms_members`, `rms_member_links`). It only ever asks.
2. **Only contacts who belong to someone are kept.** A contact not linked
   to an organisation or venue is nobody's contact here, so their details
   stay in Current RMS. The copy is read on the server only and goes in the
   export with every other table.
3. **Matched by name**, however it is cased, spaced or punctuated, and
   without "The" in front or "Ltd", "Limited", "DAC" and the like after. A
   name written differently isn't found; the card says so, and renaming one
   to match finds it next time.
4. **Gaps only.** Filling in puts an address where there is none, adds the
   contacts a client hasn't got (the same email, or the same name, is the
   same person; twenty at most), and gives a venue with nobody to ask for
   its first contact. Nothing typed here is changed, so there is no tick to
   overwrite, unlike the prices: a contact or an address the office has
   corrected is the one to keep.
5. **New ones only when ticked, and only those that were quoted.** Current
   RMS holds years of one-off names. An organisation or venue not here is
   offered only when it is active there and its name is on one of Current
   RMS's quotes (`rms_opportunities`), and added only when "Also add the N
   on Current RMS's quotes that aren't here yet" is ticked. Clients and
   venues are never deleted, so the default adds nothing new.
6. **A preview before anything changes**, then one command,
   `rms.fillMembers { add }`, which the server works out from its copy the
   same way the preview did (`rmsMemberPlan` in `shared/src/rms-members.ts`).
   It is in History as "Filled in clients and venues from Current RMS". A
   device waits for the server's answer, as the copy is on the server only.
7. **Who:** seeing the preview and filling in is for those who keep jobs
   (`jobs`); reading Current RMS again is bringing a list in (`settings`).

## Consequences

- Quotes get a client's address and call sheets a venue's contact without
  retyping, and a re-run after Current RMS changes fills any new gaps.
- A client here under a different name from Current RMS's stays unfilled
  until one of them is renamed.
- Payment terms, price and discount categories are not brought across:
  they are the office's to set here.
