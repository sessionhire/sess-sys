import type { CommandArgs, Mutation } from '../commands.ts'
import { dayLabel } from '../crew.ts'
import { daysBetween } from '../crew-days.ts'
import { kindOf, kitDaysOf, STATUS_LABELS, STOPPED } from '../jobs.ts'
import { needsPrice } from '../quotes.ts'
import { plural } from '../stock.ts'
import { JOB_STAGES, JOB_STEPS, LATE_BACK_AFTER_DAYS, SETTLED_AFTER_DAYS, STAGE_LABELS, STAGE_LINES, STAGE_OF, STEP_LABELS, STEP_LINES, stepId, type JobStage, type JobStep, type StepEntities, type RankRecord, type StepRecord } from '../steps.ts'
import type { CrewView, PersonView } from './crew-view.ts'
import type { FaultsView } from './faults-view.ts'
import { crewFill, type JobsView, type JobView } from './jobs-view.ts'
import type { KitView } from './kit-view.ts'
import { CHASE_AFTER_DAYS, type MoneyView } from './money-view.ts'
import type { MovesView, PickList } from './pick-view.ts'
import type { VehiclesView } from './vehicles-view.ts'

/**
 * A job's stages and tasks (ADR 0073, ADR 0104) as a device sees them. The
 * stage the job is in is read from the job's own records: an enquiry or a
 * quote is Quoting; confirmed, it's Planning until the first scan out or
 * its first day, Going out until its first day (or, with kit to pick and
 * none scanned out, through its days), On the job until its last, then Back until everything is in and deprepped. The tasks inside each
 * stage say who each is down to, the day it's due by and whether it's
 * ticked, from what the server has sent with this device's own waiting
 * changes laid over it, and, for the tasks the app can tell for itself,
 * whether it's done from the job's own records. Worked out on the device,
 * so the strip and everyone's list hold with no signal, and a tick the app
 * gives can't go stale: it's read afresh each time.
 */

/** Done, not needed on this job, the one to do next, or one still to come. */
export type StepState = 'done' | 'skipped' | 'now' | 'later'

export interface StepView {
  key: JobStep
  /** 1 to 8, in order. */
  number: number
  stage: JobStage
  label: string
  line: string
  ownerId: string | null
  owner: PersonView | undefined
  /** The day it's due by, if one was set; and whether that day has passed with the task still open. */
  dueOn: string | null
  late: boolean
  /** Ticked by hand: when, and by whom. */
  ticked: { at: string; by: PersonView | undefined } | undefined
  /** Done as the app can tell from the job's records, in words ("All 6 calls booked"); undefined when it can't tell. */
  auto: string | undefined
  done: boolean
  /** Why it doesn't apply to this job ("No crew on a dry hire"); undefined when it does. */
  skipped: string | undefined
  /** How far along it is, while it isn't done ("3 of 5 calls booked"). */
  hint: string | undefined
  /**
   * The same facts as fields (Move 7 of the sweep of 6 November 2026), so the dock, the Board and the chip choose a button
   * or a tone from numbers and never by reading the hint's words back: a wording change can't silently change what is
   * pressed. Set whether or not the task is done; the hint is written from these, and a test holds the two together.
   */
  facts: StepFacts
  state: StepState
  /** The part of the job page or the page where the work is done. */
  part: 'phases' | 'crew' | 'kit' | 'quote' | 'pick' | undefined
  pending: boolean
}

/** What the app can tell of a task, as numbers and days rather than words. Only what applies to the task is set. */
export interface StepFacts {
  /** Crew: people booked, asked for, and said yes waiting to be confirmed. */
  booked?: number
  needed?: number
  toConfirm?: number
  /** Kit and vans: lines of kit, lines short, and vehicles. */
  lines?: number
  short?: number
  vans?: number
  /** Picking: how many went out, of how many on the pick list. */
  out?: number
  of?: number
  /** Back in: still out, missing, and on the pick list but never scanned out. */
  stillOut?: number
  missing?: number
  neverScanned?: number
  /** The show: the first and last day. */
  starts?: string
  until?: string
  /** The quote: the day it was sent, and the client's answer; a draft started; held back from this role (ADR 0042). */
  sentOn?: string
  answeredOn?: string
  draft?: boolean
  quoteHidden?: boolean
  /** Deprep: faults open on the job's kit. */
  faults?: number
  /** Nothing to work on yet: no crew asked for, no kit on the job, nothing to pick, no dates. */
  nothingYet?: boolean
}

