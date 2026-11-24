# ADR 0196: Documents on jobs, for the crew

- **Status:** accepted
- **Date:** 24 November 2026
- **Asked for by:** Colly, 24 November 2026: "Is there a way to add attachments/supporting docs to a job for the crew to
  see?" Then picked "Build all three": documents on a job, crew see them on their call sheet once they've said yes, and
  a venue's documents can be shown to crew too.
- **Builds on:** [ADR 0032](0032-venue-and-client-pages-and-their-documents.md) (documents on venues and clients),
  [ADR 0029](0029-documents.md) (files in the storage bucket), [ADR 0021](0021-call-sheets.md) (call sheets on a
  person's private link), [ADR 0062](0062-what-crew-and-freelancers-read-of-other-people.md) (what each role reads).

## Context

A job had no place for a stage plot, run sheet, rider or site plan. Crew only saw the job's, phase's and venue's notes
as text on their call sheet. Venues and clients already kept documents (ADR 0032), but only the office opened them, and
nothing reached a freelancer, who works through their private link rather than the app.

## Decision

1. **A job is a third owner of documents**, in the same `attachments` table, with the same file, link or both, and the
   same storage. Its kinds: stage plot, run sheet, rider, site plan, something else. The database still checks that
   each document is on exactly one venue, client or job. Combining jobs moves them with the rest.
2. **Each job's and venue's document says whether the crew can see it** (`crew`), ticked by default; untick for the
   office's eyes only. A client's never can: it can carry the prices agreed. Venues' documents already there were open
   to every role, so they start ticked.
3. **On the call sheet.** Everyone who can open a call sheet (who has said yes to a call, ADR 0021) sees a Documents
   section with the job's documents for the crew and then the venue's. A file opens through their own link,
   `/f/<token>/sheet/<call>/documents/<id>`, which serves it only while it is on that sheet as they'd see it now: one
   made office-only, a call they've left, or a job that has stopped is "not found". Someone only offered the call sees
   nothing, as they can't open the sheet. A link alone opens where it is shared.
4. **In the app, by role.** Staff crew and freelancers read only documents for the crew; one made office-only after it
   was sent is taken off their device. The office, directors and heads read every one, as before.
5. **Where.** The job's Documents card is the first card on its Show pack tab, the part of the job that is what the
   crew take to the show. The office's view of the call sheet lists what crew will see.

## Consequences

- Nothing new to set up: files use the bucket documents already use. With no bucket, links still work.
- The copy of the call sheet for a WhatsApp group names the documents and gives the links; files stay behind each
  person's own link.
- Not done: documents on a phase rather than the whole job, and documents in the Crewbox show pack.
