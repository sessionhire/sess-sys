import { UnitBox } from '../UnitBox.tsx'
import {
  ADD_A_PHASE,
  calendarTitles,
  crewAgainWords,
  crewFill,
  daysLabel,
  daysOffPhase,
  phaseDaysRule,
  departmentForRole,
  departmentOf,
  eachDay,
  mapLink,
  movedCallSpan,
  newId,
  parseEuro,
  phaseOnCalendar,
  crewAsked,
  holdTitle,
  onHold,
  phaseOnlyGrew,
  MAX_LOCAL_CREW,
  PHASE_NAMES,
  KIND_LABELS,
  kindOf,
  PROJECT_KINDS,
  PROJECT_STATUSES,
  sameDepartment,
  STATUS_LABELS,
  type ProjectKind,
  STOPPED,
  spanLabel,
  suggestedReplyBy,
  venueLabel,
  type CallView,
  type CertificateKind,
  type CommandInput,
  type JobStep,
  type JobView,
  type PersonView,
  type PhaseOnCalendar,
  type PhaseView,
  type ProjectStatus,
  type View,
  stoppedCrew,
} from '@sh/shared'
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { refuseField } from '../required.ts'
import { NeedsField } from '../crew/Certificates.tsx'
import { RoleField } from '../crew/RoleField.tsx'
import { CallCard, peopleOn, promptFor, SharePanelFor, type Made, type Share } from '../crew/CrewScreen.tsx'
import { TellHere } from '../crew/Messages.tsx'
import { Empty } from '../Empty.tsx'
import { Fold } from '../Fold.tsx'
import { Pending } from '../StatusPill.tsx'
import { DepartmentField } from '../crew/Department.tsx'
import { useReach } from '../crew/reach.tsx'
import { Tabs } from '../Tabs.tsx'
import { useAccess, useSeesRates } from '../role.ts'
import { client } from '../sync.ts'
import { useToday, useView } from '../view.ts'
import { ClientField, clientNamed, NewOrNear, JobStatusPill, Page, VenueField, venueNamed } from './common.tsx'
import { KitCard, kitSummary } from './Kit.tsx'
import { VansCard } from './Vans.tsx'
import { QuotePart } from './Quote.tsx'
import { ShowPackCard } from './ShowPack.tsx'
import { JobPosition } from './JobPosition.tsx'
import { NextDock, type Landing } from './NextDock.tsx'
import { JobAssignee } from './JobAssignee.tsx'
import { crewToCall, makeCallsFromQuote } from './crewFromQuote.ts'
import { askForCrewAgain, type CrewAgain } from './crewAgain.ts'
import { confirmQuestion, crewOnJob, holdingTheDay, stopQuestion } from './jobStatus.ts'
import { YouOnThisJob } from './YouOnThisJob.tsx'
import { CancelJob } from './CancelJob.tsx'
import { StepsCard } from './Steps.tsx'
import { useMe } from '../crew/Leave.tsx'
import { Heading } from '../Icon.tsx'
import { useMyDepartment } from '../Narrowed.tsx'
import { glideTo } from '../glide.ts'
import { landOnCall } from '../crew/landOnCall.ts'
import { showToast } from '../notices.ts'
import { landOn } from '../places.ts'
import { JOBS } from '../Up.tsx'

/**
 * One job: what it is, the stage it's in and the tasks inside it, who each
 * is down to (ADR 0073, ADR 0104), its one Next button in the page head,
 * then its parts one at a time (a tab each), in the order the job goes
 * through them and opening on the one its next task is in (ADR 0140, part
 * 8): its quote, its crew, its kit and vans (ADR 0014, 0047), its phases
 * and how each will read on the calendar, and its show pack. Crew calls made here
 * belong to the job and its phase, so freelancers always see the job's
 * current name, dates and venue. The page has the whole width, with no
 * list beside it: the way up goes back to the list.
 */

export type JobPart = 'phases' | 'crew' | 'kit' | 'vans' | 'pack' | 'quote'
/**
 * In the order the job goes through them (ADR 0140, part 8): sold, crewed, kitted and vanned, then its days and the pack for
 * them. Kit and vans are tabs of their own (1.168.0): the vans were a card under a long kit list, out of sight on a phone.
 */
export const JOB_PARTS: readonly JobPart[] = ['quote', 'crew', 'kit', 'vans', 'phases', 'pack']

const PART_LABELS: Record<JobPart, string> = { phases: 'Phases', crew: 'Crew', kit: 'Kit', vans: 'Transport', pack: 'Show pack', quote: 'Quote' }

/**
 * An errand or a meeting is done in a day, with no quote, show pack or stages (user flows of 13 November 2026, finding 5):
 * its page has only the parts it uses, named for it. A meeting is when and who's going; an errand can take kit and a van too.
 */
const KIND_PARTS: Partial<Record<ProjectKind, readonly JobPart[]>> = { errand: ['phases', 'crew', 'kit', 'vans'], meeting: ['phases', 'crew'] }
const KIND_PART_LABELS: Partial<Record<JobPart, string>> = { phases: 'When', crew: "Who's going" }

/** The part last looked at, so the office moving from job to job to book crew lands on Crew each time ("a fold remembers"). */
const LAST_PART = 'sh.jobPart'

function lastPart(): JobPart | undefined {
  try {
    // The quote's tab was called money until the quote moved onto the job page (ADR 0140, part 4).
    const was = localStorage.getItem(LAST_PART)
    const p = was === 'money' ? 'quote' : was
    return JOB_PARTS.includes(p as JobPart) ? (p as JobPart) : undefined
  } catch {
    return undefined
  }
}

/** The job page's part for where a task's work is done: the pick list's tasks are under Kit, where its link is. */
function partOf(p: 'phases' | 'crew' | 'kit' | 'quote' | 'pick' | undefined): JobPart | undefined {
  return p === 'pick' ? 'kit' : p
}

