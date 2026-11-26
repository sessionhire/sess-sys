# ADR 0201: Delivery and collection on every quote, by van or truck

- **Status:** accepted; amended the same day with the Dublin flat fee and delivery or collection only (below)
- **Date:** 26 November 2026
- **Asked for by:** Colly, 26 November 2026: "Can you add a section to the quote for delivery/collection. Stipulate Van
  or Truck, if Van then base price is 160 within Dublin and then charge additional for distances travelled more than
  that." Asked what "within Dublin" means and the rest of the prices: "yes 25km", "try 1 euro per km but allow that to
  be a field editable in the admin section", "Trucks are priced individually per job".
- **Builds on:** [ADR 0183](0183-the-quote-questions-answered.md) (a dry hire's delivery line, priced as a set amount
  for the first so many km and a price for each km after), [ADR 0086](0086-travel-and-subsistence-on-quotes.md) (lines a
  quote works out for itself) and [ADR 0179](0179-vans-out-on-the-road.md) (distances by road from the warehouse).

## Context

A dry hire we deliver already put a Delivery line on its quote by itself (ADR 0183): the road km from the warehouse to
the delivery address, at a set amount covering the first so many km and a price for each km past them, set under
Admin › Company › Dry hire delivery. Nothing else could have one, and there was no way to say what it went in.

## Decision

1. **Every quote has a Delivery and collection section** with three choices: No delivery, Van or Truck. It's saved with
   the quote (`quotes.delivery_by`), and a new version takes the one before's. Until the office picks, a quote takes what
   its job starts on: a dry hire we deliver goes by van, as it did, and anything else has none, so no quote written
   before this comes to a different total. A dry hire the client collects has no section: that's said on the job.
2. **A van is worked out, as the dry hire's delivery was.** The road km from the warehouse (Dublin city centre until the
   warehouse is on the map) to a dry hire's delivery address, or to anything else's venue; the set amount covers the
   first so many km and each km past them is charged at its own price. Admin › Company › Dry hire delivery becomes
   **Delivery and collection**, with the same three fields, now the van's. Where none were set, the database takes
   Colly's figures once: €160 for the first 25 km ("within Dublin" read as 25 km by road from the warehouse, Colly's
   yes), then €1 a km. They stay editable there.
3. **A truck is priced for each job.** Picking Truck opens a price box on the row; the line is that price once,
   whatever the distance (`quotes.delivery_cents`), and says the km when they're known. With no price typed, the quote
   says so in its list of things to look at before it goes, as it does for a van with no price.
4. **One line, worked out on the device**, in its own group "Delivery and collection", reading "Delivery and collection
   by van, 32 km from the warehouse" (with how the amount is made up past the set km), or "… by truck". Two people on
   the draft merge the choice and the truck's price as the other terms (ADR 0113).

## Consequences

- A quote already sent keeps its lines as they were printed ("Delivery, 190 km from the warehouse"); a draft opened
  again works its line out afresh under the new name.
- The van's prices are one set for every quote. A second van size, or a truck rate card, would be a new set of fields
  here, and the truck's per-job box would stay as the override.
- Delivery is charged one way's measure for there and back, as before: the prices are set to cover both.

## Amended, 26 November 2026: the Dublin flat fee, and one way only

Colly: "can you change the delivery and collection quote item to be called dublin flat fee, and have an option to
stipulate delivery and/or collection in case they only need things delivered for example".

- **The van's line is the Dublin flat fee**: "Dublin flat fee" within the km the set amount covers, "Dublin flat fee,
  then 12 km at €1.00 a km" past them. With no set amount (every km at the price a km) it reads "Van, delivery and
  collection, 40 km from the warehouse". A truck's line says which way: "Delivery and collection by truck", "Delivery
  only by truck".
- **Which way** (`quotes.delivery_trips`): Delivery and collection, Delivery only or Collection only, under the vehicle
  choice; null is both, so no quote changes. A van one way is a share of its price there and back, set under Admin as
  One way only (`quote_settings.delivery_one_way_pct`, 10 to 100) and half until set: the van's set amount covers the
  trip there and back, and a one-way job uses about half the driving. A truck's typed price is the job's, whichever way.

## Amended again, 26 November 2026: a price a trip

Colly: "The flat fee Dublin delivery costs are wrong. It should be 70 euro each way not 35 euro each way". Admin's van
prices had been read as there and back, with one way at half (€70 set, so €35 one way). They're now **for one trip**:
a delivery only or collection only is one trip, delivery and collection is two (the line's quantity is 2, so €70 set
reads 2 × €70 = €140), and km past the flat fee are charged on each trip. The One way only share is taken out
(`quote_settings.delivery_one_way_pct` stays in the database, unread). No setting changes on live: the €70 there is now
€70 each way.
