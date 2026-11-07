# Native iPhone and Android apps

Research date: 7 November 2026, asked for by Colly ("Can we start to
investigate a native iPhone and android app for this?"). Nothing is built
yet; this page is for choosing.

## Recommendation

**Wrap the app we have with Capacitor, for staff first, and give it the
few things a phone app can do that a web page can't.** Keep one app: the
same screens, the same code and the same releases, inside an iPhone and an
Android shell. Freelancers keep their links, which need no app and no
sign-in, as decided at the start; an app for them can come later if they
ask for one.

In order:

1. **Now, no store needed: make the installed web app do more.** Ask the
   phone to keep the app's copy for good (so a phone short of space doesn't
   clear it), and try the phone field test on real iPhones and Androids,
   which is still to do. Push notifications to installed web apps work on
   both (an iPhone needs it added to the Home Screen first), but they reach
   people outside the app, so they wait for Colly's say under the standing
   rule.
2. **Then a Capacitor app for staff**, warehouse first: the phone's own
   barcode reader, one-tap label printing to the Zebra, notifications, NFC
   tags on iPhones, and staying signed in. Given to staff through TestFlight
   and Google Play's internal testing, then unlisted on the App Store and a
   closed track on Play, so it never shows in a public search.
3. **Not** React Native or two fully native apps. Both mean drawing every
   screen again (the web app's screens are about 43,000 lines today) and
   then building every new feature two or three times. Nothing Session Hire
   needs from a phone requires it.

## What a phone app would actually add

| Need | In the browser today | What an app adds | Worth it? |
|---|---|---|---|
| **Scanning QR labels** | Works: Android reads with the phone's own reader, iPhones with a slower one in the page (ADR 0016) | Apple's and Google's own readers on both: faster, in poor light, several codes at once, and the torch | **Yes**, for the warehouse; the biggest everyday gain |
| **Label printing** | Print from the browser, or a spreadsheet into ZebraDesigner (ADR 0015). One-tap printing waits on the printer choice | Send the label straight to a Zebra over Wi-Fi or Bluetooth, no print dialog | **Yes**, once the printer is picked |
| **Notifications** | In the app only: the bell and pop-ups (ADR 0058) | Pushed to the lock screen. The web can do this too now, so it's not a reason on its own | Only once Colly lets the app contact people |
| **Working with no signal** | Already works: the app keeps its own copy and a queue of changes (ADR 0001). The queue sends only while the app is open | Can send the queue soon after signal comes back, even closed (within limits) | Small gain |
| **NFC tags** | Android Chrome only | iPhones too | Only if NFC tags are used; QR is the system of record |
| **RFID** | Not from a browser | Zebra handhelds' own software types into the page anyway; an app could talk to the sled directly | Later, if RFID comes |
| **Trackers** | The Yabby Edge trackers report through Digital Matter, not through phones (ADR 0107) | Nothing; background location on staff phones isn't needed | **No** |
| **Staying signed in** | A year, by cookie (ADR 0052) | Months, and a home-screen icon without "Add to Home Screen" | Small gain |
| **Being in the App Store** | Installed from the browser | Easier for staff to find and trust | Small gain |

## The ways to build it

| | Capacitor (wrap this app) | React Native / Expo | Fully native (Swift + Kotlin) |
|---|---|---|---|
| What it is | The existing web app inside a native shell, with plugins for the phone's parts | A new app in React, drawn with the phone's own controls | Two new apps, one per phone |
| Reuses today's screens | All of them | Logic only; every screen redrawn | None |
| Rough effort | Days for a first build; a week or two with scanning, sign-in and notifications | Months to catch up, then every feature twice (web + app) | Many months, then every feature three times |
| Feels native | Close, since the app is already built for phones | Yes | Yes |
| Store review risk | Apple turns down apps that are only a website (guideline 4.2); the native scanner, printing and push are what clear it | Low | Low |
| Precedent | Crewbox already has a Capacitor setup to copy | | |

A Play Store listing of the web app as it is (a "Trusted Web Activity")
is cheaper still, but adds nothing the installed web app doesn't do, and
there's no iPhone equivalent, so it isn't worth a step of its own.

## Getting it onto phones

**Staff (the office, heads, the warehouse).** The app is for them.

- *iPhone*: TestFlight first (up to 100 staff who are added to the Apple
  account, no review, builds last 90 days), then **unlisted** on the App
  Store: reviewed once, reached only by its link, works on personal phones.
  Apple's "custom apps" through Apple Business Manager suit company-owned,
  managed phones, which Session Hire doesn't have.
- *Android*: Google Play internal testing (up to 100, no review), then a
  closed track or a private listing; or the app file straight onto a
  company handheld such as a Zebra.

**Freelancers (100+).** Their links stay the way in: no app, no sign-in,
one tap from a message or their calendar, as the start of the project
decided (freelancers found Rentman's and TeamTrack's apps a chore). If
staff use the app and freelancers want it too, the same app can open a
freelancer's link, and going public on both stores is a later step.

## Costs and accounts

- **Apple Developer Program**: about €99 a year, enrolled as the company
  (needs a D-U-N-S number, which is free but can take days to weeks). Colly
  or someone at Session Hire has to enrol; Claude can't.
- **Google Play Console**: a one-off $25. Enrol as an **organisation**: a
  new personal account has to run a 14-day test with 12 testers before it
  can publish.
- **Building for iPhone needs a Mac with Xcode.** This cloud workspace is
  Linux, so builds would run on GitHub's Mac runners (free while sess-sys
  is public) or a build service such as Codemagic or Ionic Appflow, or on
  Colly's Mac.
