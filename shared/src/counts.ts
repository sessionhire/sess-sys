import { z } from 'zod'
import { text, whole } from './plain.ts'
import { MAX_QTY, normaliseNumber } from './stock.ts'

/**
 * Stocktakes and rolling counts (ADR 0030): a place or a case counted on
 * a phone, compared with the record, and kept as a record itself. Like a
 * scan, a count says what was there at a moment, so the server keeps it
 * whatever has changed since; the fixes are the commands that already
 * exist, each with its own rules. The comparison and the week's list are
 * worked out on each phone (sync/counts-view.ts).
 */

const id = z.string().min(1).max(64)
const at = z.string().datetime({ offset: true })

/** A quarter: each week, enough places are on the list that every one is counted about this often. */
export const ROLLING_WEEKS = 13

/**
 * What a count said of one item:
 * - found: expected here, and scanned;
 * - not-found: expected here, and not scanned;
 * - out, missing, repair: kept here but away (out with a job, reported missing, damaged and can't go out);
 *   scanned or not, never newly missing;
 * - elsewhere: scanned here, kept somewhere else (or nowhere yet);
 * - in-case: scanned here, kept in a case that's here;
 * - retired: scanned here, retired.
 * An item kept elsewhere that's out with a job or reported missing is said as out or missing, scanned.
 */
export const COUNT_SAID = ['found', 'not-found', 'out', 'missing', 'repair', 'elsewhere', 'in-case', 'retired'] as const
export type CountSaid = (typeof COUNT_SAID)[number]

export interface CountItem {
  assetId: string
  said: CountSaid
  scanned: boolean
  /** Where it was kept when counted, for one kept somewhere else. */
  placeId?: string | null
  caseId?: string | null
  /** The job it was out with, for one out. */
  projectId?: string | null
}

/** A product expected or counted: what the record said, what was counted (null for not counted), and how many were away. */
export interface CountProduct {
  modelId: string
  recorded: number
  counted: number | null
  /** Out with jobs, or reported missing, wherever they're kept: see `countSetTo`. */
  away: number
}

export interface CountSummary {
  /** Items expected here: kept here, and neither out with a job nor reported missing. */
  expected: number
  found: number
  notFound: number
  /** Scanned here, kept somewhere else. */
  elsewhere: number
  /** Scanned here though retired, reported missing or out with a job, and numbers no item has. */
  unexpected: number
  /** Products expected and left blank. */
  uncounted: number
  /** Products whose count the fix would lower, or raise. */
  short: number
  over: number
}

export interface Count {
  id: string
  placeId: string | null
  caseId: string | null
  /** By the phone's clock. */
  startedAt: string
  finishedAt: string
  /** Who counted: a person on the Crew tab, or nobody said. */
  by: string | null
  items: CountItem[]
  /** Codes scanned that no item has, as read. */
  unknown: string[]
  products: CountProduct[]
  summary: CountSummary
}

/**
 * A count in progress, as the phone keeps it (in its browser storage, so a
 * reload loses nothing) until Finish sends it as `count.record`.
 */
export interface CountDraft {
  id: string
  placeId: string | null
  caseId: string | null
  startedAt: string
  by: string | null
  /** Items scanned, each once, in the order scanned. */
  scanned: string[]
  /** Codes scanned that no item has, each once. */
  unknown: string[]
  /** How many of each product were counted, by product; one left blank isn't here. */
  counted: Record<string, number>
  /** Products added as there though not expected, in the order added. */
  added: string[]
  /** Items labelled on this count, each put on here as its label was scanned (ADR 0175). */
  labelled?: string[]
  /** The product the last label on this count went on, offered for the next. */
  labelAs?: string
}

/**
 * A count under way on someone's phone (ADR 0177), said to every device so
 * two people don't count the same bay without knowing: begun when the
 * count starts, and over when it's finished (its record has the same id)
 * or discarded.
 */