export function JobScreen({ view, id, part: asked, task: askedTask }: { view: View; id: string; part?: JobPart; task?: JobStep }) {
  const job = view.jobs.jobs.find((j) => j.id === id)
  // An offer to send, or the people to tell after a withdrawal or a stopped job (audit finding 9): one panel at a time.
  const [share, setShare] = useState<Share | undefined>()
  const access = useAccess()
  const seesMoney = access.can('money')
  const runsJobs = access.can('jobs') || access.can('crew') || access.can('kit')
  // A button the role can't use isn't drawn (audit finding 9): phases are the job's, asking for crew is crew's.
  const mayJobs = access.can('jobs')
  const mayCrew = access.can('crew')
  const kindParts = job ? KIND_PARTS[kindOf(job)] : undefined
  const parts = JOB_PARTS.filter((p) => (p !== 'quote' || seesMoney) && (!kindParts || kindParts.includes(p)))
  // The part the address names, else the one picked here, else the last one looked at; a link to another part starts there.
  const [picked, setPicked] = useState<JobPart | undefined>()
  useEffect(() => setPicked(undefined), [asked, askedTask])
  // The task opened on Where it is, from its list or from the Next dock (ADR 0104).
  // Opened from Your tasks on Home, the page opens on that task, not on the job's own next one (audit, 5 November 2026, finding 17),
  // with the task's own part as the tab under it, so what the task is about is the next thing down (UX sweep, 6 November 2026, move 8).
  const [task, setTask] = useState<JobStep | undefined>(askedTask)
  useEffect(() => setTask(askedTask), [id, askedTask])
  // When Next's Confirm the job last opened the Confirmed task with its question asked (ADR 0168); opening a task another way
  // opens it as it is.
  const [confirmAsked, setConfirmAsked] = useState<number>()
  useEffect(() => setConfirmAsked(undefined), [id])
  const openTask = (t: JobStep | undefined) => {
    setTask(t)
    setConfirmAsked(undefined)
  }
  const stepPart = askedTask ? view.steps.of(id)?.steps.find((s) => s.key === askedTask)?.part : undefined
  // With nothing named, the job opens on the part its next task is in (ADR 0140, part 8): the quote while it's being sold, the
  // crew or kit while it's planned, the kit while it goes out and comes back, the phases while it's on. A job with no task left
  // (or no stages) opens where the last one was looked at.
  const nextPart = partOf(view.steps.of(id)?.current?.part)
  const wanted = picked ?? asked ?? parts.find((p) => p === stepPart) ?? parts.find((p) => p === nextPart) ?? lastPart() ?? 'phases'
  const part = parts.includes(wanted) ? wanted : 'phases'
  // An address that names a part of the job, or a task in it, lands on it however it was reached: a row on Home, the planner, Crew or a
  // typed link (UX sweep, 6 November 2026, move 8). A part's tab row comes to the top with the focus on its tab, as Next brings it (ADR
  // 0109); a task's card with the focus on its name. A part this role doesn't see isn't landed on.
  const named = asked && parts.includes(asked) ? asked : undefined
  useEffect(() => {
    if (askedTask)
      landOn(() => {
        const box = document.getElementById('job-step-open')
        const heading = box?.querySelector<HTMLElement>('h3')
        return box && heading ? { top: box, focus: heading } : undefined
      })
    else if (named)
      landOn(() => {
        const tab = document.getElementById(`job-tab-${named}`)
        const row = tab?.closest<HTMLElement>('[role="tablist"]')
        return tab && row ? { top: row, focus: tab } : undefined
      })
  }, [id, askedTask, named])
  const pick = (p: JobPart) => {
    setPicked(p)
    try {
      localStorage.setItem(LAST_PART, p)
    } catch {
      // Storage that's off just doesn't remember.
    }
    // In the address, so a reload or a link keeps the part, without a step in the history: Back still goes up to the list.
    history.replaceState(history.state, '', `#jobs/${encodeURIComponent(id)}/${p}`)
  }
  // Next, or a task's Open, picks a part far down the page: it comes to the top, under the bar, with the focus on its tab, so
  // the press is seen to do something (audit, 5 November 2026, finding 1). A tab picked from the row itself is already in view.
  const [went, setWent] = useState(0)
  // Where Next lands (ADR 0140): "Offer a Rigger" on that call with its picker open, a yes just confirmed on its call, "Sort 1 short"
  // on the kit's Subhire with the short lines ticked, rather than on a tab with the button still to find. Counted, so pressing
  // Next again opens it again.
  const [landing, setLanding] = useState<Landing & { n: number }>()
  const go = (p: JobPart, land?: Landing) => {
    pick(p)
    setWent((n) => n + 1)
    setLanding((was) => (land ? { ...land, n: (was?.n ?? 0) + 1 } : undefined))
  }
  useEffect(() => {
    if (!went) return
    // Glided to, as it's the same page, with the part's card under the tabs marked where it lands (glide.ts); or to the call or the
    // short kit Next named, whose picker or first tick takes the focus.
    const at = landing && document.getElementById('call' in landing ? `call-${landing.call}` : 'short-kit')
    // A call landed on without its Offer (a yes just confirmed) takes the focus on its line, so the count it moved is read out.
    const line = landing && 'call' in landing && !landing.offer ? at?.querySelector<HTMLElement>('.call-line') : undefined
    if (at) return void glideTo(at, { mark: at, focus: line ?? undefined })
    const tab = document.getElementById(`job-tab-${part}`)
    const row = tab?.closest<HTMLElement>('[role="tablist"]')
    const card = document.getElementById('job-part')?.firstElementChild
    if (row && tab) glideTo(row, { focus: tab, mark: card instanceof HTMLElement ? card : undefined })
  }, [went])
  const up = { steps: [JOBS], here: job?.name }
  if (!job)
    return (
      <Page view={view} className="crew jobs job-page" up={up}>
        <section className="card">
          {/* Up to date, a job not here isn't on its way: the address is wrong or the job has gone (audit, 5 November 2026, finding 88). */}
          {view.connection === 'idle' && !view.copying && view.cursor > 0 ? (
            <p className="empty">
              There's no job at this address: it may have been removed, or the address is mistyped. <a href="#jobs">All jobs</a>
            </p>
          ) : (
            <p className="empty">This job isn't on this device. It may still be on its way: check again once it says “Up to date”.</p>
          )}
        </section>
      </Page>
    )
  const onShare = (call: CallView) => (people: PersonView[], made?: Made) => setShare({ kind: 'offer', people, call, ...(made ? { made } : {}) })
  // Sending an offer opens under the calls it's for. People to tell open under the job's details, whichever part is open.
  // Its WhatsApp is plain, as the Next dock holds the page's one filled red (ADR 0104; UX sweep, 6 November 2026, move 1).
  const panel = share && <SharePanelFor share={share} onClose={() => setShare(undefined)} inJob />
  const offerFor = (calls: readonly CallView[]) => share?.kind === 'offer' && calls.some((c) => c.id === share.call.id) && panel
  const telling = share?.kind === 'tell' && panel
  const fill = crewFill(job.calls)
  const steps = view.steps.of(job.id)
  const counts: Partial<Record<JobPart, string>> = {
    phases: job.phases.length ? String(job.phases.length) : undefined,
    crew: fill.needed ? `${fill.booked}/${fill.needed}` : undefined,
    vans: view.vehicles.ofJob(job.id).length ? String(view.vehicles.ofJob(job.id).length) : undefined,
  }

  return (
    <Page
      view={view}
      className="crew jobs job-page"
      up={up}
      heading={job.name}
      // The head's right-hand column, top to bottom on the title's rhythm (ADR 0161): the job's status, level with its name; who
      // has it, changed where it's read; then Next, the one filled button. On a phone Next is docked in the foot, as before.
      corner={
        <>
          <div className="corner-status">
            <JobStatusPill status={job.status} pending={job.pending} />
          </div>
          {steps && (
            <div className="corner-owner">
              <JobAssignee view={view} steps={steps} />
            </div>
          )}
        </>
      }
      // The stage it's in, under its name: the five segments, the stage, and when, with "late" or "short" when it is. What's
      // outstanding is Next's own words, and whose it is the field beside it, so neither is said twice (ADR 0161).
      sub={
        <>
          <JobPosition job={job} view={view} compact />
          <JobLines job={job} view={view} />
        </>
      }
      actions={
        <NextDock
          job={job}
          view={view}
          onPart={go}
          onOpenTask={openTask}
          onTell={setShare}
          onConfirm={() => {
            setTask('confirmed')
            setConfirmAsked(Date.now())
          }}
          quoteHere={part === 'quote'}
          here={part}
        />
      }
    >
      <Summary job={job} view={view} onTell={setShare} />
      {telling}
      {/* What you're on, first for someone whose work on the job is their own booking, under Where it is for whoever runs the job
          (Move 9 of the sweep of 6 November 2026). */}
      {!runsJobs && <YouOnThisJob job={job} view={view} />}
      {/* Where the job is: its five stages, the tasks inside each and who each is down to (ADR 0073, ADR 0104). */}
      <StepsCard job={job} view={view} openTask={task} onOpenTask={openTask} onPart={go} onTell={setShare} confirmAsked={confirmAsked} />
      {runsJobs && <YouOnThisJob job={job} view={view} />}

      {/* The quote's address, typed or kept from before, for a role that doesn't see money: the job opens, saying why there's no
          quote, rather than a tab that silently isn't there (audit, 5 November 2026, finding 87; ADR 0140, part 4). */}
      {asked === 'quote' && !seesMoney && (
        <section className="card" aria-label="Quote">
          <p className="empty">Quotes and prices are for the office and directors. A director can change your role on the Crew tab.</p>
        </section>
      )}
      <Tabs label="Parts of the job" id="job" parts={parts} labels={kindParts ? { ...PART_LABELS, ...KIND_PART_LABELS } : PART_LABELS} current={part} counts={counts} onPick={pick} />
      <div className="job-part" role="tabpanel" id="job-part" aria-labelledby={`job-tab-${part}`}>
        {part === 'phases' && (
          <section className="card" aria-label="Phases">
            <Heading icon="time">Phases</Heading>
            {job.phases.length === 0 && <Empty>{mayJobs && 'Add the first phase below, so the job has dates.'}</Empty>}
            {job.phases.map((p) => (
              <Phase key={p.id} job={job} phase={p} view={view} onTell={setShare} onCrew={() => go('crew')} mayChange={mayJobs} />
            ))}
            {mayJobs && (
              <Fold label="Add phase">
                <AddPhase job={job} />
              </Fold>
            )}
          </section>
        )}

        {part === 'crew' && (
          <CrewPart
            job={job}
            view={view}
            onShare={onShare}
            onTell={setShare}
            offerFor={offerFor}
            mayCrew={mayCrew}
            offering={landing && 'call' in landing && landing.offer ? { id: landing.call, n: landing.n } : undefined}
            answering={landing && 'call' in landing && landing.answer ? { id: landing.call, n: landing.n } : undefined}
            onAgain={(call) => go('crew', { call, offer: true })}
          />
        )}

        {part === 'kit' && (
          <>
            <SettleKit job={job} view={view} />
            <KitCard job={job} view={view} subhireOpened={landing && 'short' in landing ? landing.n : undefined} />
          </>
        )}

        {part === 'vans' && <VansCard job={job} view={view} />}

        {/* The files for the on-site box (ADR 0045), once there's a phase to have a crew and a running order. */}
        {part === 'pack' &&
          (job.phases.length > 0 ? (
            <ShowPackCard view={view} job={job} />
          ) : (
            <section className="card" aria-label="Show pack">
              <Heading icon="download">Show pack</Heading>
              <Empty>Add a phase first: the pack is the crew and running order of a phase.</Empty>
            </section>
          ))}

        {/* Its quote, built from the kit and crew, for the roles that see money (ADR 0042): the quote itself, worked on here as the
            job's Quoting stage rather than on a page of its own (ADR 0140, part 4). */}
        {/* Confirming the job or marking it lost from the quote ends the card it's pressed on, so who was told opens here (ADR 0168). */}
        {part === 'quote' && seesMoney && (
          <TellHere.Provider value={setShare}>
            <QuotePart job={job} view={view} />
          </TellHere.Provider>
        )}
      </div>
      {/* Who changed what on this job, without reading the whole company's history (audit, 5 November 2026, finding 51). */}
      <p className="hint page-foot">
        <a href={`#history/job/${job.id}`}>History of this job</a>
      </p>
    </Page>
  )
}

