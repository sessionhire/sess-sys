# ADR 0208: A screen's data lines, and what takes them to it

- **Status:** accepted
- **Date:** 28 November 2026
- **Asked for by:** Colly, 28 November 2026: "Can you do some research on the LED processors so we can make the led
  wall builder more advanced?" Of the seven things [the research](../research/led-processors.md) said the builder
  could do next, Colly chose "All of it, hired kit included". This is the second. On the day, too: "We also hold CVT
  10 Pros in stock if that affects things", and of the MX40, "you can connect 4 cvt10 pros to effectively make it a
  40 port processor".
- **Builds on:** [ADR 0207](0207-an-led-screen-built-on-a-quote.md) (the builder, and its two amendments: a
  processor's four limits, and the MX range held to NovaStar's own figures) and
  [ADR 0202](0202-a-cables-length-beside-its-name.md) (a cable's length, from its field or its name).

## Context

The builder counted a screen's data lines by pixels alone: the screen's pixels over what one port carries. A screen
isn't cabled that way. A line runs through whole panels, up one column and down the next, and on most processors the
panels on one port have to make a rectangle. An 8 by 3.5 metre screen of the 3.9 mm panel is 1.84 million pixels,
which is three lines by pixels and four as cabled: three would put six columns on one of them, 688,128 pixels, over the
650,000 a line carries.

The count matters three ways. It is the ports a screen takes, so now and then it is one more processor, or a bigger
one. It is the long cables from the processor to the screen, one for every line. And once every line has a backup
(the next step) it is doubled.

The builder added nothing for that run. The cables went on by hand as kit, or were found missing on the day. The
stock list holds what it takes: data cables at 20, 30 and 50 metres and a 100 metre reel, and for the longer runs the
fibre converters (NovaStar's CVT10 Pro, in the list as "Novastar CVT Pro"), a 100 metre single-mode fibre reel and its
patch leads.

## Decision

1. **A data line is a tidy block of whole panels.** Whole columns first, as many to a line as it carries, shared out
   evenly so the lines match: 16 columns at five to a line are four lines of four, not three of five and a single.
   Where a column is more than one line carries, the columns are cut in two, then in three, and so on, and each way is
   kept only where it takes fewer lines than the ways before it. Whole columns are what a crew reaches for, and what
   NovaStar asks for where the delay matters ("all Ethernet ports load the cabinets vertically and share the same Y
   coordinate").
2. **Shorter blocks are used only where they save a processor.** The way used is the first, in that order, that takes
   no more processors than the fewest lines would. A screen 25 panels by 21 is 25 lines in whole columns, five more
   than an MX40's 20 ports, and 18 in half columns three to a line: one MX40 drives it, in 18. A screen that fits
   either way stays in whole columns, even where blocks would save a cable or two.
3. **What a line carries is its processor's own figure**: 659,722 pixels from NovaStar's MX and KU range and 650,000
   from every other, at 60 Hz in 8-bit colour, as ADR 0207 has it. Where the stock list holds no processor the builder
   knows, the lines are still counted, at 650,000 in whole columns.
4. **On the MX range a line may carry on from one column into part of the next, and only where that is what fits.**
   The range counts a line by its panels' own pixels, in any run ("free from rectangular limitation"). The builder
   keeps to tidy blocks all the same, and lets a line carry on only where the ports would otherwise run out. Then the
   processor's line says so, with what tidy blocks would take: "Fits the 10 ports it has only if a data line carries
   on from one column into part of the next: in whole columns this screen takes 11 lines." A processor that needs no
   such thing is sent first: for that screen, an MX40 before an MX30.
5. **On the MX range a panel narrower than 128 pixels is counted as 128 wide, each on its own.** NovaStar's rule is
   that "the width of each rectangular load area within a single Ethernet port must be at least 128 pixels", and
   that a narrower one loses "(128 − width) × height" of the line. It doesn't say whether two narrow columns side by
   side on one line make one area. The builder takes the reading that never counts fewer lines than a screen needs:
   every narrow panel is counted wider, however the line lies. The 4.8 mm panel at 104 pixels wide is then 24 to a
   line, not 30. The 3.9 mm panel is 128 wide and loses nothing. The working under the list says when this applies.
6. **The count is said twice.** With the screen's size and pixels, as "4 data lines". And beside the cables, with how
   the lines lie: "A line takes 4 columns of panels", "A line takes a block of up to 3 panels across by 11 down", "It
   takes the whole screen".
7. **Data cables are a part of the screen: one for every line.** A data cable is found by its name (Cat 5, Cat5e,
   Cat 6, etherCON, a data, network or Ethernet cable or lead), and not a multicore, a link between panels, a node,
   a rack or anything else that only has the word in its name. None longer than 100 metres is offered: that is as far
   as a data line goes on copper. Of those, one whose length is known comes first, then one there are enough of on the
   job's days, then the longest: the builder isn't told how far the processor is from the screen, so it sends the
   cable that reaches furthest, and the office picks a shorter one where it knows the room. A price only decides
   between two of one length. The one picked is offered first for the next screen. A cable whose length isn't on its
   product is offered last, with "Check it reaches: its length isn't on its product."
8. **Fibre to the screen is one tick, and starts off.** It is offered only where the stock list holds a fibre
   converter. Every other part of a screen starts ticked, since kit left off a quote is the mistake that costs. This
   one isn't kit a screen is short without. It is another way to carry the same lines, so it starts as it was left on
   the last screen built on that device, and off the first time. Unticked, it still says what ticking it would add,
   so the choice can be weighed without making it. It is one tick because it is one decision: the converters, the
   fibre and the shorter cables all follow from it.
9. **How many converters depends on the processor.** One with fibre outputs of its own takes a converter at the
   screen only: one for every ten lines each unit carries from an MX30 or MX40, every eight from a UHD Jr and every
   six from an MX20 or KU20, since that is what one of their fibres carries. Any other processor (a VX4S, a NovaPro
   HD) takes a pair, one at each end, for every ten lines. A converter is taken to carry ten lines, as the CVT10 Pro
   does. With them goes one fibre for each converter at the screen: the longest fibre in the stock list that there
   are enough of. A patch lead, a socket or a module isn't taken for it.
10. **By fibre the data cable is the short one.** One from the converter at the screen to the first panel of every
    line, and from a processor with no fibre output a second for every line, from the processor to the converter
    beside it. The cable offered is the shortest that reaches the far corner of the screen from a converter at one
    end, which is the screen's width and height together. Where none in the stock list does, the longest is offered
    with "Check it reaches every line from the converter". The long cable used last time isn't taken for this, and a
    cable picked by hand is let go when the tick changes: the two runs want different cables.
11. **An MX40 has 40 ports by fibre.** Its ports 21 to 40 only leave by fibre, in its 40-port mode. With the tick on,
    an MX40 is counted with all 40, and where one carries more than 20 lines its line says what that takes: "More
    than 20 lines takes its 40-port mode, which wants VMP and its firmware at 1.4.0 or later." With the tick off, its
    line says when the other 20 would help: when they would drive the screens with fewer units, or keep every line to
    whole columns.
12. **The quote keeps which.** The cables, converters and fibre go on the quote as kit under the screen's line, as
    its other parts do. Changing the screen from its line opens the builder with fibre ticked when a converter is
    among its kit, and unticking it lists what the change does before it's made: the long cables added, and the short
    cables, the converters and the fibre taken off.
13. **What still isn't counted is said.** The working ends "The links between panels, mains cables, slings and
    shackles are not counted: add what the job takes as kit."

## Consequences

- A screen's quote carries the cables that reach it, or the fibre kit in their place, with the reason for each count.
- The lines are never fewer than the pixels alone need, and now and then more: four where it said three. So a screen
  can ask for a bigger processor than it did, and is right to: 16 by 6 metres of the 3.9 mm panel fits an MX30 by
  pixels, takes 11 lines in whole columns, and now goes on an MX40.
- A cable is found by its name. One called something the builder doesn't recognise isn't offered until it is renamed,
  and is added as kit meanwhile. "Enough on the day" goes by the count in the stock list: a cable with no count shows
  as none free, and is offered after one there are enough of.
- The builder doesn't ask how far the processor is from the screen. It offers the longest cable, and by fibre the
  longest fibre, and the office changes either on the sheet or on the quote.
- The CVT Pros, the MX30, the MX40 and the UHD Jnr have no count in the stock list yet, so each shows as none free
  until they do.
- Whether the fibre is ticked is remembered on the device, with the panel and the products picked for each part, not
  for the whole office.
- The builder is about 3 KB bigger as it travels, about 22 KB in all, and still comes with the rest of the app, so it
  opens at once and with no signal.
- A screen already on a quote keeps its kit as it is. Opened from its line, Data cables and Fibre to the screen show
  as left off, since the quote has neither, and ticking one lists what it adds before the change is made.
- Left for later, and said on the sheet where it bears on a screen: an MX40 with some lines on its own sockets and
  the rest by fibre (with the tick on, every line goes by fibre); several screens that stand apart sharing a converter
  (the fibre's line asks for a look); and a patch lead in place of the short cable between a VX4S and the converter
  beside it.
- Not here, and next in [the research](../research/led-processors.md)'s order: a backup on every line; the processor
  matched to the panel's receiving card, with what to hire past ours; the crew's wiring plan; frame rate and colour
  depth, which change what a line carries.
- One question goes back to the office with the 4.8 mm panel: whether VMP counts two of its columns side by side on
  an MX line as one area. If it does, that panel is 30 to a line and point 5 loosens for blocks two or more wide.
