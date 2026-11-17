# ADR 0147: Search as a command palette

- **Status:** accepted
- **Date:** 11 November 2026
- **Asked for by:** Colly ("Can the global search option more in the style of a
  command palette? With similar keyboard shortcut. As an overlay that blurs and
  slightly darkens the background.")
- **Changes:** [ADR 0146](0146-one-search-for-everything.md) (Search was a page
  under the Menu), [ADR 0120](0120-a-quote-from-a-planner-day-and-keys-at-a-desk.md) (the keys)

## Context

ADR 0146 put one search for everything behind a magnifier in the top bar, as a
page of its own (`#search`). Looking something up took you away from where you
were, and the habit most office software has taught (Ctrl K or Command K, a box
over the screen, arrows and Enter) didn't work.

## Decision

1. **An overlay, not a page.** The magnifier, **Ctrl K** (**Command K** on a
   Mac) and **/** at a desk open the search over the screen you're on. It's the
   design system's dialog (`showModal()`, focus in its field, back where it was
   on close) near the top of the screen, so the results grow down into the
   room under it. The screen behind is blurred and dimmed a little.
2. **Ctrl K works anywhere**, a field included, and on any device with a
   keyboard (an iPad's too), as it does in other apps; pressed again, it
   closes. It stands down only over another dialog, which is a decision
   waiting. The browser's own Ctrl K gives way.
3. **The field has the combobox's keys** (design system, components.md):
   while something is typed one result is always highlighted, the one Enter
   opens; Up and Down move, wrapping; with nothing typed nothing is
   highlighted until Down. Escape, a press outside or the close button shuts
   it. A result is chosen on the press, so the field keeps the cursor.
4. **Places to go are in it.** With nothing typed it lists the places the keys
   at a desk reach (Home, Jobs, the planner, Quotes, Stock, Crew, Menu, New
   quote, money-only ones for those who see money), each with its keys shown
   at a desk, so the faster way is learnt where the slow way is used. Typed,
   a place whose name starts with what's typed comes before the records;
   otherwise after them.
5. **Results as before** (ADR 0146): by kind, with counts, five a kind and
   "Show all" as a row the arrows reach. What's typed is kept while the app is
   open and selected when it opens again, so typing starts afresh and Down
   goes back to the same results.
6. **Old links**: `#search` opens the palette over Home.

## Consequences

- The veil is lighter than a dialog's (`alpha.black-30` dark, `black-20`
  light, against the system's `veil` at 55% and 40%) and blurs, a departure
  sent back to the design system as a learning: a quick look rather than a
  decision that stops the work.
- The list scrolls inside the palette on a phone: it's an overlay, which the
  no-captive-scroll rule leaves out. It fits above the phone's keyboard.
- Search no longer lights the Menu's tab, as it isn't a place.