export interface CountStart {
  /** The count's own id: its record, once finished, has the same. */
  id: string
  placeId: string | null
  caseId: string | null
  by: string | null
  startedAt: string
  /** When it was discarded; a finished one has its record instead. */
  endedAt: string | null
}

/** A count begun this long ago and never finished nor discarded is left behind on some phone, and no longer said as under way. */
export const UNDER_WAY_HOURS = 18

export interface CountEntities {
  count: Count
  countStart: CountStart
}
export const COUNT_ENTITY_NAMES = ['count', 'countStart'] as const

const many = whole(0, MAX_QTY, 'How many')
const where = { placeId: id.nullable(), caseId: id.nullable() }
const CODE_MAX = 100

/**
 * A code no item has, as a count keeps it: a Session Hire number in its
 * own form, anything else as read, with no control characters (a barcode's
 * separators) and cut short, so a maker's QR code holding a long web
 * address can't leave a count that can never be finished.
 */
export function unknownCode(code: string): string {
  const number = normaliseNumber(code)
  if (number) return number
  const read = code.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return read.length > CODE_MAX ? `${read.slice(0, CODE_MAX - 1)}…` : read
}

export const countCommandSchemas = {
  /** A count started on a phone, so others see who's counting where (ADR 0177). Sent again, it changes nothing. */
  'count.begin': z.object({ id, ...where, by: id.nullable(), startedAt: at }).refine((c) => !!c.placeId !== !!c.caseId, { message: 'Say what is being counted: a place or a case.' }),
  /** A count discarded: no longer under way. */
  'count.end': z.object({ id }),
  /** Always kept, unless the place or the case never existed. The fixes are their own commands. */
  'count.record': z
    .object({
      id,
      ...where,
      startedAt: at,
      finishedAt: at,
      by: id.nullable(),
      items: z
        .array(
          z.object({
            assetId: id,
            said: z.enum(COUNT_SAID),
            scanned: z.boolean(),
            placeId: id.nullable().optional(),
            caseId: id.nullable().optional(),
            projectId: id.nullable().optional(),
          })
        )
        // A few hundred kilobytes at most, so a phone's waiting counts go up with the rest of what it sends.
        .max(5000, 'A count can hold up to 5,000 items. Count a place this big a shelf at a time.'),
      unknown: z.array(text(CODE_MAX, 'A number')).max(500, 'A count can hold up to 500 numbers no item has.'),
      products: z
        .array(z.object({ modelId: id, recorded: many, counted: many.nullable(), away: many }))
        .max(2000, 'A count can hold up to 2,000 products.'),
      summary: z.object({
        expected: many,
        found: many,
        notFound: many,
        elsewhere: many,
        unexpected: many,
        uncounted: many,
        short: many,
        over: many,
      }),
    })
    // No check that it finished after it started: a phone's clock can be set back mid-count, and the count still happened.
    .refine((c) => !!c.placeId !== !!c.caseId, { message: 'Say what was counted: a place or a case.' }),
} as const

/**
 * What to set a count of counted kit to (ADR 0030): what was counted, plus
 * those away (out with jobs, or reported missing), but never more than was
 * recorded unless more than that were counted. Counted kit stays in its
 * count while it's out, and the scans don't say which shelf it came from,
 * so this never shrinks what's owned because kit is out.
 */
export function countSetTo(p: Pick<CountProduct, 'recorded' | 'counted' | 'away'>): number | null {
  if (p.counted === null) return null
  return Math.max(p.counted, Math.min(p.recorded, p.counted + p.away))
}

const SUMMARY_FIELDS = ['expected', 'found', 'notFound', 'elsewhere', 'unexpected', 'uncounted', 'short', 'over'] as const

/** A summary as stored, read back: a count turned down keeps what the phone sent, whatever that was. */
export function isCountSummary(v: unknown): v is CountSummary {
  return !!v && typeof v === 'object' && SUMMARY_FIELDS.every((k) => typeof (v as Record<string, unknown>)[k] === 'number')
}

const n = (x: number) => x.toLocaleString('en-IE')

