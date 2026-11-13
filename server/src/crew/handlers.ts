import { randomBytes } from 'node:crypto'
import { whatsappSetting } from '../office/store.ts'
import { reachOf } from '../whatsapp/whatsapp.ts'
import { queueBooked, queueCallTime, queueNotNeeded } from '../whatsapp/follow-ups.ts'
import { ADD_A_PHASE, certificateRefusal, certificatesAfter, daysBetween, daysLabel, daysOffPhase, DEFAULT_LEVEL, MOVE_THE_PHASE, phaseDaysRule, departmentForRole, eachDay, RATES_REFUSAL, tidyDepartment, HOLDING, irishToday, LIVE, movedCallSpan, namesAfter, needsOf, offerDaysAfter, REPLY_BY_AFTER, STOPPED, tidyNeeds, roleCan, ROLE_LABELS, emailInUseRefusal, emailBackRefusal, hasEmail, holdsARole, OFFER_NOT_YOURS, offerRateFor, ownSharePct, QUOTE_SETTINGS_ID, OFFER_WAIT_GRACE_SECONDS, OFFER_WAIT_SECONDS, MAX_PHASE_DAYS, mayChangeWhoSignsIn, ownAddressRefusal, sameEmail, whoSignsInRefusal, type CommandArgs, type CrewCall, type Offer, type Person, type Role } from '@sh/shared'
import { emit, emitRemoved, Refused, type Ctx } from '../kernel.ts'
import type { Queryable } from '../db.ts'
import { getPhase, getProject, namesForCall } from '../projects/store.ts'
import { stopOwnCalendar } from './own-calendars.ts'
import { awayFor, awayOn, getAway, getCall, getCalls, getOffer, getPerson, HAS_EMAIL, heldElsewhere, holdsFrom, offersForCall, openCallsFor, personByEmail } from './store.ts'

/**
 * The crew rules the server enforces, whatever device or link a request
 * comes from:
 *
 * - nobody holds two jobs on the same day;
 * - a call never gets more people on a day than it needs, so with a
 *   shortlist the first to accept gets the place and the rest are told;
 * - an offer for a day someone marked off, or already holds elsewhere,
 *   needs an explicit override from ops, which is kept on the offer;
 * - an offer goes only to someone holding every certificate the call
 *   needs, to its last day (ADR 0028), override or not.
 */

type CrewCommand =
  | 'person.upsert'
  | 'person.level'
  | 'person.newLink'
  | 'person.role'
  | 'person.archive'
  | 'person.contact'
  | 'person.whatsapp'
  | 'unavailability.add'
  | 'unavailability.remove'
  | 'call.create'
  | 'call.update'
  | 'call.cancel'
  | 'call.reopen'
  | 'call.department'
  | 'offer.send'
  | 'offer.undo'
  | 'offer.respond'
  | 'offer.confirm'
  | 'offer.refuse'
  | 'offer.cancel'
  | 'offer.seen'
type Handler<N extends CrewCommand> = (ctx: Ctx, args: CommandArgs<N>) => Promise<void>

/** Once someone is a director there is always one, so nobody is locked out of roles (ADR 0034). */
async function keepADirector(ctx: Ctx, leaving: string) {
  const { rows } = await ctx.tx.query(`SELECT 1 FROM people WHERE role = 'director' AND kind = 'staff' AND NOT archived AND id <> $1 LIMIT 1`, [leaving])
  if (!rows.length) throw new Refused({ code: 'conflict', message: 'There has to be at least one director. Make someone else a director first.' })
}

/** Answers that end an offer for good: the person can be offered the same call afresh. */
const OVER: readonly Offer['status'][] = ['declined', 'filled', 'cancelled', 'pulled-out']

/** 24 characters of randomness; the whole secret in a person's link. */
export const newLinkToken = () => randomBytes(18).toString('base64url')

async function emitOffer(ctx: Ctx, id: string) {
  const o = await getOffer(ctx.tx, id)
  if (o) await emit(ctx, 'offer', id, o)
}

