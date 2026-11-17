import type { JobStage, JobStep, RankRecord, StepRecord } from '@sh/shared'
import type { Queryable } from '../db.ts'

/** Reading a job's steps back as devices see them (ADR 0073). */

const STEP = `id, project_id, step, owner_id, to_char(due_on, 'YYYY-MM-DD') AS due_on, to_char(done_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS done_at, done_by`

type Row = Record<string, any>

export const toStep = (r: Row): StepRecord => ({
  id: r.id,
  projectId: r.project_id,
  step: r.step as JobStep,
  ownerId: r.owner_id ?? null,
  dueOn: r.due_on ?? null,
  doneAt: r.done_at ?? null,
  doneBy: r.done_by ?? null,
})

export async function getStep(q: Queryable, id: string) {
  const { rows } = await q.query(`SELECT ${STEP} FROM job_steps WHERE id = $1`, [id])
  return rows[0] ? toStep(rows[0]) : undefined
}

/** A job's place on the Board (ADR 0143), as devices see it. */
export async function getRanks(q: Queryable, ids: readonly string[]): Promise<RankRecord[]> {
  const { rows } = await q.query(`SELECT project_id, stage, rank FROM job_ranks WHERE project_id = ANY($1::text[])`, [ids])
  return rows.map((r: Row) => ({ id: r.project_id, stage: r.stage as JobStage, rank: r.rank }))
}
