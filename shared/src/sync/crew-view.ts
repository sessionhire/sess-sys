import type { CommandArgs, Mutation } from '../commands.ts'
import { irishToday } from '../calendar.ts'
import { certificatesAfter, daysBetween, DEFAULT_LEVEL, departmentForRole, departmentOf, eachDay, HOLDING, LIVE, movedCallSpan, nameParts, namesAfter, offerDaysAfter, OPEN, tidyDepartment, tidyNeeds, type CrewCall, type CrewEntities, type Offer, type Person, type Unavailability } from '../crew.ts'
import { certificateOf, type Document } from '../documents.ts'
import { STOPPED, type Phase, type Project } from '../jobs.ts'
import { leaveLabel, type LeaveRequest } from '../leave.ts'
import { mergedPerson, withMainEmail } from '../merge-people.ts'
import { addDays } from './plan.ts'

/**
 * The crew screen's view of a device's data: what the server has said, with
 * this person's own waiting requests laid over it, the same way bookings are
 * shown in SyncClient.view().
 */

/** A job a person was booked on (ADR 0025): the booking's call, with the person's own days. */
export interface Worked {
  callId: string
  projectId: string | null
  name: string
  phase: string
  start: string
  end: string
}

export interface PersonView extends Person {
  pending: boolean
  /** The jobs they were booked on whose first day has come, newest first. */
  worked: Worked[]
}
export interface OfferView extends Offer {
  pending: boolean
  person: Person | undefined
}
export interface CallView extends CrewCall {
  pending: boolean
  offers: OfferView[]
  days: string[]
  /** People holding each day (accepted or confirmed). */
  heldByDay: Record<string, number>
  /** Days that still need someone. */
  openDays: string[]
}
export interface UnavailabilityView extends Unavailability {
  pending: boolean
}

export interface CrewView {
  people: PersonView[]
  calls: CallView[]
  unavailability: UnavailabilityView[]
}

type Tables = { [E in keyof CrewEntities]: Record<string, CrewEntities[E]> }

/** The fields a change names, without its id; the rest stay as they are. */
function changed(a: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(a)) if (k !== 'id' && v !== undefined) out[k] = v
  return out
}

/** A person synced before the profile existed (ADR 0025) reads as not archived, not approving leave, Level 1, with nothing else set. */
const withDefaults = (p: Person): Person => ({
  ...p,
  // Split from the whole name for a copy from before the two were asked for.
  ...nameParts(p),
  archived: p.archived ?? false,
  approvesLeave: p.approvesLeave ?? false,
  // Read in the app's own spelling: "LX" saved before is Lighting (user flows of 13 November 2026, finding 8).
  department: p.department ? tidyDepartment(p.department) : null,
  level: p.level ?? DEFAULT_LEVEL,
  knownAs: p.knownAs ?? null,
  certificates: p.certificates ?? {},
  company: p.company ?? null,
  role: p.role ?? null,
})

