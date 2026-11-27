# ADR 0202: A cable's length beside its name

- **Status:** accepted
- **Date:** 26 November 2026
- **Asked for by:** Colly, 26 November 2026: "For cables in the product item page - can you show the length of the cable
  also? I'd rather people use the length input rather than type the length in the name, but they will put it in the
  name field if it's not visible."
- **Builds on:** [ADR 0106](0106-logo-length-and-colour-on-labels.md) (a cable's length, its colour and its labels).

## Context

ADR 0106 gave a product a length in metres for its cable labels, but the field sat under Stock code, size and weight,
after weight and power, as "Length, in m, for a cable", and the product's page didn't show it at all. So people typed
the length into the name ("XLR 10m", "10 m XLR", "XLR 10M"), as the new product form's own example ("XLR 10 m") asked
them to. The length then couldn't be read, sorted or coloured reliably, and the name had to carry it because names
were unique on their own: "XLR" 5 m long and "XLR" 10 m long couldn't both exist.

## Decision

1. **A cable's length is shown after its name everywhere it's shown**: the product's page heading, the stock list,
   pick lists (on the phone and printed), the job's kit, call sheets, item pages, racks, search, and the line a quote
   takes when a product is added (`nameWithLength`). A name that already says that length is left as it is, so nothing
   reads "XLR 10m 10 m".
2. **The product's page has a Length fact** under its other names for anything that's a cable by its name or category,
   or has a length: the length in bold, or Not given with **Give its length** right there. Where the name still holds
   the length, **Move 10 m out of the name** does it in one press.
3. **The forms ask for a cable's length right under its name** (Change details and New product), with a metre box. A
   length typed in the name is offered over: "The name says 10 m. Move 10 m to Length". The length field under size
   stays for anything else that has one. The New product example name is now "XLR", not "XLR 10 m".
4. **A name and a length together make a product.** "XLR" 5 m long and "XLR" 10 m long are two products; "XLR 10m"
   and "XLR" 10 m long are one (`productNameKey`: the name without its length, and the length from the field or else
   the name). The server checks this on create and on any change of name or length, and the database's unique index on
   names becomes one on the name and length together.
5. **Finding a product reads its length**: "xlr 10" finds the XLR 10 m long in Add kit, on quotes and in Kit in the
   notes, and Claude's lines match it the same way.
6. **A one-off tidy, Stock › Lengths in names** (Menu, for stock): every product whose name holds a length, with what it
   becomes ("Becomes XLR, 10 m long"). Cables start picked, other kit with a length in its name (truss, drape) starts
   unpicked; one whose Length already says something else, or that would then match another product, can't be picked
   and links to its page. Nothing changes until Move is pressed and confirmed; each product's change is its own
   `model.update`, in its history, and can be changed back with Change details.

## Consequences

- Lengths become data: cable labels' colours, sorting ("XLR 5 m" before "XLR 10 m") and searching work from the field.
- Server refusal messages that quote a product still use its stored name, so they say "XLR" without the length. Left
  for now; the screens around them show the length.
- Quotes already written keep the line text they had; only lines added from now on take the length from the field.
