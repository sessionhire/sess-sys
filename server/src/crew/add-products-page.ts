import { CATEGORY_IDEAS, DEPARTMENT_LABELS, DEPARTMENTS, LOGO_SVG, MOST_PRODUCT_PHOTOS, newId, READ_PHOTO_SIDE, type OfficeDetails, type ProductDraft, type ProductReading } from '@sh/shared'
import { CSS, flash, h, landing, officeBlock, REFUSED, titled } from './page.ts'

/**
 * Add products from a private link, /f/<token>/add (ADR 0203; Colly, 27
 * November 2026, "On their booking link"): the same as Stock › Add
 * products in the app, for freelancers, who have no sign-in (ADR 0108).
 * Two pages: a photo of the item (and its label) or what it is typed,
 * then the form Claude filled in from them, with what's already on the
 * list that it might be, to check and add. What they add waits for the
 * office to look over, with their name on it in the history.
 *
 * The photo form needs script, as the job photos' does (photos-page.ts):
 * a phone's photo is several megabytes, and the script makes it small on
 * the phone first. Without script the photo form stays hidden and typing
 * what it is still works.
 */

export interface AddStart {
  base: string
  /** Claude can read photos now; otherwise why not. */
  reads: boolean
  why?: string
  office?: OfficeDetails | null
  flash?: { ok: boolean; text: string }
  /** What they added from this page this visit, by name, newest first. */
  added?: { name: string; already: boolean }[]
}

export interface AddCheck {
  base: string
  /** The form's own id, so adding it twice adds it once; the photo kept for it waits under the same. */
  id: string
  hasPhoto: boolean
  draft: ProductDraft
  reading?: ProductReading
  /** Why it couldn't be read, when it couldn't. */
  unread?: string
  alike: { id: string; name: string; what: string }[]
  categories: readonly string[]
  office?: OfficeDetails | null
  flash?: { ok: boolean; text: string }
}

const head = (title: string, f?: { ok: boolean }) => `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#ee3744">
<title>${titled(title, f)}</title>
<style>${CSS}${ADD_CSS}</style>
</head>
<body>
<main>
  <header class="top"><span class="mark">${LOGO_SVG}</span><div><b>Session Hire</b><h1>Add products</h1><small>Kit in the warehouse that isn't on the stock list yet.</small></div></header>`

const foot = `
  <footer>
    <span>Keep this link to yourself: anyone with it can add products as you.</span>
  </footer>
</main>
</body>
</html>`

/**
 * Makes the chosen photos small on the phone and sends the form with them in place of the originals. Let in by its hash
 * (app.ts), so it is kept exactly as it is here.
 */
export const ADD_PHOTOS_SCRIPT = `
    (function () {
      var form = document.getElementById('add-item')
      if (!form || !window.createImageBitmap || !window.DataTransfer || !window.File || !HTMLCanvasElement.prototype.toBlob) return
      var pick = document.getElementById('pick'), out = document.getElementById('copies'), said = document.getElementById('photo-status'), button = form.querySelector('button')
      try { new DataTransfer().items.add(new File([''], 'a.jpg')) } catch (e) { return }
      form.hidden = false
      document.getElementById('no-script').hidden = true
      var copy = function (bmp) {
        var scale = Math.min(1, ${READ_PHOTO_SIDE} / Math.max(bmp.width, bmp.height))
        var canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bmp.width * scale))
        canvas.height = Math.max(1, Math.round(bmp.height * scale))
        canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
        return new Promise(function (done, fail) { canvas.toBlob(function (b) { b ? done(b) : fail() }, 'image/jpeg', 0.85) })
      }
      var open = function (file) {
        return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file) })
      }
      pick.addEventListener('change', function () {
        var n = pick.files.length
        said.textContent = !n ? '' : n > ${MOST_PRODUCT_PHOTOS} ? 'The first ${MOST_PRODUCT_PHOTOS} go.' : n + (n === 1 ? ' photo' : ' photos') + ' chosen.'
      })
      form.addEventListener('submit', function (e) {
        e.preventDefault()
        var files = Array.prototype.slice.call(pick.files, 0, ${MOST_PRODUCT_PHOTOS})
        var typed = form.querySelector('[name=typed]').value.trim()
        if (!files.length && typed.length < 2) { said.textContent = 'Take a photo of it, or type what it is.'; pick.focus(); return }
        button.disabled = true
        var ready = new DataTransfer(), at = 0
        var finish = function () {
          out.files = ready.files
          said.textContent = 'Claude is reading it and looking it up. This takes up to a minute: keep this page open.'
          form.submit()
        }
        var next = function () {
          if (at >= files.length) return finish()
          var file = files[at++]
          said.textContent = 'Getting photo ' + at + ' of ' + files.length + ' ready.'
          open(file).then(copy).then(function (b) { ready.items.add(new File([b], 'photo.jpg', { type: 'image/jpeg' })) }).catch(function () {}).then(next)
        }
        next()
      })
    })()
    `

