import { dayLabel } from '../crew-days.ts'
import { firstName } from '../crew.ts'
import { KIND_LABELS, kindOf } from '../jobs.ts'
import { plural } from '../stock.ts'
import type { JobSteps } from './steps-view.ts'

/**
 * Where a job stands, as one part read the same on every surface (Move 7 of
 * the sweep of 6 November 2026): the job head, the dock's line, the Jobs
 * row, Home's rows, the Board card and the pick list's head. In one order
 * everywhere: the stage, what's short or waiting in it, whose the next task
 * is, and when. Quiet when nothing is short ("healthy is quiet"), the warn
 * tone when crew or kit is short, the bad tone when a task is late or the
 * dates passed while it was still being sold.
 *
 * Built from the job's steps alone, which a device works out from what the
 * server sent its role (ADR 0042, ADR 0046): it never says what a role's
 * reading leaves out, as the steps say "Quote: with the office" instead.
 */
export interface JobPosition {
  /** The stage's name, or "Through", or the kind for an errand or a meeting. */
  stage: string
  /** What's short or waiting in it, in a few words; undefined when nothing is. */
  hint: string | undefined
  /** The first name of whoever the next task is down to. */
  owner: string | undefined
  /** "in 6 days", "tomorrow", "until Fri 13 Nov", "2 days after", "by Wed 4 Nov", "was due Wed 4 Nov". */
  time: string | undefined
  tone: 'warn' | 'bad' | undefined
  /** The tone in one word, for a compact row where the hint isn't drawn, so it's never said by colour alone. */
  flag: 'late' | 'short' | 'no answer' | undefined
  /** All of it in one line, as a screen reader and a test read it. */
  text: string
}

/** The job's position, or undefined on a cancelled or lost job, whose status pill says all there is to say. */
export function jobPosition(steps: JobSteps): JobPosition | undefined {
  const { job } = steps
  const kind = kindOf(job)
  if (kind === 'errand' || kind === 'meeting') {
    // No stages: the kind and its day, so a meeting reads as one rather than as a job that's stuck (Move 7).
    if (steps.stopped && !steps.stopped.startsWith('Errands')) return undefined
    return make(KIND_LABELS[kind], undefined, undefined, job.span ? dayLabel(job.span.start) : 'No dates yet', undefined)
  }
  if (steps.stopped) return undefined
  const late = steps.steps.filter((t) => t.late)
  if (steps.finished) {
    const deprep = steps.steps.find((t) => t.key === 'deprep')
    return make('Through', deprep?.ticked ? `deprepped ${dayLabel(deprep.ticked.at.slice(0, 10))}` : undefined, undefined, after(steps.daysAfter), undefined)
  }
  const stage = steps.stage
  const task = steps.current
  const open = (stage?.tasks ?? []).concat(steps.behind).filter((t) => !t.done && !t.skipped)
  const short = open.some((t) => (t.key === 'crew' && (t.facts.booked ?? 0) < (t.facts.needed ?? 0)) || (t.facts.short ?? 0) > 0)
  // The show's own hint is its dates, which the time already says.
  const hint = stage?.key === 'selling' ? steps.selling : stage?.key === 'on' ? undefined : (stage?.hint ?? (task?.key === 'show' ? undefined : task?.hint))
  // A task late says so, and which, when it isn't the one to do next: the tone alone would leave it unsaid.
  const lateOne = task?.late ? task : late[0]
  const time = lateOne
    ? `${lateOne === task ? '' : `${lateOne.label.toLowerCase()} `}was due ${dayLabel(lateOne.dueOn!)}`
    : task?.dueOn
      ? `by ${dayLabel(task.dueOn)}`
    : steps.daysTo !== undefined
      ? steps.daysTo === 1
        ? 'tomorrow'
        : `in ${plural(steps.daysTo, 'day')}`
      : stage?.key === 'on' && job.span
        ? job.span.end === job.span.start
          ? 'today'
          : `until ${dayLabel(job.span.end)}`
        : after(steps.daysAfter)
  const tone = late.length || steps.lapsed ? 'bad' : short ? 'warn' : undefined
  const flag = late.length ? 'late' : steps.lapsed ? 'no answer' : short ? 'short' : undefined
  return make(stage?.label ?? 'Through', hint, task?.owner ? firstName(task.owner) : undefined, time, tone, flag)
}

const after = (days: number | undefined) => (days === undefined ? undefined : days === 1 ? 'the day after' : `${plural(days, 'day')} after`)

function make(stage: string, hint: string | undefined, owner: string | undefined, time: string | undefined, tone: JobPosition['tone'], flag?: JobPosition['flag']): JobPosition {
  return { stage, hint, owner, time, tone, flag, text: [stage, hint, owner, time].filter(Boolean).join(' · ') }
}
