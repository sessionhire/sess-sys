import {
  JOB_PHOTO_CAPTION,
  JOB_PHOTO_SIDE,
  JOB_PHOTO_TAG,
  JOB_PHOTO_TAGS,
  JOB_PHOTO_THUMB_SIDE,
  JOB_PHOTOS_AT_ONCE,
  JOB_PHOTOS_WAIT,
  jobPhotoFileName,
  jobPhotoPath,
  jobPhotoWords,
  mayAddJobPhotos,
  mayRemoveJobPhoto,
  newId,
  spanLabel,
  STARTER_PHOTO_TAGS,
  tidyTag,
  tidyTags,
  type JobPhotoDetails,
  type JobPhotoView,
  type JobView,
} from '@sh/shared'
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { refusal, useDocumentStorage } from '../crew/Documents.tsx'
import { Empty } from '../Empty.tsx'
import { Fold } from '../Fold.tsx'
import { Heading, Icon } from '../Icon.tsx'
import { PillGroup } from '../ListTools.tsx'
import { shrinkPhoto } from '../photo-file.ts'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
import { useLate } from '../useLate.ts'
import { useToday, useView } from '../view.ts'

/**
 * Photos of a job (ADR 0182): what the show looked like, put up from a
 * phone several at a time and kept on the job as a library, to look back
 * on and to show the next client. Each is made smaller on the phone first
 * (about half a megabyte) with a small copy for the grid, and sent with
 * signal; its caption and tags change with none. Opened, a photo fills the
 * screen, steps to the next with the arrows or a swipe's buttons, and goes
 * to the phone's share sheet to send on to a client.
 */

const base = import.meta.env.VITE_API_BASE ?? ''

/** Where a photo is, whole or as its small copy. */
export const photoSrc = (p: Pick<JobPhotoView, 'id'>, size: 'thumb' | 'full') => `${base}${jobPhotoPath(p.id, size)}`

