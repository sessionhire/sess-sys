import { PageAction } from '../foot.tsx'
import { namedExactly, newId, plural, STATUS_LABELS, type ClientView, type JobsView, type ProjectStatus, type VenueView, type View } from '@sh/shared'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NameField } from '../NameField.tsx'
import { useSeenAs } from '../home/Preview.tsx'
import { useNotDone } from '../problems.tsx'
import { NoticesButton, SearchButton } from '../NoticesButton.tsx'
import { OnThisScreen } from '../OnThisScreen.tsx'
import { StatusPill, type PillTone } from '../StatusPill.tsx'
import { client } from '../sync.ts'
import { ThemeButton } from '../ThemeButton.tsx'
import { Up, type Trail } from '../Up.tsx'
import { useTopBar } from '../useUnderTop.ts'
import { Icon } from '../Icon.tsx'
import { askToAdd, askToAddOn } from '../pageAdd.ts'
import { useAccess } from '../role.ts'

/** A list page's add, on its title's line (pageAdd.ts): the list's name, and what the button says ("New job"). */
export interface PageAdd {
  key: string
  label: string
  /** On another view of the list, where its form isn't: the list's address, gone to with the form opening there. */
  href?: string
  /** A page of its own rather than a form in the list (New quote, ADR 0140 part 7): the button is a link there. */
  page?: string
  /** Said on hover, as the keyboard shortcut to it. */
  title?: string
}

/**
 * New job, on the title's line of every view of the jobs (Colly, 10 November 2026): on the list it opens the form there; on the
 * Board, Calendar, Week and Month it goes to the list with the form open. Taking a job in is the office's (ADR 0034).
 */
export function useJobAdd(elsewhere = false): PageAdd | undefined {
  return useAccess().can('jobs') ? { key: 'job', label: 'New', href: elsewhere ? '#jobs' : undefined } : undefined
}

/** What the Jobs screens share, and Stock and Crew too: the header, a record's page, and picking or adding a client or venue by name. */

/** Quotes with New quote open on a day (ADR 0120): #quotes/new/2026-11-20, or today's with no day. */
export const newQuoteHref = (day?: string) => `#quotes/new${day ? `/${day}` : ''}`
/** The day #quotes/new/<day> asks for, '' for New quote on today, or undefined when it isn't asking. */
export function newQuoteAsked(hash: string): string | undefined {
  const m = /^#quotes\/new(?:\/(\d{4}-\d{2}-\d{2}))?$/.exec(hash)
  return m ? (m[1] ?? '') : undefined
}

export function useHash(): string {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}

/**
 * The top bar: the screen's name, what's waiting to sync, and what wasn't
 * done (audit finding 11), which counts every area's refusals and opens
 * the one list of them under the bar. The list is inside the header, so
 * the two stick to the top as one block and the list never covers the bar.
 */
/**
 * The bar at the top of every screen: the company's mark and name, which go
 * Home (ADR 0122), the sync state and dark or light (ADR 0036); after it, the parts of the
 * screen (ADR 0033), which put themselves on the parts. Under the name, the area; on the demo copy, whose
 * eyes it's seen through instead, the name taking you back to choose
 * again. Then the page's head, the same on every screen and outside any
 * card, so where you are is always in one place: the area's row of pages
 * (`views`), then the title naming this page (`heading`: Calls, Labels, a
 * job's name; on an area's own screen with none, `root`, the area's name),
 * with a line about it under (`sub`). `aside` goes top right, before
 * the sync state: Home's date. Every page under an area's own screen has
 * `up`, the way back up to it (Up.tsx), in the bar so it stays in view.
 */
