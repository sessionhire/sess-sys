import { eachDay } from '../crew.ts'
import { kitFromQuote, type KitToAdd } from './quote-kit.ts'

/**
 * The quote is the job's plan (ADR 0126; audit of the quote flow, 8 November 2026, findings 4, 8 and 9): its kit is the
 * job's kit, pencilled while it's quoted; its crew lines are the calls the job will need; and a line's days are the days
 * the job works, not every day from its first to its last.
 */

/** The note on a kit line the quote put on the job's list, which the quote may take back while the job isn't confirmed. */
export const FROM_THE_QUOTE = 'From the quote'

/**
 * The days a job works: each day of its phases, counted once, so the week between a build and a show isn't charged.
 * The days from its first to its last for a job whose phases cover them all, and 1 for a job with no days yet.
 */
export function workDays(job: { phases: readonly { start: string; end: string }[]; span?: { start: string; end: string } }): number {
  const days = new Set<string>()
  for (const p of job.phases) if (p.start <= p.end) for (const d of eachDay(p.start, p.end)) days.add(d)
  if (days.size) return days.size
  return job.span ? Math.max(1, eachDay(job.span.start, job.span.end).length) : 1
}

type QuoteKitLine = { id?: string; kind: string; modelId?: string | null; qty: number; subhireQty?: number; supplier?: string; packageId?: string; under?: string | null }
type JobKitLine = { id: string; modelId: string; qty: number; subhireQty: number; phaseId: string | null; notes: string }

/** What to do to a job's kit list for it to hold what its draft quote wants. */
export interface KitToMatch {
  /** Products the quote wants more of than the list has, each to go on as a line of its own. */
  add: KitToAdd[]
  /** Lines the quote put on that it now wants fewer of: their new count. */
  change: { id: string; qty: number; subhireQty: number }[]
  /** Lines the quote put on that it no longer wants at all. */
  remove: string[]
}

/**
 * How a job's kit list follows its draft quote while the job is pencilled in: whatever the quote wants that the list
 * hasn't got goes on (as `kitFromQuote` finds it), and where the list has more than the quote wants, only the lines the
 * quote put there (noted "From the quote", for the whole job) come down, newest first by id, so kit the warehouse added
 * or changed by hand is never taken off.
 */
export function kitToMatch(
  lines: readonly QuoteKitLine[],
  packageItems: (packageId: string) => readonly { modelId: string; qty: number }[] | undefined,
  kit: readonly JobKitLine[]
): KitToMatch {
  const add = kitFromQuote(lines, packageItems, kit)
  // What the quote wants of each product, as kitFromQuote counts it: an empty list shows all of it.
  const wanted = new Map(kitFromQuote(lines, packageItems, []).map((k) => [k.modelId, k.qty]))
  const change: KitToMatch['change'] = []
  const remove: string[] = []
  const byModel = new Map<string, JobKitLine[]>()
  for (const k of kit) byModel.set(k.modelId, [...(byModel.get(k.modelId) ?? []), k])
  for (const [modelId, list] of byModel) {
    let over = list.reduce((n, k) => n + k.qty, 0) - (wanted.get(modelId) ?? 0)
    if (over <= 0) continue
    const ours = list.filter((k) => k.phaseId === null && k.notes === FROM_THE_QUOTE).sort((a, b) => b.id.localeCompare(a.id))
    for (const k of ours) {
      if (over <= 0) break
      const less = Math.min(over, k.qty)
      over -= less
      if (less === k.qty) remove.push(k.id)
      else change.push({ id: k.id, qty: k.qty - less, subhireQty: Math.min(k.subhireQty, k.qty - less) })
    }
  }
  return { add, change, remove }
}

/** A role the quote has crew for that the job hasn't asked for yet, and how many more. */
export interface CallToMake {
  role: string
  needed: number
}

/**
 * The crew on a quote that the job's calls don't cover yet (finding 8): each role on its crew lines, by name in any case,
 * against the job's calls for that role that aren't cancelled. Only ever more, as with kit: a call the office made bigger
 * or for another role stays as it is.
 */
export function callsFromQuote(
  lines: readonly { kind: string; what: string; qty: number; extra?: unknown }[],
  calls: readonly { role: string; needed: number; status: string }[]
): CallToMake[] {
  const key = (s: string) => s.trim().toLowerCase()
  const wanted = new Map<string, CallToMake>()
  for (const l of lines) {
    if (l.kind !== 'crew' || l.extra || !l.what.trim() || l.qty <= 0) continue
    const found = wanted.get(key(l.what))
    if (found) found.needed += Math.ceil(l.qty)
    else wanted.set(key(l.what), { role: l.what.trim(), needed: Math.ceil(l.qty) })
  }
  const out: CallToMake[] = []
  for (const [k, w] of wanted) {
    const have = calls.filter((c) => c.status !== 'cancelled' && key(c.role) === k).reduce((n, c) => n + c.needed, 0)
    if (w.needed > have) out.push({ role: w.role, needed: Math.min(100, w.needed - have) })
  }
  return out
}