- **Review**: Apple usually answers in a day or two; the first review is
  the one that can bounce under 4.2. Updates to the screens don't need a
  new review if the shell loads them from the app's own files and only the
  web side changes, but each new native feature does.

## What would change in the app

- **Sign-in.** Google won't sign in inside an app's embedded browser, so
  the app opens Google in the phone's own browser and comes back with the
  session by a link. A small server change beside ADR 0052.
- **Where the screens come from.** Packed inside the app (works with no
  signal from the first open, and what Apple expects), with the app picking
  up new screens itself between store releases; not a shell that only loads
  the website.
- **One scan, any reader.** The scanner already treats a scan the same
  whatever read it; the app's reader becomes one more source, as the stock
  tracking research planned.
- **A new ADR** for the app, and the version and changelog as usual.

## Open questions for Colly

1. Staff only first, as recommended, or freelancers too from the start?
2. Can notifications go to staff phones, or does that wait under the
   standing rule?
3. Who enrols the company with Apple and Google (and is there a D-U-N-S
   number already)?
4. Which phones does the warehouse use, and is a Zebra handheld likely?
5. Which label printer: still the Zebra ZT411?

## Sources

- Apple, [App Review Guidelines 4.2, Minimum functionality](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality),
  and a [rejected Capacitor app](https://developer.apple.com/forums/thread/812889) on Apple's forums.
- Apple, [Unlisted app distribution](https://developer.apple.com/support/unlisted-app-distribution)
  and [Intro to content distribution](https://support.apple.com/guide/deployment/intro-to-content-distribution-depe1553f932/web).
- Google, [testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465).
- Web push on iPhone: [MacRumors, iOS 16.4](https://www.macrumors.com/2023/02/16/ios-16-4-web-push-notifications/);
  Apple reversed its 2024 plan to drop Home Screen web apps in the EU
  ([Apple developer forums](https://developer.apple.com/forums/thread/745414?page=2)).
- Our own: ADR 0001 (sync), 0015 (labels), 0016 (scanning), 0052 (sign-in),
  0058 (notifications), 0107 (trackers), and
  [stock tracking](stock-tracking.md).
