import {
  dayLabel,
  irishToday,
  money,
  plural,
  QUOTE_SHOWS,
  QUOTE_STATUS_LABELS,
  quoteNumberLabel,
  quoteRows,
  quoteRowShown,
  rmsOutcome,
  type QuoteRow,
  type QuoteShow,
  type QuoteView,
  type RmsOpportunity,
  type RmsOpportunityPage,
  type RmsOutcome,
  type View,
  activeFilters,
  listed,
  QUOTE_SORTS,
  quoteFilters,
  NOT_YOURS
} from '@sh/shared'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { AdminWords } from '../AdminWords.tsx'
import { useDesk } from '../foot.tsx'
import { MENU } from '../Up.tsx'
import { Empty } from '../Empty.tsx'
import { FromMailbox } from './Claude.tsx'
import { ShowAll } from '../Fold.tsx'
import { Heading } from '../Icon.tsx'
import { useAccess } from '../role.ts'
import { StatusPill, type PillTone } from '../StatusPill.tsx'
import { useToday, useView } from '../view.ts'
import { ListTools, useListChoices } from '../ListTools.tsx'
import { newQuoteAsked, newQuoteHref, Top, useHash } from './common.tsx'
import { Views } from '../Views.tsx'
import { shortcutHint } from '../shortcuts.tsx'
import { NewQuoteScreen, ToFollowUp } from './Money.tsx'
import { QuotePill } from './Quote.tsx'
import { getJson, type Loaded } from './rms.ts'

/**
 * Quotes (#quotes, ADR 0088): every quote in one place, a place of its own in the sidebar on a desk and on the Menu on a
 * phone, for the office and directors. What's waiting on the office first, with a new quote a press away, then every
 * job's quote, the last changed first, to find by job, client, venue, number or invoice. Each opens on the job's quote,
 * where it's changed: this page only finds them. Under them, the quotes from before the app, from Current RMS (ADR 0092),
 * found by the same search and shown by the same choice, so the history reads as one.
 */
/** Quotes' views (review of 11 November 2026, finding 7): what's waiting first, then every quote narrowed by where it stands. */
type QuotesView = 'follow' | QuoteShow
const QUOTE_VIEWS: [QuotesView, string, string][] = [
  ['follow', 'To follow up', '#quotes'],
  ['draft', 'Not sent', '#quotes/not-sent'],
  ['sent', 'Sent', '#quotes/sent'],
  ['accepted', 'Accepted', '#quotes/accepted'],
  ['declined', 'Turned down', '#quotes/turned-down'],
  ['all', 'All', '#quotes/all'],
]
const quotesViewOf = (hash: string): QuotesView => QUOTE_VIEWS.find(([, , href]) => href === hash)?.[0] ?? 'follow'

/** The search, kept for the tab's life so it holds from one view to the next and on Back from a quote, as the Jobs list's does. */
let quoteSearch = ''
const searchListeners = new Set<() => void>()
function useQuoteSearch(): [string, (next: string) => void] {
  const now = useSyncExternalStore(
    (fn) => (searchListeners.add(fn), () => void searchListeners.delete(fn)),
    () => quoteSearch
  )
  return [
    now,
    (next) => {
      quoteSearch = next
      for (const fn of searchListeners) fn()
    },
  ]
}

/**
 * Quotes (#quotes, ADR 0088): every quote in one place, a place of its own in the sidebar on a desk and on the Menu on a
 * phone, for the office and directors. Laid out as every list page is (Colly, 10 November 2026; review of 11 November 2026,
 * finding 7): the title with New quote on its line, the search, the views (To follow up first, then by where a quote stands),
 * Sort and Filter, then the quotes. Each opens on the job's quote, where it's changed: this page only finds them. Under them,
 * the quotes from before the app, from Current RMS (ADR 0092), found by the same search and shown by the same view, so the
 * history reads as one.
 */