/** Its size once drawn, for the server to keep, so a grid has its shape before it loads. */
async function sizeOf(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob)
  try {
    return { width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

/** One photo made small, with its small copy, and sent as one: the small copy first, its length in the address. */
async function sendPhoto(details: JobPhotoDetails, file: File) {
  const full = await shrinkPhoto(file, { side: JOB_PHOTO_SIDE, square: false })
  const thumb = await shrinkPhoto(file, { side: JOB_PHOTO_THUMB_SIDE, square: false })
  const { width, height } = await sizeOf(full)
  const q = new URLSearchParams({
    client: client.clientId,
    jobId: details.jobId,
    caption: details.caption,
    tags: JSON.stringify(details.tags),
    thumb: String(thumb.size),
    width: String(width),
    height: String(height),
  })
  let res: Response
  try {
    res = await fetch(`${base}/api/job-photos/${encodeURIComponent(details.id)}?${q}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new Blob([thumb, full]),
      signal: AbortSignal.timeout(120_000),
    })
  } catch {
    throw new Error("Couldn't reach the server. Photos need signal to send: try again when you have it.")
  }
  if (!res.ok) throw await refusal(res)
}

const same = (a: string, b: string) => a.toLocaleLowerCase('en-IE') === b.toLocaleLowerCase('en-IE')

/** How many tags are offered as pills: the rest are typed, and the list stays short on a phone. */
const OFFERED = 20

/** The tags offered: those in use, the most used first, then the starters not yet in use. */
export function useTagChoices(): string[] {
  const tags = useView().jobPhotos.tags
  return useMemo(() => {
    const inUse = tags.map((t) => t.tag)
    return [...inUse, ...STARTER_PHOTO_TAGS.filter((s) => !inUse.some((t) => same(t, s)))].slice(0, OFFERED)
  }, [tags])
}

/**
 * Tags as pills pressed on and off, the ones in use first, with a field for
 * a new one: a phone's thumb presses a pill more easily than it types, and
 * the same few words keep one spelling.
 */
export function TagPicker({ value, onChange, label = 'Tags' }: { value: string[]; onChange: (tags: string[]) => void; label?: string }) {
  const choices = useTagChoices()
  const [typed, setTyped] = useState('')
  // The ones chosen that aren't offered (typed here) show too, so they can be taken off.
  const shown = [...choices, ...value.filter((v) => !choices.some((c) => same(c, v)))]
  const on = (t: string) => value.some((v) => same(v, t))
  const full = value.length >= JOB_PHOTO_TAGS
  const toggle = (t: string) => onChange(on(t) ? value.filter((v) => !same(v, t)) : tidyTags([...value, t]))
  const add = () => {
    const t = tidyTag(typed)
    if (!t) return
    if (!on(t)) onChange(tidyTags([...value, t]))
    setTyped('')
  }
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' && e.key !== ',') return
    if (!typed.trim()) return // An empty field lets Enter send the form.
    e.preventDefault()
    add()
  }
  return (
    <div className="photo-tags-field">
      <PillGroup label={label}>
        {shown.map((t) => (
          <button key={t} type="button" aria-pressed={on(t)} disabled={full && !on(t)} onClick={() => toggle(t)}>
            {t}
          </button>
        ))}
      </PillGroup>
      <div className="photo-tag-new">
        <label>
          <span className="sr-only">A new tag</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={key} onBlur={add} maxLength={JOB_PHOTO_TAG} placeholder="Another tag" disabled={full} enterKeyHint="done" />
        </label>
        <button type="button" onClick={add} disabled={!typed.trim() || full}>
          Add tag
        </button>
      </div>
      {full && <small>That's the most a photo can have: {JOB_PHOTO_TAGS}.</small>}
    </div>
  )
}

interface Upload {
  file: File
  error?: string
}

/**
 * Photos picked on the phone, sent one after another with what's said
 * about them. What didn't go stays, with why, to try again; leaving the
 * page while they're going asks first, as the rest would be lost.
 */
function AddPhotos({ job }: { job: JobView }) {
  const [tags, setTags] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [queue, setQueue] = useState<Upload[]>([])
  const [at, setAt] = useState<{ done: number; of: number } | undefined>()
  const [added, setAdded] = useState(0)
  const [error, setError] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  const sending = !!at
  const late = useLate(sending)

  useEffect(() => {
    if (!sending) return
    const stay = (e: BeforeUnloadEvent) => e.preventDefault()
    addEventListener('beforeunload', stay)
    return () => removeEventListener('beforeunload', stay)
  }, [sending])

  const send = async (files: File[]) => {
    if (picker.current) picker.current.value = ''
    if (!files.length || sending) return
    setError('')
    setAdded(0)
    const words = jobPhotoWords.safeParse({ id: 'x', caption, tags })
    if (!words.success) return setError(words.error.issues[0]?.message ?? 'Check the caption and tags.')
    const picked = files.slice(0, JOB_PHOTOS_AT_ONCE)
    const failed: Upload[] = []
    let done = 0
    setAt({ done: 0, of: picked.length })
    for (const file of picked) {
      try {
        await sendPhoto({ id: newId(), jobId: job.id, caption: words.data.caption, tags: words.data.tags }, file)
        done++
      } catch (err) {
        failed.push({ file, error: err instanceof Error ? err.message : String(err) })
      }
      setAt({ done: done + failed.length, of: picked.length })
    }
    setAt(undefined)
    setAdded(done)
    setQueue(failed)
    if (files.length > picked.length) setError(`Only ${JOB_PHOTOS_AT_ONCE} go at a time: add the other ${files.length - picked.length} next.`)
  }

  return (
    <div className="add-photos">
      {/* Folded, so the grid is near the top of a phone's screen; what's chosen shows on the fold's own line. */}
      <Fold label={tags.length || caption.trim() ? `Tags and caption: ${[...tags, caption.trim()].filter(Boolean).join(', ')}` : 'Tags and a caption for them'} className="photo-words-fold">
        <TagPicker value={tags} onChange={setTags} label="Tags for the photos you add" />
        <label className="field">
          Caption for them <small>(optional)</small>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={JOB_PHOTO_CAPTION} placeholder="Main stage at dusk" />
        </label>
      </Fold>
      <div className="actions">
        {/* The button is the file field's label, so it opens the phone's camera or photos as any file field does. */}
        <label className="button primary" aria-busy={sending || undefined} aria-disabled={sending || undefined}>
          <Icon name="camera" />
          {sending && late ? `Sending ${Math.min(at.done + 1, at.of)} of ${at.of}…` : 'Add photos'}
          <input ref={picker} type="file" accept="image/*" multiple className="sr-only" disabled={sending} onChange={(e) => void send([...(e.target.files ?? [])])} />
        </label>
        {queue.length > 0 && !sending && (
          <button type="button" onClick={() => void send(queue.map((u) => u.file))}>
            Try {queue.length === 1 ? 'it' : `the ${queue.length}`} again
          </button>
        )}
      </div>
      <small>Pick as many as you like from the phone, up to {JOB_PHOTOS_AT_ONCE} at a time. Each is made smaller before it goes, so it's quick on mobile data.</small>
      <div aria-live="polite">
        {sending && <p className="hint">Sending {at.of === 1 ? 'the photo' : `${at.of} photos`}: keep this page open until they're done.</p>}
        {!sending && added > 0 && <p className="added">Added {added === 1 ? 'the photo' : `${added} photos`}.</p>}
      </div>
      {queue.length > 0 && !sending && (
        <div className="refusal" role="alert">
          <p>{queue.length === 1 ? "This one didn't go:" : `These ${queue.length} didn't go:`}</p>
          <ul>
            {queue.map((u, i) => (
              <li key={i}>
                {u.file.name}: {u.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Refusal error={error} />
    </div>
  )
}

/** Photos as a grid of small copies, each opening the photo whole; the order is the show's. */
export function PhotoGrid({ photos, onOpen, label }: { photos: readonly JobPhotoView[]; onOpen: (id: string) => void; label: string }) {
  return (
    <ul className="photo-grid" aria-label={label}>
      {photos.map((p, i) => (
        <li key={p.id}>
          <button type="button" onClick={() => onOpen(p.id)} aria-label={`Open photo ${i + 1} of ${photos.length}${p.caption ? `: ${p.caption}` : ''}`}>
            <img src={photoSrc(p, 'thumb')} alt="" loading="lazy" decoding="async" width={p.width} height={p.height} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** The photo as a file, to send on: the phone's share sheet where there is one, else saved as a download. */
async function shareOrSave(p: JobPhotoView, jobName: string, n: number) {
  let res: Response
  try {
    res = await fetch(photoSrc(p, 'full'), { signal: AbortSignal.timeout(60_000) })
  } catch {
    throw new Error("Couldn't reach the server. Try again when you have signal.")
  }
  if (!res.ok) throw await refusal(res)
  const file = new File([await res.blob()], jobPhotoFileName(jobName, p, n), { type: 'image/jpeg' })
  const phone = matchMedia('(pointer: coarse)').matches
  if (phone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return
    } catch (err) {
      // Put away without choosing: nothing to say. Anything else saves it instead.
      if ((err as { name?: string }).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * One photo whole, over the page: what it says, the job it's from when
 * it's opened from the library, the photos either side, and what can be
 * done with it. Escape, or Close, puts it away.
 */
export function PhotoViewer({ photos, id, onPick, onClose, withJob = false }: { photos: readonly JobPhotoView[]; id: string; onPick: (id: string) => void; onClose: () => void; withJob?: boolean }) {
  const view = useView()
  const today = useToday()
  const access = useAccess()
  const ref = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [busy, setBusy] = useState(false)
  const late = useLate(busy)
  const { run, error } = useAct()
  const i = photos.findIndex((p) => p.id === id)
  const p = photos[i]
  const job = p && view.jobs.jobs.find((j) => j.id === p.jobId)
  const by = p?.addedBy ? view.crew.people.find((x) => x.id === p.addedBy)?.name : undefined

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  // Taken down here or on another device: the next one, else the dialog goes.
  useEffect(() => {
    if (!p) onClose()
  }, [p, onClose])
  useEffect(() => {
    setEditing(false)
    setRemoving(false)
  }, [id])
  if (!p) return null

  const step = (by: number) => {
    const next = photos[i + by]
    if (next) onPick(next.id)
  }
  const key = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (editing || (e.target as HTMLElement).closest('input, textarea')) return
    if (e.key === 'ArrowLeft') step(-1)
    if (e.key === 'ArrowRight') step(1)
  }
  const mayEdit = mayAddJobPhotos(access.role)
  const mayRemove = mayRemoveJobPhoto(access.role, access.personId, p)
  const jobName = job?.name ?? 'Job'

  return (
    <dialog className="photo-viewer" ref={ref} aria-label={`Photo ${i + 1} of ${photos.length}${p.caption ? `: ${p.caption}` : ''}`} onClose={onClose} onKeyDown={key}>
      <div className="photo-viewer-bar">
        <span>
          {i + 1} of {photos.length}
        </span>
        <button type="button" onClick={() => step(-1)} disabled={i <= 0} aria-label="The photo before">
          <Icon name="back" />
        </button>
        <button type="button" onClick={() => step(1)} disabled={i >= photos.length - 1} aria-label="The next photo">
          <Icon name="next" />
        </button>
        <button type="button" onClick={() => ref.current?.close()}>
          <Icon name="close" />
          Close
        </button>
      </div>
      <div className="photo-viewer-picture" style={{ backgroundImage: `url("${photoSrc(p, 'thumb')}")` }}>
        <img key={p.id} src={photoSrc(p, 'full')} alt={p.caption || `Photo ${i + 1} of ${jobName}`} width={p.width} height={p.height} />
      </div>
      <div className="photo-viewer-about">
        {p.caption && <p className="photo-caption">{p.caption}</p>}
        {p.tags.length > 0 && (
          <ul className="photo-tags" aria-label="Tags">
            {p.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        {withJob && job && (
          <p>
            <a href={`#jobs/${encodeURIComponent(job.id)}/photos`}>{job.name}</a>
            {[job.client?.name, job.venue?.name, job.span ? spanLabel(job.span, today) : undefined].filter(Boolean).map((s) => ` · ${s}`)}
          </p>
        )}
        <p className="hint">
          Put up{by ? ` by ${by}` : ''} on {new Date(p.addedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
          {p.pending && ', changes waiting to sync'}
        </p>
        {editing ? (
          <PhotoWords photo={p} onDone={() => setEditing(false)} />
        ) : removing ? (
          <Confirm
            question="Take this photo off the job? It's deleted from the app for everyone."
            yes="Take it off"
            loss
            onYes={() => {
              setRemoving(false)
              void run(() => client.mutate('jobPhoto.remove', { id: p.id }))
            }}
            onNo={() => setRemoving(false)}
          />
        ) : (
          <div className="actions">
            <button
              type="button"
              className="primary"
              aria-busy={busy || undefined}
              onClick={async () => {
                if (busy) return
                setBusy(true)
                await run(() => shareOrSave(p, jobName, i + 1))
                setBusy(false)
              }}
            >
              <Icon name="send" />
              {late ? 'Getting the photo…' : 'Share or save'}
            </button>
            {mayEdit && (
              <button type="button" onClick={() => setEditing(true)}>
                Change caption and tags
              </button>
            )}
            {mayRemove && (
              <button type="button" onClick={() => setRemoving(true)}>
                Take photo off
              </button>
            )}
          </div>
        )}
        <Refusal error={error} />
      </div>
    </dialog>
  )
}

/** A photo's caption and tags, changed; works with no signal, as any change does. */
function PhotoWords({ photo, onDone }: { photo: JobPhotoView; onDone: () => void }) {
  const [caption, setCaption] = useState(photo.caption)
  const [tags, setTags] = useState(photo.tags)
  const { run, error, refuse } = useAct()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = jobPhotoWords.safeParse({ id: photo.id, caption, tags })
    if (!parsed.success) return refuse(parsed.error.issues[0]?.message ?? 'Check the caption and tags.')
    if (await run(() => client.mutate('jobPhoto.save', parsed.data))) onDone()
  }
  return (
    <form className="photo-words" onSubmit={submit} aria-label="Change caption and tags">
      <label className="field">
        Caption
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={JOB_PHOTO_CAPTION} placeholder="What it shows" />
      </label>
      <TagPicker value={tags} onChange={setTags} />
      <Refusal error={error} />
      <div className="actions">
        <button type="submit" className="primary">
          Save
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** The job's Photos tab. */
export function JobPhotosCard({ job }: { job: JobView }) {
  const view = useView()
  const photos = view.jobPhotos.of(job.id)
  const storage = useDocumentStorage()
  const access = useAccess()
  const [open, setOpen] = useState<string>()
  const mayAdd = mayAddJobPhotos(access.role) && storage?.files !== false
  return (
    <section className="card job-photos" aria-label="Photos">
      <Heading icon="image">Photos</Heading>
      {mayAdd && <AddPhotos job={job} />}
      {storage?.files === false && mayAddJobPhotos(access.role) && <p className="hint">{JOB_PHOTOS_WAIT}</p>}
      {photos.length === 0 ? (
        <Empty>Photos of the show go here, to look back on and to show the next client what it looked like.</Empty>
      ) : (
        <PhotoGrid photos={photos} onOpen={setOpen} label={`Photos of ${job.name}`} />
      )}
      {photos.length > 0 && (
        <p className="hint">
          Every job's photos are under <a href="#jobs/photos">Jobs › Photos</a>, to find them by tag, client or venue.
        </p>
      )}
      {open && <PhotoViewer photos={photos} id={open} onPick={setOpen} onClose={() => setOpen(undefined)} />}
    </section>
  )
}
