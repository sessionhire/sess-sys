import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { firstName, offerTemplateValues, type CommandArgs, type CommandName, type CrewCall, type MutationResult, type Person } from '@sh/shared'
import { applyMutation } from '../commands.ts'
import { getCall, getOffer, getPerson } from '../crew/store.ts'
import type { Db } from '../db.ts'
import { emit, serverChange } from '../kernel.ts'
import { officeFor } from '../office/store.ts'
import type { WhatsApp } from './whatsapp.ts'

/**
 * What comes back from WhatsApp (ADR 0125, part 3). Meta posts to /whatsapp/hook: its receipts for each message
 * (sent, delivered, read, or not delivered and why), which the offer's row shows; and what crew send, which is a
 * button pressed on an offer or something written.
 *
 * - **Yes, I can do it** accepts the offer, all its days, as their own answer would on their page.
 * - **No, I can't** asks once more, with *Decline it* and *Keep it open*, as their page does: a slip of the thumb
 *   shouldn't lose them a job.
 * - **STOP** turns offers on WhatsApp off for them; anything else written is answered with where to answer and the
 *   office's number, as nobody reads this number.
 *
 * A button counts only from the number its offer went to. Each is answered once, however often Meta sends it, and
 * every answer goes in the history as theirs, "on WhatsApp".
 */

/** Whether a post is Meta's: the X-Hub-Signature-256 header is the body signed with the app's secret. */
export function signedByMeta(secret: string, raw: Buffer, header: string | undefined): boolean {
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header?.trim() ?? '')
  if (!m) return false
  const want = createHmac('sha256', secret).update(raw).digest()
  const got = Buffer.from(m[1]!, 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}

/** The parts of Meta's post that the app reads; everything else in it is left alone. */
export interface HookBody {
  object?: string
  entry?: { changes?: { field?: string; value?: HookValue }[] }[]
}
interface HookValue {
  metadata?: { phone_number_id?: string }
  messages?: Incoming[]
  statuses?: Receipt[]
}
interface Incoming {
  id: string
  from: string
  type: string
  text?: { body?: string }
  button?: { payload?: string; text?: string }
  interactive?: { type?: string; button_reply?: { id?: string; title?: string } }
}
interface Receipt {
  id: string
  status: string
  timestamp?: string
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[]
}

/** How far each receipt goes: a later one never takes a message back (a "delivered" arriving after its "read"). */
const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 }

/** Writing this turns offers on WhatsApp off, as their page's button does. */
const STOP = new Set(['stop', 'stop offers', 'stop all', 'unsubscribe', 'opt out'])
/** "Stop!", " STOP. " and "stop  offers" all read as STOP; worked out in one pass over what they wrote, whatever its length. */
const isStop = (text: string) => STOP.has(text.toLowerCase().replace(/[.!]/g, '').split(/\s+/).filter(Boolean).join(' '))

export interface AnswersOptions {
  onChange: () => void
  log?: { warn: (o: object, msg: string) => void }
}

export class WhatsAppAnswers {
  constructor(
    private readonly db: Db,
    private readonly whatsapp: WhatsApp,
    private readonly options: AnswersOptions
  ) {}

  /** Everything in one post from Meta, for this number only: a Meta app can carry other numbers. */
  async take(body: HookBody, origin: string): Promise<void> {
    if (body.object !== 'whatsapp_business_account') return
    const ours = this.whatsapp.config?.phoneNumberId
    for (const entry of body.entry ?? [])
      for (const change of entry.changes ?? []) {
        const value = change.value
        if (change.field !== 'messages' || !value || value.metadata?.phone_number_id !== ours) continue
        for (const r of value.statuses ?? []) await this.receipt(r)
        for (const m of value.messages ?? []) await this.incoming(m, origin)
      }
  }

  /** Meta's word on a message the app sent: the offer's row shows it. */
  private async receipt(r: Receipt) {
    if (!(r.status in RANK) || r.status === 'queued') return
    const at = r.timestamp && /^\d+$/.test(r.timestamp) ? new Date(Number(r.timestamp) * 1000) : new Date()
    const e = r.errors?.[0]
    const problem = r.status === 'failed' ? e?.error_data?.details || e?.message || e?.title || 'WhatsApp couldn’t deliver it.' : null
    const { rows } = await this.db.query<{ offer_id: string | null }>(
      `UPDATE whatsapp_messages
          SET state = $2,
              sent_at = CASE WHEN $2 = 'sent' THEN $3::timestamptz ELSE sent_at END,
              delivered_at = CASE WHEN $2 = 'delivered' THEN $3::timestamptz ELSE delivered_at END,
              read_at = CASE WHEN $2 = 'read' THEN $3::timestamptz ELSE read_at END,
              problem = coalesce($4::text, problem)
        WHERE wamid = $1 AND (CASE state WHEN 'queued' THEN 0 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 4 END) < $5::int
        RETURNING offer_id`,
      [r.id, r.status, at, problem, RANK[r.status]]
    )
    const offerId = rows[0]?.offer_id
    if (!offerId) return
    await serverChange(this.db, undefined, async (ctx) => {
      const o = await getOffer(ctx.tx, offerId)
      if (o) await emit(ctx, 'offer', o.id, o)
    })
    this.options.onChange()
  }

