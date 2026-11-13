# ADR 0170: The logo as the app's icon and its mark

- **Status:** accepted
- **Date:** 13 November 2026
- **Asked for by:** Colly, 13 November 2026 ("Can you use the logo to
  change the web app icon and the icon in the top left")
- **Builds on:** [ADR 0122](0122-the-logo-goes-home-and-each-person-chooses-where-the-app-opens.md)
  (the mark goes Home), [ADR 0155](0155-the-company-logo-in-one-place.md)
  (the logo put up for paper) and [ADR 0112](0112-the-phone-app.md) (the
  native shells)
- **Changes:** the red "SH" square at the top left and every icon the app
  is shown or installed with.

## Context

The app's icon and the mark at the top left of every screen were a red
square with "SH" in white, drawn when the app began. The company's logo,
the circle with "Session Hire" written through it and lines running out
of it either side, was only on paper: quotes, their PDFs and labels.

The logo put up under Admin › Company › Logo is kept for paper: the
device draws it out as a PNG on white (ADR 0155). On the app's dark head
that is a white box; it can't be recoloured, and a phone's icon, cut to a
circle or a rounded square, needs the mark drawn for that square. Phones
also take an icon once, when the app is added to the home screen, so an
icon that followed each upload would not reach the phones that already
have it.

## Decision

1. **One copy of the mark, in code** (`shared/src/logo.ts`), made from the
   SVG of the logo Colly sent, with nothing changed but the colour: it is
   drawn in the colour of the text around it, so it works on either theme.
2. **At the top left, the logo in the brand red** on the page's own ground,
   40 pixels tall and as wide as its shape, on the app's screens, the
   sign-in and the demo, and on the pages freelancers and clients open (the
   freelancer's page, call sheet, timesheet, quote, kit to buy, documents).
   It goes Home as the old mark did.
3. **The name beside it is for screen readers only, on the app's own
   heads**: the logo says it, and on a phone the written name next to the
   wider mark was cut short. The page's own name (Jobs, Crew…) keeps the
   line. The freelancer's and client's pages keep the written name: they
   have the width, and the name in plain type helps someone who has never
   seen the logo.
4. **Every icon is the logo in white on the brand red**, the square cut
   round the circle with the circle about seven tenths of its side, so
   Android's crop to its own shape keeps it all and the lines run off the
   edges as they run out of the circle. White on red rather than red on
   white: it keeps the colour people know the app's icon by, reads at a
   tab's 16 pixels, and is the red the phone's status bar already takes.
   `scripts/make-icons.mjs` draws the tab's SVG, the home-screen PNGs, the
   iPhone app's icon and Android's launcher icons from the one copy, and
   Android's adaptive icon has the red as its background.
5. **The upload stays for paper.** A new logo under Admin › Company › Logo
   still changes quotes and labels at once; a new mark for the app is a
   change to `shared/src/logo.ts` and a run of the script.

## Consequences

- A phone that already has the app on its home screen keeps the "SH" icon
  until the app is taken off and added again; a browser's tab picks up the
  new one on its next visit.
- The native apps take the new icons with their next build; nothing about
  them has been sent to a store yet.
- If the company changes its logo, the app's mark and icons are a code
  change, not an upload. That is rare enough to be worth the sharper,
  recolourable mark.
