import { crewSuggestion, otherSuggestion, withModel, type Pricing, type Suggestion } from './assistant.ts'
import { STOPPED, type ProjectStatus } from './jobs.ts'
import { MAX_LINES, type QuoteLine } from './quotes.ts'
import { DEPARTMENT_LABELS } from './stock.ts'

/**
 * Start a quote from a past job (ADR 0115). A new quote for a client or a venue the company has worked for before
 * starts from what that job needed: not only its quote, but what actually went out on it, so kit added on site or after
 * the quote comes back too, and says so.
 */

/** A job as the start-from list needs it. */
export interface PastJobRef {
  id: string
  name: string
  clientId: string | null
  venueId: string | null
  status: ProjectStatus
  span: { start: string; end: string } | undefined
}

/** How a past job matches the new one: the same client and venue, the same venue, or the same client. */
export type PastMatch = 'both' | 'venue' | 'client'
export const PAST_MATCH_WORDS: Record<PastMatch, string> = { both: 'Same client and venue', venue: 'Same venue', client: 'Same client' }

/** How many past jobs are offered at most: the closest matches, latest first. */
export const MOST_PAST_JOBS = 6

/**
 * Past jobs like the new one, closest first: the same client and venue, then the same venue, then the same client, the
 * latest of each first. Only jobs that are over and went ahead, and that have something to start from.
 */
export function pastJobsLike<J extends PastJobRef>(
  jobs: readonly J[],
  want: { clientId: string | null; venueId: string | null },
  today: string,
  useful: (jobId: string) => boolean,
  most = MOST_PAST_JOBS
): { job: J; match: PastMatch }[] {
  if (!want.clientId && !want.venueId) return []
  const rank: Record<PastMatch, number> = { both: 0, venue: 1, client: 2 }
  const out: { job: J; match: PastMatch }[] = []
  for (const job of jobs) {
    if (!job.span || job.span.end >= today || STOPPED.includes(job.status)) continue
    const client = !!want.clientId && job.clientId === want.clientId
    const venue = !!want.venueId && job.venueId === want.venueId
    if (!client && !venue) continue
    if (!useful(job.id)) continue
    out.push({ job, match: client && venue ? 'both' : venue ? 'venue' : 'client' })
  }
  return out.sort((a, b) => rank[a.match] - rank[b.match] || b.job.span!.end.localeCompare(a.job.span!.end)).slice(0, most)
}

/** A product on a past job: how many its kit list had (and of those hired in), and how many of its own went out. */
export interface PastKit {
  modelId: string
  listed: number
  subhired: number
  wentOut: number
}

export interface PastJobLines {
  /** The past job's quote that counts, without the travel and subsistence it worked out (those are worked out again). */
  quoteLines: readonly QuoteLine[]
  kit: readonly PastKit[]
  /** Whether anything was scanned or counted out on it at all: if not, its kit list stands for what went. */
  scanned: boolean
  /** The new job's days, which kit is charged for, and the past job's: a line for all its days is for all the new one's. */
  days: number
  pastDays: number
  /** What a package holds now (ADR 0087), so a package's products on the kit list aren't offered again beside it. */
  packageItems?: (packageId: string) => readonly { modelId: string; qty: number }[] | undefined
}

/**
 * What the new quote starts from, each line ticked unless none of it went: the past quote's lines in its order, kit
 * taken at what went out (its own, scanned or counted, and what was hired in), then kit that went beyond the quote.
 * Priced from today's price list; a product or role with no price there keeps what it was charged.
 */
