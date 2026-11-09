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
  weekBars,
  type MonthEntry,
  type CalendarShow,
  type QuoteStatus,
  type View,
} from '@sh/shared'
import { useMemo, type CSSProperties, type MouseEvent } from 'react'
import { Icon } from '../Icon.tsx'
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
 * It looks like Google Calendar, which the office already reads (Colly, 9
 * November 2026): from 900px across a month grid with small type, each job
 * one bar over its days, today's number circled; on a phone, Google's
 * schedule, the days with something on as a list adding to the page's
 * height (no box that scrolls inside the page: the captive-scroll rule).
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

      {/* Google Calendar's bar: Today, then back and on a month, then which jobs. */}
      <div className="cal-bar-top">
        <div className="cal-steps">
          <a className="button" href={at({ month: now })} aria-current={thisMonth ? 'date' : undefined}>
            Today
          </a>
          <a className="button cal-step" href={at({ month: addMonths(month, -1) })} aria-label="Previous month" title="Previous month">
            <Icon name="back" />
          </a>
          <a className="button cal-step" href={at({ month: addMonths(month, 1) })} aria-label="Next month" title="Next month">
            <Icon name="next" />
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
        {/* A desk: the month as Google draws it, a row a week, each job one bar over its days. */}
        <div className="cal-grid">
          <div className="cal-weekdays" aria-hidden="true">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          {cal.weeks.map((w) => (
            <Week key={w[0]!.day} week={w} today={now} />
          ))}
        </div>
        {/* A phone: Google's schedule, the date on the left and what's on to the right, only the days with something on. */}
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

/** "1 Mar" on the first of a month, as Google Calendar does; otherwise just the number. */
const dayNumber = (day: string) => (day.endsWith('-01') ? dayLabel(day).split(' ').slice(1).join(' ') : String(Number(day.slice(8))))

function Week({ week, today }: { week: MonthDay[]; today: string }) {
  const { bars, lanes } = weekBars(week)
  return (
    <div className="cal-week" style={{ '--lanes': lanes } as CSSProperties}>
      {week.map((d, i) => {
        const isToday = d.day === today
        return (
          <div
            key={d.day}
            className={['cal-cell', !d.inMonth && 'out', isToday && 'today', d.day < today && 'past'].filter(Boolean).join(' ')}
            style={{ gridColumn: i + 1 }}
            aria-current={isToday ? 'date' : undefined}
          >
            <a className="cal-date" href={`#jobs/plan/week/${mondayOf(d.day)}`} title="Open its week on the planner">
              <span className="sr-only">{dayLabel(d.day)}</span>
              <span aria-hidden="true">{dayNumber(d.day)}</span>
            </a>
            {d.holiday && <small className="holiday-name">{d.holiday}</small>}
          </div>
        )
      })}
      {bars.map((b) => {
        const said = words(b)
        const when = b.span > 1 ? `${dayLabel(b.firstDay)} to ${dayLabel(b.lastDay)}` : dayLabel(b.firstDay)
        const className = ['cal-job', 'cal-span', b.tentative ? 'dashed' : 'solid', b.before && 'cont-l', b.after && 'cont-r', b.pending && 'pending'].filter(Boolean).join(' ')
        return (
          <a
            key={`${b.jobId}-${b.from}`}
            className={className}
            href={`#jobs/${b.jobId}`}
            style={{ gridColumn: `${b.from + 1} / span ${b.span}`, gridRow: b.lane + 2 }}
            title={`${b.name}: ${said} (${when})`}
          >
            <b>{b.name}</b>
            <small>{said}</small>
            <span className="sr-only">, {when}</span>
          </a>
        )
      })}
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
          <span className="sr-only">{dayLabel(d.day)}</span>
          <small aria-hidden="true">{dayLabel(d.day).slice(0, 3)}</small>
          <span className="cal-num" aria-hidden="true">
            {Number(d.day.slice(8))}
          </span>
        </a>
        {d.holiday && <small className="holiday-name">{d.holiday}</small>}
      </h3>
      {d.entries.length > 0 ? (
        <ul>
          {d.entries.map((e) => (
            <li key={e.jobId}>
              <Entry e={e} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Nothing on</p>
      )}
    </li>
  )
}

/** What a bar or a day's entry says after the job's name: an enquiry or quote says so first. */
function words(e: { tentative: boolean; status: MonthEntry['status']; quote?: QuoteStatus; phases: string[]; pending: boolean }): string {
  return [e.tentative && [STATUS_LABELS[e.status], e.quote && QUOTE_WORDS[e.quote]].filter(Boolean).join(', '), e.phases.join(', '), e.pending && WAITING_TO_SYNC]
    .filter(Boolean)
    .join(' · ')
}

function Entry({ e }: { e: MonthEntry }) {
  const said = words(e)
  const className = ['cal-job', e.tentative ? 'dashed' : 'solid', e.pending && 'pending'].filter(Boolean).join(' ')
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
