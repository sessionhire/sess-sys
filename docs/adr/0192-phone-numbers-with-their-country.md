# ADR 0192: Phone numbers with their country, everywhere

- **Status:** accepted
- **Date:** 23 November 2026
- **Asked for by:** Colly, 23 November 2026, after the Apply page got a country picker
  ([ADR 0190](0190-applications-to-join.md), 1.215.0): "Could you make that the default phone number input
  systemwide?"
- **Builds on:** [ADR 0190](0190-applications-to-join.md) (the picker on the Apply page),
  [ADR 0125](0125-offers-go-on-whatsapp-by-themselves.md) (WhatsApp needs a number in full), [ADR 0119](0119-when-a-client-pays-and-who-to-ask-for-at-a-venue.md)
  (venues' contacts).

## Context

Numbers were kept as they were typed: `087 123 4567`, `+353 87…`, `0035387…`. Calls work from most of those, but a
WhatsApp link, a text from abroad and matching one person's number against another's all need the number in full with
its country. Freelancers come from the UK and further, and nothing on a form said how to write theirs.

## Decision

- **One phone field** (`web/src/PhoneField.tsx`, and `dialSelect` for the server's own pages): a country picker set to
  Ireland, then the UK, then about forty countries by name, beside the number typed as at home. It hands its form the
  number in international form (`+353868319330`) once it can read it, else what was typed, and the form refuses that
  with the same words everywhere (`phoneProblem`). A number typed with its own `+` or `00` keeps its code.
- **Used everywhere a number is typed:** a person's card, a client's contacts, a venue's contact, the office's own
  number under Admin, a freelancer's own page and the Apply page. A number kept before opens split into its country
  and the rest (`splitPhone`), so editing someone tidies their number too.
- **Shown grouped for reading** (`phoneShown`): `+353 86 831 9330`, `+44 7700 900123`, `+1 212 555 0142`; other
  countries' numbers as one run after the code, since a wrong guess at a shape reads worse than none. Links still dial
  the digits.
- **Numbers kept from before are written in full from Jobs › Tidy up**, as a card listing each one, old and new, with
  one press and a question, as the page's other tidying is. Each is the ordinary change for its person, client, venue
  or the office, in the history. Only numbers the app reads for sure change; the rest are counted, to fix by hand.
  Not done by itself on deploy: Colly sees the list first.
- **The server doesn't rewrite numbers.** Commands take what the field hands them, so an older app's save still works,
  and the freelancer's page reads the picked country beside the number before sending it.

## Consequences

- WhatsApp links and duplicate checks work for every number saved from now on.
- The picker is a plain `<select>`, on the server's pages too, which have no script; searching it by typing the
  country's first letter works in every browser.
- A number from a country not listed is typed with its `+`, which the hint says.
