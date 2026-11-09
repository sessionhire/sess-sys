# ADR 0125: Offers go on WhatsApp by themselves

- **Status:** accepted; parts 1 and 2 built, part 3 (answers) next
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("I would like it that the system
  does this automatically"), after the research in
  [Job offers over WhatsApp](../research/whatsapp-offers.md). Colly's
  answers to its questions, the same day: send when the office presses
  Offer, at the same moment as the calendar invite; everyone on by
  default, with a toggle on their own page; staff too; test mode may send
  to Colly's own phone. The number is not decided yet.
- **Amends:** [ADR 0002](0002-crew-booking-links.md) ("Nothing is sent on
  Session Hire's behalf yet… Automatic sending can be added later behind
  the same message").
- **Keeps:** [ADR 0048](0048-messages-to-crew-off-until-said.md) (nothing
  reaches anyone until the office says), [ADR 0009](0009-crew-invites.md)
  (the calendar invite goes with the offer), [ADR 0111](0111-staff-answer-offers-in-the-app.md),
  [ADR 0114](0114-freelancer-links-remember-phones.md).

## Context

An offer today is made in the app and then sent by hand: the app writes the
message and opens WhatsApp for someone in the office to press send. With
100-odd freelancers and a shortlist on most calls, that's the slowest step
in booking crew, and the one most often left until later. Crew already
live on WhatsApp.

The only way for software to send WhatsApp messages within WhatsApp's terms
is the WhatsApp Business Platform. Its Cloud API is Meta's own, with no
monthly fee: Meta charges for each message delivered (about 1.5 cent for an
Irish number). A message the business starts must be a template Meta
approved, with blanks the app fills in. The research compared going through
Twilio or 360dialog and chose to go straight to Meta.

## Decision

1. **A switch with three settings, under Admin › Connections:** off, which
   is where it starts; *only to the numbers below*, up to five, to try it
   out; and on. The command `whatsapp.use { mode, testTo }` needs the
   `settings` ability and goes in the history. Nothing is sent when it's
   turned on: only offers made from then on go.
2. **The offer goes as it's made.** `offer.send` queues a message in the
   same change that makes the offer (`whatsapp_messages`, state `queued`)
   when the switch lets it reach that person, so it goes only if the offer
   was made. The server sends it just after, as the calendar invite goes,
   so the office never waits on Meta. A sender takes each queued message
   under a row lock other servers skip, checks again that the offer is
   still open, that WhatsApp is still on for them and that their mobile
   hasn't changed, and sends template `job_offer`. A passing problem at
   Meta (away, too many at once) is tried again a minute on, up to five
   times; Meta saying no (a number not on WhatsApp, a template not
   approved) isn't. A message that waited a day isn't sent. Whatever
   happens, the offer and the person's link are as they always were.
3. **On for everyone, theirs to turn off.** Colly chose on by default
   (9 November 2026). A person's page says, under their details, where
   their offers go on WhatsApp, with "Stop offers on WhatsApp" (and "Send
   my offers on WhatsApp" to turn them back on), from the moment the switch
   would send to their number. The office can turn someone off when they
   ask (Crew › the person › Details), but only the person turns it back on
   (`person.whatsapp`). Staff are treated the same.
4. **What it carries.** The template's eight blanks are the facts of
   `offerMessage`: their first name, the job, the role with any card it
   needs, the days, the call time, the venue, the rate (none named for
   staff) and the day to answer by. Its buttons are *Yes, I can do it*
   and *No, I can't*, carrying the offer's id, and *See the details*,
   opening their own page.
5. **Straight to Meta.** Railway holds `WHATSAPP_TOKEN` and
   `WHATSAPP_PHONE_NUMBER_ID` (enough to read the number and send),
   `WHATSAPP_APP_SECRET` and `WHATSAPP_VERIFY_TOKEN` (for answers, part
   3), and optionally `WHATSAPP_LANGUAGE` (en_GB) and `WHATSAPP_API_URL`.
   Admin › Status reads the number's state and quality from Meta and sends
   nothing. Steps for setting it up are in [whatsapp-setup.md](../whatsapp-setup.md).

## Considered

- **Twilio or another provider.** Each adds a fee or a monthly charge, and
  another company holding crew's numbers, for nothing the app needs.
- **Sending from the office's device.** That's today's way; it isn't
  automatic.
- **Asking each person first (opt-in) rather than on by default.** Meta's
  Business Messaging Policy asks for an opt-in before a business messages
  someone, and passive consent doesn't count. Colly chose on by default.
  What makes it fit: these are people who work for Session Hire and are
  messaged about offers on WhatsApp by the office today; every message
  says who it's from and is only about their work; and stopping is one
  press on their page. The risk is Meta's: if many people block or report
  the number its quality drops and Meta can limit it. Admin › Status shows
  the quality.

## Consequences

- One new table, `whatsapp_messages`, holding the number each message went
  to and Meta's id for it; in the backups and Download everything, and
  deleted with the person on erasure. Combining two people moves theirs.
- `people.whatsapp_off`, and the "whatsapp" row of `settings`.
- Nothing reaches anyone until Colly sets up the Meta side and turns the
  switch on (launch), or puts a number in test mode.

## Still to do

- **Part 3: answers.** Meta's receipts (delivered, read) on the offer row,
  Yes and No answering the offer through `offer.respond` (`respondedVia:
  'whatsapp'`), a typed reply to the office as a notification, and STOP.
  Until then the buttons do nothing but open WhatsApp's reply.
- **Which number** sends: a new one, or the office's own through Meta's
  coexistence. Colly to decide.
