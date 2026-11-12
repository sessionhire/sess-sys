# Build progress

Newest first. Each entry says what changed, what was checked, and what is
waiting on someone.

## 12 November 2026: the crew's accommodation on quotes

**Done (1.173.0)**

- On Colly's ask for "a line for accommodation similar to how travel and
  subsistence work" ([ADR 0156](adr/0156-crew-accommodation-on-quotes.md)).
  Admin › Company › Travel and subsistence gains "Stay over after" (180 km
  unless set) and "A room, € a night" (unset, so nothing changes until
  it's set).
- Past that distance a quote adds "Crew accommodation, N crew nights", a
  room for each crew day, printed "a night"; the row's switch,
  Accommodation provided, takes it off. Travel then counts one car trip
  each rather than one a day. The margin takes the rooms at cost.
- Crew invites say "Accommodation: covered" or "provided by the job" only
  on a quote that has it, so no invite out now changes.
- Checked: unit tests for the line, the travel once each, the defaults and
  the printed words; the server keeps the switch and the settings, and the
  device agrees with it; typecheck.
- Waiting on Colly: the room price, and whether 180 km is the right line.
## 12 November 2026: WhatsApp tells crew what happens next

**Done (1.172.0)**

- Batch 3 of the [audit of crew offers](audit-crew-offers-2026-11-12.md),
  its WhatsApp part: findings 4, 8 and 12, on Colly's answers to
  questions 4 and 7 ([ADR 0154](adr/0154-whatsapp-tells-crew-what-happens-next.md)).
  Under WhatsApp's own switch, which is off on live, so deploying this
  sends nothing.
- Three more messages follow an offer on WhatsApp: "you're booked" when
  the office confirms someone on a job the client has said yes to, the
  new call time when a call's call time changes (with HOLD while the day
  is still theirs to hold), and "no longer needed" with why ("filled by
  someone else", "withdrawn by the office") when an offer is filled,
  withdrawn, released or its call cancelled. Someone picked while the
  client hasn't said yes hears nothing then, and that they're booked when
  the job is confirmed. Nothing for their own No or Can't make it, nor
  about a call whose days are all past. A call time that changes again
  before its message goes doesn't add another: the one waiting says the
  call time as it is when it goes.
- These, and the job's confirmed and cancelled, go to everyone asked or
  booked whom WhatsApp reaches and who heard of the offer, whether or not
  the offer itself went on WhatsApp (question 7). Someone whose offer
  message is still waiting, or was turned down by Meta, and who hasn't
  answered, hears nothing about an offer they never saw.
- Confirm (when it asks first), Withdraw, Release, cancelling a call and
  stopping a job say first what WhatsApp sends; the panel after each says
  what went; the Offer form's line about a shortlist says the rest hear
  on WhatsApp too. Each only of the people it reaches, by the server's
  own rule.
- The three templates, `job_booked`, `job_call_time` and `job_not_needed`,
  are written out in [whatsapp-setup.md](whatsapp-setup.md), step 9, for
  Meta to approve beside the three already there. None names the rate.
- Checked: the WhatsApp tests send each message to a stand-in Meta and
  read its blanks and buttons: booked on Confirm and at the client's yes,
  nothing at a pick on a held job, confirmed and cancelled reaching people
  offered before WhatsApp was on, one cancelled per person across two
  calls, the call time once while one waits, no longer needed with why
  for filled, released and a cancelled call, nothing for their own No or
  Can't make it, nothing to someone who never heard of the offer, about
  a call that's over, or while WhatsApp is off, and a booking released
  before its message went sending no longer needed only. The words tests
  cover each question and panel. A replay on a local copy with stand-ins
  for Google and Meta, 21 checks, walked it through the office's presses
  in the browser, on a desk and a phone. Nothing real is sent.

**Waiting on Colly:** the three templates approved in Meta, with the
others, before WhatsApp is turned on.

## 12 November 2026: the company logo in one place

**Done (1.171.0)**

- Admin › Company › Logo, a card of its own after the office's details
  ([ADR 0155](adr/0155-the-company-logo-in-one-place.md)), on Colly's ask
  for a place to upload the logo with suggested formats and sizes. It was
  inside Labels before; Labels keeps the cable colours.
- The card shows the logo in colour as a quote's head has it and in black
  as a label printer prints it, and lists what works best: SVG or PNG, at
  least 1200 pixels across, about three or four times as wide as tall,
  dark on see-through or white, cropped close.
- An SVG can be put up now; the device draws it out to a 1200-pixel PNG on
  white, as it does any logo. A small or square file still goes up, with a
  line saying why it may print soft or small.
- Checked: the labels end-to-end test puts up an SVG and a small PNG
  through the new card.

## 12 November 2026: crew invites tell people what happens next

**Done (1.170.0)**

- Batch 3 of the [audit of crew offers](audit-crew-offers-2026-11-12.md),
  its calendar part: findings 4 and 8, on Colly's answer to question 4
  ([ADR 0153](adr/0153-crew-invites-tell-what-happens-next.md)). The
  WhatsApp part, three more messages and question 7, follows in its own
  change.
- A new switch under Admin › Connections › Google Calendar, "Tell crew
  what happens next", with Off, "Only to the addresses below" (up to 5,
  to try it on the office's own addresses first) and On, which asks
  first. It starts off, so deploying this changes nothing on live, and
  turning it on or off sends nothing by itself: the titles change quietly.
  Each change is in the history.
- With it on, each person's own invite says where they stand and their
  call time in its title: "Booked: Harbour Lights Festival - Show 1/2,
  call 07:30" once booked, "HOLD Harbour Lights Festival - Show 1/2, call
  07:30" while picked for a job the client hasn't said yes to, and the
  day's title with the call time while asked. Being booked or picked, and
  a call time that moves, are emailed by Google, one email a day; their
  own yes, the notes and the crew list are not. The days everyone sees
  keep their titles.
- A day that comes off someone's calendar because their offer ended says
  why first, quietly, so Google's cancellation carries it: "Filled by
  someone else", "Withdrawn by the office", "The job was cancelled", "The
  job didn't go ahead", "You declined" and "Can't make it".
- Confirm, Release, Withdraw, a cancelled call, a stopped job and a
  changed call say what Google emails, for the people the switch
  reaches: "Google is emailing Ciara to hold the day, as the client
  hasn't said yes yet", "Google is emailing Aoife and Ciara the new call
  time", "cancelled and why".
- On a freelancer's page, an offer that was waiting on them and ended on
  the office's side shows at the top of Offers waiting on you, saying
  how, for a week or until its call, then goes down to Offers that ended.
  This is so whatever the switch.
- Erasing a person takes their address off the addresses it's tried on;
  with none left, the switch goes off.
- Changed from the audit's words: "You declined:" for their own No,
  rather than "Thanks for letting us know:", the words their page and the
  office already use.
- Checked: the calendar tests turn it on, try it on one address and turn
  it off in a stand-in Google, and read every email Google would send:
  none for turning it on or off, their own yes or a change of notes; one
  a day for being booked or picked and for a call time that moves; each
  cancellation titled with why; nothing more for someone who said No to
  that day in Google. The words tests cover each question and panel, the
  page tests an ended offer at the top while it's news, an erasure test
  the addresses, and a browser test turns the switch through its three
  settings. The whole server suite passed (1,015 tests), and the whole
  browser suite on GitHub. A replay on a local copy with stand-ins for
  Google and Meta, 43 checks, walked it from off, through one address and
  on, to off again, with the office's presses in the browser and the
  freelancer's page on a phone. Nothing real is sent.

**Next:** Colly tries it on their own address on the test calendar
(ADR 0153, "Trying it first"), looking at how Google shows a cancelled
day's last title, before turning it on for everyone. Then the WhatsApp
part of batch 3, and batch 6.

## 12 November 2026: a Yes counts for its own day, and saying no to a rate keeps the offer

**Done (1.169.0)**

- Batch 4 of the [audit of crew offers](audit-crew-offers-2026-11-12.md):
  findings 3 and 9 and the rest of 7 and 16, on Colly's answers to
  questions 2 and 6 ([ADR 0152](adr/0152-a-yes-counts-for-its-own-day.md)).
- A Yes in Google counts for the day it was pressed on. The days someone
  hasn't answered stay asked: they hold nothing, the invites still ask,
  and their page says which days they haven't answered. A later Yes adds a
  day and a later No drops one, until the office confirms; a No to every
  day they'd said yes to asks them again for the rest. The history says
  which days were said yes to and which have no answer yet.
- Each person's copy of a day follows that day's own answer: a No to a day
  still asked says so, and a Yes the app couldn't take says why ("Thanks
  Niamh, but we couldn't take your yes. Sat 28 Nov has just been
  filled."). Nothing is emailed for any of it.
- Confirm books the days they said yes to. With days still asked, its
  button names the days, the question before it says which invites
  Google cancels, and the panel after says Google is emailing them, and
  that nothing else went.
- Someone else's yes no longer closes a rate asked for. The office's own
  Confirm or Agree that fills the call does, naming whose ask closes
  before the press and whose cancellation Google emails after it. A Yes
  pressed in Google after asking for a rate is flagged on the office's
  row. Say no on a call that filled meanwhile closes the offer, and the
  panel and the message say it closed rather than stands.
- Say no to a rate keeps the offer open at the rate offered, for the days
  the rate was asked for; Withdraw is its own button. Their page says
  "The office can't do €320 a day, so the offer stands at €280 a day.",
  their invite asks again without naming a rate, and the office's row says
  it. A head who doesn't read a call's rates can say no but not agree.
- The job's own Crew tab has the same presses as Answers to check:
  Confirm and Release on a yes, Agree, Say no and Withdraw on a rate. On a
  job still a quote, Next leads with the quote and says "2 answers to
  check" beside it, which opens the call's rows.
- Changed from the audit's words: Say no keeps the days the rate was asked
  for, not every day of the call, so nobody is invited again to a day
  they'd left out.
- Checked: the calendar tests press Yes and No day by day in a stand-in
  Google and read each copy's first line, the emails Google would send
  (none, bar the cancellations Confirm names) and the history; the
  booking tests cover a rate left open when someone's yes fills the call,
  Confirm and Agree closing it, Say no keeping the offer and closing it
  on a call that filled, days still asked moving with the call, and a No
  to the days said yes to; the device-matches-server tests cover each new
  answer; a browser test presses each answer on a job's own rows, then
  answers from the person's link. A day with two invites (a call across
  two phases that day) needs a Yes on both, and a Yes on one never reads
  as a rate question. The whole server suite passed (1,009 tests), and
  the whole browser suite bar two that timed out while the machine was
  busy and passed alone. A replay on a local copy with stand-ins for
  Google and Meta, 41 checks, found the panel after Confirm saying
  "Nothing was sent" while Google emailed a cancellation; that is fixed
  here. Nothing real is sent.

## 12 November 2026: notes for the crew, office notes, and a short invite

**Done (1.167.0)**

- Colly answered the seven questions of the
  [audit of crew offers](audit-crew-offers-2026-11-12.md) with "Go with
  yours", so batches 3 to 6 take the recommended answers. This is batch 5,
  finding 2 and question 1
  ([ADR 0151](adr/0151-notes-for-the-crew-and-office-notes.md)), built
  first because an email can't be unsent.
- Change details on a job has two boxes, each with a line saying who reads
  it. **Notes for the crew** is the box that was Notes, so what is in it
  stays where crew read it: the call sheet and the jobs calendar. **Office
  notes** is new and never leaves the app: not the calendar, a call sheet,
  a message or a person's page. The office, directors and heads of
  department read them; staff crew and freelancers signed in are sent the
  job without them. The history says the office notes changed, never what
  they say. A phase's box is Notes for the crew too. Combining two jobs
  joins each kind of note with its own.
- Someone only asked, or waiting on the office about a rate, gets a short
  invite: their first two lines, the stage (with what HOLD asks), the day,
  the venue's name and address, and the per diems and fuel, then "Once
  you've said yes, this invite fills in with the day's sheet: the client,
  the crew, the notes and the pick list." When they say yes, or the office
  books them, it fills in.
- Kept on purpose: the per diems and fuel stay in the short invite, where
  the audit had them out. They are about the crew's own money and are on
  neither their page nor the call sheet.
- Nothing new is sent. On the first run after this is live, the invites of
  people only asked are shortened once, quietly, as a description change
  is never emailed.
- Checked: a server test reads the invites as Google holds them for
  someone asked, someone who asked for a rate, someone booked and someone
  who then says yes, and holds that none of it is emailed and that the
  office notes are on no event; a server test holds that staff crew and
  freelancers are sent a job without its office notes, and the office,
  directors and heads with them; the history test holds that only "the
  office notes" is said; a browser test types office notes and reads each
  box's line. Nothing real is sent.

## 12 November 2026: hold the day, said everywhere

**Done (1.166.0)**

- The second batch Colly picked from the
  [audit of crew offers](audit-crew-offers-2026-11-12.md): findings 6, 10
  and 15 and the first line of 7
  ([ADR 0150](adr/0150-hold-means-hold-the-day.md)). Colly put the meaning
  right before it was built: HOLD is short for "hold the day", the ask of
  the crew, and never the job being on hold. Every line that explains it
  now says so, from one set of words.
- On a job the client hasn't said yes to, someone the office has picked
  reads "Hold the day" where they read "Booked": on their own link, on
  Home › Me and on their page in the app, with a line under it, "The
  client hasn't said yes yet, so please keep the day free. Nothing is
  booked until they do." Before they answer, the line says what a yes
  agrees to. The same line, starting "Hold the day:", heads their call
  sheet and the office's, and "You on this job". Home › Me counts the day
  as "to hold", and its "Your weeks" chart draws it as waiting to confirm.
- The office's offer message asks "can you hold the day for ...?", and its
  message after picking someone says "we have you down for ..., so please
  hold the day" in place of "you're confirmed". The panel after Confirm
  says their link tells them to hold the day.
- A person's own calendar invite greets them by the name they go by. Its
  first line asks them to hold the day while the client hasn't said yes
  and never says "booked" then. Someone who asked for a different rate is
  told it is with the office and is no longer asked to press Yes or No.
  Its second line is the day to answer by and their page, where their rate
  is: the link was the last line, under the pick list.
- The line under a HOLD day's title reads "HOLD means hold the day: ..."
  where it read "ON HOLD: ...". HOLD stays in the title and before the
  job's name on WhatsApp.
- Nothing more is sent: every change is to words on a screen or to an
  invite's description, which is never emailed. On the first run after
  this is live, each person's own invite and each HOLD day from today on
  is rewritten once, quietly.
- Left out, on purpose: saying on the invite that a Yes pressed in Google
  couldn't be taken (the second half of finding 16). It needs the invite
  written from the answers Google holds, so it goes with the Answers
  batch. The office's own card for a call still says Booked for someone it
  has picked.
- For Colly: the WhatsApp templates aren't in Meta yet, so
  [the setup guide](whatsapp-setup.md) now gives `job_confirmed` as "the
  client has said yes, so it's going ahead" in place of "it's no longer on
  hold".
- Checked: a server test reads each person's own invite as Google holds it
  through an offer, a yes, a rate request, the office's pick, the day to
  answer by passing and the client's yes, and holds that only the title
  change is emailed; a server test reads the page and the call sheet;
  unit tests hold the messages' words; a browser test follows one member
  of staff through the office's messages, Home › Me, the job, the call
  sheet and their link, before and after the client says yes; and a replay
  on a local copy with stand-ins for Google and Meta. Nothing real is
  sent.

## 12 November 2026: crew offers say what was sent

**Done (1.165.0)**

- Colly picked "The two batches with no decisions" from the
  [audit of crew offers](audit-crew-offers-2026-11-12.md). This is the
  first, "Say what was sent" (findings 1, 5, 14, 16, 18 and 20;
  [ADR 0149](adr/0149-the-office-is-told-what-the-app-sent.md)).
