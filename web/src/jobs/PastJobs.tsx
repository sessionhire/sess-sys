import {
  eachDay,
  money as money_,
  MAX_LINES,
  MOST_PAST_JOBS,
  pastJobsLike,
  pastMatchWords,
  pastJobSuggestions,
  plural,
  rmsMatched,
  rmsSuggestions,
  spanLabel,
  STOPPED,
  type JobView,
  type PastJobLines,
  type PastKit,
  type PastMatch,
  type RmsOpportunity,
  type RmsOpportunityPage,
  type RmsOpportunityWithLines,
  type View,
  rmsDay as irishDayOf,
} from '@sh/shared'
import { useEffect, useMemo, useState } from 'react'
import { useAccess } from '../role.ts'
import { Refusal, useAct } from '../act.tsx'
import { pricingOf, Suggestions, takingWords, type Offered } from './Claude.tsx'
import { getJson, type Loaded } from './rms.ts'

/**
 * Start a quote from a past job (ADR 0115): once the client or the venue is one the company has worked for, the jobs
 * like this one, closest first, each ready to start the quote from what it actually needed: its quote, with kit taken
 * at what went out, and what went beyond the quote added and marked.
 */

/** The quote that counts on a past job, or its newest version where none was ever sent. */
const quoteOf = (view: View, jobId: string) => view.money.currentOf(jobId) ?? view.money.quotesOf(jobId)[0]

