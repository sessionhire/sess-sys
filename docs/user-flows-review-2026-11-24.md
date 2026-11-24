# User and persona flows, 24 November 2026: what has opened up since the map

Colly asked for a full review of the app for gaps in the routes each kind
of person takes. The map of 13 November
([user-flows-2026-11-13.md](user-flows-2026-11-13.md)) found ten, all fixed
in 1.192.0, so this review looks at what has been built since (1.193.0 to
1.220.0) and at anything that map missed: the Apply page with payment
details, privacy and the emails to applicants, dry hire delivered or
collected, the vans on the road, photos of jobs, the stocktake, printing
over the internet, a sent quote holding stock, and the client's quote link.

It was read in the code on main at 1.220.0 and walked on a local copy with
made-up data as a director, the office, a head of department doing the
warehouse's work, staff crew, a freelancer on their link, someone applying,
and a client on a quote link, with the switches both off and on. Nothing
was sent, offered or written anywhere real, and the live app was not
touched. Nothing here is built: each gap has a recommended fix for Colly to
pick from.

**Thirteen gaps.** None stops the spine of a job, which still runs from New
to Back as the last map found. Three are worth fixing before the switch
beside them is turned on, and two are a new feature (dry hire delivery) that
stops at the quote.

| # | Gap | Who it lets down | How bad | Size |
|---|---|---|---|---|
| 1 | A delivered dry hire is never sent to Transport, and its van can't work out the drive | Office, driver | Broken | Small |
| 2 | The warehouse isn't told how or when a dry hire is handed over | Warehouse | Needs work, high | Small |
| 3 | A client can accept online a quote whose job was cancelled or lost | Client, office | Broken once the switch is on | Small |
| 4 | What arrives from outside doesn't reach Home or the Crew badge | Office, directors | Needs work, high | Small |
| 5 | Someone booked to drive a van isn't told | Staff crew, freelancers | Needs work | Medium |
| 6 | After Take on, nothing carries an applicant forward | Applicant, office, heads | Needs work | Medium |
| 7 | An email to an applicant can fail and nobody hears | Applicant, office | Needs work | Small |
| 8 | Payment details aren't where the paying is done, and a change isn't flagged | Office, directors | Needs work | Small |
| 9 | An application sent again replaces the first, bank details and all, unchecked | Office | Low | Small |
| 10 | A sent quote holds its kit until someone marks it lost | Office | For Colly to decide | Small |
| 11 | Freelancers can't put photos on a job | Freelancers | For Colly to decide | Medium |
| 12 | Archiving a member of staff doesn't sign them out | Directors | Low | Small |
| 13 | A client can only say yes online | Client | Low | Small |

*Seen* below means I did it on the local copy; *read* means it is from the
code and I did not get it on a screen.

## The gaps, worst first

### 1. A delivered dry hire is never sent to Transport, and its van can't work out the drive

**Fixed in 1.221.0** (24 November 2026).

**Who:** the office and whoever drives. **Where:** Job › Kit and Transport, Next, Stock › Vehicles. The van **seen**, Next **read**.

Since 1.202.0 a dry hire is Delivery or Collection, and a delivery puts a
Delivery line on the quote by the km. But Next still treats every dry hire
as collected: on the Kit tab it goes straight to Mark kit and vans settled
and never offers Book transport, and the Crew task reads "No crew on a dry
hire". So the client is charged for a delivery that nothing asks anyone to
plan.

When a van is booked anyway, it says "Drive not known: the venue isn't on
the map. Put it there, or type the drive." The delivery address is on the
map already (the quote measured to it), but the van only looks at a venue,
and a dry hire has none. The vehicle planner then can't say when it leaves
or when it's back.

