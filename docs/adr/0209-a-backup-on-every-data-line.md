# ADR 0209: A backup on every data line

- **Status:** accepted
- **Date:** 28 November 2026
- **Asked for by:** Colly, 28 November 2026. Of the seven things [the research](../research/led-processors.md) said
  the LED screen builder could do next, Colly chose "All of it, hired kit included". This is the fourth in its list
  and the third built. Of the MX40, the same day: "you can connect 4 cvt10 pros to effectively make it a 40 port
  processor".
- **Builds on:** [ADR 0208](0208-a-screens-data-lines-and-what-takes-them-to-it.md) (a screen's data lines as they
  are cabled, the data cables and fibre to the screen) and [ADR 0207](0207-an-led-screen-built-on-a-quote.md) (the
  builder).

## Context

A data line leaves one port on the processor and runs through its panels, one to the next. If the cable to its first
panel fails, or a link between two panels, every panel past the break goes dark. A backup is a second feed from the
other end: a cable from the line's last panel back to a second port on the processor, which takes over when the first
feed stops. On a show that can't go dark, that is how a screen is cabled.

It costs two things. Every line takes two ports, so a processor carries half as many lines: a VX4S two, an MX30 five,
an MX40 ten from its own sockets. And every line takes a second long cable.

The builder counted every line once. A screen quoted that way and cabled with backups on the day is short of half its
long cables, and now and then of a processor: an 8 by 3.5 metre screen of the 3.9 mm panel is four lines, which is
one VX4S without backups and more than one with.

The MX40 is the one that gives nothing up. Its ports 21 to 40 only leave by fibre, and in its 40-port mode NovaStar
has them stand behind the first 20: "When Ethernet port backup is enabled in 40-port mode, the first 20 Ethernet
ports are backed up by the last 20 Ethernet ports."

## Decision

1. **A backup on every data line is one tick.** It is a part in the screen's kit list, "Backup on every data line",
   after Fibre to the screen and before the power distro. It is one tick because it is one decision: the ports, the
   cables and by fibre the converters all follow from it. It is every line or none: a backup on some lines only is
   put right on the quote.
2. **It starts off, and stays as it was left.** Every other part but fibre starts ticked, since kit left off a quote
   is the mistake that costs. A backup isn't kit a screen is short without: many screens go out without one. So it
   starts as it was left on the last screen built on that device, and off the first time, as fibre does.
3. **Unticked, it says what ticking it would add, counted as the screen would be with it.** "4 × Cat 5 reel 100 m. A
   second data cable for each of the 4 data lines, from its last panel back to a second port on the processor, which
   takes over if the first feed fails." Where the tick would change the processor too, that is said before it is
   pressed, since it is the dearest thing it does: "With it the processor is 1 × Novastar MX30: each line takes two
   of its ports."
4. **A backup is a second port for every line.** A processor carries half its ports in lines, rounded down. The lines
   are laid as ADR 0208 lays them, in whole columns where they fit, against that half. The rest follows as before:
   the smallest of ours that drives the screen whole is sent, and where one unit's ports run out, more of it side by
   side. The processor's line says what it counted: "this screen has 1,835,008 in 4 data lines, each with a backup:
   8 ports".
5. **By cable it adds as many long cables again.** The backup's cable is the one chosen for the data lines, since it
   is the same run back. The cable offered is one there are enough of on the job's days for the lines and their
   backups together.
6. **By fibre the backups go through converters and fibre of their own.** As many short cables again, and converters
   and fibre counted as ADR 0208 counts them for the lines: from an MX30 or MX40 a converter and a fibre at the
   screen for every ten backups, and from a processor with no fibre output a pair of converters. They could ride a
   converter the lines leave ports free on. They don't, because a backup that shares a converter and a fibre with the
   line it backs up is lost with it. It is also how the MX40 does it: its backups leave by fibres of their own. The
   working under the list says so: "The backups go through converters and fibre of their own, so that losing one
   converter or one fibre leaves every line fed."
7. **An MX40 keeps all 20 of its lines, by fibre.** With Fibre to the screen ticked it is counted with 40 ports, as
   ADR 0208 has it, which is 20 lines with a backup each. Past ten lines its line says what that takes: "More than
   10 lines with a backup on each takes its 40-port mode, which wants VMP and its firmware at 1.4.0 or later." By
   cable it has its 20 sockets, ten lines and their backups, and its line says when the fibre tick would do better:
   "It has 20 more ports that only leave by fibre: with Fibre to the screen ticked, one drives this screen."
8. **A VX4S asks for a check.** NovaStar lists a backup between ports for its MCTRL, MX and newer VX units, the UHD
   Jr has a test for it and the NovaPro HD's manual shows one. The VX4S's own sheet doesn't mention it. With the tick
   on, a VX4S's line carries "Check it backs up one port with another: its maker's sheet doesn't say." A processor
   the builder doesn't know is asked for its ports with its pixels: "Check it drives 1,835,008 pixels, with a second
   port for every data line: what it loads isn't known here."
9. **The quote keeps the answer on the screen's line.** A backup is more of the kit the other parts hold, so the kit
   under a screen says it only by its counts. The screen's line keeps it with the panel, the size and how it stands.
   Changing the screen from its line opens the builder with the tick as the quote has it, and unticking it lists what
   that does before it's done: "Novastar vx4s Processor: 1, where there were 2." A screen already on a quote has no
   backup and opens with it unticked.
10. **The client is told.** The words under the screen's line, which print on the quote, end "a backup on every data
    line": "16 panels wide by 7 high · 2,048 × 896 pixels · a backup on every data line". It is something the client
    pays for, and often something they asked for.
11. **What's short is said once.** The data cables and their backups are one product on two parts of the list. What
    is free on the job's days is held against both together and said once, on the last part that takes it: "Only 12
    of the 16 free on the job's days."
12. **It can't be ticked where there is nothing to run it with.** Where the stock list holds no data cable and the
    lines don't go by fibre, its line says "No data cable found in the stock list to run a backup with", and the
    processor's ports are counted once.

## Consequences

- A screen that will be cabled with backups is quoted with the cables and the ports it takes, and the reason for
  each count.
- The tick can change the processor. A VX4S carries two lines with their backups, so the 8 by 3.5 metre screen goes
  on an MX30, or on two VX4S where that is the processor picked. The sheet says so before the tick is pressed.
- Whether it starts ticked is remembered on the device, not for the whole office. Whether a backup on every line is
  the house standard is a question still with the office. If it is, one setting in Admin would start it ticked for
  everybody; it isn't built until that is known.
- A quote line for a screen holds one more answer, kept only where the screen has a backup. A screen without one is
  stored as it always was.
- The builder is about 1 KB bigger as it travels, about 23 KB in all, and still comes with the rest of the app.
- Left for later, each one still put right by hand on the quote:
  - An MX40 with its lines on its own sockets and only the backups by fibre. Today it is ten lines and their backups
    by cable, or with the fibre tick every line and every backup through converters.
  - A whole second processor standing by, which is another kind of backup. It is added as kit.
  - The CVT10 Pro's own second fibre port, which backs up the fibre between two converters. No second fibre is
    counted for it.
  - Several screens that stand apart sharing a converter, as ADR 0208 leaves it.
- Not here, and next in [the research](../research/led-processors.md)'s order: the processor matched to the panel's
  receiving card, with what to hire past ours; the crew's wiring plan; frame rate and colour depth.
