import type { FastifyInstance } from 'fastify'
import type { Db } from '../db.ts'
import { describeDevice } from '../devices.ts'
import { SIGNED_OUT_EVERYWHERE_ACTION } from '../history-words.ts'
import { serverChange } from '../kernel.ts'
import { getPerson } from '../crew/store.ts'

/**
 * A member of staff signed out of the app on every phone and computer (the breach plan, docs/data-protection.md; the
 * security check of 24 November 2026): for a phone or laptop lost or stolen while signed in, whose session would
 * otherwise last as long as it's used. A director's, as everything about who can get in is. They sign in again with
 * Google; nothing they had waiting on a device is lost by this alone, as it goes up as soon as they do.
 */
export function registerSignOutEverywhere(app: FastifyInstance, db: Db) {
  app.post<{ Params: { id: string } }>('/api/people/:id/sign-out', { config: { needs: 'company' } }, async (req, reply) => {
    const person = await getPerson(db.reads, req.params.id.slice(0, 64))
    if (!person) return reply.code(404).send({ error: 'That person is no longer on the Crew tab.' })
    const emails = [person.email, ...(person.otherEmails ?? [])].map((e) => e?.trim().toLowerCase()).filter((e): e is string => !!e)
    if (person.kind !== 'staff' || !emails.length) return reply.code(422).send({ error: 'Only staff with an email sign in to the app.' })
    const ended = await serverChange(
      db,
      { name: SIGNED_OUT_EVERYWHERE_ACTION, args: { personId: person.id }, userId: req.user?.id, device: describeDevice(req.headers['user-agent']) },
      async (ctx) => {
        const { rows } = await ctx.tx.query<{ n: string }>(
          `WITH gone AS (DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE lower(email) = ANY($1::text[])) RETURNING 1) SELECT count(*) AS n FROM gone`,
          [emails]
        )
        const n = Number(rows[0]?.n ?? 0)
        await ctx.tx.query(`UPDATE mutations SET args = $2 WHERE id = $1`, [ctx.mutationId, JSON.stringify({ personId: person.id, count: n })])
        return n
      }
    )
    return { ended }
  })
}
