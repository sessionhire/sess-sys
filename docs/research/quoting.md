# Making the quoting stage faster, easier and more reliable

Research date: 8 November 2026, asked for by Colly ("I'd like to focus on
the quoting stage of the app, adding functionality that would improve the
ease of use. Could you do an investigation on the functionality that could
improve the speed, ease of use, reliability of the quoting phase?").
Nothing is built yet; this page is for choosing. Invoicing stays paused
and nothing here touches it.

## Recommendation

**The quote editor is in good shape; the time goes before it and around
it.** The redrawn form (ADR 0100), rate rules (0085), availability and
margin (0089) and sending (0101) answer most of what a single quote needs.
What's left is the work a quote repeats every time (typing quantities one
line at a time, building a quote the company has written before), and a
few places where the quote can quietly go wrong (two people on one draft,
prices that have run out, a price list that moved underneath it).

In order:

1. **First, six small things** (a day or so each, about two weeks
   together): quantity as you pick kit, the price and what's free shown
   while picking, one check before a quote goes, prices that have run out
   said so, why a quote was turned down, and a day the quote is due by.
2. **Then the two that save the most time:** start a quote from one the
   company has written before (this app's or Current RMS's), and a
   product's usual companions offered with it (amps with speakers, the
   cables and rigging a fixture needs), learned from Current RMS's history.
3. **Alongside, one reliability fix that matters more as more people
   quote:** two people (or a phone that was offline) changing the same
   draft must not wipe each other's lines.
4. **Later, and Colly's call:** options on a quote (lines the client can
   take or leave), quotes split by part (build days, show days), the
   client accepting online once the app may contact people, and a short
   "how quoting is going" view.

## How quoting works today

Walked on made-up data, desk and phone, dark, as a director, 8 November
2026, on 1.109.3. Screenshots are in the project folder under
`screens/quoting-research/`.

1. **An enquiry arrives.** By email to operations@, Claude drafts the job
   and quote by itself when that's switched on (ADR 0098); pasted, Claude
   reads it on New quote (ADR 0096); otherwise the office types it.
2. **New quote** (Quotes, top card): the job's name, client and venue
   (both optional), first and last day. It makes an enquiry with one Show
   part and opens its first draft at the client's usual discount (ADR
   0081). `02-new-quote-desk.png`
3. **The draft** (ADR 0100): Add kit, Add crew, Add transport, Add
   something else, a package from the price list; travel and subsistence
   work themselves out; terms and sending sit beside the lines on a desk.
   It saves itself. `07-draft-empty-desk.png`, `12-draft-lines-desk.png`
4. **Sent**: by email from operations@ when that's on (ADR 0101), or
   printed and marked sent. The job becomes quoted; the stage's first task
   is ticked.
5. **Followed up**: Quotes' "To follow up", Notifications and Home count
   the quotes a week old with no answer (ADR 0081).
6. **The answer**: Client accepted, or turned it down, with the offer to
   confirm the job or mark it lost. Confirming moves the job out of
   Quoting into Planning (ADR 0104). `03-quote-a-desk.png`

## Where it slows, confuses or can go wrong

Each with what was checked.

### Speed

- **Every kit line lands at 1.** Add kit picks a product and adds one; the
  quantity is set by opening the line afterwards (`QuoteAdd`, `Draft`).
  A typical five-product quote (12 speakers, 4 amps, 8 movers, 2 riggers,
  an LX op) is about 25 presses and typings; with the number typed in the
  picker it's about 15. `10-after-two-desk.png`
- **The picker shows only the name and department**, not the price, how
  it's charged, or how many are free on the job's days.
  `09-add-kit-typed-desk.png`. Availability is only worked out once the
  line is on the quote (ADR 0089), so a product short on those days is
  found after it's added, then swapped or hired in.
- **Nothing starts from a quote the company has written before.** The
  quoting plan's part 1 had "copy a quote from another job"; what was built
  is a job from a past *Current RMS* quote (ADR 0102). A job from this
  app's own history (the same client's event every year, the same
  conference rig) is typed again. Packages (ADR 0087) help only for kit
  priced as one line.
- **A product's companions are added by hand.** Speakers need amps,
  fixtures need cables, clamps and safeties. Current RMS adds a product's
  accessories with it, and its history carries them: ADR 0102 found
  "an accessory charged nothing came with its product" in the lines it
  read. The app has the history and doesn't use it for this.

### Ease

- **New quote asks for nothing about the enquiry itself**: who at the
  client asked, how it came in, and when they need the quote by. The
  Quote sent task can already have a due day (ADR 0104, `due_on`), but
  nothing sets it when the quote starts, so the Next line says "in 25
  days" (the job's first day) rather than when the client wants the
  price. `13-job-page-desk.png`
- **"Turned it down" records no reason.** The By client card (ADR 0092)
  can say how often a client goes ahead, never why not: price, dates, went
  elsewhere, event cancelled. That's the one thing that would change how
  the next quote is priced.
- **The margin reads 100% on a kit-only quote** (`03-quote-a-desk.png`,
  `12-draft-lines-desk.png`), because our own kit costs nothing (ADR 0089,
  decision 3). True by the rule, but it reads as a mistake; "own kit not
  costed" beside it says what the number is.
