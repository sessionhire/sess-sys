import { RATE_LABELS, RATE_UNIT, type RateRule } from './quotes.ts'
import { valueLabel } from './stock.ts'

/**
 * Hire prices from Current RMS (ADR 0132). The server reads each product's
 * rental rate from Current RMS and keeps a copy; this works out, from that
 * copy and the stock list, what filling the price list in would change, so
 * the office sees it before anything changes and the server does exactly
 * what was shown.
 *
 * A product here is matched to Current RMS's by the id the stock bring-in
 * kept on it (ADR 0056), else by its name or one of its other names. A
 * price someone set here is kept unless they tick to take Current RMS's
 * over it; one that came from Current RMS before follows Current RMS.
 */

/** A product as Current RMS prices it for hire, kept on the server from the last read. */
export interface RmsProductPrice {
  /** Current RMS's id for the product. */
  id: number
  name: string
  /** Its hire price in cents, for a day or a week as its rule says; null where Current RMS has none (or nought). */
  priceCents: number | null
  /** Current RMS's rate definition, as it names it: "3 Day Week Rate". */
  rateDefinition: string
}

/** Current RMS's three rate definitions, as the app's rules (ADR 0085). Anything else isn't one the app can charge by. */
export function ruleOfRateDefinition(name: string): RateRule | null {
  const n = name.trim().toLowerCase()
  if (/\b3\s*day\s*week\b/.test(n)) return 'week3'
  if (/^week(ly)?( rate)?$/.test(n)) return 'weekly'
  if (/^(daily|day)( rate)?$/.test(n)) return 'daily'
  return null
}

/** "€55 a day, 3 Day Week", "€120 a week, Weekly". */
export const hirePriceLabel = (cents: number, rule: RateRule) => `${valueLabel(cents)} a ${RATE_UNIT[rule]}, ${RATE_LABELS[rule]}`

export interface PriceModel {
  id: string
  name: string
  aliases?: readonly string[]
  /** Current RMS's id, as the stock bring-in kept it. */
  listId?: string
}

export interface PriceHere {
  dayCents: number
  rate?: RateRule
  /** Set by filling in from Current RMS, not by hand. */
  fromRms?: boolean
}

export interface RmsPriceRow {
  modelId: string
  /** The product's name here. */
  name: string
  /** Its name in Current RMS, where it differs. */
  rmsName: string
  dayCents: number
  rate: RateRule
  /** What it is here now, for those that change. */
  was?: { dayCents: number; rate?: RateRule }
}

export interface RmsPricePlan {
  /** Matched, with no price here yet. */
  fill: RmsPriceRow[]
  /** Matched, with a price that came from Current RMS before (or the same price with no rule yet): it follows Current RMS. */
  update: RmsPriceRow[]
  /** Matched, with a different price set here by hand: kept unless ticked. */
  differs: RmsPriceRow[]
  /** Already the same here. */
  same: number
  /** In Current RMS with a hire price, but no product here goes by its name or id. */
  unmatched: { id: number; name: string }[]
  /** Matched, but Current RMS has no hire price for it, or charges it by a rule the app doesn't have. */
  noPrice: { modelId: string; name: string }[]
  /** Products here Current RMS has nothing for. */
  notInRms: number
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** What filling in from Current RMS would do, to the stock list and price list as they are now. */
export function rmsPricePlan(rms: readonly RmsProductPrice[], models: readonly PriceModel[], prices: (modelId: string) => PriceHere | undefined): RmsPricePlan {
  const byListId = new Map<string, PriceModel>()
  const byName = new Map<string, PriceModel>()
  for (const m of models) if (m.listId) byListId.set(m.listId, m)
  // A product's own name before another's other name.
  for (const m of models) for (const a of m.aliases ?? []) if (!byName.has(key(a))) byName.set(key(a), m)
  for (const m of models) byName.set(key(m.name), m)

  const plan: RmsPricePlan = { fill: [], update: [], differs: [], same: 0, unmatched: [], noPrice: [], notInRms: 0 }
  const matched = new Set<string>()
  // By id first, so a renamed product isn't taken by another's name.
  const order = [...rms].sort((a, b) => Number(!byListId.has(String(a.id))) - Number(!byListId.has(String(b.id))) || a.id - b.id)
  for (const p of order) {
    const m = byListId.get(String(p.id)) ?? byName.get(key(p.name))
    if (!m || matched.has(m.id)) {
      if (!m && p.priceCents) plan.unmatched.push({ id: p.id, name: p.name })
      continue
    }
    matched.add(m.id)
    const rule = ruleOfRateDefinition(p.rateDefinition)
    if (!p.priceCents || !rule) {
      plan.noPrice.push({ modelId: m.id, name: m.name })
      continue
    }
    const row: RmsPriceRow = { modelId: m.id, name: m.name, rmsName: key(p.name) === key(m.name) ? '' : p.name, dayCents: p.priceCents, rate: rule }
    const here = prices(m.id)
    if (!here) plan.fill.push(row)
    else if (here.dayCents === p.priceCents && (here.rate ?? 'daily') === rule) plan.same++
    else {
      const was = { dayCents: here.dayCents, ...(here.rate ? { rate: here.rate } : {}) }
      // The same price with only the rule to add, or one Current RMS gave before: it follows Current RMS.
      if (here.fromRms || (here.dayCents === p.priceCents && here.rate === undefined)) plan.update.push({ ...row, was })
      else plan.differs.push({ ...row, was })
    }
  }
  plan.notInRms = models.filter((m) => !matched.has(m.id)).length
  const byNameOrder = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
  plan.fill.sort(byNameOrder)
  plan.update.sort(byNameOrder)
  plan.differs.sort(byNameOrder)
  plan.unmatched.sort(byNameOrder)
  plan.noPrice.sort(byNameOrder)
  return plan
}

/** The rows a fill-in writes: those with no price and those following Current RMS, and those set here only when ticked. */
export const rmsPriceWrites = (plan: RmsPricePlan, overwrite: boolean): RmsPriceRow[] => [...plan.fill, ...plan.update, ...(overwrite ? plan.differs : [])]

/** Where reading Current RMS's prices has got to. */
export interface RmsPriceProgress {
  /** Reading the product list, then each product's rates. */
  stage: 'products' | 'rates'
  done: number
  total: number
  startedAt: string
}

export interface RmsPriceRun {
  startedAt: string
  finishedAt: string | null
  /** Products read. */
  products: number
  error: string | null
  stopped: boolean
}

/** Hire prices from Current RMS, on Admin: whether it can be read, how far a read has got, and what filling in would do. */
export interface RmsPricesStatus {
  configured: boolean
  running: RmsPriceProgress | null
  last: RmsPriceRun | null
  /** Products read from Current RMS and kept. */
  products: number
  /** Null until the prices have been read once. */
  plan: RmsPricePlan | null
}
