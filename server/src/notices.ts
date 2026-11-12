import {
  dayLabel,
  documentsRead,
  HOLDING,
  irishToday,
  jobOnHold,
  KIT_OF,
  LIVE,
  NOTICE_WHY,
  offerNews,
  PROJECT_STATUSES,
  readsEveryRate,
  STOPPED,
  type Notice,
  type NoticesPage,
  type OfferNews,
  type OfferStanding,
  type OfferStatus,
} from '@sh/shared'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { HAS_EMAIL } from './crew/store.ts'
import type { Db, Queryable } from './db.ts'
import { SELECT, toEntries, type DocumentsRead, type Row } from './history.ts'
import { usesTimesheets } from './office/store.ts'
import { readingOf } from './reading.ts'

/**
 * Notifications (ADR 0058): the changes other people made, lately, to what
 * is someone's own. Read from the history (ADR 0006), so each says what was
 * done in the same words the History tab uses, by whom and when, and
 * nothing new is kept but how far each person has read. In the app only:
 * nothing here sends an email, a text or a push to anyone.
 *
 * What's someone's own, nearest them first (`NOTICE_WHY`):
 *
 * - **you**: their record on the Crew tab, their offers and bookings, the
 *   timesheets for them, their leave, days in lieu and allowance, days
 *   marked off, their documents, the vans they're down to drive, the
 *   job steps given to them (ADR 0073), and what they asked to be bought
 *   (ADR 0077);
 * - **sent**: the offers they sent, so an answer comes back to them;
 * - **on**: the jobs they're on, as crew on a live offer, the contact on
 *   the day for a phase, a driver, or with a step of it given to them: the
 *   job, its phases and its calls;
 * - **made**: the jobs they made in the app, with the offers on them.
 *
 * With nobody signed in (a demo copy, or sign-in off), the device is the
 * person: the jobs made and offers sent on it are its own.
 *
 * And, last, the hand-offs that make it their department's turn (UX sweep,
 * 6 November 2026, move 12), once per job each, read from history rows that
 * exist: a job going confirmed, to the heads of the departments on its calls
 * and kit and the warehouse's heads ("Confirmed: Harbour Lights, Mon 9
 * Nov"); and a job's first kit scanned out, to the office ("Gone out:
 * Harbour Lights").
 *
 * Their own changes are never news to them, on any device, nor on their
 * private link or in Google Calendar. Noting an answer (`offer.seen`) is
 * the office's housekeeping, so it's left out.
 */

/** How far back the list goes. */
export const NOTICE_DAYS = 30
/** The most the list holds. */
export const NOTICE_LIMIT = 100
/** Changes that are housekeeping, never news. */
const QUIET = ['offer.seen']
/** Timesheets' changes, which aren't news while the company doesn't use timesheets (ADR 0090). */
const TIMESHEET_CHANGES = ['timesheet.send', 'timesheet.approve', 'timesheet.reopen']

export interface NoticeReader {
  /** The signed-in account; none on a demo copy or while sign-in is off. */
  userId?: string
  /** Who they are on the Crew tab, when found. */
  personId?: string
  /** This device, whose changes are theirs too while nobody is signed in. */
  clientId?: string
}

/** A change they made: by their account, or, with nobody signed in, on this device. */
const BY_THEM = `($1::text IS NOT NULL AND m.user_id = $1::text OR $1::text IS NULL AND $7::text IS NOT NULL AND m.client_id = $7::text)`

interface Hit {
  id: string
  rank: number
  about: string
}

