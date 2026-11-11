import {
  hasSteps,
  HOLDING,
  departmentKey,
  departmentOf,
  kitOf,
  sameDepartment,
  crewFill,
  dayLabel,
  KIND_LABELS,
  kindOf,
  addDays,
  mondayOf,
  newId,
  PHASE_NAMES,
  phaseNames,
  PROJECT_KINDS,
  PROJECT_STATUSES,
  STATUS_LABELS,
  STOPPED,
  spanLabel,
  type ClientView,
  type JobView,
  JOB_STEPS,
  type JobStep,
  type KitLineView,
  type ProjectKind,
  type ProjectStatus,
  type VenueView,
  type View,
  activeFilters,
  jobFilters,
  departmentsOfJob,
  JOB_DEPARTMENTS,
  JOB_DEPARTMENT_LABELS,
  jobDepartmentsInWords,
  jobSorts,
  listed,
  sortOf,
  PLACE_SORTS,
  placeFilters,
  type PlaceForList,
  stillInBack,
} from '@sh/shared'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { Empty } from '../Empty.tsx'
import { Fold } from '../Fold.tsx'
import { Pending } from '../StatusPill.tsx'
import { useAccess } from '../role.ts'
import { useMyDepartment } from '../Narrowed.tsx'
import { useMe } from '../crew/Leave.tsx'
import { client } from '../sync.ts'
import { useToday, useView, useWide } from '../view.ts'
import { Beside, ClientField, clientNamed, NewOrNear, JobStatusPill, Top, useHash, VenueField, venueNamed, useJobAdd } from './common.tsx'
import { JobPosition } from './JobPosition.tsx'
import { ImportScreen } from './ImportScreen.tsx'
import { TidyScreen } from './TidyScreen.tsx'
import { JOB_PARTS, JobScreen, type JobPart } from './JobScreen.tsx'
import { kitShort } from './Kit.tsx'
import { MoneyScreen, PricesScreen, type MoneyPart } from './Money.tsx'
import { MatchScreen, PastQuoteScreen, PastQuotesScreen } from './PastQuotes.tsx'
import { NotesKitListScreen, NotesKitScreen } from './NotesKit.tsx'
import { PickScreen } from './PickScreen.tsx'
import { SheetScreen } from './SheetScreen.tsx'
import { BoardScreen } from './BoardScreen.tsx'
import { JobViews, PlanScreen } from './PlanScreen.tsx'
import { CalendarScreen } from './CalendarScreen.tsx'
import { ClientScreen } from './ClientScreen.tsx'
import { jobsAt, VenueScreen } from './VenueScreen.tsx'
import { VenuesMapCard } from './VenueMaps.tsx'
import { Heading, Icon } from '../Icon.tsx'
import { plain, wordsOf } from '../crew/People.tsx'
import { JOBS } from '../Up.tsx'
import { useWindowed } from '../windowed.ts'
import { ListTools, PillGroup, useListChoices } from '../ListTools.tsx'
import { DepartmentFilter, useJobDepartments } from './Departments.tsx'
import { arrival } from '../arrival.ts'

/**
 * Jobs (ADR 0007): every job, who it's for, where and when, made of phases.
 * A job opens on its own page (#jobs/<id>) with its phases, kit and crew,
 * its pick list on another (#jobs/<id>/pick, ADR 0017), each phase's call
 * sheet on another (#jobs/<id>/sheet/<phase>, ADR 0021), the
 * planner (#jobs/plan, ADR 0010) shows them by week or month, the master
 * calendar (#jobs/calendar, ADR 0123) a month with enquiries and quotes, the clients
 * and venues have a list each (#jobs/clients, #jobs/venues, ADR 0041) and
 * a page each with its documents (#jobs/venues/<id>, ADR 0032), each job's
 * quote is its Quote tab, #jobs/<id>/quote, money is on #jobs/money (ADR 0042), jobs
 * already on Google Calendar can be brought in (#jobs/import, ADR 0011) and
 * what came in tidied up (#jobs/tidy, ADR 0050), and
 * the kit their notes list turned into kit lines, a job at a time
 * (#jobs/<id>/notes-kit) or a season at a time (#jobs/notes-kit, ADR 0043).
 * Everything works with no signal and syncs later, like the rest of the app.
 */

type Filter = 'coming' | 'past' | 'stopped'
const FILTERS: [Filter, string][] = [
  ['coming', 'Coming up'],
  ['past', 'Past'],
  ['stopped', 'Not going ahead'],
]

function filterOf(j: JobView, day: string): Filter {
  if (STOPPED.includes(j.status)) return 'stopped'
  return j.span && j.span.end < day ? 'past' : 'coming'
}

