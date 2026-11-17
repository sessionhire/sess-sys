# ADR 0117: Starter packages from Current RMS's quotes

- **Status:** accepted
- **Date:** 8 November 2026
- **Asked for by:** Colly, 8 November 2026: "Can we analyse the previous
  quotes from current RMS to try find a pattern for creating a list of
  these templates to start off?"; then, on the proposed list: "Let's try
  all to start", yes to adding mics and DIs to the stock list, "Start with
  the price for the total for all items in package and then allow a
  discount to a set price", and "No generic names only".
- **Builds on:** [ADR 0087](0087-packages.md) and
  [ADR 0116](0116-a-package-is-a-shortcut-for-its-kit.md) (packages as a
  shortcut for their kit), [ADR 0092](0092-current-rms-history-on-quotes.md)
  (the RMS history), [ADR 0070](0070-finding-a-product-by-typing.md)
  (other names).

## Context

The office had no packages to start from. The research in
[docs/research/package-starter-list.md](../research/package-starter-list.md)
read all 1,072 Current RMS quotes and proposed 43 packages; Colly took them
all but the two named for clients. The live price list can't be written
from outside the app (Claude never writes live data), so the office needs a
way to add them itself.

## Decision

1. **The list lives in the app** (`shared/src/starter-packages.ts`): 41
   packages naming their products as the stock list does, each with a
   fixed id (`pkg-…`).
2. **Money's price list offers them**, under Packages, while any is still
   to add: one button adds them all through `package.save`, as the office
   adding them by hand would, so they're in the history and every device.
   Once all are there the card is gone; a package taken off afterwards is
   offered again.
3. **Products are found by name or another name**, capitals, spaces and
   dashes not counting. A package holding a product the stock list
   doesn't have waits, and the card says which product; giving the
   product that name as another name brings it in.
4. **Mics and DI boxes.** The stock list had one wired mic and no DIs, so
   the mic packages bring eight products (SM57, Beta 52A, Beta 91A, e904,
   e906, C451 B, passive and active DI), added counted with nothing
   counted, for the warehouse to count. One already on the list by any of
   its names is used instead. Which mics, and how many in each mic
   package, are a first guess for the office to change.
5. **Price.** Each package is priced at what its kit adds up to, as Colly
   asked; only Decor LX, which Current RMS always charged as one line,
   starts at a set price (€1,800 a week). Showing the total and a set
   price as a discount from it is the price editor's, built separately.

## Consequences

- Nothing is written to live data until someone in the office presses the
  button; the products and packages are theirs to change after.
- Quantities are what past quotes most often had, not rules: a package is
  a start, changed per job on the quote.
