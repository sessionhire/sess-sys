import { rmsPricePlan, ruleOfRateDefinition, type CommandInput, type CommandName, type HistoryPage, type ProductPrice, type RmsPricesStatus } from '@sh/shared'
import { describe, expect, it } from 'vitest'
import { hireRate } from '../src/rms/prices.ts'
import { IPHONE, server, staff } from './people.ts'

/**
 * Hire prices from Current RMS (ADR 0132). Nothing here reaches the real
 * Current RMS: a stand-in answers as its documentation says, products a
 * hundred a page, a product's rates on their own. A read keeps each
 * product's rental price and rule; the card's plan says what filling in
 * would do; the fill-in does just that, keeps a price set by hand unless
 * ticked, follows Current RMS for one it gave before, and is in History.
 */

interface Asked {
  method: string
  path: string
  query: URLSearchParams
}

const rate = (price: string, def: string, store = false) => ({
  store_id: store ? 1 : null,
  store_name: store ? 'Default' : '',
  transaction_type: 1,
  transaction_type_name: 'Rental',
  rate_definition_name: def,
  starts_at: '',
  ends_at: '',
  price,
})

/** Current RMS's products: two give their rates with the list, the rest are asked one by one. */
function fakeRms() {
  const asked: Asked[] = []
  const prices: Record<number, unknown[]> = {
    // Store-wide nought, and the store's own 90: the store's wins.
    151: [rate('0.0', '3 Day Week Rate'), rate('90.0', '3 Day Week Rate', true)],
    // Matched by another name here.
    152: [rate('12.0', 'Daily Rate')],
    // Matched by its id, renamed here.
    153: [rate('150.0', 'Weekly Rate')],
    // No price at all.
    154: [rate('0.0', 'Daily Rate')],
    // Nothing here by this name.
    155: [rate('40.0', 'Daily Rate')],
    // Sale only: never read.
    156: [{ ...rate('5.0', 'Daily Rate'), transaction_type: 2, transaction_type_name: 'Sale' }],
    // Set here by hand at another price.
    157: [rate('30.0', 'Daily Rate')],
  }
  const products = [
    { id: 151, name: 'd&b Y10P', rental_rates: prices[151] },
    { id: 152, name: 'Shure SM 58', rental_rates: prices[152] },
    { id: 153, name: '100m Lighting multi core' },
    { id: 154, name: 'Gaffer tape' },
    { id: 155, name: 'Mystery haze machine' },
    { id: 156, name: 'Batteries AA', allowed_stock_type_name: 'Sale' },
    { id: 157, name: 'DI box' },
  ]
  const fetch = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname.replace('/api/v1', '')
    asked.push({ method: init?.method ?? 'GET', path, query: url.searchParams })
    if (path === '/products') {
      const page = Number(url.searchParams.get('page'))
      const per = Number(url.searchParams.get('per_page'))
      const list = products.slice((page - 1) * per, page * per)
      return Response.json({ products: list, meta: { total_row_count: products.length } })
    }
    const m = /^\/products\/(\d+)\/rates$/.exec(path)
    if (m) return Response.json({ rates: prices[Number(m[1])] ?? [] })
    return new Response('{}', { status: 404 })
  }) as typeof globalThis.fetch
  return { fetch, asked }
}

const noWait = { gapMs: 0, sleep: async () => {} }

async function office(withRms = true) {
  const rms = fakeRms()
  const { app, db } = await server(withRms ? { currentRms: { subdomain: 'sessionhire', apiKey: 'key-123', fetch: rms.fetch, ...noWait } } : {})
  const colly = await staff(app, db, 'Colly Hewson', IPHONE, 'phone-c0ffee')
  const get = async <T>(url: string) => {
    const res = await app.inject({ url, cookies: colly.cookies })
    expect(res.statusCode).toBe(200)
    return res.json() as T
  }
  const post = (url: string) => app.inject({ method: 'POST', url, cookies: colly.cookies })
  const prices = async () => {
    const pulled = (await get<{ changes: { entity: string; id: string; data: ProductPrice | null }[] }>('/api/sync/pull?after=0')).changes
    const out: Record<string, ProductPrice | null> = {}
    for (const c of pulled) if (c.entity === 'productPrice') out[c.id] = c.data
    return out
  }
  const send = async (...cmds: Cmd[]) => {
    for (const [name, args] of cmds) expect((await colly.send(name, args)).status).toBe('applied')
  }
  return { app, rms, get, post, prices, send, colly }
}

type Cmd = { [N in CommandName]: [N, CommandInput<N>] }[CommandName]

const model = (id: string, name: string, more: { aliases?: string[]; listId?: string } = {}): Cmd => [
  'model.create',
  { id, name, department: 'audio', category: '', tracking: 'bulk', isCase: false, valueCents: null, notes: '', ...more },
]