/**
 * The job's crew: the calls of each phase under its name, then those
 * across phases, then asking for more. An offer being sent opens under
 * the calls it's for. A head of department's own calls come first, under
 * their department's name, so the one that's theirs isn't the fifth of
 * seven (Move 3 of the sweep of 6 November 2026).
 */
function CrewPart({
  job,
  view,
  onShare,
  onTell,
  offerFor,
  mayCrew,
  offering,
  answering,
  onAgain,
}: {
  job: JobView
  view: View
  onShare: (c: CallView) => (people: PersonView[], made?: Made) => void
  onTell: (share: Share | undefined) => void
  offerFor: (calls: readonly CallView[]) => ReactNode
  mayCrew: boolean
  /** The call whose Offer the Next button opened, and how many times. */
  offering?: { id: string; n: number }
  /** The call Next landed on to answer a yes or a rate, whose rows open (ADR 0152). */
  answering?: { id: string; n: number }
  /** Its calls cancelled with the job asked for again: lands on this one with its Offer open (ADR 0164). */
  onAgain: (callId: string) => void
}) {
  const stopped = STOPPED.includes(job.status)
  // How many roles Add a role has added: each closes its form (Fold's shut).
  const [added, setAdded] = useState(0)
  // Going again, with calls cancelled along with it last time it stopped (ADR 0164): asked for again from here.
  const today = useToday()
  const again = !stopped && mayCrew ? stoppedCrew(job.calls, today) : undefined
  const department = useMyDepartment()
  const theirs = (c: CallView) => sameDepartment(departmentOf(c), department)
  const mine = job.calls.filter(theirs)
  const others = (calls: readonly CallView[]) => calls.filter((c) => !theirs(c))
  const across = others(job.otherCalls)
  const card = (c: CallView, phase?: PhaseView) => (
    <CallCard
      key={c.id}
      call={c}
      crew={view.crew}
      late={view.late}
      onShare={onShare(c)}
      onTell={onTell}
      inJob
      offerOpened={offering?.id === c.id ? offering.n : undefined}
      rowsOpened={answering?.id === c.id ? answering.n : undefined}
      phaseDays={phase ? c.start === phase.start && c.end === phase.end : undefined}
      // Theirs are away from their phases, first, so each says its phase.
      phaseNamed={theirs(c)}
    />
  )
  /** The calls asked for on days outside their phase's, each said over the calls. */
  const outside = (calls: readonly CallView[]) =>
    calls.flatMap((c) => {
      const phase = job.phases.find((p) => p.id === c.phaseId)
      return phase && c.status === 'open' && (c.start < phase.start || c.end > phase.end)
        ? [
            <p className="warn-line" key={c.id}>
              The {c.role} crew are asked for {daysLabel(c.days)}, outside {phase.name}.
            </p>,
          ]
        : []
    })
  return (
    <>
      {again && <CrewAgainCard again={again} onAgain={onAgain} />}
      {mine.length > 0 && (
        <>
          <section className="card" aria-label={`${department} crew`}>
            <Heading icon="people">{department} crew</Heading>
            {outside(mine)}
            {mine.map((c) => card(c))}
          </section>
          {offerFor(mine)}
        </>
      )}
      {job.phases
        .filter((p) => others(p.calls).length > 0)
        .map((phase) => {
          const calls = others(phase.calls)
          return (
            <Fragment key={phase.id}>
              {/* Named for its phase, as the phase is on Phases: one part is open at a time. */}
              <article className="card" aria-label={phase.name}>
                <Heading icon="people">{phase.name}</Heading>
                <p className="hint">{spanLabel(phase)}</p>
                {outside(calls)}
                {calls.map((c) => card(c, phase))}
              </article>
              {offerFor(calls)}
            </Fragment>
          )
        })}
      {across.length > 0 && (
        <>
          <section className="card" aria-label="Crew across phases">
            <Heading icon="people">Across phases</Heading>
            {across.map((c) => card(c))}
          </section>
          {offerFor(across)}
        </>
      )}
      {/* Asking for more: last, under the calls it adds to; nothing for a role that can't ask, once there are calls to see. */}
      {(mayCrew || job.calls.length === 0) && (
        <section className="card" aria-label={job.calls.length ? 'More roles' : 'Crew'}>
          <Heading icon="add">{job.calls.length ? 'More roles' : 'Crew'}</Heading>
          {stopped ? (
            <p className="empty">This job is {job.status === 'lost' ? 'lost' : 'cancelled'}, so it needs no crew.</p>
          ) : job.calls.length === 0 && !mayCrew ? (
            <p className="empty">No roles added yet.</p>
          ) : !job.span ? (
            <p className="empty">Add a phase first: roles are added by phase and day.</p>
          ) : (
            <>
              {/* The quote's crew are the calls cancelled with the job while those can be asked for again (ADR 0164). */}
              {!again && <CrewFromQuote job={job} view={view} />}
              {job.calls.length === 0 && <p className="hint">No roles yet. Add the roles this job needs first; then offer each one to people from its card.</p>}
              {/* Added, the form closes and the page glides to the new call's card, where Offer… is (13 November 2026). */}
              <Fold label="Add a role" shut={added}>
                <AskForCrew
                  job={job}
                  onAdded={(callId) => {
                    setAdded((n) => n + 1)
                    landOnCall(callId)
                  }}
                />
              </Fold>
            </>
          )}
        </section>
      )}
    </>
  )
}

