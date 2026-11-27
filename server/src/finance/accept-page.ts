import {
  NO_CHARGE,
  LOGO_SVG,
  ACCEPT_NAME_LENGTH,
  ACCEPT_REF_LENGTH,
  depositCents,
  letterDay,
  lineCents,
  lineDiscountCents,
  anyLineDiscount,
  linesByGroup,
  linesUnder,
  money,
  paymentTermsLine,
  pctWord,
  quoteNumberLabel,
  setCents,
  groupCents,
  spanLabel,
  hireWhen,
  VAT_LABELS,
  venueLabel,
  type OfficeDetails, dsText } from '@sh/shared'
import { CSS, fieldError, h, invalid, officeBlock } from '../crew/page.ts'
import type { Sheet } from './quote-pdf.ts'

/**
 * The client's link to a quote (ADR 0121), /q/<key>: the quote as it was
 * sent, and one job, to accept it, with their name typed and a tick. Plain
 * HTML with an ordinary form, as a freelancer's page is (ADR 0002), so it
 * opens from any email on any phone, and works with no script.
 */

/** Where the quote stands for the client, which says whether they can accept it here. */
export type Standing =
  /** With the client, prices holding, the office taking answers online: the form shows. */
  | 'open'
  /** Accepted, on this link or as the office heard it. */
  | 'accepted'
  | 'declined'
  /** A newer version has gone to the client since. */
  | 'replaced'
  /** Its prices have stopped holding. */
  | 'lapsed'
  /** Its job was cancelled or lost: there's nothing to say yes to. */
  | 'stopped'
  /** Never sent: a link nobody should have yet. */
  | 'draft'

export interface AcceptPage {
  sheet: Sheet
  standing: Standing
  base: string
  office: OfficeDetails | null
  /** What was typed, and what's wrong with it, after a post that couldn't be taken. */
  typed?: { name: string; agreed: boolean; ref?: string }
  wrong?: 'name' | 'agree' | 'gone'
}

const ERRORS = { name: 'Type your full name, as you would sign it.', agree: 'Tick the box to say you accept the quote and its terms.', gone: '' } as const

const page = (title: string, body: string) => `<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${h(title)}</title><style>${CSS}${QUOTE_CSS}</style></head><body><main>${body}</main></body></html>`

const QUOTE_CSS = `
.quote-lines{width:100%;border-collapse:collapse;font-size:${dsText.touch.body.size}px}.quote-lines th,.quote-lines td{padding:8px 0;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.quote-lines th{font-size:${dsText.touch.caption.size}px;color:var(--muted);font-weight:600}.quote-lines .n{text-align:right;white-space:nowrap;padding-left:12px}
.quote-lines small{display:block;color:var(--muted)}.quote-lines tr.group-total th{text-align:left;font-weight:400;color:var(--muted)}.quote-lines tr.group-total td{font-weight:700}.quote-lines tr.group th{padding-top:16px;text-transform:uppercase;letter-spacing:.06em}
.totals{display:grid;grid-template-columns:1fr auto;gap:4px 16px;margin:0}.totals dt{color:var(--muted)}.totals dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.totals .total{font-weight:700;font-size:${dsText.touch.title.size}px;color:var(--ink)}
.accept{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:12px;padding:16px}
.agree{display:flex;gap:12px;align-items:flex-start;font-size:${dsText.touch.body.size}px}.agree input{width:22px;height:22px;flex:none;margin-top:2px;accent-color:var(--accent)}
.lines-text{white-space:pre-line}`

