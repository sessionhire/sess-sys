import { z } from 'zod'

/**
 * A job's way through the company (ADR 0073, ADR 0104): five stages every
 * gig and dry hire passes through, Quoting, Planning, Going out, On the
 * job and Back, and inside each the tasks that get it through, each with
 * a member of staff it's down to and, if wanted, a day it's due by. The
 * stage a job is in is worked out from the job's own records (its status,
 * its scans, its dates), never ticked: the tasks inside a stage are done in
 * any order, and a task left open follows the job into the next stage.
 * Where the app already knows a task is done (the quote sent, every call
 * booked, all the kit back) it says so itself; the rest are ticked by
 * hand. A task given to someone is on their own list on Home, and they
 * hear of it in Notifications, in the app only: nobody is emailed or texted
 * (ADR 0048).
 *
 * The tasks are the eight steps of ADR 0073 under their new names, kept as
 * they were stored (`job_steps.step`), so nothing already given or ticked
 * moves. A task that doesn't apply (crew on a dry hire with none asked for)
 * says so and is passed over.
 */
export const JOB_STEPS = ['quote', 'confirmed', 'crew', 'kit', 'prep', 'show', 'back', 'deprep'] as const
export type JobStep = (typeof JOB_STEPS)[number]

/** The five stages, in order. */
export const JOB_STAGES = ['selling', 'planning', 'going', 'on', 'back'] as const
export type JobStage = (typeof JOB_STAGES)[number]

export const STAGE_LABELS: Record<JobStage, string> = {
  selling: 'Quoting',
  planning: 'Planning',
  going: 'Going out',
  on: 'On the job',
  back: 'Back',
}

/** What each stage is, in a sentence. */
export const STAGE_LINES: Record<JobStage, string> = {
  selling: 'An enquiry becomes a quote, and the client says yes or no.',
  planning: 'The crew, the kit and the vans are settled before anything moves.',
  going: 'The kit is picked, loaded and on its way.',
  on: 'The build, the show and the break.',
  back: 'Everything comes back, is checked, and is put away.',
}

/** Which stage each task belongs to. */
export const STAGE_OF: Record<JobStep, JobStage> = {
  quote: 'selling',
  confirmed: 'selling',
  crew: 'planning',
  kit: 'planning',
  prep: 'going',
  show: 'on',
  back: 'back',
  deprep: 'back',
}

/** Each task's name, as the list shows it: what it is once done. */
export const STEP_LABELS: Record<JobStep, string> = {
  quote: 'Quote sent',
  confirmed: 'Confirmed',
  crew: 'Crew booked',
  kit: 'Kit and vans settled',
  prep: 'Picked and loaded',
  show: 'Out on the job',
  back: 'Back in',
  deprep: 'Checked and deprepped',
}

/** What it means for each step to be done, in a sentence. */
export const STEP_LINES: Record<JobStep, string> = {
  quote: 'The quote is written and sent to the client.',
  confirmed: 'The client has said yes, and the job is going ahead.',
  crew: 'Every crew call has someone for every day.',
  kit: 'The kit list and the vans are settled.',
  prep: 'Everything on the pick list has gone out of the warehouse.',
  show: 'The job has happened.',
  back: 'Everything that went out is back in the warehouse.',
  deprep: 'The kit is checked, cleaned and put away, and any faults reported.',
}

/**
 * How long after its last day a job with nothing still out and no fault
 * open is taken as through (ADR 0109): its open tasks count as done by the
 * app, so Back holds only the jobs with something still to sort, not every
 * show nobody ticked off by hand.
 */
export const SETTLED_AFTER_DAYS = 14

/**
 * Kit still to check back in this many days past a job's own days to bring
 * it back (ADR 0031) is late, and drawn amber wherever it's listed: the
 * day after the job is the warehouse's work, and two days' grace keeps a
 * weekend from turning every Friday show amber (Move 3 of the sweep of 6
 * November 2026).
 */
export const LATE_BACK_AFTER_DAYS = 2

/** A task's record: who it's down to, the day it's due by, and the tick, when it was ticked by hand. */
export interface StepRecord {
  /** The job and the step, together: one record each. */
  id: string
  projectId: string
  step: JobStep
  /** The member of staff it's down to; null for nobody yet. */
  ownerId: string | null
  /** The day it's due by, YYYY-MM-DD; null for none (ADR 0104). */
  dueOn: string | null
  /** When it was ticked by hand, and by whom (null when the app couldn't tell). */
  doneAt: string | null
  doneBy: string | null
}

/**
 * A job's place on the Board (ADR 0143): put there by hand, in the column of the stage it was in. It holds only while the
 * job is still in that stage; once the job moves on, it is ranked by its days again, as every job nobody has put in order is.
 */
export interface RankRecord {
  /** The job's id: one place each. */
  id: string
  stage: JobStage
  /** Smaller is higher up the column. */
  rank: number
}

export interface StepEntities {
  jobStep: StepRecord
  jobRank: RankRecord
}
export const STEP_ENTITY_NAMES = ['jobStep', 'jobRank'] as const

/** As many cards as one press puts in order: a column of a busy season, with room to spare. */
export const MOST_RANKED = 500

/** One record a step of a job, so two devices giving the same step land on the same one. */
export const stepId = (projectId: string, step: JobStep) => `${projectId}.${step}`

const id = z.string().min(1).max(64)

export const stepCommandSchemas = {
  /**
   * Give a task to someone or to nobody, set or clear the day it's due by,
   * tick it or take the tick off: only what's said changes. `by` is who
   * ticked it, as the device knows them, for a copy with sign-in off; signed
   * in, the server knows.
   */
  'jobStep.set': z
    .object({
      projectId: id,
      step: z.enum(JOB_STEPS),
      ownerId: id.nullable().optional(),
      dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      done: z.boolean().optional(),
      by: id.nullable().optional(),
    })
    .refine((a) => a.ownerId !== undefined || a.done !== undefined || a.dueOn !== undefined, { message: 'Nothing to change.' }),
  /**
   * Put jobs in order in a column of the Board (ADR 0143): `ids` top first, each given its place in the stage, the first
   * 1, the next 2. `clear` gives the jobs in `ids` back to their days instead.
   */
  'jobRank.set': z.object({
    stage: z.enum(JOB_STAGES),
    ids: z.array(id).min(1).max(MOST_RANKED),
    clear: z.boolean().optional(),
  }),
} as const

/** Staff crew see the Board but don't put it in order: the office and the heads do (ADR 0143). */
export const RANK_NOT_YOURS = 'Staff crew can see the Board but not change its order. Ask the office or a head of department.'

/** Why a step can't be given to this person, or undefined when it can: staff only, as they're the ones with a list. */
export function stepOwnerRefusal(p: { name: string; kind: 'staff' | 'freelancer'; archived?: boolean } | undefined): string | undefined {
  if (!p) return "That person isn't in the app any more."
  if (p.archived) return `${p.name} has been archived; give the step to someone else.`
  if (p.kind !== 'staff') return `${p.name} is a freelancer. Tasks are for staff, who see them on Home.`
  return undefined
}

/** Staff crew may tick or hand on only a step that's theirs; everyone above them, any step (ADR 0073). */
export const STEP_NOT_YOURS = 'Staff crew can change only a task that is theirs. Ask the office or a head of department to give it to you.'