export function JobsScreen() {
  const view = useView()
  const hash = useHash()
  const wide = useWide()
  if (hash === '#jobs/plan' || hash.startsWith('#jobs/plan/')) return <PlanScreen view={view} hash={hash} />
  if (hash === '#jobs/board') return <BoardScreen view={view} />
  if (hash === '#jobs/calendar' || hash.startsWith('#jobs/calendar/')) return <CalendarScreen view={view} hash={hash} />
  if (hash === '#jobs/import') return <ImportScreen view={view} />
  if (hash === '#jobs/tidy') return <TidyScreen view={view} />
  if (hash === '#jobs/clients') return <ClientsScreen view={view} />
  if (hash === '#jobs/venues') return <VenuesScreen view={view} />
  if (hash === '#jobs/money') return <MoneyScreen view={view} />
  // Money's parts, each at its own address (review of 11 November 2026, finding 20).
  const moneyPart = /^#jobs\/money\/(owed|margins|accountant)$/.exec(hash)?.[1] as MoneyPart | undefined
  if (moneyPart) return <MoneyScreen view={view} part={moneyPart} />
  if (hash === '#jobs/money/prices') return <PricesScreen view={view} />
  if (hash === '#jobs/money/current-rms') return <PastQuotesScreen view={view} />
  if (hash === '#jobs/money/current-rms/match') return <MatchScreen view={view} />
  if (hash.startsWith('#jobs/money/current-rms/')) return <PastQuoteScreen view={view} id={decodeURIComponent(hash.slice('#jobs/money/current-rms/'.length))} />
  if (hash === '#jobs/notes-kit') return <NotesKitListScreen view={view} />
  // A record and the tab it's on: #jobs/venues/<id>/<part> (Move 11 of the sweep of 6 November 2026).
  if (hash.startsWith('#jobs/venues/')) {
    const [id = '', part] = hash.slice('#jobs/venues/'.length).split('/')
    return <VenueScreen view={view} id={decodeURIComponent(id)} part={part} />
  }
  if (hash.startsWith('#jobs/clients/')) {
    const [id = '', part] = hash.slice('#jobs/clients/'.length).split('/')
    return <ClientScreen view={view} id={decodeURIComponent(id)} part={part} />
  }
  const [, fromNotes] = /^#jobs\/([^/]+)\/notes-kit$/.exec(hash) ?? []
  if (fromNotes) return <NotesKitScreen view={view} jobId={decodeURIComponent(fromNotes)} />
  const [, pick] = /^#jobs\/(.+)\/pick$/.exec(hash) ?? []
  if (pick) return <PickScreen view={view} id={decodeURIComponent(pick)} />
  const [, sheetJob, sheetPhase] = /^#jobs\/([^/]+)\/sheet\/([^/]+)$/.exec(hash) ?? []
  if (sheetJob && sheetPhase) return <SheetScreen view={view} jobId={decodeURIComponent(sheetJob)} phaseId={decodeURIComponent(sheetPhase)} />
  // A job's page with one of its tasks open, as Your tasks on Home links it (audit, 5 November 2026, finding 17).
  const [, taskOf, taskKey] = /^#jobs\/([^/]+)\/task\/([a-z]+)$/.exec(hash) ?? []
  if (taskOf && JOB_STEPS.includes(taskKey as JobStep)) return <JobScreen key={taskOf} view={view} id={decodeURIComponent(taskOf)} task={taskKey as JobStep} />
  // A job's page, at a part of it when the address names one.
  // The quote is the job's Quote tab (ADR 0140, part 4); #jobs/<id>/money, its tab's old address, opens it too.
  const [, partOf, named] = /^#jobs\/([^/]+)\/([a-z]+)$/.exec(hash) ?? []
  const part = named === 'money' ? 'quote' : named
  const open = partOf && JOB_PARTS.includes(part as JobPart) ? decodeURIComponent(partOf) : hash.startsWith('#jobs/') ? decodeURIComponent(hash.slice('#jobs/'.length)) : undefined
  // A job has the whole width, on a laptop too: the list beside it took a third of the desk from it. The way up goes back to the list.
  if (open) return <JobScreen key={open} view={view} id={open} part={partOf ? (part as JobPart) : undefined} />
  // On a laptop the list keeps a column of its own (audit finding 25), with its search and filter, beside the rest of the tab; on a phone it's above it.
  if (wide) return <JobsBeside view={view} />
  return <JobList view={view} />
}

function JobsBeside({ view }: { view: View }) {
  return (
    <Beside view={view} className="crew jobs" views={<JobViews />} heading="Jobs" add={useJobAdd()} lead={<JobSearch />} list={<JobsCard view={view} />}>
      <JobsRest view={view} />
    </Beside>
  )
}

function JobList({ view }: { view: View }) {
  return (
    <div className="app crew jobs">
      <Top view={view} views={<JobViews />} heading="Jobs" add={useJobAdd()} lead={<JobSearch />} />

      <JobsCard view={view} phone />

      <JobsRest view={view} phone />
    </div>
  )
}

