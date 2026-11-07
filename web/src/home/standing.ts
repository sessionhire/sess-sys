import { canApproveLeave, kindOf, standing, STANDING_HEADINGS, type Ability, type JobView, type PersonView, type Role, type Standing, type StandingKey, type View } from '@sh/shared'

/**
 * How things stand, for Home (ADR 0033): every count Home can show, each
 * with where it's sorted out. The lists are worked out in one place
 * (shared/src/sync/standing.ts), and a count is the number of rows in its
 * list: it lands on that list's heading there, which says the same number
 * (Move 3 of the sweep of 6 November 2026). Home picks which to show by who
 * it's shown for; this says what each one is.
 */

/** Who Home is shown for: the personas in docs/personas.md. */
export type HomeFor = 'company' | 'department' | 'warehouse' | 'me'

export interface Tile {
  key: StandingKey
  count: number
  /** What the count is of, after the number: "answers to check". */
  label: string
  href: string
  /** The part of that screen it counted, by its heading, landed on when it's tapped (audit, 20 October 2026, finding 4). */
  part?: string
  /** Something stopping work, drawn as bad; something late that wants a look, drawn amber; otherwise neutral. */
  tone?: 'bad' | 'warn'
  /** The list's filters it counted with, so the list it opens shows just those (audit, 5 November 2026, finding 20). */
  filters?: Record<string, string>
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

/** The departments people are in, each once, by name: the ones a head of department can pick. */
export function departmentsIn(people: readonly PersonView[]): string[] {
  const out: string[] = []
  for (const p of people) if (!p.archived && p.department && !out.some((d) => d.toLowerCase() === p.department!.toLowerCase())) out.push(p.department)
  return out.sort((a, b) => a.localeCompare(b))
}

/** The jobs on a day, by a phase on it: going ahead or quoted, never an enquiry (audit finding 22), the cancelled or the lost. */
export function jobsOn(view: View, day: string): JobView[] {
  return view.jobs.jobs.filter((j) => j.status !== 'cancelled' && j.status !== 'lost' && j.status !== 'enquiry' && j.phases.some((p) => p.start <= day && p.end >= day))
}

/**
 * Jobs from tomorrow to a week on, by when they start: the week ahead. Held
 * to Today's rule and the Jobs by week chart's (audit, 20 October 2026,
 * finding 32): going ahead or quoted, never an enquiry; gigs and hires are
 * the work, and the errands and meetings are said apart, behind one line.
 */
export function weekAhead(view: View, today: string): { work: JobView[]; errands: JobView[] } {
  const end = addDays(today, 7)
  const all = view.jobs.jobs
    .filter((j) => j.status !== 'cancelled' && j.status !== 'lost' && j.status !== 'enquiry' && j.span && j.span.end > today && j.span.start <= end && !j.phases.some((p) => p.start <= today && p.end >= today))
    .sort((a, b) => a.span!.start.localeCompare(b.span!.start) || a.name.localeCompare(b.name))
  const work = (j: JobView) => kindOf(j) === 'gig' || kindOf(j) === 'hire'
  return { work: all.filter(work), errands: all.filter((j) => !work(j)) }
}

/**
 * What each count needs before it's offered: a tile opens a page to act
 * on, so it's only for someone who can (ADR 0034 point 7; audit, 20
 * October 2026, finding 3). Leave is for whoever approves it, whatever
 * their role.
 */
const NEEDS: Record<StandingKey, Ability | 'approve-leave'> = {
  late: 'crew',
  answers: 'crew',
  'crew-needed': 'crew',
  timesheets: 'crew',
  certificates: 'crew',
  leave: 'approve-leave',
  'to-pick': 'stock',
  'still-out': 'stock',
  'kit-short': 'kit',
  faults: 'stock',
  'cant-go': 'stock',
  'damaged-stopped': 'stock',
  'tests-soon': 'stock',
  vehicles: 'stock',
  counts: 'stock',
  'no-answer': 'jobs',
  'tasks-late': 'jobs',
  'tasks-nobody': 'jobs',
  // Whoever reads quotes' money: the office and directors (ADR 0042).
  quotes: 'money',
  'to-invoice': 'money',
}

/**
 * A count's words, one and more than one, the screen it opens, and what draws it in a tone. It lands on its list's
 * heading there (STANDING_HEADINGS), and counts that list's rows, never anything else in them, so the two say one number.
 */
interface TileSpec<K extends StandingKey> {
  one: string
  many: string
  href: string
  filters?: Record<string, string>
  tone?: (list: Standing[K]) => Tile['tone']
}

const TILES: { [K in StandingKey]: TileSpec<K> } = {
  late: { one: 'person running late, not yet noted', many: 'people running late, not yet noted', href: '#crew' },
  answers: { one: 'answer to check', many: 'answers to check', href: '#crew' },
  'crew-needed': { one: 'call still needs crew', many: 'calls still need crew', href: '#crew' },
  timesheets: { one: 'timesheet to approve', many: 'timesheets to approve', href: '#crew/timesheets' },
  leave: { one: 'leave request waiting on you', many: 'leave requests waiting on you', href: '#crew/leave' },
  certificates: { one: 'certificate or document running out', many: 'certificates and documents running out', href: '#crew/people' },
  'to-pick': { one: 'job to pick for today or tomorrow', many: 'jobs to pick for today or tomorrow', href: '#stock' },
  // Amber once one is past its days to come back and two more, as its row is (ADR 0109): the day after a job is the warehouse's work.
  'still-out': {
    one: 'job with kit still out after it',
    many: 'jobs with kit still out after them',
    href: '#stock',
    tone: (list) => (list.some((k) => k.late) ? 'warn' : undefined),
  },
  'kit-short': { one: 'kit line short for a confirmed job', many: 'kit lines short for confirmed jobs', href: '#stock', tone: () => 'bad' },
  faults: { one: 'repair open', many: 'repairs open', href: '#stock/repairs', tone: (list) => (list.some((f) => f.stops) ? 'bad' : undefined) },
  // Apart from the repairs that don't stop anything (audit, 5 November 2026, finding 69), in the words of their group on the
  // Repairs page and counted as it lists them, a repair each: a report of three cables is one, as its row is.
  'damaged-stopped': { one: "damaged, can't go out", many: "damaged, can't go out", href: '#stock/repairs', tone: () => 'bad' },
  // Each lands on its own group of Inspections due, whose heading says the same number.
  'cant-go': { one: "item can't go out until tested", many: "items can't go out until tested", href: '#stock/testing', tone: () => 'bad' },
  'tests-soon': { one: 'inspection due in 30 days', many: 'inspections due in 30 days', href: '#stock/testing' },
  // Run out on a check it needs on the road, a vehicle can't be booked (ADR 0047).
  vehicles: {
    one: 'vehicle check running out',
    many: 'vehicle checks running out',
    href: '#stock/vehicles',
    tone: (list) => (list.some((r) => r.ranOut && r.kind !== 'service') ? 'bad' : undefined),
  },
  counts: { one: 'place to count this week', many: 'places to count this week', href: '#stock/count' },
  'tasks-late': { one: 'job with a task late', many: 'jobs with a task late', href: '#jobs', filters: { tasks: 'late' } },
  'tasks-nobody': {
    // Only the jobs starting within a fortnight (Move 10 of the sweep of 6 November 2026): one months off is how the company
    // works, not a signal.
    one: 'job starting within a fortnight with nobody named on its next task',
    many: 'jobs starting within a fortnight with nobody named on the next task',
    href: '#jobs',
    filters: { tasks: 'nobody-soon' },
  },
  'no-answer': { one: 'job whose dates passed with no answer', many: 'jobs whose dates passed with no answer', href: '#jobs/board' },
  // Sent a week or more ago with no answer (ADR 0081): amber, as each of its rows on Quotes is, at the top of Waiting for an
  // answer, whose heading says this number after how many are waiting (Move 10 of the sweep of 6 November 2026).
  quotes: { one: 'quote worth a call', many: 'quotes worth a call', href: '#quotes', tone: () => 'warn' },
  'to-invoice': { one: 'job through, not invoiced', many: 'jobs through, not invoiced', href: '#quotes' },
}

function tile<K extends StandingKey>(key: K, all: Standing): Tile {
  const spec: TileSpec<K> = TILES[key]
  const list: Standing[K] = all[key]
  const count = list.length
  return { key, count, label: count === 1 ? spec.one : spec.many, href: spec.href, part: STANDING_HEADINGS[key], tone: spec.tone?.(list), filters: spec.filters }
}

/** Every count Home knows that this person can act on, narrowed to a department when one is given, keyed for picking. */
export function tiles(view: View, today: string, me: PersonView | undefined, can: (a: Ability) => boolean, department?: string): Partial<Record<StandingKey, Tile>> {
  const all = standing(view, today, { me, department })
  const approver = canApproveLeave(me)
  const out: Partial<Record<StandingKey, Tile>> = {}
  for (const key of Object.keys(TILES) as StandingKey[]) {
    const needs = NEEDS[key]
    // Timesheets only while the company uses them (ADR 0090).
    if ((key === 'timesheets' && !view.office.useTimesheets) || !(needs === 'approve-leave' ? approver : can(needs))) continue
    out[key] = tile(key, all)
  }
  return out
}

/** The first of Needs attention's two groups, drawn full size over the housekeeping, with its heading and the sentence over both. */
export interface FirstGroup {
  heading: string
  hint: string
  keys: ReadonlySet<StandingKey>
}

/**
 * What stops the next fortnight's work, drawn first and full size; the rest
 * is housekeeping, smaller and under it (audit, 20 October 2026, finding
 * 33), so at volume, when nothing is zero, the soon still stands out.
 */
export const SOON: FirstGroup = {
  heading: 'The next fortnight',
  hint: "What stops the next fortnight's work first, then the housekeeping. Each goes once it's sorted.",
  keys: new Set(['late', 'crew-needed', 'kit-short', 'cant-go', 'still-out', 'to-pick']),
}

/**
 * The office's own work, in the order they work through it (docs/personas.md, O; Move 10 of the sweep of 6 November
 * 2026): anyone running late, the answers to check, the calls still needing crew, the timesheets to approve, the quotes
 * worth a call, the jobs whose dates passed with no answer, the jobs through and not invoiced, and the documents running out. Named for what it is, as most
 * of it isn't the next fortnight's: the warehouse's and the heads' counts are the housekeeping under it.
 */
const OFFICE_FIRST: readonly StandingKey[] = ['late', 'answers', 'crew-needed', 'timesheets', 'quotes', 'no-answer', 'to-invoice', 'certificates']
const OFFICE: FirstGroup = {
  heading: 'Waiting on the office',
  hint: "What's waiting on the office first, then the housekeeping. Each goes once it's sorted.",
  keys: new Set(OFFICE_FIRST),
}

/** Which counts each view of Home shows, in order: the first is what that person reaches for first. */
export const TILES_FOR: Record<HomeFor, readonly StandingKey[]> = {
  // The quotes worth a call beside the dates passed with no answer, the other count of what's being sold.
  company: ['late', 'answers', 'crew-needed', 'kit-short', 'still-out', 'to-pick', 'faults', 'damaged-stopped', 'cant-go', 'timesheets', 'leave', 'certificates', 'vehicles', 'counts', 'quotes', 'no-answer', 'to-invoice', 'tasks-late', 'tasks-nobody'],
  // Only what can be narrowed to a department: crew calls by their own department (ADR 0046); kit still out is the job's, not a department's.
  // Leave is whoever's waits on them, as an approver is a person (ADR 0024).
  department: ['late', 'answers', 'crew-needed', 'leave', 'timesheets', 'certificates', 'kit-short', 'faults', 'damaged-stopped', 'cant-go', 'tests-soon'],
  warehouse: ['to-pick', 'still-out', 'kit-short', 'faults', 'damaged-stopped', 'cant-go', 'counts', 'tests-soon', 'vehicles'],
  me: ['leave'],
}

/**
 * The Company view's counts for whoever is looking (Colly's question 5 of the sweep of 6 November 2026): the same counts
 * in the viewer's order, in the one view, as the Menu's line for Home says. The office's own work comes first for the
 * office; everyone else keeps what stops the next fortnight's work first.
 */
export function companyTiles(role: Role | undefined): { keys: readonly StandingKey[]; first: FirstGroup } {
  if (role !== 'office') return { keys: TILES_FOR.company, first: SOON }
  return { keys: [...OFFICE_FIRST, ...TILES_FOR.company.filter((k) => !OFFICE.keys.has(k))], first: OFFICE }
}
