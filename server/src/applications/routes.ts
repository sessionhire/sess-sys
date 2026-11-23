import { APPLICATIONS_MOST, AV_ROLES, hasPaymentDetails, newId, quotedCrewRole, readApplyForm, rolesInUse, type Application, type ApplyForm } from '@sh/shared'
import type { Queryable } from '../db.ts'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Db } from '../db.ts'
import { APPLICATION_IN_ACTION } from '../history-words.ts'
import { emit, serverChange } from '../kernel.ts'
import { officeFor } from '../office/store.ts'
import { renderJoin, type JoinState } from './page.ts'
import { sealPayment } from '../crew/payment.ts'
import { emailsApplicants, getApplication, takesApplications } from './store.ts'

/**
 * The public Apply page (ADR 0190), at /join: no sign-in and no link, so anyone can open it, which is why it keeps out
 * what isn't a person. A field no person sees that a bot fills, a form sent back faster than anyone could fill it, a
 * limit on how often one address can send, and a ceiling on how many can wait at once. A bot caught is shown the same
 * thank-you page as a person, so it learns nothing. One email is one application: sent again, the newer replaces it.
 */

/** Fewer seconds than this between opening the page and sending it is a bot: nobody types ten fields that fast. */
export const FASTEST_SECONDS = 4
/** How often one address can send it: plenty for a family sharing wifi, too few to fill the list. */
export const JOIN_LIMIT = { max: 10, timeWindow: 60 * 60_000 }

const field = (b: URLSearchParams | undefined, name: string, max: number) => String(b?.get?.(name) ?? '').slice(0, max)

export function registerJoin(app: FastifyInstance, db: Db, opts: { now?: () => number; onChange?: () => void; paymentKey?: string } = {}) {
  const now = opts.now ?? (() => Date.now())
  const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store').header('x-robots-tag', 'noindex')
  const page = async (reply: FastifyReply, state: JoinState, more: Omit<Parameters<typeof renderJoin>[0], 'state' | 'office'> = {}, code = 200) =>
    noStore(reply)
      .code(code)
      .type('text/html')
      .send(renderJoin({ state, office: await officeFor(db.reads), issued: String(now()), roles: state === 'ask' ? await rolesForApplicants(db.reads) : [], payment: !!opts.paymentKey, emails: await emailsApplicants(db.reads), ...more }))

  app.get('/join', async (_req, reply) => page(reply, (await takesApplications(db.reads)) ? 'ask' : 'off'))

  app.post<{ Body: URLSearchParams }>('/join', { config: { rateLimit: JOIN_LIMIT } }, async (req, reply) => {
    if (!(await takesApplications(db.reads))) return page(reply, 'off')
    const b = req.body
    // A bot: the hidden field filled, or sent back sooner than a person could, or with no time from the page at all.
    const issued = Number(field(b, 't', 20))
    if (field(b, 'website', 200).trim() || !Number.isFinite(issued) || issued <= 0 || now() - issued < FASTEST_SECONDS * 1000) return page(reply, 'thanks')
    const typed: ApplyForm = {
      firstName: field(b, 'firstName', 200),
      lastName: field(b, 'lastName', 200),
      email: field(b, 'email', 300),
      phone: field(b, 'phone', 60),
      country: field(b, 'country', 6),
      skills: field(b, 'skills', 700),
      rate: field(b, 'rate', 20),
      tradesAs: field(b, 'tradesAs', 20),
      basedIn: field(b, 'basedIn', 200),
      about: field(b, 'about', 4000),
      // Asked only while the server can lock them (ADR 0193): without its key, none are read.
      ppsn: opts.paymentKey ? field(b, 'ppsn', 40) : '',
      vatNumber: opts.paymentKey ? field(b, 'vatNumber', 40) : '',
      accountName: opts.paymentKey ? field(b, 'accountName', 200) : '',
      iban: opts.paymentKey ? field(b, 'iban', 60) : '',
      bic: opts.paymentKey ? field(b, 'bic', 30) : '',
      agree: field(b, 'agree', 10) === 'yes',
    }
    const read = readApplyForm(typed)
    // Drawn again with what they typed, and the time it was first opened, so fixing a field isn't taken for a bot.
    if (!read.ok) return page(reply, 'ask', { typed, errors: read.errors, issued: String(issued) }, 422)
    const a = read.application
    // One email is one application: the id of the one already in, if there is one, which this replaces.
    const { rows: was } = await db.reads.query<{ id: string }>('SELECT id FROM applications WHERE lower(email) = $1', [a.email])
    const again = was[0]?.id
    if (!again) {
      const { rows } = await db.reads.query<{ n: string }>('SELECT count(*) AS n FROM applications')
      if (Number(rows[0]?.n ?? 0) >= APPLICATIONS_MOST) return page(reply, 'full')
    }
    const id = again ?? newId()
    // Payment details locked before they're kept (ADR 0193), and never in what devices are sent.
    const sealed = opts.paymentKey && hasPaymentDetails(read.payment) ? sealPayment(opts.paymentKey, read.payment) : null
    await keepApplication(db, a, id, !!again, sealed)
    // The office's devices hear of it at once.
    opts.onChange?.()
    return reply.redirect('/join/thanks', 303)
  })

  app.get('/join/thanks', async (_req, reply) => page(reply, 'thanks'))
}

