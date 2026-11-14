# ADR 0181: The company as the law names it, on every quote

- **Status:** accepted
- **Date:** 14 November 2026
- **Asked for by:** Colly, 14 November 2026: "For the quote pdf can you check what kind of information should be on it? I
  think we need to have VAT number/CRO number and the registered address on it? Can these also be editable fields in the
  admin section along side anything else needed?"
- **Builds on:** [ADR 0139](0139-the-quote-as-a-company-document.md) (the quote as a company document) and the office's
  VAT number and address (ADR 0042's open item).

## Context

The printed quote and its PDF said "Session Hire", the office's address, phone, email and VAT number. The company's
registered name, its CRO number, its registered office and its directors were nowhere. Section 151 of the Companies Act
2014 asks every Irish company to show, on its business letters and order forms: its name and legal form, that it's
registered in Ireland and its registered number, its registered office, and every director's first name and surname
(with their nationality when it isn't Irish). A quote is a business letter in all but name, and it's what a client
signs to become an order. The VAT number isn't required on a quote (only on an invoice), but clients ask for it.

## Decision

1. **A Company details card under Admin › Company**, after Office details: trading name (empty means "Session Hire"),
   registered name, CRO number (digits only), VAT number, registered office, the address it trades from, and the
   directors. The VAT number and the address moved here from Office details, which keeps only what freelancers' pages
   show (name, phone and email). Under the form, the foot of a quote as it will print, and what's not given yet.
2. **One change, `company.details`**, sets them all at once; an empty field is not said. They live on the office's
   settings row. `office.update` still takes the VAT number and address, so an older app's change keeps working.
3. **The foot of every quote**, on the page and in the PDF, adds one line (two at most in the PDF, which leaves room for
   them only when there is something to say): "Session Hire is a trading name of Session Hire Productions Limited,
   registered in Ireland, number 612345. Registered office: …. Directors: …." What isn't set is left out.
4. **The trading name** replaces the "Session Hire" written into the sheet and the PDF: the name in place of a logo, the
   logo's alternative text, the PDF's author, and the first line of the foot.

## Consequences

- An invoice, when invoicing is built, should carry the same lines and the client's VAT number when reverse charge
  applies; the card already holds what it needs from the company's side.
- The quote email's own wording is unchanged.
