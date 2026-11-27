# ADR 0203: Adding many products from photos

- **Status:** accepted
- **Date:** 27 November 2026
- **Asked for by:** Colly, 27 November 2026: "There is a lot of stock that is physically in the warehouse but not on the
  system yet. Current RMS looks like it only held some of the products. The next step we'll be performing is to put all
  these products on the system, initially without a count (which will be done as another step with the labelling).
  Could you prepare a section that is accessible to staff and freelancers that will make it straightforward, accurate
  and efficient to create lots of new products on the system. Is it possible to do image recognition to get a picture
  and find the item and fill in info that way? Or OCR to scan the name of the item from a photo, or from its product
  label to populate it", and "Ideally as many fields would be filled in automatically from this recognition/lookup".
  Asked how freelancers, who can't sign in, should reach it: "On their booking link".
- **Builds on:** [ADR 0096](0096-claude-inside-the-app.md) (Claude in the app: on only when set up and switched on, under a
  monthly limit, its uses counted), [ADR 0002](0002-crew-booking-links.md) and [ADR 0108](0108-the-purchase-list-on-a-freelancers-link.md) (a
  freelancer's private link and the pages drawn on it), [ADR 0195](0195-codes-that-say-what-something-is.md) (every product gets its number) and
  [ADR 0202](0202-a-cables-length-beside-its-name.md) (a cable's length in its own field, a name and a length making a
  product).

## Context

Hundreds of products are in the warehouse and not on the stock list; Current RMS held only some. New product asks for
a dozen fields typed by hand, is only open to the people who run the stock, and has no way to tell whether the thing
in your hand is already on the list under another name. The count and the labels come later, as their own step
([ADR 0175](0175-labelling-as-the-count-goes.md) to 0178), so this step is only about getting each kind of item onto the list once, correctly.

Reading the text off a label alone (OCR) gets a model number, but nothing else the list keeps: department, category,
weight, power, rack size, replacement value. A model that can see the item and its label and then search the web for
the maker's page can fill most of those in, and say how sure it is.

## Decision

1. **Stock › Add products** (`#stock/add`, in Stock's Views as "Add products" with a count of products waiting to be
   looked over) is a page built for doing many in a row on a phone. "Photograph an item" opens the camera; more than
   one photo can go at once (the item, its label, its serial plate, at most three). Photos are shrunk on the phone
   before they go. Each item is read in the background and waits in a line, "To check", so the person keeps
   photographing while Claude reads; one item is open at a time. Without a photo, typing what it is works the same.
2. **Claude reads it** (`POST /api/products/read`): the photos, anything typed, and the names, lengths and categories
   already on the list. It reads the maker and model off the photos, searches the web (at most three searches) for
   the maker's page, and answers in a fixed schema: name as the company writes it (maker then model, never a length,
   colour or quantity), other names crew use, department, category (one already in use where one fits), whether it's
   counted one by one or in bulk, whether it's a case, length, weight, power, rack mount and units, depth, a
   replacement value in euro, whether it needs a PAT test, which product on the list it already is, how sure it is,
   what it read and the pages it used, and another photo that would help. What comes back is read leniently: a number
   out of range is dropped, not refused, and only https links are kept. It's turned down, as every Claude ask is,
   unless Claude is set up and on and this month's limit isn't spent; each read is counted, web searches at a cent
   each on top of the tokens. With Claude off the page still works: the person types the name and fills the form in.
3. **A person checks it and adds it.** The form is the suggestion, editable, with what Claude read and its sources
   under "Suggested by Claude". Above it, **Already on the stock list?** lists up to four products it may be: the one
   Claude named, those found by name, by maker and model, and by a model number they share; a cable of another length
   is another product (ADR 0202), so it isn't offered. "It's this one" drops the item from the line without adding
   anything. A length typed into the name while the Length box is empty is refused with the name it should have, so
   the length is written once, in its own field. "Add a photo of its label" sends one more photo and reads it again,
   keeping anything the person already changed. The first photo goes on the product as its photo.
4. **Anyone can add, and stock looks it over.** A new ability, *products*, lets every role add one (`model.add`),
   staff crew and signed-in freelancers included; New product (`model.create`) stays stock's. A product added by
   someone who doesn't run the stock, or from a link, is marked **to check** (`models.to_check`): its page says so, and
   Add products lists them under "Added by others, to look over" with **Looks right** (`model.checked`) for those who
   run the stock. Someone who can only add puts a photo on their own new product, once, while it waits to be checked;
   changing or taking photos down stays stock's.
5. **Freelancers do it from their private link**, as Colly chose: the link's home page gets "Kit not on the stock
   list" with **Add products ›**, opening `/f/<link>/add`, two server-drawn pages in the link pages' look: photos (or
   what it is, typed) are read, then the same check form, the same "already on the list?" list, and the same refusals,
   with what was typed kept. A small script shrinks the photos on the phone, its hash in the page's policy; without
   it, the page says to type what it is. The photo is held in the server's memory for an hour, by the form's id, until
   the product is added; a restart forgets it and the product is added without one. Adding twice from one form adds
   once.

## Consequences

- One item costs a few cents: the photos and the list's names in, a short answer out, and up to three searches. The
  list's names are sent as a cached system prompt, so the second item onwards costs less. A long session may need
  Admin › Claude's monthly limit raised.
- Claude can be wrong, and says how sure it is; nothing goes on the list until a person presses Add product, and what
  freelancers and crew add waits for stock to look over. Products added this way have no count: the first stock count
  and labelling (ADR 0175–0178) give them their items.
- The line of items to check is kept while the app is open, not saved: closing the app loses what wasn't added yet,
  but not what was.
- Products are the warehouse's: what a link adds is recorded in History as added on Add products by that freelancer.

## Later: a laptop's webcam (1.240.0, PR #457)

A file field with `capture` opens the camera on a phone but only the files on a laptop, so on a laptop Add products
could only upload. Where the pointer is fine (a mouse or trackpad), the page is secure and a camera is listed, the
first card now offers **Use the webcam** beside **Upload photos**: the live picture (not mirrored, so a label reads
the right way round), **Take photo**, the photos of this item so far, each with ×, and **Look this item up**, which
sends up to three as one item, as picking several files does. The camera stays on for the next item; closing it with
photos taken starts them rather than losing them. An item being checked gets **Photograph its label**, which takes one
and closes. Phones keep the one button that opens the camera.

The freelancers' link page `/f/<link>/add` got the same in 1.241.0 (PR #458), at Colly's ask: its hashed script
offers **Use the webcam** on a laptop with a camera, takes up to three photos with thumbnails (data: images, which the
page's policy allows) each with ×, and sends them with any uploaded ones through the same shrinking. The camera's
picture is a MediaStream on the video, which the page's `default-src 'none'` doesn't stop.