/**
 * A job going again whose crew calls were cancelled along with it (ADR 0164; audit of 12 November 2026, finding 19): what
 * was cancelled, when and who was on it, and one press to ask for the same crew again, as the job's Next button does. The
 * page's one filled button stays Next's (ADR 0104).
 */
function CrewAgainCard({ again, onAgain }: { again: CrewAgain; onAgain: (callId: string) => void }) {
  const today = useToday()
  const { run, error } = useAct()
  const names = [...new Set(again.calls.flatMap((c) => c.people.map((p) => p.name)))]
  const words = crewAgainWords(
    again.calls.map((c) => c.call),
    names,
    again.on,
    today
  )
  const ask = () => {
    let first: string | undefined
    void run(async () => {
      first = await askForCrewAgain(again)
    }).then((ok) => ok && first && onAgain(first))
  }
  return (
    <section className="card" aria-label="Cancelled with the job">
      <Heading icon="people">Cancelled with the job</Heading>
      <p>{words.said}</p>
      <p className="hint">{words.then}</p>
      <Refusal error={error} />
      <button type="button" onClick={ask}>
        Ask same crew again
      </button>
    </section>
  )
}

/**
 * Under the job's name, in two lines rather than a card of facts (ADR 0082),
 * so its parts are on the first screen: who it's for, where and when; then
 * how its crew and kit stand.
 */
function JobLines({ job, view }: { job: JobView; view: View }) {
  const crew = crewFill(job.calls)
  // A head's own department's first, beside the whole job's (Move 3 of the sweep of 6 November 2026): "LX 0 of 1 · all 5 of 10".
  const department = useMyDepartment()
  const theirs = crewFill(job.calls.filter((c) => sameDepartment(departmentOf(c), department)))
  const kit = kitSummary(job, view.kit.byJob.get(job.id) ?? [])
  const prep = view.steps.of(job.id)?.steps.find((s) => s.key === 'prep')
  const out = prep?.facts.of ? ` · ${prep.facts.out} of ${prep.facts.of} out` : ''
  const mayPick = useAccess().can('stock')
  // The facts of the job as labelled cells, on the system's facts list (the label over the value), rather than one long dotted line:
  // the eye finds the venue or the dates by their label without reading the rest (Colly, 1 November 2026).
  return (
    <dl className="facts job-facts">
      <div>
        <dt>Client</dt>
        <dd>{job.client ? <a href={`#jobs/clients/${encodeURIComponent(job.client.id)}`}>{job.client.name}</a> : <span className="muted">None yet</span>}</dd>
      </div>
      <div>
        <dt>Venue</dt>
        <dd>
          {job.venue ? (
            <>
              <a href={`#jobs/venues/${encodeURIComponent(job.venue.id)}`}>{venueLabel(job.venue)}</a>{' '}
              <a className="muted" href={mapLink(job.venue)} target="_blank" rel="noreferrer">
                (map)
              </a>
            </>
          ) : (
            <span className="muted">None yet</span>
          )}
        </dd>
      </div>
      <div>
        <dt>{kindOf(job) === 'gig' ? 'When' : KIND_LABELS[kindOf(job)]}</dt>
        <dd>{job.span ? spanLabel(job.span) : <span className="muted">No dates yet</span>}</dd>
      </div>
      {crew.needed > 0 && (
        <div>
          <dt>Crew</dt>
          <dd>
            {theirs.needed > 0
              ? `${department} ${theirs.booked} of ${theirs.needed}${theirs.toConfirm > 0 ? `, ${theirs.toConfirm} to confirm` : ''} · all ${crew.booked} of ${crew.needed}`
              : `${crew.booked} of ${crew.needed} booked${crew.toConfirm > 0 ? `, ${crew.toConfirm} to confirm` : ''}`}
          </dd>
        </div>
      )}
      {kit && (
        <div>
          <dt>Kit</dt>
          {/* How far the pick has got, and the pick list a tap away for whoever picks (Move 8 of the sweep of 6 November 2026). */}
          <dd>{mayPick && !STOPPED.includes(job.status) ? <a href={`#jobs/${encodeURIComponent(job.id)}/pick`}>{kit + out}</a> : kit + out}</dd>
        </div>
      )}
    </dl>
  )
}

/**
 * The job's notes, each saying who reads it (ADR 0151): the crew's, the office's own, and the venue's; and changing its
 * details, under its name.
 */
function Summary({ job, view, onTell }: { job: JobView; view: View; onTell: (share: Share | undefined) => void }) {
  const [editing, setEditing] = useState(false)
  const mayChange = useAccess().can('jobs')
  if (!editing && !job.notes && !job.officeNotes && !job.venue?.notes && !mayChange) return null
  return (
    <section className={editing ? 'card' : 'job-notes'} aria-label="Details">
      {job.notes && <p className="notes">For the crew: {job.notes}</p>}
      {job.officeNotes && <p className="notes">Office notes: {job.officeNotes}</p>}
      {job.venue?.notes && <p className="notes">At the venue: {job.venue.notes}</p>}
      {editing ? (
        <EditJob job={job} view={view} onDone={() => setEditing(false)} onTell={onTell} />
      ) : (
        mayChange && (
          <div className="actions">
            <button type="button" onClick={() => setEditing(true)}>
              Change details
            </button>
            <CancelJob job={job} onTell={onTell} />
          </div>
        )
      )}
    </section>
  )
}

