# ADR 0125: Offers go on WhatsApp by themselves

- **Status:** accepted; built in three parts (the last, answers, on 9 November 2026)
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

6. **Answers come back (part 3).** Meta posts to `/whatsapp/hook`, which
   answers its one-off check with `WHATSAPP_VERIFY_TOKEN` and believes a
   post only when it's signed with `WHATSAPP_APP_SECRET`. Only posts for
   this number count.
   - **Receipts.** Sent, delivered, read, or not delivered and why, go on
     the message and show on the offer's row in Crew while it waits for an
     answer ("read on WhatsApp"). A receipt never takes a message back.
   - **Yes, I can do it** accepts the offer, all its days, as their own
     answer on their page would (`offer.respond`, `respondedVia:
     'whatsapp'`), and they're told they're down for it and the office will
     confirm. Turned down (filled, withdrawn, a clash), they're told why in
     the same words their page uses.
   - **No, I can't** asks once more, *Decline it* or *Keep it open*, as
     their page does, so a slip of the thumb doesn't lose them a job.
   - **Old buttons.** Pressed after they've said yes, nothing changes: Yes
     says they're already down for it, No points to their page to say they
     can't make it, so the office hears through "Answers to check".
   - **Only theirs.** A button counts only from the number its offer went
     to. Meta sends again when unsure; each message is acted on once
     (`whatsapp_inbound`, Meta's id only), and the answer's id comes from
     Meta's, so it's never taken twice.
   - **Written messages.** STOP (or *unsubscribe*, *opt out*) turns their
     offers on WhatsApp off, as their page's button does. Anything else
     written, or a photo or voice note, is answered with where to answer and
     the office's number: nobody reads this number. A number the app never
     messaged hears nothing.
   - **In the history** each is theirs, "on WhatsApp", with the person's
     other answers (client `whatsapp:<person>`), and Download everything
     says WhatsApp.

## Offers on hold, and what follows (1.162.0)

Colly, 11 November 2026: the WhatsApp, the calendar invite and the email all
go the moment the office presses Offer, before the client has said yes if
need be, marked HOLD; a confirm some time later is followed up, and so is a
cancel. The calendar side is ADR 0008/0009 (1.162.0). On WhatsApp:

- **HOLD in the offer.** While the job is an enquiry or quoted, the job's
  blank reads `HOLD Nissan (Build)`, as its days do on the calendar. The
  same template; no new words for Meta to approve. The message keeps whether
  it went on hold.
- **Confirmed.** When the job moves to confirmed, each person whose offer
  went saying HOLD, and is still asked or booked (not declined, filled or
  withdrawn), gets the `job_confirmed` template straight away: their name,
  the job, their days, and See the details. The calendar invite loses its
  HOLD at the same moment. (1.162.0 waited an hour first; Colly asked for
  no wait, 1.162.1.) Once per HOLD message: back on hold and confirmed
  again says nothing new.
- **Cancelled or lost.** Everyone asked or booked on it who had an offer on
  WhatsApp gets the `job_cancelled` template, once per person, read before
  the job's calls are cancelled.
- Both are queued in the job's own change and sent just after, like the
  offer, and dropped if the job has changed again before they go. Nothing
  goes while the switch is off, and test mode reaches only its numbers.


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

- Two new tables: `whatsapp_messages`, holding the number each message went
  to and Meta's id for it; in the backups and Download everything, and
  deleted with the person on erasure. Combining two people moves theirs.
  And `whatsapp_inbound`, Meta's id of each message received and when,
  nothing else, so each is acted on once.
- `people.whatsapp_off`, and the "whatsapp" row of `settings`.
- Nothing reaches anyone until Colly sets up the Meta side and turns the
  switch on (launch), or puts a number in test mode.

## Still to do

- **Which number** sends: a new one, or the office's own through Meta's
  coexistence. Colly to decide.
- **Written messages to the office.** Today a written message gets an
  answer saying nobody reads the number. If crew write there a lot, the
  office could get them as a notification instead.
