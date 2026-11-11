# ADR 0148: Recent in search

- **Status:** accepted
- **Date:** 11 November 2026
- **Asked for by:** Colly ("Can we add a recent section to the global search?")
- **Builds on:** [ADR 0147](0147-search-as-a-command-palette.md) (search as a
  command palette)

## Context

Most lookups in the office are a return: the job you had open ten minutes ago,
the client you just rang, the van's flight case you scanned this morning. The
palette with nothing typed offered only the places to go, so getting back to a
record meant typing its name again.

## Decision

1. **Recent, with nothing typed, above Go to.** The last five jobs, clients,
   venues, people, products and pieces of kit whose pages were opened on this
   device, newest first, each with its kind's picture and its usual second
   line. Down then Enter goes back to the last one. Typing hides it and the
   results take over as before. This is the design system's rule for recents
   (behavioural.md, Availability Bias): their own short group at the top, so
   the rest of the list keeps its order.
2. **Anything opened counts**, not only what was chosen from the palette: a
   row on Home, a link, a tab of a job. A job counts once whichever tab was
   open.
3. **Kept by what it is, not what it's called.** Only the kind and id are
   stored (localStorage `sh.recent`, twelve kept), so a record shows its name
   as it is now, one that's gone drops out, and a role sees only what it's sent
   (ADR 0042). The one on the screen behind is left out: you're already there.
4. **This device only, forgotten on signing out**, with the rest of the
   company's data, so a shared or handed-back phone doesn't say what the last
   person looked at.

## Consequences

- Recent isn't shared between someone's phone and desk; doing that would mean
  storing what each person opens on the server, which isn't worth it for this.
- Quotes open on the job's Quote tab, so they show in Recent as their job.
