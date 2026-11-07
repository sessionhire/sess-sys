import { addDays, dayLabel, firstName, JOB_STAGES, jobPosition, plural, spanLabel, STAGE_LABELS, standing, STANDING_HEADINGS, listHeading, type JobSteps, type JobView, type KitToCheck, type View } from '@sh/shared'
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
 * 0109). Its cards with kit to check back in say so in the words Home and
 * Stock list them in, from the same list, and its head counts the late
 * ones. An enquiry or quote whose dates have passed with no answer goes
 * under Selling's own fold, out of the way of the ones to chase, asking for
 * it to be marked lost: the list Home counts.
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
  const lists = standing(view, today)
  const toCheck = new Map(lists['still-out'].map((k) => [k.job.id, k]))
  // Jobs with no dates are kept, so an enquiry isn't lost for having none yet.
  const inSpan = (j: JobView) => span === 'all' || !j.span || j.span.start <= until
  const columns = JOB_STAGES.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    jobs: all.filter((s) => s.stage?.key === key && !s.lapsed && inSpan(s.job)).sort(bySoonest),
  }))
  // The most recent first: the ones still worth a call before the ones long gone.
  const lapsed = lists['no-answer']
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
              <small>{columnWord(c.jobs, c.key === 'back' ? toCheck : undefined)}</small>
            </header>
            {c.jobs.length === 0 && <p className="hint board-empty">None</p>}
            {c.key === 'planning' ? (
              <PlanningBands jobs={c.jobs} today={today} />
            ) : (
              c.jobs.map((s) => <BoardCard key={s.job.id} steps={s} today={today} kit={c.key === 'back' ? toCheck.get(s.job.id) : undefined} />)
            )}
            {c.key === 'selling' && lapsed.length > 0 && (
              <details className="board-lapsed" open={toAnswer || undefined}>
                <summary>
                  <h3>{listHeading(LAPSED, lapsed.length)}</h3>
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

/**
 * Planning is where a confirmed job lives for months, so its column is banded by when each starts (Move 7 of the sweep of 6
 * November 2026): This week and Next week open, everything after folded under Later with its count, and a band with none
 * left out. Weeks run Monday to Sunday, as the planner's do; a job with no dates goes under Later.
 */
function PlanningBands({ jobs, today }: { jobs: JobSteps[]; today: string }) {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7
  const thisEnd = addDays(today, 6 - dow)
  const nextEnd = addDays(thisEnd, 7)
  const start = (s: JobSteps) => s.job.span?.start
  const bands = [
    { key: 'this', label: 'This week', jobs: jobs.filter((s) => !!start(s) && start(s)! <= thisEnd) },
    { key: 'next', label: 'Next week', jobs: jobs.filter((s) => !!start(s) && start(s)! > thisEnd && start(s)! <= nextEnd) },
  ]
  const later = jobs.filter((s) => !start(s) || start(s)! > nextEnd)
  return (
    <>
      {bands.map(
        (b) =>
          b.jobs.length > 0 && (
            <div key={b.key} className="board-band">
              <h3 className="board-band-head">
                {b.label} ({b.jobs.length})
              </h3>
              {b.jobs.map((s) => (
                <BoardCard key={s.job.id} steps={s} today={today} />
              ))}
            </div>
          )
      )}
      {later.length > 0 && (
        <details className="board-lapsed board-later">
          <summary>
            <h3>Later ({later.length})</h3>
          </summary>
          {later.map((s) => (
            <BoardCard key={s.job.id} steps={s} today={today} />
          ))}
        </details>
      )}
    </>
  )
}

/** Selling's fold, by its heading, which Home's count lands on. */
const LAPSED = STANDING_HEADINGS['no-answer']

const bySoonest = (a: JobSteps, b: JobSteps) => (a.job.span?.start ?? '').localeCompare(b.job.span?.start ?? '') || a.job.name.localeCompare(b.job.name)

/** "3 · 1 waiting a while", "10 · 3 late": the count, and how many want a look: a task late, or kit late back (ADR 0109). */
function columnWord(jobs: JobSteps[], kit?: ReadonlyMap<string, KitToCheck>): string {
  const late = jobs.filter((s) => s.steps.some((t) => t.late) || kit?.get(s.job.id)?.late).length
  // Short as the position part says it: crew or kit short in the stage the job is in (Move 7 of the sweep of 6 November 2026).
  const short = jobs.filter((s) => jobPosition(s)?.tone === 'warn').length
  return [String(jobs.length), late ? `${late} late` : '', short && !late ? `${short} short` : ''].filter(Boolean).join(' · ')
}

/**
 * One job on the board: its name, where and when, then the one line that says what is short or waiting and for how
 * long, in the bad tone when a task is late and the warn tone when something is short or kit is late back. Kit to check
 * back in is said as Home and Stock list it, which says when the job ended.
 */
function BoardCard({ steps, today, kit }: { steps: JobSteps; today: string; kit?: KitToCheck }) {
  const { job, stage, current } = steps
  const where = [job.client?.name, job.venue?.name].filter(Boolean).join(' · ')
  const when = job.span ? (job.span.end < today && !kit ? `ended ${dayLabel(job.span.end)}` : spanLabel(job.span)) : 'No dates yet'
  const late = steps.steps.filter((t) => t.late)
  let line = ''
  let tone: 'warn' | 'bad' | undefined
  let owner = true
  const deprep = steps.steps.find((t) => t.key === 'deprep')
  if (steps.finished) line = deprep?.ticked ? `Deprepped ${dayLabel(deprep.ticked.at.slice(0, 10))}` : deprep?.auto ? 'Through: nothing still out' : 'Deprepped'
  else if (steps.lapsed) {
    line = 'Dates passed, no answer: mark it lost?'
    tone = 'bad'
  } else if (late.length) {
    line = `${late[0]!.label} was due ${dayLabel(late[0]!.dueOn!)}${late.length > 1 ? `, and ${plural(late.length - 1, 'more task')}` : ''}`
    tone = 'bad'
  } else if (kit) {
    line = `${kit.said} · ${kit.when}`
    if (kit.late) tone = 'warn'
  } else {
    // The position's own words and tone, as the job's head, the Jobs list and Home say them (Move 7 of the sweep of 6 November
    // 2026): the column already names the stage, so the card says what's short or waiting, whose it is, and when.
    const p = jobPosition(steps)
    line = [p?.hint, p?.owner, p?.time].filter(Boolean).join(' · ')
    tone = p?.tone
    owner = false
  }
  return (
    <a className="board-card" href={`#jobs/${encodeURIComponent(job.id)}`}>
      <b>{job.name}</b>
      <p>{[where, when].filter(Boolean).join(' · ')}</p>
      {line && (
        <span className="board-line" data-tone={tone}>
          {line}
          {owner && current?.owner && ` · ${firstName(current.owner)}`}
        </span>
      )}
    </a>
  )
}
