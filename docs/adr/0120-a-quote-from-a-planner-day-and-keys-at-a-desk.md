# ADR 0120: A quote from a day on the planner, and keys at a desk

- **Status:** accepted
- **Date:** 8 November 2026
- **Asked for by:** Colly, 8 November 2026, picking ideas 3 and 4 from
  [Rentdeck, set beside the app](../research/competitor-rentdeck.md)
  ("1, 2, 3, 4, 6").
- **Builds on:** [ADR 0010](0010-planner.md) (the planner),
  [ADR 0088](0088-quotes-in-the-sidebar.md) (the Quotes page),
  [ADR 0036](0036-desk-layout-sidebar-and-dark-by-default.md) (the desk from 900px).

## Context

Rentdeck starts a booking by pressing a day in its calendar, and moves
around by keyboard. In the app, the office looking at a free week on the
planner had to go to Quotes, press New quote and type the date again. And
the office at a desk does the same few moves all day, each by mouse.

## Decision

1. **Each day in the planner's week view has "+ Quote"**, for those who see
   money, from today on (a quote for a day gone is never wanted). It opens
   New quote on the Quotes page with the job starting and ending that day.
   The address is `#quotes/new/<day>`, and `#quotes/new` opens it with no
   day, so the browser's back closes it as it opened it.
2. **Keys at a desk**, from 900px across only: G then H, J, P, Q, S, C or M
   goes to Home, Jobs, the planner, Quotes, Stock, Crew or Menu; N then Q
   starts a new quote; / goes to the page's search box; ? lists them all in
   the design system's dialog, which Escape or Close shuts.
3. **A key is a shortcut only when nothing else wants it**: not while
   typing in a field or a dialog, not held with Ctrl, Alt or Command (the
   browser's own keys), and never on a screen made for scanning, where a
   keyboard scanner types letters too.
4. **Each is shown where the slow way is**: the sidebar's places and New
   quote say "Shortcut: G then J" as the browser's hint, so they can be
   learnt by using the app, as the design system asks.

## Considered

- **Single letters (J for Jobs).** Quicker, but one stray key moves the
  page. Two keys, the way many web apps do it, are hard to press by chance.
- **Press and drag across days for a span.** Rentdeck does it; on a phone
  it fights scrolling (no captive scroll), and the span is two taps in the
  form anyway.
- **Keys on phones with keyboards.** Left out: the phone layout has no
  sidebar to teach them, and a tablet with a keyboard is wide enough to be
  a desk.

## Consequences

- A quote from the planner is a click, and the day carries across.
- New keys go in `web/src/shortcuts.tsx`, which the help sheet reads, so
  the list can't drift from what works.
