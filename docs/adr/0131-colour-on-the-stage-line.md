# ADR 0131: Colour on the stage line says how far along

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("Can we add some colour into the
  stage progression visual to make it more visually intuitive?").
- **Builds on:** [ADR 0104](0104-stages-tasks-and-one-next-button.md) (the
  five stages, the stage line and the Board) and
  [ADR 0073](0073-a-jobs-steps-and-who-has-each.md) (the steps strip).

## Context

The five stages (Quoting, Planning, Going out, On the job, Back) were drawn
in greys: passed stages a filled grey dot, the stage the job is in ringed in
ink, stages to come outlined. On a list row the small bar of five segments
was grey with the current one in ink. It read correctly once you looked, but
nothing said "this far along" at a glance, and the job page's big line and
the list's small bar didn't look like the same thing as the Board's columns,
which had no mark at all.

The shared design system's colour grammar gives each colour one meaning. A
hue for each stage would be five colours with no meaning beyond "which
stage", which the stage's name already says, and three of them would sit
on the grammar's own (amber is attention, burnt orange is bad here, green
is healthy). So colour carries state, not identity.

## Decision

1. **Progress is the app's red, "you" and the current item.** On the job
   page, passed stages are filled red with a white tick, the line from the
   first stage to the one the job is in is red, and the stage the job is in
   is ringed in red with its name in red. Stages to come stay grey outlines.
   It reads as a bar filled up to here.
2. **The stage the job is in takes the job's tone.** Amber when crew or kit
   is short in it, burnt orange when a task is late: the same tones the
   job's line already gave its words on lists, now on the big line too.
3. **The small bar matches.** On list rows, Home, the job head and the
   Board, passed segments are a lighter red, the current one the full red
   (or its tone), to come grey. The words beside stay ink, so a list of
   jobs isn't a wall of red.
4. **The Board's columns carry the same bar**, with that column's stage as
   the current one, so a column reads as a place on the job's line. Through
   is all five passed.
5. **A stopped job keeps no colour of progress.** What it got through stays
   grey, as before.

The words still say everything the colour does ("In Planning · 2 of 8 tasks
done", each stage's spoken name), so nothing depends on seeing red.

## Consequences

- The red now marks progress as well as the current tab, the selection and
  the one thing to press. It's the same meaning, "where you are", but there
  is more red on a job page than before; the opened stage's red underline
  sits under the current stage most of the time.
- Contrast: the white tick sits on the deeper red (5.7:1). The brand red
  ring and line are graphics beside words that say the same, at 3:1 or more
  against the panel in both themes.
