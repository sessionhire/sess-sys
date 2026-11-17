# ADR 0009: Crew invites on the calendar, and their answers

- **Status:** Accepted, 30 September 2026. The third part of Phase 1.
  Built behind a switch on the Account tab that starts off, since each
  invite is an email to a freelancer. Colly was asked on 30 September
  whether invites go out when crew are offered a job or once they are
  booked, and answered on 1 October: with the offer, and accepting the
  invite in Google Calendar is one acceptable way of agreeing to the job.
  That is what's built; the switch stays off until the Google key is in.
- **Decides:** who gets a Google Calendar invite to a job's days, from
  whom and when, and what their Yes or No in Google does in the app.

## Context

Today the invite is the offer: ops add crew as guests on each day's
event, and "Accepted" means the person is on the job
([current process](../research/current-process.md)). The app now writes
those events itself ([ADR 0008](0008-calendar-sync.md)), without guests,
and offers go out through each freelancer's private link
([ADR 0002](0002-crew-booking-links.md)). For crew to see no change, the
app has to put them on the events it writes and take their answers back,
without anyone answering twice.

Most freelancers use personal Gmail, Outlook, iCloud or GMX calendars.
Google updates the events in Google calendars directly, but other
calendars only hear about an event, a change or a cancellation by email.

## Decision

- **Invites go out with the offer.** With the switch on, a person offered
  a place on a job, who has an email address in the app, is a guest on
  each of the job's events on the days offered, from today on. An enquiry
  or quote with crew asked is on the calendar as HOLD (ADR 0008, from
  1.162.0; before that, their offers waited until the job was confirmed),
  so crew asked early have the day in their calendar, marked as not yet
  booked. The private link still works; either answer counts.
- **Each person gets their own copy of the day (from 1.163.0).** The
  day on the jobs calendar has no guests. Each person invited gets their
  own event for each day, on the connected account's own calendar (the
  ops account's, so the jobs calendar keeps one event a day), with them
  as its only guest. It says what the shared day says, opened by a line
  for them that follows their answer:
  - offered: "Hi Aoife, are you available to work as Audio tech on Sat 2
    Mar, call 08:00? Press Yes or No on this invite to let us know."
  - said yes: "Thanks Aoife, you said yes to Audio tech on Sat 2 Mar… We'll
    confirm it with you soon. Here's the info for the day."
  - booked: "Hi Aoife, you're booked as Audio tech on Sat 2 Mar, call
    08:00. Here's the info for the day."

  From 1.166.0 ([ADR 0150](0150-hold-means-hold-the-day.md)) it greets
  them by the name they go by; while the client hasn't said yes it asks
  them to hold the day and never says "booked"; someone who has asked for
  a different rate is told it is with the office, and isn't asked to
  press Yes or No; and the second line is their page: "Please answer by
  Mon 4 Mar. Your rate and the details are on your page, where you can
  answer too: (their link)".

  From 1.167.0 ([ADR 0151](0151-notes-for-the-crew-and-office-notes.md))
  someone only asked, or waiting on the office about a rate, gets the day
  in short: the stage, the day, the venue's name and address and the per
  diems and fuel, then "Once you've said yes, this invite fills in with
  the day's sheet: the client, the crew, the notes and the pick list."
  Once they say yes, or the office books them, it says what the shared
  day says.

  The greeting is description, so it changes quietly; the HOLD coming off
  is a title change and sends an update. Their own page, where they can
  answer or see their offers, was the link at the foot until 1.166.0 and
  is the second line since. A copy
  whose person said No stays as a No while the day is still on. When
  this came in, anyone already a guest on a shared day was taken off it
  (Google tells them that one is cancelled) and invited to their own
  copy.
- **Their answer in Google counts, as on their link.** Each invite asks
  about one day, so a Yes counts for the day it was pressed on: the offer
  is accepted for the days they said yes to, and the days they haven't
  answered stay asked, with each invite's first line following its own
  day's answer ([ADR 0152](0152-a-yes-counts-for-its-own-day.md)). Until
  1.169.0 a Yes to any day was a yes to every day of the offer but those
  they said No to. A No to a day means not that day; a No to every day
  declines. Tentative ("Maybe") is not an answer yet. The same rules as the link hold: the
  first to say yes gets the place, nobody is booked on two jobs on one
  day, and the office still confirms. Each answer goes in the history as
  the freelancer's, on Google Calendar.
- **Once the office has confirmed, Google can't undo it.** The link says
  "contact the office" in that case; here, a No in Google to a booked day
  is shown on the job page for the office to act on, and the booking
  stands until they do. Counter-offers wait for the office the same way:
  a Yes pressed after asking for a different rate settles nothing, and
  the office's row says so (ADR 0152).
- **Guests follow the offers.** Someone whose place is filled by someone
  else, or whose offer is withdrawn, is taken off the events, and Google
  tells them. Someone who took only some days on their link comes off the
  other days. Someone who said No in Google stays on as a No, so they
  aren't sent a cancellation for something they turned down.
- **Emails only when they matter.** Adding or removing a guest, and a
  change to the title, date or place, are sent to guests; a change to
  the description alone (the crew list, the notes) is not, since those
  change often. Deleting an event with guests tells them it's cancelled.
  From 1.170.0, with "Tell crew what happens next" on
  ([ADR 0153](0153-crew-invites-tell-what-happens-next.md)), a person's
  own copy is titled with where they stand and their call time ("Booked:
  Harbour Lights Festival - Show 1/2, call 06:00"), so being booked and a
  call time that moves are emailed, and a day that comes off is first
  retitled, quietly, with why ("Filled by someone else: …"). It starts
  off.
- **Guests can't see each other's addresses, or invite others.** The
  description names the crew for the day already; personal email
  addresses stay between each freelancer and the office.
- **Other guests are left alone.** Anyone added to an event by hand in
  Google, such as a client or a supplier, stays on it when the app
  updates the event; the app reads the event before changing it, so
  nothing added in the meantime is lost. This also holds with the switch
  off.
- **Answers are read by asking Google, not the database.** Every two
  minutes the server asks Google which of the app's events have changed.
  Only when an answer has actually changed does it touch the database, so
  the database still sleeps when nobody is working. The nightly check
  looks at every event as well, in case anything was missed, for example
  while the server was restarting.
- **Turning the switch off stops everything at once.** Nothing more is
  sent and no more answers are read. People already invited keep their
  invites as they are, their own copies included; the app stops changing
  them.
  Disconnecting the calendar turns it off too, so connecting again starts
  with invites off.
- **Turning it on says what it will send.** The Account tab counts the
  invites and people first ("12 invites to 5 people"), since everyone
  already offered or booked from today on is invited straight away.

## Consequences

- Invites come from the account connected on the Account tab. It should
  be one crew already get invites from (the ops account), so the events
  land straight in their calendars: Google holds back invites from
  unknown senders for some people until they answer the email.
- The connected account gets Google's own "Aoife accepted" emails, as the
  ops staff do today. They can be turned off in that account's Google
  Calendar settings.
- The switch should be tried on the test calendar with staff's own
  addresses first, to see the emails as a freelancer would, before Session
  Hire Gigs.
- A No in Google to a confirmed booking needs a person: the office
  phones the freelancer and withdraws the offer or finds cover. Changing
  part of a confirmed booking in the app is later work.
- Google limits how many invites an account sends in a day; Session
  Hire's volume is far below it.
- Push notifications from Google would make answers arrive within
  seconds instead of minutes, at the cost of a public address Google
  calls and renewing the watch every week. Two minutes is enough for crew
  bookings; it can be revisited with calendar-led jobs.
