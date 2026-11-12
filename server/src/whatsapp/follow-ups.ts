import { irishToday, jobOnHold, LIVE, newId, offerHeard, STOPPED, whatsappFollows, type CrewCall, type Offer, type ProjectStatus, type WhatsAppSetting } from '@sh/shared'
import type { Ctx } from '../kernel.ts'
import { getCall, getOffer, getPerson, offersForCall } from '../crew/store.ts'
import { getProject } from '../projects/store.ts'
import { whatsappSetting } from '../office/store.ts'
import { reachOf } from './whatsapp.ts'

/**
 * What follows an offer on WhatsApp (ADR 0125, HOLD; ADR 0154), queued in the change that makes it news, so it goes only
 * if the change is made, and sent by the server just after, as an offer's message is:
 *
 * - booked: the office confirmed them on a job the client has said yes to, or the client said yes to a job they were
 *   picked for;
 * - the call time of a call they're asked for or booked on moved;
 * - not needed: their offer was filled by someone else, withdrawn, or released, or its call cancelled;
 * - a job they were asked to hold the day for is confirmed, or a job they're asked for or booked on is cancelled or lost.
 *
 * Each goes to anyone WhatsApp reaches who has heard of the offer, whether or not the offer itself went on WhatsApp
 * (whatsappFollows; Colly's answer to question 7 of the audit of 12 November 2026). Nothing goes about a call whose days
 * are all past: it's a record then, not news. Each message's id says what it's news of, so each piece goes once.
 */

type FollowUp = 'confirmed' | 'cancelled' | 'booked' | 'call-time' | 'not-needed'

/** Queues one message to an offer's person when what follows an offer goes to them. False when it doesn't. */
async function queue(ctx: Ctx, setting: WhatsAppSetting, offer: Offer, kind: FollowUp, id: string, projectId: string | null): Promise<boolean> {
  const person = await getPerson(ctx.tx, offer.personId)
  if (!person || person.archived || !whatsappFollows(setting, person, offerHeard(offer))) return false
  await ctx.tx.query(
    `INSERT INTO whatsapp_messages (id, offer_id, person_id, project_id, kind, to_number, state) VALUES ($1, $2, $3, $4, $5, $6, 'queued') ON CONFLICT (id) DO NOTHING`,
    [id, offer.id, person.id, projectId, kind, reachOf(setting, person)]
  )
  return true
}

/** A call whose days are all before today is a record now: nothing about it is news. */
const over = (call: Pick<CrewCall, 'end'>) => call.end < irishToday()

/** WhatsApp's setting, or nothing when it's off and nothing can go. */
async function on(ctx: Ctx): Promise<WhatsAppSetting | undefined> {
  const setting = await whatsappSetting(ctx.tx)
  return setting.mode === 'off' ? undefined : setting
}

/**
 * The office confirmed someone: on a job the client has said yes to, or a call that isn't part of a job, they're told
 * they're booked. Picked for a job the client hasn't said yes to, they hold the day, and hear they're booked when the
 * client says yes (queueJobWhatsApp).
 */
export async function queueBooked(ctx: Ctx, offerId: string) {
  const setting = await on(ctx)
  const offer = setting && (await getOffer(ctx.tx, offerId))
  const call = offer && (await getCall(ctx.tx, offer.callId))
  if (!setting || !offer || !call || offer.status !== 'confirmed' || call.status !== 'open' || over(call)) return
  const job = call.projectId ? await getProject(ctx.tx, call.projectId) : undefined
  if (job && job.status !== 'confirmed') return
  await queue(ctx, setting, offer, 'booked', `booked-${offer.id}`, call.projectId)
}

/**
 * Offers that ended on the office's side (audit finding 8): filled by someone else, withdrawn, released, or their call
 * cancelled. Each person is told they're no longer needed, and why, in their page's words. Not for a job that stopped,
 * whose own word goes (queueJobWhatsApp), nor for their own No or Can't make it, which they gave.
 */
