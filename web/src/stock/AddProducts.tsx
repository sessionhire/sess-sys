import {
  addArgsOf,
  alikeProducts,
  blankDraft,
  CATEGORY_IDEAS,
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  draftOf,
  MOST_PRODUCT_PHOTOS,
  newId,
  productNameKey,
  PRODUCT_PHOTO_SIDE,
  READ_PHOTO_SIDE,
  type Department,
  type ModelView,
  type ProductDraft,
  type ProductRead,
  type ProductReading,
  type ProductReadStatus,
  type View,
} from '@sh/shared'
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { Heading, Icon } from '../Icon.tsx'
import { Top } from '../jobs/common.tsx'
import { getJson, postJson, useAsked } from '../jobs/rms.ts'
import { shrinkPhoto } from '../photo-file.ts'
import { productPhotoOf, Thumb } from '../Picture.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
import { StockViews } from '../Views.tsx'
import { TrackingChoice } from './common.tsx'
import { departmentIcon } from './kitIcon.ts'

/**
 * Stock › Add products (ADR 0203): many new products, quickly, by anyone.
 * Each item is photographed (and its maker's label, when it has one) and
 * joins a line of items; Claude reads each one and looks it up on the web
 * while the next is photographed, and the first one read opens for a person
 * to check: what it is, whether it's on the list already, and what Claude
 * found. Adding it gives it the photo too. Nothing is counted here: that's
 * the stocktake's, with the labels (ADRs 0175-0178).
 *
 * The line lives on this device while the app is open, so stepping to a
 * product's page and back keeps it; the photos never wait anywhere else.
 */

/** Long enough for Claude to read the photos and make a few searches. */
const READ_WAITS_MS = 150_000

type Status = 'reading' | 'ready' | 'failed' | 'by-hand'

interface Photo {
  /** What's shown on the device. */
  url: string
  /** Sent to be read: made small, as base64. */
  data: string
  /** The product's own photo, smaller again, for the first of an item's photos. */
  own: Blob
}

interface Item {
  key: string
  photos: Photo[]
  typed: string
  status: Status
  reading?: ProductReading
  cents?: number
  error?: string
  draft: ProductDraft
  /** The draft as it was last filled in (from what was typed, or by Claude), so what the person changed since is told apart. */
  base: ProductDraft
  /** Products already on the list it might be. */
  alike: string[]
}

interface Added {
  key: string
  id: string
  name: string
  /** Its photo, when it couldn't be sent with it, to try again. */
  photoLeft?: Blob
  photoProblem?: string
  /** It was on the list already, and this is the one. */
  already?: boolean
}

// --- The line of items, kept while the app is open ---------------------------------

let line: { items: Item[]; added: Added[]; open: string | null } = { items: [], added: [], open: null }
const listeners = new Set<() => void>()
const change = (next: Partial<typeof line>) => {
  line = { ...line, ...next }
  for (const l of listeners) l()
}
const update = (key: string, patch: Partial<Item>) => change({ items: line.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) })
const useLine = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => line
  )

