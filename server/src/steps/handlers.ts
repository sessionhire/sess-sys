import { ERASED_REFUSAL, kindOf, RANK_NOT_YOURS, STATUS_LABELS, STEP_NOT_YOURS, stepId, stepOwnerRefusal, STOPPED, type CommandArgs } from '@sh/shared'
import { getPerson, personByEmail } from '../crew/store.ts'
import { readErasure } from '../erasure/places.ts'
import { emit, emitAll, emitRemovedAll, Refused, type Ctx } from '../kernel.ts'
import { getProject } from '../projects/store.ts'
import { getRanks, getStep } from './store.ts'

/**
 * A job's tasks (ADR 0073, ADR 0104). A task is given to a member of staff
 * who isn't archived or erased, or a day it's due by, on a gig or a dry hire
 * going ahead or pencilled in; taking a tick, a name or a date off is always
 * allowed, so a stopped job can be tidied. Staff crew change only the steps that are theirs. Giving a step
 * to someone tells them in the app only, through Notifications, which
 * read the history: nothing here emails, texts or messages anyone.
 */

type Handler<N extends 'jobStep.set' | 'jobRank.set'> = (ctx: Ctx, args: CommandArgs<N>) => Promise<void>

export const stepHandlers: { 'jobStep.set': Handler<'jobStep.set'>; 'jobRank.set': Handler<'jobRank.set'> } = {
  /**
   * The Board's order (ADR 0143): each job named takes its place in the column, top first, or goes back to its days. Only
   * the jobs named change, so a column seen narrowed to a department leaves the others' places as they were; a job no
   * longer in the app is passed over. Which column a job is in is the device's to say: the place holds only while the job
   * is still in that stage, so one put in the wrong column is simply back in date order.
   */
  async 'jobRank.set'(ctx, a) {
    if (ctx.role === 'crew') throw new Refused({ code: 'forbidden', message: RANK_NOT_YOURS })
    const ids = [...new Set(a.ids)]
    if (a.clear) {
      const { rows } = await ctx.tx.query<{ project_id: string }>('DELETE FROM job_ranks WHERE project_id = ANY($1::text[]) RETURNING project_id', [ids])
      await emitRemovedAll(ctx, 'jobRank', rows.map((r) => r.project_id))
      return
    }
    const { rows } = await ctx.tx.query<{ id: string }>('SELECT id FROM projects WHERE id = ANY($1::text[])', [ids])
    const known = new Set(rows.map((r) => r.id))
    const placed = ids.map((id, i) => ({ id, rank: i + 1 })).filter((r) => known.has(r.id))
    if (!placed.length) throw new Refused({ code: 'not-found', message: 'Those jobs are no longer in the app.' })
    await ctx.tx.query(
      `INSERT INTO job_ranks (project_id, stage, rank) SELECT unnest($1::text[]), $2, unnest($3::int[])
       ON CONFLICT (project_id) DO UPDATE SET stage = EXCLUDED.stage, rank = EXCLUDED.rank`,
      [placed.map((r) => r.id), a.stage, placed.map((r) => r.rank)]
    )
    await emitAll(ctx, 'jobRank', (await getRanks(ctx.tx, placed.map((r) => r.id))).map((r) => ({ id: r.id, data: r })))
  },
  async 'jobStep.set'(ctx, a) {
    const job = await getProject(ctx.tx, a.projectId, true)
    if (!job) throw new Refused({ code: 'not-found', message: 'That job is no longer in the app.' })
    const id = stepId(a.projectId, a.step)
    const was = await getStep(ctx.tx, id)
    const adds = (a.ownerId !== undefined && a.ownerId !== null && a.ownerId !== was?.ownerId) || (a.done === true && !was?.doneAt) || (!!a.dueOn && a.dueOn !== was?.dueOn)
    if (adds && STOPPED.includes(job.status))
      throw new Refused({ code: 'conflict', message: `${job.name} is ${STATUS_LABELS[job.status].toLowerCase()}, so its tasks are stopped.` })
    if (adds && kindOf(job) !== 'gig' && kindOf(job) !== 'hire') throw new Refused({ code: 'conflict', message: 'Errands and meetings have no stages.' })

    // Who is doing it: the signed-in person; with sign-in off, whoever the device says, if they're in the app.
    const me = ctx.user ? await personByEmail(ctx.tx, ctx.user.email) : undefined
    if (ctx.role === 'crew' && (!me || was?.ownerId !== me.id)) throw new Refused({ code: 'forbidden', message: STEP_NOT_YOURS })

    if (a.ownerId && a.ownerId !== was?.ownerId) {
      const owner = await getPerson(ctx.tx, a.ownerId)
      if (owner && (await readErasure(ctx.tx, owner.id))) throw new Refused({ code: 'conflict', message: ERASED_REFUSAL })
      const no = stepOwnerRefusal(owner)
      if (no) throw new Refused({ code: 'conflict', message: no })
    }
    const by = ctx.user ? (me?.id ?? null) : a.by ? ((await getPerson(ctx.tx, a.by))?.id ?? null) : null

    const owner = a.ownerId === undefined ? (was?.ownerId ?? null) : a.ownerId
    const dueOn = a.dueOn === undefined ? (was?.dueOn ?? null) : a.dueOn
    const ticked = a.done === undefined ? !!was?.doneAt : a.done
    // Ticked again is the same tick: when and by whom stay as they were.
    const keep = ticked && !!was?.doneAt
    await ctx.tx.query(
      `INSERT INTO job_steps (id, project_id, step, owner_id, due_on, done_at, done_by) VALUES ($1, $2, $3, $4, $8, CASE WHEN $5::boolean THEN now() END, CASE WHEN $5::boolean THEN $6 END)
       ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, due_on = EXCLUDED.due_on,
         done_at = CASE WHEN $7::boolean THEN job_steps.done_at ELSE EXCLUDED.done_at END,
         done_by = CASE WHEN $7::boolean THEN job_steps.done_by ELSE EXCLUDED.done_by END`,
      [id, a.projectId, a.step, owner, ticked, by, keep, dueOn]
    )
    await emit(ctx, 'jobStep', id, await getStep(ctx.tx, id))
  },
}

