import { eachDay, PAST_MATCH_WORDS, pastJobsLike, pastJobSuggestions, plural, spanLabel, type JobView, type PastJobLines, type PastKit, type PastMatch, type View } from '@sh/shared'
import { useMemo } from 'react'
import { pricingOf, type Offered } from './Claude.tsx'

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

export function FromPastJob({
  view,
  client,
  venue,
  days,
  today,
  chosen,
  onPick,
}: {
  view: View
  client: string
  venue: string
  days: number
  today: string
  chosen: string | undefined
  onPick: (jobId: string | undefined, lines: Offered[]) => void
}) {
  const clientId = client.trim() ? (view.jobs.clients.find((c) => sameName(c.name, client))?.id ?? null) : null
  const venueId = venue.trim() ? (view.jobs.venues.find((v) => sameName(v.name, venue))?.id ?? null) : null
  const like = useMemo(() => {
    const useful = (id: string) => !!quoteOf(view, id)?.lines.length || !!view.kit.byJob.get(id)?.length
    return pastJobsLike(view.jobs.jobs, { clientId, venueId }, today, useful).map(({ job, match }) => {
      const offered = pastJobSuggestions(pastJobLines(view, job, days), pricingOf(view))
      return { job, match, offered, beyond: offered.filter((x) => x.s.beyond).length }
    })
  }, [view, clientId, venueId, today, days])
  if (!like.length) return null
  const shown = (m: PastMatch, job: JobView) =>
    [PAST_MATCH_WORDS[m], job.span ? spanLabel(job.span, today) : '', m === 'client' ? job.venue?.name : m === 'venue' ? job.client?.name : ''].filter(Boolean).join(' · ')
  return (
    <section className="wide past-jobs" aria-label="Start from a past job">
      <h3>Start from a past job</h3>
      <p className="hint">Its quote, with kit as much as actually went out, so anything added on site comes back too. Priced from today's price list.</p>
      <ul className="plain past-job-list">
        {like.map(({ job, match, offered, beyond }) => (
          <li key={job.id}>
            <button type="button" className={chosen === job.id ? 'past-job chosen' : 'past-job'} aria-pressed={chosen === job.id} onClick={() => onPick(chosen === job.id ? undefined : job.id, chosen === job.id ? [] : offered)}>
              <b>{job.name}</b>
              <small>{shown(match, job)}</small>
              <small>
                {plural(offered.length, 'line')}
                {beyond ? `, ${beyond} went beyond its quote` : ''}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
