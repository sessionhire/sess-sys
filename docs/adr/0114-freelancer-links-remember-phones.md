# ADR 0114: Freelancers' links remember their phones, and can check a new one

- **Status:** accepted
- **Date:** 8 November 2026
- **Asked for by:** Colly, 8 November 2026 ("Just want to sort out the access
  process for freelancers. What do the current rules allow?"), then "Link,
  made safer" from the three ways offered.
- **Amends:** [ADR 0002](0002-crew-booking-links.md) (the link is the whole
  credential: it still is, until the office turns checking on).
- **Keeps:** [ADR 0052](0052-google-only-for-staff.md) (staff sign in with
  Google, and their pages ask for it), [ADR 0048](0048-messages-to-crew-off-until-said.md)
  (nothing is sent until the office says), [ADR 0012](0012-personal-calendar-feeds.md)
  (calendar feeds stay read-only addresses).

## Context

A freelancer's way in is their private link, `/f/<token>`. Holding it is the
whole credential (ADR 0002): no account, password or code. That is what
makes it work for 100+ people who also work for other companies and won't
sign up to anything. Its weaknesses, found when Colly asked what the rules
allow:

1. The link never runs out and isn't tied to a phone. Forwarded into a
   WhatsApp group, or seen over a shoulder, it acts as that person, and the
   only fix is the office making a new one.
2. A freelancer who loses it has no way to get it back but asking the
   office.
3. Google sign-in only takes Session Hire's own Workspace accounts (and
   addresses listed one by one), so signing in isn't an answer for them.

Colly picked keeping the link and making it safer over leaving it as it is
or giving freelancers accounts. The rule that nobody is contacted before
launch holds: anything that sends is built behind a switch.

## Decision

1. **Every link remembers the phones it opens on, from today.** The first
   look at a link sets a cookie scoped to that link's own address
   (`/f/<token>`, 400 days, HttpOnly). The server keeps only a hash of the
   cookie's secret, which phone it looked like, and a hash of the link it
   came by. A phone counts once it comes back with its cookie, which a link
   preview fetched by WhatsApp or Mail never does; ones that never come back
   are forgotten after 30 days. This happens with the switch off too, so the
   phones freelancers already use go on working the day it goes on.
2. **One company-wide setting, "links", with `checkLinks` to it, off by
   default**, beside messages, timesheets and Claude. The command
   `links.check { on }` needs the `settings` ability (the office and
   directors). The card is under Admin › Company, after Messages to crew:
   **Freelancers' links**, with the switch **Check new phones**.
3. **With it on, a phone the link hasn't seen is asked "Is this you?"**,
   once another phone has used the link. Its one action is **Email me a
   code**: six digits, to the address the office has for them, shown
   masked ("d•••@example.com"), from the operations mailbox
   ([ADR 0098](0098-claude-drafts-quotes-from-the-mailbox.md)). The code
   works for 15 minutes and five tries, one at a time, a new one no sooner
   than a minute after the last; only its hash is kept. Right, and the
   phone is remembered and the page opens. Until then every page and form
   under the link answers with the same check, so nothing can be read or
   answered from it.
4. **A link nobody has used yet opens on the first phone.** That keeps a
   new link working the moment the office sends it. It is also the way
   back for someone with no email, or while the mailbox can't send: the
   office makes them a new link (one tap, as before), which forgets every
   phone the old one knew.
5. **Lost your link? (`/link`).** With checking on, a freelancer puts in
   their email and, if it is one freelancer's, their link is emailed to it,
   at most once every ten minutes. The page answers the same whether the
   address is known or not, so it tells nobody who works here. With
   checking off it says to ask the office. A link that doesn't work any
   more points to it.
6. **Staff are left to Google** (ADR 0052), and the calendar feed to the
   calendar apps that fetch it. Archived and erased people's links already
   open nothing; erasing someone also deletes their phones and codes.
7. **The phones and codes are secrets**, like sign-in sessions: they are
   not in Download everything or the backups. A restore asks each phone
   again, if checking is on.

## Design

- **One job:** let the right person in on their own phone, with nothing to
  sign up for.
- **Behaviour designed for:** Default Effect (off is the safe, reversible
  default before launch; on, the phone a freelancer already uses never
  sees a check). Effort and Friction: the check is one button and one code,
  once per phone, with the code field set for the phone to fill it from
  the email (`autocomplete="one-time-code"`). Loss Aversion: the email says
  plainly that a code they didn't ask for means someone has their link,
  and what to do.
- **Departures:** none from the shared system. The pages are the link's own
  plain HTML with no script, as ADR 0002 has it.

## Considered

- **Freelancers sign in** (an email code each time, or Google). Turned
  down by Colly: it asks them to sign up, which ADR 0002 was written to
  avoid.
- **A code by text.** The company has no texting account, and the rule is
  nobody is contacted before launch. Email from the mailbox already
  connected costs nothing. A text can be added behind the same page later.
- **Checking the first phone too.** Safer against a link forwarded before
  its person opened it, but every link sent would need an email before it
  opened, and someone with no email couldn't get in at all.

## Consequences

- Three new tables in the crew module: `link_devices`, `link_codes` and
  `link_lost`. None reach a device or the history.
- The office turns checking on under Admin › Company at launch, with the
  operations mailbox connected and allowed to send. Freelancers with no
  email on the Crew tab can't get a code; the office gives them a new link.
- The phone app ([research](../research/native-apps.md)) keeps the link the
  same way: opened once in the app, the app is a remembered phone.

## Open

- **Rated 2:** the first phone to open a never-used link is let in, so a
  link forwarded before its person opened it isn't caught. The office's
  New link is the fix, as before.
- **Rated 1:** the office can't yet see which phones a link remembers, or
  forget one without making a new link.
