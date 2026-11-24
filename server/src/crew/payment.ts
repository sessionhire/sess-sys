import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { hasPaymentDetails, maskPaymentDetails, NO_PAYMENT_DETAILS, readPaymentDetails, type PaymentDetails, type PaymentDetailsShown } from '@sh/shared'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Db, Queryable } from '../db.ts'
import { describeDevice } from '../devices.ts'
import { PAYMENT_DETAILS_ACTION, PAYMENT_SEEN_ACTION } from '../history-words.ts'
import { serverChange } from '../kernel.ts'
import { getPerson } from './store.ts'

/**
 * A person's details for paying them (ADR 0193): PPS number, VAT number and bank account. Kept locked, as the
 * calendar's key is (ADR 0008): AES-256-GCM, with a key worked out from PAYMENT_DETAILS_KEY, a long random text of their
 * own that lives only in the server's settings, so a copy of the database or a backup holds only the locked form.
 * Changing the key: the old one goes in PAYMENT_DETAILS_KEY_OLD, and what it locked is locked again with the new one when
 * the server starts, and on being read; once that's done the old one can go. Never in the change feed, so no device keeps them: those who see money (directors and the
 * office) ask the server each time, and see them masked until they ask for them in full, which the history records.
 */

const VERSION = 'p1'
/** Bound into each, so a locked text from another column can't be passed off as these. */
const BOUND = 'payment details'
/** For a copy with sign-in off (the tests and trials), where anyone who can reach it is in anyway. */
export const OPEN_PAYMENT_KEY = 'sign-in is off: not a secret'

/** Shorter than this, PAYMENT_DETAILS_KEY isn't used: it is a key, not a password to remember. */
export const PAYMENT_KEY_LENGTH = 32

/** What locks new details, and what else may unlock ones locked before the key was changed. */
export interface PaymentKeys {
  current?: string
  old?: readonly string[]
}

/** The keys from the server's settings, and why PAYMENT_DETAILS_KEY wasn't used if it wasn't. */
export function paymentKeysFromEnv(env: NodeJS.ProcessEnv, googleSecret?: string): { keys: PaymentKeys; problem?: string } {
  const set = env.PAYMENT_DETAILS_KEY?.trim()
  const short = !!set && set.length < PAYMENT_KEY_LENGTH
  // Before 1.219.0 the Google client secret stood in until a key was set: still tried, to unlock and lock again.
  const old = [env.PAYMENT_DETAILS_KEY_OLD?.trim(), googleSecret?.trim()].filter((k): k is string => !!k && k !== set)
  return {
    keys: { current: set && !short ? set : undefined, old },
    problem: short ? `PAYMENT_DETAILS_KEY is shorter than ${PAYMENT_KEY_LENGTH} characters, so payment details aren't asked for or kept. Make it a long random text.` : undefined,
  }
}

/** Unlocks with whichever key locked it, and says whether that was an old one. */
export function openWithKeys(keys: PaymentKeys, sealed: string): { details: PaymentDetails; old: boolean } | undefined {
  const tries = [keys.current, ...(keys.old ?? [])].filter((k): k is string => !!k)
  for (const [i, k] of tries.entries()) {
    const details = openPayment(k, sealed)
    if (details) return { details, old: i > 0 || !keys.current }
  }
  return undefined
}

/**
 * Locks again with the current key everything an old one locked: kept details, and those given on the Apply page and
 * not yet taken on. The count of each, and of any no key could unlock.
 */
export async function resealPayments(db: Db, keys: PaymentKeys): Promise<{ resealed: number; unreadable: number }> {
  let resealed = 0
  let unreadable = 0
  if (!keys.current) return { resealed, unreadable }
  for (const [table, idCol, col] of [
    ['payment_details', 'person_id', 'sealed'],
    ['applications', 'id', 'payment_sealed'],
  ] as const) {
    const { rows } = await db.query<{ id: string; sealed: string }>(`SELECT ${idCol} AS id, ${col} AS sealed FROM ${table} WHERE ${col} IS NOT NULL`)
    for (const r of rows) {
      const opened = openWithKeys(keys, r.sealed)
      if (!opened) unreadable++
      else if (opened.old) {
        await db.query(`UPDATE ${table} SET ${col} = $2 WHERE ${idCol} = $1 AND ${col} = $3`, [r.id, sealPayment(keys.current, opened.details), r.sealed])
        resealed++
      }
    }
  }
  return { resealed, unreadable }
}

const keyFrom = (secret: string) => Buffer.from(hkdfSync('sha256', secret, 'session-hire', 'payment details', 32))

export function sealPayment(secret: string, d: PaymentDetails): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv)
  cipher.setAAD(Buffer.from(BOUND))
  const body = Buffer.concat([cipher.update(JSON.stringify(d), 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64url'), body.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.')
}

/** The details, or undefined when they can't be unlocked: the key has changed, or the text was altered. */
export function openPayment(secret: string, sealed: string): PaymentDetails | undefined {
  const [version, iv, body, tag] = sealed.split('.')
  if (version !== VERSION || !iv || !body || !tag) return undefined
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(iv, 'base64url'))
    decipher.setAAD(Buffer.from(BOUND))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const read = JSON.parse(Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')) as Partial<PaymentDetails>
    return { ...NO_PAYMENT_DETAILS, ...read }
  } catch {
    return undefined
  }
}