export interface StageView {
  key: JobStage
  /** 1 to 5, in order. */
  number: number
  label: string
  line: string
  /** Passed, the one the job is in, or still to come. */
  state: 'done' | 'now' | 'later'
  tasks: StepView[]
  done: number
  /** Of the tasks that apply. */
  of: number
  /** What's short or waiting in it, in a few words ("3 of 5 booked · 1 short"); undefined when nothing is. */
  hint: string | undefined
}

export interface JobSteps {
  job: JobView
  /** All eight tasks, in order. */
  steps: StepView[]
  stages: StageView[]
  /** The stage the job is in. Undefined once it's through the last, or on a stopped job. */
  stage: StageView | undefined
  /** The task to do next: the first open in the stage the job is in, else one left open from before, else picking, which can start early. Undefined when there's none. */
  current: StepView | undefined
  /** Tasks left open from a stage the job has passed. */
  behind: StepView[]
  done: number
  /** Of the tasks that apply. */
  of: number
  /** Through every stage, with every task done. */
  finished: boolean
  /** Why the job has no tasks to do: it's cancelled or lost, or it's an errand or a meeting. */
  stopped: string | undefined
  /** Still an enquiry or quoted after its last day (ADR 0109): the answer to record is whether it happened, or it was lost. */
  lapsed: boolean
  /** Whole days until its first day, while that is still to come; undefined with no dates or once it has begun. */
  daysTo: number | undefined
  /** Whole days since its last day, once that has passed; undefined before. */
  daysAfter: number | undefined
  /** Where the selling stands in one sentence, the same on the Board, the Jobs list and the dock (sellingLine); undefined once sold. */
  selling: string | undefined
  /**
   * Its place in its column of the Board, put there by hand (ADR 0143): smaller is higher. Undefined when nobody has, or
   * when it was put there in the column of a stage it has since left, so it goes by its days again.
   */
  rank: number | undefined
}

export interface MyStep {
  job: JobView
  step: StepView
  /** It's the task the job is at, so it's theirs to do now. */
  next: boolean
}

export interface StepsView {
  of(jobId: string): JobSteps | undefined
  /** A person's tasks not done yet, on jobs going ahead or pencilled in: the ones to do now first, then by the day each is due, then by the job's first day. */
  mine(personId: string): MyStep[]
}

type Tables = { [E in keyof StepEntities]: Record<string, StepEntities[E]> }

/** What the app can tell of one task: done in words, how far along in words, or not needed, and the facts under each. */
type Told = { auto?: string; hint?: string; skipped?: string; facts: StepFacts }

/**
 * Where the selling stands, in one sentence (Move 7 of the sweep of 6 November 2026): the Board's card, the Jobs list's
 * stage line and the selling stage's hint all read this, so a quote reads the same wherever it's seen. "Worth a call" at
 * the same threshold Quotes and Home use (CHASE_AFTER_DAYS); "Quote: with the office" when the role is sent no money.
 */
export function sellingLine(s: {
  lapsed: boolean
  quoteHidden: boolean
  answered: boolean
  answeredOn?: string
  /** Days since the quote with the client was sent; undefined when none is with the client. */
  sentDays: number | undefined
  draft: boolean
  /** Lines on the draft with no price. */
  unpriced: number
}): string {
  if (s.lapsed) return 'Dates passed, no answer'
  if (s.quoteHidden) return 'Quote: with the office'
  if (s.answered) return `The client said yes${s.answeredOn ? ` ${dayLabel(s.answeredOn)}` : ''}`
  if (s.sentDays !== undefined)
    return s.sentDays === 0 ? 'Quote with the client since today' : `Quote with the client ${plural(s.sentDays, 'day')}${s.sentDays >= CHASE_AFTER_DAYS ? ' · worth a call' : ''}`
  if (s.draft) return `Draft started${s.unpriced ? ` · ${plural(s.unpriced, 'line')} ${s.unpriced === 1 ? 'needs' : 'need'} a price` : ''}`
  return 'No quote yet'
}

