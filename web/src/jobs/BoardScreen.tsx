import { addDays, byBoardOrder, dayLabel, rankedAfterDrop, type JobStage, JOB_STAGES, jobPosition, plural, spanLabel, STAGE_LABELS, standing, STANDING_HEADINGS, listHeading, type JobSteps, type JobView, type KitToCheck, type View } from '@sh/shared'
import { useState } from 'react'
import { client } from '../sync.ts'
import { useAct, Refusal } from '../act.tsx'
import { useAccess } from '../role.ts'
import { OrderedCards } from './BoardOrder.tsx'
import { StageOwner } from './StageOwner.tsx'
import { arrival } from '../arrival.ts'
import { useToday } from '../view.ts'
import { Top, useJobAdd } from './common.tsx'
import { PillGroup, ViewFilter } from '../ListTools.tsx'
import { JobViews } from './PlanScreen.tsx'
import './steps.css'
import { departmentChips, DepartmentFilter, useJobDepartments } from './Departments.tsx'

/**
 * Jobs › Board (ADR 0104, part 3): a column per stage, a card per job,
 * each card saying what is short or waiting and how long it has been. It
 * answers "is anything stuck?" in one look. A job moves between columns when
 * its own records do (the client's answer, a scan, a date), never by
 * dragging a card, so the column a job is in is always what the job says.
 * Inside a column the office and the heads put the cards in the order they
 * matter (ADR 0143); the cards nobody has put in order go soonest first,
 * under them. The sixth column is the jobs through every stage this
 * month. Everyone who sees Jobs sees the board; money is not on it.
 *
 * Back holds only the jobs with something still to sort: a job over a
 * fortnight ago with nothing still out and no fault open is through (ADR
 * 0109). Its cards with kit to check back in say so in the words Home and
 * Stock list them in, from the same list, and its head counts the late
 * ones. An enquiry or quote whose dates have passed with no answer goes
 * under Quoting's own fold, out of the way of the ones to chase, asking for
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
  // The departments picked (ADR 0137), as on the Jobs list and the calendar: only the jobs involving one of them, in every column.
  const { picked, setPicked, involves } = useJobDepartments(view)
  // Staff crew see the board but don't put it in order (ADR 0143).
  const access = useAccess()
  const canOrder = access.role !== 'crew' && access.can('steps')
  const { run, error } = useAct()
  const [said, say] = useState('')
  /** A card dropped: it and every card above it in its group join the ones already in order, as the column now reads. */
  const order = (stage: JobStage, groups: JobSteps[][], group: number, now: string[], id: string) => {
    const drawn = groups.map((g, i) => (i === group ? now : g.map((s) => s.job.id)))
    const ranked = new Set(groups.flat().filter((s) => s.rank !== undefined).map((s) => s.job.id))
    void run(() => client.mutate('jobRank.set', { stage, ids: rankedAfterDrop(drawn, group, id, ranked) }))
  }
  const byDate = (stage: JobStage, jobs: JobSteps[]) => {
    const ids = jobs.filter((s) => s.rank !== undefined).map((s) => s.job.id)
    if (!ids.length) return
    say(`${STAGE_LABELS[stage]} is back in date order.`)
    void run(() => client.mutate('jobRank.set', { stage, ids, clear: true }))
  }
  const all = view.jobs.jobs
    .filter(involves)
    .map((j) => view.steps.of(j.id))
    .filter((s): s is JobSteps => !!s && !s.stopped)
  const lists = standing(view, today)
  const toCheck = new Map(lists['still-out'].map((k) => [k.job.id, k]))
  // Jobs with no dates are kept, so an enquiry isn't lost for having none yet.
  const inSpan = (j: JobView) => span === 'all' || !j.span || j.span.start <= until
  const columns = JOB_STAGES.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    // Back keeps what ended in the last month; kit out longer than that is folded under the column (review of 11 November 2026, finding 10).
    jobs: all.filter((s) => s.stage?.key === key && !s.lapsed && inSpan(s.job) && !(key === 'back' && toCheck.get(s.job.id)?.longOverdue)).sort(byBoardOrder),
  }))
  const longOverdue = all.filter((s) => s.stage?.key === 'back' && toCheck.get(s.job.id)?.longOverdue)
  // The most recent first: the ones still worth a call before the ones long gone.
  const lapsed = lists['no-answer']
  const through = all.filter((s) => s.finished && s.job.span && s.job.span.end >= monthAgo).sort((a, b) => bySoonest(b, a))
  return (
    <div className="app crew jobs board-page">
      <Top
        view={view}
        views={<JobViews current="board" />}
        heading="Board"
        add={useJobAdd(true)}
        sub={
          <p>
            {/* One line before the cards on a phone (review of 11 November 2026, finding 6): how to order a column is on the arrows. */}
            A column a stage. {canOrder ? 'Drag a card by its arrows to put a column in order.' : 'The office’s order first, then soonest first.'}
          </p>
        }
      />
      {/* Which jobs and the departments in Filter, as on the list (Colly, 10 November 2026), each one on a chip above the columns. */}
      <ViewFilter
        name="board"
        what="jobs"
        pills={
          <>
            <PillGroup label="Which jobs">
              <button type="button" aria-pressed={span === 'eight'} onClick={() => setSpan('eight')}>
                Next 8 weeks
              </button>
              <button type="button" aria-pressed={span === 'all'} onClick={() => setSpan('all')}>
                All coming up
              </button>
            </PillGroup>
            <DepartmentFilter pills picked={picked} onChange={setPicked} />
          </>
        }
        active={[...(span === 'all' ? [{ key: 'span', label: 'All coming up', off: () => setSpan('eight') }] : []), ...departmentChips(picked, setPicked)]}
        onClear={() => {
          setSpan('eight')
          setPicked([])
        }}
      />
      <Refusal error={error} />
      <p id="board-order-help" className="sr-only">
        Picks the card up: the arrows move it in its column, Space puts it down, Escape puts it back. Or drag it.
      </p>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      <div className="board">
        {columns.map((c) => (
          <section key={c.key} className="board-col" aria-labelledby={`board-${c.key}`}>
            <header>
              {/* The column's place in the five, drawn as a job's own line draws it, so the Board and a job page read alike. */}
              <span className="stage-seg" aria-hidden="true">
                {JOB_STAGES.map((k, i) => (
                  <i key={k} data-state={i < JOB_STAGES.indexOf(c.key) ? 'done' : k === c.key ? 'now' : undefined} />
                ))}
              </span>
              <b id={`board-${c.key}`}>{c.label}</b>
              <small>{columnWord(c.jobs, c.key === 'back' ? toCheck : undefined)}</small>
              {canOrder && c.jobs.some((s) => s.rank !== undefined) && (
                <button type="button" className="link board-by-date" onClick={() => byDate(c.key, c.jobs)}>
                  Back to date order
                </button>
              )}
            </header>
            {c.jobs.length === 0 && <p className="hint board-empty">None</p>}
            {c.key === 'planning' ? (
              <PlanningBands view={view} jobs={c.jobs} today={today} canOrder={canOrder} say={say} onOrder={(groups, group, now, id) => order('planning', groups, group, now, id)} />
            ) : (
              <OrderedCards
                jobs={c.jobs}
                where={c.label}
                canOrder={canOrder}
                say={say}
                card={(s) => <BoardCard view={view} steps={s} today={today} kit={c.key === 'back' ? toCheck.get(s.job.id) : undefined} />}
                onOrder={(now, id) => order(c.key, [c.jobs], 0, now, id)}
              />
            )}
            {c.key === 'selling' && lapsed.length > 0 && (
              <details className="board-lapsed" open={toAnswer || undefined}>
                <summary>
                  <h3>{listHeading(LAPSED, lapsed.length)}</h3>
                </summary>
                {lapsed.map((s) => (
                  <BoardCard key={s.job.id} view={view} steps={s} today={today} />
                ))}
              </details>
            )}
            {c.key === 'back' && longOverdue.length > 0 && (
              <details className="board-lapsed">
                <summary>
                  <h3>Long overdue ({longOverdue.length})</h3>
                </summary>
                <p className="hint">Ended more than a month ago. Each one can be settled in one press under Pick lists on Stock.</p>
                {longOverdue.map((s) => (
                  <BoardCard key={s.job.id} view={view} steps={s} today={today} kit={toCheck.get(s.job.id)} />
                ))}
              </details>
            )}
          </section>
        ))}
        <section className="board-col" aria-labelledby="board-through">
          <header>
            <span className="stage-seg" aria-hidden="true">
              {JOB_STAGES.map((k) => (
                <i key={k} data-state="done" />
              ))}
            </span>
            <b id="board-through">Through</b>
            <small>{through.length ? `${through.length} this month` : 'this month'}</small>
          </header>
          {through.length === 0 && <p className="hint board-empty">None</p>}
          {through.map((s) => (
            <BoardCard key={s.job.id} view={view} steps={s} today={today} />
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
function PlanningBands({
  view,
  jobs,
  today,
  canOrder,
  say,
  onOrder,
}: {
  view: View
  jobs: JobSteps[]
  today: string
  canOrder: boolean
  say: (words: string) => void
  onOrder: (groups: JobSteps[][], group: number, now: string[], id: string) => void
}) {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7
  const thisEnd = addDays(today, 6 - dow)
  const nextEnd = addDays(thisEnd, 7)
  const start = (s: JobSteps) => s.job.span?.start
  const bands = [
    { key: 'this', label: 'This week', jobs: jobs.filter((s) => !!start(s) && start(s)! <= thisEnd) },
    { key: 'next', label: 'Next week', jobs: jobs.filter((s) => !!start(s) && start(s)! > thisEnd && start(s)! <= nextEnd) },
  ]
  const later = jobs.filter((s) => !start(s) || start(s)! > nextEnd)
  // Each week is put in order on its own, as it is drawn (ADR 0143): the column's order runs through them all, top to bottom.
  const groups = [...bands.map((b) => b.jobs), later]
  const cards = (g: number, where: string) => (
    <OrderedCards
      jobs={groups[g]!}
      where={where}
      canOrder={canOrder}
      say={say}
      card={(s) => <BoardCard view={view} steps={s} today={today} />}
      onOrder={(now, id) => onOrder(groups, g, now, id)}
    />
  )
  return (
    <>
      {bands.map(
        (b) =>
          b.jobs.length > 0 && (
            <div key={b.key} className="board-band">
              <h3 className="board-band-head">
                {b.label} ({b.jobs.length})
              </h3>
              {cards(bands.indexOf(b), `Planning, ${b.label.toLowerCase()}`)}
            </div>
          )
      )}
      {later.length > 0 && (
        <details className="board-lapsed board-later">
          <summary>
            <h3>Later ({later.length})</h3>
          </summary>
          {cards(groups.length - 1, 'Planning, later')}
        </details>
      )}
    </>
  )
}

/** Quoting's fold, by its heading, which Home's count lands on. */
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
function BoardCard({ view, steps, today, kit }: { view: View; steps: JobSteps; today: string; kit?: KitToCheck }) {
  const { job, stage } = steps
  const where = [job.client?.name, job.venue?.name].filter(Boolean).join(' · ')
  const when = job.span ? (job.span.end < today && !kit ? `ended ${dayLabel(job.span.end)}` : spanLabel(job.span)) : 'No dates yet'
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
  } else if (kit) {
    line = `${kit.said} · ${kit.when}`
    if (kit.late) tone = 'warn'
  } else {
    // The position's own words and tone, as the job's head, the Jobs list and Home say them (Move 7 of the sweep of 6 November
    // 2026): the column already names the stage, so the card says what's short or waiting, and when. Whose it is is said once,
    // at the card's foot, where it's changed (ADR 0144).
    const p = jobPosition(steps)
    // In Planning the crew and the kit say where they stand as two dots in the footer (Colly, 10 November 2026), so the line
    // keeps only when, and its colour only for a task that's late.
    const dots = stage?.key === 'planning'
    line = [dots ? undefined : p?.hint, p?.time].filter(Boolean).join(' · ')
    tone = dots && p?.tone !== 'bad' ? undefined : p?.tone
  }
  const marks = stage?.key === 'planning' && !steps.lapsed ? (['crew', 'kit'] as const).map((key) => readiness(steps, key)).filter((m): m is Readiness => !!m) : []
  return (
    <div className="board-owned">
      <a className="board-card" href={`#jobs/${encodeURIComponent(job.id)}`}>
        <b>{job.name}</b>
        <p>{[where, when].filter(Boolean).join(' · ')}</p>
        {(line || marks.length > 0) && (
          <span className="board-foot">
            {line && (
              <span className="board-line" data-tone={tone}>
                {line}
              </span>
            )}
            {marks.length > 0 && (
              <span className="board-marks">
                {marks.map((m) => (
                  <span key={m.label} className="board-mark" data-state={m.state} title={m.said}>
                    {m.label}
                    {m.count && <small>{m.count}</small>}
                    <i aria-hidden="true" />
                    <span className="sr-only">: {m.said}</span>
                  </span>
                ))}
              </span>
            )}
          </span>
        )}
      </a>
      <StageOwner view={view} steps={steps} />
    </div>
  )
}

/** One of the Planning card's dots: done, short or waiting, late, or nothing on the job yet; and the words it stands for. */
interface Readiness {
  label: string
  /** "3/5" booked of asked for: the dot's colour alone never says it. */
  count?: string
  state: 'ok' | 'warn' | 'bad' | 'off'
  said: string
}

/**
 * Where the crew or the kit of a job in Planning stands, as a dot (Colly, 10 November 2026): green when done or nothing is
 * short, amber when crew are still to book or confirm or kit is short, the bad tone when its task is late, and hollow while
 * there's nothing on the job yet. Left off when it doesn't apply, such as crew on a dry hire with none asked for.
 */
function readiness(steps: JobSteps, key: 'crew' | 'kit'): Readiness | undefined {
  const t = steps.steps.find((x) => x.key === key)
  if (!t || t.skipped) return undefined
  const label = key === 'crew' ? 'Crew' : 'Kit'
  const said = t.done ? (t.auto ?? 'Done') : (t.hint ?? (t.facts.nothingYet ? 'Nothing yet' : 'To do'))
  const { booked = 0, needed = 0, toConfirm = 0, lines = 0, short = 0 } = t.facts
  const count = key === 'crew' && needed > 0 ? `${booked}/${needed}` : key === 'kit' && short > 0 ? `${short} short` : undefined
  const state: Readiness['state'] = t.late
    ? 'bad'
    : t.done
      ? 'ok'
      : t.facts.nothingYet || (key === 'crew' ? needed === 0 : lines === 0)
        ? 'off'
        : (key === 'crew' ? booked < needed || toConfirm > 0 : short > 0)
          ? 'warn'
          : 'ok'
  return { label, ...(count ? { count } : {}), state, said: t.late ? `${said}, was due ${dayLabel(t.dueOn!)}` : said }
}
