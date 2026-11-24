import { JOB_PHOTO_SIDE, JOB_PHOTO_THUMB_SIDE, LINK_PHOTOS_AT_ONCE, LOGO_SVG, newId, type OfficeDetails } from '@sh/shared'
import { dayLabel } from '@sh/shared'
import { CSS, flash, h, officeBlock, titled } from './page.ts'

/**
 * Photos of a job, put up from a freelancer's private link,
 * /f/<token>/photos/<booking> (user flows of 24 November 2026, gap 11;
 * Colly, 24 November 2026: "yes they should"). Freelancers are most of the
 * people at a show and have no sign-in (ADR 0108), so without this the
 * people holding the phones on site had no way to add to the job's Photos
 * (ADR 0182). Theirs go on the job with their name, for the office to take
 * down if one isn't wanted.
 *
 * The one page under a link whose form needs script: a phone's photo is 3
 * to 5 MB, and the job keeps each at half a megabyte with a small copy for
 * the grids, both made on the phone (ADR 0182), which the server has
 * nothing to make. The script makes the two copies of each photo chosen
 * and puts them in the form in place of the originals; the form is then
 * sent as any other on these pages, to this server. Until the script has
 * run the form stays hidden behind a line that says to send them to the
 * office instead.
 */

export interface PhotosPage {
  base: string
  /** The booking the photos are for. */
  offerId: string
  job: string
  /** The last day they can be added, or nothing when this booking can't take them (now). */
  until?: string
  today: string
  /** How many of theirs are on the job already. */
  mine: number
  /** Nowhere to keep them on this server. */
  off?: boolean
  office?: OfficeDetails | null
  flash?: { ok: boolean; text: string }
}

/**
 * Makes each chosen photo's two copies on the phone and sends the form with them. Let in by its hash (app.ts), so it
 * is kept exactly as it is here. The copies go in the hidden file field small one first, then the photo, for each.
 */
export const PHOTOS_SCRIPT = `
    (function () {
      var form = document.getElementById('add-photos')
      if (!form || !window.createImageBitmap || !window.DataTransfer || !window.File || !HTMLCanvasElement.prototype.toBlob) return
      var pick = document.getElementById('pick'), out = document.getElementById('copies'), said = document.getElementById('photo-status'), button = form.querySelector('button')
      try { new DataTransfer().items.add(new File([''], 'a.jpg')) } catch (e) { return }
      var most = ${LINK_PHOTOS_AT_ONCE}
      form.hidden = false
      document.getElementById('no-script').hidden = true
      var copy = function (bmp, side) {
        var scale = Math.min(1, side / Math.max(bmp.width, bmp.height))
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
        said.textContent = !n ? '' : n > most ? n + ' chosen. The first ' + most + ' go this time; send the rest after.' : n + (n === 1 ? ' photo' : ' photos') + ' chosen.'
      })
      form.addEventListener('submit', function (e) {
        e.preventDefault()
        var files = Array.prototype.slice.call(pick.files, 0, most)
        if (!files.length) { said.textContent = 'Choose the photos first.'; pick.focus(); return }
        button.disabled = true
        var ready = new DataTransfer(), at = 0, left = 0
        var finish = function () {
          var n = ready.files.length / 2
          if (!n) { said.textContent = "Those couldn't be opened as photos. Choose JPEG or PNG photos, or take one with the camera."; button.disabled = false; return }
          out.files = ready.files
          said.textContent = 'Sending ' + n + (n === 1 ? ' photo' : ' photos') + (left ? ' (' + left + " couldn't be opened)" : '') + '. Keep this page open.'
          form.submit()
        }
        var next = function () {
          if (at >= files.length) return finish()
          var file = files[at++]
          said.textContent = 'Getting photo ' + at + ' of ' + files.length + ' ready.'
          open(file).then(function (bmp) {
            return copy(bmp, ${JOB_PHOTO_THUMB_SIDE}).then(function (small) {
              return copy(bmp, ${JOB_PHOTO_SIDE}).then(function (whole) {
                ready.items.add(new File([small], 'small.jpg', { type: 'image/jpeg' }))
                ready.items.add(new File([whole], 'photo.jpg', { type: 'image/jpeg' }))
              })
            })
          }).catch(function () { left++ }).then(next)
        }
        next()
      })
    })()
    `