/** The quote's lines as on the printed page: each line, a package's kit under it, by group. */
function lines(s: Sheet): string {
  // In the groups and order the printed page has (ADR 0128).
  const groups = linesByGroup(s.q.lines)
  const rows = groups.map(
    ({ group: g, lines: ls }) =>
      `<tr class="group"><th colspan="3" scope="rowgroup">${h(g)}</th></tr>` +
      ls
        .map((l) => {
          // Words only (ADR 0128): as written, across the row.
          if (l.words) return `<tr class="words"><td colspan="3">${h(l.what)}</td></tr>`
          const under = linesUnder(s.q.lines, l.id)
          const off = lineDiscountCents(l)
          // A line's own discount under its amount (Colly, 26 November 2026), as the printed quote has it in its own column.
          const amount =
            (l.included && !under.length ? NO_CHARGE : money(under.length ? setCents(l, s.q.lines) : lineCents(l))) +
            (off ? `<small>${pctWord(l.discountPct!)} off, −${money(off)}</small>` : '')
          // An LED screen (ADR 0207) says what it is, its panels and pixels, before the kit that makes it.
          const about = l.screen && l.includes ? `<small>${h(l.includes)}</small>` : ''
          const inIt = under.length ? `<small>With ${h(under.map((u) => `${u.qty} × ${u.what}`).join(', '))}</small>` : l.includes && !about ? `<small>${h(l.includes)}</small>` : ''
          return `<tr><td>${h(l.what)}${about}${inIt}</td><td class="n">${l.qty}</td><td class="n">${amount}</td></tr>`
        })
        .join('') +
      // Each department's subtotal at its end (Colly, 18 November 2026); with one group it's the quote's subtotal.
      (groups.length > 1 ? `<tr class="group-total"><th colspan="2" scope="row">${h(g)} subtotal</th><td class="n">${money(groupCents(ls, s.q.lines))}</td></tr>` : '')
  )
  return `<table class="quote-lines"><thead><tr><th scope="col">What</th><th scope="col" class="n">How many</th><th scope="col" class="n">Amount</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
}

function totals(s: Sheet): string {
  const t = s.totals
  const row = (dt: string, dd: string, cls = '') => `<dt${cls}>${dt}</dt><dd${cls}>${dd}</dd>`
  return `<dl class="totals">${t.discount > 0 ? row('Subtotal', money(t.subtotal)) + row(`${anyLineDiscount(s.q.lines) ? 'Overall discount' : 'Discount'}, ${pctWord(t.discountPct)}`, `−${money(t.discount)}`) : ''}${row('Before VAT', money(t.net))}${t.rates
    .map((r) => row(`VAT at ${VAT_LABELS[r.rate]}`, money(r.vat)))
    .join('')}${row('Total', money(t.gross), ' class="total"')}</dl>`
}

/** What the page says above the quote, for anything but open. */
function standingLine(d: AcceptPage, until: string): string {
  const q = d.sheet.q
  switch (d.standing) {
    case 'accepted': {
      const on = q.acceptedOnline
      const when = on ? new Date(on.at) : undefined
      const at = when ? ` on ${letterDay(when.toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' }))} at ${when.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Dublin' })}` : ''
      return `<p class="flash ok" role="status">${on ? `Accepted by ${h(on.name)}${at}${on.ref ? `, your reference ${h(on.ref)}` : ''}. Thank you: we'll be in touch to confirm the booking.` : 'This quote has been accepted. Thank you.'}</p>`
    }
    case 'stopped':
      return `<p class="flash warn">This job isn't going ahead. Get in touch if that's changed.</p>`
    case 'declined':
      return `<p class="flash warn">This quote was turned down. To go ahead after all, get in touch and we'll look at it again.</p>`
    case 'replaced':
      return `<p class="flash warn">There's a newer version of this quote. Use the link in the latest email, or get in touch.</p>`
    case 'lapsed':
      return `<p class="flash warn">The prices on this quote held until ${letterDay(until)}. Get in touch for an up-to-date quote.</p>`
    case 'draft':
      return `<p class="flash warn">This quote hasn't been sent yet.</p>`
    default:
      return ''
  }
}

/** The form: their name, a tick, one button. A refusal says what's missing under the field it's about, and keeps what was typed. */
function form(d: AcceptPage): string {
  const s = d.sheet
  const client = s.job.client?.name
  const wrong = d.wrong && d.wrong !== 'gone' ? d.wrong : undefined
  return `<section class="accept" aria-labelledby="accept-head"><h2 id="accept-head">Accept this quote</h2>
<form method="post" action="${h(d.base)}">
  <div class="field"><label for="name">Your full name</label>
    <input id="name" name="name" autocomplete="name" maxlength="${ACCEPT_NAME_LENGTH}" required value="${h(d.typed?.name ?? '')}"${wrong === 'name' ? `${invalid('name-error')} autofocus` : ''}>
    ${wrong === 'name' ? fieldError('name-error', ERRORS.name) : ''}</div>
  <div class="field"><label for="ref">Your PO number or reference <small>(optional)</small></label>
    <input id="ref" name="ref" autocomplete="off" maxlength="${ACCEPT_REF_LENGTH}" value="${h(d.typed?.ref ?? '')}" aria-describedby="ref-hint">
    <small id="ref-hint" class="small">If your accounts need one on the invoice.</small></div>
  <label class="agree"><input type="checkbox" name="agree" value="yes" required${d.typed?.agreed ? ' checked' : ''}${wrong === 'agree' ? invalid('agree-error') : ''}>
    <span>I accept this quote, ${money(s.totals.gross)} including VAT, and its terms${client ? `, for ${h(client)}` : ''}.</span></label>
  ${wrong === 'agree' ? fieldError('agree-error', ERRORS.agree) : ''}
  <button class="yes">Accept the quote</button>
</form>
<p class="small">We're told straight away. To change anything first, reply to the email instead.</p></section>`
}

