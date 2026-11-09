# Audit, 8 November 2026: the quote flow, as the office fills it in

Colly asked on 8 November for an audit of the quote flow: "Consider
everything. Particularly from the persona of the staff member filling it
in." And a second angle: "if you had to do it again from scratch what would
be different". This is that audit. It follows one quote from the enquiry to
a sent quote, the client's answer and the confirmed job, as the office
person who writes most of them, on a phone and at a desk. The
[second half](#if-we-built-quoting-again-from-scratch) answers the
from-scratch question.

It audits main at **8b1852e, app 1.118.0**, the same day as the
[quoting research](research/quoting.md) and the work that came out of it:
quantity and price in the product picker, the check before a quote goes,
prices that have run out, why a quote was turned down, who asked and the
day it's wanted by (#254, #255), two people on one draft
([ADR 0113](adr/0113-two-people-on-one-draft.md)), starting from a past job
([ADR 0115](adr/0115-start-a-quote-from-a-past-job.md)), packages as a
shortcut for their kit and the 41 starter packages
([ADRs 0116](adr/0116-a-package-is-a-shortcut-for-its-kit.md) and 0117),
and type-to-search client, venue and who asked (#263). Nothing here repeats
a finding that is already fixed. Where one from the
[5 November audit](audit-ux-2026-11-05.md) is still open, or has come back
in a new form, it says so.

**Since:** every finding is fixed, in the
[order to fix things](#the-order-to-fix-things): batch 1 in #266 (1.119.0),
2 in #278 (ADR 0126), 3 in #279 (ADR 0127), 4 in #281 (ADR 0128), 5 in
#283 (ADR 0129), 6 in #284 (ADR 0130) and 7 in #287 (ADR 0133). The six
questions at the end are still open.

**How it was done.** A local copy of the app at 1.118.0, filled with the
made-up data, plus the 309 products and 221 prices of the company's real
price list brought in from Current RMS, and the 41 starter packages. A
48-line quote was built to stand for a big festival. The quote flow was
walked end to end as the office role, many times, in a browser driven by
script: New quote, the draft, kit, crew, transport, packages, travel, the
check before it goes, Mark as sent, the printed quote and its PDF, the
client's yes, confirming the job, and what the job's Kit and Crew tabs show
after. It was walked on a phone (390×844) and a desk (1440×900), dark and
light, with the processor slowed four times for timing, and with the
network cut. Every press and key was counted. The code each screen runs
was read to find where it decides what it does, and the design system's
designing questions, heuristics and behaviour rules were the yardstick. *Reproduced* means it was seen
happening; *inferred* means it was read from the code.

To know what a real quote looks like, the company's Current RMS export
(1,072 quotes and their lines, 2023 to 2026) was counted. **Only totals,
shares and medians are given here**, because this repository is public: no
client, venue or job from that history is named.

Nothing live was read or changed. Nothing went near Google, Gmail,
Railway or Neon, and nobody was contacted. Sending by email needs the
operations mailbox, which the local copy doesn't have, so that path was
judged from the code. Screenshots are in the project folder under
`screens/quote-audit/` (made-up data; the "made-up data" line under the
company name is how the local copy says so).

## What a real quote looks like

The office's quotes, from the Current RMS history. Each finding below is
weighed against these.

| | |
|---|---|
| Quotes a year | about 360 (354 in 2024, 365 in 2025) |
| Lines on a quote | median 17; a quarter have 7 or fewer, a quarter 33 or more, one in ten 48 or more; the most is 121 |
| Groups on a quote | median 3, named by part or place ("audio", "lighting", "crew", "cables", "power", stage areas) |
| Lines given at no charge | **three quarters of quotes (791 of 1,057) carry at least one deliberate €0 line**: cables, power, adaptors, stands. 5,225 such product lines in all |
| Text lines | 28% of all lines are headings or words, not products |
| How kit is charged | Weekly 46%, 3 Day Week 40%, Daily 8% |
| Crew and transport | on 448 quotes; "Technician" 507 lines, "Transport" 319 |
| Time from the quote being made to the first day | **median 3 days**; 44% within 2 days, 64% within a week |
| Repeat clients | 862 of 1,072 quotes (80%) are for a client quoted before; 42 clients have five or more |
| Venue named | 22 of 1,072. 40 quotes are named as dry hire |
| Value | median €1,915; a quarter under €505, a quarter over €6,635, one in ten over €15,695 |
| Priced to a deal | 200 quotes (19%) have a deal price; 158 (15%) discount single lines |

So the person filling a quote in is usually quoting a client they know,
for a show three days away, with about seventeen lines in three groups,
some of them given free, charged by the week or a three-day week. That is
the person this audit follows.

## The short version

**21 findings: no P0, 4 P1, 13 P2, 4 P3.**

What works is a long list, and it is in [What held up](#what-held-up). In
short: the flow is fast. A new quote with eight kit lines, crew and
transport, taken through to sent, accepted and confirmed, took 31 presses
and about 128 keys, and every press answered in under a tenth of a second
at a desk. Typing "12 y10" adds twelve. The
picker says each product's price, rule and how many are free. The client's
usual discount is put on by itself. Everything works with no signal and
goes up when it comes back. Two people on one draft keep both their
changes. The numbers agree from the draft to the printed quote, the PDF,
the Quotes page and Home. The check before a quote goes catches unpriced
lines, short kit and missing travel.

What gets in the way falls into four patterns:

1. **The app can't say what the office means.** Three quarters of real
   quotes give some lines free, but the app can only call a €0 line
   "needs a price": amber on the line, an amber chip, and a question
   before it goes, on almost every quote (finding 1). Lines can only be
   grouped by department, where the office groups by place and by cables
   and power (11). A dry hire is made as a show with a crew task and
   travel (10). The quote goes to the client's first contact, not to the
   person who asked (6).
2. **Typing is read as something else, silently.** "2 d20" adds one D20,
   because "2 d20" is found whole in the product's name before it's read as
   a count (2). "bright" in Client, then Tab, makes a new client called
   "bright" beside Brightwater Conferences, without its discount, contacts
   or past jobs (3). Both are quiet: the screen looks right until the
   total is wrong.
3. **The quote and the job don't know about each other.** Kit put on a
   draft isn't on the job's kit list, so a rival quote's picker still says
   it's free, and confirming the job holds nothing until someone presses
   "Add all to the kit list" on the Kit tab (4). Crew on the quote don't
   become crew calls (8). Days are the whole span, gaps included (9).
4. **Time is the office's tightest limit, and it's out of sight.** With a
   median of three days from enquiry to the first day, the day a quote is
   wanted by is set on New quote and then only shows once it's late (7).
   Drafts sit last on the Quotes page, ordered by when they last changed.

On a phone, two things hurt: a festival-sized draft is eight phone screens
with no way to fold a group (15), and the picker's list has room for about
two options above the keyboard (15).

The second angle, from scratch, comes to one idea: **the quote is the
job's plan, not a document about the job.** Its lines are the kit and crew
the job will have, pencilled while it's a quote, held when it's confirmed.
That one change answers findings 4, 8 and 9 and most of the from-scratch
list. It doesn't need a rebuild: the
[from-scratch section](#if-we-built-quoting-again-from-scratch) ends with
how to get there in steps.

## The flow, step by step

The office person's walk, with what it costs and a verdict. Presses and
keys are for the made-up "Brightwater conference desk": eight kit lines,
one crew role, transport, sent, accepted, confirmed. Times are at a desk;
the phone at four times slower is given where it differs.

| Step | What they do | Presses · keys | Verdict |
|---|---|---|---|
| 1. Open New quote | Quotes › To follow up › New quote, or Money on a job | 1 | Good. One press from the Quotes page |
| 2. Say what and who | Job name, client, venue, dates, who asked, how it came, the day it's wanted by | 10 · 52 | Good, but the client and venue fields take a part-typed name as a new record (3) |
| 3. Start from something | Past jobs (same client or venue), suggestions from a pasted enquiry | 0 to 3 | Offered only on an exact name match, and only this app's own jobs (17) |
| 4. Start the quote | Start the quote | 1 | 113 ms (73 ms offline). Makes a show with a Show phase and travel, whatever the job (10) |
| 5. Add kit | Add kit, "4 yp10", Enter, "2 d20", Enter… | 10 · 60 for eight lines | Fast: the picker stays open, about 70 ms a pick, and says price and free count. A count whose digits are in a name is dropped (2). Free lines flag amber (1) |
| 6. Add crew, transport | Add crew, a role and how many; Add transport | 6 · 14 | Good. Crew are charged every day of the span (9) |
| 7. Packages | Add a package, a select of 41 | 2 (not in the count) | A long plain list beside the kit search (12) |
| 8. Terms | Discount (filled from the client), agreed total, valid for, deposit, notes | 0 (not in the count) | Good. The client's usual discount is put on and said |
| 9. Before it goes | Mark as sent; one question listing what's missing | 2 | Catches the right things, but on most real quotes it lists the free lines too (1) |
| 10. Print and send | Print or save as PDF, send it by hand | 2 (not in the count) | The red button after marking sent is "Client accepted", not Print (14). By email, marked sent before Gmail takes it (5) |
| 11. The answer | Client accepted, or turned down with a reason | 2 | Good. Reasons and notes are kept |
| 12. Confirm the job | Confirm the job | 1 | Holds no kit and books no crew; both are typed again or pressed for on Kit (4, 8) |
| **In all, measured end to end** | Steps 1 to 6, 9, 11 and 12 | **31 · about 128** | Fast to do, slow to trust: the office has to read every line back |

## Findings

Each finding has a priority (P0: the office cannot work from it or data is
lost; P1: fix before quoting moves into the app for real; P2: worth doing;
P3: polish) and a severity from 0 to 4 on the usability scale the design
system uses (1 cosmetic, 2 minor, 3 major, 4 catastrophe). Each names the
heuristic or rule it breaks, what happens, what it costs, the fix, and
where the app decides it.

| # | Priority | Severity | Finding |
|---|---|---|---|
| 1 | P1 | 3 | A line given free can only be said as "needs a price", so three quarters of real quotes are flagged amber and asked about before they go |
| 2 | P1 | 3 | A count typed in the kit picker is dropped when its digits are in a product's name: "2 d20" adds one |
| 3 | P1 | 3 | A client or venue typed in part and left becomes a new record, without the real one's discount, contacts or past jobs |
| 4 | P1 | 3 | Kit on a draft isn't on the job's kit list, so a rival quote sees it as free and confirming holds nothing |
| 5 | P2 | 3 | Sending by email marks the quote sent and numbered before Gmail takes it; if Gmail refuses, it says nothing was sent but the quote stays Sent |
| 6 | P2 | 3 | The quote is addressed to the client's first contact, not to the person who asked for it |
| 7 | P2 | 3 | The day a quote is wanted by is out of sight until it's late, and drafts are listed last, by when they last changed |
| 8 | P2 | 2 | Crew on a confirmed quote don't become crew calls: Next says "Ask for the crew" and they are typed again |
| 9 | P2 | 2 | Kit and crew added on a draft are charged for every day of the job's span, gaps included |
| 10 | P2 | 2 | New quote always makes a show with a Show phase, crew task and travel; a dry hire can't be quoted as one |
| 11 | P2 | 2 | Lines are grouped only by department and can't be put in order, where the office groups by place and by cables and power |
| 12 | P2 | 2 | Packages are a separate plain list of 41, away from the kit search |
| 13 | P2 | 2 | One unfinished line, such as an empty "something else", stops every other change on the draft saving |
| 14 | P2 | 2 | After Mark as sent the red button is "Client accepted", while the office's next step is to print it; the numbered PDF exists only after marking sent |
| 15 | P2 | 2 | On a phone a festival-sized draft is eight screens with no group folded, and the picker has room for about two options above the keyboard |
| 16 | P2 | 2 | The printed quote and its PDF carry no logo, and are drawn by two different pieces of code |
| 17 | P2 | 2 | Past jobs are offered only on an exact client or venue name, and never from the Current RMS history where four in five clients already are |
| 18 | P3 | 2 | "Accepted already, by phone?" records a yes without the check before it goes |
| 19 | P3 | 1 | Own kit counts as costing nothing, so the margin reads high and every quote has a "no cost yet" chip |
| 20 | P3 | 1 | A quote marked sent with no signal shows a guessed number, which a PDF printed then carries even if the server gives another |
| 21 | P3 | 1 | Small wording and listing slips |

### P1: before quoting moves into the app for real

#### 1. A line given free can only be said as "needs a price", so three quarters of real quotes are flagged amber and asked about before they go

**P1, severity 3** · 2 Match between the system and the real world; principles "healthy is quiet" (amber means attention) and rule 1 ("a confirm that appears every time is clicked through by habit") · Draft, readout, before it goes · Seen: desk and phone, dark · Reproduced

- **What happens:** Cables, power and stands are added from the price list at no price, as the office has always quoted them. Each such line reads "1 × no price a day × 2 days: needs a price" in amber, the readout shows an amber chip "3 lines with no price", and Mark as sent asks first: "3 lines with no price, which go to the client as €0.00". Only a line under a package or a rack (ADR 0116) can be at €0 quietly. In the Current RMS history 791 of 1,057 quotes (75%) carry at least one deliberate €0 product line, 5,225 lines in all.
- **What it costs:** The question built to stop a real mistake (5 November, finding 26) is asked on three quotes in four, so the office learns to press past it, and then it no longer catches the line someone forgot to price. The amber on screen, meant for "look at this", is on most quotes all the time.
- **Fix:** A third state for a line's price beside a price and no price: **Included** (or "no charge"). Chosen on the line, or set on a product in the price list so it arrives that way. It shows quietly, prints as "Included", and the check before it goes then asks only about lines that have no price and aren't marked included. Bring the RMS €0 products in as included.
- **Where it is decided:** `shared/src/quotes.ts:798` (`needsPrice`), `web/src/jobs/QuoteDraft.tsx:325` and `:355`, `web/src/jobs/QuoteLine.tsx:83`
- **Screenshots:** `15-draft-lines-desk.png`, `16-before-it-goes-desk.png`, `16-before-it-goes-phone.png`

#### 2. A count typed in the kit picker is dropped when its digits are in a product's name: "2 d20" adds one

**P1, severity 3** · 5 Error prevention; 1 Visibility of system status; principles rule 10 ("say what will happen, then show what did") · Add kit · Seen: desk and phone · Reproduced

- **What happens:** The picker reads "12 y10" as twelve of what "y10" finds, but only when the whole text finds nothing. "2 d20" finds the d&b D20 whole (the "2" matches inside "D20" and the model numbers), so it adds one at 1. The same with "4 m4", "10 y10" and other model names with digits in. "12 x 58" works because nothing has "12 x 58" in its name. The picker gives no sign which reading it took until the line lands at 1.
- **What it costs:** On a real price list, where most audio and lighting products carry model numbers, the quickest way to add kit gives a wrong quantity about as often as a right one, and the total is short by the difference. The office finds out only by reading each line back, or the client is undercharged.
- **Fix:** Read a leading whole number followed by a space as the count first, and only fall back to the whole text when the rest finds nothing. Show the count in the picker before Enter ("2 × d&b D20"), so the reading is seen, not guessed.
- **Where it is decided:** `web/src/RecordPicker.tsx:103`, `shared/src/find-product.ts` (`leadingCount`, `findProducts`)
- **Screenshots:** `23-picker-2-d20-desk.png`, `15-draft-lines-desk.png` (the "d&b D20 1 ×" line)

#### 3. A client or venue typed in part and left becomes a new record, without the real one's discount, contacts or past jobs

**P1, severity 3** · 5 Error prevention; 4 Consistency (the combobox's keys); 5 November finding 21, come back in a new form · New quote: Client, Venue, Who asked · Seen: desk · Reproduced

- **What happens:** Type "bright" in Client. The list offers "Brightwater Conferences" and "Add 'bright' as new". Press Tab, or click elsewhere, and "bright" is kept as typed; on Start the quote the app makes a client called "bright". Press the down arrow to go to Brightwater and then Enter, and the arrow has already moved past it to "Add as new", so the same happens. Only a name typed in full, in any case, is matched. The field says nothing beyond grey text when the name is new. The same is true of Venue and Who asked.
- **What it costs:** The quote goes out without the client's usual discount, without its contacts or address, and with no past jobs to start from. The client list gains a duplicate that Tidy up has to find later. This happened in the audit's own first walk, at a desk, typing at normal speed.
- **Fix:** Leaving the field with text that matches the start of one known name takes that name (and says so); with several, the field stays open and asks. "Add as new" is never the row Enter or the first arrow lands on while a known name contains the text. A new name shows a plain line under the field: "New client: bright".
- **Where it is decided:** `web/src/NameField.tsx:153` (blur keeps what was typed), the highlight logic above it; `web/src/jobs/Money.tsx:357` (`clientNamed`, `venueNamed` make the record)
- **Screenshots:** `03-client-typed-desk.png`, `04-who-asked-desk.png`

#### 4. Kit on a draft isn't on the job's kit list, so a rival quote sees it as free and confirming holds nothing

**P1, severity 3** · 1 Visibility of system status; principles rule 9 ("a default is a decision") · Draft, the picker's free count, Confirm the job, Kit tab · Seen: desk · Reproduced

- **What happens:** Kit picked on New quote's suggestions, from a past job or an RMS quote is put on the job's kit list as well. Kit added on the draft itself, the usual way, isn't. So the picker's "N free" on another quote for the same days doesn't count it, and two quotes can both promise the last two D20s. When the client says yes and the job is confirmed, the job's kit list is still empty: nothing is held until someone opens Kit and presses "Add all 8 to the kit list". Next does say "Add the kit", but the kit is already decided.
- **What it costs:** With a median of three days from quote to show, a double promise is found on the morning it's picked, if at all. And every confirmed job has a step that only retypes what the quote says.
- **Fix:** The quote's kit is the job's kit: every kit line on a draft is on the kit list, pencilled, and changes there as the quote changes; confirming makes it held. The Kit tab's "From the quote" card then only reconciles changes made after a version was sent. This is the first move of the [from-scratch section](#if-we-built-quoting-again-from-scratch).
- **Where it is decided:** `shared/src/sync/quote-kit.ts` (`quoteKit`, `kitFromQuote`, `kitFree`), `web/src/jobs/Money.tsx:368` (only New quote adds it), `web/src/jobs/Kit.tsx:615`
- **Screenshots:** `19-job-after-confirm-desk.png`, `20-job-kit-desk.png`, `20-job-kit-phone.png`

### P2: worth doing

#### 5. Sending by email marks the quote sent and numbered before Gmail takes it; if Gmail refuses, it says nothing was sent but the quote stays Sent

**P2, severity 3** · 9 Help users recognise and recover from errors; principles rule 18 · Send to the client (email switch on) · Inferred (no mailbox in the local copy)

- **What happens:** The server marks the draft sent (which gives it its number), moves an enquiry to quoted, then draws the PDF and hands it to Gmail. If Gmail refuses, the answer is "Gmail didn't take it. Nothing was sent; try again in a minute", while the quote now shows Sent, numbered, with the follow-up clock started. If the number clashed, it's found after marking. The PDF is drawn from the server's copy, so a change still waiting in the device's queue can be left off it, and once the quote is sent that change is refused.
- **What it costs:** A quote that never reached the client sits in "Waiting on the client" and is chased as if it had. Off by default today, so nothing is lost yet.
- **Fix:** Wait for the device's queue to be empty before sending; draw and send first, and mark sent with the number in the same step only once Gmail has taken it. If that can't be one step, say exactly what state the quote is in when Gmail refuses ("Numbered 1043 but not sent: send again or print it").
- **Where it is decided:** `server/src/finance/quote-email.ts:135-166`
- **Must be fixed before** the email switch is turned on in live.

#### 6. The quote is addressed to the client's first contact, not to the person who asked for it

**P2, severity 3** · 2 Match between the system and the real world; principles rule 15 ("help them look good") · New quote, the printed quote, the PDF · Reproduced

- **What happens:** Who asked is typed on New quote and added to the client's contacts, and a line goes into the job's notes. The printed quote and the PDF both print the client's first contact, whoever that is. For a company client with several people, the quote is "For" someone who didn't ask.
- **What it costs:** The client's person gets a quote addressed to a colleague, or the office edits contacts before printing. 80% of quotes are for repeat clients, the kind with several contacts.
- **Fix:** The quote keeps who it's for (a contact), set from Who asked and changeable on the draft; both renderers print that one.
- **Where it is decided:** `web/src/jobs/QuoteSheet.tsx:173`, `server/src/finance/quote-pdf.ts:124`, `web/src/jobs/Money.tsx:358`

#### 7. The day a quote is wanted by is out of sight until it's late, and drafts are listed last, by when they last changed

**P2, severity 3** · 1 Visibility of system status; behavioural "Time" (Time Scarcity: a near deadline must be seen before it passes) · Quotes page, Home, the job's tasks · Seen: desk · Reproduced

- **What happens:** "Quote wanted by" on New quote becomes the due day of the job's Quote sent task. That task has nobody on it, and a task shows as late only once its day has passed. On the Quotes page, drafts sit in "Not sent yet", the last group, ordered by days since they were saved, with no due day shown. Home's office view doesn't count quotes due today. Drafts for jobs whose days have passed stay in "Not sent yet" too.
- **What it costs:** With a median three days from enquiry to show, and 44% within two, the quote that matters today is found by memory. The one place the day is kept tells nobody until it's too late.
- **Fix:** Order "Not sent yet" by the day wanted (then the job's first day), show the day on each row ("wanted today", "wanted Tue"), lead the Quotes page with what's due today, and count it on Home. A draft for a job that's over moves to a closed group. Whoever starts the quote is on its task.
- **Where it is decided:** `shared/src/sync/money-view.ts` (`quotesToFollow`), `web/src/jobs/Money.tsx:262`, `shared/src/sync/steps-view.ts`
- **Screenshots:** `25-quotes-with-drafts-desk.png`, `26-home-office-desk.png`

#### 8. Crew on a confirmed quote don't become crew calls: Next says "Ask for the crew" and they are typed again

**P2, severity 2** · 7 Flexibility and efficiency; 6 Recognition rather than recall · Confirm the job, Crew tab · Reproduced

- **What happens:** "Sound No.1 × 2 for 2 days" on the quote is just a line. After Confirm the job, the Crew tab is empty and Next says to ask for the crew. There is no "from the quote" for crew as there is for kit.
- **What it costs:** Every confirmed job with crew (448 of the RMS quotes) has the roles and counts typed again, and a difference between the quote and the calls is found only by reading both.
- **Fix:** Crew lines are the job's crew calls, open, from the moment they're on the quote, made firm on confirming; or at the least, a "Make the calls from the quote" press on Crew, as Kit has.
- **Where it is decided:** `web/src/jobs/NextDock.tsx` (crew case), `web/src/jobs/Kit.tsx` (FromQuote, kit only)
- **Screenshots:** `21-job-crew-desk.png`, `21-job-crew-phone.png`

#### 9. Kit and crew added on a draft are charged for every day of the job's span, gaps included

**P2, severity 2** · 2 Match with the real world; 5 Error prevention · Add kit, Add crew · Inferred from the code, seen on a two-day job

- **What happens:** A new line's days are every day from the job's first to its last. A job with a build on Friday and a show the next Friday is charged eight days for each crew line, and eight days out for each kit line's rule.
- **What it costs:** The office corrects the days on every line, or the client is over-quoted. Rate rules soften it for kit (a week is a week), not for crew.
- **Fix:** Take a line's days from the job's phases: crew for the days they work (build, show, derig), kit for the days it's out. "Charge all kit for the same days" already exists for the rest.
- **Where it is decided:** `web/src/jobs/QuoteDraft.tsx:143` (`jobDays`), `:391`, `:506`

#### 10. New quote always makes a show with a Show phase, crew task and travel; a dry hire can't be quoted as one

**P2, severity 2** · 2 Match with the real world; 8 Aesthetic and minimalist design · New quote, the draft · Reproduced

- **What happens:** New quote makes a job of kind gig with a Show phase. A dry hire (no venue, no crew, collected and returned) gets the travel and subsistence rows, "No travel: the venue isn't on the map" and a crew step it will never need. The app has a hire kind; New quote can't choose it. In the RMS history 40 quotes are named dry hire and only 22 of 1,072 name a venue at all; a quarter of quotes are under €505.
- **What it costs:** The small, quick quotes take the same form as a festival, and the check before it goes asks about travel on them.
- **Fix:** A choice at the top of New quote, "Show" or "Dry hire": dry hire asks for collect and return days instead of a venue, and leaves out crew, travel and the Show phase.
- **Where it is decided:** `web/src/jobs/Money.tsx:360-363`, `shared/src/jobs.ts` (`PROJECT_KINDS`)

#### 11. Lines are grouped only by department and can't be put in order, where the office groups by place and by cables and power

**P2, severity 2** · 2 Match with the real world; 3 User control and freedom · Draft, printed quote · Reproduced

- **What happens:** Each kit line's group is its product's department (Audio, Lighting…), crew go under Crew, the rest under Transport or nothing. Lines can't be moved, and a group can't be named. In the RMS history the office groups by part or place ("FOH", "Monitors", a stage) and by cables, power and rigging, median three groups a quote, and 28% of its lines are headings and words.
- **What it costs:** The quote the client gets doesn't read the way the office has always written it, so the office keeps a second way of writing quotes for the big jobs.
- **Fix:** A group is a heading the office types or picks (with the department as the default), lines move between and within groups (drag on desk, Move up and down on the line's editor on a phone), and a line can be words only.
- **Where it is decided:** `web/src/jobs/QuoteDraft.tsx` (`addKit` sets `group` from the department); `shared/src/quotes.ts` (line `group`)

#### 12. Packages are a separate plain list of 41, away from the kit search

**P2, severity 2** · 6 Recognition rather than recall; 4 Consistency · Add a package · Reproduced

- **What happens:** Add a package opens a native select of all 41 starter packages in name order. It can't be searched, it doesn't say what's in each or what it costs beyond a few names that carry a price, and typing "Axient" in Add kit doesn't find "Axient radio mics, 4".
- **What it costs:** The office has to know there's a package before looking for it, so packages are used less than the 41 found in the history suggest they could be.
- **Fix:** Packages and racks are found in the same Add kit search as products, marked as a package with what they hold and their price.
- **Where it is decided:** `web/src/jobs/QuoteAdd.tsx` (`AddPackage`)
- **Screenshots:** `33-add-package-phone.png`

#### 13. One unfinished line, such as an empty "something else", stops every other change on the draft saving

**P2, severity 2** · principles rule 11 ("never lose the crew's work"); 9 Recover from errors · Draft · Reproduced

- **What happens:** "Add something else" adds a line with nothing in What. Until it's filled or removed, the whole draft is "Not saved yet: line 12 isn't finished", and every other change, on every line, waits on the device (kept in the tab, not sent). A second person on the draft sees none of it.
- **What it costs:** Leave the draft with one half-made line and the morning's work is on one tab of one device.
- **Fix:** Save every line that's whole and hold back only the unfinished one, which stays open with its fault beside it.
- **Where it is decided:** `web/src/jobs/QuoteDraft.tsx:972`, `web/src/jobs/lineDraft.ts:98`

#### 14. After Mark as sent the red button is "Client accepted", while the office's next step is to print it; the numbered PDF exists only after marking sent

**P2, severity 2** · 1 Visibility of system status; principles rule 10 · Send, the sent quote · Reproduced

- **What happens:** With email off (as in live), the hint says "Marked sent, it becomes quote 4… Print it as a PDF and send it yourself". So the office marks it sent before the client has it, and then the page's one red button is "Client accepted"; Print is a plain button lower down. "Print a draft" before that prints with no number.
- **What it costs:** The order is backwards from what the person is doing: they must say it's sent in order to get the thing they then send. Easy to mark sent and forget to send.
- **Fix:** One press "Get the PDF to send" that numbers the quote and opens the PDF, then asks "Sent it?" with Mark as sent as the primary. After that, Client accepted.
- **Where it is decided:** `web/src/jobs/QuoteDraft.tsx:1040-1063`, `web/src/jobs/Quote.tsx` (the sent view's primary), `web/src/jobs/QuoteRecords.tsx` (`nextRecord`)
- **Screenshots:** `17-sent-desk.png`, `17-sent-phone.png`

#### 15. On a phone a festival-sized draft is eight screens with no group folded, and the picker has room for about two options above the keyboard

**P2, severity 2** · 8 Aesthetic and minimalist design; principles (phone first for the office on the move) · Draft on a phone · Seen: phone 390×844, CPU 4× · Reproduced (the keyboard's room inferred from the layout)

- **What happens:** A 48-line draft (one quote in ten is this long) is 6,927 px on a phone, about eight screens, against 4,384 px at a desk. Groups can't be folded. A keystroke still paints in 42 to 55 ms at four times slower, and opening a line takes 232 ms: speed holds up, length doesn't. With the sticky readout at the top and the bottom bar, the picker's list is drawn under the keyboard with room for about two options.
- **What it costs:** Checking a big quote on a phone means scrolling past lines already checked; adding kit on a phone means typing blind past the second result.
- **Fix:** Fold each group to its title and total, open by a tap; while the picker is open on a phone, hide the bottom bar and let the readout shrink to one line.
- **Where it is decided:** `web/src/jobs/QuoteDraft.tsx` (groups, readout), `web/src/RecordPicker.tsx`
- **Screenshots:** `27-big-draft-phone-4x.png`, `24-picker-shure-phone.png`, `12-picker-5-phone.png`

#### 16. The printed quote and its PDF carry no logo, and are drawn by two different pieces of code

**P2, severity 2** · principles rule 15 ("help them look good") · Printed quote, PDF · Reproduced

- **What happens:** Both say "Session Hire" in bold type where a logo goes; the company's logo, uploaded for labels (ADR 0106), isn't used. The quote on screen and printed from the browser is drawn by one renderer; the emailed PDF by another on the server. They agree today, by care.
- **What it costs:** The quote is the one thing every client sees, and it looks less finished than the cable labels. Each change to the quote's layout has to be made twice.
- **Fix:** Put the logo on both; then draw the quote once (the server's PDF) and show that as the preview and the print.
- **Where it is decided:** `web/src/jobs/QuoteSheet.tsx:180`, `server/src/finance/quote-pdf.ts:98`
- **Screenshots:** `22-printed-quote-1.png`, `22-printed-quote.pdf`

#### 17. Past jobs are offered only on an exact client or venue name, and never from the Current RMS history where four in five clients already are

**P2, severity 2** · 6 Recognition rather than recall; 7 Flexibility · New quote, Start from a past job · Read from the code

- **What happens:** "Start from a past job" appears once the client or venue matches a known one exactly, and offers this app's own jobs. The 1,072 RMS quotes are reachable only one at a time from Quotes › From Current RMS.
- **What it costs:** 80% of quotes are for repeat clients; for the next year most of their history is in RMS, so the quickest start the app offers is rarely there.
- **Fix:** One "Start from" search on New quote across this app's jobs and RMS quotes, by client, venue or name, with the client's last three first.
- **Where it is decided:** `web/src/jobs/PastJobs.tsx`, `shared/src/past-job.ts`

### P3: polish

#### 18. "Accepted already, by phone?" records a yes without the check before it goes

**P3, severity 2** · 5 Error prevention · Draft › Send · Read from the code, seen on the page

- **What happens:** From a draft, "Accepted already, by phone?" then "Record it as accepted" numbers the quote and records the yes, skipping the list of unpriced lines and short kit that Mark as sent asks about.
- **What it costs:** The one path where the client has already said yes is the one with no last look, and it's the quote that becomes the invoice.
- **Fix:** Run the same check before recording it.
- **Where it is decided:** `web/src/jobs/QuoteDraft.tsx:1050-1055`

#### 19. Own kit counts as costing nothing, so the margin reads high and every quote has a "no cost yet" chip

**P3, severity 1** · 2 Match with the real world · Draft readout · Reproduced

- **What happens:** "Expected margin €1,366 51.6%" with a chip "1 line with no cost yet". Kit the company owns is counted as costing nothing, so a quote of own kit reads 100%. The quoting research ranked this as feature 11; it isn't built.
- **Fix:** As the research says: own kit's cost as a set share of its price, or the margin shown only for hired-in kit and crew.
- **Where it is decided:** `shared/src/quotes.ts` (margin)

#### 20. A quote marked sent with no signal shows a guessed number, which a PDF printed then carries even if the server gives another

**P3, severity 1** · 1 Visibility of system status · Mark as sent offline · Reproduced offline; the clash inferred

- **What happens:** Offline, Mark as sent works and shows "Saved on this device". The quote shows the next number the device expects. If another person numbered a quote meanwhile, the server gives this one the next, and a PDF printed while offline carries the wrong one.
- **Fix:** While the number isn't confirmed, show it as "quote 1043 (once it's saved)" and print "Draft" on the PDF until it is.
- **Where it is decided:** `shared/src/sync/money-view.ts` (optimistic numbering)
- **Screenshots:** `29-offline-sent-phone.png`, `30-back-online-phone.png`

#### 21. Small wording and listing slips

**P3, severity 1** · 4 Consistency · Reproduced

- "No subsistence" says "No per diem set yet: set it in Admin › Company › Travel and subsistence" twice, once as the line and once as a link under it (`15-draft-lines-desk.png`).
- "Quote wanted by (optional)" wraps onto two lines at a desk, out of line with its row (`10-new-quote-desk.png`).
- The picker matches inside words: "1 das" offers Midas consoles.

## How the office person gets on

**At a desk, on a normal day,** the office person can write a seventeen-line
quote for a known client in about five minutes, mostly typing product
names. The app is quick enough that speed is never the problem. What takes
the time is checking: reading each line back for a quantity that didn't
take (2), days that crossed a gap (9), free lines that look like mistakes
(1), and then a total that has to be trusted. The check before it goes
helps, but it's diluted by the free lines.

**On a phone, between jobs,** a small quote is comfortable: New quote fits
in about one screen, adding kit works one-handed with the
picker staying open. A big quote is eight screens, and the picker is
cramped above the keyboard (15). Offline works throughout.

**On a busy morning,** with three quotes due and one job tomorrow, the app
doesn't say which quote is due first (7), and confirming tomorrow's job
leaves its kit list and crew empty (4, 8).

**For a director checking a quote,** the readout, margin and totals are
right and agree with the PDF. The margin reads high (19), and the quote has
no logo (16).

## Earlier findings, re-checked

| From | Finding | Now |
|---|---|---|
| 5 Nov, 21 | A client typed one letter off becomes a new one | Partly fixed by type-to-search (#263): a known name is offered. Come back as finding 3: a part-typed name left by Tab or the first arrow still becomes new |
| 5 Nov, 23 | Daily to Weekly keeps the day price as a week's | Fixed: the line warns that its price was for a day |
| 5 Nov, 26 | An unpriced line can be sent at €0.00 | Fixed by the check before it goes (#255), which now fires on most quotes (finding 1) |
| 5 Nov, 58 | Three presses a kit line | Fixed: the picker stays open, and "12 y10" adds twelve, except as in finding 2 |
| Research, 11 | Margin on own kit | Not built (finding 19) |
| Research, 9, 10, 12 to 15 | Product companions, price list moved, parts on New quote, options, how quoting is going, online accept | Not built; options and online accept are in the from-scratch section |

## The order to fix things

A suggestion, in batches that each make one PR.

1. **Say what the office means.** Findings 1 (Included), 2 (the count),
   3 (part names). Small, and they make every quote more trustworthy. Do
   these first.
2. **The quote is the job's plan.** Findings 4, 8 and 9: the quote's kit on
   the kit list as pencilled, its crew as open calls, days from the phases.
   One ADR. The biggest gain, and the start of the from-scratch idea.
3. **Due today.** Finding 7, with 14 (Get the PDF to send) and 18.
4. **Write it the way the company writes quotes.** Findings 11 (groups and
   order), 6 (who it's for), 16 (the logo), 10 (dry hire).
5. **Fewer places to look.** Findings 12 and 17: one search for products,
   packages and racks, and one for where to start from.
6. **Before email is switched on:** finding 5.
7. The rest: 13, 15, 19, 20, 21.

Batch 1 is worth doing before the next busy week.

## If we built quoting again from scratch

Colly asked what would be different. Knowing what the history shows (a
known client, a show three days away, seventeen lines in three groups, some
free, charged by the week) and having watched the office fill one in, here
is what quoting would be if it were drawn again today, and how close the
app is.

### 1. The quote is the job's plan, not a document about the job

Today the quote is a list of priced lines that sits beside the job's kit
list and crew calls, and three paths copy between them (New quote's
suggestions, a past job, the Kit tab's "Add all"). From scratch, there
would be **one set of lines**: each kit line is the job's kit, pencilled
while it's quoted, held when confirmed; each crew line is a call, open
until people are asked; each line knows its days from the job's phases.
The price is a property of the line, not a second copy of it. A sent
version is a snapshot of those lines.

What it removes: findings 4, 8 and 9, the Kit tab's "From the quote"
reconciling, the "Add the kit" and "Ask for the crew" steps after
confirming, and the risk of two quotes promising the same kit. It's also
what Current RMS does with its opportunities, which is how the office
already thinks.

### 2. Start from who, not from a blank form

80% of quotes are for a known client. From scratch, New quote's first
field is the client, and choosing one shows their last few jobs and quotes
(this app's and RMS's alike) with "Start from this" beside each. A blank
quote is the exception, not the default. The person who asked is the
quote's contact from that moment (finding 6), and their usual discount and
terms come with them, as today.

### 3. One box to add anything

Today there are five Add buttons (kit, crew, transport, something else,
package) and a select. From scratch, there is **one Add box** on the quote
that finds products, packages, racks, crew roles, transport and the
client's past lines, and takes "2 × D20", "4 yp10" or "No.1 × 2" with the
count shown before Enter (finding 2). Words-only lines and headings are
typed into the same box ("# Monitors"). The five buttons remain as
shortcuts for people who browse.

### 4. Lines the way the office writes them

Each line has one of three prices: **a price, Included, or not priced
yet** (finding 1). Groups are headings the office names, in the order it
wants, by place or by kind (finding 11). Options ("add a second desk for
€X") are lines the client can tick, priced but not counted in the total
until taken, which the research (feature 13) found the office does by hand.

### 5. Time first

With a median of three days, the due day is the most important fact about
a draft. From scratch, the Quotes page opens on **Due today and tomorrow**,
each draft says who's writing it and when it's wanted (finding 7), and
Home counts it. A draft past its show date closes itself.

### 6. Two shapes of quote

A **dry hire** (collect, return, a deposit, no crew, no venue) is a
different, shorter form from a **show** (phases, venue, crew, travel). The
form asks first and shows only what that shape needs (finding 10). About a
quarter of quotes are small enough to be done in under a minute this way.

### 7. Sending is one act, and the client can answer online

Number, PDF, send (email or print), record: **one step that either all
happens or none of it does** (findings 5, 14, 20). One renderer, the
server's PDF, with the logo, shown as the preview (finding 16). At launch,
behind its switch, the client gets a link to the quote where they can
accept, ask for a change, or tick options; their answer records itself
(research feature 15).

### 8. Save each line, not the whole draft

Lines are saved one by one, so a half-finished line holds back only
itself (finding 13), and two people on one draft never meet a merge at
all, because they're changing different lines. The merge built in ADR
0113 becomes the exception path.

### What would stay the same

The things that work and would be drawn the same: offline first with the
quiet "Saved on this device"; the price, rule and free count in the
picker; rate rules as the price list has them; the client's usual
discount put on by itself; packages as a shortcut for their kit, folded on
screen and itemised on paper; the check before it goes, narrowed to what
really needs a look; turn-down reasons; the numbers agreeing everywhere.

### Rebuild or move towards it?

Not a rebuild. The data model already has most of what's needed: a quote's
lines carry their product, days, rule and package; the job has phases,
kit lines and calls. The from-scratch shape is reachable in the batches
above: batch 1 is section 4's three prices and section 3's count; batch 2
is section 1; batch 3 is section 5; batch 4 is sections 2, 4 and 6; batch
5 is section 3's one box; sections 7 and 8 come with email and online
accept at launch. The one decision that changes the model is section 1
(pencilled kit from the draft), which wants its own ADR and Colly's yes.

## Questions for Colly

1. **Free lines:** on the printed quote, should a free line say
   "Included", "No charge", or show €0.00 as Current RMS did?
2. **Pencilling:** should kit on a draft hold the kit softly (others see it
   as pencilled) from the moment it's added, or only once the quote is
   sent?
3. **Groups:** should the default group be the department (as now) or a
   heading the office types, as on RMS?
4. **Who it's for:** is the person who asked always the person the quote is
   addressed to?
5. **Dry hire:** what does a dry hire quote need that a show's doesn't
   (collection and return times, a deposit, ID)?
6. **The logo:** use the one uploaded for labels on the quote too?

## What held up

- **Speed.** Starting a quote 113 ms (73 ms offline); about 70 ms a kit
  pick; a keystroke on a 48-line draft paints in 10 to 17 ms at a desk and
  42 to 55 ms on a phone at four times slower. No step in the walk waited
  on the network.
- **Offline.** New quote, every line, terms and Mark as sent work with no
  signal, say "Saved on this device" and "No signal · N waiting", and go up
  within a second of the signal returning (`28-offline-draft-phone.png` to
  `30-back-online-phone.png`).
- **The picker.** Stays open with the cursor in it; says each product's
  price, rule and how many are free on the job's days; "12 y10" adds twelve
  when the name has no digits to confuse it.
- **The client's discount** is put on by itself and said ("Brightwater
  Conferences usually gets 10% off").
- **Two people on one draft** keep both their changes (ADR 0113).
- **Totals agree** on the draft, the readout, the printed quote, the PDF,
  the Quotes page, Money and Home, VAT rates split right under an agreed
  total.
- **The check before it goes** catches unpriced lines, short kit, missing
  travel and a first day already gone, and each item opens the line it's
  about.
- **Turn-down reasons** and notes are kept on the quote and in history.
- **Packages** fold on screen and print itemised; a package's price shows
  as a discount from its items' total.
- **Rate rules** follow the price list, and a line that switches rule says
  what happens to its price.