export function pastJobSuggestions(input: PastJobLines, p: Pricing): { s: Suggestion; take: boolean }[] {
  const kit = new Map(input.kit.map((k) => [k.modelId, k]))
  const quoted = new Map<string, number>()
  for (const l of input.quoteLines) if (l.kind === 'kit' && l.modelId) quoted.set(l.modelId, (quoted.get(l.modelId) ?? 0) + l.qty)
  // A package's products went on the kit list with it: they're on the quote, inside the package's line.
  const packaged = new Map<string, number>()
  for (const l of input.quoteLines)
    if (l.packageId) for (const i of input.packageItems?.(l.packageId) ?? []) packaged.set(i.modelId, (packaged.get(i.modelId) ?? 0) + i.qty * l.qty)
  const used = (modelId: string) => {
    const k = kit.get(modelId)
    if (!k) return input.scanned ? 0 : (quoted.get(modelId) ?? 0)
    return input.scanned ? k.wentOut + k.subhired : k.listed
  }
  const went = input.scanned ? 'went out' : 'on the kit list'
  const out: { s: Suggestion; take: boolean }[] = []
  const done = new Set<string>()

  const product = (modelId: string, charged: number | undefined, discountPct: number | undefined): { s: Suggestion; take: boolean } | undefined => {
    const m = p.model(modelId)
    if (!m) return undefined
    const q = quoted.get(modelId) ?? 0
    const n = Math.max(0, used(modelId) - (q ? 0 : (packaged.get(modelId) ?? 0)))
    const base: Suggestion = { key: `past-${modelId}`, kind: 'kit', said: m.name, what: m.name, group: DEPARTMENT_LABELS[m.department], qty: Math.max(1, n || q), days: input.days, per: 'day', modelId: null, how: 'chosen', likely: [], cents: undefined, rate: null }
    let s = withModel(p, base, modelId)
    if (s.cents === undefined && charged !== undefined) s = { ...s, cents: charged }
    if (discountPct) s = { ...s, discountPct }
    if (!q) return { s: { ...s, note: `Not on the quote: ${n} ${went}`, beyond: true }, take: true }
    if (!n) return { s: { ...s, note: `${q} quoted, none ${went}` }, take: false }
    if (n > q) return { s: { ...s, note: `${q} quoted, ${n} ${went}`, beyond: true }, take: true }
    if (n < q) return { s: { ...s, note: `${q} quoted, ${n} ${went}` }, take: true }
    return { s: { ...s, note: 'As quoted' }, take: true }
  }

  input.quoteLines.forEach((l, i) => {
    if (l.extra) return
    if (l.kind === 'kit' && l.modelId) {
      if (done.has(l.modelId)) return
      done.add(l.modelId)
      const o = product(l.modelId, l.unitCents || undefined, l.discountPct)
      if (o) out.push(o)
      return
    }
    const key = `past-line-${i}`
    // Out for all the past job's days: out for all the new one's. Otherwise as it was.
    const out_ = l.out ?? l.days
    const days = out_ === input.pastDays ? input.days : out_
    const s =
      l.kind === 'crew'
        ? crewSuggestion(p, key, l.what, l.qty, days)
        : { ...otherSuggestion(key, l.what, l.qty, l.per ?? 'day', l.per === 'once' ? 1 : days, l.unitCents), kind: l.kind, group: l.group, rate: l.rate ?? null }
    const pack = l.packageId ? { packageId: l.packageId, includes: l.includes ?? '', cents: l.unitCents, what: l.what, said: l.what } : {}
    out.push({ s: { ...s, cents: s.cents ?? l.unitCents, ...pack, ...(l.discountPct ? { discountPct: l.discountPct } : {}), note: 'As quoted' }, take: true })
  })
  // What went beyond the quote: on the kit list or out with the job, not on the quote at all, nor in a package on it.
  const beyond = input.kit.filter((k) => !done.has(k.modelId) && used(k.modelId) > (packaged.get(k.modelId) ?? 0))
  const name = (id: string) => p.model(id)?.name ?? ''
  for (const k of beyond.sort((a, b) => (p.model(a.modelId)?.department ?? '').localeCompare(p.model(b.modelId)?.department ?? '') || name(a.modelId).localeCompare(name(b.modelId)))) {
    done.add(k.modelId)
    const o = product(k.modelId, undefined, undefined)
    if (o) out.push(o)
  }
  return out.slice(0, MAX_LINES)
}