export function renderAcceptPage(d: AcceptPage, until: string): string {
  const s = d.sheet
  const number = quoteNumberLabel(s.q)
  // A dry hire's days as its quote has them (ADR 0183), its times and where it's delivered.
  const hired = hireWhen(s.job, s.job.span).map((w) => `${w.label} ${w.text}`)
  const where = [...(hired.length ? hired : [s.job.span && spanLabel(s.job.span)]), s.job.venue && venueLabel(s.job.venue)].filter(Boolean).join(' · ')
  const terms = paymentTermsLine(s.job.client?.paymentTerms)
  const top = `<header class="top"><span class="mark">${LOGO_SVG}</span><div><b>Session Hire</b><h1>${h(s.job.name)}</h1><small>${h(number ? `Quote ${number}` : 'Quote')}${
    s.job.client ? ` · for ${h(s.job.client.name)}` : ''
  }</small></div></header>`
  // A version not yet sent has no client to show it to: whoever has its link sees that, and nothing of its lines or prices (ADR 0186).
  if (d.standing === 'draft') return page(number ? `Quote ${number}` : 'Quote', [top, standingLine(d, until), officeBlock(d.office)].join('\n'))
  const facts = `<dl class="facts">${where ? `<dt>When and where</dt><dd>${h(where)}</dd>` : ''}${s.q.sentOn ? `<dt>Sent</dt><dd>${letterDay(s.q.sentOn)}</dd>` : ''}${
    d.standing === 'open' ? `<dt>Prices hold until</dt><dd>${letterDay(until)}</dd>` : ''
  }</dl>`
  const deposit = s.q.depositPct ? `<p>A deposit of ${pctWord(s.q.depositPct)}, <b>${money(depositCents(s.totals.gross, s.q.depositPct))}</b>, confirms the booking.</p>` : ''
  const body = [
    top,
    d.wrong === 'gone' ? `<p class="flash bad" role="alert">That couldn't be taken: the quote changed while you were looking. Here it is as it stands.</p>` : '',
    standingLine(d, until),
    facts,
    `<section aria-label="The quote">${lines(s)}${totals(s)}</section>`,
    deposit,
    terms ? `<p>${h(terms)}</p>` : '',
    s.q.notes ? `<p class="lines-text">${h(s.q.notes)}</p>` : '',
    `<p><a class="button" href="${h(d.base)}/pdf">The quote as a PDF</a></p>`,
    s.quoting.terms.trim() ? `<details><summary>The terms</summary><p class="lines-text small">${h(s.quoting.terms.trim())}</p></details>` : '',
    d.standing === 'open' ? form(d) : '',
    officeBlock(d.office),
  ]
  const title = `${d.wrong && d.wrong !== 'gone' ? 'Error: ' : ''}${number ? `Quote ${number}` : 'Quote'}: ${s.job.name}`
  return page(title, body.filter(Boolean).join('\n'))
}

/** The link while the office isn't taking answers online, or one that isn't a quote's: nothing about any quote. */
export function renderAcceptClosed(office: OfficeDetails | null, known: boolean): string {
  const said = known
    ? "Quotes can't be accepted online just now. To accept this one, reply to the email it came with, or ring us."
    : "This link doesn't open a quote. It may have been copied wrongly: try the link in the email again, or get in touch."
  return page('Quote', `<header class="top"><span class="mark">${LOGO_SVG}</span><div><b>Session Hire</b><h1>Your quote</h1></div></header>
<p class="flash warn">${said}</p>${officeBlock(office)}`)
}
