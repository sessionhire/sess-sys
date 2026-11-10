import { UnitBox } from '../UnitBox.tsx'
import {
  addDays,
  belowZero,
  costsCsv,
  dayLabel,
  daysLabel,
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  euroText,
  invoicesCsv,
  marginsByMonth,
  money,
  moneyMonth,
  namedExactly,
  newId,
  parseEuro,
  pctWord,
  plural,
  quotesToFollow,
  quoteWantedBy,
  RATE_LABELS,
  RATE_RULES,
  RATE_UNIT,
  standing,
  vatPeriodOf,
  vatSummaryCsv,
  type CostRow,
  type JobMoney,
  type MoneyView,
  type OwedBy,
  type Period,
  type QuoteToFollow,
  type RateRule,
  type View,
  eachDay,
  enquiryPhases,
  enquirySuggestions,
  MAX_LINES,
  spanLabel,
  suggestionLine,
  type EnquiryReading,
  STANDING_HEADINGS,
  waitingHeading,
  listHeading,
  KIND_PHASE,
} from '@sh/shared'
import { Fragment, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { arrive } from '../arrival.ts'
import { Empty } from '../Empty.tsx'
import { ShowAll } from '../Fold.tsx'
import { Heading } from '../Icon.tsx'
import { Sideways } from '../more.tsx'
import { useAccess } from '../role.ts'
import { Pending } from '../StatusPill.tsx'
import { client } from '../sync.ts'
import { JOBS, MONEY, QUOTES } from '../Up.tsx'
import { useToday } from '../view.ts'
import { ByClaude, FromEnquiry, offer, pricingOf, Suggestions, takingWords, useClaude, type Offered } from './Claude.tsx'
import { ClientField, clientNamed, contactAdded, NewOrNear, newQuoteHref, Top, VenueField, venueNamed } from './common.tsx'
import { useDesk } from '../foot.tsx'
import { shortcutHint } from '../shortcuts.tsx'
import { NameField } from '../NameField.tsx'
import { addKitFromQuote, kitToAdd } from './Kit.tsx'
import { PackagesCard } from './Packages.tsx'
import { StarterPackagesCard } from './StarterPackages.tsx'
import { FromPastJob } from './PastJobs.tsx'
import { takeQuickDraft } from './QuickQuote.tsx'
import { JobViews } from './PlanScreen.tsx'
import { InStep, QuotePill } from './Quote.tsx'

/**
 * Money (ADR 0042), #jobs/money, on Jobs' row, where the director looks:
 * by month, what's quoted, confirmed and invoiced; who still owes; what's
 * owed to freelancers; each job's margin; and the accountant's files. The
 * price list it's all built from is its own page beneath it,
 * #jobs/money/prices. The app keeps the records and makes the files; it
 * sends nothing and books nothing into accounts.
 */

export function NotYours({ view, here }: { view: View; here?: string }) {
  return (
    <div className="app crew jobs money">
      <Top
        view={view}
        up={here ? { steps: [JOBS, MONEY], here } : undefined}
        views={!here && <JobViews current="money" />}
        heading={here ?? 'Money'}
      />
      <section className="card">
        <p className="empty">Money is for the office and directors. A director can change your role on the Crew tab.</p>
      </section>
    </div>
  )
}

export function MoneyScreen({ view }: { view: View }) {
  const today = useToday()
  if (!useAccess().can('money')) return <NotYours view={view} />
  const m = view.money
  return (
    <div className="app crew jobs money">
      <Top view={view} views={<JobViews current="money" />} heading="Money" />
      <section className="card plain">
        <MoneyFacts view={view} today={today} />
        <p className="hint">
          Before VAT, by the month each job starts, except what's accepted and unpaid, which is with VAT, as an invoice asks. <a href="#quotes">Quotes</a> · <a href="#jobs/money/prices">Price list</a> ·{' '}
          <a href="#jobs/money/current-rms">Past quotes from Current RMS</a>
        </p>
      </section>
      <ByMonth m={m} />
      {/* What's owed comes from approved timesheets: not shown while they're off (ADR 0090), unless some approved are still to pay. */}
      {(view.office.useTimesheets || m.costsOwed.length > 0) && <Owed m={m} />}
      <Freelancers m={m} />
      <Margins m={m} today={today} />
      <ForTheAccountant m={m} />
    </div>
  )
}

/** "today", "yesterday", "9 days ago". */
const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`)

/** One quote waiting on the office: the job, what's waiting and for how long, and what it comes to. */
function FollowRow({ f, what, chase, late, when, children }: { f: QuoteToFollow; what: string; chase?: boolean; late?: boolean; when?: string; children?: ReactNode }) {
  return (
    <li className="row">
      <div>
        <a href={`#jobs/${encodeURIComponent(f.job.id)}/quote`}>{f.job.name}</a>
        <p>
          {[f.job.client?.name, `version ${f.quote.version}`, money(f.quote.totals.net)].filter(Boolean).join(' · ')}
          <br />
          <span className={chase || late ? 'warn' : undefined}>
            {what}
            {when === '' ? '' : ` ${when ?? ago(f.days)}`}
            {chase ? ': worth a call' : ''}
          </span>
          {/* Its prices held until a day that has passed (research/quoting.md, feature 4): a new version, or a word with the client that they stand. */}
          {f.ranOut && (
            <>
              <br />
              <span className="warn">Prices held until {dayLabel(f.ranOut)}: check they stand, or start a new version</span>
            </>
          )}
        </p>
      </div>
      {children}
    </li>
  )
}

/**
 * To follow up (ADR 0081), at the top of Quotes (ADR 0088, at first on Money): a new one in a few words, and every quote
 * waiting on the office, the longest waiting first: answered but the job not yet in step, sent with no answer (a call
 * after a week), and drafts not sent. Nothing here is sent to anyone: the office rings or emails the client themselves.
 */
