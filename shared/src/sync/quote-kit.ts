import { eachDay } from '../crew.ts'
import type { JobView } from './jobs-view.ts'
import { heldAround, type KitView } from './kit-view.ts'
import type { ModelView } from './stock-view.ts'

/**
 * Whether there's enough kit for a quote (ADR 0089), by the same rules as a
 * job's kit (ADR 0031): the job's days, with its days to get kit ready and
 * check it back, from today on, against what other jobs hold. Its own job's
 * kit is left out, since the quote is what the job's kit will be: what's
 * asked is how many of each product the quote's lines want from our own
 * stock, all its lines of that product and the packages that hold it
 * together.
 */

export interface QuoteKitCheck {
  modelId: string
  /** How many the quote's lines want from our own stock. */
  wanted: number
  /** How many we have that can go out (kit-view.ts's `owned`). */
  owned: number
  /** The most it's short on any of the days; 0 when there's enough. */
  short: number
  shortDay: string | undefined
  /** Short by this many if the enquiries and quotes on those days go ahead too; 0 unless more than `short`. */
  ifPencilled: number
  pencilledDay: string | undefined
  /** The jobs that have it out on the day that matters, most first. */
  others: { jobId: string; name: string; qty: number; held: boolean }[]
}

export interface QuoteKitInputs {
  kit: KitView
  models: (modelId: string) => ModelView | undefined
  /** How many of a product are missing or not fit to use (ADR 0018). */
  unusable: (modelId: string) => number
  /** How many are still out with jobs that should have brought them back (ADR 0031). */
  lateOut: (modelId: string) => number
}

/** Each product a quote wants, checked over its job's days; empty for a job with no dates, or whose days are past. */
export function quoteKit(job: Pick<JobView, 'id' | 'span' | 'prepDays' | 'returnDays'>, wanted: ReadonlyMap<string, number>, today: string, x: QuoteKitInputs): Map<string, QuoteKitCheck> {
  const out = new Map<string, QuoteKitCheck>()
  if (!job.span) return out
  const held = heldAround(job, job.span)
  if (held.end < today) return out
  const days = eachDay(held.start < today ? today : held.start, held.end)
  for (const [modelId, want] of wanted) {
    const model = x.models(modelId)
    // Dry hire stock (ADR 0075) is all hired in, so there's none of our own to run short of.
    if (want <= 0 || !model || model.dryHire) continue
    const owned = Math.max(0, model.total - model.racked - x.unusable(modelId) - x.lateOut(modelId))
    const lines = (x.kit.byModel.get(modelId) ?? []).filter((l) => l.projectId !== job.id && l.hold !== 'none' && l.own > 0 && l.held)
    const r: QuoteKitCheck = { modelId, wanted: want, owned, short: 0, shortDay: undefined, ifPencilled: 0, pencilledDay: undefined, others: [] }
    let tightest: string | undefined
    let least = Infinity
    for (const d of days) {
      let heldBy = 0
      let pencilledBy = 0
      for (const l of lines) {
        if (l.held!.start > d || l.held!.end < d) continue
        if (l.hold === 'held') heldBy += l.own
        else pencilledBy += l.own
      }
      const short = Math.max(0, want - Math.max(0, owned - heldBy))
      if (short > r.short) [r.short, r.shortDay] = [short, d]
      const ifPencilled = Math.max(0, want - Math.max(0, owned - heldBy - pencilledBy))
      if (ifPencilled > short && ifPencilled > r.ifPencilled) [r.ifPencilled, r.pencilledDay] = [ifPencilled, d]
      if (owned - heldBy - want < least) [least, tightest] = [owned - heldBy - want, d]
    }
    const on = r.shortDay ?? r.pencilledDay ?? tightest
    if (on) {
      const byJob = new Map<string, QuoteKitCheck['others'][number]>()
      for (const l of lines) {
        if (l.held!.start > on || l.held!.end < on) continue
        const found = byJob.get(l.projectId)
        if (found) found.qty += l.own
        else byJob.set(l.projectId, { jobId: l.projectId, name: l.job?.name ?? 'Another job', qty: l.own, held: l.hold === 'held' })
      }
      r.others = [...byJob.values()].sort((a, b) => Number(b.held) - Number(a.held) || b.qty - a.qty || a.name.localeCompare(b.name))
    }
    out.set(modelId, r)
  }
  return out
}

/** How many of each product a quote's lines want from our own stock: a kit line's, less those hired in, and each package's pieces. */
/** The lines under a rack's line on a quote (ADR 0116): what's built into it, which goes where the rack goes. */
export function inRacks<L extends { id?: string; modelId?: string | null; under?: string | null }>(lines: readonly L[]): Set<L> {
  const racks = new Set(lines.filter((l) => l.modelId && !l.under && l.id).map((l) => l.id))
  return new Set(lines.filter((l) => l.under && racks.has(l.under)))
}