- The Offer form says what pressing sends by itself, for the people
  picked, by the rule the server sends by: who is emailed a calendar
  invite, who it goes to on WhatsApp, and who gets nothing and why (no
  email address, a job brought in from Google Calendar, a call that isn't
  part of a job, days outside the job's phases).
- Each offer's row says how its person was reached, from what the server
  read back: "Invited by email, 2 days. No answer yet.", "Calendar invite
  on its way.", "Answered on their page.", in amber that nothing has
  reached them and why, or as a failure that Google turned the invite
  down. A row nothing reached offers Ring and WhatsApp where Send would
  be. With invites, WhatsApp and messages all off, the call says so once.
- The panel after Offer, Confirm, Withdraw, Release, a cancelled or
  changed call and a stopped job is headed by what was done and says who
  Google emailed, who nothing reached and why, with their number a press
  away. "Messages to crew are off" is said last.
- The questions before Withdraw, Release, Say no to a rate, Cancel crew
  call and marking a job cancelled or lost name the email Google sends,
  and to how many. Where crew invites were switched off after someone was
  invited, they say no cancellation goes and the days stay in that
  person's calendar; where the calendar has a problem, that the email
  goes once it's working again.
- On a freelancer's page the note about calendar invites shows only when
  one has gone for an offer waiting on them, and "Declined and withdrawn"
  is "Offers that ended".
- Nothing about what is sent changed. Not built, waiting on Colly's
  answers to the audit's questions: a fresh invitation after a No and a
  person's own invite on a brought-in job (question 3), and telling
  people they're booked or that a call time moved (question 4). The form,
  the rows and the panel say that nothing went.
- Checked: a server test compares the rule a device reads with who the
  server really made a guest, across six cases; 39 unit tests on the
  wording; the whole browser suite, with the tests for offering, the
  calendar, the Next dock and cancelling rewritten; and a replay of 14
  steps on a local copy with stand-ins for Google and Meta, where what
  each screen said was read against what the stand-ins were asked to
  send. Nothing real is sent.

## 12 November 2026: an audit of crew offers, from the office to the crew

**Done**

- [Audit, 12 November 2026: crew offers](audit-crew-offers-2026-11-12.md),
  at Colly's ask: one offer followed from the office's press, through what
  the app sends by itself (the Google Calendar invite, and WhatsApp when
  it's on), to what the freelancer or member of staff sees and is told
  afterwards, at 1.164.2. Walked on a local copy with stand-ins for Google
  and Meta that record what they're asked to send, as the office, four
  freelancers and a member of staff. 20 findings: no P0, 6 P1 (the form
  promises an invite that never goes for a job brought in from Google
  Calendar; a job's notes are emailed to everyone asked; a Yes on one
  day's invite is taken for every day; nobody is told they're booked or
  that their call time moved; the office is told "nothing opened to send"
  while Google emails people; on hold is on the invite while their page
  says Booked), 7 P2, 7 P3, in six suggested batches, with seven questions
  for Colly. Screenshots in the project folder under
  `screens/audit-crew-offers/`. Nothing live was touched and nobody was
  contacted.
- Nothing is built from it yet: Colly picks what to fix.
- Checked: every count of what was sent is read from the stand-ins, each
  quoted line from the screen or the invite, and each place in the code
  against main; the Blueprint builds.

## 11 November 2026: forms say what needs sorting

**Done (1.159.0)**

- Colly asked for a clearer error on forms and errors on each field. An
  empty or out-of-range field already had its line under it (required.ts);
  now every form also gets a list beside its submit button of all that's
  left to sort, each line a press away from its field, gone once it's fixed.
- A form's own checks say it on the field too (`refuseField`): crew calls'
  project, role, day rate and reply-by day; the Offer's picker and Offer
  anyway. Spaces alone no longer stop a form silently.
- Checked: offer-from-next, leave, refusals and the full browser suite.

## 11 November 2026: a crew offer that wouldn't send

**Done (1.158.1)**

- Colly picked two people in a call's Offer on a phone, then pressed the red
  Next button ("Offer the Audio - FOH"), which only opened the same form
  again; the form's own Offer button is plain and read as greyed out. With
  people picked, Next now sends the offer to them (`offerPicks.ts`).
- More people than places is said before it goes; a reason the offer can't
  go shows under the Offer button; a fault in the checks is said there too.
- Checked: new offer-from-next browser test (a call across Build, Show and
  Break, two picked for one place), and the steps, crew, certificates,
  layout, leave, own-calendar, calendar and refusals tests.

## 11 November 2026: search as a command palette

**Done (1.158.0, ADR 0147)**

- Search opens over the current screen (blurred, dimmed veil) from the
  magnifier, Ctrl K / Command K anywhere, or / at a desk; `#search` links open
  it over Home.
- The combobox's keys in its field; places to go with their keys before
  anything is typed.
- Checked: the search browser tests (phone and desk, Ctrl K in a field,
  arrows, Enter, Escape, a press outside, the old link); screens in
  screens/palette.

## 10 November 2026: every view of the jobs filters alike

**Done (1.150.0, ADR 0141 addendum)**

- Board, Calendar, Week and Month: Filter as on the list (ListTools'
  `ViewFilter`), departments and which jobs as pills, chips above the view.
- New job on every view's title line, opening the list's form.
- New client on Clients, New venue on Venues.
- Checked: job-departments, master-calendar, steps, plan and the new
  view-add browser tests; screens in screens/job-views.

## 10 November 2026: Home's views, and Sort across a phone

**Done (1.149.1)**

- Home's Company / Department / Warehouse / Me are the area views' row
  (Views.tsx `ViewChoice`), under the same "Views" heading; the greeting is
  the line under the title.
- On a phone, Sort fills the row and Filter sits at its right edge.
- Colly: When on Jobs stays one at a time.
- Checked: the Home, departments, steps, access, person and screens
  browser tests; screens in screens/home-views.

## 10 November 2026: the Jobs list reads top to bottom

**Done (1.149.0, ADR 0141)**

- A list page's add is on its title's line: New job, New product, New
  place, New person, New vehicle, New rack; the form opens at the top of
  the list (New job's beside it on a laptop).
- Jobs: search under the title, then the views under a "Views" heading,
  then Sort and Filter. Every area's views now sit under the title.
- Coming up / Past / Not going ahead, the five departments and Mine are
  pills in Jobs' filter panel; each one picked is a chip above the list.
- The Google Calendar line is off the Jobs list (Menu and Admin keep it).
- Checked: the browser tests that add to a list or use the Jobs list's
  choices; screens in screens/list-story.

**Open:** the calendar, week and Board keep their departments row on the
page, as it is their one choice.

## 10 November 2026: one job, one path, part 8: tabs in stage order

**Done (1.148.0)**

- The job's tabs run Quote, Crew, Kit and vans, Phases, Show pack.
- A job opens on the tab its next task is in; one with nothing left opens
  where it was last looked at; a link to a tab still wins.
- Checked: steps.spec opens a job being sold on Quote and one being
  planned on Crew; the full browser suite.

## 10 November 2026: one job, one path, part 7: New quote, client first

**Done (1.147.0)**

- New quote is a page of its own under Quotes; To follow up's New quote
  opens it, as the shortcut and the planner's More options already did.
- The client first, with their past jobs and Current RMS quotes to start
  from right under it; picking one fills the name and venue when empty.
- Who asked, how it came, wanted by and the kind of job fold under More
  about the enquiry.
- Checked: past-job.spec walks the client-first page; the New quote tests
  open the fold where they use it; screen in screens/one-path-7.

**Next:** part 8, the job's tabs in stage order.

## 10 November 2026: one job, one path, part 6: the pick list starts with the kit

**Done (1.146.0)**

- A job on its days with nothing scanned out is in Going out and its pick
  list says "Due out today · 0 of 6 out", not "Out on the job".
- The pick list's department chips and order buttons are one Show choice;
  Going out or Coming back appears once something has gone out.
- Opened partway through picking, it lands on the first row still to pick.
- Next's "Pick the kit" carries the count.
- Checked: new browser tests for the first day with nothing out and for
  landing partway through; the pick test reads the Show choice; screens in
  screens/one-path-6.

**Next:** part 7, New quote as a sheet of its own, client first.

## 10 November 2026: one job, one path, part 5: each press moves the count

**Done (1.145.0)**

- Next on a job takes the crew a step per press, with the count in the
  button: a yes is confirmed where it is ("Confirm Aoife's yes · 1 of 2
  booked"), the next place nobody's offered opens its Offer ("Offer the
  Rigger · 1 of 2 offered"), a different rate goes to Crew's answers, and
  once every place is offered it says how many answers are out. Confirming
  sends nothing; the Crew page's message prompt opens as its own Confirm does.
- "Sort 1 short on the kit" lands on the Kit card's Subhire, open, with the
  short lines ticked.
- Crew lines on a quote made from the job ("Rigger (Load in)") count against
  their own call, so they no longer show as "not asked for yet" beside it.
- Checked: a new browser test walks a job from a yes to confirm through to
  the short kit; screens in screens/one-path-5.

**Next:** part 6, the pick list opening on the first thing to pick.

## 10 November 2026: one job, one path, part 4b: one press for the yes

**Done (second half of part 4, 1.144.0)**

- "Client accepted: confirm the job" records the client's yes and confirms
  a job still being sold in the same press, said first under What happened.
  Confirming writes the job's days to the connected calendar, as
  confirming always has.
- A draft's terms are one line ("10% off · prices hold 30 days · no deposit
  · for Ruairí Kelly") with Change; they open by themselves while one needs
  putting right.
- Add kit and Add crew stay in front; transport, something else, words,
  packages, saving the kit as a package and charging all kit the same days
  are under More to add. An empty quote shows them all.

**Next:** part 5, crew and kit steps that move their count on with each
press.

## 9 November 2026: one job, one path, part 4a: the quote on the job

**Done (first half of part 4, 1.143.0)**

- The quote is the job's Quote tab, under the job's head, stage line and
  Next; it no longer has a page of its own. #jobs/<id>/quote opens the tab,
  and so does the tab's old address, /money.
- With the tab open while the job is in Quoting, Next says "Finish the
  quote below and send it to the client" in words, so Send (or Build it
  from the job) is the one filled red. From any other tab, Next still
  takes you there.

**Next:** the second half of part 4: accept and confirm in one press,
terms on one line with Change, one Add box with the rarer adds under More.

## 9 November 2026: one job, one path, part 3: said once

**Done (part 3, 1.142.2)**

- On a confirmed job, where it stands is said beside its name only; Next's
  line says just Next. On the quote page and on a job still being sold,
  Next's line still says it, as nothing else there does.
- Where it is folds to its five stages and "2 tasks to do in Planning";
  that, a stage, or a task opened from Next or Home opens them. The open
  stage pressed again folds it. The invoice row shows folded only once it's
  invoiced or due.

**Checked:** steps, job-moves-on, person, quotes, RMS history, home,
screens, pick, kit, crew and departments browser tests; a walk on a phone
and a desk (project files, one-path-3).

**Next:** part 4, the quote as the Quoting stage on the job page.

## 9 November 2026: one job, one path, part 2: Send stays in view

**Done (part 2, 1.142.1)**

- A draft quote's Send (or Get the PDF to send) sits in the sticky strip
  with the totals and never disappears. With a line unfinished it reads
  "Send: 1 line to finish" and takes you to the line, even one already open
  and scrolled away; pressed mid-save, it saves and then sends. The last
  look and the email box still open under Send at the foot, and the page
  glides there.
- The foot keeps the date it was sent on, Print a draft, Sent another way
  and Accepted by phone; the duplicate red button there is gone.

**Checked:** the quote, quote polish and follow-up browser tests; a walk on
a phone and a desk (screens in project files, one-path-2).

**Next:** part 3, the job's head says where it stands once.

## 9 November 2026: one job, one path, part 1: Next does what it says

Colly walked the journey from quote to crew and the pick list and found it
hard to follow between steps. A walk on a phone and a desk found ten places
it loses the thread ([proposal](https://claude.ai/artifact/D9cXTUpDZPSoMBz5RoNzDP));
Colly chose to make the job page the one path through a job, in eight parts
(ADR 0140).

**Done (part 1, 1.142.0)**

- The job's Next makes the crew calls from the quote rather than opening the
  Crew tab; Book N more crew opens the first call's Offer; Settle the kit
  and vans lands on a tick card at the top of Kit and vans.
- The quote page shows the job's Next once the job is past Quoting, so it
  points on to crew and kit rather than to the invoice.

**Next:** part 2, Send never disappears from the quote; then the job's head
said once, the quote as the Quoting stage, crew and kit steps, the pick
list, New quote as a sheet, tabs in stage order.

**Assumed until Colly says otherwise:** the client's yes is the moment the
job is confirmed; crew may be pencilled before the yes; the warehouse picks;
invoicing stays out of the path while paused.

## 9 November 2026: the quote looks like the company's own document

**Done**

- The printed quote and its PDF redrawn as one design (ADR 0139, 1.141.0):
  the brand's red band, logo and "Quote" with its number, Prepared for /
  The job / dates in three columns, lines under a shaded head with red
  group heads, deposit beside a red total block, terms and bank side by
  side, the company's details as a letterhead at the foot. IBM Plex Sans
  and Archivo on both copies.
- Printing from the browser no longer shows the browser's address, title
  and date (the page's own margins carry the band and page count), and Save
  as PDF offers "Quote 1115 - Job". The PDF opened from a quote, and from
  the client's link, now carries the logo.

**Checked:** the server PDF drawn with a long sample (two pages) and a short
draft; the browser's print saved as a PDF by Chromium with its header and
footer on, showing neither; the quote, package and quote-shape browser tests.

## 9 November 2026: gear on quotes from Current RMS

**Done**

- A Current RMS quote's lines are matched to the stock list by the product
  Current RMS quoted (its id, kept on each product by the stock bring-in)
  before the name (1.140.2). Colly: putting the MSF quote's lines on its
  job brought only the audio gear onto the kit list.
- Each read of Current RMS reads the lines again of every quote still to
  come (or up to a week past) and of any with no lines (1.140.1). Current
  RMS doesn't always move a quote's updated time when lines are added, so
  a quote first read while empty stayed blank here (Colly: the MSF quote
  for Wednesday).

**Checked:** a server test with a stand-in Current RMS.

## 9 November 2026: correcting the days of a Current RMS quote

**Done**

- A past quote from Current RMS has Correct the days (ADR 0138, 1.140.0):
  the office's first and last day are the days to go by everywhere, kept
  when Current RMS is read again, with what Current RMS has said beside
  them, and Use Current RMS's days to go back. Each change is in the
  history. Nothing in Current RMS changes.
- Times from Current RMS are taken as their day in Ireland everywhere: some
  places took the UTC date, so a summer job from midnight showed (and
  matched) a day early.
- The show days Current RMS keeps are read too, and said on the quote when
  they aren't its days. They show after the next read of Current RMS.

**Checked:** server tests for correcting, a read keeping it, the history and
going back (including summer time); shared tests for the Irish day; a
browser test of the page.

**Waiting on:** Colly, for an example of a quote that came in wrong, to
confirm which of the causes it was.

## 9 November 2026: clients and venues filled in from Current RMS

**Done**

- Admin › Connections has a Clients and venues from Current RMS card (ADR
  0136, 1.137.0). Read them reads Current RMS's organisations, venues and
  the contacts who belong to them.
- Before anything changes, it says what filling in would do: addresses
  where there are none, contacts a client hasn't got, a contact for a venue
  with nobody, and those on Current RMS's quotes not here yet (added only
  when ticked). Nothing typed here is changed.
- Checked: server tests with a stand-in for Current RMS, and the card at
  phone width.

**Waiting on**

- The office: Read them, look over the lists, and Fill in, on live.

## 9 November 2026: hire prices filled in from Current RMS

**Done**

- Admin › Connections has a Hire prices from Current RMS card (ADR 0132,
  1.136.0). Read the prices reads each product's rental price and rule
  from Current RMS through the API, a few minutes in the background.
- Before anything changes, it says what filling in would do: to fill in,
  to bring up to date, set here by hand and different (kept unless
  ticked), already the same, no hire price there, and not found here.
- Fill in is one change in the history; the price list now knows which
  prices came from Current RMS, so a later run follows Current RMS for
  those and keeps the office's own.
- Checked: 7 server tests with a stand-in for Current RMS.

**Waiting on**

- The office: Read the prices, look over the list, and Fill in, on live.

## 9 November 2026: open Current RMS quotes on the calendar

**Done**

- Jobs › Calendar shows the quotes still open in Current RMS (not an order,
  not lost, days still to come) as potentials, dashed and marked Current RMS
  quote with number and client, opening the past quote. Ones linked to a job
  here, or that look like one, stay off. "Not going ahead" on the past quote
  takes one off; "Put it back on the calendar" undoes it. Nothing changes in
  Current RMS (1.135.0, ADR 0134).
- Checked: server, shared and browser tests for the calendar and past quotes.

**Waiting on**

- Nothing.

## 9 November 2026: the calendar looks like Google Calendar

**Done**

- Jobs › Calendar now looks like the Google Calendar the office already
  reads: smaller type, a job of several days drawn as one bar across its
  days, today circled, Today and arrows at the top. Confirmed still solid,
  potential still dashed. On a phone it reads like Google's schedule
  (1.133.1, ADR 0123).

**Waiting on**

- Nothing.

## 9 November 2026: colour on the stage line

**Done**

- A job's five stages fill in red up to where it is: passed stages red with
  a tick, the line between them red, the stage it's in ringed in red, or
  amber when crew or kit is short and orange when something is late
  (1.133.0, ADR 0131). The small bar on the Jobs list, Home and the job's
  head does the same, and each Board column carries the bar too.
- One colour for progress, not one per stage: the stage's name already
  says which, and other colours already mean short, late and healthy.
- Checked: before and after on phone and desk, dark and light; the stages,
  Home and Jobs tests.

**Waiting on**

- Colly: merging the learning in design-system #47.

## 9 November 2026: answers on WhatsApp (off until launch)

**Done**

- The WhatsApp offer's buttons now answer it (1.129.0, ADR 0125 part 3).
  *Yes, I can do it* accepts it, as their page would, and they get a reply
  saying they're down for it. *No, I can't* asks once more (*Decline it* or
  *Keep it open*). A filled or withdrawn job says so. A button counts only
  from the number the offer went to, and once however often Meta sends it.
- Each offer's row in Crew says "sent", "delivered" or "read on WhatsApp"
  while it waits for an answer, or "not sent" and why.
- STOP turns their offers on WhatsApp off; anything else written gets a
  reply pointing to their page and the office's number.
- The history shows these answers as theirs, "on WhatsApp".
- Checked: 16 tests with a stand-in for Meta, including the signature,
  repeats, a stranger's number and receipts arriving out of order.

**Waiting on**

- Colly: Meta's side ([steps](whatsapp-setup.md)) and which number. Then
  test mode on Colly's phone.

## 9 November 2026: a master calendar of jobs and enquiries

**Done**

- Jobs › Calendar shows a month a box a day, with confirmed jobs solid and
  enquiries and quotes dashed and named, all together. Everything, Confirmed
  or Potential at the top; jobs with no dates yet listed underneath; a day
  opens its week on the planner. Those who see money also see whether a
  quote has gone out. On a phone it lists the days with something on. It
  reads only and writes nothing to Google (1.124.0, ADR 0123).

**Waiting on**

- Nothing.

## 9 November 2026: offers go on WhatsApp by themselves (off until launch)

**Done**

- Colly answered the research's questions and said go. An offer now queues
  a WhatsApp in the same change that makes it, and the server sends it to
  Meta just after, at the same moment as the calendar invite: template
  `job_offer` with the job's facts and Yes, No and See the details
  buttons (1.126.0, ADR 0125).
- Admin › Connections › Offers on WhatsApp: Off (as it starts), only to up
  to five numbers to try it on, or On. Admin › Status reads the number's
  state and quality from Meta, sending nothing.
- Everyone gets offers there once on (Colly's choice); each person's page
  has "Stop offers on WhatsApp" under their details. The office can turn
  someone off when asked; only they turn it back on.
- [Steps for setting up Meta's side](whatsapp-setup.md).

**Waiting on**

- Colly: Meta business verification, the number (new, or the office's own),
  the template, and the four Railway variables. Then test mode on Colly's
  phone.

## 9 November 2026: job offers over WhatsApp, researched

**Done**

- [Job offers over WhatsApp](research/whatsapp-offers.md), at Colly's ask
  that the app send offers itself. Recommended: Meta's WhatsApp Cloud API
  direct (no provider, about €80 a year), an offer that sends itself when
  the office makes it, with Yes, No and See the details buttons; Yes and
  No answer the offer as the link does. Freelancers tick "Send my offers on
  WhatsApp" on their link first. Behind a switch, off until launch. A plan
  in four parts. Nothing built.

**Waiting on**

- Colly to pick the plan and answer the page's five questions; Meta
  business verification and a number when building starts.

## 9 November 2026: the logo goes Home, and a start screen for each person

**Done**

- Pressing the Session Hire logo top left goes Home from any screen, on a
  phone and at a desk.
- Menu › You has "Open the app on": Home, Jobs, Board, Planner, Quotes,
  Stock or Crew. It's kept with the person's account, so every device they
  sign in on opens there; Home stays the default, and a link still opens
  where it points (1.123.0, ADR 0122, PR #272).

**Waiting on**

- Nothing.

## 9 November 2026: five ideas from Rentdeck, built

**Done**

- Colly picked five of the eight ideas, and all five are in:
  - A client's payment terms, printed on the quote, and who to ask for at
    a venue, printed on the call sheet (1.120.0, ADR 0119, PR #268).
  - "+ Quote" on each day of the planner starts a quote for that day, and
    keys at a desk: press ? for the list (1.121.0, ADR 0120, PR #269).
  - The client accepts a quote online from a link: the quote as sent, their
    name and a tick (1.122.0, ADR 0121, PR #270). Behind the switch "Let
    clients accept quotes online" under Admin › Company, **off** until
    launch; the app sends nothing, the link goes only in an email the
    office sends.
- Learnings for the design system in design-system PR #45.

**Waiting on**

- Colly to merge design-system #45, and to turn on online acceptance at
  launch.

## 8 November 2026: Rentdeck, set beside the app

**Done**

- [Rentdeck, set beside Session Hire's app](research/competitor-rentdeck.md),
  at Colly's ask: a new Dutch tool at €9.95 a month for one user, for small
  hire firms leaving Excel. Read from its site, wiki and terms; no trial
  opened. It is ahead on invoices, the client signing a quote online and
  paperwork the office can redraw; the app is ahead on crew, the calendar,
  the warehouse, jobs and quoting. Eight ideas worth taking, all small
  except online acceptance and invoicing (paused). Nothing built.

**Waiting on**

- Colly to pick any of the ideas, and the page's four questions.

## 8 November 2026: an audit of the quote flow, and quoting from scratch

**Done**

- [Audit, 8 November 2026: the quote flow](audit-quote-flow-2026-11-08.md),
  at Colly's ask: the quote from enquiry to confirmed job, as the office
  person fills it in, on a phone and at a desk, offline too, at 1.118.0,
  weighed against what 1,072 Current RMS quotes look like (counted, none
  named). 21 findings: no P0, 4 P1 (free lines can only be "needs a
  price", a count lost when the product's name has digits, a part-typed
  client becomes a new one, a draft's kit isn't held or seen by other
  quotes), 13 P2, 4 P3, in seven suggested batches. Screenshots in the
  project folder under `screens/quote-audit/`. Nothing live was touched.
- Its second half answers "if we did it again from scratch": the quote as
  the job's plan (its kit pencilled, its crew as calls), starting from the
  client, one Add box, Included lines and the office's own groups, due
  today first, dry hire as its own shape, sending as one act. Reachable in
  steps, not a rebuild.

- Colly picked batch 1, "the first 3 small ones" (#266, 1.119.0): a quote
  line can be given as Included at no charge, and a product at €0 on the
  price list arrives that way; a number typed before a product is how many
  first ("2 d20" adds two); the start of one client or venue left in the
  box takes that one, said under it with a press to keep it new.
- On 9 November Colly asked for the rest, in order. Batch 2, the quote is
  the job's plan (ADR 0126, 1.127.0): a draft's kit is on the job's kit
  list as it's typed, pencilled, so other quotes see it and confirming
  holds it; the quote's crew are made calls in one press; a line's days
  are the days the job works, not the gap between build and show.
- Batch 3, the quote due today comes first (ADR 0127, 1.128.0): drafts
  in the order they're wanted, "Wanted today" leading Quotes and counted on
  Home, drafts for jobs that are over kept apart, whoever starts a quote on
  its task; with email off, Get the PDF to send marks it sent and opens the
  numbered PDF; "accepted by phone" gets the same last look as sending.
- Batch 4, the quote the way the office writes it (ADR 0128, 1.131.0):
  each line is under the office's own heading, lines and groups move up
  and down, a line can be words only; the quote is for who asked; the logo
  heads the printed quote and the PDF; New quote asks show or dry hire,
  and a dry hire has no venue, crew or travel.
- Batch 5, found where you'd look (ADR 0129, 1.132.0): packages are found
  in Add kit with their price and what they hold; New quote's Start from
  is one search over this app's past jobs and Current RMS's quotes, the
  client's last three first.
- Batch 6, an emailed quote is sent only once Gmail has it (ADR 0130,
  1.132.1): numbered, drawn and handed to Gmail first, marked sent after;
  turned down, it stays a draft with its number and says so; Send waits
  for the device's changes. Needed before email is turned on in live.

- Batch 7, the last rough edges (ADR 0133, 1.134.0): a half-made line
  holds back only itself; a long draft on a phone opens folded to its
  groups, and picking there gets the screen; Admin › Company › Own kit in
  the margin costs own kit at a share of its price, and until it's set the
  margin says "own kit not costed"; a number guessed offline says so and
  prints as a draft; the per diem said once, "Wanted by", and short words
  found only at a word's start in the picker.

**Waiting on**

- The page's six questions; every finding of the audit is now fixed.

## 8 November 2026: a package's price starts at its items' total

**Done**

- Colly: "Start with the price for the total for all items in package and
  then allow a discount to a set price." The package editor and list show
  what its items come to; a price of its own shows as what it takes off;
  a package added to a quote keeps that total, and the quote on screen and
  on paper says "€N off its items' €T" ([ADR 0116](adr/0116-a-package-is-a-shortcut-for-its-kit.md), point 2).

## 8 November 2026: packages as a shortcut for their kit

**Done**

- Colly asked for named sets of kit as templates, then for a package to be
  a shortcut for its gear, itemised under it (folded on screen, printed
  open), and racks the same.
- Built ([ADR 0116](adr/0116-a-package-is-a-shortcut-for-its-kit.md)):
  adding a package adds its line and each product as a line under it; a
  priced package includes its kit, an unpriced one is its kit's prices;
  racks bring their layout's kit, included; save a quote's kit as a
  package; add a package's kit on a job's Kit.

**Waiting**

- Colly chose "either, set per package" for pricing, as built.
- The thread finding package templates in Current RMS quotes proposes a
  starter list, loaded only once Colly approves it.

## 8 November 2026: start a quote from a past job

**Done**

- Colly asked for old quotes as templates for related new ones, by venue
  and client, based on what actually went out rather than what was quoted.
- Built ([ADR 0115](adr/0115-start-a-quote-from-a-past-job.md)): New quote
  offers up to six past jobs once the client or venue is known (both
  first), and picking one fills the ticked lines: kit at what went out,
  marked where it differed from the quote or went beyond it, priced from
  today's price list.

## 8 November 2026: freelancers' access

**Done**

- Colly asked what the rules allow for freelancers' access. Today: the
  private link is the whole way in (ADR 0002); Google sign-in takes only
  Session Hire's Workspace, so freelancers can't sign in; a link never runs
  out, isn't tied to a phone, and a lost one comes back only through the
  office. Colly picked "Link, made safer" from three ways.
- Built ([ADR 0114](adr/0114-freelancer-links-remember-phones.md)): every
  link remembers the phones it opens on (a cookie scoped to the link, only
  hashes kept). A switch under Admin › Company, Freelancers' links, starts
  off; on, a new phone needs a six-digit code emailed from the operations
  mailbox, and `/link` emails a lost link. A never-used link opens on the
  first phone, which is also the way back for someone with no email: the
  office's New link.

**Waiting**

- Colly: turn on Check new phones at launch, with the operations mailbox
  connected and allowed to send.
## 8 November 2026: quoting, the six small ones and the draft fix

**Done**

- Colly picked the six small features and the draft fix from
  [research/quoting.md](research/quoting.md).
- Quantity typed with the product in Add kit ("12 y10"), and How many
  beside the role in Add crew; each product in the picker says its price,
  rule and how many are free on the job's days (#254, 1.110.0).
- One check before a quote goes (no price, short of kit, no travel, first
  day gone); a sent quote whose prices have run out says so; why a quote
  was turned down, with a note, on the quote and in history; who asked,
  how it came and the day the quote's wanted by on New quote, the day as
  the Quote sent task's due day (#255, 1.111.0).
- Two people on one draft keep both their changes: saves carry what they
  began from and are merged line by line on the server and the device,
  and an open draft takes in changes from elsewhere
  ([ADR 0113](adr/0113-two-people-on-one-draft.md), #256, 1.111.1).

**Waiting on**

- Colly's answers to the research's seven questions, and whether to go on
  to starting from a past quote and product companions.

## 8 November 2026: what would make quoting faster, easier and more reliable

**Done**

- Research on Colly's ask to focus on the quoting stage:
  [research/quoting.md](research/quoting.md). The quote flow walked on
  made-up data, desk and phone, at 1.109.3 (screenshots in the project
  folder under `screens/quoting-research/`), the quoting ADRs and code
  read. Fifteen features ranked by value and effort: six small ones first
  (quantity as kit is picked, price and free count in the picker, one
  check before a quote goes, prices that have run out, why a quote was
  turned down, a day the quote is due by), then starting from a past
  quote and a product's usual companions, and a fix so two people on one
  draft don't wipe each other's lines. No invoicing work proposed.

**Waiting on**

- Colly's answers to the page's seven questions, and which to build first.

## 7 November 2026: batch 5 of the UX sweep, what the small moves prepared

**Done**

- Batch 5, on Colly's "move on to the next batch" after batch 4, built on
  section 9's recommendations: move 12, move 5c and question 2.
- Move 12, first part, whose turn it is (1.105.0, PR #240): a task with
  nobody named on it says whose it is by role, from the one owner table
  ("For the warehouse (nobody named).", `ownerByRole` in
  shared/src/words.ts), and the Tasks filter and Home's tile say
  "nobody named"; two hand-offs reach the people whose turn it is as
  notifications in the app only (ADR 0058's fifth reason, "Your
  department's turn"): a job going confirmed, to the heads of the
  departments on its calls or kit and the warehouse's heads
  ("Confirmed: Harbour Lights, Mon 9 Nov"), and a job's first kit out,
  to the office ("Gone out: Harbour Lights"). Nobody is emailed.
- Move 12, second part, the invoice tail (1.106.0, PR #241), on question 6's
  answer, the row and the group: `invoiceOf` in
  shared/src/sync/money-view.ts says where a job's invoice stands; Quotes
  gains "To invoice" (confirmed, finished, accepted, not invoiced, longest
  first), the job's tasks end on an Invoice row that opens the quote, and
  Home has the office a "jobs through, not invoiced" count. Jobs that
  ended before November 2026 (`INVOICES_FROM`) are "Not needed", so the
  group starts honest rather than with every old quote. Question 9's
  answer (tone and count, no "At risk" state) needed no change.
- Move 5c, the record picker's half step (1.107.0, PR #242): `ProductPicker`
  becomes `RecordPicker` (web/src/RecordPicker.tsx) with the system's
  combobox keys, `find` and `meta` given by each use, and Offer to… on a
  call is it: the search box and the select are one, the department,
  level and skills the meta line with a certificate gap, "⚠ not free then"
  and "busy in own calendar", the call's department first at rest, Show
  applicants a checkbox under it. Enter while typing never sends the form.
  Eight offers at most, and on a phone the list grows with the page
  rather than scrolling inside it. Client, venue, place and supplier wait
  for a month of use, as the sweep says.
- Question 2, staff answer offers in the app (1.108.0, PR #243,
  [ADR 0111](adr/0111-staff-answer-offers-in-the-app.md)): a new ability,
  `answer`, every role but freelancer; `offer.respond` needs it and its
  handler holds anyone without `crew` to their own offers. "You on this
  job" has Yes / No (no asks first); some of the days and pulling out stay
  on the link. Offer rows on Home › Me and their own page open the job.
  Timesheets wait for their switch (ADR 0090). That ends the sweep's
  twelve moves.

## 7 November 2026: batch 4 of the UX sweep, the pages that are someone's own

**Done**

- Batch 4, straight after batch 3 on Colly's "And then proceed to the next
  batch": moves 10b and 11.
- Move 10b, first part, Home for whoever is looking (1.101.0, PR #236): one line on
  the week above the Company view's counts ("The next seven days: 4 confirmed jobs
  on, 2 short of crew or kit · €19,189 confirmed of €22,729 quoted for
  November 2026", the money for whoever sees it, from Money's own
  figures), quiet unless something in the first group stops work; the
  Money card straight after the week ahead; Housekeeping a fold with its
  count, closed for a director and open for everyone else, kept per
  phone (`sh.home.housekeeping`); each count's "N more since Tuesday" from
  this phone's last look on an earlier day (shared/src/last-look.ts,
  `sh.home.looks`); the down-to-nobody count only for jobs starting
  within a fortnight (the Jobs list's Tasks filter gains that option);
  the head of the warehouse lands on the Warehouse view.
- Move 10b, second part, what's over but not finished, and what was lost
  (1.102.0, PR #237): Home's Today lists Just finished (n), the jobs over in the
  last fortnight still in Back with work open (`stillInBack` in
  shared/src/lists.ts); the Jobs list's Past opens on Still in Back (n)
  before the weeks; Money's head gains Lost or lapsed for the month
  (quotes turned down and lost jobs' uninvoiced quotes, `MonthMoney.lost`),
  with the jobs whose dates passed unanswered named apart and not summed;
  By month gains Lost; Home's Money card shows Money's own list
  (`MoneyFacts`) in place of its sentence.

- Move 11, first part, the Jobs area's record heads (1.103.0, PR #238): the client
  and the venue take the shared page head (name, Pending beside it, a sub
  line "Client · 2 jobs · Declan Moore" / "Venue · Dublin 1 · 2 jobs
  here") and the shared Tabs (client: Details · Documents · Jobs; venue:
  Details · On the map · Documents · Jobs here), addressed as
  #jobs/clients/<id>/<part>; the quote and the pick list take the job's
  name in the head with "Quote · version 2 · <client> · <dates>" or
  "Pick list · <dates>" under it and the quote's pill or the job's
  position beside it; the QUOTE kicker and the first card's h1 go.
- Move 11, second part, the Stock area's record heads (1.104.0, PR #239): the item
  (number and picture in the head, "Mic case 24 · Bay C2" under it, the
  Details card and tracker over Tabs: Faults · Tests and certificates ·
  In it · Counts · Log, as #stock/item/<id>/<part>), the place ("Place ·
  576 items · counted …") and the vehicle ("Van · 241-D-100 · 3 seats",
  "Off the road until …" as a pill beside its name) take the shared page
  head; a fault drawn away from the Repairs list's state groups carries
  its state as a pill; the record card gap is one role, `--record`
  (16px, Colly's question 7), in app.css.

**Left for later**

- A Company count narrowed for a head naming their department ("2 LX
  calls still need crew").

## 7 November 2026: batch 3 of the UX sweep, where a job stands

**Done**

- Batch 3, on Colly's "And then proceed to the next batch" after batch 2:
  moves 7, 8b and 9, in four PRs built in turn.
- Move 7, first part, the task's fields (1.97.1, PR #232): each task of a job
  carries its facts as fields beside its hint (booked, needed, short,
  out of, still out, the show's days, the quote's sent day, faults), and
  the Next dock and the Board choose a button or a tone from the fields,
  never by reading the hint back. One selling sentence (`sellingLine`)
  for the Board's card and the Jobs list's stage line: "Draft started ·
  1 line needs a price", "Quote with the client 12 days · worth a call"
  at Quotes' threshold, "Dates passed, no answer", "Quote: with the
  office". A server test reads every made-up job's hints back and holds
  each number against its field.
- Move 7, second part, the position part (1.98.0, PR #233): `jobPosition()` in
  shared/src/sync/position.ts and `JobPosition` (web/src/jobs/
  JobPosition.tsx, which replaces StageLine) draw "stage · what's short
  or waiting · owner · when" on the job head (in place of the pill once
  confirmed), the dock's line, the Jobs row (in place of the stage line,
  the Confirmed pill and the Kit short flag on a confirmed job), Home's
  rows (compact), the Board's card and the pick list's head. Quiet when
  nothing is short, warn ink when crew or kit is, bad ink when a task is
  late or the dates passed unsold. The Board's Planning column is banded
  This week, Next week and a folded Later (n); a column's "short" counts
  crew as well as kit. Departures: a sale keeps its Kit short flag on the
  row, as its position is the quote's; an errand or meeting row keeps its
  line and draws no position. Left for later: the "In Planning since"
  line on Where it is (no stage dates are stored), the quote's What
  happened card, folding a meeting's Kit, Show pack and Quote.
- Move 8b, arriving on the kit (1.99.0, PR #234): the job head's Kit fact says
  "· 0 of 27 out" and links to the pick list for a role with the stock
  ability; within seven days of going out the dock's quiet second slot
  is "Pick the kit · 0 of 27 out" for that role (also on the rest line
  when the task is another role's), the filled verb staying the
  planner's; the pick list draws `PickDock` in the foot on a phone in
  four wordings (pick, all out and ready to load, scan back, tick off
  the deprep). A line in ADR 0104 says the dock is drawn there too.
  pick.spec checks at 390px that the scan box and the dock never cover
  each other.
- Move 9, each role's own app (1.100.0, PR #235): the Jobs list's filters gain
  Whose (Mine) and Department (a job is a department's when a call is,
  or a kit line is in its stock department); a head's list starts on
  their department once a tab, widened with the chip's take-off; a
  "Mine (n)" chip first for anyone booked (as Home › Me reads them).
  `YouOnThisJob` on the job page for anyone with a booking or offer on
  it, above Where it is for a role without jobs, crew or kit, under it
  otherwise: role, phase, days, call, venue, details, call sheet, and
  "Can't make it any more? ›" (or "Answer it on your page ›") to their
  link at that booking. Plain #crew lands a role without crew on
  People. Stock opens with "Broken or missing kit · Report it ›" for a
  role without stock. Left for later: the planner's To sort out
  narrowing, Home's views group by role and "The company's week ›",
  the NotYours head and role-aware Empty states, the warehouse head's
  first landing.

## 7 November 2026: batch 2 of the UX sweep, words, forms and the link

**Done**

- Batch 2, on Colly's "Do batch 2": moves 4, 5b and 6b, one PR each,
  built in turn.
- Move 4, one word table (1.96.0, PR #229): shared/src/words.ts holds
  the words met on more than one surface, and the pills, the call sheet,
  the link, the dock and the "not yours" sentences read it. A crew
  booking is Booked on every surface (Colly's question 1 on its
  recommendation), so Confirmed is only the client's yes (ADR 0103);
  accepted is To confirm, filled is "Filled by someone else", the
  office's take-back "Withdrawn by the office". Leave's waiting is
  "Waiting for approval". "Still needs crew" is the one name for calls
  short of people (Home's tile, Crew's list, the planner's key), under
  Calls' "Coming up" card. Time groups are Coming up, Past and Not going
  ahead (a person's Worked tab is Past). Someone else's work is one
  sentence shape from STEP_OWNERS and NOT_YOURS (the dock's rest, Vans,
  Counting, Quotes, the pick list, Timesheets); a colleague's hidden
  details say "Hidden for your role". Kit lists narrowed for a head say
  "Showing LX (Lighting) only". Menu lines have a reader's version for a
  role without the ability; history says "Cancelled the job …". Keys,
  wire names and stored rows are unchanged.
- Move 5b, the app's forms (1.96.1, PR #230): `.grid-form` and the
  Admin office form are one column under 640px, with `.pair` for From
  and To, First and Last name and the like (ten pairs); at a desk a
  submit spanning the grid sits at the start, as wide as its words.
  "(optional)" is written in the label (`.optional`), and instruction
  placeholders moved under the label as hints read with the field.
  UnitBox moved out of the quote into `web/src/UnitBox.tsx` and app.css,
  and the day rate fields carry € in the box. No submit is disabled:
  Offer, That's me, Save allowance, Subhire, Give a department and Tidy's
  Give press into a refusal in required.ts's voice; required.ts also
  refuses a number under its min, over its max or off its step in the
  app's words, and a wheel over a focused number blurs it. Add phase's
  name is required.
- Move 6b, the freelancer's page as a whole (1.97.0, PR #231): "Since
  you said yes" opens the link with each booking whose call, days or
  venue moved since the yes (with "was …") and each that ended, linking
  to its card; no script. Past work and the timesheet rows are one "Work
  done" list after the bookings, rows to send first, each with its state
  (send, sent, approved, paid) when timesheets are on. The feed, "Let us
  see when you're busy" and "Your documents" fold to a state line ("Not
  shared", "Shared, 2 busy days ahead", "one runs out in 9 days") and
  open on a flash, a problem or a typed value.

## 6 November 2026: the UX cohesion sweep, and batch 1 of its moves

**Done**

- [UX cohesion sweep, 6 November 2026](ux-sweep-2026-11-06.md), at
  Colly's ask (PR #218): what makes the app feel like several apps, and
  twelve moves that make it one. Seven maps of the app, ten lenses each
  checked by a sceptic, three programmes, two judges and a critic: 46
  themes (5 P1, 29 P2, 12 P3) and 29 smaller findings kept, 9 dropped.
  The moves are in five batches, with thirteen questions for Colly.
  Screenshots are in the project folder under screens/ux-sweep/. Nothing
  live was touched.
- Batch 1, "Monday", on Colly's "Start with the first batch": moves 1,
  2, 3, 5a, 6a, 8a and 10a, one PR each. Screenshots are in the project
  folder under screens/ux-batch1/.
- Move 1, one red button (1.88.1, PR #219): the red fill is only the
  one next step on a screen. On a job that is the Next button, and the
  forms opened under it are plain; on a quote it is the next thing to
  record (one helper decides), and Send and Print turn red only once
  nothing is left to record. An ask's yes is plain, or the bad fill when
  it takes something away. Check on Timesheets is quiet; Checked and the
  leave queue's Approve and Decline are plain; every list opens with its
  add, and the add's form holds the page's one red.
- Move 3, part 1, one count (1.89.0, PR #220): kit to check back in
  after a job is one rule in shared (kitToCheckBackIn), read by Home,
  Home › Warehouse's new "Still out after the job (n)", Stock and the
  Board's Back head ("Back 12 · 6 late"). It follows ADR 0109's
  never-scanned rule, so the count went from 3 to 7 jobs on the bench.
  Every Home count is the length of the list it opens (standing() in
  shared) and lands on that list's heading with the same number: a server
  test builds all 18 lists through real mutations, and e2e taps every
  tile. Pick lists, Kit short and Crew's calls start with the tile's
  group; Answers to check reads "(73) · 1 running late"; damaged kit is
  counted a repair at a time; Repairs has one name; Stock's row counts
  show only to roles that look after stock. Late kit is amber, not bad
  (ADR 0104 updated).
- Move 5a, the link's forms (1.89.1, PR #221): the freelancer's link
  takes the app's form look from the vendored tokens: 16px text and 44px
  controls, one filled yes per card, a quiet No in the bad ink behind its
  fold, and a refusal said under its field in the bad wash with "Error: "
  first in the title. The redrawn page lands on the refused field through
  #refused with no script (ADR 0002): the offer, timesheet, days off,
  details, calendar, kit to buy, broken kit and documents forms. The day
  rate reads "Day rate you'd do it for" with the € in the box; From and
  Until are a pair; instructions are hints under their labels. Nothing
  the forms post changed.
- Move 2, one look for heads, boxes and folds (1.89.2, PR #222): inside
  a card a head is a group (small grey capitals naming a run of rows or
  figures, or a part of one long form) or a section (the plain heading
  over a part with words of its own); a row drawn as a box has one inset
  and corner (--inset-box, --radius-box); every fold is one fold, the
  shared chevron turning as it opens, drawn as a mask over a border so a
  high-contrast theme still shows it; an open task is the turned chevron
  and the picked chart column an ink bar; wrong takes the bad tone and a
  number waiting to sync is grey; hovers only where a pointer hovers.
  Money's By month and Margin by job stack each month or job on a phone,
  every figure named.
- Move 3, part 2, a head's own department (1.90.0, PR #223): for a head,
  Stock's row counts and its Repairs, Testing and Kit short lists start
  on their department's kit (LX through lighting) under "Showing LX only.
  Show all departments"; widening is kept per step of the tab's history
  (places.ts), so Back finds a list as it was left and the row's count is
  the list's as it opens. A count on Home decides where its list starts,
  everyone's included, and a narrowed list with nothing of theirs keeps
  its card, quiet. Leave counts by approver (ADR 0024), the Timesheets
  count leaves out the office's, a job's CREW fact reads "LX 0 of 1 · all
  5 of 10" with their crew first on the Crew tab, and where the device
  isn't sent money a job says "Quote: with the office".
- Move 6a, part 1, one home for a staff member's leave and bookings
  (1.91.0, PR #224): a staff member's link lists their waiting and
  approved leave (ADR 0024) and ends "Ask for leave in the app ›" instead
  of the days-off form, and the server turns down a days-off post from a
  staff link in the app's words, so a kept page can't post. Home › Me,
  the reader's own person page and the link all say "Your bookings" with
  one glance line and one row shape, from shared/src/bookings.ts (one
  next-booking rule: a held day from today on). An offer to the reader,
  its row and its notification open their link, where it is answered,
  and the link's purchase card loses its "Kit to buy" kicker.
- Move 3, part 3, one item row (1.92.0, PR #225): ItemRow draws an
  item one way on its product's Items tab, the catalogue's Items found,
  the Stock camera's last read and the pick list coming back: its state
  (Missing, Damaged can't go out, a failed or overdue test as bad;
  Damaged fit to go out as warn), "Out with <job> since <day>" (with the
  year when it's another), where it's kept and its serial. While a scan
  of it, or of a case it's in, is unsent, the row, the scan's answer and
  the pick list's row and done line carry the dashed "Waiting to sync"
  pill (MovesView.waiting and countWaiting), never amber. On a pick list
  only the number opens the item (audit of 5 November, finding 92), and
  Report damage opens under its row.
- Move 10a, Home for whoever is looking (1.93.0, PR #226): the Company
  view's first group follows the viewer's role (companyTiles). For the
  office it is "Waiting on the office": late, answers, crew still
  needed, timesheets, quotes worth a call, no answer and documents, with
  the rest under Housekeeping; directors, heads and the warehouse keep
  their order. The quotes worth a call count, for the money roles, is
  Quotes' own chase list (quotesToFollow's chase, a week with no
  answer) and lands on "Waiting for an answer (12) · 3 worth a call";
  Notifications keeps its plain heading. The Menu lists Home under
  Company with a line saying its order follows the viewer (ADRs 0033,
  0035 and 0081 say so).
- Move 8a, arrive on the part (1.94.0, PR #227): an address that names
  a job's part or task lands on it however it's reached (places.ts
  landOn, as Next does, ADR 0109): the tab row under the bar with the
  part's tab focused, or the task's card with its name focused and its
  own part open. Back, Forward and a reload still return to where the
  screen was left. On a phone Stock's catalogue is headed "Catalogue
  (n)", so the strip is back, and a typed search draws the catalogue
  alone; a label's whole six-digit number on one item opens it
  (wholeNumber). Coming back, Back is as wide as Missing, 16px apart.
- Move 6a, part 2, the link says what changed (1.95.0, PR #228): a
  booking's call time, days and venue read as they are now with what
  was said yes to in brackets, "07:30 (was 09:00)", for a week or until
  the call (CHANGE_SHOWN_DAYS, shared since-yes.ts, Colly's question
  10 on its recommendation), from one bounded read of the change log
  per page draw and no write. A booking that ended says how as its
  card's first line, from one table (STOPPED_WORDS) that the question
  before stopping a job reads too; the app's person page and Home › Me
  say "Job cancelled" or "Job lost" with it. Pulling out is "Can't make
  it" on both sides and in the history; Past work and Declined fold
  under "Earlier (n)".

**Waiting**

- Colly's answers to the sweep's thirteen questions (its section 9).
  Each move follows the recommendation until then. Batches 2 to 5 wait
  for Colly.

## 5 November 2026: an audit of every flow, by role, and batches 1 to 4 of its fixes

**Done**

- [Audit, 5 November 2026: every flow, by role](audit-ux-2026-11-05.md),
  at Colly's ask: a functionality, UI and UX audit of the whole app at
  1.77.0. Ten reviews walked 142 flows as each role, on phone and desk, in
  both themes, on a local copy with made-up data, and a sceptic checked
  every finding. 103 findings: no P0, 12 P1, 43 P2, 48 P3. Screenshots are
  in the project folder under screens/audit-ux/. Nothing live was touched.

- Finding 12 fixed the same day (1.77.1, PR #202): the week ahead keeps
  every job's name on a phone.
- Batch 1, "Next and the stages tell the truth" (1.78.0,
  [ADR 0109](adr/0109-next-and-the-stages-tell-the-truth.md)), on Colly's
  "Start with batch 1": findings 1, 2, 3, 4, 16, 18, 19, 22 and 25. Next
  brings what it opens into view and offers only what the role can do,
  and it confirms the job in one press after a yes. A job is through a
  fortnight after it ended with nothing out, kit never scanned is a check
  rather than "not needed", and Kit and vans settled ticks itself once the
  job is under way. Sales whose dates passed go in a fold on the Board, a
  housekeeping count on Home and their own group on Quotes. On the
  audit's copy, Back went from 108 jobs to 12 and the Board from 17,780 px
  to 7,884 px at a desk.
- Batch 2, "keep people where they were" (1.78.1, PR #204), on Colly's
  "Start with the next ones": findings 5, 7, 9, 31 and 87. On Crew, the
  card to send or tell opens in the answer's place or under its call, with
  the focus on it, and Done goes on to the next answer: on the audit's copy
  the page stayed at 2,345 px instead of jumping to the foot of a
  16,000 px page. The freelancer's page leaves room for its sticky line, so
  a thank-you lands below it, and days off come back to their list. Show
  all is kept for Back and a reload. Change details focuses its first
  field, and the quote's refusal has a heading. No ADR: none of it changes
  a decision.
- Batch 3, "get the data right" (1.79.0,
  [ADR 0110](adr/0110-getting-the-data-right.md)), on Colly's "Go for
  batch 3": findings 8, 10, 11, 13, 15, 23, 26, 39 and 43. Undo on a pick
  list is its own record, so it no longer reads as kit back. Scanning out
  kit that's damaged but fit to go says so. A crew list that changes
  someone's email keeps the old one among their other addresses, and
  combining keeps the other phone in the notes. Every refused change has a
  title in Not done, and Director is asked before it's given. A quote line
  says whether its price is a day's or a week's and asks when the charge
  changes, and a line with no price is asked about before the quote goes.
  Timesheets are asked for only from the day they're turned on, and for
  two months after a booking.
- Batch 4, "heads start on their department" (1.79.1, PR #206), on Colly's
  "Go with batch 4": findings 6, 28, 42, 47 and 62. A head's Answers to
  check, the Crew count, People and Running out start on their own
  department, with Show all departments; on the audit's copy the head of
  LX's Crew count went from 76 to 8. Home's count of certificates running
  out lands on that list. Offering a call lists its department's people
  first. For an approver, To approve comes first on Leave with its count,
  their own request isn't counted, and allowances fold to a row each: To
  approve moved from 2,209 px down to 320 px, and the page from 5,381 px to
  3,609 px. No ADR: it carries ADR 0046's start on a head's department to
  the lists that missed it.
- Batch 5, "phone legibility" (1.79.2, PR #207), on Colly's "Go for batch
  5": findings 54, 55, 56, 59 and 86 (12 went in with the audit). On a
  phone, Next and Hand it to someone share one row, taking the dock from
  116 px to 70 px, and the link is in the accent's ink (6.5:1 dark, 5.2:1
  light, was 4.3 and 3.7). Tasks show Next and Late again. Counts on view
  and part tabs are no longer faded (5.1 to 6.1:1, was 3.7 to 4.0). A sent
  quote's lines fold to the name, a line of how many, price, days and VAT,
  and the amount, so nothing is off the right edge. Home's rows, a job's
  map link, the map's zoom, the rack designer's units and the freelancer
  page's links and boxes are 44 px on a touch screen. No ADR.
- Batch 6, "long pages at real size" (1.80.0, PR #208), on Colly's
  "Please do batch 6 & 7": findings 35, 32, 53, 36, 38 and 27. Counted
  rows on a pick list show the one-tap count with "Type how many" behind
  it. The freelancer page folds offers after the three to answer soonest,
  and sent and approved timesheets under one line: on the audit's copy
  the bookings now start at 2,280 px instead of 4,184. To follow up and
  Accepted, unpaid stop at eight with Show all (Money 7,102 to 5,918 px).
  Testing's two paragraphs of product names are two folds with counts,
  opening to linked products (3,823 to 2,139 px). A bay of more than 40
  numbers folds each product to a line, on its page (16,938 to 6,201 px)
  and in its count (15,186 to 5,467 px). Answers to check puts calls in
  the next fortnight first, and declines on calls already full are noted
  in one press. No ADR.
- Batch 7, "switches on with nothing behind them" (1.81.0, PR #209):
  findings 49, 81, 82 and 50. Send quotes by email stays off and can't be
  turned on until operations@ is connected allowing sending, and Send by
  email on a quote needs both. The Claude switch waits for the server's
  key and the to-do card hides until then. Status gives plain steps for
  Claude and the mailbox, pointing at Admin › Connections, and a map
  search outage is "off", not a warning. Past quotes say where they come
  from when there are none. On this screen reads the open tab on Admin,
  and the Menu's Admin line names the switches. No ADR.
- Batch 8a, the office's P2s (1.82.0, PR #210), on Colly's "Go for batch
  8": findings 14, 17, 20, 21, 24, 29 and 30. Needs attention counts jobs
  with a task late and jobs in Planning with the next task down to nobody
  (73 of 131 on the audit's copy), each opening the Jobs list filtered to
  them, and Filter gains Stage and Tasks. Your tasks open on the task
  (#jobs/<id>/task/<key>). A client or venue a letter or two off one
  already here asks "Did you mean", and a new one says it will be added.
  A sent quote's margins are named apart. Timesheet dates carry the year
  as the link's do. Leave for a year not open names who to ask. The link
  page reads a form up to 40 MB, so an 11 MB photo gets the page's own
  "over 10 MB" message. No ADR.
- Batch 8b, the rest of the P2s (1.83.0, PR #211): findings 33, 34, 37,
  40, 41, 44, 45, 46, 48, 51 and 52. Damage can be reported on any item
  back, not only the last one scanned. "No signal" shows the moment the
  phone loses it. A product's "In all" line says how many can't go out,
  linked. The crew-list preview says what a matched person keeps (the
  office's type, level and rate). People search finds a phone number or
  email. Levels are the office's too: staff and freelancers no longer see
  them (written into ADR 0062). Home holds its cards while the phone is
  still catching up and says so, and the all-clear says when some tiles
  aren't yours. Signing in lands on Home. A job and a person each have
  their own history (#history/job/<id>, #history/person/<id>), linked
  from the foot of their page. Tidy up's name boxes start filled, with
  "Keep all these names as they are".

- The P3s, all 41, on Colly's "Work on all" (6 November), in six PRs.
  Batch 9a, the six that matter most (1.84.0, PR #212): findings 64, 73,
  65, 75, 60 and 72. A freelancer reports broken or missing kit from their
  link (/f/<token>/broken), onto Repairs with their name. Calls short in
  the next three days lead To sort out; an offer with no reply-by day is
  chased from the day before the call. Testing a batch asks who's testing
  first. An approved timesheet on the link says when it was paid (the
  invoice details wait for invoicing, 20 Oct 89). The feed says it carries
  rates (ADR 0012, Later). Cable labels with no stock code start on a QR
  code.
  Batch 9b, the freelancer's link (1.84.1, PR #213): findings 63, 66, 67
  and 91. Their page prints light in a dark theme; a link with a stray
  full stop or slash still opens; an old timesheet link says timesheets
  are off; small slips on the day picker, glance line and documents.
  Batch 9c, warehouse and stock (1.85.0, PR #214): findings 68, 69, 70,
  71, 74, 92 and 93. The scanner holds off a second read of the same item;
  kit that can't go out says so on the catalogue and on Home; the 3D rack
  lets a phone scroll and the kit being placed sits in the phone's dock;
  staff crew aren't shown stock work that isn't theirs; a pick list says
  back and still out, and Stock's lists say on now, today, tomorrow.
  Batch 9d, jobs, quotes and crew booking (1.86.0, PR #215): findings 57,
  58, 61, 84, 88, 89, 90 and 95. Add kit stays open for the next product;
  a freelancer is told when the call they were offered filled; a venue's
  or client's jobs are grouped with years; the steps strip says late in
  the bad colour; Admin pages named in words are links; the parts strip
  no longer covers what it jumps to.
  Batch 9e, people (1.87.0, PR #216): findings 76, 78 and 94; 77 left as
  ADR 0082 decided. Combining keeps staff, then offers, then a real name;
  reminders only for those who see to them; archiving someone booked says
  what to withdraw first; archived people can be found and opened; a
  same-name hint when adding someone.
  Batch 9f, Home, Menu, Admin and across the app (1.88.0, PR #217):
  findings 79, 80, 83, 85, 96 to 103. "To set up" on a new company's Home;
  What's changed folds by month, marks what's new and links each decision
  (/adr/<n>); an empty required field is refused in the app's words
  (required.ts); the browser's own Print leaves the chrome out; Disconnect
  asks; in-date checks quiet. That finishes the 5 November audit's P3s.

**Waiting**

- Nothing from Colly: the rest of the P3s are being worked through.

## 1 November 2026: the logo, stock code, cable length and colour on labels

**Done**

- [ADR 0106](adr/0106-logo-length-and-colour-on-labels.md), at Colly's ask:
  a company logo under Admin › Company › Labels, printed on every label;
  the stock code on an item's own label; a length on each product; a
  colour for each length (resistor order to start, the office's to
  change); cable labels with the length in big type and its colour as a
  word in a black band, in colour on a colour printer. 100 m pink and 150 m light blue added at Colly's ask. App 1.76.0.
- Checked: typecheck, shared and server tests, and the browser tests for
  labels, cable labels and the new logo test.

**Waiting**

- Colly to put the logo up once this is live. Colour printers were
  researched in the thread "Print labels straight from the app"; the ZT411
  stays the suggestion, with tape by length.

## 1 November 2026: Trackers on expensive kit

**Done**

- [ADR 0107](adr/0107-trackers-on-expensive-kit.md) (PR #199): Digital Matter
  trackers (the Yabby Edge Cellular recommended in the research) report
  into the app through Digital Matter's HTTP connector, with the server's
  key. Each tracker is made the first time it reports, every report is
  kept, and the app works out where the item is against where it should
  be: the warehouse, a job's venue, with a job, away on no job, or not back
  after its job. The item's page shows it on a map; Kit to check tops
  Notifications for whoever looks after stock; Admin › Connections ›
  Trackers turns it on, puts the warehouse on the map and lists every
  tracker. Off until turned on; staff crew and freelancers don't see where
  kit is. App 1.75.0.
- Checked: typecheck, the shared and server tests (new tracker tests for
  both of Digital Matter's report shapes, the key, late and repeated
  reports, each place and who sees them), and the screens in a browser
  with made-up reports.

**Waiting**

- Colly to buy the trackers, set `TRACKERS_KEY` in Railway and point
  Digital Matter's connector at the app ([setup step
  10](sign-in-setup.md#10-trackers-on-expensive-kit)). The first real
  report should be checked against what the app expects.

## 1 November 2026: What the Security tab found

**Done**

- [ADR 0105](adr/0105-security-tab-and-limits-on-the-ways-in.md) (PR #197):
  limits on the ways in (signing in with Google or the passcode, 60 a minute
  from one address; connecting a calendar or the operations mailbox, 20),
  by the address Railway's proxy saw, and never on the sync, which every
  phone in the warehouse does from one address. HTML read tag by tag in one
  place for emails, job sheets and the AA's page; a job sheet with an odd
  character number no longer stops a bring-in. The device's copy refuses
  "constructor" and "prototype" as well as "\_\_proto\_\_". Four patterns that
  slowed down on long input now run in a straight line. The Blueprint checks
  its markdown reader against cdnjs's hash and no longer reads its documents
  back out of the page. glob held at 14.0.3 or later. App 1.74.1.
- Checked: typecheck, the shared and server tests (new ones for each fix,
  including a sign-in limit test and long-input timings), the web build and
  its offline worker, and the Blueprint in a browser with the real script and
  a tampered one.

**Waiting**

- Colly to look at the Security tab once main is scanned again and say
  what's still open: the alerts from before the first pull request scan
  can't be listed from here.

## 30 October 2026: Send a quote to the client by email

**Done**

- [ADR 0101](adr/0101-sending-a-quote-to-the-client-by-email.md) (PR #188):
  Send to the client on a quote, once the office turns it on under Admin ›
  Connections › The operations mailbox. The compose box is filled in from
  the quote and the client's contacts; the quote goes from operations@
  with its PDF, drawn on the server to say what the printed page says;
  sending marks the quote sent and numbers it; each email that went is
  listed on the quote with its PDF, and in the history. The mailbox
  connection (ADR 0098) now asks Google to send as well as read and moves
  to Admin › Connections. App 1.71.0.
- Checked: typecheck, the shared and server tests (a new server test sends
  through a stood-in Gmail and reads the email back), and the browser tests
  for quotes and Claude. The PDF looked at as an image.

**Waiting**

- Colly to connect operations@ again once this is live, allowing sending,
  and to turn the switch on when ready. Stacked on PR #185 (the quote form)
  and PR #173 (the mailbox); the version numbers move if either lands
  under a different one.

## 30 October 2026: The quote form, redrawn

**Done**

- [ADR 0100](adr/0100-the-quote-form-redrawn.md) (PR #185): the draft
  quote redrawn after an in-depth review against the design system and the
  form research (25 findings, five major). A readout strip that stays in
  view with amber chips that open the first line needing a look; lines as
  rows that open one at a time, the numbers on one row with the unit in
  the box; the cost side folded under the line and saying what it holds;
  travel and subsistence as rows; terms and sending beside the lines on a
  laptop; a line faulted only once it's left. Every feature, name and saved
  shape kept. App 1.69.0 (PRs #183 and #189 to #191 took 1.65.0 to 1.68.0 first).
- Checked: typecheck, the shared and server tests, the web build, and the
  browser tests for quotes, quote follow-up, Current RMS history, Claude,
  access and the shell. Looked at on a phone and a laptop in both themes.

**Waiting**

- PR #173 (the operations mailbox) replaces Ask Claude on the draft with a
  card of what the mail asks for.
- The six learnings for the design system, as a PR there.
## 29 October 2026: Claude drafts quotes from the operations mailbox

**Done**

- [ADR 0098](adr/0098-claude-drafts-quotes-from-the-mailbox.md), Colly's
  change of flow: Claude reads operations@sessionhire.com (read only) every
  five minutes once it's connected under Admin › Company. A new enquiry
  becomes a job and a draft quote as Claude, kept up to date as the thread
  goes on until a person changes it; then the new mail's changes are offered
  on the quote to take or leave. Quotes lists what was read under "From the
  operations mailbox", Admin › Status checks the connection, and the to-do
  list hears of client mail waiting for a reply. Asking Claude in words is
  gone; pasting an enquiry is folded away on New quote.
- Checked: typecheck, server tests with a pretend Gmail (enquiry drafted,
  kept up to date, changes offered after an edit, jobs linked, newsletters
  skipped, off and disconnect), export, erasure and status, and the browser
  test for the quote, Quotes and Admin.

**Waiting on**

- Colly: make operations@ a Workspace user, turn on the Gmail API and add
  the mailbox's redirect address to the Google key, then connect it under
  Admin › Company ([sign-in setup, step 9](sign-in-setup.md#9-connect-the-operations-mailbox)).

## 30 October 2026: The job's kit from its quote

**Done**

- Colly asked for the kit to fill in from what was quoted, still to be
  changed, added to and taken off (ADR 0102 point 7). Jobs made from a past
  quote or by New quote get the quote's kit (products and package pieces,
  hired in as quoted) on the kit list; the Kit card offers what the newest
  quote has that the list hasn't, in one press; the quote's "The job has
  changed" card no longer offers that kit back as new.
- Checked: typecheck, unit tests (kitFromQuote, changesFromJob), the past
  quote browser test now checks the kit list, and the kit, quote and
  Claude browser tests.

## 30 October 2026: A job from a past quote

**Done**

- Colly asked for an action on the quotes from Current RMS to make a job
  from one, to try the app on real jobs (ADR 0102, changing ADR 0092's
  "link and look up only"). "Make a job from this" on a past quote's page,
  and "Make a job from it" on each unlinked one on Quotes: the job's name,
  client, venue, days and status as Current RMS had them, and its draft
  quote with each priced line matched to the stock list where it's the same
  product and charged as it was there (price, rate rule, days, discount);
  lines charged nothing offered unticked; a total agreed on the whole kept.
  The past quote is linked to the new job. App 1.66.0 (takes the next number
  after #185, #173 and #188).
- Checked: typecheck, unit tests (rms-job.test.ts), a browser test from
  the Quotes page to the job's quote, and the quote, Claude, layout and
  access browser tests.

## 30 October 2026: Filter and sort on the long lists

**Done**

- Colly asked for a filter and sort system on the long lists (ADR 0099,
  PR #183): one shared part under the search on Jobs, Quotes, People, the
  catalogue, Venues and Clients. Sort select, Filter button with a select
  per filter (each choice with its count), filters that are on as chips
  that take them off, "N of M" and Clear filters. Kept for the tab's life;
  the order kept on the device. Clients get a search. App 1.65.0.
- Checked: typecheck, unit tests for the orders, filters and counts, a
  new browser test (lists.spec.ts), the layout test's department filter,
  and the whole browser suite.

## 30 October 2026: The big files split

**Done**

- Finding 114 of the [20 October audit](audit-2026-10-20.md) (PR #182):
  the nine hand-written files over 900 lines are split along their seams
  (Quote, stock-import, history, calendar sync, Counts, RackDesigner,
  crew, the sync client, the import plan), code moved and not changed,
  each old file re-exporting what it did. Three stay between 700 and 870
  lines where one class or function is that long. App 1.64.3.
- Checked: typecheck, shared and server tests, the web build (same lazy
  screens), and the browser tests for quotes, racks, counts, stock and
  calendar bring-ins.

## 30 October 2026: A long stock list that keeps up

**Done**

- Finding 97 of the [20 October audit](audit-2026-10-20.md) (PR #181):
  the catalogue's Show all is windowed as Jobs is (ADR 0050), so 300
  products build a few dozen rows rather than a 30,000 px page; search
  first and the first twenty on a laptop (five on a phone) as before.
  Show all (every list) now keeps the page where it was: with the button
  below the fold the browser had carried the page to the list's end.
  App 1.64.2.
- Checked: typecheck, a new browser test with 150 products, and the
  stock and screens browser tests.

## 30 October 2026: Major upgrades

**Done**

- The rest of finding 115 of the [20 October audit](audit-2026-10-20.md)
  (PR #180): vitest 3 to 5 (both critical tinypool advisories gone), PGlite
  0.3 to 0.5, vite 7 to 8 with the React plugin 5 to 6, @fastify/compress 8
  to 9, concurrently 9 to 10. npm audit now shows only four low ones, all
  in deepmerge under vite-plugin-pwa's workbox, used only while building;
  deepmerge has no fixed version and vite-plugin-pwa 2 carries the same
  one, so it stays at 1 until there is. App 1.64.1.
- Left open: TypeScript 7 (later), vite-plugin-pwa 2 (when it clears the
  advisory).
- Checked: typecheck, shared and server tests, the web build and every
  browser test.

## 29 October 2026: Heads see clients' documents

**Done**

- Colly's answer to the open question from finding 39 of the [20 October
  audit](audit-2026-10-20.md): heads of department are sent clients'
  documents and can open their files (PR #178). Staff crew and freelancers
  still aren't. ADR 0062 notes it. App 1.64.0.
- Checked: typecheck, shared tests and the roles tests.

## 29 October 2026: zod 4

**Done**

- Moved zod from 3 to 4 (PR #177), closing the high advisory on oversized
  collections (finding 115 of the [20 October audit](audit-2026-10-20.md)).
  Number fields keep their own wording; a field left out altogether still
  says to reload for the newer app, now told apart by the input zod reports;
  certificate and vehicle check records are partial records; the browser
  runs zod without building code on the fly, which the app's security policy
  refuses. App 1.63.5.
- Left open: vitest 5 and PGlite 0.5.
- Checked: typecheck, shared, server and parity tests, and the browser
  tests for quotes, timesheets, crew and vans.

## 29 October 2026: Tidying behind the scenes

**Done**

- Findings 108, 109 and 111 to 115 of the [20 October
  audit](audit-2026-10-20.md) (PR #171): the parity test compares nested
  records in full and caught joined days keeping their old names offline
  (fixed), and untidy typed text now settles to the same view on both sides; slow label waits get room; the docs say Admin rather than the
  Account tab, freelancer rather than warehouse, and that the Google,
  backups and Sentry keys were all set on 19 October; the field test no
  longer says Start fresh now real data is live; the design system's files
  match what main carries; nine unused parts deleted; one put-away form for places and
  cases; and the security updates that need no major version. App 1.63.4.
- Left open: splitting the six files over 900 lines (when next touched),
  and the major upgrades (zod 4, now first since zod 3 has a high advisory
  on oversized arrays; vitest 5; PGlite 0.5), as one dependency afternoon.
- Checked: typecheck, shared, server, parity and real-Postgres tests, and
  nine browser test files.

## 29 October 2026: Easier on a phone, and printing any screen

**Done**

- Findings 13, 58 to 61, 63 and 74 to 78 of the [20 October
  audit](audit-2026-10-20.md) (PR #170): one fade wherever a row or table
  runs off the edge, 44 px taps on links, folds and small buttons, the
  fortnight charts a week at a time on a phone, settled things quiet
  rather than green, plainer words and a lasting bad-email line, any
  screen printable in light, text trimmed on the phone as on the server,
  the skills offers clear of the tab bar and out of the Tab order, a find
  box on Venues, and rows focused with Tab kept clear of both bars. ADR
  0067 notes it. App 1.63.3.
- Checked: typecheck, shared, server and real-Postgres tests, and 26
  browser test files including a new one for the fades.

## 29 October 2026: Current RMS quotes in the quote history

**Done**

- Colly asked for the Current RMS quotes to be in the quote history rather
  than hidden. Quotes now lists them under the app's own ("Before this
  app, from Current RMS"), found by the same search, narrowed by the same
  choices (Accepted = went ahead, Turned down = didn't, Sent = still to
  come), each with how it went and its linked job's quote. Note 8 on
  [ADR 0092](adr/0092-current-rms-history-on-quotes.md). App 1.63.0.
- Checked: typecheck, server tests (the went filter and links), browser
  tests (rms-history.spec.ts, quotes-page.spec.ts, quote-follow-up.spec.ts).

**Waiting on** nobody.

## 29 October 2026: Claude's to-do list

**Done**

- [ADR 0097](adr/0097-claudes-to-do-list.md), the second part of Colly's
  pick (PR #172), coming "each weekday morning, and on request": with Claude on,
  Home and the top of Notifications show a To do list for the office and
  directors. Claude puts in order the quotes to chase, enquiries with no
  quote sent, crew short in the next fortnight, accepted jobs not invoiced,
  and dates in jobs' notes; each thing links to its job and ticks done for
  everyone. Lists are kept two weeks; erasing anyone deletes them all.
- Checked: typecheck, server tests for the list (written and ticked,
  refused while off, due on weekdays from 7am), erasure and export, and the
  browser test with the stand-in.

**Waiting on**

- Colly: the Anthropic key in Railway's shserver, then Claude turned on
  under Admin › Company. The first morning list comes the weekday after.

## 29 October 2026: Claude reads enquiries into quotes

**Done**

- [ADR 0096](adr/0096-claude-inside-the-app.md), the first part of Colly's
  pick: New quote takes a pasted enquiry, which Claude reads into the job,
  its days, what to ask the client, and the kit, crew and other lines,
  matched to the stock list and priced from the price list on the device.
  Each line is ticked to take, an unsure product offers those most like
  it, and the start button says how many lines go on. A draft quote takes
  "Ask Claude to change this quote", whose answer is shown as changes to
  take or leave. Claude only suggests and contacts nobody; nothing is saved
  until someone takes it. Off until the office turns it on under Admin ›
  Company; the server counts what each ask cost (no words kept) and stops
  at a monthly limit; Admin › Status says what's been spent.
- Checked: typecheck, shared and server tests (Anthropic stood in for),
  and a browser test with a stand-in for Anthropic's API.

**Waiting on Colly**

- An Anthropic API key, put in Railway's shserver as ANTHROPIC_API_KEY
  (and CLAUDE_MONTHLY_LIMIT_USD if $50 a month isn't right), then Claude
  turned on under Admin › Company.
- Next: Claude's to-do list and notifications for the office and
  directors.

## 29 October 2026: a plan for Claude inside the app

**Planned, nothing built**

- Colly asked for Claude in the app in three roles: bringing enquiries in
  during the early quote phase, a PA on email through a new
  operations@sessionhire.com mailbox cc'd on mail, and later a business and
  systems analyst. The plan is a [Claude Doc](https://claude.ai/artifact/6z9f5bSSAMGtZRvqmckD3h):
  Claude only suggests and a person accepts through the same commands and
  role rules; email starts read-only, with replies opened in Gmail for a
  person to send; one switch per role under Admin, off to start; about
  EUR 20 to 60 a month in use plus one Workspace licence.
- Recommended order: enquiries into quotes first, then the mailbox, then
  the weekly report.

**Colly's pick**

- Claude stays inside the app only: no mailbox and no email for now. It
  acts as a PA for the office and directors with a to-do list and
  notifications in the app, and helps start, change and update quotes in
  this early phase. Building that next.

## 29 October 2026: Taking back a bring-in, safely

**Done**

- Findings 51, 52, 53 and 85 of the [20 October audit](audit-2026-10-20.md)
  (PR #169): Take it all back refuses in words when a job has a quote or a
  late note, and keeps people named, changed or used since; a job is known
  by its events, so one that gained an earlier day still comes in and one
  already brought in says so; Mac an and Nic na surnames split properly,
  and those split before are mended on start-up. ADRs 0037 and 0066 note
  it. App 1.60.1.
- Checked: typecheck, shared, server and real-Postgres tests, and the
  bring-in browser test.

## 29 October 2026: cable labels

**Done**

- [ADR 0095](adr/0095-cable-labels.md), at Colly's ask after choosing a
  Zebra ZT411 label printer (thread "Print labels straight from the app"):
  every product has a Cable labels tab printing what it is, such as "10 m
  XLR", in big type on a wrap-round (50 × 25 mm), flag (100 × 25 mm, both
  ends) or bag label, two by default, with the stock code as a Code 128
  barcode, a QR code, or none. A stock code scanned or typed in the Stock
  search opens its product. App 1.60.0.
- Checked: typecheck, shared tests (the barcode's widths; decoded by
  zxing-cpp when written), e2e cable-labels.spec.ts plus the labels, stock
  and scan specs.

**Waiting**

- iPhones read only QR codes in the app's camera for now; Code 128 needs a
  1D reader in the fallback. One-tap printing to the ZT411 (no print
  dialog) waits on Colly's pick of the options in that thread.

## 29 October 2026: Home at volume

**Done**

- Findings 32, 33, 62, 68, 69, 70 and 80 of the [20 October
  audit](audit-2026-10-20.md) (PR #168): the week ahead one line per job
  with errands folded, Needs attention split into the next fortnight and
  housekeeping, links under the charts that look like links,
  notifications grouped into lines with the bell counting lines, "Your
  day" on Me, days in lieu said, and Working this week readable on a
  phone. ADRs 0033 and 0058 note it. App 1.59.0.
- Checked: typecheck, shared, server and real-Postgres tests, and 45
  browser tests.


## 29 October 2026: Money says what its figures are

**Done**

- Findings 27 to 31, 71 and 79 of the [20 October
  audit](audit-2026-10-20.md) (PR #167): half-typed quote lines kept,
  "Accepted, unpaid" with VAT split into invoiced and not, one rule for
  cancelled and lost jobs, Margin by job by month with losses named, and
  ink links on amber lines. Finding 28 was already fixed. ADR 0042 notes
  it. App 1.58.0.
- Checked: typecheck, shared and server tests, and 32 browser tests.

## 29 October 2026: a freelancer's own page

**Done**

- Findings 47 to 50, 86 and 89 to 92 of the [20 October
  audit](audit-2026-10-20.md) (PR #166): link pages compressed, the next
  three bookings in full and the rest a line each, a refusal that names
  the job, checked days off that merge and warn over a booking, own
  calendars tried again after a failed read, years on dates, mistakes said
  beside their field, one sent line on a timesheet, and a plain Share
  button. ADRs 0002, 0033 and 0049 note it. App 1.57.0.
- Not built: the invoice details finding 89 defers to ADR 0022's invoice
  step, which waits on Colly.
- Checked: typecheck, shared, server and real-Postgres tests, and 35
  browser tests.


## 29 October 2026: Stock puts today's work first

**Done**

- Findings 97 to 106 of the [20 October audit](audit-2026-10-20.md)
  (PR #165): going out before still out, twenty products on a desk, a
  scanner that works without a tap, plainer words on setting numbers
  aside, an item found through its case and taken back out, no packing
  into a case that's out, a faster next label number, and a re-run stock
  list that adds up and notes price differences. Finding 100 was already
  fixed. ADRs 0017 and 0018 note it. App 1.56.0.
- Left open: the catalogue's long page after Show all on a desk (finding
  97), as search is the designed way in.
- Checked: typecheck, shared, server and real-Postgres tests, and 17
  browser test files.

## 29 October 2026: heavy jobs that held everyone up

**Done**

- Findings 17, 18, 19, 54 and 110 of the [20 October
  audit](audit-2026-10-20.md) (PR #162): a calendar bring-in saves new
  people and venues a few hundred at a time and plans once, a big calendar
  off the main thread; the export and backup read each table in one go and
  build the zip a slice at a time; a deploy waits for a backup in progress
  and the next server makes up one it stopped; slow backup tests given
  room. ADRs 0004, 0006 and 0011 note it. App 1.55.1.
- Checked: typecheck, shared, server and real-Postgres tests, and 11
  browser tests.


## 29 October 2026: the warehouse's small hurts

**Done**

- Findings 40 to 46 and 93 to 96 of the [20 October
  audit](audit-2026-10-20.md) (PR #161): Back and Missing apart with Undo,
  numbers that don't break, damage reports confirmed, counts and Testing
  folded with Finish in reach, Repairs grouped by what can't go out with a
  department filter, clearer scan answers, a retired item off Coming back,
  two missing reports as one loss, and a priced product removable. ADRs
  0017, 0018 and 0042 note it. App 1.55.0.
- Checked: typecheck, shared, server and real-Postgres tests, and 32
  browser tests.


## 29 October 2026: the office's crew day

**Done**

- Findings 23 to 26, 72, 73 and 81 to 84 of the [20 October
  audit](audit-2026-10-20.md) (PR #160): Crew needed shows the next
  fortnight with the rest a tap away and today's late calls on their own
  line; unanswered offers past their reply-by day wait in Answers to
  check; declined offers stay declined; counters noted offline show their
  rate; mixed call lines name each state; Offer anyway says what can be
  taken; resends keep the booking's rate and the office's days; approvers
  can't set their own allowance while another can. ADRs 0002 and 0024 note
  it. App 1.54.0.
- Checked: typecheck, shared, server and real-Postgres tests, and 40
  browser tests.


## 29 October 2026: opening on the screen's shape, and less to fetch

**Done**

- Findings 11, 12 (in part), 14 and 65 of the [20 October
  audit](audit-2026-10-20.md) (PR #159): the app opens on the tab bar and a
  skeleton of the screen, then says it is reading the phone's copy;
  notifications are looked for once the copy is read and then only after
  news; the map and the 3D rack drawing are fetched the first time they are
  shown; where the scans leave the kit is kept through a change to a job.
  Finding 64 did not reproduce on current main. ADRs 0016, 0057 and 0076
  note it. App 1.53.0.
- Checked: typecheck, shared, server and real-Postgres tests, and 60
  browser tests.

## 29 October 2026: edits checked against what each device saw

**Done**

- Findings 15, 16, 20, 21, 22, 66, 67 and 88 of the [20 October
  audit](audit-2026-10-20.md) (PR #158, Colly asked for all remaining
  items): the rest of the edits that save typed text are checked against
  what the device saw, pushes take fewer database trips and stop when the
  phone has gone, refused changes skip the write lock, a bad pull cursor
  gets a plain answer, and database faults are logged without their rows.
  ADR 0049 notes what still applies in arrival order. App 1.52.1.
- Checked: typecheck, shared, server and real-Postgres tests, and 13
  browser spec files.

## 29 October 2026: staff crew's own work first, and others' details kept

**Done**

- Findings 34 to 39 of the [20 October audit](audit-2026-10-20.md) (PR #156,
  Colly chose "Roles first"): a role without crew starts Home on Me and
  Crew on People, with no Answers card and only its own timesheets; Home ›
  Me links to their own page and says confirmed or accepted on each
  booking; others' timesheet notes, documents' details in the history, and
  clients' documents are held back on the server. ADR 0062 notes it. App
  1.52.0.
- Checked: typecheck, shared and server tests, and the browser tests for
  Home, Crew, a person's page and timesheets.

## 29 October 2026: calendar writes off unless asked for

**Done**

- Finding 107 of the [20 October audit](audit-2026-10-20.md) (PR #155,
  Colly chose "Roles first"): the calendar sync now writes only when told
  to, rather than unless told not to, so a caller that forgets the setting
  can't reach the real calendar. Live is unchanged (still read-only until
  `CALENDAR_WRITES=on`). ADR 0008 notes it. App 1.51.2.
- Checked: typecheck and the calendar, import, Postgres and status tests.

## 29 October 2026: a director's sign-in is the directors' to change

**Done**

- Finding 10 of the [20 October audit](audit-2026-10-20.md) (PR #138, Colly
  chose "Directors only"): a director's email, type, main address and
  combining need a director, and no command gives the sender's own sign-in
  address to another person, so the office can't take a director's account
  in two steps. A director may still combine her own two records. ADR 0064
  notes it. App 1.51.1. All ten P1s of the audit are now fixed.
- Checked: typecheck, shared and server tests.

## 28 October 2026: certificates on stock items

**Done**

- [ADR 0094](adr/0094-certificates-on-items.md), at Colly's ask: numbered
  items keep their certificates, a PAT certificate, a report of thorough
  examination (motors and other lifting gear) or another (a declaration of
  conformity, an FR certificate), each a file, a link, or both, kept as
  venues' documents are. One certificate covers a whole round. A test's
  certificate is the one of its kind on its item dated its day, so the
  tests stay as recorded. On an item's page each test has its certificate
  to open, or Add certificate beside a pass, and a Certificates card lists
  them all; after a round on the Testing page one report goes on every item
  that passed; Inspections due lists other certificates running out and
  how many tests have none yet. Nothing new stops kit going out: failed or
  overdue tests still do. App 1.51.0.
- Checked: typecheck, server tests (item-certificates.test.ts: links,
  files, a round, refusals, history words, strays, starting fresh, no
  bucket), device tests (which test a certificate is for, running out,
  waiting changes), browser tests (item-certificates.spec.ts, inspections
  and scanning).

**Waiting on** the storage bucket on the live server for files; links work
meanwhile. Emailing certificates to a venue from a job could follow.

## 28 October 2026: a status page for everything the app relies on

**Done**

- [ADR 0093](adr/0093-system-status.md), at Colly's ask: Admin › Status
  (office, directors, system admins) checks thirteen things at once and says
  in a sentence how each stands and what to do when one needs someone: the
  server and its version, whether main has a newer version Railway hasn't
  deployed, the database (speed and size), sign-in, error reports, live
  updates, nightly backups, the bucket, Google Calendar, crew's own
  calendars, Current RMS, the AA fuel price and the map search. Read only:
  nothing is written to Google and nobody is contacted. Kept for a minute;
  Check again asks afresh. `/api/health` now gives the version and commit.
  App 1.49.0.
- Checked: typecheck, server tests (status.test.ts: every check's words and
  what to do, a newer version on main, services down, the minute's keep, a
  real backup and bucket; crew refused), browser tests (status.spec.ts, and
  the layout, access and backups tests).

**Waiting on** nobody. Telling the office in Notifications when a check
turns bad could follow.

## 28 October 2026: every page the same width

**Done**

- [ADR 0091](adr/0091-one-page-width.md), at Colly's ask: every page in the
  app is one width at a given window size (full width to 640px on a phone,
  up to 1200px beside the sidebar from 900px), planner, job page and the
  catalogue beside a record included. Before, Stock's pages alone were
  960, 1072 or 1400px. Only sign-in keeps the phone's width. A card's
  paragraphs stop at about 75 characters instead. App 1.48.1.
- Checked: a browser test walks every area's pages, Admin, You and Home on
  a phone, a laptop and a 1680px screen and fails on any difference (it
  failed on main as it should).

## 28 October 2026: Current RMS's history on quotes

**Done**

- [ADR 0092](adr/0092-current-rms-history-on-quotes.md), part 4 of the
  quoting plan. Match to jobs (`#jobs/money/current-rms/match`): each
  opportunity beside its likeliest job by days, client and name; link one,
  link all the sure ones, unlink. Links kept in `rms_matches` (server only).
  A job's quote has an "In Current RMS" card (linked past quotes, the
  client's record); a line being priced shows what it was last charged to
  the client and to anyone, with "Use €X". Past quotes has a By client card
  (went ahead of those decided, usual discount, last). Colly chose "Link and
  look up only": no jobs made from old quotes. App 1.50.0.
- Checked: typecheck, shared tests (outcomes, client names, matching, client
  records), server tests (matches, link and unlink, a job's past quotes,
  last charged, by client), browser tests (rms-history.spec.ts and the
  quotes tests).

**Waiting on** Colly: read Current RMS again from Admin › Connections if it
has been a while, then link the sure ones on Match to jobs.

## 28 October 2026: timesheets can be turned off, and start off

**Done**

- [ADR 0090](adr/0090-timesheets-off-until-used.md). A "Timesheets" switch
  under Admin › Company, off by default (Colly won't use them on day one).
  While off: no Timesheets page in Crew's row or the Menu, no Home count, no
  notifications of them, nothing on freelancers' links (their timesheet page
  is 404 and a post is turned down), and Money's "Owed to freelancers" only
  if some approved are still to pay. Nothing deleted. Made-up data turns
  them on. App 1.48.0.
- Checked: typecheck, shared and server tests (off by default, link page and
  post refused while off, kept and back when on, the history entry), browser
  tests (timesheets-switch.spec.ts, and the timesheet, crew row, home,
  departments and access tests).

**Waiting on** nobody. Colly turns them on under Admin › Company when needed.

## 28 October 2026: Quotes, a place of its own

**Done**

- [ADR 0088](adr/0088-quotes-in-the-sidebar.md). Quotes (`#quotes`) is a
  sixth place in the desk sidebar, after Jobs, for those who see money; on a
  phone it's on the Menu, which keeps its tab. The page has "To follow up"
  (moved from Money, with New quote) and "All quotes": each job's quote, the
  last changed first, found by job, client, venue, number or invoice and
  narrowed by what it is. Money keeps the figures and links to it. App
  1.47.0.
- Checked: typecheck, unit tests (the list, its order, a draft over a sent
  version, narrowing and finding), browser tests (quotes-page.spec.ts: the
  sidebar on a desk, the Menu on a phone; quote-follow-up.spec.ts moved to
  Quotes).

## 28 October 2026: availability, subhire and margin on quotes

**Done**

- [ADR 0089](adr/0089-availability-subhire-and-margin-on-quotes.md), part 3
  of the quoting plan. Each kit line is checked against the job's days by
  the kit's hold rules, leaving out the job's own kit. Short lines say so
  and offer "Hire in". Lines carry how many are hired in, the supplier and
  what they cost us (`subhireQty`, `supplier`, `costCents`), with crew
  costed at booked rates when left empty. "Add transport" adds the job's
  vans. The office and directors see each line's margin and the quote's,
  never printed.
  App 1.46.0.
- Checked: typecheck, unit tests (enough kit, what's wanted, line costs,
  margin), server (cost side kept, supplier trimmed), browser test
  (quotes.spec.ts: short, hired in, transport, nothing printed).

## 28 October 2026: crew travel by car, and the fuel price kept up from the AA

**Done**

- Travel on quotes is the crew's own, not the vans': a car trip there and
  back for each crew day, or each car load ("Crew to a car" in Admin), at
  6.5 litres for 100 km unless set. Van fuel stays in the transport lines.
- [ADR 0086](adr/0086-travel-and-subsistence-on-quotes.md), added to. The
  server looks at the AA's survey once a day and takes a new month's diesel
  price the day it appears (it comes out on the second Monday), unless
  Admin's switch is off; a price more than 30% from the last waits for
  someone. Admin says which survey the price is from. App 1.45.0.
- Checked: typecheck, server (taken once a month, not when off, not a far
  jump, the history entry), parity, browser test (quotes.spec.ts).

## 28 October 2026: packages

**Done**

- [ADR 0087](adr/0087-packages.md), part 2b of the quoting plan. Packages on
  the price list (`packages`): a name, the department it's listed under, a
  price and rate rule, the products it holds and anything else it includes.
  "Add a package" on a quote puts it on as one line, with what it holds
  written on the line (`includes`) and printed under it. App 1.44.0.
- Checked: typecheck, unit tests (what a package prints, saved, changed and
  taken off, only products in the stock list), parity, browser test
  (quotes.spec.ts: a package made on the price list, added to a quote and
  printed).

## 28 October 2026: travel and subsistence on quotes

**Done**

- [ADR 0086](adr/0086-travel-and-subsistence-on-quotes.md). A quote works
  out the crew's travel (past a distance from Dublin city centre, the fuel
  there and back for each van) and subsistence (a per diem for each crew
  day, off when "Meals provided" is on) as two lines of its own. Admin ›
  Company › Travel and subsistence sets the distance, the fuel price (read
  from the AA's monthly survey in one press), what a van uses and the per
  diem. App 1.43.0.
- Checked: typecheck, unit tests (distance, fuel, crew days, the lines and
  why there's none), server (settings, quote fields, the AA's page read and
  refused), parity, browser test (quotes.spec.ts).

**Waiting on**

- Colly: set the fuel price (Read the AA's price, then Save) and the per diem
  in Admin › Company › Travel and subsistence.

## 28 October 2026: rate rules, discounts and an agreed price

**Done**

- [ADR 0085](adr/0085-rate-rules-discounts-and-an-agreed-price.md), part 2a
  of the quoting plan. Each product price is charged Daily, 3 Day Week or
  Weekly (`product_prices.rate`), and "Take the rules from Current RMS" on
  the price list gives each priced product the one its Current RMS lines
  were charged by most. A kit line charged by a rule keeps its days out and
  works out its days charged. Lines have their own discount, a department
  can be given one at once, and "Agree a total" (`quotes.agreed_cents`) makes
  the discount whatever comes to the price agreed. App 1.42.0.
- Checked: typecheck, unit tests (the three rules against Current RMS's
  counts, a line's discount, an agreed price across VAT rates, a rule kept
  through an older app's change, rules taken from Current RMS lines by name
  and other name), parity, browser test (quotes.spec.ts).

**Waiting on**

- Colly: read Current RMS's quotes if not already, then press "Take the
  rules from Current RMS" on the price list.

## 28 October 2026: product photos and the rack sheet

**Done**

- [ADR 0083](adr/0083-product-photos-and-the-rack-sheet.md), part 3 of 3 of
  the advanced rack builder. A product can have a photo (`models.photo_*`,
  kept as people's photos are, changed by whoever changes stock, seen by
  everyone signed in), kept at its own shape; it shows on the product's
  page, in the lists, and on its panel in the rack, flat and in 3D. Print
  the rack sheet, on the rack's page and in the designer: front and back,
  groups, what goes where and what's loose, black on white. App 1.40.0.
- Checked: typecheck, unit tests (a product's photo put up, replaced,
  taken down, gone with the product, and who can), browser test
  (racks.spec.ts: a photo from the product's page on its panel, and the
  sheet as it prints).

**Next**

- Nothing more planned for racks. Sizes from a list of known models were
  left out (see the ADR).

## 28 October 2026: the printed quote

**Done**

- [ADR 0084](adr/0084-the-printed-quote.md), part 1c of the quoting plan.
  Quote numbers given when a quote is first sent, kept on every version,
  carrying on from Admin's "next quote number" (1115, after Current RMS);
  valid until (30 days unless changed) and a deposit on each quote; terms
  and bank details in Admin; a client address for quotes; the printed page
  laid out as a letter; "What changed since version 1". App 1.41.0.
- Checked: typecheck, unit tests (numbers, valid until, deposit, version
  changes), server tests (numbering, the next number refused below one
  given, the address kept by an older save), parity, and the quotes e2e
  test extended through printing, numbering and a second version.

**Waiting on Colly**

- In Admin › Printed quotes: set the next quote number to 1115, and type
  the terms and bank details.

**Next**

- Part 2: the three rate rules, line and department discounts, "Agree a
  total", packages.

## 27 October 2026: starting a quote and following it up

**Done**

- [ADR 0081](adr/0081-starting-a-quote-and-following-it-up.md), part 1b of
  the quoting plan. New quote on Money (an enquiry and its draft from a
  name, client and days); marking a quote sent makes the job quoted; an
  answer offers to confirm the job or mark it lost; Money lists quotes
  waiting on the office, and Notifications the ones worth a call. App
  1.39.0.
- Checked: typecheck, unit tests (`quotesToFollow`), a new e2e test from New
  quote to confirming the job, and the quotes e2e test.

**Next**

- 1c: the printed quote (number, valid until, terms, deposit).

## 27 October 2026: building a rack up

**Done**

- [ADR 0079](adr/0079-building-a-rack-up.md) (PR #132), part 2 of 3 of the
  advanced rack builder. Narrower kit sits side by side (`rack_slots.across`);
  rack parts are products (`models.rack_part`: blank, vent, shelf, drawer),
  with the usual six added in one press and Fill the gaps with blanks; loose
  kit in a shelf or drawer (`in_slot_id`); a label, group and tape colour on
  each slot, the tape drawn as content; undo and redo in the designer; Copy
  this rack. App 1.38.0.
- Checked: typecheck, unit tests (racks, parity, export), browser test
  (racks.spec.ts: halves side by side, label and tape, undo and redo, a
  drawer with a loom in it, blanks, a copy).

**Next**

- Part 3: product photos on the panels and a printable rack sheet.

## 27 October 2026: a quote that saves itself and keeps up with the job

**Done**

- [ADR 0080](adr/0080-a-quote-that-saves-itself-and-keeps-up-with-the-job.md),
  part 1a of the quoting plan, on Colly's ask for ease of use and clarity.
  The draft saves itself; the total and lines with no price stay in view;
  lines read as a list, one open at a time; lines charged once as well as
  by the day; Add kit / Add crew priced from the price list; Undo on
  Remove; "The job has changed" offers the job's new kit and crew. App
  1.37.0.
- Checked: typecheck, unit tests (charged once, changes from the job), the
  e2e quote test on a phone, and the pick tests (the "stay under the top
  bar" hook moved to its own file).

**Next**

- 1b: starting a quote from Money with a client and dates, the job kept in
  step with the quote, and quotes to follow up in To sort out.
- 1c: the printed quote (number, valid until, terms, deposit).

## 23 October 2026: reading Current RMS through its API

**Done**

- [ADR 0078](adr/0078-reading-current-rms-through-its-api.md) (PR #131),
  the first step of the quoting engine, on Colly's ask. The server reads
  Current RMS's API with the key Colly saved on Railway (`CURRENT_CMS_KEY`,
  subdomain `sessionhire`), GET only: every opportunity and its lines into
  `rms_opportunities` and `rms_lines`, a request a second, "too many" waited
  out, a second read re-reading only changed lines. Admin › Current RMS
  starts, shows and stops a read and downloads two spreadsheets; Jobs ›
  Money › Past quotes lists and opens them. Office and directors only. App
  1.36.0.
- Checked: typecheck, unit tests (a stand-in Current RMS), export.

**Next**

- Colly runs the first read on live and sends the downloads or an export,
  to shape parts 1 and 2 of the quoting plan.

## 23 October 2026: rack-mount kit and the rack in 3D

**Done**

- [ADR 0076](adr/0076-rack-mount-kit-and-the-rack-in-3d.md) (PR #129), part 1 of 3 of
  Colly's "more advanced rack builder", after a survey of web rack builders
  (STAGERACK, Rackula, ConnectCAD, Stardraw, Lanberg). Products get a
  Rack-mount tick box that reveals height, width (full, half, third) and
  depth (`rack_mount`, `rack_width`); rack cases get outside size, castors
  and a power limit in amps. Layout totals add amps and heat, and say a rack
  too heavy to lift or past its power, and kit on the rails that isn't
  rack-mount. The designer draws the rack in 3D (three.js, lazy-loaded):
  turn, zoom, square views, drop or press kit onto the face towards you; and
  from the side. App 1.35.0.
- Checked: typecheck, unit tests (racks, parity, export), browser test
  (racks.spec.ts: 3D placing, side view, rack-mount tick box).

**Next**

- Part 2: half-width kit side by side, shelves, drawers, blanks, labels and
  colours, undo, copy a rack. Part 3: product photos on the panels and a
  printable rack sheet.

## 23 October 2026: the purchase list, with votes

**Done**

- [ADR 0077](adr/0077-the-purchase-list.md) (PR #130). Stock › Purchase
  list (`#stock/buy`): anyone signed in asks for kit to be bought and votes,
  one vote each; asked for and agreed ranked by votes; the office and heads
  say where each is at; whoever asked sees changes in Notifications. A list
  comes in from a .csv at `#stock/buy/bring-in`, names matched to the Crew
  tab, the same list twice adding nothing. App 1.34.0.
- The WhatsApp group's export sorted into 38 requests, kept in the
  project's private files for the office to bring in on the live app.
- Checked: typecheck, unit tests (purchases, parity, roles, history,
  export, erasure pointers), browser test (purchases.spec.ts).

**Waiting**

- Colly brings the WhatsApp list in on the live app (Stock › Purchase list
  › Bring in a list).

## 22 October 2026: dry hire stock and the rack designer

**Done**

- [ADR 0075](adr/0075-dry-hire-stock-and-the-rack-designer.md) (PR #128), part 2 of
  racks. Every product is Ours or Dry hire (`dry_hire`, `supplier`,
  `hire_day_cents`); the catalogue filters by Whose; dry hire can't have
  items or counts, is never short on a job ("hired in"), and a built rack
  isn't missing it but lists it to hire in. The rack designer at
  `#stock/racks/<id>`: kit to build with (search, whose, free on a day)
  beside the rack front and back; drag or press to put in, move and take
  out; totals include the dry hire's day rate and buy price. App 1.33.0.
- Checked: typecheck, unit tests (dry hire refusals, parity, racks), and
  browser tests (racks.spec.ts: designer drag, press, move, take out,
  catalogue filter).

## 22 October 2026: racks

**Done**

- [ADR 0074](adr/0074-racks.md) (PR #127), part 1 of Colly's ask for racks
  in the stock and a rack designer. A rack is a product marked as a rack
  (always a numbered case) with its own stock code; each built one is an
  item holding its kit, so scanning it takes the lot. Any product can have
  a stock code (found by search and the product picker) and a size: rack
  units, depth, weight, power. Each rack has a layout (`rack_slots`,
  `rackSlot.set`/`remove`): what goes at which unit, front or back, or
  loose. The app draws it front and back, adds up units, weight and power,
  and says what won't fit (off the bottom, on top of something, too deep,
  front and back meeting); the server never refuses a plan. Built racks
  are checked against the layout ("2 missing"). Kit built into a rack isn't
  free for jobs on its own. Stock › Racks lists them. App 1.32.0.
- Checked: typecheck, unit tests (racks, parity, export and the rest), and a
  browser test (racks.spec.ts).

**Next (part 2, done above)**

- Ours or dry hired in on every product (supplier, hire and buy price),
  a catalogue filter, dry hire never short; then the rack designer
  (drag gear in, owned and dry hire, same checks, cost to buy or hire in).

## 22 October 2026: each job's steps, and who has each

**Done**

- [ADR 0073](adr/0073-a-jobs-steps-and-who-has-each.md) (PR #126), on
  Colly's ask for a line of steps on every job page, from the quote to the
  deprep, each given to a member of staff and on their to-do list. Eight
  steps for gigs and dry hires; the app ticks Quote sent, Confirmed, Crew
  booked, Picked, On the job and Back in from the job's own records, and
  Kit and vans and Deprepped are ticked by hand (any step can be). Steps
  are given to staff (`job_steps`, `jobStep.set`, a new `steps` ability:
  staff crew change only their own). "Your steps" on Home, and
  Notifications for a step given to you; nothing is sent outside the app.
  App 1.31.0.
- Checked: typecheck, unit tests (steps, roles, parity, export), and a
  browser test (steps.spec.ts).

**Not done, for later if wanted**

- Choosing the steps per company, due dates on steps, and an office list
  of every step by who has it.

## 22 October 2026: picking on the phone

**Done**

- [ADR 0072](adr/0072-picking-on-the-phone.md) (PR #125), on Colly's ask
  to think through a warehouse hand or head of department who inherits a
  pick list and picks it on a phone. Built on the audit's shorter pick
  list (PR #120). Going out, the pick list now says when the kit is first
  needed, where, and the vans booked; "Whose kit" narrows it to one
  department (a head starts on their own), with rows left in each; "By
  where it's kept" lists what's left place by place; kit line notes show
  on rows; the answer to a scan or count has Undo (the opposite movement,
  nothing deleted); counted kit has "Count out the 12" and "Count back all
  12"; "All 40 out: ready to load."; and the screen is kept on while
  picking. Department and order are kept on the phone (`sh.pick`). No
  server change. App 1.30.0.
- Checked: typecheck, unit tests, and the browser tests, with a new one
  for picking on the phone (pick.spec.ts) and the pick and faults tests
  reading the new total.

**Not done, for later if wanted**

- Who scanned what, a "picked by" sign-off the office sees, and splitting
  one pick list between two people.

## 22 October 2026: the backup check gives its memory back

**Done**

- Finding 9 of the [20 October audit](audit-2026-10-20.md) (PR #124): the
  nightly test restore ran in a worker thread that took the server to
  about 1 GB and kept 420 MB after. It now runs in a child process capped
  at 512 MB that ends when the check does (about 1 MB kept), and backups,
  test restores and the exports take turns. ADR 0004 notes it. App 1.29.5.
- Checked: typecheck, unit tests, and the backup server tests (memory
  growth under 150 MB over three restores; a timed-out restore fails).

**Waiting on Colly**

- Railway's memory limit for the app is worth raising to 2 GB on the
  dashboard, as the audit says.

## 22 October 2026: combining people keeps the leave allowance

**Done**

- Finding 8 of the [20 October audit](audit-2026-10-20.md) (PR #123):
  `person.merge` moved leave allowance rows to the kept person but left
  their ids keyed to the person merged away, so the allowance vanished
  from devices. The move now re-keys each row to the kept person and year
  and tells devices the old one is gone; a leave migration puts right any
  row already moved wrongly. App 1.29.4.
- Checked: typecheck, unit tests, and the merge and leave server tests.

## 22 October 2026: a second stock bring-in doesn't double the counts

**Done**

- Finding 7 of the [20 October audit](audit-2026-10-20.md) (PR #122): a
  second Current RMS bring-in with another place typed counted every
  product at both places, and a rename there made a new product. The
  bring-in now carries Current RMS's id onto the product
  (`models.list_id`) and matches by it before the name; a count at a place
  the list doesn't mention is set to none where the place was typed for
  the whole list ("Counts none at Store one (12 there now)"), or noted
  where the row names its own place; a new product with the same category,
  value and count as an unnamed one says "Looks like Amp renamed". The
  238 products already live pick up their id, by name, on the next
  bring-in. [ADR 0056](adr/0056-bringing-the-stock-in-from-current-rms.md)
  notes it. App 1.29.3.
- Checked: typecheck, all unit and server tests, with new ones for the
  move, the aside, the rename by id and by likeness, and the whole round
  trip on the server.

## 22 October 2026: Accept after a counter takes the rate offered

**Done**

- Finding 6 of the [20 October audit](audit-2026-10-20.md) (PR #121): a
  freelancer who countered and then pressed Accept was booked at their own
  rate. On a countered card Accept now reads "Accept these days at €250 a
  day instead" (or "the rate the office sets"), Send rate is the main
  button, and accepting withdraws the counter with the words "the rate
  you asked for is withdrawn. The office will confirm." App 1.29.2.
- Checked: typecheck, unit tests, and the crew server tests.

## 22 October 2026: a shorter pick list, with the scan box kept in view

**Done**

- Finding 5 of the [20 October audit](audit-2026-10-20.md) (PR #120): a
  300-line pick list measured 56,142 px on a phone, mostly every item
  number written out under "Where to find them", and the scan box scrolled
  away. Each place is now one line ("Bay A1: 12 here") with its numbers
  folded; lines done fold under "N done" at the foot of their department;
  the scan box, what it said and anything that failed stay docked under
  the top bar while the camera is off. App 1.29.1.
- Checked: typecheck, unit tests, and the pick list and faults browser
  tests (the scan field stays in view after scrolling).

## 22 October 2026: Home counts open on what they counted

**Done**

- Findings 3 and 4 of the [20 October audit](audit-2026-10-20.md) (PR
  #119): Home offered counts to roles that couldn't act on them, and every
  count opened the top of a whole-company list. Each tile now needs the
  ability its screen asks for (timesheets and leave to approve need the
  approving ability, crew tiles crew, stock tiles stock); tapping one lands
  on the part it counted, focused, with Back and Forward keeping it; and a
  department's count opens the list narrowed to that department, with
  "Showing Video only. Show all departments". App 1.29.0.
- Checked: typecheck, all unit and server tests, and the Home, departments
  and screens browser tests.

## 22 October 2026: the Jobs tab opens quicker

**Done**

- Finding 2 of the [20 October audit](audit-2026-10-20.md) (PR #118): a
  tap on Jobs took 1.3 s cold on a slowed phone at 800 jobs, half of it
  the Tidy up nudge comparing every pair of jobs. The nudge now checks for
  a calendar job first, the analysis is kept while the jobs and people are
  the same, the pair check stops once jobs start too late to be near
  (about 250 ms to 22 ms at 810 jobs here), and the Jobs list's counts and
  weeks are worked out only when something they read changes. App 1.28.1.
- Checked: typecheck, all unit and server tests, and the Jobs, Tidy up,
  import and screens browser tests.

## 22 October 2026: a new phone says when it is still catching up

**Done**

- Finding 1 of the [20 October audit](audit-2026-10-20.md) (PR #117): a
  new phone or computer said "Up to date" while its first copy of the
  company was still arriving, and Home showed empty counts meanwhile. The
  sync client now remembers whether it has ever read to the end and tells
  screens how far it has got; the top bar says "Catching up · 40%", Home's
  tiles, charts and lists say they are still catching up instead of
  showing nothing, and the Crew badge waits. Devices that already hold a
  full copy are unaffected. App version 1.28.0.
- Checked: typecheck, all unit and server tests, and the browser tests.

## 22 October 2026: the checks pass on Thursdays

**Done**

- Finding 57 of the [20 October audit](audit-2026-10-20.md) (PR #116): the
  shared test seed asked for leave 30 and 31 days ahead, which on a
  Thursday is a Saturday and a Sunday, so 116 server tests failed one day
  in five. The seed and the parity test now pick working days (Colly's
  "separate small PR"). App version 1.27.1; nothing on the screens changes.
- Checked: typecheck, all unit and server tests, on the Thursday itself.

## 22 October 2026: a full audit at real size, by role

**Done**

- A full audit of the app as it stood on 20 October, once the 18 October
  audit's fixes and the week's features were in
  ([Audit, 20 October 2026](audit-2026-10-20.md), Colly's ask): the
  server, the sync engine and the data; every screen as each kind of
  person, on a phone and a desk; and speed on a slow phone and at the
  distance from Railway to Neon. Three reviews side by side, every finding
  re-run and weighed independently, and the three folded into one list:
  115 findings (no P0, 10 P1, 47 P2, 58 P3), with each of the 18 October
  findings re-checked (12 fixed and holding, 14 partly, the leftovers
  numbered). The P1s: "Up to date" shown before a new phone's first copy
  has arrived, the Jobs tab's second on a phone, Home's tiles offered to
  people who can't act on them and landing on the whole company's list, a
  300-line pick list fifty-six thousand pixels long, Accept on a countered
  offer booking the original rate, a second stock bring-in doubling counts,
  combining people losing a leave allowance, the backup's test restore
  taking the server to Railway's 1 GB limit, and the office able to take
  the director's account with the settings ability.
- Checked: everything was local on copies seeded at the company's size;
  nothing live was read or changed, nothing was written to Google, and
  nobody was contacted. Nothing is fixed yet: the audit asks Colly which to
  take first.

**Waiting on**

- Colly: which findings to fix, and in what order (the audit proposes one);
  and four dashboard things only Colly can do: `?sslmode=verify-full` on
  the live database address (finding 55), the start command on both
  Railway services (56), the service's memory limit to 2 GB (9), and
  `PUBLIC_URL` on the live service (87).

## 20 October 2026: What's changed, and version numbers

**Done**

- Admin ends with the app's version and its latest change, and "See every
  change" opens Admin › What's changed: every version from 0.1.0 (29
  September) to 1.26.0, newest first, in plain words, each with its pull
  requests and decisions
  ([Decision 0071](adr/0071-whats-changed-and-version-numbers.md), Colly's
  ask). From now on every change to the app adds an entry and a version.
- Checked: typecheck, and a test that the list runs newest first, each
  number one step up, and every decision it names exists.

## 20 October 2026: finding a product by typing

**Done**

- Kit from the notes and Add kit choose a product by typing, not from a
  long dropdown: any part of the name, an other name it goes by, or its
  category or department, in any order ("shure 58", "beta", "wedge"), the
  best first and Enter takes it. Products can have other names, set on
  their page, and Kit from the notes matches lines written that way
  ([Decision 0070](adr/0070-finding-a-product-by-typing.md), Colly's ask).
  The design system's combobox gained the pattern for picking one record.
- Checked: typecheck, all unit and server tests, the kit, notes, pick list,
  faults and inspections browser tests, one new test typing part of a name.

## 20 October 2026: To sort out, from today on

**Done**

- Jobs › Week and Month: "To sort out" no longer lists clashes and checks
  on days gone; the day itself still shows them. Notifications now open
  with the clashes and checks from today to four weeks out, for anyone who
  books crew ([Decision 0069](adr/0069-to-sort-out-today-and-ahead.md),
  Colly's ask).
- Checked: typecheck and unit tests, with a test that a day gone leaves
  the list but keeps its mark.

## 20 October 2026: saving names in Tidy up

**Done**

- Jobs › Tidy up › People named from their address: a name saved for
  someone whose address already spells it (aoife.byrne@…, saved as Aoife
  Byrne) left them on the list as if nothing was saved. The office's save
  is now remembered, so each person leaves the list once named
  ([Decision 0068](adr/0068-a-name-checked-in-tidy-up.md), Colly's bug
  report).
- Checked: typecheck, all unit tests, a browser test saving three names in
  a row, which failed before the fix.

## 20 October 2026: the Skills field, reviewed against the design system

**Done**

- The Skills field ([Decision 0063](adr/0063-skills-as-picks.md)) given a
  full review against the shared design system (Colly's "give it a full
  review to align with the style and design guide"). While something is
  typed one offer is highlighted, the one Enter or a comma takes, the
  spelling in use before a new one, so "aud" and Enter is Audio. The list
  scrolls to keep the highlight in sight; Backspace held down to clear
  what's typed no longer runs on into the chips; each chip added or taken
  off is said aloud; the highlighted row looks apart from the one under the
  pointer; and the "Add as a new skill" row is readable when highlighted.
- Checked: typecheck, all unit tests, the browser tests, contrast of each
  row in both themes.
## 20 October 2026: the audit's P2s and P3s

**Done**

- All of the 18 October audit's P2s (findings 13 to 26) and its P3 polish,
  in [Decision 0067](adr/0067-the-audits-p2-and-p3s.md) (Colly's "proceed
  with all the P2s and P3s"). A new phone reads the latest of each record
  rather than the whole feed; a deploy without screen changes costs a phone
  2 KB, not 1.2 MB; devices poll only while the live connection is down,
  with a heartbeat; phones ask to keep their storage; the backup's test
  restore no longer holds the server up; more failures reach the error
  reports; demo passcode guesses are limited and every page has a content
  security policy.
- On the screens: a big call reads "25 of 40, both days" with its names
  across the card; a job's short kit is one line by reason and one
  "Subhire what's short…"; Jobs shows the next fortnight under week
  headings with New job at the top; Home puts what needs attention first;
  every page in an area row shows on a phone; one link style; the quote
  carries the company's VAT number and address (Admin › Office details).
- The architecture page now says what's built, including which role's
  device holds whose contact details. New tests on the money, kit from
  the notes and vans views, and a parity test that runs 90 commands on a
  phone offline and compares its copy with the server's.
- Checked: typecheck (now including the browser tests), all unit, server
  and browser tests.

**Waiting on**

- Colly: clear the start command in Railway's dashboard on both services
  (audit finding 25), and say when a demo passcode under 12 characters
  should be refused rather than warned about.

## 20 October 2026: a photo on a person's page

**Done**

- A photo on a person's page, in [Decision 0065](adr/0065-a-photo-on-a-persons-page.md)
  (Colly's "upload of peoples images on their staff page"). Add a photo,
  Change photo and Remove photo under their picture, for the person and
  whoever can change crew. The device squares and shrinks it before sending;
  it's kept in the bucket the documents use, and shown in place of the
  initials on their page, the People list and Home. Erasing and combining
  people handle it.
- Checked: typecheck, all tests (new server tests for photos).

## 20 October 2026: first and last names

**Done**

- A person's name is asked for in two, first and last, in
  [Decision 0066](adr/0066-first-and-last-names.md) (Colly's "first name and
  last name fields whenever name is asked for"): the person form, Tidy up's
  people named from their address, and the people on a calendar bring-in.
  The whole name stays as the two joined, so everything else reads as
  before. Everyone already in the app is split on deploy, Irish surnames
  kept whole ("Seán Ó Briain"), and the form shows the split to correct.
  Download everything has the two as columns.
- Checked: typecheck, all unit and server tests (the deploy's split checked
  against the app's own), the browser tests.

## 20 October 2026: making another email the main one

**Done**

- A person's main email can be swapped for another of theirs, in
  [Decision 0064](adr/0064-making-another-email-the-main-one.md) (Colly's
  "change the primary email address for users that have been combined"):
  on their page, each address under "Also found by" has **Make main**, and
  the one it replaces joins the others. They answer to the same addresses,
  so sign-in and roles don't change; for someone with a role only the
  office and directors can do it.
- Checked: typecheck, all tests (new unit and server tests).

## 20 October 2026: skills as picks

**Done**

- Skills as picks, in [Decision 0063](adr/0063-skills-as-picks.md)
  (Colly's "an autocomplete free type field, that can populate with
  multiple selections"): the person form's Skills field holds chips, offers
  the skills already on the crew list as you type (most used first, in the
  spelling most people have), and still takes a new one as typed. Enter or
  a comma adds, Backspace or a chip's own button takes one off.
- Checked: typecheck, all unit and server tests, the browser suite (new
  skills test).

## 19 October 2026: what crew and freelancers read of other people

**Done**

- Reading narrowed further, in [Decision 0062](adr/0062-what-crew-and-freelancers-read-of-other-people.md)
  (Colly's "limit what each role can see"). Rates, money and private links
  were already narrowed (Decisions 0042 and 0046); now staff crew read a
  colleague's phone but not their email, notes or company, and a signed-in
  freelancer none of it. Other people's certificates and insurance, and
  their files, go only to the office, directors and heads. Time off, running
  late and answers to offers keep their days and lose what was written, in
  the feed, the history and the notifications. A head allowed to see rates
  sees their own department's, and can set only those. All on the server;
  each screen says what's hidden.
- Checked: typecheck, all tests (new unit and server tests).

## 19 October 2026, night: one place for a whole stock list

**Done**

- One place for a whole stock list, in [Decision 0061](adr/0061-one-place-for-a-whole-stock-list.md)
  (Colly's "set the stock location all to the same"): the bring-in's
  "Where it's kept" card now asks first where all the kit is kept, and a
  list that places its kit can be put all in one place with "Put all of it
  there".
- Checked: typecheck, all tests (1 new unit, end-to-end extended).

**Waiting on**

- Colly: bring the Current RMS files in on the live app (Claude can't sign
  in there).

## 19 October 2026: system admins

**Done**

- System admins, in [Decision 0060](adr/0060-system-admins.md) (Colly's
  "I need to retain admin access to continue building this out"): the
  Railway variable `SYSTEM_ADMINS` names accounts that can change
  everything whatever their role on the Crew tab. Set on the server only,
  so no director's change can take it away, and it isn't a director: it
  doesn't switch roles on or count as the last one. **You** says so.
  **Switch roles on** on You now shows when it should.
- Checked: typecheck, all tests (new unit and server tests).

**Waiting on**

- Colly: add `SYSTEM_ADMINS` with their sign-in address on the
  **shserver** service in Railway.

## 19 October 2026: a job's page in parts

**Done**

- A job's page tidied, in [Decision 0059](adr/0059-a-job-page-in-parts.md)
  (Colly's "tidy up and segment the job page", and "the coming up jobs
  shouldn't be there when you click into a job"): on a desk a job now has
  the whole width, with no list beside it; Jobs › the job in the bar goes
  back to the list. Its details stay on top, and under them its parts are
  tabs, one at a time: Phases, Crew (booked of needed), Kit and vans, Show
  pack, and Quote for the roles that see money. Crew calls moved out of the
  phases into Crew, a card per phase; each phase says how its crew stand,
  a tap from them. The page opens on the part last looked at.
- Checked: typecheck, all tests, and the page on a phone and a desk.

## 19 October 2026: notifications

**Done**

- Notifications, in [Decision 0058](adr/0058-notifications.md) (Colly's
  "a notification centre … that fires toast messages when something
  updates for something the person is associated with"): a bell top right
  on every screen counts what's new, and opens a list of what others
  changed in the last 30 days on what's yours (the jobs you're on or made,
  the offers you sent, your own details, bookings, leave and timesheets),
  in the History tab's words, each linking to its page. Changes that arrive
  while the app is open pop up at the bottom of the screen, more than two
  at once as one; a switch on the list turns the pop-ups off on that
  device. In the app only: nobody is emailed, texted or pushed to.
- The bell icon is new in the design system (0.5.1, its PR #15).
- Checked: typecheck, all tests (3 new server, 1 new end-to-end), and the
  pop-up and the list looked at on a phone and a desk.

**Waiting on**

- Nothing: the design system's PR #15 is merged.

## 19 October 2026: venues on the map

**Done**

- Venues on the map, in [Decision 0057](adr/0057-venues-on-the-map.md)
  (Colly's "a map interface for the individual venue pages and an overall
  map for the venues page"): each venue's page has its map with
  Directions, and Jobs › Venues has one map of them all. OpenStreetMap,
  drawn with Leaflet: open, free, no key. A venue's pin is kept on the
  venue, so the map needs no look-up once it's placed and works with poor
  signal. It is placed by looking the venue up by name and address,
  pasting a map link or coordinates, or tapping the map. **Find the rest**
  looks up every venue not yet on the map for the office to check, then
  puts the ticked ones on in one press.
- Checked: typecheck, all tests (6 new unit, 9 new server, 2 new
  end-to-end), and the pages on a phone and a desk in both themes.

**Waiting on**

- The office: Jobs › Venues › Find the rest on the live app, then a look
  at any venue it couldn't find.

## 19 October 2026: the stock from Current RMS

**Done**

- Bringing the stock in from Current RMS, in [Decision 0056](adr/0056-bringing-the-stock-in-from-current-rms.md)
  (Colly's "can this be imported?"): Stock › Bring in the stock list takes
  Current RMS's products, stock levels and rates exports chosen together,
  and reads them into one list of a row a product, everything counted to
  be labelled later. Colly's export: 309 products and 3,491 pieces of kit,
  228 day prices. Any stock list can now have a Day price column, which
  fills the price list where a product has no price.
- Checked: typecheck, all tests (5 new unit, 1 new server, 1 new
  end-to-end), and Colly's three files read through the preview with
  nothing to fix.

**Waiting on**

- Colly: bring the three files in on the live app, with the place the kit
  is kept typed once above the rows.

## 19 October 2026: combining people brought in twice

**Done**

- Combining people, in [Decision 0055](adr/0055-combining-people-brought-in-twice.md)
  (Colly's "combine users created to the same one"): on a person's page,
  "Combine with…", and on Jobs › Tidy up, "The same person, brought in
  twice". The one person keeps every booking, offer, timesheet, day off,
  leave, document and history entry, and every address, so the next
  bring-in and their Google sign-in find them. Old private links and feeds
  open the one person. Two offers for one call become one.
- Checked: typecheck, all tests (11 new unit, 6 new server, 1 new
  end-to-end), and the page on a phone.

**Waiting on**

- Colly: combine the doubles on the live app (Jobs › Tidy up lists them);
  the Railway start command, backup variables and Sentry key, as before.

## 18 October 2026, late: charts on Home

**Done**

- Charts on Home, in [Decision 0054](adr/0054-charts-on-home.md) (Colly's
  "more visuals and graphs to the dashboard"): jobs by week, crew booked
  and still needed each day for a fortnight, the season month by month,
  and money by month (money ability only) for the company; crew and kit
  for a department; kit booked out each day for the warehouse; your own
  days by week for Me. Coloured by the shared grammar: ink settled, grey
  not yet, amber only for crew still needed. Each column is a button that
  says itself in words.
- Checked: typecheck, all tests (7 new unit, 1 new end-to-end), and the
  page on a phone and a laptop in both themes.

**Waiting on**

- Colly: the Railway start command, the backup variables and the Sentry
  key, as before.

## 18 October 2026, night: tidying what came in

**Done**

- Jobs › Tidy up, in [Decision 0053](adr/0053-tidying-what-came-in.md)
  (Colly's "tidy-ups for the imported data"): the jobs brought in as
  several made one (EP was 22 jobs), people named from their address
  given names, venues and clients found in job names, and names given a
  capital. Each group is a suggestion the office ticks; only sure ones
  come ticked. Joining moves phases, crew, kit, vans, quotes and the
  calendar's days, naming each day for its title.
- The next bring-in reads "EP - Smirnoff LX" as EP's Smirnoff LX day.
- Staff on several jobs a day are no longer clashes; calls say "25 of 40,
  both days"; "No client or venue yet" only on jobs in the next fortnight;
  "Show 3 times"; a bring-in's history keeps its start date and what it
  left out.
- Checked: typecheck, all server and shared tests (13 new), and the page
  on a local copy of the live data on a phone and a laptop, no console
  errors. Nothing in the live data was changed.

**Waiting on**

- The office: going through Tidy up on the live app.
- Colly: the Railway start command, the backup variables and the Sentry
  key, as before.
## 18 October 2026, night: Google is the only way in for staff

**Done**

- A member of staff's own page (their link) now asks for their Google
  sign-in before it opens, in [Decision 0052](adr/0052-google-only-for-staff.md)
  (Colly's "log in with Google is the only option for them"). It opens for
  them, or the office or a director once roles are on; anyone else gets one
  Sign in with Google button that comes back to the page. Freelancers'
  links and calendar feeds are unchanged; the demo keeps its passcode.
- Staff stay signed in for 400 days after they last used the app, renewed
  each day (was 60), so in practice until they sign out (Colly's "persist
  their login for as long as possible"). 400 days is the most a browser
  keeps.
- Checked: typecheck, 290 shared and 514 server tests, including new ones
  for a staff page signed out, signed in, signed in as someone else, and
  turned away by Google.

**Waiting on**

- Staff: their email on the Crew tab must be the Google address they sign
  in with, as roles already need.

## 18 October 2026, late: Freelancer in the list of roles

**Done**

- Warehouse is out of the staff role list and Freelancer is in, on Colly's
  ask, in [Decision 0051](adr/0051-freelancer-in-place-of-warehouse.md): a
  freelancer signed in can look and report a fault, reads only their own
  rate and link, and asks for no leave; their offers, timesheets and days
  off still go through their private link. Anyone on the Crew tab as a
  freelancer signs in as one. Whoever had the warehouse role is now a head
  of department, so keeps the stock and kit. The demo's Warehouse persona
  stays, held to a head's role.
- Checked: typecheck, 802 unit tests, the two role browser tests.

## 18 October 2026, night: long lists drawn in a window

**Done**

- Jobs' list and Crew's calls draw only the rows near the screen, the rest
  standing in at their heights, in [Decision 0050](adr/0050-long-lists-drawn-in-a-window.md)
  (Colly's "faster long lists"). With 900 extra jobs on a slowed phone the
  Jobs tab went from 254–587 ms to 80–242 ms and Crew from 730–959 ms to
  132–192 ms. Back still finds the row a job was opened from. Filled calls
  are built only once unfolded. Find in page now reaches only the rows
  near the screen; the list's own search covers the rest.
- Checked: typecheck, the full browser suite (113 tests; the long-list test
  three times more), scrolling end to end on a phone and in the laptop's
  column with no blank rows.

**Waiting on**

- Colly: the Railway start command, the backup variables and the Sentry key,
  as before.

## 18 October 2026, evening: the audit's P1 fixes

**Done**

- All nine P1 findings of the [audit of 18 October](audit-2026-10-18.md),
  findings 4 to 12, in [Decision 0049](adr/0049-holding-up-at-real-size.md)
  (PR #88, live on Railway 14:28): the app's files and the copy go
  compressed (1.3 MB of app to 0.33 MB); database time limits, a busy
  answer after 3 s instead of a stalled phone, and a read pool of its own;
  freelancers' calendars read in a worker from near today and capped; an
  edit made against an old copy turned down in words, the typed text kept
  to copy; only the office and directors change a role-holder's email,
  never from a link, and no two people share one; a new screen opens at
  its top and Back finds its place; a role sees only the buttons it can
  use; Crew › Calls shows the short calls, filled ones folded; views kept
  between changes and the saved copy written a table at a time (an own
  edit 130 ms to 45 ms, the Crew tab 3.8 s to 2.4 s on a slowed phone).
  Node pinned to 22.
- Checked: typecheck, 801 unit tests, 112 browser tests, CI with real
  Postgres; live, health answers and the app's files come back as Brotli.

**Waiting on**

- Colly: clear the start command in the Railway dashboard (finding 25),
  plus the backup variables and the Sentry key as before.
- Next: windowed long lists (the Jobs tab tap), and checking a person
  brought back from the archive against everyone's emails.

## 18 October 2026, later: messages to crew are off until the office says

**Done**

- A company-wide switch under Admin › Messages to crew
  ([Decision 0048](adr/0048-messages-to-crew-off-until-said.md)), off by
  default: while it's off, Offer, Send, Tell and Ask open nothing. The
  offer is still made and the change still reaches the person's private
  link; in the Send panel's place a card says messages are off, who would
  have been sent what, and where to turn them on. Finding 3 of the
  [audit of 16 October](audit-2026-10-16.md), now that the two real
  calendars are in.
- Checked: typecheck, 774 unit tests, and the crew booking browser test,
  which now starts quiet, turns messages on through Admin, then sends.

**Waiting on**

- Colly: the backup variables and the Sentry key; and, once the imported
  lists are tidy, turning messages to crew on under Admin.

## 18 October 2026: a full audit, from reliability to the screens

**Done**

- A full audit of the app with all six new features in
  ([Audit, 18 October 2026](audit-2026-10-18.md)): sync and data at real
  size, security and privacy, every screen as each role on a phone and a
  desk, and speed and running it. Two P0s in the sync (a pull that can
  skip a change, a phone with a backlog stuck for ever), backups and
  alerts still off, and an order to fix the rest.
- Checked: everything was local; nothing live was read or changed.
- The two sync P0s fixed ([Decision 0001](adr/0001-sync-engine.md),
  amended): a pull that finds nothing new keeps the device where it was,
  and every device reads its copy again once, keeping what it has
  waiting; a phone sends 50 changes at a time, a resend is answered from
  one look, a slow push is answered in part inside 20 seconds, and a
  round whose push fails still pulls.

**Waiting on**

- Colly: the backup variables and the Sentry key, and clearing the
  dashboard start command on both Railway services.

## 17 October 2026: vans and drivers

**Done**

- Stock › Vehicles: the company's vans, Lutons, trucks, cars and trailers,
  each with its registration, seats, payload and notes, and its checks:
  NCT or CVRT, motor tax, insurance, service due and, for a truck, the
  tachograph. Each has its own page, where it's taken off the road (in for
  repair, until a day or until it's back) and retired
  ([Decision 0047](adr/0047-vans-and-drivers.md)).
- A Vehicles card on each job's page books a van on the whole job or one
  phase, for given days, with a driver from the crew; errands are booked
  the same way. A road check run out on the booking's days is refused by
  name, before anything is sent and again on the server; so is a driver
  with no licence, or one run out. Another job on the same van that day,
  or a day off the road, asks first and is booked anyway. A licence not
  recorded, a check not recorded and a service overdue warn.
- Each booking says what's wrong with it from today on, worst first, and
  nothing is taken off later: a check that lapses after booking shows on
  it.
- The planner has Vans rows: one per vehicle, the jobs it's on and who
  drives, off the road, and a van on two jobs as a clash in To sort out.
  A job's day names its vans and drivers.
- Call sheets, in the app and on a freelancer's link, list the vehicles on
  that phase and who's driving.
- Checks running out are listed on the Vehicles page, beside the
  certificates and documents on Crew › People, and counted on Home for
  the company and the warehouse. The app asks nobody for anything.
- The made-up data has Big Van (motor tax running out, service overdue,
  booked on two jobs on one day) and The Luton (in for a new clutch, its
  driver's licence not recorded), and an errand to collect stage decks.
- Checked: typecheck, unit tests (shared and server), the web build, the
  hub build and the browser tests.

**Waiting on**

- The office: the real vehicles and their check dates, and drivers'
  licences on their cards.
- A decision on licence categories (C1 for a heavy Luton, C for a truck),
  which aren't checked yet.

## 17 October 2026: a department on every call, and what each role reads

**Done**

- Every crew call has a department from the crew profiles' list, or none.
  Asking for crew starts it on the one its role suggests (from calls for
  the same role, then people with the role as a skill, then the role's
  words), with a line saying so; it changes on the call's edit form.
  Calls brought in from the calendar take the one most of their people
  are in, or none
  ([Decision 0046](adr/0046-departments-on-calls-and-what-each-role-reads.md)).
- Crew › Calls narrows to a department, a head of department starting on
  their own. Narrowed to "No department", it gives many calls one at once,
  nothing ticked to start. Home for a department counts the crew its calls
  still need. Call sheets and the show pack carry the call's department.
- Crew rates, timesheet amounts and freelancers' private links go only to
  the roles that need them: all to the office and directors; a head of
  department their own department's links, and rates if a director
  allows it in Admin; the warehouse and staff crew none but their own.
  Records still go to everyone with those fields left out, and every
  screen says what's hidden for the role. Setting or agreeing a rate, and
  deciding a timesheet, are refused for a role without rates, with who
  can. The history leaves the figures out for them; Download everything
  stays with the office and directors.
- The demo's personas are sent what the person they stand for would be
  sent, and You says what each role reads.
- Checked: typecheck, unit tests (shared and server, with each role's
  feed checked for rates and links it shouldn't hold), the web build, the
  hub build and the browser tests.

**Waiting on**

- Colly: whether heads of department should see crew rates (Admin, off
  to start).
- The office trial: whether the warehouse and staff crew still need every
  phone number and certificate, the last of the reading left open.

## 17 October 2026: the Crewbox show pack

**Done**

- Show pack, on each phase's call sheet and on the job's page: one .zip
  for the Crewbox, made on the device from what it holds, so it works with
  no signal, and sent nowhere. In it: the crew who said yes (what they go
  by, role, department, call time, days), the running order as Crewbox
  acts read from the phase's notes and the run of show as typed, the kit
  with the Session Hire numbers scanned out, the venue and its access
  notes, who to ring on the day and the office, a crew list to print, and
  a manifest with the format's version
  ([Decision 0045](adr/0045-the-crewbox-show-pack.md)).
- The join QR: typing the box's address (and the event PIN) when making
  it puts a QR code of the box's join page on the crew list. Neither is
  kept in the app.
- Crew numbers are in it only for the office, heads and directors, as the
  contact on the day's call sheet has them; anyone else's pack has the
  contact's number only. No rates or prices in any pack.
- The patch and lighting sheets are empty, with their columns: the app
  doesn't plan either yet. Every file's layout is written down in
  [crewbox-show-pack.md](crewbox-show-pack.md) for the Crewbox side.
- Checked: typecheck, unit tests (shared and server), the web build, the
  hub build and the browser tests.

**Waiting on**

- The Crewbox side: a running-order import that reads
  `running-order.csv`, and a check of the patch and lighting columns
  against Crewbox's own export layout, which couldn't be read from here.

## 17 October 2026: kit lists from the notes

**Done**

- Jobs brought in from the calendars keep their job sheets in the notes;
  the kit lists in them (`4 x d&b Y10P`, `2x d20 amp`, `Shure ULXD x 2`)
  can now become kit lines. A job's Kit card says what its notes list and
  opens Kit from the notes: each line as written, the product it matched
  (by name, by its model or code, or a close match), how many, and in
  words what it will do. Any line can take another product, another
  number, Not kit, or New product… (for roles that can change stock).
  Nothing goes on until it's added.
- A line from a phase's notes goes on that phase; from the job's notes,
  on the whole job. What the job already has counts, so nothing is
  doubled, even when the same notes are read twice or by two phones with
  no signal. The notes stay as written.
- Names chosen are remembered: "d20 amp" chosen as the D20 once matches
  it on every job after, and a name said to be not kit stays not kit.
- Kit in the notes (from the Jobs list, the bring-in and the Menu) lists
  the jobs whose notes hold kit not on them yet, coming up first: those
  where everything matched go on together, asked first; the rest each
  open their own lines. Matching runs on the phone and works with no
  signal; a season goes in batches of 50 jobs a change
  ([Decision 0043](adr/0043-kit-lists-from-the-notes.md)).
- The made-up data has three jobs with kit in their notes: one to check,
  one with a phase's notes, and one ready to add.
- Checked: typecheck, unit tests (shared and server), the web build, the
  hub build and the browser tests.

**Waiting on**

- Adam or the office: a look at a few real job sheets on the made-up
  data's pattern once the stock list is in, to see how many lines match
  by name and which names need choosing once.

## 17 October 2026: freelancers' own calendars, read only

**Done**

- A freelancer can share when they're busy from their private link, by
  pasting their calendar's private address (Google's secret iCal address,
  Outlook's or iCloud's published link, or a webcal:// one). The page says
  first that only busy times are kept, never what, where or who with, and
  that nothing is added to their calendar. One tap stops it.
- The office can add the address a freelancer sent on their page, in a
  card "Their own calendar", read it again now, or stop reading it.
- The server reads each calendar at once, then every three hours: busy
  times only, four months ahead, repeating events worked out, our own
  Session Hire bookings left out.
- Busy days show in the planner as "Busy (own calendar)", on the person's
  page, and as a warning when offering work; the offer can still go.
- The address is kept on the server as a secret: not on devices, not in
  the history, not in Download everything, and blanked in error reports.
  The server reads only public https addresses, checked again after each
  redirect, with time and size limits
  ([Decision 0044](adr/0044-freelancers-own-calendars-read-only.md)).
- Checked: typecheck, unit tests (shared and server), the web build, the
  hub build and the browser tests.

**Waiting on**

- Nothing to set up: no keys or accounts are needed. Colly: whether four
  months ahead and every three hours are right for how far out work is
  offered.

## 17 October 2026: quotes and a money view

**Done**

- A price list: a day price on each product and each crew role, and a
  client's usual discount, at Jobs › Money › Price list.
- Quotes on a job, at the job's Quote card: built from its kit and crew at
  those prices, every line open to change (what, how many, days charged,
  price, VAT at 23%, 13.5% or 0%), the kit's days set at once, and the
  client's discount. Once it's marked sent it stays as it went, and a
  change is a new version. It prints as an A4 page to save as a PDF; the
  app sends nothing. The office records the client's answer, the invoice
  (day and number) and the payment.
- Money, a page along Jobs' row for the director and the office: by month,
  quoted, confirmed and invoiced; who owes, by client; freelancers owed,
  marked paid from approved timesheets; and each job's margin. Home's
  whole-company view has a short Money card.
- Files for the accountant, for a VAT period or a year: invoices by VAT
  rate, VAT by period and rate, and freelancer costs. The new tables are in
  Download everything.
- Only the office and directors are sent money: the server leaves it out
  of every other role's copy ([Decision 0042](adr/0042-quotes-prices-and-a-money-view.md)).
- Checked: typecheck, unit tests (shared and server), the web build, the
  hub build and the browser tests.

**Waiting on**

- Colly: the company's VAT number, address and quote terms, if the PDF
  should carry them (the office details have no field for them yet; the
  quote's notes do for now).
- Colly: whether invoice numbers should be made in the app one day, or
  stay the accounts package's.

## 16 October 2026: Crew's own pages

**Done**

- Crew's row now names four pages, now each person has a page of their
  own: Calls (answers to check and crew still needed), People (the list and
  certificates running out), Leave and Timesheets. Calls and Leave count
  what the Crew tab's badge counts, so the badge says where to look; a
  person's page reads Crew › People › their name
  ([Decision 0041](adr/0041-where-things-live.md)).
- Checked: the whole browser test suite and typecheck.

**Waiting on**

- Nothing.

## 16 October 2026: everything moved to where it lives

**Done**

- Colly chose "Move it all". Jobs, Stock and Crew each name their pages in
  a row under the header: List · Week · Month · Clients · Venues;
  Catalogue · Places · Labels · Counting · Testing · Repairs (tests overdue
  and repairs open counted); Calls · People · Leave · Timesheets
  ([Decision 0041](adr/0041-where-things-live.md)).
- Every address starts with its area (`#jobs/plan`, `#jobs/venues`,
  `#admin`…). Old links and bookmarks land on the new pages.
- The crew and stock lists are brought in under Crew and Stock; Admin
  keeps a "Bring lists in" card linking to all three, and is otherwise
  settings. Clients and venues have a list page each; the Menu names them.
- Checked: the whole browser test suite, server tests and typecheck.

**Waiting on**

- Nothing. Crew's split came in a second step, once each person had a page.

## 16 October 2026: a page for each person

**Done**

- Colly asked for a page per crew member. Everything about a person was
  already kept, but it only opened as a long fold inside the People list.
  Each person now has a page of their own under Crew
  ([Decision 0040](adr/0040-a-page-for-each-person.md)): their picture,
  name and who they are, Call, WhatsApp and Email, their details, level
  and role; what's coming up (bookings and offers, each opening its job,
  and days off); certificates and documents; every job they've worked;
  and their private link. The People list is one line each that opens
  it, and a name on a call card or a person's lane in the planner opens
  it too. Archive is one tap from the page and the list says so, with
  the way back.

**Waiting on**

- Nothing new. Photos wait on the backup bucket, as the icons work says.

## 16 October 2026: icons, and pictures of kit and crew

**Done**

- Colly found the app very text heavy. Every card heading now starts with
  an icon, the Menu's places have one each, kit has a square picture
  (a placeholder with the icon for what it is: speaker, spotlight, cable,
  case…) in the stock list, on a job's kit lines and at the top of its
  page, and crew have a round one with their initials in People, on crew
  calls and on Home ([Decision 0038](adr/0038-icons-and-pictures.md)).
- The icons live in the shared design system now (version 0.4.0): one open
  set, Lucide, named by meaning, with the rules for icons and pictures, so
  every app draws the same ones.

**Waiting on**

- Colly: merge the design system's pull request for the icons. Photos in
  place of the placeholders wait on somewhere to keep files (the backup
  bucket).

## 16 October 2026: a way up from every page, and where things live

**Done**

- Colly asked for breadcrumbs or a back button. Every page under Jobs,
  Stock, Crew and the Menu now has its way up in the top bar, so it stays
  in view down a long page: one link to the page above on a phone ("‹ All
  jobs"), and the whole way down as breadcrumbs on a desk (Jobs › Liffey
  Brands Shoot › Pick list)
  ([Decision 0039](adr/0039-the-way-up-and-breadcrumbs.md)).
- Looked over where everything lives and wrote up a tidier structure
  ([where things live](information-architecture.md)): addresses that start
  with their area, each list brought in where it lives, list pages for
  clients and venues, Stock's long screen split into its parts, and Admin
  as settings only.

**Waiting on**

- Nothing: Colly chose to move it all (next entry up).

## 16 October 2026, later: a season comes in within the app's wait

**Done**

- Colly took the first bring-in back (141 jobs, in the history) and
  brought Adam's calendar in from 19 December 2025: 767 jobs over 1,714
  days, 678 crew bookings and offers, 73 people, 37 venues. The server
  took 1 minute 47 seconds to save it, one row a round trip to the
  database, and the app had stopped waiting at 60 seconds and said it
  couldn't reach the server, though everything landed.
- The bring-in now gathers the jobs, phases, calls, offers and event-days
  and writes them a few hundred per statement, and the take-back removes
  its rows the same way, so a season takes seconds. The app waits up to ten
  minutes for a look, a bring-in or a take-back, says "Saving them all in
  one go" while it does, and a slow answer says the server may still be
  working rather than that there is no signal.

**Waiting on**

- Colly: bring Olan's calendar in from the same first day; then the backup
  bucket and the Sentry key.

## 16 October 2026: the bring-in learns from the real calendars

**Done**

- Colly said go on the audit's fix order. A job now has a kind: gig, dry
  hire, errand or meeting ([Decision 0037](adr/0037-job-kinds-and-days-gone-as-history.md)),
  guessed from the title on the import screen and corrected there before
  saving; only a gig gets a crew call, and the invited are noted on the
  rest. Days gone come in as the record of who worked: a Yes is a booking,
  anything else is noted, so no call is still looking for crew for a gig
  that happened, and a booking brought in after its day has no timesheet
  to chase. "Build 4/9 & Client Walk Through" is a Build with a note, a
  day naming two phases books its crew once, people's names are typed on
  the import screen where Google had none, and a shared mailbox is never
  crew.
- The import screen says what has been brought in so far and can take it
  all back in one go, so the calendars can come in again from the first
  day with the new rules. It refuses once anyone has acted on those jobs
  in the app.

**Waiting on**

- Colly: take the first bring-in back on the import screen and bring both
  calendars in again from the start of the season, checking the kinds and
  typing the names; then the backup bucket and the Sentry key.

## 16 October 2026: the real calendars are in, and audited

**Done**

- Sign-in is live, the company's Google account is connected, and Colly
  brought in two organisers' calendars: 141 jobs, 149 phases, 66 crew
  calls, 179 offers, 36 people and 12 venues, from 1 October 2026 on. The
  app holds real data only; nothing has been written back to Google and
  crew invites are off.
- [The audit of the real data](audit-2026-10-16.md), read-only: what the
  import made of the calendars, and what the office would see. The import
  ran clean, but a calendar is not a job list: dry hires, collections and
  meetings came in as gigs with crew calls; Google's unanswered invites
  became 54 offers waiting and 41 timesheets to chase; most freelancers
  are named from their email handle; the second organiser's tidy titles
  split four jobs into thirteen. Nineteen findings, with the order to fix
  them.

**Waiting on**

- Colly: the backup bucket and the Sentry key (still off, now with real
  people in), and the go-ahead for the import fixes before the next
  bring-in.

## 16 October 2026: Google sign-in live, and calendar writing held off

**Done**

- Colly added the Google key. Sign-in is live (`"auth":"google"`), Colly
  signed in, connected Google Calendar and brought in 141 real jobs from two
  calendars. The app had written nothing to Google: it held no jobs of its
  own before the import.
- Colly asked that the app write nothing to Google Calendar and contact
  nobody for now. Writing is now off unless `CALENDAR_WRITES` is `on` on the
  server ([Decision 0008](adr/0008-calendar-sync.md), last section);
  bringing jobs in still works. Nothing else in the app sends anything to
  anyone: crew invites were its only way to email.

**Waiting on**

- Colly: say when the app may write to the calendar.

## 13 October 2026: the Google steps brought up to date

**Done**

- Colly has a Google Workspace account for Session Hire now. The steps for
  switching on sign-in and Google Calendar ([sign-in-setup.md](sign-in-setup.md))
  were checked against the app as it is: what was the Account tab is now
  Admin and You in the Menu, the demo copy keeps its passcode and no Google
  key, `STAFF_DOMAINS` is there for a Workspace not on sessionhire.com, and
  two new steps say when to start fresh and how to switch roles on.

**Waiting on**

- Colly: the Google key and the two Railway variables (steps 1 to 3), then
  the office trial and the phone field test.

## 12 October 2026: a desk layout, a sidebar, and dark by default

**Done**

- Colly asked for better use of a desk's width, the bottom bar as a
  sidebar there, a dark theme by default with a toggle top right, and the
  header to be the company with "seeing it as Director" under it
  ([Decision 0036](adr/0036-desk-layout-sidebar-and-dark-by-default.md)).
- From 900px across, Home, Jobs, Stock, Crew and Menu are a sidebar down
  the left; a phone keeps the bar along the bottom. From 1200px a screen's
  cards stand two across, and the Menu's groups too.
- The app opens dark. The sun or moon at the right of every header
  switches to light, and You has the same with "match this device's
  setting"; the choice stays on that device.
- The header is the Session Hire mark and name. On the demo, "Seeing it as
  Director" sits under it, the name a link back to choosing someone else,
  in place of the black bar.
- Home is the page's title, with today's date at the top right of the
  header.
- Checked: typecheck, unit tests, the full end-to-end suite with a new
  test for the sidebar and the theme, and the demo in a browser on a
  phone, a 1024px tablet and a 1440px desk, dark and light.

## 11 October 2026: roles, and what each can change

**Done**

- Colly asked for roles and permissions next. Each persona with an
  account is now a role: **director**, **office and production**, **head
  of department**, **warehouse** and **staff crew**. Freelancers keep
  their link. A role decides what a member of staff can *change*; everyone
  signed in still reads everything
  ([Decision 0034](adr/0034-roles-and-what-each-can-change.md)).
- The server checks every change and every settings request against the
  sender's role, and turns one down with who can and who to ask. The app
  works the role out the same way from its own copy, so it holds offline,
  turns a change down before keeping it, and doesn't offer what the role
  can't do (New job, Ask for crew, Add person, Add product, the settings
  cards).
- A role is set by a director on the person's card on the Crew tab, found
  by the email they sign in with. Admin shows **Your role**. Roles start
  off: **Switch roles on** in Admin makes you the first director, and
  there's always one after that. Who approves time off is now a
  director's to give.
- The demo's **See it as…** personas are the roles: the server holds the
  browser to the one chosen.
- Checked: typecheck, the unit tests (new ones for roles on the server
  and the shared rules), the end-to-end tests for crew, jobs, Home,
  leave, stock and refusals, and the demo in a browser as the warehouse
  and as a director.

**Waiting on Colly**

- Once Google sign-in is on: switch roles on from Admin, then give the
  office, heads and warehouse their roles on the Crew tab. Everyone needs
  the email they sign in with on their own person.

**Next**

- Narrow what each role can read (rates, phone numbers and private links
  for staff crew).

## 11 October 2026: Home, and finding your way around

**Done**

- Colly asked for a look at the app through the eyes of each kind of
  person who uses it, and said that on a phone every screen looked the
  same and nothing gave an overview. [Who uses it, and how](personas.md)
  sets out six personas (director, office, head of department,
  warehouse, staff crew, freelancer), a job's path through them, and
  what fell short for each, rated
  ([Decision 0033](adr/0033-home-and-finding-your-way-around.md)).
- **Home**, first in the bar: today, the counts that need someone, and
  the week ahead, shown for the company, a department, the warehouse or
  me. It starts on the person's own department when their profile has
  one, and the phone remembers the choice. A count that's nothing isn't
  shown.
- **Five places, each with a picture and a word:** Home, Jobs, Stock,
  Crew and Admin. History moved under Admin, which is Account renamed.
- **Each area's screen has its name as a large title**, and every long
  screen has **On this screen**: its parts by name under the bar, with
  their counts, a tap away, marking the one in view.
- **A freelancer's page** opens with what's waiting on them and what's
  next.
- **The demo copy opens on "See it as…"**: pick a director, the office,
  a head of department, the warehouse, staff crew or a freelancer, and the
  app opens where that person starts, with a bar on every screen to choose
  someone else.
- Checked: typecheck, the unit tests and the end-to-end suite, with a new
  test for Home, History under Admin and the strip.

**Next**

- A department on each crew call, so a department's Home narrows crew
  still needed too.
- ~~Decide whether the app needs roles and permissions~~: built, above.

## 10 October 2026: screens checked against the shared behaviour rules

**Done**

- Every screen was read against the design system's behaviour rules
  (`behavioural.md` and principles 1 to 15), and what fell short was
  fixed. Most of it is about never losing typed work, asking before
  things that can't be taken back, and saying what a press did where it
  was pressed.
  - **Jobs.** A scan that wasn't recorded stays until it's dismissed.
    Taps on the pick list say what they recorded. Asking for crew and
    adding a phase say so where the form is. The calendar import keeps
    its picks when you go back, and says which step it's on.
  - **Stock.**
    - Fixed, Not faulty and Found ask first, since the kit can go out
      again.
    - A test and a retirement start with nothing chosen.
    - A new number asks before the old one is gone for good.
    - Counts and moves say what they did.
  - **Crew.**
    - A refused form on a freelancer's page keeps what they typed.
    - Decline is folded away from Accept.
    - Release, Say no, Withdraw and cancelling approved leave ask first.
    - A timesheet check isn't wiped when a new version arrives.
  - **Everywhere.**
    - Account and History show what's waiting to sync.
    - Waiting to sync is drawn quietly rather than in amber.
    - A closed fold keeps what was typed.
    - Signing out sends waiting changes first.
    - Buttons say what they do.
  - **A new job starts as an enquiry** (Colly's call), so nothing goes on
    the jobs calendar or holds kit until someone confirms it.
- What the system didn't cover went back to it as learnings
  ([design-system PR #6](https://github.com/legofsalmon/design-system/pull/6)).
- Checked: typecheck, the unit tests and the end-to-end suite.

**Next**

- An Undo notice, so reversible actions can stop asking first.

## 10 October 2026: a page for each venue and client, with their documents

**Done**

- Colly asked for each venue, and then each client, to have its own page
  with somewhere to keep documents
  ([Decision 0032](adr/0032-venue-and-client-pages-and-their-documents.md)).
  A venue in the Jobs tab's list now opens its page: the address with the
  map, the notes, its documents and the jobs there. A client opens its
  page the same way: its contacts to ring or email, the notes, its
  documents and its jobs. A job's venue and client link to their pages.
- Each document is a file, a link to where it's shared (Dropbox, Google
  Drive, a website), or both, with a kind: tech spec, floor plan,
  rigging, power, access and load-in, health and safety for a venue;
  contract, purchase order, brief, brand guidelines, insurance they ask
  for for a client.
- Links work now, with no signal too. Files are kept and opened exactly as
  people's documents are, so they wait on the same storage bucket.
- Checked: the typecheck, the shared and server tests (with four new ones
  for these documents), and two new browser tests on a phone: one adds a
  link and a file on a venue, opens the file and removes a document; the
  other adds a link on a client and changes a contact.

**Next**

- Set the storage bucket (the BACKUP_S3_ settings) to turn on files, for
  people's documents and those on venues and clients alike.
- Perhaps: crew opening a venue's documents from their call sheet.

## 10 October 2026: the planner's days open their job

**Done**

- In the Jobs tab's Week and Month views, a job's days now open that job,
  and so does anywhere in its name cell on the left, not just the words
  ([planner decision](adr/0010-planner.md)). Crew asked for on the Crew
  tab, with no job behind them, still go to the Crew tab from their name.
- Checked with the planner's end-to-end tests, which now open a job from
  a day and from the edge of its name cell.

## 9 October 2026: colours from the shared design system

**Done**

- The app's colours, and the freelancer's pages', now come from the
  shared design system that Colly's other apps take theirs from
  ([design system](design-system.md)): the page, cards, text, lines, and the
  green and amber. Session Hire keeps its own red for the one thing to do
  next, the current tab, links and focus, and its burnt-orange bad tone.
  Layout, type, spacing, corners and components are as they were.
- Checked in both themes: the unit tests (including a new check that the
  vendored token files are unedited), the end-to-end suite with its
  contrast checks, and every text colour against the page and a card.

**Next**

- Bring the Figma file's colours over to match.

## 9 October 2026: a demo copy, locked with a passcode

**Done**

- For showing the app as a proposal before the Google key is in, a
  `DEMO_PASSCODE` setting now locks a copy of the app behind one shared
  passcode ([PR #61](https://github.com/sessionhire/sess-sys/pull/61);
  [sign-in setup](sign-in-setup.md)). Freelancers' private links still
  open without it, and once the Google key is set Google sign-in takes
  over.
- A separate demo copy runs on Railway as the `demo` service, in the EU,
  with its own small database on a Railway volume, so nothing touches the
  live app's data. It deploys from `main` like the live app and sleeps
  when nobody is using it. It is filled with made-up data. Its address
  and passcode are in the project thread, not here.

**Next**

- Start fresh, then made-up data again, on the demo copy before each
  showing if it has been played with.

## 8 October 2026: stocktakes and rolling counts merged and live

**Done**

- Colly chose "Merge it" for stocktakes and rolling counts
  ([PR #57](https://github.com/sessionhire/sess-sys/pull/57),
  [Decision 0030](adr/0030-stocktakes-and-rolling-counts.md); see
  4 October). It was brought up to date with getting kit ready and back
  (7 October) first, and the full suite passed with both: the
  typecheck, the shared tests (194), the server tests (427) and the
  browser suite (84).
- Merged into `main` at 19:35 UTC once GitHub's checks passed, and live
  by 19:47: Railway deployed it on its own.

**Next**

- Phase 2's app work is done. What's left is the labelling rollout,
  which is work in the warehouse rather than in the app, and RFID later.
- The stock list, then the baseline stocktake: count every place once,
  from the Counts card on the Stock tab.
- The keys: the Google key, the backups bucket with `BACKUP_KEY`, and
  the Sentry key.

## 7 October 2026: getting kit ready and back

**Done**

- **Getting kit ready and checking it back in**
  ([Decision 0031](adr/0031-getting-kit-ready-and-back.md)), the next
  item in the plan ("working hours and buffer time on availability").
  Each job now holds its kit a day before, to get it ready, and a day
  after, to check it back in, so a job the day before or after can't
  have the same speakers. The Kit card says the days held, with a
  Change link for any job to say from 0 to 14 of each: none before when
  it has its own Prep phase, or none either side when kit goes straight
  from one job to the next. A shortage on one of those days says so:
  "Short 2 on Tue 3 Sep, getting it ready".
- **Kit still out after its job isn't free.** Once a job's days are
  over, kit scanned out with it and not back is taken off what's owned
  until it's scanned in, and its line says "2 still out after their
  jobs". Kit already reported missing or not fit to go out isn't counted
  twice.
- **Hours, not yet.** Phases are whole days, and the calendar events
  carry no times, so the days held are whole days too. Hours can come
  with times on phases if the office wants them.
- Jobs already in the app hold a day either side from now on, so a few
  more shortages may show between jobs a day apart. In the made-up data,
  two speakers still out after the gala now show short on the next two
  jobs, as they should.
- Six crew tests had started failing on their own once their October
  dates passed; they now run on a fixed day.
- Checked: the typecheck; the shared tests (180); the server tests (408,
  two new); the web build; the full browser suite (78), with the kit
  spec now changing a job's days from the Kit card.

- Merged into `main` at 10:27 UTC once GitHub's checks passed, and live
  by 10:36: Railway deployed it on its own.

**Next**

- Stocktakes and rolling counts
  ([PR #57](https://github.com/sessionhire/sess-sys/pull/57)) took
  Decision 0030 first, so this is 0031. With both in, the rest of
  Phase 2 is the labelling rollout, which is work in the warehouse
  rather than in the app, and RFID later.

## 4 October 2026: stocktakes, rolling counts and four loose ends

**Done**

- Colly, 4 October: "Merge 56 and go with 1 and 2". #56 is merged and
  live (see 3 October). Then the two parts below, each built, then read
  by a reviewer trying to break it and corrected.
- **Stocktakes and rolling counts**
  ([Decision 0030](adr/0030-stocktakes-and-rolling-counts.md)).
  - A place or a case is counted on a phone, with no signal needed.
    Labels are scanned. Counted kit is typed without the record beside
    it, so the number on the screen doesn't become the count.
  - **Finish** says what's different, in words, with each fix one tap
    away:
    - not found: report it missing;
    - in the wrong place: move it here;
    - not expected: bring it back, mark it found, or put the label on
      its item;
    - counted kit short or over: set the count.
  - Kit out with a job, already missing or in repair is never called
    newly missing. Counted kit out on jobs never lowers what's owned.
  - Each place and case shows when it was last counted and by whom, and
    each item's log says what a count found.
  - The Stock tab's Counts card lists this week's places: those never
    counted first, then those counted longest ago, so every place is
    counted within a quarter. It shows how far the round has got. The
    first round, once the stock list is in, is the baseline stocktake.
- **Four loose ends**:
  - **Hidden characters.** Text pasted from Word or a PDF can carry
    invisible control characters. They gave a server error on staff
    forms, and also on the freelancer's link, the crew list import and
    documents. Text is now cleaned of them everywhere, keeping tabs and
    line breaks. A character the database still can't hold is turned
    down in plain words, never a crash, and is never reported as one.
  - **"Mark as there"** works now on a phone that hadn't yet heard the
    freelancer say they were late.
  - **Archived approvers.** Someone archived is told so when they try
    to approve leave, on the server and on the Leave screen.
  - **A history browser test that failed now and then.** It was a race
    in the test itself, and two other tests had the same pattern; all
    three are fixed. In the app, a sync asked for while one was failing
    now runs, with one retry at a time, never more.
- Found and fixed in review:
  - a count could move an item out of its case;
  - a case found only by what's in it was called missing;
  - an older count's page could undo newer changes;
  - a long maker's QR code could leave a count that could never be
    finished;
  - two tabs on one phone overwrote each other's scans;
  - a phone with its clock set ahead could leave a place counted for
    good;
  - a half-done count stayed on the phone after signing out;
  - the history named the wrong counter;
  - the character safety net would have hidden a real server bug;
  - sync retries piled up on a poor signal.
- The download test in the history spec failed once the shared test
  server had more than 1,000 rows. The test expected "(123 rows)", but
  the app writes "(1,234 rows)". The test now reads the number as the
  app writes it, and the size in MB too.
- Checked with both parts together:
  - the typecheck;
  - the shared tests (194);
  - the server tests (412 on PGlite, and the real-Postgres file, 13);
  - the web build;
  - the full browser suite (84);
  - the history, counts and sign-in specs ten times over (120).

**Next**

- The stock list next week. Then the baseline stocktake: count every
  place once, from the Counts card on the Stock tab.
- The keys:
  - the Google key;
  - the backups bucket, with `BACKUP_KEY`, for documents' files too;
  - the Sentry key.
- Then the real crew list, after Start fresh, and an approver opening
  2026 for leave.

## 3 October 2026: the small items

**Done**

- The small items Colly asked for ("you can start on those small
  items"), each built, then read by a reviewer trying to break it and
  corrected.
- **Running late from the office**
  ([Decision 0028](adr/0028-certificates-a-call-needs-and-running-late.md),
  amended). Someone who rings in to say they're late can be noted from
  the call's line, with the same choices as their link, and marked as
  there. It shows everywhere the link's does, and the history says who
  noted it.
- **Old running-late notes cleared.** Thirty days after its day, a
  running late goes, with every copy of it and the words in the
  history, since no law asks for it; the server does it on its daily
  look.
- **The call-changed message** says when a call starts or stops
  needing a certificate, and call sheets show what each call needs.
- **Documents** ([Decision 0029](adr/0029-documents.md)). A person's
  insurance, certificate cards and other documents, each with a day it
  runs out, on their card; a freelancer sends a renewed one from their
  link and the office checks it, which sets that certificate's date, so
  there is only ever one. Documents running out join certificates in
  one list, with a message ready. Files go in the backups' bucket,
  encrypted with `BACKUP_KEY`; until the bucket is set up the details
  and dates work and the file waits. Erasing a person deletes theirs at
  once.
- Every request now has five minutes to arrive, so nobody can hold a
  connection open for ever by sending a post a byte at a time.
- Found and fixed in review: a running late turned down for a day far
  off, or no real day, would have kept its words for good; "Mark as
  there" had a different name for screen readers than on the button; a
  document's download failed when its name was cut in half an emoji;
  the link's upload read 10 MB from anyone before checking the link;
  and a long one-word title pushed a phone's page sideways.
- Checked with both together: the typecheck; the shared tests (180);
  the server tests (394 on PGlite, and the real-Postgres file, 12, with
  two servers clearing at once); the web build; the full browser suite
  (78), and the documents and certificates specs three more times.
- Merged into `main` on 4 October at 07:24 UTC (Colly: "Merge 56") and
  live by 07:34 once main's checks passed. The live database has the
  documents module at version 1 with its `documents` and
  `document_files_to_delete` tables, and nothing went wrong at start-up.
  The server says documents' files are off until the backups' bucket is
  set, as expected: their details and dates work meanwhile.

**Next**

- See 4 October.
- The stock list next week. On the live server, a list of 1,500 rows is
  expected to take about 8 to 10 minutes with the page left open.
- The keys: the Google key, the backups bucket (now for documents'
  files too, with `BACKUP_KEY`), and the Sentry key. Then the real crew
  list, after Start fresh, and an approver opening 2026 for leave.

## 3 October 2026: leave years the office opens

**Done**

- **Leave years the office opens** (Colly, 3 October: "the office have
  to manually open the years for leave. So staff can't apply for leave
  very far in advance"; ADR 0024 amended). An approver opens each year
  for leave from the Leave screen, this year or next only, and an open
  year stays open. Staff can only ask for leave in an open year, and are
  told plainly when the next one isn't open yet; allowances can be set
  for this year or next. On a server already in use, the update opens
  this year and any earlier year that already holds leave. Since no
  leave can now be put in a year far ahead, a slip can't keep an erased
  person's name for decades.
- Colly confirmed that erasure keeps declined and cancelled leave for
  three years along with approved leave, and that a kept name lasts as
  long as the records it's kept for. Both were already so; ADR 0027
  says it.
- Found and fixed in review: the update would have opened a year far
  ahead if an allowance had been typed for one; a year that wasn't a
  whole number was turned down with "2,000" in its words; the "not
  done" list wrote a year as "2,026"; and an erasure test could fail by
  chance when a random id happened to hold one of the words it looked
  for, about one run in twenty.
- Checked: the typecheck; the shared tests (169); the server tests (371
  on PGlite, twice, and the real-Postgres file, 11); the web build; the
  full browser suite (74), and the history spec five more times.

- Merged into `main` at 10:45 UTC (Colly: "Finish off that PR") and
  live by 10:54 once main's checks passed. The live database has the
  leave module at version 2 with its `leave_years` table, and nothing
  went wrong. No year is open there yet: the live database is still
  empty, and the update opens years only on a server already in use, so
  made-up data and a restore start clean. When the real staff are in,
  an approver opens 2026 on the Leave screen with one tap.

**Next**

- The small items, being built: the office recording running late for
  someone who rang in, old running-late notes cleared after their day,
  the call-changed message naming a change to the certificates a call
  needs, and documents uploaded with expiry reminders.
- The stock list next week. On the live server, a list of 1,500 rows is
  expected to take about 8 to 10 minutes with the page left open.
- The keys, as before: the Google key, the backups bucket (and a
  `BACKUP_KEY`), and the Sentry key. Then the real crew list, after
  Start fresh, and opening 2027 for leave when the office is ready.

## 2 October 2026: the stock list, item logs, erasure, certificates and running late

**Done**

- Everything that could be built without waiting on the keys, in four
  streams built side by side, each read by a reviewer trying to break it
  and corrected, then brought together and checked as one.
- **Bringing in the stock list**
  ([Decision 0026](adr/0026-bringing-in-the-stock-list-and-item-logs.md)).
  Colly's list arrives next week and nobody here has seen it, so the
  reader doesn't depend on one layout. Columns are found by their names,
  and a column the reader doesn't know is asked about, never guessed at.
  Rows become products and numbered items or counted stock. A Session
  Hire number on the list is kept when it's free; any other tag is kept
  as the item's old number, and scanning it still finds the item. New
  numbers are never ones used before. Places and cases the list names
  are only made when the office ticks to make them. Every row is checked
  first, fixed in place or skipped, and nothing is saved until the
  office says so. Bringing the same file in twice changes nothing the
  second time. A long list goes in a part at a time, each part saved,
  so it never holds up the phones; choosing the file again carries on
  where it stopped. A made-up sample is in `docs/samples`, and the
  decision says how to shape the sheet.
- **A log on each item's page** (the same decision): out to a job and
  back, faults and repairs, missing and found, PAT tests, moves and
  changes, newest first, with who did it. What the phone knows shows
  with no signal, and the rest fills in from the server when there is
  signal. GPS trackers would add to the same log later. AirTags can't,
  because other apps can't read where they are.
- **Erasing a person on request**
  ([Decision 0027](adr/0027-erasing-a-person-on-request.md)). This is
  GDPR's right to erasure. It's done from an archived person's card, and
  refused while they have work still to come. Their details go from
  everywhere they're held: the card, every earlier copy in the change
  feed, the history's stored commands, the export, every device, and a
  staff member's sign-in. Someone with paid work in the last six years
  keeps their name and timesheets, because Revenue needs the records.
  Backups can't be edited and age out within a year; putting one back
  never brings an erased person back.
- **Certificates a job needs**
  ([Decision 0028](adr/0028-certificates-a-call-needs-and-running-late.md)).
  Safe Pass, working at height and IPAF join first aid, manual handling
  and the driving licence, and the crew list reads them. A crew call can
  say which it needs. An offer to someone without one, or whose card
  runs out before the job ends, is turned down, saying why; not known is
  allowed with a warning. A list on the Crew tab shows cards that have
  run out or run out in the next 30 days, each with a message ready
  asking for the new card.
- **Running late** (the same decision). On the day, a freelancer's link
  lets them say how late they'll be, with a note, and then that they're
  there. The office sees it at once on the Crew tab, on the call and on
  the planner; the contact on the day sees it on their call sheet.
- **The History tab** is grouped by day, and within a day by person,
  with a run of changes folded to one line that opens on a tap. While
  sign-in is off it groups by device and says why once, at the top.
  **The old sync test** is gone from the app, with its commands and its
  four empty tables. Its tests now run on real commands, and a phone on
  an older version is told plainly that something it held isn't done
  any more.
- The reviewers found and fixed, among others: a long stock list going
  in at once, holding every phone's sync for minutes and timing out; a
  sheet split by semicolons read as one column; a totals row becoming a
  product; a month-first date read the wrong way round; old tags not
  working for packing a case; erasing an old record switching off a live
  staff account with the same email; erasure damaging other people's
  stored history; an erased person staying a guest on future calendar
  events; an older version of the app unable to clear a certificate; and
  a card that ran out after a job was over still counted against it.
- Checked with all four together: the typecheck; the shared tests (161);
  the server tests (356 on PGlite, and the real-Postgres file, 9); the
  web build; the Blueprint build; the full browser suite (72), with the
  new specs run three more times; and screenshots of each new screen at
  phone and laptop widths, light and dark.
- Merged into `main` at 18:46 UTC once GitHub's checks passed, and live
  by 18:55: Railway waited for main's checks, then deployed it on its
  own. The live database has the core schema at version 5, with the old
  sync test's four empty tables gone; stock at 8, with an item's old
  number, its PAT due date and the new index; crew at 9, with what a
  call needs and the running-late table; and erasure's own module at 1.
  The new import route answers, the start-up log says where the list of
  erasures is kept while backups are off, and nothing went wrong. The
  Blueprint rebuilt itself from `main`.

- **Records kept for their recommended time, then let go** (Colly, 2
  October: "Keep all records for the recommended timeframes"; ADR 0027
  amended). Erasing someone now keeps their staff leave records (leave
  asked for, days in lieu and allowances) for three years, as the
  Organisation of Working Time Act asks, with their notes and the
  approver's reasons cleared. Pay records keep their six years for
  Revenue, as before. The name stays only while a kept record needs it.
  The server goes through what erasures kept once a day, after Irish
  midnight, and lets each record and name go on its day, so nobody has
  to remember; the "Erase the name now" button is gone. Erasing waits
  while someone's leave waits for a decision, so nothing is left that
  can never be decided. The decision has a table of how long each kind
  of record is kept, and why.
- Found and fixed in review: a staff member's older leave would have
  stayed until their newest leave's day rather than its own, and a
  restore could bring back a request still waiting for a decision that
  could no longer be made.
- Checked: the typecheck; the shared tests (168); the server tests (366
  on PGlite, and the real-Postgres file, 11, with two servers running
  the daily look at once); the web build; the full browser suite (73).

**Next**

- See 3 October.

## 2 October 2026: audit round three

**Done**

- The audit's P2 list, findings 16 to 27, in four streams built side by
  side, each read by a reviewer trying to break it and corrected, then
  brought together by hand. Under each finding the audit says how it was
  fixed, and anything left.
- **Screens that fit the device** (findings 16, 24, 25 and 26). The Crew
  tab groups the open calls by job and day, each call one line until
  it's tapped, with offers and forms behind buttons. People are found by
  name, department or skill, with or without fadas, in the offer picker
  and in the people list, which folds to its first ten. Stock and a
  job's page fold their long lists. On a laptop, from 960 px wide, Jobs
  and Stock show the list beside what's open. One status pill, one
  "Waiting to sync", one clock for the Irish day that turns at midnight
  (the clocks going back on 25 October included), one empty line, and
  the text styles throughout; and icons for adding the app to a phone's
  home screen.
- **Mistakes that can be taken back, and scanning finished** (17, 18 and
  19). Testing a batch holds each read for five seconds with Undo before
  it counts. Putting kit away works by camera, the camera stays open
  from one item to the next, a link opened inside WhatsApp or Gmail says
  to open it in Safari or Chrome, codes are only read inside the frame,
  and a camera that can zoom gets a slider. A product can be marked
  "added by mistake", which frees its name. Setting label numbers aside
  asks first, and a run with none of its labels used can be cancelled;
  its numbers are never given out again. A fault's details can be
  changed, and a place that doesn't exist is asked about before it's
  made.
- **The server hardened, and devices true to it** (20, 23 and 27). Files
  with their hash in their names are kept for a year; every answer
  carries the security headers, with HSTS over https; the CORS plugin is
  gone, since nothing on another site calls the app. A database
  connection dropping in the middle of a change no longer stops the
  server. A calendar sync that fails tries again after one, five and
  twenty-five minutes. Downloading everything writes nothing until the
  app records it. With `BACKUP_KEY` set, backups are encrypted. A device
  with changes waiting shows what the server will do with them, and
  every device lists things in the same order. New tests for the sync
  client, each view on its own, a deploy while the app is open, and
  every command and server action having its words in the history.
- **The freelancer's page and accessibility** (21 and 22). The office
  can set a reply-by day, suggested from the job's dates and never after
  them. A day the person is booked on another job is shown as such and
  never ticked for them. The calendar address has Copy and Subscribe.
  Staff are never shown or sent a rate. Past work and declined or
  withdrawn offers are listed apart, with dates. Nothing typed into the
  page's address ever appears on the page. Field borders show in
  daylight; focus and the tab's title follow every move; one main area;
  back links big enough to tap; the current tab and the grey pill
  readable; the "not done" count read out; a label on every field.
- The reviewers found and fixed, among others: a cancelled label run's
  numbers being given out again, so two labels could carry one number;
  a database connection dropping mid-change stopping the server; an
  offer made with no signal showing nothing on its call line; Enter in
  the picker's search sending the offer; a reply-by after the job being
  accepted; and staff being named a rate in messages.
- Checking the four together found one more. Moving the focus to a new
  screen's heading happens a frame after the move, and could take it
  from someone already typing in that screen's search, so their Enter
  went nowhere. A field someone is typing in now keeps the focus, and a
  test holds that frame back to prove it.
- Checked with all four streams together: the typecheck; the shared
  tests (110); the server tests (313 on PGlite, and the real-Postgres
  file); the web build; the full browser suite (63), with new specs for
  the layout, scanning, accessibility and a deploy while the app is
  open; and screenshots of every area at phone and laptop widths, light
  and dark.
- Merged into `main` at 10:07 UTC once GitHub's checks passed, and live
  by 10:14: Railway waited for main's checks, then deployed it on its
  own. The live database has the stock schema at version 7: a label run
  can be marked cancelled, a product as added by mistake, and a
  product's name need only be unique among those not marked. Every
  answer from the live server carries the security headers, hashed
  files are kept for a year, and another site's preflight gets a 404
  with no CORS header. The Blueprint rebuilt itself from `main`.

**Next**

- Finding 1 still waits on Colly's keys: the Google key for sign-in, the
  backups bucket (and now a `BACKUP_KEY` to encrypt them, made once with
  `openssl rand -hex 32`), and the Sentry key.
- Invoicing is parked for now (Colly, 1 October); its plan stays in the
  roadmap.
- The audit's P3 list is what's left of it.

## 1 October 2026: crew profiles and bringing in the list

**Done**

- The real crew list is a spreadsheet of 124 staff, freelancers and
  applicants, and the app's person now holds all of it
  ([Decision 0025](adr/0025-crew-profiles-and-bringing-in-the-list.md)):
  a department (free text, the known ones offered as you type), a level
  from 0 to 5 shown as "Level 3" (Colly's call: one number in place of
  preferred and onboarded, higher more preferred, 0 an applicant nobody
  has vetted), the name they go by (used in the greeting on their link
  and in every message the office is prompted with), first aid, manual
  handling and driving licence as held, not held or unknown with an
  expiry date, and the company a freelancer trades through with its VAT
  and CRO numbers. Each is optional on the command, so an older version
  of the app keeps what the server has.
- The person's card shows it all, with a warning when a certificate has
  run out, a Level select that moves them without opening the form
  ("Moved Dara Quinn to Level 3" in the history), and "Worked": the jobs
  they were booked on, built on each device from their bookings, newest
  first, with a count. Past events from the spreadsheet aren't brought
  in (Colly, 1 October): the list grows from here.
- The Crew tab's list says the department and level on each person and
  narrows to one department; the Offer to… picker sorts by department
  then level, highest first, and keeps applicants out until "Show
  applicants" is ticked.
- **Bring in a list**, from a card on the Account tab: choose the
  spreadsheet saved as a .csv, see every row as the app read it with the
  counts at the top, fix a phone, email or name in place (checked again
  by the same rules as you type) or skip the row, then bring them all in
  at once. Phones in every shape the file has go into international
  form; what can't be read is marked, never guessed. Rows match people
  already here by email, then phone, so the file can go in again after
  it's updated without doubling anyone; a matched person keeps the
  office's level, day rate and kind, gains the file's skills and notes
  once, and nothing in the app is erased by a blank cell, down to a
  certificate's expiry date and a VAT number. One bad row refuses the
  whole import, naming it, and nothing goes in.
- Two reviewers read the build (a data lens and an app lens) and the
  import was tightened before the real file goes near it: a row for
  someone archived is marked and never revives them; a row whose email
  is one person's and whose phone is another's, or a second row for one
  person, is marked rather than guessed at; a phone fixed in place is
  matched again on the device, and the server refuses a row whose match
  isn't what the preview showed rather than overwriting someone unseen;
  the fields on a row with a problem stay put as the problem clears
  instead of vanishing mid-word; a second import of the same file sends
  nothing for anyone it would leave as they are ("4 were already up to
  date"), so the history doesn't gain 124 lines each time; "Bring in"
  asks first, as the calendar import does; and the reader marks a UK
  number typed locally, a day rate it can't read and a name over 200
  characters, numbers rows by their line in the spreadsheet, and says
  when a file's letters didn't survive the save.
- The made-up people have departments and levels, a certificate in date
  and one run out, Dara trading through a VAT-registered company, and
  an applicant at Level 0.
- Checked: typecheck; 80 shared tests (14 new: the CSV reader on quotes,
  line breaks, Windows line endings, the byte-order mark and blank
  lines; the phone normaliser on every shape and the ones it must mark;
  a row read end to end; a row with problems fixed in place; matching
  with what the office must decide marked; the counts; Worked from a
  person's own first day); the server suite on PGlite (9 new: the
  preview's matching by email then phone with an archived person marked,
  bringing in with the union of skills, notes added once and cut to fit,
  the level and rate kept, a certificate's expiry and the VAT and CRO
  numbers kept, the same file again adding nobody and sending nothing, a
  bad row refusing the lot with nothing applied, a match the preview
  didn't show refused, the history and export lines, the level's own
  command and its plain refusals); the web build; the full browser suite
  with a new test (from the Account tab, a small made-up file with a
  company email, an unreadable phone and an applicant, the phone fixed in
  place a key at a time with the field staying put, the question before
  bringing them in, the Crew tab showing department and level, the
  applicant hidden from the picker until asked for, and the same file
  again adding nobody).
- Merged into `main` at 20:51 UTC once GitHub's checks passed, and live
  by 20:58: Railway waited for main's checks, then deployed it on its
  own. The live database has the crew schema at version 7 with the
  seven new columns on people, and the health check answers on the new
  build.

**Next**

- The afternoon of checking the real file in the preview: the phones the
  reader marks, the email with the typo, the four people with no way to
  reach them, and what the three blank departments should be. It goes
  in after Start fresh, and only once sign-in is on: until then the app
  is open to anyone with its address, and the file is personal data for
  124 people.
- Later items written into the ADR: Safe Pass, working at height and
  IPAF; an expired required certificate blocking an assignment; a text
  search in the picker that matches jobs worked; the stock list through
  the same step; removing an applicant who isn't taken on.

## 1 October 2026: the Blueprint's hero

**Done**

- The system map at the top of the Blueprint (the flight-case board,
  merged this morning) is replaced by a full-width hero above the
  sidebar and the content, as Colly asked: the business first, the
  systems second. One job goes through eight numbered chapters (enquire
  and quote, book and plan, crew it, prep the kit, deliver and run the
  show, return and repair, pay and invoice, and underneath it all, the
  cloud). Each chapter says who and where, its state in words, what the
  app does there, and names the parts of the app that do the work as a
  second layer, each with its build mark (built, in progress, planned,
  waiting on a key).
- A tag travels the baseline as one job, lighting each chapter as it
  arrives with a word on what just happened. Hover, tap or Enter pins a
  chapter and the footnote says what is left. Reduced motion gets a
  still frame. Laptop, tablet and phone each have their own layout, in
  light and dark, with nothing under 12px.
- Chosen from three concepts (a strip, an arc, and chapters) by three
  judges reading against Colly's critique, with the runners-up's best
  ideas grafted in; then read by a reviewer whose four must-fixes (a
  cramped top, ragged card bottoms, a half-empty title spread on
  tablets, and freelancer invoices over-claimed) and most suggestions
  went in.
- Checked at 1440, 1280, 1150, 1100, 1024, 768 and 390, light and dark,
  motion and reduced motion: no console errors, no horizontal scroll,
  the hero under 760px on a laptop.

**Next**

- The hero's facts (lines of code, tests, decisions) are typed into the
  page; the build script could fill them from the repo so they never
  drift.


## 1 October 2026: staff leave and time in lieu

**Done**

- Colly answered the three invoice questions: freelancers write their
  own invoices and email them to the office; some of them are
  VAT-registered; and an invoice can cover one job or several over a
  period, either way. So the app will tell each freelancer what to
  invoice and track what arrives, rather than make the invoice; the
  roadmap and the architecture say so now.
- Colly answered the open question from ADR 0009: calendar invites go
  out to crew when they're offered a job, and accepting the invite in
  Google Calendar is one acceptable way of agreeing to it. That is what
  was built, so the decision record now says so.
- The stray `@sh/web` service on Railway is gone: Colly committed the
  staged deletion on 1 October. Only `@sh/server` is left.
- The first part of the app that is for the staff rather than the jobs:
  annual leave and days in lieu, applied for and approved in the app.
  [Decision 0024](adr/0024-staff-leave.md) has the reasons, and Colly's
  calls: the calendar year, lieu in days, a flag for who approves until
  roles exist, and no sick or unpaid leave yet.
- A request is a span of whole days, counted in the weekdays that aren't
  Irish public holidays, which a new rule book works out for any year
  (checked against the published 2026 and 2027 dates). The form says the
  count before anything is sent; the server counts again.
- The **Leave** screen under Crew: my year as facts (allowance, carried
  over, taken, booked, waiting, left; and lieu earned, to be approved,
  taken, booked, waiting, left), last year and next year, Apply, Log a
  day in lieu, and my requests with Cancel. For anyone with "Can approve
  time off" on their person: the queue, oldest first, with what to weigh
  up (jobs they hold those days, other staff off or asking for the same
  days), Approve and Decline in place, and every staff member's
  allowance to set. The Crew tab's badge counts the waiting requests for
  an approver.
- Approved leave is days off under the request's own id: the planner
  shows it, offers warn, the clash is flagged if they're booked, and the
  person's own calendar feed carries it as an all-day event. Declining
  or cancelling takes it off again, and neither the office by hand nor
  the person from their private link can remove those days off. The
  planner marks public holidays as a faint band.
- Who "me" is: the signed-in account's email matched to a person on the
  Crew tab, and the server checks a request is the person's own and a
  decision is by an approver. While sign-in is off the screen asks "Who
  are you?" once and the device says who is deciding, so it works today
  and becomes honest by itself when the Google key goes in.
- The made-up data has allowances for the three staff, Aoife approving,
  Cian's week and day in lieu waiting, and Orla's week last month taken.
- Checked: typecheck; 66 shared tests (10 new: the holidays by rule, the
  count across a bank holiday, the balances with and without an
  allowance, overlaps, the device's view with its own changes and the
  planner's clash); the server suite on PGlite (8 new, each rule in turn
  with signed-in staff, the planner, offers, the feed and the private
  link after approval, nothing approved for someone archived, and the
  device saying who it is with sign-in off); the web build; the full
  browser suite with a new test (pick who you are, apply for three
  days, the approver's badge counts it at once, the approver approves,
  a blanked allowance is turned down in place, the planner shows the
  days off, an offer warns).
- Merged into `main` at 14:14 UTC once GitHub's checks passed, and live
  by 14:21: Railway waited for main's checks, then deployed it on its
  own. The three leave tables are in the live database at version 1,
  and the health check answers on the new build.

**Next**

- Later items written into the ADR: half days, working patterns, sick
  and unpaid leave, carrying days over by rule at the year end, lieu in
  hours, roles instead of the flag, and telling the person their request
  was decided through the Send panel.
- Colly: the Google key, the backups bucket and the Sentry key are still
  the first three items on the list; with the key in, leave checks who
  is asking by itself.

## 1 October 2026: audit round two

**Done**

- The P1 loops from [the audit](audit-2026-09-30.md), findings 7 to 15,
  decided in [ADR 0023](adr/0023-audit-round-two-the-loops.md). Five
  streams, each built in its own worktree, read by a separate reviewer,
  corrected, and merged by hand.
- People can be edited and archived (never deleted), and freelancers fix
  their own phone and email on their link. A crew call can be changed
  after it's made; a phase that moves asks whether its crew move too;
  nobody is ever un-booked silently. Booked means confirmed everywhere.
- The office is prompted to tell people after Confirm, Withdraw, a
  cancelled job, a changed call, a moved phase and an approved
  timesheet; the Crew tab counts answers to check, declines and
  pull-outs wait there until Noted; office details sit on every
  freelancer page; a booked freelancer can say "can't make it".
- The device rebuilds and saves only when something changed (at 31× the
  made-up data the rebuild went from 44 ms to 18 ms and the idle tick
  from 137 ms to 3 ms); storage fails safely, two tabs never fight, and
  a start-up that fails shows a card, never a white page.
- Every refusal is shown where it happened, the top bar counts what
  wasn't done with one list, every browser alert and confirm is gone,
  and prices read as typed ("€1,250").
- Round one went live on 1 October at 08:54 UTC (merged as 1b189c4; the
  live server answers 404 for a missing asset, which proves the build).
- Checked: typecheck; 56 shared tests; the server suite on PGlite and on
  real Postgres; the web build; the full browser suite (42 tests, two new
  ones for refusals). The reviewers' must-fixes went
  in before each merge: an empty contact change, a misleading notes
  placeholder, a reformatted import, screens not told when a round ended
  or the day turned, the link's inputs blocking "€300", the not-done
  list covering the top bar on a phone, spaces in a price, and forms
  wiping what was typed.

**Next**

- Round three alongside invoices (P2): grouped and collapsed screens, a
  person picker with search, batch-test undo, camera in the put-away
  flows, "added by mistake", server hardening, accessibility, the laptop
  layout, the home-screen icon.
- Left for later and written down: the right to erasure, "running late"
  on the day, a per-item log on the stock item page, GPS trackers.
- Colly: the Google key, the backups bucket and the Sentry key are still
  the first three items on the list.

## 1 October 2026: audit round one

**Done**

- The P0 fixes from [the audit](audit-2026-09-30.md), findings 2 to 6.
  Each finding there now says how it was fixed.
- One bad change can't strand a phone any more. A server error nobody
  expected drops that one change with a plain reason, logs and reports
  it, and lets the rest of the push through; a 500 never carries
  Postgres's words; a date that isn't real is turned away on the device
  in plain words; a change the device's own view can't show is turned
  away before it's saved, or set aside as a problem when the app opens
  on an old copy.
- A big backlog goes up in slices of 500, with a 30 s push timeout.
- A deploy no longer breaks the open app: a bar offers "A new version
  is ready. Reload", a missing file answers 404 rather than the page,
  a page whose file has gone starts itself again, and a change for a
  table this build doesn't know is kept for the build that will.
- On the freelancer's page, Enter in the rate field sends the rate
  (never accepts), and the message after an answer lands in the card,
  as an alert when it's a refusal.
- Checked: typecheck; the shared tests (22, with new ones for slices,
  the stale stop, bad dates, the view guard, the un-brick on open,
  unknown tables and the prototype guard); the server tests on PGlite
  and on real Postgres (new: a fault inside a handler, a year-0
  timestamp, a 500's answer, a 400's answer, the calendar sync getting
  the fault, Enter on the link page, the message in the card, a missing
  asset); the web build; the whole Playwright suite with a new
  freelancer-on-a-phone test. Each fix was reviewed by a separate
  reader before it was merged, and their two must-fixes (the year-0
  timestamp, and old Safari passing over a hidden button) went in.

**Next**

- Round two: the P1 loops (edit person, `call.update`, prompted
  messages, the Crew tab count, "Can't make it", one not-done
  indicator, the idle sync cost, storage, "booked", the money parser).
- Colly: the Google key and the backups bucket are still the first two
  items on the list.

## 30 September 2026: audit

**Done**

- A full audit of the app before freelancer invoices: reliability,
  security, every screen and the freelancer pages, the flows for each
  kind of person, bugs, and how it holds up as the data grows.
  [The audit](audit-2026-09-30.md) has every finding with its evidence,
  in priority order, and the order to fix them.
- The foundations checked out: sign-in, the command log and change feed,
  retries, backups, the export, escaping, the Google flows. Nothing lets
  an outsider in or leaks one person's details to another.
- What it found, in short: things that can be created but not corrected
  (a person's number, a crew call's time, a phase's crew when it moves);
  answers and changes nobody is told about; four ways a phone can be
  left stuck or blank (one bad change, a big backlog, a deploy, a full
  disk); two traps on the freelancer's page (Enter accepts the job at the
  offered rate; the message lands off-screen); and a data model rebuilt
  and re-saved in full every 30 seconds, which will slow down as the
  years' jobs accumulate. Timesheets, merged earlier, went live by
  themselves.
- Checked by hand: the bad-date 500, the missing-file answer after a
  deploy, the Enter-accepts trap, the off-screen message, and the timings
  (2.7 ms on the made-up data, 38 ms at 31×, 6 s at 51×).

**Next**

- Round one of the fixes (the P0 list), then round two, then invoices
  alongside round three.
- Colly: the Google key and the backups bucket are the first two items
  on the list.

## 30 September 2026: timesheets

**Done**

- The second part of Phase 3: freelancers send a timesheet for each
  booking, and the office checks and approves it.
  [Decision 0022](adr/0022-timesheets.md) has the reasons.
- Freelancers bill a day rate, so a timesheet is the **days worked** at
  the booking's agreed rate, plus **extras** such as parking, tolls or
  mileage, and a note. There's one for each confirmed booking, from its
  first day. Staff are paid through payroll, so they have none.
- A freelancer's private page lists their **Timesheets**: to send, sent,
  and approved lately. Each opens with their booked days ticked and rows
  for extras, sent with no app, and they can change it until the office
  approves it.
- The Crew tab has **Timesheets**: to approve, not in yet, and approved
  lately. **Check** opens one to change the days, rate or extras, with a
  note and a preview of what the freelancer will see changed, then
  **Approve** in one step. **Ask** sends someone a link straight to
  theirs. **Fill in** puts one in for someone who won't. An approved one
  is reopened to change it.
- Once approved, the freelancer sees the total, each line, and anything
  the office changed, in words: "Mileage: €20, not €25.50".
- The made-up data has the Autumn Gala's crew, which is over: Dara's
  timesheet waiting to be approved, Tadhg's approved without his
  dinner, and Laoise's not in yet.
- Checked: 5 new tests of totals, changes and which bookings have one,
  and of the office's list with changes waiting to sync. Also 4 new
  server tests: sent from a link and shown on the freelancer's page;
  only for their own confirmed booking, from its first day, on their
  booked days; approved with changes, settled, and reopened; and put in
  by the office. A new browser test runs from the office's check and
  approval to a freelancer's phone and back.
- Call sheets, merged earlier today, went live by themselves once main's
  checks passed.

**Next**

- Colly, to try it: put in the made-up data, then **Crew**, and
  **Check** under Timesheets.
- Is anything paid by the half day, or with overtime? For now the office
  changes the rate or adds an extra line.
- Next in Phase 3: ready-made freelancer invoices from the approved
  timesheets, with their payment status on the freelancer's page.

## 30 September 2026: call sheets

**Done**

- The first part of Phase 3 since crew booking: each phase of a job has a
  call sheet, worked out from what the app already holds.
  [Decision 0021](adr/0021-call-sheets.md) has the reasons.
- A phase on a job's page has **Call sheet**, with who crew ring on the
  day. The sheet has the phase's days, where (with the map and the
  venue's notes on access and parking), the running order from the
  phase's notes, and who's on for each crew call, by call time.
- The office picks the **contact on the day** for each phase, from
  anyone in the app. Their name and number go on everyone's sheet.
- The office's sheet shows everyone asked, with their numbers and
  whether they're booked, still to confirm or only offered, places still
  to find, the kit, and the client's contacts. It works with no signal,
  **prints** on one A4 page, and **copies for a crew's WhatsApp group**
  with no number but the contact's.
- **Send** beside each person who has said yes gives them a link to
  their own sheet by WhatsApp, text or email, and it's on their private
  page too, with no app. Theirs shows their call first, who to ring,
  where, the running order, and who else is on by name only. The contact
  on the day sees the crew's numbers and the kit on theirs.
- The made-up data has contacts on the day, running orders and a crew
  chief booked for the festival. Its phone numbers are from the range
  kept for TV and radio drama, which never ring anyone.
- Checked: 5 new tests of what each reader sees, 4 new server tests (the
  sheet on a private link for someone booked, the contact on the day
  with the crew's numbers and the kit, no sheet for a call only offered,
  someone else's or cancelled, and the contact kept to people in the
  app and in the history), and a new browser test (the office's sheet,
  the contact changed, copied for a group, printed, sent, and opened on
  the freelancer's phone). All 38 browser tests and all 244 server tests
  pass, on real Postgres too.

**Next**

- Colly, to try it: put in the made-up data, open Harbour Lights
  Festival, and **Call sheet** under Show.
- Next in Phase 3: timesheets from the bookings, then ready-made
  freelancer invoices.

## 30 September 2026: PAT tests and thorough examinations

**Done**

- The seventh part of Phase 2: electrical tests (PAT) and thorough
  examinations of lifting gear are recorded on each item, the app works
  out when each is next due, and kit that failed or is overdue can't go
  out. [Decision 0020](adr/0020-inspections.md) has the reasons.
- A numbered product's **Change details** has **PAT every, in months**
  and **Thorough examination every, in months** (blank for never). Its
  page says "Testing: PAT every 12 months", how many of its items can't
  go out, and flags each one.
- An item's page has an **Inspections** card: where it stands on each
  ("PAT due 30 Sept 2027", due soon, overdue, failed, or not recorded
  yet), **Record a test** (passed or failed, the day, who did it, a
  note), and every one recorded. A failed or overdue item says so at the
  top.
- **Test a batch**, from the Stock tab: pick PAT or thorough examination
  and who's testing, then scan or type each item that passes. Each scan
  says "SH-000123 d&b Y10P: passed, next due 30 Sept 2027.", and **It
  failed** records a fail for the one just scanned. Works with no
  signal.
- The Stock tab's new **Inspections due** card lists what can't go out,
  what's due in the next 30 days, and how many aren't recorded yet.
- Failed or overdue kit isn't counted as owned, so a job's kit says
  "2 owned and fit to go out (1 damaged, missing or due a test)"; the
  pick list leaves it out of where to find kit, and warns when it's
  scanned out: "PAT failed on 30 Sept 2026. Test it before it goes."
- Every record is kept for good, is in the History tab and the export
  (new table `inspections`), and is turned down only for an item never
  saved or retired.
- Checked: 4 new server tests (the next due day, month ends included;
  records kept, sent twice, and turned down; the history; due, soon,
  overdue, failed and not recorded, what can't go out, a job short, and
  a retest with no signal) and a new browser test at phone size (the
  interval set, a test on paper recorded and overdue, the Stock tab's
  list, a batch tested with one fail and one with no signal, the failed
  item's page, the job short, and the scan out warned). All 37 browser
  tests and all 240 server tests pass, with the made-up data work merged in.
- Merged into `main` at 14:30 UTC once GitHub's checks passed, and live
  by 14:40: Railway deployed it on its own.

## 30 September 2026: made-up data to try the app with, and starting fresh

**Done**

- The real stock list, crew lists and calendars won't be in until next
  week, so the app can now be tried in full with made-up data, and cleared
  before the real data goes in.
  [Decision 0019](adr/0019-made-up-data-and-starting-fresh.md) has the
  reasons.
- On the Account tab, **Put in made-up data** fills an empty app with a
  few weeks of made-up jobs, crew and stock: speakers short between two
  jobs, a quote that would leave the moving heads short, an LED wall
  hired in, crew booked, offered, countered and declined, a freelancer
  on two jobs at once, labelled items and amps in racks, a roll of label
  numbers, pick lists for the jobs going out, and a job that's over with
  two speakers not back and one on the repair list. Every name is
  invented and nobody can be
  emailed or texted. The jobs are always in the coming weeks.
- While it's in, every screen says **made-up data** beside its name, on
  every phone.
- **Start fresh**, on the same card, deletes everything but the staff
  accounts, once "delete everything" is typed: made-up data and anything
  tried on top of it, the history too, and label numbers start again
  from SH-000001. It makes a backup first where backups are on, and waits
  for Google Calendar to be disconnected. One entry is left in the
  history, saying who did it.
- Every phone empties its copy by itself, and drops what it had waiting
  rather than sending it again, so nothing made up comes back, even from
  a phone that was out of signal.
- Checked: 10 new server tests (the made-up data through the server's own
  rules, with what each tab shows; only into an empty app; the typed
  words; everything deleted but the staff accounts, with one history
  entry; phones emptied and a phone's waiting changes dropped; a backup
  first, and nothing deleted if it fails; neither while Google Calendar
  is connected), one on real Postgres with twenty phones sending while
  the office starts fresh, and a new browser test (made-up data in,
  marked on every tab, then deleted with the words typed while another
  phone empties by itself). All 36 browser tests and all 236 server
  tests pass, on real Postgres too.
- Merged into `main` at 14:16 UTC once GitHub's checks passed, and live
  by 14:22: Railway deployed it on its own. The live app is empty, so
  made-up data can go straight in.

**Next**

- Colly, to try it: on the Account tab, tap **Put in made-up data**, then
  look round Jobs, Crew and Stock.
- When the real data is ready next week: Account tab, open **Start
  fresh**, type "delete everything" and tap **Delete everything**.

## 30 September 2026: faults, missing kit and repairs

**Done**

- The sixth part of Phase 2: kit that comes back damaged, or doesn't come
  back, is reported, repaired or written off, and it's taken off what's
  free for jobs until then.
  [Decision 0018](adr/0018-faults-missing-kit-and-repairs.md) has the
  reasons.
- **Coming back** on a job's pick list: after an item is scanned back,
  **Report damage to SH-…** takes what's wrong and whether it can still
  go out. Each item still out has **Missing** beside **Back**, and
  counted kit has **Missing** in its count and **Report damage to
  counted …**. The page says "18 back, 1 still out, 4 missing".
- Kit reported missing isn't out with the job any more, nor back. A
  missing item that's scanned anywhere is marked found at once, and the
  answer says so.
- An item's page, and a counted product's page, have **Report damage**
  and **Report missing** at any time, and list their faults. The item's
  page says its fault at the top.
- The Stock tab's new **Faults and repairs** card is the repair list:
  every open fault, each with **Repair notes** and how it ends (**Fixed**,
  **Not faulty**, **Found**, or **Write off**). Writing off retires an
  item (scrapped, or lost) or takes counted kit off the count, biggest
  count first. Nothing is deleted.
- Kit missing, or damaged and not fit to use, isn't counted as owned, so
  a job's kit says "Short 1: 2 owned and fit to go out (1 damaged or
  missing)". The pick list leaves it out of where to find kit, and warns
  if it's scanned out anyway. A missing case takes what's in it along.
- Every report works with no signal, is kept whatever the plan says, and
  is in the History tab and the export (new table `faults`).
- Checked: 6 new server tests (reports kept once each whatever the
  plan, turned down only for what was never saved or an item already
  retired, updated and closed once in a way that fits, writing off an
  item and counted kit, kit that can't go out taken off availability and
  the pick list, and kit missing from a job neither out nor back until
  found) and a new browser test at phone size (damage, missing items and
  counted kit reported with no signal, a missing speaker scanned and
  found, the job short, the Stock tab's repair list, a repair note and
  Fixed, and missing cables written off the count). All 35 browser tests
  and all 225 server tests pass.
- Merged into `main` at 13:50 UTC once GitHub's checks passed, and live
  by 13:56: Railway deployed it on its own.

## 30 September 2026: pick lists, and scanning kit out and back in

**Done**

- The fifth part of Phase 2: each job has a pick list, and kit is scanned
  out to the job and back in on a phone, with no signal too.
  [Decision 0017](adr/0017-pick-lists-and-scanning-out-and-in.md) has the
  reasons.
- A job's **Kit** card has **Pick list**, with how much is out. The pick
  list has a row for each product on the kit: how many the job needs from
  Session Hire's own (subhired ones left out), how many are out, and
  where to find the rest, place by place with the item numbers there and
  what's counted.
- **Going out**, each label scanned with the camera, or typed by a
  scanner, is recorded as out with the job, and the answer comes at once:
  "SH-000123 d&b Y10P: 3 of 8 out". Counted kit, like cables, is counted
  out on its row. Scanning a case takes everything in it.
- A scan is never refused. When it doesn't match the plan, it says so and
  keeps it: not on the kit, more than the job needs, still out with
  another job, or retired. **Not going** on an item takes it off again.
- **Coming back**, the same page records each scan as back in, and says
  what's still out. An item that went out with another job comes back
  from that one, and says so.
- An item's page says which job it's out with and since when. The Stock
  tab lists jobs going out in the next two weeks or on now, with how much
  is out, and jobs over with kit still out.
- Every phone works out what's out from the scans in the order they
  happened, not the order they synced, so they all agree once they
  catch up. Every scan is in the History tab and the export.
- Checked: 6 new server tests (scans kept whatever the plan says and
  once each, turned down only for a job or item never saved, the history
  in words, a pick list with a case and counted kit out and back, scans
  put in the order they happened across two phones, and the Stock tab's
  lists) and a new browser test on a phone with a stand-in camera (kit
  found, scanned and counted out, a scan read once, a mic not on the kit
  warned about and taken off, the item's page and the Stock tab, then
  everything back with no signal and synced after). All 34 browser tests
  and all 219 server tests pass.
- Merged into `main` at 13:19 UTC once GitHub's checks passed, and live
  by 13:24: Railway deployed it on its own.

**Next**

- Colly, to try it: add kit to a job, open **Pick list** from its Kit
  card, and scan a labelled item with **Scan**.
- Next in Phase 2: missing and damaged items on return, with faults and
  repairs, and the Stock tab's list becoming the place scans that didn't
  match get sorted out.
## 30 September 2026: deploys unstuck

**Done**

- Kit on jobs and printing labels were merged at 07:48 UTC but didn't go
  live on their own. GitHub ran none of its checks from 06:10 to about
  12:00 UTC: each run stopped within seconds without starting, the usual
  sign that the account's GitHub Actions minutes or spending limit had run
  out (this repo is private, so its runs count against them). They've run
  again since. Railway waits for those checks before deploying, so it
  skipped the deploy. The checks were run here on the merged code instead,
  all passing (all 218 unit and sync tests, on PGlite and a real Postgres,
  and all 31 browser tests), and it was deployed from Railway by hand at
  11:32 UTC; the entries for kit and labels say when it was live.
- Why Railway skipped merges (the question from 29 September): the app
  server only deployed when something under `server/` changed, so merges
  of only the docs, the web app or the shared code were skipped. It now
  also deploys on changes to `web/`, `shared/` and the files at the top of
  the repo that the build uses. That's set on the Railway service and in
  `railway.json`, so it's kept with the code. It worked on the next merge:
  scanning with the camera, which changed only the web app and the docs,
  went live by itself at 12:38 once its checks had passed, while a merge
  of only the docs is still skipped, as it should be.
- The checks run once for each change rather than twice: on pull requests
  and on `main`, not also on every push to a branch with a pull request
  open. That halves the minutes they use.
- The second service in the Railway project, `@sh/web`, was made by
  Railway from the repo's layout. It runs a development copy of the web
  app with no address, so nobody uses it, and it doesn't touch the
  database. It can be deleted.

**Next**

- If GitHub stops running the checks again, Railway will skip each merge
  until they do; **Deploy Latest Commit** on `@sh/server` (or asking
  Claude, who now has access to Railway) puts it live meanwhile.
- Colly, if you agree: delete `@sh/web` in Railway, so it stops using the
  project's resources.

## 30 September 2026: scanning with the camera

**Done**

- The fourth part of Phase 2: phones read labels with their camera, in
  the app. [Decision 0016](adr/0016-camera-scanning.md) has the reasons.
- In **Stock**, **Scan** beside the search turns the camera on: point it
  at a label and its item opens. A maker's serial in a barcode finds its
  item too, on Android.
- A label that isn't on anything yet asks which product it's on, with the
  camera still on and made small so the form fits under it. The product
  and place stay, so labelling a shelf is a scan and a tap each.
- The camera stays on until **Stop camera**, reading one label after
  another. A label held still is read once. Each read flashes the frame,
  shows the number, beeps (**Sound** turns that off) and buzzes on
  Android. **Light** turns on the torch where the phone allows it.
- It works with no signal: the reading happens on the phone, and the
  pictures never leave it and aren't kept. The camera turns off when the
  app is out of sight, and says what to do if it's blocked or missing.
- Checked: 2 new browser tests on a phone with a stand-in camera that
  shows the app a label's QR code (an item opened, a maker's serial, two
  labels put on items one after another with the camera on, a label held
  still read once, the camera turned off on leaving; a blocked camera and
  Try again), and the real camera path once with Chromium's test camera.
  All 33 browser tests and all 213 server tests pass.
- Merged into `main` at 12:32 UTC, once GitHub's checks passed (they're
  running again), and live by 12:38: Railway deployed it on its own. The
  first run on GitHub found two browser tests getting in each other's way
  on a shared test server, so the tests now run one at a time.

**Next**

- Colly, to try it: on a phone, open **Stock**, tap **Scan** and allow the
  camera, then point it at a label printed from **Print labels**. It's
  worth trying on an iPhone and an Android phone in the phone field test.
- Next in Phase 2: pick lists for each job, then scanning out and in with
  the same camera (done: see the entry above).

## 30 September 2026: printing labels

**Done**

- The third part of Phase 2: labels, so the warehouse can start sticking
  numbers on gear. [Decision 0015](adr/0015-printing-labels.md) has the
  reasons. There was still no word on a stock list to bring in, so this
  came next, as planned.
- **Stock**, **Print labels** sets numbers aside before their labels are
  printed: say how many (up to 10,000 at a time) and what they're for,
  such as a roll from a label maker. The next free number skips them, so
  no item in the office gets a number that's waiting on a printed label.
  Numbers set aside with no signal come once it's back.
- Each run can be **printed here**, from the browser: on a label printer,
  one to a page at 50 × 25 mm or 25 × 25 mm, or on A4 sheets of 65
  labels in an office printer, up to 500 at a time from any number in the
  run. Or **Download the spreadsheet** for a label maker, a row a label,
  which a label printer's own software can print from too.
- A label has a QR code, the number in large type and "Session Hire". The
  QR code holds just the number, so it never goes out of date and it's the
  smallest code there is, readable with up to 30% scuffed off.
- **Claim on scan:** scan or type a label that isn't on anything yet in
  the Stock search, and it asks which product it's on and where that's
  kept, then adds the item with that number, one of those counted there if
  some are. The product and place stay for the next label, so each one
  after the first is a scan and Enter.
- An item's page has **Print label**, with the product's name on it, for
  a new item or a replacement. Each run shows how many of its labels are
  on items so far.
- The History tab describes numbers set aside ("Set aside SH-000101 to
  SH-000600 for printing labels (Label World roll)"), and backups and
  **Download everything** include the new table.
- Checked: 5 new tests of what's printed (every QR code read back by a
  decoder, from the first number to the last), 5 new server tests (the
  next free number skipping runs, claiming labels, the last six-digit
  number, two devices setting numbers aside with no signal, and the
  history), all 213 server tests, and 2 new browser tests on a phone (set
  aside, printed in each layout with the printed page sizes checked,
  downloaded, claimed by scanning, an item's own label; set aside with no
  signal), with all 31 browser tests passing.
- Merged into `main` at 07:48 UTC, together with kit on jobs, and live by
  11:33 once Railway was asked to deploy it (it hadn't picked the merge up
  on its own): the live app has the Labels screen, claim on scan and
  **Print label**, and the live server adds the new table before it
  starts.

**Next**

- Decided by Colly on 30 September: the QR code holds just the number,
  not a web address, so rolls can be ordered as built.
- Colly, to try it: in **Stock**, **Print labels**, set aside a few
  numbers, print them on A4 or download the spreadsheet, then type one in
  the Stock search and put it on a made-up product.
- Next in Phase 2: scanning with the phone's camera in the app, then pick
  lists and scanning out and in.

## 30 September 2026: kit on jobs, with shortages

**Done**

- The second part of Phase 2: each job says what kit it needs, and the
  app says whether there's enough.
  [Decision 0014](adr/0014-kit-on-jobs.md) has the reasons. There was no
  word yet on a stock list to bring in, so this came next, as planned.
- A job's page has a **Kit** card: products from the stock list and how
  many, for the whole job or one phase, grouped by department. A line
  for the whole job covers every day from its first phase to its last,
  the days between included. Adding a product already on the job for the
  same days adds to that line.
- Each line says whether there's enough on its days once the other
  confirmed jobs have theirs: "Short 2 on Wed 4 Sep: 10 owned, 8 on
  Electric Picnic", in red. Enquiries and quotes are pencilled in: they're
  checked as if they went ahead ("Would be short 2 on Fri 6 Sep if it goes
  ahead"), and a confirmed job whose spare kit they'd use says "Enough,
  unless Longitude goes ahead", in amber. Cancelled and lost jobs hold
  nothing. Only days from today on are checked.
- Being short never stops a line being saved: the count may be
  unfinished, or someone is about to subhire. A short line has
  **Subhire the 2 short**, which fills in how many and asks who from,
  suggesting suppliers already used. Subhired ones don't come out of
  Session Hire's own stock.
- The jobs list flags **Kit short**, the Stock tab lists every line short
  from today on, and a product's page lists the jobs it's on, with
  whether there's enough for each. A product on a job's kit can't be
  taken out of the stock list, and a phase with kit on it can't be
  removed.
- It's worked out on each device from what it already has, so it works
  with no signal: kit added offline counts at once and goes through once
  the signal is back.
- The History tab describes kit changes ("Added 8 × d&b Y10P to the kit
  for Nissan, whole job"), and backups and **Download everything**
  include the new table.
- Until the warehouse has counted everything, lines will show short that
  aren't; a product with nothing counted yet says so.
- Checked: 7 new server tests (the rules; the history lines; and what a
  device shows: a shortage in the gap between a job's phases, sorted by
  subhire, a quote pencilled in, cancelled jobs, days gone by, jobs with
  no dates, and kit added with no signal), all 208 server tests, and 2
  new browser tests on a phone (short, subhired, a quote pencilled in,
  the Stock tab and a product's page; kit added with no signal), with all
  29 browser tests passing.
- Merged into `main` at 07:48 UTC, together with printing labels, and live
  by 11:33: the live app has the Kit card, **Subhire the 2 short** and
  **Kit short**, and the live database has the new table.

**Next**

- Colly, to try it: in **Stock**, count a few of a made-up product; in
  **Jobs**, put more of it on two made-up jobs on the same day than are
  counted, see both say they're short, then subhire the rest on one.
- Still open: is there a stock list or spreadsheet to bring in? If so,
  bringing it in comes next. If not, label printing, then pick lists and
  scanning out and in.

## 30 September 2026: the warehouse catalogue

**Done**

- Phase 2 has started, with what the rest of the warehouse builds on:
  what Session Hire owns, how many of each, and where it's kept.
  [Decision 0013](adr/0013-warehouse-catalogue.md) has the reasons.
- The **Stock** tab is now the catalogue: products by department, and a
  search that finds a product, an item's number or a serial. A scanner
  that types a label's number and Enter opens the item.
- A product is **numbered** (each one gets its own label, `SH-` and six
  digits) or **counted** (cables, clamps, adaptors). A numbered product
  can be counted until it's labelled: 6 × d&b Y10P counted at Bay A3 are
  6 not labelled yet, and adding an item there takes one off the count,
  so the total is right from the first day and labelling can take weeks.
- An item gets the next free number, or the one on a label already stuck
  on, typed as `SH-000123`, `sh 123` or `123`. A number is used only
  once: a new label for a worn one keeps the old number with the item,
  and search still finds it by the old one. Retiring an item (sold,
  scrapped, lost or stolen) keeps it and its number, and it can be
  brought back.
- Places are added by typing a new name wherever one is asked for.
  Cases (road cases, racks, bags, cable bundles) hold items and counted
  stock, up to five deep; moving a case moves what's in it, and nothing
  can go inside itself. Each product, item, case and place has its own
  page, with its own address to share.
- The server keeps the rules whichever device a change comes from, and
  it all works with no signal: an item added offline says "Number when
  synced" until it gets one.
- The History tab describes every stock change ("Put a new label on d&b
  Y10P: SH-000202, replacing SH-000201"), and backups and **Download
  everything** include the five new tables.
- The Phase 0 sync test moved to the bottom of the Stock tab, behind
  **Open the sync test**.
- Checked: 13 new server tests (numbers given, typed and never reused;
  counts and moves; cases and their limits; the product and place rules;
  labelling with no signal on a device; the history lines; a backup of
  600 items in cases put back), all 201 server tests, and 2 new browser
  tests on a phone (count, label, find by number, fill a case, the place,
  a new label, retire and bring back; labelling with no signal), with all
  27 browser tests passing.
- Merged into `main` at 05:57 UTC and live by 06:04: the live app has the
  new Stock pages, and the live server adds the five new tables before it
  starts, so the live database has them too.

**Next**

- Colly, to try it: in **Stock**, add a made-up product, count a few at
  a made-up place, then add items one after another on its page, leaving
  the number empty for the next free one.
- Waiting on Colly: is there a stock list or spreadsheet to bring in? If
  so, bringing it in comes next. If not, equipment lines on jobs, with
  shortages flagged.

## 30 September 2026: everyone's own bookings in their own calendar

**Done**

- Everyone has a calendar feed of the jobs they're booked on, for Google,
  Apple or Outlook Calendar, at an address of its own that can only show
  bookings. It used to be the private link with `/calendar.ics` on the
  end, so anyone who could see a shared calendar's settings could answer
  offers as that person; now it's safe in a calendar they share.
  [Decision 0012](adr/0012-personal-calendar-feeds.md) has the reasons.
  This is the last part of Phase 1, so everything on the Phase 1 list is
  now built.
- The address is worked out from the private link, so nothing new is
  stored, backed up or downloaded, and **New link** retires the feed with
  the link. The events no longer carry the link to the person's page;
  they say the details and changes are on it.
- Where people find it: freelancers on their page, under Your bookings
  (subscribe on an iPhone, Mac or in Outlook, or add the address in
  Google Calendar); the office with **Copy calendar address** beside Copy
  link in the Crew tab, to send on; and staff who also work jobs, with
  the same email address in Crew, on the Account tab. Each says that
  anyone getting our Google Calendar invites doesn't need it as well.
- The server keeps every feed in memory and builds them again only after
  something changes, or every 6 hours, so calendar apps looking every
  hour don't keep the database awake. A feed that hasn't changed answers
  "nothing new" without being sent again. The old address still works
  for anyone already subscribed.
- The server's log now writes each request as its method and path only,
  with private link and feed codes masked and no query string. Before,
  it wrote whole addresses, private links and Google sign-in codes
  included.
- Checked: 8 new server tests (the read-only address and what's in it;
  answered from memory without touching the database, and rebuilt after
  an answer on a link, a change from the office and a withdrawn job;
  "nothing new" still true after someone else's booking; New link
  retiring both addresses; the 6-hour rebuild; the log), all 188 server
  tests, and 2 new browser tests (on a phone: the office copies a
  freelancer's calendar address and their page gives the same one; a
  signed-in staff member finds theirs on the Account tab), with all 25
  browser tests passing.
- Merged into `main` at 04:52 UTC and live by 04:58: the live app has the
  new buttons, and the live server answers a feed address that doesn't
  exist with "Not found", marked private and not for search engines,
  without asking the database.

**Next**

- Colly, to try it: in the Crew tab, open a made-up person with a
  booking, tap **Copy calendar address**, and add it to your phone's
  calendar or to Google Calendar (From URL). Once sign-in is on, your own
  shows on the Account tab if you're in Crew with your sessionhire.com
  address.
- Phase 1 is built. What's left is the office using it for real, which
  needs the Google key ([the steps](sign-in-setup.md)): jobs onto the test
  calendar, bringing in the organisers' calendars, then Session Hire Gigs.
- Colly, still open: should crew invites go out when crew are offered (as
  built) or only once they're booked?
- Colly, still waiting: the Sentry key ([the steps](monitoring.md)), the
  Railway bucket for backups ([the steps](backups.md)), the Google key
  ([the steps](sign-in-setup.md)) and the phone field test
  ([the steps](field-test.md)).

## 30 September 2026: bringing in the jobs already on Google Calendar

**Done**

- The jobs already on the organisers' Google calendars can now be brought
  into the app, so nobody types them again. **Bring them in**, on the Jobs
  tab (and on the Account tab once a calendar is connected), lists the
  calendars the connected account can see; pick one and a first day (by
  default three months back) and tap **Look at the calendar**.
  [Decision 0011](adr/0011-calendar-import.md) has the reasons.
- Nothing is saved until the office has looked. The app reads the
  calendar's all-day events from that day to two years ahead and shows
  each job it found: its phases and days, its venue (new, or already in
  the app), its crew (booked, not answered, said no, not in the app yet),
  and whether it's confirmed or pencilled in. Any job can be unticked or
  renamed, and giving two the same name brings them in as one. People on
  the invites who aren't in the app yet are listed, ticked when the
  address looks like a person's own and unticked for suppliers and
  clients. What was left out (meetings, repeating events, out of office)
  is listed with why.
- Titles are read the way they're typed today: "Tik Tok - Ploughing - Load
  In 2/3" is the job "Tik Tok - Ploughing" and its Load in, "Show Day 2/
  Load Out" is a day of both, and "Dublin Horse Show" stays whole. A title
  with no phase comes in as a Show, and says so. A job whose titles all say
  TBC, hold or pencil, or end in a question mark, comes in pencilled in.
- **Bring in** reads the calendar again and saves the ticked jobs in one
  go: the jobs and their phases, new venues and people, and a crew call
  per phase, with a guest who said Yes booked, one who hasn't answered
  offered, and a No kept as declined. The job sheet in an event's
  description goes into the notes. The History tab says who brought in
  what, and Download everything lists each event-day and the job it went
  into.
- Looking again, or at the other organiser's calendar, shows only what's
  new, adds new days to jobs brought in before, and lists events deleted
  or moved in Google since, to change the job to match. Days a job typed
  into the app already has are left out.
- Nothing is written to Google and nobody is emailed. The organiser's
  calendar keeps these jobs' events, so the app doesn't add them to the
  jobs calendar as well, and the job page says where their days are.
  Everything else works as for any other job: the planner, crew, private
  links and the history.
- Checked: 22 new server tests against the pretend Google (titles, job
  sheets and names; grouping into jobs and phases, venues, people and
  crew; looking saves nothing; bringing in, and the history and download;
  looking again; a calendar shared with the account; what goes wrong; a
  job gone from the calendar before it was brought in), the real-Postgres
  test now brings jobs in too, all 180 server tests, and 2 new browser
  tests (on a phone: look, untick, rename and bring in; on a laptop: a
  calendar that can't be read), with all 23 browser tests passing.
- Merged into `main` at 04:06 UTC and live by 04:13: the live app has the
  import screen, and the live server answers its address saying it needs
  the Google key first, as it should until the key is added.

**Next**

- Colly: once the Google key is in and a calendar connected, bring in the
  jobs on your test calendar, then the organisers' calendars
  ([the steps](sign-in-setup.md), step 6), and say what it got wrong.
- Next in Phase 1: personal calendar feeds, the last part of Phase 1.
- Colly, still open: should crew invites go out when crew are offered (as
  built) or only once they're booked?
- Colly, still waiting: the Sentry key ([the steps](monitoring.md)), the
  Railway bucket for backups ([the steps](backups.md)), the Google key
  ([the steps](sign-in-setup.md)) and the phone field test
  ([the steps](field-test.md)).

## 30 September 2026: the week and month planner

**Done**

- The Jobs tab has **List · Week · Month** at the top. Week and Month lay
  out every job with anything on, a row each, and each day says which
  phase it is, as the calendar titles it ("Build 1/2"), and how many of its
  crew are booked ("2 of 3 crew, 1 asked"). Confirmed jobs are solid, and
  enquiries and quotes dashed, as pencilled in. A day is green once its
  crew are all booked and amber while some are still to find. Crew asked
  for on the Crew tab, outside a job, get a row of their own.
  [Decision 0010](adr/0010-planner.md) has the reasons.
- **People** shows the same days by person: where each is booked, where
  they've been offered work and haven't answered, and the days they can't
  work. Everyone else can be shown too, to see who is free.
- Clashes are listed above the planner, in words, with the job to open.
  Someone booked on a day they're marked unavailable, or booked twice, is a
  **clash**. An offer still waiting on an answer for a day they're booked
  or unavailable is a **check**: it would be a clash if they said yes. The
  server already stops most clashes, so these are the ones a day off marked
  after the booking, or an offer sent anyway, can still make.
- A phase moved to other days without its crew shows their old days in
  amber, "No phase this day", so it's seen before the day comes.
- A week reads in words and, on a phone, scrolls sideways from today with
  the names kept in view. A month shows each day as a short code ("Bu" for
  Build, "WS" for Web Summit) and a colour, with the words on hover and for
  screen readers, and a tap on a date opens its week. It's the one screen
  that uses a laptop's full width. The address keeps the week or month and
  the view, so a reload or a shared link lands in the same place.
- It's worked out on each device from what it already holds, so it works
  with no signal and shows a change as soon as it syncs. Nothing changed on
  the server. For now it only shows: changes are made on the job's page or
  the Crew tab, a tap away.
- Checked: 6 new server tests (phase-days and crew counts; pencilled-in and
  cancelled jobs; crew outside Jobs; a phase moved without its crew;
  booked, offered and unavailable by person; clashes and checks, and their
  order; weeks and months across a new year and a leap year), all 157
  server tests, and 2 new browser tests of a week on a phone and a month
  on a laptop, with all 21 browser tests passing.
- Merged into `main` at 02:55 UTC and live by 03:00: the live app's Jobs
  tab has List, Week and Month.

**Next**

- Colly: once there are real jobs in, open the week and month and say what
  the office would change, such as dragging a phase to other days.
- Next in Phase 1: bringing the jobs already on Google Calendar into the
  app as drafts.
- Colly, still open: should crew invites go out when crew are offered (as
  built) or only once they're booked?
- Colly, still waiting: the Sentry key ([the steps](monitoring.md)), the
  Railway bucket for backups ([the steps](backups.md)), the Google key
  ([the steps](sign-in-setup.md)) and the phone field test
  ([the steps](field-test.md)).

## 30 September 2026: crew invites on the calendar, and their answers

**Done**

- Crew can now be invited to the days they're offered on Google Calendar,
  as ops do by hand today, and their Yes or No there counts as their answer
  to the offer, as if they'd answered on their private link. It sits behind
  a switch on the **Account** tab that starts off, since each invite is an
  email to a freelancer. [Decision 0009](adr/0009-crew-invites.md) has the
  reasons.
- With it on, everyone offered a place on a confirmed job, or booked on it,
  who has an email address in the app, is a guest on the job's events on
  their days, from today on. Invites come from the account connected on
  the Account tab. Crew can't see each other's addresses, or invite anyone.
- An answer in Google works as it does on the link: a Yes to any day is a
  yes to the offer, for all its days bar any they said No to; a No to every
  day declines; Maybe waits. The first to say yes gets the place, and the
  rest of the shortlist come off the events, with a cancellation from
  Google. Each answer is in the History tab as the freelancer's own, "on
  Google Calendar", and in Download everything.
- Once the office has confirmed someone, Google can't undo it: a No to a
  booked day shows on the job page and under **Answers to check** on the
  Crew tab, for the office to phone them.
- Google emails guests only when it matters: being invited or taken off,
  and a new title, date or place. The crew list and notes change quietly.
  Guests added by hand in Google, such as a client, stay on, and an answer
  given while the app is changing an event is never lost.
- Answers arrive within a couple of minutes: the server asks Google every
  two minutes which of the app's events have changed, and touches the
  database only when an answer has, so it still sleeps when nobody is
  working. The nightly check takes in anything missed.
- The job page shows, under each person offered, how they stand on Google
  Calendar ("Said yes on Google Calendar.", "Invited on Google Calendar; no
  answer yet."), and says when someone has no email address, so gets no
  invite.
- Turning it on first says what goes out ("6 invites to 3 people") and who
  has no email address. Turning it off stops everything at once; people
  already invited keep their invites. Disconnecting the calendar turns it
  off and tells invited crew their days are cancelled.
- Checked: 15 new server tests against the pretend Google (who is invited
  and who isn't; a Yes, a partial Yes, a Maybe, a No to every day, a No
  from someone booked; looking for answers without waking the database,
  and by itself every couple of minutes; guests added by hand kept, and
  emails only when they matter; an answer given while the app is writing;
  an email address changed; switched off; the nightly check; disconnecting;
  two servers taking each answer once), the real-Postgres test now takes an
  answer in too, all 151 server tests, and a new browser test for the switch
  and the job page.
- Merged into `main` at 02:08 UTC and live by 02:13: the live server
  answers the new crew invites address, and says it needs the Google key
  first, as it should until the key is added.

**Next**

- Colly: once the Google key is in and the test calendar connected, try
  crew invites on it with the office's own addresses as the crew, to see
  the emails as a freelancer would ([the steps](sign-in-setup.md), step 5).
  It stays off on Session Hire Gigs until you choose.
- Colly, still open: should invites go out when crew are offered (as
  built, like today) or only once they're booked?
- Next in Phase 1: the week and month planner.
- Colly, still waiting: the Sentry key ([the steps](monitoring.md)), the
  Railway bucket for backups ([the steps](backups.md)), the Google key
  ([the steps](sign-in-setup.md)) and the phone field test
  ([the steps](field-test.md)).

## 30 September 2026: confirmed jobs onto Google Calendar

**Done**

- The app now puts every day of every confirmed job, from today on, on a
  Google calendar, in the shape crew know: one all-day event per phase per
  day, titled "Nissan - Build 1/2", with the venue and its address as the
  location. The description has the client, the phase and which day of it,
  the venue's access notes, the job and phase notes, the crew booked for
  that day by role with call times and places still to fill, and a link to
  the job in the app. Crew show by name only: rates, phone numbers and
  emails never go on the calendar. [Decision 0008](adr/0008-calendar-sync.md)
  has the reasons.
- The **Account** tab connects it: **Connect Google Calendar** goes to
  Google to pick the account that writes the jobs, then back to pick which
  of its calendars they go on. The card then shows the calendar, how many
  days are on it, and anything wrong in words, with **Check now**,
  **Change calendar** and **Disconnect**.
- The calendar follows the jobs: renaming a job, moving or adding a phase,
  changing a venue, booking crew or a freelancer answering from their link
  reaches the calendar within seconds, touching only the events that
  changed. Cancelling a job takes its days off; confirming it again puts
  them back. Days that have gone are never changed.
- The app leads: an event changed or deleted in Google is put back each
  night, a few minutes after the backup while the database is awake
  anyway, or straight away with **Check now**. Nothing else wakes the
  database.
- Each job's page says, for each phase, whether its days are on the
  calendar (with a link to open it), on their way, or couldn't be written
  and why. Enquiries say they go on once confirmed.
- Nothing doubles: each event's id is worked out from the job, so a write
  whose answer was lost, or two servers during a deploy, update the same
  event. The app only ever touches its own events, found by a hidden mark.
- Google being busy only delays things (tried again after a minute, then
  longer); the Account tab says so only if it goes on. If Google stops
  accepting the app's access, or the Calendar API is switched off, the
  Account tab says exactly that and what to do, and nothing else in the
  app is affected.
- The key Google gives the app is kept encrypted with the app's Google
  secret, never reaches a phone or laptop, and is left out of Download
  everything. Disconnecting hands it back to Google. Connecting, choosing a
  calendar and disconnecting show in the History tab.
- Checked: 19 new server tests against a pretend Google that answers as
  the real one does (connecting, and what Google is asked for; the
  events' contents; renames, moves, cancelling and confirming again; a lost
  answer; the nightly check putting back edits and deletions and clearing
  strays while leaving people's own events alone; Google busy; a day turned
  down; access taken away; the API off; a calendar unshared; changing
  calendar; disconnecting; the key never in the export or on devices), one
  more on a real Postgres like the live one, all 137 server tests, and 2
  new browser tests for the Account card and the job page.
- Merged into `main` at 00:36 UTC and live by 00:42: the live server
  answers the new calendar addresses, and says it needs the Google key
  first, as it should until the key is added.

**Next**

- Colly: when adding the Google key, also switch on the Google Calendar
  API and add the second redirect address, then connect your test
  calendar from the Account tab ([the steps](sign-in-setup.md), updated).
- Next in Phase 1: crew invites on the events and their answers read back
  (behind a switch that starts off), then the week and month planner.
- Colly, still waiting: the Sentry key ([the steps](monitoring.md)), the
  Railway bucket for backups ([the steps](backups.md)), the Google key
  ([the steps](sign-in-setup.md)) and the phone field test
  ([the steps](field-test.md)).

## 29 September 2026: Phase 1 starts with jobs, their phases, clients and venues

**Done**

- A new **Jobs** tab, now the one the app opens on. Each job has a client,
  a main venue, a status (enquiry, quoted, confirmed, cancelled or lost),
  notes, and its phases: Prep, Build, Show, Load out or any name typed,
  each one or more whole days, and each with its own venue if it needs
  one, such as Prep at the warehouse. [Decision 0007](adr/0007-jobs.md)
  has the reasons.
- Each phase shows how its days will read on the calendar, in today's
  format ("Nissan launch - Build 1/2"), which is what the calendar sync
  will write.
- A new job is one form: name, client, venue, status and phases. A client
  or venue not yet in the app is added as it's typed. Clients keep their
  contacts; venues keep an address, with a map link, and notes for access,
  load-in, power and parking.
- The list shows jobs coming up, past, and not going ahead, with a search
  across jobs, clients and venues, and how much of each job's crew is
  booked.
- Crew are now asked for from the job, for one of its phases or across
  several. The job's, phase's and venue's names go onto the crew call and
  stay current: rename any of them and freelancers' pages, offer messages
  and calendar feeds say the new name. The Crew tab still takes crew for
  something not in Jobs.
- Cancelling a job, or marking it lost, cancels its crew calls too, after
  the app asks and says how many people it affects. A phase with crew on
  it can't be removed until they're cancelled. Nothing is ever deleted, so
  the history and the download keep every job.
- Two people changing different things about the same job both keep their
  change, with or without signal. A job added with no signal waits on the
  phone and goes through when the signal is back.
- The History tab describes job changes in words ("Added the job Nissan
  launch for Nissan Ireland, confirmed"; "Changed Show on Nissan launch:
  dates to Sat 10 Oct"), and Download everything includes the clients,
  venues, jobs and phases.
- The live database gets its new tables by itself when the new version
  starts. Existing crew calls are kept as they are, not tied to any job.
- Checked: 16 new server tests (a job with its phases, client and venue;
  calendar titles; dates that don't make sense turned down; two phones
  editing one job offline; a rename reaching the freelancer's page;
  removing a phase that has crew; cancelling a job cancelling its crew;
  crew for a phase of a different job turned down; an older copy of the
  app still able to ask for crew; the history wording), all 116 server
  tests on both PGlite and a real Postgres like the live one, and 2 new
  browser tests: a job with its phases and crew, renamed for the crew too,
  and a job added with no signal.
- Also fixed: things added in a burst on one device, such as a new job's
  phases, now always keep the order they were added in.
- Merged into `main` at 23:33 UTC and live by 23:38: the live app has the
  Jobs tab, and the live database took its new tables when the new version
  started.

**Next**

- Nothing to set up for this: it's on.
- The phone field test now opens on Jobs; its steps say to tap **Stock**
  first.
- Next in Phase 1: the calendar sync, tried on Colly's test calendar, then
  a week and month planner showing who is on what, with clashes flagged.
- Colly, still waiting: the Sentry key ([the steps](monitoring.md)), the
  Railway bucket for backups ([the steps](backups.md)), the Google sign-in
  key ([the steps](sign-in-setup.md)) and the phone field test
  ([the steps](field-test.md)).

## 29 September 2026: a history of every change, and download everything

**Done**

- A new **History** tab shows every change anyone makes, newest first:
  what was done, in words ("Booked 4 × d&b Y10P for Electric Picnic, Fri 2
  Oct to Sun 4 Oct"), who did it, on what kind of device (such as "Safari
  on iPhone", with the device code its Account tab shows) and when. It can
  be narrowed to one person. [Decision 0006](adr/0006-audit-trail-and-export.md)
  has the reasons.
- A change made with no signal says so, and how long it waited on the phone
  before it reached the server. The wait is measured on the phone's own
  clock and the time placed on the server's, so a phone set to the wrong
  time still shows the right one.
- Requests the server turned down, such as a booking for kit that was
  already out, are in the history with the reason. Freelancers' own
  answers on their private links (accept, decline, a counter-offer, days
  off) show as theirs.
- **Download everything**, on the Account tab, gives one ZIP file: a
  spreadsheet for each kind of record, all of it as JSON for moving to
  another system, the history in words, and a README saying what each file
  holds. The spreadsheets open cleanly in Excel: names like Seán and Irish
  times come through, and text Excel would run as a formula (a risk with
  notes freelancers type) shows as the text it is. Tables added later are
  in it automatically.
- Left out of the file on purpose: freelancers' private link codes and
  staff sign-in sessions, so whoever holds it can't act as anyone. Each
  download shows in the history, with who took it and on what device.
- The History tab needs signal: the history is kept on the server rather
  than on every phone.
- Checked: 14 new server tests (who, what, which device and what was
  turned down; a change made offline on a phone whose clock was wrong;
  freelancers' answers; paging and narrowing to one person or one record;
  every file in the download, with no link codes or sessions anywhere in
  it; spreadsheets that open safely; each download recorded), one of them
  on a real Postgres database like the live one, and 3 new browser tests:
  a booking made with no signal and sent two hours later showing as made
  offline; the History tab saying it needs signal; and Download everything
  giving the file and showing in the history. Each safeguard was also
  broken on purpose, and its test failed.
- Also fixed: two older browser tests could pick up each other's speakers
  when they ran at the same time; each now uses names of its own.
- Merged into `main` at 22:41 UTC and live by 22:46: the live server
  answers the new history address.
- Also upgraded the part of the server that sends the app's pages to
  phones and laptops, which had a security warning. The real risk was
  low, since it only sends the app's own public files.

**Next**

- Nothing to set up for this: it is on.
- Colly, still waiting: the Sentry key ([the steps](monitoring.md)), the
  Railway bucket for backups ([the steps](backups.md)), the Google sign-in
  key ([the steps](sign-in-setup.md)) and the phone field test
  ([the steps](field-test.md)), which is what's left of Phase 0.
- Phase 1, projects and the calendar: clients, venues and projects first,
  which need no Google access, then the calendar sync, tried on Colly's
  test calendar.

## 29 September 2026: error alerts and uptime checks built

**Done**

- With a Sentry key set, the app server reports its own faults to Sentry,
  which emails whoever looks after the app: a request that failed on the
  server, a crash, a start-up that went wrong, and a backup that failed or
  couldn't start. [Decision 0005](adr/0005-error-alerts.md) has the
  reasons, and Colly chose Sentry for its EU data and one account covering
  all of it.
- The app on each phone and laptop reports its own errors too. A report
  made with no signal waits on the device and goes when the signal is
  back, or the next time the app opens. Phones only download Sentry's code
  while reporting is on.
- Reports are built to leave out anyone's details: no sign-in, request
  contents, cookies or IP addresses. The server names a failed request by
  its route as the code writes it, never the address used, and email
  addresses and anything shaped like a private link in an error's text are
  replaced.
- A new uptime address, `/api/up`, answers without asking the database, so
  Sentry's check every minute doesn't keep Neon's database awake and use up
  its free hours.
- Each scheduled backup checks in with Sentry, which emails when a night's
  backup fails or hasn't started by 03:00 UTC.
- Two fixes to backups on the way: pressing **Back up now** shortly before
  a scheduled run no longer makes a second backup straight after it; and
  after the `new-generation` command, phones start afresh on their next
  sync rather than after the server next restarts.
- Checked: 9 new server tests against a stand-in Sentry that keeps what
  it's sent (among them a failed request carrying a private link, an email
  address, a cookie and a form, none of which reached the report; 400s and
  404s not reported; the backup's check-ins, and a failed backup's report;
  nothing sent while reporting is off), 2 new backup tests, and 3 new
  browser tests: a phone's report with nothing personal in it and a browser
  extension's error left out; a report made with no signal sent when the
  signal came back; and one still waiting when the app was closed, sent
  when it next opened. Each browser test was also run against a
  deliberately broken app, and failed.
- Merged into `main` at 21:40 UTC and live by 21:47. The live health check
  says `"errors":"off"` until the Sentry key is added, and `/api/up`
  answers.

**Next**

- Colly: make a free Sentry account and give its key to the app server,
  about ten minutes: [the steps](monitoring.md). Until then the health
  check says `"errors":"off"`.
- Colly, still waiting: the Railway bucket for backups
  ([the steps](backups.md)), the Google sign-in key
  ([the steps](sign-in-setup.md)) and the phone field test
  ([the steps](field-test.md)).
- The last Phase 0 item: the audit trail and export-everything.

## 29 September 2026: design system in Figma

**Done**

- A Figma design system built from the app as it is today:
  [Session Hire Design System](https://www.figma.com/design/GO1I1Zv2iEfT07uMOk89ZN).
  Colour tokens in light and dark carrying the same names as the CSS,
  spacing, radius and type styles, and 11 components (brand mark, button,
  status pill, connection badge, input, alert, card, list row, tab bar, top
  bar). The Crew area is rebuilt from them as a worked example.
  [Design system](design-system.md) has the details.
- Checked: every component screenshotted; the example screen flips to dark
  by switching one setting; contrast measured for every text colour pair.

- Contrast fixes, chosen by Colly: text on red uses the darker #c8202e
  (5.7:1 with white), light-mode warn text is #8a5800, and buttons and
  fields are at least 44px tall. Done in the app, the freelancer page and
  Figma. Checked: typecheck, all server tests, all 8 browser tests.

- Spacing and radius tokens, added on 30 September: `app.css` names them as
  Figma does (`--space-2` to `--space-40`, `--radius-control`,
  `--radius-tab`, `--radius-card`, `--radius-full`), and `app.css` and
  `crew.css` use them wherever a value is on the scale. Nothing on screen
  moved. Checked: typecheck, the web build, all 31 browser tests, and 12
  screens screenshotted before and after in light and dark, two also at
  laptop width: all 28 identical to the pixel.

- Jobs, the planner and Stock use them too, also on 30 September:
  `jobs.css` and `stock.css` swap every value on the scale for its token.
  Four 10px corners stay in px, as they're on boxes, not tabs. Nothing on
  screen moved. Checked: typecheck, all server tests, the web build, all 37
  browser tests, and 14 screens screenshotted before and after in light and
  dark, four also at laptop width: every box and space the same in all 36,
  and 34 identical to the pixel. The other two differ by 3 pixels of text
  smoothing, as two pictures with the same CSS do.

## 29 September 2026: nightly backups built

**Done**

- Every night at 02:00 UTC the app server copies the whole database into
  one file and puts it in storage outside the database. It then restores
  that file into a scratch database and checks every table before counting
  it as a backup, so a backup that can't be restored is caught the night
  it's made, not the day it's needed.
  [Decision 0004](adr/0004-backups.md) has the reasons.
- The file is plain text inside, a line per row with a checksum per table,
  so it can be read without the app.
- Backups are kept for 35 days, then the first of each month for a year. A
  failed backup is tried again each hour, up to three times.
- Putting the data back means pointing the server at a new, empty database
  with `RESTORE_FROM` set, and deploying: [the steps](backups.md). Phones
  and laptops notice on their next sync, reload their copy, and send again
  everything they changed in the last two weeks, so work done after the
  backup isn't lost.
- The **Account** tab has a **Backups** card: when the last backup was
  made, what went wrong if the last try failed, and **Back up now**. The
  health check says whether backups are fresh, ready for the uptime alert.
- Checked: 21 new server tests (every table coming back exactly, accents,
  emoji and times to the microsecond included; damaged and cut-short files
  refused with nothing changed; an older backup restoring into newer code;
  the schedule, retries and what's kept; phones catching up after a
  restore; the storage's signed requests), one of them restoring into a
  fresh real Postgres database, and 3 new browser tests for the card. A
  trial on a local server restored a backup into an empty database on
  start-up, and left a database with data in it alone.
- Merged into `main` at 20:25 UTC and live by 20:32. The live health check
  says `"backups":"off"` until the bucket is added.

**Next**

- Colly: make a Railway bucket and give it to the app server, a few
  minutes: [the steps](backups.md). Until then the Account tab says
  backups are off.
- Colly, still waiting: the Google sign-in key
  ([the steps](sign-in-setup.md)) and the phone field test
  ([the steps](field-test.md)).
- Error tracking and uptime alerts.

## 29 September 2026: staff sign-in built

**Done**

- Staff sign in with their Google account. Staff means a sessionhire.com
  Workspace account, or an address listed by hand, such as a tester's.
  Everything the app reads or changes now needs sign-in, except the health
  check and freelancers' private links.
  [Decision 0003](adr/0003-staff-sign-in.md) has the reasons.
- A signed-in phone stays signed in for 60 days after it was last used, and
  keeps working with no signal. It only shows the sign-in page when the
  server says so, and anything changed offline waits until someone signs in
  rather than being lost.
- Every change now records who made it, in the audit trail and the export.
- New **Account** tab: who is signed in, and **Sign out**, which also clears
  the device's copy of the data (with a warning if changes haven't synced).
- Safety catch: once anyone has signed in, the server won't start without
  the Google key, so a lost setting can't quietly open the app to everyone.
- Checked: 26 new server tests (signing in; turning away personal accounts,
  other companies and unverified addresses; forged returns from Google; sign
  out, expiry and switched-off accounts; live updates only for signed-in
  devices) and 3 new browser tests (the sign-in page keeping waiting
  changes, a refused account, signing out clearing the device). All earlier
  tests still pass.
- Merged into `main` at 19:36 UTC. It reaches the live app with the next
  deploy; until the Google key is added the health check will say
  `"auth":"off"` and the app stays open as before.

**Next**

- Colly: make the Google sign-in key, add it in Railway, then **Deploy
  Latest Commit**, about ten minutes: [the steps](sign-in-setup.md). Until
  then the app stays open to anyone with the address, so keep to made-up
  data.
- Phone field test: [the steps](field-test.md).
- Backups with a tested restore, then error tracking and uptime alerts.

## 29 September 2026: app live on Railway

**Done**

- The app runs at shserver-production.up.railway.app, deployed from `main`,
  with its data in a Neon Postgres database created through Vercel's
  storage menu. A Railway incident ("slow or stuck deployments") held the
  first deploy up for a few minutes.
- The health check (`/api/health`) now says where the data lives:
  `postgres`, `file` or `memory`. Before this, there was no way to tell from
  outside which database a deploy was using.
- On a host the server now refuses to start without a database, so a missing
  `DATABASE_URL` fails the deploy with a reason in its logs instead of
  running on a throwaway in-memory store that loses everything on restart.
- Checked: new server tests for each setting and for the health check.

- The database is in Frankfurt (confirmed by Colly), as planned for GDPR
  and latency.
- Confirmed live at 19:19 UTC: the health check reads `"db":"postgres"`.
  Railway didn't start a deploy by itself for the merges after the first
  one, so Colly deployed the latest commit by hand (Railway's command
  palette, **Deploy Latest Commit**).

**Next**

- Phone field test on the live app: [the steps](field-test.md) (Colly).
- Find out why Railway skips merges: the reason it shows on skipped
  deployments. Until then, each merge to `main` needs Deploy Latest Commit.
- Staff sign-in with Google, so real jobs and crew can go in: being built.

## 29 September 2026: crew booking started early

Built in parallel with Phase 0, so the freelancer side can be tried as soon
as the app is hosted. The decision is recorded in
[ADR 0002](adr/0002-crew-booking-links.md).

**Done**

- **Crew screen for ops** (the Crew tab in the app): people with skills,
  rates and contact details; jobs that need crew (project, phase, role,
  dates, call time, how many, day rate, venue, details); offers to one
  person or a shortlist; answers to check, with Confirm, "Agree €300" for
  counters, and Release.
- **Send an offer where the freelancer already looks:** the app writes the
  message with every detail and their link, and opens WhatsApp, text or
  email with it filled in. Nothing is sent automatically yet.
- **Freelancer's private link, no app or login:** see offers in full, accept
  all or some days, decline, ask for a different rate, mark days off,
  subscribe to bookings in Google, Apple or Outlook calendar, and download
  everything held on them. Works with JavaScript off, so it opens instantly
  from WhatsApp.
- **Rules the server enforces**, whichever way an answer arrives: nobody is
  double booked; the first to accept a shortlisted role gets it and the rest
  are told it's filled; days someone marked off need an explicit override.
- Checked: 12 new server tests (shortlists, part-days, counters, clashes,
  days off, links, calendar feed, offline ops device) and a browser test
  where the office offers a job and a phone answers from the link. All
  earlier tests still pass.

**Next for crew**

- Link crew calls to Phase 1 projects and phases, and add confirmed crew to
  the Google Calendar event as attendees; read RSVPs back as answers.
- Documents with expiry (Safe Pass, manual handling) that block an offer.
- Timesheets from confirmed days, then ready-made freelancer invoices.

**Waiting on**

- Nothing new. Real freelancer data waits until staff sign-in is in.

## 29 September 2026: hosting picked

**Decided:** the app server runs on Railway and the database on Neon
(Postgres, EU). Vercel keeps serving this blueprint at sh.letissier.ie.

**Done**

- `railway.json` added: Railway builds the app, starts the server and checks
  `/api/health` before switching traffic over. The server already serves the
  app and its live connections from one place.
- Checked: a production-style start locally serves the app and answers the
  health check.

- Neon project `session-hire` created (Postgres 17, Frankfurt, free tier).
  The server creates its tables on first start.
- `main` branch created from the working branch, so production deploys
  from `main` and new work arrives through pull requests.

**Waiting on**

- Colly: make `main` the default branch on GitHub, then create the Railway
  project from `main` with `DATABASE_URL` set as a secret, and share the URL
  for the phone field test.

## 29 September 2026: Phase 0 started

**Done**

- Codebase set up as one TypeScript repo with three parts: `shared` (the
  model, commands and the device-side sync engine), `server` (Fastify and
  Postgres) and `web` (the installable app).
- The sync engine is built and the decision is recorded in
  [ADR 0001](adr/0001-sync-engine.md): our own engine on the Crewbox pattern.
- A small test app shows it working: add stock, book it, scan it out, switch
  the signal off, book on another device, switch it back on.
- Checked: 10 server tests (including 20 devices at once on real Postgres)
  and a browser test where a phone in flight mode reloads the app, books,
  and gets the server's answer on reconnect. All pass.
- CI runs typecheck, tests, the browser test and the blueprint build on
  every push.

**Waiting on**

- Somewhere to host the server so the test app can be tried on real phones,
  in a real dead spot. Vercel hosts the blueprint but cannot hold the
  server's live connections.

**Next in Phase 0**

- Host the test app and do the field test.
- Staff sign-in with Google Workspace and freelancer email links.
- Backups with a tested restore; error tracking and uptime alerts.
