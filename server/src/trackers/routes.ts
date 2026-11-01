import { createHash, timingSafeEqual } from 'node:crypto'
import { trackerId, type TrackerSetup } from '@sh/shared'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Db } from '../db.ts'
import { publicOrigin } from '../http.ts'
import { serverChange } from '../kernel.ts'
import { readDigitalMatter, type TrackerReport } from './digital-matter.ts'
import { settlePlace } from './place.ts'
import { getTrackerSettings } from './store.ts'

/**
 * Where trackers' reports come in (ADR 0107): Digital Matter's server posts
 * each one here, as its HTTP connector is set up to. It's a way in from
 * outside, so it's shut unless the server has a key for it (TRACKERS_KEY)
 * and the request carries it, as a bearer token or the password of basic
 * sign-in, both of which the connector can send. While the office has
 * trackers off it answers that they're off and keeps nothing: Digital
 * Matter keeps a report until it's taken, so nothing is lost, and they come
 * in once trackers are on.
 *
 * Reports are the server's own bookkeeping, not anyone's change, so they
 * aren't in the history; putting a tracker on an item is.
 */

export const DIGITAL_MATTER_PATH = '/api/trackers/digital-matter'

/** Whether the request carries the key: "Bearer <key>", or basic sign-in with it as the password, any user name. */
export function carriesKey(req: Pick<FastifyRequest, 'headers'>, key: string): boolean {
  const header = req.headers.authorization
  if (typeof header !== 'string') return false
  const [scheme, value = ''] = header.trim().split(/\s+/, 2)
  let given: string | undefined
  if (scheme?.toLowerCase() === 'bearer') given = value
  else if (scheme?.toLowerCase() === 'basic') {
    const decoded = Buffer.from(value, 'base64').toString('utf8')
    const colon = decoded.indexOf(':')
    given = colon >= 0 ? decoded.slice(colon + 1) : undefined
  }
  if (!given) return false
  // Compared as hashes, so the time taken says nothing of the key's length or letters.
  const hash = (s: string) => createHash('sha256').update(s, 'utf8').digest()
  return timingSafeEqual(hash(given), hash(key))
}

/**
 * Keep the reports, and bring each tracker up to date: made the first time
 * it's heard from, its newest fix and battery, when it was last heard
 * from, and where that is against where its item should be. A report that
 * arrives late, after a newer one, is kept but moves nothing on.
 */
export async function takeReports(db: Db, reports: readonly TrackerReport[], now = new Date()): Promise<number> {
  if (reports.length === 0) return 0
  const serials = [...new Set(reports.map((r) => r.serial))]
  return serverChange(db, undefined, async (ctx) => {
    const settings = await getTrackerSettings(ctx.tx)
    let kept = 0
    for (const serial of serials) {
      const id = trackerId('digital-matter', serial)
      await ctx.tx.query(
        `INSERT INTO trackers (id, maker, serial, first_heard, last_heard, place_since) VALUES ($1, 'digital-matter', $2, $3, $3, $3)
         ON CONFLICT (id) DO UPDATE SET last_heard = greatest(trackers.last_heard, EXCLUDED.last_heard)`,
        [id, serial, now.toISOString()]
      )
      const mine = reports.filter((r) => r.serial === serial)
      for (const r of mine) {
        const { rows } = await ctx.tx.query(
          `INSERT INTO tracker_reports (tracker_id, at, seq, received_at, lat, lng, accuracy_m, battery_mv, reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (tracker_id, at, seq) DO NOTHING RETURNING id`,
          [id, r.at, r.seq, now.toISOString(), r.fix?.lat ?? null, r.fix?.lng ?? null, r.fix?.accuracyM ?? null, r.batteryMv, r.reason]
        )
        kept += rows.length
      }
      const fix = mine.filter((r) => r.fix).sort((a, b) => b.fix!.at.localeCompare(a.fix!.at))[0]?.fix
      if (fix)
        await ctx.tx.query(
          `UPDATE trackers SET lat = $2, lng = $3, accuracy_m = $4, fix_at = $5 WHERE id = $1 AND (fix_at IS NULL OR fix_at < $5::timestamptz)`,
          [id, fix.lat, fix.lng, fix.accuracyM, fix.at]
        )
      const battery = mine.filter((r) => r.batteryMv !== null).sort((a, b) => b.at.localeCompare(a.at))[0]
      if (battery) await ctx.tx.query('UPDATE trackers SET battery_mv = $2 WHERE id = $1', [id, battery.batteryMv])
      await settlePlace(ctx, id, settings, now)
    }
    return kept
  })
}

export function registerTrackerRoutes(app: FastifyInstance, { db, key, onChange }: { db: Db; key: string | undefined; onChange: () => void }) {
  app.post(DIGITAL_MATTER_PATH, { config: { public: true } }, async (req, reply) => {
    if (!key) return reply.code(503).send({ error: 'Trackers are not set up on this server: TRACKERS_KEY is not set.' })
    if (!carriesKey(req, key)) return reply.code(401).send({ error: 'That is not the trackers key.' })
    if (!(await getTrackerSettings(db.reads)).on) return reply.code(503).send({ error: 'Trackers are off in the app. Turn them on under Admin › Connections.' })
    const read = readDigitalMatter(req.body)
    if ('problem' in read) return reply.code(400).send({ error: read.problem })
    const kept = await takeReports(db, read.reports)
    if (kept > 0 || read.reports.length > 0) onChange()
    return { ok: true, reports: read.reports.length, kept }
  })

  // For Admin: whether the server has the key, and the address to give Digital Matter. Never the key itself.
  app.get('/api/trackers/setup', { config: { needs: 'settings' } }, async (req): Promise<TrackerSetup> => ({
    keySet: !!key,
    address: `${publicOrigin(req)}${DIGITAL_MATTER_PATH}`,
  }))
}