  /** A button pressed or something written, acted on once. */
  private async incoming(m: Incoming, origin: string) {
    if (!m.id || !m.from) return
    const seen = await this.db.query(`SELECT 1 FROM whatsapp_inbound WHERE wamid = $1`, [m.id])
    if (seen.rows.length) return
    const from = m.from.replace(/\D/g, '')
    const pressed = m.type === 'button' ? m.button?.payload : m.type === 'interactive' && m.interactive?.type === 'button_reply' ? m.interactive.button_reply?.id : undefined
    if (pressed) await this.pressed(m.id, from, pressed, origin)
    else await this.written(m.id, from, m.type === 'text' ? (m.text?.body ?? '') : '', origin)
    await this.db.query(`INSERT INTO whatsapp_inbound (wamid) VALUES ($1) ON CONFLICT DO NOTHING`, [m.id])
  }

  private async pressed(wamid: string, from: string, payload: string, origin: string) {
    const at = payload.indexOf(':')
    const what = payload.slice(0, at)
    const offerId = payload.slice(at + 1)
    if (at < 0 || !['yes', 'no', 'decline', 'keep'].includes(what)) return
    // Theirs only: the offer's message went to this very number. Anyone else's press is ignored, and nothing is said.
    const { rows } = await this.db.query(`SELECT 1 FROM whatsapp_messages WHERE offer_id = $1 AND to_number = $2 LIMIT 1`, [offerId, from])
    if (!rows.length) return
    const offer = await getOffer(this.db, offerId)
    const person = offer && (await getPerson(this.db, offer.personId))
    const call = offer && (await getCall(this.db, offer.callId))
    if (!offer || !person || !call) return this.say(from, 'That offer isn’t there any more. Ask the office if you think it should be.')
    const page = pageOf(origin, person)
    const job = jobOf(person, call)
    // A button on an old message, pressed after they answered: say where things stand rather than change it.
    if (offer.status === 'accepted' || offer.status === 'confirmed') {
      if (what === 'yes') return this.say(from, `You’re already down for ${job}. Your page has the details: ${page}`)
      if (what !== 'keep') return this.say(from, `You said yes to ${job}. If you can’t make it now, say so on your page, so the office can find cover: ${page}`)
    }
    if (what === 'no')
      return this.ask(from, `Decline ${job}? The office will offer it to someone else.`, [
        { id: `decline:${offer.id}`, title: 'Decline it' },
        { id: `keep:${offer.id}`, title: 'Keep it open' },
      ])
    if (what === 'keep') return this.say(from, `Kept open. Answer here when you know, or on your page: ${page}`)
    const result =
      what === 'yes'
        ? await this.run(wamid, person.id, 'offer.respond', { id: offer.id, answer: 'accept', days: null, note: offer.note })
        : await this.run(wamid, person.id, 'offer.respond', { id: offer.id, answer: 'decline', note: offer.note })
    if (result.duplicate) return
    if (result.status === 'rejected') return this.say(from, `${result.reason.message} Your page has the rest: ${page}`)
    return this.say(
      from,
      what === 'yes'
        ? `Thanks, ${firstName(person)}. You’re down for ${job}. The office will confirm it with you. Your page has the details: ${page}`
        : `Thanks for letting us know. You’ve declined ${job}.`
    )
  }

  /** Something written, or a photo or voice note: STOP, or where to answer instead. From numbers the app never messaged, nothing. */
  private async written(wamid: string, from: string, text: string, origin: string) {
    const { rows } = await this.db.query<{ person_id: string }>(`SELECT person_id FROM whatsapp_messages WHERE to_number = $1 ORDER BY made_at DESC LIMIT 1`, [from])
    const person = rows[0] && (await getPerson(this.db, rows[0].person_id))
    if (!person) return
    const page = pageOf(origin, person)
    if (isStop(text)) {
      const result = await this.run(wamid, person.id, 'person.whatsapp', { id: person.id, on: false })
      if (result.duplicate) return
      return this.say(from, `Done: no more offers on WhatsApp. They’ll still be on your page, where you can turn this back on: ${page}`)
    }
    const office = await officeFor(this.db)
    const call = office?.phone ? ` For anything else, ring ${office.name} on ${office.phone}.` : office?.email ? ` For anything else, email ${office.name} at ${office.email}.` : ''
    return this.say(from, `Nobody reads messages written to this number. Answer an offer with its buttons, or on your page: ${page}.${call} Write STOP to get no more offers here.`)
  }

  /** Their answer, as theirs: the history says "on WhatsApp". The command's id comes from Meta's, so a second send of it is the same answer. */
  private async run<N extends CommandName>(wamid: string, personId: string, name: N, args: CommandArgs<N>): Promise<MutationResult> {
    const id = `wa${createHash('sha256').update(wamid).digest('hex').slice(0, 19)}`
    const result = await applyMutation(this.db, `whatsapp:${personId}`, { id, name, args, createdAt: new Date().toISOString() }, { via: 'whatsapp' })
    if (result.status === 'applied' && !result.duplicate) this.options.onChange()
    return result
  }

  private async say(to: string, text: string) {
    try {
      await this.whatsapp.api?.sendText(to, text)
    } catch (err) {
      this.options.log?.warn({ err: err instanceof Error ? err.message : String(err) }, 'A WhatsApp answer could not be sent')
    }
  }

  private async ask(to: string, text: string, buttons: { id: string; title: string }[]) {
    try {
      await this.whatsapp.api?.sendButtons(to, text, buttons)
    } catch (err) {
      this.options.log?.warn({ err: err instanceof Error ? err.message : String(err) }, 'A WhatsApp question could not be sent')
    }
  }
}

const pageOf = (origin: string, person: Person) => `${origin}/f/${person.linkToken}`
/** "Electric Picnic (Build)", as the offer named it. */
const jobOf = (person: Person, call: CrewCall) => offerTemplateValues(person, call)[1]!