/** Keeps someone's, or takes them off when there are none: in the same change as whatever gave them. */
export async function keepPayment(tx: Queryable, personId: string, sealed: string | null, by: string) {
  if (!sealed) return void (await tx.query('DELETE FROM payment_details WHERE person_id = $1', [personId]))
  await tx.query(
    `INSERT INTO payment_details (person_id, sealed, changed_at, changed_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (person_id) DO UPDATE SET sealed = EXCLUDED.sealed, changed_at = now(), changed_by = EXCLUDED.changed_by`,
    [personId, sealed, by]
  )
}

const CANT_KEEP = "Payment details can't be kept on this copy of the app yet: it needs PAYMENT_DETAILS_KEY in the server's settings."

export function registerPaymentRoutes(app: FastifyInstance, db: Db, opts: { keys: PaymentKeys; onChange?: () => void }) {
  const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store')
  const id = (s: string) => s.slice(0, 64)

  app.get<{ Params: { id: string }; Querystring: { full?: string } }>(
    '/api/people/:id/payment',
    { config: { needs: 'money' } },
    async (req, reply): Promise<PaymentDetailsShown | void> => {
      noStore(reply)
      const personId = id(req.params.id)
      if (!(await getPerson(db.reads, personId))) return reply.code(404).send({ error: 'That person is no longer on the Crew tab.' })
      const { rows } = await db.reads.query<{ sealed: string; changed_at: Date; changed_by: string }>('SELECT sealed, changed_at, changed_by FROM payment_details WHERE person_id = $1', [personId])
      const row = rows[0]
      if (!row) return { kept: false, details: NO_PAYMENT_DETAILS, full: false }
      const opened = openWithKeys(opts.keys, row.sealed)
      if (!opened && !opts.keys.current) return reply.code(503).send({ error: CANT_KEEP })
      if (!opened) return reply.code(500).send({ error: "These payment details can't be unlocked: the server's key has changed since they were given. Ask for them again." })
      const { details } = opened
      // Locked with a key since changed: locked again with today's, so the old one can go.
      if (opened.old && opts.keys.current)
        await db.query('UPDATE payment_details SET sealed = $2 WHERE person_id = $1 AND sealed = $3', [personId, sealPayment(opts.keys.current, details), row.sealed])
      const full = req.query.full === '1'
      // In full only for a director (Colly, 24 November 2026); with roles off, anyone signed in is one.
      if (full && req.role && req.role !== 'director') return reply.code(403).send({ error: 'Only a director can see payment details in full.' })
      // Seeing them in full is in the history, as who looked and when, never what they saw.
      if (full)
        await serverChange(db, { name: PAYMENT_SEEN_ACTION, args: { personId }, userId: req.user?.id, device: describeDevice(req.headers['user-agent']) }, async () => {})
      return { kept: true, details: full ? details : maskPaymentDetails(details), full, changedAt: row.changed_at.toISOString(), changedBy: row.changed_by }
    }
  )

  app.put<{ Params: { id: string } }>('/api/people/:id/payment', { config: { needs: 'money' } }, async (req, reply): Promise<PaymentDetailsShown | void> => {
    noStore(reply)
    const key = opts.keys.current
    if (!key) return reply.code(503).send({ error: CANT_KEEP })
    const personId = id(req.params.id)
    if (!(await getPerson(db.reads, personId))) return reply.code(404).send({ error: 'That person is no longer on the Crew tab.' })
    const body = (req.body ?? {}) as Record<string, unknown>
    const typed = Object.fromEntries((['ppsn', 'vatNumber', 'accountName', 'iban', 'bic'] as const).map((f) => [f, typeof body[f] === 'string' ? (body[f] as string).slice(0, 200) : ''])) as unknown as PaymentDetails
    const read = readPaymentDetails(typed)
    if (!read.ok) return reply.code(422).send({ error: Object.values(read.errors)[0], errors: read.errors })
    const gone = !hasPaymentDetails(read.details)
    // Taking them off is a director's, as seeing them in full is: the office only sees them masked.
    if (gone && req.role && req.role !== 'director') return reply.code(403).send({ error: 'Only a director can take payment details off.' })
    const by = req.user?.name ?? 'The office'
    await serverChange(db, { name: PAYMENT_DETAILS_ACTION, args: { personId, ...(gone ? { gone: true } : {}) }, userId: req.user?.id, device: describeDevice(req.headers['user-agent']) }, (ctx) =>
      keepPayment(ctx.tx, personId, gone ? null : sealPayment(key, read.details), by)
    )
    if (gone) return { kept: false, details: NO_PAYMENT_DETAILS, full: false }
    return { kept: true, details: maskPaymentDetails(read.details), full: false, changedAt: new Date().toISOString(), changedBy: by }
  })
}
