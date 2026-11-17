import type { FastifyBaseLogger } from 'fastify'
import type { Mailbox } from '../assistant/mailbox.ts'
import type { ThreadMessage } from '../assistant/gmail.ts'
import type { Db } from '../db.ts'
import { QUOTE_EMAIL_NEWS_ACTION } from '../history-words.ts'
import { emit, serverChange } from '../kernel.ts'
import { getQuoteEmail } from './store.ts'

/**
 * Watching each quote's email for a week (ADR 0172): the conversation it
 * started in the operations mailbox, read now and then, for what comes back
 * into it. A delivery failure from the mail system (a bounce, said with the
 * address it failed for and why), a delay notice while the mail system is
 * still trying, and the client's own reply. Each is put on the email's
 * record, which every device that sees money is sent, and said in the
 * history as the app's own change, so whoever sent it is told.
 *
 * Only these conversations are read, and only their headers and Gmail's
 * one-line preview: never the rest of the mailbox, and never the body of
 * a reply. It needs only the reading the mailbox connection already has.
 */

/** How long an email is watched. */
export const WATCH_DAYS = 7
/** How often the watcher wakes; each email is looked at less often as it ages. */
const TICK_MS = 60_000
/** At most this many emails looked at a tick, so a busy week is caught up over a few. */
const MOST_A_TICK = 10

/** How long to leave an email between looks: often while a bounce is likeliest, then less. */
export function lookEvery(ageMs: number): number {
  if (ageMs < 60 * 60_000) return 5 * 60_000
  if (ageMs < 24 * 60 * 60_000) return 30 * 60_000
  return 6 * 60 * 60_000
}

/** What came back, as the record keeps it. */
export interface Heard {
  bounced?: { at: Date; to: string[]; why: string }
  delayed?: { at: Date; to: string[] }
  reply?: { at: Date; from: string }
  replies: number
  inSent: boolean
  /** The messages read, so each is said once. */
  ids: string[]
}

