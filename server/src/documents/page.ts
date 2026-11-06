import { CERTIFICATE_SOON_DAYS, dayLabel, daysBetween, DOCUMENT_KIND_LABELS, DOCUMENT_KINDS, documentRunsOut, fileLabel, FILE_TYPES, type Document, type Person } from '@sh/shared'
import { CSS, fieldError, flash, h, invalid, landing, type Flash } from '../crew/page.ts'

/**
 * "Your documents" on a freelancer's private link (ADR 0029): what the
 * office holds for them, each file to view, and plain forms to send a new
 * one or a renewal, which the office checks before it counts. No script:
 * a form with a file posts as multipart, and every value drawn goes
 * through the page's escaper.
 */

export interface LinkDocuments {
  person: Pick<Person, 'certificates'>
  list: readonly Document[]
  /** Whether the server can keep files; without, the page says to send them another way for now. */
  files: boolean
  base: string
  today: string
  flash?: Flash
}

/** What the file field takes: the types by name too, for phones that pick by them. */
const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', ...Object.values(FILE_TYPES).map((t) => `.${t.ext}`), '.jpeg'].join(',')

const fullDay = (d: string) => `${dayLabel(d)} ${d.slice(0, 4)}`

/** A refusal about one field of a form, the file or the day it runs out, to say under that field (UX sweep, 6 November 2026, move 5). */
interface Wrong {
  field: 'file' | 'expires'
  text: string
}

/** Whether a document's card has the form to send a new one: once the office has checked it, and where files can be kept. */
const renewable = (d: LinkDocuments, doc: Document) => d.files && !!doc.checkedAt

/**
 * A form to send a document: a new one, or a renewal of one of theirs. Each is on the page at once, so each field's id
 * starts with the form's own (`form`). How to send the file is a hint under its label, read with the field, and a
 * refusal of the file is said under it.
 */
function fileFields(action: string, form: string, inner: string, wrong: Wrong | undefined): string {
  const file = `${form}-file`
  const hint = `${file}-hint`
  const error = wrong?.field === 'file' ? `${file}-error` : undefined
  return `<form method="post" action="${h(action)}" enctype="multipart/form-data" class="add-away">
      ${inner}
      <div class="field"${landing(error)}><label for="${file}">The file</label>
        <small class="hint" id="${hint}">A PDF, or a photo of it (JPEG, PNG, WebP or HEIC), up to 10 MB. Sending it needs signal, and the office checks it.</small>
        <input type="file" id="${file}" name="file" accept="${ACCEPT}" required${error ? invalid(error, hint) : ` aria-describedby="${hint}"`}></div>
      ${error && wrong ? fieldError(error, wrong.text) : ''}
      <button class="yes">Send to the office</button>
    </form>`
}

/** The day it runs out, and a refusal of it said under it. */
function expiresField(label: string, form: string, today: string, wrong: Wrong | undefined): string {
  const error = wrong?.field === 'expires' ? `${form}-expires-error` : undefined
  return `<label${landing(error)}>${label} <input type="date" name="expires" min="${h(today)}"${error ? invalid(error) : ''}></label>${error && wrong ? fieldError(error, wrong.text) : ''}`
}

function card(d: LinkDocuments, doc: Document, wrong: Wrong | undefined): string {
  // A renewal turned down opens again under its card, with the message above, or under the field it's about.
  const reopen = d.flash?.section === 'documents' && !d.flash.ok && d.flash.offer === doc.id
  const runsOut = documentRunsOut(doc, d.person)
  const waiting = !doc.checkedAt
  const ran = runsOut !== null && runsOut < d.today
  const soon = runsOut !== null && !ran && daysBetween(d.today, runsOut) <= CERTIFICATE_SOON_DAYS
  const [tag, tone] = waiting ? ['With the office to check', 'accepted'] : ran ? ['Ran out', 'pulled-out'] : soon ? ['Runs out soon', 'accepted'] : ['', '']
  const when = runsOut === null ? 'No expiry' : `${ran ? 'Ran' : 'Runs'} out on ${fullDay(runsOut)}`
  const form = `renew-${h(doc.id)}`
  return `<article class="offer doc" id="doc-${h(doc.id)}">
    <header><h3>${h(doc.title)}</h3>${tag ? `<span class="tag ${tone}">${h(tag)}</span>` : ''}</header>
    <p class="small">${h([when, doc.file && fileLabel(doc.file)].filter(Boolean).join(' · '))}</p>
    ${doc.file ? `<a class="sheet-link" href="${h(`${d.base}/documents/${encodeURIComponent(doc.id)}`)}">View the file ›</a>` : ''}
    ${
      renewable(d, doc)
        ? `<details${reopen ? ' open' : ''}><summary>Send a new one</summary>
      ${fileFields(
        `${d.base}/documents`,
        form,
        `<input type="hidden" name="renews" value="${h(doc.id)}">
      ${expiresField('The new one runs out', form, d.today, wrong)}`,
        wrong
      )}
    </details>`
        : ''
    }
  </article>`
}

export function documentsSection(d: LinkDocuments): string {
  const mine = d.flash?.section === 'documents' ? d.flash : undefined
  // A refusal about the file or the day it runs out is said under that field of the form it came from: a renewal's, under
  // its card (o), or else a new one's. One about the whole form, or from a form that's no longer drawn, is said at the top.
  const wrong = mine && !mine.ok && (mine.field === 'file' || mine.field === 'expires') && d.files ? { field: mine.field, text: mine.text } : undefined
  const renewal = mine?.offer ? d.list.find((doc) => doc.id === mine.offer && renewable(d, doc)) : undefined
  const underField = wrong !== undefined && (!mine?.offer || renewal !== undefined)
  const inNew = underField && !mine?.offer ? wrong : undefined
  const send = d.files
    ? `<details class="send-doc"${mine && !mine.ok && !mine.offer ? ' open' : ''}><summary>${d.list.length ? 'Send something else' : 'Send a document'}</summary>
      ${fileFields(
        `${d.base}/documents`,
        'new-doc',
        `<label>What is it <select name="kind">${DOCUMENT_KINDS.map((k) => `<option value="${h(k)}">${h(DOCUMENT_KIND_LABELS[k])}</option>`).join('')}</select></label>
      <label>What it's called, if you like <input name="title" maxlength="100" placeholder="e.g. Public liability insurance"></label>
      ${expiresField('Runs out', 'new-doc', d.today, inNew)}`,
        inNew
      )}
    </details>`
    : `<p class="small">Sending documents here isn't switched on yet. For now, send a photo or a PDF of it to the office by WhatsApp or email.</p>`
  return `<section id="documents">
    <h2>Your documents</h2>
    ${mine && !underField ? flash(mine) : ''}
    ${d.list.length ? d.list.map((doc) => card(d, doc, underField && doc === renewal ? wrong : undefined)).join('') : '<p class="empty">None yet. Your insurance and certificate cards go here once the office has them.</p>'}
    ${send}
  </section>`
}

/** A file that can't be shown, in words, with the way back to their page. */
export function renderNoFile(base: string, text: string): string {
  return `<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Session Hire</title><style>${CSS}</style></head>
<body><main><header class="top"><span class="mark">SH</span><div><b>Session Hire</b></div></header>
<p class="flash bad">${h(text)}</p><a class="sheet-link" href="${h(base)}#documents">‹ Back to your page</a></main></body></html>`
}
