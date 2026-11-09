import {
  addMonths,
  CALENDAR_SHOW_LABELS,
  CALENDAR_SHOWS,
  dayLabel,
  isDay,
  masterCalendar,
  mondayOf,
  monthLabel,
  plural,
  STATUS_LABELS,
  type MonthDay,
  type MonthEntry,
  type CalendarShow,
  type QuoteStatus,
  type View,
} from '@sh/shared'
import { useMemo, type MouseEvent } from 'react'
import { WAITING_TO_SYNC } from '../StatusPill.tsx'
import { useToday } from '../view.ts'
import { Top } from './common.tsx'
import { JobViews } from './PlanScreen.tsx'

/**
 * Jobs › Calendar (ADR 0123): the master calendar. A month, every job that
 * is on and every one that might be, together: confirmed solid, enquiries
 * and quotes dashed with their word on them, as on the planner. It answers
 * "how full is that day, and how full could it get?" in one look, before a
 * yes to a new enquiry. It reads only and writes nowhere, Google least of
 * all; a job is opened to change it, a day to plan its week.
 *
 * From 900px across it is a month grid; on a phone, the days with something
 * on as a list, adding to the page's height (no box that scrolls inside the
 * page: the captive-scroll rule).
 */

interface Place {
  month: string
  show: CalendarShow
}

/** #jobs/calendar/2026-11-01, with /confirmed or /potential to narrow it. */
export function calendarPlace(hash: string, now: string): Place {
  const [, , month, show] = hash.split('/')
  return { month: addMonths(month && isDay(month) ? month : now, 0), show: (CALENDAR_SHOWS as readonly string[]).includes(show ?? '') ? (show as CalendarShow) : 'all' }
}

export function calendarHref(p: Partial<Place> & { month: string }): string {
  return `#jobs/calendar/${addMonths(p.month, 0)}${p.show && p.show !== 'all' ? `/${p.show}` : ''}`
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Where a job's newest quote stands, in the words the Quotes page uses. */
const QUOTE_WORDS: Record<QuoteStatus, string> = { draft: 'quote not sent', sent: 'quote sent', accepted: 'quote accepted', declined: 'quote turned down' }

export function CalendarScreen({ view, hash }: { view: View; hash: string }) {
  const now = useToday()
  const place = calendarPlace(hash, now)
  const { month, show } = place
  const cal = useMemo(() => masterCalendar(view.jobs, month, show, (id) => view.money.currentOf(id)?.status), [view.jobs, view.money, month, show])
  const at = (changes: Partial<Place>) => calendarHref({ ...place, ...changes })
  // Which jobs is a toggle, not a move, so it keeps focus, as the planner's rows do.
  const pick = (to: CalendarShow) => (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.focus()
    location.hash = at({ show: to })
  }
  const days = cal.weeks.flat()
  const anything = days.some((d) => d.inMonth && d.entries.length > 0)
  const thisMonth = addMonths(now, 0) === month

  return (
    <div className="app crew jobs master-cal">
      <Top view={view} views={<JobViews current="calendar" />} heading={monthLabel(month)} sub={<p>{summary(cal.confirmed, cal.potential, show)}</p>} />

      <div className="plan-bar">
        <div className="steps">
          <a className="button" href={at({ month: addMonths(month, -1) })} aria-label="Previous month">
            ‹ Previous
          </a>
          <a className="button" href={at({ month: now })} aria-current={thisMonth ? 'date' : undefined}>
            This month
          </a>
          <a className="button" href={at({ month: addMonths(month, 1) })} aria-label="Next month">
            Next ›
          </a>
        </div>
        <div className="filters" role="group" aria-label="Which jobs">
          {CALENDAR_SHOWS.map((s) => (
            <button key={s} type="button" aria-pressed={show === s} onClick={pick(s)}>
              {CALENDAR_SHOW_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <p className="cal-key hint">
        <span className="cal-swatch solid" aria-hidden="true" /> Confirmed <span className="cal-swatch dashed" aria-hidden="true" /> Potential: an enquiry or a quote
      </p>

      <section className="card cal-card" aria-label={`${monthLabel(month)}, a day at a time`}>
        {!anything && <p className="empty">{emptyWords(show)}</p>}
        <div className="cal-weekdays" aria-hidden="true">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <ol className="cal-days">
          {days.map((d) => (
            <Day key={d.day} d={d} today={now} />
          ))}
        </ol>
      </section>

      {cal.undated.length > 0 && (
        <section className="card cal-undated" aria-labelledby="cal-undated">
          <h2 id="cal-undated">No dates yet</h2>
          <p className="hint">Not on the calendar until they have days. Open one to give it some.</p>
          <ul>
            {cal.undated.map((j) => (
              <li key={j.id}>
                <a className={`cal-job ${j.status === 'confirmed' ? 'solid' : 'dashed'}`} href={`#jobs/${j.id}`}>
                  <b>{j.name}</b>
                  <small>{[STATUS_LABELS[j.status], j.pending && WAITING_TO_SYNC].filter(Boolean).join(' · ')}</small>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Day({ d, today }: { d: MonthDay; today: string }) {
  const isToday = d.day === today
  const className = ['cal-day', !d.inMonth && 'out', d.entries.length === 0 && 'free', isToday && 'today', d.day < today && 'past'].filter(Boolean).join(' ')
  return (
    <li className={className} aria-current={isToday ? 'date' : undefined}>
      <h3>
        <a href={`#jobs/plan/week/${mondayOf(d.day)}`} title="Open its week on the planner">
          <span className="cal-full">{dayLabel(d.day)}</span>
          <span className="cal-num" aria-hidden="true">
            {Number(d.day.slice(8))}
          </span>
          {isToday && <small className="today-word">Today</small>}
        </a>
        {d.holiday && <small className="holiday-name">{d.holiday}</small>}
      </h3>
      {d.entries.length > 0 && (
        <ul>
          {d.entries.map((e) => (
            <li key={e.jobId}>
              <Entry e={e} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Entry({ e }: { e: MonthEntry }) {
  const said = [e.tentative && [STATUS_LABELS[e.status], e.quote && QUOTE_WORDS[e.quote]].filter(Boolean).join(', '), e.phases.join(', '), e.pending && WAITING_TO_SYNC].filter(Boolean).join(' · ')
  const className = ['cal-job', e.tentative ? 'dashed' : 'solid', !e.first && 'cont-l', !e.last && 'cont-r', e.pending && 'pending'].filter(Boolean).join(' ')
  return (
    <a className={className} href={`#jobs/${e.jobId}`} title={`${e.name}: ${said}`}>
      <b>{e.name}</b>
      <small>{said}</small>
    </a>
  )
}

function summary(confirmed: number, potential: number, show: CalendarShow): string {
  const on = `${plural(confirmed, 'confirmed job')}`
  const maybe = `${plural(potential, 'potential job')}: enquiries and quotes`
  return show === 'confirmed' ? `${on}.` : show === 'potential' ? `${maybe}.` : `${on}, ${maybe}.`
}

function emptyWords(show: CalendarShow): string {
  return show === 'confirmed' ? 'No confirmed jobs this month.' : show === 'potential' ? 'No enquiries or quotes this month.' : 'Nothing on this month, confirmed or potential.'
}
