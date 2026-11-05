# ADR 0110: Getting the data right

- **Status:** accepted
- **Date:** 5 November 2026
- **Asked for by:** Colly, 5 November 2026 ("Go for batch 3"), batch 3 of
  the [5 November audit](../audit-ux-2026-11-05.md#the-order-to-fix-things):
  findings 8, 10, 11, 13, 15, 23, 26, 39 and 43.
- **Amends:** [ADR 0017](0017-pick-lists-and-scanning-out-and-in.md) and
  [ADR 0072](0072-picking-on-the-phone.md) (Undo on a pick list),
  [ADR 0090](0090-timesheets-off-until-used.md) (the timesheets switch),
  [ADR 0055](0055-combining-people-brought-in-twice.md) (combining people),
  [ADR 0034](0034-roles-and-what-each-can-change.md) (giving a role).

## Context

The audit found places where the app quietly records something other than
what happened, or drops something without saying so:

- Undo after a scan or a count out was recorded as the kit coming back.
  A job that hadn't left showed kit back, and counted it as gone out
  (finding 8).
- Scanning out an item reported damaged but fit to go said nothing about
  the fault (finding 15).
- Bringing in a crew list again replaced a matched person's email with the
  file's, and threw the old one away (finding 10).
- Combining two people kept one phone number and dropped the other
  (finding 43).
- A refused role change or combine snapped back silently, and Not done
  called it "A change from an older version of the app" (finding 11).
  Forty-six kinds of change had no title there.
- Picking a role applied it at once, so one slip made someone a director
  (finding 39).
- Switching a quote line from Daily to Weekly kept the day's price as the
  week's (finding 23). A line with no price could be marked sent and
  printed to the client at €0.00 (finding 26).
- Turning timesheets on would ask every freelancer for a timesheet for
  every confirmed booking back to April (finding 13).

## Decision

**An Undo is its own record, not a movement the other way.**

- A movement can say which movement it `undoes`. Undo on a pick list now
  sends that, not a scan back or a count back.
- Neither half of an undo pair counts towards sent, back or counted. An
  item's place still comes from its latest scan, so an undone scan out
  leaves it where it was before.
- "Not going" for an item scanned out on this job undoes that scan.
- The history reads "Undid a scan of X on Job" and "Undid a count of
  N × M on Job".
- Movements recorded before this have no link and read as they always did.

**Scanning out an item that's damaged but fit to go says so.**

The answer is in the warn tone: "Reported damaged but fit to go: (the
note). Pick another if it matters for this job." Where to find it marks
the number "(damaged, fit to go)".

**An address the app knew someone by is kept.**

- When a crew list matches someone (by phone or name) and its email
  differs, the person takes the new email. The old one moves to their
  other addresses (`keepEmail`), so it still finds them and still lets
  them sign in.
- The import's card says "Email changes from X to Y; the old one still
  finds them".
- An office changing an email by hand is correcting it, so a mistyped
  address isn't kept.
- Combining two people with different phones keeps the other phone in the
  notes ("Also on …"), and the question before it says so.

**Every refused change says what it was, and a role is asked before it's
given.**

- Not done has a title for every kind of change. A test fails if a change
  that needs an ability has none.
- Giving someone Director, or taking it off yourself, asks first, in words
  that say what a director can do.
- The last director can't be changed on the device: it says to make
  someone else a director first. After a change, the page says
  "X is (role) now" where a screen reader hears it.

**A price says what it is a price of.**

- A quote line's price field says "€ a day", "€ a week" or "€ once".
- After the charge changes, the line asks "Was €X a day, now €X a week:
  change the price?" until the price is edited.
- Mark as sent and Send to the client ask first when a line has no price:
  "N lines have no price and will go to the client as €0.00". Price it
  first opens that line.

**Timesheets are asked for from the day they're turned on.**

- The timesheets setting keeps a day, `timesheets_from`:
  - Turning timesheets on sets it to today.
  - The office can move it back under Admin, "Ask for bookings from".
  - While timesheets stay on, the day stays as set.
  - A company already using them starts from the day the switch last
    changed.
- Only bookings that started on or after that day are asked for, on the
  freelancer's link and in the office's Not in yet.
- So are only bookings that ended in the last 60 days
  (`TIMESHEET_ASKED_DAYS`), as long as an approved one stays on the
  freelancer's page.
- The office can still put a timesheet in for any booking. A timesheet
  already sent stays wherever it was.
- The count at the top of a freelancer's page counts a booking from the
  evening (18:00) of its last day. A booking starting today isn't "to
  send" while they're on site, though the list still lets them send it.

## Consequences

- A pick list's sent, back and counted figures come out right for jobs
  where Undo was used after this ships. Earlier undo pairs still read as
  out and back.
- On live, turning timesheets on asks for nothing from before that day. A
  booking from before needs the office to move the day back or to put the
  timesheet in itself.
- A person matched again by a crew list can collect old addresses in their
  other addresses. Make main and the person page show them, as before.

## The heuristic check

- **1, visibility of status:** fixed for Undo, damaged-but-fit kit,
  replaced emails and role changes.
- **5, error prevention:** fixed for directors given by a slip, a week
  charged at a day's price, a €0.00 line sent, and a backlog of
  timesheets.
- **9, help people recognise and recover from errors:** every refused
  change now names itself.

None is left at 3.
