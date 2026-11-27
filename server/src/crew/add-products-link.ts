import { addArgsOf, alikeProducts, blankDraft, DEPARTMENT_LABELS, DEPARTMENTS, draftOf, FILE_HEAD_BYTES, fileTypeOf, MAX_FILE_BYTES, MOST_PRODUCT_PHOTOS, newId, type Department, type Person, type ProductDraft, type ProductReading } from '@sh/shared'
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { NoAnswer } from '../assistant/claude.ts'
import { productReadStatus, readProduct } from '../assistant/products.ts'
import type { Assistant } from '../assistant/routes.ts'
import { applyMutation } from '../commands.ts'
import type { Db } from '../db.ts'
import { describeDevice } from '../devices.ts'
import type { DocumentFiles } from '../documents/files.ts'
import { NotAForm, readForm } from '../documents/form.ts'
import { putProductPhoto } from '../documents/photos.ts'
import { publicOrigin } from '../http.ts'
import { reportError } from '../monitoring.ts'
import { officeFor } from '../office/store.ts'
import { getModel } from '../stock/store.ts'
import { renderAddCheck, renderAddStart } from './add-products-page.ts'
import { renderGone } from './page.ts'
import { personByToken } from './store.ts'

/**
 * Add products from a private link (ADR 0203): the routes for the two pages
 * in add-products-page.ts. A photo sent to be read is kept in the server's
 * memory, by the form's id, until the product is added or an hour has gone,
 * so it can go on the product as its photo without being sent twice. A
 * restart forgets it, and the product is added without one.
 */

/** Three photos made small on the phone, and room for one that sends them larger. */
const ROUTE_LIMIT = 16 * 1024 * 1024
const HELD_MS = 60 * 60 * 1000
/** At most this many photos wait at once across every link, the oldest let go first. */
const MOST_HELD = 200

type Req = FastifyRequest<{ Params: { token: string }; Querystring: { m?: string; p?: string; k?: string } }>
type Form = URLSearchParams

const isJpeg = (b: Buffer) => {
  const found = fileTypeOf(b.subarray(0, FILE_HEAD_BYTES))
  return !('refused' in found) && found.type === 'jpeg'
}

/** The form as typed, read into the draft the page draws again when it's refused. */
export function draftFromForm(form: { get(name: string): string | null }): ProductDraft {
  const get = (name: string) => (form.get(name) ?? '').slice(0, 2000)
  const department = get('department')
  const isCase = get('isCase') === 'yes'
  return {
    ...blankDraft(),
    name: get('name').trim(),
    otherNames: get('otherNames'),
    department: DEPARTMENTS.includes(department as Department) ? (department as Department) : 'other',
    category: get('category'),
    tracking: !isCase && get('tracking') === 'bulk' ? 'bulk' : 'serialised',
    isCase,
    length: get('length'),
    value: get('value'),
    weight: get('weight'),
    power: get('power'),
    rackMount: get('rackMount') === 'yes',
    units: get('units'),
    depth: get('depth'),
    pat: get('pat') === 'yes',
    notes: get('notes'),
  }
}

