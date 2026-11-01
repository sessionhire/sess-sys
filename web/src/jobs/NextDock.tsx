import { dayLabel, firstName, type JobStep, type JobView, type View } from '@sh/shared'
import { useAccess } from '../role.ts'
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
 */

/** Whose a task is when this role can't act on it. */
const WHOSE: Record<JobStep, string> = {
  quote: 'the office',
  confirmed: 'the office',
  crew: 'whoever books the crew',
  kit: 'the heads of department',
  prep: 'the warehouse',
  show: 'the crew on it',
  back: 'the warehouse',
  deprep: 'the warehouse',
}

export function NextDock({ job, view, onPart, onOpenTask }: { job: JobView; view: View; onPart: (p: JobPart) => void; onOpenTask: (t: JobStep) => void }) {
  const access = useAccess()
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
      {task?.dueOn && ` · ${task.late ? 'was due' : 'by'} ${dayLabel(task.dueOn)}`}
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

  if (steps.stopped) return rest(steps.stopped)
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
      press = { label: quotes.length === 0 ? 'Make a quote' : quotes.some((q) => q.status === 'draft') ? 'Finish the quote' : 'Open the quote', href: `${href}/quote` }
      break
    }
    case 'confirmed':
      if (!access.can('jobs')) break
      press = { label: "Record the client's answer", onPress: () => onOpenTask('confirmed') }
      break
    case 'crew': {
      const needed = job.calls.reduce((n, c) => n + c.needed, 0)
      const short = task.hint?.match(/^(\d+) of (\d+) booked/)
      press = { label: needed === 0 ? 'Ask for crew' : short ? `Book ${Number(short[2]) - Number(short[1])} more crew` : 'Book the crew', onPress: () => onPart('crew') }
      break
    }
    case 'kit': {
      const short = task.hint?.match(/(\d+) short/)
      press = { label: short ? `Sort ${short[1]} short on the kit` : task.hint === 'No kit on the job yet' ? 'Add the kit' : 'Settle the kit and vans', onPress: () => onPart('kit') }
      break
    }
    case 'prep':
      press = task.hint === 'No kit to pick yet' ? { label: 'Add the kit', onPress: () => onPart('kit') } : { label: 'Pick the kit', href: `${href}/pick` }
      break
    case 'show':
      why = `Nothing to press: ${task.hint?.startsWith('On until') ? `on the job until ${task.hint.slice('On until '.length)}` : task.hint?.toLowerCase() ?? 'the job is on'}.`
      break
    case 'back':
      press = { label: 'Scan the kit back', href: `${href}/pick` }
      break
    case 'deprep':
      if (!mayTask) break
      press = { label: 'Tick off the deprep', onPress: () => onOpenTask('deprep') }
      break
  }
  if (!press) return rest(why ?? `Next is ${task.label.toLowerCase()}, for ${task.owner ? task.owner.name : WHOSE[task.key]}. Nothing here for you to press.`)
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
    </div>
  )
}