const DAEMON = /(^|[<\s"])(mailer-daemon|postmaster|mail-daemon|mailerdaemon)@/i

/** Whether a message is the mail system's report on delivery, rather than a person's. */
function isReport(m: ThreadMessage): boolean {
  return DAEMON.test(m.from) || /report-type="?delivery-status/i.test(m.contentType) || /^(undeliverable|undelivered mail|delivery (status notification|failure|has failed)|mail delivery (failed|subsystem)|returned mail)/i.test(m.subject.trim())
}

/** A report that says it's still trying, rather than that it gave up. */
function isDelay(m: ThreadMessage): boolean {
  return /\(delay\)|delayed|delivery incomplete|not yet been delivered|will (keep|continue) trying|will retry/i.test(`${m.subject} ${m.snippet}`)
}

/** Why it bounced, in the office's words, from what the report says. */
export function bounceWhy(text: string): string {
  if (/address not found|couldn.?t be found|does ?n.?t exist|does not exist|no such (user|mailbox|recipient)|user unknown|unknown (user|recipient)|recipient (address )?rejected|invalid (recipient|address)|5\.1\.1|5\.1\.0/i.test(text)) return 'the address doesn’t exist'
  if (/domain (not found|couldn.?t be found)|dns|host (not found|unknown)|5\.1\.2|5\.4\.4/i.test(text)) return 'the domain can’t take email'
  if (/(mailbox|inbox) (is )?full|over (its )?quota|quota exceeded|insufficient storage|5\.2\.2/i.test(text)) return 'their mailbox is full'
  if (/blocked|block list|blacklist|spam|policy|rejected|refused|denied|5\.7\.\d/i.test(text)) return 'their mail server turned it away'
  if (/too (large|big)|size limit|5\.3\.4/i.test(text)) return 'it was too big for their mail server'
  return 'it couldn’t be delivered'
}

/** "Anna Kelly <anna@client.ie>" → "Anna Kelly"; a bare address stays. */
export function nameOf(from: string): string {
  const named = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/)
  return (named?.[1] ?? from).trim()
}

/** What the conversation says about one email sent to `to` at `sentAt` with Gmail's id `gmailId`, newest last. */
export function hear(messages: readonly ThreadMessage[], email: { gmailId: string; sentAt: Date; to: string[] }): Heard {
  const heard: Heard = { replies: 0, inSent: false, ids: [] }
  const ours = new Set(email.to.map((a) => a.toLowerCase()))
  for (const m of messages) {
    if (m.id === email.gmailId) {
      heard.inSent = m.labels.includes('SENT')
      continue
    }
    // Only what came after it; the office's own mail in the thread (another quote, a reply from operations@) isn't news.
    if (m.at.getTime() < email.sentAt.getTime() || m.labels.includes('SENT')) continue
    heard.ids.push(m.id)
    if (isReport(m)) {
      const named = m.failed.map((a) => a.toLowerCase()).filter((a) => ours.has(a))
      const inText = email.to.filter((a) => `${m.snippet} ${m.subject}`.toLowerCase().includes(a.toLowerCase()))
      const to = named.length ? named : inText.length ? inText : email.to
      if (isDelay(m)) heard.delayed = { at: m.at, to }
      else heard.bounced = { at: m.at, to: [...new Set([...(heard.bounced?.to ?? []), ...to])], why: bounceWhy(`${m.subject} ${m.snippet}`) }
      continue
    }
    heard.replies++
    heard.reply = { at: m.at, from: nameOf(m.from) }
  }
  return heard
}

interface Row {
  id: string
  quote_id: string
  project_id: string
  gmail_id: string | null
  thread_id: string | null
  sent_at: Date
  to_addresses: string[]
  in_sent_at: Date | null
  bounced_at: Date | null
  delayed_at: Date | null
  replies: number
  seen_ids: string[]
}

export class QuoteWatch {
  private timer?: ReturnType<typeof setInterval>
  private looking?: Promise<number>

  constructor(
    private readonly db: Db,
    private readonly mailbox: Mailbox,
    private readonly onChange: () => void,
    private readonly log?: FastifyBaseLogger,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** One look at the emails due one; asked again while one is going, it waits for that one. Says how many it read. */
  look(): Promise<number> {
    this.looking ??= this.lookNow().finally(() => (this.looking = undefined))
    return this.looking
  }

  private async lookNow(): Promise<number> {
    const now = this.now()
    const { rows } = await this.db.reads.query<Row & { looked_at: Date | null }>(
      `SELECT id, quote_id, project_id, gmail_id, thread_id, sent_at, to_addresses, in_sent_at, bounced_at, delayed_at, replies, seen_ids, looked_at
         FROM quote_emails
        WHERE thread_id IS NOT NULL AND gmail_id IS NOT NULL AND sent_at > $1
        ORDER BY coalesce(looked_at, sent_at)`,
      [new Date(now.getTime() - WATCH_DAYS * 24 * 60 * 60_000)]
    )
    const due = rows.filter((r) => !r.looked_at || now.getTime() - new Date(r.looked_at).getTime() >= lookEvery(now.getTime() - new Date(r.sent_at).getTime())).slice(0, MOST_A_TICK)
    if (!due.length) return 0
    const sender = await this.mailbox.sender().catch(() => ({ ok: false as const }))
    if (!sender.ok) return 0
    let read = 0
    for (const r of due) {
      let messages: ThreadMessage[]
      try {
        messages = await this.mailbox.gmail.threadHeads(sender.token, r.thread_id!)
      } catch (err) {
        await this.mailbox.stopped(err, 'read')
        this.log?.warn({ err: err instanceof Error ? err.message : String(err) }, 'A quote email could not be looked at')
        break
      }
      await this.take(r, hear(messages, { gmailId: r.gmail_id!, sentAt: new Date(r.sent_at), to: r.to_addresses }), now)
      read++
    }
    return read
  }

  /** Puts what was heard on the record, saying each new thing once, in the history, as the app's own change. */
  private async take(r: Row, heard: Heard, now: Date) {
    const seen = new Set(r.seen_ids)
    const fresh = heard.ids.filter((id) => !seen.has(id))
    const news: { kind: 'bounced' | 'delayed' | 'replied'; who: string; why?: string }[] = []
    if (heard.bounced && !r.bounced_at) news.push({ kind: 'bounced', who: heard.bounced.to.join(', '), why: heard.bounced.why })
    else if (heard.delayed && !r.delayed_at && !heard.bounced) news.push({ kind: 'delayed', who: heard.delayed.to.join(', ') })
    if (heard.replies > r.replies && heard.reply) news.push({ kind: 'replied', who: heard.reply.from })
    const changed = news.length > 0 || (heard.inSent && !r.in_sent_at)
    const save = async (tx: Parameters<Parameters<typeof serverChange>[2]>[0]['tx']) => {
      await tx.query(
        `UPDATE quote_emails SET looked_at = $2, seen_ids = $3,
            in_sent_at = CASE WHEN $4 THEN coalesce(in_sent_at, $2) ELSE in_sent_at END,
            bounced_at = coalesce(bounced_at, $5), bounced_to = CASE WHEN bounced_at IS NULL THEN $6 ELSE bounced_to END, bounce_why = CASE WHEN bounced_at IS NULL THEN $7 ELSE bounce_why END,
            delayed_at = CASE WHEN $5::timestamptz IS NULL THEN coalesce(delayed_at, $8) ELSE delayed_at END, delayed_to = CASE WHEN delayed_at IS NULL AND $5::timestamptz IS NULL THEN $9 ELSE delayed_to END,
            replies = greatest(replies, $10), replied_at = coalesce($11, replied_at), replied_from = coalesce($12, replied_from)
          WHERE id = $1`,
        [
          r.id,
          now,
          [...r.seen_ids, ...fresh].slice(-200),
          heard.inSent,
          heard.bounced?.at ?? null,
          heard.bounced?.to ?? null,
          heard.bounced?.why ?? null,
          heard.delayed?.at ?? null,
          heard.delayed?.to ?? null,
          heard.replies,
          heard.replies > r.replies ? (heard.reply?.at ?? null) : null,
          heard.replies > r.replies ? (heard.reply?.from ?? null) : null,
        ]
      )
    }
    if (!changed) {
      await this.db.query(`UPDATE quote_emails SET looked_at = $2 WHERE id = $1`, [r.id, now])
      return
    }
    // One change for what was heard, in the history as the app's, with the most serious thing first.
    const lead = news[0]
    await serverChange(
      this.db,
      lead ? { name: QUOTE_EMAIL_NEWS_ACTION, args: { id: r.id, quoteId: r.quote_id, projectId: r.project_id, kind: lead.kind, who: lead.who, ...(lead.why ? { why: lead.why } : {}) } } : undefined,
      async (ctx) => {
        await save(ctx.tx)
        await emit(ctx, 'quoteEmail', r.id, await getQuoteEmail(ctx.tx, r.id))
      }
    )
    // A bounce and a reply heard at once: the reply is its own line in the history too.
    for (const n of news.slice(1))
      await serverChange(this.db, { name: QUOTE_EMAIL_NEWS_ACTION, args: { id: r.id, quoteId: r.quote_id, projectId: r.project_id, kind: n.kind, who: n.who, ...(n.why ? { why: n.why } : {}) } }, async (ctx) => {
        await emit(ctx, 'quoteEmail', r.id, await getQuoteEmail(ctx.tx, r.id))
      })
    this.onChange()
  }

  start() {
    if (this.timer) return
    const look = () => void this.look().catch((err) => this.log?.warn({ err: err instanceof Error ? err.message : String(err) }, 'Quote emails could not be looked at'))
    this.timer = setInterval(look, TICK_MS)
    this.timer.unref()
    look()
  }

  stop() {
    clearInterval(this.timer)
    this.timer = undefined
  }
}
