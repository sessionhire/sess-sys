import {
  followUpTemplateValues,
  jobOnHold,
  offerTemplateValues,
  STOPPED,
  WHATSAPP_CANCELLED_TEMPLATE,
  WHATSAPP_CONFIRMED_TEMPLATE,
  WHATSAPP_OFFER_TEMPLATE,
} from '@sh/shared'
import type { Db, Queryable } from '../db.ts'
import { emit, serverChange } from '../kernel.ts'
import { getCall, getOffer, getPerson } from '../crew/store.ts'
import { getProject } from '../projects/store.ts'
import { whatsappSetting } from '../office/store.ts'
import { WhatsAppRefused, type TemplateComponent } from './api.ts'
import { reachOf, type WhatsApp } from './whatsapp.ts'

/**
 * Sends what's queued for WhatsApp (ADR 0125). An offer queues its message in the same change that makes it, so it
 * goes only if the offer was made; this sends it just after, as soon as anything changes and once a minute besides,
 * so the office never waits on Meta and a message queued while Meta was away goes when it's back.
 *
 * Each message is taken under a row lock that another server skips, so two servers never send the same one. One
 * whose offer is no longer open, whose person turned WhatsApp off or whose number isn't the one queued any more, or
 * that waited a day, isn't sent: it's marked failed with why, and the office's own way (the link, the Send panel) stands.
 *
 * Three kinds go (ADR 0125, HOLD): the offer, saying HOLD while the client hasn't said yes; the follow-up when that
 * job is confirmed a while later; and the word that a job they were asked for or booked on is cancelled or lost.
 */

const EVERY_MS = 60_000
/** A message Meta couldn't take for a passing reason is tried this many times in all. */
const TRIES = 5
/** After a passing problem, a message waits this long before it's tried again. */
const AGAIN_MS = 50_000
/** Older than this, an offer's message would be news nobody wants: it isn't sent. */
const STALE_MS = 24 * 60 * 60_000

interface Queued {
  id: string
  offer_id: string | null
  project_id: string | null
  person_id: string
  kind: string
  to_number: string
  made_at: Date
  tries: number
}

export interface SenderOptions {
  log?: { warn: (o: object, msg: string) => void }
  report?: (err: unknown) => void
  now?: () => Date
  /** A message went, or won't: its offer's row says so on devices. */
  onSent?: () => void
}

export class WhatsAppSender {
  private timer: NodeJS.Timeout | undefined
  private running: Promise<void> | undefined
  private again = false
  private readonly now: () => Date

  constructor(
    private readonly db: Db,
    private readonly whatsapp: WhatsApp,
    private readonly options: SenderOptions = {}
  ) {
    this.now = options.now ?? (() => new Date())
  }

  start() {
    if (this.timer || !this.whatsapp.configured) return
    this.timer = setInterval(() => void this.kick(), EVERY_MS)
    this.timer.unref()
    void this.kick()
  }

  stop() {
    clearInterval(this.timer)
    this.timer = undefined
  }

