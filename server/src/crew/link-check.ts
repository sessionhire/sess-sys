import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { hasEmail, newId, type Person } from '@sh/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Mailbox } from '../assistant/mailbox.ts'
import type { Db, Queryable } from '../db.ts'
import { describeDevice } from '../devices.ts'
import { mime } from '../finance/quote-email.ts'
import { publicOrigin, readCookie, setCookie, SIGN_IN_LIMIT } from '../http.ts'
import { checksLinks, officeFor } from '../office/store.ts'
import { getPerson, HAS_EMAIL, personByToken } from './store.ts'
import { renderCheckPhone, renderLost, type LostState, type PhoneCheck } from './link-check-page.ts'

/**
 * A freelancer's link, made safer (ADR 0114). The link is still the whole
 * way in (ADR 0002), but each phone it opens on is remembered, by a cookie
 * scoped to that link's address. While the office has checking on, a phone
 * the link hasn't seen, once another phone has used it, is asked for a code
 * emailed from the operations mailbox; and a freelancer who lost their
 * link can have it emailed from /link. While checking is off, phones are
 * still remembered, quietly, so the day it goes on the phones freelancers
 * already use go on working; and nothing is ever sent.
 *
 * Staff pages are left to Google (ADR 0052), and the calendar feed to the
 * calendar apps that fetch it (ADR 0012).
 */

export const LINK_COOKIE = 'sh_link'
/** As long as a browser keeps a cookie, as for staff sessions (ADR 0052). */
const REMEMBER_DAYS = 400
const CODE_MINUTES = 15
const CODE_TRIES = 5
/** A second code inside this is "give it a minute": nobody's inbox is filled by a held-down button. */
const RESEND_SECONDS = 60
/** A lost link is emailed at most this often to one person, whoever asks. */
const LOST_MINUTES = 10
/** Phones that never came back with their cookie (a link preview, a one-off look) are forgotten after this. */
const UNSEEN_DAYS = 30
const FEED = '/f/:token/calendar.ics'
const CODE_ROUTES = new Set(['/f/:token/code', '/f/:token/code/send'])

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
export const linkHash = (linkToken: string) => sha(`link:${linkToken}`)
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

type Req = FastifyRequest<{ Params: { token: string } }>

/** What sends the code and the lost link: the operations mailbox (ADR 0098), when it's connected and may send. */
export type LinkMail = Pick<Mailbox, 'sender' | 'stopped'> & { gmail: Pick<Mailbox['gmail'], 'send'> }