/**
 * An application kept, or the one with its email replaced: in the history as the server's own change, by nobody signed
 * in, with only the id kept there.
 */
export async function keepApplication(db: Db, a: Omit<Application, 'id' | 'appliedAt'>, id: string, again = false, paymentSealed: string | null = null) {
  await serverChange(db, { name: APPLICATION_IN_ACTION, args: { id, ...(again ? { again: true } : {}) } }, async (ctx) => {
    const { rows } = await ctx.tx.query<{ id: string }>(
      `INSERT INTO applications (id, first_name, last_name, email, phone, department, skills, day_rate_cents, trades_as, based_in, about, payment_sealed, applied_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       ON CONFLICT (lower(email)) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email, phone = EXCLUDED.phone,
         department = EXCLUDED.department, skills = EXCLUDED.skills, day_rate_cents = EXCLUDED.day_rate_cents, trades_as = EXCLUDED.trades_as,
         based_in = EXCLUDED.based_in, about = EXCLUDED.about, payment_sealed = EXCLUDED.payment_sealed, applied_at = now()
       RETURNING id`,
      [id, a.firstName, a.lastName, a.email, a.phone, a.department, JSON.stringify(a.skills), a.dayRateCents, a.tradesAs, a.basedIn, a.about, paymentSealed]
    )
    const got = await getApplication(ctx.tx, rows[0]!.id)
    if (got) await emit(ctx, 'application', got.id, got)
  })
}

/**
 * The roles the Apply page offers as someone types (Colly, 23 November 2026): those on the price list, the crew lines
 * quoted most in Current RMS (quotedCrewRole keeps a person's work and leaves out travel, delivery and fees), then the
 * trade's usual ones (AV_ROLES), each spelt once, as the office spells it. Names only: no rate, and no person's name.
 */
export async function rolesForApplicants(q: Queryable): Promise<string[]> {
  const priced = (await q.query<{ role: string }>('SELECT role FROM role_prices')).rows.map((r) => r.role)
  const quoted = (
    await q.query<{ name: string }>(
      `SELECT name FROM rms_lines WHERE (lower(transaction_type) = 'service' OR lower(item_type) = 'service') AND name <> ''
       GROUP BY name ORDER BY count(*) DESC, name LIMIT 300`
    )
  ).rows
    .map((r) => quotedCrewRole(r.name))
    .filter((r): r is string => !!r)
    .slice(0, 40)
  return rolesInUse({ priced: [...priced, ...quoted], standard: AV_ROLES })
    .map((r) => r.name)
    .slice(0, 150)
}
