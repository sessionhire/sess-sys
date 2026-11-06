import { addDays, dayLabel, daysBetween, firstName, JOB_STAGES, plural, spanLabel, STAGE_LABELS, type JobSteps, type JobView, type View } from '@sh/shared'
import { useState } from 'react'
import { arrival } from '../arrival.ts'
import { useToday } from '../view.ts'
import { Top } from './common.tsx'
import { JobViews } from './PlanScreen.tsx'
import './steps.css'

/**
 * Jobs › Board (ADR 0104, part 3): a column per stage, a card per job,
 * soonest at the top, each card saying what is short or waiting and how
 * long it has been. It answers "is anything stuck?" in one look. It reads
 * only: a job moves when its own records do (the client's answer, a scan,
 * a date), never by dragging a card, so what the board says is always what
 * the job says. The sixth column is the jobs through every stage this
 * month. Everyone who sees Jobs sees the board; money is not on it.
 *
 * Back holds only the jobs with something still to sort: a job over a
 * fortnight ago with nothing still out and no fault open is through (ADR
 * 0109). An enquiry or quote whose dates have passed with no answer goes
 * under Selling's own fold, out of the way of the ones to chase, asking for
 * it to be marked lost.
 */

type Span = 'eight' | 'all'

export function BoardScreen({ view }: { view: View }) {
  const today = useToday()
  const [span, setSpan] = useState<Span>('eight')
  // Opened from Home's count of them, the fold starts open.
  const [toAnswer] = useState(() => arrival('#jobs/board')?.part === LAPSED)
  const until = addDays(today, 56)
  const monthAgo = addDays(today, -31)
  const all = view.jobs.jobs.map((j) => view.steps.of(j.id)).filter((s): s is JobSteps => !!s && !s.stopped)
  // Jobs with no dates are kept, so an enquiry isn't lost for having none yet.
  const inSpan = (j: JobView) => span === 'all' || !j.span || j.span.start <= until
  const columns = JOB_STAGES.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    jobs: all.filter((s) => s.stage?.key === key && !s.lapsed && inSpan(s.job)).sort(bySoonest),
  }))
  // The most recent first: the ones still worth a call before the ones long gone.
  const lapsed = all.filter((s) => s.lapsed).sort((a, b) => bySoonest(b, a))
  const through = all.filter((s) => s.finished && s.job.span && s.job.span.end >= monthAgo).sort((a, b) => bySoonest(b, a))
  return (
    <div className="app crew jobs board-page">
      <Top view={view} views={<JobViews current="board" />} heading="Board" sub={<p>A column a stage, soonest first. A job moves when its own records do.</p>} />
      <div className="filters" role="group" aria-label="Which jobs">
        <button type="button" aria-pressed={span === 'eight'} onClick={() => setSpan('eight')}>
          Next 8 weeks
        </button>
        <button type="button" aria-pressed={span === 'all'} onClick={() => setSpan('all')}>
          All coming up
        </button>
      </div>
      <div className="board">
        {columns.map((c) => (
          <section key={c.key} className="board-col" aria-labelledby={`board-${c.key}`}>
            <header>
              <b id={`board-${c.key}`}>{c.label}</b>
              <small>{columnWord(c.jobs)}</small>
            </header>
            {c.jobs.length === 0 && <p className="hint board-empty">None</p>}
            {c.jobs.map((s) => (
              <BoardCard key={s.job.id} steps={s} today={today} />
            ))}
            {c.key === 'selling' && lapsed.length > 0 && (
              <details className="board-lapsed" open={toAnswer || undefined}>
                <summary>
                  <h3>
                    {LAPSED} ({lapsed.length})
                  </h3>
                </summary>
                {lapsed.map((s) => (
                  <BoardCard key={s.job.id} steps={s} today={today} />
                ))}
              </details>
            )}
          </section>
        ))}
        <section className="board-col" aria-labelledby="board-through">
          <header>
            <b id="board-through">Through</b>
            <small>{through.length ? `${through.length} this month` : 'this month'}</small>
          </header>
          {through.length === 0 && <p className="hint board-empty">None</p>}
          {through.map((s) => (
            <BoardCard key={s.job.id} steps={s} today={today} />
          ))}
        </section>
      </div>
    </div>
  )
}

/** Selling's fold, by its heading, which Home's count lands on. */
const LAPSED = 'Dates passed, no answer'

const bySoonest = (a: JobSteps, b: JobSteps) => (a.job.span?.start ?? '').localeCompare(b.job.span?.start ?? '') || a.job.name.localeCompare(b.job.name)

/** "3 · 1 waiting a while", "2 · 1 late": the count, and how many want a look. */
function columnWord(jobs: JobSteps[]): string {
  const late = jobs.filter((s) => s.steps.some((t) => t.late)).length
  const short = jobs.filter((s) => s.stage?.tasks.some((t) => t.state === 'now' && t.hint?.includes('short'))).length
  return [String(jobs.length), late ? `${late} late` : '', short && !late ? `${short} short` : ''].filter(Boolean).join(' · ')
}

/**
 * One job on the board: its name, where and when, then the one line that says what is short or waiting and for how
 * long, in the warn tone when something is short and the bad tone when a task is late or kit is still out after the job.
 */
function BoardCard({ steps, today }: { steps: JobSteps; today: string }) {
  const { job, stage, current } = steps
  const where = [job.client?.name, job.venue?.name].filter(Boolean).join(' · ')
  const when = job.span ? (job.span.end < today ? `ended ${dayLabel(job.span.end)}` : spanLabel(job.span)) : 'No dates yet'
  const late = steps.steps.filter((t) => t.late)
  let line = ''
  let tone: 'warn' | 'bad' | undefined
  const deprep = steps.steps.find((t) => t.key === 'deprep')
  if (steps.finished) line = deprep?.ticked ? `Deprepped ${dayLabel(deprep.ticked.at.slice(0, 10))}` : deprep?.auto ? 'Through: nothing still out' : 'Deprepped'
  else if (steps.lapsed) {
    line = 'Dates passed, no answer: mark it lost?'
    tone = 'bad'
  } else if (late.length) {
    line = `${late[0]!.label} was due ${dayLabel(late[0]!.dueOn!)}${late.length > 1 ? `, and ${plural(late.length - 1, 'more task')}` : ''}`
    tone = 'bad'
  } else if (stage?.key === 'back' && current?.key === 'back' && job.span) {
    const after = daysBetween(job.span.end, today)
    line = `${current.hint ?? 'Kit still out'}${after > 1 ? `, ${after} days after` : ''}`
    tone = after > 2 ? 'bad' : 'warn'
  } else if (stage?.key === 'selling' && current?.key === 'confirmed') {
    const sent = steps.steps.find((t) => t.key === 'quote')?.auto?.match(/^Sent (.+)$/)
    line = sent ? `Quote with the client since ${sent[1]}` : 'Waiting on the client'
  } else {
    line = [stage?.hint ?? current?.hint ?? '', job.span && job.span.start > today ? `${plural(daysBetween(today, job.span.start), 'day')} left` : ''].filter(Boolean).join(' · ')
    if (stage?.hint?.includes('short')) tone = 'warn'
  }
  return (
    <a className="board-card" href={`#jobs/${encodeURIComponent(job.id)}`}>
      <b>{job.name}</b>
      <p>{[where, when].filter(Boolean).join(' · ')}</p>
      {line && (
        <span className="board-line" data-tone={tone}>
          {line}
          {current?.owner && ` · ${firstName(current.owner)}`}
        </span>
      )}
    </a>
  )
}