const base64Of = (blob: Blob) =>
  new Promise<string>((done, fail) => {
    const r = new FileReader()
    r.onload = () => done(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => fail(new Error('That photo couldn’t be read on this phone. Take it again.'))
    r.readAsDataURL(blob)
  })

async function photoOf(file: File): Promise<Photo> {
  const read = await shrinkPhoto(file, { side: READ_PHOTO_SIDE, square: false })
  const own = await shrinkPhoto(file, { side: PRODUCT_PHOTO_SIDE, square: false })
  return { url: URL.createObjectURL(read), data: await base64Of(read), own }
}

/** Sends an item to be read, and fills in its form from what comes back, keeping anything typed into it meanwhile. */
async function read(key: string, view: View) {
  const item = line.items.find((i) => i.key === key)
  if (!item) return
  update(key, { status: 'reading', error: undefined })
  const l = await postJson<ProductRead>('/api/products/read', { photos: item.photos.map((p) => ({ type: 'image/jpeg', data: p.data })), typed: item.typed }, READ_WAITS_MS)
  const now = line.items.find((i) => i.key === key)
  if (!now) return
  if (l.state !== 'ready') {
    update(key, { status: 'failed', error: l.state === 'gone' ? l.error : 'Claude didn’t answer in time, or there’s no signal. Try again, or fill it in yourself.' })
    return
  }
  const r = l.data.reading
  const filled = draftOf(r, view.warehouse.categories)
  // What someone changed in the form while it was being read stays as they changed it.
  const base = now.base as unknown as Record<string, unknown>
  const typed = Object.fromEntries(Object.entries(now.draft).filter(([k, v]) => v !== base[k]))
  const alike = alikeProducts(view.warehouse.models, { name: r.name, maker: r.maker, model: r.model, sameAs: r.sameAs, lengthM: r.lengthM }).map((m) => m.id)
  update(key, { status: 'ready', reading: r, cents: l.data.cents, draft: { ...filled, ...typed }, base: filled, alike })
  if (!line.open) change({ open: key })
}

export function AddProductsScreen({ view }: { view: View }) {
  const access = useAccess()
  const { items, added, open } = useLine()
  const status = useAsked(true, 'product-read', () => getJson<ProductReadStatus>('/api/products/read'))
  const reads = status.state === 'ready' && status.data.ok
  const why = status.state === 'ready' ? status.data.why : status.state === 'gone' ? status.error : status.state === 'offline' ? 'Reading photos needs signal.' : undefined
  const [department, setDepartment] = useState<Department>('audio')
  const [typed, setTyped] = useState('')
  const [problem, setProblem] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  const start = async (files: File[], what = '') => {
    setProblem('')
    let photos: Photo[] = []
    try {
      photos = await Promise.all(files.slice(0, MOST_PRODUCT_PHOTOS).map(photoOf))
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That photo couldn’t be read on this phone. Take it again.')
      return
    }
    const key = newId()
    const item: Item = { key, photos, typed: what, status: reads ? 'reading' : 'by-hand', draft: { ...blankDraft(department), name: what }, base: { ...blankDraft(department), name: what }, alike: [] }
    change({ items: [...line.items, item], open: reads ? line.open : (line.open ?? key) })
    if (reads) void read(key, view)
  }

  const waiting = items.filter((i) => i.status === 'reading').length
  const toCheck = view.warehouse.models.filter((m) => m.toCheck && !m.mistake)

  return (
    <div className="app warehouse add-products">
      <Top view={view} title="Stock" views={<StockViews view={view} current="add" />} heading="Add products" />

      <section className="card">
        <Heading icon="camera">Photograph an item</Heading>
        <p>
          One item at a time: a photo of it, and of its maker's label if it has one. {reads ? 'Claude reads it and looks it up while you photograph the next.' : ''} Nothing
          is counted here: that's done with the labels, at the stocktake.
        </p>
        {!reads && why && <p className="hint">Photos can't be read just now: {why} You can still add products here, and fill them in yourself.</p>}
        <div className="add-photo">
          {/* The button is the file field's label, so it opens the phone's camera as any file field does. */}
          <label className="button primary">
            <Icon name="camera" />
            Photograph an item
            <input
              ref={picker}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                e.target.value = ''
                if (files.length) void start(files)
              }}
            />
          </label>
        </div>
        <form
          className="grid-form typed-item"
          onSubmit={(e) => {
            e.preventDefault()
            const what = typed.trim()
            if (what.length < 2) return setProblem('Type what it is: its maker and model, or what it says on it.')
            setTyped('')
            void start([], what)
          }}
        >
          <label className="wide">
            Or type what it is <span className="optional">(no photo to hand)</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. Shure SM58, or what's printed on it" maxLength={300} />
          </label>
          <label>
            Department, to start with
            <select value={department} onChange={(e) => setDepartment(e.target.value as Department)}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="wide">
            {reads ? 'Look it up' : 'Fill it in'}
          </button>
        </form>
        <Refusal error={problem} />
      </section>

      {items.length > 0 && (
        <section className="card">
          <h2>
            To check ({items.length})
          </h2>
          {waiting > 0 && <p className="hint">{waiting === 1 ? 'Claude is reading one.' : `Claude is reading ${waiting}.`} Carry on photographing: each opens here once it's read.</p>}
          <ul className="add-line">
            {items.map((i) => (
              <li key={i.key}>
                {open === i.key ? (
                  <CheckItem view={view} item={i} />
                ) : (
                  <button type="button" className="add-row" onClick={() => change({ open: i.key })} aria-expanded={false}>
                    <Thumb icon={departmentIcon(i.draft.department)} src={i.photos[0]?.url} />
                    <span>
                      <b>{i.draft.name || i.typed || 'An item'}</b>
                      <small>{i.status === 'reading' ? 'Being read…' : i.status === 'failed' ? 'Couldn’t be read: open it to try again' : 'Ready to check'}</small>
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {added.length > 0 && <AddedList view={view} added={added} />}

      {access.can('stock') && toCheck.length > 0 && <ToCheck models={toCheck} />}
    </div>
  )
}

/** One item, opened to check: its photos, what Claude made of it, what it might already be, and the form. */
function CheckItem({ view, item }: { view: View; item: Item }) {
  const w = view.warehouse
  const f = item.draft
  const set = (patch: Partial<ProductDraft>) => update(item.key, { draft: { ...f, ...patch } })
  const { run, error, refuse } = useAct()
  const more = useRef<HTMLInputElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const alike = item.alike.map((id) => w.models.find((m) => m.id === id)).filter((m): m is ModelView => !!m && !m.mistake)
  const r = item.reading
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  const next = (left: Item[]) => left.find((i) => i.status === 'ready')?.key ?? left.find((i) => i.status !== 'reading')?.key ?? null
  const done = (also?: Added) => {
    const left = line.items.filter((i) => i.key !== item.key)
    change({ items: left, added: also ? [also, ...line.added] : line.added, open: next(left) })
  }

  const addPhoto = async (files: File[]) => {
    try {
      const photos = await Promise.all(files.slice(0, MOST_PRODUCT_PHOTOS - item.photos.length).map(photoOf))
      update(item.key, { photos: [...item.photos, ...photos] })
      void read(item.key, view)
    } catch (err) {
      refuse(err instanceof Error ? err.message : 'That photo couldn’t be read on this phone. Take it again.')
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const id = newId()
    const made = addArgsOf(f, id)
    if (made.reason !== undefined) return refuse(made.reason)
    const { args } = made
    // A name and a length make a product (ADR 0202): "XLR" 10 m long is "XLR 10m".
    const taken = w.models.find((m) => !m.mistake && productNameKey(m) === productNameKey(args))
    if (taken) return refuse(`There's already a product called ${taken.name}${taken.lengthM ? ` (${taken.lengthM} m)` : ''}. Open it below if this is one.`)
    const ok = await run(() => client.mutate('model.add', args))
    if (!ok) return
    const added: Added = { key: item.key, id, name: args.name }
    done(added)
    const photo = item.photos[0]?.own
    if (photo) void sendPhoto(added, photo)
  }

  const sure = r ? (r.sure === 'sure' ? 'Claude is sure of this.' : r.sure === 'likely' ? 'Claude thinks this is likely: check it.' : 'This is Claude’s guess: check it closely.') : ''
  return (
    <div className="check-item" ref={top}>
      <div className="add-photos">
        {item.photos.map((p, n) => (
          <img key={n} src={p.url} alt={n === 0 ? 'The item' : 'Another photo of it'} />
        ))}
        {item.photos.length < MOST_PRODUCT_PHOTOS && (
          <label className="button">
            <Icon name="camera" />
            {item.photos.length ? 'Add a photo of its label' : 'Add a photo'}
            <input
              ref={more}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                e.target.value = ''
                if (files.length) void addPhoto(files)
              }}
            />
          </label>
        )}
      </div>

      {item.status === 'reading' && <p className="hint" role="status">Claude is reading this one and looking it up. You can fill it in meanwhile.</p>}
      {item.status === 'failed' && (
        <div className="alert" role="alert">
          <p>{item.error}</p>
          <button type="button" onClick={() => void read(item.key, view)}>
            Try again
          </button>
        </div>
      )}
      {r && (
        <div className="by-claude">
          <p>
            <b>Suggested by Claude.</b> {sure} {r.said}
            {r.photoToTake && <> A photo of {r.photoToTake} would help.</>}
          </p>
          {r.sources.some((s) => s.url) && (
            <ul className="sources">
              {r.sources
                .filter((s) => s.url)
                .map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer noopener">
                      {s.title || new URL(s.url).hostname} <Icon name="external" />
                    </a>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {alike.length > 0 && (
        <div className="alike" role="group" aria-label="Already on the stock list?">
          <h3>Already on the stock list?</h3>
          <p className="hint">If it's one of these, it doesn't need adding again.</p>
          <ul>
            {alike.map((m) => (
              <li key={m.id}>
                <Thumb icon={departmentIcon(m.department)} src={productPhotoOf(m)} />
                <span>
                  <a href={`#stock/product/${m.id}`}>
                    {m.name}
                    {m.lengthM ? ` (${m.lengthM} m)` : ''}
                  </a>
                  <small>
                    {DEPARTMENT_LABELS[m.department]}
                    {m.category ? `, ${m.category}` : ''}
                  </small>
                </span>
                <button type="button" onClick={() => done({ key: item.key, id: m.id, name: m.name, already: true })}>
                  It's this one
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="grid-form" onSubmit={(e) => void submit(e)}>
        <label className="wide">
          Name <span className="hint">Maker and model, such as Shure SM58. A cable's length goes in Length, not here.</span>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} required />
        </label>
        <label className="wide">
          Other names <span className="optional">(optional)</span>
          <span className="hint">What crew call it, separated by commas, such as 58.</span>
          <input value={f.otherNames} onChange={(e) => set({ otherNames: e.target.value })} />
        </label>
        <label>
          Department
          <select value={f.department} onChange={(e) => set({ department: e.target.value as Department })}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category <input list="add-category-names" value={f.category} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Microphones" />
        </label>
        <TrackingChoice tracking={f.tracking} isCase={f.isCase} onChange={(t) => set(t)} />
        <label>
          Length, in metres <span className="optional">(cables)</span>
          <input inputMode="decimal" value={f.length} onChange={(e) => set({ length: e.target.value })} />
        </label>
        <label>
          Value of one, in euro <span className="optional">(optional)</span>
          <input inputMode="decimal" value={f.value} onChange={(e) => set({ value: e.target.value })} />
        </label>
        <label>
          Weight, in kg <span className="optional">(optional)</span>
          <input inputMode="decimal" value={f.weight} onChange={(e) => set({ weight: e.target.value })} />
        </label>
        <label>
          Power, in watts <span className="optional">(optional)</span>
          <input inputMode="numeric" value={f.power} onChange={(e) => set({ power: e.target.value })} />
        </label>
        <label className="tick wide">
          <input type="checkbox" checked={f.rackMount} onChange={(e) => set({ rackMount: e.target.checked })} />
          Goes on a rack's rails
        </label>
        {f.rackMount && (
          <>
            <label>
              Rack units high
              <input inputMode="numeric" value={f.units} onChange={(e) => set({ units: e.target.value })} />
            </label>
            <label>
              Depth, in mm
              <input inputMode="numeric" value={f.depth} onChange={(e) => set({ depth: e.target.value })} />
            </label>
          </>
        )}
        <label className="tick wide">
          <input type="checkbox" checked={f.pat} onChange={(e) => set({ pat: e.target.checked })} />
          Runs off the mains, so it's PAT tested every year
        </label>
        <label className="wide">
          Notes <span className="optional">(optional)</span>
          <textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
        </label>
        <Refusal error={error} className="wide" />
        <div className="wide actions">
          <button type="submit" className="primary">
            Add product
          </button>
          <button type="button" className="link" onClick={() => done()}>
            Skip this one
          </button>
        </div>
        <datalist id="add-category-names">
          {[...new Set([...w.categories, ...CATEGORY_IDEAS])].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </form>
      {item.cents !== undefined && item.cents > 0 && <p className="hint">Reading this one cost about {item.cents} US cents, counted toward Claude's monthly limit.</p>}
    </div>
  )
}

/** Puts an added product's photo up once the server has the product; kept to try again when it couldn't be sent. */
async function sendPhoto(added: Added, photo: Blob) {
  const base = import.meta.env.VITE_API_BASE ?? ''
  const kept = (problem: string) => change({ added: line.added.map((a) => (a.key === added.key ? { ...a, photoLeft: photo, photoProblem: problem } : a)) })
  const clear = () => change({ added: line.added.map((a) => (a.key === added.key ? { ...a, photoLeft: undefined, photoProblem: undefined } : a)) })
  try {
    // The product goes to the server first, so its photo has somewhere to go.
    await client.sync()
    const res = await fetch(`${base}/api/models/${encodeURIComponent(added.id)}/photo?${new URLSearchParams({ client: client.clientId })}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: photo,
      signal: AbortSignal.timeout(120_000),
    })
    if (res.ok) return clear()
    kept(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'The photo wasn’t put up.')
  } catch {
    kept('The photo needs signal.')
  }
}

function AddedList({ view, added }: { view: View; added: Added[] }) {
  return (
    <section className="card">
      <h2>Done just now ({added.length})</h2>
      <ul className="job-list">
        {added.map((a) => {
          const m = view.warehouse.models.find((x) => x.id === a.id)
          return (
            <li key={a.key}>
              <div className="add-done">
                <a href={`#stock/product/${a.id}`}>
                  <Icon name="done" className="picker-saved" />
                  {m?.name ?? a.name}
                  {m?.lengthM ? ` (${m.lengthM} m)` : ''}
                </a>
                <small>{a.already ? 'Already on the list' : m?.pending ? 'Added, waiting to sync' : m?.toCheck ? 'Added, for the office to check' : 'Added'}</small>
                {a.photoLeft && (
                  <span className="hint">
                    {a.photoProblem}{' '}
                    <button type="button" className="link" onClick={() => void sendPhoto(a, a.photoLeft!)}>
                      Send the photo again
                    </button>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** For whoever runs the stock: products others added here, to look over and mark as looked over. */
function ToCheck({ models }: { models: ModelView[] }) {
  const { run, error } = useAct()
  return (
    <section className="card">
      <h2>Added by others, to look over ({models.length})</h2>
      <p className="hint">Open each to check it, change what's wrong, then mark it looked over.</p>
      <ul className="job-list">
        {models.map((m) => (
          <li key={m.id} className="to-look-over">
            <a className="job-row" href={`#stock/product/${m.id}`}>
              <Thumb icon={departmentIcon(m.department)} src={productPhotoOf(m)} />
              <div>
                <b>
                  {m.name}
                  {m.lengthM ? ` (${m.lengthM} m)` : ''}
                </b>
                <p>
                  {DEPARTMENT_LABELS[m.department]}
                  {m.category ? `, ${m.category}` : ''}
                </p>
              </div>
            </a>
            <button type="button" onClick={() => void run(() => client.mutate('model.checked', { id: m.id }))}>
              Looks right
            </button>
          </li>
        ))}
      </ul>
      <Refusal error={error} />
    </section>
  )
}