export function Top({
  view,
  title = 'Jobs',
  root = false,
  aside,
  up,
  views,
  heading,
  badge,
  sub,
  picture,
  actions,
  add,
  lead,
}: {
  view: View
  title?: string
  root?: boolean
  /** The list's add, right of the title on the same line (pageAdd.ts). */
  add?: PageAdd
  /** Straight under the title, before the views: the list's search, the first thing done on it (Colly, 10 November 2026). */
  lead?: ReactNode
  aside?: ReactNode
  /** The page's one next thing (NextDock.tsx, ADR 0104): right of the title on a desk, docked above the bar on a phone. */
  actions?: ReactNode
  up?: Trail
  /** The area's row of pages (Views.tsx), first under the bar. */
  views?: ReactNode
  /** This page's own name, as its title: Calls rather than Crew, Labels rather than Stock. An area's own screen without one says the area's name. */
  heading?: ReactNode
  /** Beside the title: a record's state, as a job's status. */
  badge?: ReactNode
  /** Before the title: a person's photo or initials. */
  picture?: ReactNode
  /** A line or two under the title: what matters most about the page or the thing it's of. */
  sub?: ReactNode
}) {
  const waiting = view.pendingCount
  const notDone = useNotDone(view)
  const seenAs = useSeenAs()
  const bar = useTopBar()
  return (
    <>
      <header className="top" ref={bar}>
        <div className="brand">
          <span className="mark">SH</span>
          <span>
            {/* The company's mark and name go Home from every screen, as an app's logo does (ADR 0122): the whole block is the target. */}
            <b>{seenAs ? 'Session Hire' : <a className="home-link" href="#home" aria-label="Session Hire: Home">Session Hire</a>}</b>
            {seenAs ? (
              <small className="seen-as">
                Seeing it as{' '}
                <a href="#preview" aria-label={`${seenAs.name}: choose someone else`}>
                  {seenAs.name}
                </a>
                <MadeUp view={view} />
              </small>
            ) : (
              <small className="where">
                {title}
                <MadeUp view={view} />
              </small>
            )}
          </span>
        </div>
        <div className="state">
          {aside}
          {notDone.count}
          <span className={`conn ${view.connection === 'offline' ? 'offline' : waiting || view.copying ? 'syncing' : 'online'}`} role="status">
            {connWords(view)}
          </span>
          <SearchButton />
          <NoticesButton view={view} />
          <ThemeButton />
        </div>
        {up && <Up {...up} />}
        {notDone.list}
      </header>
      {/* The page's story in order (Colly, 10 November 2026): what this is and the way to add to it, then finding in it, then the
          other ways of seeing it, under a heading of their own so they read as a choice rather than as the page's title. */}
      {(heading ?? root) && <PageHead heading={heading ?? title} badge={badge} sub={sub} picture={picture} actions={actions} add={add} />}
      {lead}
      {views && (
        <section className="views-part" aria-labelledby="views-heading">
          <h2 className="views-heading" id="views-heading">
            Views
          </h2>
          {views}
        </section>
      )}
      <OnThisScreen />
    </>
  )
}

/**
 * The top bar's word for the connection. "Up to date" only once the copy has
 * arrived in full: before that, "Catching up" with how far it has got, so a
 * new phone's counts aren't vouched for while they're still climbing (audit,
 * 20 October 2026, finding 1).
 */
export function connWords(view: Pick<View, 'connection' | 'pendingCount' | 'copying'>): string {
  const waiting = view.pendingCount
  const share = view.copying && view.copying.share !== undefined ? ` · ${Math.floor(view.copying.share * 100)}%` : ''
  if (view.connection === 'offline') return `No signal${view.copying ? ' · not caught up' : ''}${waiting ? ` · ${waiting} waiting` : ''}`
  if (view.copying) return `Catching up${share}`
  return waiting ? `${waiting} waiting` : 'Up to date'
}

/** Beside each screen's name while the app holds made-up data (ADR 0019), so nobody mistakes it for real work. */
export function MadeUp({ view }: { view: Pick<View, 'madeUp'> }) {
  return view.madeUp ? <span className="made-up"> · made-up data</span> : null
}

/**
 * A record's page (a job, a product, an item, a place): on its own with the
 * top bar and the way up, or beside its list on a laptop (audit finding
 * 25), where the list's screen draws the bar, so just its cards.
 */
export function Page({
  view,
  title,
  className,
  up,
  bare,
  heading,
  badge,
  sub,
  picture,
  actions,
  children,
}: {
  view: View
  title?: string
  className: string
  up: Trail
  bare?: boolean
  actions?: ReactNode
  /** The record's name as the page's title, its state beside it and what matters about it under (Top). Beside its list, they head its column. */
  heading?: ReactNode
  badge?: ReactNode
  sub?: ReactNode
  picture?: ReactNode
  children: ReactNode
}) {
  if (bare)
    return (
      <>
        {heading && <PageHead heading={heading} badge={badge} sub={sub} picture={picture} actions={actions} />}
        {children}
      </>
    )
  return (
    <div className={`app ${className}`}>
      <Top view={view} title={title} up={up} heading={heading} badge={badge} sub={sub} picture={picture} actions={actions} />
      {children}
    </div>
  )
}

