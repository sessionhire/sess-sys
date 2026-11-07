import { canApproveLeave, crewByDay, kindOf, crewFill, departmentOf, jobsByMonth, jobsByWeek, kitByDay, kitOf, moneyByMonth, myWeeks, dayLabel, daysLabel, eachDay, firstName, leaveDaysLabel, money, moneyMonth, narrower, plural, spanLabel, standing, STANDING_HEADINGS, listHeading, STATUS_LABELS, type Department, type JobView, type PersonView, type StandingKey, type View } from '@sh/shared'
import { glanceParts, HOLDING, nextBooking, OPEN, soonestFirst, type CallView, type OfferView, type ProjectStatus } from '@sh/shared'
import { Fragment, useState } from 'react'
import { asBooking, BookingRow, stoppedBookings } from '../crew/BookingRow.tsx'
import { useMe } from '../crew/Leave.tsx'
import { linkFor } from '../crew/Messages.tsx'
import { Empty } from '../Empty.tsx'
import { Top } from '../jobs/common.tsx'
import { kitShort } from '../jobs/Kit.tsx'
import { BelowZero } from '../jobs/Money.tsx'
import { useToday, useView } from '../view.ts'
import { addDays, companyTiles, departmentsIn, jobsOn, SOON, TILES_FOR, tiles, weekAhead, type FirstGroup, type HomeFor, type Tile } from './standing.ts'
import { StageLine } from '../jobs/StageLine.tsx'
import { Heading } from '../Icon.tsx'
import { Avatar, photoOf } from '../Picture.tsx'
import { arrive } from '../arrival.ts'
import { useAccess } from '../role.ts'
import { Chart, type Series } from './Chart.tsx'
import { Copying, STILL_ARRIVING, useCopying } from './copying.ts'
import { TodoCard } from '../TodoCard.tsx'
import { StillOutRow } from '../stock/StillOut.tsx'

/**
 * Home (ADR 0033): how things stand, for whoever is looking. One screen,
 * shown for the whole company, a department, the warehouse, or me: the
 * personas in docs/personas.md. The view starts from who this person is
 * (their department, from their profile), which they can change, and the
 * phone remembers the choice, as a warehouse phone stays on the warehouse.
 * A count that's nothing isn't shown, so the few that are stand out
 * (healthy is quiet); each opens the screen that sorts it out.
 */

const KEY = 'sh.home'
export interface Saved {
  for: HomeFor
  department?: string
}

function load(): Saved | undefined {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    if (s && ['company', 'department', 'warehouse', 'me'].includes(s.for)) return s
  } catch {
    // Nothing saved, or storage is blocked: start from who they are.
  }
  return undefined
}

export function saveHomeFor(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Private browsing can refuse storage; the choice lasts this visit.
  }
}

const FOR: readonly [HomeFor, string][] = [
  ['company', 'Company'],
  ['department', 'Department'],
  ['warehouse', 'Warehouse'],
  ['me', 'Me'],
]

