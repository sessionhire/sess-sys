# ADR 0126: The quote is the job's plan

- **Status:** accepted
- **Date:** 9 November 2026
- **Asked for by:** Colly, 9 November 2026 ("Work on all of these in order
  overnight", then "Go"), batch 2 of the
  [audit of the quote flow](../audit-quote-flow-2026-11-08.md): findings 4,
  8 and 9, and the first move of its from-scratch section.
- **Builds on:** [ADR 0014](0014-kit-on-jobs.md) (confirmed jobs hold kit,
  enquiries and quotes pencil it in), [ADR 0089](0089-availability-subhire-and-margin-on-quotes.md)
  (enough kit for a quote), [ADR 0102](0102-a-job-from-a-past-quote.md)
  (the Kit tab's "From the quote").

## Context

A quote was a list of priced lines beside the job's kit list and crew
calls, and three paths copied between them: New quote's suggestions, a past
job, and the Kit tab's "Add all". Kit added on the draft itself, the usual
way, stayed on the quote only. So another quote for the same days didn't
see it, two quotes could promise the last two of something, and a job
confirmed with an empty kit list held nothing until someone pressed "Add
all". Crew lines had no way at all onto the job's calls: they were typed
again. And every line added on the draft was charged for every day from
the job's first to its last, so a build on a Friday and a show the next
Friday charged eight days.

The audit's from-scratch section draws the end of this: one set of lines,
each kit line the job's kit and each crew line a call. That is a rebuild of
how quotes are stored. This ADR takes the steps that get the office the
gain now without changing what's stored.

## Decision

1. **The draft's kit is on the job's kit list while the job is pencilled
   in.** Each time the draft saves, whoever is writing it (if they may
   change kit) brings the kit list into line with it: what the quote wants
   that the list hasn't got goes on, noted "From the quote", for the whole
   job; where the list has more than the quote wants, only lines the quote
   put there come down. Kit the warehouse added or changed by hand, or put
   on for a phase, is never taken off. Confirming the job then holds it,
   because a confirmed job's kit is held (ADR 0014). After that the Kit
   tab's "From the quote" card stays as it was: only ever more, since the
   list is then the warehouse's.
2. **Other quotes see it.** Pencilled kit still isn't counted as taken
   (ADR 0014), so the picker says it beside what's free: "4 free · 2
   pencilled for other quotes". The check before a quote goes already
   counts pencilled kit ("short if the enquiries and quotes go ahead").
3. **The quote's crew become calls in one press.** The Crew tab shows "The
   quote has crew to ask for: 2 × Sound No.1" with Make the calls: one call
   a role, for the job's one phase or across its phases, with no rate and
   nobody offered. Next says "Make the calls from the quote". A call is
   only made by that press, not as the draft changes, because an open call
   is something crew can be offered and the job may not go ahead.
4. **A line's days are the days the job works.** A line added on a draft
   is charged for each day of the job's phases, counted once, not the gap
   between them. "Charge all kit for the same days" stays for the rest.

## Consequences

- Two quotes for the same days now see each other in the picker and in the
  check before it goes, and a confirmed job's kit list is already full.
- The kit list moves as the draft is typed. Lines are only added or taken
  down when the draft saves, a moment after typing stops, so it doesn't
  flicker line by line.
- Someone who sees money but may not change kit doesn't move the list; the
  Kit tab's card is still there for those who can.
- Nothing stored changes, and nothing is sent to anyone.

## Not done

- Kit lines on the quote for one phase only: the kit list is matched for
  the whole job. A phase's kit is still added on the Kit tab.
- Crew as calls from the moment they're quoted, open and then firm on
  confirming, as the from-scratch section would have it: left until the
  office sees the press used, and until calls can be pencilled the way kit
  is.