/** The changes, newest first, that others made to what's this reader's own. */
export async function readNotices(q: Queryable, reader: NoticeReader, rates = true, notes = true, timesheets = true, docs: DocumentsRead = true): Promise<Notice[]> {
  const user = reader.userId ?? null
  const person = reader.personId ?? null
  // What they did themselves, wherever they did it.
  const own = [...(person ? [`link:${person}`, `calendar:${person}`, `whatsapp:${person}`] : []), ...(reader.clientId ? [reader.clientId] : [])]
  const { rows: hits } = await q.query<Hit>(
    `WITH made AS (
       SELECT m.args->>'id' AS id FROM mutations m
        WHERE ${BY_THEM} AND m.name = 'project.create' AND m.status = 'applied'
     ),
     onjob AS (
       SELECT c.project_id AS id FROM offers o JOIN crew_calls c ON c.id = o.call_id
        WHERE o.person_id = $2::text AND o.status = ANY($3::text[]) AND c.project_id IS NOT NULL
       UNION SELECT project_id FROM phases WHERE contact_id = $2::text
       UNION SELECT project_id FROM vehicle_bookings WHERE driver_id = $2::text
       UNION SELECT project_id FROM job_steps WHERE owner_id = $2::text
     ),
     mine (entity, id, rank) AS (
       SELECT 'person', $2::text, 0 WHERE $2::text IS NOT NULL
       UNION ALL SELECT 'offer', id, 0 FROM offers WHERE person_id = $2::text
       UNION ALL SELECT 'timesheet', t.id, 0 FROM timesheets t JOIN offers o ON o.id = t.id WHERE o.person_id = $2::text
       UNION ALL SELECT 'leaveRequest', id, 0 FROM leave_requests WHERE person_id = $2::text
       UNION ALL SELECT 'lieuEntry', id, 0 FROM lieu_entries WHERE person_id = $2::text
       UNION ALL SELECT 'leaveAllowance', id, 0 FROM leave_allowances WHERE person_id = $2::text
       UNION ALL SELECT 'unavailability', id, 0 FROM unavailability WHERE person_id = $2::text
       UNION ALL SELECT 'document', id, 0 FROM documents WHERE person_id = $2::text
       UNION ALL SELECT 'vehicleBooking', id, 0 FROM vehicle_bookings WHERE driver_id = $2::text
       UNION ALL SELECT 'jobStep', id, 0 FROM job_steps WHERE owner_id = $2::text
       UNION ALL SELECT 'purchaseRequest', id, 0 FROM purchase_requests WHERE asked_by = $2::text
       UNION ALL SELECT 'offer', c.entity_id, 1 FROM mutations m JOIN changes c ON c.mutation_id = m.id
                  WHERE ${BY_THEM} AND m.name = 'offer.send' AND c.entity = 'offer'
       UNION ALL SELECT 'project', id, 2 FROM onjob
       UNION ALL SELECT 'phase', p.id, 2 FROM phases p JOIN onjob j ON j.id = p.project_id
       UNION ALL SELECT 'crewCall', c.id, 2 FROM crew_calls c JOIN onjob j ON j.id = c.project_id
       UNION ALL SELECT 'project', id, 3 FROM made
       UNION ALL SELECT 'phase', p.id, 3 FROM phases p JOIN made j ON j.id = p.project_id
       UNION ALL SELECT 'crewCall', c.id, 3 FROM crew_calls c JOIN made j ON j.id = c.project_id
       UNION ALL SELECT 'offer', o.id, 3 FROM offers o JOIN crew_calls c ON c.id = o.call_id JOIN made j ON j.id = c.project_id
     ),
     hits AS (
       SELECT c.mutation_id AS id, min(mine.rank) AS rank, (array_agg(mine.entity || ':' || mine.id ORDER BY mine.rank, c.seq))[1] AS about
         FROM mine JOIN changes c ON c.entity_id = mine.id AND c.entity = mine.entity
        WHERE c.mutation_id IS NOT NULL AND c.at > now() - make_interval(days => $5::int)
        GROUP BY c.mutation_id
     )
     SELECT h.id, h.rank, h.about FROM hits h JOIN mutations m ON m.id = h.id
      WHERE m.status = 'applied'
        AND NOT ($1::text IS NOT NULL AND m.user_id IS NOT DISTINCT FROM $1::text)
        AND m.client_id <> ALL($4::text[])
        AND m.name <> ALL($6::text[])
      ORDER BY m.received_at DESC, m.id DESC
      LIMIT ${NOTICE_LIMIT}`,
    [user, person, LIVE, own, NOTICE_DAYS, timesheets ? QUIET : [...QUIET, ...TIMESHEET_CHANGES], reader.clientId ?? null],
  )
  const turns = person ? await handOffs(q, person, user, own) : []
  const told = new Map(turns.map((t) => [t.id, t.say]))
  for (const t of turns) if (!hits.some((h) => h.id === t.id)) hits.push({ id: t.id, rank: NOTICE_WHY.indexOf('turn'), about: `project:${t.project}` })
  if (hits.length === 0) return []
  const { rows } = await q.query<Row>(`${SELECT} WHERE m.id = ANY($1::text[]) ORDER BY m.received_at DESC, m.id DESC`, [hits.map((h) => h.id)])
  const byId = new Map(hits.map((h) => [h.id, h]))
  const entries = await toEntries(q, rows, rates, notes, docs)
  // What others did to the reader's own offers, said to them first, with the history's words under it (finding 17).
  const toThem = person ? await offerNewsFor(q, hits.map((h) => h.id), person) : new Map<string, string>()
  return entries.map((e) => {
    const hit = byId.get(e.id)!
    const [entity, ...rest] = hit.about.split(':')
    const said = toThem.get(e.id)
    const forYou = told.get(e.id)
    return {
      ...e,
      why: NOTICE_WHY[Math.min(Number(hit.rank), NOTICE_WHY.length - 1)]!,
      about: { entity: entity!, id: rest.join(':') },
      ...(said ? { said } : {}),
      ...(forYou ? { forYou } : {}),
    }
  })
}

