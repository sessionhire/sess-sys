import {
  dayLabel,
  hasSteps,
  spanLabel,
  STATUS_LABELS,
  STOP_ABOUT,
  STOP_BUTTON,
  STOP_NOTHING,
  STOP_STATUSES,
  STOP_WHY_EXAMPLE,
  STOP_WHY_HINT,
  STOP_WHY_LENGTH,
  stopAfterWords,
  stopLines,
  stopNote,
  STOPPED,
  type JobView,
  type StopLine,
  type StopStatus,
} from '@sh/shared'
import { useEffect, useId, useRef, useState } from 'react'
import { Refusal, useAct } from '../act.tsx'
import type { TellTo } from '../crew/Messages.tsx'
import { useReach } from '../crew/reach.tsx'
import { Icon, type IconName } from '../Icon.tsx'
import { client } from '../sync.ts'
import { useToday, useView } from '../view.ts'
import { crewOnJob, stopFacts } from './jobStatus.ts'

/** A job that can still be stopped: one going ahead or pencilled in. */
export const canCancel = (job: Pick<JobView, 'status'>) => !STOPPED.includes(job.status)

/** Each line's part of the job, as its tab and the rest of the app draw it. */
const ICONS: Record<StopLine['key'], IconName> = { crew: 'people', kit: 'kit', transport: 'van', calendar: 'calendar', quote: 'document' }

/**
 * Stopping a job from its own page (user flows of 13 November 2026, finding 6; redrawn 27 November 2026, as Colly asked:
 * "This UI for cancelling a gig can be improved a lot"). "Cancel this job…" under its details opens this in the buttons'
 * place, as a card of its own, so it has the room a decision needs rather than a corner beside Change details.
 *
 * It asks what happened, as two choices each with a line of what it is, under the status's own word (errands and
 * meetings are only ever cancelled, so they aren't asked); then why, with the box saying where the words go before
 * anything is typed. Beside them, what the press does to this job, each part in a line and only what's true of it
 * (shared/src/stop-job.ts): who sees what and how it reaches them, in amber as it leaves the app; the kit and vehicles
 * free for other jobs again; the days that come off the calendar; the quote. Then the way back, and the one thing that
 * has none.
 *
 * One press then does it. There's no second question, as the form has already said everything one would, and a
 * question asked every time is answered by habit. The friction is in the form: the press takes the bad fill and is
 * named for what it does ("Cancel the job", "Mark lost"), sits at the far end from the button that opened it, and Enter
 * in the reason box does nothing, so a stray key never cancels a gig. Keep the job is the plain way out, and gives the
 * focus back to where it came from. After it, the panel under the details says what was sent to whom (ADR 0149).
 */
export function CancelJob({ job, onKeep, onDone }: { job: JobView; onKeep: () => void; /** The job is stopped: who was on it, to say what they were sent. */ onDone: (people: TellTo[]) => void }) {
  // Only a gig or a dry hire can be lost to a no: an errand or a meeting is called off.
  const ways: readonly StopStatus[] = hasSteps(job) ? STOP_STATUSES : ['cancelled']
  const [status, setStatus] = useState<StopStatus>(job.status === 'confirmed' || !hasSteps(job) ? 'cancelled' : 'lost')
  const [why, setWhy] = useState('')
  const [sending, setSending] = useState(false)
  const { run, error } = useAct()
  const view = useView()
  const reach = useReach()
  const today = useToday()
  const id = useId()
  const title = useRef<HTMLHeadingElement>(null)
  // It opens with the focus on its name, so it's read from the top and the choice is the next Tab; and comes into view as far as
  // it fits, a nudge and not a jump, as the panels a press opens do.
  useEffect(() => {
    title.current?.closest('form')?.scrollIntoView?.({ block: 'nearest' })
    title.current?.focus({ preventScroll: true })
  }, [])

  const people = crewOnJob(job)
  const facts = stopFacts(view, reach, job, status, people, today)
  const lines = stopLines(facts)
  const go = () => {
    if (sending) return
    setSending(true)
    const officeNotes = stopNote(STATUS_LABELS[status], dayLabel(today), why, job.officeNotes)
    void run(() => client.mutate('project.update', { id: job.id, status, officeNotes })).then((ok) => {
      setSending(false)
      if (ok) onDone(people)
    })
  }

  return (
    // Enter in the reason box sends nothing: the press that stops a job is always the button itself.
    <form className="card cancel-job" aria-labelledby={`${id}-title`} onSubmit={(e) => e.preventDefault()}>
      <div className="cancel-job-head">
        <h2 id={`${id}-title`} ref={title} tabIndex={-1}>
          Cancel this job
        </h2>
        {/* Which job, said in the form itself: on a phone its name has scrolled off the top by now. */}
        <p className="hint">{[job.name, job.span && spanLabel(job.span)].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="cancel-job-body">
        <div className="cancel-job-ask">
          {ways.length > 1 && (
            <fieldset className="choices">
              <legend>What happened?</legend>
              {ways.map((s) => (
                <label className="signal" key={s}>
                  <input type="radio" name={`${id}-status`} value={s} checked={status === s} onChange={() => setStatus(s)} aria-labelledby={`${id}-${s}-name`} aria-describedby={`${id}-${s}-about`} />
                  <span>
                    <b id={`${id}-${s}-name`}>{STATUS_LABELS[s]}</b> <span id={`${id}-${s}-about`}>{STOP_ABOUT[s]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="cancel-job-why">
            <label htmlFor={`${id}-why`}>
              Why <span className="optional">(optional)</span>
            </label>
            <input id={`${id}-why`} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={STOP_WHY_LENGTH} placeholder={STOP_WHY_EXAMPLE[status]} aria-describedby={`${id}-why-hint`} autoComplete="off" />
            <p className="hint" id={`${id}-why-hint`}>
              {STOP_WHY_HINT}
            </p>
          </div>
        </div>
        <div className="cancel-job-does" id={`${id}-does`}>
          <p className="cancel-job-label" id={`${id}-does-label`}>
            What this does
          </p>
          {lines.length > 0 ? (
            <ul aria-labelledby={`${id}-does-label`}>
              {lines.map((l) => (
                <li key={l.key} className={l.warn ? 'warn' : undefined}>
                  <Icon name={ICONS[l.key]} />
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cancel-job-nothing">{STOP_NOTHING}</p>
          )}
          <p className="hint">{stopAfterWords(facts)}</p>
        </div>
      </div>
      <Refusal error={error} />
      <div className="actions">
        {/* What it does is read out with it, as the focus lands on it. */}
        <button type="button" className="danger" onClick={go} aria-describedby={`${id}-does`} aria-busy={sending || undefined}>
          {STOP_BUTTON[status]}
        </button>
        <button type="button" onClick={onKeep}>
          Keep the job
        </button>
      </div>
    </form>
  )
}
