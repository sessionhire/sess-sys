import { eachDay } from '../crew-days.ts'
import { publicHolidaysAmong } from '../holidays.ts'
import { STOPPED, type ProjectStatus } from '../jobs.ts'
import type { QuoteStatus } from '../quotes.ts'
import type { JobsView, JobView } from './jobs-view.ts'
import { addDays, addMonths, mondayOf } from './plan.ts'

/**
 * Jobs › Calendar (ADR 0123): a month as a calendar, every job that is on
 * and every one that might be, together. A confirmed job is drawn solid and
 * an enquiry or a quote dashed with its word on it, the planner's grammar
 * (ADR 0010), so the office sees at a glance how full a day is and how full
 * it could get. Worked out on the device from the jobs it holds, like the
 * planner, so it needs no signal and writes nowhere: never to Google.
 */

/** Which jobs are shown: everything, only the confirmed, or only the potential ones (enquiries and quotes). */
export const CALENDAR_SHOWS = ['all', 'confirmed', 'potential'] as const
export type CalendarShow = (typeof CALENDAR_SHOWS)[number]
export const CALENDAR_SHOW_LABELS: Record<CalendarShow, string> = { all: 'Everything', confirmed: 'Confirmed', potential: 'Potential' }

/** One job on one day. */
export interface MonthEntry {
  jobId: string
  name: string
  status: ProjectStatus
  /** An enquiry or a quote: pencilled in. */
  tentative: boolean
  /** Changed on this device and not yet on the server. */
  pending: boolean
  /** The day's phases as the calendar titles them: "Build 1/2", "Show". */
  phases: string[]
  /** Where its newest quote stands, for those the server sends quotes to; none for everyone else. */
  quote?: QuoteStatus
  /** Its first and last day of all, so a run of days reads as one. */
  first: boolean
  last: boolean
}

export interface MonthDay {
  day: string
  /** False for the days of the months either side that fill the first and last weeks. */
  inMonth: boolean
  entries: MonthEntry[]
  /** A public holiday's name (ADR 0024), when it is one. */
  holiday?: string
}

export interface MasterCalendar {
  /** Monday to Sunday, from the week the month starts in to the week it ends in. */
  weeks: MonthDay[][]
  /** Jobs with a day in the month, each counted once. */
  confirmed: number
  potential: number
  /** Jobs still going ahead with no dates yet, so an enquiry isn't lost for having none: enquiries and quotes first. */
  undated: JobView[]
}

export const showsJob = (show: CalendarShow, status: ProjectStatus) => show === 'all' || (show === 'confirmed') === (status === 'confirmed')

/**
 * The month `month` is in, as a calendar. `quoteOf` says where a job's
 * newest quote stands; it is left out, or answers nothing, for a role the
 * server sends no money to (ADR 0042).
 */
