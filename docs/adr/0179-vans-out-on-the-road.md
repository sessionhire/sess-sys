# ADR 0179: Vans out on the road, and a planner for them

- **Status:** accepted
- **Date:** 14 November 2026
- **Asked for by:** Colly, 14 November 2026: "Can we work on the vehicles next? I think we need a planner for them to view
  their bookings as well as using an estimated time for travel so we can plan how long they're out on the road for."
  Then, on the choice of where drive times come from: "Estimate from the map".
- **Builds on:** [ADR 0047](0047-vans-and-drivers.md) (vans and drivers, and the planner's Vans rows),
  [ADR 0010](0010-planner.md) (the planner), [ADR 0057](0057-venues-on-the-map.md) (venues' pins),
  [ADR 0086](0086-travel-and-subsistence-on-quotes.md) (a fifth more than the crow flies for the roads) and
  [ADR 0107](0107-trackers-on-expensive-kit.md) (the warehouse on the map).

## Context

A van booking was days: Thursday to Sunday. Nothing said that a van due in Galway at eight leaves the warehouse before
half five, or that one loading out of Limerick at half eleven is back after two in the morning, and so isn't free for a
Monday drop. The van's days were in the Jobs planner's Vans rows, a press away under Jobs › Week, and nowhere under
Stock › Vehicles, where the vans are kept.

## Decision

1. **Drive times are estimated from the map, on the device.** From the warehouse's pin to the venue's (the phase's own
   venue, or else the job's): as the crow flies, a fifth more for the roads, the first 10 km at 30 km/h and the rest at
   what a vehicle of its kind keeps up with a load on (a car 95, a van 90, a Luton 85, a truck or a trailer 75), rounded
   up to the next five minutes. Dublin to Galway is about 2 h 45 in a van. It's free, needs no key, and works with no
   signal. Colly chose it over Google's drive times (traffic, but a billed key) and a free routing service (real roads,
   but its limits); either could fill the same number later without changing a screen.
2. **A drive typed on the booking wins.** "Drive each way, in minutes": the office knows the M6 on a Friday. Said "as
   typed" wherever it's shown, and the map's said "about".
3. **The warehouse is the trackers' warehouse.** One pin, already kept for trackers (`trackers.home`). Until it's set,
   drives are measured from Dublin city centre, and the planner says so in an attention card with **Put the warehouse on
   the map** for those who keep the settings. Setting it there doesn't turn trackers on.
4. **A booking has two times, both optional.** *At the venue by* on its first day (blank: the earliest call of the job's
   crew that day, for its phase or the whole job, since the kit should be there when they are) and *Leaves the venue* on
   its last. With a drive, they give when it leaves the warehouse and when it's back, which can be the day before or the
   day after its days.
5. **Away is away.** The days a van is out run from the day it leaves to the day it's back. A clash, the booking form's
   "Book anyway" question and a driver on two vans are all checked against those days on the device. The server still
   checks a clash on the booking's own days: the extra day is the device's warning, then the office's call, as any clash
   is.
6. **Stock › Vehicles has List, Week and Month.** The week and month are the planner's Vans rows on their own
   (`#stock/vehicles/week/<monday>`, `#stock/vehicles/month/<first>`); on a phone the week opens as a list of its days
   (`…/days`), each van out that day with its job, who drives, and when it leaves and is back, with a Grid press for the
   timeline. A day it's only driving is hatched, "Driving there" or "Driving back". Jobs › Week and Month keep their Vans
   rows, with the same times.

## Consequences

- Each booking line, on the job's Transport tab and the vehicle's page, says "Leaves the warehouse about 05:15 Thu 26
  Nov · back about 02:15 Mon 30 Nov · about 2 h 45 each way (223 km)", or why there's no drive (the venue not on the map).
- No traffic, ferries or breaks: an estimate for planning, not a route. The typed drive is the way past it.
- Three columns on `vehicle_bookings` (`drive_minutes`, `arrive_by`, `leave_at`); a phone from before them leaves them
  as they were.
