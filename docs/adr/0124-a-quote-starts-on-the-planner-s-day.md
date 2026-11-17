# 0124. A quote starts on the planner's day, as a calendar makes an event

Date: 9 November 2026

## Status

Accepted. Builds on [ADR 0120](0120-a-quote-from-a-planner-day-and-keys-at-a-desk.md), which put "+ Quote" on each day of the planner's week.

## Context

Since ADR 0120, "+ Quote" on a day of the planner moved to Quotes with New
quote open on that day. Colly asked for it to work the way an event is
made in Google Calendar: press the day, and a small card opens on it with
the essentials; save from there, or open the full form for more. The move
to Quotes lost the week the office was looking at, and the full form asks
for more than a quick enquiry needs (who asked, how it came, lines from a
past job, a pasted enquiry for Claude).

The design system has the parts: a **popover** (anchored, no veil, closed
by Escape or a press outside) and a **sheet** (a phone's panel up from the
foot, over the veil), and says every overlay has the same surface, edge and
motion.

## Decision

- Pressing "+ Quote" on a day opens a **card on that day**, and the planner
  stays where it is behind it. The card has the job's name as its big field
  (focused as it opens, as the event's title is), From and To filled in
  with the day, the client and the venue, and two ways out: **Start the
  quote**, which makes the job as an enquiry with one Show across the days
  and an empty quote on it, then opens the quote, as New quote does; and
  **More options**, which goes to New quote on that day with what was typed
  carried over.
- At a desk the card hangs under the day's button, kept inside the window
  (below it when it fits, else above). There is no veil, so the week is
  readable behind it, and a press outside closes it. On a phone it is a
  sheet up from the foot over the veil. One native `<dialog>` does both:
  Escape, the focus trap and focus going back to the day's button are the
  browser's.
- The day's "+ Quote" is a button, since it opens something here rather
  than moving; the address doesn't change while the card is open.
- What the card carries to the full form is kept in sessionStorage for the
  one move and read once; a later New quote starts clean.

## Consequences

- The office starts a quote without leaving the week, in three fields.
  Everything else is still on the quote, where it was.
- The month view keeps its day links to the week: its cells are too narrow
  for the button, and the week is one press away.
- The card's big title field is the one departure from the app's field
  look, taken from the calendar pattern Colly asked for; the rest of the
  card uses the app's own fields and buttons.
- A learning for the design system: an app that keeps its screens in the
  address hash can open a popover-shaped dialog without moving, and the
  same dialog serves as a sheet on a phone with CSS alone.
