import { APPLICATION_KEPT_MONTHS, PAYMENT_KEPT_IDLE_MONTHS } from '@sh/shared'
import type { Db, Queryable } from '../db.ts'
import { APPLICATIONS_EXPIRED_ACTION, PAYMENTS_IDLE_ACTION } from '../history-words.ts'
import { serverChange } from '../kernel.ts'
import { removeApplication } from '../applications/handlers.ts'

/**
 * Keeping people's details no longer than they're needed (Colly, 24 November 2026, after the security check; ADR 0193).
 * Once a day, with the erasures:
 * - an application nobody has taken on or turned down for 6 months goes, as a turned-down one does (Crew › Applications
 *   says so for the last week);
 * - payment details go once nobody has booked or asked for that person for 12 months, and they were last given or
 *   changed over 12 months ago, so details given for someone not yet booked get a year too. Taking someone off the
 *   crew list (archiving them) clears theirs at once, in the same change.
 * Each run that removes something is one history entry, saying how many, never whose.
 */

class NothingToClear extends Error {}

const appsDue = (q: Queryable) =>
  q.query<{ id: string }>(`SELECT id FROM applications WHERE applied_at < now() - make_interval(months => $1) ORDER BY id`, [APPLICATION_KEPT_MONTHS])

/** Payment details of someone archived, or not booked, offered or asked for in 12 months, and not given in 12 months either. */
const paymentsDue = (q: Queryable) =>
  q.query<{ person_id: string }>(
    `SELECT d.person_id FROM payment_details d JOIN people p ON p.id = d.person_id
      WHERE p.archived
         OR (d.changed_at < now() - make_interval(months => $1)
             AND NOT EXISTS (
               SELECT 1 FROM offers o JOIN crew_calls c ON c.id = o.call_id
                WHERE o.person_id = d.person_id AND c.end_day >= (now() - make_interval(months => $1))::date))
      ORDER BY d.person_id`,
    [PAYMENT_KEPT_IDLE_MONTHS]
  )

export async function clearUnneededDetails(db: Db): Promise<{ applications: number; payments: number }> {
  const run = async <T extends object>(name: string, find: (q: Queryable) => Promise<{ rows: T[] }>, remove: (rows: T[], ctx: Parameters<Parameters<typeof serverChange>[2]>[0]) => Promise<void>) => {
    // Most days there's nothing, and that costs one read, without the lock or a history entry.
    if (!(await find(db)).rows.length) return 0
    try {
      return await serverChange(db, { name, args: {} }, async (ctx) => {
        const { rows } = await find(ctx.tx)
        if (!rows.length) throw new NothingToClear()
        await remove(rows, ctx)
        await ctx.tx.query(`UPDATE mutations SET args = $2 WHERE id = $1`, [ctx.mutationId, JSON.stringify({ count: rows.length })])
        return rows.length
      })
    } catch (err) {
      if (err instanceof NothingToClear) return 0
      throw err
    }
  }
  const applications = await run(APPLICATIONS_EXPIRED_ACTION, appsDue, async (rows, ctx) => {
    for (const r of rows) await removeApplication(ctx, r.id)
  })
  const payments = await run(PAYMENTS_IDLE_ACTION, paymentsDue, async (rows, ctx) => {
    await ctx.tx.query('DELETE FROM payment_details WHERE person_id = ANY($1::text[])', [rows.map((r) => r.person_id)])
  })
  return { applications, payments }
}
