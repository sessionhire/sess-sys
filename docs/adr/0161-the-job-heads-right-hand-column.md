# ADR 0161: The job head's right-hand column: status, who has it, Next

- **Status:** accepted
- **Date:** 12 November 2026
- **Asked for by:** Colly, 12 November 2026, with a screenshot of an
  enquiry's head ("Enquiry" on the left, "Next · Quoting · No quote yet ·
  Colm" over "Add the kit to quote" and "Hand it on"): "can we standardise
  this".
- **Builds on:** [ADR 0104](0104-stages-tasks-and-one-next-button.md) (the
  one Next button), [ADR 0140](0140-one-job-one-path.md) (Next acts, the
  head says it once), [ADR 0144](0144-who-has-a-stage-on-the-board.md) (who has a
  stage, given from the Board card), and the design system's combobox and
  states (`components.md`, `states.md`).
- **Changes:** ADR 0140 part 3's "the head says where the job stands, and
  Next's line says only Next": Next has no line at all now, and the head's
  stage line is the compact one. "Hand it on" leaves Next.

## Context

The top-right of a job page had grown by parts: the status pill sat
beside the title on an enquiry but became the stage line once confirmed;
Next carried a line of its own ("Next · Quoting · No quote yet · Colm"),
which said again what the head and the button said; and giving the task
to someone was a link, "Hand it on", that opened the task's card further
down the page, with its own select, away from where the name was read.

Colly asked for one column at the right of the page, top to bottom, its
first item level with the job's name so the page keeps one vertical
rhythm:

1. the **status** (Enquiry, Quoted, Confirmed…);
2. **who it's assigned to**, a combobox changed in place, saying it took:
   a small spinner while it's saved, a green tick once it's kept, and the
   chevron back after three seconds; the old way of opening the person's
   dropdown on the page to go;
3. the **Next** button, suggesting the next thing from what's done so far
   and from the kind of job (a dry hire doesn't need crew), with a small
   pie when the step is part done and words that say what's outstanding.

And "Next · No quote yet" to go.

## Decision

**One column, one grid.** The job's page head is one grid of two
columns: the title, the stage line and the facts on the left, and the
corner on the right. The title row and the status share the first row, so
the status pill is centred on the title's line whatever the title's size.
Under it, who has the job; under that, Next. One right edge, one
`space.2` gap, and the column as wide as Next (at least 260px). On a
phone the status stays level with the title, who has it goes right under
it, and Next stays docked in the foot over the bar, in the thumb's reach,
as ADR 0104 put it. The head gets a `corner` slot for this (`Page`, `Top`,
`PageHead`), which is never moved into the foot.

**The status is always the status.** The pill is the job's status on every
job, confirmed ones too. Where the job is in its five stages moves to the
line under the name, in its compact form: the five segments, the stage,
when, and "short", "late" or "no answer" when it is. What's short is
said by Next's own words and the Crew and Kit facts under it; whose it is,
by the field in the corner. So nothing in the head is said twice.

**Who has it is the stage holder.** "Assigned to" is the person who has
the stage the job is in (ADR 0144): picking someone gives them every open
task of the stage together, the same records the Board card's foot
writes, so the Board, the jobs list's Assignee column and the job page
agree. Split work says "Split: Ana, nobody", and picking one person
settles it. "Nobody yet" is offered to take it off. You are first in the
list, as on the Board. Staff crew read the name as words, as they can't
hand work on (ADR 0073). An errand or a meeting has no stages, so no
field. The task's own "Down to" stays in the task's card for the rare
task given apart from its stage.

**The field is the design system's combobox,** our `RecordPicker`, with
the system's `__toggle` chevron at the end of the box, which it didn't
have: a press shows everyone without typing, and turns over while open.
While a pick is saved the chevron's place shows a spinner, the system's
spin in the secondary ink; once kept, a tick in the ok ink (`--good`)
that grows in (fades in with reduced motion), held for three seconds,
then the chevron again. A refusal is said under the field and the
chevron comes straight back.

**Next says what's outstanding, and shows how far.** The line over it
goes. The button keeps its verb and object and says what's left rather
than what's done ("Offer the Rigger · 3 to offer", "Confirm Aoife's yes ·
2 to book", "Pick the kit · 6 to go out", "Scan the kit back · 2 still
out"); the count of what's done moves into a pie at the button's start,
in the button's own ink, filled as far as the task is done. A task with no
count of its own (making the quote, settling the kit) shows how many of
its stage's tasks are done. When the task is complete there's no pie.
The pie is hidden from screen readers, as the label already says it in
words; its count is its tooltip.

**What Next suggests already follows the job's kind**: a dry hire's crew
task is passed over when it has none asked for, so Next goes from the
yes to the kit; errands and meetings have no stages and no Next. This ADR
doesn't change that.

**"Hand it on" leaves Next.** The field above it does that job where the
name is read. Next's quiet second choice stays for an answer to check
(ADR 0152) and the pick list a week out.

## Consequences

- A job page reads the same at every status: status top right, who has
  it, then the one red button.
- The spinner shows at once, as Colly asked, rather than after the
  system's `timing.wait` (1s) for busy controls: the change is a value
  sent from a field (pending, in the system's words) and the spinner, tick
  and chevron are one short sequence that says it took. Sent back to the
  design system as a learning: an inline "saved" state for a field.
- The jobs list's Assignee column (PR #354) reads the same holder.
- Tests that read Next's labels and line move to the new words.