/** The page's title, outside any card: the one h1, the biggest words on the screen (ADR 0082). */
function PageHead({
  heading,
  badge,
  sub,
  picture,
  actions,
  add,
}: {
  heading: ReactNode
  badge?: ReactNode
  sub?: ReactNode
  picture?: ReactNode
  actions?: ReactNode
  add?: PageAdd
}) {
  const words = (
    <div className="page-words">
      <div className="page-title-row">
        <h1 className="page-title">{heading}</h1>
        {badge}
        {add?.page ? (
          <a className="button page-add" data-add={add.key} href={add.page} title={add.title}>
            <Icon name="add" />
            {add.label}
          </a>
        ) : (
          add && (
            <button type="button" className="page-add" data-add={add.key} title={add.title} onClick={() => (add.href ? askToAddOn(add.key, add.href) : askToAdd(add.key))}>
              <Icon name="add" />
              {add.label}
            </button>
          )
        )}
      </div>
      {sub && <div className="page-sub">{sub}</div>}
    </div>
  )
  return (
    <div className="page-head" data-actions={actions ? 'true' : undefined}>
      {picture ? (
        <div className="pictured">
          {picture}
          {words}
        </div>
      ) : (
        words
      )}
      {actions && <PageAction>{actions}</PageAction>}
    </div>
  )
}

/** On a laptop (audit finding 25): the list down the left, kept in view, with the open record beside it; `head` goes over both. */
export function Beside({
  view,
  title,
  className,
  views,
  heading,
  head,
  list,
  open,
  up,
  add,
  lead,
  children,
}: {
  view: View
  title?: string
  className: string
  /** The list's add and search (Top), while no record is open beside it. */
  add?: PageAdd
  lead?: ReactNode
  /** The area's row of pages, and the list's own name as the title while no record is open beside it. */
  views?: ReactNode
  heading?: ReactNode
  head?: ReactNode
  list: ReactNode
  /** Which record is open, if any: another picked from the list starts at its top. */
  open?: string
  /** The open record's breadcrumbs: the list beside it is its way back, so on a desk they only say where it is. */
  up?: Trail
  children: ReactNode
}) {
  // The window may be far down the last record, which would leave the next one's title out of sight; the list keeps its own place.
  const was = useRef(open)
  useEffect(() => {
    if (was.current === open) return
    was.current = open
    scrollTo(0, 0)
  }, [open])
  return (
    <div className={`app ${className} beside`}>
      <Top view={view} title={title} root={!open} views={views} heading={open ? undefined : heading} up={open ? up : undefined} add={open ? undefined : add} lead={open ? undefined : lead} />
      {head}
      <div className="columns">
        <div className="column list">{list}</div>
        <div className="column open">{children}</div>
      </div>
    </div>
  )
}

export const STATUS_TONE: Record<ProjectStatus, PillTone> = {
  enquiry: 'pending',
  quoted: 'pending',
  confirmed: 'confirmed',
  cancelled: 'cancelled',
  lost: 'cancelled',
}

/** A job's status as a pill, "Waiting to sync" while this device's change is on its way. */
export function JobStatusPill({ status, pending }: { status: ProjectStatus; pending: boolean }) {
  return (
    <StatusPill tone={STATUS_TONE[status]} pending={pending}>
      {STATUS_LABELS[status]}
    </StatusPill>
  )
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** A name with its case, fadas, spaces and punctuation set aside: "Ó Sé's Bar" and "o ses bar" are one. */
const bare = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** How many letters to add, drop or change to turn one into the other. */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    row = next
  }
  return row[b.length]!
}

/** The one already here under this name, set aside how it's spelt in case, fadas, spaces and punctuation. */
const known = <T extends { name: string }>(name: string, all: readonly T[]) => all.find((c) => same(c.name, name)) ?? all.find((c) => bare(c.name) === bare(name) && bare(name) !== '')

/**
 * The one already here that what's typed is a slip away from: a letter or
 * two off, as "Shannonside Festival" is from "Shannonside Festivals" (audit,
 * 5 November 2026, finding 21). Short names allow one letter, longer two.
 */
export function nearly<T extends { name: string }>(name: string, all: readonly T[]): T | undefined {
  const typed = bare(name)
  if (typed.length < 4 || known(name, all)) return undefined
  const room = typed.length >= 8 ? 2 : 1
  let best: { one: T; d: number } | undefined
  for (const one of all) {
    const other = bare(one.name)
    if (Math.abs(other.length - typed.length) > room) continue
    const d = distance(typed, other)
    if (d <= room && (!best || d < best.d)) best = { one, d }
  }
  return best?.one
}

/**
 * Under a client or venue field: a name a slip away from one already here
 * offers it in one press, and a name not here says it will be added, so a
 * typo doesn't quietly make a second client (audit, 5 November 2026,
 * finding 21). Nothing while it's one already here.
 */
