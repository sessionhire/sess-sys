import { plural, type JobView, type View } from '@sh/shared'
import './steps.css'

/**
 * Where a job is, in one line on a list row (ADR 0104, part 2): five
 * segments for the five stages, the ones passed filled and the one the job
 * is in drawn in ink, then the stage's name and what is short or waiting
 * in it, so two Confirmed jobs no longer look the same. Nothing on a
 * stopped job, an errand or a meeting: the status pill says what there is
 * to say. `compact` keeps the segments and the stage's name only, for a
 * row that is one line.
 */
export function StageLine({ job, view, compact }: { job: JobView; view: View; compact?: boolean }) {
  const s = view.steps.of(job.id)
  if (!s || s.stopped) return null
  const late = s.steps.filter((t) => t.late).length
  const words = s.finished
    ? 'Through every stage'
    : compact
      ? s.stage!.label
      : [s.stage!.label, s.stage!.hint, s.behind.length ? `${plural(s.behind.length, 'task')} left open from before` : ''].filter(Boolean).join(' · ')
  return (
    <span className="stage-line" data-compact={compact ? 'true' : undefined}>
      <span className="stage-seg" aria-hidden="true">
        {s.stages.map((st) => (
          <i key={st.key} data-state={st.state} />
        ))}
      </span>
      <span className="stage-words">{words}</span>
      {late > 0 && <span className="stage-late">{compact ? 'Late' : `${plural(late, 'task')} late`}</span>}
    </span>
  )
}
