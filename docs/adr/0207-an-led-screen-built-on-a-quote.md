# ADR 0207: An LED screen built on a quote

- **Status:** accepted
- **Date:** 27 November 2026
- **Asked for by:** Colly, 27 November 2026: "Can we make a LED Screen builder function within the quote form? Using the
  learnings from the pixel map project and the tipping point project. After selecting to add an LED screen a popover
  can come up with the additional questions needed. Such as the size, the panels used (with the panels we hold being
  at the top), if the screen is hung or ground stacked etc. When all complete it can add in the relevant product items
  from the stock in an LED screen group. Take your time, consider the flow, consider the UI and make it simple for the
  user."
- **Builds on:** [ADR 0116](0116-a-package-is-a-shortcut-for-its-kit.md) (one line on a quote with its kit under it),
  [ADR 0128](0128-the-quote-the-way-the-office-writes-it.md) (a quote's groups),
  [ADR 0140](0140-one-job-one-path.md) (kit and crew are most of every quote, so the rarer ways to add sit under More)
  and [ADR 0202](0202-a-cables-length-beside-its-name.md) (a product's length, read from its field or its name).

## Context

Quoting an LED screen meant finding each part in the catalogue and doing the sums somewhere else: how many panels make
5 by 3 metres, how many fly bars, how much truss, how many motors or uprights, which processor, how many circuits. A
part left off is found on the day, at our cost.

Two of the company's own tools already hold the sums and what was learned making them, both public:
[the pixel map maker](https://github.com/legofsalmon/pixelmapmaker) (a screen's totals, its power circuits, how many
processors, where the hang points go) and [tipping point](https://github.com/legofsalmon/tipping-point) (an LED wall
stood against ballasted truss uprights: how many, how much ballast, what wind). Their lessons for the screen that asks:
favourites first, the answer before the working, a blank is never read as zero, every count names the limit that
decides it, and it is a first pass, not a structural check.

Nothing in the stock list said how big a panel is, and the stock brought in from Current RMS carries no weights.

## Decision

1. **Add LED screen opens a sheet over the quote.** Colly said a popover; the part this app has for a short task over a
   page is the sheet a product's page opens in from a quote line, so the builder is one: from the side at a desk, the
   whole screen on a phone, with one scroller. The button sits with the other ways to add: there on an empty quote,
   under More to add… once the quote has lines (ADR 0140). Add kit's search offers it too, as "LED screen" (also found
   by "LED wall" or "video wall"), and a number typed first is how many.
2. **It asks three things, and how many.** The size, as width and height in metres; the panel; hung or ground stacked.
   "How many like this" starts at 1. Nothing is pressed to work it out: the answer is beside the questions at a desk
   and under them on a phone, and changes as they're answered. Until they are, the foot says what's still to give.
3. **The panels we hold come first.** The list is the products that have a panel's size and those that read like an
   LED panel: ours before hired in, those with a size before those without. The panel used last time on this device is
   already chosen, or the only one we own. Another product… finds anything in the stock list.
4. **A panel's size is asked once and kept on its product.** One panel's width and height in mm are needed; its pixels
   across and down, its weight and its power are asked for but can be left out. They're saved on the product as the
   screen is added, by anyone who may change stock, and the product's page shows them in an LED panel row where they
   can be put right or taken away. What's left out is said as not worked out, on the part it would have sized: never
   guessed, and never read as nothing.
5. **A screen is whole panels.** The size asked for is taken to the nearest whole panel each way, and the sheet says
   what that makes: "In whole panels that is 5 × 3 m: 10 panels wide by 6 high."
6. **The kit is worked out part by part from the stock list**, each part with the reason for its count:
   - **Panels**: across by down, times how many screens.
   - **Fly bars**: the panel maker's own first; one for each column, or fewer where the bar's length spans more.
   - **Hung**: **truss** across the top in the fewest lengths that reach; **motors** one every 3 m or less, and more
     where weight asks, no motor carrying more than three quarters of what it lifts; **motor control** by how many
     motors one runs.
   - **Ground stacked**: **truss uprights** behind the screen and a **base plate** under each. How many is tipping
     point's solver: no more than 3 m apart, no upright carrying more than 500 kg of wall, standing at a safety factor
     of 1.5, and no more than fit side by side.
   - **Processor**: enough for the screen's pixels and a port for each 650,000 of them, from what the processors we're
     likely to meet drive.
   - **Power distro**: by 16 A circuits loaded to four fifths.

   Products are found by what they're called. Where several could do a part, the one that does it with the fewest,
   has a price and is free on the job's days is taken; the one chosen last time comes back where it does the job as
   well; and the office can choose another. A part nothing in the stock list fits says so. Where a name doesn't say
   what a motor lifts or how many ways a distro has, the part says what to check.
7. **Every part is ticked to begin with.** Kit left off a quote is the mistake that costs, so leaving a part off is
   the office's one tick, not the other way round. The panels can't be left off.
8. **A ground stack says how it stands**: how many uprights and how far apart, that it stands without ballast indoors
   and the wind it holds to outdoors, or the ballast each base plate wants. Ballast isn't put on the quote. A hung
   screen says its points and what each carries. Straight under either, ahead of the kit, so it's read with the
   figures it speaks of: "A first pass to quote from, not a structural check: whoever rigs it checks what it hangs
   from or stands on." How it was worked out is one fold, under the kit.
9. **On the quote it is one line with its kit under it**, as a package is (ADR 0116): "LED screen 5 × 3 m, hung",
   with "10 panels wide by 6 high · 1,280 × 768 pixels" under its name, in a group called LED screen (ADR 0128). It
   has no price of its own: it comes to its kit, each line at its product's price for the job's days, and a product
   with no price is flagged as any unpriced line is. The line keeps what it was built from (the panel, panels across
   and down, hung or ground stacked). The printed quote and the client's page show it the same way.
10. **It's changed from its line.** Pressing the screen's line opens the sheet on its answers, each part as the quote
    has it. What the change does to the quote is listed before it's made (lines added, taken off, counts changed), and
    how much more or less it comes to is said by the button that makes it. A price typed on one of its lines is kept
    through the change. Remove from the quote takes the screen and its kit, with Undo.
11. **Nothing typed is lost.** Shut by Escape, Close or a press outside, a new screen's answers are kept while the
    quote is open: the sheet opens on them next time, with Start again beside.
12. **Where the sums live.** `shared/src/led-screen.ts`, which only the builder reads, by its own door
    (`@sh/shared/led-screen`), so the server never loads it. The solver is tipping point's own file (MIT), copied at a
    named commit by `scripts/vendor-ledwall.mjs` with only its wrapper changed: a fault in it is fixed there and
    brought in again, never edited in the copy.

## Consequences

- An LED screen is a few answers and one press, and the quote carries the kit it takes with the reason for each count.
- It is a first pass. Cables, slings and shackles aren't counted, and the sheet says so; nor are spare panels, and
  ballast is named where a stack wants it but not added. What the job takes of those goes on as kit.
- It finds kit by name. A fly bar or base plate called something it doesn't recognise isn't offered until it's
  renamed, and is added as kit by hand meanwhile. A motor's lift and a distro's ways are read from their names; the
  truss's and base plate's weights from their products. The wind figure needs the base plate's weight on its product.
- A panel's weight and power have to be typed once, in the builder or on its product: until then the motors go by
  spacing alone and the circuits aren't counted, and each part says so.
- The builder comes with the rest of the app (about 19 KB as it travels) and isn't fetched when first opened: it opens
  at once, and with no signal.
- A quote made from a past job brings a screen's kit as ordinary lines, without the screen's own line. To have it as a
  screen again, it's built again.
- The panel and the products chosen for each part are remembered on the device, not for the whole office.

## Amended 28 November 2026: a processor's four limits

Colly asked for research on the processors, to make the builder more advanced. It is in
[docs/research/led-processors.md](../research/led-processors.md): what each processor we hold or are likely to hire
drives, from its maker's own sheet, and seven things the builder can do with it. The first is built here (1.245.3).

- **A processor is held to four limits, not two.** The pixels it loads and its ports, as before, and now the widest
  and tallest picture it sends. The VX4S and the NovaPro HD stop at 3,840 pixels wide and 1,920 tall, which is
  15 metres and 7.5 metres of the 3.9 mm panel: a 16 by 2 metre screen is 4,096 pixels wide and was passed on one
  of them.
- **A screen that is more than one drives is split.** Into the fewest parts that each fit one processor, in whole
  panels, side by side before one above another, and the line names the limit that decided it: "One drives a picture
  3,840 pixels wide at most and this screen is 4,096: 2 side by side, each driving part of it".
- **Several screens share one** while its pixels, its ports and the room in its picture last: the screens sit beside
  or above each other in the one picture it sends.
- **A name is read whole.** A VX400s (2.3 million pixels) is not a VX400 (2.6 million); an MCTRL660 PRO has six ports
  to the MCTRL660's four; and the MCTRL4K is held to its sheet's 3840 by 2160, not its catalogue's 4096.
- **The processors we hold are five, not two.** Colly, the same morning: "we hold mx30s and mx40 and uhd juniors
  too", then "We also hold CVT 10 Pros in stock if that affects things", then "The mx30 should be in the stock
  list". It is: the stock list files five as LED processors, "Novastar VX4S", "Novastar pro HD", "Novastar MX30",
  "Novastar MX40" and "Novastar UHD Jnr", and the research had gone by a copy of the Current RMS product table of
  19 October that held only the first two. The MX30 (6.5 million pixels from 10 ports), the MX40 Pro (8.8 million
  from 20) and the UHD Jr (10.4 million from 16) are read by name however it is written: "MX30", "mx 40pro",
  "UHD Junior", "UHD Jnr", "NovaPro UHD Jr". A product is offered as a processor when it is filed as an LED
  processor, or is video kit whose name holds a model the builder knows, since "MX30" says neither NovaStar nor
  processor. The MX sheets give the widest picture each takes in, not the widest screen it sends, so neither is
  checked on them. A test names all six as the stock list does.
- **The smallest of ours that drives the screen whole is sent.** The fewest units first, ours before one hired in,
  then the smallest: a VX4S for a small screen, an MX30 past it, and two VX4S side by side only when nothing bigger
  is in the stock list.
- **A fibre converter is not a processor.** A CVT10 Pro carries a processor's data lines to the screen down one
  fibre and drives nothing, so it is never offered as one, and nor is a receiving card. Ours is "Novastar CVT Pro"
  in the stock list, with no number in its name, and the builder as first built offered it among the processors
  because its name says NovaStar: a CVT is left out with its number or without. Counting converters and
  fibre as the run to the screen belongs to the second step.
- **Not yet:** data lines counted as they are cabled with the cables or fibre that take them to the screen, a
  backup on every line, the processor's make matched to the panel's, and what to hire in past our biggest. The
  research lists them in the order to build them.

## Amended 28 November 2026: the MX range held to NovaStar's current figures

Colly, the same day: "you can connect 4 cvt10 pros to effectively make it a 40 port processor"; of the fibre outputs that
copy each other, "This can be changed in VMP so that the 4 ports operate independently, rather than cloned"; and
"https://coex.wiki/ has great up to date documentation". The amendment above went by the first sheets of the MX30 and the
MX40 Pro, as their distributors host them. NovaStar's own wiki for the range is newer, and where the two differ the wiki
is kept to (1.245.5). [The research](../research/led-processors.md) has what it says in full.

- **An MX40 Pro drives 9 million pixels**, not 8.8 million.
- **An MX30 or an MX40 Pro sends a screen up to 16,384 pixels wide or tall**, and an MX20 or a KU20 up to 4,096. This
  replaces "The MX sheets give the widest picture each takes in, not the widest screen it sends, so neither is checked
  on them": the wiki gives the screen each sends, and it is checked.
- **A data line from the MX range carries 659,722 pixels.** That is the maker's own sum: pixels × 24 bits × 60 Hz, under
  95% of a gigabit. In the 3.9 mm panel it is 40 panels a line in place of 39. Every other processor is still counted
  at the 650,000 its sheets size it by, so point 6's "a port for each 650,000 of them" holds for the rest.
- **A KU20 is read by name**: 3.9 million pixels from 6 ports, as the MX20.
- **Where a figure comes from is part of this.** For the MX range it is NovaStar's wiki, and for the rest the maker's
  sheet. A distributor's copy of a first sheet is where the three figures above went wrong.
- **Known now, and not built here.** An MX40 Pro's four fibre outputs can each carry ten data lines of their own: its
  40-port mode, with VMP and firmware 1.4.0 or later. The first sheet had two of them only copying the other two. Ports
  21 to 40 leave by fibre alone, through CVT10 Pros, so they come into the builder with the data lines and their fibre,
  and with the backup on every line, which they carry without a second processor. And the MX range drives only panels
  fitted with NovaStar's A series receiving cards, which the builder will need to be told of each panel.