**In the code:** `web/src/jobs/NextDock.tsx:339` ("A dry hire is collected, so it isn't sent to Transport"); `shared/src/sync/vehicles-view.ts:159` (the drive goes to the venue's pin only).

**Recommended fix:** for a delivery, Next goes on to Book transport as a gig
does; the van measures to the delivery address's pin, takes the From time
as when it's due there and the To time for the run back; and the Transport
tab says "Delivery to 12 Main Street, Naas, by 10:00" above the bookings. A
collection stays as it is.

### 2. The warehouse isn't told how or when a dry hire is handed over

**Fixed in 1.221.0** (24 November 2026), all but the optional "Handed over to" line.

**Who:** the warehouse. **Where:** the pick list, Home › Warehouse and Today. **Seen.**

The job page says "Collection Tue 24 Nov, 09:30 · Return Thu 26 Nov,
17:00". The pick list for the same job says only "Today: Hire, Tue 24 Nov",
and Home's Today row says "Going out". Nothing on the warehouse's screens
says the client is coming at 09:30, who is coming, or, for a delivery, where
it goes and by when. On the way back nothing says it is due at 17:00, so a
late return only shows the next day as kit still out. There is also no
moment of handing it over: scanned out is the same press whether it went on
our van or into a client's car.

**In the code:** `web/src/jobs/PickScreen.tsx` (the day line under the head); `web/src/home/HomeScreen.tsx` (Today and Going out rows).

**Recommended fix:** on a dry hire's pick list, one line under the head:
"Client collects at 09:30 · Shannonside Festivals, Niamh Walsh" with her
number to ring, or "Deliver by 10:00 to 12 Main Street, Naas"; coming back,
"Due back Thu 26 Nov, 17:00". Home's rows for a dry hire say the time. A
"Handed over to" line with a name, typed when the last item goes out, would
give the office something to point to if kit comes back short; that part is
optional.

### 3. A client can accept online a quote whose job was cancelled or lost

**Fixed in 1.222.0** (24 November 2026).

**Who:** the client and the office. **Where:** the client's quote link. **Seen**, with Clients accept online turned on locally.

I took a sent quote, cancelled its job (the same change Cancel this job
makes), and opened the client's link: it still showed the quote with Accept the quote, and would
have taken a yes. The link checks whether the quote is a draft, replaced,
answered or past its prices, but never looks at the job. Cancelling a job
stops its crew calls and frees its kit and vans, but leaves its quote
"sent". This costs nothing while the switch is off on live, and is the
first thing a client could trip over once it is on.

**In the code:** `server/src/finance/accept-routes.ts:34` (`standingOf` reads the quote and its versions, not the job's status).

**Recommended fix:** a link for a job that is cancelled or lost says "This
job isn't going ahead. Get in touch if that's changed." and takes no yes;
the same check sits inside the accept itself. Fix it before turning the
switch on.

### 4. What arrives from outside doesn't reach Home or the Crew badge

**Fixed in 1.222.0** (24 November 2026).

**Who:** the office and directors. **Where:** Home › Needs attention, the Crew tab's badge, the bell. **Seen.**

Two things now come in from people outside the app, and neither reaches
the places the office looks first:

- **A new application.** I applied on the Apply page. The office's Home
  said nothing, the Crew badge stayed at 27, and the bell was empty. The
  only sign is a "1" beside Applications in the Also here row on Crew.
  The Apply page tells the person someone will read it; an application
  nobody notices is deleted after six months.
- **A client's yes online.** I accepted a quote as the client, whose page
  says "We're told straight away". Home's list had no line for it. It is
  on Money › To follow up ("Answered: put the job in step") and on the
  job, for someone who goes looking, and at most one person's bell.

**In the code:** `web/src/home/standing.ts:104` to `:148` (no row for either); `web/src/crew/CrewBadge.tsx:32` (answers and leave only).

**Recommended fix:** two rows under Waiting on the office: "1 application
to read" (opens Crew › Applications) and "1 quote accepted, job to confirm"
(opens Money › To follow up). Count applications in the Crew badge. Put
the online yes on the bell of whoever has the job's Quoting stage, as well
as whoever sent the quote.

### 5. Someone booked to drive a van isn't told

**Fixed in 1.224.0** (24 November 2026).

**Who:** staff crew and freelancers who drive. **Where:** Home › Me, a freelancer's page, the call sheet. **Seen.**

I booked the Big Van on a job with Aoife driving. Her Home › Me listed her
two crew bookings and nothing about the drive: Your bookings and Your day
come only from crew calls. A driver who is also on a call can find the van
on the call sheet, which says "Big Van, Sat 3 Oct: Aoife driving", but not
the times the planner now works out ("Leaves 06:15, 1 h 45 each way"). A
driver with no call on the job, which is every dry hire delivery and most
errands booked as a van only, sees nothing but a bell notification.

**In the code:** `shared/src/bookings.ts` (bookings are offers and calls); `shared/src/callsheet.ts:306` (`vanLine` has the van, days, driver and notes, no times).

**Recommended fix:** a drive shows in Your bookings and Your day as its own
row, "Driving the Big Van · RV dry hire · leaves the warehouse 06:15", on
Home › Me and on a freelancer's page; the call sheet's vehicle line gains
"leaves 06:15, back about 19:30".

### 6. After Take on, nothing carries an applicant forward

**Fixed in 1.223.0** (24 November 2026). The offer to send their page stays until they are moved up a level, since the app doesn't record a link being opened.

**Who:** the applicant, the office and heads. **Where:** Crew › Applications, the person's page, their own link. **Seen.**

Take on works and the toast says they're on the Crew tab at Level 0. Then
the route stops in three places:

- **Their link.** With Email people who apply off (as on live), nothing
  offers to send them their page. It is two taps away, under the person's
  Their link tab, as Copy link. Someone taken on and never sent it can't
  add days off, documents or payment details.
- **Vetting.** They are out of Offer to… until moved up a level, which is
  right, but nothing lists who is still waiting to be vetted or counts
  them. They are found only by filtering People by Level 0.
- **Their own page.** It opens with "Nothing waiting right now" and "No
  upcoming bookings", with no word that they are new, what happens next,
  or what would help (a Safe Pass, insurance, how to be paid).

**In the code:** `web/src/crew/Applications.tsx:111` (the toast); `server/src/crew/page.ts` (the page's opening lines).

**Recommended fix:** after Take on, the toast and the top of the person's
page offer "Send them their page" with the same WhatsApp, text, email and
Copy choices an offer has, until it has been opened once. Crew ›
Applications gains a short second list, "Taken on, not vetted yet (3)",
each with Move up. A new person's page opens with two lines: "You're on
our crew list. We'll offer you work here; adding your certificates and
days off helps us pick you."

### 7. An email to an applicant can fail and nobody hears

**Fixed in 1.223.0** (24 November 2026), all but the count in Admin › Status.

**Who:** the applicant and the office. **Where:** Admin › Company › Applications to join, Crew › Applications. **Read.**

With Email people who apply on, the toast says "They're emailed the link to
their page" at once. The email is queued and sent from the operations
mailbox. If the mailbox isn't connected or Google refuses it, it is tried
for a day and then given up, and the address is wiped so nothing of a
turned-down applicant is kept. None of that shows anywhere in the app: not
on the switch, not on Applications, not on Admin › Status. The office
believes the person has their link, and the person waits.

**In the code:** `server/src/applications/emails.ts:140` (given up after a day, and after five refusals); nothing in `web/src` reads the queue.

**Recommended fix:** the switch says "The operations mailbox can't send
just now" when that is so, as Send on a quote does. An email given up on
shows on Crew › Applications as "Aoife's email didn't go: send her page
yourself", with the link to her page, and counts in Admin › Status.

### 8. Payment details aren't where the paying is done, and a change isn't flagged

**Fixed in 1.225.0** (24 November 2026). The warning stands until a payment to them is marked paid after the change; Timesheets carries only the warning, so a line on every row isn't noise.

**Who:** the office and directors. **Where:** Money › Owed, Crew › Timesheets, a person's Details tab. **Read**, and the card seen.

Bank details can now be given on the Apply page and changed by crew on
their own page. The app warns well about a change, "Changed on their own
page. Before paying to a new account, ring them", but only on that
person's Details tab. Money › Owed and Timesheets, where someone decides
to pay, say nothing about whether details are held or have just changed,
and nobody is notified when they change. A link passed on or guessed is
the usual way money goes to the wrong account, and the warning is on a
page nobody opens that day.

**In the code:** `web/src/crew/PaymentCard.tsx:86` (the only place it's said); `web/src/jobs/Money.tsx` and `web/src/crew/Timesheets.tsx` (no mention of payment details).

**Recommended fix:** each person on Owed carries one quiet line: "Payment
details held", "None yet: ask for them", or, in the warning colour,
"Changed on their own page on 21 Nov: ring before paying". A change made
from a link goes on the bell of directors and the office.

### 9. An application sent again replaces the first, bank details and all, unchecked

**Fixed in 1.225.0** (24 November 2026).

**Who:** the office. **Where:** the Apply page, Crew › Applications. **Read.**

One email is one application, and the thank-you page tells people to send
it again if something changes. The newer one silently takes the place of
the older, including the bank details, and nothing checks that the same
person sent both: only the email has to match. The card doesn't say it
was sent again. The chance is small, but the result is the same as in gap
8.

**In the code:** `server/src/applications/routes.ts:104` (the newer replaces every field).

**Recommended fix:** the card says "Sent again on 24 Nov, replacing one
from 20 Nov", and when the payment details differ from the first, says so
in the warning colour with the same advice to ring.

### 10. A sent quote holds its kit until someone marks it lost

**Who:** the office. **Where:** Kit short, another quote's availability. **Read.** For Colly to decide.

Since 1.202.0 a sent quote holds its kit as a confirmed job does, as Colly
asked. The hold has no end of its own: a quote whose prices have lapsed
(the client's link says so) or whose client never answered keeps holding
that kit for its dates until someone marks it lost, so a later quote for
the same days reads as short. Home does count "quotes worth a call", which
is the prompt to chase.

**In the code:** `shared/src/sync/kit-view.ts:84` (`kitHoldOf`: quoted is held, with no look at the quote's valid-until day).

**Recommended fix:** when a quote's prices lapse with no answer, its kit
drops back to pencilled in, and To follow up says "Prices lapsed: its kit
is no longer held". The other choice is to leave it and rely on the chase
list; that risks turning down work for kit that was never going out.

### 11. Freelancers can't put photos on a job

**Who:** freelancers. **Where:** Job › Photos. **Read.** For Colly to decide.

Any member of staff can add photos, and freelancers, who are most of the
people at a show, can't: their page has no way in. That was a fair first
cut. If the point of Photos is what the show looked like, the people
holding the phones on site are mostly left out.

**Recommended fix:** Add photos on a freelancer's booking, for its days
and a week after, going onto the job's Photos tab marked with who sent
them, for the office to take down if they aren't wanted.

**Fixed in 1.227.0** (24 November 2026), as recommended: Colly said "yes they should".

### 12. Archiving a member of staff doesn't sign them out

**Fixed in 1.225.1** (24 November 2026).

**Who:** directors. **Where:** a person's page. **Read.**

Someone leaving now takes three separate steps that nothing connects:
suspend their Google account, archive them, and press Sign out everywhere
(new in 1.220.0). Archive alone leaves their phone signed in, and an
account that still works but matches nobody on the Crew tab comes in as
staff crew, who can read jobs and crew phone numbers.

**In the code:** `server/src/crew/handlers.ts:464` (`person.archive` clears payment details and their calendar, not their sign-ins).

**Recommended fix:** archiving a member of staff signs them out everywhere
in the same step, and the question says so and reminds whoever is doing it
to suspend the Google account.

### 13. A client can only say yes online

**Fixed in 1.226.0** (24 November 2026): the reference box. Turning down stays with email, as recommended.

**Who:** the client. **Where:** the client's quote link. **Seen.**

The page takes a name and a tick, and says "To change anything first,
reply to the email instead". That is a fair choice. Two things clients
often need at that moment have nowhere to go: a purchase order number, and
a plain "not this time". Both come back as emails for the office to type
in.

**Recommended fix:** an optional "Your PO number or reference" box beside
the name, kept on the quote and printed on it; leave turning down to email
unless clients ask for it.

## Switches, off and on

How each new route behaves with its switch off (as on live) and on.

| Switch | Off | On |
|---|---|---|
| Take applications | The Apply page says to get in touch with the office. Works. | Applications arrive, but nothing on Home or the badge says so (gap 4). |
| Email people who apply | Nothing is sent; nothing prompts the office to send the link (gap 6). | Emails go; one that fails is never shown (gap 7). |
| Ask for PPS numbers | Not asked anywhere. Works. | Asked on the Apply page, their own page and the card. Works. |
| Clients accept online | The link shows nothing of the quote and says to reply or ring. Works. | Accepting works; a cancelled job's quote can still be accepted (gap 3), and Home doesn't say a yes came in (gap 4). |
| Label printer over the internet | Read only: Print falls back to the download for the ZT411. | Not walked: it needs the real printer. |
| Timesheets | Payment details are collected with nowhere they're used. | Owed and Timesheets don't show them (gap 8). |
| Messages to crew | After Take on, only Copy link is offered, on the person's page (gap 6). | The same choices as an offer would fit here. |

## What held up

Seen on the local copy:

- The Apply page: sending an application, the thank-you page, the card on
  Crew › Applications, and Take on carrying their roles, department,
  mobile and notes across to a person at Level 0 with a page of their own.
- The client's link: off, it shows nothing of the quote and says to reply
  or ring; on, a yes is taken with the name and time, and the job page
  then says "The client said yes: confirm the job below".
- Cancelling a job frees its vans in the vehicle planner.
- A freelancer's page: offers, a rate asked for, bookings with Hold the
  day, work done, For paying you, Download everything we hold on you, and
  the privacy page.
- The stocktake's page: who is counting where, places counted, and labels
  on by department.
- 32 pages opened on a phone as a director, the office, a head and staff
  crew with no errors and no sideways scroll; staff crew aren't shown
  Applications among Crew's views, nor Admin's settings.

Read in the code, and sound:

- The Apply page keeps bots out, flags someone already on the Crew tab
  before they're taken on twice, and asks before Turn down deletes.
- A quote not sent yet shows no prices on its link, a newer version closes
  the older link, and a second press of Accept is taken as one yes.
- Payment details are deleted when someone is archived, and only a
  director opens them in full.

## Suggested order

1. **Dry hire, both halves together** (gaps 1 and 2): a feature already
   charged for on the quote that stops there.
2. **Before Clients accept online is turned on:** gap 3, and the online
   yes half of gap 4.
3. **Before the Apply page is turned on:** the applications half of gap 4,
   then gaps 6 and 7.
4. **Drivers** (gap 5), which also finishes the vans work of 1.198.0.
5. **Before timesheets or paying from the app:** gaps 8 and 9.
6. Colly's calls on 10 and 11; 12 and 13 whenever convenient.
