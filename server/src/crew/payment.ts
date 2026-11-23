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
 * calendar's key is (ADR 0008): AES-256-GCM, with a key worked out from PAYMENT_DETAILS_KEY, or the app's Google client
 * secret where that isn't set, which live only in the server's settings, so a copy of the database or a backup holds
 * only the locked form. Never in the change feed, so no device keeps them: those who see money (directors and the
 * office) ask the server each time, and see them masked until they ask for them in full, which the history records.
 */

const VERSION = 'p1'
/** Bound into each, so a locked text from another column can't be passed off as these. */
const BOUND = 'payment details'
/** For a copy with sign-in off (the tests and trials), where anyone who can reach it is in anyway. */
export const OPEN_PAYMENT_KEY = 'sign-in is off: not a secret'

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

export function registerPaymentRoutes(app: FastifyInstance, db: Db, opts: { key?: string; onChange?: () => void }) {
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
      if (!opts.key) return reply.code(503).send({ error: CANT_KEEP })
      const details = openPayment(opts.key, row.sealed)
      if (!details) return reply.code(500).send({ error: "These payment details can't be unlocked: the server's key has changed since they were given. Ask for them again." })
      const full = req.query.full === '1'
      // Seeing them in full is in the history, as who looked and when, never what they saw.
      if (full)
        await serverChange(db, { name: PAYMENT_SEEN_ACTION, args: { personId }, userId: req.user?.id, device: describeDevice(req.headers['user-agent']) }, async () => {})
      return { kept: true, details: full ? details : maskPaymentDetails(details), full, changedAt: row.changed_at.toISOString(), changedBy: row.changed_by }
    }
  )

  app.put<{ Params: { id: string } }>('/api/people/:id/payment', { config: { needs: 'money' } }, async (req, reply): Promise<PaymentDetailsShown | void> => {
    noStore(reply)
    if (!opts.key) return reply.code(503).send({ error: CANT_KEEP })
    const personId = id(req.params.id)
    if (!(await getPerson(db.reads, personId))) return reply.code(404).send({ error: 'That person is no longer on the Crew tab.' })
    const body = (req.body ?? {}) as Record<string, unknown>
    const typed = Object.fromEntries((['ppsn', 'vatNumber', 'accountName', 'iban', 'bic'] as const).map((f) => [f, typeof body[f] === 'string' ? (body[f] as string).slice(0, 200) : ''])) as unknown as PaymentDetails
    const read = readPaymentDetails(typed)
    if (!read.ok) return reply.code(422).send({ error: Object.values(read.errors)[0], errors: read.errors })
    const gone = !hasPaymentDetails(read.details)
    const by = req.user?.name ?? 'The office'
    await serverChange(db, { name: PAYMENT_DETAILS_ACTION, args: { personId, ...(gone ? { gone: true } : {}) }, userId: req.user?.id, device: describeDevice(req.headers['user-agent']) }, (ctx) =>
      keepPayment(ctx.tx, personId, gone ? null : sealPayment(opts.key!, read.details), by)
    )
    if (gone) return { kept: false, details: NO_PAYMENT_DETAILS, full: false }
    return { kept: true, details: maskPaymentDetails(read.details), full: false, changedAt: new Date().toISOString(), changedBy: by }
  })
}