/** Only what was changed is sent, so someone else's change to another detail stands (ADR 0007). */
function EditJob({ job, view, onDone, onTell }: { job: JobView; view: View; onDone: () => void; onTell: (share: Share | undefined) => void }) {
  const { clients, venues } = view.jobs
  const [f, setF] = useState({
    name: job.name,
    client: job.client?.name ?? '',
    venue: job.venue?.name ?? '',
    status: job.status,
    kind: kindOf(job),
    notes: job.notes,
    officeNotes: job.officeNotes ?? '',
  })
  // Stopping a job with crew out, or confirming one its crew hold the day for, waits here until the office says so, with the
  // fields held still.
  const [asking, setAsking] = useState(false)
  const { run, error } = useAct()
  const reach = useReach()
  const today = useToday()
  const stopping = STOPPED.includes(f.status) && !STOPPED.includes(job.status)
  // Everyone offered or booked on the job's open calls: told it's off once it's stopped.
  const people = crewOnJob(job)
  // Confirmed with crew asked to hold the day: they hear it's going ahead, and those picked are booked (ADR 0168).
  const confirming = f.status === 'confirmed' && job.status !== 'confirmed'
  const holding = confirming ? holdingTheDay(job, today) : []
  const confirmAsk = confirmQuestion(reach, job, holding)
  const send = () => {
    setAsking(false)
    void run(async () => {
      const changes: CommandInput<'project.update'> = { id: job.id }
      if (f.name.trim() !== job.name) changes.name = f.name.trim()
      if (f.status !== job.status) changes.status = f.status
      if (f.kind !== kindOf(job)) changes.kind = f.kind
      if (f.notes.trim() !== job.notes) changes.notes = f.notes.trim()
      if (f.officeNotes.trim() !== (job.officeNotes ?? '')) changes.officeNotes = f.officeNotes.trim()
      const clientId = await clientNamed(f.client, clients)
      if (clientId !== job.clientId) changes.clientId = clientId
      const venueId = await venueNamed(f.venue, venues)
      if (venueId !== job.venueId) changes.venueId = venueId
      if (Object.keys(changes).length > 1) await client.mutate('project.update', changes)
    }).then((ok) => {
      if (!ok) return
      onDone()
      if (stopping) onTell(promptFor('job-stopped', people))
      else if (confirming) onTell(promptFor('job-confirmed', holding))
    })
  }
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return
    if ((stopping && job.calls.some((c) => c.status === 'open')) || (confirming && confirmAsk)) return setAsking(true)
    send()
  }
  return (
    <form className="grid-form" onSubmit={save}>
      <label className="wide">
        Job <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required disabled={asking} />
      </label>
      <ClientField jobs={view.jobs} value={f.client} onChange={(client) => setF((now) => ({ ...now, client }))} disabled={asking} />
      <NewOrNear value={f.client} names={clients} what="client" onPick={(n) => setF({ ...f, client: n })} />
      <VenueField jobs={view.jobs} value={f.venue} onChange={(venue) => setF((now) => ({ ...now, venue }))} disabled={asking} />
      <NewOrNear value={f.venue} names={venues} what="venue" onPick={(n) => setF({ ...f, venue: n })} />
      <label className="wide">
        Status
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectStatus })} disabled={asking}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="wide">
        Kind
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ProjectKind })} disabled={asking}>
          {PROJECT_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {/* Who reads each, said where it's typed (ADR 0151, audit of 12 November 2026, finding 2): an email can't be unsent. */}
      <label className="wide">
        Notes for the crew{' '}
        <textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} aria-describedby={`crew-notes-${job.id}`} disabled={asking} />
      </label>
      <p className="hint wide" id={`crew-notes-${job.id}`}>
        {CREW_NOTES_HINT}
      </p>
      <label className="wide">
        Office notes{' '}
        <textarea
          rows={3}
          value={f.officeNotes}
          onChange={(e) => setF({ ...f, officeNotes: e.target.value })}
          aria-describedby={`office-notes-${job.id}`}
          disabled={asking}
        />
      </label>
      <p className="hint wide" id={`office-notes-${job.id}`}>
        Only in the app, for the office: never on the calendar, a call sheet or a message.
      </p>
      <Refusal error={error} className="wide" />
      {asking && stopping ? (
        <Confirm
          className="wide"
          // With the email Google sends those who hold an invite (ADR 0149).
          question={stopQuestion(reach, job, f.status === 'lost' ? 'lost' : 'cancelled', people)}
          yes={`Mark it ${STATUS_LABELS[f.status].toLowerCase()}`}
          loss
          no="Keep it as it is"
          onYes={send}
          onNo={() => setAsking(false)}
        />
      ) : asking && confirmAsk ? (
        // What confirming sends those asked to hold the day, said first (ADR 0168): HOLD comes off their days, and WhatsApp tells them.
        <Confirm className="wide" question={confirmAsk} yes="Confirm job" no="Keep it as it is" onYes={send} onNo={() => setAsking(false)} />
      ) : (
        <div className="actions wide">
          {/* Plain: the Next dock holds the job page's one filled red (ADR 0104; UX sweep, 6 November 2026, move 1). */}
          <button type="submit">
            Save job
          </button>
          <button type="button" onClick={onDone}>
            Cancel
          </button>
        </div>
      )}
    </form>
  )
}

/** Where a job's or a phase's notes for the crew go (ADR 0151), under the box they're typed in. */
const CREW_NOTES_HINT = "On the call sheet and the jobs calendar, and in each person's invite once they've said yes."