/** Jobs with stages: gigs and dry hires. Errands and meetings are done in a day and need none. */
export const hasSteps = (job: Pick<JobView, 'kind'>) => kindOf(job) === 'gig' || kindOf(job) === 'hire'

const PART: Record<JobStep, StepView['part']> = {
  quote: 'quote',
  confirmed: 'quote',
  crew: 'crew',
  kit: 'kit',
  prep: 'pick',
  show: 'phases',
  back: 'pick',
  deprep: 'pick',
}

export function stepsView(
  entities: Partial<Tables>,
  outbox: readonly (Mutation & { appliedSeq?: number })[],
  cursor: number,
  jobs: JobsView,
  crew: CrewView,
  kit: KitView,
  moves: MovesView,
  money: MoneyView,
  vehicles: VehiclesView,
  faults: FaultsView,
  today: string,
  /** Whether the server sends this device money (ADR 0042): a role it doesn't isn't sent the quotes either. */
  sentMoney: boolean
): StepsView {
  // Snapshots saved before steps have no table for them, and rows saved before due dates have none.
  const records = new Map<string, StepRecord & { pending: boolean }>()
  for (const r of Object.values(entities.jobStep ?? {})) records.set(r.id, { ...r, dueOn: r.dueOn ?? null, pending: false })
  for (const m of outbox) {
    if (m.appliedSeq !== undefined && m.appliedSeq <= cursor) continue
    if (m.name !== 'jobStep.set') continue
    const a = m.args as CommandArgs<'jobStep.set'>
    const key = stepId(a.projectId, a.step)
    const was = records.get(key) ?? { id: key, projectId: a.projectId, step: a.step, ownerId: null, dueOn: null, doneAt: null, doneBy: null }
    const ticked = a.done === undefined ? was.doneAt !== null : a.done
    records.set(key, {
      ...was,
      ownerId: a.ownerId === undefined ? was.ownerId : a.ownerId,
      dueOn: a.dueOn === undefined ? was.dueOn : a.dueOn,
      // A tick kept stays as it was given: ticking again isn't a new tick.
      doneAt: ticked ? (was.doneAt ?? m.createdAt) : null,
      doneBy: ticked ? (was.doneAt ? was.doneBy : (a.by ?? null)) : null,
      pending: true,
    })
  }
  // The Board's order (ADR 0143), with any change still on its way laid over it as it was made.
  const ranks = new Map<string, RankRecord>()
  for (const r of Object.values(entities.jobRank ?? {})) ranks.set(r.id, r)
  for (const m of outbox) {
    if (m.appliedSeq !== undefined && m.appliedSeq <= cursor) continue
    if (m.name !== 'jobRank.set') continue
    const a = m.args as CommandArgs<'jobRank.set'>
    a.ids.forEach((id, i) => (a.clear ? ranks.delete(id) : ranks.set(id, { id, stage: a.stage, rank: i + 1 })))
  }
  const people = new Map(crew.people.map((p) => [p.id, p]))
  const jobById = new Map(jobs.jobs.map((j) => [j.id, j]))

  /** Where the job is by its own records, and what the app can tell of each task for itself: done, in words, or how far along, or not needed. */
  function told(job: JobView): { stage: JobStage | 'through'; lapsed: boolean; settled: string | undefined; tasks: Record<JobStep, Told>; selling: string | undefined } {
    const quotes = money.quotesOf(job.id)
    const sent = quotes.find((q) => q.status === 'sent' || q.status === 'accepted')
    const accepted = quotes.find((q) => q.status === 'accepted')
    const draft = quotes.find((q) => q.status === 'draft')
    const crewOn = crewFill(job.calls)
    const lines = kit.byJob.get(job.id) ?? []
    const short = lines.filter((l) => l.short > 0).length
    const vans = vehicles.ofJob(job.id).length
    const pick = lines.length ? moves.pickList(job.id) : undefined
    const onKit = pick?.rows.filter((r) => r.lines.length > 0) ?? []
    const wentOut = onKit.reduce((n, r) => n + Math.min(r.out + r.back + r.missing, r.need), 0)
    const anyOut = pick ? pick.stillOut + pick.back + pick.missing > 0 : false
    const over = job.span !== undefined && job.span.end < today
    const on = job.span !== undefined && job.span.start <= today && today <= job.span.end
    const openFaults = faults.ofJob(job.id).filter((f) => f.open).length
    // The stage, from the records alone: the status says sold or not, the scans say the kit is moving, the dates say the rest.
    // On its days with kit to pick and none of it scanned out, it's still going out, not out (ADR 0140, part 6): the warehouse
    // isn't told the kit has gone when nothing has.
    const unpicked = !!pick && pick.need > 0 && !anyOut
    const stage: JobStage | 'through' =
      job.status !== 'confirmed' ? 'selling' : over ? 'back' : on ? (unpicked ? 'going' : 'on') : wentOut > 0 ? 'going' : 'planning'
    const past = (s: JobStage) => JOB_STAGES.indexOf(stage) > JOB_STAGES.indexOf(s)
    // Still selling after its last day: nobody recorded the answer (ADR 0109).
    const lapsed = stage === 'selling' && over
    // Over a fortnight ago with nothing still out and no fault open, a job is through whether or not its tasks were ticked
    // (ADR 0109): the shows from before the stages existed, and the ones nobody ticked off, stop filling Back.
    const settled =
      stage === 'back' && daysBetween(job.span!.end, today) > SETTLED_AFTER_DAYS && (!pick || pick.stillOut === 0) && openFaults === 0
        ? `Taken as done: it ended ${dayLabel(job.span!.end)} with nothing still out`
        : undefined
    const unpriced = draft ? draft.lines.filter((l, _, all) => needsPrice(l, all)).length : 0
    const quoteFacts: StepFacts = {
      ...(sent?.sentOn ? { sentOn: sent.sentOn } : {}),
      ...(accepted?.answeredOn ? { answeredOn: accepted.answeredOn } : {}),
      ...(draft ? { draft: true } : {}),
      ...(!sentMoney ? { quoteHidden: true } : {}),
    }
    const crewFacts: StepFacts = { booked: crewOn.booked, needed: crewOn.needed, toConfirm: crewOn.toConfirm, ...(crewOn.needed === 0 ? { nothingYet: true } : {}) }
    const kitFacts: StepFacts = { lines: lines.length, short, vans, ...(lines.length || vans ? {} : { nothingYet: true }) }
    const pickFacts: StepFacts = pick && pick.need > 0 ? { out: wentOut, of: pick.need } : { nothingYet: true }
    const backFacts: StepFacts = pick
      ? { stillOut: pick.stillOut, missing: pick.missing, neverScanned: !anyOut && pick.need > 0 && past('on') ? pick.need : 0 }
      : { nothingYet: true }
    const showFacts: StepFacts = job.span ? { starts: job.span.start, until: job.span.end } : { nothingYet: true }
    const tasks: Record<JobStep, Told> = {
      quote: sent
        ? { auto: sent.sentOn ? `Sent ${dayLabel(sent.sentOn)}` : 'Sent', facts: quoteFacts }
        : job.status === 'quoted' || job.status === 'confirmed'
          ? { auto: `The job is ${STATUS_LABELS[job.status].toLowerCase()}`, facts: quoteFacts }
          : // Not sent the quotes, a role can't tell a quote started from none: it's the office's, not missing (ADR 0046 §8;
            // Move 3 of the sweep of 6 November 2026). Such a device holds no quote, so never a "Sent …" either.
            { hint: quoteFacts.quoteHidden ? 'Quote: with the office' : quoteFacts.draft ? 'A draft is started' : 'No quote yet', facts: quoteFacts },
      // Only the job's own status is the yes (ADR 0103): it's what puts the job on the calendar and holds its kit, so a
      // quote accepted on a job still an enquiry is the task to do, not a task done.
      confirmed:
        job.status === 'confirmed'
          ? { auto: 'The job is confirmed', facts: quoteFacts }
          : accepted
            ? { hint: `The client said yes${accepted.answeredOn ? ` ${dayLabel(accepted.answeredOn)}` : ''}, and the job is still ${STATUS_LABELS[job.status].toLowerCase()}`, facts: quoteFacts }
            : lapsed
              ? { hint: `Its dates have passed with no answer`, facts: quoteFacts }
              : { hint: `Still ${STATUS_LABELS[job.status].toLowerCase()}`, facts: quoteFacts },
      crew:
        crewOn.needed === 0
          ? kindOf(job) === 'hire'
            ? { skipped: 'No crew on a dry hire', facts: crewFacts }
            : { hint: 'No crew asked for yet', facts: crewFacts }
          : crewOn.booked >= crewOn.needed
            ? { auto: `All ${crewOn.needed} crew booked`, facts: crewFacts }
            : { hint: `${crewOn.booked} of ${crewOn.needed} booked${crewOn.toConfirm ? `, ${crewOn.toConfirm} to confirm` : ''}`, facts: crewFacts },
      // A job with no kit and no vans once it's under way (a crew-only shoot) had none to settle; before that they may still be coming.
      // Once it's under way with nothing short, what it has was settled (ADR 0109): the tick by hand is for while it's planned.
      kit:
        (lines.length || vans) && past('planning') && !short
          ? { auto: wentOut > 0 ? 'Settled: the kit went out' : over ? 'Settled: the job is over' : 'Settled: the job is under way', facts: kitFacts }
          : lines.length || vans
            ? { hint: [lines.length ? plural(lines.length, 'line') + ' of kit' : '', short ? `${short} short` : '', vans ? plural(vans, 'vehicle') : ''].filter(Boolean).join(', '), facts: kitFacts }
            : past('planning')
              ? { skipped: 'No kit or vans on this job', facts: kitFacts }
              : { hint: 'No kit on the job yet', facts: kitFacts },
      // A job with no kit once it's under way (a crew-only gig) has nothing to pick or bring back; before that the kit may still be coming.
      prep:
        pick && pick.need > 0 && wentOut >= pick.need
          ? { auto: 'Everything went out', facts: pickFacts }
          : pick && pick.need > 0
            ? { hint: `${wentOut} of ${pick.need} out`, facts: pickFacts }
            : past('going')
              ? { skipped: 'No kit went out on this job', facts: pickFacts }
              : { hint: 'No kit to pick yet', facts: pickFacts },
      show: over
        ? { auto: `Finished ${dayLabel(job.span!.end)}`, facts: showFacts }
        : on
          ? { hint: `On until ${dayLabel(job.span!.end)}`, facts: showFacts }
          : { hint: job.span ? `Starts ${dayLabel(job.span.start)}` : 'No dates yet', facts: showFacts },
      back:
        anyOut && pick!.stillOut === 0
          ? { auto: pick!.missing ? `All back but ${pick!.missing} missing` : 'All back', facts: backFacts }
          : anyOut
            ? { hint: `${pick!.stillOut} still out`, facts: backFacts }
            : pick && pick.need > 0 && past('on')
              ? // Kit on the pick list and none of it scanned (ADR 0109): it may have gone out unscanned and still be at the venue.
                { hint: `${pick.need} never scanned out: check they're back`, facts: backFacts }
              : past('on')
                ? { skipped: 'Nothing went out to come back', facts: backFacts }
                : { hint: 'Nothing out yet', facts: backFacts },
      deprep: { hint: openFaults ? `${plural(openFaults, 'fault')} open on its kit` : undefined, facts: { faults: openFaults } },
    }
    const selling =
      stage === 'selling'
        ? sellingLine({
            lapsed,
            quoteHidden: !sentMoney,
            answered: !!accepted,
            answeredOn: accepted?.answeredOn ?? undefined,
            // A new version being drafted is what's being worked on, not the one with the client.
            sentDays: sent && sent.status === 'sent' && !draft ? (sent.sentOn ? Math.max(0, daysBetween(sent.sentOn, today)) : 0) : undefined,
            draft: !!draft,
            unpriced,
          })
        : undefined
    return { stage, lapsed, settled, tasks, selling }
  }

  const built = new Map<string, JobSteps>()
  function of(jobId: string): JobSteps | undefined {
    const ready = built.get(jobId)
    if (ready) return ready
    const job = jobById.get(jobId)
    if (!job) return undefined
    const stopped = STOPPED.includes(job.status)
      ? `This job is ${STATUS_LABELS[job.status].toLowerCase()}, so its tasks are stopped.`
      : !hasSteps(job)
        ? 'Errands and meetings have no stages.'
        : undefined
    const what = told(job)
    const steps = JOB_STEPS.map((key, i): StepView => {
      const r = records.get(stepId(job.id, key))
      const own = what.tasks[key]
      // A job settled long after it ended takes what's still open as done (ADR 0109); a tick given by hand still shows as given.
      const t = what.settled && STAGE_OF[key] !== 'selling' && !own.auto && !own.skipped && !r?.doneAt ? { auto: what.settled, facts: own.facts } : own
      const ticked = r?.doneAt ? { at: r.doneAt, by: r.doneBy ? people.get(r.doneBy) : undefined } : undefined
      const done = !!ticked || !!t.auto
      const skipped = done ? undefined : t.skipped
      const dueOn = r?.dueOn ?? null
      return {
        key,
        number: i + 1,
        stage: STAGE_OF[key],
        label: STEP_LABELS[key],
        line: STEP_LINES[key],
        ownerId: r?.ownerId ?? null,
        owner: r?.ownerId ? people.get(r.ownerId) : undefined,
        dueOn,
        late: !done && !skipped && dueOn !== null && dueOn < today,
        ticked,
        auto: t.auto,
        done,
        skipped,
        hint: done || skipped ? undefined : t.hint,
        facts: t.facts,
        state: done ? 'done' : skipped ? 'skipped' : 'later',
        part: PART[key],
        pending: r?.pending ?? false,
      }
    })
    const open = (s: StepView) => !s.done && !s.skipped
    // Through the last stage once it's reached and everything in it is done.
    const at: JobStage | 'through' = what.stage === 'back' && steps.filter((s) => s.stage === 'back').every((s) => !open(s)) ? 'through' : what.stage
    const atIndex = at === 'through' ? JOB_STAGES.length : JOB_STAGES.indexOf(at)
    const stages = JOB_STAGES.map((key, i): StageView => {
      const tasks = steps.filter((s) => s.stage === key)
      const applies = tasks.filter((s) => !s.skipped)
      const hints = tasks.filter(open).map((s) => s.hint).filter((h): h is string => !!h)
      return {
        key,
        number: i + 1,
        label: STAGE_LABELS[key],
        line: STAGE_LINES[key],
        state: stopped ? 'later' : i < atIndex ? 'done' : i === atIndex ? 'now' : 'later',
        tasks,
        done: applies.filter((s) => s.done).length,
        of: applies.length,
        // Quoting says where the quote stands in its one sentence; the other stages, what's open in them.
        hint: key === 'selling' && what.selling ? what.selling : hints.length ? hints.slice(0, 2).join(' · ') : undefined,
      }
    })
    const stage = stopped || at === 'through' ? undefined : stages[atIndex]
    const behind = stopped ? [] : steps.filter((s) => open(s) && JOB_STAGES.indexOf(s.stage) < atIndex)
    // The task to do next: in the stage the job is in, else one left behind, else picking, which can start while it's still being
    // planned. The show itself only happens, so it's next only when nothing else is open.
    const show = steps.find((s) => s.key === 'show')!
    // A job whose dates passed while it was still being sold has one thing left to do: say what happened (ADR 0109).
    const lapsedAnswer = what.lapsed ? steps.find((s) => s.key === 'confirmed' && open(s)) : undefined
    const current = stopped
      ? undefined
      : (lapsedAnswer ??
        stage?.tasks.find((s) => open(s) && s.key !== 'show') ??
        behind[0] ??
        (at === 'planning' ? steps.find((s) => s.key === 'prep' && open(s) && !s.facts.nothingYet) : undefined) ??
        (stage?.key === 'on' && open(show) ? show : undefined))
    if (current) current.state = 'now'
    const applies = steps.filter((s) => !s.skipped)
    const out: JobSteps = {
      job,
      steps,
      stages,
      stage,
      current,
      behind,
      done: applies.filter((s) => s.done).length,
      of: applies.length,
      finished: !stopped && at === 'through',
      stopped,
      lapsed: !stopped && what.lapsed,
      daysTo: job.span && job.span.start > today ? daysBetween(today, job.span.start) : undefined,
      daysAfter: job.span && job.span.end < today ? daysBetween(job.span.end, today) : undefined,
      selling: stopped ? undefined : what.selling,
      rank: (() => {
        const r = ranks.get(jobId)
        return r && !stopped && r.stage === stage?.key ? r.rank : undefined
      })(),
    }
    built.set(jobId, out)
    return out
  }

  return {
    of,
    mine(personId) {
      const out: MyStep[] = []
      const seen = new Set<string>()
      for (const r of records.values()) {
        if (r.ownerId !== personId || seen.has(r.projectId)) continue
        seen.add(r.projectId)
        const s = of(r.projectId)
        if (!s || s.stopped) continue
        for (const step of s.steps) if (step.ownerId === personId && !step.done && !step.skipped) out.push({ job: s.job, step, next: step === s.current })
      }
      const first = (j: JobView) => j.span?.start ?? '9999'
      const due = (s: StepView) => s.dueOn ?? '9999'
      return out.sort(
        (a, b) => Number(b.next) - Number(a.next) || due(a.step).localeCompare(due(b.step)) || first(a.job).localeCompare(first(b.job)) || a.job.name.localeCompare(b.job.name) || a.step.number - b.step.number
      )
    },
  }
}