export function registerLinkCheck(app: FastifyInstance, db: Db, { mailbox }: { mailbox: () => LinkMail | undefined }) {
  const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store').header('x-robots-tag', 'noindex')

  /** This phone's row for the person's current link, if its cookie names one. */
  async function deviceOf(req: FastifyRequest, person: Person): Promise<{ id: string; seen: boolean; used: Date } | undefined> {
    const secret = readCookie(req, LINK_COOKIE)
    if (!secret || secret.length > 100) return undefined
    const { rows } = await db.reads.query<{ id: string; seen: boolean; used_at: Date }>(
      `SELECT id, seen, used_at FROM link_devices WHERE secret_hash = $1 AND person_id = $2 AND link_hash = $3`,
      [sha(secret), person.id, linkHash(person.linkToken)]
    )
    const r = rows[0]
    return r && { id: r.id, seen: r.seen, used: new Date(r.used_at) }
  }

  /** Remembers this phone for the person's link: a new secret, its hash kept, the cookie scoped to the address it came by. */
  async function remember(req: Req, reply: FastifyReply, person: Person, seen: boolean) {
    const secret = randomBytes(24).toString('base64url')
    await db.query(`DELETE FROM link_devices WHERE person_id = $1 AND NOT seen AND created_at < now() - make_interval(days => $2)`, [person.id, UNSEEN_DAYS])
    await db.query(`INSERT INTO link_devices (id, person_id, link_hash, secret_hash, device, seen) VALUES ($1, $2, $3, $4, $5, $6)`, [
      newId(),
      person.id,
      linkHash(person.linkToken),
      sha(secret),
      (describeDevice(req.headers['user-agent']) ?? '').slice(0, 200),
      seen,
    ])
    setCookie(req, reply, LINK_COOKIE, secret, { maxAge: REMEMBER_DAYS * 86_400, path: `/f/${req.params.token}` })
  }

  /** Whether any phone has come back to this link with its cookie: until one has, the first to open it is let in. */
  async function anyPhone(q: Queryable, person: Person): Promise<boolean> {
    const { rows } = await q.query(`SELECT 1 FROM link_devices WHERE person_id = $1 AND link_hash = $2 AND seen LIMIT 1`, [person.id, linkHash(person.linkToken)])
    return rows.length > 0
  }

  /** Whether a code can go out now: an address to send it to, and a mailbox that may send. */
  async function canSend(person: Person): Promise<boolean> {
    if (!person.email) return false
    const m = mailbox()
    if (!m) return false
    return (await m.sender().catch(() => ({ ok: false as const }))).ok
  }

  async function checkPage(req: Req, reply: FastifyReply, person: Person, state: PhoneCheck, code = 401) {
    return noStore(reply)
      .code(code)
      .type('text/html')
      .send(
        renderCheckPhone({
          name: person.name,
          base: `/f/${req.params.token}`,
          email: person.email?.trim() || null,
          canSend: await canSend(person),
          state,
          office: await officeFor(db.reads),
        })
      )
  }

  /** Sends one plain email from the mailbox. False when it couldn't go; nothing is said to the person about why. */
  async function mail(to: string, subject: string, text: string): Promise<boolean> {
    const m = mailbox()
    if (!m) return false
    try {
      const sender = await m.sender()
      if (!sender.ok) return false
      await m.gmail.send(sender.token, mime({ from: { name: 'Session Hire', address: sender.account }, to: [to], replyTo: [], subject, text, date: new Date() }))
      return true
    } catch (err) {
      await m.stopped(err, 'send').catch(() => undefined)
      app.log.warn({ err }, 'A link email could not be sent')
      return false
    }
  }

  app.addHook('onRequest', async (req, reply) => {
    const url = req.routeOptions.url
    if (!url?.startsWith('/f/:token') || url === FEED || CODE_ROUTES.has(url)) return
    const token = (req.params as { token?: string }).token ?? ''
    const person = await personByToken(db.reads, token)
    if (!person || person.kind === 'staff') return
    const device = await deviceOf(req, person)
    if (device) {
      // Back with its cookie: a phone, not a preview. Marked once, and its day of use kept to the day.
      if (!device.seen || Date.now() - device.used.getTime() > 86_400_000) await db.query(`UPDATE link_devices SET seen = true, used_at = now() WHERE id = $1`, [device.id])
      return
    }
    // Remembered from its first look; a post never makes a phone, as a page always comes first.
    if (!(await checksLinks(db.reads)) || !(await anyPhone(db.reads, person))) {
      if (req.method === 'GET') await remember(req as Req, reply, person, false)
      return
    }
    return checkPage(req as Req, reply, person, 'ask')
  })

  /** Emails a new code, replacing any waiting. */
  app.post('/f/:token/code/send', { config: { rateLimit: SIGN_IN_LIMIT } }, async (req: Req, reply) => {
    const person = await personByToken(db.reads, req.params.token)
    if (!person || person.kind === 'staff' || !(await checksLinks(db.reads))) return reply.redirect(`/f/${req.params.token}`, 303)
    const { rows } = await db.reads.query<{ sent_at: Date }>(`SELECT sent_at FROM link_codes WHERE person_id = $1`, [person.id])
    if (rows[0] && Date.now() - new Date(rows[0].sent_at).getTime() < RESEND_SECONDS * 1000) return checkPage(req, reply, person, 'wait')
    if (!person.email || !(await canSend(person))) return checkPage(req, reply, person, 'not-sent')
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const sent = await mail(
      person.email.trim(),
      `Your Session Hire code: ${code}`,
      `Hi ${person.name.split(' ')[0]},\n\nYour code to open your Session Hire page on a new phone is:\n\n${code}\n\nIt works for ${CODE_MINUTES} minutes. If you didn't ask for it, someone may have your link: ring the office and they'll give you a new one.\n\nSession Hire`
    )
    if (!sent) return checkPage(req, reply, person, 'not-sent')
    await db.query(
      `INSERT INTO link_codes (person_id, link_hash, code_hash, sent_at, expires_at, tries) VALUES ($1, $2, $3, now(), now() + make_interval(mins => $4), 0)
       ON CONFLICT (person_id) DO UPDATE SET link_hash = EXCLUDED.link_hash, code_hash = EXCLUDED.code_hash, sent_at = now(), expires_at = EXCLUDED.expires_at, tries = 0`,
      [person.id, linkHash(person.linkToken), sha(`${person.id}:${code}`), CODE_MINUTES]
    )
    return checkPage(req, reply, person, 'sent', 200)
  })

  /** The code typed: right, and this phone is remembered and opens the page; wrong, and it says so, until the tries run out. */
  app.post<{ Params: { token: string }; Body: URLSearchParams }>('/f/:token/code', { config: { rateLimit: SIGN_IN_LIMIT } }, async (req, reply) => {
    const person = await personByToken(db.reads, req.params.token)
    if (!person || person.kind === 'staff' || !(await checksLinks(db.reads))) return reply.redirect(`/f/${req.params.token}`, 303)
    const typed = String(req.body?.get?.('code') ?? '').replace(/\D/g, '')
    const { rows } = await db.reads.query<{ code_hash: string; link_hash: string; expired: boolean; tries: number }>(
      `SELECT code_hash, link_hash, expires_at < now() AS expired, tries FROM link_codes WHERE person_id = $1`,
      [person.id]
    )
    const waiting = rows[0]
    if (!waiting || waiting.expired || waiting.tries >= CODE_TRIES || waiting.link_hash !== linkHash(person.linkToken)) {
      if (waiting) await db.query(`DELETE FROM link_codes WHERE person_id = $1`, [person.id])
      return checkPage(req, reply, person, 'expired')
    }
    if (typed.length !== 6 || !same(sha(`${person.id}:${typed}`), waiting.code_hash)) {
      await db.query(`UPDATE link_codes SET tries = tries + 1 WHERE person_id = $1`, [person.id])
      return checkPage(req, reply, person, waiting.tries + 1 >= CODE_TRIES ? 'expired' : 'wrong', 422)
    }
    await db.query(`DELETE FROM link_codes WHERE person_id = $1`, [person.id])
    await remember(req, reply, person, true)
    return reply.redirect(`/f/${req.params.token}`, 303)
  })

  const lost = async (reply: FastifyReply, state: LostState, typed?: string) =>
    noStore(reply)
      .code(state === 'not-an-email' ? 422 : 200)
      .type('text/html')
      .send(renderLost({ state, office: await officeFor(db.reads), typed }))

  /** Lost your link? (ADR 0114): asked for by email, while checking is on. */
  app.get('/link', async (_req, reply) => lost(reply, (await checksLinks(db.reads)) ? 'ask' : 'off'))

  app.post<{ Body: URLSearchParams }>('/link', { config: { rateLimit: SIGN_IN_LIMIT } }, async (req, reply) => {
    if (!(await checksLinks(db.reads))) return lost(reply, 'off')
    const email = String(req.body?.get?.('email') ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return lost(reply, 'not-an-email', email.slice(0, 200))
    // The same answer whether the address is ours or not, and whether it went, so the page tells nobody who works here.
    // Only when the address is one freelancer's: two people sharing one address get neither's link, and the office sorts it.
    const { rows } = await db.reads.query<{ id: string }>(`SELECT id FROM people WHERE NOT archived AND kind = 'freelancer' AND ${HAS_EMAIL('$1')} LIMIT 2`, [email])
    const person = rows.length === 1 ? await getPerson(db.reads, rows[0]!.id) : undefined
    if (person && hasEmail(person, email)) {
      const { rows: recent } = await db.reads.query(`SELECT 1 FROM link_lost WHERE person_id = $1 AND sent_at > now() - make_interval(mins => $2)`, [person.id, LOST_MINUTES])
      if (!recent.length) {
        const sent = await mail(
          email,
          'Your Session Hire link',
          `Hi ${person.name.split(' ')[0]},\n\nHere's your Session Hire page, with your offers, bookings and days off:\n\n${publicOrigin(req)}/f/${person.linkToken}\n\nKeep it to yourself: it's your way in. If you didn't ask for it, you can ignore this email.\n\nSession Hire`
        )
        // Kept, so asking again within the ten minutes sends nothing more.
        if (sent)
          await db.query(`INSERT INTO link_lost (person_id, sent_at) VALUES ($1, now()) ON CONFLICT (person_id) DO UPDATE SET sent_at = now()`, [person.id])
      }
    }
    return lost(reply, 'sent')
  })
}
