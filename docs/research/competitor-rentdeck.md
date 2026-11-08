# Rentdeck, set beside Session Hire's app

Research date: 8 November 2026, asked for by Colly ("Can you do a competitor
analysis against https://rentdeck.eu/en/?"). An assessment only: nothing is
built from it. The app is at 1.118.0. It sits beside the wider
[competitor audit](competitor-audit.md) of September, which covered Rentman,
TeamTrack, Current RMS, Flex, HireHop and easyjob.

## How this was done

- **Read:** Rentdeck's English site (rentdeck.eu/en), its `llms.txt`, its AV
  hire page, its terms and conditions (version April 2026), and its wiki
  (rentdeck.eu/wiki, every English article: 25 pages from first login to
  keyboard shortcuts). Capterra lists it but refused to be read (HTTP 403);
  a search snippet says it is aimed at teams of one to five people still on
  Excel or calendars.
- **Not done:** no trial account was opened. Their trial asks for an email
  and sign-up, which is outside an assessment. Everything below about the
  app comes from Rentdeck's own words and the screenshots on its site, so
  it is what they say it does, not what was seen working.
- **Screenshots** of their site are in the project folder under
  `screens/rentdeck/`.

## In one paragraph

**Rentdeck is not a competitor for Session Hire itself; it is a competitor
for what Session Hire's app might one day be for other people.** It is a
very young (terms dated April 2026, wiki June 2026, no customers named), one-founder product at €9.95 a month for one
user, selling to freelancers and small hire firms leaving Excel and
WhatsApp. It covers the straight line *customer → quote → approved → pick
list → invoice → archive* cleanly, and does three things this app does not:
**invoices, a drag-and-drop template builder for its paperwork, and the
client signing a quote online.** On everything that makes Session Hire's work
hard (freelance crew, calendars, offline warehouse scanning, racks, kit that
is serialised and tested, a job with many people and phases) it is thin or
silent. The ideas worth taking are small and mostly about paperwork and
polish, not structure.

## Who they are

| | |
|---|---|
| **Company** | Foneg B.V., Harmelen, Netherlands (KvK 99741393). Founder Fons van Egmond, "over 20 years in rental and events". |
| **Age** | New: terms "Version: April 2026"; wiki "Last updated: June 2026"; a mobile app "in development". No customers, logos or reviews are named anywhere on the site. |
| **Who it is for** | "Freelancers and small rental businesses" that "replace Excel, lists and WhatsApp". 13 use-case pages: bouncy castles, AV, marquees, tools, bikes, party, furniture, IT, sport, care equipment, machinery, clothing, charities. |
| **Mixed signals** | The wiki's intro says it was "built specifically for rental companies in the construction and infrastructure industry" (scaffolding, cabins, fencing), while the screenshot of the product list on the home page shows an AV catalogue (Line Array, Licht, Rigging, Kabels, Video, Camera). It looks like a construction-hire start that was widened to everyone. |
| **Price** | €9.95/month or €99/year, **one user**, all features, email support, 14-day trial with no card. "For more users, get in touch." Payments through Mollie/Stripe. |
| **Where data lives** | "Hosted in Europe", GDPR, Rentdeck acts as processor; uptime target 99.5% a month. The customer owns their data and "may export" it on leaving; deleted after 30 days. |
| **AI** | An assistant called Erik in the corner of every screen answering how-to questions, plus "XLSX import and offer layout assistance" through the Claude API (Anthropic named as sub-processor). |
| **Languages** | The app and wiki in ten languages (NL, EN, DE, FR, ES, IT, PT, PL, DA, SV); the site in 15 regional versions. |

## What Rentdeck has, by its own documentation

- **Dashboard:** counts of active rentals, customers and products free;
  recent quotes; upcoming projects.
- **Customers:** contact, company, payment term (14 or 30 days), invoicing
  address; history of quotes, rentals and invoices; **import from Excel with
  a downloadable template**.
- **Products:** in product groups, a price per day, week or month, a stock
  count, a photo, serial numbers (site), import from Excel. Availability
  counted automatically; "overlapping quotes trigger a warning".
- **Quotes:** customer, project name, start and end date, products with
  quantities, location, transport and discounts, sections. States Draft,
  Sent, Approved, Rejected. PDF preview and send by email from the app.
  **Approved makes the pick list and lets you make the invoice.**
- **Calendar:** three views (calendar, a timeline per project, a timeline
  per product "for spotting double bookings"); day, week, month; **click a
  day to start a quote for that date**.
- **Invoices:** from an approved quote in one press or by hand; Draft, Sent,
  Paid, Overdue; credit notes; VAT and KvK numbers printed from Company
  settings. Payments marked paid by hand; Moneybird link "in development".
- **Warehouse:** a pick list per approved rental, lines ticked off, filtered
  by today, this week or a project; "print it or show it on a tablet". No
  scanning is mentioned anywhere.
- **Staff:** shifts with a date, time and role (Driver, Technician,
  Foreman), assigned now or later; a "To be scheduled" tab; internal
  projects for work with no quote (warehouse days, maintenance). Staff are
  the firm's own team; there is no outside freelancer, offer or answer.
- **Archive:** a finished project leaves the active lists, can be searched
  and restored.
- **Settings:** company details and logo; **a drag-and-drop template
  builder** for the quote, packing slip, invoice, credit note and call sheet
  (text, image, letterhead, table, columns, signature, **a Sign button for
  the client to sign online**), with templates exported and imported as
  JSON; product groups; **saved locations** with an on-site contact;
  **transport priced from the depot by kilometre with tiered discounts**;
  team invites; four roles (Admin, Sales hero, Warehouse, Read only);
  a changelog that is really an audit log of who changed what, kept 12
  months.
- **Help:** Erik the assistant; keyboard shortcuts (`g d` dashboard, `n q`
  new quote, `/` search, `?` the list).
- **Not mentioned anywhere:** an API or webhooks, Google or any calendar
  link, a native or offline app, scanning or labels, testing (PAT) or
  faults and repairs, sub-hire, packages or kits beyond "link items to
  sets", crew outside the company, timesheets, documents or certificates,
  more than one warehouse, multi-day phases on a job.

## Side by side

**Ahead** means clearly further along for what Session Hire does. Rentdeck's
column is what its documentation claims.

| Area | Rentdeck | Session Hire's app | Who is ahead |
|---|---|---|---|
| **Who it serves** | One person's hire business; one user in the price | A crewed production and hire company: office, heads of department, staff crew, 100+ freelancers, each by role (ADRs 0034, 0051) | Different jobs |
| **Jobs** | A quote is the project: one start and end date, a location | Jobs with days, kinds and parts; five stages with tasks and one Next button (ADR 0104); a Board; history | **Session Hire** |
| **Calendar** | Its own calendar, three views, click a day to quote | Two-way Google Calendar on the real company calendars (ADR 0008), calendars brought in (ADR 0011), personal feeds (0012), freelancers' own calendars read (0044), planner by job and person (0010) | **Session Hire** |
| **Stock** | Groups, day/week/month price, count, serials, photo, Excel import | Catalogue, numbered items and bulk, places and racks, labels with QR and logo, cable labels, stocktakes, certificates, trackers, photos, aliases (ADRs 0013, 0015, 0030, 0074-0079, 0083, 0094, 0095, 0107) | **Session Hire** |
| **Availability** | Counted, a warning on overlap | Counted per day with shortage and sub-hire on the quote and the job (ADRs 0031, 0089) | **Session Hire** |
| **Warehouse** | A tick-off pick list, printed or on a tablet | Pick lists scanned out and in on the phone, offline; faults, repairs, PAT tests; picking on the phone (ADRs 0016-0018, 0020, 0072) | **Session Hire** |
| **Quotes** | Sections, discounts, transport, PDF, email, Draft/Sent/Approved/Rejected | Rate rules and discounts, packages and starter packages, travel and subsistence, margin, availability, follow-up, two people on one draft, start from a past job or a Current RMS quote, Claude drafting from the mailbox, sending by email (ADRs 0080-0089, 0098, 0101, 0113, 0115-0117) | **Session Hire** |
| **Client signs online** | Yes, a Sign button on the quote | Not yet: on the quoting research list as "the client accepts online", at launch behind a switch | **Rentdeck** |
| **Paperwork layout** | Drag-and-drop template builder for five documents; letterhead; JSON export | A fixed printed quote and call sheet in the company's look (ADRs 0021, 0084) | **Rentdeck** (on flexibility) |
| **Invoices** | From the quote in one press; Paid/Overdue; credit notes | None: paused by Colly until the company's own invoicing is known | **Rentdeck** |
| **Customers** | Contacts, payment terms, history, Excel import | Client and venue pages with documents and history (ADR 0032); type-to-search names with "Add as new"; no payment terms field | Even; Rentdeck has payment terms and an import template |
| **Locations** | Saved locations, an on-site contact, used to price transport | Venues with maps, documents, access notes (ADRs 0032, 0057); travel worked out by straight-line km with the office able to type the real distance (0086) | Even; Rentdeck's on-site contact is a small extra |
| **Crew** | The firm's staff, shifts by role, "to be scheduled" | Freelancer-first: offers by link with no login, counter-offers, certificates a call needs, running late, documents with expiry, leave, timesheets, call sheets, departments (ADRs 0002, 0009, 0021-0029, 0046, 0111, 0114) | **Session Hire**, by a long way |
| **Phone and offline** | "Works in any modern mobile browser", app in development | Built offline-first with its own sync (ADR 0001), phone layout first, native warehouse app under way | **Session Hire** |
| **Audit trail** | A changelog of who changed what, 12 months | History of every change and Download everything (ADR 0006) | **Session Hire** |
| **Roles** | Four fixed roles, custom roles "in future versions" | Five roles by job, reading narrowed by role and held back by the server (ADRs 0034, 0062, PR #103) | **Session Hire** |
| **Openness** | Excel export of customers, products, quotes; a full export by asking support; no API | Download everything, Current RMS read through its API, iCal feeds; a public API is still a principle more than a feature | Session Hire, though neither has a public API yet |
| **AI** | Erik answers how-to questions; Claude helps import spreadsheets and lay out offers | Claude inside the app: an enquiry to a quote, Ask Claude about the data, a to-do list, reading operations@ (ADRs 0096-0098), off until switched on | **Session Hire** |
| **Getting going** | Demo data to remove, Excel templates, a 25-page wiki in ten languages | Made-up data and starting fresh (ADR 0019), bringing lists in, "On this screen" help, the blueprint | Rentdeck on outside help pages and languages |
| **Keyboard** | Shortcuts for going and making things | None to speak of | **Rentdeck** |
| **Price** | €9.95 a month, one user | Built in-house: no licence, the cost is hosting and the build | Not comparable |

## Where Rentdeck is ahead

1. **Invoices and credit notes**, straight from an approved quote, with Paid
   and Overdue. This is the one real gap, and it is paused on purpose: Colly
   has said invoicing waits until the company's present way is known.
   Rentdeck's shape (one press from the quote, money states, credit notes,
   and accounting links "in development" rather than built) is a sensible
   floor whenever it starts.
2. **The client signs the quote online.** A Sign button on the quote's
   template. Session Hire's quoting research already lists it, held back
   until the app may contact people at launch.
3. **Paperwork the office can redraw itself.** A drag-and-drop builder for
   the quote, packing slip, invoice, credit note and call sheet, with a
   letterhead and a signature block. Session Hire's printed pages are good
   and fixed; changing them needs a build.
4. **Small speed-ups:** keyboard shortcuts; click a day in the calendar to
   start a quote on that date; a customer's payment terms; a saved location
   with its on-site contact; an Excel import template to fill in.
5. **Help outside the app in ten languages**, and a how-to assistant always
   in the corner. Session Hire has one company and one language, so only
   the assistant part matters here.

## Where Session Hire's app is ahead

Almost everything that makes event production hard:

- **Freelance crew as people, not shifts.** Offers that reach a freelancer
  without an account, their own calendar read, counter-offers, documents
  and certificates, running late, timesheets, call sheets. Rentdeck has
  shifts filled by the firm's own team and nothing for outside crew.
- **The real calendar.** Two-way with Google on the calendars the company
  already lives in. Rentdeck has its own calendar and no link out.
- **A job shaped like a show:** days, parts, stages and tasks, the Next
  button, the Board, vans and drivers, the Crewbox show pack.
- **The warehouse as a place:** labels, scanning out and in on a phone with
  no signal, faults and repairs, PAT tests, stocktakes, racks built and
  drawn, trackers on expensive kit. Rentdeck's warehouse is a list you tick.
- **Quoting depth:** rate rules, packages, sub-hire and margin, travel and
  subsistence, two people on one draft, starting from a past job, Claude
  turning an email into a draft.
- **Openness and safety:** history of every change, download everything,
  reading held back by role on the server, backups and alerts.

## Ideas worth taking

Ranked by what they would save against what they would cost. None is built;
each is for Colly to pick.

| # | Idea | Why | Size | Notes |
|---|---|---|---|---|
| 1 | **The client accepts the quote online** (a typed name, or a drawn signature) | Saves the "did they say yes?" chase and gives a dated record of what was agreed | M | Already on the quoting research list as item 15. Waits on the launch switch for contacting people. Rentdeck shows small firms now expect it. |
| 2 | **When invoicing starts, start where Rentdeck does:** one press from the confirmed quote, Draft/Sent/Paid/Overdue, credit notes, a register for the accountant | A known-good floor, no accounting link needed on day one | L | Paused. Recorded so it is ready when Colly reports how the company invoices today. |
| 3 | **Payment terms on a client** (14, 30, on the day) printed on the quote | Small, and needed before invoices anyway | S | A client field and a line on the printed quote. |
| 4 | **An on-site contact on a venue**, picked onto the job and the call sheet | Crew ring the right person on the day | S | A venue's contacts go in its notes today (ADR 0032 lists this as open); this is one named field the call sheet can print. |
| 5 | **Start a quote from a day on the planner** | One fewer step when the office is looking at the week | S | The planner has no way to start anything from a day today; "New quote on this day" would carry the date into New quote. |
| 6 | **Keyboard shortcuts at a desk** (`/` find, `n q` new quote, `g j` jobs, `?` the list) | The office at a desk does the same few things all day | S | Desk only, and the design system's keys come first. Never on a phone. |
| 7 | **The office edits the printed quote's words and blocks** (intro, terms, which parts show) without a build | The paperwork changes more often than the code | M | Not a full drag-and-drop builder: a few named blocks the office can switch and word. Keeps the company look. |
| 8 | **An import template to fill in** (download, fill, bring back) for clients and stock | Makes bringing a list in predictable | S | The app already brings lists in, matching columns by their header names (ADR 0025); a blank file with those headers is the missing piece. |

**Not worth taking:** fixed shift-by-role crew planning (Session Hire's
offers to named people are further along and freelancer-first); a separate
in-app "changelog" (History already covers it); ten languages; a tick-only
pick list.

## What this says about positioning

- Rentdeck's pitch is "between Excel and the heavy systems", which is close
  to Session Hire's own reason for building: Rentman and TeamTrack felt
  closed, inflexible and company-centred. The difference is that Rentdeck
  solves it by **doing less**, and Session Hire by **doing what the work
  actually needs and staying open**. For a one-person bouncy castle or
  camera hire, Rentdeck's is the right answer. For a company sending a
  crewed show out with racks, PAT-tested kit and twenty freelancers, it is
  not yet close.
- If Session Hire's app were ever offered to other companies, Rentdeck sets
  the floor on price (€9.95, one user) and on the basics a buyer expects to
  see on day one: invoices, online signing, and paperwork in their own
  name. The app would compete on crew and the warehouse, not on price.
- Rentdeck is worth checking again in six months: a native app, Moneybird,
  custom roles and more users are all "in development" or "in future
  versions".

## Questions for Colly

1. Should the client accepting online move up, and is a typed name enough
   or does it need a drawn signature?
2. Does the office need to change the printed quote's wording or blocks
   often enough to make idea 7 worth it?
3. Any of ideas 3 to 6 and 8 to build now? Each is a day or two.
4. Is Rentdeck a name that came up from crew or clients, or just seen? If
   someone in the company is looking at it for a side business, a trial
   account would let us check its claims.

## Sources

- Rentdeck home page (English): <https://rentdeck.eu/en/>
- Rentdeck AV hire page: <https://rentdeck.eu/en/rental-software/av-hire/>
- Rentdeck AI summary: <https://rentdeck.eu/llms.txt>
- Rentdeck wiki (content read from its data file, English):
  <https://rentdeck.eu/wiki/>
- Rentdeck terms and conditions, version April 2026:
  <https://rentdeck.eu/legal/En/terms-and-conditions-en.pdf>
- Capterra listing (not readable, snippet only):
  <https://www.capterra.com/p/10040392/Rentdeck/>
