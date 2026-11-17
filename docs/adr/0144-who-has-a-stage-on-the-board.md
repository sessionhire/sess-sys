# ADR 0144: Who has a stage, given on the Board

- **Status:** accepted
- **Date:** 10 November 2026
- **Asked for by:** Colly ("we need to be able to assign each stage to members
  of the staff, or take yourself. Such as when it needs to be picked to assign
  it to someone, and have the ability to change that too", 10 November 2026)
- **Builds on:** [ADR 0073](0073-a-jobs-steps-and-who-has-each.md) (tasks with an owner),
  [ADR 0104](0104-stages-tasks-and-one-next-button.md) (stages and the Board)

## Context

Each of a job's eight tasks could already be given to a member of staff, on the
job page, one task at a time: open the job, open the stage, open the task, pick
from Down to. On the Board, where the office looks to see what is stuck, a
card said whose the next task was but couldn't change it. Handing out the
week's picking meant opening every job.

## Decision

1. **A stage is given by giving its open tasks.** Who has the stage a job is in
   is the person every open task of that stage is down to. Giving the stage
   writes the same task records (`jobStep.set`), so nothing new is stored, the
   job page's Down to agrees, the tasks land on that person's list on Home and
   they hear of it in Notifications, in the app only. A stage with no task open
   while one from before is still open hands over that one, the job's next.
   When the open tasks are down to different people the card says so ("Split:
   Ana, Ben") and a choice gives them all to one.
2. **At the card's foot, outside the link.** Each Board card has a person icon
   and a native select under it: Nobody yet, then Me (first name), then the
   staff. Choosing never opens the job. A native select because it is the
   job page's own Down to, opens the phone's own picker (no list scrolling
   inside a card) and keeps the 44px target. You come first so taking a stage
   is the same two presses wherever you sit in the list.
3. **Said once.** The card's line no longer adds the owner's name; the foot says
   it.
4. **Staff crew** see whose it is as words, since they may change only tasks
   that are theirs (ADR 0073).

## Consequences

- No new storage, command or permission. A stage given is several task records;
  on Planning that is crew and kit together, and the person hears of each.
- The job page still gives tasks one at a time, for a stage shared out.
