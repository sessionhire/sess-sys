import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { newId, type ProductRead, type ProductReading } from '@sh/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { dirStore } from '../src/backup/store.ts'
import type { Ask, Asked } from '../src/assistant/claude.ts'
import { flashOf, IPHONE, server, staff } from './people.ts'

/**
 * Adding many new products quickly (ADR 0203): anyone adds a product, which
 * waits to be looked over unless they run the stock; a photo is read by
 * Claude (stood in for here) with a web search or two, and what it says is
 * only ever offered; and a freelancer does the same from their link.
 */

const folders: string[] = []
afterEach(() => {
  for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true })
})

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('a made-up microphone')])
const PERSON = { phone: null, skills: [], dayRateCents: null, notes: '' }

const reading: ProductReading = {
  known: true,
  name: 'Shure SM58',
  maker: 'Shure',
  model: 'SM58',
  otherNames: ['58'],
  department: 'audio',
  category: 'Microphones',
  tracking: 'serialised',
  isCase: false,
  lengthM: null,
  weightKg: 0.3,
  powerW: null,
  rackMount: false,
  rackUnits: null,
  depthMm: null,
  valueEuro: 109,
  needsPat: false,
  sameAs: '',
  sure: 'sure',
  said: 'The label says Shure SM58; Shure’s page gives its weight.',
  sources: [{ title: 'Shure SM58', url: 'https://www.shure.com/en-GB/products/microphones/sm58' }],
  photoToTake: '',
}

const add = (id: string, name: string, more: Record<string, unknown> = {}) => ({ id, name, department: 'audio' as const, category: 'Microphones', tracking: 'serialised' as const, isCase: false, valueCents: null, notes: '', ...more })

