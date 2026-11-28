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
  and tallest picture it sends. Both of ours stop at 3,840 pixels wide and 1,920 tall, which is 15 metres and
  7.5 metres of the 3.9 mm panel: a 16 by 2 metre screen is 4,096 pixels wide and was passed on one of them.
- **A screen that is more than one drives is split.** Into the fewest parts that each fit one processor, in whole
  panels, side by side before one above another, and the line names the limit that decided it: "One drives a picture
  3,840 pixels wide at most and this screen is 4,096: 2 side by side, each driving part of it".
- **Several screens share one** while its pixels, its ports and the room in its picture last: the screens sit beside
  or above each other in the one picture it sends.
- **A name is read whole.** A VX400s (2.3 million pixels) is not a VX400 (2.6 million); an MCTRL660 PRO has six ports
  to the MCTRL660's four; and the MCTRL4K is held to its sheet's 3840 by 2160, not its catalogue's 4096.
- **Not yet:** data lines counted as they are cabled, a backup on every line, the processor's make matched to the
  panel's, and what to hire in when ours can't drive a screen. The research lists them in the order to build them.
