# ADR 0186: A client's quote link opens without the app

- **Status:** accepted
- **Date:** 15 November 2026
- **Asked for by:** Colly, 15 November 2026, after turning on quotes accepted online: "I've activated the accept quote
  link in the quote email. But it links to the site and asks for a sign in. Can we fix this by providing an area of the
  site to do this without needing to login as clients won't have any access to this."
- **Builds on:** [ADR 0121](0121-the-client-accepts-a-quote-online.md) (the client's link, `/q/<key>`),
  [ADR 0002](0002-crew-booking-links.md) and [ADR 0114](0114-freelancer-links-remember-phones.md) (freelancers' links and the
  lost-link page), [ADR 0173](0173-amending-a-quote-the-client-has.md) (amending a quote).

## Context

The page Colly asked for already exists: since ADR 0121 the server answers `/q/<key>` itself, with no sign-in, and
shows the quote with a name and a tick to accept it. On live, a made-up key gets the server's own "This link doesn't
open a quote" page, signed out.

What Colly met was the app's service worker. Once a browser has opened the app, its worker answers every page address
with the app's shell, offline, except the ones on its list: `/api/`, `/f/`, `/cal/` and `/adr/`. `/q/` was never put on
it, nor was `/link` (a freelancer's lost-link page). So on a phone or laptop that has used the app, as anyone in the
office testing their own email has, a client's link opened the app, and the app, finding nobody signed in, asked for
Google. A client's phone, which has never opened the app, got the quote. Staff pressing "Open it as they see it" on the
Quote tab met the same sign-in.

## Decision

- **One list of the server's own pages**, `web/src/serverPages.ts`: `/api/`, `/f/`, `/q/`, `/cal/`, `/adr/` and
  `/link`. The worker's `navigateFallbackDenylist` is that list, so a new public page is added in one place.
- **An older worker lets go by itself.** A phone keeps the worker it has until the app is reloaded onto the new version,
  so for a while an old worker can still answer `/q/` with the shell. The shell now looks where it was opened before it
  starts anything: at one of those addresses it removes the worker's registration and loads the page again, which then
  comes from the server. Once only for the same address in a minute, so it can never reload for ever; the next time the
  app itself is opened, its worker is put back.
- **A version not yet sent shows nothing of itself.** Every version has its key from the moment it is started, so an
  amendment being drafted (ADR 0173) has one. Its link showed its lines and prices under "This quote hasn't been sent
  yet". Now it says only that, with the office's details: no lines, prices, notes or form. It already took no answer,
  and its PDF already opened nothing.

What was checked and stays as it was (ADR 0121): each version's key is 144 random bits, its own, kept out of the
exports; a deleted version's key opens nothing; the page shows only what the printed quote shows; it takes an answer
only on the version with the client while its prices hold, and the switch being off shows nothing of any quote. The
email's link is built from `PUBLIC_URL` (server.letissier.ie on live), the address the office sends from otherwise.

Considered and not taken: a link that runs out after so many days. The quote's own "prices hold until" already stops the
link taking an answer, and the client keeps being able to see what they were sent and what they accepted.

## Consequences

- Clients, and anyone in the office trying a link, get the quote with no sign-in, on any device.
- A new public page the server answers must go on `SERVER_PAGES`, or a device with the app will show the app instead.
- `e2e/server-pages.spec.ts` opens a quote link with the app's worker in charge, and with an older worker that still
  answers it, and expects the server's page both times.
