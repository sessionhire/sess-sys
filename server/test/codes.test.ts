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
import { STOCK } from '../src/stock/schema.ts'

/**
 * Codes that say what something is (ADR 0195): "0123-004", the product's
 * number and the item's. Products get their numbers in turn; a product's
 * labels are set aside for printing as its next codes; a code goes only on
 * its own product; and a code printed in the hours they had the department's
 * letters in front, "0123-004", still reads as its code.
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
  it('give each product its number in turn, whatever its department', async () => {
    const { app, y10p, mac, xlr } = await warehouse()
    const models = await products(app)
    expect([y10p, mac, xlr].map((m) => productCode(models.get(m.id)!))).toEqual(['0001', '0002', '0003'])
  })

  it('read however they are typed or scanned', () => {
    expect(['0123-004', '123 4', ' 0123-004 ', '1-1', 'AUD-0123-004', 'aud0123004', 'lgt 123 4'].map(normaliseNumber)).toEqual([
      '0123-004',
      '0123-004',
      '0123-004',
      '0001-001',
      '0123-004',
      '0123-004',
      '0123-004',
    ])
    // Digits alone are an SH- number written short, or an old tag; another firm's letters, or none of the item's number, aren't ours.
    expect(['123', '0123004'].map(normaliseNumber)).toEqual(['SH-000123', undefined])
    expect(['ABC-0123-004', '0000-001', '0123-000', '12345-1'].map(normaliseNumber)).toEqual(Array(4).fill(undefined))
    // Only all seven digits make it whole, as a label has them.
    expect(['0123-004', '0123 004', '123-004', '0123-4', 'AUD-0123-004'].map(wholeNumber)).toEqual(['0123-004', '0123-004', undefined, undefined, '0123-004'])
    expect(inShForm('123 4')).toBe(true)
    expect(inShForm('0123')).toBe(false)
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
    expect(items.get(first.id)?.number).toBe('0001-001')
    expect(runs.get(roll.id)).toMatchObject({ first: 2, count: 10, modelId: y10p.id, prefix: '0001' })
    // Past the roll: 0001-002 to -011 wait on labels not stuck on yet.
    expect(items.get(next.id)?.number).toBe('0001-012')

    // A printed one scanned goes on its own product, never another.
    const scanned = item(y10p.id, '1 5', { placeId: place.id })
    await ok(app, 'asset.add', scanned)
    expect(await refused(app, 'asset.add', item(mac.id, '0001-006'))).toBe('0001-006 is a label for d&b Y10P, not Mac Aura.')
    expect(await refused(app, 'asset.add', item(y10p.id, '0099-001'))).toBe("No product's codes start 0099, so check the label.")
    expect(await refused(app, 'asset.add', item(y10p.id, '0001-005'))).toBe('0001-005 is already in use (d&b Y10P).')
    // One never given out, typed off a label printed elsewhere: the next free code moves past it.
    await ok(app, 'asset.add', item(y10p.id, '0001-040'))
    const after = item(y10p.id, null)
    await ok(app, 'asset.add', after)
    ;({ runs, items } = await records(app))
    expect(items.get(after.id)?.number).toBe('0001-041')

    // Cancelled only while none is on an item.
    expect(await refused(app, 'labels.cancel', { id: roll.id })).toBe("One of the labels 0001-002 to 0001-011 is on an item, so the run can't be cancelled.")
    // A product with labels set aside is kept, since they may be printed.
    expect(await refused(app, 'model.remove', { id: y10p.id })).toMatch(/has numbered items/)
    const spare = product('Spare', 'other')
    await ok(app, 'model.create', spare)
    await ok(app, 'labels.reserve', run(2, spare.id))
    expect(await refused(app, 'model.remove', { id: spare.id })).toBe(
      'Spare has had labels set aside, which may be printed with its codes, so it can\'t be removed. Mark it as added by mistake instead.'
    )

    const { entries } = await readHistory(db)
    expect(entries.map((e) => e.what)).toContain('Set aside 0001-002 to 0001-011 for printing labels')
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

  it('lose the letters any were given with, and devices hear of it', async () => {
    const { app, db, y10p } = await warehouse()
    const first = item(y10p.id, null)
    await ok(app, 'asset.add', first)
    const roll = run(3, y10p.id)
    await ok(app, 'labels.reserve', roll)
    const moved = item(y10p.id, null)
    await ok(app, 'asset.add', moved)
    await ok(app, 'asset.relabel', { id: moved.id, number: null })
    // As 1.229.0 left them, letters in front.
    await db.exec(`
      UPDATE identifiers SET value = 'AUD-' || value WHERE kind = 'code';
      UPDATE label_runs SET prefix = 'AUD-' || prefix WHERE prefix <> '';
      INSERT INTO changes (entity, entity_id, op, data)
      SELECT entity, entity_id, 'put', jsonb_set(data, '{number}', to_jsonb('AUD-' || (data->>'number')))
        FROM changes WHERE entity = 'asset' AND seq = (SELECT max(seq) FROM changes c WHERE c.entity_id = changes.entity_id);
    `)
    await db.exec(STOCK.migrations.at(-2)!)
    const { rows } = await db.query<{ value: string }>(`SELECT value FROM identifiers WHERE kind = 'code' ORDER BY value`)
    expect(rows.map((r) => r.value)).toEqual(['0001-001', '0001-005', '0001-006'])
    const { runs, items } = await records(app)
    expect(runs.get(roll.id)?.prefix).toBe('0001')
    expect(items.get(first.id)?.number).toBe('0001-001')
    expect(items.get(moved.id)).toMatchObject({ number: '0001-006', formerNumbers: ['0001-005'] })
    expect(productCode((await products(app)).get(y10p.id)!)).toBe('0001')
    // A label printed with them still finds its item.
    const phone = await device(app)
    expect(phone.client.view().warehouse.byNumber.get(normaliseNumber('AUD-0001-001')!)?.id).toBe(first.id)
  })

  it("give an item put down as another product that product's next code, and the old one still finds it", async () => {
    const { app, y10p, mac } = await warehouse()
    const wrong = item(y10p.id, null)
    await ok(app, 'asset.add', wrong)
    await ok(app, 'asset.update', { id: wrong.id, modelId: mac.id })
    expect((await records(app)).items.get(wrong.id)).toMatchObject({ number: '0002-001', formerNumbers: ['0001-001'] })
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
    await phone.client.mutate('asset.add', item(y10p.id, '0001-002'))
    await phone.client.sync()
    const labels = phone.client.view().labels
    expect(labels.runs.map((r) => [r.firstNumber, r.lastNumber, r.used])).toEqual([['0001-001', '0001-005', 1]])
    expect(labels.runOf('0001-004')?.id).toBe(roll.id)
    expect(labels.runOf('0001-006')).toBeUndefined()
    // SH- numbers are as they were.
    expect(labels.next).toBe('SH-000001')
  })
})
