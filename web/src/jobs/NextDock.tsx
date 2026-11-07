import { dayLabel, firstName, STATUS_LABELS, STOPPED, whoDoes, type JobStep, type JobView, type View } from '@sh/shared'
import { Refusal, useAct } from '../act.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
import type { JobPart } from './JobScreen.tsx'

/**
 * The one Next button of a job (ADR 0104): drawn the same on every job and
 * in one place, right of the title on a desk and docked above the bar on a
 * phone, where the thumb is, staying put while the page scrolls. A line
 * says where the job is and how far (the stage, the task's count, whose it
 * is, when it's due); the one filled button says what to do, a verb and
 * its object; a quiet second choice hands the task to someone. It is never
 * greyed out and never gone: when there's nothing for this person to press
 * (the show is on, the task is another role's, the job is through) the
 * same place says so in plain words.
 *
 * It offers only what this person's role can do (ADR 0034, ADR 0109): booking
 * crew needs the crew ability, the kit the kit one, picking and scanning the
 * stock one; anyone else is told whose it is. Its label follows what has
 * happened: once the client has said yes it confirms the job in one press,
 * and once a job's dates pass while it's still being sold it asks what
 * happened.
 */

/** Whose a task is when this role can't act on it. */

export function NextDock({ job, view, onPart, onOpenTask }: { job: JobView; view: View; onPart: (p: JobPart) => void; onOpenTask: (t: JobStep) => void }) {
  const access = useAccess()
  const { run, error } = useAct()
  const steps = view.steps.of(job.id)
  // Errands and meetings have no stages, so no Next: the page is as it was.
  if (!steps || (steps.stopped && !steps.steps.some((s) => s.ownerId || s.ticked) && steps.stopped.startsWith('Errands'))) return null
  const href = `#jobs/${encodeURIComponent(job.id)}`
  const task = steps.current
  const stage = steps.stage
  const mayTask = access.can('steps') && (access.role !== 'crew' || (!!access.personId && task?.ownerId === access.personId))

  /** The line over the button: where the job is, and how far. */
  const line = (
    <p className="line">
      <b>Next</b>
      {stage && ` · ${stage.label}`}
      {task?.hint && ` · ${task.hint}`}
      {task?.owner && ` · ${firstName(task.owner)}`}
      {task?.dueOn && (task.late ? <> · <span className="late">was due {dayLabel(task.dueOn)}</span></> : ` · by ${dayLabel(task.dueOn)}`)}
    </p>
  )
  const rest = (words: string, link?: { href: string; label: string }) => (
    <div className="next-dock" role="region" aria-label="Next" data-rest="true">
      {line}
      <p className="rest">
        {words}
        {link && (
          <>
            {' '}
            <a href={link.href}>{link.label}</a>
          </>
        )}
      </p>
    </div>
  )

  // The steps card says the tasks are stopped; the dock says how to take the job up again, rather than the same words twice (audit,
  // 5 November 2026, finding 88).
  if (steps.stopped)
    return STOPPED.includes(job.status)
      ? rest(
          access.can('jobs')
            ? `${STATUS_LABELS[job.status]}. To take it up again, change its status under Change details.`
            : `${STATUS_LABELS[job.status]}: the office can take it up again.`
        )
      : rest(steps.stopped)
  if (steps.finished) {
    const deprep = steps.steps.find((s) => s.key === 'deprep')
    return rest(`All done${deprep?.ticked ? `: deprepped ${dayLabel(deprep.ticked.at.slice(0, 10))}` : ''}. Nothing left to press.`)
  }
  if (!task) {
    // The stage's tasks are done and nothing is left behind: the job waits on its dates.
    const show = steps.steps.find((s) => s.key === 'show')
    return rest(`${stage?.label ?? 'This stage'} is done. ${show?.hint ?? ''}`.trim())
  }

  /** What to press for the task, or why there's nothing to. */
  let press: { label: string; href?: string; onPress?: () => void } | undefined
  let why: string | undefined
  switch (task.key) {
    case 'quote': {
      if (!access.can('money')) break
      const quotes = view.money.quotesOf(job.id)
      // A quote is built from the kit and crew, so a job with neither starts there (audit, 5 November 2026, finding 16).
      const empty = quotes.length === 0 && !(view.kit.byJob.get(job.id)?.length) && job.calls.length === 0
      press =
        empty && access.can('kit')
          ? { label: 'Add the kit to quote', onPress: () => onPart('kit') }
          : { label: quotes.length === 0 ? 'Make a quote' : quotes.some((q) => q.status === 'draft') ? 'Finish the quote' : 'Open the quote', href: `${href}/quote` }
      break
    }
    case 'confirmed': {
      if (!access.can('jobs')) break
      // The client's yes is on the quote, so the one press left is the job's own (audit, 5 November 2026, finding 25).
      const yes = access.can('money') && view.money.currentOf(job.id)?.status === 'accepted'
      press = yes
        ? { label: 'Confirm the job', onPress: () => void run(() => client.mutate('project.update', { id: job.id, status: 'confirmed' })) }
        : { label: steps.lapsed ? 'Record what happened' : "Record the client's answer", onPress: () => onOpenTask('confirmed') }
      break
    }
    case 'crew': {
      if (!access.can('crew')) break
      const needed = job.calls.reduce((n, c) => n + c.needed, 0)
      const short = task.hint?.match(/^(\d+) of (\d+) booked/)
      press = { label: needed === 0 ? 'Ask for the crew' : short ? `Book ${Number(short[2]) - Number(short[1])} more crew` : 'Book the crew', onPress: () => onPart('crew') }
      break
    }
    case 'kit': {
      if (!access.can('kit')) break
      const short = task.hint?.match(/(\d+) short/)
      press = { label: short ? `Sort ${short[1]} short on the kit` : task.hint === 'No kit on the job yet' ? 'Add the kit' : 'Settle the kit and vans', onPress: () => onPart('kit') }
      break
    }
    case 'prep':
      if (!access.can(task.hint === 'No kit to pick yet' ? 'kit' : 'stock')) break
      press = task.hint === 'No kit to pick yet' ? { label: 'Add the kit', onPress: () => onPart('kit') } : { label: 'Pick the kit', href: `${href}/pick` }
      break
    case 'show':
      why = `Nothing to press: ${task.hint?.startsWith('On until') ? `on the job until ${task.hint.slice('On until '.length)}` : task.hint?.toLowerCase() ?? 'the job is on'}.`
      break
    case 'back':
      if (!access.can('stock')) break
      press = { label: 'Scan the kit back', href: `${href}/pick` }
      break
    case 'deprep':
      if (!mayTask) break
      press = { label: 'Tick off the deprep', onPress: () => onOpenTask('deprep') }
      break
  }
  // Someone else's, said in the one shape the word table writes (UX sweep, 6 November 2026, move 4): who does it, and nothing to press.
  if (!press) return rest(why ?? `Next is ${task.label.toLowerCase()}. ${task.owner ? `It's down to ${task.owner.name}.` : whoDoes(task.key)}`)
  // The quiet second choice: hand the task on, or open it. Not for the client's answer, whose button already opens it.
  const second = mayTask && task.key !== 'confirmed' && task.key !== 'deprep' && (
    <button type="button" className="link second" onClick={() => onOpenTask(task.key)}>
      {task.owner ? 'Hand it on' : 'Hand it to someone'}
    </button>
  )
  return (
    <div className="next-dock" role="region" aria-label="Next">
      {line}
      {press.href ? (
        <a className="button primary" href={press.href}>
          {press.label}
        </a>
      ) : (
        <button type="button" className="primary" onClick={press.onPress}>
          {press.label}
        </button>
      )}
      {second}
      <Refusal error={error} />
    </div>
  )
}