interface OfferChange {
  mutation_id: string
  command: string
  /** The status a job was given, when the change was to a job. */
  job_to: string | null
  status: OfferStatus
  /** The offer's status before the change, from the log. */
  was: OfferStatus | null
  stopped_on: string | null
  role: string
  project: string
  /** The job's status before the change, from the log, or as it is now for a job with none. */
  job_was: string | null
  /** Who took the place, when someone else's yes filled the call. */
  taker: string | null
}

/** "Audio tech", "Audio tech and Rigger", "A, B and C". */
const inWords = (parts: readonly string[]) => (parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`)

/** One change to one of the reader's offers, as news for them, when it's news. */
function newsOf(r: OfferChange): OfferNews | undefined {
  const hold = jobOnHold(r.job_was ?? undefined)
  const was: OfferStanding = r.was === 'confirmed' ? (hold ? 'hold' : 'booked') : 'asked'
  switch (r.status) {
    case 'confirmed':
      return r.was === 'accepted' || r.was === 'countered' ? { kind: 'booked', hold, theirRate: r.was === 'countered' } : undefined
    case 'offered':
      return r.command === 'offer.refuse' ? { kind: 'rate-not-agreed' } : undefined
    case 'cancelled':
      // Cancelled with its job (ADR 0164): the change that stopped the job, which marks the offers it takes with the day.
      if (r.stopped_on || (r.command === 'project.update' && STOPPED.some((s) => s === r.job_to))) return { kind: 'job-stopped', job: r.job_to === 'lost' ? 'lost' : 'cancelled', was }
      if (r.command === 'call.cancel') return { kind: 'call-cancelled', was }
      if (r.command === 'offer.cancel') return { kind: 'withdrawn', was }
      return undefined
    case 'filled':
      return { kind: 'filled', taker: r.taker }
    default:
      return undefined
  }
}

/** How much a piece of news weighs for them, so a change to several of their offers at once says the one that matters most. */
const weight = (n: OfferNews) => ('was' in n ? { booked: 3, hold: 2, asked: 1 }[n.was] : n.kind === 'booked' ? 3 : 1)

/**
 * What others' changes did to this person's own offers, by change, said to them (audit of 12 November 2026, finding 17):
 * booked, or down to hold the day; a rate they asked for not agreed; withdrawn; their call cancelled; their job stopped;
 * someone else's yes that filled the call (audit of 5 November 2026, finding 61); and their job confirmed while they hold
 * the day for it, which books them. Read from the log as each change found things, where they stood and the job's status
 * before it, so an old row still says what happened then. An offer made to them is said by the app, which knows where
 * it's answered (web/src/notices.ts).
 */
export async function offerNewsFor(q: Queryable, mutations: readonly string[], person: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (mutations.length === 0) return out
  const { rows } = await q.query<OfferChange>(
    `SELECT c.mutation_id, m.name AS command, m.args->>'status' AS job_to, c.data->>'status' AS status, c.data->>'stoppedOn' AS stopped_on,
            (SELECT p.data->>'status' FROM changes p
              WHERE p.entity = 'offer' AND p.entity_id = c.entity_id AND p.seq < c.seq ORDER BY p.seq DESC LIMIT 1) AS was,
            cl.role, cl.project,
            coalesce((SELECT j.data->>'status' FROM changes j
                       WHERE j.entity = 'project' AND j.entity_id = cl.project_id AND j.seq < c.seq AND j.mutation_id IS DISTINCT FROM c.mutation_id
                       ORDER BY j.seq DESC LIMIT 1), pr.status) AS job_was,
            CASE WHEN c.data->>'status' = 'filled' THEN
              (SELECT string_agg(DISTINCT pp.name, ' and ') FROM changes t JOIN people pp ON pp.id = t.data->>'personId'
                WHERE t.mutation_id = c.mutation_id AND t.entity = 'offer' AND t.data->>'callId' = cl.id
                  AND t.data->>'status' = ANY($3::text[]) AND t.data->>'personId' <> $2) END AS taker
       FROM changes c JOIN mutations m ON m.id = c.mutation_id JOIN crew_calls cl ON cl.id = c.data->>'callId' LEFT JOIN projects pr ON pr.id = cl.project_id
      WHERE c.mutation_id = ANY($1::text[]) AND c.entity = 'offer' AND c.op = 'put' AND c.data->>'personId' = $2
      ORDER BY c.seq`,
    [mutations, person, HOLDING],
  )
  const byChange = new Map<string, { news: OfferNews; role: string; project: string }[]>()
  for (const r of rows) {
    const news = newsOf(r)
    if (news) byChange.set(r.mutation_id, [...(byChange.get(r.mutation_id) ?? []), { news, role: r.role, project: r.project }])
  }
  for (const [id, list] of byChange) {
    // A job stopped with several of their calls on it is said once, for where they stood most, naming each such role.
    const first = list.reduce((a, b) => (weight(b.news) > weight(a.news) ? b : a))
    const roles = [...new Set(list.filter((x) => x.news.kind === first.news.kind && weight(x.news) === weight(first.news)).map((x) => x.role))]
    out.set(id, offerNews(first.news, inWords(roles), first.project))
  }
  // Their job confirmed while they held the day for it (ADR 0150): from then they're booked, as their invite and WhatsApp say.
  const { rows: confirmed } = await q.query<{ mutation_id: string; project: string; roles: string[] }>(
    `SELECT pc.mutation_id, pr.name AS project, array_agg(DISTINCT cl.role ORDER BY cl.role) AS roles
       FROM changes pc JOIN projects pr ON pr.id = pc.entity_id
       JOIN crew_calls cl ON cl.project_id = pc.entity_id JOIN offers o ON o.call_id = cl.id AND o.person_id = $2
      WHERE pc.mutation_id = ANY($1::text[]) AND pc.entity = 'project' AND pc.op = 'put' AND pc.data->>'status' = 'confirmed'
        AND (SELECT b.data->>'status' FROM changes b
              WHERE b.entity = 'project' AND b.entity_id = pc.entity_id AND b.seq < pc.seq ORDER BY b.seq DESC LIMIT 1) = ANY($3::text[])
        AND (SELECT s.data->>'status' FROM changes s
              WHERE s.entity = 'offer' AND s.entity_id = o.id AND s.seq < pc.seq ORDER BY s.seq DESC LIMIT 1) = 'confirmed'
      GROUP BY pc.mutation_id, pr.name`,
    [mutations, person, PROJECT_STATUSES.filter((s) => jobOnHold(s))],
  )
  for (const c of confirmed) if (!out.has(c.mutation_id)) out.set(c.mutation_id, offerNews({ kind: 'job-confirmed' }, inWords(c.roles), c.project))
  return out
}

interface HandOff {
  /** The change that handed it over. */
  id: string
  project: string
  say: string
}

/**
 * The hand-offs that make it this person's department's turn, in the last month, by others (move 12): the change that
 * confirmed a job, once per time it went confirmed, for a head of a department on its calls or kit or of the
 * warehouse; and the change that scanned a job's first kit out, for the office. In the app only: nobody is emailed
 * (ADR 0048).
 */
export async function handOffs(q: Queryable, person: string, user: string | null, own: string[]): Promise<HandOff[]> {
  const { rows: me } = await q.query<{ role: string | null; department: string | null }>('SELECT role, department FROM people WHERE id = $1 AND NOT archived', [person])
  const role = me[0]?.role
  const department = me[0]?.department?.trim().toLowerCase() || null
  const head = role === 'head' && department
  if (!head && role !== 'office') return []
  const notMine = `m.status = 'applied' AND NOT ($1::text IS NOT NULL AND m.user_id IS NOT DISTINCT FROM $1::text) AND m.client_id <> ALL($2::text[])`
  const out: HandOff[] = []
  if (head) {
    const { rows } = await q.query<{ id: string; project: string; name: string; starts: string | null }>(
      `WITH went AS (
         SELECT c.mutation_id AS id, c.entity_id AS project, c.at,
                c.data->>'status' AS status, lag(c.data->>'status') OVER (PARTITION BY c.entity_id ORDER BY c.seq) AS was
           FROM changes c
          WHERE c.entity = 'project' AND c.op = 'put'
            AND c.entity_id IN (SELECT entity_id FROM changes WHERE entity = 'project' AND data->>'status' = 'confirmed' AND at > now() - make_interval(days => $3::int))
       )
       SELECT w.id, w.project, p.name, to_char(min(ph.start_day), 'YYYY-MM-DD') AS starts
         FROM went w JOIN mutations m ON m.id = w.id JOIN projects p ON p.id = w.project LEFT JOIN phases ph ON ph.project_id = w.project
        WHERE w.status = 'confirmed' AND w.was IS DISTINCT FROM 'confirmed' AND w.at > now() - make_interval(days => $3::int) AND ${notMine}
          AND (
            $4::text = 'warehouse'
            OR EXISTS (SELECT 1 FROM crew_calls cc WHERE cc.project_id = w.project AND lower(trim(cc.department)) = $4::text)
            OR EXISTS (SELECT 1 FROM kit_lines k JOIN models md ON md.id = k.model_id WHERE k.project_id = w.project AND md.department = $5::text)
          )
        GROUP BY w.id, w.project, p.name`,
      [user, own, NOTICE_DAYS, department, KIT_OF[department as string] ?? null],
    )
    out.push(...rows.map((r) => ({ id: r.id, project: r.project, say: `Confirmed: ${r.name}${r.starts ? `, ${dayLabel(r.starts, irishToday())}` : ''}` })))
  }
  if (role === 'office') {
    const { rows } = await q.query<{ id: string; project: string; name: string }>(
      `WITH first AS (
         SELECT DISTINCT ON (c.data->>'projectId') c.mutation_id AS id, c.data->>'projectId' AS project, c.at
           FROM changes c
          WHERE c.entity = 'movement' AND c.op = 'put' AND c.data->>'direction' = 'out' AND c.data->>'undoes' IS NULL
          ORDER BY c.data->>'projectId', c.seq
       )
       SELECT f.id, f.project, p.name FROM first f JOIN mutations m ON m.id = f.id JOIN projects p ON p.id = f.project
        WHERE f.at > now() - make_interval(days => $3::int) AND ${notMine}`,
      [user, own, NOTICE_DAYS],
    )
    out.push(...rows.map((r) => ({ id: r.id, project: r.project, say: `Gone out: ${r.name}` })))
  }
  return out
}

/** Who reads the list: the account, or, with nobody signed in, this device. */
const readerKey = (reader: NoticeReader) => (reader.userId ? `user:${reader.userId}` : reader.clientId ? `client:${reader.clientId}` : undefined)

export async function readUpTo(q: Queryable, reader: NoticeReader): Promise<string | null> {
  const key = readerKey(reader)
  if (!key) return null
  const { rows } = await q.query<{ up_to: string }>(
    `SELECT to_char(up_to AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS up_to FROM notices_read WHERE reader = $1`,
    [key],
  )
  return rows[0]?.up_to ?? null
}

/** They've opened the list up to this change: never back, so a slow device can't undo a quicker one. */
export async function markRead(q: Queryable, reader: NoticeReader, upTo: string) {
  const key = readerKey(reader)
  if (!key) return
  await q.query(
    `INSERT INTO notices_read (reader, up_to) VALUES ($1, $2::timestamptz)
     ON CONFLICT (reader) DO UPDATE SET up_to = greatest(notices_read.up_to, excluded.up_to)`,
    [key, upTo],
  )
}

/** Who this request is: the signed-in account and who they are on the Crew tab, or a demo persona, and the device. */
async function readerOf(db: Db, req: FastifyRequest, clientId: unknown): Promise<NoticeReader> {
  const client = typeof clientId === 'string' && clientId && !clientId.includes(':') ? clientId : undefined
  if (req.user) {
    const wanted = req.user.email.trim().toLowerCase()
    const { rows } = await db.reads.query<{ id: string }>(`SELECT id FROM people WHERE ${HAS_EMAIL('$1')} AND NOT archived ORDER BY id LIMIT 1`, [
      wanted,
    ])
    return { userId: req.user.id, ...(rows[0] ? { personId: rows[0].id } : {}), ...(client ? { clientId: client } : {}) }
  }
  // A demo copy's persona stands in for a member of staff (ADR 0033).
  return { ...(req.reader?.personId ? { personId: req.reader.personId } : {}), ...(client ? { clientId: client } : {}) }
}

export function registerNoticeRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.get<{ Querystring: { client?: string } }>('/api/notices', async (req, reply): Promise<NoticesPage> => {
    reply.header('cache-control', 'no-store')
    const reader = await readerOf(db, req, req.query.client)
    // In the history's words, without crew pay for a role that doesn't see every rate (ADR 0046, ADR 0062).
    const reading = await readingOf(db.reads, req.role, req.reader ?? {})
    const timesheets = await usesTimesheets(db.reads)
    const [notices, upTo] = await Promise.all([
      readNotices(db.reads, reader, readsEveryRate(reading), (reading.details ?? 'all') === 'all', timesheets, documentsRead(reading)),
      readUpTo(db.reads, reader),
    ])
    return { notices, readUpTo: upTo, found: reader.personId !== undefined }
  })

  app.post<{ Body: { upTo?: unknown; client?: unknown } }>('/api/notices/read', async (req, reply) => {
    const upTo = req.body?.upTo
    if (typeof upTo !== 'string' || Number.isNaN(Date.parse(upTo)))
      return reply.code(400).send({ error: 'Say which change the list was read up to.' })
    await markRead(db, await readerOf(db, req, req.body?.client), upTo)
    return { ok: true }
  })
}