/** "9 of 10 found, 1 not found, 1 count short", or "All 10 found, as recorded". */
export function countSummaryWords(s: CountSummary): string {
  const problems = [
    s.notFound > 0 && `${n(s.notFound)} not found`,
    s.elsewhere > 0 && `${n(s.elsewhere)} in the wrong place`,
    s.unexpected > 0 && `${n(s.unexpected)} not expected`,
    s.short > 0 && `${n(s.short)} ${s.short === 1 ? 'count' : 'counts'} short`,
    s.over > 0 && `${n(s.over)} ${s.over === 1 ? 'count' : 'counts'} over`,
    s.uncounted > 0 && `${n(s.uncounted)} ${s.uncounted === 1 ? 'product' : 'products'} not counted`,
  ].filter((p): p is string => !!p)
  // Expected and neither found nor not found: in repair, which isn't said to be missing.
  const repair = s.expected - s.found - s.notFound
  const items =
    s.expected === 0
      ? undefined
      : `${s.found === s.expected ? `All ${n(s.expected)}` : `${n(s.found)} of ${n(s.expected)}`} found${repair > 0 ? `, ${n(repair)} in repair` : ''}`
  if (problems.length === 0) return items ? `${items}, as recorded` : 'All as recorded'
  return [items, ...problems].filter(Boolean).join(', ')
}

/** The most places made at once from a range, so a slip ("Bay 1 to 1000") can't fill the list. */
export const PLACE_RANGE_MAX = 200

/**
 * The places a range names (ADR 0176): "Bay A1 to A20", "Bay A1 to Bay A20",
 * "Shelf 1-12" or "Rack 01 – 10", each its own name with the numbers in
 * between, keeping the first's leading noughts ("Rack 01" … "Rack 10").
 * Undefined for a single name, numbers alone, or a range running backwards, naming a
 * different stem at its end ("Bay A1 to B9"), or of more than
 * PLACE_RANGE_MAX.
 */
export function placeRange(text: string): string[] | undefined {
  // Read by hand rather than by one pattern, so a long run of digits can't make it slow.
  const s = text.trim().slice(0, 200)
  const digitsBefore = (t: string, end: number) => {
    let i = end
    while (i > 0 && t.charCodeAt(i - 1) >= 48 && t.charCodeAt(i - 1) <= 57) i--
    return i
  }
  const toStart = digitsBefore(s, s.length)
  if (toStart === s.length) return undefined
  const to = s.slice(toStart)
  const rest = s.slice(0, toStart)
  const lower = rest.toLowerCase()
  // The separator nearest the end with a number just before it: "to", "-", "–" or "—".
  let cut: { at: number; len: number } | undefined
  for (const sep of ['to', '-', '–', '—'])
    for (let at = lower.lastIndexOf(sep); at >= 0; at = at === 0 ? -1 : lower.lastIndexOf(sep, at - 1)) {
      const left = rest.slice(0, at).trimEnd()
      if (left && digitsBefore(left, left.length) < left.length) {
        if (!cut || at > cut.at) cut = { at, len: sep.length }
        break
      }
    }
  if (!cut) return undefined
  const left = rest.slice(0, cut.at).trimEnd()
  const fromStart = digitsBefore(left, left.length)
  const stem = left.slice(0, fromStart)
  const from = left.slice(fromStart)
  const again = rest.slice(cut.at + cut.len)
  // Numbers alone name no place: "1-3" is more likely a typo than three places called 1, 2 and 3.
  if (!stem.trim()) return undefined
  const end = again.trim().toLowerCase()
  if (end && !stem.trim().toLowerCase().endsWith(end)) return undefined
  const a = Number(from)
  const b = Number(to)
  if (!(b > a) || b - a + 1 > PLACE_RANGE_MAX) return undefined
  const width = from.startsWith('0') ? from.length : 0
  const names: string[] = []
  for (let n = a; n <= b; n++) names.push(`${stem}${String(n).padStart(width, '0')}`)
  return names
}
