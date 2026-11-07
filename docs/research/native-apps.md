# Native iPhone and Android apps

Research date: 7 November 2026, asked for by Colly ("Can we start to
investigate a native iPhone and android app for this?"). Nothing is built
yet; this page is for choosing.

## Recommendation

**Wrap the app we have with Capacitor, one app for staff and freelancers,
and give it the few things a phone app can do that a web page can't.** Keep
one app: the same screens, the same code and the same releases, inside an
iPhone and an Android shell. Colly chose staff and freelancers on
7 November 2026. Staff sign in with Google; a freelancer opens their link
once in the app and it stays their way in. The app is never required: the
links keep working in any browser, as decided at the start.

In order:

1. **Now, no store needed: make the installed web app do more.** Ask the
   phone to keep the app's copy for good (so a phone short of space doesn't
   clear it), and try the phone field test on real iPhones and Androids,
   which is still to do. Push notifications to installed web apps work on
   both (an iPhone needs it added to the Home Screen first). The app contacts
   nobody only until launch (Colly, 7 November 2026: "When we launch we will
   definitely be contacting people"), so push can be built now and switched
   on at launch, like messages to crew.
2. **Then a Capacitor app for staff and freelancers**, warehouse first for
   staff: the phone's own
   barcode reader, one-tap label printing to the Zebra, notifications on the
   lock screen from launch, NFC
   tags on iPhones, and staying signed in. For freelancers: offers, their
   days and call sheets with a notification when something changes. Tried
   by a few staff and freelancers through TestFlight and Google Play's
   testing tracks, then on both stores for everyone (see below).
3. **Not** React Native or two fully native apps. Both mean drawing every
   screen again (the web app's screens are about 43,000 lines today) and
   then building every new feature two or three times. Nothing Session Hire
   needs from a phone requires it.

## What a phone app would actually add

| Need | In the browser today | What an app adds | Worth it? |
|---|---|---|---|
| **Scanning QR labels** | Works: Android reads with the phone's own reader, iPhones with a slower one in the page (ADR 0016) | Apple's and Google's own readers on both: faster, in poor light, several codes at once, and the torch | **Yes**, for the warehouse; the biggest everyday gain |
| **Label printing** | Print from the browser, or a spreadsheet into ZebraDesigner (ADR 0015). One-tap printing waits on the printer choice | Send the label straight to a Zebra over Wi-Fi or Bluetooth, no print dialog | **Yes**, once the printer is picked |
| **Notifications** | In the app only: the bell and pop-ups (ADR 0058) | Pushed to the lock screen. The web can do this too now, so it's not a reason on its own | **Yes, from launch**: built behind a switch, on when the app launches |
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

One app for both, Colly decided on 7 November 2026. 100+ freelancers on
their own phones rules out anything managed or capped, so:

- **Trying it** (a handful of staff and freelancers): TestFlight on iPhone
  (staff added to the Apple account need no review; freelancers join by a
  public TestFlight link after a light review; builds last 90 days) and
  Google Play's internal or closed testing on Android.
- **Everyone**: **unlisted on the App Store** (reviewed like any app, found
  only by its link, works on personal phones) and a **listing on Google
  Play** that isn't promoted. Apple's "custom apps" through Apple Business
  Manager suit company-owned, managed phones, which freelancers' phones
  aren't. A Zebra handheld in the warehouse can have the app file put on
  directly.
- **How a freelancer gets in.** Their offer or call-sheet link opens the
  app if it's installed (an app link on the app's own web address) and in
  the browser if not, so nobody has to install anything. Opened once in the
  app, the link is remembered and becomes their way in, with notifications
  for new offers and changes to their days. Staff sign in with Google.
- **Nothing extra for review.** Apple asks for a way to try an app that
  needs signing in; a demo freelancer link and a demo staff account (on
  made-up data, never the live company's) cover that.

## Costs and accounts

- **Apple Developer Program**: about €99 a year, enrolled as the company
  (needs a D-U-N-S number, which is free but can take days to weeks). Colly
  is enrolling the company.
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

1. Staff and freelancers, decided 7 November 2026. Which comes first in
   the build: the warehouse (scanning, printing) or freelancers' offers and
   notifications?
2. At launch, which notifications should reach a phone (offers answered,
   jobs moved, kit to check), and should freelancers get them too, or stay
   with messages and their links?
3. Colly enrols the company with Apple and Google (7 November 2026). Is
   there a D-U-N-S number already?
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