/** What a past job needed, as the start-from list reads it from the device. */
export function pastJobLines(view: View, job: JobView, days: number): PastJobLines {
  const kit = new Map<string, PastKit>()
  const of = (modelId: string) => kit.get(modelId) ?? kit.set(modelId, { modelId, listed: 0, subhired: 0, wentOut: 0 }).get(modelId)!
  for (const l of view.kit.byJob.get(job.id) ?? []) {
    const k = of(l.modelId)
    k.listed += l.qty
    k.subhired += l.subhireQty
  }
  const pick = view.moves.pickList(job.id)
  for (const r of pick?.rows ?? []) {
    const went = r.out + r.back + r.missing
    if (went) of(r.modelId).wentOut += went
  }
  return {
    quoteLines: quoteOf(view, job.id)?.lines ?? [],
    kit: [...kit.values()],
    scanned: !!pick && pick.stillOut + pick.back + pick.missing > 0,
    days,
    pastDays: job.span ? eachDay(job.span.start, job.span.end).length : days,
    packageItems: (id) => view.money.package(id)?.items,
  }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const has = (text: string | undefined, typed: string) => !!text && text.toLowerCase().includes(typed)

/** How many of Current RMS's quotes are offered: the client's last three with nothing typed, more for a search. */
const RMS_FOR_CLIENT = 3
const RMS_FOR_SEARCH = 6

/**
 * One "Start from" on New quote (ADR 0129; audit of the quote flow, finding 17), across this app's past jobs and the
 * quotes read from Current RMS. With nothing typed it offers the jobs like this one (the same client and venue first)
 * and the client's last three quotes in Current RMS; typing finds either by job, client or venue. Picking one fills
 * the lines from it; picking it again clears them.
 */
export function FromPastJob({
  view,
  client,
  venue,
  name = '',
  not,
  days,
  today,
  chosen,
  onPick,
  heading = 'Start from a past job or quote',
}: {
  view: View
  client: string
  venue: string
  /** The new job's name: a past job with a name like it counts as a match too (Colly, 27 November 2026). */
  name?: string
  /** The job the quote is for, never offered as its own start. */
  not?: string
  days: number
  today: string
  chosen: string | undefined
  onPick: (key: string | undefined, lines: Offered[]) => void
  heading?: string
}) {
  const [search, setSearch] = useState('')
  const typed = search.trim().toLowerCase()
  const clientId = client.trim() ? (view.jobs.clients.find((c) => sameName(c.name, client))?.id ?? null) : null
  const venueId = venue.trim() ? (view.jobs.venues.find((v) => sameName(v.name, venue))?.id ?? null) : null
  const like = useMemo(() => {
    const useful = (id: string) => id !== not && (!!quoteOf(view, id)?.lines.length || !!view.kit.byJob.get(id)?.length)
    const found: { job: JobView; matched: PastMatch[] }[] =
      typed.length >= 2
        ? view.jobs.jobs
            .filter((j) => j.span && j.span.end < today && !STOPPED.includes(j.status))
            .filter((j) => has(j.name, typed) || has(j.client?.name, typed) || has(j.venue?.name, typed))
            .filter((j) => useful(j.id))
            .sort((a, b) => b.span!.end.localeCompare(a.span!.end))
            .slice(0, MOST_PAST_JOBS)
            .map((job) => ({ job, matched: [] }))
        : pastJobsLike(view.jobs.jobs, { clientId, venueId, name }, today, useful)
    return found.map(({ job, matched }) => {
      const offered = pastJobSuggestions(pastJobLines(view, job, days), pricingOf(view))
      return { job, matched, offered, beyond: offered.filter((x) => x.s.beyond).length }
    })
  }, [view, clientId, venueId, name, not, today, days, typed])
  // Current RMS's quotes, kept on the server: asked a moment after typing stops, by what's typed or else the client's name.
  const money = useAccess().can('money')
  // With no client yet, the quotes under a name like the job's.
  const asking = typed.length >= 2 ? search.trim() : client.trim() || name.trim()
  const [rms, setRms] = useState<Loaded<RmsOpportunityPage>>()
  useEffect(() => {
    if (!money || asking.length < 2) return setRms(undefined)
    let live = true
    const t = setTimeout(() => void getJson<RmsOpportunityPage>(`/api/rms/opportunities?q=${encodeURIComponent(asking)}&page=1`).then((l) => live && setRms(l)), 300)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [money, asking])
  // The most in common first, as the jobs are, and Current RMS's own order (latest first) among those with as much.
  const want = { client, venue, name }
  const past =
    rms?.state === 'ready'
      ? rms.data.opportunities
          .map((o, i) => ({ o, i, matched: typed.length >= 2 ? [] : rmsMatched(o, want) }))
          .sort((a, b) => b.matched.length - a.matched.length || a.i - b.i)
          .slice(0, typed.length >= 2 ? RMS_FOR_SEARCH : RMS_FOR_CLIENT)
      : []
  const [opening, setOpening] = useState<number>()
  const [rmsError, setRmsError] = useState('')
  const pickRms = async (id: number) => {
    const key = `rms-${id}`
    if (chosen === key) return onPick(undefined, [])
    setOpening(id)
    setRmsError('')
    const l = await getJson<RmsOpportunityWithLines>(`/api/rms/opportunities/${id}`)
    setOpening(undefined)
    if (l.state === 'ready') onPick(key, rmsSuggestions(l.data.lines, pricingOf(view)))
    else setRmsError(l.state === 'offline' ? 'Current RMS’s quotes are kept on the server, so they need signal. Try again when you have it.' : l.state === 'gone' ? l.error : '')
  }
  // What matched, said first, then the client and venue that aren't already said by it.
  const shown = (matched: PastMatch[], job: JobView) =>
    [
      pastMatchWords(matched),
      job.span ? spanLabel(job.span, today) : '',
      [!matched.includes('client') && job.client?.name, !matched.includes('venue') && job.venue?.name].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(' · ')
  const rmsDay = (o: RmsOpportunity) => (o.startsAt ? spanLabel({ start: irishDayOf(o.startsAt)!, end: irishDayOf(o.endsAt ?? o.startsAt)! }, today) : '')
  return (
    <section className="wide past-jobs" aria-label="Start from">
      <h3>{heading}</h3>
      <input
        className="search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        // Short enough not to clip on a phone.
        placeholder={money ? 'Find a past job or RMS quote' : 'Find a past job'}
        aria-label="Find a past job or quote to start from"
      />
      {like.length > 0 && <p className="hint">Its quote, with kit as much as actually went out, so anything added on site comes back too. Priced from today's price list.</p>}
      {like.length > 0 && (
        <ul className="plain past-job-list" aria-label="Past jobs">
          {like.map(({ job, matched, offered, beyond }) => (
            <li key={job.id}>
              <button type="button" className={chosen === job.id ? 'past-job chosen' : 'past-job'} aria-pressed={chosen === job.id} onClick={() => onPick(chosen === job.id ? undefined : job.id, chosen === job.id ? [] : offered)}>
                <b>{job.name}</b>
                <small>{shown(matched, job)}</small>
                <small>
                  {plural(offered.length, 'line')}
                  {beyond ? `, ${beyond} went beyond its quote` : ''}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <>
          <p className="hint">{typed.length >= 2 || !client.trim() ? 'From Current RMS, its lines as they were there:' : `${client.trim()}'s last quotes in Current RMS, its lines as they were there:`}</p>
          <ul className="plain past-job-list" aria-label="Current RMS quotes">
            {past.map(({ o, matched }) => {
              const key = `rms-${o.id}`
              return (
                <li key={o.id}>
                  <button type="button" className={chosen === key ? 'past-job chosen' : 'past-job'} aria-pressed={chosen === key} aria-busy={opening === o.id} onClick={() => void pickRms(o.id)}>
                    <b>{o.subject || o.number}</b>
                    <small>
                      {[pastMatchWords(matched), 'Current RMS ' + o.number, rmsDay(o), [!matched.includes('client') && o.client, !matched.includes('venue') && o.venue].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                    </small>
                    <small>{money_(o.netCents)} before VAT</small>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {rms?.state === 'offline' && typed.length >= 2 && <p className="hint">Current RMS’s quotes are kept on the server, so they need signal.</p>}
      {rmsError && <p className="alert">{rmsError}</p>}
      {typed.length >= 2 && !like.length && !past.length && rms?.state !== 'loading' && <p className="hint">Nothing found for “{search.trim()}”.</p>}
    </section>
  )
}

/**
 * The same start on a quote that's already a job's (Colly, 27 November 2026): its client, venue and name find the past
 * gigs like it, the most in common first, and the lines of the one picked are ticked off and added to this quote, after
 * any it has. Current RMS's quotes for the client come too, with the lines they had there.
 */
export function FromPastGig({
  view,
  job,
  days,
  today,
  adding,
  onAdd,
  onCancel,
}: {
  view: View
  job: JobView
  days: number
  today: string
  /** What the button says it does with the lines: "Add 4 lines to the quote", "Start quote with 4 lines". */
  adding: (words: string) => string
  onAdd: (lines: Offered[]) => void | Promise<unknown>
  onCancel?: () => void
}) {
  const [chosen, setChosen] = useState<string>()
  const [lines, setLines] = useState<Offered[]>([])
  const { run, error } = useAct()
  // A dry hire takes no crew (ADR 0183): crew on the gig picked stay off it.
  const offered = job.kind === 'hire' ? lines.filter((x) => x.s.kind !== 'crew') : lines
  const taking = offered.filter((x) => x.take)
  // Not a form of its own: it sits inside the draft quote's (a form can't hold another).
  const add = () => {
    if (!taking.length) return
    void run(async () => {
      await onAdd(taking.slice(0, MAX_LINES))
    }).then((ok) => {
      if (!ok) return
      setChosen(undefined)
      setLines([])
    })
  }
  return (
    <div className="grid-form from-past-gig" role="group" aria-label="Start from a past gig">
      <FromPastJob
        view={view}
        client={job.client?.name ?? ''}
        venue={job.venue?.name ?? ''}
        name={job.name}
        not={job.id}
        days={days}
        today={today}
        chosen={chosen}
        heading="Start from a past gig"
        onPick={(key, picked) => {
          setChosen(key)
          setLines(picked)
        }}
      />
      {offered.length > 0 && (
        <section className="wide" aria-label="Lines to add">
          <h3>Lines to add</h3>
          <Suggestions view={view} items={offered} onChange={(next) => setLines(job.kind === 'hire' ? [...next, ...lines.filter((x) => x.s.kind === 'crew')] : next)} />
        </section>
      )}
      <Refusal error={error} className="wide" />
      {(chosen || onCancel) && (
        <div className="actions wide">
          {chosen && (
            <button type="button" disabled={!taking.length} onClick={add}>
              {taking.length ? adding(takingWords(offered)) : 'Tick lines to add'}
            </button>
          )}
          {onCancel && (
            <button type="button" className="link" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
