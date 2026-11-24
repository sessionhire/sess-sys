import {
  MemoryStorage,
  newId,
  SyncClient,
  type Asset,
  type CommandInput,
  type CommandName,
  type LabelRun,
  type Model,
  inShForm,
  normaliseNumber,
  productCode,
  readProductCode,
  wholeNumber,
  type MutationResult,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type Transport,
} from '@sh/shared'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { pgliteDb } from '../src/db.ts'
import { readHistory } from '../src/history.ts'

/**
 * Codes that say what something is (ADR 0195): "AUD-0123-004", the
 * department's letters, the product's number and the item's. Products get
 * their numbers in turn; a product's labels are set aside for printing as its
 * next codes; a code goes only on its own product; and the letters are fixed
 * once a code is out, so a label never goes out of date.
 */

let cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn()
  cleanup = []
})

async function server() {
  const db = await pgliteDb()
  const app = await buildApp({ db })
  cleanup.push(async () => {
    await app.close()
    await db.close()
  })
  return { app, db }
}

async function send<N extends CommandName>(app: FastifyInstance, name: N, args: CommandInput<N>): Promise<MutationResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    payload: { clientId: 'office-laptop', mutations: [{ id: newId(), name, args, createdAt: new Date().toISOString() }] },
  })
  return res.json().results[0]
}

async function ok<N extends CommandName>(app: FastifyInstance, name: N, args: CommandInput<N>) {
  const r = await send(app, name, args)
  expect(r, `${name} ${JSON.stringify(args)}`).toMatchObject({ status: 'applied' })
  return r
}

async function refused<N extends CommandName>(app: FastifyInstance, name: N, args: CommandInput<N>) {
  const r = await send(app, name, args)
  expect(r.status, `${name} ${JSON.stringify(args)}`).toBe('rejected')
  return r.status === 'rejected' ? r.reason.message : ''
}

/** What the server has said about runs and items. */
async function records(app: FastifyInstance) {
  const res = await app.inject({ method: 'GET', url: '/api/sync/pull?after=0' })
  const runs = new Map<string, LabelRun>()
  const items = new Map<string, Asset>()
  for (const c of (res.json() as PullResponse).changes) {
    if (c.entity === 'labelRun') runs.set(c.id, c.data as LabelRun)
    if (c.entity === 'asset') items.set(c.id, c.data as Asset)
  }
  return { runs, items }
}

const run = (count: number, modelId?: string): CommandInput<'labels.reserve'> => ({ id: newId(), count, name: '', notes: '', ...(modelId ? { modelId } : {}) })
const item = (modelId: string, number: string | null, extra: Partial<CommandInput<'asset.add'>> = {}): CommandInput<'asset.add'> => ({
  id: newId(),
  modelId,
  number,
  serial: '',
  placeId: null,
  caseId: null,
  notes: '',
  fromCount: false,
  ...extra,
})

/** A laptop in the office, which can lose its signal. */
async function device(app: FastifyInstance) {
  const signal = { on: true }
  const transport: Transport = {
    async push(req: PushRequest): Promise<PushResponse> {
      if (!signal.on) throw new Error('offline')
      return (await app.inject({ method: 'POST', url: '/api/sync/push', payload: req })).json()
    },
    async pull(after: number): Promise<PullResponse> {
      if (!signal.on) throw new Error('offline')
      return (await app.inject({ method: 'GET', url: `/api/sync/pull?after=${after}` })).json()
    },
  }
  const client = await new SyncClient({ storage: new MemoryStorage(), transport }).open()
  await client.sync()
  return { client, signal }
}


const product = (name: string, department: 'audio' | 'lighting' | 'video' | 'other', tracking: 'serialised' | 'bulk' = 'serialised') => ({
  id: newId(),
  name,
  department,
  category: '',
  tracking,
  isCase: false,
  valueCents: null,
  notes: '',
})

async function products(app: FastifyInstance) {
  const res = await app.inject({ method: 'GET', url: '/api/sync/pull?after=0' })
  const models = new Map<string, Model>()
  for (const c of (res.json() as PullResponse).changes) if (c.entity === 'model') models.set(c.id, c.data as Model)
  return models
}

