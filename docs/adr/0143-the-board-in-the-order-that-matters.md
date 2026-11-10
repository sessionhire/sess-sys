# ADR 0143: The Board in the order that matters

- **Status:** accepted
- **Date:** 10 November 2026
- **Asked for by:** Colly ("On the board view, to make it work more like a proper
  kanban board can we add re-ordering to set the priority order. Outside of the
  priority being given by human input you can rank by time to the gig", and "on the
  cards … a more graphical representation of the status in the planning phase …
  a 'Crew' with a coloured status dot and 'Kit' with a coloured status dot", 10
  November 2026)
- **Changes:** [ADR 0104](0104-stages-tasks-and-one-next-button.md) part 3 (the
  Board read only, soonest first): a column can now be put in order by hand.

## Context

The Board (ADR 0104) shows a column a stage and a card a job, soonest first. The
office wanted it to work like a kanban board, where the order of a column is a
decision: which quote to chase first, which job to plan first. ADR 0104 said
nothing drags because a job's stage is a fact worked out from its records, and a
card dragged to another column would be a wish. That still holds. Order inside a
column is not a fact the records hold: it is the office's judgement, so it is
the one thing on the Board a person sets.

## Decision

1. **Order inside a column, never across.** A card moves up or down its own
   column (Planning: inside its week, This week, Next week or Later). A job still
   changes column only when its records do.
2. **Put in order first, then by date.** The cards somebody has put in order sit
   at the top of the column in that order; under them, everyone else's go by
   time to the gig, soonest first, as before.
3. **Dropping a card is what puts it in order, with every card above it.** The
   card dropped and every card above it in its group take their places as they
   are seen, so the column reads after the drop exactly as it did when the card
   was let go. Cards already in order stay in order. (`rankedAfterDrop` in
   `shared/src/board-order.ts`.)
4. **The order holds while the job is in that stage.** It is kept with the stage
   it was set in. When the job moves on, it goes back to date order in its new
   column, rather than carrying a place set for different work.
5. **Back to date order** under a column's count takes its cards' places off.
6. **One handle, three ways to move.** Each card has a Move button (the sort
   arrows) at its top right, after the design system's drag and drop and list:
   drag it (mouse, pen or finger; only the button takes the drag, so a phone still
   scrolls by the card; a line shows where it will land and nothing moves until
   it is let go); or press it, then the arrows, Home or End, then Space (Escape
   puts it back); or press it, then press the card whose place it should take.
   Each move is said in a live region.
7. **Who.** The office and the heads, who give out the tasks (`steps`); staff
   crew see the order but don't change it. The device and the server both refuse
   it.
8. **Kept by the server, for everyone.** A table `job_ranks` (one row per job:
   the stage and its place), synced as `jobRank` records by the command
   `jobRank.set` (`ids` top first, or `clear`). Only the jobs named change, so a
   column seen narrowed to one department leaves the others' places as they were.
   A job combined into another loses its place; a job deleted takes its row.
9. **Crew and Kit dots on Planning cards.** In Planning the card's footer says
   the crew and the kit as two words, each with a dot, at the right: green when
   done or nothing is short, amber when crew are still to book or confirm or
   kit is short, the bad tone when its task is late, and hollow while there's
   nothing on the job yet. Crew carries its count ("3/5") and Kit how many lines
   are short, so the colour is never alone; the words are in each dot's name for a
   screen reader and in its hover. The line keeps whose it is and when.

## Consequences

- Two people reordering the same column at once: the last drop wins, as with any
  edit; the Board shows the server's order on the next sync.
- A card put in order in one department's view keeps its number when another
  department's cards are put in order around it, so two numbers can match; the
  tie goes by date.
- The dots are drawn only in Planning, where crew and kit are the work. Other
  columns keep their sentence.
