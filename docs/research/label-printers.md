# Label printers

Research from 28 October to 12 November 2026, at Colly's asks in the thread
"Print labels straight from the app". Where it stands: Colly is leaning
towards a **Zebra ZT411 at 300 dpi**. RFID is not for now (Colly,
1 November). One-tap printing, with no print dialog, waits until Colly picks
a printer. Until then the app prints labels through the computer's print
dialog, on a page sized to the label ([Decision 15](../adr/0015-printing-labels.md)).

Prices are guides taken from retailers and search results on the dates
given. They are not quotes.

## Desk printers: LabelTac against Zebra

The first shortlist was a LabelTac Pro X. For numbered QR labels printed from
our own app, a Zebra desk printer does the same job for less, without being
tied to one supplier.

| | LabelTac Pro X | Zebra ZD421t / ZD621t |
|---|---|---|
| Price | about $1,299 | about €450–700 / €700–900 |
| Speed at 300 dpi | 6 in/s | 4 / 6 in/s |
| Screen | 3.5" colour | lights only / 4.3" colour touch |
| Network | USB and Ethernet built in | ZD421: USB and Bluetooth, Ethernet or Wi-Fi added later. ZD621: Ethernet built in |
| Label language | ZPL copied from Zebra | ZPL natively (the standard) |
| Labels and ribbon | LabelTac's own, one US supplier | anyone's, sold in Ireland and the UK |
| Printing from a web app | nothing ready-made | free Browser Print helper, or the printer connects to the app itself |
| Design software | LabelSuite (safety signs, pipe marking) | ZebraDesigner (free) |
| Extras | continuous signs up to 37 ft | cutter or peeler can be added |

LabelTac is strongest at safety signs and pipe marking. Dymo and Brother QL
printers use paper labels that won't survive road cases.

## Industrial printers: the step up

All of these speak the same ZPL, so the app works the same with any of them.

| Printer | Rough price | What it adds | Verdict |
|---|---|---|---|
| Zebra ZT231 | €1,100–1,500 | Metal case, ribbons up to 450 m, colour touch screen, Ethernet | The sensible upgrade without RFID |
| **Zebra ZT411** | €1,307 (203 dpi), €1,569 (300 dpi) inc. VAT online; about €3,100–3,300 with RFID | The same toughness, plus a 600 dpi head option for tiny QR labels and an RFID encoder option | **The pick if budget allows** |
| Zebra ZD621R | — | A desk printer with RFID built in | A cheaper way to RFID without the industrial build |
| Zebra ZT610 / ZT620 | — | Factory-line printers | Far more than we'll print |
| Zebra ZQ handhelds | — | Print without ribbon | Those labels fade, so not for kit |

## Colour printers

The ZT411 prints black only. The app prints a cable's colour as a word in a
black band, so labels read in black alone, and a "This printer prints
colour" tick prints the band in the real colour on a colour printer
([Decision 106](../adr/0106-logo-length-and-colour-on-labels.md)).

| Printer | Rough price | Notes |
|---|---|---|
| Epson ColorWorks CW-C6000 / C6500 | €2,300–2,750 + VAT | 4" or 8" wide, pigment ink, 1200 dpi, auto-cut, ZPL II emulation listed. About 2–5c a 50 × 25 mm label in ink and label. The one to choose if colour on the label matters. |
| Epson ColorWorks CW-C4000 | about €1,680 + VAT (Jarltech Ireland) | The same kind of print, slower, with smaller ink cartridges |
| Primera LX910 / Afinia L901 | similar | Aimed at product labels. Skip them for kit. |
| Brady BBP37 | — | Thermal transfer with 2–4 colour ribbons at about €290 + VAT a ribbon. Durable, but only a few fixed colours. |

Pigment ink on synthetic labels survives water and sun, but scuffs sooner
than resin print on polyester. The suggestion is to stay with the ZT411 and
add the colour with tape or heat-shrink by length, which shows all the way
round the cable.

## Label stock

- **Labels:** white matte polyester, die-cut on a roll (Zebra Z-Ultimate 3000T
  White or the like), in 50 × 25 mm and 25 × 25 mm to match the app's layouts.
- **Adhesive:** permanent or aggressive, rated for powder-coat and textured
  plastic.
- **Ribbon:** full resin (Zebra 5095 or the like), at least as wide as the
  label.
- **Cables:** vinyl flag labels for QR codes, or self-laminating wraps for a
  length in big type. A ZT411 can't print true heat-shrink sleeves.
- **Road cases and rigging:** riveted aluminium (Metalphoto) tags.
- Wipe the surface with isopropyl alcohol first, and let the glue set for a
  day before the kit goes out.

## Irish suppliers for the ZT411

None of the resellers publish a ZT411 price, so each one is a quote. Partner
levels are what each says on its own website; Zebra's partner finder can
confirm them. Checked 12 November 2026.

| Supplier | Where | Zebra standing (their claim) | Pros | Cons |
|---|---|---|---|---|
| [AIS](https://www.aisautomation.ie/brand/zebra/) | Park West, Dublin 12 (+353 1 620 5742) and Little Island, Cork (+353 21 235 5540) | Premier partner, accredited repairer | Zebra's top level; accredited repairs with stock and spares in Dublin; also sells CAB and SATO | A larger integrator, so one printer is a small order; no prices online; two websites under two names |
| [TPSI Ireland](https://www.tpsi.ie/) | Nationwide, Dublin and Cork (087 353 4779) | Authorised agent | On-site repair and service contracts; sets up and trains; labels and ribbons for any printer | Seems small (a mobile number, no address online); not Premier; no prices online |
| [BHTS](https://www.bhtservices.ie/label-printers-ireland/) | 2 Fairview Strand, Dublin 3 (01 902 3825); engineers in Portadown | Premier partner | Online catalogue including the ZT411 and RFID version; printer, labels, printheads and label software from one supplier | Ask how quickly they reach Dublin for a repair; the Dublin office may be sales only |
| [KSE Barcode](http://www.ksebarcode.ie/) | Park West Enterprise Centre, Dublin 12 | Authorised partner | Repairs and printheads; prints barcode labels to order | Dated website, mostly desktop printers; site was down on 12 November; no prices online |
| [BSS Labelit](https://www.bsslabelit.ie/) | Swords Business Park (+353 1 870 0070) | Authorised partner | Next-day labels and ribbons; an [online shop](https://shop.bsslabelit.ie/); label software | Shop shows mostly desktop printers; not Premier. Not the same company as labelit.ie. |
| [Logiscenter](https://www.logiscenter.ie/brands/zebra/printers/barcode-label-printers) | Online only | A shop | Published prices, a floor for the quotes | No one local to set up, repair or advise |

**Suggested next step:** ask AIS and BHTS for quotes, and TPSI too if
someone coming out matters most. Use the Logiscenter price as the floor.
Ask each of them the same five things:

1. The price for a ZT411 at 300 dpi with Ethernet, including VAT and delivery.
2. The warranty length, whether it's on-site, and the cost of Zebra OneCare.
3. Whether they will set it up on the warehouse network and print a test from the app.
4. A sample roll of white matte polyester labels (50 × 25 mm and 25 × 25 mm)
   with a resin ribbon, and the price per roll.
5. How quickly they can be in Dublin if it breaks.

The same comparison, as a page: [Irish Zebra Suppliers](https://claude.ai/artifact/NKimnzycnGaNYBvZ6KDjaa).
RFID research, for later: [RFID at Session Hire](https://claude.ai/artifact/4qMfhWP5nfMssJgBPbEaXk).
