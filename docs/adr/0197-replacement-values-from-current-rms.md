# ADR 0197: Replacement values come in from Current RMS with the hire prices

- **Status:** accepted
- **Date:** 26 November 2026
- **Asked for by:** Colly, 26 November 2026 ("use the pricing in Current RMS
  to populate the rental prices in the new system, and also see if it's
  possible to populate the replacement costs for the equipment").
- **Builds on:** [ADR 0132](0132-hire-prices-from-current-rms.md)
  (hire prices filled in from Current RMS), [ADR 0056](0056-bringing-the-stock-in-from-current-rms.md)
  (the stock bring-in, which took the export's replacement charge as a
  product's value).

## Context

A product's replacement value is what the office charges when kit is lost
or damaged on hire, and what the stock list's worth adds up from. Current
RMS keeps a replacement charge on 190 of its 309 products. The stock
bring-in took it from the export file, once, but only for products made by
that bring-in; products added or renamed since, and any stock list brought
in another way, have none. The read of hire prices (ADR 0132) already asks
Current RMS for every product, and the replacement charge comes back in the
same answer, so it costs no extra requests.

## Decision

1. **The price read keeps each product's replacement charge** beside its
   hire price (`rms_products.replacement_cents`); nought is none, as with
   prices.
2. **It fills in only empty values.** A matched product (same matching as
   ADR 0132) with no replacement value here, or a value of nought, takes
   Current RMS's. A value someone typed here is never changed, and there is
   no tick to change it: unlike a hire price, a value is not something
   Current RMS keeps more current than the office does. The card counts the
   ones that differ so the office can look.
3. **One press does both.** The card on Admin › Connections is now
   "Prices and replacement values from Current RMS"; it lists the values it
   would fill in beside the prices, and "Fill in" writes both. History says
   so.

## Not done here

Replacement costs for the 119 products Current RMS has none for are being
looked up by hand from European shops that deliver to Ireland, each with
its source and how sure the match is, for Colly to approve before any goes
in. They are not scraped by the app: the shops that matter either refuse
automated readers or offer data only to affiliates.
