# ADR 0180: The warehouse under Admin › Company

- **Status:** accepted
- **Date:** 14 November 2026
- **Asked for by:** Colly, 14 November 2026: "Can the warehouse address be in the admin section with the ability to be
  updateable?"
- **Builds on:** [ADR 0179](0179-vans-out-on-the-road.md) (vans measure their drives from the warehouse) and
  [ADR 0107](0107-trackers-on-expensive-kit.md) (the warehouse on the map for trackers).

## Context

The warehouse's pin was set only from the trackers' card under Admin › Connections, shown only once trackers were turned
on, and from a fold on Stock › Vehicles. It had no address, so nobody could see where the app thought the warehouse was
without reading coordinates, and a company not using trackers had to find it on the vans' page.

## Decision

1. **A Warehouse card under Admin › Company**, after the logo, for whoever can change settings: the address, typed as
   written, and the pin. "Find it on the map" looks the address up (the same search venues use, OpenStreetMap through
   the server); the first place found becomes the pin, and when several are found they're offered to pick from. Tapping
   or dragging on the map, or pasting a map link, moves it. Nothing is saved until "Save the warehouse".
2. **Kept where the pin already was.** The address is a column beside the pin in the trackers' settings, sent with the
   same `trackers.home` change. It's optional there, so a change from an older app, or the trackers' "how near", leaves
   the address as it was.
3. **One place to change it.** The trackers' card keeps only "how near counts as there" and says where the warehouse is,
   with a link to Admin › Company. Stock › Vehicles names the warehouse's first address line under the planner, or, until
   it's on the map, links to the card.

## Consequences

- Drives are still measured from the pin, not the address: an address without a pin changes no drive. The card says
  when it isn't on the map.
- The address isn't printed anywhere yet; it's the office's own record of where the vans leave from.