export function registerAddProductsLink(app: FastifyInstance, { db, files, assistant, onChange }: { db: Db; files: DocumentFiles; assistant: Assistant; onChange: () => void }) {
  const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store').header('x-robots-tag', 'noindex')
  const base = (req: FastifyRequest, token: string) => `${publicOrigin(req)}/f/${token}`
  const held = new Map<string, { personId: string; photo: Buffer; until: number }>()
  /** What each link added this hour, to say on the first page. */
  const done = new Map<string, { name: string; already: boolean; at: number }[]>()
  const tidy = (now = Date.now()) => {
    for (const [k, v] of held) if (v.until < now) held.delete(k)
    while (held.size > MOST_HELD) held.delete(held.keys().next().value!)
    for (const [k, v] of done) {
      const kept = v.filter((d) => d.at > now - HELD_MS)
      if (kept.length) done.set(k, kept)
      else done.delete(k)
    }
  }
  const did = (person: Person, name: string, already: boolean) => done.set(person.id, [{ name, already, at: Date.now() }, ...(done.get(person.id) ?? [])].slice(0, 20))

  const models = async () => {
    const { rows } = await db.reads.query<{ id: string; name: string; department: Department; category: string; aliases: string[]; mistake: boolean; length_m: number | null }>(
      'SELECT id, name, department, category, aliases, mistake, length_m::float8 AS length_m FROM models WHERE NOT mistake'
    )
    return rows.map((r) => ({ id: r.id, name: r.name, department: r.department, category: r.category, aliases: r.aliases ?? [], mistake: r.mistake, lengthM: r.length_m }))
  }
  const what = (m: { department: Department; category: string; lengthM: number | null }) =>
    [DEPARTMENT_LABELS[m.department], m.category, m.lengthM ? `${m.lengthM} m` : ''].filter(Boolean).join(', ')

  const checkPage = async (req: FastifyRequest, person: Person, o: { id: string; draft: ProductDraft; reading?: ProductReading; unread?: string; flash?: { ok: boolean; text: string } }) => {
    const all = await models()
    const r = o.reading
    const alike = alikeProducts(all, { name: r?.name || o.draft.name, maker: r?.maker, model: r?.model, sameAs: r?.sameAs, lengthM: r?.lengthM ?? null })
    return renderAddCheck({
      base: base(req, person.linkToken),
      id: o.id,
      hasPhoto: held.has(o.id),
      draft: o.draft,
      reading: r,
      unread: o.unread,
      alike: alike.map((m) => ({ id: m.id, name: m.lengthM ? `${m.name} (${m.lengthM} m)` : m.name, what: what(m) })),
      categories: [...new Set(all.map((m) => m.category.trim()).filter(Boolean))],
      office: await officeFor(db),
      flash: o.flash,
    })
  }

  app.get('/f/:token/add', async (req: Req, reply) => {
    noStore(reply)
    const person = await personByToken(db, req.params.token)
    if (!person) return reply.code(404).type('text/html').send(renderGone())
    tidy()
    let flash: { ok: boolean; text: string } | undefined
    const { m, p, k } = req.query
    if ((m === 'added' || m === 'already') && p) {
      const model = await getModel(db.reads, p)
      if (model) {
        flash = { ok: true, text: m === 'added' ? `${model.name} is on the stock list. Thanks: on to the next.` : `${model.name} is on the list already, so it wasn't added again.` }
        // Said once, however often the page is opened again.
        if (m === 'already' && k && held.has(k)) {
          held.delete(k)
          did(person, model.name, true)
        }
      }
    }
    const status = await productReadStatus(assistant)
    return reply.type('text/html').send(
      renderAddStart({ base: base(req, person.linkToken), reads: status.ok, why: status.why, office: await officeFor(db), flash, added: done.get(person.id) })
    )
  })

  /** Whose link a form is being sent on, found before its body is read. */
  const sender = new WeakMap<FastifyRequest, Person>()

  // The first page's form: photos and what's typed (multipart from the photo form, plain from the typed one), read by Claude.
  const read = async (req: Req, reply: FastifyReply, person: Person, id: string, photos: Buffer[], typed: string) => {
    tidy()
    if (photos[0]) held.set(id, { personId: person.id, photo: photos[0], until: Date.now() + HELD_MS })
    const draft = { ...blankDraft('other'), name: typed }
    const status = await productReadStatus(assistant)
    if (!status.ok) return noStore(reply).type('text/html').send(await checkPage(req, person, { id, draft }))
    try {
      const r = await readProduct(assistant, { photos: photos.map((b) => ({ type: 'image/jpeg' as const, data: b.toString('base64') })), typed })
      const all = await models()
      const filled = draftOf(r.reading, [...new Set(all.map((x) => x.category.trim()).filter(Boolean))])
      return noStore(reply).type('text/html').send(await checkPage(req, person, { id, draft: { ...filled, name: filled.name || typed }, reading: r.reading }))
    } catch (err) {
      if (!(err instanceof NoAnswer)) reportError(err, { route: '/f/:token/add/read', method: 'POST' })
      const unread = err instanceof NoAnswer ? err.message : 'Claude couldn’t read it just now.'
      return noStore(reply).type('text/html').send(await checkPage(req, person, { id, draft, unread }))
    }
  }

  void app.register(async (scope) => {
    scope.addContentTypeParser('multipart/form-data', { parseAs: 'buffer', bodyLimit: ROUTE_LIMIT }, (_req, body, done) => done(null, body))
    scope.post(
      '/f/:token/add/read',
      {
        bodyLimit: ROUTE_LIMIT,
        // The link is looked up before the body is read, so a made-up link never has photos read into the server's memory for it.
        onRequest: async (req: Req, reply) => {
          const person = await personByToken(db, req.params.token)
          if (!person) return reply.code(404).type('text/html').send(renderGone())
          sender.set(req, person)
        },
        errorHandler: (err: FastifyError, req: Req, reply) => {
          if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.redirect(`/f/${encodeURIComponent(req.params.token)}/add`, 303)
          throw err
        },
      },
      async (req: Req, reply) => {
        const person = sender.get(req)!
        const type = String(req.headers['content-type'] ?? '')
        let id = ''
        let typed = ''
        let photos: Buffer[] = []
        if (type.startsWith('multipart/form-data')) {
          try {
            const form = readForm(req.body as Buffer, type, MOST_PRODUCT_PHOTOS)
            id = form.fields.id ?? ''
            typed = form.fields.typed ?? ''
            photos = form.files.filter((f) => f.length > 0 && f.length <= MAX_FILE_BYTES && isJpeg(f))
          } catch (err) {
            if (err instanceof NotAForm) return reply.redirect(`/f/${person.linkToken}/add`, 303)
            throw err
          }
        } else {
          const form = (req.body ?? new URLSearchParams()) as Form
          id = form.get('id') ?? ''
          typed = form.get('typed') ?? ''
        }
        typed = typed.replace(/\s+/g, ' ').trim().slice(0, 300)
        if (!/^[\w-]{8,40}$/.test(id)) id = newId()
        if (!photos.length && typed.length < 2) return reply.redirect(`/f/${person.linkToken}/add`, 303)
        return read(req, reply, person, id, photos, typed)
      }
    )
  })

  // The second page's form: the product, added as anyone adds one, waiting for the office to look over, and the photo put on it.
  app.post('/f/:token/add', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return reply.code(404).type('text/html').send(renderGone())
    const form = (req.body ?? new URLSearchParams()) as Form
    const given = form.get('id') ?? ''
    const id = /^[\w-]{8,40}$/.test(given) ? given : newId()
    // Sent twice (a double tap, the browser sending it again): the first added it.
    if (await getModel(db.reads, id)) return reply.redirect(`/f/${person.linkToken}/add?${new URLSearchParams({ m: 'added', p: id })}`, 303)
    const draft = draftFromForm(form)
    const refuse = async (text: string) => noStore(reply).code(422).type('text/html').send(await checkPage(req, person, { id, draft, flash: { ok: false, text } }))
    const made = addArgsOf(draft, id)
    if (made.reason !== undefined) return refuse(made.reason)
    const result = await applyMutation(db, `link:${person.id}`, { id: newId(), name: 'model.add', args: made.args, createdAt: new Date().toISOString() }, { via: 'link', device: describeDevice(req.headers['user-agent']) })
    if (result.status === 'rejected') return refuse(result.reason.message)
    const photo = held.get(id)
    if (photo && photo.personId === person.id && files.on) {
      try {
        await putProductPhoto(db, files, id, photo.photo, 'jpeg', { link: person.id, device: describeDevice(req.headers['user-agent']) }, true)
      } catch (err) {
        // The product is added all the same; the office can put a photo on it.
        reportError(err, { route: '/f/:token/add', method: 'POST' })
      }
    }
    held.delete(id)
    did(person, made.args.name, false)
    onChange()
    return reply.redirect(`/f/${person.linkToken}/add?${new URLSearchParams({ m: 'added', p: id })}`, 303)
  })
}