export async function queueNotNeeded(ctx: Ctx, offerIds: readonly string[]) {
  const setting = offerIds.length ? await on(ctx) : undefined
  if (!setting) return
  for (const id of offerIds) {
    const offer = await getOffer(ctx.tx, id)
    const call = offer && (await getCall(ctx.tx, offer.callId))
    if (!offer || !call || (offer.status !== 'filled' && offer.status !== 'cancelled') || over(call)) continue
    await queue(ctx, setting, offer, 'not-needed', `not-needed-${offer.id}`, call.projectId)
  }
}

/**
 * A call's call time moved (audit finding 4): everyone asked or booked on it is told the new one. One already waiting to
 * go for someone says the call time as it is when it goes, so none is added beside it.
 */
export async function queueCallTime(ctx: Ctx, callId: string) {
  const setting = await on(ctx)
  const call = setting && (await getCall(ctx.tx, callId))
  if (!setting || !call || call.status !== 'open' || over(call)) return
  const job = call.projectId ? await getProject(ctx.tx, call.projectId) : undefined
  if (job && STOPPED.includes(job.status)) return
  for (const o of await offersForCall(ctx.tx, call.id)) {
    if (!LIVE.includes(o.status)) continue
    const waiting = await ctx.tx.query(`SELECT 1 FROM whatsapp_messages WHERE offer_id = $1 AND kind = 'call-time' AND state = 'queued' LIMIT 1`, [o.id])
    if (waiting.rows.length) continue
    await queue(ctx, setting, o, 'call-time', `call-time-${newId()}`, call.projectId)
  }
}

/**
 * What a job's own change sends its crew (ADR 0125, HOLD; ADR 0154). Called before the job's crew are taken off a stopped
 * job, so who was asked or booked is still to be read.
 *
 * - Confirmed after its crew were asked to hold the day: each person picked is told they're booked, and each still
 *   asked that it's going ahead, straight away (Colly, 11 November 2026: no wait). Once for each offer, so a job that
 *   went back to a quote and was confirmed again says nothing new.
 * - Cancelled or lost: each person asked or booked on it is told it isn't going ahead, once, however many of its calls
 *   they're on.
 */
export async function queueJobWhatsApp(ctx: Ctx, projectId: string, before: ProjectStatus, after: ProjectStatus | undefined) {
  if (!after || after === before) return
  const confirmed = after === 'confirmed' && jobOnHold(before)
  const stopped = STOPPED.includes(after) && !STOPPED.includes(before)
  const setting = confirmed || stopped ? await on(ctx) : undefined
  if (!setting) return
  // Everyone asked or booked on its open calls that aren't over, in the order of the calls.
  const { rows } = await ctx.tx.query<{ id: string }>(
    `SELECT o.id FROM offers o JOIN crew_calls c ON c.id = o.call_id
      WHERE c.project_id = $1 AND c.status = 'open' AND c.end_day >= $2 AND o.status IN ('offered', 'countered', 'accepted', 'confirmed')
      ORDER BY c.start_day, c.id, o.id`,
    [projectId, irishToday()]
  )
  const offers: Offer[] = []
  for (const r of rows) {
    const o = await getOffer(ctx.tx, r.id)
    if (o) offers.push(o)
  }
  if (confirmed)
    for (const o of offers) {
      if (o.status === 'confirmed') await queue(ctx, setting, o, 'booked', `booked-${o.id}`, projectId)
      else {
        // Any confirmed message for the offer counts, including one queued under the id 1.162.0 gave it ('confirmed-' and the HOLD message's id).
        const said = await ctx.tx.query(`SELECT 1 FROM whatsapp_messages WHERE offer_id = $1 AND kind = 'confirmed' LIMIT 1`, [o.id])
        if (!said.rows.length) await queue(ctx, setting, o, 'confirmed', `confirmed-${o.id}`, projectId)
      }
    }
  if (stopped) {
    const told = new Set<string>()
    for (const o of offers) if (!told.has(o.personId) && (await queue(ctx, setting, o, 'cancelled', `cancelled-${o.id}`, projectId))) told.add(o.personId)
  }
}