- **One part only.** New quote makes a single Show across the days unless
  Claude read parts from an enquiry. Builds, shows and load-outs (the
  company's own shape, `current-process.md`) are added on the job page
  afterwards, and lines are charged for the whole span unless changed one
  by one or with "Charge all kit for…".

### Reliability

- **Two people on one draft: the later save wins whole.** A draft reads
  the quote once when it opens and doesn't take in changes made
  elsewhere; each save sends every line, and the server writes them over
  what's there (`quote.save` in `server/src/finance/handlers.ts`). So the
  director on a phone and the office on a desk, or Claude's draft from
  the mailbox and an edit by hand, or a phone that saved "on this device"
  and comes back online later, can each undo the other's lines without a
  word. Nothing is refused, so nobody knows.
- **Prices run out silently.** A quote prints "valid until" (30 days by
  default), but nothing happens when the day passes: it stays in "Waiting
  for an answer", and accepting it afterwards says nothing about prices
  that may have changed (`validUntil` is only used for printing).
- **The price list can move underneath a draft.** A line keeps the price
  it was added at; if the price list changes before it's sent, nothing
  says so.
- **What stops a quote going is spread out.** Chips for lines with no
  price, short of kit or with no cost sit in the readout (ADR 0100), the
  venue not on the map sits in the travel row, a client with no email
  shows only in the compose box. Mark as sent doesn't gather them, so a
  quote can go out with no travel because the venue wasn't on the map.

## What other hire systems do

From the competitor audit (`competitor-audit.md`) and the systems' own
documentation: Current RMS and Rentman both clone a quote into a new job,
add a product's accessories with it, offer optional lines, and take the
client's acceptance online with a signature. Rentman sells quoting and
invoicing as an add-on with e-signature and online payment. The audit's
advice stands: parity on quoting is enough; the app's difference is the
rest of the job.

## The features, ranked

Value is for the office and directors who quote; effort is a rough size
for this codebase: **S** a day or less, **M** a few days, **L** a week or
more.

| # | Feature | Helps | Value | Effort |
|---|---|---|---|---|
| 1 | Quantity as you pick kit | Speed | High | S |
| 2 | Price, rule and free count in the kit picker | Speed, reliability | High | S |
| 3 | One check before a quote goes | Reliability | High | S |
| 4 | Prices that have run out said so | Reliability | Medium | S |
| 5 | Why it was turned down | Ease | Medium | S |
| 6 | Due by, who asked and how, on New quote | Ease | Medium | S |
| 7 | Two people on one draft keep both changes | Reliability | High | M |
| 8 | Start from a quote written before | Speed | High | M |
| 9 | A product's usual companions | Speed | High | M |
| 10 | The price list changed since a line was priced | Reliability | Medium | S–M |
| 11 | Margin says "own kit not costed" | Ease | Low | S |
| 12 | Parts on New quote, and lines charged per part | Ease | Medium | M |
| 13 | Options on a quote | Ease | Medium | M–L |
| 14 | How quoting is going | Ease | Medium | M |
| 15 | The client accepts online | Speed | High | L |

### 1. Quantity as you pick kit

Type "12 y10" in Add kit, or a number box beside it that Enter carries
over; the line lands at 12. The picker stays open for the next product as
it does now (audit finding 58). Crew the same: a number beside the role.

### 2. What the picker knows

Each product in the picker shows its price and rule ("€45 a day, 3 Day
Week") and, for the job's days, how many are free ("8 free of 24"), from
the same `quoteKit` the line uses afterwards. A product with none free is
still offered, said plainly, with Hire in as the line's first question.
Healthy stays quiet: nothing coloured unless short.

### 3. One check before a quote goes

Pressing Send to the client or Mark as sent first lists what's still open,
in one place, each opening its line: no price, short of kit, no cost
(warning only), no travel because the venue isn't on the map, the client
with no email address, days already past. Faults stop it; warnings ask
once ("Send anyway"). The chips stay as they are; this gathers them at the
moment it matters (Nielsen's error prevention).

### 4. Prices that have run out

A sent quote past its valid-until moves to its own line in To follow up,
"Prices ran out Tue 24 Nov", with **Hold them another 30 days** (a note in
the history, no new version) or **Start a new version**. Recording an
acceptance after the day asks once whether the prices stand. Nothing is
sent to the client.

### 5. Why it was turned down

"Client turned it down" asks why, one tap from a short list (price, dates,
went with someone else, event off, no reason given) with a note. The By
client card and the Quotes page count them. Stored on the quote's answer;
optional, so a quick "no" stays quick.

### 6. The enquiry's own facts on New quote

Three optional fields: **who asked** (a client contact, or typed), **how it
came** (email, phone, in person, from Claude), and **quote by** (a day).
Quote by sets the Quote sent task's due day, which the Next line, Home's
tasks and lateness already use (ADR 0104). Claude fills all three from an
enquiry when it can.

### 7. Two people on one draft

Each save says which saved version it started from; the server takes a
save only onto that version, line by line: lines changed by only one side
merge, the same line changed by both keeps the later and says so. The open
draft takes in changes made elsewhere (as the rest of the app does through
sync), except the line being typed in, and says "2 lines changed on another
device a moment ago". The phone that comes back online merges the same way instead
of overwriting. This is the one change here with a data rule in it, so it
gets an ADR of its own.

### 8. Start from a quote written before

New quote gets **Start from a past quote**: search this app's quotes and
Current RMS's together (the Quotes page's search already covers both),
pick one, give new dates. Its lines come in as the ticked list Claude's
and ADR 0102's already use, priced **at today's price list** by default,
with "as charged then" a choice per quote (repeat clients often expect
last year's price). A job's page gets **Quote it again** for the same.
Packages stay for a fixed bundle at one price; a past quote is a starting
point to change.

### 9. A product's usual companions

When a product is added, offer the products that usually go with it, with
how many: "Usually with 12 × d&b Y10P: 3 × D20, 12 × rigging frame". Taken
from the accessories Current RMS's lines carry and from what's quoted
together in the app's own quotes (worked out on the server, refreshed when
history is read). One press adds them; ignoring them costs nothing. Kept on
a product's price-list row so the office can correct it.

### 10. The price list moved

A draft says "3 lines priced before the price list changed" with **Use
today's prices**, as "The job has changed" does for kit and crew (ADR
0080). Lines priced by hand, from history or by Claude are left alone.

### 11. The margin's words

"Margin €3,540, 100% · own kit not costed" when the quote has own kit, so
the number reads as what it is.

### 12. Parts from the start

New quote offers the usual parts as chips (Prep, Build, Show, Load out)
with a day each, and lines can be charged for the parts they're needed
for, not only the whole span. Larger, because kit charged by part touches
rate rules and availability; worth it if most quotes have build days.

### 13. Options on a quote

A line marked **option** is printed under "Options" with its own price,
not in the total; the client's answer can take some of them, which become
lines of the next version (or of the accepted one, with a note). Only if
clients ask for "with or without the LED wall" often.

### 14. How quoting is going

On Quotes, for the office and directors: quotes sent this month, how long
from enquiry to sent, how many went ahead and the reasons for the rest
(from 5), the average discount. No invoicing figures.

### 15. The client accepts online

The quote email (ADR 0101) carries a link to the quote, where the client
presses Accept, types their name and, if there's a deposit, sees how to
pay it by transfer. It records the answer as the office would. This
contacts clients, so it waits until launch and is built behind a switch
like messages to crew; it also needs the client page kept from search
engines and links that run out. Online payment is invoicing work and is
left out.

## Design

- **One job of the stage:** get a correct price to the client quickly, and
  know where every quote stands.
- **Behaviour designed for:** Default Effect (the quantity, the companions
  and the past quote are offered ready to take, the office corrects rather
  than builds); Time Scarcity (quote by and prices running out make the
  deadline visible rather than remembered); Loss Aversion kept honest (no
  one's lines silently lost; a turned-down quote kept with its reason).
- **The system's parts first:** the combobox for the picker (with a second
  line for price and free count), the issue chips and an inline confirm for
  the check before sending, the existing ticked-list for a past quote and
  companions, task due days for quote by.
- **Heuristics rated 3 today and closed by this list:** error prevention
  (a quote goes with no travel; a draft overwritten without a word, 3 and
  7); visibility of system status (prices run out silently, 4).

## Questions for Colly

1. **How long does a quote take today, and which part is slowest?** The
   order above assumes picking and typing quantities; if it's waiting for
   the client's details or checking availability, 6 or 2 move up.
2. **How many jobs repeat a quote from before** (the same event each
   year)? That sizes 8.
3. **Companions: offer them, or add them by themselves?** Recommended:
   offer, one press to take.
4. **Do clients ask for options** ("with and without the LED wall") on one
   quote? If not, 13 drops off.
5. **A repeat quote: last year's prices or today's** by default?
6. **At launch, should clients accept online** (15), and is a typed name
   enough, or is a signature needed?
7. **Is Claude reading operations@ on live yet?** If so, 7 matters sooner,
   since Claude and the office then both touch drafts.

## Not proposed

- Invoicing, deposits taken in the app, online payment: paused.
- Sending anything to clients before launch: everything that contacts
  someone is behind a switch, as now.
- A second quote editor for desk (a grid): ADR 0080 chose one way on every
  screen, and the walk found the editor itself isn't where the time goes.

## Sources

- Our own: ADRs 0042, 0078, 0080, 0081, 0084-0089, 0092, 0096, 0098,
  0100-0102, 0104; [current process](current-process.md);
  [competitor audit](competitor-audit.md); the code at 1.109.3
  (`web/src/jobs/QuoteDraft.tsx`, `QuoteAdd.tsx`, `Money.tsx`,
  `server/src/finance/handlers.ts`, `shared/src/quotes.ts`).
- Nielsen Norman Group, [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
  (error prevention, visibility of system status).
- Current RMS help on product accessories and cloning opportunities, and
  Rentman's quoting documentation, as summarised in the competitor audit.