export function quoteWants(
  lines: readonly { id?: string; kind: string; modelId?: string | null; qty: number; subhireQty?: number; packageId?: string; under?: string | null }[],
  packageItems: (packageId: string) => readonly { modelId: string; qty: number }[] | undefined
): Map<string, number> {
  const wanted = new Map<string, number>()
  // A package with its kit as lines under it (ADR 0116) wants that kit, not what the package holds now; what's built into
  // a rack goes with the rack, so isn't wanted on its own.
  const heads = new Set(lines.map((l) => l.under).filter(Boolean))
  const racked = inRacks(lines)
  const add = (modelId: string, n: number) => n > 0 && wanted.set(modelId, (wanted.get(modelId) ?? 0) + n)
  for (const l of lines) {
    if (l.kind !== 'kit' || racked.has(l)) continue
    const own = Math.max(0, l.qty - (l.subhireQty ?? 0))
    if (l.modelId) add(l.modelId, own)
    else if (l.packageId && !(l.id && heads.has(l.id))) for (const i of packageItems(l.packageId) ?? []) add(i.modelId, i.qty * own)
  }
  return wanted
}

/** A product the quote has more of than the job's kit list, and how many to add for the list to hold what was quoted. */
export interface KitToAdd {
  modelId: string
  qty: number
  /** Of those, how many the quote has hired in, and who from. */
  subhireQty: number
  supplier: string
}

/**
 * What a job's kit list is missing of its quote (ADR 0102): each product on the quote's kit lines, and the pieces of
 * each package on it, against all the job's kit lines of that product, whatever phase they're for. Only ever more:
 * kit on the list that isn't on the quote, or more of it, stays, since the list is the warehouse's to change.
 */
export function kitFromQuote(
  lines: readonly { id?: string; kind: string; modelId?: string | null; qty: number; subhireQty?: number; supplier?: string; packageId?: string; under?: string | null }[],
  packageItems: (packageId: string) => readonly { modelId: string; qty: number }[] | undefined,
  kit: readonly { modelId: string; qty: number; subhireQty: number }[]
): KitToAdd[] {
  const heads = new Set(lines.map((l) => l.under).filter(Boolean))
  const racked = inRacks(lines)
  const wanted = new Map<string, { qty: number; subhireQty: number; supplier: string }>()
  const want = (modelId: string, qty: number, subhireQty = 0, supplier = '') => {
    if (qty <= 0) return
    const w = wanted.get(modelId) ?? { qty: 0, subhireQty: 0, supplier: '' }
    wanted.set(modelId, { qty: w.qty + qty, subhireQty: w.subhireQty + subhireQty, supplier: w.supplier || supplier })
  }
  for (const l of lines) {
    if (l.kind !== 'kit' || racked.has(l)) continue
    if (l.modelId) want(l.modelId, l.qty, Math.min(l.qty, l.subhireQty ?? 0), l.supplier ?? '')
    else if (l.packageId && !(l.id && heads.has(l.id))) for (const i of packageItems(l.packageId) ?? []) want(i.modelId, i.qty * l.qty)
  }
  const out: KitToAdd[] = []
  for (const [modelId, w] of wanted) {
    const have = kit.filter((k) => k.modelId === modelId)
    const qty = w.qty - have.reduce((n, k) => n + k.qty, 0)
    if (qty <= 0) continue
    const subhireQty = Math.min(qty, Math.max(0, w.subhireQty - have.reduce((n, k) => n + k.subhireQty, 0)))
    out.push({ modelId, qty, subhireQty, supplier: subhireQty ? w.supplier : '' })
  }
  return out
}

/**
 * How many of a product are free on a job's days (research/quoting.md, feature 2), for the product picker on a quote:
 * the fewest of our own that no confirmed job holds on any of the days, with the job's days to get kit ready and check
 * it back, from today on, as `quoteKit` counts them, less what the quote already wants of it. Undefined for a job with
 * no dates or whose days are past, and for dry hire stock, which is all hired in.
 */
export function kitFree(
  job: Pick<JobView, 'id' | 'span' | 'prepDays' | 'returnDays'>,
  modelId: string,
  wanted: number,
  today: string,
  x: QuoteKitInputs
): number | undefined {
  // One wanted, so quoteKit checks it; the tightest day's free count is what's owned less the most held on any day.
  const check = quoteKit(job, new Map([[modelId, 1]]), today, x).get(modelId)
  if (!check) return undefined
  const held = heldAround(job, job.span!)
  const days = eachDay(held.start < today ? today : held.start, held.end)
  const lines = (x.kit.byModel.get(modelId) ?? []).filter((l) => l.projectId !== job.id && l.hold === 'held' && l.own > 0 && l.held)
  let most = 0
  for (const d of days) {
    let on = 0
    for (const l of lines) if (l.held!.start <= d && l.held!.end >= d) on += l.own
    if (on > most) most = on
  }
  return Math.max(0, check.owned - most - wanted)
}
