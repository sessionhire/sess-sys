# ADR 0183: The quote questions answered, and a dry hire delivered or collected

- **Status:** accepted
- **Date:** 14 November 2026
- **Asked for by:** Colly, 14 November 2026, answering the six questions at the end of the
  [audit of the quote flow](../audit-quote-flow-2026-11-08.md):
  1. "No Charge"
  2. "After the quote is sent hold the stock"
  3. "Grouped by department"
  4. "Yes by default"
  5. "Dry hire quotes should have a from/to field, with a time field also. On the dry hire quote form, once dry hire is
     selected, there should be a delivery/collection radio button to select. If Collection then on the quote the from/to
     should be named collection/return, if delivery is selected then keep as from/to. For delivery only, a delivery
     address should be entered. Using that field can autopopulate a delivery line item on the quote. This is calculated
     based on the distance from the warehouse to the delivery address. The unit charged per km should be set in the
     admin section."
  6. "Logo can be the same as the labels, but the high quality/full color version."
- **Builds on:** [ADR 0014](0014-kit-on-jobs.md) (held and pencilled kit), [ADR 0126](0126-the-quote-is-the-job-s-plan.md)
  (a draft's kit on the job's list), [ADR 0128](0128-the-quote-the-way-the-office-writes-it.md) (groups, who it's for,
  the logo, a dry hire's shape), [ADR 0086](0086-travel-and-subsistence-on-quotes.md) (lines a quote works out for
  itself), [ADR 0179](0179-vans-out-on-the-road.md) (drives measured from the warehouse) and
  [ADR 0180](0180-the-warehouse-under-admin.md) (the warehouse's address and pin).

## Context

The audit's batches took a recommended answer to each question so the work could go on, and said they waited on Colly.
Three of the answers are what the app already does: lines are grouped by their department until the office types a
heading of its own (ADR 0128, 1); the quote is for whoever asked, changeable on the draft (ADR 0128, 3); and the quote
prints the logo put up under Admin › Company › Logo in full colour, the same file the labels print, at 1,200 pixels on
its longer side (about 450 dots an inch at the quote's 67 mm), while labels make their own grey or pure black and white
copy of it on the device (ADR 0155, ADR 0163). Those three stay as they are. The other three change the app.

## Decision

1. **A line given free reads No charge**, on the draft, the printed quote, the PDF and the client's page, where it read
   Included. Kit under a package priced as a whole still reads Included: it's in the package, not given free.
2. **A sent quote holds its kit.** Sending a quote, or marking it sent, makes the job quoted (as before), and a quoted
   job's kit is now held, counted as taken as a confirmed job's is (`kitHoldOf`): another quote for the same days sees it
   gone, and the job's own kit list says short in red, not "would be short". A draft's kit stays on the job's list
   pencilled in, as an enquiry's (ADR 0126), so other drafts see it beside what's free ("4 pencilled on other drafts").
   Vans and pick lists still wait for the job to be confirmed: Colly asked about stock, and a van booked on a quote that
   may not go ahead isn't one the warehouse loads.
3. **A dry hire is delivered or collected.** New quote's Show or dry hire choice comes out of More about the enquiry, and
   a dry hire asks How it gets there: Delivery ("We take it to them and bring it back") or Collection ("They collect it
   and return it"). Its two days are called From and To for a delivery and Collection and Return for a collection, each
   with an optional time. A delivery asks for the address it goes to, found on the map as it's left. The same is asked on
   New for a dry hire and under Change details. It's kept on the job as one record (`projects.hire`): the handover, the
   two times, and for a delivery the address and its pin. A dry hire from before reads as a collection, which is what
   ADR 0128 made it.
4. **The quote says the days that way.** The printed quote, the PDF and the client's page give a dry hire's days as
   "From Fri 20 Nov, 09:00" and "To Mon 23 Nov, 18:00", or "Collection …" and "Return …", and "Delivered to …" under
   them. The job's page says them the same way.
5. **A delivery puts its own line on the quote.** Worked out on the draft as travel is: "Delivery, 194 km from the
   warehouse", the road km (as the crow flies and a fifth more, as the vans' drives, ADR 0179) times the price a km set
   under Admin › Company › Dry hire delivery, charged once, under its own Delivery heading. Until the warehouse is on the
   map it's measured from Dublin city centre and says so. With no address, no pin or no price, there's a Delivery row
   saying why, and the check before the quote goes lists it.

### Amended 15 November 2026: a set amount, then each km after

Colly: "For the dry hire delivery can we change the pricing rules to be a set amount (set in the admin section) for a
certain distance, and then km after that are charged at an individual rate (also set in the admin area)."

Admin › Company › Dry hire delivery now asks three things: a **set amount**, the km it **covers**, and the price of
**each km after**. A delivery within the km covered is the set amount alone; one further is the set amount plus each km
past them at the price a km, on one line: "Delivery, 74 km from the warehouse: the first 20 km, then 54 km at €1.50 a
km", charged once. With no set amount every km is at the price a km, as before, so a price set under 1.202.0 still
charges as it did. Past the km covered with no price a km, there's no line and the row says why, rather than charge the
set amount alone for a long delivery. Stored as `quote_settings.delivery_base_cents` and `delivery_base_km`;
`quoting.delivery` carries them, and an app from before them leaves them as they are.

## Consequences

- A quoted job that's never answered holds its kit until its days pass or it's marked lost. The quotes the app makes
  have days, and Money › To follow up already lists the ones gone quiet; marking one lost frees its kit at once.
- Made-up and real jobs already quoted hold their kit from this version on, so a kit list can turn red where it was
  amber the day before. That's the answer working, not a fault.
- The km are measured one way. The card says so: set the amounts to cover the trip there and back.
- Two new things are stored: `projects.hire` (jsonb) and `quote_settings.delivery_cents_per_km`. An older app leaves
  both as they are. Nothing is sent to anyone.

## Not done

- Typing the real delivery distance on the quote, as travel's can be. The address is the office's to put right under
  Change details; a typed distance can come if the map's is often out.
- A deposit or ID for a dry hire, which the question also wondered about: Colly's answer didn't ask for them.
- Booking a van for a delivery by itself. The Transport tab still books one by hand, and its drive is estimated to the
  venue, which a dry hire hasn't got.
