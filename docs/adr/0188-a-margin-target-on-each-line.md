# ADR 0188: A margin target on each quote line

- **Status:** accepted
- **Date:** 18 November 2026
- **Asked for by:** Colly, 18 November 2026: "can we add a colour validation to the discount applied on each line item
  that corresponds to how much margin we have. We can set a percentage of the purchase value of the stock to set a
  default margin for all products, this is set in the admin panel. Then individual products can have the ability to set
  that margin higher through setting on their individual product pages. For items above the margin target they validate
  as green on the discount field. Where discount applies would cause items to be rented at between 50-100% of target
  margin the should go orange. And then anything below 50% is red."
- **Builds on:** [ADR 0089](0089-availability-subhire-and-margin-on-quotes.md) (margin on quotes), the own kit running cost (quote flow audit,
  finding 19).

## Context

A quote line used to say "makes €…" under its total. That went when each line became one row (1.208.1), and Colly asked
for something in its place that answers the question a discount raises: is this still worth hiring out at this price?

## Decision

- **The target is a share of what one cost to buy, for each day it's charged.** The value is the product's "Value of one"
  (what one would cost to replace). A line's target is that value × the target % × how many × the days charged (once for a
  line charged once). This is the hire trade's usual rule of a day rate as a share of purchase price; days charged, not
  days out, so a week rate's shorter count is what's measured.
- **What the line makes** is its total after its own discount, less what it costs: own kit's running cost when the office
  has set one, or a cost typed on the line.
- **Good** at or above the target (green), **short** from half of it (amber), **bad** under half (Session Hire's bad tone).
  The discount box takes the tone's edge and wash, with the words in its title and as the field's description for a
  screen reader.
- **Admin › Company › Margin target** sets it for every product (`quote_settings.margin_target_pct`, 0.1 to 100, one
  decimal place; `quoting.marginTarget`, money). Left blank, nothing is coloured.
- **A product's page** can ask for more (`models.margin_pct`, through `model.update`), only above the office's; blank
  takes the office's. The higher of the two counts, so raising the office's later never leaves a product below it.
- **Only own kit with a value is measured.** Hired-in kit, packages, kit included in a package, words, crew and the
  rest have no purchase value to measure by and aren't coloured. Only people who see money see the colours and the
  product's target.

## Consequences

- Products with no value aren't coloured, so filling in values is what turns this on across the catalogue.
- The quote-wide discount isn't counted against a line: the colour is about the line's own discount, where it's typed.