export function crewView(
  entities: Partial<Tables> & { phase?: Record<string, Phase>; project?: Record<string, Project>; leaveRequest?: Record<string, LeaveRequest>; document?: Record<string, Document> },
  outbox: readonly (Mutation & { appliedSeq?: number })[],
  cursor: number,
  today = irishToday()
): CrewView {
  const people = new Map<string, PersonView>()
  for (const p of Object.values(entities.person ?? {})) people.set(p.id, { ...withDefaults(p), pending: false, worked: [] })
  const calls = new Map<string, CrewCall & { pending: boolean }>()
  // Calls synced before jobs existed have no job or phase.
  for (const c of Object.values(entities.crewCall ?? {})) calls.set(c.id, { ...c, projectId: c.projectId ?? null, phaseId: c.phaseId ?? null, department: departmentOf(c), pending: false })
  const offers = new Map<string, Offer & { pending: boolean }>()
  // Offers synced before "Answers to check" kept declines have no seenAt.
  for (const o of Object.values(entities.offer ?? {})) offers.set(o.id, { ...o, seenAt: o.seenAt ?? null, pending: false })
  const away = new Map<string, UnavailabilityView>()
  for (const u of Object.values(entities.unavailability ?? {})) away.set(u.id, { ...u, pending: false })

  /**
   * A call cancelled takes every offer still live on it, as the server withdraws them: the office sees it at once, not after
   * the sync. One cancelled along with its job (`stoppedOn`, the day) is marked so, with those offers, for asking for the
   * same crew again once the job is going again (ADR 0164).
   */
  const cancelCall = (id: string, stoppedOn?: string) => {
    const c = calls.get(id)
    if (!c) return
    calls.set(c.id, { ...c, status: 'cancelled', ...(stoppedOn ? { stoppedOn } : {}), pending: true })
    for (const o of offers.values())
      if (o.callId === c.id && LIVE.includes(o.status)) offers.set(o.id, { ...o, status: 'cancelled', ...(stoppedOn ? { stoppedOn } : {}), pending: true })
  }

  // Phases' dates, followed through this device's own changes, for calls that move with their phase.
  const phaseDates = new Map<string, { start: string; end: string }>()
  for (const p of Object.values(entities.phase ?? {})) phaseDates.set(p.id, { start: p.start, end: p.end })
  /** A call's offers once its days change, by the same rule as the server's: chosen days shift with a phase that moved. */
  const moveOffers = (callId: string, oldDays: string[], newDays: string[], shift = 0) => {
    for (const o of offers.values()) {
      if (o.callId !== callId || !LIVE.includes(o.status)) continue
      let days = offerDaysAfter(o.days, oldDays, newDays, shift)
      if (!days.length) {
        // Nobody has answered, so the offer is simply for the new days. Anyone booked or countering is shown as they were: the server refuses to strand them.
        if (o.status !== 'offered') continue
        days = [...newDays]
      }
      // The days still asked of someone who said yes to others move as theirs do (ADR 0152).
      const asked = o.asked?.length ? offerDaysAfter(o.asked, oldDays, newDays, shift).filter((d) => !days.includes(d)) : undefined
      const { asked: _was, ...rest } = o
      if (days.join() !== o.days.join() || (asked ?? []).join() !== (o.asked ?? []).join())
        offers.set(o.id, { ...rest, ...(asked?.length ? { asked } : {}), days, pending: true })
    }
  }

  /** A certificate's card is in: the certificate is held, running out on its day, the note kept. */
  const cardSets = (personId: string, kind: Document['kind'], expires: string | null) => {
    const cert = certificateOf(kind)
    const p = people.get(personId)
    if (cert && p) people.set(p.id, { ...p, certificates: { ...p.certificates, [cert]: { held: true, expires, note: p.certificates[cert]?.note ?? '' } }, pending: true })
  }

  for (const m of outbox) {
    if (m.appliedSeq !== undefined && m.appliedSeq <= cursor) continue
    switch (m.name) {
      case 'person.upsert': {
        // Editing someone keeps what a device doesn't own: their link, and whether they're archived. An
        // edit that says nothing about approving leave, or about the profile (ADR 0025), keeps those too.
        const a = m.args as CommandArgs<'person.upsert'>
        const was = people.get(a.id)
        const approvesLeave = a.kind === 'staff' && (a.approvesLeave ?? was?.approvesLeave ?? false)
        people.set(a.id, {
          linkToken: was?.linkToken ?? '',
          archived: was?.archived ?? false,
          // What this device isn't sent (ADR 0046) stays hidden: an edit from a role that doesn't read the rate sends none and keeps it.
          ...(was?.linkHidden ? { linkHidden: true } : {}),
          // Their photo is the server's to set (ADR 0065).
          ...(was?.photo ? { photo: was.photo } : {}),
          ...a,
          ...namesAfter(a, was),
          // A name once checked stays checked (ADR 0068).
          ...(a.nameChecked || was?.nameChecked ? { nameChecked: true } : { nameChecked: undefined }),
          dayRateCents: a.dayRateCents !== undefined ? a.dayRateCents : (was?.dayRateCents ?? null),
          ...(a.dayRateCents === undefined && was?.rateHidden ? { rateHidden: true } : {}),
          approvesLeave,
          department: a.department !== undefined ? a.department : (was?.department ?? null),
          level: a.level ?? was?.level ?? DEFAULT_LEVEL,
          knownAs: a.knownAs !== undefined ? a.knownAs : (was?.knownAs ?? null),
          // As the server lays them (ADR 0028).
          certificates: certificatesAfter(was?.certificates, a.certificates),
          company: a.company !== undefined ? a.company : (was?.company ?? null),
          // Set only by person.role (ADR 0034); a freelancer has none.
          role: a.kind === 'staff' ? (was?.role ?? null) : null,
          pending: true,
          worked: was?.worked ?? [],
        })
        break
      }
      case 'person.role': {
        const a = m.args as CommandArgs<'person.role'>
        const p = people.get(a.id)
        if (p && p.kind === 'staff') people.set(p.id, { ...p, role: a.role, pending: true })
        break
      }
      case 'person.level': {
        const a = m.args as CommandArgs<'person.level'>
        const p = people.get(a.id)
        if (p) people.set(p.id, { ...p, level: a.level, pending: true })
        break
      }
      // A certificate's card saved or checked sets the certificate on the person, which holds its date (ADR 0029).
      case 'document.save': {
        const a = m.args as CommandArgs<'document.save'>
        const doc = entities.document?.[a.id]
        // As the server: someone else's, or one sent from a link and not checked yet, isn't changed by a save.
        if (!doc || (doc.personId === a.personId && doc.checkedAt)) cardSets(a.personId, a.kind, a.expires)
        break
      }
      case 'document.check': {
        const a = m.args as CommandArgs<'document.check'>
        const doc = entities.document?.[a.id]
        // Checked once is checked.
        if (doc && !doc.checkedAt) cardSets(doc.personId, doc.kind, a.expires)
        break
      }
      case 'person.archive': {
        const a = m.args as CommandArgs<'person.archive'>
        const p = people.get(a.id)
        if (p) people.set(p.id, { ...p, archived: a.archived, pending: true })
        break
      }
      case 'person.merge': {
        // As the server combines them (ADR 0055): one person, with the others' offers and days off. Two offers for one call
        // are shown as they are until the server says which it kept.
        const a = m.args as CommandArgs<'person.merge'>
        const into = people.get(a.id)
        const from = a.from.map((id) => people.get(id)).filter((p): p is PersonView => !!p)
        if (!into || !from.length) break
        people.set(into.id, { ...into, ...mergedPerson(into, from), pending: true })
        for (const p of from) people.delete(p.id)
        const gone = new Set(from.map((p) => p.id))
        for (const o of offers.values()) if (gone.has(o.personId)) offers.set(o.id, { ...o, personId: into.id, pending: true })
        for (const u of away.values()) if (gone.has(u.personId)) away.set(u.id, { ...u, personId: into.id, pending: true })
        break
      }
      case 'person.mainEmail': {
        // The same addresses, one of the others first (ADR 0064).
        const a = m.args as CommandArgs<'person.mainEmail'>
        const p = people.get(a.id)
        const next = p && withMainEmail(p, a.email)
        if (p && next) people.set(p.id, { ...p, ...next, pending: true })
        break
      }
      case 'person.contact': {
        // Only the fields sent change, so an unchanged one is never named in the history.
        const a = m.args as CommandArgs<'person.contact'>
        const p = people.get(a.id)
        if (p) people.set(p.id, { ...p, ...(a.email !== undefined ? { email: a.email } : {}), ...(a.phone !== undefined ? { phone: a.phone } : {}), pending: true })
        break
      }
      case 'person.whatsapp': {
        // Sent only while off, as the server sends it (ADR 0125).
        const a = m.args as CommandArgs<'person.whatsapp'>
        const p = people.get(a.id)
        if (p) {
          const { whatsappOff: _, ...rest } = p
          people.set(p.id, { ...rest, ...(a.on ? {} : { whatsappOff: true }), pending: true })
        }
        break
      }
      case 'call.create': {
        const a = m.args as CommandArgs<'call.create'>
        // A call sent without a department is given the one its role suggests, as the server will (ADR 0046).
        // Tidied as the server keeps it: "audio" is Audio.
        const department = a.department !== undefined ? (a.department ? tidyDepartment(a.department) : null) : departmentForRole(a.role, { calls: [...calls.values()], people: [...people.values()] })
        if (!calls.has(a.id))
          calls.set(a.id, { ...a, department, needsCertificates: tidyNeeds(a.needsCertificates), projectId: a.projectId ?? null, phaseId: a.phaseId ?? null, status: 'open', pending: true })
        break
      }
      case 'call.department': {
        const a = m.args as CommandArgs<'call.department'>
        const department = a.department ? tidyDepartment(a.department) : null
        for (const id of a.ids) {
          const c = calls.get(id)
          if (c && departmentOf(c) !== department) calls.set(id, { ...c, department, pending: true })
        }
        break
      }
      case 'project.update': {
        // A job being stopped takes its crew calls with it (ADR 0007).
        const a = m.args as CommandArgs<'project.update'>
        if (!a.status || !STOPPED.includes(a.status)) break
        for (const c of [...calls.values()]) if (c.projectId === a.id && c.status === 'open') cancelCall(c.id, today)
        break
      }
      case 'call.cancel':
        cancelCall((m.args as CommandArgs<'call.cancel'>).id)
        break
      case 'call.reopen': {
        // Asked for again once its job is going again (ADR 0164): open, with nobody on it; its old offers stay as they ended.
        // Only one cancelled along with its job; the server alone knows whether the job is going again, and refuses if not.
        const c = calls.get((m.args as CommandArgs<'call.reopen'>).id)
        if (!c || c.status !== 'cancelled' || !c.stoppedOn) break
        const { stoppedOn: _, ...rest } = c
        calls.set(c.id, { ...rest, status: 'open', pending: true })
        break
      }
      case 'call.update': {
        const a = m.args as CommandArgs<'call.update'>
        const c = calls.get(a.id)
        if (!c) break
        const next = { ...c, ...(changed(a) as Partial<CrewCall>), pending: true }
        if (a.needsCertificates !== undefined) next.needsCertificates = tidyNeeds(a.needsCertificates)
        if (a.department !== undefined) next.department = a.department ? tidyDepartment(a.department) : null
        calls.set(c.id, next)
        if (next.start !== c.start || next.end !== c.end) moveOffers(c.id, eachDay(c.start, c.end), eachDay(next.start, next.end))
        // A new rate reaches only offers nobody has answered; the rest keep what was agreed.
        if (next.dayRateCents !== c.dayRateCents)
          for (const o of offers.values()) if (o.callId === c.id && o.status === 'offered') offers.set(o.id, { ...o, dayRateCents: next.dayRateCents, pending: true })
        break
      }
      case 'phase.add': {
        const a = m.args as CommandArgs<'phase.add'>
        if (!phaseDates.has(a.id)) phaseDates.set(a.id, { start: a.start, end: a.end })
        break
      }
      case 'phase.update': {
        // A phase moving with its crew takes its open calls, and their offers' days, along.
        const a = m.args as CommandArgs<'phase.update'>
        const from = phaseDates.get(a.id)
        if (!from) break
        const to = { start: a.start ?? from.start, end: a.end ?? from.end }
        phaseDates.set(a.id, to)
        if (to.start === from.start && to.end === from.end) break
        // Calls cancelled along with their job always go with their phase, as nobody is on them (ADR 0164): asked for again,
        // they're on the phase's days as it is then.
        for (const c of [...calls.values()]) {
          if (c.phaseId !== a.id || c.status !== 'cancelled' || !c.stoppedOn) continue
          const span = movedCallSpan(c, from, to)
          if (span.start !== c.start || span.end !== c.end) calls.set(c.id, { ...c, ...span, pending: true })
        }
        if (!a.moveCrew) break
        for (const c of [...calls.values()]) {
          if (c.phaseId !== a.id || c.status !== 'open') continue
          const span = movedCallSpan(c, from, to)
          if (span.start === c.start && span.end === c.end) continue
          calls.set(c.id, { ...c, ...span, pending: true })
          moveOffers(c.id, eachDay(c.start, c.end), eachDay(span.start, span.end), daysBetween(from.start, to.start))
        }
        break
      }
      case 'offer.send': {
        const a = m.args as CommandArgs<'offer.send'>
        const c = calls.get(a.callId)
        if (!offers.has(a.id) && c)
          offers.set(a.id, {
            id: a.id,
            callId: a.callId,
            personId: a.personId,
            status: 'offered',
            days: eachDay(c.start, c.end),
            dayRateCents: c.dayRateCents,
            counterRateCents: null,
            ...(c.rateHidden ? { rateHidden: true } : {}),
            note: '',
            respondedAt: null,
            respondedVia: null,
            override: a.override,
            seenAt: null,
            pending: true,
          })
        break
      }
      case 'offer.respond': {
        const a = m.args as CommandArgs<'offer.respond'>
        const o = offers.get(a.id)
        if (!o) break
        // Only a yes not yet confirmed goes back to being asked, as on the server.
        if (a.answer === 'undecided' && o.status !== 'accepted') break
        const status =
          a.answer === 'accept' ? 'accepted' : a.answer === 'decline' ? 'declined' : a.answer === 'pullOut' ? 'pulled-out' : a.answer === 'undecided' ? 'offered' : 'countered'
        // A yes or a counter with no days chosen takes every day of the call, as on the server.
        const call = calls.get(o.callId)
        const days =
          a.answer === 'accept' || a.answer === 'counter'
            ? a.days
              ? [...new Set(a.days)].sort()
              : call
                ? eachDay(call.start, call.end)
                : o.days
            : a.answer === 'undecided'
              ? [...new Set(a.days)].sort()
              : o.days
        // A new answer is one the office hasn't seen yet. The counter's rate, and when and how it was answered, as the server records them,
        // so a Confirm queued behind a counter agrees its rate (audit, 20 October 2026, finding 26).
        const counterRateCents = a.answer === 'counter' ? a.counterRateCents : a.answer === 'accept' ? null : o.counterRateCents
        // Days still asked after a Yes in Google to some (ADR 0152); any other answer is for every day.
        const { asked: _was, ...rest } = o
        const still = a.answer === 'accept' ? [...new Set(a.asked ?? [])].filter((d) => !days.includes(d)).sort() : []
        const asked = still.length ? { asked: still } : {}
        offers.set(o.id, { ...rest, ...asked, status, days, counterRateCents, note: a.note, respondedAt: m.createdAt, respondedVia: 'app', seenAt: null, pending: true })
        break
      }
      case 'offer.confirm': {
        const o = offers.get((m.args as CommandArgs<'offer.confirm'>).id)
        // Agreeing a counter makes its rate the rate, as the server does, so the timesheet's total follows at once.
        const agreed = o?.status === 'countered' && o.counterRateCents !== null ? { dayRateCents: o.counterRateCents } : {}
        // Confirming books the days they said yes to and ends the ask for the rest (ADR 0152).
        if (o && (o.status === 'accepted' || o.status === 'countered')) {
          const { asked: _ended, ...rest } = o
          offers.set(o.id, { ...rest, status: 'confirmed', ...agreed, pending: true })
        }
        break
      }
      case 'offer.refuse': {
        const o = offers.get((m.args as CommandArgs<'offer.refuse'>).id)
        // The offer stands at the rate offered, for the days they asked it for, with the rate they asked for kept to say it was refused.
        if (o?.status === 'countered') offers.set(o.id, { ...o, status: 'offered', pending: true })
        break
      }
      case 'offer.undo': {
        const o = offers.get((m.args as CommandArgs<'offer.undo'>).id)
        // Taken back before anyone answered, as the server takes it (ADR 0162): gone, as if never made. The server alone knows
        // whether it's still waiting; one that has gone comes back with the server's word that it must be withdrawn instead.
        if (o && o.status === 'offered' && !o.respondedAt) offers.delete(o.id)
        break
      }
      case 'offer.cancel': {
        const o = offers.get((m.args as CommandArgs<'offer.cancel'>).id)
        // An offer that is over stays as it ended, as on the server: a Withdraw queued offline never rewrites a decline.
        if (o && LIVE.includes(o.status)) offers.set(o.id, { ...o, status: 'cancelled', pending: true })
        break
      }
      case 'offer.seen': {
        const o = offers.get((m.args as CommandArgs<'offer.seen'>).id)
        if (o && !o.seenAt) offers.set(o.id, { ...o, seenAt: m.createdAt, pending: true })
        break
      }
      case 'unavailability.add': {
        const a = m.args as CommandArgs<'unavailability.add'>
        if (!away.has(a.id)) away.set(a.id, { ...a, source: 'ops', pending: true })
        break
      }
      case 'unavailability.remove':
        away.delete((m.args as CommandArgs<'unavailability.remove'>).id)
        break
      case 'leave.decide': {
        // Approved leave is days off (ADR 0024), under the request's own id, so the planner shows it before it syncs.
        const a = m.args as CommandArgs<'leave.decide'>
        const r = entities.leaveRequest?.[a.id]
        if (!r || r.status !== 'waiting' || !a.approved || away.has(a.id)) break
        away.set(a.id, { id: a.id, personId: r.personId, start: r.start, end: r.end, note: leaveLabel(r.type, r.days), source: 'leave', pending: true })
        break
      }
      case 'leave.cancel':
        away.delete((m.args as CommandArgs<'leave.cancel'>).id)
        break
    }
  }

  // Each call's offers gathered once: looking through every offer for every call is calls × offers, most of a year's rebuild.
  const byCall = new Map<string, OfferView[]>()
  for (const o of offers.values()) {
    const list = byCall.get(o.callId) ?? []
    list.push({ ...o, person: people.get(o.personId) })
    byCall.set(o.callId, list)
  }
  const callViews: CallView[] = [...calls.values()].map((c) => {
    const days = eachDay(c.start, c.end)
    const own = (byCall.get(c.id) ?? []).sort(
      (a, b) => statusRank(a.status) - statusRank(b.status) || (a.person?.name ?? '').localeCompare(b.person?.name ?? '') || a.id.localeCompare(b.id)
    )
    const heldByDay: Record<string, number> = {}
    // People, not offers, as the server counts them (audit, 20 October 2026, finding 25).
    for (const d of days) heldByDay[d] = new Set(own.filter((o) => HOLDING.includes(o.status) && o.days.includes(d)).map((o) => o.personId)).size
    return { ...c, offers: own, days, heldByDay, openDays: days.filter((d) => heldByDay[d]! < c.needed) }
  })

  // What each person has worked (ADR 0025): a place held on a call that stands, from the person's own first day on it, newest first.
  // The job's name as it is today, where the call is part of one; the call's own name otherwise.
  for (const c of callViews) {
    if (c.status === 'cancelled') continue
    const name = (c.projectId && entities.project?.[c.projectId]?.name) || c.project
    for (const o of c.offers) {
      if (!HOLDING.includes(o.status) || o.days.length === 0) continue
      const p = people.get(o.personId)
      if (!p) continue
      const days = [...o.days].sort()
      if (days[0]! > today) continue
      p.worked.push({ callId: c.id, projectId: c.projectId, name, phase: c.phase, start: days[0]!, end: days[days.length - 1]! })
    }
  }
  for (const p of people.values()) p.worked.sort((a, b) => b.start.localeCompare(a.start) || a.name.localeCompare(b.name) || a.callId.localeCompare(b.callId))

  // Every order ends on the id, so two devices holding the same data show the same order whatever order it arrived in.
  return {
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    calls: callViews.sort((a, b) => a.start.localeCompare(b.start) || a.project.localeCompare(b.project) || a.id.localeCompare(b.id)),
    unavailability: [...away.values()].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)),
  }
}

