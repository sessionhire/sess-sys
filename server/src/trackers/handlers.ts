import { TRACKER_SETTINGS_ID, trackerName, type CommandArgs } from '@sh/shared'
import { emit, Refused, type Ctx } from '../kernel.ts'
import { getAsset } from '../stock/store.ts'
import { settlePlace } from './place.ts'
import { getTracker, getTrackerSettings, trackerOnAsset, trackersInUse } from './store.ts'

/**
 * Trackers on kit (ADR 0107): turning them on, putting the warehouse on the
 * map, and putting each tracker on an item. Trackers themselves come from
 * their reports (routes.ts), never from a device, so there's no command to
 * add one: the office names it and puts it on an item once it has said
 * hello. One tracker an item: putting one on an item that has another
 * takes that one off, as moving a tracker from case to case would.
 */

async function emitSettings(ctx: Ctx) {
  await emit(ctx, 'trackerSettings', TRACKER_SETTINGS_ID, await getTrackerSettings(ctx.tx))
}

async function mustTracker(ctx: Ctx, id: string) {
  const t = await getTracker(ctx.tx, id, true)
  if (!t) throw new Refused({ code: 'not-found', message: "That tracker isn't in the app. It's added the first time it reports." })
  return t
}

/** Every tracker's place again, as the warehouse or the switch changed. */
async function settleAll(ctx: Ctx) {
  const settings = await getTrackerSettings(ctx.tx)
  for (const t of await trackersInUse(ctx.tx)) await settlePlace(ctx, t.id, settings)
}

type TrackerCommand = 'trackers.use' | 'trackers.home' | 'tracker.attach' | 'tracker.name' | 'tracker.archive'
type Handler<N extends TrackerCommand> = (ctx: Ctx, args: CommandArgs<N>) => Promise<void>

export const trackerHandlers: { [N in TrackerCommand]: Handler<N> } = {
  /** Only shows or hides them, and lets reports in or keeps them out: every tracker and report kept stays as it was. */
  async 'trackers.use'(ctx, a) {
    await ctx.tx.query(`INSERT INTO tracker_settings (id, used) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET used = EXCLUDED.used`, [TRACKER_SETTINGS_ID, a.on])
    await emitSettings(ctx)
    if (a.on) await settleAll(ctx)
  },

  async 'trackers.home'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO tracker_settings (id, home_lat, home_lng, radius_m) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET home_lat = EXCLUDED.home_lat, home_lng = EXCLUDED.home_lng, radius_m = EXCLUDED.radius_m`,
      [TRACKER_SETTINGS_ID, a.home?.lat ?? null, a.home?.lng ?? null, a.radiusM]
    )
    await emitSettings(ctx)
    await settleAll(ctx)
  },

  async 'tracker.attach'(ctx, a) {
    const t = await mustTracker(ctx, a.id)
    if (t.assetId === a.assetId) return
    if (a.assetId) {
      if (t.archived) throw new Refused({ code: 'conflict', message: `${trackerName(t)} is put away. Bring it back into use first.` })
      const asset = await getAsset(ctx.tx, a.assetId)
      if (!asset) throw new Refused({ code: 'not-found', message: "That item isn't in the stock list any more." })
      if (asset.status !== 'active') throw new Refused({ code: 'conflict', message: `${asset.number || 'That item'} is retired. Bring it back first, or put the tracker on another.` })
      const other = await trackerOnAsset(ctx.tx, a.assetId)
      if (other) {
        await ctx.tx.query('UPDATE trackers SET asset_id = NULL WHERE id = $1', [other.id])
        await settlePlace(ctx, other.id, await getTrackerSettings(ctx.tx))
      }
    }
    await ctx.tx.query('UPDATE trackers SET asset_id = $2 WHERE id = $1', [a.id, a.assetId])
    await settlePlace(ctx, a.id, await getTrackerSettings(ctx.tx))
  },

  async 'tracker.name'(ctx, a) {
    await mustTracker(ctx, a.id)
    await ctx.tx.query('UPDATE trackers SET name = $2 WHERE id = $1', [a.id, a.name])
    await emit(ctx, 'tracker', a.id, await getTracker(ctx.tx, a.id))
  },

  /** Put away comes off its item, so the item shows no tracker and nothing about it is to check. */
  async 'tracker.archive'(ctx, a) {
    const t = await mustTracker(ctx, a.id)
    if (t.archived === a.archived) return
    await ctx.tx.query(`UPDATE trackers SET archived = $2, asset_id = CASE WHEN $2 THEN NULL ELSE asset_id END WHERE id = $1`, [a.id, a.archived])
    await settlePlace(ctx, a.id, await getTrackerSettings(ctx.tx))
  },
}
