import type { RmsPriceProgress, RmsPriceRun, RmsProductPrice } from '@sh/shared'
import { faultForLog, type Db } from '../db.ts'
import { RmsRefused, type RmsApi } from './api.ts'

/**
 * Reading each product's hire price from Current RMS (ADR 0132), for filling
 * the price list in. Current RMS lists its products a hundred a request; a
 * product's rates (store-wide, and the office's own store's where it has
 * one) come with it where Current RMS includes them, else from its own
 * request, a second apiece, so a read of three hundred products takes a few
 * minutes. It runs in the background, says how far it's got, and can be
 * stopped; only a read that finishes replaces the copy kept here, so a
 * stopped one leaves the last whole read in place.
 */

type Log = { info(obj: object, msg: string): void; warn(obj: object, msg: string): void }

type Num = string | number | null | undefined
interface ApiRate {
  store_id?: number | null
  store_name?: string | null
  transaction_type?: number | null
  transaction_type_name?: string | null
  rate_definition_name?: string | null
  rate_definition?: { name?: string | null } | null
  starts_at?: string | null
  ends_at?: string | null
  price?: Num
}
interface ApiProduct {
  id: number
  name?: string | null
  active?: boolean
  allowed_stock_type_name?: string | null
  rental_rates?: ApiRate[] | null
}
interface Meta {
  total_row_count?: number
}

const PRODUCTS_A_PAGE = 100

const cents = (v: Num): number => {
  const n = typeof v === 'number' ? v : Number(v ?? '')
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

const isRental = (r: ApiRate) => (r.transaction_type_name ? /rent/i.test(r.transaction_type_name) : r.transaction_type == null || r.transaction_type === 1)

/** Whether a rate holds today: one with no dates always does. */
function current(r: ApiRate, now: number): boolean {
  const from = r.starts_at ? Date.parse(r.starts_at) : NaN
  const to = r.ends_at ? Date.parse(r.ends_at) : NaN
  return !(from > now) && !(to < now)
}

/**
 * The hire price of a product from its rates: the office's own store's where it has one with a price, as the stock
 * bring-in reads the export (ADR 0056), else the store-wide one. Nought is no price: Current RMS writes it where none
 * was put in.
 */
export function hireRate(rates: readonly ApiRate[], now = Date.now()): { priceCents: number | null; rateDefinition: string } {
  const rental = rates.filter((r) => isRental(r) && current(r, now) && cents(r.price) > 0)
  const store = rental.find((r) => r.store_id != null || !!r.store_name)
  const best = store ?? rental[0]
  if (!best) return { priceCents: null, rateDefinition: '' }
  return { priceCents: cents(best.price), rateDefinition: (best.rate_definition_name ?? best.rate_definition?.name ?? '').slice(0, 100) }
}

class Stopped extends Error {}

export class RmsPriceReader {
  private progress: RmsPriceProgress | null = null
  private stopping = false
  /** The read under way, for tests and for closing the server. */
  done: Promise<void> | undefined

  constructor(
    private readonly db: Db,
    private readonly api: RmsApi | undefined,
    private readonly log?: Log
  ) {}

  get configured() {
    return this.api !== undefined
  }

  get running(): RmsPriceProgress | null {
    return this.progress && { ...this.progress }
  }

  async last(): Promise<RmsPriceRun | null> {
    const { rows } = await this.db.reads.query<Record<string, any>>('SELECT started_at, finished_at, products, error, stopped FROM rms_price_reads ORDER BY id DESC LIMIT 1')
    const r = rows[0]
    return r
      ? { startedAt: new Date(r.started_at).toISOString(), finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null, products: r.products, error: r.error, stopped: r.stopped }
      : null
  }

  /** The copy from the last whole read. */
  async kept(): Promise<RmsProductPrice[]> {
    const { rows } = await this.db.reads.query<{ id: number; name: string; price_cents: number | null; rate_definition: string }>(
      'SELECT id, name, price_cents, rate_definition FROM rms_products ORDER BY id'
    )
    return rows.map((r) => ({ id: r.id, name: r.name, priceCents: r.price_cents, rateDefinition: r.rate_definition }))
  }

  /** Start a read in the background. False when one is already running or there's no key. */
  start(): boolean {
    if (!this.api || this.progress) return false
    this.stopping = false
    this.progress = { stage: 'products', done: 0, total: 0, startedAt: new Date().toISOString() }
    this.done = this.run(this.api, this.progress).finally(() => {
      this.progress = null
    })
    return true
  }

  /** Stop after the request in hand; the last whole read stays. */
  stop(): boolean {
    if (!this.progress) return false
    this.stopping = true
    return true
  }

  private async run(api: RmsApi, progress: RmsPriceProgress) {
    const { rows } = await this.db.query<{ id: string }>('INSERT INTO rms_price_reads (started_at) VALUES ($1) RETURNING id', [progress.startedAt])
    const runId = rows[0]!.id
    let read = 0
    let error: string | null = null
    const check = () => {
      if (this.stopping) throw new Stopped()
    }
    try {
      // Every product that can be hired, active or not, in the order of their ids so none is missed as pages go by.
      const products: ApiProduct[] = []
      for (let page = 1; ; page++) {
        check()
        const got = await api.read<{ products?: ApiProduct[]; meta?: Meta }>('/products', { page, per_page: PRODUCTS_A_PAGE, filtermode: 'all', 'q[s][]': ['id asc'] })
        const list = (got.products ?? []).filter((p) => typeof p.id === 'number' && !products.some((q) => q.id === p.id))
        products.push(...list)
        progress.done = products.length
        progress.total = got.meta?.total_row_count ?? products.length
        if (list.length < PRODUCTS_A_PAGE || (got.meta?.total_row_count !== undefined && products.length >= got.meta.total_row_count) || page >= 100) break
      }
      const hired = products.filter((p) => !/^sale$/i.test(p.allowed_stock_type_name ?? ''))

      // Each product's rates, from the list where Current RMS gave them, else asked for one by one.
      progress.stage = 'rates'
      progress.done = 0
      progress.total = hired.length
      const found: RmsProductPrice[] = []
      for (const p of hired) {
        check()
        const rates = Array.isArray(p.rental_rates) ? p.rental_rates : ((await api.read<{ rates?: ApiRate[] }>(`/products/${p.id}/rates`)).rates ?? [])
        found.push({ id: p.id, name: (p.name ?? '').slice(0, 200), ...hireRate(rates) })
        read++
        progress.done = read
      }

      // A whole read replaces the copy.
      await this.db.transaction(async (tx) => {
        await tx.query('DELETE FROM rms_products')
        for (const f of found)
          await tx.query('INSERT INTO rms_products (id, name, price_cents, rate_definition) VALUES ($1, $2, $3, $4)', [f.id, f.name, f.priceCents, f.rateDefinition])
      })
      this.log?.info({ products: read }, "Read Current RMS's hire prices")
    } catch (err) {
      if (err instanceof Stopped) error = null
      else {
        error = err instanceof RmsRefused ? err.message : "Something went wrong reading Current RMS's prices; the last whole read is kept."
        this.log?.warn({ err: faultForLog(err) }, "Reading Current RMS's prices failed")
      }
    } finally {
      await this.db
        .query('UPDATE rms_price_reads SET finished_at = now(), products = $2, error = $3, stopped = $4 WHERE id = $1', [runId, read, error, this.stopping])
        .catch(() => {})
    }
  }
}
