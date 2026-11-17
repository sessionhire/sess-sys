# ADR 0133: The quote flow's last rough edges

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("Work on all of these in order
  overnight", then "Go"), batch 7 of the
  [audit of the quote flow](../audit-quote-flow-2026-11-08.md): findings 13,
  15, 19, 20 and 21.
- **Changes:** [ADR 0100](0100-the-quote-form-redrawn.md) (the draft saves
  itself once it reads as a quote) and
  [ADR 0089](0089-availability-subhire-and-margin-on-quotes.md) (own kit
  costs nothing in the margin).

## Context

Five small things the audit found, each one a place where the office would
stop and wonder:

- **13.** The draft saved only when every line read as a quote, so one
  empty "something else" held back every other change on it, and a
  colleague's device saw none of them.
- **15.** A festival-sized draft on a phone was about eight screens long
  with nothing folded, and while kit was being picked there, the picker's
  list had room for two options under the readout and above the keyboard.
- **19.** Own kit counted as costing nothing, so a quote of our own kit
  read a 100% margin, which looks like a mistake.
- **20.** Marked sent with no signal, a quote showed the number the device
  expected. Another quote sent first would take that number, and a PDF
  printed in the meantime would carry the wrong one.
- **21.** Three slips: "No per diem set yet" said twice on the No
  subsistence row, "Quote wanted by (optional)" wrapping on a desk, and the
  picker matching inside words, so "1 das" offered Midas consoles.

## Decision

1. **A half-made line holds back only itself.** Every whole line saves. A
   line that isn't finished keeps what it was when last saved, or isn't
   saved at all if it's new. The readout says "Line 4 not saved" and leads
   to it, and Send says the rest is saved. Changes to the terms (a discount,
   a deposit) still wait until they read right, as before, because they
   change every line's sum.
2. **A long draft on a phone opens folded.** On a phone, a draft of more
   than twelve lines opens with each group folded to its title, how many
   lines it has and what they come to. A tap opens a group. A group a line
   is added to, or that holds the open line, stays open. At a desk, and on
   short drafts, nothing changes: groups can still be folded, but they open
   unfolded.
3. **Picking on a phone gets the screen.** While kit or crew is being
   picked on a phone, the readout drops to its first figure and the bottom
   bar steps aside, so the list has the room under the search.
4. **Own kit costs what the office says it costs to run.** Admin ›
   Company › Own kit in the margin takes a percentage of what own kit is
   charged at (wear, repairs, testing, the store), and each margin takes it
   off for own kit, as it takes off what hired-in kit and crew cost. A line
   with its own cost typed keeps it. Until the share is set, own kit costs
   nothing, as before, and the margin says "own kit not costed" beside it,
   linking to where it's set. Words between lines cost nothing, so they
   never show up as "no cost yet".
5. **A guessed number says it's a guess.** A number this device gave with
   no signal reads "Quote 1043 (once it's saved)", and the printed page
   says "Draft quote" and leaves out "give quote 1043 as the reference"
   until the server has given it. A new version of a quote already numbered
   keeps that number, so isn't a guess.
6. **The slips.** The No subsistence row says "No per diem set yet." and the
   line under it says where to set it. "Quote wanted by" is "Wanted by".
   In the picker, a word of one to three letters is found only at the start
   of a word ("das" finds DAS, not Midas); a longer word, or one with a
   number in it, is still found anywhere ("58" in SM58).

## Consequences

- One person's half-typed line never hides the rest of their work from a
  colleague's device.
- The office sets one figure to make every margin honest about own kit,
  and can leave it blank and still see why the margin is high.
- A PDF printed offline can't go out with a number another quote takes.

## Not done

- The finding 15 "picker has room" is measured from the layout, not from a
  real phone's keyboard; the bar already stepped aside when the keyboard
  is up.
- Own kit's share is one figure for all own kit. A share for each
  department, or for each product, waits until one figure proves too rough.