/**
 * A job with kit to check back in (ADR 0109): in Back with its Back in task
 * open, its kit out and not scanned back, or on its pick list and never
 * scanned out; or kit still out with a job that has no Back to be in, being
 * cancelled, lost, an errand or with no dates, or whose Back in was ticked
 * by hand. One list for every place that counts or lists it (Move 3 of the
 * sweep of 6 November 2026): Home's count and Home › Warehouse, Stock's
 * Still out after the job, and the Board's Back column.
 */
export interface KitToCheck {
  job: JobView
  pick: PickList
  /** Out with it now, by the scans. */
  out: number
  /** Everything that went out by the scans, what's back and what's missing too. */
  went: number
  /** On its pick list and none of it ever scanned out: it may have gone out unscanned and still be at the venue. */
  neverScanned: number
  /** Whole days since its last day; undefined when it has none. */
  after: number | undefined
  /** Past its own days to come back plus LATE_BACK_AFTER_DAYS, stopped, or with no dates to go by: drawn amber. */
  late: boolean
  /** "3 of 27 not scanned back", or the Back in task's own "23 never scanned out: check they're back" (ADR 0109). */
  said: string
  /** "ended 4 days ago", "ended yesterday", "job cancelled", "job lost", "no dates": after what isn't back, so it's the job that's said to be cancelled, not the kit. */
  when: string
}