export function ToFollowUp({ view }: { view: View }) {
  const today = useToday()
  const desk = useDesk()
  const f = quotesToFollow(view.money, today, quoteWantedBy(view))
  const none = f.drafts.length + f.overDrafts.length + f.waiting.length + f.passed.length + f.outOfStep.length + f.toInvoice.length === 0
  return (
    <section className="card quotes-to-follow" aria-label="To follow up">
      <Heading icon="document">To follow up</Heading>
      {/* Plain, as every list's add is: the red fill is for the one next thing (UX sweep, 6 November 2026, move 1). A page of its
          own (ADR 0140, part 7). */}
      <a className="button" href={newQuoteHref()} title={desk ? shortcutHint(newQuoteHref()) : undefined}>
        New quote
      </a>
      {none && <Empty>No quote is waiting on anyone. Start a new one here, or from a job's page.</Empty>}
      <QuoteGroups f={f} lapsed={standing(view, today)['no-answer'].length} />
    </section>
  )
}

/** How many rows of each group To follow up and Accepted, unpaid draw before Show all (audit, 5 November 2026, finding 53). */
const FOLLOW_SHOWN = 8

/**
 * `lapsed`: every job whose dates passed with no answer, Home's count of them (ADR 0109): the ones with a quote sent are
 * here, and the Board's fold has them all, enquiries that never had a quote too.
 */
function QuoteGroups({ f, chaseOnly, lapsed = 0 }: { f: ReturnType<typeof quotesToFollow>; chaseOnly?: boolean; lapsed?: number }) {
  const waiting = chaseOnly ? f.chase : f.waiting
  const today = useToday()
  // A draft's day wanted, as each row says it (ADR 0127): "Wanted today", "Wanted Tue 12 Nov", "Was wanted Mon 10 Nov".
  const wantedWords = (x: QuoteToFollow) =>
    x.wanted === undefined ? undefined : x.wanted === today ? 'Wanted today' : x.wanted < today ? `Was wanted ${dayLabel(x.wanted, today)}` : `Wanted ${dayLabel(x.wanted, today)}`
  const notDue = f.drafts.filter((d) => !f.due.includes(d))
  return (
    <>
      {/* What the client wants today, or wanted already, first (ADR 0127; audit of the quote flow, 8 November 2026, finding 7). */}
      {!chaseOnly && f.due.length > 0 && (
        <div className="follow-group">
          <h3 className="group">{listHeading(STANDING_HEADINGS['quotes-due'], f.due.length)}</h3>
          <ul className="plain">
            {f.due.map((x) => (
              <FollowRow key={x.quote.id} f={x} what={wantedWords(x)!} when="" late={x.wanted! < today} />
            ))}
          </ul>
        </div>
      )}
      {f.outOfStep.length > 0 && (
        <div className="follow-group">
          <h3 className="group">Answered: put the job in step</h3>
          <ShowAll items={f.outOfStep} limit={FOLLOW_SHOWN} what="quotes" name={`${chaseOnly ? 'chase' : 'follow'} in step`}>
            {(shown) => (
              <ul className="plain">
                {shown.map((x) => (
                  <FollowRow key={x.quote.id} f={x} what={x.want === 'confirmed' ? 'Accepted' : 'Turned down'}>
                    <InStep job={x.job} want={x.want} compact />
                  </FollowRow>
                ))}
              </ul>
            )}
          </ShowAll>
        </div>
      )}
      {/* The office's last step (UX sweep, 6 November 2026, move 12): the jobs through, their accepted quote not invoiced. */}
      {!chaseOnly && f.toInvoice.length > 0 && (
        <div className="follow-group">
          <h3 className="group">{listHeading(STANDING_HEADINGS['to-invoice'], f.toInvoice.length)}</h3>
          <ShowAll items={f.toInvoice} limit={FOLLOW_SHOWN} what="jobs" name="follow to invoice">
            {(shown) => (
              <ul className="plain">
                {shown.map((x) => (
                  <FollowRow key={x.quote.id} f={x} what="Through since" when={dayLabel(x.job.span!.end, today)} />
                ))}
              </ul>
            )}
          </ShowAll>
        </div>
      )}
      {waiting.length > 0 && (
        <div className="follow-group">
          {/* On Quotes, where Home's count of the quotes worth a call lands, how many are waiting and how many of them are worth a
              call, the longest waiting at the top. Notifications lists only those, and no count lands there, so its heading has no number. */}
          <h3 className="group">{chaseOnly ? STANDING_HEADINGS.quotes : waitingHeading(waiting.length, f.chase.length)}</h3>
          <ShowAll items={waiting} limit={FOLLOW_SHOWN} what="quotes" name={`${chaseOnly ? 'chase' : 'follow'} waiting`}>
            {(shown) => (
              <ul className="plain">
                {shown.map((x) => (
                  <FollowRow key={x.quote.id} f={x} what="Sent" chase={f.chase.includes(x)} />
                ))}
              </ul>
            )}
          </ShowAll>
        </div>
      )}
      {/* Not a client to ring: the job happened without them, or went elsewhere (ADR 0109). */}
      {!chaseOnly && f.passed.length > 0 && (
        <div className="follow-group">
          <h3 className="group">
            Dates passed with no answer ({f.passed.length}
            {lapsed > f.passed.length && ` of ${plural(lapsed, 'job')}`})
          </h3>
          {lapsed > f.passed.length && (
            <p className="hint">
              <a href="#jobs/board" onClick={() => arrive({ hash: '#jobs/board', part: STANDING_HEADINGS['no-answer'] })}>
                All {lapsed} on the Board
              </a>
              , enquiries with no quote sent too.
            </p>
          )}
          <ShowAll items={f.passed} limit={FOLLOW_SHOWN} what="quotes" name="follow passed">
            {(shown) => (
              <ul className="plain">
                {shown.map((x) => (
                  <FollowRow key={x.quote.id} f={x} what="Sent">
                    <InStep job={x.job} want="lost" compact />
                  </FollowRow>
                ))}
              </ul>
            )}
          </ShowAll>
        </div>
      )}
      {!chaseOnly && notDue.length > 0 && (
        <div className="follow-group">
          <h3 className="group">Not sent yet</h3>
          <ShowAll items={notDue} limit={FOLLOW_SHOWN} what="quotes" name="follow drafts">
            {(shown) => (
              <ul className="plain">
                {shown.map((x) => (
                  <FollowRow key={x.quote.id} f={x} what={wantedWords(x) ? `${wantedWords(x)} · last changed` : 'Last changed'} />
                ))}
              </ul>
            )}
          </ShowAll>
        </div>
      )}
      {/* Drafts for jobs whose days are over: nothing to send, so kept apart under the rest. */}
      {!chaseOnly && f.overDrafts.length > 0 && (
        <div className="follow-group">
          <h3 className="group">Not sent, the job is over</h3>
          <ShowAll items={f.overDrafts} limit={FOLLOW_SHOWN} what="quotes" name="follow over drafts">
            {(shown) => (
              <ul className="plain">
                {shown.map((x) => (
                  <FollowRow key={x.quote.id} f={x} what="Over" when={dayLabel(x.job.span!.end, today)} />
                ))}
              </ul>
            )}
          </ShowAll>
        </div>
      )}
    </>
  )
}

/**
 * On Notifications, for the office and directors (ADR 0081): only the quotes that need doing something about, a
 * client to ring and jobs to put in step. Worked out on this device, so it shows without signal.
 */
export function QuotesToChase({ view }: { view: View }) {
  const today = useToday()
  const f = quotesToFollow(view.money, today)
  if (f.chase.length + f.outOfStep.length === 0) return null
  return (
    <section className="card quotes-to-follow" aria-label="Quotes to follow up">
      <Heading icon="document">Quotes to follow up</Heading>
      <p className="hint">
        Sent over a week ago with no answer, or answered with the job not yet in step. The app contacts nobody: ring or email the client yourself. All
        quotes are on <a href="#quotes">Quotes</a>.
      </p>
      <QuoteGroups f={f} chaseOnly />
    </section>
  )
}

/**
 * A quote from nothing (ADR 0081): the job in a few words, made as an enquiry with its days as one Show, and its
 * first draft opened, so a phone call can turn into a quote without making the job first.
 */
const ENQUIRY_WAYS = ['email', 'phone', 'person', 'other'] as const
type EnquiryWay = (typeof ENQUIRY_WAYS)[number]
const ENQUIRY_WAY_LABELS: Record<EnquiryWay, string> = { email: 'Email', phone: 'Phone', person: 'In person', other: 'Another way' }
const ENQUIRY_WAY_WORDS: Record<EnquiryWay, string> = { email: ' by email', phone: ' by phone', person: ' in person', other: '' }

/** The job's first line of notes, when who asked or how was said: "Enquiry by phone from Aoife Byrne." */
function enquiryLine(by: string, how: EnquiryWay | ''): string {
  const who = by.trim().replace(/\s+/g, ' ').slice(0, 200)
  if (!who && !how) return ''
  return `Enquiry${how ? ENQUIRY_WAY_WORDS[how] : ''}${who ? ` from ${who}` : ''}.`
}

/**
 * New quote as a page of its own (ADR 0140, part 7): the client first, with the jobs and quotes like it to start from straight
 * under it, then the job's name and days and Start; the rest of the enquiry folded under More about the enquiry.
 */
export function NewQuoteScreen({ view, on }: { view: View; on?: string | undefined }) {
  return (
    <div className="app crew jobs money quotes new-quote-page">
      <Top view={view} title="New quote" up={{ steps: [QUOTES], here: 'New quote' }} heading="New quote" />
      <section className="card">
        <NewQuote view={view} on={on} onCancel={() => location.replace('#quotes')} />
      </section>
    </div>
  )
}

function NewQuote({ view, on, onCancel }: { view: View; on?: string | undefined; onCancel: () => void }) {
  const me = useAccess().personId
  const today = useToday()
  const { clients, venues } = view.jobs
  // From a day on the planner (ADR 0120), the job's days start there; a day gone starts today, as New quote does.
  const first = on && on >= today ? on : today
  // Started from the planner's card with More options (ADR 0124), what was typed there comes along; otherwise empty, on the day.
  const [f, setF] = useState(() => {
    const quick = takeQuickDraft()
    return quick ? { ...quick, start: quick.start >= today ? quick.start : today, end: quick.end >= today ? quick.end : today } : { name: '', client: '', venue: '', start: first, end: first }
  })
  // Who asked, how it came and when they want it by (research/quoting.md, feature 6): the first two go in the job's notes as
  // a line, the day is the Quote sent task's due day, so it's on someone's list and late shows as late.
  const [asked, setAsked] = useState<{ by: string; how: EnquiryWay | ''; quoteBy: string }>({ by: '', how: '', quoteBy: '' })
  // Two shapes of quote (ADR 0128; audit of the quote flow, finding 10): a show has a venue, crew and travel; a dry hire is
  // collected and returned, so it asks for neither and its days are one Hire.
  const [hire, setHire] = useState(false)
  const [more, setMore] = useState(false)
  const shapeId = useId()
  // Who asked is someone at the client, or anyone at any client while no client is chosen; a new name is added to the
  // client's contacts when the quote is started.
  const chosenClient = namedExactly(clients, f.client)
  const askers = useMemo(
    () => (chosenClient ? [chosenClient] : clients).flatMap((c) => c.contacts.map((p) => ({ name: p.name, role: p.role, client: c.name }))),
    [chosenClient, clients]
  )
  // What Claude read of an enquiry (ADR 0096): the job's parts and lines, until the dates are changed by hand.
  const claude = useClaude(view)
  const [read, setRead] = useState<EnquiryReading>()
  const [phases, setPhases] = useState<{ name: string; start: string; end: string }[]>([])
  const [lines, setLines] = useState<Offered[]>([])
  // The past job the lines were started from (ADR 0115), until another is picked or it's picked again to clear them.
  const [fromJob, setFromJob] = useState<string>()
  const { run, error } = useAct()
  const onRead = (r: EnquiryReading) => {
    const parts = enquiryPhases(r)
    const start = parts[0]?.start ?? f.start
    const end = parts.reduce((e, ph) => (ph.end > e ? ph.end : e), start)
    setF({ name: r.name || f.name, client: r.client || f.client, venue: r.venue || f.venue, start, end })
    setAsked({ by: r.asker || asked.by, how: asked.how, quoteBy: r.quoteBy && r.quoteBy >= today ? r.quoteBy : asked.quoteBy })
    setPhases(parts.length > 1 ? parts : [])
    if (r.asker || r.quoteBy) setMore(true)
    setLines(offer(enquirySuggestions(r, pricingOf(view), eachDay(start, end).length)))
    setFromJob(undefined)
    setRead(r)
  }
  const dates = (next: { start: string; end: string }) => {
    setF({ ...f, ...next })
    setPhases([])
  }
  // A dry hire takes no crew: crew read from an enquiry or a past job stay off it.
  const offered = hire ? lines.filter((x) => x.s.kind !== 'crew') : lines
  const taking = offered.filter((x) => x.take)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return
    const id = newId()
    void run(async () => {
      const clientId = await clientNamed(f.client, clients)
      await contactAdded(clientId, f.client, asked.by, clients)
      const venueId = hire ? null : await venueNamed(f.venue, venues)
      const kind = hire ? 'hire' : 'gig'
      await client.mutate('project.create', { id, name: f.name.trim(), clientId, venueId, status: 'enquiry', kind, notes: enquiryLine(asked.by, asked.how) })
      // Whoever starts the quote is on its task (ADR 0127; audit of the quote flow, finding 7), with the day it's wanted by.
      if (asked.quoteBy || me) await client.mutate('jobStep.set', { projectId: id, step: 'quote', ...(asked.quoteBy ? { dueOn: asked.quoteBy } : {}), ...(me ? { ownerId: me } : {}) })
      for (const ph of phases.length && !hire ? phases : [{ name: KIND_PHASE[kind], start: f.start, end: f.end < f.start ? f.start : f.end }])
        await client.mutate('phase.add', { id: newId(), projectId: id, name: ph.name, start: ph.start, end: ph.end, venueId: null, notes: '' })
      const quoteLines = taking.map((x) => suggestionLine(x.s, newId())).slice(0, MAX_LINES)
      await client.mutate('quote.save', { id: newId(), projectId: id, lines: quoteLines, discountPct: view.money.discountOf(clientId) ?? 0, notes: '', ...(clientId && asked.by.trim() ? { forName: asked.by.trim() } : {}) })
      // Its kit on the job's kit list as well (ADR 0102), to change there as any kit is.
      await addKitFromQuote(id, kitToAdd(view, quoteLines, id))
    }).then((ok) => ok && (location.hash = `#jobs/${encodeURIComponent(id)}/quote`))
  }
  return (
    <form className="grid-form new-quote" onSubmit={submit} aria-label="New quote">
      {/* Enquiries cc'd to operations@ are drafted by themselves (ADR 0098); pasting one is for those that came another way. */}
      {claude.offered && (
        <details className="wide paste-enquiry" open={!!read}>
          <summary>Or paste an enquiry for Claude to read</summary>
          <FromEnquiry status={claude.status} onRead={onRead} />
        </details>
      )}
      {read && (
        <section className="claude-advice wide" aria-label="Suggested by Claude">
          <ByClaude>Read by Claude from the enquiry. Check the job and each line below before you start the quote.</ByClaude>
          {read.summary && <p>{read.summary}</p>}
          {read.questions.length > 0 && (
            <>
              <h3 className="group">To ask the client</h3>
              <ul>
                {read.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {/* The client first (ADR 0140, part 7): four in five quotes are for someone quoted before, so their jobs to start from come next. */}
      <ClientField jobs={view.jobs} optional autoFocus value={f.client} onChange={(client) => setF((now) => ({ ...now, client }))} />
      <NewOrNear value={f.client} names={clients} what="client" onPick={(n) => setF({ ...f, client: n })} />
      <FromPastJob
        view={view}
        client={f.client}
        venue={f.venue}
        days={eachDay(f.start, f.end < f.start ? f.start : f.end).length}
        today={today}
        chosen={fromJob}
        onPick={(jobId, offered) => {
          setFromJob(jobId)
          setLines(offered)
          // Again for the same client, most often under the same name and at the same venue: filled in when still empty.
          const past = jobId ? view.jobs.jobs.find((j) => j.id === jobId) : undefined
          if (past) setF((now) => ({ ...now, name: now.name.trim() ? now.name : past.name, venue: now.venue.trim() ? now.venue : (past.venue?.name ?? '') }))
        }}
      />
      <label className="wide">
        What's the job? <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Nissan launch" required />
      </label>
      {!hire && <VenueField jobs={view.jobs} optional value={f.venue} onChange={(venue) => setF((now) => ({ ...now, venue }))} />}
      {!hire && <NewOrNear value={f.venue} names={venues} what="venue" onPick={(n) => setF({ ...f, venue: n })} />}
      <div className="pair">
        <label>
          {hire ? 'Collected' : 'From'} <input type="date" value={f.start} onChange={(e) => dates({ start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end })} required />
        </label>
        <label>
          {hire ? 'Brought back' : 'To'} <input type="date" value={f.end} min={f.start} onChange={(e) => dates({ start: f.start, end: e.target.value })} required />
        </label>
      </div>
      {phases.length > 0 && !hire && (
        <p className="hint wide">
          In parts, as the enquiry gives them: {phases.map((ph) => `${ph.name} ${spanLabel(ph)}`).join(', ')}. Changing the dates makes it one Show across them instead.
        </p>
      )}
      {/* The rest of the enquiry, folded until it's wanted (ADR 0140, part 7); open when Claude read any of it. */}
      <details className="wide more-enquiry" open={more} onToggle={(e) => setMore(e.currentTarget.open)}>
        <summary>More about the enquiry{hire ? ': a dry hire' : ''}</summary>
        <div className="grid-form">
          <fieldset className="choices quote-shape wide">
            <legend>What kind of job</legend>
            {/* Each named by its shape alone, with what it means said as its description. */}
            <label className="signal">
              <input type="radio" name="quote-shape" checked={!hire} onChange={() => setHire(false)} aria-labelledby={`${shapeId}-show-name`} aria-describedby={`${shapeId}-show`} />
              <span>
                <b id={`${shapeId}-show-name`}>A show</b> <span id={`${shapeId}-show`}>At a venue, with crew and travel</span>
              </span>
            </label>
            <label className="signal">
              <input type="radio" name="quote-shape" checked={hire} onChange={() => setHire(true)} aria-labelledby={`${shapeId}-hire-name`} aria-describedby={`${shapeId}-hire`} />
              <span>
                <b id={`${shapeId}-hire-name`}>A dry hire</b> <span id={`${shapeId}-hire`}>Kit collected and brought back, no crew</span>
              </span>
            </label>
          </fieldset>
          <div className="pair">
            <label>
              {/* Short enough for its half of the row at a desk (audit of the quote flow, finding 21). */}
              Wanted by <span className="optional">(optional)</span>
              <input type="date" value={asked.quoteBy} min={today} onChange={(e) => setAsked({ ...asked, quoteBy: e.target.value })} />
            </label>
            <label>
              How it came <span className="optional">(optional)</span>
              <select value={asked.how} onChange={(e) => setAsked({ ...asked, how: e.target.value as EnquiryWay | '' })}>
                <option value="">Not said</option>
                {ENQUIRY_WAYS.map((w) => (
                  <option key={w} value={w}>
                    {ENQUIRY_WAY_LABELS[w]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <NameField
            label="Who asked"
            optional
            what={f.client.trim() ? `contact for ${chosenClient?.name ?? f.client.trim()}` : 'contact'}
            value={asked.by}
            onChange={(by) => setAsked((now) => ({ ...now, by }))}
            records={askers}
            first={chosenClient ? askers : []}
            firstLabel="Their people"
            meta={(o) => [o.record.role, !chosenClient && o.record.client].filter(Boolean).join(' · ')}
            // Someone at a client, picked with no client yet, brings their client with them.
            onPick={(o) => !f.client.trim() && setF((now) => ({ ...now, client: o.client }))}
          />
        </div>
      </details>
      {offered.length > 0 && (
        <section className="wide" aria-label="Lines for the quote">
          <h3>Lines for the quote</h3>
          <Suggestions view={view} items={offered} onChange={(next) => setLines(hire ? [...next, ...lines.filter((x) => x.s.kind === 'crew')] : next)} />
        </section>
      )}
      {read && lines.length === 0 && <p className="hint wide">Claude found no kit or crew to put on the quote. Add them on the quote.</p>}
      <p className="hint wide">
        It's added to Jobs as an enquiry, and moves to quoted when you mark the quote sent. Who asked and how go in the job's notes; the day they want it by is when the Quote sent task is due. Kit, crew and the rest can be added on the quote.
      </p>
      <Refusal error={error} className="wide" />
      <div className="actions wide">
        <button type="submit" className="primary">
          {taking.length ? `Start the quote with ${takingWords(offered)}` : 'Start the quote'}
        </button>
        <button type="button" className="link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/**
 * The month in Money's own words, one list for Money's head and Home's Money card, so the two never frame it differently
 * (Move 10 of the sweep of 6 November 2026): quoted, confirmed, accepted and unpaid, owed to freelancers, and what was lost,
 * with the jobs whose dates passed with no answer named under it, not summed, until someone marks them lost.
 */
export function MoneyFacts({ view, today }: { view: View; today: string }) {
  const m = view.money
  const month = moneyMonth(today)
  const now = m.months.find((x) => x.key === month.key)
  const owed = m.owed.reduce((s, o) => s + o.cents, 0)
  const notInvoiced = owed - m.owed.reduce((s, o) => s + o.invoiced, 0)
  const toFreelancers = m.costsOwed.reduce((s, c) => s + c.cents, 0)
  const lapsed = view.jobs.jobs.filter((j) => view.steps.of(j.id)?.lapsed).length
  return (
    <dl className="facts money-facts">
      <div>
        <dt>Quoted for {month.label}</dt>
        <dd>{money(now?.quoted ?? 0)}</dd>
      </div>
      <div>
        <dt>Confirmed</dt>
        <dd>{money(now?.confirmed ?? 0)}</dd>
      </div>
      {/* Named for what it is (audit finding 29): accepted and not paid, much of it not asked for yet. */}
      <div>
        <dt>Accepted, unpaid</dt>
        <dd>
          {money(owed)}
          <small>with VAT{notInvoiced > 0 && `, of which ${money(notInvoiced)} not invoiced yet`}</small>
        </dd>
      </div>
      <div>
        <dt>Owed to freelancers</dt>
        <dd>{money(toFreelancers)}</dd>
      </div>
      <div>
        <dt>Lost or lapsed for {month.label}</dt>
        <dd>
          {money(now?.lost ?? 0)}
          <small>
            turned down or marked lost
            {lapsed > 0 && (
              <>
                ; and <a href="#jobs/board">{plural(lapsed, 'job')} whose dates passed with no answer</a>, not in this
              </>
            )}
          </small>
        </dd>
      </div>
    </dl>
  )
}

function ByMonth({ m }: { m: MoneyView }) {
  if (!m.months.length) return null
  return (
    <section className="card" aria-label="By month">
      <Heading icon="calendar">By month</Heading>
      <Sideways className="quote-table-wrap">
        <table className="quote-table money-months">
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col" className="n">Quoted</th>
              <th scope="col" className="n">Confirmed</th>
              <th scope="col" className="n">Invoiced</th>
              <th scope="col" className="n">Freelancers</th>
              <th scope="col" className="n">Lost</th>
            </tr>
          </thead>
          <tbody>
            {m.months.map((x) => (
              <tr key={x.key}>
                <th scope="row">{x.label}</th>
                <td className="n" data-label="Quoted">{money(x.quoted)}</td>
                <td className="n" data-label="Confirmed">{money(x.confirmed)}</td>
                <td className="n" data-label="Invoiced">{money(x.invoiced)}</td>
                <td className="n" data-label="Freelancers">{money(x.costs)}</td>
                <td className="n" data-label="Lost">{money(x.lost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sideways>
      <p className="hint">
        Quoted counts the quote that stands on each job, sent or accepted; confirmed, the accepted ones. A quote turned down isn't counted, nor one on a job cancelled or lost
        until it's invoiced. Lost sums the quotes turned down and those on jobs marked lost.
      </p>
    </section>
  )
}

/** A client's quotes in one group of what's accepted and unpaid: the invoiced ones, or those not invoiced yet. */
function OwedGroup({ title, owed, invoiced, hint }: { title: string; owed: OwedBy[]; invoiced: boolean; hint: string }) {
  const rows = owed
    .map((o) => ({ o, quotes: o.quotes.filter((x) => !!x.quote.invoicedOn === invoiced), cents: invoiced ? o.invoiced : o.cents - o.invoiced }))
    .filter((r) => r.quotes.length > 0)
    .sort((a, b) => b.cents - a.cents || a.o.client.localeCompare(b.o.client))
  if (!rows.length) return null
  return (
    <div className="owed-group" role="group" aria-label={title}>
      <h3>
        {title} <span className="amount">{money(rows.reduce((s, r) => s + r.cents, 0))}</span>
      </h3>
      <p className="hint">{hint}</p>
      {/* One row a client, its quotes folded under it (audit finding 31). */}
      {/* The biggest first, then Show all, so the freelancers' costs are in reach (audit, 5 November 2026, finding 53). */}
      <ShowAll items={rows} limit={FOLLOW_SHOWN} what="clients" name={`owed ${invoiced ? 'invoiced' : 'to invoice'}`}>
        {(shown) =>
          shown.map(({ o, quotes, cents }) => (
            <details key={o.clientId ?? ''} className="owed">
              <summary>
                <b>{o.client}</b>
                <span className="count">{plural(quotes.length, 'quote')}</span>
                <span className="amount">{money(cents)}</span>
              </summary>
              <ul className="plain">
                {quotes.map(({ job, quote }) => (
                  <li key={quote.id} className="row">
                    <div>
                      <a href={`#jobs/${encodeURIComponent(job.id)}/quote`}>{job.name}</a>
                      <p>
                        Version {quote.version} · {money(quote.totals.gross)} with VAT
                        {quote.invoicedOn ? ` · invoiced ${dayLabel(quote.invoicedOn)}${quote.invoiceRef ? ` as ${quote.invoiceRef}` : ''}` : ' · not invoiced yet'}
                      </p>
                    </div>
                    <QuotePill q={quote} />
                  </li>
                ))}
              </ul>
            </details>
          ))
        }
      </ShowAll>
    </div>
  )
}

/**
 * Accepted, unpaid (ADR 0042 §6): every accepted quote not marked paid, with VAT, in two groups (audit finding 29),
 * the invoiced ones to chase and those not invoiced yet, which are the office's to invoice.
 */
function Owed({ m }: { m: MoneyView }) {
  return (
    <section className="card" aria-label="Accepted, unpaid">
      <Heading icon="company">Accepted, unpaid</Heading>
      {m.owed.length === 0 ? (
        <Empty>Nothing accepted is waiting to be paid: every accepted quote is marked paid.</Empty>
      ) : (
        <>
          <OwedGroup title="Invoiced" owed={m.owed} invoiced hint="Asked for: what clients owe." />
          <OwedGroup title="Not invoiced yet" owed={m.owed} invoiced={false} hint="Accepted, with no invoice yet: yours to invoice." />
        </>
      )}
    </section>
  )
}

function Freelancers({ m }: { m: MoneyView }) {
  const today = useToday()
  const { run, error } = useAct()
  if (!m.costsOwed.length && !m.costsPaid.length) return null
  const row = (c: CostRow, paid: boolean) => (
    <div key={c.row.offer.id} className="row ts-row">
      <div>
        <b>{c.row.person?.name ?? 'Someone'}</b>
        <p>
          {c.row.call.project} · {c.row.call.role} · {daysLabel(c.row.timesheet?.days ?? c.row.offer.days)}
          {paid && c.paidOn && ` · paid ${dayLabel(c.paidOn)}`}
        </p>
      </div>
      <div className="actions">
        <span className="amount">{money(c.cents)}</span>
        <Pending pending={c.pending} />
        {paid ? (
          <button type="button" className="link" onClick={() => void run(() => client.mutate('cost.paid', { id: c.row.offer.id, on: null }))}>
            Not paid
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void run(() => client.mutate('cost.paid', { id: c.row.offer.id, on: today }))}
            aria-label={`Mark ${c.row.person?.name ?? 'them'} paid for ${c.row.call.project}`}
          >
            Mark paid
          </button>
        )}
      </div>
    </div>
  )
  return (
    <section className="card timesheets" aria-label="Owed to freelancers">
      <Heading icon="timesheet">Owed to freelancers</Heading>
      <Refusal error={error} />
      {m.costsOwed.length === 0 ? (
        <Empty>Every approved timesheet is marked paid.</Empty>
      ) : (
        <ShowAll items={m.costsOwed} limit={5} what="timesheets">
          {(rows) => rows.map((c) => row(c, false))}
        </ShowAll>
      )}
      {m.costsPaid.length > 0 && (
        <div className="ts-group" role="group" aria-label="Paid lately">
          <h3 className="group">Paid lately</h3>
          {m.costsPaid.slice(0, 5).map((c) => row(c, true))}
        </div>
      )}
      <p className="hint">From approved timesheets, as approved. Mark one paid once the money has gone; the timesheet then stays as approved.</p>
    </section>
  )
}

/** "1 job below zero: Nore Pharma Fundraiser, −€270.00", or nothing when none is (audit finding 31). */
export function BelowZero({ jobs }: { jobs: readonly JobMoney[] }) {
  const losing = belowZero(jobs)
  if (!losing.length) return null
  // Each job named is a link to its money (audit, 5 November 2026, finding 89): every count opens what explains it.
  const named = losing.slice(0, 3)
  return (
    <p className="below-zero">
      {plural(losing.length, 'job')} below zero:{' '}
      {named.map((j, i) => (
        <Fragment key={j.job.id}>
          {i > 0 && '; '}
          <a href={`#jobs/${encodeURIComponent(j.job.id)}/quote`}>{j.job.name}</a>, {money(j.margin!)}
        </Fragment>
      ))}
      {losing.length > named.length ? `; and ${losing.length - named.length} more` : ''}.
    </p>
  )
}

/**
 * Margin by job, under the month each job starts, this month first (audit finding 31): the first ten, with a job below
 * zero kept in view wherever it is, and a sentence above naming them. The month heads don't stay at the top as the page
 * scrolls: the table sits in a box that scrolls sideways when it's wider than the card, and a head can't stick inside that.
 * On a phone each job is a stacked row, its figures under its name, each saying which it is (UX sweep, 6 November 2026).
 */
function Margins({ m, today }: { m: MoneyView; today: string }) {
  const now = moneyMonth(today).key
  const shown = marginsByMonth(m.jobs, today).flatMap((month) => month.jobs.map((j) => ({ j, month })))
  if (!shown.length) return null
  return (
    <section className="card" aria-label="Margin by job">
      <Heading icon="calendar">Margin by job</Heading>
      <BelowZero jobs={m.jobs} />
      <ShowAll items={shown} limit={10} what="jobs" keep={({ j }) => j.margin !== null && j.margin < 0}>
        {(rows) => (
          <Sideways className="quote-table-wrap">
            <table className="quote-table money-margins">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col" className="n">Quoted</th>
                  <th scope="col" className="n">Freelancers</th>
                  <th scope="col" className="n">After freelancers</th>
                </tr>
              </thead>
              <tbody>
                {rows.flatMap(({ j, month }, i) => [
                  ...(i === 0 || rows[i - 1]!.month.key !== month.key
                    ? [
                        <tr key={`month-${month.key}`} className="group">
                          <th scope="colgroup" colSpan={4}>
                            {month.key === now ? `This month, ${month.label}` : month.label}
                          </th>
                        </tr>,
                      ]
                    : []),
                  <tr key={j.job.id}>
                    <th scope="row">
                      <a href={`#jobs/${encodeURIComponent(j.job.id)}/quote`}>{j.job.name}</a>
                      {j.job.span && <small>{dayLabel(j.job.span.start)}</small>}
                    </th>
                    <td className="n" data-label="Quoted">
                      {j.setAside ? <small>Set aside: job {j.job.status}</small> : j.current ? money(j.quoted) : 'No quote'}
                    </td>
                    <td className="n" data-label="Freelancers">
                      {money(j.costs)}
                      {j.toCome > 0 && <small>+ {money(j.toCome)} to come</small>}
                    </td>
                    <td className={`n${j.margin !== null && j.margin < 0 ? ' bad' : ''}`} data-label="After freelancers">
                      {j.margin === null ? '–' : money(j.margin)}
                    </td>
                  </tr>,
                ])}
              </tbody>
            </table>
          </Sideways>
        )}
      </ShowAll>
      <p className="hint">
        The quote that stands, before VAT, less freelancers' approved timesheets and those booked and still to come at their booked rate. Staff and subhire aren't in it. A
        cancelled or lost job's quote is set aside until it's invoiced.
      </p>
    </section>
  )
}

/** The periods an accountant asks for: Revenue's two-month VAT periods lately, and whole years. */
function periodsTo(today: string): (Period & { key: string })[] {
  const out: (Period & { key: string })[] = []
  let d = today
  for (let i = 0; i < 6; i++) {
    const p = vatPeriodOf(d)
    out.push({ key: p.key, start: p.start, end: p.end, label: p.label })
    d = addDays(p.start, -1)
  }
  const year = Number(today.slice(0, 4))
  for (const y of [year, year - 1]) out.push({ key: String(y), start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}${y === year ? ', so far' : ''}` })
  return out
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ForTheAccountant({ m }: { m: MoneyView }) {
  const today = useToday()
  const periods = periodsTo(today)
  const [key, setKey] = useState(periods[1]!.key)
  const p = periods.find((x) => x.key === key) ?? periods[0]!
  const file = (what: string) => `session-hire-${what}-${p.start}-to-${p.end}.csv`
  return (
    <section className="card" aria-label="For the accountant">
      <Heading icon="download">For the accountant</Heading>
      <label className="field">
        Period
        <select value={key} onChange={(e) => setKey(e.target.value)}>
          {periods.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        <button type="button" onClick={() => download(file('invoices'), invoicesCsv(m, p))}>
          Invoices
        </button>
        <button type="button" onClick={() => download(file('vat'), vatSummaryCsv(m, p))}>
          VAT by rate
        </button>
        <button type="button" onClick={() => download(file('freelancers'), costsCsv(m, p))}>
          Freelancer costs
        </button>
      </div>
      <p className="hint">
        Spreadsheets made on this device: each invoice by VAT rate, by the day it was invoiced; the VAT on them by Revenue's two-month period and rate; and
        freelancers' approved timesheets, by the day approved. Every table is also in Download everything, on <a href="#admin/data">Admin › Data</a>.
      </p>
    </section>
  )
}

// The price list.

export function PricesScreen({ view }: { view: View }) {
  const [search, setSearch] = useState('')
  if (!useAccess().can('money')) return <NotYours view={view} here="Price list" />
  const m = view.money
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const models = view.warehouse.models.filter((x) => words.every((w) => x.name.toLowerCase().includes(w)))
  const priced = view.warehouse.models.filter((x) => m.productPrice(x.id) !== undefined).length
  return (
    <div className="app crew jobs money prices">
      <Top view={view} up={{ steps: [JOBS, MONEY], here: 'Price list' }} />
      <section className="card">
        <h1>Price list</h1>
        <p className="hint">
          Prices before VAT, which a new quote is built from. Changing one here changes no quote already made: open a quote's draft to change its lines.
        </p>
      </section>

      <section className="card" aria-label="Kit">
        <Heading icon="kit">Kit</Heading>
        <p className="hint">
          {priced} of {plural(view.warehouse.models.length, 'product')} priced. A product with no price goes on a quote for you to price there. One priced at €0 goes on as included, at no charge, as cables and power usually are.
        </p>
        <RateRules view={view} />
        <input className="search" type="search" placeholder="Find a product" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find a product" />
        {DEPARTMENTS.map((d) => {
          const here = models.filter((x) => x.department === d)
          if (!here.length) return null
          return (
            <div key={d} className="price-group" role="group" aria-label={DEPARTMENT_LABELS[d]}>
              <h3 className="group">{DEPARTMENT_LABELS[d]}</h3>
              <ShowAll items={here} limit={8} what="products">
                {(rows) =>
                  rows.map((x) => (
                    <PriceRow
                      key={`${x.id} ${m.productPrice(x.id)} ${m.productRate(x.id)}`}
                      label={x.name}
                      cents={m.productPrice(x.id)}
                      rule={m.productRate(x.id) ?? 'daily'}
                      pending={m.pricePending('product', x.id)}
                      onSave={(cents, rate) => client.mutate('price.product', { modelId: x.id, dayCents: cents, rate })}
                    />
                  ))
                }
              </ShowAll>
            </div>
          )
        })}
        {view.warehouse.models.length === 0 && <Empty>No products yet: they come from the Stock tab.</Empty>}
      </section>

      <StarterPackagesCard view={view} />
      <PackagesCard view={view} />

      <section className="card" aria-label="Crew">
        <Heading icon="people">Crew</Heading>
        <p className="hint">A day's price for each role, to the client. A role with none is quoted at the rate its crew were asked for at.</p>
        {m.roles.map((r) => (
          <PriceRow
            key={`${r.role} ${r.cents}`}
            label={r.role}
            sub={r.booked !== undefined ? `Asked for at ${money(r.booked)} a day` : undefined}
            cents={r.cents}
            pending={m.pricePending('role', r.role)}
            onSave={(cents) => client.mutate('price.role', { role: r.role, dayCents: cents })}
          />
        ))}
        {m.roles.length === 0 && <Empty>No roles yet: add one below, or they come as crew are asked for.</Empty>}
        <AddRole />
      </section>

      <section className="card" aria-label="Client discounts">
        <Heading icon="company">Client discounts</Heading>
        <p className="hint">A client's usual discount goes on each new quote for them, and can be changed on the quote.</p>
        {view.jobs.clients.map((c) => (
          <DiscountRow key={`${c.id} ${m.discountOf(c.id)}`} label={c.name} pct={m.discountOf(c.id)} pending={m.pricePending('client', c.id)} clientId={c.id} />
        ))}
        {view.jobs.clients.length === 0 && <Empty>No clients yet: they're added as you type them into a job.</Empty>}
      </section>
    </div>
  )
}

/**
 * How each product is charged (ADR 0085): the three rate rules Current RMS used, and one press to give every priced
 * product the rule its quotes there were charged by most.
 */
function RateRules({ view }: { view: View }) {
  const m = view.money
  const { run, error } = useAct()
  const priced = view.warehouse.models.filter((x) => m.productPrice(x.id) !== undefined)
  const by = (r: RateRule) => priced.filter((x) => (m.productRate(x.id) ?? 'daily') === r).length
  return (
    <div className="rate-rules">
      <p className="hint">
        Each price is charged by its rule: <b>Daily</b>, by the day; <b>3 Day Week</b>, by the day but never more than three days a week; <b>Weekly</b>, the
        price is for a week, and up to seven days out is charged once. Now: {RATE_RULES.map((r) => `${by(r)} ${RATE_LABELS[r]}`).join(', ')}.
      </p>
      <button type="button" onClick={() => void run(() => client.mutate('price.rulesFromRms', { all: false }))}>
        Take the rules from Current RMS
      </button>
      <p className="hint">Gives each priced product with no rule the one its quotes in Current RMS were charged by most, once Admin has read them.</p>
      <Refusal error={error} />
    </div>
  )
}

/** One price, changed in place: nothing typed takes it off the list. A product's has its rate rule beside it. */
function PriceRow({
  label,
  sub,
  cents,
  rule,
  pending,
  onSave,
}: {
  label: string
  sub?: string
  cents: number | undefined
  rule?: RateRule
  pending: boolean
  onSave: (cents: number | null, rate?: RateRule) => Promise<unknown>
}) {
  const [text, setText] = useState(cents === undefined ? '' : euroText(cents))
  const [ruleNow, setRule] = useState(rule)
  const { run, error, refuse } = useAct()
  const was = cents === undefined ? '' : euroText(cents)
  const save = (e: FormEvent) => {
    e.preventDefault()
    const p = parseEuro(text)
    if (p.reason) return refuse(p.reason)
    // The rule goes only once it's chosen, so a price changed alone leaves one still to come from Current RMS.
    void run(() => onSave(p.cents ?? null, ruleNow !== rule ? ruleNow : undefined))
  }
  return (
    <form className="row price-row" onSubmit={save}>
      <div>
        <b>{label}</b>
        {sub && <p>{sub}</p>}
      </div>
      <div className="actions">
        <label className="euro">
          <span>€</span>
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="No price"
            aria-label={`${label}: price a ${ruleNow ? RATE_UNIT[ruleNow] : 'day'}`}
          />
          <span className="muted">a {ruleNow ? RATE_UNIT[ruleNow] : 'day'}</span>
        </label>
        {ruleNow && (
          <select value={ruleNow} onChange={(e) => setRule(e.target.value as RateRule)} aria-label={`${label}: charged`} disabled={!text.trim()}>
            {RATE_RULES.map((r) => (
              <option key={r} value={r}>
                {RATE_LABELS[r]}
              </option>
            ))}
          </select>
        )}
        <Pending pending={pending} />
        {(text.trim() !== was || ruleNow !== rule) && (
          <button type="submit" className="primary">
            Save
          </button>
        )}
      </div>
      <Refusal error={error} />
    </form>
  )
}

function DiscountRow({ label, pct, pending, clientId }: { label: string; pct: number | undefined; pending: boolean; clientId: string }) {
  const was = pct === undefined ? '' : String(pct)
  const [text, setText] = useState(was)
  const { run, error, refuse } = useAct()
  const save = (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim().replace(',', '.').replace(/%$/, '')
    const n = Number(t)
    if (t && !(n >= 0 && n <= 100 && Number.isInteger(n * 10))) return refuse('A discount is a percentage from 0 to 100, such as 10 or 12.5.')
    void run(() => client.mutate('price.client', { clientId, pct: t && n > 0 ? n : null }))
  }
  return (
    <form className="row price-row" onSubmit={save}>
      <div>
        <b>{label}</b>
        {pct !== undefined && <p>{pctWord(pct)} off each new quote</p>}
      </div>
      <div className="actions">
        <label className="euro">
          <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="None" aria-label={`${label}: discount, %`} />
          <span className="muted">% off</span>
        </label>
        <Pending pending={pending} />
        {text.trim() !== was && (
          <button type="submit" className="primary">
            Save
          </button>
        )}
      </div>
      <Refusal error={error} />
    </form>
  )
}

function AddRole() {
  const [role, setRole] = useState('')
  const [price, setPrice] = useState('')
  const { run, error, refuse } = useAct()
  const add = (e: FormEvent) => {
    e.preventDefault()
    const p = parseEuro(price)
    if (!role.trim()) return refuse('Say which role it is.')
    if (p.reason) return refuse(p.reason)
    if (p.cents === null) return refuse('Put in its price a day, like 380.')
    void run(() => client.mutate('price.role', { role, dayCents: p.cents ?? null })).then((ok) => {
      if (!ok) return
      setRole('')
      setPrice('')
    })
  }
  return (
    <form className="grid-form add-role" onSubmit={add}>
      <label>
        Role <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Rigger" maxLength={100} />
      </label>
      <label>
        Price a day <UnitBox unit="€" before><input aria-label="€ a day" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="380" /></UnitBox>
      </label>
      <Refusal error={error} className="wide" />
      <button type="submit" className="wide">
        Add a role
      </button>
    </form>
  )
}