/** The list's search, kept for the tab's life so Back from a job finds the list as it was searched. */
let jobSearch = ''
const searchListeners = new Set<() => void>()
const onSearch = (fn: () => void) => {
  searchListeners.add(fn)
  return () => void searchListeners.delete(fn)
}
function useJobSearch(): [string, (next: string) => void] {
  const now = useSyncExternalStore(onSearch, () => jobSearch)
  return [
    now,
    (next) => {
      jobSearch = next
      for (const fn of searchListeners) fn()
    },
  ]
}

/** Straight under the title, before the views: finding a job is the first thing most do here. */
function JobSearch() {
  const [search, setSearch] = useJobSearch()
  return <input className="search" type="search" placeholder="Find a job, client or venue" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find" />
}

/** Beside the list on a laptop: the new job's form once New job is pressed. Tidying up and kit in the notes live under Menu and Admin, not here (Colly, 10 November 2026). */
function JobsRest({ view, phone = false }: { view: View; phone?: boolean }) {
  const mayAdd = useAccess().can('jobs')
  return (
    <>
      {mayAdd && !phone && (
        // Beside the list, where there's room for it, as it was before New job moved to the title's line; nothing until it's pressed.
        <section className="card new-job-card" aria-label="New job">
          <Fold label="New job" from="job">
            <Heading icon="add">New job</Heading>
            <NewJob view={view} />
          </Fold>
        </section>
      )}
    </>
  )
}

/** A client or venue in its list, with what the list counts and filters by (ADR 0099). */
type Placed<T> = PlaceForList & { of: T }

/** What a list of clients or venues counts of each: its jobs, the latest one's first day, the ones still to come, its documents. */
function placed<T extends { id: string; name: string }>(items: readonly T[], jobsOf: (item: T) => readonly JobView[], docs: (item: T) => number, today: string, pinned?: (item: T) => boolean): Placed<T>[] {
  return items.map((of) => {
    const jobs = jobsOf(of)
    return {
      of,
      name: of.name,
      jobs: jobs.length,
      lastJob: jobs.reduce<string | undefined>((last, j) => (j.span && (!last || j.span.start > last) ? j.span.start : last), undefined),
      comingUp: jobs.filter((j) => j.span && j.span.end >= today).length,
      docs: docs(of),
      pinned: pinned?.(of),
    }
  })
}

/**
 * Every client, on a page along Jobs' row (ADR 0041): each opens its own page, with its documents and its jobs. Found by name or a
 * contact's, and filtered and sorted as the other long lists are (ADR 0099).
 */
