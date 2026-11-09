# ADR 0112: The phone app, warehouse first

- **Status:** accepted
- **Date:** 8 November 2026
- **Asked for by:** Colly, 7 and 8 November 2026 ("Can we start to
  investigate a native iPhone and android app for this?"; one app for
  "Staff and freelancers"; "Warehouse first")
- **Research:** [native iPhone and Android apps](../research/native-apps.md)

## Context

The app is a web app built for phones, installed from the browser. The
research compared wrapping it with Capacitor, React Native and two fully
native apps, and recommended the first: one set of screens, released
once, inside an iPhone and an Android shell that adds what a browser
can't do. Colly chose one app for staff and freelancers, the warehouse
first, and is enrolling the company with Apple and Google.

The warehouse's biggest gain is reading labels. In a browser, Android
reads with the phone's own reader, but an iPhone uses a slower reader in
the page (ADR 0016).

## Decision

1. **A Capacitor shell round the web app at its own address** (`app/`,
   `com.sessionhire.app`). The shell opens the live app, so signing in,
   the device's copy and the queue of changes (ADR 0001) are the web
   app's own, and a deploy reaches the phone app the moment it reaches
   the web, with no store release. On an iPhone the app's address is
   listed as the app's own (`WKAppBoundDomains`), which is what lets the
   web app keep working with no signal there. A page packed into the
   shell says "No signal" only if the app has never been opened with
   signal. `SH_APP_URL` points a build at a test copy.
2. **The phone's own barcode reader.** Inside the app, the camera on
   Stock, pick lists, counts, testing and putting away uses Google's ML
   Kit reader on both phones instead of the page's. It behaves as the
   page's camera does: stays on, reads each new code once (again only
   after it has been out of sight for a moment), only counts a code
   wholly inside the frame, beeps and buzzes, has Light, Sound and Stop,
   and stops while the app is out of sight. The phone draws its camera
   behind the page, so while it's on, the camera shows in a band across
   the top of the screen and the page carries on below it, so a form a
   read opens (claiming a label, a count) is still there to fill in. In
   a browser nothing changes.
3. **Signing in through the phone's browser.** Google won't sign in
   inside an app, so in the app "Sign in with Google" opens the phone's
   browser. The app leaves with a challenge (the hash of a secret only
   it holds, PKCE's shape); once Google says yes, the server keeps the
   new session for two minutes and sends the browser back to the app by
   its own address (`com.sessionhire.app://signed-in?code=…`). The app
   swaps the code, with the secret, for its session (`POST
   /api/auth/app/claim`), once. A code caught by anything else on the
   phone is no use without the secret. Kept in the server's memory, as
   it runs as one process: a restart in those two minutes means signing
   in again. Refusals come back the same way and the sign-in screen says
   why, as it does in a browser.
4. **Built in CI, not yet signed.** `.github/workflows/app.yml` builds
   the Android app (and keeps the file for trying on an Android phone by
   hand) and the iPhone app for the simulator whenever the shell
   changes. Signing, TestFlight and Google Play's testing tracks follow
   once the company's Apple and Google accounts exist.

## Consequences

- Nothing changes for anyone in a browser. Freelancers' links stay the
  way in, app or no app.
- The phone app is what the stores review, so it needs its icons, a
  demo account for Apple's reviewers, and the store listings before it
  goes out: the next part.
- Still to come, in order: label printing straight to the Zebra; a
  freelancer's link opening in the app and being remembered; lock-screen
  notifications behind a switch for launch; NFC tags on iPhones.
- The shell needs the live app's address to stay where it is, or a new
  build: a custom domain for the app would be worth having before the
  stores.
