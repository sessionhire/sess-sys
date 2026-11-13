# User flows, 13 November 2026: every route through a job, and where it breaks

Colly asked for a flow chart of the common tasks from beginning to end,
every route each kind of person can take, with broken flows and flows
that need work flagged. This is that map, built from the code on main at
version 1.188.0 and walked on a local copy with made-up data as the
office, a head of department, the warehouse, staff crew and a freelancer
on their link. Nothing was sent, offered or written anywhere real. The
charts themselves are section 03 of the Blueprint; this page holds the
same routes in words and the list of what was fixed. All ten broken or
weak routes were fixed in version 1.192.0 the same day (PR #379), and
Amend quote at the client's answer is built (1.189.0).

Letters say who does each step: D Director, O Office, H Head of dept, W Warehouse, S Staff crew, F Freelancer, C Client, A The app.
A step that isn't marked works. *Switched off on live* means a switch
cuts the route short on purpose until launch; it isn't broken.

## The job, start to finish

The spine every gig and dry hire follows. Each stage is worked out from the records, and the red Next button offers the one thing to do. Errands and meetings stop after the first box.

1. **New**: New › pick the kind first [O D], then: Gig or dry hire: name, client, venue, status, phases; Errand or meeting: name, day, notes. No stages, no Next *(fixed in 1.192.0)* (see 5); Also: New quote page, a past job, or an open Current RMS quote
2. **Quoting**: Add kit (or crew) to the job [O H] → Build the quote from the job, or start empty [O] → Send [O] *(switched off on live)* (Email is off: Generate PDF marks it sent, the office emails it) → Record the client's answer [O], then: Yes: Confirm job (asks first if crew hold the day); Turned down: the job is left half-way *(fixed in 1.192.0)* (see 1); Amend: New version today; Amend quote at the answer step; Dates passed with no answer: Record what happened
3. **Planning**: Crew: add a role, Offer, confirm the yes [O H] (Crew can be asked while it is still a quote) → Kit: sort short kit by subhire [O H] → Settle the kit and vans [O H] *(fixed in 1.192.0)* (see 4) (Vans and venue never asked for)
4. **Going out**: Pick list: scan or count each line out [W H] → All out: ready to load [W]
5. **On the job**: Nothing to press: call sheets, running late, faults [S F H]
6. **Back**: Scan or count kit back; Missing; Report damage [W H] → Tick off deprep [W H O] → Invoice [O] *(paused)* (Waiting on how the company invoices today) → Done (taken as done 14 days after, if nothing is out) [A]
- **Stopping**: Change details › Status › Cancelled or Lost, at any stage [O D] *(fixed in 1.192.0)* (see 6) (Asks first and cancels the crew calls; no reason kept)

## Quoting and the client

From an enquiry to the client's answer. Every box that would reach the client is switched off on live, so the office sends the PDF itself and types in the answer.

1. **Start**: Next: Add kit to quote [O] (see 7) (On the Kit tab it still says this) → Make a quote: Build from job / Start one empty [O]
2. **Draft**: Lines, discounts, travel, packages, terms [O] → Lines with no price hold Send back [A]
3. **Send**: Email from operations@ with the PDF [O] *(switched off on live)* → Watched a week for a bounce, delay or reply [A] *(switched off on live)* → Generate PDF: marks it sent, office emails it [O]
4. **Client**: Opens the quote link and accepts online [C] *(switched off on live)* (Off: the link says it can't be accepted online, reply or ring) → Replies by email or phone [C]
5. **Answer**: Client accepted: confirm job [O] → Client turned it down, with why [O] *(fixed in 1.192.0)* (see 1) (Job stays Quoted; list says No quote yet) → Mark lost [O] *(fixed in 1.192.0)* (see 1) (Only on the quote and Money › To follow up) → Amend quote from the answer step [O] → Take the answer back [O]
6. **After the yes**: Crew or kit added later [O] *(fixed in 1.192.0)* (see 2) (Not flagged on the accepted quote) → Mark invoiced, To invoice [O] *(paused)*

## Booking crew

The office or a head asks; staff answer in the app, freelancers on their link. On live, Google Calendar invites carry the offer; messages and WhatsApp are off.

1. **Ask**: Add a role (role, how many, days, rate, department) [O H] → Rate left empty: offered as "rate to agree" [O H] *(fixed in 1.192.0)* (see 3) → Offer to one or several, best fits first [O H] → Undo for 30 seconds; nothing goes out in the wait [O H]
2. **Reach them**: Google Calendar invite, HOLD the day [A] *(real on live)* → WhatsApp with Yes and No [A] *(switched off on live)* → WhatsApp, text or email opened for the office [O] *(switched off on live)* → Staff crew: Offers waiting on you, on Home [S]
3. **Answer**: Accept these days, or some days [F S] → Ask for a different rate or add a note [F] → Can't do this one [F S] → Yes on the Google invite counts [F] *(real on live)*
4. **Settle**: Next: Confirm Dara's yes / Check a yes / Answer a rate [O H] → Say no to a rate keeps the offer open [O H] → Booked: own invite copy, call sheet [A] *(real on live)*
5. **Afterwards**: Release, withdraw, cancel the call [O H] → Can't make it, from their booking [F S] → Tell crew what happens next (moves, call time) [A] *(switched off on live)* → Ask same crew again after a restart [O] → Timesheets from the link [F] *(switched off on live)* (see 3)

## Kit, vans and the warehouse

Kit is held from the day before to the day after. The pick list is the warehouse’s one screen, from going out to deprep.

1. **Plan**: Add kit, for the whole job or a phase [O H] → Short: Sort N short opens Subhire [O H] → Book a vehicle with a driver (Transport tab) [O H] *(fixed in 1.192.0)* (see 4) (Not on Next; nothing asks for it) → The kit and vans are settled (a tick) [O H]
2. **Out**: Pick list, by department or by where it is kept [W] → Type a number then Enter, or the camera [W] *(fixed in 1.192.0)* (see 9) → Count out counted kit; a case brings its contents [W] → Faulty or untested kit is warned at the scan [A]
3. **Back**: Coming back: scan, count, Missing [W] (see 10) (Says 10 out where going out said 4) → Report damage, fit to go or not [W] → Never scanned out: check it is back [W]
4. **Close**: Tick off deprep, faults open shown [W H] → Repairs, tests, stock counts carry on in Stock [W H]

## Each person's routes

**Directors and system admins** (Google sign-in, desk and phone): Everything the office does; Roles: give each person theirs on their Crew page; Who reads crew rates (Admin › Company); Delete or restore a quote; erase a person; start fresh; Status, backups, History, What’s changed.

**Office and production** (Desk all day): New job or quote › Quote › answer › confirm; Turned down › Mark lost *(fixed in 1.192.0)* (see 1); Roles › Offer › confirm yes or answer rate; Kit, subhire, settle; vans *(fixed in 1.192.0)* (see 4); Money: To follow up, Owed, Margins; Admin › Connections: calendar, mailbox, RMS, WhatsApp; Bring in: calendar, crew list, stock list, RMS; Leave approvals; Timesheets to approve *(switched off on live)*.

**Heads of department** (Phone, show weeks): Home on their department: needs attention, today; Crew: roles, offers, answers (rates if allowed); Kit and stock; pick lists; counts; Quote and job details: “The office makes the quote”; Board order, job tasks and who has them.

**Warehouse (a head’s role)** (Phone, gloves, patchy signal): Home › Warehouse: today, to pick, still out; Pick list › scan out › all out; Coming back › damage, missing › deprep; Labels, counts, testing, repairs, racks; Label printing in one tap *(paused)*.

**Staff crew** (Phone, signed in): Home › Me: offers waiting on you, my jobs; Answer their own offers in the app; Tick the job tasks given to them; Leave and days in lieu › approver; Report a fault; ask for kit; vote.

**Freelancers** (Their own link, no app): Google invite › link › accept, some days, rate, decline *(real on live)*; WhatsApp offer with Yes and No *(switched off on live)*; Bookings, call sheet, can’t make it, calendar feed; Days off, busy calendar, documents, details; Timesheets *(switched off on live)*; Safer link check (sign-in by link) *(switched off on live)*.

**The client** (Email from the office): Quote PDF by the office’s own email; Quote email from operations@ *(switched off on live)*; Accept online on the quote link *(switched off on live)*; Answer by reply or phone; office records it.

## Side flows

**Stock and catalogue** [O H W]: Catalogue › product › items, numbers, photos; Labels and runs; places; racks and rack builder; Counting, testing (PAT), repairs, certificates; Vehicles and their checks; trackers; Purchase list: crew ask and vote, office buys.

**People** [O H D]: New person, or bring in the crew list (.csv); Person page: levels, skills, documents, link; Combine people brought in twice; Erase a person (director).

**Leave** [S O]: Ask for time off or a day in lieu; Approver says yes or no; days off block offers.

**Timesheets** [F S O]: Sent from the link after a booking *(switched off on live)*; Office approves; amounts owed *(switched off on live)*.

**Admin and connections** [O D]: Google Calendar: writes job days from today *(real on live)*; Crew invites to Google *(real on live)*; Operations mailbox: quote email *(switched off on live)*; Clients accept online *(switched off on live)*; Messages to crew; WhatsApp offers *(switched off on live)*; Timesheets; Ask Claude *(switched off on live)*; Current RMS: prices, clients, venues, past quotes.

**Bringing things in** [O]: Jobs from Google Calendar (read once, by hand) (Jobs typed into Google later need another bring-in); Tidy up what came in (Menu); Kit in the notes into kit lines; Stock list and Current RMS stock.

## Switched off on live, not broken

Calendar writing and crew invites are on and real.

| Switch | What happens instead |
|---|---|
| Quote email from operations@ | The office downloads the PDF and emails it; Generate PDF marks it sent. |
| Clients accept online | The quote link says it can’t be accepted online; the client replies or rings. |
| Messages to crew | No WhatsApp, text or email opens for the office; the Google invite and the link carry the offer. |
| WhatsApp offers | Waiting on the Meta setup and number. |
| Tell crew what happens next | Moves and call-time changes reach crew only when the office tells them. |
| Timesheets | No timesheet asked for; crew pay comes from the company’s own records. |
| Safer links, Ask Claude | Freelancer links open without a check; Claude in the app is off. |
| Invoicing and one-tap labels | Paused until Colly says how invoicing and printing will work. |

## Broken and weak flows, and how each was fixed

One was broken and nine needed work when the map was made. All ten were
fixed in version 1.192.0 on 13 November 2026 (PR #379).

### 1. A turned-down quote leaves the job half-way (fixed in 1.192.0)

**Where:** Job › Quote › What happened; Jobs list; Board; Next.

After Client turned it down, the job stays Quoted in the Quoting stage. The Jobs list and Board say “No quote yet”, Next on other tabs says “Open the quote”, and on the Quote tab it says the quote is “waiting on the client's answer”. Mark lost is only on the quote and under Money › To follow up. Next also kept offering the pick list for it. The quote task counts only sent or accepted quotes, so a declined one reads as no quote at all.

**In the code:** `shared/src/sync/steps-view.ts:253 and sellingLine at :169; web/src/jobs/NextDock.tsx:164`.

**Fixed:** A turned-down quote now counts as sent: the Jobs list and Board say “Turned down · mark it lost or amend”, and Next says Mark lost or amend, opening the client’s answer with Client said no and Amend quote.

### 2. Work added after the quote went is never flagged (fixed in 1.192.0)

**Where:** Job › Quote, after it is sent or accepted.

I added a Sound engineer after the client said yes. The accepted quote and its margin stayed as they were, with no note that the job now has crew the quote does not. Only a new draft shows the difference. With invoicing to come from the quote, this is money missed. It fits with the Amend quote work going on now.

**In the code:** `web/src/jobs/QuoteDraft.tsx:910 (JobChangesCard shown on drafts only)`.

**Fixed:** The quote with the client lists kit and crew new, gone or changed on the job since it went, said differently after a yes, with Amend quote beside it.

### 3. Crew can be booked with the rate still to agree (fixed in 1.192.0)

**Where:** Job › Crew › Add a role; Offer; Confirm.

A role with no day rate is offered as “rate to agree”, and the yes can be confirmed with no rate. Nothing asks for it later except a timesheet, and timesheets are off on live, so the job’s crew cost and the freelancer’s pay are unknown.

**In the code:** `web/src/format.ts:35; web/src/jobs/NextDock.tsx (Confirm yes)`.

**Fixed:** Confirming a freelancer’s yes with no day rate agreed asks first, on the row and from Next.

### 4. Vans and the venue are off the path (fixed in 1.192.0)

**Where:** Job › Kit (Settle the kit and vans) and Transport.

Next says “Settle the kit and vans” but opens the Kit tab, which shows no vans. A gig went through Planning with no vehicle and no venue, and nothing said so.

**In the code:** `web/src/jobs/NextDock.tsx:308; shared/src/sync/steps-view.ts (kit task)`.

**Fixed:** On the Kit tab Next goes on to Book transport when a gig has no vehicle, then Mark kit and vans settled; a dry hire skips Transport.

### 5. Errands and meetings get a gig’s page (fixed in 1.192.0)

**Where:** Job page for an errand or meeting.

The New form asks only for a name, day and notes, but the page has all six tabs (Quote, Crew, Kit, Transport, Phases, Show pack), says Client and Venue “None yet”, and has no Next or way to say who is going.

**In the code:** `web/src/jobs/JobScreen.tsx (tabs); NextDock returns nothing for errands`.

**Fixed:** Errands show When, Who’s going, Kit and Transport; meetings only When and Who’s going; the dock says who’s going.

### 6. Cancelling a job is a status in a form, with no reason (fixed in 1.192.0)

**Where:** Job › Change details › Status.

It asks first and cancels the crew calls, which is right, but the way there is a select in Change details and no reason is kept. A lost quote keeps why; a cancelled job does not.

**In the code:** `web/src/jobs/JobScreen.tsx (Change details)`.

**Fixed:** A Cancel this job… button beside Change details: called off or lost, and why in a line, kept at the top of the office notes with the day.

### 7. Next repeats a press that goes where you are (fixed in 1.192.0)

**Where:** Job › Kit tab on a new job.

On the Kit tab Next still says “Add kit to quote” and only opens the tab already open. The Quote tab already avoids this.

**In the code:** `web/src/jobs/NextDock.tsx:171`.

**Fixed:** On the Kit tab Next says to add the kit below instead of a press that opens the tab you’re on.

### 8. Departments are named two ways (fixed in 1.192.0)

**Where:** Add a role › Department; Jobs › Filter.

The role form offers Audio, LX, Video, Backline, Laser, Staging; the Jobs filter offers Audio, Lighting, Video, Lasers, Staging.

**In the code:** `shared/src/crew-departments.ts; shared/src/job-departments.ts`.

**Fixed:** Crew departments are Lighting and Lasers, as everywhere else; LX, Lights and Laser saved before read as them.

### 9. Typing a number then tapping Scan opens the camera (fixed in 1.192.0)

**Where:** Pick list › Scan.

The Scan button turns the camera on; a typed number goes only with Enter or Go. Someone who types a damaged label’s number and taps Scan gets the camera.

**In the code:** `web/src/jobs/PickScreen.tsx:316`.

**Fixed:** With a number typed, the button beside the box is Enter and enters it; empty, it is Scan for the camera.

### 10. Going out and coming back count differently (fixed in 1.192.0)

**Where:** Pick list.

Two cases and two stands went out as “4 of 4 out”; on the way back the same job said “10 out”, counting what was inside the cases.

**In the code:** `web/src/jobs/PickScreen.tsx (totals)`.

**Fixed:** Going out says how many more went with the kit (case contents, added on the day), so it agrees with coming back.

## What held up

The spine works end to end: a new gig went from New to Confirmed, crewed
by a freelancer's yes on their link, picked by scanning and counting,
brought back and ticked off as deprepped, with Next naming the right
press at each step and refusing nothing a role should do. Cancelling a
job with crew asks first and says who will hear. Every Stock, Crew,
Menu and Admin page opened as its role with no errors.
