import { CHANGE_SHOWN_DAYS, crewCall as callSchema, DEFAULT_LEVEL, eachDay, HOLDING, WHATSAPP_AFTER, offer as offerSchema, splitName, tidyNeeds, type CrewCall, type Offer, type Person, type Unavailability, type Watched, type WatchedStep } from '@sh/shared'
import type { EndedBy } from '@sh/shared'
import type { Queryable } from '../db.ts'
import { sortByIds } from '../projects/store.ts'

/** Reading crew rows back as the entities devices and pages see. */

const PERSON = `id, name, first_name, last_name, kind, email, other_emails, phone, skills, day_rate_cents, notes, link_token, archived, approves_leave, department, level, known_as, certificates, company_name, company_vat_number, company_cro_number, role, photo_at, name_checked, whatsapp_off`
const CALL = `id, project_id, phase_id, project, phase, venue, role, start_day::text, end_day::text, call_time, needed, day_rate_cents, details, reply_by::text, status, needs_certificates, department, stopped_on::text`
// The offer's own WhatsApp message, newest first (ADR 0125): where Meta says it has got to. And the newest that followed it
// (ADR 0154): that they're booked, the new call time, no longer needed, the job going ahead or off.
const OFFER = `id, call_id, person_id, status, days, asked, day_rate_cents, counter_rate_cents, note, responded_at, responded_via, override, seen_at, no_own_invite, stopped_on::text,
  (SELECT json_build_object('state', w.state, 'at', coalesce(w.read_at, w.delivered_at, w.sent_at, w.tried_at, w.made_at), 'problem', w.problem)
     FROM whatsapp_messages w WHERE w.offer_id = offers.id AND w.kind = 'offer' ORDER BY w.made_at DESC LIMIT 1) AS whatsapp,
  (SELECT json_build_object('kind', w.kind, 'state', w.state, 'at', coalesce(w.read_at, w.delivered_at, w.sent_at, w.tried_at, w.made_at), 'problem', w.problem)
     FROM whatsapp_messages w WHERE w.offer_id = offers.id AND w.kind <> 'offer' ORDER BY w.made_at DESC, w.id DESC LIMIT 1) AS whatsapp_after`
const AWAY = `id, person_id, start_day::text, end_day::text, note, source`

type Row = Record<string, any>

