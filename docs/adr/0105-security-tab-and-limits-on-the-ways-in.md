# ADR 0105: What the Security tab found, and limits on the ways in

- **Status:** accepted
- **Date:** 1 November 2026
- **Asked for by:** Colly ("Can you review the security tab and find any
  changes you can implement?", 1 November 2026).
- **Builds on:** [ADR 0052](0052-google-only-for-staff.md) (Google the only
  way in for staff), [ADR 0098](0098-claude-drafts-quotes-from-the-mailbox.md)
  (the operations mailbox), [ADR 0029](0029-documents.md) (the
  server's own limits on slow and large requests).

## Context

GitHub's code scanning (CodeQL) and its dependency alerts list what they
think could be wrong. The open ones that could be seen from a pull request
fell into five kinds:

1. **No limit on how often the ways in can be knocked at.** Signing in with
   Google, the passcode, and connecting a calendar or the operations mailbox
   each start or finish a sign-in with Google, and nothing stopped one address
   asking a thousand times a minute.
2. **HTML taken apart with patterns.** A job sheet Google keeps as HTML and the
   AA's survey page had their tags taken out by patterns, which can't be got
   right: taking out "<script>" from "<scr<script>ipt>" leaves one behind. The
   text is only ever shown as text, so nothing could run, but a job sheet with
   a character number past the last one there is ("&#99999999;") stopped a
   calendar bring-in with an error.
3. **A change from the server written into the device's copy by its name.**
   "\_\_proto\_\_" was already refused; "constructor" and "prototype" weren't.
4. **Patterns that slow down on long input.** A few patterns (a quantity's
   "pcs", a price's "€", a header's brackets, a job name's trailing dashes)
   tried every space or mark before giving up, so a long enough cell took
   seconds rather than a moment.
5. **The Blueprint page.** It loaded its markdown reader from a CDN without
   checking it was the file expected, and read its documents back out of the
   page as text before showing them as HTML.

The dependency alerts were in packages used to build the app, not to run it,
except glob (and minimatch under it), which the server's file serving and
error reporting bring in.

## Decision

- **Limits on the ways in only.** A route asks for a limit in its config;
  those that do are the three sign-in routes (60 a minute from one address)
  and the four that connect a calendar or the mailbox (20 a minute). The
  address is the one Railway's proxy saw, the last in x-forwarded-for, so
  writing another in front gets nowhere. Past the limit the answer is 429,
  "Too many tries from here just now. Wait a minute and try again.", in the
  words the app already shows for the passcode's own count. **Not** a limit on
  everything: every phone in the warehouse shares one address, and the sync
  (a push, then every other phone pulling) would meet it on a busy day. Those
  routes all need someone signed in already. Done with Fastify's own
  rate-limit plugin rather than our own counter, so code scanning sees it.
- **HTML is read tag by tag, in one place** (server/src/html-text.ts): what's
  outside a tag is text, style and script are skipped whole, comments too, a
  "<" that starts no tag is kept, and entities are decoded once, in one pass.
  The mailbox reader already worked this way; job sheets and the AA page now
  use the same reader.
- **The device's copy refuses "\_\_proto\_\_", "constructor" and "prototype"**
  as a table or a row, and makes a table it doesn't have only when it truly
  doesn't have one.
- **Patterns that run in a straight line**: the trailing word or sign is found
  and cut, and a header's brackets are matched without anything inside them
  that could be another bracket.
- **The Blueprint page** checks its markdown reader against the hash cdnjs
  publishes for it (a changed file is refused, and the documents show as plain
  text), carries its documents as a value in its own script, and builds the
  library's buttons as text.
- **glob is held at 14.0.3 or later** across the workspace (an npm override),
  which brings minimatch 11. What's left is in the offline worker's build
  (workbox-build, ejs, deepmerge): it runs on the build machine, never in the
  app, and the only fix offered is an old major version of the plugin.

## Consequences

- One address can't hammer sign-in or the connect pages; the office never
  meets a limit in normal use, and a whole morning's sign-ins from the
  warehouse are well under it.
- Code scanning's alerts for these close once main is scanned again. What it
  found before the first pull request scan can't be listed from here; any that
  remain open can be fixed the same way, or dismissed with a reason when they
  are about our own trusted text.
- Job sheets keep their bullets and lines as before; style and script in one
  are now left out rather than shown as text.
