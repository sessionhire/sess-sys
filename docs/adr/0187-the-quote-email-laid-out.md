# ADR 0187: The quote email, laid out as the company's

- **Status:** accepted
- **Date:** 15 November 2026
- **Asked for by:** Colly, 15 November 2026: "Can we do something to improve the look of the quote email that gets
  sent. It's very basic." Then: "The pdf is fine."
- **Builds on:** [ADR 0101](0101-sending-a-quote-to-the-client-by-email.md) (sending a quote by email), [ADR 0121](0121-the-client-accepts-a-quote-online.md)
  (the client's link), [ADR 0139](0139-a-quote-that-looks-like-the-company.md) (the PDF as a company document),
  [ADR 0181](0181-the-company-on-every-quote.md) (the company's registered details on the foot), [ADR 0186](0186-client-links-open-without-the-app.md).

## Context

The quote went as plain text: the office's message, and the PDF attached. In a client's inbox it looked like any
email, with nothing of the company's in it, and the link to accept online was a long address in the middle of a
paragraph. The PDF already reads as the company's document; the email that carries it didn't.

## Decision

- **The email gets an HTML part beside the text** (`multipart/alternative`), laid out in
  `server/src/finance/quote-email-html.ts`: the brand red band and the logo from Admin › Company › Logo, with "Quote"
  and its number opposite; the office's message as typed, in paragraphs, web and email addresses made links; a panel
  with the job, the dates, the venue and the total including VAT in the brand's red, with the net and VAT under it, the
  deposit and the date prices hold until; a red **View and accept the quote** button while the office takes answers
  online, with the link written out under it for a client whose mail program won't press it; a line naming the PDF
  attached; and the company's address, phone, email, VAT number and registered details along the foot, as the PDF has
  them.
- **The text part is the message exactly as typed**, so a mail program that shows no HTML, and the office's record,
  read as before. In the HTML the paragraph that only gives the accept link is left out, as the button stands for it.
- **The logo travels inside the email** (`multipart/related`, by content id), as Gmail shows no picture written into
  the page and fetching one from the app would show "images hidden" in Outlook. PNG, JPEG and GIF go; a WebP logo,
  which Outlook can't show, gives way to the trading name in words. Its size is read from the picture, so Outlook draws
  it the right shape, 44 pixels tall and no wider than 200. It sits on its own white tile, so a mail program that
  darkens the email still shows it.
- **Written as email has to be:** tables for the layout, every style inline, nothing fetched from outside, a Windows
  Outlook frame in conditional comments. A style block adds a full-width layout on phones and dark colours for the mail
  programs that take one (Apple Mail, iOS, Outlook on the web); the rest stay in light colours, or darken it themselves.
- **The compose box shows it.** "Look at the email" under the message draws the email as it would go, with the message
  as it stands, from `POST /api/quotes/:id/email/preview` (money roles). The frame grows to the email's height, so the
  page scrolls, not the frame. "Show my changes" draws it again after an edit.
- The PDF is left as it is.

## Consequences

- Every quote email goes laid out; there is no switch for the plain one, as nothing about sending changes.
- The preview and the email come from the same function, so what the office looks at is what goes.
- Nothing was sent to test this: the layout was checked by drawing it in a browser at desk and phone widths, light and
  dark.
