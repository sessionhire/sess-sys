import { dayLabel, firstName, invoiceOf, irishToday, jobPosition, ownerByRole, STAGE_OF, STOPPED_WORDS, type JobStep, type JobView, type StageView, type StepView, type View } from '@sh/shared'
import { useEffect, useRef, useState } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { peopleOn, promptFor, type Share } from '../crew/CrewScreen.tsx'
import { useMe } from '../crew/Leave.tsx'
import { Icon } from '../Icon.tsx'
import { useAccess } from '../role.ts'
import { Pending } from '../StatusPill.tsx'
import { client } from '../sync.ts'
import type { JobPart } from './JobScreen.tsx'
import './steps.css'

/**
 * Where a job is (ADR 0073, ADR 0104): five stages across the top of the
 * job page, Quoting, Planning, Going out, On the job and Back, the one the
 * job is in ringed, worked out from the job's own records and never ticked.
 * Under the strip, the stage opened lists its tasks, each a row saying how
 * it stands, whose it is and when it's due, done in any order; a task left
 * open from an earlier stage is listed too, so nothing is lost when the job
 * moves on. A task picked opens under the list: what it means, who it's
 * down to, the day it's due by, and its tick. The app ticks what it can
 * tell from the job's own records; the rest are ticked here. A task given
 * to someone is on their list on Home, and they hear of it in
 * Notifications, in the app only.
 *
 * The Confirmed task is the client's answer itself (ADR 0103), the one gate
 * between stages: saying yes confirms the job (and records the yes on the
 * quote that went), which is what puts it on the calendar and holds its
 * kit; saying no marks it lost. A tick by hand on it would say the job was
 * going ahead while it stayed an enquiry, so it has none. The job's one
 * Next button lives in the page head (NextDock.tsx), not here.
 */

const PART_NAMES: Partial<Record<NonNullable<StepView['part']>, string>> = { crew: 'Crew', kit: 'Kit and vans', money: 'Quote', phases: 'Phases' }