export function renderPhotos(d: PhotosPage): string {
  const open = !!d.until && !d.off
  return `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#ee3744">
<title>${titled(`Session Hire: photos of ${d.job}`, d.flash)}</title>
<style>${CSS}${PHOTOS_CSS}</style>
</head>
<body>
<main>
  <header class="top"><span class="mark">${LOGO_SVG}</span><div><b>Session Hire</b><h1>Photos of ${h(d.job)}</h1><small>What the job looked like, for us to look back on and show clients.</small></div></header>
  ${officeBlock(d.office)}
  <a class="back" href="${h(d.base)}">‹ Your work</a>
  ${d.flash ? flash(d.flash) : ''}
  <section id="photos">
    ${d.mine ? `<p id="mine">You've put ${d.mine === 1 ? '1 photo' : `${d.mine} photos`} on this job.</p>` : ''}
    ${
      open
        ? `<p id="no-script" class="small">This browser can't get photos ready to send from here. Send them to the office instead.</p>
    <form id="add-photos" method="post" enctype="multipart/form-data" action="${h(d.base)}/photos/${encodeURIComponent(d.offerId)}" hidden>
      <input type="hidden" name="id" value="${h(newId())}">
      <label>Choose photos <input id="pick" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
      <input id="copies" type="file" name="file" multiple hidden tabindex="-1" aria-hidden="true">
      <p id="photo-status" class="small" role="status"></p>
      <button class="yes">Add photos</button>
    </form>
    <p class="small">Up to ${LINK_PHOTOS_AT_ONCE} at a time, until ${h(dayLabel(d.until!, d.today))}. They go on the job with your name, for the office and crew to see. They're made smaller on your phone first, and where each was taken isn't sent. If one shouldn't be there, ask the office to take it down.</p>
    <script>${PHOTOS_SCRIPT}</script>`
        : `<p>${h(d.off ? PHOTOS_SAID.off.text : PHOTOS_SAID.closed.text)}</p>`
    }
  </section>
  <footer>
    <span>Keep this link to yourself: anyone with it can add photos as you.</span>
  </footer>
</main>
</body>
</html>`
}

/** What the page says after a send, by the code in its address. */
export const PHOTOS_SAID = {
  none: { ok: false, text: 'No photos came with that. Choose them and try again.' },
  'too-big': { ok: false, text: 'That was too much to send at once. Send fewer photos at a time.' },
  'not-photos': { ok: false, text: "Those weren't photos the job can keep. Choose JPEG or PNG photos, or take one with the camera." },
  'not-kept': { ok: false, text: "The photos couldn't be kept just now. Try again in a minute." },
  'try-again': { ok: false, text: "That didn't go through. Try again." },
  closed: { ok: false, text: "Photos can be added from a booking's first day until a week after its last. For anything else, send them to the office." },
  off: { ok: false, text: "Photos can't be kept here yet. Send them to the office instead." },
} as const
export type PhotosSaid = keyof typeof PHOTOS_SAID

/** The thanks after a send: how many went on, and how many of them didn't. */
export const photosSent = (added: number, left: number) => ({
  ok: added > 0,
  text: `${added === 1 ? '1 photo is' : `${added} photos are`} on the job.${left ? ` ${left === 1 ? "1 couldn't" : `${left} couldn't`} be kept: try ${left === 1 ? 'it' : 'them'} again.` : ' Thanks.'}`,
})

const PHOTOS_CSS = `
.back{font-weight:600}
#add-photos[hidden],#no-script[hidden]{display:none}
#add-photos:not([hidden]){display:grid;gap:12px}
#add-photos input[type=file]:not([hidden]){min-height:44px;width:100%}
#photo-status:empty{display:none}
`
