# ADR 0119: When a client pays, and who to ask for at a venue

- **Status:** accepted
- **Date:** 8 November 2026
- **Asked for by:** Colly, 8 November 2026, picking ideas 1 and 2 from
  [Rentdeck, set beside the app](../research/competitor-rentdeck.md)
  ("1, 2, 3, 4, 6").
- **Builds on:** [ADR 0084](0084-the-printed-quote.md) (the printed quote
  and the client's address), [ADR 0021](0021-call-sheets.md) (call sheets),
  [ADR 0032](0032-venue-and-client-pages-and-their-documents.md) (venue and
  client pages).

## Context

Rentdeck keeps a payment term on each customer (14 or 30 days) and a
contact person on each saved location. The app had neither. A client's
payment terms lived in the company's own terms text, the same for everyone,
or in someone's head. A venue's people went in its notes: ADR 0032 lists "a
venue's contacts, which today go in its notes" as open. So the call sheet
could say where to load in, but not who to ask for at the door.

## Decision

1. **A client has payment terms, or none.** Before the job, when the
   invoice arrives, or within so many days of the invoice (7, 14, 30 or 60
   offered; any whole number up to 120 is kept). None means the company's
   own terms, which every quote prints anyway. Stored as
   `clients.payment_terms` (null, `'before'` or the days), sent as
   `paymentTerms`.
2. **Their quotes print it**, under the deposit, in the same words on the
   page and in the emailed PDF: "Payment is due within 30 days of the
   invoice." The client's page says it under "Pays".
3. **A venue has one person to ask for on site**: a name, a role, a mobile
   and an email, the shape a client's contact already has. Stored as
   `venues.contact` (jsonb or null), sent as `contact`. A name is what makes
   one: clear it to take them off.
4. **Every call sheet for a job there names them, for every reader**:
   "At the venue, ask for Gráinne Nolan (Venue technical manager) on
   087 123 4567", in the app, on the crew's own link and in the message to
   paste. With their number, as the venue's notes on access already go to
   everyone: it is the venue's own person, whom the crew ring at the door.
   Never their email, which is the office's to use.
5. **A save from an older app leaves both as they were.** Both fields are
   optional on `client.upsert` and `venue.upsert`, as the client's address
   is (ADR 0084), and the device's own copy keeps them the same way.

## Considered

- **Payment terms as free text.** Flexible, but then the quote would print
  whatever was typed, and nothing could later work out when an invoice is
  due. The fixed shape covers what hire firms use. Anything stranger still
  goes in the company's terms or the quote's notes.
- **Several contacts on a venue, as a client has.** The call sheet needs
  one person to ask for, and two names would leave crew asking which. The
  venue's notes still hold anyone else.
- **Keeping the venue contact to the office and the contact on the day**,
  as the client's contacts are. Rejected: the crew member arriving first is
  the one who needs to know who to ask for. The client's people are the
  office's business, but the venue's door person is everyone's.

## Consequences

- Invoicing, when it comes, can work out a due date from the terms.
- Download everything carries both, in the clients and venues files.
- Made-up data gives Brightwater 30 days, Kilbeg Weddings "before the job",
  and Northbank a technical manager, so the demo shows both.