/** "“Nissan - Build 1/2” and “Nissan - Build 2/2”"; a long phase gives its first and last. Only the days from `from` on, when given. */
function titlesLine(job: string, p: PhaseView, from = '', hold = false) {
  const days = eachDay(p.start, p.end)
  const titles = calendarTitles(job, p)
    .map((t) => (hold ? holdTitle(t) : t))
    .filter((_, i) => days[i]! >= from)
    .map((t) => `“${t}”`)
  if (titles.length === 1) return titles[0]
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`
  return `${titles[0]} to ${titles.at(-1)}`
}

/** How a phase stands with Google Calendar (ADR 0008), in a line. */
function CalendarLine({ job, phase, on, today }: { job: JobView; phase: PhaseView; on: PhaseOnCalendar; today: string }) {
  const hold = onHold(job, crewAsked(job.calls))
  switch (on.state) {
    case 'theirs':
      return <p className="cal">Brought in from {on.calendar}, which keeps its days, so the app doesn't add them to the jobs calendar.</p>
    case 'waiting':
      return (
        <p className="cal">
          Goes on the calendar as {titlesLine(job.name, phase)} once the job is confirmed, or marked HOLD as soon as crew are added to it.
        </p>
      )
    case 'stopped':
      return <p className="cal">Not on the calendar: the job is {job.status}.</p>
    case 'past':
      return <p className="cal">Over, so the calendar keeps it as it was.</p>
    case 'unconnected':
      return <p className="cal">Goes on the calendar as {titlesLine(job.name, phase, today, hold)} once one is connected in Admin.</p>
    case 'paused':
      return <p className="warn-line">Not being updated on the calendar: it needs connecting again in Admin.</p>
    case 'going':
      return (
        <p className="cal">
          Going on {on.calendar} as {titlesLine(job.name, phase, today, hold)}…
        </p>
      )
    case 'on':
      return (
        <p className="cal">
          On {on.calendar} as {titlesLine(job.name, phase, today, hold)}.
          {hold && ' HOLD is short for hold the day, and comes off once the job is confirmed.'}
          {on.link && (
            <>
              {' '}
              <a href={on.link} target="_blank" rel="noreferrer">
                Open it
              </a>
            </>
          )}
        </p>
      )
    case 'failed':
      return (
        <p className="warn-line">
          {on.failed === on.days ? phase.name : `${on.failed} of its ${on.days} days`} couldn't go on {on.calendar}. {on.problem}
        </p>
      )
  }
}

function Phase({
  job,
  phase,
  view,
  onTell,
  onCrew,
  mayChange,
}: {
  job: JobView
  phase: PhaseView
  view: View
  onTell: (share: Share | undefined) => void
  /** Opens the job's Crew, where this phase's calls are. */
  onCrew: () => void
  mayChange: boolean
}) {
  const [editing, setEditing] = useState(false)
  const today = useToday()
  const fill = crewFill(phase.calls)
  const local = phase.localCrew ?? 0
  const ownVenue = phase.venueId && phase.venueId !== job.venueId ? phase.venue : undefined
  const contact = phase.contactId ? view.crew.people.find((p) => p.id === phase.contactId) : undefined
  const on = phaseOnCalendar(job, phase, view.calendar.link, view.calendar.days, today, crewAsked(job.calls))
  // A calendar line to act on stays in view; the rest of the phase's details wait behind a tap (audit finding 16).
  const calendarWarns = on.state === 'paused' || on.state === 'failed'
  return (
    <article className="phase" aria-label={phase.name}>
      <header>
        <div>
          <b>{phase.name}</b> <span className="muted">{spanLabel(phase)}</span>
          {ownVenue && <p>At {venueLabel(ownVenue)}</p>}
        </div>
        {/* A phase still waiting to sync can be changed too: the change waits behind it, in order. */}
        <div className="actions">
          <Pending pending={phase.pending} />
          {mayChange && (
            <button type="button" className="link" onClick={() => setEditing(!editing)} aria-expanded={editing}>
              Change
            </button>
          )}
        </div>
      </header>
      {calendarWarns && <CalendarLine job={job} phase={phase} on={on} today={today} />}
      <details className="phase-details">
        <summary>{phase.notes ? 'Running order, call sheet, calendar' : 'Call sheet and calendar'}</summary>
        <div>
          {phase.notes && <p className="notes">{phase.notes}</p>}
          {!calendarWarns && <CalendarLine job={job} phase={phase} on={on} today={today} />}
          <div className="pick-link">
            <a className="button" href={`#jobs/${job.id}/sheet/${phase.id}`}>
              Call sheet
            </a>
            <span>{contact ? `Contact on the day: ${contact.name}` : 'No contact on the day yet'}</span>
          </div>
        </div>
      </details>
      {editing && mayChange && <EditPhase phase={phase} view={view} onDone={() => setEditing(false)} onTell={onTell} />}
      {/* Its calls are under Crew; here, how they stand, a tap from them. */}
      {/* Local crew are the venue's or the client's, so they're only a count here and never a call. */}
      {(fill.needed > 0 || local > 0) && (
        <p className="phase-crew">
          {fill.needed > 0 && (
            <button type="button" className="link" onClick={onCrew}>
              Crew: {fill.booked} of {fill.needed} booked{fill.toConfirm > 0 && `, ${fill.toConfirm} to confirm`}
            </button>
          )}
          {fill.needed > 0 && local > 0 && ' · '}
          {local > 0 && <span>Local crew: {local}</span>}
        </p>
      )}
    </article>
  )
}

function EditPhase({ phase, view, onDone, onTell }: { phase: PhaseView; view: View; onDone: () => void; onTell: (share: Share | undefined) => void }) {
  const { venues } = view.jobs
  const [f, setF] = useState({ name: phase.name, start: phase.start, end: phase.end, venue: phase.venueId ? (phase.venue?.name ?? '') : '', notes: phase.notes, localCrew: String(phase.localCrew ?? 0) })
  // A change of dates to a phase with crew waits here until the office says whether the crew move too.
  const [ask, setAsk] = useState<CommandInput<'phase.update'> | undefined>()
  const [removing, setRemoving] = useState(false)
  const { run, error, refuse } = useAct()
  const openCalls = phase.calls.filter((c) => c.status === 'open')
  // Everyone on the phase's open calls, with the days the move gives each call. Their own days move with it, so the message gives the call's and the page has the rest.
  const movedPeople = (changes: CommandInput<'phase.update'>) => {
    const to = { start: changes.start ?? phase.start, end: changes.end ?? phase.end }
    return openCalls.flatMap((c) => {
      const span = movedCallSpan(c, phase, to)
      return peopleOn({ ...c, ...span, days: eachDay(span.start, span.end) }).map((t) => ({ ...t, context: { ...t.context, days: undefined } }))
    })
  }
  // The days keeping their dates would leave outside the phase that are inside it now: a call is for its phase's days (ADR 0159),
  // so then they move with it, and the question says why there's no keeping them.
  const leftOut = (changes: CommandInput<'phase.update'>) => {
    const to = { start: changes.start ?? phase.start, end: changes.end ?? phase.end }
    const days = openCalls.flatMap((c) => {
      const was = daysOffPhase(c, phase)
      return daysOffPhase(c, to).filter((d) => !was.includes(d))
    })
    return [...new Set(days)].sort()
  }
  const stranded = ask ? leftOut(ask) : []
  const today = useToday()
  const send = (changes: CommandInput<'phase.update'>) =>
    void run(() => client.mutate('phase.update', changes)).then((ok) => {
      if (!ok) return
      onDone()
      if (changes.moveCrew) onTell(promptFor('phase-moved', movedPeople(changes)))
    })
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return
    let asking = false
    void run(async () => {
      const changes: CommandInput<'phase.update'> = { id: phase.id }
      if (f.name.trim() !== phase.name) changes.name = f.name.trim()
      if (f.start !== phase.start) changes.start = f.start
      if (f.end !== phase.end) changes.end = f.end < f.start ? f.start : f.end
      if (f.notes.trim() !== phase.notes) changes.notes = f.notes.trim()
      // Left empty, it's none.
      const localCrew = f.localCrew.trim() === '' ? 0 : Number(f.localCrew)
      if (localCrew !== (phase.localCrew ?? 0)) changes.localCrew = localCrew
      const venueId = await venueNamed(f.venue, venues)
      if (venueId !== phase.venueId) changes.venueId = venueId
      if (Object.keys(changes).length === 1) return
      // A phase that only grows hasn't moved, so its crew stay on their days and there's nothing to ask.
      const to = { start: changes.start ?? phase.start, end: changes.end ?? phase.end }
      if ((changes.start !== undefined || changes.end !== undefined) && openCalls.length && !phaseOnlyGrew(phase, to)) {
        asking = true
        setAsk(changes)
        return
      }
      await client.mutate('phase.update', changes)
    }).then((ok) => ok && !asking && onDone())
  }
  const remove = () => {
    if (phase.calls.some((c) => c.status === 'open')) return refuse(`${phase.name} still has crew. Cancel its crew calls first.`)
    const kit = view.kit.lines.filter((l) => l.phaseId === phase.id)
    if (kit.length) return refuse(`${phase.name} still has kit. Put it on the whole job or take it off first.`)
    setRemoving(true)
  }
  const held = !!ask || removing
  return (
    <form className="grid-form" onSubmit={save}>
      {/* While a question is open, the fields hold still: Move them and Keep their dates send what Save captured. */}
      <label className="wide">
        Phase <input list="phase-names-edit" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required disabled={held} />
      </label>
      <label>
        From{' '}
        <input
          type="date"
          value={f.start}
          onChange={(e) => setF({ ...f, start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end })}
          disabled={held}
        />
      </label>
      <label>
        To <input type="date" value={f.end} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} disabled={held} />
      </label>
      <VenueField jobs={view.jobs} className="wide" value={f.venue} onChange={(venue) => setF((now) => ({ ...now, venue }))} placeholder="The job's venue" disabled={held} />
      {!held && <NewOrNear value={f.venue} names={venues} what="venue" onPick={(n) => setF({ ...f, venue: n })} />}
      <label>
        Local crew{' '}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_LOCAL_CREW}
          step={1}
          value={f.localCrew}
          onChange={(e) => setF({ ...f, localCrew: e.target.value })}
          aria-describedby={`local-crew-${phase.id}`}
          disabled={held}
        />
      </label>
      <p className="muted" id={`local-crew-${phase.id}`}>
        How many the venue or client brings.
      </p>
      <label className="wide">
        Notes for the crew{' '}
        <textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} aria-describedby={`crew-notes-${phase.id}`} disabled={held} />
      </label>
      <p className="hint wide" id={`crew-notes-${phase.id}`}>
        {CREW_NOTES_HINT}
      </p>
      {ask &&
        (stranded.length ? (
          <p className="warn-line wide" role="status">
            {openCalls.length === 1 ? 'Its crew call moves' : `Its ${openCalls.length} crew calls move`} with it, as {daysLabel(stranded, today)} won't be one of its
            days. The days {openCalls.length === 1 ? 'its' : 'their'} crew hold move too.
          </p>
        ) : (
          <p className="warn-line wide" role="status">
            Move its {openCalls.length} crew call{openCalls.length === 1 ? '' : 's'} too? The days their crew hold move with them.
          </p>
        ))}
      <Refusal error={error} className="wide" />
      {removing && (
        <Confirm
          className="wide"
          question={`Remove ${phase.name}? Its days come off the job and the calendar.`}
          yes="Remove it"
          loss
          onYes={() => {
            setRemoving(false)
            void run(() => client.mutate('phase.remove', { id: phase.id })).then((ok) => ok && onDone())
          }}
          onNo={() => setRemoving(false)}
        />
      )}
      {/* Plain, the question's yes and the Save alike: the Next dock holds the job page's one filled red (ADR 0104; UX sweep, 6 November 2026, move 1). */}
      <div className="actions wide" hidden={removing}>
        {ask ? (
          <>
            <button type="button" onClick={() => send({ ...ask, moveCrew: true })}>
              Move them
            </button>
            {!stranded.length && (
              <button type="button" onClick={() => send(ask)}>
                Keep their dates
              </button>
            )}
            <button type="button" className="link" onClick={() => setAsk(undefined)}>
              Back
            </button>
          </>
        ) : (
          <>
            <button type="submit">
              Save phase
            </button>
            <button type="button" onClick={onDone}>
              Cancel
            </button>
            <button type="button" className="link" onClick={remove}>
              Remove phase
            </button>
          </>
        )}
      </div>
      <datalist id="phase-names-edit">
        {PHASE_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </form>
  )
}

