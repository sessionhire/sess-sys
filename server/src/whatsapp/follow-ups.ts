import { jobOnHold, STOPPED, type ProjectStatus } from '@sh/shared'
import type { Ctx } from '../kernel.ts'
import { getPerson } from '../crew/store.ts'
import { whatsappSetting } from '../office/store.ts'
import { reachOf } from './whatsapp.ts'

/**
 * What a job's own change sends crew on WhatsApp (ADR 0125, HOLD), queued in the same change so it goes only if the
 * change is made, and sent by the server just after, as an offer's message is:
 *
 * - confirmed after being on hold: each person whose offer went saying HOLD, and is still asked or booked, is told
 *   straight away that it's going ahead (Colly, 11 Nov 2026: no wait);
 * - cancelled or lost: each person asked or booked on it who had an offer on WhatsApp is told it isn't.
 *
 * Called before the job's crew are taken off a stopped job, so who was asked or booked is still to be read.
 */
export async function queueJobWhatsApp(ctx: Ctx, projectId: string, before: ProjectStatus, after: ProjectStatus | undefined) {
  if (!after || after === before) return
  const setting = await whatsappSetting(ctx.tx)
  if (setting.mode === 'off') return
  const queue = async (rows: { id: string; offer_id: string; person_id: string }[], kind: 'confirmed' | 'cancelled') => {
    for (const r of rows) {
      const person = await getPerson(ctx.tx, r.person_id)
      const to = person && !person.archived ? reachOf(setting, person) : undefined
      if (!to) continue
      await ctx.tx.query(
        `INSERT INTO whatsapp_messages (id, offer_id, person_id, project_id, kind, to_number, state) VALUES ($1, $2, $3, $4, $5, $6, 'queued') ON CONFLICT (id) DO NOTHING`,
        [r.id, r.offer_id, r.person_id, projectId, kind, to]
      )
    }
  }
  if (after === 'confirmed' && jobOnHold(before)) {
    // One follow-up for each HOLD message, so a job put back on hold and confirmed again doesn't say it twice.
    const { rows } = await ctx.tx.query<{ id: string; offer_id: string; person_id: string }>(
      `SELECT 'confirmed-' || w.id AS id, w.offer_id, w.person_id FROM whatsapp_messages w
         JOIN offers o ON o.id = w.offer_id JOIN crew_calls c ON c.id = o.call_id
        WHERE c.project_id = $1 AND c.status = 'open' AND w.kind = 'offer' AND w.hold AND w.state IN ('sent', 'delivered', 'read')
          AND o.status IN ('offered', 'countered', 'accepted', 'confirmed')`,
      [projectId]
    )
    await queue(rows, 'confirmed')
  }
  if (STOPPED.includes(after) && !STOPPED.includes(before)) {
    // One for each person, however many of the job's calls they were on.
    const { rows } = await ctx.tx.query<{ offer_id: string; person_id: string }>(
      `SELECT DISTINCT ON (o.person_id) o.id AS offer_id, o.person_id FROM offers o JOIN crew_calls c ON c.id = o.call_id
        WHERE c.project_id = $1 AND c.status = 'open' AND o.status IN ('offered', 'countered', 'accepted', 'confirmed')
          AND EXISTS (SELECT 1 FROM whatsapp_messages w WHERE w.offer_id = o.id AND w.kind = 'offer' AND w.state IN ('sent', 'delivered', 'read'))
        ORDER BY o.person_id, c.start_day`,
      [projectId]
    )
    await queue(rows.map((r) => ({ ...r, id: `cancelled-${r.offer_id}` })), 'cancelled')
  }
}
