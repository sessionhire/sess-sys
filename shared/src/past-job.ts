import { crewSuggestion, otherSuggestion, withModel, type Pricing, type Suggestion } from './assistant.ts'
import { inRacks } from './sync/quote-kit.ts'
import { STOPPED, type ProjectStatus } from './jobs.ts'
import { headsKit, MAX_LINES, type QuoteLine } from './quotes.ts'
import { DEPARTMENT_LABELS } from './stock.ts'
import { nameWithLength } from './cable-colours.ts'
import { namesAlike, sameClient } from './rms-history.ts'

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

/** What a past job has in common with the new one: its client, its venue, or a name like it. */
export type PastMatch = 'client' | 'venue' | 'name'
const MATCH_ORDER: readonly PastMatch[] = ['client', 'venue', 'name']

/** What matched, said as the list shows it: "Same client, venue and name", "Same venue", "Similar name". */
export function pastMatchWords(matched: readonly PastMatch[]): string {
  const same = MATCH_ORDER.filter((m) => matched.includes(m))
  if (!same.length) return ''
  if (same.length === 1 && same[0] === 'name') return 'Similar name'
  return `Same ${same.length === 1 ? same[0] : `${same.slice(0, -1).join(', ')} and ${same.at(-1)}`}`
}

/** How many past jobs are offered at most: the closest matches, latest first. */
export const MOST_PAST_JOBS = 6

/**
 * Past jobs like the new one, the most in common first: its client, its venue and a name like it (Colly, 27 November
 * 2026), so a job that shares all three comes before one that shares two, then one; the latest first among those that
 * share as many. Only jobs that are over and went ahead, and that have something to start from.
 */
export function pastJobsLike<J extends PastJobRef>(
  jobs: readonly J[],
  want: { clientId: string | null; venueId: string | null; name?: string },
  today: string,
  useful: (jobId: string) => boolean,
  most = MOST_PAST_JOBS
): { job: J; matched: PastMatch[] }[] {
  const name = want.name?.trim() ?? ''
  if (!want.clientId && !want.venueId && !name) return []
  const out: { job: J; matched: PastMatch[] }[] = []
  for (const job of jobs) {
    if (!job.span || job.span.end >= today || STOPPED.includes(job.status)) continue
    const matched: PastMatch[] = []
    if (want.clientId && job.clientId === want.clientId) matched.push('client')
    if (want.venueId && job.venueId === want.venueId) matched.push('venue')
    if (name && namesAlike(job.name, name)) matched.push('name')
    if (!matched.length || !useful(job.id)) continue
    out.push({ job, matched })
  }
  return out.sort((a, b) => b.matched.length - a.matched.length || b.job.span!.end.localeCompare(a.job.span!.end)).slice(0, most)
}

/** What a Current RMS quote has in common with the new one, as a past job's is read: its client, venue and name. */
export function rmsMatched(o: { client: string; venue?: string | null; subject: string }, want: { client: string; venue: string; name: string }): PastMatch[] {
  const matched: PastMatch[] = []
  if (want.client.trim() && o.client && sameClient(o.client, want.client)) matched.push('client')
  if (want.venue.trim() && o.venue && sameClient(o.venue, want.venue)) matched.push('venue')
  if (want.name.trim() && o.subject && namesAlike(o.subject, want.name)) matched.push('name')
  return matched
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
  // A package with its kit under it (ADR 0116) charged by that kit comes as the kit, each product a line of its own; one
  // charged as a whole comes as its line, as one with no kit under it does. What's built into a rack comes with it.
  // An LED screen (ADR 0207) is charged by its kit too, so it comes the same way.
  const byKit = new Set(input.quoteLines.filter((l) => headsKit(l) && !l.unitCents && input.quoteLines.some((x) => x.under === l.id)).map((l) => l.id))
  const skip = new Set(input.quoteLines.filter((l) => l.under && !byKit.has(l.under)))
  for (const l of inRacks(input.quoteLines)) skip.add(l)
  for (const l of input.quoteLines)
    if (l.packageId && !byKit.has(l.id)) for (const i of input.packageItems?.(l.packageId) ?? []) packaged.set(i.modelId, (packaged.get(i.modelId) ?? 0) + i.qty * l.qty)
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
    const base: Suggestion = { key: `past-${modelId}`, kind: 'kit', said: nameWithLength(m), what: nameWithLength(m), group: DEPARTMENT_LABELS[m.department], qty: Math.max(1, n || q), days: input.days, per: 'day', modelId: null, how: 'chosen', likely: [], cents: undefined, rate: null }
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
    if (l.extra || skip.has(l) || byKit.has(l.id)) return
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