async function company({ answer = reading as unknown, claude = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sh-add-products-'))
  folders.push(dir)
  const asked: Asked[] = []
  const ask: Ask = async (a) => {
    asked.push(a)
    return { json: answer, model: 'claude-opus-5-5', inputTokens: 6_000, outputTokens: 800, searches: 2 }
  }
  const { app, db } = await server({ documentStore: dirStore(dir), ...(claude ? { claude: { apiKey: 'test', model: 'claude-opus-5-5', limitCents: 5_000, ask } } : {}) })
  const colly = await staff(app, db, 'Colly Hewson', IPHONE, 'phonec0ffee')
  const sean = await staff(app, db, 'Sean Walsh', IPHONE, 'phonebeef')
  for (const [id, name] of [
    ['colly', 'Colly Hewson'],
    ['sean', 'Sean Walsh'],
  ] as const)
    expect(await colly.send('person.upsert', { id, name, kind: 'staff', email: `${id}@sessionhire.com`, ...PERSON })).toMatchObject({ status: 'applied' })
  expect(await colly.send('person.upsert', { id: 'dara', name: 'Dara Kelly', kind: 'freelancer', email: null, ...PERSON })).toMatchObject({ status: 'applied' })
  const token = (await db.query<{ link_token: string }>('SELECT link_token FROM people WHERE id = $1', ['dara'])).rows[0]!.link_token
  const model = async (id: string) => (await db.query('SELECT name, to_check, photo_key, length_m::float8 AS length_m, pat_months, aliases FROM models WHERE id = $1', [id])).rows[0]
  return { app, db, colly, sean, asked, dara: `/f/${token}`, model }
}

describe('adding products (ADR 0203)', () => {
  it('lets staff crew and freelancers add, not change; what they add waits to be looked over', async () => {
    const { colly, sean, model } = await company()
    expect(await colly.send('person.role', { id: 'colly', role: 'director' })).toMatchObject({ status: 'applied' })
    expect(await colly.send('person.role', { id: 'sean', role: 'crew' })).toMatchObject({ status: 'applied' })

    expect(await sean.send('model.add', add('sm58', 'Shure SM58', { aliases: ['58'], weightKg: 0.3 }))).toMatchObject({ status: 'applied' })
    expect(await model('sm58')).toMatchObject({ name: 'Shure SM58', to_check: true, aliases: ['58'] })
    // Adding isn't changing: that stays with whoever runs the stock.
    expect(await sean.send('model.update', { id: 'sm58', name: 'Shure SM58 vocal' })).toMatchObject({ status: 'rejected' })
    expect(await sean.send('model.create', add('beta', 'Shure Beta 58'))).toMatchObject({ status: 'rejected' })
    expect(await sean.send('model.checked', { id: 'sm58' })).toMatchObject({ status: 'rejected' })

    // Someone who runs the stock adds without it waiting, and looks over the rest.
    expect(await colly.send('model.add', add('e935', 'Sennheiser e935'))).toMatchObject({ status: 'applied' })
    expect(await model('e935')).toMatchObject({ to_check: false })
    expect(await colly.send('model.checked', { id: 'sm58' })).toMatchObject({ status: 'applied' })
    expect(await model('sm58')).toMatchObject({ to_check: false })

    // A name taken is turned down, as on New product.
    expect(await sean.send('model.add', add('sm58b', 'shure sm58'))).toMatchObject({ status: 'rejected' })
  })

  it('gives the first photo of a product they added, and no other', async () => {
    const { app, colly, sean, model } = await company()
    expect(await colly.send('person.role', { id: 'colly', role: 'director' })).toMatchObject({ status: 'applied' })
    expect(await colly.send('person.role', { id: 'sean', role: 'crew' })).toMatchObject({ status: 'applied' })
    expect(await sean.send('model.add', add('sm58', 'Shure SM58'))).toMatchObject({ status: 'applied' })
    expect(await colly.send('model.create', add('ours', 'Old desk'))).toMatchObject({ status: 'applied' })
    const put = (id: string) =>
      app.inject({ method: 'POST', url: `/api/models/${id}/photo?client=phonebeef`, cookies: sean.cookies, headers: { 'content-type': 'application/octet-stream' }, payload: JPEG })
    expect((await put('sm58')).statusCode).toBe(200)
    expect((await model('sm58'))?.photo_key).toBeTruthy()
    // Not a second time, nor on a product already looked over, nor taking one down.
    expect((await put('sm58')).statusCode).toBe(403)
    expect((await put('ours')).statusCode).toBe(403)
    expect((await app.inject({ method: 'DELETE', url: '/api/models/sm58/photo?client=phonebeef', cookies: sean.cookies })).statusCode).toBe(403)
  })

  it('reads a photo with Claude, with web searches counted, only once Claude is on', async () => {
    const { app, colly, asked, db } = await company()
    await colly.send('model.create', add('y10p', 'd&b Y10P'))
    const read = () =>
      app.inject({ method: 'POST', url: '/api/products/read', cookies: colly.cookies, payload: { photos: [{ type: 'image/jpeg', data: JPEG.toString('base64') }], typed: '' } })
    expect((await app.inject({ url: '/api/products/read', cookies: colly.cookies })).json()).toMatchObject({ ok: false })
    expect((await read()).statusCode).toBe(409)
    expect(asked).toHaveLength(0)

    expect(await colly.send('assistant.use', { on: true })).toMatchObject({ status: 'applied' })
    expect((await app.inject({ url: '/api/products/read', cookies: colly.cookies })).json()).toEqual({ ok: true })
    const res = await read()
    expect(res.statusCode).toBe(200)
    const got = res.json() as ProductRead
    expect(got.reading).toMatchObject({ name: 'Shure SM58', weightKg: 0.3, valueEuro: 109 })
    // Words and two searches: 6,000 in at $4 a million, 800 out at $20, and a cent a search.
    expect(got.cents).toBe(2 + 2 + 2)
    expect(asked[0]!.images).toHaveLength(1)
    expect(asked[0]!.searches).toBeGreaterThan(0)
    // It's told what's already on the list, so it can say an item is one of them.
    expect(asked[0]!.user).toContain('d&b Y10P')
    expect((await db.query(`SELECT kind, cost_cents FROM assistant_uses`)).rows[0]).toMatchObject({ kind: 'product', cost_cents: 6 })
    // Nothing to read is turned down before asking.
    expect((await app.inject({ method: 'POST', url: '/api/products/read', cookies: colly.cookies, payload: { photos: [], typed: '' } })).statusCode).toBe(400)
  })

  it('reads leniently: anything out of range is left for the person to fill in', async () => {
    const { app, colly } = await company({ answer: { ...reading, weightKg: -2, department: 'sound', sources: [{ title: 'x', url: 'javascript:alert(1)' }], tracking: 'lots' } })
    await colly.send('assistant.use', { on: true })
    const got = (await app.inject({ method: 'POST', url: '/api/products/read', cookies: colly.cookies, payload: { photos: [], typed: 'SM58' } })).json() as ProductRead
    expect(got.reading).toMatchObject({ weightKg: null, department: 'other', tracking: 'serialised', sources: [] })
  })
})

describe('adding products from a freelancer’s link (ADR 0203)', () => {
  const FORM = { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': IPHONE }

  it('is reached from their page, reads what they typed, and adds it with their name, to be looked over', async () => {
    const { app, colly, dara, model, db } = await company()
    await colly.send('assistant.use', { on: true })
    await colly.send('model.create', add('sm58-old', 'Shure SM58 Vocal Mic'))
    expect((await app.inject({ url: dara })).body).toContain('/add">Add products ›</a>')
    const start = await app.inject({ url: `${dara}/add` })
    expect(start.statusCode).toBe(200)
    expect(start.body).toContain('Photos of it')

    const id = newId()
    const check = await app.inject({ method: 'POST', url: `${dara}/add/read`, headers: FORM, payload: new URLSearchParams({ id, typed: 'shure 58' }).toString() })
    expect(check.statusCode).toBe(200)
    expect(check.body).toContain('value="Shure SM58"')
    expect(check.body).toContain('Suggested by Claude.')
    // What's already on the list that it might be, to choose instead.
    expect(check.body).toContain('Shure SM58 Vocal Mic')
    expect(check.body).toContain("It's this one")

    const fields = { id, name: 'Shure SM58', otherNames: '58', department: 'audio', category: 'Microphones', tracking: 'serialised', length: '', value: '109', weight: '0.3', power: '', units: '', depth: '', notes: '' }
    const added = await app.inject({ method: 'POST', url: `${dara}/add`, headers: FORM, payload: new URLSearchParams(fields).toString() })
    expect(added.statusCode).toBe(303)
    expect(await model(id)).toMatchObject({ name: 'Shure SM58', to_check: true })
    const { rows } = await db.query(`SELECT client_id FROM mutations WHERE name = 'model.add'`)
    expect(rows[0]).toMatchObject({ client_id: 'link:dara' })
    const after = await app.inject({ url: (added.headers.location as string).replace(/^https?:\/\/[^/]+/, '') })
    expect(flashOf(after.body)).toMatchObject({ ok: true, message: expect.stringContaining('Shure SM58 is on the stock list') })

    // Sent again, it's added once.
    expect((await app.inject({ method: 'POST', url: `${dara}/add`, headers: FORM, payload: new URLSearchParams(fields).toString() })).statusCode).toBe(303)
    expect((await db.query(`SELECT count(*)::int AS n FROM models WHERE name = 'Shure SM58'`)).rows[0]).toMatchObject({ n: 1 })
  })

  it('keeps what was typed when it is refused, and says why', async () => {
    const { app, dara, db } = await company({ claude: false })
    const page = await app.inject({ url: `${dara}/add` })
    expect(page.body).toContain("Photos can't be read just now")
    const refused = await app.inject({ method: 'POST', url: `${dara}/add`, headers: FORM, payload: new URLSearchParams({ id: newId(), name: 'XLR 10m', department: 'audio', tracking: 'bulk', length: '' }).toString() })
    expect(refused.statusCode).toBe(422)
    expect(flashOf(refused.body).message).toMatch(/Length box/)
    expect(refused.body).toContain('value="XLR 10m"')
    expect((await db.query(`SELECT count(*)::int AS n FROM models`)).rows[0]).toMatchObject({ n: 0 })
  })

  it('puts the photo it read on the product it adds', async () => {
    const { app, colly, dara, model } = await company()
    await colly.send('assistant.use', { on: true })
    const id = newId()
    const boundary = '----add' + newId()
    const part = (head: string, body: Buffer | string) => Buffer.concat([Buffer.from(`--${boundary}\r\n${head}\r\n\r\n`), Buffer.isBuffer(body) ? body : Buffer.from(body), Buffer.from('\r\n')])
    const payload = Buffer.concat([
      part('Content-Disposition: form-data; name="id"', id),
      part('Content-Disposition: form-data; name="typed"', ''),
      part('Content-Disposition: form-data; name="file"; filename="photo.jpg"\r\nContent-Type: image/jpeg', JPEG),
      Buffer.from(`--${boundary}--\r\n`),
    ])
    const check = await app.inject({ method: 'POST', url: `${dara}/add/read`, headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'user-agent': IPHONE }, payload })
    expect(check.statusCode).toBe(200)
    expect(check.body).toContain('Its photo goes on it too.')
    const fields = { id, name: 'Shure SM58', department: 'audio', tracking: 'serialised' }
    expect((await app.inject({ method: 'POST', url: `${dara}/add`, headers: FORM, payload: new URLSearchParams(fields).toString() })).statusCode).toBe(303)
    expect((await model(id))?.photo_key).toBeTruthy()
  })
})
