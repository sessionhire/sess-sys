import type { QuoteHold } from '@sh/shared'
import { emit, type Ctx } from '../kernel.ts'
import { getProject } from '../projects/store.ts'

/**
 * The job again, when its quote's hold has changed (ADR 0194): a quote sent, answered, taken back, deleted or put back
 * changes how long the job's kit is held and when its Quoting task's follow-ups fall, which every device reads from the
 * job (`quoteHold`, worked out as it's read). Sent only when the hold differs from what devices last had, so saving a
 * draft, which changes none of it, sends no job.
 */
export async function jobAgain(ctx: Ctx, projectId: string) {
  const job = await getProject(ctx.tx, projectId)
  if (!job) return
  const { rows } = await ctx.tx.query<{ hold: QuoteHold | null }>(
    `SELECT data->'quoteHold' AS hold FROM changes WHERE entity = 'project' AND entity_id = $1 ORDER BY seq DESC LIMIT 1`,
    [projectId]
  )
  if (rows.length && sameHold(rows[0]!.hold ?? undefined, job.quoteHold)) return
  await emit(ctx, 'project', projectId, job)
}

const sameHold = (a: QuoteHold | undefined, b: QuoteHold | undefined) =>
  !a === !b && a?.validUntil === b?.validUntil && a?.heldUntil === b?.heldUntil
