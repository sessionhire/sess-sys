# ADR 0190: Applications to join the crew

- **Status:** accepted
- **Date:** 23 November 2026
- **Asked for by:** Colly, 23 November 2026: "I need a way for new applicants to submit themselves onto our system". Asked
  where an application should land, Colly chose **applications to review** over straight into People.
- **Builds on:** [ADR 0025](0025-crew-profiles-and-bringing-in-the-list.md) (Level 0 is an applicant nobody has vetted), [ADR 0002](0002-crew-booking-links.md)
  and [ADR 0114](0114-freelancer-links-remember-phones.md) (the server's own plain pages), [ADR 0048](0048-messages-to-crew-off-until-said.md)
  (nothing goes to anyone until launch), [ADR 0062](0062-what-crew-and-freelancers-read-of-other-people.md) (who reads people's details), [ADR 0184](0184-sole-trader-or-company.md).

## Context

New freelancers asked about work by phone, email or Instagram, and the office typed them in by hand, or didn't. Level 0
already meant "an applicant nobody has vetted", kept out of Offer to… unless asked for, but there was no way for an
applicant to put themselves forward.

## Decision

- **A public Apply page at `/join`**, drawn by the server like the lost-link page: plain HTML, an ordinary form, no
  script, no sign-in, works inside WhatsApp's and Instagram's browsers. It asks first and last name, email, mobile,
  what they do (as pills, below), day rate, sole trader or
  company, where they're based, their experience, and their agreement that we keep the details to offer them work.
  Errors are said under each field and listed at the top, with what they typed kept.
- **The mobile has a country picker beside it** (Colly, 23 November 2026, 1.215.0), set to Ireland, then the UK, then
  the rest by name. The number is typed as at home and kept in international form with the picked code before it, less
  the 0 dialled only at home (Italy keeps its 0), so `086 831 9330` with Ireland is `+353868319330`, ready for a call
  or WhatsApp with nothing added. A number typed with its own `+` or `00` keeps its code whatever is picked. A plain
  `<select>`, not a searchable list, as the page has no script; about forty countries, chosen for where crew come from.
- **What they do is a pill input, and there's no department to pick** (Colly, 23 November 2026, 1.217.0: "remove the
  department picker and include instead the autocomplete pill input the same as the roles one"). Typing offers roles
  as the app's Skills field does (Enter or a comma takes the highlighted one, or what's typed as a new one; × or
  Backspace takes one off), from the price list's roles, the crew lines quoted most in Current RMS (a service line that
  names a person's work, such as "Sound Engineer - per day", read as "Sound Engineer"; delivery, travel, hire and fees
  left out), then about forty usual AV roles (`AV_ROLES`), each spelt once as the office spells it. Only names go on
  the page. The department is read from the roles they pick, as a crew call's is (the one named most; none when they
  name none). At least one role is needed. This is the page's one script, let in by its hash; without script the field
  is the plain one it was, with commas between roles and the browser's own offers. The same usual roles are offered
  after those in use by the app's Role and Skills fields.
- **Off until the office turns it on**, under Admin › Company › Applications to join (`applications.use`, the
  `applications` setting). Off, the page says to get in touch with the office.
- **Applications wait, not in People.** Each is its own record (`applications`, synced as `application`) under
  Crew › Applications, newest first, each saying if someone on the Crew tab already has the same email or phone.
  - **Take on** (`application.take`) makes them a freelancer at Level 0 with what they sent (notes start "Applied on…",
    then where they're based and their experience), and the application goes.
  - **Turn down** (`application.drop`) deletes what they sent, from the table and the change feed, so nothing the app
    reads keeps it. The history says only that one was turned down.
  - Both need the crew ability. Applications are read by the office, directors and heads (who read people's details);
    a head who doesn't read rates isn't sent the rate or how they'd trade. Staff crew and freelancers get none.
- **Nothing was sent to the person who applied**: they see a thank-you page, and the office gets in touch the usual way.
  Since 1.218.0 ([ADR 0193](0193-payment-details-kept-locked.md)) they can be emailed when taken on, with their own page,
  or turned down, behind a switch that is off until launch.
- **Keeping junk out**, quietly: a hidden field a person never sees, a form sent back within 4 seconds of opening, or
  with no opening time, is a bot, and is shown the same thank-you with nothing kept. One address can send 10 an hour.
  One email is one application: sent again, the newer replaces it. Past 300 waiting, the page asks people to try again
  later. The history records each arrival by id only.

## Consequences

- No CV or photo upload yet: the experience box carries it. Files from strangers need scanning and limits of their own.
- No count on Home and no notification when one comes in: the Applications page under Crew counts them.
- The Apply page's address is the app's own (`/join` on the live address), to put on the website or send.
