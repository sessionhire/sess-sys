# LED processors: what they can drive

28 November 2026. Colly: "Can you do some research on the LED processors so we
can make the led wall builder more advanced?" And later the same morning: "we
hold mx30s and mx40 and uhd juniors too", then "We also hold CVT 10 Pros in
stock if that affects things", then "The mx30 should be in the stock list".
Then, on the MX40: "you can connect 4 cvt10 pros to effectively make it a 40
port processor", and "https://coex.wiki/ has great up to date documentation".
All of it is worked in below.

What each processor we hold or are likely to hire can drive, from its maker's
own sheet; what the LED screen builder ([ADR 0207](../adr/0207-an-led-screen-built-on-a-quote.md))
made of those figures; and what it can do next. The figures in
`shared/src/led-screen.ts` come from here.

## The short answer

We hold five kinds of processor, all NovaStar, and between them they drive any
screen we are likely to build.

| Ours | Drives | In the 3.9 mm panel | Takes a picture up to |
| --- | --- | --- | --- |
| VX4S, NovaPro HD | 2.3 million pixels from 4 ports, no wider than 3,840 pixels | 140 panels: a 10 by 3.5 metre screen, and nothing wider than 15 metres | HD |
| MX30 | 6.5 million from 10 ports | 396 panels, 99 m² | 4K at 60 Hz |
| MX40 Pro | 9 million from 20 ports, or from 40 by fibre | 549 panels, 137 m² | 4K at 60 Hz |
| NovaPro UHD Jr | 10.4 million from 16 ports | 634 panels, 158 m² | 4K at 60 Hz |

So a screen too big or too wide for a VX4S goes on an MX30, and nothing needs
hiring to drive our own panels. The CVT10 Pro is a fibre converter, not a
processor: one at the screen takes up to ten data lines down a single fibre, in
place of a long data cable for every line.

A processor has four limits and the builder checked two of them. It missed the
widest and tallest picture, and it counts data lines by pixels, not as they are
cabled. It read the VX4S and the NovaPro HD right. It did not know the MX30 or
the MX40 Pro, knew the UHD Jr only by its full name, and had three hired units
wrong.