function AddPhase({ job }: { job: JobView }) {
  const last = job.phases.at(-1)
  const today = useToday()
  const start = last?.end ?? today
  const [f, setF] = useState({ name: '', start, end: start })
  const [added, setAdded] = useState('')
  const { run, error } = useAct()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return
    const end = f.end < f.start ? f.start : f.end
    // Ready for the next phase, starting where this one ends; a refusal brings what was typed back, unless the next thing has been typed since.
    const cleared = { name: '', start: f.end, end: f.end }
    setF(cleared)
    void run(() =>
      client.mutate('phase.add', { id: newId(), projectId: job.id, name: f.name.trim(), start: f.start, end, venueId: null, notes: '' })
    ).then((ok) => {
      // Said where it was added: on a phone the new phase lands above, out of sight.
      if (ok) setAdded(`Added ${f.name.trim()}, ${spanLabel({ start: f.start, end })}.`)
      else setF((now) => (now === cleared ? f : now))
    })
  }
  return (
    <form className="grid-form add-phase" onSubmit={submit} aria-label="Add a phase">
      <label className="wide">
        New phase <input list="phase-names-add" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Build" required />
      </label>
      <div className="pair">
        <label>
          From <input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end })} />
        </label>
        <label>
          To <input type="date" value={f.end} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} />
        </label>
      </div>
      <Refusal error={error} className="wide" />
      {added && !error && (
        <p className="added wide" role="status">
          {added}
        </p>
      )}
      <button type="submit" className="wide">
        Add phase
      </button>
      <datalist id="phase-names-add">
        {PHASE_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </form>
  )
}

/**
 * Kit and vans settled (ADR 0140): the one task the app can't tell is done by itself, ticked where the kit is, so the job's
 * Next button, "Settle the kit and vans", lands on something that settles it. Shown while the task is open with kit on the
 * job and none of it short; short kit is sorted first, on the card under it.
 */
function SettleKit({ job, view }: { job: JobView; view: View }) {
  const access = useAccess()
  const { me } = useMe(view)
  const { run, error } = useAct()
  const step = view.steps.of(job.id)?.steps.find((s) => s.key === 'kit')
  const mayTick = access.can('steps') && (access.role !== 'crew' || (!!access.personId && step?.ownerId === access.personId))
  if (!step || step.done || step.skipped || !mayTick || job.status !== 'confirmed' || step.facts.nothingYet || step.facts.short) return null
  return (
    <section className="card settle-kit" aria-label="Ready to pick">
      <p>
        <b>Is the kit list final?</b> Once the kit and vans are as they'll go, mark it settled: the job moves on to picking.
      </p>
      <Refusal error={error} />
      <button type="button" onClick={() => void run(() => client.mutate('jobStep.set', { projectId: job.id, step: 'kit', done: true, by: me?.id ?? null }))}>
        The kit and vans are settled
      </button>
    </section>
  )
}

/** The crew on the job's quote not asked for yet (ADR 0126), made calls in one press here or from the job's Next button (ADR 0140). */
function CrewFromQuote({ job, view }: { job: JobView; view: View }) {
  const { run, error } = useAct()
  const today = useToday()
  const toMake = crewToCall(view, job)
  if (!toMake.length || !job.span) return null
  const only = job.phases.length === 1 ? job.phases[0] : undefined
  const make = () => makeCallsFromQuote(view, job, today)
  return (
    <div className="kit-from-quote" role="group" aria-label="Crew on the quote">
      <p>
        {job.calls.length ? 'On the quote but not added yet: ' : 'The quote has crew to add: '}
        {toMake.map((c) => `${c.needed} × ${c.role}`).join(', ')}.
      </p>
      <Refusal error={error} />
      <button type="button" className="secondary" onClick={() => void run(make)}>
        {toMake.length === 1 ? 'Make call' : `Make ${toMake.length} calls`}
      </button>
      <p className="hint">For {only ? only.name : "the job's days"}, with nobody offered yet. Change the days, time or rate on each after.</p>
    </div>
  )
}