function statusRank(s: Offer['status']) {
  return ['confirmed', 'accepted', 'countered', 'offered', 'pulled-out', 'declined', 'filled', 'cancelled'].indexOf(s)
}

/** Why an offer is in "Answers to check", and so what the office does next: `no-reply` is an offer nobody answered by its reply-by day. */
export type AnswerKind = 'accepted' | 'countered' | 'declined' | 'pulled-out' | 'no-reply'

export interface AnswerToCheck {
  call: CallView
  offer: OfferView
  kind: AnswerKind
  /** Places still to fill on the call's busiest day, now that this answer is in. */
  short: number
}

const ANSWER_ORDER: readonly AnswerKind[] = ['pulled-out', 'accepted', 'countered', 'declined', 'no-reply']

/**
 * Answers the office hasn't dealt with, on calls still to come (audit
 * finding 9): a yes or a counter waits for Confirm or Withdraw; a decline or
 * a pull-out stays until the office taps Noted (offer.seen), since either
 * can leave the call short. An offer still unanswered after its call's
 * reply-by day is here too, until the office taps Noted, as chasing it is
 * their day (audit, 20 October 2026, finding 24). The Crew tab's count is
 * the length of this.
 */
export function answersToCheck(crew: CrewView, today: string): AnswerToCheck[] {
  const out: AnswerToCheck[] = []
  for (const call of crew.calls) {
    if (call.status !== 'open' || call.end < today) continue
    const short = Math.max(0, ...call.days.map((d) => call.needed - (call.heldByDay[d] ?? 0)))
    for (const offer of call.offers) {
      // With no reply-by day (cleared, or never set), it counts as unanswered from the day before the call, so it's still chased
      // (audit, 5 November 2026, finding 60).
      const replyBy = call.replyBy ?? addDays(call.start, -2)
      const unanswered = offer.status === 'offered' && replyBy < today
      const kind = (unanswered ? 'no-reply' : offer.status) as AnswerKind
      if (!ANSWER_ORDER.includes(kind)) continue
      if ((kind === 'declined' || kind === 'pulled-out' || kind === 'no-reply') && offer.seenAt) continue
      out.push({ call, offer, kind, short })
    }
  }
  // Answers on calls in the next fortnight come first, whatever their kind, so a yes for next week isn't under a pull-out for
  // March (audit, 5 November 2026, finding 27); within each, pull-outs first, then by the call's first day.
  const soon = addDays(today, ANSWERS_SOON_DAYS)
  const later = (a: AnswerToCheck) => (a.call.start <= soon ? 0 : 1)
  return out.sort(
    (a, b) =>
      later(a) - later(b) ||
      ANSWER_ORDER.indexOf(a.kind) - ANSWER_ORDER.indexOf(b.kind) ||
      a.call.start.localeCompare(b.call.start) ||
      a.call.id.localeCompare(b.call.id) ||
      a.offer.id.localeCompare(b.offer.id)
  )
}