function ClientsScreen({ view }: { view: View }) {
  const { jobs, clients } = view.jobs
  const today = useToday()
  const [find, setFind] = useState('')
  const [choices, setChoices] = useListChoices('clients')
  const mayAdd = useAccess().can('jobs')
  const filters = useMemo(() => placeFilters(false), [])
  const all = useMemo(
    () => placed(clients, (c) => jobs.filter((j) => j.clientId === c.id), (c) => view.attachments.of('client', c.id).length, today),
    [clients, jobs, view.attachments, today],
  )
  const words = wordsOf(find)
  const searched = words.length ? all.filter((c) => words.every((w) => plain([c.of.name, ...c.of.contacts.map((x) => x.name)].join(' ')).includes(w))) : all
  const shown = listed(searched, filters, PLACE_SORTS, choices)
  return (
    <div className="app crew jobs">
      <Top view={view} views={<JobViews current="clients" />} heading="Clients" add={mayAdd ? { key: 'client', label: 'New client' } : undefined} />
      <section className="card plain" aria-label="Every client">
        {mayAdd && (
          <Fold label="New client" from="client">
            <NewNamed what="client" taken={(n) => clients.find((c) => plain(c.name) === plain(n))?.name} make={(id, name) => client.mutate('client.upsert', { id, name, contacts: [], notes: '' })} href={(id) => `#jobs/clients/${id}`} />
          </Fold>
        )}
        {clients.length === 0 && <Empty>Add one with New client, at the top, or type a new one into a job.</Empty>}
        {clients.length > 0 && (
          <>
            <input className="search" type="search" placeholder="Name or contact" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find a client" />
            <ListTools name="clients" items={searched} filters={filters} sorts={PLACE_SORTS} choices={choices} onChange={setChoices} shown={shown.length} what="clients" />
          </>
        )}
        {clients.length > 0 && shown.length === 0 && <p className="empty">No client matches.</p>}
        <ul className="job-list">
          {shown.map((c) => (
            <li key={c.of.id}>
              <ClientRow c={c.of} jobs={c.jobs} docs={c.docs} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/**
 * New client or New venue, opened from the title's line (Colly, 10 November 2026): the name (and a venue's address), then its own
 * page, where the rest is filled in. A name already here is said, with the way to it, rather than made twice.
 */
function NewNamed({
  what,
  address: withAddress = false,
  taken,
  make,
  href,
}: {
  what: 'client' | 'venue'
  address?: boolean
  taken: (name: string) => string | undefined
  make: (id: string, name: string, address: string) => Promise<unknown>
  href: (id: string) => string
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const { run, error, refuse } = useAct()
  const add = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    const was = taken(n)
    if (was) return refuse(`There's already a ${what} called ${was}.`)
    const id = newId()
    void run(() => make(id, n, address.trim())).then((ok) => {
      if (ok) location.hash = href(id)
    })
  }
  return (
    <form className="grid-form" onSubmit={add} aria-label={`New ${what}`}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </label>
      {withAddress && (
        <label>
          Address
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={500} placeholder="With the Eircode, for the map" />
        </label>
      )}
      <button type="submit" className="primary">
        Add {what}
      </button>
      <Refusal error={error} />
    </form>
  )
}

/**
 * Every venue, on a page along Jobs' row (ADR 0041), with a map of them all above the list (ADR 0057). Sixty and more is a long
 * list, so it has People's find box at its top, by name or address with or without the fadas (audit, 20 October 2026, finding 76),
 * and the long lists' filter and sort (ADR 0099).
 */
function VenuesScreen({ view }: { view: View }) {
  const { jobs, venues } = view.jobs
  const today = useToday()
  const [find, setFind] = useState('')
  const [choices, setChoices] = useListChoices('venues')
  const mayAdd = useAccess().can('jobs')
  const filters = useMemo(() => placeFilters(true), [])
  const all = useMemo(
    () => placed(venues, (v) => jobsAt(jobs, v.id), (v) => view.attachments.of('venue', v.id).length, today, (v) => !!v.pin),
    [venues, jobs, view.attachments, today],
  )
  const words = wordsOf(find)
  const searched = words.length ? all.filter((v) => words.every((w) => plain([v.of.name, v.of.address].filter(Boolean).join(' ')).includes(w))) : all
  const shown = listed(searched, filters, PLACE_SORTS, choices)
  return (
    <div className="app crew jobs">
      <Top view={view} views={<JobViews current="venues" />} heading="Venues" add={mayAdd ? { key: 'venue', label: 'New venue' } : undefined} />
      {mayAdd && (
        <section className="card plain" aria-label="New venue">
          <Fold label="New venue" from="venue">
            <NewNamed what="venue" address taken={(n) => venues.find((v) => plain(v.name) === plain(n))?.name} make={(id, name, address) => client.mutate('venue.upsert', { id, name, address, notes: '' })} href={(id) => `#jobs/venues/${id}`} />
          </Fold>
        </section>
      )}
      <VenuesMapCard venues={venues} jobsAt={(id) => jobsAt(jobs, id).length} />
      <section className="card plain" aria-label="Every venue">
        {venues.length === 0 && <Empty>Add one with New venue, at the top, or type a new one into a job.</Empty>}
        {venues.length > 0 && (
          <>
            <input className="search" type="search" placeholder="Name or address" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find a venue" />
            <ListTools name="venues" items={searched} filters={filters} sorts={PLACE_SORTS} choices={choices} onChange={setChoices} shown={shown.length} what="venues" />
          </>
        )}
        {venues.length > 0 && shown.length === 0 && <p className="empty">No venue matches.</p>}
        <ul className="job-list">
          {shown.map((v) => (
            <li key={v.of.id}>
              <VenueRow v={v.of} jobs={v.jobs} docs={v.docs} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** A row of the list: the heading of a week, or a job with its place among the jobs. */
type Row = { week: string; label: string } | { job: JobView; n: number }
const rowKey = (r: Row) => ('job' in r ? r.job.id : `week:${r.week}`)

/** Coming up shows the next fortnight until Show all (audit finding 22). */
const SOON_DAYS = 14
/** Show all, kept for the tab's life, so Back from a job finds the same list and its place on it (places.ts). */
let showingAll = false

/** "This week", "Next week", "Last week", or "Week of Mon 3 Nov". */
function weekLabel(monday: string, today: string): string {
  const now = mondayOf(today)
  if (monday === now) return 'This week'
  if (monday === addDays(now, 7)) return 'Next week'
  if (monday === addDays(now, -7)) return 'Last week'
  return `Week of ${dayLabel(monday)}`
}

/** Jobs under the heading of their week: a job already going is in this week's; one with no dates under "No dates yet". */
function byWeek(jobs: readonly JobView[], today: string): Row[] {
  const rows: Row[] = []
  let last: string | undefined
  jobs.forEach((job, n) => {
    const week = job.span ? mondayOf(job.span.start < today && job.span.end >= today ? today : job.span.start) : ''
    if (week !== last) rows.push({ week, label: week ? weekLabel(week, today) : 'No dates yet' })
    last = week
    rows.push({ job, n })
  })
  return rows
}

/**
 * The week headings stay at the top while their jobs scroll under them: on
 * a phone just under the top bar, whatever its height; in a column of its
 * own on a laptop, at the column's top.
 */
function useUnderTop(phone: boolean) {
  const card = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = card.current
    const top = document.querySelector<HTMLElement>('.top')
    if (!phone || !el || !top || typeof ResizeObserver === 'undefined') return
    const set = () => el.style.setProperty('--under-top', `${(parseFloat(getComputedStyle(top).top) || 0) + top.offsetHeight}px`)
    const watch = new ResizeObserver(set)
    watch.observe(top)
    set()
    return () => watch.disconnect()
  }, [phone])
  return card
}

/** A head's department starts the Jobs list once a tab; widened, it stays so (Move 9 of the sweep of 6 November 2026). */
let jobsLensSet = false

/**
 * Whose a job is, for the Jobs list's first filters (Move 9 of the sweep of 6 November 2026): the jobs someone is booked on, by
 * their own bookings (a yes waiting to be confirmed counts), and each department named on a call, a job being a department's when
 * one of its calls is, or a line of its kit is in that department's stock. Read from what this role is sent, so it never counts
 * more than the list holds.
 */
function jobLens(jobs: readonly JobView[], view: View, me: string | undefined) {
  const mine = me ? (j: JobView) => j.calls.some((c) => c.offers.some((o) => o.personId === me && HOLDING.includes(o.status))) : undefined
  const names = new Map<string, string>()
  for (const j of jobs) for (const c of j.calls) {
    const d = departmentOf(c)?.trim()
    if (d && !names.has(departmentKey(d))) names.set(departmentKey(d), d)
  }
  const departments = [...names.values()]
    .sort((a, b) => a.localeCompare(b, 'en-IE'))
    .map((name) => {
      const stock = kitOf(name)
      return {
        name,
        test: (j: JobView) =>
          j.calls.some((c) => sameDepartment(departmentOf(c), name)) || (!!stock && (view.kit.byJob.get(j.id) ?? []).some((l) => l.model?.department === stock)),
      }
    })
  return { ...(mine && jobs.some(mine) ? { mine } : {}), departments }
}

/** Every job, searched and filtered, by week. */
function JobsCard({ view, phone = false }: { view: View; phone?: boolean }) {
  const { jobs } = view.jobs
  const [filter, setFilter] = useState<Filter>('coming')
  const [search] = useJobSearch()
  const [all, setAll] = useState(showingAll)
  const mayAdd = useAccess().can('jobs')
  const card = useUnderTop(phone)
  const day = useToday()
  // The departments picked (ADR 0137), as on the calendar, the planner and the Board.
  const { picked, setPicked, involves } = useJobDepartments(view)
  // Worked out again only when the jobs, the day or what's asked for change, not on every render (audit, 20 October 2026, finding 2).
  const counts = useMemo(() => {
    const counted = new Map<Filter, number>()
    for (const j of jobs) if (involves(j)) counted.set(filterOf(j, day), (counted.get(filterOf(j, day)) ?? 0) + 1)
    return counted
  }, [jobs, day, involves])
  const count = (f: Filter) => counts.get(f) ?? 0
  // Filter and sort (ADR 0099): the filters narrow the tab chosen above them, and the order is the tab's own until another is picked.
  // A count on Home of jobs with a task late, or down to nobody, opens the list on just those, its other filters off (audit, 5 November 2026, finding 20).
  const [asked] = useState(() => arrival()?.filters)
  // The lens (Move 9 of the sweep of 6 November 2026): a head's list opens on their department, once a tab, as Crew's and Stock's
  // do; widened, it stays widened for the tab. A count on Home for a department passes it the same way.
  const department = useMyDepartment()
  const [choices, setChoices] = useListChoices('jobs', asked && { mine: '', department: '', status: '', kind: '', crew: '', kit: '', stage: '', tasks: '', ...asked })
  // Read as it's known: a head's department can come with the first copy, after the list first drew.
  useEffect(() => {
    if (!department || jobsLensSet) return
    jobsLensSet = true
    if (!asked) setChoices({ ...choices, filters: { ...choices.filters, department: departmentKey(department) } })
  })
  const sorts = useMemo(() => jobSorts(filter !== 'coming'), [filter])
  // Who they are as Home › Me and the job's "You on this job" read it: signed in, by their email; with sign-in off, their word.
  const me = useMe(view).me?.id
  const whose = useMemo(() => jobLens(jobs, view, me), [jobs, view, me])
  const filters = useMemo(
    () => jobFilters((j) => !!kitShort(view.kit.byJob.get(j.id)), filter === 'stopped', (j) => view.steps.of(j.id), whose),
    [view.kit.byJob, view.steps, filter, whose]
  )
  const { rows, shownCount, listedCount, searched, byDepartment, total } = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const matches = (j: JobView) => {
      const text = [j.name, j.client?.name, j.venue?.name, ...j.phases.map((p) => p.venue?.name)].filter(Boolean).join(' ').toLowerCase()
      return words.every((w) => text.includes(w))
    }
    const inTab = jobs.filter((j) => filterOf(j, day) === filter && matches(j))
    // The departments row (ADR 0137) narrows before the filters, so their counts are of the jobs it leaves.
    const searched = inTab.filter(involves)
    const shown = listed(searched, filters, sorts, choices)
    const byDate = sortOf(sorts, choices.sort)?.key === 'date'
    const narrowed = activeFilters(filters, choices.filters).length > 0 || picked.length > 0
    // The next fortnight, and the ones with no dates yet, until Show all; a search or a filter looks through them all, as does another order.
    const soonOnly = filter === 'coming' && !all && words.length === 0 && !narrowed && byDate
    const soonEnd = addDays(day, SOON_DAYS)
    const listedJobs = soonOnly ? shown.filter((j) => !j.span || j.span.start < soonEnd) : shown
    // Under the heading of their week while they're by date; in any other order a week heading would come round again and again.
    // Past opens on the jobs still in Back with work open on them, under a head of their own, before the weeks (Move 10 of the
    // sweep of 6 November 2026): a job whose dates passed isn't finished while its Back isn't.
    const back = filter === 'past' && byDate ? listedJobs.filter((j) => stillInBack(view.steps.of(j.id))) : []
    const rest = back.length ? listedJobs.filter((j) => !back.includes(j)) : listedJobs
    const rows: Row[] = byDate
      ? [
          ...(back.length ? [{ week: 'back', label: `Still in Back (${back.length.toLocaleString('en-IE')})` }, ...back.map((job, n) => ({ job, n }))] : []),
          ...byWeek(rest, day).map((r) => ('job' in r ? { ...r, n: r.n + back.length } : r)),
        ]
      : listedJobs.map((job, n) => ({ job, n }))
    const byDepartment = new Map(JOB_DEPARTMENTS.map((d) => [d, inTab.filter((j) => departmentsOfJob(j, view.kit.byJob.get(j.id)).has(d)).length]))
    // What "of" counts once the list is narrowed: every job the search finds, whenever it is, so "12 of 1,760 jobs" says how much is left out.
    const total = words.length ? jobs.filter(matches).length : jobs.length
    return { rows, shownCount: shown.length, listedCount: listedJobs.length, searched, byDepartment, total }
  }, [jobs, day, filter, search, all, filters, sorts, choices, view.steps, view.kit.byJob, involves, picked])
  const win = useWindowed('jobs', rows, rowKey, 110)

  // When, the departments and Mine are in the filter panel as pills (Colly, 10 November 2026), with the list's other filters, rather
  // than three rows between the search and the jobs. Each one on away from the list's start shows as a chip under Filter, as every
  // filter does, so a list that's Past or Lighting never looks like the whole of it.
  const whenLabel = (f: Filter) => FILTERS.find(([k]) => k === f)![1]
  const leadActive = [
    ...(filter === 'coming' ? [] : [{ key: 'when', label: whenLabel(filter), off: () => setFilter('coming') }]),
    ...picked.map((d) => ({ key: `department-${d}`, label: JOB_DEPARTMENT_LABELS[d], off: () => setPicked(picked.filter((x) => x !== d)) })),
  ]
  const lead = (
    <>
      <PillGroup label="When">
        {FILTERS.map(([f, label]) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {label} ({count(f).toLocaleString('en-IE')})
          </button>
        ))}
      </PillGroup>
      <DepartmentFilter pills picked={picked} onChange={setPicked} count={(d) => byDepartment.get(d) ?? 0} />
    </>
  )

  return (
    <section className="card plain jobs-card" aria-label="Jobs" ref={card}>
      {mayAdd && phone && (
        <Fold label="New job" from="job">
          <NewJob view={view} />
        </Fold>
      )}
      {jobs.length > 0 && (
        <ListTools
          name="jobs"
          items={searched}
          filters={filters}
          sorts={sorts}
          choices={choices}
          onChange={setChoices}
          shown={shownCount}
          what="jobs"
          lead={lead}
          leadActive={leadActive}
          onClear={() => {
            setFilter('coming')
            setPicked([])
          }}
          pills={['mine']}
          total={total}
        />
      )}
      {shownCount === 0 && searched.length > 0 && <p className="empty">No job here matches those filters.</p>}
      {searched.length === 0 && picked.length > 0 && jobs.length > 0 && <p className="empty">No job here involves {jobDepartmentsInWords(picked)}.</p>}
      {searched.length === 0 && picked.length === 0 && <Empty>{jobs.length === 0 && 'Add the first one under New job.'}</Empty>}
      {shownCount > 0 && listedCount === 0 && <p className="hint">Nothing in the next fortnight.</p>}
      {/* A long list (audit finding 11, ADR 0050): only the rows near the screen are drawn, and Back finds its place by them (places.ts). */}
      <ul className="job-list windowed" ref={win.list} style={win.style}>
        {win.rows.map((r) =>
          'job' in r ? (
            <li key={r.job.id} ref={win.row(r.job.id)} data-place={r.job.id} aria-setsize={listedCount} aria-posinset={r.n + 1}>
              <JobRow job={r.job} kit={view.kit.byJob.get(r.job.id)} view={view} current={false} />
            </li>
          ) : (
            <li key={rowKey(r)} ref={win.row(rowKey(r))} data-place={rowKey(r)} className="week-head">
              <h3 className="group">{r.label}</h3>
            </li>
          )
        )}
      </ul>
      {listedCount < shownCount && (
        <button
          type="button"
          className="link show-all"
          onClick={() => {
            showingAll = true
            setAll(true)
          }}
        >
          Show all {shownCount.toLocaleString('en-IE')} coming up
        </button>
      )}
    </section>
  )
}

/** A job in the next fortnight with neither is worth a prompt; on every other row the empty line is noise (audit of 16 October, finding 8). */
const PROMPT_DAYS = 14

const sameWord = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function JobRow({ job, kit, view, current }: { job: JobView; kit: readonly KitLineView[] | undefined; view: View; current: boolean }) {
  const crew = crewFill(job.calls)
  // A sale's kit would only be short if it went ahead, which its position (the quote's) doesn't say: the flag stays for it.
  const short = job.status !== 'confirmed' ? kitShort(kit) : undefined
  const today = useToday()
  const where = [job.client?.name, job.venue?.name].filter(Boolean).join(' · ')
  // An errand or a meeting never has a client to name, so it isn't prompted for one (review of 11 November 2026, finding 5).
  const soon = hasSteps(job) && !!job.span && job.span.end >= today && job.span.start <= addDays(today, PROMPT_DAYS)
  // The crew count once a row: when the position already says it ("Planning · 5 of 10 booked"), it isn't said again at the side.
  const steps = view.steps.of(job.id)
  const crewHint = steps?.steps.find((s) => s.key === 'crew')?.hint
  const crewSaid = hasSteps(job) && !!crewHint && !!steps?.stage?.hint?.includes(crewHint)
  return (
    <a className="job-row" href={`#jobs/${job.id}`} aria-current={current ? 'page' : undefined}>
      <div>
        <b>{job.name}</b>
        {(where || soon) && <p>{where || 'No client or venue yet'}</p>}
        <p>
          {/* The kind once: a meeting whose one phase is called Meeting doesn't say it twice (audit, 20 October 2026, finding 77a). */}
          {kindOf(job) !== 'gig' && !sameWord(KIND_LABELS[kindOf(job)], phaseNames(job.phases)) && `${KIND_LABELS[kindOf(job)]} · `}
          {job.span ? spanLabel(job.span) : 'No dates yet'}
          {job.phases.length > 0 && ` · ${phaseNames(job.phases)}`}
        </p>
        {/* Where the job stands, under its dates (ADR 0104; Move 7 of the sweep of 6 November 2026): the one position part, the
            same as the job's head, Home and the Board say it, which carries a kit shortfall in its words and its tone. */}
        {/* An errand or a meeting already says its kind and day on the line above. */}
        {hasSteps(job) && <JobPosition job={job} view={view} />}
      </div>
      <div className="side">
        {/* The pill for a sale or a stopped job; once confirmed, the position says where it stands, so Confirmed isn't the biggest word. */}
        {(job.status !== 'confirmed' || job.pending || !hasSteps(job)) && <JobStatusPill status={job.status} pending={job.pending} />}
        {crew.needed > 0 && !crewSaid && (
          <small>
            {/* Booked, as the sheet, the link and Calls say it, so this line's Confirmed is only ever the job's (UX sweep, 6 November 2026, move 4). */}
            Crew {crew.booked} of {crew.needed} booked
            {crew.toConfirm > 0 && `, ${crew.toConfirm} to confirm`}
          </small>
        )}
        {short && <small className={`flag ${short}`}>Kit short</small>}
      </div>
    </a>
  )
}

interface PhaseDraft {
  key: string
  name: string
  start: string
  end: string
}

/** A new job with its first phases, all in one go. Clients and venues not yet known are added as typed. */
function NewJob({ view }: { view: View }) {
  const { clients, venues } = view.jobs
  const today = useToday()
  const first = (): PhaseDraft => ({ key: newId(), name: 'Show', start: today, end: today })
  const [f, setF] = useState({ name: '', client: '', venue: '', status: 'enquiry' as ProjectStatus, kind: 'gig' as ProjectKind })
  const [phases, setPhases] = useState<PhaseDraft[]>(() => [first()])
  const { run, error } = useAct()
  const setPhase = (key: string, changes: Partial<PhaseDraft>) =>
    setPhases(
      phases.map((p) => {
        if (p.key !== key) return p
        const next = { ...p, ...changes }
        if (next.end < next.start) next.end = next.start
        return next
      })
    )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return
    const id = newId()
    // A refusal brings what was typed back, unless the next thing has been typed since.
    const cleared = { name: '', client: '', venue: '', status: 'enquiry' as ProjectStatus, kind: 'gig' as ProjectKind }
    const clearedPhases = [first()]
    setF(cleared)
    setPhases(clearedPhases)
    void run(async () => {
      const clientId = await clientNamed(f.client, clients)
      const venueId = await venueNamed(f.venue, venues)
      await client.mutate('project.create', { id, name: f.name.trim(), clientId, venueId, status: f.status, kind: f.kind, notes: '' })
      for (const p of phases)
        if (p.name.trim()) await client.mutate('phase.add', { id: newId(), projectId: id, name: p.name.trim(), start: p.start, end: p.end, venueId: null, notes: '' })
    }).then((ok) => {
      if (ok) location.hash = `#jobs/${id}`
      else {
        setF((now) => (now === cleared ? f : now))
        setPhases((now) => (now === clearedPhases ? phases : now))
      }
    })
  }

  return (
    <form className="grid-form" onSubmit={submit}>
      <label className="wide">
        Job <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Nissan launch" required />
      </label>
      <ClientField jobs={view.jobs} optional value={f.client} onChange={(client) => setF((now) => ({ ...now, client }))} />
      <NewOrNear value={f.client} names={clients} what="client" onPick={(n) => setF({ ...f, client: n })} />
      <VenueField jobs={view.jobs} optional value={f.venue} onChange={(venue) => setF((now) => ({ ...now, venue }))} />
      <NewOrNear value={f.venue} names={venues} what="venue" onPick={(n) => setF({ ...f, venue: n })} />
      <label className="wide">
        Status
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectStatus })}>
          {PROJECT_STATUSES.filter((s) => !STOPPED.includes(s)).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {f.status === 'confirmed' && <p className="hint wide">A confirmed job goes on the jobs calendar and holds its kit.</p>}
      <label className="wide">
        Kind
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ProjectKind })}>
          {PROJECT_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="wide phase-rows">
        <legend>Phases</legend>
        {phases.map((p, i) => (
          <div className="phase-row" key={p.key}>
            <input list="phase-names" value={p.name} onChange={(e) => setPhase(p.key, { name: e.target.value })} aria-label={`Phase ${i + 1}`} placeholder="Build, Show…" />
            <input type="date" value={p.start} onChange={(e) => setPhase(p.key, { start: e.target.value })} aria-label={`Phase ${i + 1} from`} />
            <input type="date" value={p.end} min={p.start} onChange={(e) => setPhase(p.key, { end: e.target.value })} aria-label={`Phase ${i + 1} to`} />
            <button type="button" className="link" onClick={() => setPhases(phases.filter((x) => x.key !== p.key))} aria-label={`Remove phase ${i + 1}`}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const last = phases.at(-1)
            setPhases([...phases, { key: newId(), name: '', start: last?.end ?? today, end: last?.end ?? today }])
          }}
        >
          Add a phase
        </button>
      </fieldset>
      <Refusal error={error} className="wide" />
      <button type="submit" className="primary wide">
        Add job
      </button>
      <datalist id="phase-names">
        {PHASE_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </form>
  )
}

/** A client in the list: opens their own page, with their documents and their jobs (ADR 0032). */
function ClientRow({ c, jobs, docs }: { c: ClientView; jobs: number; docs: number }) {
  return (
    <a className="job-row" href={`#jobs/clients/${encodeURIComponent(c.id)}`}>
      <div>
        <b>{c.name}</b>
        <p>
          {jobs} job{jobs === 1 ? '' : 's'}
          {docs > 0 && ` · ${docs} document${docs === 1 ? '' : 's'}`}
          {c.contacts.length > 0 && ` · ${c.contacts.map((x) => x.name).join(', ')}`}
        </p>
      </div>
      <div className="side">
        <Pending pending={c.pending} />
      </div>
    </a>
  )
}

/** A venue in the list: opens its own page, with its documents and its jobs (ADR 0032). */
function VenueRow({ v, jobs, docs }: { v: VenueView; jobs: number; docs: number }) {
  return (
    <a className="job-row" href={`#jobs/venues/${encodeURIComponent(v.id)}`}>
      <div>
        <b>{v.name}</b>
        <p>
          {jobs} job{jobs === 1 ? '' : 's'}
          {docs > 0 && ` · ${docs} document${docs === 1 ? '' : 's'}`}
          {v.address && ` · ${v.address.split('\n')[0]}`}
          {!v.pin && ' · not on the map yet'}
        </p>
      </div>
      <div className="side">
        <Pending pending={v.pending} />
      </div>
    </a>
  )
}