export const toPerson = (r: Row): Person => ({
  id: r.id,
  name: r.name,
  // Held since the two were asked for; a row from before is split from the whole name, as its migration split them.
  ...(r.first_name ? { firstName: r.first_name, lastName: r.last_name ?? '' } : splitName(r.name)),
  kind: r.kind,
  email: r.email,
  // Only once combined with someone (ADR 0055), so a person never combined is sent as before.
  ...(r.other_emails?.length ? { otherEmails: r.other_emails } : {}),
  phone: r.phone,
  skills: r.skills,
  dayRateCents: r.day_rate_cents,
  notes: r.notes,
  linkToken: r.link_token,
  archived: r.archived ?? false,
  approvesLeave: r.approves_leave ?? false,
  department: r.department ?? null,
  level: r.level ?? DEFAULT_LEVEL,
  knownAs: r.known_as ?? null,
  certificates: r.certificates ?? {},
  // A company is there when any of its three columns is.
  company: r.company_name || r.company_vat_number || r.company_cro_number ? { name: r.company_name ?? '', vatNumber: r.company_vat_number ?? null, croNumber: r.company_cro_number ?? null } : null,
  role: r.kind === 'staff' ? (r.role ?? null) : null,
  // Only once they have one (ADR 0065), so a person without is sent as before.
  ...(r.photo_at ? { photo: { at: new Date(r.photo_at).toISOString() } } : {}),
  // Only once checked (ADR 0068), so everyone else is sent as before.
  ...(r.name_checked ? { nameChecked: true } : {}),
  // Only once off (ADR 0125), so everyone else is sent as before.
  ...(r.whatsapp_off ? { whatsappOff: true } : {}),
})
export const toCall = (r: Row): CrewCall => ({
  id: r.id,
  projectId: r.project_id ?? null,
  phaseId: r.phase_id ?? null,
  project: r.project,
  phase: r.phase,
  venue: r.venue,
  role: r.role,
  start: r.start_day,
  end: r.end_day,
  callTime: r.call_time,
  needed: r.needed,
  dayRateCents: r.day_rate_cents,
  details: r.details,
  replyBy: r.reply_by,
  status: r.status,
  needsCertificates: tidyNeeds(r.needs_certificates),
  department: r.department ?? null,
  // Only on a call cancelled along with its job (ADR 0164), so every other call is sent as before.
  ...(r.stopped_on ? { stoppedOn: r.stopped_on } : {}),
})
export const toOffer = (r: Row): Offer => ({
  id: r.id,
  callId: r.call_id,
  personId: r.person_id,
  status: r.status,
  days: r.days,
  // Only on an offer with days still asked (ADR 0152); a row read without the column has none.
  ...(Array.isArray(r.asked) && r.asked.length ? { asked: r.asked } : {}),
  dayRateCents: r.day_rate_cents,
  counterRateCents: r.counter_rate_cents,
  note: r.note,
  respondedAt: r.responded_at ? new Date(r.responded_at).toISOString() : null,
  respondedVia: r.responded_via,
  override: r.override,
  seenAt: r.seen_at ? new Date(r.seen_at).toISOString() : null,
  // Only on an offer on a job brought in from Google Calendar that has no invite of its own, saying why (ADR 0157).
  ...(r.no_own_invite ? { noOwnInvite: r.no_own_invite } : {}),
  // Only on an offer cancelled along with its job (ADR 0164).
  ...(r.stopped_on ? { stoppedOn: r.stopped_on } : {}),
  ...(r.whatsapp ? { whatsapp: { state: r.whatsapp.state, at: new Date(r.whatsapp.at).toISOString(), problem: r.whatsapp.problem ?? null } } : {}),
  // Only a kind this version knows, so a device a version behind is never sent one it can't read.
  ...(r.whatsapp_after && WHATSAPP_AFTER.includes(r.whatsapp_after.kind)
    ? { whatsappAfter: { kind: r.whatsapp_after.kind, state: r.whatsapp_after.state, at: new Date(r.whatsapp_after.at).toISOString(), problem: r.whatsapp_after.problem ?? null } }
    : {}),
})
export const toAway = (r: Row): Unavailability => ({
  id: r.id,
  personId: r.person_id,
  start: r.start_day,
  end: r.end_day,
  note: r.note,
  source: r.source,
})

export async function getPerson(q: Queryable, id: string) {
  const { rows } = await q.query(`SELECT ${PERSON} FROM people WHERE id = $1`, [id])
  return rows[0] ? toPerson(rows[0]) : undefined
}
/** Several people at once, in the order asked for. */
export async function getPeople(q: Queryable, ids: readonly string[]) {
  if (ids.length === 0) return []
  const { rows } = await q.query(`SELECT ${PERSON} FROM people WHERE id = ANY($1::text[])`, [ids])
  return sortByIds(rows.map(toPerson), ids)
}
/**
 * The person a private link belongs to: theirs, or the link of someone
 * they were combined with (ADR 0055), which opens the one person. An
 * archived person's link is gone with them.
 */
