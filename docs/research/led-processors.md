# LED processors: what they can drive

28 November 2026. Colly: "Can you do some research on the LED processors so we
can make the led wall builder more advanced?"

What each processor we hold or are likely to hire can drive, from its maker's
own sheet; what the LED screen builder ([ADR 0207](../adr/0207-an-led-screen-built-on-a-quote.md))
made of those figures; and what it can do next. The figures in
`shared/src/led-screen.ts` come from here.

## The short answer

Each processor we hold drives about 2.3 million pixels: 140 of the 3.9 mm
panels, a 10 by 3.5 metre screen, and nothing wider than 15 metres. Past that a
screen needs two of ours side by side or one hired unit, and a VX600 or VX1000
covers most of what would be asked.

A processor has four limits and the builder checked two of them. It missed the
widest and tallest picture, and it counts data lines by pixels, not as they are
cabled. Its figures for the two we hold were right; three readings of hired
units were wrong.

## A processor's four limits

| Limit | What sets it | The figure |
| --- | --- | --- |
| Total pixels | The unit's own video pipeline | 2.3 million on a VX4S, up to 13 million on a VX2000 Pro |
| Pixels on one port | Each Ethernet output is a 1 gigabit line | 650,000 at 60 Hz in 8-bit colour |
| Widest and tallest picture | The unit | 3,840 wide and 1,920 tall on a VX4S or NovaPro HD |
| Ports | The unit, halved when every line has a backup | 4 on a VX4S |

**The port figure is arithmetic.** NovaStar prints the sum in its newer
sheets: pixels × 24 bits × frame rate has to stay under 95% of a gigabit. That
gives 659,722 pixels at 60 Hz, which its older sheets round down to 650,000.

| Frame rate | 8-bit | 10-bit, A10s Pro cards | 10-bit, other cards |
| --- | --- | --- | --- |
| 50 Hz | 791,667 | 593,750 | 395,833 |
| 60 Hz | 659,722 | 494,792 | 329,861 |
| 120 Hz | 329,861 | 247,396 | 164,931 |

So a screen run at 50 Hz carries a fifth more on each line, and 10-bit colour
halves a line on most panels.

**In our panels.** Taking the 3.9 mm half-metre panel as 128 × 128 pixels, one
line carries 39 panels at 60 Hz. The 4.8 mm metre panel at 104 × 208 gives 30 a
line. Both pixel counts are worked from the pitch and need confirming on the
panels.

**A line is a block of whole columns or rows.** NovaStar's Pro sheets sell
"flexible screen configuration without rectangle restriction on a single
Ethernet port" as something new that needs specific receiving cards. On older
units each port's panels form a rectangle. So a screen six panels tall carries
six columns a line, 36 panels, not 39.

**A backup halves the ports.** A line runs through its panels and back into a
second port, which takes over if the first feed fails. NovaStar lists backup
between Ethernet ports on its MCTRL and newer VX units, and the NovaPro HD's
manual shows a port in hot backup. The VX4S's own sheet doesn't mention it, so
that needs a check on the unit.

**The make has to match the panel.** A processor only talks to its own maker's
receiving card inside the panel. Both processors we hold are NovaStar, so the
panels they drive must have NovaStar cards, and a hired Brompton or Colorlight
would not drive them.

**All-in-one or sending only.** The VX and NovaPro units scale any source to
fit the screen. The MCTRL units send the picture pixel for pixel, so their
limit is their input (1920 × 1200 at 60 Hz is 2.3 million) and they need a
scaler, switcher or media server in front.

## The two we hold

Both drive about 2.3 million pixels from four ports, no wider than 3,840
pixels and no taller than 1,920, from an HD picture that they scale to fit.

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
panels it is 106 panels, 53 square metres. The width limit is 15 metres of the
3.9 mm panel and the height limit is 7.5 metres.