NovaStar's own wiki for the MX range is newer than the sheets this research
first read, and it changed five things here: the MX40 Pro drives 9 million
pixels, not 8.8; its four fibre outputs can carry 40 separate data lines, not
only 20 and their copies; an MX30 or MX40 Pro sends a screen up to 16,384
pixels wide or tall; a line from one carries 659,722 pixels, not 650,000; and
the range only drives panels fitted with NovaStar's A series receiving cards.
[The MX range in full](#the-mx-range-in-full-novastars-coex-wiki) has the rest.

All five are in the stock list, filed as LED processors: "Novastar VX4S",
"Novastar pro HD", "Novastar MX30", "Novastar MX40" and "Novastar UHD Jnr".
The fibre converter is there as "Novastar CVT Pro". The builder reads each of
those names, and the other ways they get written: MX 30, MX40 Pro, UHD Jr, UHD
Junior, CVT10 Pro. The three bigger processors and the converter have no count
yet, so the builder says none is free until they do.

## A processor's four limits

| Limit | What sets it | The figure |
| --- | --- | --- |
| Total pixels | The unit's own video pipeline | 2.3 million on a VX4S, up to 13 million on a VX2000 Pro |
| Pixels on one port | Each Ethernet output is a 1 gigabit line | 650,000 at 60 Hz in 8-bit colour, and 659,722 on the MX range |
| Widest and tallest picture | The unit | 3,840 wide and 1,920 tall on a VX4S or NovaPro HD, 16,384 each way on an MX30 or MX40 Pro |
| Ports | The unit, halved when every line has a backup | 4 on a VX4S, 20 on an MX40 Pro and 40 by fibre |

**The port figure is arithmetic.** NovaStar prints the sum in its newer
sheets: pixels × 24 bits × frame rate has to stay under 95% of a gigabit. That
gives 659,722 pixels at 60 Hz, which its older sheets round down to 650,000.
The builder keeps each range to its own figure: 659,722 for the MX range, whose
pages print the sum, and 650,000 for the rest.

| Frame rate | 8-bit | 10-bit, A10s Pro cards | 10-bit, other cards |
| --- | --- | --- | --- |
| 50 Hz | 791,667 | 593,750 | 395,833 |
| 60 Hz | 659,722 | 494,792 | 329,861 |
| 120 Hz | 329,861 | 247,396 | 164,931 |

So a screen run at 50 Hz carries a fifth more on each line, and 10-bit colour
halves a line on most panels.

**In our panels.** The 3.9 mm half-metre panel is 128 × 128 pixels, so one line
carries 40 panels from an MX30 or MX40 Pro and 39 from the older units. The
4.8 mm metre panel at 104 × 208 gives 30 a line from either. Its pixel count is
worked from the pitch and needs confirming on the panel.

**A line is a block of whole columns or rows.** On the older units each port's
panels form a rectangle, so a screen six panels tall carries six columns a
line, 36 panels, not 39. The newer units lift this. NovaStar's VX Pro sheets
sell "flexible screen configuration without rectangle restriction on a single
Ethernet port" as something that needs specific receiving cards. The whole MX
range has it: its wiki counts a line by its panels' own pixels, in any run.
What it asks instead is that each rectangular part of a line is at least 128
pixels wide, or it is counted as if it were. Whole columns stay the way a
screen is cabled, and counting them is the safe side: it never asks for fewer
ports than the screen needs.

**A backup halves the ports.** A line runs through its panels and back into a
second port, which takes over if the first feed fails. NovaStar lists backup
between Ethernet ports on its MCTRL, MX and newer VX units, the UHD Jr has a
test for it, and the NovaPro HD's manual shows a port in hot backup. The
VX4S's own sheet doesn't mention it, so that needs a check on the unit. The
MX40 Pro is the one that keeps all its lines: in its 40-port mode, ports 21 to
40, which leave by fibre, back up ports 1 to 20.

**The make has to match the panel, and so has the range.** A processor only
talks to its own maker's receiving card inside the panel. Every processor we
hold is NovaStar, so the panels they drive must have NovaStar cards, and a
hired Brompton or Colorlight would not drive them. Within NovaStar there are
two ranges. The MX30 and MX40 Pro only drive its A series cards (A5s Plus,
A7s Plus, A8s, A8s-N, A8s Pro, A10s Plus-N, A10s Pro), not the older MRV or DH
cards. The VX4S, the NovaPro HD and the UHD Jr drive every NovaStar card.

**All-in-one or sending only.** The VX, NovaPro and MX units scale any source
to fit the screen. The MCTRL units send the picture pixel for pixel, so their
limit is their input (1920 × 1200 at 60 Hz is 2.3 million) and they need a
scaler, switcher or media server in front.

## The processors we hold

Five kinds, all NovaStar. The VX4S and the NovaPro HD are the small ones: about
2.3 million pixels from four ports, no wider than 3,840 pixels and no taller
than 1,920, from an HD picture that they scale to fit. The MX30, the MX40 Pro
and the NovaPro UHD Jr are the big ones: 6.5 to 10.4 million pixels, a 4K
picture in, and fibre outputs that each carry eight or ten data lines. Colly's
"MX40" is read as the MX40 Pro, the only MX40 found in NovaStar's range. The
table in the short answer sets the five side by side.

The two small ones, in full:

| | [NovaStar VX4S](https://www.fullcompass.com/common/files/47354-VX4SBLZSpecSheet.pdf) | [NovaPro HD](https://cdn.shopify.com/s/files/1/1741/5055/files/iris-nova-novaprohd_cutsheet.pdf) |
| --- | --- | --- |
| Total pixels | 2.3 million | No single figure given: 2.3 million is safe |
| Ethernet outputs | 4 | 4, and 4 fibre |
| Widest and tallest | 3,840 and 1,920, from the VX4S-N and VX4U sheets | 3,840 and 1,920 |
| Biggest picture it takes | 1920 × 1200 at 60 Hz | 1080p at 60 Hz |
| Inputs | HDMI, DVI, DisplayPort, SDI, 2 VGA, 2 composite | HDMI, DVI, DisplayPort, 3G-SDI, VGA, composite |
| Colour depth | 8 and 10-bit | Up to 12-bit on HDMI |
| Joins with a second unit for a bigger screen | Yes | Yes |
| Extras | Picture in picture, fades | Genlock, DMX, a backup unit |
| Weight and power | 2.55 kg, 25 W | 6 kg, 30 W |

In our panels, 2.3 million pixels is 140 of the 3.9 mm half-metre panels,
which is 35 square metres: a 10 by 3.5 metre screen. In the 4.8 mm metre
panels it is 106 panels, 53 square metres. The width limit of the two small
ones is 15 metres of the 3.9 mm panel and the height limit is 7.5 metres.

- **The VX4S figure is NovaStar's, not the distributor's.** NovaStar's sheet
  says 2.3 million. Elation's American
  [sheet](https://www.fullcompass.com/common/files/28276-ADJNovastarVX4SSpecificationsSheet.pdf)
  says 2.6 million, which is four ports at 650,000 each. The unit builds its
  picture at 1920 × 1200 at most, which is 2.3 million.
- **The NovaPro HD has a little more than the round figure.** Its sheet gives
  a 165 MHz pixel clock, which is 1920 × 1200 at 60 Hz, and lists 2304 × 1152
  among its output sizes, which is 2.65 million. Four ports carry 2.6 million
  at most. Its four fibre outputs are the long-distance route. Its sheet
  doesn't say what turns them back into data lines at the screen.
- **The VX4S's own sheet gives no widest or tallest picture.** The 3,840 and
  1,920 come from its two sister units, the VX4S-N and the VX4U. NovaStar's
  VX4S manual is reported to say the same, but the copies online refused to
  open, so it is worth one look at the unit's menu.

The three big ones, in full:

| | [MX30](https://coex.wiki/en/Processor/MX30) | [MX40 Pro](https://coex.wiki/Processor/MX40-Pro) | [NovaPro UHD Jr](https://cdn.shopify.com/s/files/1/0150/7190/3844/files/NovaPro-UHD-Jr-All-in-One-Controller-Specifications-V1.0.1.pdf) |
| --- | --- | --- | --- |
| Total pixels | 6.5 million | 9 million | 10.4 million |
| Ethernet outputs | 10, and 2 fibre | 20, and 4 fibre | 16, and 4 fibre |
| Widest and tallest | 16,384 each way | 16,384 each way | 16,384 and 8,192 |
| Biggest picture it takes | 4K at 60 Hz | 4K at 60 Hz, or 8,192 × 1,080 | 4K at 60 Hz |
| Inputs | HDMI 2.0, HDMI 1.4, DisplayPort, 2 3G-SDI | 3 HDMI 2.0, DisplayPort, 12G-SDI | HDMI 2.0, DisplayPort, 4 DVI, 2 12G-SDI |
| Colour depth | 8 and 10-bit, HDR10 | 8, 10 and 12-bit, HDR10 | 8, 10 and 12-bit, HDR |
| Joins with a second unit for a bigger screen | Up to 20 on one genlock signal | Up to 20 on one genlock signal | Up to 4, with a video distributor |
| What a fibre carries | All ten lines on one, copied on the second | Ten lines on each of two, copied on the other two. Or ten separate lines on each of the four, in its 40-port mode | Eight lines on each of two |
| Backup between ports | Yes | Yes | Yes |
| Weight and power | 7.2 kg, 55 W | 7.5 kg, 95 W | 6.3 kg, 70 W |

- **The big three's area is their pixel limit, and the ports can bind first.**
  A 16 by 6 metre screen is 6.3 million pixels, inside an MX30. Counted by
  panels alone it takes ten data lines of 40, which is every port an MX30
  has. Cabled in whole columns it takes 11, one more than it has. NovaStar's
  wiki settles which applies: an MX counts a line by its panels in any run,
  so ten lines do it when each runs on from one column into the next, and
  lines of whole columns want the MX40 Pro's twenty ports. Step 2 below says
  both.
- **Both MX units send a screen up to 16,384 pixels wide or tall**, which is
  64 metres of the 3.9 mm panel, so it only binds on a long ribbon. Their
  first sheets gave no such figure, only the widest picture each takes in,
  8,192 pixels, which is not the same thing.
- **The MX figures here are NovaStar's current ones.** The first sheets
  (V1.0.0) gave the MX40 Pro 8.8 million pixels, 70 W and fibre outputs that
  only copy. [The MX range in full](#the-mx-range-in-full-novastars-coex-wiki)
  says what changed.
- **The UHD Jr's fibre ports changed with its software.** Its first sheet
  ([V1.0.1](https://cdn.shopify.com/s/files/1/0150/7190/3844/files/NovaPro-UHD-Jr-All-in-One-Controller-Specifications-V1.0.1.pdf)) sends ports 1 to 8 down one fibre and 9 to 16 down a
  second, with the other two as their hot backups. Its later sheet
  ([V1.3.0](https://jpleisure.co.uk/Data/novastar_novapro-uhd-jr_datasheet.pdf)) makes two of the four inputs and leaves two outputs,
  set to back up or to copy. Which ours do depends on their software, so it
  is worth one look.

## Fibre to the screen: the CVT10 Pro

The [CVT10 Pro](https://cdn.shopify.com/s/files/1/0099/2260/9218/files/CVT10_Pro_Fiber_Converter_Specifications-V1.0.0.T2.pdf) is a fibre converter, not a processor. It turns one
10 gigabit fibre into ten Gigabit data ports, or ten ports into one fibre, so
the long run from the processor to the screen is a single fibre in place of a
data cable for every line. It is sealed to IP65, weighs 5.9 kg and can hang on
the truss at the screen.

| Processor | Lines down one fibre | CVT10 Pros for all its lines |
| --- | --- | --- |
| MX30 | 10 | 1 |
| MX40 Pro | 10 on each: two fibres in its 20-port mode, four in its 40-port mode | 2, or 4 for all 40 ports |
| NovaPro UHD Jr | 8 on each of two fibres | 2 |
| VX4S, NovaPro HD | All four, with a CVT10 Pro at each end | 2 |

- **It is for the long run.** A data cable is good for 100 metres: the limit
  of Gigabit Ethernet over copper, and NovaStar's own figure for a CAT5E
  cable. The fibre runs 300 metres on the multi-mode CVT10 Pro-M and 10
  kilometres on the single-mode Pro-S. The fibre in the stock list is
  single-mode (a 100 metre reel and LC patch leads), so ours are taken to be
  the Pro-S. The label says for certain, and the fibre has to match:
  NovaStar's rule is that single-mode units and modules never go on
  multi-mode fibre.
- **The backup is built in.** The CVT10 Pro's second fibre port takes over
  from its first, and each of the big three has a fibre output that copies or
  backs up the main one.
- **An MX40 Pro can send 40 lines through four of them.** In its 40-port
  mode each of its four fibres carries ten lines of its own. Ports 21 to 40
  only leave by fibre, so they are what backs up the first 20, or what a show
  in 10-bit colour runs on.
- **With a VX4S or NovaPro HD it works as a pair.** Neither sends its lines
  down one fibre, so one CVT10 Pro turns their ports into fibre and a second
  turns it back at the screen.
- **With a UHD Jr it gives eight ports, not ten.** Its sheet says a unit with
  8 or 16 ports uses the CVT10 Pro's first eight. An MX30 or MX40 Pro uses
  all ten: the wiki has each of their fibres carrying ten lines. The CVT10
  Pro's first sheet warns that its ports 9 and 10 may want a software update
  before they work from fibre, which is one check on our own units.
- **The fibre's ends wear.** NovaStar rates an optical module for 200
  plug-ins, and says to wipe the fibre's end with alcohol before each one.
  That belongs on the crew's wiring plan.
- **What it changes in the builder is the cables.** Without it a screen takes
  a long data cable for every line. With it a screen takes one CVT10 Pro for
  every ten lines, one fibre to each, and a short data cable from it to every
  line.

## The MX range in full: NovaStar's COEX wiki

Colly pointed to [coex.wiki](https://coex.wiki/), NovaStar's own pages for the
range it calls COEX: the MX and KU processors, the A series receiving cards
that go in the panels, the CVT fibre converters, and VMP, the software that
sets them up. It is kept up with each software release, where a distributor's
copy of a sheet stays as it was printed. All 81 of its pages were read on 28
November 2026, with the MX40 Pro's current
[specifications, V1.5.1](https://ret.de/wp-content/uploads/2026/07/MX40-Pro-LED-Display-Controller-Specifications-V1.5.1.pdf).
For an MX30 or an MX40 Pro it is the page to go by.

### The MX40 Pro's 40 ports

Colly: "you can connect 4 cvt10 pros to effectively make it a 40 port
processor", and of the fibre outputs that copy each other: "This can be
changed in VMP so that the 4 ports operate independently, rather than cloned."
That is right. The unit's first sheet, of 2022, had only the copies. Its four
fibre outputs now have two modes:

| | Fibre 1 | Fibre 2 | Fibre 3 | Fibre 4 |
| --- | --- | --- | --- | --- |
| 20-port mode | Ports 1 to 10 | Ports 11 to 20 | A copy of fibre 1 | A copy of fibre 2 |
| 40-port mode | Ports 1 to 10 | Ports 11 to 20 | Ports 21 to 30 | Ports 31 to 40 |

- **It needs VMP and the processor's firmware at 1.4.0 or later.**
- **Ports 21 to 40 only leave by fibre**, each ten through a CVT10 Pro at the
  screen. Ports 1 to 20 leave by the sockets on the unit or by fibres 1 and 2.
  So all 40 take four CVT10 Pros, or two when the first 20 go by data cable.
- **It is not for a bigger screen.** The unit still loads 9 million pixels at
  60 Hz. NovaStar's own example: 40 ports could carry 26 million pixels, and
  "the specifications will take the minimum value of 9 million pixels".
- **It is for a backup on every line.** "When Ethernet port backup is enabled
  in 40-port mode, the first 20 Ethernet ports are backed up by the last 20
  Ethernet ports." One MX40 Pro then backs up all 20 of its lines, where any
  other processor gives up half its ports to do it.
- **It is for a show where each line carries less.** In 10-bit or 12-bit
  colour, or in 3D, a line carries three quarters or half as much, so a 4K
  screen can want more than 20 lines, and one unit still drives it.
- **It is for a second screen showing the same picture**, such as a screen
  with two faces: the second face's panels are laid over the first's in VMP,
  on ports of their own.

### The canvas: pixels at a frame rate

What a sheet calls a unit's load is its canvas, the biggest picture it makes,
and panels outside it show black. It is a count of pixels at a frame rate, in
any shape up to the widest and tallest the unit sends: at 60 Hz an MX40 Pro
makes 4,166 × 2,160 and an MX30 6,018 × 1,080. "The canvas size is only
affected by the frame rate and resolution, not by bit depth."

| Million pixels | 30 Hz or less | 50 Hz | 60 Hz | 120 Hz |
| --- | --- | --- | --- | --- |
| MX40 Pro | 18 | 10.8 | 9 | 4.5 |
| MX30 | 6.5 | 6.5 | 6.5 | 3.25 |
| MX20 | 3.9 | 3.9 | 3.9 | 1.95 |

So an MX40 Pro drives a fifth more at 50 Hz than at 60, and an MX30 the same
at either. Colour depth leaves the canvas alone and cuts what each line
carries, so a 10-bit show wants more lines, not a bigger picture. On an MX30
the lines run out first: its ten carry 4.8 million pixels in 10-bit on A10s
Pro or A8s Pro cards and 3.25 million on any other card.

### What one line carries

The sum is the one under the four limits, with NovaStar's exact answers:
pixels × bits × frame rate, under 95% of a gigabit. The bits are 24 in 8-bit
colour, 32 in 10-bit on A10s Pro or A8s Pro cards, and 48 in 10-bit on any
other card and in 12-bit. At 60 Hz that is 659,722, 494,792 and 329,861
pixels. 3D halves a line, to 325,000 pixels, and an MX40 Pro to 4.5 million.

- **A line may run in any shape.** "Loading capacity is calculated by the
  physical cabinet pixels, free from rectangular limitation." A line can run
  up three columns and on into part of a fourth.
- **But no thinner than 128 pixels.** "The width of each rectangular load
  area within a single Ethernet port must be at least 128 pixels", and a
  narrower one is counted as if it were 128 wide. Our 3.9 mm panel is 128
  wide, so a single column of it loses nothing. A single column of the 4.8 mm
  panel, 104 wide, is counted at 128: 24 panels a line, not 30. Two of its
  columns side by side on one line lose nothing.
- **Up the columns, for the shortest delay.** With Low Latency on, NovaStar
  asks that "all Ethernet ports load the cabinets vertically and share the
  same Y coordinate". Lines of whole columns that all start at the same
  height are that, which is one more reason the builder counts them so.

### Which panels an MX can drive

This is the finding with the most weight. An MX30 or MX40 Pro drives only
panels fitted with NovaStar's A series receiving cards: the A5s Plus, A7s
Plus, A8s, A8s-N, A8s Pro, A10s Plus-N and A10s Pro. Asked whether a COEX
controller can run a panel that has only the older kind of settings file,
NovaStar says yes for those cards, and "for MRV series and DH series, the
answer is no". The older ranges, set up in NovaLCT, drive the older cards as
they always have, and the A series too: "There is no limitation on
controllers", the wiki says of the MCTRL, H and VX series. Our VX4S, NovaPro
HD and UHD Jr are of that family.

So the builder has to know which card each panel has, and offer an MX only
where it can drive the panel. Until the office says, every processor is
offered for every panel, as before. That is step 3, and it is no longer only
about hired kit.

The card sets the extras too. 10-bit colour at three quarters of a line,
rather than half, takes an A10s Pro or A8s Pro. The work for cameras (frame
multiplication, fitting the shutter, the xR tools) takes an MX40 Pro or
bigger with A10s Pro cards.

### Backup, in VMP

VMP 1.4.0 has three kinds. A whole second processor standing by, which has to
run the same firmware version. A spare output card, on the card-built units
only. And a backup between ports, set in one press (it calls the two patterns
Split and Sequential) or port by port by hand. With a backup between ports
the line runs through its panels and back to the backup port, so each line
takes a second long cable, or a place on a second fibre converter. That is
what step 4 counts.

### Past an MX40 Pro

The bigger units of the range are built from cards and send everything by
fibre, so they come in with step 5, as things to hire. An MX2000 Pro loads up
to 35 million pixels at 60 Hz and an MX6000 Pro up to 141 million. Each fibre
output card in one makes a picture of 8,192 × 2,160, which is 17.7 million
pixels, and feeds 40 data lines through four CVT10 Pros. The CX40 Pro is an
MX40 Pro for NovaStar's 5 gigabit receiving cards, which are a different
panel again.

### What else it does

None of this changes the kit on a quote, so the builder leaves it alone: four
layers of picture on an MX40 Pro and three on an MX30, genlock, HDR10 and
HLG, colour correction by 3D LUT, correction for the heat in a panel, and
control by SNMP and Art-Net.

## The common hired processors

None of these is needed to drive our own panels. They are here because a hired
screen often arrives with its own processor, and because the builder should
read whatever is put in the stock list.

The panel counts use the 3.9 mm half-metre panel at 128 × 128 pixels.

### NovaStar units that scale the picture

These drive panels with NovaStar cards, so they are the ones that would run
our own panels. The UHD Jr in the table is ours.

| Processor | Total pixels | Ports | Widest × tallest | Takes a picture up to | 3.9 mm panels |
| --- | --- | --- | --- | --- | --- |
| [VX400](https://www.fullcompass.com/common/files/87899-VX400SpecSheet.pdf) | 2.6 million | 4 | 10,240 × 8,192 | 1920 × 1200 | 158, or 39.5 m² |
| [VX400 Pro](https://ac-et.com/storage/product_images/novastar/vx-pro-series/vx400-pro-all-in-one-controller-specifications-v1.0.1.pdf) | 2.6 million | 4 | 10,240 × 8,192 | 4K at 60 Hz | 158, or 39.5 m² |
| [VX400s](https://cdn.shopify.com/s/files/1/0150/7190/3844/files/VX400s_LED_Display_Controller_Specifications.pdf) | 2.3 million | 4 | Not given | HD | 140, or 35 m² |
| [VX600](https://ret.de/wp-content/uploads/2025/08/VX600-All-in-One-Controller-Specifications-V1.7.1.pdf) | 3.9 million | 6 | 10,240 × 8,192 | 1920 × 1200 | 238, or 59.5 m² |
| [VX600 Pro](https://shop.captech.se/sv-SE/Product/167159/Link/94689/VX600%20Pro%20All-in-One%20Controller%20Specifications-V1.3.0.pdf) | 3.9 million | 6 | 10,240 × 8,192 | 4K at 60 Hz | 238, or 59.5 m² |
| [VX6s](https://cdn.shopify.com/s/files/1/0150/7190/3844/files/VX6s-All-in-One-Controller-Specifications-V1.1.0.pdf) | 3.9 million | 6 | 4,096 × 4,096 | 1920 × 1200 | 238, or 59.5 m² |
| [VX1000](https://audioeffetti.com/product/documents/NOV/VX1000-01.pdf) | 6.5 million | 10 | 10,240 × 8,192 | 4K at 30 Hz | 396, or 99 m² |
| [VX1000 Pro](https://avlgear.com/products/novastar-vx1000-pro-4k-all-in-one-led-video-controller) | 6.5 million | 10 | 10,240 × 8,192 | 4K | 396, or 99 m² |
| [NovaPro UHD](https://cdn.shopify.com/s/files/1/0150/7190/3844/files/NovaPro-UHD-All-in-One-Controller-Specifications-V1.0.0.pdf) | 8.8 million | 16, and 4 fibre | 8,192 × 8,192 | 4K at 60 Hz | 537, or 134 m² |
| [VX16s](https://cdn.shopify.com/s/files/1/0099/2260/9218/files/VX16s_User_Manual.pdf) | 10.4 million | 16 | 16,384 × 8,192 | 4K at 60 Hz | 634, or 158 m² |
| [NovaPro UHD Jr](https://cdn.shopify.com/s/files/1/0150/7190/3844/files/NovaPro-UHD-Jr-All-in-One-Controller-Specifications-V1.0.1.pdf) | 10.4 million | 16, and 4 fibre | 16K × 8K | 4K at 60 Hz | 634, or 158 m² |
| [VX2000 Pro](https://ret.de/wp-content/uploads/2025/08/VX2000-Pro-All-in-One-Controller-Specifications-V1.0.3.pdf) | 13 million | 20 | 16,384 × 8,192 | 4K at 60 Hz | 793, or 198 m² |

The Pro models add two things: they take a 4K picture at 60 Hz, and a line no
longer has to be a rectangle. The second needs "specific receiving cards",
which the sheet does not name.

The newer MX range scales too, and our MX30 and MX40 Pro are from it. Its
smallest, the
[MX20](https://chauvetprofessional.com/wp-content/uploads/2024/06/MX20-LED-Display-Controller-Specifications-V1.0.0.T2.pdf)
and the half-width [KU20](https://coex.wiki/en/Processor/KU20), each drive 3.9
million pixels from 6 ports, no wider or taller than 4,096, and the card-built
[MX2000 Pro](https://cdn.shopify.com/s/files/1/0099/2260/9218/files/MX2000_Pro_LED_Display_Controller_Specifications-V1.0.0-1.pdf)
up to 35 million. All of them drive only A series receiving cards.

### NovaStar units that only send

These pass the picture on pixel for pixel, so something in front of them has to
make it the screen's size.

| Processor | Total pixels | Ports | Widest × tallest | 3.9 mm panels |
| --- | --- | --- | --- | --- |
| [MCTRL300](https://procom-me.com/products/mctrl300-independent-led-display-controller) | 1.3 million | 2 | 2,048 × 1,200 | 79, or 20 m² |
| MCTRL600 (2021 catalogue) | 2.3 million | 4 | 3,840 × 2,560 | 140, or 35 m² |
| [MCTRL660](https://cdn.shopify.com/s/files/1/0079/3513/1738/files/MCTRL660-Independent-Controller-Specifications-V1.4.1.pdf) | 2.3 million | 4 | 3,840 × 3,840 | 140, or 35 m² |
| [MCTRL660 PRO](https://www.fullcompass.com/common/files/35894-MCTRL660PROCutSheet.pdf) | 2.3 million | 6, and 2 fibre | 3,840 × 3,840 | 140, or 35 m² |
| [MCTRL4K](https://www.fullcompass.com/common/files/62199-MCTRL4KSpecSheet.pdf) | 8.3 million | 16, and 4 fibre | 3,840 × 3,840 | 506, or 126 m² |

The MCTRL660 PRO's two extra ports carry no more pixels: they leave room for
backup lines and for lines of whole columns. The MCTRL4K's figure depends on
the page: its sheet gives 3840 × 2160 at 60 Hz, which is 8.3 million, and
NovaStar's
[2021 catalogue](https://www.ac-et.com/storage/product_images/novastar/novastar-mctrlr5-led-controller/novastar-mctrlr5-novastar-catalog-2021.pdf)
gives 4096 × 2160, which is 8.8 million, and up to 7,680 wide or tall. The
builder keeps to the sheet.

### Brompton

Brompton's Tessera processors only drive panels fitted with Brompton cards, so
one arrives with a hired screen and never drives ours.

| Processor | Total pixels | Outputs | Takes a picture up to | 3.9 mm panels |
| --- | --- | --- | --- | --- |
| [T1](https://www.bromptontech.com/wp-content/uploads/2024/09/Brompton-T1-Data-Sheet-Sep2024-EN.pdf) | 525,000 | 1 | HD | 32, or 8 m² |
| [S4](https://www.bromptontech.com/wp-content/uploads/2024/09/Brompton-S4-Data-Sheet-Sep2024-EN.pdf) | 2.1 million | 4 | 1080p at 60 Hz | 128, or 32 m² |
| [S8](https://www.bromptontech.com/wp-content/uploads/2025/07/Brompton-S8-Data-Sheet-Mar2025-EN.pdf) | 4.5 million | 8 | 4K at 60 Hz | 274, or 68.5 m² |
| [SX40](https://www.bromptontech.com/wp-content/uploads/2025/07/Brompton-SX40-Data-Sheet-Feb2025-EN.pdf) | 9 million | 4 fibre trunks, each to ten ports on an XD box | 4K at 60 Hz | 549, or 137 m² |
| [SQ200](https://www.bromptontech.com/compare/) | 36 million | 2 fibre trunks to QD boxes | 8K | 2,197, or 549 m² |

A Brompton line carries less than a NovaStar one: 525,000 pixels at 60 Hz in
8-bit colour, which is 32 of the 3.9 mm panels against 39 or 40. No line takes more
than 500 panels
([capacity note](https://dl.bromptontech.com/tessera/docs/processor_capacity/?filter=all))
and no processor more than 2,000
([compare chart](https://www.bromptontech.com/compare/)). Every Brompton unit
runs the backup loop, and the SX40 and SQ200 can run a second processor as a
standby.

### Colorlight and Linsn

Colorlight's processors drive only Colorlight cards. The
[X8](https://led-mall.com/specifications/X8-Specification.pdf) drives 5 million
pixels from 8 ports and the
[X16](https://led-mall.com/specifications/X16-Specification510382.pdf) 8.88
million from 16, each up to 8,192 wide or tall. The
[Z6 PRO](https://led-mall.com/specifications/Z6_PRO-Specification_V1.2.pdf)
drives 8.85 million over four fibre lines. Linsn is the fourth make the builder
knows by name; none of its sheets was read for this.

### A hired screen, worked: ROE's V4ST at 26 by 10 metres

Asked on 28 November: which processor suits a hired screen of ROE Visual's
V4ST, 26 metres by 10, from a company that runs Colorlight or Brompton?

The [V4ST](https://www.roevisual.com/en/vanish-st) is a 4.6 mm outdoor
touring panel, 1 metre square, 216 × 216 pixels, 27.5 kg and 700 W at most
(350 W on average). ROE builds it for three makes of processing: Brompton,
Megapixel, and Evision, which is ROE's name for its build on Colorlight's
receiving cards. NovaStar is not one of them, so none of ours drives it.

The screen is 26 panels across by 10 down, 260 in all: a picture of 5,616 ×
2,160 pixels, 12.1 million. The panels weigh 7.2 tonnes and draw 182 kW at
most, 91 kW on average. The picture is wider than 4K and more than any 4K
processor loads, so it takes two side by side, or one of the 8K class.

- **On Brompton cards:** two SX40s, each driving a 13 metre half: 2,808 ×
  2,160, which is 6.1 million of the 9 million one loads, inside its 4,096
  pixel canvas. A Brompton line carries 525,000 pixels at 60 Hz in 8-bit,
  which is 11 of these panels, so each column of ten is one line: 26 lines,
  and four XD boxes of ten ports on fibre. With a backup loop on every line
  the ports double, to six XD boxes or more. One SQ200 (36 million pixels,
  an 8K canvas) drives it whole.
- **Colour depth and frame rate change the lines.** A Brompton line carries
  less in proportion as the colour depth goes up, and more as the frame rate
  comes down. At 60 Hz in 10-bit it carries 9 of these panels, so every
  column splits into two lines. At 50 Hz in 10-bit it still carries ten.
- **On Colorlight cards:** a line carries 655,360 pixels, 14 of these panels,
  so again one line a column. One unit of the 17 million pixel class (the
  Z8t, or the X26m with its 26 ports), or two 4K units side by side: ROE's
  own eV4 (8.3 million pixels, no wider than 4,096) or Colorlight's Z6 PRO
  (8.85 million).
- **Playback sends two pictures.** One 4K output is 3,840 or 4,096 pixels
  wide and the screen is 5,616. Pixel for pixel, each processor takes its own
  half from the media server; or one 4K feed is split and scaled across.

What it asks of the builder, for steps 3 and 5: a hired panel says which
makes of processing it is built for, the builder offers none of ours for it,
and the line says what to hire, "2 Brompton SX40 and 4 XD", with the reason.

The V4ST's figures are from ROE's
[brochure](https://www.roevisual.com/uploads/files/Product%20File/Vanish%20ST/vanish-st-brochure-nov-7_-2025.pdf)
of November 2025. Brompton's are from its
[capacity calculator](https://dl.bromptontech.com/tessera/docs/processor_capacity/?filter=all),
which lists the V4ST, and its [XD data sheet](https://www.rentex.com/wp-content/uploads/2026/02/Brompton-XD-Data-Sheet-Apr2023.pdf).
The eV4's are from ROE's
[processor comparison](https://roevisual.com/uploads/files/Product%20File/roe-visual-processors-brochure-print-mar-30-2022.pdf).
Colorlight's own site refused the request, so the Z8t and X26m are from
distributors' pages and want checking with whoever supplies them.

## What the builder said, checked

The builder knew 13 processors by name, and its figures matched the makers'
sheets for all but three readings. It checked two of the four limits: total
pixels, and ports counted by pixels alone.

| Name on the product | The builder said | The sheet says | What it changed |
| --- | --- | --- | --- |
| VX400s | 2.6 million, because it read the name as a VX400 | 2.3 million | Up to 18 panels too many on one unit |
| MCTRL4K | 8.8 million | 8.3 million on its sheet, 8.8 million in the 2021 catalogue | Up to 31 panels too many on one unit |
| MCTRL660 PRO | 4 ports, because it read the name as an MCTRL660 | 6 ports | Nothing yet. It matters once lines are counted as cabled |

Of the five we hold it read two. The VX4S and the NovaPro HD were both read as
2.3 million pixels from 4 ports, which is right. The MX30, the MX40 and the
UHD Jnr were offered, since each name says NovaStar, but with no figures: each
came with a note to check it by hand, and none was chosen ahead of a VX4S. It
read a UHD Jr only when the name was written "Nova Pro UHD Jr". And it offered
the fibre converter, "Novastar CVT Pro", as a processor, for the same reason
as the others: its name says NovaStar.

- **It didn't check the widest or tallest picture.** A 16 by 2 metre screen of
  the 3.9 mm panel is 4,096 pixels wide. The builder passed it on one VX4S,
  which stops at 3,840.
- **It counts lines by pixels, not as they are cabled.** An 8 by 3.5 metre
  screen is 1.84 million pixels, which is three lines by pixels. Cabled in
  whole columns or rows it takes four: three lines would put six columns on
  one of them, 688,128 pixels, over the 650,000 a line carries. That seldom
  changes how many processors are asked for, but it sets the long cables, and
  the ports once every line has a backup.
- **It has no backup lines.** Every line is counted once.
- **It assumes 60 Hz in 8-bit colour.** That is the right default. A 10-bit or
  120 Hz show carries half as much on a line or less.
- **It doesn't match the processor's make to the panel.** A Brompton or
  Colorlight unit in the stock list would be offered for a NovaStar panel.
- **It didn't send the right one of ours.** With no figures for the bigger
  three, a screen past a VX4S was given two of them side by side, when an
  MX30 drives it whole with one picture and no join. The builder now sends
  the smallest of ours that drives the screen, which is built with step 1.
  What is left for step 5 is small: a note when a picture is stretched from
  HD, and what to hire past our biggest.
- **Three MX figures were out of date (put right in 1.245.5).** Step 1 took
  the MX30 and the MX40 Pro from their first sheets. NovaStar's wiki gives
  the MX40 Pro 9 million pixels, not 8.8. It gives both a widest and tallest
  screen of 16,384 pixels, where the first sheets gave none. And it carries
  659,722 pixels on one of their lines, not 650,000, which is 40 of the 3.9
  mm panels a line in place of 39. The builder holds the MX range to those
  now, and reads a KU20 by name.

## What the builder can do next

| | What it adds | What the person sees | New questions | Size |
| --- | --- | --- | --- | --- |
| 1 | Every limit checked | The processor line says which limit a screen breaks, in words. The three wrong readings are corrected | None | Small |
| 2 | Data lines as they are cabled, and what takes them to the screen | "5 data lines of up to 3 columns" beside the processor. A long data cable for every line, picked from the lengths in the stock list, or one tick, "Fibre to the screen", which swaps them for CVT Pros and the fibre reel. It also settles MX30 or MX40 where a screen fits one by pixels and not by ports: an MX line is counted at its own 659,722 pixels and no thinner than 128, and where an MX30 has the ports only if lines run on from one column into the next, the line says so | None | Medium |
| 3 | Processors matched to the panel's receiving card | A panel says which card it has. An MX30 or MX40 Pro is offered only for NovaStar's A series cards, and the wrong make is never offered. About 35 processors known by name; one the list doesn't know asks once for its pixels and ports, as a panel does | Once for each panel and each unknown processor | Medium |
| 4 | Backup lines | One tick, "Backup on every data line". Lines and long cables double. On an MX40 Pro the backups ride its 40-port mode, by fibre through CVT Pros, so it keeps all 20 lines. On any other the ports double too, and a second processor is asked for when they run out | One tick, off unless Admin sets it on | Small |
| 5 | The right one of ours, and what to hire past them | The smallest of ours that drives the screen whole is offered first, which is built with step 1. A note when a VX4S or NovaPro HD would stretch a picture wider than HD, naming the one of ours that shows it pixel for pixel. Past our biggest, a hired unit added as a line to price | None on the quote. The office lists what it hires | Small |
| 6 | A wiring plan for the crew | A drawing on the show pack: the screen from behind, each data line numbered with its port, each power circuit with its way on the distro | None | Large |
| 7 | Frame rate and colour depth | Two choices under "More": 50, 60 or 120 Hz, and 8, 10 or 12-bit. They change what a line carries, and on an MX40 Pro what the unit loads. The wiki gives every figure | Two, hidden unless opened | Small |

**Step 1 is built (1.245.3), and Colly chose the rest on 28 November: "All of
it, hired kit included", which is steps 2 to 6.** They are built in this
order, each on its own. Step 2 first, the data lines with the data cables or
the CVT Pros and fibre: the stock list holds everything it would add (data
cables at 20, 30 and 50 metres and a 100 metre reel, the CVT Pros, a 100
metre single-mode fibre reel and its patch leads), and on our biggest screens
it decides between the MX30 and the MX40. Then 4, the backup lines, which
lean on 2. Then 3 and 5 together: the processors matched to each panel's
card, and what to hire past ours. Then 6, the crew's wiring plan, which draws
what the others count.

Step 3 has more to it since the wiki was read. It was for hired kit, and now
it bears on our own: an MX drives only A series cards. If either of our panels
has another card, it is built ahead of the rest.

Step 7 was not in what Colly chose. It is proposed after 6, now that the wiki
gives its sums. Until then, counting at 60 Hz in 8-bit colour is the safe
side for nearly every show, since 50 Hz carries more.

The short links between panels are in the stock list too, as "Absen Data Link"
and a half-metre "Powercon True1". Step 2 could count them: a data link for
every panel less one for each data line, and a power link for every panel less
one for each circuit. Whether it should depends on whether they travel in the
panels' cases or are picked on their own.

The sheet stays as simple as it is. It keeps its four questions: size, panel,
hung or stacked, and how many. Everything above shows as a reason beside the
processor in the kit list, or sits behind one tick.

One thing from step 5 is worth knowing now. The VX4S and the NovaPro HD take
an HD picture and scale it, so on them a screen wider than 1,920 pixels, which
is 7.5 metres of the 3.9 mm panel, shows a picture stretched from HD. The MX30,
the MX40 Pro and the UHD Jr take 4K at 60 Hz. A client who wants 4K shown
pixel for pixel gets one of those, however few panels there are.

## What is needed from the office

| Question | Why it matters | Assumed until answered |
| --- | --- | --- |
| How many pixels across and down is the 4.8 mm panel? | Every panel count is worked from them. The 3.9 mm panel's 128 × 128 is on its product now | 104 × 208 |
| Which receiving card is in each panel, by its model (A8s, A5s Plus, MRV…)? | A processor only drives its own make, and an MX30 or MX40 Pro only NovaStar's A series | NovaStar's A series in both, so every processor we hold is offered for both |
| Are the MX40s on VMP and firmware 1.4.0 or later? | The 40-port mode needs both | Yes |
| What is the widest and tallest screen the VX4S's menu allows? | Its own sheet doesn't say | 3,840 wide and 1,920 tall, as its sister units |
| Do shows run at 50 or 60 Hz? | 50 Hz carries a fifth more on each line | 60 Hz, the safe side |
| Is a backup on every data line the house standard? | It doubles the ports and the long cables | No backup |
| Do the short data and power links travel in the panels' cases, or are they picked on their own? | Picked on their own, the builder can count them | They travel with the panels, so none is added |
| Which processors are hired in, from whom, and at what price? | The builder can only suggest what the office can get | Nothing suggested |
| How many MX30s, MX40s, UHD Jnrs and CVT Pros are there? | They are in the stock list with no count, and the builder counts what is free on the day | None, so each shows as none free |
| Does the run to the screen usually go by data cable or by fibre, and are the CVT Pros the single-mode kind? | It sets which cables the builder adds | Data cable, with fibre one tick away; single-mode, as the fibre in the stock list is |

The builder already asks for a panel's pixels the first time that panel is
used, and keeps them on its product.

## Sources

Every figure comes from the maker's own sheet or manual unless a line says
otherwise. NovaStar's were read as the copies its distributors host, each with
NovaStar's own version number; each is linked from its name in the tables
above. The rest:

- VX4S: [specifications, Rev1.0.5](https://www.fullcompass.com/common/files/47354-VX4SBLZSpecSheet.pdf); the [VX4U cut sheet](https://cdn.shopify.com/s/files/1/1741/5055/files/novastar-vx4u_cutsheet.pdf) and the VX4S-N page of [NovaStar's 2021 catalogue](https://www.ac-et.com/storage/product_images/novastar/novastar-mctrlr5-led-controller/novastar-mctrlr5-novastar-catalog-2021.pdf) for 3,840 wide and 1,920 tall.
- NovaPro HD: [cut sheet](https://cdn.shopify.com/s/files/1/1741/5055/files/iris-nova-novaprohd_cutsheet.pdf) and [user manual](https://www.fullcompass.com/common/files/62167-NOVAPROHDBLZUserManual.pdf).
- MX30 and MX40 Pro: NovaStar's COEX wiki, linked from the table of the three big ones, and the MX40 Pro's [specifications V1.5.1](https://ret.de/wp-content/uploads/2026/07/MX40-Pro-LED-Display-Controller-Specifications-V1.5.1.pdf) of April 2026. The first sheets read for this, V1.0.0 of the [MX30](https://goknight.com/content/documentation/MX30%20LED%20Display%20Controller%20Specifications-V1.0.0.pdf) and the [MX40 Pro](https://cdn.shopify.com/s/files/1/0150/7190/3844/files/MX40_Pro_LED_Display_Controller_Specifications-V1.0.0.pdf), are out of date on the MX40 Pro's pixels and its fibre outputs.
- The rest of the MX range: [coex.wiki](https://coex.wiki/), read whole on 28 November 2026. The pages leaned on are [loading capacity](https://coex.wiki/en/Intro_Info/Loading-Capacity-Instructions) (the canvas, what a line carries, the 40-port mode, the notes on fibre), [the NCP file](https://coex.wiki/en/Intro_Info/NCP-File) (which receiving cards), [function compatibility](https://coex.wiki/en/Solution/Function-Compatibility) (a line in any shape), [xR](https://coex.wiki/en/Intro_Info/xR) (low latency), VMP's [layout](https://coex.wiki/en/VMP/Layout-Interface) and [backup](https://coex.wiki/en/VMP/Backup-Interface) pages, and the [MX20](https://coex.wiki/en/Processor/MX20), [KU20](https://coex.wiki/en/Processor/KU20) and [CVT10 Pro](https://coex.wiki/en/Accessory/CVT10-Pro).
- NovaPro UHD Jr: specifications [V1.0.1](https://cdn.shopify.com/s/files/1/0150/7190/3844/files/NovaPro-UHD-Jr-All-in-One-Controller-Specifications-V1.0.1.pdf) and [V1.3.0](https://jpleisure.co.uk/Data/novastar_novapro-uhd-jr_datasheet.pdf), which differ on the fibre ports.
- CVT10 Pro: [specifications V1.0.0](https://cdn.shopify.com/s/files/1/0099/2260/9218/files/CVT10_Pro_Fiber_Converter_Specifications-V1.0.0.T2.pdf). The 100 metres for a data cable is Gigabit Ethernet's own limit, and the wiki's figure for a CAT5E cable.
- The table of pixels a port carries: the [MX30](https://goknight.com/content/documentation/MX30%20LED%20Display%20Controller%20Specifications-V1.0.0.pdf) and [KU20](https://www.ac-et.com/storage/product_images/novastar/ku20-led-display-controller/ku20-led-display-controller-specification-sheet-ku20-led-display-controller-specifications-v1.1.0.pdf) sheets.
- MCTRL4K: [Rev1.0.1](https://www.rentex.com/wp-content/uploads/2018/02/NovaStar-Controller-MCTRL4K-Specifications-Rev1.0.1.pdf) and [V1.0.3](https://www.fullcompass.com/common/files/62199-MCTRL4KSpecSheet.pdf), both 3840 × 2160.
- The VX1000 Pro and the MCTRL300 are from a reseller's and a distributor's page, not a sheet.
- Brompton: the maker's [compare chart](https://www.bromptontech.com/compare/), data sheets and [capacity note](https://dl.bromptontech.com/tessera/docs/processor_capacity/?filter=all); and [ROE Visual's processor comparison](https://www.roevisual.com/uploads/files/Downloads/processor-mar-30-2021.pdf), a panel maker's figures (350,000 pixels a port at 60 Hz in 12-bit).

What could not be read:

- The makers' sheets for our two panels. Absen's site refused the request and
  no Gloshine sheet turned up, so both pixel counts are worked from the pitch.
- NovaStar's VX4S user manual, which is said to give its widest and tallest
  picture.
- Any Linsn sheet.
