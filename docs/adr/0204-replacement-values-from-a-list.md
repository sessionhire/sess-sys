# ADR 0204: Replacement values from a list

- **Status:** accepted
- **Date:** 27 November 2026
- **Asked for by:** Colly, 27 November 2026, after a sweep of current retail prices for the products Current RMS gave a
  replacement charge: "Update all the high confidence ones", then, told the stock import only fills empty values, "You
  can build that function now", and "Once we have all the products put into the system we can run this exercise again
  to make sure everything is up to date."
- **Builds on:** [ADR 0197](0197-replacement-values-from-current-rms.md) (Current RMS's replacement
  charge fills a value only where a product has none) and the stock import ([ADR 0026](0026-bringing-in-the-stock-list-and-item-logs.md)),
  which also keeps a value set here.

## Context

A product's replacement value ("Value of one") is set by hand, filled from Current RMS where empty, or filled by the stock
import where empty. Both fills keep a value already there, on purpose: a value typed here is the office's. But a price
check exists to replace values that have gone stale, and it gives a list: product, value. Typing twenty, or two hundred,
values on product pages is slow and easy to get wrong, and the stock import can't do it: it needs a quantity on every
row and adds stock as it goes.

## Decision

Admin › Data has **Replacement values from a list**, for anyone who looks after the stock.

- The office chooses a CSV, or pastes lines such as "Yamaha DM3, 1,999". In a sheet, the product is the column named
  product, name, item, model or description, and the value is the column saying new, to use or suggested before one
  saying value, price, cost or replacement; never one saying now, old, was or current. So the price check's own sheet
  goes in as it is, its today's figure left alone.
- A product is found by its name, another name it goes by, or its stock code, as Current RMS's fill-in finds one.
- Before anything is set, the card shows every value it would set, from what to what, then how many are already the
  same, rows left without a value, names not found, values it can't read, and products named twice (the first row
  counts). A value of nothing is never set.
- One press sets them, a value already here **replaced**. Each is an ordinary product change, so each is in the history
  and can be changed back on the product's page.

## Consequences

- Repeating the price check once every product is on the list is a matter of producing the sheet and choosing it here.
- A value typed here can now be changed in bulk, but only by a person choosing a list and pressing Set after seeing
  every change; the fills from Current RMS and the stock import still never replace one.
- The list's figures go in as written: whether a price includes VAT is the sheet's to say.
