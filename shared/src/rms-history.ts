import type { RmsOpportunity } from './current-rms-api.ts'
import { irishToday } from './day.ts'

/** The day in Ireland of a time Current RMS gave: its UTC date is the day before for anything from midnight to 1am in summer. */
export const rmsDay = (at: string | null | undefined): string | undefined => (at ? irishToday(new Date(at)) : undefined)

/**
 * Current RMS's quoting history, put to use (ADR 0092): each opportunity
 * matched to the job the calendars brought in for it, what each product or
 * service was last charged, and how each client's quotes went. Statuses
 * there can't be trusted as won or lost (310 quotes were still
 * "provisional" with their dates long past), so what went ahead is an
 * order, and a quote whose days are past with no order didn't.
 */

/** Whether an opportunity went ahead: an order not cancelled; not: lost, dead, cancelled, or a quote whose days are past; open: still to come. */
export type RmsOutcome = 'ahead' | 'not' | 'open'

export function rmsOutcome(o: { state: string; status: string; startsAt: string | null; endsAt: string | null }, today: string): RmsOutcome {
  const status = o.status.toLowerCase()
  if (status === 'lost' || status === 'dead' || status === 'cancelled') return 'not'
  if (o.state.toLowerCase() === 'order') return 'ahead'
  const last = rmsDay(o.endsAt ?? o.startsAt)
  return last && last < today ? 'not' : 'open'
}