/** A speaker, a moving light and some cable, each with its product number. */
async function warehouse() {
  const s = await server()
  const place = { id: newId(), name: 'Bay A1', notes: '' }
  const y10p = product('d&b Y10P', 'audio')
  const mac = product('Mac Aura', 'lighting')
  const xlr = product('XLR 10 m', 'audio', 'bulk')
  await ok(s.app, 'place.upsert', place)
  for (const m of [y10p, mac, xlr]) await ok(s.app, 'model.create', m)
  return { ...s, place, y10p, mac, xlr }
}

describe('codes', () => {
  it('give each product its number in turn, with its department letters', async () => {
    const { app, y10p, mac, xlr } = await warehouse()
    const models = await products(app)
    expect([y10p, mac, xlr].map((m) => productCode(models.get(m.id)!))).toEqual(['AUD-0001', 'LGT-0002', 'AUD-0003'])
  })

  it('read however they are typed or scanned', () => {
    expect(['AUD-0123-004', 'aud 123 4', 'AUD0123004', ' aud-0123-004 ', 'LGT 1 1'].map(normaliseNumber)).toEqual([
      'AUD-0123-004',
      'AUD-0123-004',
      'AUD-0123-004',
      'AUD-0123-004',
      'LGT-0001-001',
    ])
    // Another firm's letters, or none of the item's number, aren't ours.
    expect(['ABC-0123-004', 'AUD-0123', 'AUD-0000-001', 'AUD-0123-000', 'AUD-12345-1'].map(normaliseNumber)).toEqual(Array(5).fill(undefined))
    // Only all three of the item's digits make it whole, as a label has them.
    expect(['AUD-0123-004', 'aud 123 004', 'AUD-0123-4'].map(wholeNumber)).toEqual(['AUD-0123-004', 'AUD-0123-004', undefined])
    expect(['AUD-0123', 'aud 123', 'AUD-0123-004'].map(readProductCode)).toEqual(['AUD-0123', 'AUD-0123', undefined])
    expect(inShForm('aud 123 4')).toBe(true)
  })

  it("set aside a product's next codes for printing, which go only on that product", async () => {
    const { app, db, y10p, mac, place } = await warehouse()
    const first = item(y10p.id, null)
    await ok(app, 'asset.add', first)
    const roll = run(10, y10p.id)
    await ok(app, 'labels.reserve', roll)
    const next = item(y10p.id, null)
    await ok(app, 'asset.add', next)

    let { runs, items } = await records(app)
    expect(items.get(first.id)?.number).toBe('AUD-0001-001')
    expect(runs.get(roll.id)).toMatchObject({ first: 2, count: 10, modelId: y10p.id, prefix: 'AUD-0001' })
    // Past the roll: AUD-0001-002 to -011 wait on labels not stuck on yet.
    expect(items.get(next.id)?.number).toBe('AUD-0001-012')

    // A printed one scanned goes on its own product, never another.
    const scanned = item(y10p.id, 'aud 1 5', { placeId: place.id })
    await ok(app, 'asset.add', scanned)
    expect(await refused(app, 'asset.add', item(mac.id, 'AUD-0001-006'))).toBe('AUD-0001-006 is a label for d&b Y10P, not Mac Aura.')
    expect(await refused(app, 'asset.add', item(y10p.id, 'VID-0001-001'))).toBe("No product's codes start VID-0001, so check the label.")
    expect(await refused(app, 'asset.add', item(y10p.id, 'AUD-0001-005'))).toBe('AUD-0001-005 is already in use (d&b Y10P).')
    // One never given out, typed off a label printed elsewhere: the next free code moves past it.
    await ok(app, 'asset.add', item(y10p.id, 'AUD-0001-040'))
    const after = item(y10p.id, null)
    await ok(app, 'asset.add', after)
    ;({ runs, items } = await records(app))
    expect(items.get(after.id)?.number).toBe('AUD-0001-041')

    // Cancelled only while none is on an item.
    expect(await refused(app, 'labels.cancel', { id: roll.id })).toBe("One of the labels AUD-0001-002 to AUD-0001-011 is on an item, so the run can't be cancelled.")
    // A product with labels set aside is kept, since they may be printed.
    expect(await refused(app, 'model.remove', { id: y10p.id })).toMatch(/has numbered items/)
    const spare = product('Spare', 'other')
    await ok(app, 'model.create', spare)
    await ok(app, 'labels.reserve', run(2, spare.id))
    expect(await refused(app, 'model.remove', { id: spare.id })).toBe(
      'Spare has had labels set aside, which may be printed with its codes, so it can\'t be removed. Mark it as added by mistake instead.'
    )

    const { entries } = await readHistory(db)
    expect(entries.map((e) => e.what)).toContain('Set aside AUD-0001-002 to AUD-0001-011 for printing labels')
  })

  it('are only for numbered products of our own, up to 999 of each', async () => {
    const { app, y10p, xlr } = await warehouse()
    expect(await refused(app, 'labels.reserve', run(5, xlr.id))).toBe('XLR 10 m is counted, not numbered. Change it to numbered to label them one by one.')
    expect((await send(app, 'labels.reserve', run(1000, y10p.id))).status).toBe('rejected')
    await ok(app, 'labels.reserve', run(990, y10p.id))
    expect(await refused(app, 'labels.reserve', run(10, y10p.id))).toBe('Only 9 codes are left for d&b Y10P. Set aside those at most.')
    await ok(app, 'labels.reserve', run(9, y10p.id))
    // With every code given out, a new item takes an SH- number, as before codes.
    const extra = item(y10p.id, null)
    await ok(app, 'asset.add', extra)
    expect((await records(app)).items.get(extra.id)?.number).toBe('SH-000001')
  })

  it('keep their letters once one is given out, so a label never goes out of date', async () => {
    const { app, y10p, mac } = await warehouse()
    // Nothing printed yet: the letters follow the department.
    await ok(app, 'model.update', { id: mac.id, department: 'video' })
    expect(productCode((await products(app)).get(mac.id)!)).toBe('VID-0002')
    await ok(app, 'asset.add', item(y10p.id, null))
    await ok(app, 'model.update', { id: y10p.id, department: 'video' })
    const models = await products(app)
    expect([models.get(y10p.id)?.department, productCode(models.get(y10p.id)!)]).toEqual(['video', 'AUD-0001'])
  })

  it("give an item put down as another product that product's next code, and the old one still finds it", async () => {
    const { app, y10p, mac } = await warehouse()
    const wrong = item(y10p.id, null)
    await ok(app, 'asset.add', wrong)
    await ok(app, 'asset.update', { id: wrong.id, modelId: mac.id })
    expect((await records(app)).items.get(wrong.id)).toMatchObject({ number: 'LGT-0002-001', formerNumbers: ['AUD-0001-001'] })
    // An SH- label says nothing of the product, so it stays.
    const sh = item(y10p.id, 'SH-000123')
    await ok(app, 'asset.add', sh)
    await ok(app, 'asset.update', { id: sh.id, modelId: mac.id })
    expect((await records(app)).items.get(sh.id)?.number).toBe('SH-000123')
  })

  it("on a device, show a product's run as its codes and how many are on items", async () => {
    const { app, y10p } = await warehouse()
    const phone = await device(app)
    const roll = run(5, y10p.id)
    await phone.client.mutate('labels.reserve', roll)
    await phone.client.sync()
    await phone.client.mutate('asset.add', item(y10p.id, 'AUD-0001-002'))
    await phone.client.sync()
    const labels = phone.client.view().labels
    expect(labels.runs.map((r) => [r.firstNumber, r.lastNumber, r.used])).toEqual([['AUD-0001-001', 'AUD-0001-005', 1]])
    expect(labels.runOf('AUD-0001-004')?.id).toBe(roll.id)
    expect(labels.runOf('AUD-0001-006')).toBeUndefined()
    // SH- numbers are as they were.
    expect(labels.next).toBe('SH-000001')
  })
})
