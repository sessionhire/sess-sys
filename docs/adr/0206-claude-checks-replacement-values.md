# ADR 0206: Claude checks replacement values

- **Status:** accepted
- **Date:** 27 November 2026
- **Asked for by:** Colly, 27 November 2026, after the retail price sweep behind
  [ADR 0204](0204-replacement-values-from-a-list.md) was done by hand: "Can this be made a process for the claude inside
  of the app in case we need to rerun in future?" Earlier the same day: "prices on thomann are a good marker so if you
  find a thomann price then happy to take it with high confidence".
- **Builds on:** [ADR 0096](0096-claude-inside-the-app.md) (every ask to Claude is turned down unless it's set up, on and
  within the month's limit, and its answer is read leniently), [ADR 0203](0203-adding-many-products-from-photos.md)
  (Claude searches the web, each search counted toward the limit) and ADR 0204 (a list of values is shown from what to
  what before anything is set).

## Context

The first price check was a long sweep done outside the app: search shops for each product, say how sure, hand the
office a sheet, then set the ones they chose. Colly wants to run it again once every product is on the list, and
whenever prices drift, without asking for it each time.

## Decision

Admin › Data has **Check replacement values with Claude**, beside Replacement values from a list, for anyone who looks
after the stock.

- The office picks the products: those with **no value yet** or **every product**, and one department or all. Racks
  are left out: they're built from other kit. The card says how many, about what it will cost (ten US cents a product,
  for the words and up to three searches) and what's left of the month's limit, and that the app has to stay open.
- Claude is asked about **one product at a time**, three at once, so each shows as it comes and **Stop** stops part
  way. The server reads the product by its id (name, other names, department, category, length and value now), so only
  the stock list's own words are sent, and a product's name can never change the rules.
- Claude gives the price of one, new, in whole euro **with Irish VAT**, from a shop in Ireland or the EU that ships here;
  Thomann first, its price without VAT multiplied by 1.23; never a used price; the successor when it's no longer made.
  It says how sure: **High** for Thomann's price on the exact model, or two shops within about a tenth; **Medium** for
  one other shop, or the successor's price; **Low** for anything less, such as a trade-only maker with no price shown.
  It says no price found rather than guess.
- The results are grouped High, Medium, Low, no price found and couldn't be checked, each with what was priced, where and
  why. High is chosen by default; Medium and Low can be added. **Use N prices** puts the chosen ones into Replacement
  values from a list as a sheet, which shows every change from what to what before Set, as any list does.
  **Download the results** gives the whole sheet, in the shape that card reads.
- The run is kept while the app is open, so moving to another page doesn't lose it.

## Consequences

- Rerunning the price check is one card and a press, at a few cents a product, and nothing is set without a person
  seeing every change.
- The run lives in the browser: closing the app loses what hasn't been downloaded or used. A run on the server would
  survive that, but needs a queue and a place to keep results; not worth it for something run a few times a year.
- What Claude finds is only as good as the shops' pages; Low prices are offered but never chosen by default.
