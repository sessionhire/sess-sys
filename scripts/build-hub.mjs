// Builds the Session Hire Blueprint page from docs/hub/template.html and the
// markdown files in docs/. Run: node scripts/build-hub.mjs [fragment-out-path]
//
// Writes docs/hub/index.html (a complete page you can open in a browser).
// With an argument, also writes the bare fragment there (used to publish the
// page as a claude.ai Artifact, which supplies its own <html>/<head>).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = [
  ['Build progress', 'docs/progress.md'],
  ['Who uses it, and how', 'docs/personas.md'],
  ['Where things live', 'docs/information-architecture.md'],
  ['User flows, 13 November 2026: every route through a job', 'docs/user-flows-2026-11-13.md'],
  ['Audit, 12 November 2026: crew offers, from the office to the crew', 'docs/audit-crew-offers-2026-11-12.md'],
  ['Audit, 8 November 2026: the quote flow, as the office fills it in', 'docs/audit-quote-flow-2026-11-08.md'],
  ['UX cohesion sweep, 6 November 2026: one app, one journey, every role', 'docs/ux-sweep-2026-11-06.md'],
  ['Audit, 5 November 2026: every flow, by role', 'docs/audit-ux-2026-11-05.md'],
  ['Audit, 20 October 2026: real size, by role', 'docs/audit-2026-10-20.md'],
  ['Audit, 18 October 2026: from reliability to the screens', 'docs/audit-2026-10-18.md'],
  ['Audit, 16 October 2026: the real data', 'docs/audit-2026-10-16.md'],
  ['Audit, 30 September 2026', 'docs/audit-2026-09-30.md'],
  ['Phone field test', 'docs/field-test.md'],
  ['Switching on sign-in and Google Calendar', 'docs/sign-in-setup.md'],
  ['Switching on offers over WhatsApp', 'docs/whatsapp-setup.md'],
  ['Design system', 'docs/design-system.md'],
  ['Backups', 'docs/backups.md'],
  ['Error alerts', 'docs/monitoring.md'],
  ['Architecture', 'docs/architecture.md'],
  ['Roadmap', 'docs/roadmap.md'],
  ['Bringing in the crew list', 'docs/research/crew-import.md'],
  ['Quoting: faster, easier, more reliable', 'docs/research/quoting.md'],
  ['Starter packages from past quotes', 'docs/research/package-starter-list.md'],
  ['Native iPhone and Android apps', 'docs/research/native-apps.md'],
  ['Job offers over WhatsApp', 'docs/research/whatsapp-offers.md'],
  ['Stock tracking', 'docs/research/stock-tracking.md'],
  ['Label printers and where to buy them', 'docs/research/label-printers.md'],
  ['Rentdeck, set beside the app', 'docs/research/competitor-rentdeck.md'],
  ['Competitor audit', 'docs/research/competitor-audit.md'],
  ['How booking works today', 'docs/research/current-process.md'],
  ['Crewbox handoff', 'docs/research/crewbox-handoff.md'],
  ['The Crewbox show pack', 'docs/crewbox-show-pack.md'],
  // Every decision record, in order, titled from its first heading.
  ...readdirSync(join(root, 'docs/adr'))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const md = readFileSync(join(root, 'docs/adr', f), 'utf8')
      const title = (md.match(/^# (.+)$/m)?.[1] ?? f).replace(/^ADR (\d+):\s*/, 'Decision $1: ')
      return [title, `docs/adr/${f}`]
    }),
];

const docs = DOCS.map(([title, path]) => ({ title, path, md: readFileSync(join(root, path), 'utf8') }));
const built = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
// A value in the page's own script, which the page never reads back out of itself as text (code scanning's "DOM text
// reinterpreted as HTML"). "<" is escaped so no document can close the <script> block early.
const json = JSON.stringify({ built, docs }).replace(/</g, '\\u003c');
const data = `<script>window.SH_DOCS = ${json};</script>`;

const template = readFileSync(join(root, 'docs/hub/template.html'), 'utf8');
if (!template.includes('<!--DOCS-DATA-->')) throw new Error('template is missing <!--DOCS-DATA-->');
// Inline images from docs/hub/img so the page stays a single file.
const fragment = template
  .replace('<!--DOCS-DATA-->', () => data)
  .replace(/src="img\/([\w.-]+\.(png|jpe?g|svg|webp))"/g, (_, file, ext) => {
    const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' }[ext];
    return `src="data:${type};base64,${readFileSync(join(root, 'docs/hub/img', file)).toString('base64')}"`;
  });

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head>
<body>
${fragment}
</body>
</html>
`;
writeFileSync(join(root, 'docs/hub/index.html'), page);
if (process.argv[2]) writeFileSync(process.argv[2], fragment);
console.log(`Built docs/hub/index.html with ${docs.length} documents (${built}).`);
