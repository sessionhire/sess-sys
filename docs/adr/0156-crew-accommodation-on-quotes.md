# ADR 0156: The crew's accommodation on quotes

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026: "Can you add in a line for
  accommodation similar to how travel and subsistence work?"
- **Builds on:** [ADR 0086](0086-travel-and-subsistence-on-quotes.md)
  (travel and subsistence), [ADR 0089](0089-availability-subhire-and-margin-on-quotes.md)
  (margin), [ADR 0100](0100-the-quote-form-redrawn.md) (the worked-out rows).
- **Amends:** ADR 0086, which left "crew staying over and travelling once
  rather than each day" not done.

## Context

On a job far from Dublin the crew stay over, and the rooms were typed onto
the quote by hand, if remembered. Like travel and subsistence, they follow
from what the quote already knows: how far the venue is and how many crew
days are quoted. Charging a hotel and a car trip home every day as well
would charge the client twice for the same nights.

## Decision

**A third line the quote works out for itself**, marked
`extra: 'accommodation'`, after travel and subsistence and under the same
heading. "Travel and subsistence" is kept as the heading and the Admin
card's name: in Ireland the words already take in overnight stays, and
keeping it leaves every quote already saved as it was.

- **When**: the distance each way (the same one travel uses: the venue's
  pin, or what's typed on the quote) is more than Admin's "Stay over
  after", 180 km unless set. By the map's reckoning that takes in Galway,
  Cork, Limerick, Sligo and Derry, and leaves out Belfast, Waterford and
  Athlone, which crew drive home from.
- **How much**: a room for each crew day (the same count as subsistence,
  each crew line's how many times its days, a half day as a whole), at
  Admin's "A room, € a night". Printed as so many crew nights at the room
  price "a night". A room price not set charges nothing, and the quote says
  where to set it, as the per diem does.
- **Accommodation provided**: a switch on the quote, as Meals provided is,
  for a job that puts the crew up (`quotes.accommodation_provided`, carried
  to the next version). No rooms are charged.
- **Travel when they stay**: the crew drive there and home once, not each
  day, so travel is a car trip for each of the crew (each crew line's how
  many, never more than the crew days), or each car load when they share.
  This applies only once the office has set a room price or the quote says
  the job puts the crew up, so travel on a far job reads exactly as before
  until accommodation is in use. The travel line then says "staying over".
- **Margin**: the rooms cost what they're charged, as travel and the per
  diem do: passed on, not marked up.
- **The quote's row** shows only on a job far enough to stay over, so a
  job near home doesn't gain a "No accommodation" row. One link to Admin is
  said when both the per diem and the room price want setting.
- **Crew invites**: the "Per diems and fuel" part of a day's description
  becomes "Per diems, fuel and accommodation" with "Accommodation: covered"
  when the quote charges rooms, or "provided by the job" when the job puts
  them up. A job with neither reads exactly as before, so no invite already
  out changes.

## Consequences

- `quote_settings` gains `stay_from_km` and `room_cents`, set by
  `quoting.travel` with the rest and left as they were by an app older
  than them. `quotes` gains `accommodation_provided`.
- An existing draft for a far job, opened once the room price is set,
  gains the line and its travel becomes once each, and saves itself, as
  for any change from the job. A quote that has gone keeps what it went
  with.
- Not done: nights that differ from crew days (arriving the night before,
  or going home after the last night), a room shared between crew, and
  the office booking the hotel in the app.
