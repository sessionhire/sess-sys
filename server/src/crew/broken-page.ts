import { LOGO_SVG, newId, type OfficeDetails } from '@sh/shared'
import { CSS, fieldError, flash, h, invalid, landing, officeBlock, REFUSED, titled } from './page.ts'

/**
 * Broken or missing kit, reported from a freelancer's private link,
 * /f/<token>/broken (audit, 5 November 2026, finding 75). Their role can
 * report a fault (ADR 0051), but they have no sign-in (ADR 0108), so
 * without this the ability was out of their reach: the person holding the
 * broken mic at the gig had to text someone. It lands on Repairs as any
 * report does, with their name on it. Plain forms, no script, like the
 * rest of their page.
 */

export interface BrokenPage {
  base: string
  office?: OfficeDetails | null
  /** A message after a post; a refusal about the number or the product is said under that field. */
  flash?: { ok: boolean; text: string; field?: 'number' | 'product' }
  /** What a refused report typed (rule 11), drawn back into the form. */
  kept?: URLSearchParams
}

export function renderBroken(d: BrokenPage): string {
  const k = d.kept
  const kind = k?.get('kind') === 'missing' ? 'missing' : 'damaged'
  const usable = k?.get('usable') === 'yes'
  // A refused report is drawn again with what was typed, and the page lands on what the refusal is about (rule 11).
  const wrong = (name: 'number' | 'product') => (d.flash && !d.flash.ok && d.flash.field === name ? `${name}-error` : undefined)
  const [number, product] = [wrong('number'), wrong('product')]
  return `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#ee3744">
<title>${titled('Session Hire: broken or missing kit', d.flash)}</title>
<style>${CSS}${BROKEN_CSS}</style>
</head>
<body>
<main>
  <header class="top"><span class="mark">${LOGO_SVG}</span><div><b>Session Hire</b><h1>Broken or missing kit</h1><small>Tell the warehouse, so it's checked before it goes out again.</small></div></header>
  ${officeBlock(d.office)}
  <a class="back" href="${h(d.base)}">‹ Your work</a>
  ${d.flash && !d.flash.field ? flash(d.flash) : ''}
  <section id="report">
    <form method="post" action="${h(d.base)}/broken#${REFUSED}">
      <input type="hidden" name="id" value="${h(k?.get('id') || newId())}">
      <label${landing(number)}>Its number, from the label <input name="number" autocomplete="off" placeholder="e.g. SH-001234"${number ? invalid(number) : ''} value="${h(k?.get('number'))}"></label>${number ? fieldError(number, d.flash!.text) : ''}
      <label${landing(product)}>Or, with no label, the product <input name="product" autocomplete="off" placeholder="e.g. Shure SM58"${product ? invalid(product) : ''} value="${h(k?.get('product'))}"></label>${product ? fieldError(product, d.flash!.text) : ''}
      <fieldset>
        <legend>What's wrong</legend>
        <label class="pick"><input type="radio" name="kind" value="damaged"${kind === 'damaged' ? ' checked' : ''}> It's damaged</label>
        <label class="pick"><input type="radio" name="kind" value="missing"${kind === 'missing' ? ' checked' : ''}> It's missing</label>
      </fieldset>
      <label class="pick"><input type="checkbox" name="usable" value="yes"${usable ? ' checked' : ''}> Damaged, but it still works</label>
      <label>What happened (optional) <textarea name="note" rows="3" maxlength="1500" placeholder="e.g. Crackles when the cable moves">${h(k?.get('note'))}</textarea></label>
      <button class="yes">Tell the warehouse</button>
    </form>
    <p class="small">Unless it still works, it's held back from jobs until the warehouse has looked at it.</p>
  </section>
  <footer>
    <span>Keep this link to yourself: anyone with it can report as you.</span>
  </footer>
</main>
</body>
</html>`
}

const BROKEN_CSS = `
.back{font-weight:600}
#report form{display:grid;gap:12px}
fieldset{border:1px solid var(--line);border-radius:12px;padding:8px 14px;margin:0;display:grid;gap:4px}
legend{font-weight:600;padding:0 4px}
.pick{display:flex;gap:10px;align-items:center;min-height:44px;font-weight:400}
.pick input{flex:none;width:20px;height:20px;accent-color:var(--accent)}
`
