import { DEFAULT_TRACKER_RADIUS_M, TRACKER_SETTINGS_ID, type Tracker, type TrackerPlace, type TrackerSettings } from '@sh/shared'
import type { Queryable } from '../db.ts'

/** Reading trackers and their settings back as devices see them (ADR 0107). */

type Row = Record<string, any>

const ISO = (col: string) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
const TRACKER = `id, maker, serial, name, asset_id, ${ISO('first_heard')} AS first_heard, ${ISO('last_heard')} AS last_heard,
  lat, lng, accuracy_m, ${ISO('fix_at')} AS fix_at, battery_mv, place, ${ISO('place_since')} AS place_since, archived`

export const toTracker = (r: Row): Tracker => ({
  id: r.id,
  maker: r.maker,
  serial: r.serial,
  name: r.name,
  assetId: r.asset_id ?? null,
  firstHeard: r.first_heard,
  lastHeard: r.last_heard,
  position: r.lat === null || r.lat === undefined ? null : { lat: r.lat, lng: r.lng, accuracyM: r.accuracy_m ?? null, at: r.fix_at },
  batteryMv: r.battery_mv ?? null,
  place: r.place as TrackerPlace,
  placeSince: r.place_since,
  archived: r.archived,
})

export async function getTracker(q: Queryable, id: string, lock = false): Promise<Tracker | undefined> {
  const { rows } = await q.query(`SELECT ${TRACKER} FROM trackers WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id])
  return rows[0] ? toTracker(rows[0]) : undefined
}

/** Every tracker in use, for working out each one's place again when the warehouse moves. */
export async function trackersInUse(q: Queryable): Promise<Tracker[]> {
  const { rows } = await q.query(`SELECT ${TRACKER} FROM trackers WHERE NOT archived ORDER BY id`)
  return rows.map(toTracker)
}

/** The tracker in use on an item, if any. */
export async function trackerOnAsset(q: Queryable, assetId: string): Promise<Tracker | undefined> {
  const { rows } = await q.query(`SELECT ${TRACKER} FROM trackers WHERE asset_id = $1`, [assetId])
  return rows[0] ? toTracker(rows[0]) : undefined
}

export async function getTrackerSettings(q: Queryable): Promise<TrackerSettings> {
  const { rows } = await q.query<{ used: boolean; home_lat: number | null; home_lng: number | null; radius_m: number }>(
    'SELECT used, home_lat, home_lng, radius_m FROM tracker_settings WHERE id = $1',
    [TRACKER_SETTINGS_ID]
  )
  const r = rows[0]
  return {
    id: TRACKER_SETTINGS_ID,
    on: r?.used === true,
    home: r && r.home_lat !== null && r.home_lng !== null ? { lat: r.home_lat, lng: r.home_lng } : null,
    radiusM: r?.radius_m ?? DEFAULT_TRACKER_RADIUS_M,
  }
}
