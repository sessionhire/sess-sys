# Job offers to freelancers over WhatsApp, sent by the app

Research date: 9 November 2026, asked for by Colly ("Can you investigate
using WhatsApp to contact freelancers with job offers? I would like it that
the system does this automatically"). Nothing is built yet; this page is for
choosing.

The app contacts nobody until launch (Colly's standing rule). Everything
below is built behind a switch that starts **off**, and stays off until
Colly turns it on at launch.

## Recommendation

**Connect the app straight to Meta's WhatsApp Cloud API, with a Session
Hire WhatsApp number, and let an offer send itself the moment the office
makes it.** The freelancer gets a WhatsApp from "Session Hire" with the job,
the days, the call time, the venue and the rate, and three buttons:
**Yes, I can do it**, **No, I can't** and **See the details**. A Yes or a No
answers the offer in the app straight away, through the same command their
link uses, so every rule holds (no two jobs on a day, a call never
over-filled, first to accept on a shortlist). Only some of the days, or a
different rate, stays on their link, which the third button opens.

In order:

1. **Colly sets up the WhatsApp side** (about a week, mostly Meta's
   checks): a Meta business account verified as Session Hire, a phone
   number for WhatsApp, the display name "Session Hire" approved, a card
   for billing, and four message templates approved. Steps below.
2. **Part 1: the connection, the switch and freelancers saying yes to
   WhatsApp.** Nothing can send yet. Each freelancer's link page gets
   "Send my offers on WhatsApp" for them to tick, kept with when and what
   it said.
3. **Part 2: offers send themselves.** With the switch on, an offer to
   someone who ticked it goes on WhatsApp at once; the office sees sent,
   delivered and read on the offer. Anyone who hasn't ticked it, or whose
   message fails, falls back to today's panel for the office to send by
   hand.
4. **Part 3: the answer buttons**, so Yes and No on WhatsApp answer the
   offer, with a short thank-you back.
5. **Part 4, if wanted: the rest goes on its own too.** A reminder the day
   before "please answer by", and word when the office confirms, withdraws
   or changes a booking.

Picking crew without the office (offer the next person on the shortlist
when the first says no or doesn't answer) is a bigger step and a choice
about how the office works; it is a question below, not in the plan.

Cost: about **€80 a year** at Session Hire's size (worked out below). Direct
to Meta there is no monthly fee.

## How offers go out today

- The office makes an offer on the job page or under Crew (`offer.send`).
  The app writes the message (`offerMessage` in `shared/src/crew.ts`: the
  job, role, days, call time, venue, rate, what's needed, answer by, and
  their private link) and opens WhatsApp, a text or email with it filled in,
  for the office to press send ([ADR 0002](../adr/0002-crew-booking-links.md)).
- While "Messages to crew" is off, nothing opens at all; a card says who
  would have been sent what ([ADR 0048](../adr/0048-messages-to-crew-off-until-said.md)).
  It is off in the live app.
- The freelancer answers on their private link `/f/<token>`: accept all or
  some days, decline, or ask for another rate. Staff can also answer in the
  app ([ADR 0111](../adr/0111-staff-answer-offers-in-the-app.md)). Since
  8 November a link remembers the phones it opened on, and with that switch
  on a new phone needs a code by email ([ADR 0114](../adr/0114-freelancer-links-remember-phones.md)).
- Google Calendar invites are the one way the app already reaches people by
  itself, behind their own switch, also off
  ([ADR 0009](../adr/0009-crew-invites.md)).

ADR 0002 said this day would come: "Automatic sending (SMS/WhatsApp
Business, email) can be added later behind the same message." The message,
the link and the answer command are all there; WhatsApp becomes one more way
in and out, like the calendar.

## How WhatsApp for businesses works

**The ordinary WhatsApp app can't be driven by software.** Tools that do it
by pretending to be a phone break WhatsApp's terms, and the number gets
banned. The legal way is the **WhatsApp Business Platform**, whose
**Cloud API** Meta hosts: the app's server sends a message with one web
request and Meta tells it what happened (delivered, read, a button pressed,
a reply) by calling the server back.

The rules that shape the design:

- **Templates for anything the business starts.** A message to someone who
  hasn't written in the last 24 hours must be a template Meta approved
  beforehand, with blanks the app fills in (name, job, days, rate…). Once
  they reply, a 24-hour "service window" opens and the app can write
  freely. A job offer is always a template.
- **Three kinds of template, priced differently.** *Utility* (about a
  transaction the person is part of), *marketing* (anything promoting) and
  *authentication* (codes). An offer of work to a freelancer who asked for
  offers should be utility. Meta checks and can move a template to
  marketing if it reads as promotion, so the words stay plain: no "great
  opportunity", no offers of anything else. Meta tells the app if a
  template's category changes.
- **Buttons.** A template can carry up to three quick-reply buttons ("Yes,
  I can do it", "No, I can't") and a web button whose address ends in a
  blank (the freelancer's own `/f/<token>`). A pressed quick reply comes
  back to the server with a code the app chose, so it knows which offer it
  answers.
- **Opt-in first.** Meta's Business Messaging Policy requires the person to
  have agreed to hear from Session Hire on WhatsApp before the first
  message, and to be able to stop. Passive consent ("we have your number")
  doesn't count. Since November 2024 the opt-in needs to name the business
  but not WhatsApp itself; we'd name both anyway. Keep a record of each
  one.
- **Limits.** A new, unverified business can start conversations with 250
  people a day; verified, it climbs to 2,000 and beyond automatically.
  Session Hire's 100-odd freelancers fit under the first step, but
  verification is needed for the "Session Hire" display name anyway.
- **Quality.** If people block or report the number, Meta lowers its
  quality rating and can cut the limit. Offers people asked for, with a
  plain way to stop, keep it high.

## What it costs

Since 1 July 2025 Meta charges for each **delivered** message the business
sends, by category and by the recipient's country. Messages from the
freelancer to us are free.

| | Ireland (+353), per delivered message |
| --- | --- |
| Utility template (an offer, a reminder, a confirmation) | about $0.017 (about 1.5 cent) |
| Marketing template | about $0.059 |
| Free replies inside the 24-hour window | free for the first 1,000 a month per number, then the utility rate (from 1 October 2026) |

The Irish figures are from third-party rate cards, not Meta's own sheet,
and Meta changes them a few times a year; check Meta's rate card when
setting up. Utility templates sent inside a service window were free until
1 October 2026 and are charged now.

At Session Hire's size: a few hundred jobs a year, say 600 calls with three
offers each, plus a reminder for half and a confirmation for the ones who
say yes, is about 3,500 utility messages, **about €55 a year**, and the
thank-yous fit easily in the free 1,000 a month. Allow €80. If Meta moved
offers to marketing it would be about three and a half times that, still
under €300.

Billing is in Meta Business Suite against a card; currency is chosen once
when the account is made (euro).

## Direct to Meta, or through Twilio or another provider

| | Meta Cloud API, direct | Twilio | 360dialog and similar |
| --- | --- | --- | --- |
| Monthly fee | none | none | about €50 a number |
| On top of Meta's price | nothing | $0.005 a message, both ways | nothing |
| A year at our size | about €55 | about €75 | about €650 |
| Who else sees the messages | Meta | Meta and Twilio | Meta and the provider |
| Set-up | Meta's own sign-up | Twilio's guided sign-up | theirs |
| Texts (SMS) on the same connection | no | yes | no |

**Direct to Meta.** The app is already a server with web addresses for
Google, Current RMS and the operations mailbox to call back, so a provider
adds a company, a contract and a fee without adding anything we need. Fewer
companies holding freelancers' numbers is also simpler under GDPR. The one
thing Twilio would bring is texts for someone without WhatsApp; in Ireland
that's rare, and the office's own panel already covers them (it opens a
text with the words in). If texts are wanted later, the same message can go
through a text provider without changing anything else.

## Ireland and the EU

- **GDPR.** Session Hire is the controller; for business messages
  WhatsApp Ireland acts as the processor under the WhatsApp Business Terms
  and Data Transfer Addendum, which cover moving data out of the EU. The
  lawful basis is the working relationship (offering work the freelancer
  has asked to hear about) plus their opt-in. Session Hire's privacy notice
  for crew should say offers can go by WhatsApp, through Meta, and how to
  stop. Where Meta stores Cloud API messages (EU or US) isn't settled in
  what I could find; Meta offers local storage for some countries, worth
  checking when setting up.
- **The ePrivacy rules** (Ireland's S.I. 336 of 2011) are about direct
  marketing. Offering paid work to a freelancer who asked for offers isn't
  marketing, and nothing else would be sent.
- **The app keeps little.** It already holds the phone number. It would add
  the opt-in (when, the words they agreed to, from which link), Meta's
  message number and its delivered/read times on the offer, and any
  free-text reply for the office to read, kept 30 days. All of it goes in
  Download everything and the erasure, as the rest of a person does.
- **Erasure and stopping.** "Stop" (a button on every message, or the word
  typed, or unticking on their link) ends WhatsApp for them at once; offers
  go back to the office's panel.

## How it fits the app

**Sending.** When the office makes an offer and the switch is on, the
server sends the template after the offer is saved, in the background, so
the office never waits on Meta. The blanks come from the same place as
today's message (`offerMessage`'s pieces), so the WhatsApp, the link and
the panel all say the same. Staff could get them too, but they have the app
and, with the native app, its notifications; the question is below.

**What the office sees.** On the offer row: "On WhatsApp · delivered 10:42
· read 10:50", in the row's quiet second line. If it fails (number not on
WhatsApp, not delivered in 24 hours, they stopped) the row says so and the
office's panel comes back with the words, so nobody is silently missed.
"Read, no answer" is the most useful thing the office has never had.

**Answers.** Yes and No arrive at a new web address the server checks with
Meta's signature, find the offer from the button's code, and check the
sender's number is that person's. Then they run `offer.respond` exactly as
the link does, with `respondedVia: 'whatsapp'`, so History says "accepted
on WhatsApp", the shortlist and clash rules apply, and a late Yes after
someone else took the place gets "Sorry, that one's been filled" back.
"No" asks first, in the link's words, with a second button, because only
the office can offer it again. A typed reply ("can't do the Tuesday")
answers nothing: it goes to the office as a notification on the offer, and
the freelancer is told "Thanks, the office will see this. To pick days,
open your page."

**The link stays the place for everything else**, and the button opens it.
With "check new phones" on ([ADR 0114](../adr/0114-freelancer-links-remember-phones.md)),
a freelancer on a new phone is asked for a code; WhatsApp could carry that
code too, as an authentication template, later.

**Two switches, both off.** A new setting "Send offers on WhatsApp" under
Admin › Connections beside the calendar invites, which needs the
connection made and "Messages to crew" on. Off, nothing goes to Meta at
all, and opting in on a link is shown only once it's on. A **test mode**
sends only to numbers on a list (Meta's own test numbers allow up to five),
so Colly can try every message on their own phone before launch, if they say
so.

**What it needs from Railway:** `WHATSAPP_TOKEN` (a permanent system-user
token), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (to check Meta's
signature) and `WHATSAPP_VERIFY_TOKEN` (to register the web address).
Admin › Status gets a "WhatsApp" check that reads the number's status and
quality without sending.

## The four templates

In English, utility, wording to finalise with Colly. `{{…}}` are blanks.

1. **Offer** ("job_offer")
   > Hi {{first name}}, are you free for {{job}}?
   > {{role}}, {{days}}, call {{time}}, at {{venue}}. {{rate}}.
   > Please answer by {{day}}.
   >
   > [Yes, I can do it] [No, I can't] [See the details ›]
2. **Reminder** ("offer_reminder"): "{{job}} on {{days}} still needs your
   answer by {{day}}." with the same buttons.
3. **Booked** ("booking_confirmed"): "You're booked for {{job}}, {{days}}.
   Call sheet and details: [Your page ›]"
4. **Changed or off** ("booking_changed"): "{{job}} has changed:
   {{what}}. [Your page ›]"

Every one carries a Stop button or ends "Reply STOP to stop offers here".

## What Colly would set up

1. A **Meta Business portfolio** for Session Hire at business.facebook.com,
   and **business verification**: the company's CRO registration, an
   address and phone, a website on sessionhire.com and an email on it.
   Usually a few days, sometimes two weeks.
2. **A phone number** that isn't on ordinary WhatsApp, or, if the office
   already uses the WhatsApp Business app on a number freelancers know,
   that number through Meta's **coexistence**, which keeps the app working
   on the phone alongside the API (six months of chats come across). Which
   one is a question below.
3. **The display name** "Session Hire", approved by Meta after
   verification.
4. **A card** in Meta Business Suite for the messages.
5. **A system user and its token** for the app, and the web address for
   Meta to call back. I'd write the steps out, as for Google sign-in.
6. Submit **the four templates**; approval is usually minutes to a day.

## Build plan

Each part is a PR with its own changelog line and version; one ADR for the
lot, numbered when the first part is built (0123 is free on main today).

| Part | What | Size | Contacts anyone? |
| --- | --- | --- | --- |
| 1 | Connection under Admin › Connections, the two switches, test mode, Status check, the opt-in on the link page, kept and in the export | medium | No |
| 2 | Offers send themselves when on; delivered/read on the offer row; fall back to the panel | medium | Only when switched on |
| 3 | Yes/No buttons answer the offer; typed replies to the office; Stop | medium | Only when switched on |
| 4 | Reminder before "answer by"; confirmed, withdrawn and changed go on their own | small | Only when switched on |

Parts 1 to 3 together are what "the system does this automatically" needs.
All four can be built and tested now against a stand-in for Meta, as the
Claude and Google parts are; nothing reaches a real phone until Colly
connects a number and turns the switch on.

## Questions for Colly

1. **How automatic?** (a) The office presses Offer and it goes, no WhatsApp
   to tap (recommended); (b) also reminders and word of changes on their
   own (part 4); (c) the app works down a shortlist by itself when someone
   says no or doesn't answer in time. (c) changes who decides who's offered
   what, so I'd leave it until (a) has run for a while.
2. **Which number?** A new number just for the app, or the office's existing
   WhatsApp number freelancers already know (through coexistence)? Who holds
   it today?
3. **Opt-in on the link only?** Recommended: the freelancer ticks it on
   their own page, so there's proof in their own hand. The alternative is
   the office ticking it after asking them, which is quicker for the first
   100 but leaves the proof with the office.
4. **Staff too?** Staff answer in the app (ADR 0111) and will get phone
   notifications with the native app. WhatsApp for freelancers only, or for
   staff who tick it too?
5. **Testing before launch.** May the test mode send to your own phone (and
   anyone else's you name) so you can see each message for real? Nothing
   goes to anyone else until launch.

## Sources

- Meta, [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
  (per-message pricing from 1 July 2025; utility in the service window and
  service messages over 1,000 a month charged from 1 October 2026).
- Meta, [Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits.md)
  (250 to start, then 2,000 and 10,000, per business portfolio).
- Meta, [Getting opt-in](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in);
  CM.com, [opt-in policy update](https://www.cm.com/blog/whatsapp-updates-opt-in-and-quality-rating-policy/).
- Meta, [template category update webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/template_category_update/);
  YCloud, [category guidelines](https://www.ycloud.com/blog/whatsapp-api-message-template-category-guidelines-update).
- Irish rates: [Sent.dm pricing guide](https://docs.sent.dm/docs/guides/whatsapp-pricing),
  [Whautomate calculator](https://whautomate.com/tools/whatsapp-business-api-pricing-calculator).
- Twilio's fee: [Kanal](https://getkanal.com/blog/twilio-whatsapp-pricing),
  [Twilio's notice on October 2026 pricing](https://support.twilio.com/hc/en-us/articles/53100462475931-Notice-Changes-to-WhatsApp-s-Pricing-October-2026).
- Coexistence: [Hootsuite](https://www.hootsuite.com/whats-new/whatsapp-coexistence-in-business-app-and-cloud-api),
  [Telnyx](https://telnyx.com/release-notes/whatsapp-coexistence).
- GDPR: WhatsApp [Business Data Transfer Addendum](https://www.whatsapp.com/legal/business-data-transfer-addendum/).
