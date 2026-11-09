# ADR 0122: The logo goes Home, and each person chooses where the app opens

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026: "Can clicking the logo bring you
  back to home? And can each user's first load screen be set to be unique
  to them?"
- **Builds on:** [ADR 0033](0033-home-and-finding-your-way-around.md) (Home and its views),
  [ADR 0035](0035-the-menu-and-you.md) (You),
  [ADR 0041](0041-where-things-live.md) (addresses),
  [ADR 0052](0052-google-only-for-staff.md) (staff sign in with Google).

## Context

The company's mark and name sat top left on every screen and did nothing,
though almost every app and site sends its logo home, so people press it
and nothing happens. And everyone opened the app on Home, though some of
the office live in the planner or on Quotes and the warehouse in Stock:
their first move every morning was the same tap.

## Decision

1. **The mark and the name go Home** (`#home`) from every screen, on a
   phone and at a desk. The whole block top left (mark, name and the area
   under it) is one link, named "Session Hire: Home", with the hover,
   pressed and focus states drawn round the block. The words stay ink: it
   reads as the brand, not a link in a sentence. On a demo copy, where the
   line under the name is the way to choose whose eyes, it stays as it was.
2. **You has "Open the app on"**: Home, Jobs, Board, Planner, Quotes (for
   those who see money), Stock or Crew, each with a line saying what it is.
   Home is the default and is checked until someone picks another. It saves
   as it's picked, as dark or light does.
3. **The choice is kept with the person's account**, on the server
   (`users.start_screen`, `POST /api/me/start`), not on the device, so every
   phone and computer they sign in on opens there. `/api/me` returns it as
   the user's `start`. Anything not on the list, Home included, is stored as
   nothing. Only the person signed in can set their own, whatever their role.
4. **Only the opening load uses it**: the app's bare address, as the home
   screen icon, a bookmark of the app or typing its name opens. A link to a
   job, a shared planner week or `#home` itself lands where it points. The
   address is replaced rather than added, so Back doesn't stop on a Home the
   person never saw. The device has who they are from last time; on a new
   device it comes a moment later, and is followed if nothing has moved yet.
5. **The installed app's start address is `/`** (the manifest's
   `start_url`), so a phone opens the app's own address, and so the chosen
   screen, whatever page it was added to the home screen from.

## Consequences

- Home stays everyone's default, and its views (Company, Department, Me,
  ADR 0033) work as before, chosen per device.
- Without Google sign-in (a copy with sign-in off) there is nobody to keep a
  choice for, so You doesn't show it.
- A freelancer's link is a page of its own and is not affected.