export function QuotesScreen() {
  const view = useView()
  // A place of its own on a desk; on a phone it's under the Menu, and says so as the Menu's other places do (audit, 5 November 2026,
  // finding 96).
  const desk = useDesk()
  const access = useAccess()
  const hash = useHash()
  const [search, setSearch] = useQuoteSearch()
  const placed = desk ? { root: true as const } : { up: { steps: [MENU], here: 'Quotes' } }
  if (!access.can('money'))
    return (
      <div className="app crew jobs money quotes">
        <Top view={view} title="Quotes" {...placed} heading="Quotes" />
        <section className="card">
          <p className="empty">{NOT_YOURS.quotes} A director can change your role on the Crew tab.</p>
        </section>
      </div>
    )
  // New quote is a page of its own (ADR 0140, part 7), not a form opened inside To follow up.
  const asked = newQuoteAsked(hash)
  if (asked !== undefined) return <NewQuoteScreen key={asked} view={view} on={asked || undefined} />
  const current = quotesViewOf(hash)
  // A search on To follow up looks through every quote: what's typed is a quote being looked for, not one waiting.
  const show: QuoteShow | undefined = current === 'follow' ? (search.trim() ? 'all' : undefined) : current
  return (
    <div className="app crew jobs money quotes">
      <Top
        view={view}
        title="Quotes"
        {...placed}
        heading="Quotes"
        add={{ key: 'quote', label: 'New quote', page: newQuoteHref(), title: desk ? shortcutHint(newQuoteHref()) : undefined }}
        lead={<input className="search" type="search" placeholder="Find a job, client, venue or number" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find a quote" />}
        views={<Views label="Quotes views" current={current} pages={QUOTE_VIEWS.map(([key, label, href]) => ({ key, label, href }))} />}
      />
      {show ? (
        <QuoteList view={view} show={show} search={search} />
      ) : (
        <>
          <FromMailbox view={view} />
          <ToFollowUp view={view} />
        </>
      )}
    </div>
  )
}

function QuoteList({ view, show, search }: { view: View; show: QuoteShow; search: string }) {
  const rows = useMemo(() => quoteRows(view.money), [view.money])
  // Filter and sort (ADR 0099) on the quotes made here; the ones from Current RMS are kept on the server, newest first, by the same search and view.
  const today = useToday()
  const [choices, setChoices] = useListChoices('quotes')
  const filters = useMemo(() => quoteFilters(today), [today])
  const inView = rows.filter((r) => quoteRowShown(r, show, ''))
  const searched = rows.filter((r) => quoteRowShown(r, show, search))
  const shown = listed(searched, filters, QUOTE_SORTS, choices)
  const narrowed = activeFilters(filters, choices.filters).length > 0
  const label = show === 'all' ? 'All quotes' : `${QUOTE_SHOWS.find(([s]) => s === show)![1]} quotes`
  return (
    <>
      {inView.length > 0 && <ListTools name="quotes" items={searched} filters={filters} sorts={QUOTE_SORTS} choices={choices} onChange={setChoices} shown={shown.length} what="quotes" />}
      <section className="card quote-list" aria-label={label}>
        <Heading icon="document">{label}</Heading>
        {rows.length === 0 && <Empty>No quotes made here yet. Start one with New quote, at the top, or from a job's page.</Empty>}
        {rows.length > 0 && inView.length === 0 && <p className="hint">None here.</p>}
        {inView.length > 0 && shown.length === 0 && <p className="hint">No quote made here matches that.</p>}
        {/* A search or a filter looks through them all; otherwise the first thirty in the order chosen, until Show all. */}
        <ShowAll key={`${show} ${search} ${choices.sort} ${JSON.stringify(choices.filters)}`} items={shown} limit={search.trim() || narrowed ? shown.length : 30} what="quotes">
          {(list) => (
            <ul className="plain">
              {list.map((r) => (
                <QuoteRowItem key={r.job.id} r={r} />
              ))}
            </ul>
          )}
        </ShowAll>
        <FromCurrentRms view={view} show={show} search={search} />
        <p className="hint">
          Invoiced and paid quotes count as accepted. <a href="#jobs/money/prices">Price list</a> ·{' '}
          <a href="#jobs/money">Money</a>
        </p>
      </section>
    </>
  )
}

/** What last happened to a version, in a few words. */
function lastWord(q: QuoteView): string {
  if (q.status === 'draft') return 'Being put together'
  if (q.paidOn) return `Paid ${dayLabel(q.paidOn)}`
  if (q.invoicedOn) return `Invoiced ${dayLabel(q.invoicedOn)}${q.invoiceRef ? ` as ${q.invoiceRef}` : ''}`
  if (q.answeredOn) return `${QUOTE_STATUS_LABELS[q.status]} ${dayLabel(q.answeredOn)}`
  return q.sentOn ? `Sent ${dayLabel(q.sentOn)}` : QUOTE_STATUS_LABELS[q.status]
}

function QuoteRowItem({ r }: { r: QuoteRow }) {
  const { job, quote, behind } = r
  const number = quoteNumberLabel(behind ?? quote)
  const when = job.span ? (job.span.start === job.span.end ? dayLabel(job.span.start) : `${dayLabel(job.span.start)} to ${dayLabel(job.span.end)}`) : 'No dates yet'
  return (
    <li className="row">
      <div>
        <a href={`#jobs/${encodeURIComponent(job.id)}/quote`}>{job.name}</a>
        <p>
          {[job.client?.name, when, number && `No. ${number}`].filter(Boolean).join(' · ')}
          <br />
          {behind ? `Version ${quote.version} being put together over version ${behind.version}: ${lastWord(behind).toLowerCase()}` : lastWord(quote)} · {money(quote.totals.net)}
          {quote.lines.length === 0 && ' · No lines yet'}
        </p>
      </div>
      <QuotePill q={quote} />
    </li>
  )
}

/** How each of our choices reads Current RMS (ADR 0092): sent is still to come, accepted went ahead, turned down didn't. None was a draft here. */
const WENT: Record<QuoteShow, RmsOutcome | 'all' | null> = { all: 'all', draft: null, sent: 'open', accepted: 'ahead', declined: 'not' }
const OUTCOME_PILL: Record<RmsOutcome, [PillTone, string]> = { ahead: ['confirmed', 'Went ahead'], not: ['cancelled', "Didn't go ahead"], open: ['pending', 'Open'] }

/**
 * The quotes from before the app, from Current RMS (ADR 0092), under the app's own: newest first, fifty at a time, by
 * the same search and choice. Kept on the server, so they need signal; each opens on its own page, and one linked to
 * a job says which.
 */
function FromCurrentRms({ view, show, search }: { view: View; show: QuoteShow; search: string }) {
  const went = WENT[show]
  const [asked, setAsked] = useState(search.trim())
  const [pages, setPages] = useState(1)
  const [loaded, setLoaded] = useState<Loaded<RmsOpportunityPage>>({ state: 'loading' })
  // Asked a moment after typing stops, so each letter isn't a request.
  useEffect(() => {
    const t = setTimeout(() => setAsked(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => setPages(1), [asked, went])
  useEffect(() => {
    if (!went) return
    let live = true
    const q = `q=${encodeURIComponent(asked)}${went === 'all' ? '' : `&went=${went}`}`
    // Each page asked again as more are shown, so what came first stays in its place.
    void Promise.all(Array.from({ length: pages }, (_, i) => getJson<RmsOpportunityPage>(`/api/rms/opportunities?${q}&page=${i + 1}`))).then((all) => {
      if (!live) return
      const bad = all.find((l) => l.state !== 'ready')
      if (bad) return setLoaded(bad)
      const ready = all as { state: 'ready'; data: RmsOpportunityPage }[]
      setLoaded({
        state: 'ready',
        data: { total: ready[0]!.data.total, opportunities: ready.flatMap((l) => l.data.opportunities), links: Object.assign({}, ...ready.map((l) => l.data.links ?? {})) },
      })
    })
    return () => {
      live = false
    }
  }, [asked, went, pages])

  if (!went) return null
  if (loaded.state === 'gone') return null
  return (
    <div className="from-rms" aria-label="From Current RMS" role="group" aria-busy={loaded.state === 'loading'}>
      <h3>Before this app, from Current RMS</h3>
      {loaded.state === 'loading' && <p className="hint">Looking…</p>}
      {loaded.state === 'offline' && <p className="hint">The quotes from Current RMS are kept on the server, so they need signal.</p>}
      {loaded.state === 'ready' &&
        (loaded.data.total === 0 ? (
          <p className="hint">{asked || went !== 'all' ? 'None from Current RMS matches that.' : <AdminWords>Nothing has been read from Current RMS yet. Bring it in from Admin › Connections.</AdminWords>}</p>
        ) : (
          <>
            <p className="hint">
              {plural(loaded.data.total, 'quote')}
              {went === 'all' ? '' : ` ${QUOTE_SHOWS.find(([s]) => s === show)![1].toLowerCase()}`}, newest first. Read only: they're as Current RMS had them. An order
              that wasn't cancelled went ahead; one whose days passed with no order didn't.
            </p>
            <ul className="plain">
              {loaded.data.opportunities.map((o) => (
                <RmsRowItem key={o.id} o={o} job={jobName(view, loaded.data.links?.[o.id])} />
              ))}
            </ul>
            {loaded.data.opportunities.length < loaded.data.total && (
              <button type="button" className="link show-all" onClick={() => setPages(pages + 1)}>
                Show {Math.min(50, loaded.data.total - loaded.data.opportunities.length)} more of {loaded.data.total}
              </button>
            )}
          </>
        ))}
    </div>
  )
}

const jobName = (view: View, id: string | undefined) => {
  const j = id ? view.jobs.jobs.find((x) => x.id === id) : undefined
  return j ? { id: j.id, name: j.name } : undefined
}

const pastDay = (at: string) => new Date(at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Dublin' })

function RmsRowItem({ o, job }: { o: RmsOpportunity; job: { id: string; name: string } | undefined }) {
  const [tone, words] = OUTCOME_PILL[rmsOutcome(o, irishToday())]
  const a = o.startsAt ? pastDay(o.startsAt) : ''
  const b = o.endsAt ? pastDay(o.endsAt) : ''
  return (
    <li className="row">
      <div>
        <a href={`#jobs/money/current-rms/${o.id}`}>{o.subject || o.number}</a>
        <p>
          {[o.client, a && b && a !== b ? `${a} to ${b}` : a, o.number && `No. ${o.number}`].filter(Boolean).join(' · ')}
          <br />
          {[[o.state, o.status].filter(Boolean).join(', '), money(o.netCents)].filter(Boolean).join(' · ')}
          {job ? (
            <>
              {' · For '}
              <a href={`#jobs/${encodeURIComponent(job.id)}/quote`}>{job.name}</a>
            </>
          ) : (
            <>
              {' · '}
              <a href={`#jobs/money/current-rms/${o.id}/job`}>Make a job from it</a>
            </>
          )}
        </p>
      </div>
      <StatusPill tone={tone}>{words}</StatusPill>
    </li>
  )
}