export function masterCalendar(jobs: JobsView, month: string, show: CalendarShow = 'all', quoteOf?: (jobId: string) => QuoteStatus | undefined): MasterCalendar {
  const first = addMonths(month, 0)
  const last = addDays(addMonths(month, 1), -1)
  const days = eachDay(mondayOf(first), addDays(mondayOf(last), 6))
  const holidays = publicHolidaysAmong(days)
  const at = new Map<string, MonthDay>(
    days.map((day) => [day, { day, inMonth: day >= first && day <= last, entries: [], ...(holidays[day] ? { holiday: holidays[day] } : {}) }])
  )
  const going = jobs.jobs.filter((j) => !STOPPED.includes(j.status) && showsJob(show, j.status))
  const inMonth = { confirmed: new Set<string>(), potential: new Set<string>() }
  for (const job of going) {
    if (!job.span) continue
    const quote = quoteOf?.(job.id)
    const tentative = job.status !== 'confirmed'
    const byDay = new Map<string, string[]>()
    for (const ph of job.phases) {
      const all = eachDay(ph.start, ph.end)
      all.forEach((d, i) => {
        if (at.has(d)) (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(all.length > 1 ? `${ph.name} ${i + 1}/${all.length}` : ph.name)
      })
    }
    for (const [d, phases] of byDay) {
      const day = at.get(d)!
      day.entries.push({
        jobId: job.id,
        name: job.name,
        status: job.status,
        tentative,
        pending: job.pending || job.phases.some((p) => p.pending),
        phases,
        ...(quote ? { quote } : {}),
        first: d === job.span.start,
        last: d === job.span.end,
      })
      if (day.inMonth) inMonth[tentative ? 'potential' : 'confirmed'].add(job.id)
    }
  }
  // The same order every day, so a job that runs over several sits at the same height where it can: the confirmed, then by when they start.
  const start = new Map(going.map((j) => [j.id, j.span?.start ?? '']))
  for (const day of at.values())
    day.entries.sort(
      (a, b) => Number(a.tentative) - Number(b.tentative) || start.get(a.jobId)!.localeCompare(start.get(b.jobId)!) || a.name.localeCompare(b.name) || a.jobId.localeCompare(b.jobId)
    )
  const weeks: MonthDay[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7).map((d) => at.get(d)!))
  const undated = going.filter((j) => !j.span).sort((a, b) => Number(a.status === 'confirmed') - Number(b.status === 'confirmed') || a.name.localeCompare(b.name))
  return { weeks, confirmed: inMonth.confirmed.size, potential: inMonth.potential.size, undated }
}

/**
 * A job across a run of days in one week, drawn as one bar as Google Calendar
 * draws an event of several days (Colly, 9 November 2026), rather than a box
 * on each day.
 */
export interface WeekBar {
  jobId: string
  name: string
  status: ProjectStatus
  tentative: boolean
  pending: boolean
  quote?: QuoteStatus
  /** Its phases over the run, each once: "Build", "Show". */
  phases: string[]
  /** The column it starts in, Monday 0, and how many days it runs. */
  from: number
  span: number
  /** Its line in the week, 0 at the top. */
  lane: number
  /** It carries on from the week before, or into the week after. */
  before: boolean
  after: boolean
  firstDay: string
  lastDay: string
}

/** A week's jobs as bars, laid out in lines so none overlap: the confirmed first, then the earliest, then the longest. */
export function weekBars(week: readonly MonthDay[]): { bars: WeekBar[]; lanes: number } {
  const runs: WeekBar[] = []
  const seen = new Set<string>()
  for (const day of week)
    for (const e of day.entries) {
      if (seen.has(e.jobId)) continue
      seen.add(e.jobId)
      let i = 0
      while (i < week.length) {
        const at = (n: number) => week[n]!.entries.find((x) => x.jobId === e.jobId)
        if (!at(i)) {
          i++
          continue
        }
        const from = i
        const phases: string[] = []
        while (i < week.length && at(i)) {
          for (const p of at(i)!.phases) {
            const name = p.replace(/ \d+\/\d+$/, '')
            if (!phases.includes(name)) phases.push(name)
          }
          i++
        }
        const first = at(from)!
        const last = at(i - 1)!
        runs.push({
          jobId: e.jobId,
          name: e.name,
          status: e.status,
          tentative: e.tentative,
          pending: e.pending,
          ...(e.quote ? { quote: e.quote } : {}),
          phases,
          from,
          span: i - from,
          lane: 0,
          before: from === 0 && !first.first,
          after: i === week.length && !last.last,
          firstDay: week[from]!.day,
          lastDay: week[i - 1]!.day,
        })
      }
    }
  runs.sort((a, b) => Number(a.tentative) - Number(b.tentative) || a.from - b.from || b.span - a.span || a.name.localeCompare(b.name))
  const taken: boolean[][] = []
  for (const r of runs) {
    let lane = 0
    while ((taken[lane] ??= []).slice(r.from, r.from + r.span).some(Boolean)) lane++
    for (let c = r.from; c < r.from + r.span; c++) taken[lane]![c] = true
    r.lane = lane
  }
  return { bars: runs, lanes: taken.length }
}
