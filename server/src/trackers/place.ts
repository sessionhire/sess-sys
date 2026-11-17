import { irishToday, placeOf, samePlace, STOPPED, type HeldJob, type Tracker, type TrackerPlace, type TrackerSettings } from '@sh/shared'
import type { Queryable } from '../db.ts'
import { emit, type Ctx } from '../kernel.ts'
import { outWith } from '../stock/moves.ts'
import { getTracker } from './store.ts'

/**
 * Where a tracker is against where its item should be (ADR 0107), worked
 * out from the database for `placeOf` (shared/src/trackers.ts): the job the
 * item was last scanned out with, by the same rules as the pick lists, and
 * the jobs holding its product on the day of the fix, each with its days
 * (prep and return days in) and its venues that are on the map.
 */

/** A job's held days and its venues on the map; undefined for a job no longer in the app. */
async function heldJob(q: Queryable, projectId: string): Promise<HeldJob | undefined> {
  const { rows } = await q.query<{ id: string; name: string; from: string | null; to: string | null }>(
    `SELECT p.id, p.name, (min(ph.start_day) - p.prep_days)::text AS "from", (max(ph.end_day) + p.return_days)::text AS "to"
       FROM projects p LEFT JOIN phases ph ON ph.project_id = p.id
      WHERE p.id = $1
      GROUP BY p.id`,
    [projectId]
  )
  const j = rows[0]
  if (!j) return undefined
  // A job with no days yet holds nothing on any day: kit out with one is out with it until someone says otherwise.
  return { id: j.id, name: j.name, from: j.from ?? '0000-01-01', to: j.to ?? '9999-12-31', venues: await venuesOf(q, j.id) }
}

async function venuesOf(q: Queryable, projectId: string): Promise<HeldJob['venues']> {
  const { rows } = await q.query<{ name: string; lat: number; lng: number }>(
    `SELECT v.name, v.lat, v.lng FROM venues v
      WHERE v.lat IS NOT NULL
        AND (v.id = (SELECT venue_id FROM projects WHERE id = $1) OR v.id IN (SELECT venue_id FROM phases WHERE project_id = $1 AND venue_id IS NOT NULL))
      ORDER BY v.name, v.id`,
    [projectId]
  )
  return rows.map((r) => ({ name: r.name, pin: { lat: r.lat, lng: r.lng } }))
}

/** The jobs going ahead or pencilled in whose kit has this item's product, and whose held days take in `day`. */
async function jobsHolding(q: Queryable, assetId: string, day: string): Promise<HeldJob[]> {
  const { rows } = await q.query<{ id: string; name: string; from: string; to: string }>(
    `SELECT p.id, p.name, (min(ph.start_day) - p.prep_days)::text AS "from", (max(ph.end_day) + p.return_days)::text AS "to"
       FROM projects p JOIN phases ph ON ph.project_id = p.id
      WHERE p.status <> ALL($3::text[])
        AND p.id IN (SELECT k.project_id FROM kit_lines k JOIN assets a ON a.model_id = k.model_id WHERE a.id = $1)
      GROUP BY p.id
     HAVING min(ph.start_day) - p.prep_days <= $2::date AND max(ph.end_day) + p.return_days >= $2::date
      ORDER BY min(ph.start_day), p.id`,
    [assetId, day, STOPPED]
  )
  return Promise.all(rows.map(async (r) => ({ ...r, venues: await venuesOf(q, r.id) })))
}

/** Where this tracker is against where its item should be, by its last fix. */
export async function placeNow(q: Queryable, t: Pick<Tracker, 'assetId' | 'position'>, settings: TrackerSettings): Promise<TrackerPlace> {
  const day = irishToday(t.position ? new Date(t.position.at) : new Date())
  const out = t.assetId ? await outWith(q, t.assetId) : undefined
  return placeOf({
    position: t.position,
    settings,
    onItem: !!t.assetId,
    outWith: out ? await heldJob(q, out.projectId) : undefined,
    heldFor: t.assetId && t.position ? await jobsHolding(q, t.assetId, day) : [],
    day,
  })
}

/**
 * Work a tracker's place out again and keep it, with when it began: a
 * place of the same kind, about the same job, keeps its "since". Tells
 * devices whether or not it changed, since the caller changed something
 * else of it too.
 */
export async function settlePlace(ctx: Ctx, id: string, settings: TrackerSettings, at = new Date()) {
  const t = await getTracker(ctx.tx, id, true)
  if (!t) return
  const place = await placeNow(ctx.tx, t, settings)
  if (!samePlace(place, t.place)) await ctx.tx.query('UPDATE trackers SET place = $2, place_since = $3 WHERE id = $1', [id, JSON.stringify(place), at.toISOString()])
  else if (JSON.stringify(place) !== JSON.stringify(t.place)) await ctx.tx.query('UPDATE trackers SET place = $2 WHERE id = $1', [id, JSON.stringify(place)])
  await emit(ctx, 'tracker', id, await getTracker(ctx.tx, id))
}
