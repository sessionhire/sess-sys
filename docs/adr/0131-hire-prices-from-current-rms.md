# ADR 0131: Hire prices are filled in from Current RMS

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("Can you populate the prices of
  stock to rent from Current RMS?").
- **Builds on:** [ADR 0078](0078-reading-current-rms-through-its-api.md) (the read-only Current
  RMS connection), [ADR 0056](0056-bringing-the-stock-in-from-current-rms.md) (the stock
  bring-in, which kept each product's Current RMS id),
  [ADR 0070](0070-finding-a-product-by-typing.md) (other names a product goes
  by), [ADR 0085](0085-rate-rules-discounts-and-an-agreed-price.md) (rate rules on the price
  list).

## Context

Quotes take a product's price from the price list. The stock bring-in of
19 October filled in a day price only where the export gave one and the
product had none, read every rental price as a day price whatever its rate
definition, and was a one-off from files. Since then products have been
added, renamed and given other names, and prices change in Current RMS,
which the office still prices from.

## Decision

1. **The server reads the prices itself**, through the Current RMS
   connection: every product (a hundred a request), and each one's rates,
   from the product list where Current RMS includes them, else from its
   own request at a request a second, so three hundred products is a few
   minutes. Sale-only products are skipped. The rate used is a rental rate
   in force today, the office's store's own where it has one with a price,
   else the store-wide one, as the stock bring-in reads the export; nought
   is no price. Its rate definition becomes the app's rule: Daily Rate,
   3 Day Week Rate and Weekly Rate; any other isn't one the app can charge
   by, and the product is listed as having no hire price. It runs in the
   background with progress and Stop, from Admin › Connections; only a read
   that finishes replaces the copy kept (`rms_products`), so a stopped one
   leaves the last whole read standing. It only ever asks Current RMS.
2. **Matching:** the Current RMS id kept on the product first, so a renamed
   product is still found; else its name, or one of its other names, a
   product's own name before another's other name. One Current RMS product
   prices one product here.
3. **A preview before anything changes.** The card says how many prices
   would be filled in (no price here), brought up to date (the price came
   from Current RMS before, or it is the same price with only the rule to
   add), set here by hand and different, already the same, matched with no
   hire price in Current RMS, priced in Current RMS but not found here, and
   products here Current RMS doesn't have; each list opens in place.
4. **A price set here stays** unless the tick "Use Current RMS's price for
   the ones set here too" is on. The price list now knows where each price
   came from: a fill-in marks its prices as from Current RMS
   (`product_prices.from_rms`), and a price typed on the price list, or by
   the stock bring-in, is the office's. So a second run follows Current
   RMS's changes to its own prices and leaves the office's.
5. **One change, in the history.** Fill in is one command,
   `price.fromRms { overwrite }`, which the server works out from its copy
   the same way the preview did (`rmsPricePlan` in
   `shared/src/rms-prices.ts`), so what's done is what was shown. It is in
   History as "Filled in hire prices from Current RMS". A device doesn't lay
   it over its copy while it waits: the prices it needs are on the server
   only.
6. Seeing the preview and filling in is money (office and directors);
   reading Current RMS again is bringing a list in, a setting, as the
   quote read is.

## Consequences

- Quotes pick the prices up as any price on the price list.
- A product whose Current RMS name differs from every name it has here is
  listed as not found; adding that name as another name on its page finds
  it on the next run.
- Current RMS's price categories and date-limited rates are not used.

## Open

- Whether to run the read on a schedule. For now the office runs it when
  prices change in Current RMS.
