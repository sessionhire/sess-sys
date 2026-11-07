import { jobPosition, type JobView, type View } from '@sh/shared'
import './steps.css'

/**
 * Where a job stands, the one part every surface draws (Move 7 of the sweep
 * of 6 November 2026; ADR 0104): the job head, the Jobs row, Home's rows,
 * the Board card and the pick list's head. Five small segments for the five
 * stages, then text first, in one order: the stage, what's short or waiting
 * in it, whose the next task is, and when. Quiet when nothing is short;
 * amber when crew or kit is short; the bad tone when a task is late. It is
 * read from the job's steps, which hold only what this role is sent, so it
 * never says what the reading limits hide.
 *
 * `compact` keeps the segments, the stage and the time, for a row of one
 * line. Nothing on a cancelled or lost job: the status pill says it.
 */
export function JobPosition({ job, view, compact, bare }: { job: JobView; view: View; compact?: boolean; bare?: boolean }) {
  const steps = view.steps.of(job.id)
  const p = steps && jobPosition(steps)
  if (!steps || !p) return null
  const words = compact ? [p.time].filter(Boolean) : [p.hint, p.owner, p.time].filter(Boolean)
  return (
    <span className="stage-line job-position" data-compact={compact ? 'true' : undefined} data-tone={p.tone} title={compact ? p.text : undefined}>
      {!bare && !steps.stopped && (
        <span className="stage-seg" aria-hidden="true">
          {steps.stages.map((st) => (
            <i key={st.key} data-state={steps.finished ? 'done' : st.state} />
          ))}
        </span>
      )}
      <span className="stage-words">
        <b>{p.stage}</b>
        {words.map((w) => ` · ${w}`)}
      </span>
    </span>
  )
}