export async function personByToken(q: Queryable, token: string) {
  if (!token || token.length < 16) return undefined
  const { rows } = await q.query(
    `SELECT ${PERSON} FROM people WHERE NOT archived AND (link_token = $1 OR id = (SELECT into_id FROM person_merges WHERE link_token = $1)) ORDER BY link_token = $1 DESC LIMIT 1`,
    [token]
  )
  return rows[0] ? toPerson(rows[0]) : undefined
}
/** Whether an address is a person's, as SQL on `people`: their own, or one they had as someone they were combined with (ADR 0055). `$n` is the address, trimmed and in small letters. */
export const HAS_EMAIL = (param: string) => `(lower(trim(email)) = ${param} OR other_emails ? ${param})`
/** The person a signed-in account is, by email, case aside (ADR 0024): the match the feed card on You makes. */
export async function personByEmail(q: Queryable, email: string) {
  const wanted = email.trim().toLowerCase()
  if (!wanted) return undefined
  const { rows } = await q.query(`SELECT ${PERSON} FROM people WHERE ${HAS_EMAIL('$1')} AND NOT archived ORDER BY id LIMIT 1`, [wanted])
  return rows[0] ? toPerson(rows[0]) : undefined
}
export async function getCall(q: Queryable, id: string, lock = false) {
  const { rows } = await q.query(`SELECT ${CALL} FROM crew_calls WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id])
  return rows[0] ? toCall(rows[0]) : undefined
}
/** Several calls at once, in the order asked for. */
export async function getCalls(q: Queryable, ids: readonly string[]) {
  if (ids.length === 0) return []
  const { rows } = await q.query(`SELECT ${CALL} FROM crew_calls WHERE id = ANY($1::text[])`, [ids])
  return sortByIds(rows.map(toCall), ids)
}
/** Several offers at once, in the order asked for. */
export async function getOffers(q: Queryable, ids: readonly string[]) {
  if (ids.length === 0) return []
  const { rows } = await q.query(`SELECT ${OFFER} FROM offers WHERE id = ANY($1::text[])`, [ids])
  return sortByIds(rows.map(toOffer), ids)
}
export async function getOffer(q: Queryable, id: string) {
  const { rows } = await q.query(`SELECT ${OFFER} FROM offers WHERE id = $1`, [id])
  return rows[0] ? toOffer(rows[0]) : undefined
}
export async function offersForCall(q: Queryable, callId: string) {
  const { rows } = await q.query(`SELECT ${OFFER} FROM offers WHERE call_id = $1`, [callId])
  return rows.map(toOffer)
}
/**
 * How many people hold each day of each of these calls (accepted or
 * confirmed), in one query for all of them: a freelancer's page needs it for
 * every call they were ever offered, which would otherwise be a query each.
 */
export async function heldByCall(q: Queryable, calls: readonly CrewCall[]): Promise<Map<string, Record<string, number>>> {
  const held = new Map<string, Record<string, number>>()
  for (const c of calls) if (!held.has(c.id)) held.set(c.id, Object.fromEntries(eachDay(c.start, c.end).map((d) => [d, 0])))
  const ids = [...held.keys()]
  if (ids.length === 0) return held
  const { rows } = await q.query<{ call_id: string; days: string[] }>(
    `SELECT call_id, days FROM offers WHERE status IN ('accepted', 'confirmed') AND call_id = ANY($1::text[])`,
    [ids]
  )
  for (const r of rows) {
    const byDay = held.get(r.call_id)!
    for (const d of r.days) if (d in byDay) byDay[d]!++
  }
  return held
}
export async function getAway(q: Queryable, id: string) {
  const { rows } = await q.query(`SELECT ${AWAY} FROM unavailability WHERE id = $1`, [id])
  return rows[0] ? toAway(rows[0]) : undefined
}
export async function awayFor(q: Queryable, personId: string) {
  const { rows } = await q.query(`SELECT ${AWAY} FROM unavailability WHERE person_id = $1 ORDER BY start_day`, [personId])
  return rows.map(toAway)
}

const OFFER_WITH_CALL = `o.id, o.call_id, o.person_id, o.status, o.days, o.asked, o.day_rate_cents, o.counter_rate_cents, o.note,
            o.responded_at, o.responded_via, o.override, o.seen_at, o.no_own_invite,
            c.id AS c_id, c.project_id AS c_project_id, c.phase_id AS c_phase_id,
            c.project AS c_project, c.phase AS c_phase, c.venue AS c_venue, c.role AS c_role,
            c.start_day::text AS c_start_day, c.end_day::text AS c_end_day, c.call_time AS c_call_time,
            c.needed AS c_needed, c.day_rate_cents AS c_day_rate_cents, c.details AS c_details,
            c.reply_by::text AS c_reply_by, c.status AS c_status, c.needs_certificates AS c_needs_certificates,
            c.department AS c_department`

const withCalls = (rows: Row[]) =>
  rows.map((r) => {
    const c: Row = {}
    for (const [k, v] of Object.entries(r)) if (k.startsWith('c_')) c[k.slice(2)] = v
    return { offer: toOffer(r), call: toCall(c) }
  })

/**
 * Of these jobs, the ones the client hasn't said yes to yet (an enquiry, or quoted): anyone asked for one is asked to
 * hold the day, and their page and call sheet say so (ADR 0150).
 */
export async function jobsNotYetAgreed(q: Queryable, projectIds: readonly (string | null | undefined)[]): Promise<Set<string>> {
  const ids = [...new Set(projectIds.filter((id): id is string => !!id))]
  if (ids.length === 0) return new Set()
  const { rows } = await q.query<{ id: string }>(`SELECT id FROM projects WHERE id = ANY($1::text[]) AND status IN ('enquiry', 'quoted')`, [ids])
  return new Set(rows.map((r) => r.id))
}

/** A person's offers with their calls, newest call first. */
export async function offersFor(q: Queryable, personId: string) {
  const { rows } = await q.query(
    `SELECT ${OFFER_WITH_CALL}
       FROM offers o JOIN crew_calls c ON c.id = o.call_id
      WHERE o.person_id = $1
      ORDER BY c.start_day, c.project`,
    [personId]
  )
  return withCalls(rows)
}

/**
 * How an offer ended on the office's side (UX sweep, 6 November 2026, move 6): the job was cancelled, or didn't go ahead
 * (lost), taking its calls with it; the office withdrew it, cancelled its call, or stopped a job it has since started
 * again; or someone else took the last place.
 */
export type { EndedBy }

/** When and how an offer ended, and whether it was a booking then: they'd said yes, or were booked. */
export interface Ended {
  at: string
  by: EndedBy
  held: boolean
}

/**
 * When and how each of these offers ended, if it was withdrawn or filled, by offer, from the change log: the offer keeps
 * when its person answered, but not when the office withdrew it or someone else took the place. The first change to give
 * it the status it has now, the command that made it, which says whether a job was stopped, and the status it had before.
 * Read from the log, with the stopped job's status as it is now, in one read for offers the page has already read.
 */
export async function endedOn(q: Queryable, offers: readonly Pick<Offer, 'id' | 'status'>[]): Promise<Map<string, Ended>> {
  const status = new Map(offers.filter((o) => o.status === 'cancelled' || o.status === 'filled').map((o) => [o.id, o.status]))
  if (status.size === 0) return new Map()
  const { rows } = await q.query<{ id: string; status: string; at: Date | string; command: string | null; job: string | null; now: string | null; was: string | null }>(
    `SELECT e.id, e.status, e.at, m.name AS command, m.args->>'status' AS job, j.status AS now,
            (SELECT p.data->>'status' FROM changes p
              WHERE p.entity_id = e.id AND p.entity = 'offer' AND p.seq < e.seq
              ORDER BY p.seq DESC LIMIT 1) AS was
       FROM (SELECT DISTINCT ON (entity_id) entity_id AS id, data->>'status' AS status, data->>'callId' AS call_id, seq, at, mutation_id
               FROM changes
              WHERE entity = 'offer' AND entity_id = ANY($1::text[]) AND data->>'status' IN ('cancelled', 'filled')
              ORDER BY entity_id, seq) e
       LEFT JOIN mutations m ON m.id = e.mutation_id
       LEFT JOIN crew_calls c ON c.id = e.call_id
       LEFT JOIN projects j ON j.id = c.project_id`,
    [[...status.keys()]]
  )
  // A stopped job is said as it stands now, as the app's person page reads it: cancelled and then marked lost, it didn't go
  // ahead; started again since, it's going ahead without them, which is the office's doing.
  const by = (r: (typeof rows)[number]): EndedBy => {
    if (r.status === 'filled') return 'filled'
    const stopped = r.command === 'project.update' && (r.job === 'cancelled' || r.job === 'lost')
    return stopped && r.now === 'cancelled' ? 'job-cancelled' : stopped && r.now === 'lost' ? 'job-lost' : 'withdrawn'
  }
  return new Map(
    rows
      .filter((r) => status.get(r.id) === r.status)
      .map((r) => [r.id, { at: new Date(r.at).toISOString(), by: by(r), held: HOLDING.some((s) => s === r.was) }])
  )
}

/** A booking as the log has it since its person said yes (UX sweep, 6 November 2026, move 6), for `sinceYes`. */
export interface YesLog {
  yes: Watched
  before: Watched
  steps: WatchedStep[]
}

/** The facts the link watches in a logged offer or call, or nothing where the log holds a shape these can't read. */
const offerFacts = offerSchema.pick({ days: true })
const callFacts = callSchema.pick({ callTime: true, venue: true })

/**
 * What the log holds of each of these bookings since its yes, by offer, in one bounded read per page whatever the
 * number of bookings, reading nothing it writes: the offer's change that recorded their answer, the call as it stood
 * then, both as they stood a week ago, and every change to either since. Changes older than a week are no longer news,
 * so they're never read one by one. The yes is the change that gave the offer the answer it holds now. A booking from
 * before the log, with no answer or no call in it, isn't watched.
 */
export async function yesLogs(q: Queryable, bookings: readonly { offer: Offer; call: CrewCall }[], now = new Date()): Promise<Map<string, YesLog>> {
  const watched = bookings.filter((b) => b.offer.respondedAt !== null)
  if (watched.length === 0) return new Map()
  const { rows } = await q.query<{ offer_id: string; kind: 'yes' | 'then' | 'before' | 'step'; entity: string; seq: string; at: Date | string; data: unknown }>(
    `WITH yes AS (
       SELECT b.offer_id, b.call_id, y.seq, y.at, y.data
         FROM unnest($1::text[], $2::text[], $3::text[]) AS b(offer_id, call_id, responded_at)
         JOIN LATERAL (SELECT seq, at, data FROM changes
                        WHERE entity_id = b.offer_id AND entity = 'offer' AND data->>'respondedAt' = b.responded_at
                        ORDER BY seq LIMIT 1) y ON true
     )
     SELECT offer_id, 'yes' AS kind, 'offer' AS entity, seq, at, data FROM yes
     UNION ALL
     SELECT yes.offer_id, 'then', 'crewCall', t.seq, t.at, t.data FROM yes
       JOIN LATERAL (SELECT seq, at, data FROM changes
                      WHERE entity_id = yes.call_id AND entity = 'crewCall' AND seq < yes.seq
                      ORDER BY seq DESC LIMIT 1) t ON true
     UNION ALL
     SELECT yes.offer_id, 'before', w.entity, w.seq, w.at, w.data FROM yes
       JOIN LATERAL ((SELECT entity, seq, at, data FROM changes
                       WHERE entity_id = yes.offer_id AND entity = 'offer' AND seq > yes.seq AND at <= $4
                       ORDER BY seq DESC LIMIT 1)
                     UNION ALL
                     (SELECT entity, seq, at, data FROM changes
                       WHERE entity_id = yes.call_id AND entity = 'crewCall' AND seq > yes.seq AND at <= $4
                       ORDER BY seq DESC LIMIT 1)) w ON true
     UNION ALL
     SELECT yes.offer_id, 'step', s.entity, s.seq, s.at, s.data FROM yes
       JOIN changes s ON s.entity_id IN (yes.offer_id, yes.call_id) AND s.entity IN ('offer', 'crewCall') AND s.seq > yes.seq AND s.at > $4`,
    [watched.map((b) => b.offer.id), watched.map((b) => b.call.id), watched.map((b) => b.offer.respondedAt), new Date(now.getTime() - CHANGE_SHOWN_DAYS * 86_400_000).toISOString()]
  )
  const byOffer = new Map<string, typeof rows>()
  for (const r of rows) byOffer.set(r.offer_id, [...(byOffer.get(r.offer_id) ?? []), r])
  const logs = new Map<string, YesLog>()
  for (const [id, list] of byOffer) {
    list.sort((a, b) => Number(a.seq) - Number(b.seq))
    const days = offerFacts.safeParse(list.find((r) => r.kind === 'yes')?.data)
    const then = callFacts.safeParse(list.find((r) => r.kind === 'then')?.data)
    if (!days.success || !then.success) continue
    const yes: Watched = { days: days.data.days, callTime: then.data.callTime, venue: then.data.venue }
    // A change read is laid over the booking as it stood; one this can't read leaves it as it was.
    const over = (w: Watched, r: (typeof rows)[number]): Watched | undefined => {
      if (r.entity === 'offer') {
        const o = offerFacts.safeParse(r.data)
        return o.success ? { ...w, days: o.data.days } : undefined
      }
      const c = callFacts.safeParse(r.data)
      return c.success ? { ...w, callTime: c.data.callTime, venue: c.data.venue } : undefined
    }
    const before = list.filter((r) => r.kind === 'before').reduce((w, r) => over(w, r) ?? w, yes)
    const steps: WatchedStep[] = []
    let state = before
    for (const r of list.filter((x) => x.kind === 'step')) {
      const after = over(state, r)
      steps.push({ at: new Date(r.at), after })
      state = after ?? state
    }
    logs.set(id, { yes, before, steps })
  }
  return logs
}

/** Everyone, and every job anyone holds, for building all the calendar feeds at once (ADR 0012). */
export async function everyonesBookings(q: Queryable) {
  const people = await q.query(`SELECT ${PERSON} FROM people ORDER BY id`)
  const { rows } = await q.query(
    `SELECT ${OFFER_WITH_CALL}
       FROM offers o JOIN crew_calls c ON c.id = o.call_id
      WHERE o.status IN ('accepted', 'confirmed') AND c.status = 'open'
      ORDER BY c.start_day, c.project, o.id`
  )
  return { people: people.rows.map(toPerson), bookings: withCalls(rows) }
}

/** A job's calls still open, for stopping the job or removing a phase. */
export async function openCallsFor(q: Queryable, by: { projectId: string } | { phaseId: string }) {
  const [column, value] = 'projectId' in by ? ['project_id', by.projectId] : ['phase_id', by.phaseId]
  const { rows } = await q.query(`SELECT ${CALL} FROM crew_calls WHERE ${column} = $1 AND status = 'open' ORDER BY start_day, id`, [value])
  return rows.map(toCall)
}

/**
 * Of these days, the ones a person holds on calls other than one, with the
 * job holding them: a yes, or a booking, on a call still going ahead. From
 * their offers with their calls (offersFor), so the rules, which read them
 * for it, and the freelancer's page, which has them already, always agree.
 */
export function heldElsewhereIn(theirs: readonly { offer: Offer; call: CrewCall }[], days: readonly string[], exceptCallId: string) {
  const out: { project: string; days: string[] }[] = []
  for (const { offer, call } of theirs) {
    if (call.id === exceptCallId || !HOLDING.includes(offer.status) || call.status !== 'open') continue
    const hit = offer.days.filter((d) => days.includes(d))
    if (hit.length) out.push({ project: call.phase ? `${call.project} (${call.phase})` : call.project, days: hit })
  }
  return out
}

/** Offers, other than one, that hold any of these days for a person. */
export async function heldElsewhere(q: Queryable, personId: string, days: string[], exceptCallId: string) {
  return heldElsewhereIn(await offersFor(q, personId), days, exceptCallId)
}

/**
 * What would be left hanging if a person were archived: an offer still
 * waiting on someone, or days they hold, from today on. The first by date.
 */
export async function holdsFrom(q: Queryable, personId: string, today: string) {
  const { rows } = await q.query<Row>(
    `SELECT o.status, o.days, c.project, c.phase, c.end_day::text AS end_day
       FROM offers o JOIN crew_calls c ON c.id = o.call_id
      WHERE o.person_id = $1 AND c.status = 'open' AND c.end_day >= $2::date
        AND o.status IN ('offered', 'countered', 'accepted', 'confirmed')
      ORDER BY c.start_day, c.project`,
    [personId, today]
  )
  for (const r of rows) {
    const holding = r.status === 'accepted' || r.status === 'confirmed'
    if (holding && !(r.days as string[]).some((d) => d >= today)) continue
    return { status: r.status as Offer['status'], project: r.phase ? `${r.project} (${r.phase})` : (r.project as string) }
  }
  return undefined
}

export async function awayOn(q: Queryable, personId: string, days: string[]) {
  const all = await awayFor(q, personId)
  return all
    .map((u) => ({ u, hit: days.filter((d) => d >= u.start && d <= u.end) }))
    .filter((x) => x.hit.length)
}
