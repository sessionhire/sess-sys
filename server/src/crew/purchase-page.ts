import { dayLabel, PURCHASE_DETAILS_LENGTH, PURCHASE_LINK_LENGTH, PURCHASE_OPEN, PURCHASE_SETTLED, PURCHASE_STATUS_LABELS, PURCHASE_TITLE_LENGTH, newId, type OfficeDetails } from '@sh/shared'
import type { PurchaseOnLink } from '../purchases/store.ts'
import { CSS, flash, h, officeBlock } from './page.ts'

/**
 * The purchase list on a freelancer's private link, /f/<token>/buy (ADR
 * 0108): the same list the app keeps under Stock › Purchase list (ADR
 * 0077), for the people the company books most, who have no sign-in. They
 * see what's been asked for and where each is at, ask for something, and
 * vote, one vote each, pressed again to take it back. Plain forms, no
 * script, like the rest of their page.
 */

export interface PurchasePage {
  requests: PurchaseOnLink[]
  base: string
  today: string
  office?: OfficeDetails | null
  /** A message after a post; `field` puts a refusal under the ask form rather than at the top. */
  flash?: { ok: boolean; text: string; field?: 'ask' }
  /** What a refused ask typed (rule 11), drawn back into the form. */
  kept?: URLSearchParams
}

const lines = (s: string) => h(s).replace(/\n/g, '<br>')

export function renderPurchases(d: PurchasePage): string {
  const open = d.requests.filter((r) => PURCHASE_OPEN.includes(r.status))
  const ordered = d.requests.filter((r) => r.status === 'ordered')
  const settled = d.requests.filter((r) => PURCHASE_SETTLED.includes(r.status))
  const k = d.kept
  const askRefused = d.flash && !d.flash.ok && d.flash.field === 'ask'
  return `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#ee3744">
<title>Session Hire: kit to buy</title>
<style>${CSS}${BUY_CSS}</style>
</head>
<body>
<main>
  <header class="top"><span class="mark">SH</span><div><b>Session Hire</b><h1>Kit to buy</h1><small>The purchase list, as the office and crew see it.</small></div></header>
  ${officeBlock(d.office)}
  <a class="back" href="${h(d.base)}">‹ Your work</a>
  ${d.flash && !askRefused ? flash(d.flash) : ''}

  <section id="ask">
    <details class="ask"${k || !d.requests.length ? ' open' : ''}>
      <summary><h2>Ask for something to be bought</h2></summary>
      <p class="small">Something you'd find useful on our jobs. The office decides what's bought, and you'll see where it's at here.</p>
      ${askRefused ? flash(d.flash!) : ''}
      <form method="post" action="${h(d.base)}/buy#ask">
        <input type="hidden" name="id" value="${h(k?.get('id') || newId())}">
        <label>What to buy <input name="title" required maxlength="${PURCHASE_TITLE_LENGTH}" placeholder="e.g. NL4T connectors" value="${h(k?.get('title'))}"></label>
        <label>How many, and details (optional) <textarea name="details" rows="3" maxlength="${PURCHASE_DETAILS_LENGTH}" placeholder="e.g. 20, for the amp racks">${h(k?.get('details'))}</textarea></label>
        <label>Link to it (optional) <input name="link" inputmode="url" maxlength="${PURCHASE_LINK_LENGTH}" placeholder="Copy it from the shop's page" value="${h(k?.get('link'))}"></label>
        <button class="yes">Ask for it</button>
      </form>
    </details>
  </section>

  <section id="asked">
    <h2>Asked for (${open.length})</h2>
    ${open.length ? `<p class="small">Most votes first. Vote for what you'd find useful; tap again to take your vote back.</p><ul class="buy">${open.map((r) => row(d, r)).join('')}</ul>` : '<p class="empty">Nothing waiting. Ask for something above.</p>'}
  </section>

  ${ordered.length ? `<section id="ordered"><h2>Ordered (${ordered.length})</h2><ul class="buy">${ordered.map((r) => row(d, r)).join('')}</ul></section>` : ''}

  ${settled.length ? `<section><details class="settled"><summary>Arrived or not buying (${settled.length})</summary><ul class="buy">${settled.map((r) => row(d, r)).join('')}</ul></details></section>` : ''}

  <footer>
    <span>Keep this link to yourself: anyone with it can ask and vote as you.</span>
  </footer>
</main>
</body>
</html>`
}

/** One request: the vote, while it's still to decide or to buy; what it is, who asked and when, and where it's at. */
function row(d: PurchasePage, r: PurchaseOnLink): string {
  const votes = `${r.votes} ${r.votes === 1 ? 'vote' : 'votes'}`
  const vote = PURCHASE_OPEN.includes(r.status)
    ? `<form method="post" action="${h(d.base)}/buy/${encodeURIComponent(r.id)}/vote#p-${h(r.id)}" class="vote">
        <input type="hidden" name="vote" value="${r.mine ? 'no' : 'yes'}">
        <button aria-pressed="${r.mine}" aria-label="Vote for ${h(r.title)}, ${h(votes)}${r.mine ? ', yours among them' : ''}"><b>${r.votes}</b><span>${r.mine ? 'Voted' : 'Vote'}</span></button>
      </form>`
    : `<span class="vote-count"><b>${r.votes}</b><span>${r.votes === 1 ? 'vote' : 'votes'}</span></span>`
  const link = r.link ? ` · <a href="${h(r.link)}" rel="noopener noreferrer" target="_blank">See it</a>` : ''
  return `<li id="p-${h(r.id)}">${vote}<div>
      <b>${h(r.title)}</b>${r.status === 'asked' ? '' : ` <span class="tag">${h(PURCHASE_STATUS_LABELS[r.status])}</span>`}
      ${r.details ? `<p>${lines(r.details)}</p>` : ''}
      <p class="meta">${h(r.askerName)}, ${h(dayLabel(r.askedOn, d.today))}${r.department ? ` · ${h(r.department)}` : ''}${link}</p>
      ${r.notes ? `<p class="notes">${lines(r.notes)}</p>` : ''}
    </div></li>`
}

const BUY_CSS = `
.back{font-weight:600}
.ask{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:4px 14px}.ask[open]{padding-bottom:14px}
.ask summary{padding:10px 0;list-style-position:inside}.ask summary h2{display:inline;margin:0}
.buy{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.buy li{display:flex;gap:12px;align-items:flex-start;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}
.buy li>div{flex:1;min-width:0;display:grid;gap:2px}
.buy p{margin:0;font-size:.92rem;overflow-wrap:anywhere}.buy .meta{color:var(--muted)}.buy .notes{padding:8px 10px;background:var(--bg);border-radius:8px}
.vote button,.vote-count{display:grid;justify-items:center;min-width:3.5rem;min-height:48px;padding:4px 8px;line-height:1.15}
.vote button b,.vote-count b{font-size:1.15rem;font-variant-numeric:tabular-nums}
.vote button span,.vote-count span{font-size:.8rem;font-weight:600;color:var(--muted)}
.vote button[aria-pressed=true]{border-color:var(--accent);color:var(--accent-ink)}.vote button[aria-pressed=true] span{color:var(--accent-ink)}
.vote-count{color:var(--muted)}
.buy .tag{justify-self:start}
.settled{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:0 12px}.settled[open]{padding-bottom:12px}
`