/** A role the job needs, for one phase or across several: a crew call added to the job, offered to people later from its card. */
function AskForCrew({ job, onAdded }: { job: JobView; onAdded: (callId: string) => void }) {
  // The reply-by day is suggested from the first day until the office types or clears it (audit finding 21).
  const blank = {
    phaseId: undefined as string | undefined,
    across: '',
    role: '',
    needed: 1,
    callTime: '',
    rate: '',
    details: '',
    replyBy: undefined as string | undefined,
    needs: [] as CertificateKind[],
    // Follows the role until picked (ADR 0046).
    department: undefined as string | null | undefined,
  }
  const [f, setF] = useState(blank)
  const view = useView()
  const seesRates = useSeesRates()
  const suggested = departmentForRole(f.role, { calls: view.crew.calls, people: view.crew.people })
  // The phase picked ('' is across several), while the job still has it. Until then, the job's first phase as it is
  // now rather than when the page opened, so a job that had no phases then starts on the first one added.
  const picked = f.phaseId === '' || job.phases.some((p) => p.id === f.phaseId) ? f.phaseId : undefined
  const phaseId = picked ?? job.phases[0]?.id ?? ''
  const phase = job.phases.find((p) => p.id === phaseId)
  const span = phase ?? job.span
  const [dates, setDates] = useState<{ start: string; end: string } | undefined>()
  const start = dates?.start ?? span?.start ?? ''
  const end = dates?.end ?? span?.end ?? ''
  const venue = phase?.venue ?? job.venue
  const today = useToday()
  const replyBy = f.replyBy ?? (start ? (suggestedReplyBy(start, end < start ? start : end, today) ?? '') : '')
  const { run, error, refuse } = useAct()

  if (!job.span) return <p className="empty">Add a phase first: roles are added by phase and day.</p>
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    // A reason left from the last press goes; this press says its own.
    refuse('')
    // Each said on its field, never a press that does nothing (spaces alone get past the browser's own check).
    if (!f.role.trim()) return void refuseField(form, '[name="role"]', 'Fill in the role first.')
    if (!start) return refuse('Add a phase first: roles are added by phase and day.')
    const rate = parseEuro(f.rate)
    if (rate.reason !== undefined) return void refuseField(form, 'input[aria-label="Day rate €"]', rate.reason)
    // Ready for the next call; a refusal brings what was typed back, unless the next thing has been typed since.
    const cleared = { ...blank, phaseId: f.phaseId }
    setF(cleared)
    setDates(undefined)
    const id = newId()
    const needed = Math.max(1, f.needed)
    const role = f.role.trim()
    void run(() =>
      client.mutate('call.create', {
        id,
        projectId: job.id,
        phaseId: phase?.id ?? null,
        project: job.name,
        phase: phase?.name ?? f.across.trim(),
        venue: venue ? venueLabel(venue) : '',
        role,
        start,
        end: end < start ? start : end,
        callTime: f.callTime || null,
        needed,
        // A role that doesn't read rates leaves it to the office (ADR 0046).
        dayRateCents: seesRates ? rate.cents : null,
        details: f.details.trim(),
        replyBy: replyBy || null,
        needsCertificates: f.needs,
        department: f.department === undefined ? suggested : f.department,
      })
    ).then((ok) => {
      // Said where the person is looking: the new call lands above, out of sight on a phone, so the page goes to it and a pop-up at
      // the bottom edge says what was added. Nobody has been asked anything yet: that is Offer…, on the card (13 November 2026).
      if (ok) {
        showToast({
          id: `added-${id}`,
          title: `Added ${needed} × ${role}`,
          body: `${phase?.name ?? (f.across.trim() || job.name)}, ${spanLabel({ start, end: end < start ? start : end })}. Nobody offered it yet: Offer… is on its card.`,
        })
        return onAdded(id)
      }
      setF((now) => (now === cleared ? f : now))
      setDates((now) => now ?? dates)
    })
  }
  return (
    <form className="grid-form" onSubmit={submit} aria-label="Add a role">
      <label className="wide">
        For
        <select
          aria-label="For which phase"
          value={phaseId}
          onChange={(e) => {
            setF({ ...f, phaseId: e.target.value })
            setDates(undefined)
          }}
        >
          {job.phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}, {spanLabel(p)}
            </option>
          ))}
          <option value="">Across several phases</option>
        </select>
      </label>
      {!phase && (
        <label className="wide">
          Which phases <input value={f.across} onChange={(e) => setF({ ...f, across: e.target.value })} placeholder="e.g. Build and Show" />
        </label>
      )}
      <RoleField value={f.role} onChange={(role) => setF((now) => ({ ...now, role }))} placeholder="Audio tech" />
      <label>
        How many <input type="number" min={1} value={f.needed} onChange={(e) => setF({ ...f, needed: Number(e.target.value) })} />
      </label>
      {/* Crew on a phase are asked for its days (ADR 0159): the days are picked among them, and the line says how to go further. */}
      <div className="pair">
        <label>
          From{' '}
          <input
            type="date"
            value={start}
            min={phase?.start}
            max={phase?.end}
            onChange={(e) => setDates({ start: e.target.value, end: end < e.target.value ? e.target.value : end })}
            aria-describedby={phase ? `ask-days-${job.id}` : undefined}
          />
        </label>
        <label>
          To{' '}
          <input
            type="date"
            value={end}
            min={start}
            max={phase?.end}
            onChange={(e) => setDates({ start, end: e.target.value })}
            aria-describedby={phase ? `ask-days-${job.id}` : undefined}
          />
        </label>
      </div>
      {phase && (
        <p className="hint wide" id={`ask-days-${job.id}`}>
          {phaseDaysRule(phase, today)} {ADD_A_PHASE}
        </p>
      )}
      <label>
        Call time <input type="time" value={f.callTime} onChange={(e) => setF({ ...f, callTime: e.target.value })} />
      </label>
      {seesRates ? (
        <label>
          Day rate <UnitBox unit="€" before><input aria-label="Day rate €" inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} placeholder="250" /></UnitBox>
        </label>
      ) : (
        <p className="hint">The office sets the rate: your role doesn't see crew rates.</p>
      )}
      <DepartmentField view={view} value={f.department} suggested={suggested} onChange={(department) => setF({ ...f, department })} className="wide" />
      <label className="wide">
        Reply by <input type="date" name="replyBy" value={replyBy} onChange={(e) => setF({ ...f, replyBy: e.target.value })} />
      </label>
      <p className="hint wide">Two days before the first day, or the day before when the job is close. Clear it if there's no hurry.</p>
      <label className="wide">
        Details for crew <textarea rows={2} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} placeholder="Travel, food, parking, dress" />
      </label>
      <NeedsField value={f.needs} onChange={(needs) => setF({ ...f, needs })} />
      <Refusal error={error} className="wide" />
      {/* Plain: the Next dock holds the job page's one filled red (ADR 0104; UX sweep, 6 November 2026, move 1). */}
      <button type="submit" className="wide">
        Add role
      </button>
    </form>
  )
}