export function StepsCard({
  job,
  view,
  openTask,
  onOpenTask,
  onPart,
  onTell,
}: {
  job: JobView
  view: View
  /** The task opened from outside (the Next dock), if any. */
  openTask: JobStep | undefined
  onOpenTask: (t: JobStep | undefined) => void
  onPart: (p: JobPart) => void
  onTell: (share: Share | undefined) => void
}) {
  const steps = view.steps.of(job.id)
  const [pickedStage, setPickedStage] = useState<StageView['key'] | undefined>()
  // Moving to another job opens that job's own stage.
  useEffect(() => setPickedStage(undefined), [job.id])
  if (!steps) return null
  if (steps.stopped && steps.steps.every((s) => !s.ownerId && !s.ticked)) {
    // An errand, a meeting, or a stopped job nobody had started on: a line, not a tracker.
    return (
      <section className="card job-steps" aria-label="Where it is">
        <p className="hint">{steps.stopped}</p>
      </section>
    )
  }
  const shownTask = steps.steps.find((s) => s.key === openTask)
  // The stage open: the one picked, else the task opened from outside's, else the one the job is in; through every stage, the last.
  const openKey = pickedStage ?? (shownTask ? STAGE_OF[shownTask.key] : undefined) ?? steps.stage?.key ?? (steps.finished ? 'back' : undefined)
  const open = steps.stages.find((s) => s.key === openKey)
  const atIndex = steps.stage ? steps.stages.indexOf(steps.stage) : steps.finished ? steps.stages.length : 0
  const pickStage = (key: StageView['key']) => {
    setPickedStage(key)
    if (shownTask && STAGE_OF[shownTask.key] !== key) onOpenTask(undefined)
  }
  // The tasks left open from an earlier stage are listed with the stage the job is in, so they're seen where the work is.
  const behind = open && open.state === 'now' ? steps.behind : []
  // The stage the job is in takes the job's tone when something in it is short or late, as its line on a list does.
  const tone = steps.stopped ? undefined : jobPosition(steps)?.tone
  return (
    <section className="card job-steps" aria-labelledby="job-steps-title">
      <header className="steps-head">
        <h2 id="job-steps-title">Where it is</h2>
        <p className="hint">
          {steps.stopped ?? (steps.finished ? `Through every stage · all ${steps.of} tasks done` : `${steps.stage ? `In ${steps.stage.label}` : ''} · ${steps.done} of ${steps.of} tasks done`)}
        </p>
      </header>
      <ol className="stages-flow" data-stopped={steps.stopped ? 'true' : undefined} data-tone={tone}>
        {steps.stages.map((s, i) => (
          <li key={s.key} data-state={s.state} data-come={i < atIndex ? 'true' : undefined} data-open={s.state === 'done' && s.done < s.of ? 'true' : undefined} aria-current={s.state === 'now' ? 'step' : undefined}>
            <button type="button" aria-expanded={s.key === open?.key} aria-controls="job-stage-open" aria-label={stageName(s, steps.stopped !== undefined)} onClick={() => pickStage(s.key)}>
              <span className="stage-dot" aria-hidden="true">
                {s.state === 'done' ? <Icon name="done" /> : s.number}
              </span>
              <span className="stage-label" aria-hidden="true">
                {s.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {open && (
        <div className="stage-open" id="job-stage-open">
          {/* Not .stage-line, the list rows' inline line, which broke this sentence at each part on a phone (audit, 5 November 2026, finding 88). */}
          <p className="stage-said">
            <b>{open.label}</b>
            {open.state === 'now' ? ' · the stage the job is in. ' : open.state === 'done' ? ' · passed. ' : ' · to come. '}
            {open.line}
          </p>
          <TaskList tasks={open.tasks} shown={shownTask} onOpen={(k) => onOpenTask(shownTask?.key === k ? undefined : k)} />
          {behind.length > 0 && (
            <>
              <p className="hint behind-head">Left open from before</p>
              <TaskList tasks={behind} shown={shownTask} onOpen={(k) => onOpenTask(shownTask?.key === k ? undefined : k)} />
            </>
          )}
        </div>
      )}
      <InvoiceRow job={job} view={view} />
      {shownTask && <OpenStep key={`${job.id}.${shownTask.key}`} job={job} view={view} step={shownTask} stopped={steps.stopped !== undefined} onPart={onPart} onTell={onTell} />}
    </section>
  )
}

/**
 * The office's last step, under the tasks, for whoever reads money (UX sweep, 6 November 2026, move 12): one row in the
 * task-list shape, worked out from the quote and never ticked, opening the Quote tab. Quiet before the job is through,
 * amber once it is and not invoiced, "Invoiced Mon 2 Nov · paid" when done; never an amount (ADR 0042). Not a ninth task:
 * nothing here holds a job in Back (ADR 0109).
 */
function InvoiceRow({ job, view }: { job: JobView; view: View }) {
  const access = useAccess()
  const today = irishToday()
  if (!access.can('money')) return null
  const at = invoiceOf(job, view.money.currentOf(job.id), today)
  if (at.state === 'none') return null
  const how =
    at.state === 'invoiced'
      ? `Invoiced ${dayLabel(at.on, today)}${at.paidOn ? ' · paid' : ''}`
      : at.state === 'not-needed'
        ? 'Not needed: before the app listed invoices'
        : at.state === 'due'
          ? `Not invoiced yet · through since ${dayLabel(at.since, today)}`
          : 'Not invoiced yet'
  const done = at.state === 'invoiced' || at.state === 'not-needed'
  return (
    <ul className="task-list invoice-row" aria-label="Invoice">
      <li data-state={done ? 'done' : 'to-come'} data-due={at.state === 'due' ? 'true' : undefined}>
        <a href={`#jobs/${encodeURIComponent(job.id)}/quote`}>
          <span className="task-tick" aria-hidden="true">
            {done ? <Icon name="done" /> : null}
          </span>
          <span className="task-words">
            <span className="task-name">Invoice</span>
            <span className="task-how">{how}</span>
          </span>
          <span className="task-tag">{at.state === 'invoiced' ? (at.paidOn ? 'Paid' : 'Invoiced') : at.state === 'not-needed' ? 'Not needed' : at.state === 'due' ? 'To invoice' : 'After'}</span>
        </a>
      </li>
    </ul>
  )
}

/** What a screen reader hears for a stage: its number and name, how it stands, and how far through. */
function stageName(s: StageView, stopped: boolean): string {
  const how = stopped ? 'stopped' : s.state === 'done' ? (s.done < s.of ? `passed with ${s.of - s.done} left open` : 'passed') : s.state === 'now' ? 'the stage the job is in' : 'to come'
  return `${s.number}. ${s.label}, ${how}, ${s.done} of ${s.of} done`
}

/** A stage's tasks as rows (the task-list shape): the name, how it stands, whose it is and when it's due, and a plain tag. */
function TaskList({ tasks, shown, onOpen }: { tasks: StepView[]; shown: StepView | undefined; onOpen: (k: JobStep) => void }) {
  return (
    <ul className="task-list">
      {tasks.map((t) => (
        <li key={t.key} data-state={t.state} data-late={t.late ? 'true' : undefined}>
          <button type="button" aria-expanded={t.key === shown?.key} aria-controls="job-step-open" onClick={() => onOpen(t.key)}>
            <span className="task-tick" aria-hidden="true">
              {t.done ? <Icon name="done" /> : null}
            </span>
            <span className="task-words">
              <span className="task-name">
                {t.label} <Pending pending={t.pending} />
              </span>
              <span className="task-how">
                {t.auto ?? (t.ticked ? `Ticked${t.ticked.by ? ` by ${firstName(t.ticked.by)}` : ''}` : (t.skipped ?? t.hint ?? ''))}
                {t.owner && ` · ${firstName(t.owner)}`}
                {t.dueOn && !t.done && ` · ${t.late ? 'was due' : 'by'} ${dayLabel(t.dueOn)}`}
              </span>
            </span>
            <span className="task-tag">{t.done ? 'Done' : t.skipped ? 'Not needed' : t.late ? 'Late' : t.state === 'now' ? 'Next' : 'To do'}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function OpenStep({
  job,
  view,
  step,
  stopped,
  onPart,
  onTell,
}: {
  job: JobView
  view: View
  step: StepView
  stopped: boolean
  onPart: (p: JobPart) => void
  onTell: (share: Share | undefined) => void
}) {
  const access = useAccess()
  const { me } = useMe(view)
  const { run, error } = useAct()
  const box = useRef<HTMLDivElement>(null)
  // Opened from the Next dock, the task comes into view and takes the focus, so the eye and the keyboard land on it.
  useEffect(() => {
    box.current?.scrollIntoView({ block: 'nearest' })
    box.current?.querySelector<HTMLElement>('h3')?.focus()
  }, [])
  // Staff crew change only their own tasks (ADR 0073); the server says the same.
  const mayChange = access.can('steps') && (access.role !== 'crew' || (!!access.personId && step.ownerId === access.personId)) && !stopped
  const staff = view.leave.staff
  const set = (change: { ownerId?: string | null; dueOn?: string | null; done?: boolean }) =>
    run(async () => {
      await client.mutate('jobStep.set', { projectId: job.id, step: step.key, ...change, by: me?.id ?? null })
      // A quote sent another way (by hand, from Current RMS) moves an enquiry on, as marking one sent here does (ADR 0081).
      if (step.key === 'quote' && change.done && job.status === 'enquiry' && access.can('jobs')) await client.mutate('project.update', { id: job.id, status: 'quoted' })
    })
  // The client's answer is the job's own status, not a tick (ADR 0103).
  const answering = step.key === 'confirmed' && !step.ticked && job.status !== 'confirmed' && !stopped && access.can('jobs')
  const where = step.part === 'pick' ? undefined : step.part && PART_NAMES[step.part]
  const seesPart = step.part !== 'money' || access.can('money')
  return (
    <div className="step-open" id="job-step-open" aria-live="polite" ref={box}>
      <h3 tabIndex={-1}>
        {step.label} <Pending pending={step.pending} />
      </h3>
      <p className="step-state" data-state={step.state}>
        {step.auto
          ? `Done: ${step.auto}.`
          : step.ticked
            ? `Ticked done${step.ticked.by ? ` by ${step.ticked.by.name}` : ''}, ${dayLabel(irishToday(new Date(step.ticked.at)))}.`
            : step.skipped
              ? `Not needed: ${step.skipped}.`
              : `${step.hint ? `${step.hint}. ` : ''}${step.state === 'now' && !stopped ? 'This is the task to do next.' : ''}${step.dueOn ? ` ${step.late ? 'Was due' : 'Due'} by ${dayLabel(step.dueOn)}.` : ''}`}
      </p>
      {/* The answer first, where the eye is: who it's down to can wait under it. */}
      {answering ? <ClientsAnswer job={job} view={view} onTell={onTell} /> : <p className="hint">{step.line}</p>}
      {/* Whose it is when nobody is named: the role, from the one table (UX sweep, 6 November 2026, move 12). */}
      {!step.owner && !step.done && !step.skipped && <p className="step-owner-line">{ownerByRole(step.key)}</p>}
      {mayChange ? (
        <div className="step-actions">
          <label className="field">
            Down to
            <select value={step.ownerId ?? ''} onChange={(e) => void set({ ownerId: e.target.value || null })}>
              <option value="">Nobody named</option>
              {step.owner && !staff.some((p) => p.id === step.ownerId) && <option value={step.owner.id}>{step.owner.name}</option>}
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === me?.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </label>
          {me && step.ownerId !== me.id && access.role !== 'crew' && staff.some((p) => p.id === me.id) && (
            <button type="button" onClick={() => void set({ ownerId: me.id })}>
              Give it to me
            </button>
          )}
          {/* The day it's due by (ADR 0104): a date, or none. A task done needs none. */}
          {!step.done && !step.skipped && (
            <label className="field">
              Due by
              <input type="date" value={step.dueOn ?? ''} onChange={(e) => void set({ dueOn: e.target.value || null })} />
            </label>
          )}
          {/* What the app ticks itself has no tick to give or take; a tick given by hand on top of it stays, out of the way. */}
          {!step.auto &&
            !answering &&
            (step.ticked ? (
              <button type="button" onClick={() => void set({ done: false })}>
                Take the tick off
              </button>
            ) : (
              !step.skipped && (
                <button type="button" onClick={() => void set({ done: true })}>
                  Mark it done
                </button>
              )
            ))}
        </div>
      ) : (
        step.owner && <p className="step-owner-line">Down to {step.owner.name}.</p>
      )}
      <Refusal error={error} />
      {step.part === 'pick' && (
        <a className="button" href={`#jobs/${encodeURIComponent(job.id)}/pick`}>
          Open the pick list
        </a>
      )}
      {seesPart && where && !answering && (
        <button type="button" className="link" onClick={() => onPart(step.part as JobPart)}>
          Open {where}
        </button>
      )}
    </div>
  )
}

/**
 * The client's answer, on the Confirmed task (ADR 0103): yes confirms the job, which puts it on the calendar and holds
 * its kit; no marks it lost, which cancels its crew calls, so that one asks first. Either goes on the quote that went
 * too, when there is one waiting for an answer, so the quote and the job never say different things.
 */
function ClientsAnswer({ job, view, onTell }: { job: JobView; view: View; onTell: (share: Share | undefined) => void }) {
  const access = useAccess()
  const [asking, setAsking] = useState(false)
  const { run, error } = useAct()
  const today = irishToday()
  // The version that went to the client and is waiting on them; a draft is left to be finished and sent.
  const current = access.can('money') ? view.money.currentOf(job.id) : undefined
  const waiting = current && !current.invoicedOn && (current.status === 'sent' || current.status === 'accepted' || current.status === 'declined') ? current : undefined
  const people = job.calls.filter((c) => c.status === 'open').flatMap((c) => peopleOn(c))
  const answer = (yes: boolean) => {
    setAsking(false)
    void run(async () => {
      const said = yes ? 'accepted' : 'declined'
      if (waiting && waiting.status !== said) await client.mutate('quote.answer', { id: waiting.id, answer: said, on: today })
      await client.mutate('project.update', { id: job.id, status: yes ? 'confirmed' : 'lost' })
    }).then((ok) => ok && !yes && onTell(promptFor('job-stopped', people)))
  }
  return (
    <div className="clients-answer">
      <p>
        {waiting?.status === 'accepted'
          ? 'The client has said yes. Confirming the job puts it on the jobs calendar and holds its kit.'
          : waiting?.status === 'declined'
            ? 'The client turned the quote down. Mark the job lost, or confirm it if they came back.'
            : `Confirming the job puts it on the jobs calendar and holds its kit${waiting ? `, and records the yes on version ${waiting.version} of the quote` : ''}.`}
      </p>
      {asking ? (
        <Confirm
          // What their link says once the job is lost, in its own words (UX sweep, 6 November 2026, move 6).
          question={`Marking ${job.name} lost also cancels its crew calls${
            people.length ? `: ${people.length === 1 ? '1 person' : `${people.length} people`} offered or booked will see ${STOPPED_WORDS.lost}` : ''
          }.`}
          yes="Mark it lost"
          loss
          no="Keep it as it is"
          onYes={() => answer(false)}
          onNo={() => setAsking(false)}
        />
      ) : (
        <div className="step-actions">
          {/* Plain, as the card's other buttons are: the Next dock holds the page's one filled red (ADR 0104; audit, 5 November 2026, finding 19). */}
          <button type="button" onClick={() => answer(true)} disabled={job.pending}>
            Confirm the job
          </button>
          <button type="button" onClick={() => (job.calls.some((c) => c.status === 'open') ? setAsking(true) : answer(false))} disabled={job.pending}>
            The client said no
          </button>
        </div>
      )}
      <Refusal error={error} />
    </div>
  )
}