- **The VX4S figure is NovaStar's, not the distributor's.** NovaStar's sheet
  says 2.3 million. Elation's American
  [sheet](https://www.fullcompass.com/common/files/28276-ADJNovastarVX4SSpecificationsSheet.pdf)
  says 2.6 million, which is four ports at 650,000 each. The unit builds its
  picture at 1920 × 1200 at most, which is 2.3 million.
- **The NovaPro HD has a little more than the round figure.** Its sheet gives
  a 165 MHz pixel clock, which is 1920 × 1200 at 60 Hz, and lists 2304 × 1152
  among its output sizes, which is 2.65 million. Four ports carry 2.6 million
  at most. Its four fibre outputs are the long-distance route.
- **The VX4S's own sheet gives no widest or tallest picture.** The 3,840 and
  1,920 come from its two sister units, the VX4S-N and the VX4U. NovaStar's
  VX4S manual is reported to say the same, but the copies online refused to
  open, so it is worth one look at the unit's menu.

## The common hired processors

The panel counts use the 3.9 mm half-metre panel at 128 × 128 pixels.

### NovaStar units that scale the picture

These drive panels with NovaStar cards, so they are the ones that would run
our own panels.

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

The newer MX range scales too. The
[MX20](https://chauvetprofessional.com/wp-content/uploads/2024/06/MX20-LED-Display-Controller-Specifications-V1.0.0.T2.pdf)
drives 3.9 million pixels from 6 ports and the
[MX30](https://goknight.com/content/documentation/MX30%20LED%20Display%20Controller%20Specifications-V1.0.0.pdf)
6.5 million from 10. The
[MX40 Pro](https://cdn.shopify.com/s/files/1/0150/7190/3844/files/MX40_Pro_LED_Display_Controller_Specifications-V1.0.0.pdf)
drives 8.8 million from 20, and the card-built
[MX2000 Pro](https://cdn.shopify.com/s/files/1/0099/2260/9218/files/MX2000_Pro_LED_Display_Controller_Specifications-V1.0.0-1.pdf)
up to 35 million.

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
8-bit colour, which is 32 of the 3.9 mm panels against 39. No line takes more
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

## What the builder said, checked

The builder knew 13 processors by name, and its figures matched the makers'
sheets for all but three readings. It checked two of the four limits: total
pixels, and ports counted by pixels alone.

| Name on the product | The builder said | The sheet says | What it changed |
| --- | --- | --- | --- |
| VX400s | 2.6 million, because it read the name as a VX400 | 2.3 million | Up to 18 panels too many on one unit |
| MCTRL4K | 8.8 million | 8.3 million on its sheet, 8.8 million in the 2021 catalogue | Up to 31 panels too many on one unit |
| MCTRL660 PRO | 4 ports, because it read the name as an MCTRL660 | 6 ports | Nothing yet. It matters once lines are counted as cabled |

Neither of the two we hold was affected: the VX4S and NovaPro HD were both read
as 2.3 million pixels from 4 ports, which is right.

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
- **It never says what would drive a screen ours can't.** Past one unit it
  asks for two of ours. It doesn't say that one hired VX600 or VX1000 would do
  it with one picture and no join.

## What the builder can do next

| | What it adds | What the person sees | New questions | Size |
| --- | --- | --- | --- | --- |
| 1 | Every limit checked | The processor line says which limit a screen breaks, in words. The three wrong readings are corrected | None | Small |
| 2 | Data lines as they are cabled | "5 data lines of up to 3 columns" beside the processor, and the long data cables to the screen counted | None | Small |
| 3 | Known processors, matched to the panel | About 35 processors known by name. One the list doesn't know asks once for its pixels and ports, as a panel does. A panel says which make of card it has, so the wrong make is never offered | Once for each panel and each unknown processor | Medium |
| 4 | Backup lines | One tick, "Backup on every data line". Lines, long cables and ports double, and a second processor is asked for when the ports run out | One tick, off unless Admin sets it on | Small |
| 5 | What to hire when ours can't drive it | "Two VX4S side by side, or hire one VX1000", with the hired unit added as a line to price. A note when the picture is scaled up from HD | None on the quote. The office lists what it hires | Medium |
| 6 | A wiring plan for the crew | A drawing on the show pack: the screen from behind, each data line numbered with its port, each power circuit with its way on the distro | None | Large |
| 7 | Frame rate and colour depth | Two choices under "More": 50, 60 or 120 Hz, and 8 or 10-bit. They change what a line carries | Two, hidden unless opened | Small |

**Step 1 is built (1.245.3).** The recommendation is to build 2 and 3 with it,
then 4, then 5, then 6, and to leave 7 until a job asks for it: counting at
60 Hz in 8-bit colour is the safe side for nearly every show, since 50 Hz
carries more.

The sheet stays as simple as it is. It keeps its four questions: size, panel,
hung or stacked, and how many. Everything above shows as a reason beside the
processor in the kit list, or sits behind one tick.

One thing from step 5 is worth knowing now. Both processors we hold take an HD
picture and scale it. A screen wider than 1,920 pixels, which is 7.5 metres of
the 3.9 mm panel, shows a picture stretched from HD. A client who wants 4K
shown pixel for pixel needs a hired 4K unit however few panels there are.

## What is needed from the office

| Question | Why it matters | Assumed until answered |
| --- | --- | --- |
| How many pixels across and down is each panel? | Every panel count here is worked from them | 128 × 128 for the 3.9 mm half-metre panel, 104 × 208 for the 4.8 mm metre panel |
| Which make of receiving card is in each panel? | A processor only drives its own make | NovaStar in both, since both processors are NovaStar |
| What is the widest and tallest screen the VX4S's menu allows? | Its own sheet doesn't say | 3,840 wide and 1,920 tall, as its sister units |
| Do shows run at 50 or 60 Hz? | 50 Hz carries a fifth more on each line | 60 Hz, the safe side |
| Is a backup on every data line the house standard? | It doubles the ports and the long cables | No backup |
| Which processors are hired in, from whom, and at what price? | The builder can only suggest what the office can get | Nothing suggested |

The builder already asks for a panel's pixels the first time that panel is
used, and keeps them on its product.

## Sources

Every figure comes from the maker's own sheet or manual unless a line says
otherwise. NovaStar's were read as the copies its distributors host, each with
NovaStar's own version number; each is linked from its name in the tables
above. The rest:

- VX4S: [specifications, Rev1.0.5](https://www.fullcompass.com/common/files/47354-VX4SBLZSpecSheet.pdf); the [VX4U cut sheet](https://cdn.shopify.com/s/files/1/1741/5055/files/novastar-vx4u_cutsheet.pdf) and the VX4S-N page of [NovaStar's 2021 catalogue](https://www.ac-et.com/storage/product_images/novastar/novastar-mctrlr5-led-controller/novastar-mctrlr5-novastar-catalog-2021.pdf) for 3,840 wide and 1,920 tall.
- NovaPro HD: [cut sheet](https://cdn.shopify.com/s/files/1/1741/5055/files/iris-nova-novaprohd_cutsheet.pdf) and [user manual](https://www.fullcompass.com/common/files/62167-NOVAPROHDBLZUserManual.pdf).
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