async function setOffer(ctx: Ctx, id: string, fields: Partial<Record<string, unknown>>) {
  const keys = Object.keys(fields)
  await ctx.tx.query(
    `UPDATE offers SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...keys.map((k) => (k === 'days' || k === 'asked' ? JSON.stringify(fields[k]) : fields[k]))]
  )
  await emitOffer(ctx, id)
}

/**
 * People holding each day of a call, not counting one offer. People, not
 * offers: two offers to one person never take two places (audit, 20
 * October 2026, finding 25).
 */
function heldByDay(call: CrewCall, offers: Offer[], exceptOfferId?: string) {
  const who: Record<string, Set<string>> = {}
  for (const d of eachDay(call.start, call.end)) who[d] = new Set()
  for (const o of offers) {
    if (o.id === exceptOfferId || !HOLDING.includes(o.status)) continue
    for (const d of o.days) who[d]?.add(o.personId)
  }
  return Object.fromEntries(Object.entries(who).map(([d, s]) => [d, s.size]))
}

/**
 * Can this offer take these days? Refuses with the days still open when the
 * call has filled, and with the other job when the person is booked.
 */
async function checkCanHold(ctx: Ctx, call: CrewCall, offer: Offer, days: string[]) {
  const offers = await offersForCall(ctx.tx, call.id)
  const held = heldByDay(call, offers, offer.id)
  const full = days.filter((d) => held[d]! >= call.needed)
  if (full.length) {
    // "Still open" is what they could still take: a day they already hold isn't news to them (ADR 0152, where it's said on their invite).
    const mine = HOLDING.includes(offer.status) ? offer.days : []
    const open = Object.keys(held).filter((d) => held[d]! < call.needed && !mine.includes(d))
    const filled = `${daysLabel(full)} ${full.length === 1 ? 'has' : 'have'} just been filled.`
    throw new Refused({
      code: 'filled',
      message: open.length
        ? `Sorry, ${filled} Still open: ${daysLabel(open)}.`
        : mine.length
          ? `Sorry, ${filled}`
          : `Sorry, ${jobNamed(call, days)} has just been filled by someone else.`,
    })
  }
  const twice = offers.find((o) => o.id !== offer.id && o.personId === offer.personId && HOLDING.includes(o.status))
  if (twice) throw new Refused({ code: 'conflict', message: "You're already booked on this job. Ask the office to change your days." })
  const clash = await heldElsewhere(ctx.tx, offer.personId, days, call.id)
  if (clash.length) {
    throw new Refused({
      code: 'clash',
      message: `Already booked on ${clash.map((c) => `${c.project} ${daysLabel(c.days)}`).join(' and ')}.`,
    })
  }
}

/**
 * The job a refusal is about, by name ("Harbour Lights Festival, Driver, Thu 19 Nov"): with two or three offers waiting,
 * "this" doesn't say which one went, and its card has already moved down the page (audit, 20 October 2026, finding 49).
 */
const jobNamed = (call: CrewCall, days: string[]) => `${call.project}, ${call.role}, ${daysLabel(days.length ? days : eachDay(call.start, call.end))}`

/**
 * Once every day of a call is covered, tell everyone still waiting, and end the ask for the days someone who said yes to
 * others hasn't answered (ADR 0152). A rate asked for waits for the office to answer it: someone else's yes no longer
 * closes it, only the office's Confirm does (`rates`), which says so before the press (ratesClosedBy).
 */
async function closeIfFull(ctx: Ctx, call: CrewCall, rates = false) {
  const offers = await offersForCall(ctx.tx, call.id)
  const held = heldByDay(call, offers)
  if (Object.values(held).some((n) => n < call.needed)) return
  const filled: string[] = []
  for (const o of offers) {
    if (o.status === 'offered' || (rates && o.status === 'countered')) {
      await setOffer(ctx, o.id, { status: 'filled' })
      filled.push(o.id)
    } else if (o.status === 'accepted' && o.asked?.length) await setOffer(ctx, o.id, { asked: [] })
  }
  // Each of them hears on WhatsApp it was filled by someone else, where it reaches them (ADR 0154).
  await queueNotNeeded(ctx, filled)
}

/**
 * Cancel a call: everyone still offered is told it's withdrawn, and anyone
 * booked on it is released. Also how a job being stopped takes its crew:
 * then `stoppedOn`, the day, marks the call and those offers (ADR 0164), so
 * the same crew can be asked for again once the job is going again.
 */
export async function cancelCall(ctx: Ctx, callId: string, stoppedOn?: string) {
  await ctx.tx.query(`UPDATE crew_calls SET status = 'cancelled', stopped_on = $2 WHERE id = $1`, [callId, stoppedOn ?? null])
  await emit(ctx, 'crewCall', callId, await getCall(ctx.tx, callId))
  for (const o of await offersForCall(ctx.tx, callId))
    if (!OVER.includes(o.status)) await setOffer(ctx, o.id, { status: 'cancelled', asked: [], ...(stoppedOn ? { stopped_on: stoppedOn } : {}) })
}

/**
 * A call cancelled along with its job keeps to its phase while the job is stopped (ADR 0164): nobody is on it, so it moves
 * whenever the phase does, and is asked for again on the phase's days as they are then. Its old offers keep theirs.
 */
export async function moveStoppedCallsWithPhase(ctx: Ctx, phaseId: string, from: { start: string; end: string }, to: { start: string; end: string }) {
  const { rows } = await ctx.tx.query<{ id: string; start: string; end: string }>(
    `SELECT id, start_day::text AS start, end_day::text AS end FROM crew_calls WHERE phase_id = $1 AND status = 'cancelled' AND stopped_on IS NOT NULL ORDER BY id`,
    [phaseId]
  )
  for (const c of rows) {
    const span = movedCallSpan(c, from, to)
    if (span.start === c.start && span.end === c.end) continue
    await ctx.tx.query('UPDATE crew_calls SET start_day = $2, end_day = $3 WHERE id = $1', [c.id, span.start, span.end])
    await emit(ctx, 'crewCall', c.id, await getCall(ctx.tx, c.id))
  }
}

/** "Aoife Byrne", "Aoife Byrne and Dara Walsh", "Aoife Byrne, Dara Walsh and Niall Kerr". */
const names = (list: string[]) => (list.length < 2 ? (list[0] ?? 'someone') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`)

/**
 * Change a call to `next`, taking its offers along. A change of dates
 * moves each live offer's days: all the new days for one holding all the
 * old ones, otherwise the chosen days still in range. A change of rate
 * reaches only offers nobody has answered; accepted, countered and
 * confirmed ones keep what was agreed. Nobody booked is ever left with no
 * days, or put on a day they hold elsewhere, and the call never needs
 * fewer people than are booked: those are refused by name, for the office
 * to release someone or keep the days. Once every day is covered again,
 * anyone still waiting is told it's filled, as after an acceptance. With
 * `shift`, the days people chose move by that many days first: the whole
 * job has moved, so the second day's person stays on the second day.
 */
async function changeCall(ctx: Ctx, call: CrewCall, next: CrewCall, shift = 0) {
  const offers = await offersForCall(ctx.tx, call.id)
  const oldDays = eachDay(call.start, call.end)
  const newDays = eachDay(next.start, next.end)
  const moved = next.start !== call.start || next.end !== call.end
  const changes = new Map<string, { days?: string[]; asked?: string[]; day_rate_cents?: number | null }>()
  const stranded: { booked: string[]; countered: string[] } = { booked: [], countered: [] }
  const daysOf = new Map<string, string[]>()
  for (const o of offers) {
    if (!LIVE.includes(o.status)) continue
    const fields: { days?: string[]; asked?: string[]; day_rate_cents?: number | null } = {}
    let days = o.days
    if (moved) {
      days = offerDaysAfter(o.days, oldDays, newDays, shift)
      if (days.length === 0) {
        const who = (await getPerson(ctx.tx, o.personId))?.name ?? 'Someone'
        if (o.status === 'countered') stranded.countered.push(who)
        else if (o.status !== 'offered') stranded.booked.push(who)
        else days = [...newDays]
      }
      if (days.join() !== o.days.join()) fields.days = days
      // The days still asked of someone who said yes to others move as theirs do (ADR 0152).
      if (o.asked?.length) {
        const asked = offerDaysAfter(o.asked, oldDays, newDays, shift).filter((d) => !days.includes(d))
        if (asked.join() !== o.asked.join()) fields.asked = asked
      }
    }
    // A new rate reaches an offer not yet answered, still kept up to their own rate where it's above it (ADR 0167).
    if (next.dayRateCents !== call.dayRateCents && o.status === 'offered') {
      const who = await getPerson(ctx.tx, o.personId)
      const rate = who ? offerRateFor(next.dayRateCents, who, await ownShareOn(ctx.tx, next.phase)) : next.dayRateCents
      if (rate !== o.dayRateCents) fields.day_rate_cents = rate
    }
    daysOf.set(o.id, days)
    if (Object.keys(fields).length) changes.set(o.id, fields)
  }
  if (stranded.booked.length || stranded.countered.length) {
    const parts: string[] = []
    if (stranded.booked.length)
      parts.push(`${names(stranded.booked)} ${stranded.booked.length === 1 ? 'is' : 'are'} booked for days that would go. Release them or keep those days.`)
    if (stranded.countered.length)
      parts.push(`${names(stranded.countered)} asked for a rate for days that would go. Say no to it or keep those days.`)
    throw new Refused({ code: 'conflict', message: parts.join(' ') })
  }
  // A day new to someone booked may be one they marked off, or hold on another job: the same clashes an offer needs an override for.
  for (const o of offers) {
    if (o.status !== 'accepted' && o.status !== 'confirmed') continue
    const added = (daysOf.get(o.id) ?? []).filter((d) => !o.days.includes(d))
    if (!added.length) continue
    const reasons: string[] = []
    for (const { u, hit } of await awayOn(ctx.tx, o.personId, added)) reasons.push(`marked unavailable ${daysLabel(hit)}${u.note ? ` (${u.note})` : ''}`)
    for (const c of await heldElsewhere(ctx.tx, o.personId, added, call.id)) reasons.push(`already booked on ${c.project} ${daysLabel(c.days)}`)
    if (reasons.length) {
      const who = (await getPerson(ctx.tx, o.personId))?.name ?? 'Someone'
      throw new Refused({ code: 'clash', message: `${who} is ${reasons.join(' and ')}. Release them or keep those days.` })
    }
  }
  const held: Record<string, number> = {}
  for (const d of newDays) held[d] = 0
  for (const o of offers) if (o.status === 'accepted' || o.status === 'confirmed') for (const d of daysOf.get(o.id) ?? []) if (d in held) held[d]!++
  const most = Math.max(0, ...Object.values(held))
  if (next.needed < most) {
    const spare = most - next.needed
    throw new Refused({ code: 'conflict', message: `${most} people are booked; release ${spare === 1 ? 'one' : spare} first.` })
  }
  await ctx.tx.query(
    `UPDATE crew_calls SET project = $2, phase = $3, venue = $4, role = $5, start_day = $6, end_day = $7, call_time = $8,
            needed = $9, day_rate_cents = $10, details = $11, reply_by = $12, needs_certificates = $13, department = $14 WHERE id = $1`,
    [call.id, next.project, next.phase, next.venue, next.role, next.start, next.end, next.callTime, next.needed, next.dayRateCents, next.details, next.replyBy, JSON.stringify(needsOf(next)), next.department ?? null]
  )
  await emit(ctx, 'crewCall', call.id, await getCall(ctx.tx, call.id))
  for (const [id, fields] of changes) await setOffer(ctx, id, fields)
  await closeIfFull(ctx, next)
  // A call time that moved is news to everyone still asked or booked on it, on WhatsApp where it reaches them (ADR 0154).
  if ((next.callTime ?? '') !== (call.callTime ?? '')) await queueCallTime(ctx, call.id)
}

/**
 * A phase's open calls once it moves: each by the same shift as the
 * phase's start, kept inside the phase, with its offers' days along, under
 * the same refusals as changing a call. How a phase takes its crew with it.
 */
export async function moveCallsWithPhase(ctx: Ctx, phaseId: string, from: { start: string; end: string }, to: { start: string; end: string }) {
  for (const c of await openCallsFor(ctx.tx, { phaseId })) {
    const span = movedCallSpan(c, from, to)
    if (span.start === c.start && span.end === c.end) continue
    const call = await getCall(ctx.tx, c.id, true)
    if (call) await changeCall(ctx, call, { ...call, ...span }, daysBetween(from.start, to.start))
  }
}

/**
 * The job and phase a new call is part of, and the names it takes from
 * them (ADR 0007). A call not tied to a job keeps the names as typed.
 */
async function callJob(ctx: Ctx, a: CommandArgs<'call.create'>) {
  let projectId = a.projectId
  const phase = a.phaseId ? await getPhase(ctx.tx, a.phaseId) : undefined
  if (a.phaseId) {
    if (!phase) throw new Refused({ code: 'not-found', message: 'That phase of the job no longer exists.' })
    if (projectId && projectId !== phase.projectId) throw new Refused({ code: 'invalid', message: 'That phase is part of a different job.' })
    projectId = phase.projectId
  }
  if (!projectId) return { projectId: null, phaseId: null, project: a.project, phase: a.phase, venue: a.venue }
  const job = await getProject(ctx.tx, projectId)
  if (!job) throw new Refused({ code: 'not-found', message: 'That job no longer exists.' })
  if (STOPPED.includes(job.status))
    throw new Refused({ code: 'conflict', message: `${job.name} has been ${job.status === 'lost' ? 'marked as lost' : 'cancelled'}, so it needs no crew.` })
  // Crew on a phase are asked for its days: a day outside them has no day on the calendar to invite anyone to (ADR 0159).
  if (phase && daysOffPhase(a, phase).length) throw new Refused({ code: 'invalid', message: `${phaseDaysRule(phase)} ${ADD_A_PHASE}` })
  const names = await namesForCall(ctx.tx, projectId, a.phaseId)
  return { projectId, phaseId: a.phaseId, project: names!.project, phase: names!.phase ?? a.phase, venue: names!.venue ?? a.venue }
}

/**
 * The department a new call for this role is given when none is sent (ADR
 * 0046): from the calls for the same role before it, the people with it as
 * a skill, or the role's own words, as the device works it out.
 */
async function guessDepartment(ctx: Ctx, role: string) {
  const key = role.trim().replace(/\s+/g, ' ').toLowerCase()
  const calls = await ctx.tx.query(
    `SELECT role, department FROM crew_calls WHERE department IS NOT NULL AND lower(regexp_replace(trim(role), '\\s+', ' ', 'g')) = $1`,
    [key]
  )
  const people = await ctx.tx.query(`SELECT skills, department, archived FROM people WHERE department IS NOT NULL AND NOT archived`)
  return departmentForRole(role, { calls: calls.rows.map((r) => ({ role: r.role as string, department: r.department as string })), people: people.rows.map((r) => ({ skills: r.skills as string[], department: r.department as string, archived: false })) })
}

/** Turned down when the sender doesn't read crew rates (ADR 0046): setting or agreeing one is for the office and directors. */
function refuseRates(ctx: Ctx) {
  if (ctx.seesRates === false) throw new Refused({ code: 'forbidden', message: RATES_REFUSAL })
}

async function openCall(ctx: Ctx, callId: string) {
  const call = await getCall(ctx.tx, callId, true)
  if (!call) throw new Refused({ code: 'not-found', message: 'That job no longer exists.' })
  // Off, whatever stopped it: the job cancelled or not going ahead, or the call cancelled. The crew's link says which (UX sweep, 6 November 2026, move 6).
  if (call.status !== 'open') throw new Refused({ code: 'conflict', message: `${call.role} on ${call.project} is off.` })
  return call
}

/**
 * A person's email and kind decide which account is them, and so its role
 * (audit finding 12). An email someone else here already has is refused, so
 * no account can find the wrong person; and those of someone who holds a
 * role are changed only by a role that changes settings, so a head can't
 * move a director's account, or take one.
 */
async function checkWhoSignsIn(ctx: Ctx, was: Person | undefined, next: { id: string; name: string; email: string | null; kind: Person['kind'] }) {
  const emailChanged = !sameEmail(was?.email, next.email)
  if (was && (emailChanged || was.kind !== next.kind) && (ctx.via === 'link' || !mayChangeWhoSignsIn(ctx.role, 'director'))) {
    // The role as kept, which a freelancer who held one still has, and would have again as staff.
    const { rows } = await ctx.tx.query<{ role: Role | null }>('SELECT role FROM people WHERE id = $1', [was.id])
    const held = rows[0]?.role ?? null
    if (holdsARole({ role: held }) && (ctx.via === 'link' || !mayChangeWhoSignsIn(ctx.role, held)))
      throw new Refused({ code: 'forbidden', message: whoSignsInRefusal(was.name, held!, ctx.role) })
  }
  if (!emailChanged || !next.email?.trim()) return
  // The address the sender signs in with goes to nobody else here, even once they've let it go in the same push (audit, 20 October
  // 2026, finding 10); a person made new with it holds no role, so putting yourself on the Crew tab is still yours to do.
  if (ctx.user && was && sameEmail(next.email, ctx.user.email) && !hasEmail(was, ctx.user.email)) throw new Refused({ code: 'forbidden', message: ownAddressRefusal(next.email.trim()) })
  const { rows } = await ctx.tx.query<{ name: string }>(
    `SELECT name FROM people WHERE id <> $1 AND NOT archived AND ${HAS_EMAIL('$2')} ORDER BY id LIMIT 1`,
    [next.id, next.email.trim().toLowerCase()]
  )
  if (rows[0]) throw new Refused({ code: 'conflict', message: emailInUseRefusal(rows[0].name) })
}

export const crewHandlers: { [N in CrewCommand]: Handler<N> } = {
  async 'person.upsert'(ctx, a) {
    // Only staff approve time off (ADR 0024); an edit from a version of the app that doesn't know the flag keeps it as it is,
    // and one that says nothing about the profile (ADR 0025) keeps that as it is too.
    const was = await getPerson(ctx.tx, a.id)
    const approvesLeave = a.kind === 'staff' ? (a.approvesLeave ?? was?.approvesLeave ?? false) : false
    // Who approves time off is a permission, so once roles are on only a director sets it (ADR 0034).
    if (ctx.role && !roleCan(ctx.role, 'company') && approvesLeave !== (was?.approvesLeave ?? false))
      throw new Refused({ code: 'forbidden', message: `Only directors can say who approves time off. Your role is ${ROLE_LABELS[ctx.role]}.` })
    await checkWhoSignsIn(ctx, was, a)
    // A freelancer has no role, so someone made a freelancer loses theirs; the last director can't be.
    if (a.kind !== 'staff' && was?.role === 'director') await keepADirector(ctx, a.id)
    const department = a.department !== undefined ? a.department : (was?.department ?? null)
    const level = a.level ?? was?.level ?? DEFAULT_LEVEL
    const knownAs = a.knownAs !== undefined ? a.knownAs : (was?.knownAs ?? null)
    // The first and last name make the whole name; a whole name alone keeps the two they have, or is split.
    const names = namesAfter(a, was)
    // An edit from a version that knows fewer kinds keeps the newer ones, and can still clear one it knows (ADR 0028).
    const certificates = certificatesAfter(was?.certificates, a.certificates)
    const company = a.company !== undefined ? a.company : (was?.company ?? null)
    // The usual rate, left out by a role that doesn't read it, or sent by one as it was shown it (none), is kept as it is (ADR 0046).
    const dayRateCents = a.dayRateCents === undefined || ctx.seesRates === false ? (was?.dayRateCents ?? null) : a.dayRateCents
    await ctx.tx.query(
      `INSERT INTO people (id, name, kind, email, phone, skills, day_rate_cents, notes, link_token, approves_leave,
                           department, level, known_as, certificates, company_name, company_vat_number, company_cro_number, first_name, last_name, name_checked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, kind = EXCLUDED.kind, email = EXCLUDED.email,
         phone = EXCLUDED.phone, skills = EXCLUDED.skills, day_rate_cents = EXCLUDED.day_rate_cents, notes = EXCLUDED.notes,
         approves_leave = EXCLUDED.approves_leave, department = EXCLUDED.department, level = EXCLUDED.level, known_as = EXCLUDED.known_as,
         certificates = EXCLUDED.certificates, company_name = EXCLUDED.company_name, company_vat_number = EXCLUDED.company_vat_number,
         company_cro_number = EXCLUDED.company_cro_number, name_checked = EXCLUDED.name_checked`,
      [
        a.id,
        names.name,
        a.kind,
        a.email,
        a.phone,
        JSON.stringify(a.skills),
        dayRateCents,
        a.notes,
        newLinkToken(),
        approvesLeave,
        department,
        level,
        knownAs,
        JSON.stringify(certificates),
        company?.name ?? null,
        company?.vatNumber ?? null,
        company?.croNumber ?? null,
        names.firstName,
        names.lastName,
        // Once the office has checked their name (ADR 0068) it stays checked.
        a.nameChecked === true || (was?.nameChecked ?? false),
      ]
    )
    // The address replaced stays one they're found by, and the new one isn't listed twice (audit, 5 November 2026, finding 10).
    const before = was?.email?.trim().toLowerCase()
    const after = a.email?.trim().toLowerCase()
    if (was && (a.keepEmail || (after && (was.otherEmails ?? []).includes(after)))) {
      const others = (was.otherEmails ?? []).filter((e) => e !== after)
      if (a.keepEmail && before && before !== after && !others.includes(before)) others.push(before)
      await ctx.tx.query('UPDATE people SET other_emails = $2 WHERE id = $1', [a.id, JSON.stringify(others)])
    }
    await emit(ctx, 'person', a.id, await getPerson(ctx.tx, a.id))
  },

  async 'person.level'(ctx, a) {
    const person = await getPerson(ctx.tx, a.id)
    if (!person) throw new Refused({ code: 'not-found', message: 'That person no longer exists.' })
    // The archived list is kept as it was, as offers are.
    if (person.archived) throw new Refused({ code: 'conflict', message: `${person.name} has been archived. Bring them back on the Crew tab to change their level.` })
    await ctx.tx.query('UPDATE people SET level = $2 WHERE id = $1', [a.id, a.level])
    await emit(ctx, 'person', a.id, await getPerson(ctx.tx, a.id))
  },

  async 'person.role'(ctx, a) {
    const person = await getPerson(ctx.tx, a.id)
    if (!person) throw new Refused({ code: 'not-found', message: 'That person no longer exists.' })
    if (person.kind !== 'staff') throw new Refused({ code: 'conflict', message: `${person.name} is a freelancer. Only staff have a role; freelancers use their link.` })
    if (person.archived) throw new Refused({ code: 'conflict', message: `${person.name} has been archived. Bring them back on the Crew tab to change their role.` })
    if (person.role === 'director' && a.role !== 'director') await keepADirector(ctx, a.id)
    await ctx.tx.query('UPDATE people SET role = $2 WHERE id = $1', [a.id, a.role])
    await emit(ctx, 'person', a.id, await getPerson(ctx.tx, a.id))
  },

  async 'person.newLink'(ctx, a) {
    const { rows } = await ctx.tx.query('UPDATE people SET link_token = $2 WHERE id = $1 RETURNING id', [a.id, newLinkToken()])
    if (!rows.length) throw new Refused({ code: 'not-found', message: 'That person no longer exists.' })
    // The links of anyone they were combined with (ADR 0055) stop with theirs: a new link is asked for when one has leaked.
    // The rows stay, saying who was made part of them, for the history.
    await ctx.tx.query(`UPDATE person_merges SET link_token = 'stopped:' || from_id WHERE into_id = $1`, [a.id])
    await emit(ctx, 'person', a.id, await getPerson(ctx.tx, a.id))
  },

  async 'person.archive'(ctx, a) {
    const person = await getPerson(ctx.tx, a.id)
    if (!person) throw new Refused({ code: 'not-found', message: 'That person no longer exists.' })
    if (person.archived === a.archived) return
    if (a.archived) {
      // Archiving the last director would switch roles off for everyone (ADR 0034).
      if (person.role === 'director' && person.kind === 'staff') await keepADirector(ctx, person.id)
      // Nothing is left hanging: an offer waiting on them, or days they hold from today on, is settled first.
      const hold = await holdsFrom(ctx.tx, person.id, irishToday())
      if (hold) {
        const what =
          hold.status === 'confirmed' ? `is booked on ${hold.project}; withdraw their booking on the job's crew first` : hold.status === 'accepted' ? `has accepted ${hold.project}; release them first` : `has an open offer for ${hold.project}; withdraw it first`
        throw new Refused({ code: 'conflict', message: `${person.name} ${what}.` })
      }
    } else if (person.email?.trim()) {
      // Back from the archive, their email must still be theirs alone, or an account could find either of them (ADR 0049).
      const { rows } = await ctx.tx.query<{ name: string }>(
        `SELECT name FROM people WHERE id <> $1 AND NOT archived AND ${HAS_EMAIL('$2')} ORDER BY id LIMIT 1`,
        [person.id, person.email.trim().toLowerCase()]
      )
      if (rows[0]) throw new Refused({ code: 'conflict', message: emailBackRefusal(person.name, rows[0].name) })
    }
    await ctx.tx.query('UPDATE people SET archived = $2 WHERE id = $1', [person.id, a.archived])
    // Their link stops, so they couldn't stop sharing their own calendar themselves: it stops with it (ADR 0044).
    if (a.archived) await stopOwnCalendar(ctx, person.id)
    await emit(ctx, 'person', person.id, await getPerson(ctx.tx, person.id))
  },

  /**
   * A person's own email and phone. On a link the route has already matched
   * the id to the link's person, so the handler only sets what was sent.
   */
  async 'person.contact'(ctx, a) {
    const person = await getPerson(ctx.tx, a.id)
    if (!person) throw new Refused({ code: 'not-found', message: 'That person no longer exists.' })
    if (a.email !== undefined && a.email !== person.email) {
      // Their email is how an account finds them (audit finding 12), so a link, which anyone holding it can use, can't change it.
      if (ctx.via === 'link') throw new Refused({ code: 'forbidden', message: "Your email can't be changed here. Ask the office to change it." })
      await checkWhoSignsIn(ctx, person, { id: person.id, name: person.name, email: a.email, kind: person.kind })
    }
    const fields: [string, string | null][] = []
    if (a.email !== undefined) fields.push(['email', a.email])
    if (a.phone !== undefined) fields.push(['phone', a.phone])
    if (!fields.length) return
    await ctx.tx.query(`UPDATE people SET ${fields.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [person.id, ...fields.map(([, v]) => v)])
    await emit(ctx, 'person', person.id, await getPerson(ctx.tx, person.id))
  },

  /**
   * Offers on WhatsApp for one person (ADR 0125). Their choice, on their own page: the office can turn them off when
   * they ask, but turning them back on is theirs, so nobody is put back on WhatsApp who said no.
   */
  async 'person.whatsapp'(ctx, a) {
    const person = await getPerson(ctx.tx, a.id)
    if (!person) throw new Refused({ code: 'not-found', message: 'That person no longer exists.' })
    if (a.on === !person.whatsappOff) return
    if (a.on && ctx.via !== 'link')
      throw new Refused({ code: 'forbidden', message: `Only ${person.name} can turn offers on WhatsApp back on, on their own page.` })
    await ctx.tx.query('UPDATE people SET whatsapp_off = $2 WHERE id = $1', [person.id, !a.on])
    await emit(ctx, 'person', person.id, await getPerson(ctx.tx, person.id))
  },

  async 'unavailability.add'(ctx, a) {
    if (!(await getPerson(ctx.tx, a.personId))) throw new Refused({ code: 'not-found', message: 'That person no longer exists.' })
    if (await getAway(ctx.tx, a.id)) return
    // From the link, nothing in the past and nothing past a year, as a phase is capped: a slip of the year marked them off
    // for good, and every offer to them was refused until someone saw it. The office can still backdate (audit,
    // 20 October 2026, finding 50).
    if (ctx.via === 'link' && a.start < irishToday()) throw new Refused({ code: 'invalid', message: "The first day off has gone by. Pick today or a day after it." })
    if (daysBetween(a.start, a.end) + 1 > MAX_PHASE_DAYS) throw new Refused({ code: 'invalid', message: `Days off can be at most ${MAX_PHASE_DAYS} days at a time.` })
    // Days off that overlap ones already marked become one row, not two saying the same days (finding 50). Approved leave
    // stays as it is: it is cancelled as leave (ADR 0024). The new row takes the span of all of them, under its own id.
    const overlapping = (await awayFor(ctx.tx, a.personId)).filter((u) => u.source !== 'leave' && u.start <= a.end && u.end >= a.start)
    const start = [a.start, ...overlapping.map((u) => u.start)].sort()[0]!
    const end = [a.end, ...overlapping.map((u) => u.end)].sort().at(-1)!
    const note = [...new Set([...overlapping.map((u) => u.note), a.note].map((n) => n.trim()).filter(Boolean))].join('; ').slice(0, 500)
    for (const u of overlapping) {
      await ctx.tx.query('DELETE FROM unavailability WHERE id = $1', [u.id])
      await emitRemoved(ctx, 'unavailability', u.id)
    }
    await ctx.tx.query(
      'INSERT INTO unavailability (id, person_id, start_day, end_day, note, source) VALUES ($1, $2, $3, $4, $5, $6)',
      [a.id, a.personId, start, end, note, ctx.via === 'link' ? 'self' : 'ops']
    )
    await emit(ctx, 'unavailability', a.id, await getAway(ctx.tx, a.id))
  },

  async 'unavailability.remove'(ctx, a) {
    const away = await getAway(ctx.tx, a.id)
    if (!away) return
    // Approved leave and its days off never disagree: the leave is cancelled instead (ADR 0024).
    if (away.source === 'leave') throw new Refused({ code: 'conflict', message: 'These days off are approved leave: cancel the leave on the Leave screen instead.' })
    await ctx.tx.query('DELETE FROM unavailability WHERE id = $1', [a.id])
    await emitRemoved(ctx, 'unavailability', a.id)
  },

  async 'call.create'(ctx, a) {
    if (await getCall(ctx.tx, a.id)) throw new Refused({ code: 'conflict', message: 'This job already exists.' })
    const job = await callJob(ctx, a)
    // Sent, or else the one its role suggests (ADR 0046), which the office can change.
    const department = a.department !== undefined ? (a.department ? tidyDepartment(a.department) : null) : await guessDepartment(ctx, a.role)
    await ctx.tx.query(
      `INSERT INTO crew_calls (id, project_id, phase_id, project, phase, venue, role, start_day, end_day, call_time, needed, day_rate_cents, details, reply_by, status, needs_certificates, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'open', $15, $16)`,
      [a.id, job.projectId, job.phaseId, job.project, job.phase, job.venue, a.role, a.start, a.end, a.callTime, a.needed, a.dayRateCents, a.details, a.replyBy, JSON.stringify(tidyNeeds(a.needsCertificates)), department]
    )
    await emit(ctx, 'crewCall', a.id, await getCall(ctx.tx, a.id))
  },

  async 'call.update'(ctx, a) {
    const call = await openCall(ctx, a.id)
    if (call.projectId && (a.project !== undefined || a.phase !== undefined || a.venue !== undefined))
      throw new Refused({ code: 'invalid', message: `This call is part of ${call.project}: change the job, its phase or its venue in Jobs.` })
    const next: CrewCall = { ...call }
    for (const k of ['role', 'start', 'end', 'callTime', 'needed', 'dayRateCents', 'details', 'replyBy', 'project', 'phase', 'venue'] as const)
      if (a[k] !== undefined) (next as Record<string, unknown>)[k] = a[k]
    // Needing a certificate refuses nobody already on the call: anyone short of it is warned about on the call's line (ADR 0028).
    if (a.needsCertificates !== undefined) next.needsCertificates = tidyNeeds(a.needsCertificates)
    if (a.department !== undefined) next.department = (a.department ? tidyDepartment(a.department) : null)
    // One end may have moved on another device, so check the call as it will be.
    if (next.start > next.end) throw new Refused({ code: 'invalid', message: `${next.role} on ${next.project} would end before it starts.` })
    // A call on a phase moves within the phase's days; the phase moves it further, taking its crew along (ADR 0159). A call
    // already outside them from before keeps its days until they're changed, and its card says so.
    if (call.phaseId && (a.start !== undefined || a.end !== undefined)) {
      const phase = await getPhase(ctx.tx, call.phaseId)
      if (phase && daysOffPhase(next, phase).length) throw new Refused({ code: 'invalid', message: `${phaseDaysRule(phase)} ${MOVE_THE_PHASE}` })
    }
    // A reply-by day the change sets is asked for before the job is over, as when a call is made (audit finding 21). One a move of dates leaves behind is left to the office.
    if (a.replyBy && a.replyBy > next.end) throw new Refused({ code: 'invalid', message: REPLY_BY_AFTER })
    await changeCall(ctx, call, next)
  },

  async 'call.cancel'(ctx, a) {
    const call = await getCall(ctx.tx, a.id, true)
    if (!call) throw new Refused({ code: 'not-found', message: 'That job no longer exists.' })
    const on = (await offersForCall(ctx.tx, a.id)).filter((o) => LIVE.includes(o.status))
    await cancelCall(ctx, a.id)
    // Everyone asked or booked on it hears on WhatsApp they're no longer needed (ADR 0154). A stopped job takes its calls
    // without this: its crew hear the job's own word (queueJobWhatsApp).
    await queueNotNeeded(ctx, on.map((o) => o.id))
  },

  /**
   * A call cancelled along with its job, asked for again now the job is going again (ADR 0164; audit of 12 November 2026,
   * finding 19): open, with nobody on it, so nothing is sent until someone is offered it. Its old offers stay as they
   * ended. One cancelled on its own, or whose days have all gone, stays as it is.
   */
  async 'call.reopen'(ctx, a) {
    const call = await getCall(ctx.tx, a.id, true)
    if (!call) throw new Refused({ code: 'not-found', message: 'That crew call no longer exists.' })
    // Asked for again already, by a second press or another device.
    if (call.status === 'open') return
    if (!call.stoppedOn) throw new Refused({ code: 'conflict', message: `The ${call.role} call on ${call.project} was cancelled on its own, so it stays cancelled. Add the crew again.` })
    const job = call.projectId ? await getProject(ctx.tx, call.projectId) : undefined
    if (job && STOPPED.includes(job.status))
      throw new Refused({ code: 'conflict', message: `${job.name} is still ${job.status === 'lost' ? 'marked as lost' : 'cancelled'}: set it going again first.` })
    if (call.end < irishToday()) throw new Refused({ code: 'conflict', message: `The ${call.role} call on ${call.project} was for ${daysLabel(eachDay(call.start, call.end))}, which has passed.` })
    await ctx.tx.query(`UPDATE crew_calls SET status = 'open', stopped_on = NULL WHERE id = $1`, [a.id])
    await emit(ctx, 'crewCall', a.id, await getCall(ctx.tx, a.id))
  },

  /** Many calls given one department (ADR 0046); a cancelled one too, so the record is right. One already gone is left out. */
  async 'call.department'(ctx, a) {
    const department = (a.department ? tidyDepartment(a.department) : null)
    const calls = await getCalls(ctx.tx, [...new Set(a.ids)])
    if (calls.length === 0) throw new Refused({ code: 'not-found', message: 'Those calls no longer exist.' })
    for (const c of calls) {
      if ((c.department ?? null) === department) continue
      await ctx.tx.query('UPDATE crew_calls SET department = $2 WHERE id = $1', [c.id, department])
      await emit(ctx, 'crewCall', c.id, await getCall(ctx.tx, c.id))
    }
  },

  async 'offer.send'(ctx, a) {
    if (await getOffer(ctx.tx, a.id)) throw new Refused({ code: 'conflict', message: 'This offer has already been sent.' })
    const call = await openCall(ctx, a.callId)
    const person = await getPerson(ctx.tx, a.personId)
    if (!person) throw new Refused({ code: 'not-found', message: 'That person no longer exists.' })
    if (person.archived) throw new Refused({ code: 'conflict', message: `${person.name} has been archived. Bring them back on the Crew tab to offer them work.` })
    const offers = await offersForCall(ctx.tx, call.id)
    const live = offers.find((o) => o.personId === person.id && !OVER.includes(o.status))
    if (live) throw new Refused({ code: 'conflict', message: `${person.name} already has this offer (${live.status}).` })
    const days = eachDay(call.start, call.end)
    const held = heldByDay(call, offers)
    if (days.every((d) => held[d]! >= call.needed))
      throw new Refused({ code: 'filled', message: `${call.role} on ${call.project} is already filled.` })
    // A condition of the work, not the office's judgement, so "Send anyway" doesn't pass it: the fix is the person's card (ADR 0028).
    const short = certificateRefusal(person, needsOf(call), days, irishToday())
    if (short) throw new Refused({ code: 'conflict', message: short })
    if (!a.override) {
      const reasons: string[] = []
      for (const { u, hit } of await awayOn(ctx.tx, person.id, days))
        reasons.push(`marked unavailable ${daysLabel(hit)}${u.note ? ` (${u.note})` : ''}`)
      for (const c of await heldElsewhere(ctx.tx, person.id, days, call.id)) reasons.push(`booked on ${c.project} ${daysLabel(c.days)}`)
      if (reasons.length)
        throw new Refused({ code: 'clash', message: `${person.name} is ${reasons.join(' and ')}. Send anyway to override.` })
    }
    // Nothing of the app's goes to them for OFFER_WAIT_SECONDS (ADR 0162): the calendar and WhatsApp wait for goes_at, so
    // the office can take a wrong pick back with Undo and nobody is sent a cancellation for it. The offer is made at once.
    // A few seconds more here than the panel offers Undo, so one pressed at the last moment still arrives in time.
    await ctx.tx.query(
      `INSERT INTO offers (id, call_id, person_id, status, days, day_rate_cents, override, goes_at)
       VALUES ($1, $2, $3, 'offered', $4, $5, $6, now() + make_interval(secs => $7))`,
      // At the call's rate, or the person's own where it's above it (ADR 0167): what they're offered is what they're paid.
      [a.id, call.id, person.id, JSON.stringify(days), offerRateFor(call.dayRateCents, person, await ownShareOn(ctx.tx, call.phase)), a.override, OFFER_WAIT_SECONDS + OFFER_WAIT_GRACE_SECONDS]
    )
    // On WhatsApp too, once the office sends offers there and this person hasn't turned them off (ADR 0125): queued with
    // the offer, so it goes only if the offer is made, and sent by the server once its wait is over, never holding the office up.
    const to = reachOf(await whatsappSetting(ctx.tx), person)
    if (to)
      await ctx.tx.query(`INSERT INTO whatsapp_messages (id, offer_id, person_id, kind, to_number, state) VALUES ($1, $2, $3, 'offer', $4, 'queued') ON CONFLICT (id) DO NOTHING`, [
        `offer-${a.id}`,
        a.id,
        person.id,
        to,
      ])
    await emitOffer(ctx, a.id)
  },

  /**
   * Undo, just after Offer (ADR 0162): while nothing of the app's has gone to them and they haven't answered, the offer is
   * gone as if never made, with its WhatsApp that was waiting. After that it's withdrawn instead, which tells them.
   */
  async 'offer.undo'(ctx, a) {
    const { rows } = await ctx.tx.query<{ status: Offer['status']; responded_at: Date | null; waiting: boolean; name: string }>(
      `SELECT o.status, o.responded_at, coalesce(o.goes_at > now(), false) AS waiting, p.name
         FROM offers o JOIN people p ON p.id = o.person_id WHERE o.id = $1 FOR UPDATE OF o`,
      [a.id]
    )
    const o = rows[0]
    // Taken back already, by a second press or another device: nothing more to do.
    if (!o) return
    if (o.status !== 'offered' || o.responded_at) throw new Refused({ code: 'conflict', message: `${o.name} has already answered, so it can't be undone. Withdraw it instead.` })
    if (!o.waiting) throw new Refused({ code: 'conflict', message: `The offer has already gone to ${o.name}, so it can't be undone. Withdraw it instead.` })
    await ctx.tx.query('DELETE FROM whatsapp_messages WHERE offer_id = $1', [a.id])
    await ctx.tx.query('DELETE FROM offers WHERE id = $1', [a.id])
    await emitRemoved(ctx, 'offer', a.id)
  },

  async 'offer.respond'(ctx, a) {
    const offer = await getOffer(ctx.tx, a.id)
    if (!offer) throw new Refused({ code: 'not-found', message: 'That offer no longer exists.' })
    // Signed in without the crew ability, only their own (ADR 0111): the link and the office answer as before.
    if (ctx.role && !roleCan(ctx.role, 'crew')) {
      const me = ctx.user ? await personByEmail(ctx.tx, ctx.user.email) : undefined
      if (!me || me.id !== offer.personId) throw new Refused({ code: 'forbidden', message: OFFER_NOT_YOURS })
    }
    const call = await openCall(ctx, offer.callId)
    // Every answer is new to the office, so it goes back into "Answers to check".
    const answered = { responded_at: new Date().toISOString(), responded_via: ctx.via, note: a.note, seen_at: null }
    if (a.answer === 'pullOut') {
      // A page left open from before still has the button on a booking the office has since taken them off.
      if (offer.status === 'cancelled') throw new Refused({ code: 'conflict', message: "The office has already taken you off this one, so there's nothing to do." })
      // Only a place they hold can be given back. The held count drops with the
      // status, so the call is short again, and the office hears of it in
      // "Answers to check" until they note it (audit finding 10).
      if (!HOLDING.includes(offer.status)) throw new Refused({ code: 'conflict', message: "You can only say you can't make it to a job you've said yes to." })
      // The page never offers it after the job, but a crafted post could reach here and lose the timesheet.
      if (call.end < irishToday()) throw new Refused({ code: 'conflict', message: 'That job has already happened; talk to the office.' })
      await setOffer(ctx, offer.id, { ...answered, status: 'pulled-out', asked: [] })
      return
    }
    if (offer.status === 'filled') throw new Refused({ code: 'filled', message: `Sorry, ${jobNamed(call, offer.days)} has just been filled by someone else.` })
    if (offer.status === 'cancelled') throw new Refused({ code: 'conflict', message: `Sorry, the office has withdrawn ${jobNamed(call, offer.days)}.` })
    // Can't make it is over: the office offers it afresh if they can do it after all.
    if (offer.status === 'pulled-out') throw new Refused({ code: 'conflict', message: "You've told us you can't make this one. Ask the office if you can do it after all." })
    if (offer.status === 'confirmed')
      throw new Refused({ code: 'conflict', message: 'You are confirmed for this job. Please contact the office to change it.' })
    // Declined is over, as the page promises: an old tab's Accept can't bring it back (audit, 20 October 2026, finding 25).
    if (offer.status === 'declined')
      throw new Refused({ code: 'conflict', message: "You declined this one, so it's off your page: only the office can offer it to you again." })

    if (a.answer === 'decline') {
      await setOffer(ctx, offer.id, { ...answered, status: 'declined', asked: [] })
      return
    }
    const all = eachDay(call.start, call.end)
    const outsideOf = (list: string[]) => {
      const outside = list.filter((d) => !all.includes(d))
      if (outside.length) throw new Refused({ code: 'invalid', message: `${daysLabel(outside)} ${outside.length === 1 ? 'is' : 'are'} not part of this job.` })
    }
    if (a.answer === 'undecided') {
      // A No in Google to every day they'd said yes to, with days not yet answered (ADR 0152): asked again for those, as
      // before their yes. Only a yes not yet confirmed can go back; an answer since has settled it.
      if (offer.status !== 'accepted') return
      const days = [...new Set(a.days)].sort()
      outsideOf(days)
      await setOffer(ctx, offer.id, { ...answered, status: 'offered', days, asked: [] })
      return
    }
    const days = a.days ? [...new Set(a.days)].sort() : all
    outsideOf(days)
    await checkCanHold(ctx, call, offer, days)
    if (a.answer === 'counter') {
      await setOffer(ctx, offer.id, { ...answered, status: 'countered', days, counter_rate_cents: a.counterRateCents, asked: [] })
      return
    }
    // A Yes in Google counts for its own day (ADR 0152): the days it didn't answer stay asked. An answer on their page or in
    // the app sends none, as it is for every day.
    const asked = [...new Set(a.asked ?? [])].filter((d) => !days.includes(d)).sort()
    outsideOf(asked)
    await setOffer(ctx, offer.id, { ...answered, status: 'accepted', days, asked, counter_rate_cents: null })
    await closeIfFull(ctx, call)
  },

  async 'offer.confirm'(ctx, a) {
    const offer = await getOffer(ctx.tx, a.id)
    if (!offer) throw new Refused({ code: 'not-found', message: 'That offer no longer exists.' })
    const call = await openCall(ctx, offer.callId)
    if (offer.status === 'confirmed') return
    if (offer.status === 'accepted') {
      // Books the days they said yes to, and ends the ask for any they haven't answered (ADR 0152). A rate still asked for
      // on a call this leaves full closes with it, as the office was told before the press.
      await setOffer(ctx, offer.id, { status: 'confirmed', asked: [] })
      await closeIfFull(ctx, call, true)
      // Booked, they hear it on WhatsApp where it reaches them; picked to hold the day, when the client says yes (ADR 0154).
      await queueBooked(ctx, offer.id)
      return
    }
    if (offer.status !== 'countered')
      throw new Refused({ code: 'conflict', message: `Only an accepted offer or a counter-offer can be confirmed; this one is ${offer.status}.` })
    // Agreeing a counter agrees a rate, so it's for someone who reads rates (ADR 0046).
    refuseRates(ctx)
    // Agreeing a counter: the days may have filled while ops were deciding.
    await checkCanHold(ctx, call, offer, offer.days)
    await setOffer(ctx, offer.id, { status: 'confirmed', day_rate_cents: offer.counterRateCents })
    await closeIfFull(ctx, call, true)
    await queueBooked(ctx, offer.id)
  },

  async 'offer.refuse'(ctx, a) {
    const offer = await getOffer(ctx.tx, a.id)
    if (!offer) throw new Refused({ code: 'not-found', message: 'That offer no longer exists.' })
    // Said no to already, from another device: nothing more to do.
    if (offer.status === 'offered') return
    if (offer.status !== 'countered') throw new Refused({ code: 'conflict', message: `There's no rate to say no to: this offer is ${offer.status}.` })
    const call = await openCall(ctx, offer.callId)
    // The offer stands at the rate offered, for the days they asked it for, for them to take or turn down (ADR 0152): no day
    // is offered again that they'd left out, so nobody is sent an invite for it. The rate they asked for is kept, so their
    // page can say it wasn't agreed.
    await setOffer(ctx, offer.id, { status: 'offered', asked: [] })
    // A call that filled while they waited has no place left at any rate.
    await closeIfFull(ctx, call)
  },

  async 'offer.cancel'(ctx, a) {
    const offer = await getOffer(ctx.tx, a.id)
    if (!offer) throw new Refused({ code: 'not-found', message: 'That offer no longer exists.' })
    // An offer that is over stays as it ended: a Withdraw queued on an offline device must not rewrite a decline or a pull-out.
    if (OVER.includes(offer.status)) return
    await setOffer(ctx, offer.id, { status: 'cancelled', asked: [] })
    // Withdrawn or released, they hear on WhatsApp they're no longer needed, where it reaches them (ADR 0154).
    await queueNotNeeded(ctx, [offer.id])
  },

  async 'offer.seen'(ctx, a) {
    const offer = await getOffer(ctx.tx, a.id)
    if (!offer) throw new Refused({ code: 'not-found', message: 'That offer no longer exists.' })
    // Noted once is noted: a second device's Noted changes nothing.
    if (offer.seenAt) return
    await setOffer(ctx, offer.id, { seen_at: new Date().toISOString() })
  },
}

/**
 * The share of someone's own day rate an offer on this phase is made at (ADR 0174): on a travel or warehouse day, the
 * share set under Admin, half until then; everywhere else, all of it.
 */
async function ownShareOn(q: Queryable, phase: string | null | undefined): Promise<number> {
  if (ownSharePct(phase, undefined) === 100) return 100
  const { rows } = await q.query<{ reduced_day_pct: number | null }>('SELECT reduced_day_pct FROM quote_settings WHERE id = $1', [QUOTE_SETTINGS_ID])
  return ownSharePct(phase, { reducedDayPct: rows[0]?.reduced_day_pct ?? undefined })
}
