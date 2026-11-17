# Working on sess-sys

## Design

This app follows the shared design system in
[legofsalmon/design-system](https://github.com/legofsalmon/design-system),
checked out beside this repository as `../design-system`. Before changing
anything a person sees or touches, read its `docs/designing.md` and answer its
questions, then the pages it points to: `principles.md` (who uses these tools
and where, the colour grammar, type, space and the behaviour rules),
`behavioural.md` (how crew behave while getting a job done), `nngroup.md`
(the usability research and the ten heuristics every change is checked
against), `navigation.md`, `states.md`, `components.md` and `motion.md`.

- **Write the reasoning down.** A PR that changes what a person sees or
  touches has a short **Design** section: the one job of the view, the
  behaviour it designs for with the effect named (Default Effect, Loss
  Aversion, Time Scarcity…), any departure from the system and why, and
  any problem the heuristic check rated 3 that it leaves open. A bug fix
  that changes no design says so.
- **Use the system's parts first.** Its roles rather than literal colours,
  and a shared component's states, keys and wording before drawing a new one.
- **Send back what you learn.** A gap in the system, a departure that was
  right, something crew did that the rules did not predict, or a meaning of
  this app's that another app now needs: add it to the design system's
  `docs/learnings.md` in a PR there, or list it under **Learnings** in this
  PR's Design section so it can be carried across.
- **What stays this app's own:** storage and wire names, layout and flow,
  content, and meanings only this app has.

sess-sys takes the system's colours, as an override, with the tokens that sit
beside them (washes, elevation, layers, motion durations) and the shared
icons. Since 30 October 2026 (Colly's call) it also takes the type (IBM Plex
and Archivo, bundled for offline, at the touch density's text styles:
`data-density="touch"`) and the space (every gap a `--ds-space-*` step, its
layout roles in `web/src/app.css` pointing at the system's `space.*` roles).
Its own layout, corners and components stay as they are; where the system
has a part (the combobox, toasts), sess-sys follows its keys and states in
its own look. The server-drawn pages crew and clients open from a link
(`server/src/crew/page.ts` and the pages that share its CSS) follow the
same type, space and roles as the app. Its brand red stays as "you" and
burnt orange as bad, by decision; everything else about colour follows the
grammar, including a brief green tick when the system confirms a person's
own action (design system 0.20.0).

## Changelog and version

Every PR that changes the app (anything under `server/`, `web/` or
`shared/`) adds an entry at the top of `shared/src/changelog.ts` and with it
bumps the version: the middle number for something new a person can use,
the last for a fix or a change that only makes it work better ([ADR
0071](docs/adr/0071-whats-changed-and-version-numbers.md)). Write it for the
office, in plain English with no code words, and give the PR number (fill it
in once the PR is open) and any ADR. Admin › What's changed shows it. If
another PR merges first with the same number, take the next one before
merging. Docs-only PRs don't get a version.
