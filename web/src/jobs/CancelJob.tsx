import { dayLabel, STATUS_LABELS, STOPPED, type JobView } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { promptFor, type Share } from '../crew/Messages.tsx'
import { useReach } from '../crew/reach.tsx'
import { client } from '../sync.ts'
import { useToday } from '../view.ts'
import { crewOnJob, stopQuestion } from './jobStatus.ts'

/**
 * Calling a job off, said as what it is (user flows of 13 November 2026, finding 6): until now it was a status picked in
 * Change details, with no word on why. The button asks which it was, called off or lost to someone else, and why in a
 * line, kept at the top of the office notes with the day, so whoever opens the job later reads what happened. Crew
 * offered or booked are asked about first, as Change details does (ADR 0149), and who was told is said after.
 */
export function CancelJob({ job, onTell }: { job: JobView; onTell: (share: Share | undefined) => void }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'cancelled' | 'lost'>(job.status === 'confirmed' ? 'cancelled' : 'lost')
  const [why, setWhy] = useState('')
  const [asking, setAsking] = useState(false)
  const { run, error } = useAct()
  const reach = useReach()
  const today = useToday()
  if (STOPPED.includes(job.status)) return null
  const people = crewOnJob(job)
  const go = () => {
    setAsking(false)
    const line = `${STATUS_LABELS[status]} ${dayLabel(today)}${why.trim() ? `: ${why.trim()}` : ''}`
    const officeNotes = [line, job.officeNotes ?? ''].filter(Boolean).join('\n').slice(0, 4000)
    void run(() => client.mutate('project.update', { id: job.id, status, officeNotes })).then((ok) => {
      if (!ok) return
      setOpen(false)
      if (people.length) onTell(promptFor('job-stopped', people))
    })
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (job.calls.some((c) => c.status === 'open')) setAsking(true)
    else go()
  }
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} disabled={job.pending}>
        Cancel this job…
      </button>
    )
  return (
    <form className="grid-form cancel-job" onSubmit={submit} aria-label="Cancel this job">
      <fieldset className="wide" disabled={asking}>
        <legend>What happened?</legend>
        <label>
          <input type="radio" name={`stop-${job.id}`} checked={status === 'cancelled'} onChange={() => setStatus('cancelled')} /> Called off: it isn't going ahead
        </label>
        <label>
          <input type="radio" name={`stop-${job.id}`} checked={status === 'lost'} onChange={() => setStatus('lost')} /> Lost: the client went elsewhere or said no
        </label>
      </fieldset>
      <label className="wide">
        Why, in a line <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} placeholder="Optional: kept in the office notes" disabled={asking} />
      </label>
      {asking ? (
        <Confirm
          className="wide"
          question={stopQuestion(reach, job, status, people)}
          yes={`Mark ${STATUS_LABELS[status].toLowerCase()}`}
          loss
          no="Keep it as it is"
          onYes={go}
          onNo={() => setAsking(false)}
        />
      ) : (
        <div className="actions wide">
          <button type="submit" disabled={job.pending}>
            Mark {STATUS_LABELS[status].toLowerCase()}
          </button>
          <button type="button" className="link" onClick={() => setOpen(false)}>
            Keep the job
          </button>
        </div>
      )}
      <Refusal error={error} />
    </form>
  )
}