  /** Something changed: send what's queued. A kick while sending goes round once more after, so nothing waits a minute. */
  kick(): Promise<void> {
    // Not set up, nothing can go: what's queued waits, and the server takes no look for it.
    if (!this.whatsapp.configured) return Promise.resolve()
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      do {
        this.again = false
        try {
          for (let done = await this.sendOne(); done; done = await this.sendOne()) await this.show(done.offerId)
        } catch (err) {
          this.options.log?.warn({ err: err instanceof Error ? err.message : String(err) }, 'WhatsApp messages could not be sent')
          this.options.report?.(err)
        }
      } while (this.again)
    })().finally(() => (this.running = undefined))
    return this.running
  }

  /** The offer's row as it now is, for devices: "sent on WhatsApp", or not and why. */
  private async show(offerId: string | null) {
    if (!offerId) return
    await serverChange(this.db, undefined, async (ctx) => {
      const o = await getOffer(ctx.tx, offerId)
      if (o) await emit(ctx, 'offer', o.id, o)
    })
    this.options.onSent?.()
  }

  /**
   * Takes the oldest queued message and sends it, or says why not, answering its offer to show. False when there's
   * none left to take, or when Meta is away and the rest wait.
   */
  private async sendOne(): Promise<false | { offerId: string | null }> {
    return this.db.transaction(async (tx) => {
      const { rows } = await tx.query<Queued>(
        `SELECT id, offer_id, project_id, person_id, kind, to_number, made_at, tries FROM whatsapp_messages
         WHERE state = 'queued' AND (tried_at IS NULL OR tried_at < $1) ORDER BY made_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [new Date(this.now().getTime() - AGAIN_MS)]
      )
      const m = rows[0]
      if (!m) return false
      const fail = (problem: string) => tx.query(`UPDATE whatsapp_messages SET state = 'failed', problem = $2, tries = tries + 1, tried_at = $3 WHERE id = $1`, [m.id, problem, this.now()])
      const ready = await this.ready(tx, m)
      if (typeof ready === 'string') {
        await fail(ready)
        return { offerId: m.offer_id }
      }
      try {
        const wamid = await this.whatsapp.api!.sendTemplate(m.to_number, ready.template, ready.components)
        await tx.query(`UPDATE whatsapp_messages SET state = 'sent', wamid = $2, sent_at = $3, problem = NULL, tries = tries + 1, tried_at = $3, hold = $4 WHERE id = $1`, [
          m.id,
          wamid,
          this.now(),
          ready.hold,
        ])
      } catch (err) {
        const why = err instanceof Error ? err.message : String(err)
        // Meta saying no to this message (a number not on WhatsApp, a template not approved) won't change by trying again; Meta away, or too many at once, will.
        const passing = !(err instanceof WhatsAppRefused) || err.status === 429 || err.status >= 500
        if (passing && m.tries + 1 < TRIES) await tx.query(`UPDATE whatsapp_messages SET problem = $2, tries = tries + 1, tried_at = $3 WHERE id = $1`, [m.id, why, this.now()])
        else await fail(why)
        // A passing problem leaves the rest for the next round, rather than trying each in turn against a Meta that's away.
        if (passing) return false
      }
      return { offerId: m.offer_id }
    })
  }

  /** The template, its blanks and buttons, or why it isn't to go after all. */
  private async ready(q: Queryable, m: Queued): Promise<{ template: string; components: TemplateComponent[]; hold: boolean } | string> {
    if (!this.whatsapp.api) return 'WhatsApp isn’t set up on the server.'
    if (this.now().getTime() - new Date(m.made_at).getTime() > STALE_MS) return 'It waited more than a day to go, so it wasn’t sent.'
    if (!['offer', 'confirmed', 'cancelled'].includes(m.kind) || !m.offer_id) return 'Not a kind of message this version sends.'
    const offer = await getOffer(q, m.offer_id)
    const call = offer && (await getCall(q, offer.callId))
    const person = offer && (await getPerson(q, offer.personId))
    if (!offer || !call || !person) return 'The offer is gone.'
    const job = call.projectId ? await getProject(q, call.projectId) : undefined
    if (person.archived) return 'They were archived before it went.'
    const to = reachOf(await whatsappSetting(q), person)
    if (!to) return 'WhatsApp was turned off, for them or for everyone, before it went.'
    if (to !== m.to_number) return 'Their mobile changed before it went.'
    // Their own page, from a "See the details" button: the template holds the address up to /f/, and the secret goes in here.
    const page = (index: string): TemplateComponent => ({ type: 'button', sub_type: 'url', index, parameters: [{ type: 'text', text: person.linkToken }] })
    const body = (values: string[]): TemplateComponent => ({ type: 'body', parameters: values.map((text) => ({ type: 'text', text })) })
    if (m.kind === 'confirmed') {
      if (job?.status !== 'confirmed') return 'The job was no longer confirmed, or was stopped, before it went.'
      if (!['offered', 'countered', 'accepted', 'confirmed'].includes(offer.status) || call.status !== 'open') return 'The offer was answered no or withdrawn before it went.'
      return { template: WHATSAPP_CONFIRMED_TEMPLATE, components: [body(followUpTemplateValues(person, call, offer.days)), page('0')], hold: false }
    }
    if (m.kind === 'cancelled') {
      if (!job || !STOPPED.includes(job.status)) return 'The job was started again before it went.'
      return { template: WHATSAPP_CANCELLED_TEMPLATE, components: [body(followUpTemplateValues(person, call, offer.days))], hold: false }
    }
    if (offer.status !== 'offered' || call.status !== 'open') return 'The offer was answered or withdrawn before it went.'
    const hold = jobOnHold(job?.status)
    return {
      template: WHATSAPP_OFFER_TEMPLATE,
      components: [
        body(offerTemplateValues(person, call, hold)),
        { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `yes:${offer.id}` }] },
        { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: `no:${offer.id}` }] },
        page('2'),
      ],
      hold,
    }
  }
}
