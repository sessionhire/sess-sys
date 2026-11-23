import { TRADING_NAME, type OfficeDetails } from '@sh/shared'
import type { Db } from '../db.ts'
import type { Mailbox } from '../assistant/mailbox.ts'
import { mime } from '../finance/quote-email.ts'
import { officeFor } from '../office/store.ts'
import { emailsApplicants } from './store.ts'

/**
 * Emails to people who applied (ADR 0193): one when the office takes them on, with the address of their own page,
 * where they see and answer offers and keep their details up to date; and a polite one when it turns them down. Queued
 * in the same change as the decision, while the office has it on (Admin › Company › Applications to join), and sent
 * from the operations mailbox just after, as the link codes are (ADR 0114). Plain text, as a person would write it.
 *
 * Each is taken under a row lock another server skips, so it goes once. One the mailbox can't send yet waits, and is
 * tried again each minute for a day; turned off before it went, it doesn't go. Once it has gone or been given up on,
 * the address and name it was for are cleared, so nothing of a turned-down applicant stays.
 */

const EVERY_MS = 60_000
const TRIES = 5
const STALE_MS = 24 * 60 * 60_000

interface Queued {
  id: string
  kind: 'taken' | 'declined'
  person_id: string | null
  to_email: string
  first_name: string
  made_at: Date
  tries: number
  link_token: string | null
}

/** What each says, from the office's details and, for one taken on, their page's address. */
export function applicantEmail(
  kind: 'taken' | 'declined',
  firstName: string,
  link: string | null,
  office: OfficeDetails | null | undefined
): { subject: string; text: string } {
  const company = office?.name?.trim() && !/ office$/i.test(office.name.trim()) ? office.name.trim() : TRADING_NAME
  const reach = [office?.phone?.trim() ? `ring ${office.phone.trim()}` : '', office?.email?.trim() ? `email ${office.email.trim()}` : ''].filter(Boolean).join(' or ')
  const hi = `Hi ${firstName || 'there'},`
  const sign = `Thanks,\nThe ${company} office`
  if (kind === 'taken')
    return {
      subject: `You're on the ${company} crew list`,
      text: [
        hi,
        `Thanks for applying to work with ${company}. We've added you to our crew list.`,
        link
          ? `This is your own page, where you'll see the work we offer you, say yes or no, and keep your details and days off up to date:\n\n${link}\n\nKeep this email, or save the page to your home screen: the link is yours alone, so please don't share it.`
          : '',
        `We'll be in touch when we have work that suits you.${reach ? ` If anything changes in the meantime, ${reach}.` : ''}`,
        sign,
      ]
        .filter(Boolean)
        .join('\n\n'),
    }
  return {
    subject: `Your application to ${company}`,
    text: [
      hi,
      `Thanks for applying to work with ${company}, and for taking the time to tell us about yourself.`,
      "We've read your application, and we don't have work that suits it just now, so we haven't kept your details. You're welcome to apply again in future.",
      sign,
    ].join('\n\n'),
  }
}

export class ApplicantEmails {
  private timer: NodeJS.Timeout | undefined
  private running: Promise<void> | undefined
  private again = false

  constructor(
    private readonly db: Db,
    private readonly mailbox: Mailbox,
    private readonly options: { appUrl?: string | null; log?: { warn: (o: object, msg: string) => void }; now?: () => Date } = {}
  ) {}

  start() {
    if (this.timer) return
    this.timer = setInterval(() => void this.kick(), EVERY_MS)
    this.timer.unref()
  }

  stop() {
    clearInterval(this.timer)
    this.timer = undefined
  }

  /** Something changed: send what's queued. A kick while sending goes round once more after. */
  kick(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      do {
        this.again = false
        try {
          while (await this.sendOne()) {
            // One at a time, each in its own change.
          }
        } catch (err) {
          this.options.log?.warn({ err: err instanceof Error ? err.message : String(err) }, 'Emails to people who applied could not be sent')
        }
      } while (this.again)
    })().finally(() => (this.running = undefined))
    return this.running
  }

  /** Sends the oldest queued, or says why not. False when there's none to take, or the mailbox can't send and the rest wait. */
  private async sendOne(): Promise<boolean> {
    const now = this.options.now?.() ?? new Date()
    const { rows: any } = await this.db.query(`SELECT 1 FROM applicant_emails WHERE state = 'queued' LIMIT 1`)
    if (!any.length) return false
    // Asked before the row is taken: the mailbox reads the database itself, which a held change would keep waiting.
    const sender = await this.mailbox.sender().catch(() => ({ ok: false as const, why: 'The mailbox didn’t answer.' }))
    let refused: unknown
    const went = await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<Queued>(
        `SELECT e.id, e.kind, e.person_id, e.to_email, e.first_name, e.made_at, e.tries, p.link_token FROM applicant_emails e
         LEFT JOIN people p ON p.id = e.person_id
         WHERE e.state = 'queued' ORDER BY e.made_at LIMIT 1 FOR UPDATE OF e SKIP LOCKED`
      )
      const e = rows[0]
      if (!e) return false
      const end = async (state: 'sent' | 'failed', problem: string | null) =>
        tx.query(`UPDATE applicant_emails SET state = $2, problem = $3, sent_at = CASE WHEN $2 = 'sent' THEN now() END, to_email = NULL, first_name = NULL WHERE id = $1`, [
          e.id,
          state,
          problem,
        ])
      if (!(await emailsApplicants(tx))) {
        await end('failed', 'Emailing people who apply was turned off before it went.')
        return true
      }
      if (now.getTime() - new Date(e.made_at).getTime() > STALE_MS) {
        await end('failed', 'The mailbox couldn’t send it within a day.')
        return true
      }
      if (e.kind === 'taken' && (!e.link_token || !this.options.appUrl)) {
        await end('failed', 'There was no address for their page to send.')
        return true
      }
      if (!sender.ok) {
        // Waits for the mailbox: tried again on the next round.
        await tx.query(`UPDATE applicant_emails SET tries = tries + 1, problem = $2 WHERE id = $1`, [e.id, sender.why])
        return false
      }
      const link = e.kind === 'taken' ? `${this.options.appUrl}/f/${e.link_token}` : null
      const { subject, text } = applicantEmail(e.kind, e.first_name, link, await officeFor(tx))
      try {
        await this.mailbox.gmail.send(sender.token, mime({ from: { name: TRADING_NAME, address: sender.account }, to: [e.to_email], replyTo: [], subject, text, date: now }))
      } catch (err) {
        refused = err
        if (e.tries + 1 >= TRIES) await end('failed', 'Gmail didn’t take it.')
        else await tx.query(`UPDATE applicant_emails SET tries = tries + 1, problem = 'Gmail didn’t take it.' WHERE id = $1`, [e.id])
        return false
      }
      await end('sent', null)
      return true
    })
    // Google stopped letting the app at the mailbox: said on Admin, as for any send.
    if (refused) await this.mailbox.stopped(refused, 'send').catch(() => undefined)
    return went
  }
}
