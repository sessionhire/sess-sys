# ADR 0184: Sole trader or company

- **Status:** accepted
- **Date:** 14 November 2026
- **Asked for by:** Colly, 14 November 2026: "Can you add a Company/Sole Trader question to the staff screen? If it's a
  sole trader then ask if they are VAT registered? If they're a company then ask for CRO number and VAT number is just a
  field."
- **Builds on:** [ADR 0025](0025-crew-profiles-and-bringing-in-the-list.md) (the company a freelancer trades through),
  [ADR 0046](0046-departments-on-calls-and-what-each-role-reads.md) (rates left out for roles that don't read them).

## Context

A freelancer's record held a company: a name, a VAT number and a CRO number, under "More" on the form, with
"VAT-registered" read from whether a VAT number was held. Most freelancers are sole traders, not companies: a sole trader
has no CRO number and often no company name, and may be VAT-registered with the number not yet to hand. The form had no
way to say any of that, and invoicing will need to know which a freelancer is before it can treat their bills right.

## Decision

1. **One question, then only what it needs.** On the person form, beside Type, a freelancer has "Works for us as",
   Sole trader or Company, optional so nobody already on the list is held up. Sole trader asks "VAT registered?" Yes or
   No, and a VAT number only after Yes. Company asks the company name, the CRO number and the VAT number, the last just a
   field. The three company fields leave "More", which keeps department, level and certificates.
2. **Kept with the company.** `company` gains `as` (`sole-trader` or `company`) and `vatRegistered` (a sole trader's
   answer, null while not asked), stored in two new columns, `trades_as` and `vat_registered`. Both are optional on the
   wire, and an edit that leaves them out keeps what was said (`companyAfter`), so an older version of the app, the crew
   list's bring-in and combining two people never lose them. A record from before reads as a company, as it always did.
   VAT-registered is the yes, or a VAT number held.
3. **It goes with their pay.** How someone trades and their VAT and CRO numbers are money details, so they reach only a
   reader who sees that person's rate: the office and directors, a head where directors let heads see their department's
   rates, and the person themself. Anyone else is sent none (`companyHidden`), their form doesn't ask, and the server keeps
   what it has when such a reader saves the person, as it does the rate.
4. **Said plainly.** The person's page has a Business line: "Sole trader, VAT-registered", "Sole trader, not
   VAT-registered" or "Trades as Quinn Audio Ltd, VAT-registered", with the VAT and CRO numbers under it. The timesheet
   export's "Trading as" says Sole trader for one.

## Consequences

- Invoicing reads `tradesAs()` and `isVatRegistered()` rather than the raw fields.
- Heads who aren't given rates no longer see a freelancer's company or VAT number, which they did before.
- The radios can't be cleared back to not said; a wrong choice is changed to the right one.