export function HomeScreen() {
  const view = useView()
  const today = useToday()
  const { me, pick } = useMe(view)
  const departments = departmentsIn(view.crew.people)
  const [saved, setSaved] = useState(load)
  // Nothing chosen yet: a role without crew (staff crew, a freelancer) starts on Me, their own work (audit, 20 October 2026,
  // finding 34); a head of department on their own; everyone else on the company.
  const mayCrew = useAccess().can('crew')
  const shownFor: HomeFor = saved?.for ?? (!mayCrew ? 'me' : me?.department ? 'department' : 'company')
  const department = saved?.department ?? me?.department ?? departments[0]
  const choose = (next: Saved) => {
    saveHomeFor(next)
    setSaved(next)
  }

  return (
    <Copying.Provider value={view.copying !== false}>
      <div className="app home">
        {/* Today's date top right, so Home is the page's one title (Colly, 12 October 2026). */}
        <Top view={view} title="Home" root aside={<span className="top-date">{dayLabel(today)}</span>} />
        {me && <p className="home-day">Hello, {firstName(me)}</p>}

        <div className="views home-for" role="group" aria-label="Show for">
          {FOR.map(([f, label]) => (
            <button
              key={f}
              type="button"
              aria-pressed={shownFor === f}
              onClick={(e) => {
                // A toggle, not a move: it keeps focus, as the Shell expects of one (audit finding 22).
                e.currentTarget.focus()
                choose({ for: f, department })
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* The job steps given to whoever is looking (ADR 0073): their to-do list, on top of whichever view. */}
        {me && <MySteps view={view} me={me} all={shownFor === 'me'} />}
        {shownFor === 'company' && <ForCompany view={view} today={today} me={me} />}
        {shownFor === 'department' && (
          <ForDepartment view={view} today={today} me={me} departments={departments} department={department} onDepartment={(d) => choose({ for: 'department', department: d })} />
        )}
        {shownFor === 'warehouse' && <ForWarehouse view={view} today={today} me={me} />}
        {shownFor === 'me' && <ForMe view={view} today={today} me={me} onPick={pick} />}
      </div>
    </Copying.Provider>
  )
}

/**
 * The counts that aren't nothing, as tiles; a word when all are. Grouped, what
 * stops the next fortnight's work comes first and the housekeeping after,
 * smaller (audit, 20 October 2026, finding 33); for the office, what's
 * waiting on them comes first (Move 10 of the sweep of 6 November 2026).
 */
function Tiles({
  all,
  keys,
  first = SOON,
  title = 'Needs attention',
  clear,
  department,
  grouped = true,
}: {
  all: Partial<Record<StandingKey, Tile>>
  keys: readonly StandingKey[]
  /** The group drawn first and full size, in the order of `keys`; the rest are the housekeeping. */
  first?: FirstGroup
  title?: string
  clear: string
  /** The department counted for; none for the company's or the warehouse's counts, whose lists then open on everyone's. */
  department?: string
  grouped?: boolean
}) {
  const shown = keys.map((k) => all[k]).filter((t): t is Tile => !!t && t.count > 0)
  // Counts this role can't act on aren't offered (ADR 0034), so all clear is only this person's to say, not the company's (audit, 5 November 2026, finding 46).
  const withheld = keys.some((k) => !all[k])
  const copying = useCopying()
  const soon = grouped ? shown.filter((t) => first.keys.has(t.key)) : shown
  const rest = grouped ? shown.filter((t) => !first.keys.has(t.key)) : []
  const list = (tiles: Tile[], className = 'tiles') => (
    <ul className={className}>
      {tiles.map((t) => (
        <li key={t.key}>
          <a className={`tile${t.tone ? ` ${t.tone}` : ''}`} href={t.href} onClick={() => arrive({ hash: t.href, part: t.part, department: department ?? '', filters: t.filters })}>
            <b>{t.count.toLocaleString('en-IE')}</b>
            <span>{t.label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
  return (
    <section className="card standing">
      <h2>{title}</h2>
      {copying ? (
        <p className="all-clear">{STILL_ARRIVING}</p>
      ) : shown.length === 0 ? (
        <p className="all-clear">{withheld ? 'Nothing here for you to sort out.' : clear}</p>
      ) : !grouped ? (
        list(shown)
      ) : (
        <>
          <p className="hint">{first.hint}</p>
          {soon.length > 0 && (
            <>
              <h3 className="group">{first.heading}</h3>
              {list(soon)}
            </>
          )}
          {rest.length > 0 && (
            <>
              <h3 className="group">Housekeeping</h3>
              {list(rest, 'tiles housekeeping')}
            </>
          )}
        </>
      )}
    </section>
  )
}

/** What's on today, a line a job with its crew (audit finding 22); the next one when nothing is. */
function Today({ view, today }: { view: View; today: string }) {
  const on = jobsOn(view, today)
  const ahead = on.length === 0 ? weekAhead(view, today) : undefined
  const next = ahead && [...ahead.work, ...ahead.errands].sort((a, b) => a.span!.start.localeCompare(b.span!.start))[0]
  const copying = useCopying()
  return (
    <section className="card">
      <Heading icon="time">Today{on.length > 0 && !copying ? ` (${on.length})` : ''}</Heading>
      {/* Part of a copy is no answer at all, so nothing here is said as if it were (audit, 5 November 2026, finding 45). */}
      {copying ? (
        <p className="empty">{STILL_ARRIVING}</p>
      ) : on.length === 0 ? (
        <p className="empty">Nothing on today.{next?.span && ` Next: ${next.name}, ${dayLabel(next.span.start)}.`}</p>
      ) : (
        <ul className="job-list">
          {on.map((j) => (
            <li key={j.id}>
              <JobLine job={j} view={view} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** A job in one line: its name, then (in the week ahead) its first day, a quote not yet confirmed, its crew and kit short, as the jobs list says them. */
function JobLine({ job, view, from }: { job: JobView; view: View; from?: boolean }) {
  const crew = crewFill(job.calls)
  const short = kitShort(view.kit.byJob.get(job.id))
  return (
    <a className="job-row today-row" href={`#jobs/${job.id}`}>
      <b>{job.name}</b>
      <span className="side">
        {from && job.span && <small>{dayLabel(job.span.start)}</small>}
        <StageLine job={job} view={view} compact />
        {job.status !== 'confirmed' && <small>{STATUS_LABELS[job.status]}</small>}
        {crew.needed > 0 && (
          <small>
            Crew {crew.booked} of {crew.needed}
          </small>
        )}
        {short && <small className={`flag ${short}`}>Kit short</small>}
      </span>
    </a>
  )
}

/**
 * The gigs and hires starting in the next seven days, a line a job as Today
 * has (audit, 20 October 2026, finding 32), counted in the heading as
 * listed; the errands and meetings behind one line that opens them.
 */
function WeekAhead({ view, today }: { view: View; today: string }) {
  const { work, errands } = weekAhead(view, today)
  const copying = useCopying()
  const rows = (jobs: JobView[]) => (
    <ul className="job-list">
      {jobs.map((j) => (
        <li key={j.id}>
          <JobLine job={j} view={view} from />
        </li>
      ))}
    </ul>
  )
  return (
    <section className="card week-ahead">
      <Heading icon="calendar">The week ahead{work.length > 0 && !copying ? ` (${work.length})` : ''}</Heading>
      {copying ? (
        <p className="empty">{STILL_ARRIVING}</p>
      ) : work.length === 0 && errands.length === 0 ? (
        <Empty>Nothing starts in the next seven days.</Empty>
      ) : (
        <>
          {work.length > 0 ? rows(work) : <p className="empty">No gigs or hires start in the next seven days.</p>}
          {errands.length > 0 && (
            <details className="phase-details errands">
              <summary>{errandsLine(errands, work.length > 0)}</summary>
              {rows(errands)}
            </details>
          )}
        </>
      )}
    </section>
  )
}

/** "and 2 errands and 1 meeting": what's folded, by kind. */
function errandsLine(jobs: readonly JobView[], after: boolean): string {
  const meetings = jobs.filter((j) => kindOf(j) === 'meeting').length
  const errands = jobs.length - meetings
  const said = [errands > 0 && plural(errands, 'errand'), meetings > 0 && plural(meetings, 'meeting')].filter(Boolean).join(' and ')
  return after ? `and ${said}` : said.charAt(0).toUpperCase() + said.slice(1)
}

function ForCompany({ view, today, me }: { view: View; today: string; me: PersonView | undefined }) {
  const { can, role } = useAccess()
  // The same counts in the order of whoever is looking: the office's own work first for the office (Move 10 of the sweep of 6 November 2026).
  const { keys, first } = companyTiles(role)
  const confirmed = view.jobs.jobs.filter((j) => j.status === 'confirmed' && j.span && j.span.end >= today).length
  const pencilled = view.jobs.jobs.filter((j) => (j.status === 'enquiry' || j.status === 'quoted') && (!j.span || j.span.end >= today)).length
  return (
    <>
      <SetUp view={view} />
      {/* What needs someone first, then what's on (audit finding 22). */}
      <Tiles all={tiles(view, today, me, can)} keys={keys} first={first} clear="Nothing waiting on anyone. Everything else is as it should be." />
      <TodoCard view={view} />
      <Today view={view} today={today} />
      <Chart title="Jobs by week" icon="calendar" series={JOBS} columns={jobsByWeek(view.jobs.jobs, today)} empty="No gigs or hires in the next eight weeks." />
      <CrewChart view={view} today={today} />
      <WeekAhead view={view} today={today} />
      <Chart
        title="The season"
        icon="calendar"
        series={JOBS}
        columns={jobsByMonth(view.jobs.jobs, today)}
        empty="No gigs or hires in the six months either side of this one."
        more={
          <p className="hint">
            {plural(confirmed, 'confirmed job')} from today on, and {plural(pencilled, 'enquiry or quote', 'enquiries and quotes')} not yet decided. <a href="#jobs">All jobs</a>
          </p>
        }
      />
      <MoneyCard view={view} today={today} />
    </>
  )
}

/**
 * A new company's first steps, in the order that matters, while it has no crew or no stock yet: office details first, so
 * freelancer links can ring the office, then the crew list, the stock list and the vans. Each goes once it's done, and the card
 * with them (audit, 5 November 2026, finding 100). Only for who can set them up, and never while the copy is still arriving.
 */
function SetUp({ view }: { view: View }) {
  const { can } = useAccess()
  const copying = useCopying()
  if (copying || !can('settings')) return null
  const people = view.crew.people.length > 0
  const stock = view.warehouse.models.length > 0
  if (people && stock) return null
  const steps = [
    !view.office.details && { href: '#admin/company', what: 'Office details', why: 'So freelancer links can ring the office' },
    !people && { href: '#crew/import', what: 'The crew list', why: 'From a spreadsheet, or one at a time under Crew' },
    !stock && { href: '#stock/import', what: 'The stock list', why: 'From Current RMS or a spreadsheet, or one at a time under Stock' },
    view.vehicles.vehicles.length === 0 && { href: '#stock/vehicles', what: 'The vans', why: 'So they can be booked on jobs with a driver' },
  ].filter((x) => !!x)
  return (
    <section className="card set-up" aria-labelledby="set-up-title">
      <Heading icon="company" id="set-up-title">
        To set up
      </Heading>
      <ul className="job-list">
        {steps.map((step) => (
          <li key={step.href}>
            <a className="job-row" href={step.href}>
              <div>
                <b>{step.what}</b>
                <p>{step.why}</p>
              </div>
              <div className="side" aria-hidden="true">
                ›
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** For the director and the office (ADR 0042): this month's quotes and who owes, a tap from Money. */
function MoneyCard({ view, today }: { view: View; today: string }) {
  const sees = useAccess().can('money')
  const m = view.money
  if (!sees || !m.any) return null
  const month = m.months.find((x) => x.key === moneyMonth(today).key)
  const owed = m.owed.reduce((s, o) => s + o.cents, 0)
  const notInvoiced = owed - m.owed.reduce((s, o) => s + o.invoiced, 0)
  const toFreelancers = m.costsOwed.reduce((s, c) => s + c.cents, 0)
  return (
    <Chart
      title="Money"
      icon="document"
      series={MONEY}
      columns={moneyByMonth(m.months, today)}
      // The sentence's own money words, so a month's column and the sentence under it say the same sum (Move 3 of the sweep of 6 November 2026).
      format={money}
      empty="No quotes in the three months either side of this one."
      more={
        <>
          {/* What's accepted and unpaid says it's with VAT, and how much isn't invoiced yet (audit findings 29 and 71). */}
          <p className="hint">
            {money(month?.confirmed ?? 0)} confirmed of {money(month?.quoted ?? 0)} quoted for {moneyMonth(today).label}, before VAT. {money(owed)} with VAT accepted and
            unpaid from {plural(m.owed.length, 'client')}
            {notInvoiced > 0 ? `, ${money(notInvoiced)} of it not invoiced yet` : ''}; {money(toFreelancers)} owed to freelancers. <a href="#jobs/money">Money</a>
          </p>
          <BelowZero jobs={m.jobs} />
        </>
      }
    />
  )
}

/** Each chart's parts, bottom up: settled first, then not yet, then short (ADR 0054). */
const JOBS: Series[] = [
  { name: 'confirmed', tone: 'settled' },
  { name: 'not yet decided', tone: 'pending' },
]
const CREW: Series[] = [
  { name: 'booked', tone: 'settled' },
  { name: 'waiting to confirm', tone: 'pending' },
  { name: 'still needed', tone: 'short' },
]
const KIT: Series[] = [
  { name: 'for confirmed jobs', tone: 'settled' },
  { name: 'pencilled in', tone: 'pending' },
]
const DAYS: Series[] = [
  { name: 'confirmed', tone: 'settled' },
  { name: 'waiting to confirm', tone: 'pending' },
]
const MONEY: Series[] = [
  { name: 'confirmed', tone: 'settled' },
  { name: 'still a quote', tone: 'pending' },
]

/** Crew on each of the next fourteen days, for everyone or one department's calls. */
function CrewChart({ view, today, department }: { view: View; today: string; department?: string }) {
  return (
    <Chart
      title={department ? `${department} crew, the next fortnight` : 'Crew, the next fortnight'}
      icon="people"
      series={CREW}
      columns={crewByDay(view.crew.calls, today, 14, department)}
      empty={department ? `No ${department} calls in the next fourteen days.` : 'No crew called in the next fourteen days.'}
      more={
        <a className="link chart-more" href="#crew">
          Calls
        </a>
      }
    />
  )
}

/** Items held for jobs on each of the next fourteen days, for all the kit or one department's. */
function KitChart({ view, today, department }: { view: View; today: string; department?: Department }) {
  return (
    <Chart
      title="Kit booked out, the next fortnight"
      icon="kit"
      series={KIT}
      columns={kitByDay(view.kit.lines, today, 14, department ? (l) => l.model?.department === department : undefined)}
      format={(n) => n.toLocaleString('en-IE')}
      empty="No kit held for jobs in the next fourteen days."
      more={
        <a className="link chart-more" href="#stock">
          Stock
        </a>
      }
    />
  )
}

function ForDepartment({
  view,
  today,
  me,
  departments,
  department,
  onDepartment,
}: {
  view: View
  today: string
  me: PersonView | undefined
  departments: string[]
  department: string | undefined
  onDepartment: (d: string) => void
}) {
  const { can } = useAccess()
  if (!department)
    return (
      <section className="card">
        <Empty>Nobody has a department yet. Set one on each person's card on the Crew tab, and each head of department can see just theirs here.</Empty>
      </section>
    )
  const by = narrower(department)
  const week = addDays(today, 6)
  // Who in the department is working this week, and who's away: what a head of department plans around.
  const working = view.crew.calls
    .filter((c) => c.status === 'open' && c.end >= today && c.start <= week)
    .flatMap((c) => c.offers.filter((o) => o.status === 'confirmed' && o.person && !o.person.archived && by.person(o.person) && o.days.some((d) => d >= today && d <= week)).map((o) => ({ c, o })))
    .sort((a, b) => a.o.days[0]!.localeCompare(b.o.days[0]!) || a.o.person!.name.localeCompare(b.o.person!.name))
  const people = new Map(view.crew.people.map((p) => [p.id, p]))
  // Calls are counted by their own department (ADR 0046): those with none aren't in the tile, so it says how many.
  const fortnight = addDays(today, 14)
  const noDepartment = view.crew.calls.filter((c) => c.status === 'open' && c.end >= today && c.start <= fortnight && c.openDays.some((d) => d >= today) && !departmentOf(c)?.trim()).length
  const away = view.crew.unavailability
    .filter((u) => u.end >= today && u.start <= week && by.person(people.get(u.personId)) && !people.get(u.personId)?.archived)
    .sort((a, b) => a.start.localeCompare(b.start))
  return (
    <>
      <label className="field home-department">
        Department
        <select value={department} onChange={(e) => onDepartment(e.target.value)}>
          {(departments.includes(department) ? departments : [department, ...departments]).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <Tiles all={tiles(view, today, me, can, department)} keys={TILES_FOR.department} department={department} title={`Needs attention in ${department}`} clear={`Nothing waiting in ${department}.`} />
      <p className="hint">
        {noDepartment > 0 &&
          `${plural(noDepartment, 'call')} still needing crew in the next fortnight ${noDepartment === 1 ? "has no department, so it isn't" : "have no department, so they aren't"} counted here: give ${noDepartment === 1 ? 'it' : 'them'} one on Crew. `}
        Kit still out after a job is the job's, not a department's: it's on Stock.
      </p>
      <CrewChart view={view} today={today} department={department} />
      {kitOf(department) && <KitChart view={view} today={today} department={kitOf(department)} />}
      <section className="card">
        <Heading icon="people">Working this week{working.length > 0 ? ` (${working.length})` : ''}</Heading>
        {working.length === 0 ? (
          <Empty>Nobody in {department} is booked in the next seven days.</Empty>
        ) : (
          <ul className="job-list">
            {working.map(({ c, o }) => (
              <li key={o.id}>
                <a className="job-row working-row" href={c.projectId ? `#jobs/${c.projectId}` : '#crew'}>
                  <Avatar name={o.person!.name} src={photoOf(o.person)} />
                  <div>
                    <b>{o.person!.name}</b>
                    <p>
                      {c.role} · {c.project}
                      {c.phase && `, ${c.phase}`}
                    </p>
                  </div>
                  <div className="side">
                    <small>{daysLabel(o.days.filter((d) => d >= today && d <= week))}</small>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      {away.length > 0 && (
        <section className="card">
          <Heading icon="leave">Away this week ({away.length})</Heading>
          <ul className="job-list">
            {away.map((u) => (
              <li key={u.id}>
                <div className="job-row">
                  <Avatar name={people.get(u.personId)?.name ?? ''} src={photoOf(people.get(u.personId))} />
                  <div>
                    <b>{people.get(u.personId)?.name ?? 'Someone'}</b>
                    <p>{u.source === 'leave' ? 'Approved leave' : u.note || 'Away'}</p>
                  </div>
                  <div className="side">
                    <small>{daysLabel(eachDay(u.start, u.end))}</small>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function ForWarehouse({ view, today, me }: { view: View; today: string; me: PersonView | undefined }) {
  const { can } = useAccess()
  const tomorrow = addDays(today, 1)
  const out = view.moves.soon.filter((p) => p.job.span && p.job.span.start <= addDays(today, 7))
  const stillOut = standing(view, today)['still-out']
  const word = (start: string) => (start <= today ? 'Today · ' : start === tomorrow ? 'Tomorrow · ' : '')
  return (
    <>
      <section className="card">
        <Heading icon="van">Going out{out.length > 0 ? ` (${out.length})` : ''}</Heading>
        {out.length === 0 ? (
          <Empty>No confirmed job needs kit in the next seven days.</Empty>
        ) : (
          <ul className="job-list">
            {out.map((p) => (
              <li key={p.job.id}>
                <a className="job-row" href={`#jobs/${p.job.id}/pick`}>
                  <div>
                    <b>{p.job.name}</b>
                    <p>
                      {word(p.job.span!.start)}
                      {spanLabel(p.job.span!)}
                    </p>
                  </div>
                  <div className="side">
                    <small className={`flag ${p.out >= p.need ? 'ok' : ''}`}>
                      {p.out} of {p.need} out
                    </small>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Tiles all={tiles(view, today, me, can)} keys={TILES_FOR.warehouse} clear="Nothing back late, broken or due a test." />
      <KitChart view={view} today={today} />
      {stillOut.length > 0 && (
        <section className="card">
          {/* Stock's name for the same list (audit, 5 November 2026, finding 79), and the count's own list (ADR 0109). */}
          <Heading icon="warehouse">{listHeading(STANDING_HEADINGS['still-out'], stillOut.length)}</Heading>
          <ul className="job-list">
            {stillOut.map((k) => (
              <StillOutRow key={k.job.id} k={k} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function ForMe({ view, today, me, onPick }: { view: View; today: string; me: PersonView | undefined; onPick: (id: string) => void }) {
  const { can } = useAccess()
  const [id, setId] = useState('')
  if (!me) {
    const staff = view.leave.staff
    return (
      <section className="card">
        <h2>Who are you?</h2>
        {staff.length === 0 ? (
          <Empty>Add staff on the Crew tab, with Type set to Staff, to see your own work here.</Empty>
        ) : (
          <form
            className="who-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (id) onPick(id)
            }}
          >
            <label className="field">
              Your name
              <select value={id} onChange={(e) => setId(e.target.value)}>
                <option value="">Pick your name…</option>
                {staff.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">Until sign-in is on, this device takes your word for it, and remembers the answer, as Leave does.</p>
            <button type="submit" className="primary" disabled={!id}>
              That's me
            </button>
          </form>
        )}
      </section>
    )
  }
  // Their bookings and the offers waiting on them, in the order their link and their own page list them, with theirs on a job
  // that was stopped in its place (UX sweep, 6 November 2026, move 6).
  const mine = soonestFirst<{ c: CallView; o: OfferView; job?: ProjectStatus }>(
    [
      ...view.crew.calls
        .filter((c) => c.status === 'open' && c.end >= today)
        .flatMap((c) => c.offers.filter((o) => o.personId === me.id && (HOLDING.includes(o.status) || OPEN.includes(o.status))).map((o) => ({ c, o }))),
      ...stoppedBookings(view, me.id, today),
    ],
    today,
    asBooking,
  )
  const booked = mine.filter(({ o }) => HOLDING.includes(o.status))
  const offered = mine.filter(({ o }) => OPEN.includes(o.status))
  const link = linkFor(me)
  const year = Number(today.slice(0, 4))
  const balance = me.kind === 'staff' ? view.leave.balance(me.id, year) : undefined
  const waiting = view.leave.requestsFor(me.id, year).filter((r) => r.status === 'waiting')
  const approver = canApproveLeave(me)
  const copying = useCopying()
  const weeks = myWeeks(view.crew.calls, me.id, today)
  return (
    <>
      {/* Today first, where a person looks first; leave after (audit, 5 November 2026, finding 97). */}
      <YourDay view={view} today={today} me={me} mine={booked} />
      <section className="card">
        {/* One name and one row for them on Home › Me, their own page and their link (UX sweep, 6 November 2026, move 6); booked and only
            accepted said apart, as on their own page (audit, 20 October 2026, finding 36): an accepted day can still go to someone else.
            Only bookings are counted: the glance line under it says the offers, and the strip's name for the card stays on a phone. */}
        <Heading icon="calendar">Your bookings{booked.length > 0 && !copying ? ` (${workCount(booked)})` : ''}</Heading>
        {copying ? (
          <p className="empty">{STILL_ARRIVING}</p>
        ) : mine.length === 0 ? (
          <Empty>No bookings coming up.</Empty>
        ) : (
          <>
            <MyGlance offers={offered.length} next={nextBooking(booked, today, asBooking)} link={link} today={today} />
            <ul className="job-list">
              {mine.map(({ c, o, job }) => (
                <li key={o.id}>
                  {/* An offer is answered on their own page (audit, 20 October 2026, finding 35), so its row opens there. */}
                  <BookingRow c={c} o={o} today={today} href={jobHref(c)} link={link} {...(job ? { job } : {})} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {/* Only with something in it: an empty chart said nothing Your bookings hadn't (finding 97). */}
      {weeks.some((w) => w.parts.some((n) => n > 0)) && (
        <Chart title="Your weeks" icon="calendar" series={DAYS} columns={weeks} format={(n) => plural(n, 'day')} empty="No days booked in the next eight weeks." />
      )}
      {balance && (
        <section className="card">
          <Heading icon="leave">Your leave</Heading>
          {copying ? (
            <p className="empty">{STILL_ARRIVING}</p>
          ) : (
            <p>
              {leaveDaysLabel(balance.annual.left)} of annual leave left this year, {leaveDaysLabel(balance.lieu.left)} in lieu to take.
              {/* A day in lieu waiting is said beside the requests, as Leave shows it (audit, 20 October 2026, finding 70). */}
              {awaiting(waiting.length, balance.lieu.waitingToApprove)}
            </p>
          )}
          <a className="button" href="#crew/leave">
            Open leave
          </a>
        </section>
      )}
      {approver && <Tiles all={tiles(view, today, me, can)} keys={TILES_FOR.me} title="Waiting on you" clear="No time off waiting on you." grouped={false} />}
    </>
  )
}

/**
 * Their own day, under Me (audit, 20 October 2026, finding 69): the
 * bookings whose days take in today, with the call time and venue, or their
 * leave; otherwise "Nothing on today", the next booking being in the glance
 * line over Your bookings (UX sweep, 6 November 2026, move 6). Never the
 * company's Today, whose jobs they may not be on (ADR 0033 §1: my bookings,
 * my leave).
 */
function YourDay({ view, today, me, mine }: { view: View; today: string; me: PersonView; mine: readonly { c: View['crew']['calls'][number]; o: View['crew']['calls'][number]['offers'][number] }[] }) {
  const copying = useCopying()
  const booked = mine.filter(({ o }) => o.status === 'confirmed')
  const on = booked.filter(({ o }) => o.days.includes(today))
  const away = view.crew.unavailability.find((u) => u.personId === me.id && u.start <= today && u.end >= today)
  return (
    <section className="card your-day">
      <Heading icon="time">Your day{on.length > 0 && !copying ? ` (${on.length})` : ''}</Heading>
      {copying ? (
        <p className="empty">{STILL_ARRIVING}</p>
      ) : on.length === 0 ? (
        <p className="empty">
          {/* What's next is in the glance line over Your bookings, with its call time. */}
          {away ? (away.source === 'leave' ? 'On leave today.' : `Away today${away.note ? `: ${away.note}` : ''}.`) : 'Nothing on today.'}
        </p>
      ) : (
        <ul className="job-list">
          {on.map(({ c, o }) => (
            <li key={o.id}>
              <a className="job-row" href={c.projectId ? `#jobs/${c.projectId}` : '#crew'}>
                <div>
                  <b>{c.project}</b>
                  <p>
                    {c.role}
                    {c.phase && ` · ${c.phase}`}
                    {c.venue && ` · ${c.venue}`}
                  </p>
                </div>
                <div className="side">{c.callTime && <small>Call {c.callTime}</small>}</div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * The job tasks given to you (ADR 0073, ADR 0104), not done yet: the ones
 * to do now first, as the job is at them, then by the day each is due,
 * then by the job's first day. Each opens the job, whose stages are at the
 * top. On Me, all of them; on the other views, on top as they're yours
 * whichever you look at, only the first few to do now. Nothing at all
 * while there are none.
 */
const STEPS_ON_TOP = 5

function MySteps({ view, me, all }: { view: View; me: PersonView; all: boolean }) {
  const steps = view.steps.mine(me.id)
  const now = steps.filter((s) => s.next)
  const shown = all ? steps : now.slice(0, STEPS_ON_TOP)
  if (shown.length === 0) return null
  const more = steps.length - shown.length
  return (
    <section className="card my-steps" aria-labelledby="my-steps-title">
      <Heading icon="done" id="my-steps-title">{all ? `Your tasks (${steps.length})` : `Your tasks to do now (${now.length})`}</Heading>
      <ul className="job-list">
        {shown.map(({ job, step, next }) => {
          const at = view.steps.of(job.id)
          return (
            <li key={`${job.id}.${step.key}`}>
              <a className="job-row" href={`#jobs/${encodeURIComponent(job.id)}/task/${step.key}`}>
                <div>
                  <b>{step.label}</b>
                  <p>
                    {job.name}
                    {/* The stage the job is in, so the list says how far along each job is (ADR 0104). */}
                    {at?.stage && ` · ${at.stage.label}`}
                    {step.hint && ` · ${step.hint}`}
                  </p>
                </div>
                <div className="side">
                  {/* No "After …": tasks don't wait on one another (ADR 0104), so the stage in the line above says how far along it is. */}
                  {next && <small className="flag">Now</small>}
                  {step.dueOn ? <small className={step.late ? 'flag bad' : undefined}>{step.late ? 'Was due' : 'By'} {dayLabel(step.dueOn)}</small> : job.span && <small>{dayLabel(job.span.start)}</small>}
                </div>
              </a>
            </li>
          )
        })}
      </ul>
      {!all && more > 0 && <p className="hint">{plural(more, 'more task')} of yours on Me.</p>}
    </section>
  )
}

/** "3 confirmed, 2 accepted", or the one kind there is. */
function workCount(mine: readonly { o: { status: string } }[]) {
  const confirmed = mine.filter((m) => m.o.status === 'confirmed').length
  const accepted = mine.length - confirmed
  return [confirmed && `${confirmed} confirmed`, accepted && `${accepted} accepted`].filter(Boolean).join(', ')
}

/** Where a booking of theirs opens in the app: its job, or Crew for a call made before jobs. */
const jobHref = (c: { projectId?: string | null }) => (c.projectId ? `#jobs/${c.projectId}` : '#crew')

/**
 * What's waiting on them and what's next, in the words of the glance line at the top of their own page (UX sweep, 6
 * November 2026, move 6): the offers open their page, where they're answered; the next booking opens its job. No
 * timesheets: Me is a member of staff's, and staff are paid through payroll.
 */
function MyGlance({ offers, next, link, today }: { offers: number; next: { booking: { c: CallView; o: OfferView }; day: string } | undefined; link: string; today: string }) {
  const parts = glanceParts({ offers, ...(next ? { next: { project: next.booking.c.project, callTime: next.booking.c.callTime, day: next.day } } : {}) }, today)
  if (parts.length === 0) return null
  return (
    <p className="my-glance">
      {parts.map((p, i) => {
        const href = p.key === 'next' ? next && jobHref(next.booking.c) : link && `${link}#${p.key}`
        return (
          <Fragment key={p.key}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            {href ? (
              <a className="link" href={href} {...(p.key === 'next' ? {} : { target: '_blank', rel: 'noreferrer' })}>
                {p.text}
              </a>
            ) : (
              p.text
            )}
          </Fragment>
        )
      })}
    </p>
  )
}

/** " 1 request and 1 day in lieu waiting to be approved.", or nothing while nothing is. */
export function awaiting(requests: number, lieuDays: number): string {
  const parts = [requests > 0 && plural(requests, 'request'), lieuDays > 0 && `${leaveDaysLabel(lieuDays)} in lieu`].filter(Boolean)
  return parts.length === 0 ? '' : ` ${parts.join(' and ')} waiting to be approved.`
}