/** How far ahead an answer is on a call soon enough to come first in Answers to check. */
export const ANSWERS_SOON_DAYS = 14

/** How close a call still short of crew is called out first, in To sort out (audit, 5 November 2026, finding 60). */
export const SHORT_SOON_DAYS = 3

/** A call still short of crew on a day from today to three days out, how many short, and in how many days that day is. */
export interface ShortSoon {
  call: CallView
  short: number
  inDays: number
}

/**
 * Calls still short of crew within three days, soonest first: within the
 * fortnight, a call short in two days looked the same as one short in
 * thirteen (audit, 5 November 2026, finding 60).
 */
export function shortSoon(crew: CrewView, today: string): ShortSoon[] {
  const last = addDays(today, SHORT_SOON_DAYS)
  const out: ShortSoon[] = []
  for (const call of crew.calls) {
    if (call.status !== 'open' || call.end < today || call.start > last) continue
    const days = call.days.filter((d) => d >= today && d <= last && call.needed > (call.heldByDay[d] ?? 0))
    if (!days.length) continue
    out.push({ call, short: Math.max(...days.map((d) => call.needed - (call.heldByDay[d] ?? 0))), inDays: daysBetween(today, days[0]!) })
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.call.start.localeCompare(b.call.start) || a.call.id.localeCompare(b.call.id))
}

/**
 * Why a person might not be right for these days: marked unavailable, or
 * already holding another call. Shown as a warning before an offer goes out;
 * the server checks again when it arrives.
 */
export function personConflicts(view: CrewView, personId: string, days: string[], exceptCallId?: string): string[] {
  const out: string[] = []
  for (const u of view.unavailability) {
    if (u.personId !== personId) continue
    const hit = days.filter((d) => d >= u.start && d <= u.end)
    if (hit.length) out.push(`Marked unavailable ${hit.length === 1 ? hit[0] : `${hit[0]} to ${hit[hit.length - 1]}`}${u.note ? ` (${u.note})` : ''}`)
  }
  for (const c of view.calls) {
    if (c.id === exceptCallId || c.status !== 'open') continue
    for (const o of c.offers) {
      if (o.personId !== personId) continue
      const hit = o.days.filter((d) => days.includes(d))
      if (!hit.length) continue
      if (HOLDING.includes(o.status)) out.push(`Booked on ${c.project} (${hit.join(', ')})`)
      else if (OPEN.includes(o.status)) out.push(`Also offered ${c.project} (${hit.join(', ')})`)
    }
  }
  return out
}