describe('hire prices from Current RMS', () => {
  it('says nothing to do without a key, and turns a read down', async () => {
    const { get, post } = await office(false)
    expect(await get<RmsPricesStatus>('/api/rms/prices')).toMatchObject({ configured: false, running: null, last: null, products: 0, plan: null })
    expect((await post('/api/rms/prices/read')).statusCode).toBe(409)
  })

  it('reads each product’s rental price, the store’s own first, only ever asking', async () => {
    const { app, rms, get, post } = await office()
    expect((await post('/api/rms/prices/read')).statusCode).toBe(202)
    await app.rmsPrices.done
    expect(rms.asked.every((a) => a.method === 'GET')).toBe(true)
    // Rates came with the list for two; the sale-only product is never asked about.
    expect(rms.asked.filter((a) => a.path.endsWith('/rates')).map((a) => a.path)).toEqual(['/products/153/rates', '/products/154/rates', '/products/155/rates', '/products/157/rates'])
    const status = await get<RmsPricesStatus>('/api/rms/prices')
    expect(status).toMatchObject({ configured: true, running: null, products: 6, last: { products: 6, error: null, stopped: false } })
    // Nothing on the stock list yet: everything priced is unmatched.
    expect(status.plan?.unmatched.map((u) => u.name)).toEqual(['100m Lighting multi core', 'd&b Y10P', 'DI box', 'Mystery haze machine', 'Shure SM 58'])
  })

  it('fills in what has no price, keeps one set by hand unless ticked, follows Current RMS for its own, and says so in History', async () => {
    const { app, get, post, prices, send } = await office()
    await send(
      model('y10p', 'd&b Y10P'),
      model('sm58', 'Shure SM58', { aliases: ['Shure SM 58'] }),
      model('lxmulti', 'Lighting multicore 100 m', { listId: '153' }),
      model('tape', 'Gaffer tape'),
      model('di', 'DI box'),
      model('hazer', 'Hazer'),
      ['price.product', { modelId: 'di', dayCents: 2500 }]
    )
    await post('/api/rms/prices/read')
    await app.rmsPrices.done

    const { plan } = await get<RmsPricesStatus>('/api/rms/prices')
    expect(plan!.fill.map((r) => [r.modelId, r.dayCents, r.rate])).toEqual([
      ['y10p', 9000, 'week3'],
      ['lxmulti', 15000, 'weekly'],
      ['sm58', 1200, 'daily'],
    ])
    expect(plan!.fill.find((r) => r.modelId === 'lxmulti')!.rmsName).toBe('100m Lighting multi core')
    expect(plan!.differs.map((r) => [r.modelId, r.was?.dayCents, r.dayCents])).toEqual([['di', 2500, 3000]])
    expect(plan!.noPrice.map((r) => r.modelId)).toEqual(['tape'])
    expect(plan!.unmatched.map((r) => r.name)).toEqual(['Mystery haze machine'])
    expect(plan!.notInRms).toBe(1)

    await send(['price.fromRms', { overwrite: false }])
    let now = await prices()
    expect(now.y10p).toEqual({ id: 'y10p', dayCents: 9000, rate: 'week3', fromRms: true })
    expect(now.sm58).toEqual({ id: 'sm58', dayCents: 1200, rate: 'daily', fromRms: true })
    expect(now.lxmulti).toMatchObject({ dayCents: 15000, rate: 'weekly' })
    // Set by hand, kept.
    expect(now.di).toEqual({ id: 'di', dayCents: 2500 })
    expect((await get<RmsPricesStatus>('/api/rms/prices')).plan).toMatchObject({ fill: [], update: [], same: 3 })

    // Current RMS's own follows a change there; a price typed here becomes the office's.
    await app.inject({ method: 'POST', url: '/api/rms/prices/read' })
    await send(['price.product', { modelId: 'sm58', dayCents: 1500 }])
    const { plan: after } = await get<RmsPricesStatus>('/api/rms/prices')
    expect(after!.differs.map((r) => r.modelId).sort()).toEqual(['di', 'sm58'])

    // Ticked, the office's are replaced too.
    await send(['price.fromRms', { overwrite: true }])
    now = await prices()
    expect(now.di).toEqual({ id: 'di', dayCents: 3000, rate: 'daily', fromRms: true })
    expect(now.sm58).toMatchObject({ dayCents: 1200, fromRms: true })

    const history: HistoryPage = await get('/api/history?limit=20')
    expect(history.entries.filter((e) => e.command === 'price.fromRms').map((e) => e.what)).toEqual([
      'Filled in hire prices from Current RMS, over prices set here too',
      'Filled in hire prices from Current RMS',
    ])
  })

  it('turns a fill-in down before the prices have been read', async () => {
    const { colly } = await office()
    const res = await colly.send('price.fromRms', { overwrite: false })
    expect(res).toMatchObject({ status: 'rejected' })
  })
})

describe('choosing a hire price', () => {
  it('maps Current RMS’s rate definitions to the app’s rules', () => {
    expect(['Daily Rate', '3 Day Week Rate', 'Weekly Rate', 'Weeks and Days', 'Hourly'].map(ruleOfRateDefinition)).toEqual(['daily', 'week3', 'weekly', null, null])
  })

  it('takes a rate in force today, the store’s over the store-wide one, and nought as none', () => {
    const past = { ...rate('70.0', 'Daily Rate', true), ends_at: '2020-01-01T00:00:00Z' }
    expect(hireRate([rate('50.0', 'Daily Rate'), past])).toEqual({ priceCents: 5000, rateDefinition: 'Daily Rate' })
    expect(hireRate([rate('0.0', 'Daily Rate')])).toEqual({ priceCents: null, rateDefinition: '' })
  })

  it('matches a product’s own name before another’s other name', () => {
    const plan = rmsPricePlan(
      [{ id: 1, name: 'SM58', priceCents: 1000, rateDefinition: 'Daily Rate' }],
      [
        { id: 'a', name: 'Beta 58', aliases: ['SM58'] },
        { id: 'b', name: 'sm58' },
      ],
      () => undefined
    )
    expect(plan.fill.map((r) => r.modelId)).toEqual(['b'])
  })
})