/** A name to compare by: lower case, letters and digits, with "Ltd", "Limited" and "The" left out. */
export function rmsNameKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|ltd|limited|dac|plc|teo)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Words that say nothing of which job it is. */
const COMMON = new Set([
  ...['and', 'of', 'the', 'a', 'at', 'in', 'on', 'for', 'to', 'dry', 'hire', 'event', 'events', 'show', 'job', 'day', 'days', 'night', 'party', '2024', '2025', '2026', '2027'],
  // A quote's name often says its day ("Thursday 3 December"), which says nothing of which job it is.
  ...['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  ...['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  ...['jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec'],
])
const words = (s: string) => new Set(rmsNameKey(s).split(' ').filter((w) => w.length > 1 && !COMMON.has(w)))

/**
 * Whether two jobs' names are alike: most of the words that say which job it is are in both. All of them, or at least
 * two and half of the longer name's ("Nissan Launch" and "Nissan Launch Dublin"); one word of two ("KPMG Launch" and
 * "Launch Party") isn't. Years, days and words like "show" are left out, so "Web Summit 2025" is "Web Summit".
 */
export function namesAlike(a: string, b: string): boolean {
  const x = words(a)
  const y = words(b)
  const most = Math.max(x.size, y.size)
  if (!most) return false
  const both = [...x].filter((w) => y.has(w)).length
  return both === most || (both >= 2 && both / most >= 0.5)
}

/** Whether two clients' names are the same company, as each system spells it: equal, or one starts the other ("Verve" and "Verve Live"). */
export function sameClient(a: string, b: string): boolean {
  const x = rmsNameKey(a)
  const y = rmsNameKey(b)
  if (!x || !y) return false
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `)
}

export interface RmsToMatch {
  id: number
  subject: string
  client: string
  startsAt: string | null
  endsAt: string | null
}

export interface JobToMatch {
  id: string
  name: string
  client: string
  /** Its first and last days, from its phases. */
  start: string
  end: string
}

export interface RmsMatch {
  opportunityId: number
  /** The job it's most likely for, and whether that's sure enough to link with one press for many. */
  projectId: string | null
  sure: boolean
  /** Every job that could be it, likeliest first, for the office to choose from. */
  candidates: { projectId: string; score: number }[]
}

const addDay = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** What a job needs, besides its days, to be suggested: the same client, or most of the words of its name. */
const KIN = 3

/**
 * Each opportunity's likeliest job: one whose days meet its days (give or take a day, for getting ready), scored by
 * the client, the words of its name, and starting the same day. Only suggested with the same client or most of its
 * name's words: the days alone, or a word or two in common, are only offered to choose from. Sure when the best has
 * the client or most of its words, starts within a day, and no other job comes close.
 */
export function matchOpportunities(opps: readonly RmsToMatch[], jobs: readonly JobToMatch[]): RmsMatch[] {
  const sorted = [...jobs].sort((a, b) => a.start.localeCompare(b.start))
  return opps.map((o) => {
    const start = rmsDay(o.startsAt)
    const end = rmsDay(o.endsAt ?? o.startsAt)
    if (!start || !end) return { opportunityId: o.id, projectId: null, sure: false, candidates: [] }
    const from = addDay(start, -1)
    const to = addDay(end, 1)
    const said = words(o.subject)
    const candidates: RmsMatch['candidates'] = []
    const kin = new Set<string>()
    for (const j of sorted) {
      if (j.start > to) break
      if (j.end < from) continue
      let score = 0
      if (j.client && o.client && sameClient(j.client, o.client)) score += 3
      const has = words(j.name)
      const both = [...said].filter((w) => has.has(w)).length
      // Most of its name: all of it, or at least two words and half. One word of two ("KPMG Launch", "Launch Party") isn't.
      if (both) score += both === said.size || (both >= 2 && both / said.size >= 0.5) ? 3 : 1
      if (score >= KIN) kin.add(j.id)
      if (j.start === start) score += 1
      // A job on the same days is offered whatever its name, for the office to choose; it's only suggested with more.
      candidates.push({ projectId: j.id, score })
    }
    candidates.sort((a, b) => b.score - a.score || a.projectId.localeCompare(b.projectId))
    const best = candidates[0]
    const next = candidates[1]
    const sure = !!best && best.score >= 4 && (!next || best.score - next.score >= 2)
    return { opportunityId: o.id, projectId: best && kin.has(best.projectId) ? best.projectId : null, sure: sure && kin.has(best!.projectId), candidates: candidates.slice(0, 5) }
  })
}

/** An opportunity as the matching screen lists it, with the job it's linked to and the job it looks like it's for. */
export interface RmsMatchRow {
  opportunity: Pick<RmsOpportunity, 'id' | 'number' | 'subject' | 'client' | 'state' | 'status' | 'startsAt' | 'endsAt' | 'netCents'>
  linked: string | null
  suggested: RmsMatch
}

/** An open quote in Current RMS with no job here, as the master calendar draws it (ADR 0134): its days in Ireland. */
export interface RmsOnCalendar {
  id: number
  number: string
  subject: string
  client: string
  /** Current RMS's own word for it: Provisional, Reserved, Open. */
  status: string
  start: string
  end: string
}

export interface RmsMatches {
  rows: RmsMatchRow[]
  /** The jobs that come up, by id, so the screen can name them. */
  jobs: Record<string, { name: string; client: string; start: string; end: string }>
}

export interface RmsClientStats {
  client: string
  quotes: number
  ahead: number
  /** Went ahead or didn't: the ones still to come aren't counted either way. */
  decided: number
  /** Of those decided, the share that went ahead, as a whole percentage; null with none decided. */
  winPct: number | null
  /** The usual discount, off what the lines came to, across those that went ahead, to one place; null with none. */
  discountPct: number | null
  /** Before VAT, of those that went ahead. */
  aheadCents: number
  lastOn: string | null
}

/** How each client's quotes went in Current RMS, most quoted first. */
export function rmsClients(
  opps: readonly { client: string; state: string; status: string; startsAt: string | null; endsAt: string | null; netCents: number; undiscountedCents: number }[],
  today: string
): RmsClientStats[] {
  const by = new Map<string, RmsClientStats & { off: number; before: number }>()
  for (const o of opps) {
    const key = rmsNameKey(o.client)
    if (!key) continue
    let c = by.get(key)
    if (!c) by.set(key, (c = { client: o.client.trim(), quotes: 0, ahead: 0, decided: 0, winPct: null, discountPct: null, aheadCents: 0, lastOn: null, off: 0, before: 0 }))
    c.quotes++
    const out = rmsOutcome(o, today)
    if (out !== 'open') c.decided++
    if (out === 'ahead') {
      c.ahead++
      c.aheadCents += o.netCents
      if (o.undiscountedCents > 0) {
        c.before += o.undiscountedCents
        c.off += Math.max(0, o.undiscountedCents - o.netCents)
      }
    }
    const on = rmsDay(o.startsAt) ?? null
    if (on && (!c.lastOn || on > c.lastOn)) c.lastOn = on
  }
  return [...by.values()]
    .map(({ off, before, ...c }) => ({
      ...c,
      winPct: c.decided ? Math.round((c.ahead / c.decided) * 100) : null,
      discountPct: before ? Math.round((off / before) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.quotes - a.quotes || a.client.localeCompare(b.client))
}

/** What something was last charged in Current RMS: for one, a period, after the line's discount. */
export interface RmsCharge {
  /** The price for one for a period, before and after the line's discount. */
  priceCents: number
  unitCents: number
  discountPct: number
  /** "Weekly Rate", "3 Day Week Rate", "Daily Rate", or blank. */
  rate: string
  client: string
  number: string
  opportunityId: number
  on: string | null
}

export interface RmsLastCharged {
  /** Asked by the names a line goes by; each answered with the last to this client and the last to anyone. */
  [name: string]: { client: RmsCharge | null; any: RmsCharge | null }
}

/** The most names a quote asks about at once: a product's own and its other names, for every line. */
export const MOST_LAST_CHARGED_NAMES = 600