export function renderAddStart(d: AddStart): string {
  return `${head('Session Hire: add products', d.flash)}
  ${officeBlock(d.office)}
  <a class="back" href="${h(d.base)}">‹ Your work</a>
  ${d.flash ? flash(d.flash) : ''}
  <section id="add">
    <h2>An item at a time</h2>
    <p>A photo of it, and of its maker's label if it has one.${d.reads ? ' Claude reads it and looks it up, then you check what it found and add it.' : ''} Nothing is counted here: that's done with the labels, later.</p>
    ${d.reads ? '' : `<p class="small">Photos can't be read just now${d.why ? `: ${h(d.why)}` : '.'} Type what it is and fill it in yourself.</p>`}
    <p id="no-script" class="small">This browser can't get photos ready to send from here. Type what it is instead.</p>
    <form id="add-item" method="post" enctype="multipart/form-data" action="${h(d.base)}/add/read" hidden>
      <input type="hidden" name="id" value="${h(newId())}">
      <label>Photos of it <input id="pick" type="file" accept="image/*" capture="environment" multiple></label>
      <input id="copies" type="file" name="file" multiple hidden tabindex="-1" aria-hidden="true">
      <label>Or what it is <span class="small">(optional with a photo)</span> <input name="typed" maxlength="300" autocomplete="off" placeholder="e.g. Shure SM58"></label>
      <p id="photo-status" class="small" role="status"></p>
      <button class="yes">${d.reads ? 'Read it' : 'Next'}</button>
    </form>
    <form class="typed-only" method="post" action="${h(d.base)}/add/read">
      <input type="hidden" name="id" value="${h(newId())}">
      <label>No photo? Type what it is <input name="typed" maxlength="300" autocomplete="off" placeholder="e.g. Shure SM58, or what's printed on it" required minlength="2"></label>
      <button>${d.reads ? 'Look it up' : 'Fill it in'}</button>
    </form>
    <script>${ADD_PHOTOS_SCRIPT}</script>
  </section>
  ${
    d.added?.length
      ? `<section id="added"><h2>Just now</h2><ul>${d.added.map((a) => `<li>${h(a.name)}${a.already ? ' (already on the list)' : ''}</li>`).join('')}</ul></section>`
      : ''
  }
  ${foot}`
}

const value = (s: string) => ` value="${h(s)}"`

export function renderAddCheck(d: AddCheck): string {
  const f = d.draft
  const r = d.reading
  const sure = r ? (r.sure === 'sure' ? 'Claude is sure of this.' : r.sure === 'likely' ? 'Claude thinks this is likely: check it.' : 'This is Claude’s guess: check it closely.') : ''
  const refusal = d.flash && !d.flash.ok
  return `${head('Session Hire: check and add', d.flash)}
  ${officeBlock(d.office)}
  <a class="back" href="${h(d.base)}/add">‹ Another item</a>
  ${d.flash ? `<div${landing(refusal)}>${flash(d.flash)}</div>` : ''}
  ${d.unread ? `<p class="flash bad" role="alert">${h(d.unread)} Fill it in yourself, or go back and try again.</p>` : ''}
  ${
    r
      ? `<section class="by-claude"><p><b>Suggested by Claude.</b> ${h(sure)} ${h(r.said)}${r.photoToTake ? ` A photo of ${h(r.photoToTake)} would help.` : ''}</p>${
          r.sources.some((s) => s.url)
            ? `<ul>${r.sources
                .filter((s) => s.url)
                .map((s) => `<li><a href="${h(s.url)}" rel="noreferrer noopener" target="_blank">${h(s.title || new URL(s.url).hostname)}</a></li>`)
                .join('')}</ul>`
            : ''
        }</section>`
      : ''
  }
  ${
    d.alike.length
      ? `<section id="alike"><h2>Already on the stock list?</h2><p class="small">If it's one of these, it doesn't need adding again.</p><ul>${d.alike
          .map((a) => `<li><span><b>${h(a.name)}</b><small>${h(a.what)}</small></span><a class="sheet-link" href="${h(d.base)}/add?${new URLSearchParams({ m: 'already', p: a.id, k: d.id })}">It's this one</a></li>`)
          .join('')}</ul></section>`
      : ''
  }
  <section id="check">
    <h2>Check and add</h2>
    <form method="post" action="${h(d.base)}/add#${REFUSED}">
      <input type="hidden" name="id"${value(d.id)}>
      <label>Name <span class="small">Maker and model, such as Shure SM58. A cable's length goes in Length.</span><input name="name" required maxlength="200"${value(f.name)}></label>
      <label>Other names <span class="small">(optional) What crew call it, separated by commas.</span><input name="otherNames" maxlength="400"${value(f.otherNames)}></label>
      <label>Department <select name="department">${DEPARTMENTS.map((x) => `<option value="${x}"${x === f.department ? ' selected' : ''}>${h(DEPARTMENT_LABELS[x])}</option>`).join('')}</select></label>
      <label>Category <input name="category" list="categories" maxlength="100"${value(f.category)}></label>
      <datalist id="categories">${[...new Set([...d.categories, ...CATEGORY_IDEAS])].map((c) => `<option value="${h(c)}">`).join('')}</datalist>
      <fieldset>
        <legend>How it's kept track of</legend>
        <label class="pick"><input type="radio" name="tracking" value="serialised"${f.tracking === 'serialised' ? ' checked' : ''}> Numbered: each one gets its own label</label>
        <label class="pick"><input type="radio" name="tracking" value="bulk"${f.tracking === 'bulk' ? ' checked' : ''}> Counted: cables, clamps, adaptors</label>
        <label class="pick"><input type="checkbox" name="isCase" value="yes"${f.isCase ? ' checked' : ''}> Holds other kit: a road case, bag or cable trunk</label>
      </fieldset>
      <label>Length, in metres <span class="small">(cables)</span><input name="length" inputmode="decimal"${value(f.length)}></label>
      <label>Value of one, in euro <span class="small">(optional)</span><input name="value" inputmode="decimal"${value(f.value)}></label>
      <label>Weight, in kg <span class="small">(optional)</span><input name="weight" inputmode="decimal"${value(f.weight)}></label>
      <label>Power, in watts <span class="small">(optional)</span><input name="power" inputmode="numeric"${value(f.power)}></label>
      <label class="pick"><input type="checkbox" name="rackMount" value="yes"${f.rackMount ? ' checked' : ''}> Goes on a rack's rails</label>
      <label>Rack units high <span class="small">(rack kit)</span><input name="units" inputmode="numeric"${value(f.units)}></label>
      <label>Depth, in mm <span class="small">(rack kit)</span><input name="depth" inputmode="numeric"${value(f.depth)}></label>
      <label class="pick"><input type="checkbox" name="pat" value="yes"${f.pat ? ' checked' : ''}> Runs off the mains, so it's PAT tested every year</label>
      <label>Notes <span class="small">(optional)</span><textarea name="notes" rows="2" maxlength="2000">${h(f.notes)}</textarea></label>
      <button class="yes">Add product</button>
    </form>
    <p class="small">${d.hasPhoto ? 'Its photo goes on it too. ' : ''}The office looks over what's added here.</p>
  </section>
  ${foot}`
}

const ADD_CSS = `
.back{font-weight:600}
#add-item[hidden],#no-script[hidden]{display:none}
#add-item:not([hidden]),.typed-only,#check form{display:grid;gap:12px}
.typed-only{margin-top:16px}
#add-item input[type=file]:not([hidden]){min-height:44px;width:100%}
#photo-status:empty{display:none}
fieldset{border:1px solid var(--line);border-radius:12px;padding:8px 16px;margin:0;display:grid;gap:4px}
legend{font-weight:600;padding:0 4px}
.pick{display:flex;gap:12px;align-items:center;min-height:44px;font-weight:400}
.pick input{flex:none;width:20px;height:20px;accent-color:var(--accent)}
.by-claude{font-size:.9em;color:var(--muted)}
.by-claude a{overflow-wrap:anywhere}
#alike ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}
#alike li{display:flex;gap:12px;align-items:center;justify-content:space-between}
#alike li span{display:grid;min-width:0}
`
