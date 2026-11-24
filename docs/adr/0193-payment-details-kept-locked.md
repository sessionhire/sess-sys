# ADR 0193: Payment details kept locked, and emailing people who apply

- **Status:** accepted
- **Date:** 23 November 2026
- **Asked for by:** Colly, 23 November 2026: "As a freelancer, I'd like to be able to provide a VAT or PPSN as well as
  bank details for invoicing on the basic applicant page, so that payroll can be streamlined".
- **Builds on:** [ADR 0190](0190-applications-to-join.md) (the Apply page), [ADR 0008](0008-calendar-sync.md)
  (a secret stored locked), [ADR 0046](0046-departments-on-calls-and-what-each-role-reads.md) and [ADR 0062](0062-what-crew-and-freelancers-read-of-other-people.md)
  (who reads what of people), [ADR 0027](0027-erasing-a-person-on-request.md) (erasing on request).

## Context

Paying a freelancer needs their PPS number or VAT number and their bank account. The office collected these by email
or text, then retyped them. They are the most sensitive details the app would hold about anyone: a PPS number and an
IBAN are enough for fraud. Invoicing is paused until the office says how it pays people, so for now they only need to be
kept, safely, for when it does.

## Decision

- **Asked on the Apply page, all optional**, under "For paying you (optional)": PPS number, VAT number if registered,
  name on the account, IBAN, and BIC (optional, as an IBAN in the euro area is enough). Each is checked as typed in the
  way its issuer checks it: a PPS number by its check letter, an IBAN by its check digits, a BIC by its shape. A name
  needs an IBAN with it and the other way round. A mistake is said under the field, as every other one on the page.
- **Kept locked, never sent to devices.** They are sealed on the server with AES-256-GCM, under a key worked out from
  `PAYMENT_DETAILS_KEY`, a random text of at least 32 characters that lives only in the server's settings, so a copy of
  the database or a backup holds only the locked text. (Until 1.218.1 the Google client secret stood in when it wasn't
  set; it is now only tried to unlock, so one secret leaking doesn't open both sign-in and payment details.)
- **The key can be changed** (24 November 2026, after a security check Colly asked for): the old one goes in
  `PAYMENT_DETAILS_KEY_OLD`; on starting, the server locks everything the old one locked, kept or still on an
  application, again with the new one, and logs how many. Once that's in the log, the old one can go. They go nowhere in the change feed. An application
  says only that they were given (`paymentGiven`).
- **Read only by those who see money** (directors and the office, the `money` ability), on the person's Details tab, in
  a Payment details card that asks the server each time and so needs signal. They come masked (the PPS number's last
  three, the IBAN's country and last four; the name, BIC and VAT number as they are, since they are on every invoice).
  Show in full asks again and goes in the history as "Looked at …'s payment details in full", never with what was
  seen. Change puts them in or corrects them, which also goes in the history; clearing them all takes them off.
- **They move with the person**: taken on from an application, they go to the new person, marked as given by the Apply
  page. Combining people keeps the kept person's, or brings the newest of the others' when the kept one had none.
  Erasing someone on request deletes theirs at once.
- **Told before they're given** (GDPR article 13): the Apply page has "How we look after your details": who keeps them
  and how to reach them, why (including telling Revenue what was paid), who sees them, that they're in the EU, how long
  they're kept, and the right to see, correct or delete them and to complain to the Data Protection Commission.
- **Without a key, none are asked or kept**: the Apply page leaves the section out and the card says why. With sign-in
  off (the tests and trials) a stand-in key is used, as anyone who can reach that copy is in anyway.
- **Not used yet.** Nothing reads them to pay anyone until invoicing is decided.

### Emailing people who apply

Colly, 23 November 2026, asked whether the app should email applicants after launch: "Yes. Please notify them before
they submit that they will be emailed. Please also in that email allow them to log into their portal in the app."

- **A switch of its own, off until launch** (Admin › Company › Applications to join › Email people who apply,
  `applications.email`), as every way the app reaches anyone outside it is (ADR 0048).
- **On, the Apply page says so before they send**: under the email field ("We'll email you here once we've read your
  application, with a link to your own page if we add you to our crew list") and again above Send my application. The
  thank-you page says the same.
- **Taken on**, they're emailed the address of their own page (`/f/…`, ADR 0002), the portal where they see and answer
  offers and keep their details and days off up to date, told to keep it to themselves. **Turned down**, a short polite
  email says there's no work that suits just now, that their details weren't kept, and that they can apply again.
- **Sent just after, from the operations mailbox**, as the link codes are (ADR 0114): queued in the same change as the
  decision, so one goes only if that was kept, and sent once under a row lock. One the mailbox can't send waits and is
  tried each minute for a day. Turned off before it went, it doesn't go. Once gone or given up on, the address and first
  name it was for are cleared, so a turned-down applicant's address isn't kept. The office's confirmations and toasts
  say whether they'll be emailed.

## Consequences

- Until `PAYMENT_DETAILS_KEY` is set on the live server, the Apply page doesn't ask for payment details and the card
  can't add any. Losing the key (rather than changing it as above) loses every detail it locked: keep a copy somewhere
  safe outside the app, such as the company's password manager.
- A freelancer can't yet give or change their own on their page: they tell the office, which changes them on the card.