/** The jobs with kit to check back in, the one that ended last first, as the one just back is the one being worked on (audit, 20 October 2026, finding 99), and any with no dates last. */
export function kitToCheckBackIn(jobs: JobsView, steps: StepsView, moves: MovesView, today: string): KitToCheck[] {
  const picks = new Map<string, PickList>()
  for (const job of jobs.jobs) {
    // Only a confirmed job past its last day can be in Back.
    if (job.status !== 'confirmed' || !job.span || job.span.end >= today) continue
    const at = steps.of(job.id)
    const back = at?.stage?.key === 'back' ? at.steps.find((s) => s.key === 'back') : undefined
    const pick = back && !back.done && !back.skipped ? moves.pickList(job.id) : undefined
    if (pick) picks.set(job.id, pick)
  }
  for (const p of moves.stillOut) picks.set(p.job.id, p)
  return [...picks.values()]
    .map((pick): KitToCheck => {
      const { job } = pick
      const went = pick.stillOut + pick.back + pick.missing
      const neverScanned = went === 0 ? pick.need : 0
      const after = job.span ? daysBetween(job.span.end, today) : undefined
      const stopped = STOPPED.includes(job.status)
      return {
        job,
        pick,
        out: pick.stillOut,
        went,
        neverScanned,
        after,
        late: stopped || after === undefined || after > kitDaysOf(job).back + LATE_BACK_AFTER_DAYS,
        said: neverScanned ? `${neverScanned} never scanned out: check they're back` : `${pick.stillOut} of ${went} not scanned back`,
        when: stopped ? `job ${STATUS_LABELS[job.status].toLowerCase()}` : after === undefined ? 'no dates' : after === 1 ? 'ended yesterday' : `ended ${after} days ago`,
      }
    })
    .sort((a, b) => (b.job.span?.end ?? '').localeCompare(a.job.span?.end ?? '') || a.job.name.localeCompare(b.job.name) || a.job.id.localeCompare(b.job.id))
}