export function NewOrNear({ value, names, what, onPick }: { value: string; names: readonly { id: string; name: string }[]; what: 'client' | 'venue'; onPick: (name: string) => void }) {
  const typed = value.trim()
  if (!typed || known(typed, names)) return null
  const near = nearly(typed, names)
  return (
    <p className="hint wide new-or-near" aria-live="polite">
      {near ? (
        <>
          Did you mean{' '}
          <button type="button" className="link" onClick={() => onPick(near.name)}>
            {near.name}
          </button>
          ? If not, “{typed}” is added as a new {what}.
        </>
      ) : (
        <>“{typed}” is added as a new {what}.</>
      )}
    </p>
  )
}

/** Clients and venues with how many jobs each has had, most used first: the order the name fields offer them in. */
function useUsed(jobs: JobsView) {
  return useMemo(() => {
    const clientJobs = new Map<string, number>()
    const venueJobs = new Map<string, number>()
    for (const j of jobs.jobs) {
      if (j.clientId) clientJobs.set(j.clientId, (clientJobs.get(j.clientId) ?? 0) + 1)
      const at = new Set([j.venueId, ...j.phases.map((p) => p.venueId)].filter((v): v is string => !!v))
      for (const v of at) venueJobs.set(v, (venueJobs.get(v) ?? 0) + 1)
    }
    const byUse = <T extends { id: string; name: string }>(all: readonly T[], n: Map<string, number>) =>
      [...all].sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    return { clients: byUse(jobs.clients, clientJobs), venues: byUse(jobs.venues, venueJobs), clientJobs, venueJobs }
  }, [jobs])
}

const jobsWord = (n: number) => (n ? plural(n, 'job') : 'No jobs yet')
/** A venue's address on one line, short enough to sit under its name. */
const addressLine = (address: string) => {
  const line = address.replace(/\s*\n\s*/g, ', ').trim()
  return line.length > 60 ? `${line.slice(0, 59)}…` : line
}

interface NameFieldProps {
  jobs: JobsView
  value: string
  onChange: (name: string) => void
  label?: string
  optional?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

/** The client of a job or quote: one already here, found as it's typed, or a new one added when the form is saved (clientNamed). */
export function ClientField({ jobs, label = 'Client', ...rest }: NameFieldProps) {
  const used = useUsed(jobs)
  return <NameField {...rest} label={label} what="client" records={used.clients} first={used.clients.slice(0, 5)} meta={(f) => jobsWord(used.clientJobs.get(f.record.id) ?? 0)} />
}

/** The venue of a job, a phase or a quote, found by its name or address, or a new one added when the form is saved (venueNamed). */
export function VenueField({ jobs, label = 'Venue', ...rest }: NameFieldProps) {
  const used = useUsed(jobs)
  return (
    <NameField
      {...rest}
      label={label}
      what="venue"
      records={used.venues}
      first={used.venues.slice(0, 5)}
      also={(v) => v.address}
      meta={(f) => [addressLine(f.record.address), jobsWord(used.venueJobs.get(f.record.id) ?? 0)].filter(Boolean).join(' · ')}
    />
  )
}

/** The client with this name, added if there isn't one yet; null for no name. */
export async function clientNamed(name: string, clients: readonly ClientView[]): Promise<string | null> {
  if (!name.trim()) return null
  const found = known(name, clients)
  if (found) return found.id
  const id = newId()
  await client.mutate('client.upsert', { id, name: name.trim(), contacts: [], notes: '' })
  return id
}

/**
 * Who asked, added to the client's contacts when they aren't one yet, so the next quote for that client offers them.
 * Nothing when there's no client or no name, or the client has the most contacts it can hold.
 */
export async function contactAdded(clientId: string | null, clientName: string, who: string, clients: readonly ClientView[]): Promise<void> {
  const name = who.trim().replace(/\s+/g, ' ')
  if (!clientId || !name) return
  const held = clients.find((c) => c.id === clientId)
  const contacts = held?.contacts ?? []
  if (namedExactly(contacts, name) || contacts.length >= MOST_CONTACTS) return
  await client.mutate('client.upsert', {
    id: clientId,
    name: held?.name ?? clientName.trim(),
    contacts: [...contacts, { name, role: '', email: null, phone: null }],
    notes: held?.notes ?? '',
    ...(held?.address !== undefined && { address: held.address }),
  })
}
/** As many contacts as a client holds (jobs.ts). */
const MOST_CONTACTS = 20

/** The venue with this name, added if there isn't one yet; null for no name. */
export async function venueNamed(name: string, venues: readonly VenueView[]): Promise<string | null> {
  if (!name.trim()) return null
  const found = known(name, venues)
  if (found) return found.id
  const id = newId()
  await client.mutate('venue.upsert', { id, name: name.trim(), address: '', notes: '' })
  return id
}

