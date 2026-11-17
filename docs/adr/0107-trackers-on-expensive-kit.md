# ADR 0107: Trackers on expensive kit

- **Status:** accepted
- **Date:** 1 November 2026
- **Asked for by:** Colly ("What are the options for trackers also to put on
  expensive equipment?", then "Something that we could integrate into the
  application", then "Could you build out the application side of it
  presuming we would go with those trackers", 1 November 2026).
- **Builds on:** [ADR 0017](0017-pick-lists-and-scanning-out-and-in.md)
  (scans out and in), [ADR 0031](0031-getting-kit-ready-and-back.md) (kit
  held a day either side of a job), [ADR 0057](0057-venues-on-the-map.md)
  (venues on the map), [ADR 0058](0058-notifications.md) and
  [ADR 0069](0069-to-sort-out-today-and-ahead.md) (a standing card at the top
  of Notifications).

## Context

The research ("Trackers for expensive kit", 1 November 2026) compared
Bluetooth tags, cellular trackers and asset platforms. Consumer tags
(AirTag, SmartTag, Find Hub tags, Tile) have no API and warn a thief's
phone, so they can't feed the app. The recommended tracker is Digital
Matter's Yabby Edge Cellular (LTE-M, IP68, years of battery at a fix a
day), whose server posts every report as JSON to an address we give it.

The app already knows where each item *should* be: in the warehouse, or
with a job (scanned out, or held for one by its kit list) at that job's
venue. A tracker that reports into the app lets it compare.

## Decision

1. **Reports come in at `POST /api/trackers/digital-matter`**, from Digital
   Matter's HTTP connector, with the server's key (Railway variable
   `TRACKERS_KEY`) as a bearer token or the password of basic sign-in. Both
   of Digital Matter's shapes are read: Device Manager's (`SerNo`,
   `Records`, `Fields`) and the Location Engine's for Edge trackers
   (`device.sn`, `date`, `lat`, `lng`, `posAcc`), as Traccar reads them. No
   key, the wrong key, or trackers off is turned away with a non-2xx, so
   Digital Matter keeps the report and sends it later: nothing is lost.
2. **A tracker is made the first time it reports**, as
   `digital-matter:<serial>`. Every report is kept in `tracker_reports`
   (once, by tracker, time and number); the tracker keeps its newest fix,
   battery and when it was last heard from. Reports are the server's
   bookkeeping, not in the history; naming a tracker and putting it on an
   item are.
3. **One tracker to an item**, put on from the item's page or from Admin by
   the item's number. Putting one on an item that has one takes the other
   off. A tracker put away comes off its item.
4. **Where it is against where it should be** (`placeOf`, shared) is worked
   out at each report, and again when it's put on an item or the warehouse
   moves: at the warehouse; at a venue of a job it's out with or held for;
   with a job (anywhere, while a job holds its product, prep and return days
   in); **away** (from the warehouse, on no job); **not back** (scanned out
   with a job that's over, not at the warehouse); or not known. Lenient on
   purpose: only *away* and *not back* are put in front of anyone, since a
   tracker that cried wolf every time a van left the yard would soon be
   ignored. "How near counts as there" is one radius, 300 m unless set, for
   the warehouse and venues.
5. **Kit to check** tops Notifications for whoever can change stock: kit
   away, kit not back, and trackers not heard from in three days. Worked out
   on the device, not counted on the bell, gone once sorted (as ADR 0069).
6. **Who reads them:** the office, directors and heads. Where the most
   expensive kit is right now isn't sent to staff crew or freelancers.
7. **Off until the office turns it on** under Admin › Connections › Trackers,
   with the warehouse on the map, the address to give Digital Matter, and
   every tracker heard from. Nothing here contacts anyone outside the app.

## Consequences

- Colly needs: the trackers, a Digital Matter account with an HTTP connector
  pointed at the address Admin shows, and `TRACKERS_KEY` in Railway.
- Digital Matter's payload is taken from its connector's documented shapes and
  Traccar's decoder; the first real report should be checked against it.
- A trail (where it went today) can be drawn from `tracker_reports` later.
- A low-battery warning is left out: each model's full and flat voltages
  differ. The battery shows as volts on the item's page, and a tracker gone
  quiet is on Kit to check.
- Other makers (Teltonika through flespi, say) would be another reader
  beside `digital-matter.ts` and another `maker`.

## Design

- One job of each view: the item's tracker card says where it is and
  whether that's right; Kit to check says what to go and look at.
- Behaviour designed for: whoever looks after stock scans Notifications for
  what to act on (Time Scarcity: only what's wrong now), and trusts a list
  that doesn't cry wolf (only two alarming places, Loss Aversion kept for
  real loss).
- Uses the system's parts: the card, the switch, pills in the grammar (bad
  for away and not back, settled for at the warehouse or venue, pending for
  with a job or gone quiet), the venue icon, the existing map and pin
  placing. No new components.
- Heuristics: visibility of system status (last heard from, how accurate,
  since when); match with the real world (place words, not coordinates);
  error prevention (one tracker an item, put-away trackers can't go on one).
  No 3s left open.
