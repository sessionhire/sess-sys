import { z } from 'zod'
import { day } from './day.ts'
import { euroCents, needed, text, whole } from './plain.ts'
import { ROLES } from './roles.ts'
import { DEFAULT_LEVEL, mostNamed, ROLE_WORDS, roleKey } from './crew-departments.ts'
import { certificates, needs, needsLabel, tidyNeeds, type Certificate, type CertificateKind } from './crew-certificates.ts'
import { dayLabel, daysLabel, eachDay, euro } from './crew-days.ts'

export {
  APPLICANT_LEVEL,
  CREW_DEPARTMENTS,
  DEFAULT_LEVEL,
  departmentInWords,
  departmentOfPeople,
  levelLabel,
  levelLine,
  LEVELS,
  sameDepartment,
  tidyDepartment,
} from './crew-departments.ts'
export {
  certificate,
  CERTIFICATE_KINDS,
  CERTIFICATE_LABELS,
  CERTIFICATE_WORDS,
  certificateName,
  certificates,
  certificatesAfter,
  needsLabel,
  tidyNeeds,
  type Certificate,
  type CertificateKind,
  type Certificates,
} from './crew-certificates.ts'
export { fullName, NAME_ARTICLES, NAME_PARTICLES, nameParts, namesAfter, splitName, type NameParts } from './crew-names.ts'
export {
  ADD_A_PHASE,
  dayLabel,
  daysBetween,
  daysLabel,
  daysOffPhase,
  eachDay,
  euro,
  MOVE_THE_PHASE,
  movedCallSpan,
  offerDaysAfter,
  offPhaseLine,
  phaseDaysRule,
  phaseOnlyGrew,
  suggestedReplyBy,
} from './crew-days.ts'

/**
 * Crew booking: people, the roles a job needs (calls), the offers that fill
 * them, and the days people can't work.
 *
 * Built to "meet freelancers in the middle" (docs/architecture.md): every
 * freelancer has a private link that works without an app or a login. From
 * it they see their offers with full details, accept all or some days,
 * decline, counter the rate, mark days off and subscribe to their bookings
 * in any calendar app. Ops send that link wherever the freelancer already
 * looks (WhatsApp, SMS, email).
 *
 * The same server-decides rule as the rest of sync applies: a freelancer
 * accepting a role that has just been filled, or a day they are already
 * booked elsewhere, gets a plain reason instead of a silent double booking.
 */

const id = z.string().min(1).max(64)
const time = z.string().regex(/^\d{2}:\d{2}$/, 'The call time is a time of day, such as 08:00.')
/** Money in euro cents, so sums never drift. */
const cents = euroCents(100_000_00, 'A day rate')

/**
 * The profile (ADR 0025): the department, the level, the name they go by,
 * their certificates and the company they trade through.
 */

/**
 * The department a call for this role most likely belongs to (ADR 0046),
 * offered when a call is made and given to calls brought in from the
 * calendar: the one calls for the same role were given before, or else the
 * one most people with the role as a skill are in, or else what the role's
 * own words say. None when nothing says; the office gives it one. A guess
 * the office can always change, never a rule.
 */
export function departmentForRole(
  role: string,
  known: { calls?: readonly Pick<CrewCall, 'role' | 'department'>[]; people?: readonly Pick<Person, 'skills' | 'department' | 'archived'>[] } = {}
): string | null {
  const key = roleKey(role)
  if (!key) return null
  const fromCalls = mostNamed((known.calls ?? []).filter((c) => roleKey(c.role) === key).map((c) => c.department ?? null))
  if (fromCalls) return fromCalls
  const fromPeople = mostNamed((known.people ?? []).filter((p) => !p.archived && p.skills.some((s) => roleKey(s) === key)).map((p) => p.department))
  if (fromPeople) return fromPeople
  return ROLE_WORDS.find(([words]) => words.test(key))?.[1] ?? null
}

/** How much the notes hold; the crew list's notes are added to fit it. */
export const NOTES_LENGTH = 2000
const level = whole(0, 5, 'The level')

/** The company a freelancer trades through. VAT-registered is derived: a VAT number is held. */
export const company = z.object({
  name: text(200, 'The company name'),
  vatNumber: text(40, 'The VAT number').nullable(),
  croNumber: text(40, 'The CRO number').nullable(),
})
export type Company = z.infer<typeof company>

const department = text(60, 'The department').nullable()
const knownAs = text(100, 'The name they go by').nullable()
// Trimmed, so spaces alone are no first name.
const givenName = z.string().transform((s) => s.trim()).pipe(needed(100, 'The first name', 'A first name'))
const familyName = z.string().transform((s) => s.trim()).pipe(text(100, 'The last name'))

export const person = z.object({
  id,
  name: needed(200, 'The name', 'A name'),
  /**
   * The name in two (asked for since 2026-10-20): the whole name is always
   * the two joined. The server sends both; a copy from before they existed
   * has neither, so read them through nameParts, which splits the name.
   */
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  kind: z.enum(['staff', 'freelancer']),
  email: z.string().max(200).nullable(),
  /**
   * The addresses they had as someone they were combined with (ADR 0055),
   * trimmed and in small letters: a bring-in matches them, and so does
   * their Google sign-in, as it does `email`. Set by the server, never by
   * an edit. Missing on records synced before it existed, and on anyone
   * never combined: none.
   */
  otherEmails: z.array(z.string().max(200)).max(20).optional(),
  /** International format, e.g. +353871234567, so WhatsApp links work. */
  phone: z.string().max(40).nullable(),
  skills: z.array(needed(60, 'A skill', 'A skill')).max(30, 'Up to 30 skills, please.'),
  dayRateCents: cents.nullable(),
  notes: text(NOTES_LENGTH, 'The notes'),
  /**
   * The secret in the person's private link. Set by the server, never by a
   * device. Anyone holding the link acts as this person, so it can be
   * replaced (person.newLink) if it leaks.
   */
  linkToken: z.string(),
  /**
   * Archived people have left, or stopped working for us: they're kept for
   * the record (past bookings, timesheets, the history) but offered nothing,
   * and their link and calendar feed stop. Defaults so records synced
   * before it existed read as not archived.
   */
  archived: z.boolean().default(false),
  /**
   * Can approve staff leave and days in lieu (ADR 0024). Staff only; the
   * senior staff are a flag until roles exist. Defaults so records synced
   * before it existed read as not.
   */
  approvesLeave: z.boolean().default(false),
  /** The profile (ADR 0025). Each defaults so records synced before it existed read as not set. */
  department: department.default(null),
  level: level.default(DEFAULT_LEVEL),
  knownAs: knownAs.default(null),
  certificates: certificates.default({}),
  company: company.nullable().default(null),
  /**
   * What they can change once signed in (ADR 0034). Staff only; none set
   * is staff crew. Set by a director with person.role, never by an edit.
   */
  role: z.enum(ROLES).nullable().default(null),
  /**
   * Set by the server on what it sends a role that doesn't read them (ADR
   * 0046): the rate is left out (null) and so is the link's secret (''),
   * so a screen can say they're hidden rather than "rate to agree" or "no
   * link yet". Never stored.
   */
  rateHidden: z.boolean().optional(),
  linkHidden: z.boolean().optional(),
  /**
   * Set by the server on what it sends staff crew and freelancers (ADR
   * 0062): someone else's email, notes and company are left out, and for a
   * freelancer their phone too. Never stored.
   */
  detailsHidden: z.boolean().optional(),
  /**
   * Set by the server alongside detailsHidden: their level is how much the office prefers them, and Level 0 is not vetted
   * yet, so it's the office's, as the notes are, and sent as the default (audit, 5 November 2026, finding 44). Never stored.
   */
  levelHidden: z.boolean().optional(),
  /**
   * Their photo (ADR 0065): when it was put up, which makes its address
   * (photoPath). Set by the server, never by an edit; none is their
   * initials. Not sent to a reader who doesn't read their details.
   */
  photo: z.object({ at: z.string() }).nullable().optional(),
  /**
   * Their name was given or checked in Jobs › Tidy up (ADR 0068), so it's
   * theirs even where it's what their address spells ("Aoife Byrne" from
   * aoife.byrne@…). Sent only once true; none is not yet.
   */
  nameChecked: z.boolean().optional(),
  /**
   * They turned off offers on WhatsApp (ADR 0125), on their own page, or the office did when they asked. Sent only once
   * true: everyone else gets them, once the office has WhatsApp on.
   */
  whatsappOff: z.boolean().optional(),
})
export type Person = z.infer<typeof person>

/** What a person is called in a greeting or a message: the name they go by, their first name, or else the first word of their name. */
export function firstName(p: Pick<Person, 'name'> & Partial<Pick<Person, 'knownAs' | 'firstName'>>): string {
  return p.knownAs?.trim() || p.firstName?.trim() || p.name.trim().split(/\s+/)[0] || p.name
}

/** A freelancer who charges VAT: the invoicing work reads this. */
export function isVatRegistered(p: Pick<Person, 'company'>): boolean {
  return !!p.company?.vatNumber?.trim()
}

/** "Trades as Quinn Audio Ltd, VAT-registered"; empty when there's no company. */
export function companyLine(p: Pick<Person, 'company'>): string {
  if (!p.company) return ''
  const name = p.company.name.trim()
  const parts = [name ? `Trades as ${name}` : 'Trades through a company', isVatRegistered(p) ? 'VAT-registered' : '']
  return parts.filter(Boolean).join(', ')
}

export type CertificateState = 'held' | 'expired' | 'not-held' | 'unknown'

/** What a certificate is worth today: held, held but past its expiry, not held, or not known. */
export function certificateState(c: Certificate | undefined, today: string): CertificateState {
  if (!c || c.held === null) return 'unknown'
  if (!c.held) return 'not-held'
  return c.expires !== null && c.expires < today ? 'expired' : 'held'
}

/** Days a person can't work. Offers for those days need an explicit override. */
export const unavailability = z.object({
  id,
  personId: id,
  start: day,
  end: day,
  note: text(500, 'The note'),
  /** Who said so: ops, the person on their link, their own calendar (later), or approved leave (ADR 0024), which has the request's own id. */
  source: z.enum(['ops', 'self', 'calendar', 'leave']),
})
export type Unavailability = z.infer<typeof unavailability>

/**
 * A role a job needs: "2 x audio tech, Build and Show, 3 to 5 October".
 * Usually part of a job in Jobs, and of one of its phases (ADR 0007): then
 * the server writes the job's, phase's and venue's names here and keeps them
 * in step, so freelancers' pages and messages read them as text. A call not
 * tied to a job has them as typed.
 */
export const crewCall = z.object({
  id,
  /** The job, when the call is part of one. Missing on calls synced before jobs existed. */
  projectId: id.nullable(),
  /** The phase, when the call is for one; null for a call across several, or not tied to a job. */
  phaseId: id.nullable(),
  project: needed(200, "The job's name", "The job's name"),
  phase: text(100, 'The phase'),
  venue: text(300, 'The venue'),
  role: needed(100, 'The role', 'A role'),
  start: day,
  end: day,
  callTime: time.nullable(),
  needed: whole(1, 100, 'How many'),
  dayRateCents: cents.nullable(),
  /** Everything a freelancer wants up front: travel, food, parking, dress. */
  details: text(4000, 'The details for crew'),
  /** When offers stop being open, if ops set one. */
  replyBy: day.nullable(),
  status: z.enum(['open', 'cancelled']),
  /** The certificates everyone on it must hold to the last day (ADR 0028). Missing on calls synced before, which need none. */
  needsCertificates: needs.optional(),
  /** The department it's for (ADR 0046), from the crew profiles' list; none for a call nobody has given one. Missing on calls synced before. */
  department: department.optional(),
  /** Set by the server on what it sends a role that doesn't read rates (ADR 0046): the rate is left out. Never stored. */
  rateHidden: z.boolean().optional(),
})
export type CrewCall = z.infer<typeof crewCall>
/** A call's department, reading one synced before as having none. */
export const departmentOf = (c: Pick<CrewCall, 'department'>): string | null => c.department ?? null
/** What a call needs, reading one synced before as needing nothing. */
export const needsOf = (c: Pick<CrewCall, 'needsCertificates'>): CertificateKind[] => tidyNeeds(c.needsCertificates)

export const OFFER_STATUSES = [
  /** Sent, waiting on the freelancer. */
  'offered',
  /** The freelancer said yes (to `days`). Ops still confirm. */
  'accepted',
  /** The freelancer asked for a different rate; ops decide. */
  'countered',
  'declined',
  /** Ops confirmed: this is a booking. */
  'confirmed',
  /** Someone else took the last place before this person answered. */
  'filled',
  /** Ops withdrew it, or the call was cancelled. */
  'cancelled',
  /** Had accepted, or was booked, then said they can't make it. The office finds cover. */
  'pulled-out',
] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

/** An offer is also the crew assignment once accepted and confirmed. */
export const offer = z.object({
  id,
  callId: id,
  personId: id,
  status: z.enum(OFFER_STATUSES),
  /** The days this person is on for. All the call's days unless they took only some. */
  days: z.array(day),
  /**
   * On an offer they've said yes to in Google Calendar for some of its days: the days still asked, which they haven't
   * answered (ADR 0152). A Yes counts for the day it was pressed on, so these hold nothing. Absent when there are none.
   */
  asked: z.array(day).optional(),
  /** The agreed rate; starts as the call's rate, changes if a counter is agreed. */
  dayRateCents: cents.nullable(),
  /**
   * The rate they asked for. On an offer back to offered, it is the rate the office said no to, with the offer standing
   * at `dayRateCents` (ADR 0152).
   */
  counterRateCents: cents.nullable(),
  /** What the freelancer said when answering, for ops to read. */
  note: text(1000, 'The note'),
  respondedAt: z.string().nullable(),
  respondedVia: z.enum(['link', 'app', 'calendar', 'ops', 'whatsapp']).nullable(),
  /** Sent despite a clash or marked day off; kept for the audit trail. */
  override: z.boolean(),
  /**
   * When the office noted a decline or a pull-out, so it left "Answers to
   * check"; null while it waits there. A yes or a counter leaves the queue
   * through Confirm and Withdraw instead. Missing on offers synced before.
   */
  seenAt: z.string().nullable(),
  /**
   * Where the offer's WhatsApp message has got to (ADR 0125): queued, sent, delivered to their phone, read, or not sent
   * and why. Set by the server from Meta's receipts; absent when nothing went on WhatsApp.
   */
  whatsapp: z.object({ state: z.enum(['queued', 'sent', 'delivered', 'read', 'failed']), at: z.string(), problem: z.string().nullable() }).optional(),
  /**
   * On a job brought in from Google Calendar, an offer with no calendar invite of its own (ADR 0157): `organiser`, it came
   * in with the job, from the guests the organiser invited; `before`, it was made before such jobs had their own. Set by
   * the server; absent otherwise.
   */
  noOwnInvite: z.enum(['organiser', 'before']).optional(),
  /** Set by the server on what it sends a role that doesn't read rates (ADR 0046): both rates are left out. Never stored. */
  rateHidden: z.boolean().optional(),
})
export type Offer = z.infer<typeof offer>

export interface CrewEntities {
  person: Person
  unavailability: Unavailability
  crewCall: CrewCall
  offer: Offer
}
export const CREW_ENTITY_NAMES = ['person', 'unavailability', 'crewCall', 'offer'] as const

/**
 * How long an offer made by Offer can be undone, counted from the press, before its invites and WhatsApp go (ADR 0161;
 * audit of 12 November 2026, finding 13): long enough to see a wrong pick and press Undo, short enough that nobody waits on
 * it.
 */
export const OFFER_WAIT_SECONDS = 30
/**
 * The server holds what an offer sends this much longer than the panel offers Undo (ADR 0161), so an Undo pressed in the
 * last second, on a slow connection, still reaches it before anything goes.
 */
export const OFFER_WAIT_GRACE_SECONDS = 5

/** Offers that hold a person's days. */
export const HOLDING: readonly OfferStatus[] = ['accepted', 'confirmed']
/** Offers still waiting on someone. */
export const OPEN: readonly OfferStatus[] = ['offered', 'countered']
/** Offers a change to the call still reaches: waiting on someone, or holding days. */
export const LIVE: readonly OfferStatus[] = ['offered', 'countered', 'accepted', 'confirmed']

/**
 * The rates still asked for that close unanswered if the office confirms this offer (ADR 0152). Someone's yes no longer
 * closes a rate asked for when it fills the call: the office's Confirm does, once every day has the people it needs, so
 * it's said before the press. Nothing when confirming leaves a day short, or the offer isn't one to confirm.
 */
export function ratesClosedBy<O extends Pick<Offer, 'id' | 'personId' | 'status' | 'days'>>(
  call: Pick<CrewCall, 'start' | 'end' | 'needed'>,
  offers: readonly O[],
  offerId: string
): O[] {
  const confirming = offers.find((o) => o.id === offerId)
  if (!confirming || (confirming.status !== 'accepted' && confirming.status !== 'countered')) return []
  const held: Record<string, Set<string>> = {}
  for (const d of eachDay(call.start, call.end)) held[d] = new Set()
  for (const o of offers) if (HOLDING.includes(o.status) || o.id === offerId) for (const d of o.days) held[d]?.add(o.personId)
  if (Object.values(held).some((who) => who.size < call.needed)) return []
  return offers.filter((o) => o.status === 'countered' && o.id !== offerId)
}

/** A field-by-field change must name at least one field; shared with the job and phase changes. */
export const somethingToChange = [(u: Record<string, unknown>) => Object.keys(u).some((k) => k !== 'id' && u[k] !== undefined), { message: 'Nothing to change.' }] as const

/** A reply-by day after the call's last day, refused when a call is made or its reply-by changed. */
export const REPLY_BY_AFTER = "The reply-by day is after the job's last day."

/** The same checks wherever contact details are typed: the office's form, or the person's own link. */
const contactEmail = z.string().email("That email address doesn't look right.").max(200, 'The email address can be up to 200 characters.').nullable()
const contactPhone = z.string().regex(/^\+?[0-9 ()-]{6,40}$/, 'Phone numbers need digits only, ideally starting with +353.').nullable()

/**
 * The most days one answer to an offer can pick: as many as a phase can have (MAX_PHASE_DAYS in jobs.ts, which imports
 * this file), so one answer can't make the server check any number of them (audit, P3).
 */
export const MAX_OFFER_DAYS = 366
const offerDays = z.array(day).min(1).max(MAX_OFFER_DAYS, `Up to ${MAX_OFFER_DAYS} days, please.`).nullable()

export const crewCommandSchemas = {
  'person.upsert': z.object({
    id,
    /** The whole name. A version of the app that asks for the two sends them as well, and they make it (namesAfter). */
    name: needed(200, 'The name', 'A name'),
    firstName: givenName.optional(),
    lastName: familyName.optional(),
    kind: z.enum(['staff', 'freelancer']),
    email: contactEmail,
    phone: contactPhone,
    skills: z.array(needed(60, 'A skill', 'A skill')).max(30, 'Up to 30 skills, please.'),
    /** Left out by a role that doesn't read rates (ADR 0046), which keeps what the server has. */
    dayRateCents: cents.nullable().optional(),
    notes: text(NOTES_LENGTH, 'The notes'),
    /** Left out by versions of the app from before leave existed, which then keeps what the server has. */
    approvesLeave: z.boolean().optional(),
    /** The profile (ADR 0025), likewise: anything left out keeps what the server has. */
    department: department.optional(),
    level: level.optional(),
    knownAs: knownAs.optional(),
    certificates: certificates.optional(),
    company: company.nullable().optional(),
    /** True from Jobs › Tidy up when the office names someone (ADR 0068). Never unset: left out or false, what the server has stays. */
    nameChecked: z.boolean().optional(),
    /**
     * The email it replaces stays one they're found by (ADR 0055), as Make main and combining keep it: a crew list brought in
     * again with a new address for someone (audit, 5 November 2026, finding 10). Left out, a changed email replaces the old one.
     */
    keepEmail: z.boolean().optional(),
  }),
  /** Move a person up or down a level from their card, so the history says so by name (ADR 0025). */
  'person.level': z.object({ id, level }),
  /** Replace a person's private link, so the old one stops working. */
  'person.newLink': z.object({ id }),
  /** A member of staff's role (ADR 0034). Only a director, once roles are on; there is always one director after that. */
  'person.role': z.object({ id, role: z.enum(ROLES) }),
  /**
   * Archive someone who has left, or bring them back. Refused while they
   * hold an open offer or a booking from today on, so nothing is left hanging.
   */
  'person.archive': z.object({ id, archived: z.boolean() }),
  /**
   * A person's own contact details, from their link or the app. Only the
   * fields sent change, so the history can say which, never what.
   */
  'person.contact': z
    .object({ id, email: contactEmail.optional(), phone: contactPhone.optional() })
    .refine((c) => c.email !== undefined || c.phone !== undefined, { message: 'Nothing to change.' }),
  /**
   * Whether offers reach this person on WhatsApp (ADR 0125). Theirs to choose, on their own page; the office can turn
   * them off when asked, but only they can turn them back on.
   */
  'person.whatsapp': z.object({ id, on: z.boolean() }),
  'unavailability.add': z
    .object({ id, personId: id, start: day, end: day, note: text(500, 'The note') })
    .refine((u) => u.start <= u.end, { message: 'The days off end before they start.' }),
  'unavailability.remove': z.object({ id }),
  'call.create': z
    .object({
      id,
      /** Optional so versions of the app from before jobs can still send it. */
      projectId: id.nullable().default(null),
      phaseId: id.nullable().default(null),
      project: needed(200, "The job's name", "The job's name"),
      phase: text(100, 'The phase'),
      venue: text(300, 'The venue'),
      role: needed(100, 'The role', 'A role'),
      start: day,
      end: day,
      callTime: time.nullable(),
      needed: whole(1, 100, 'How many'),
      dayRateCents: cents.nullable(),
      details: text(4000, 'The details for crew'),
      replyBy: day.nullable(),
      /** Optional so versions of the app from before it existed can still send it (ADR 0028). */
      needsCertificates: needs.optional(),
      /** The department (ADR 0046). Left out, the server gives the one the role suggests; null is none. */
      department: department.optional(),
    })
    .refine((c) => c.start <= c.end, { message: 'The call ends before it starts.' })
    // A day typed before the dates were changed can be left behind them; an answer asked for after the job is no use (audit finding 21).
    .refine((c) => c.replyBy === null || c.replyBy <= c.end, { message: REPLY_BY_AFTER }),
  /**
   * Only the fields the person changed, like a phase (ADR 0007). A change
   * of dates takes each offer's days along; a change of rate reaches only
   * offers nobody has answered yet; nobody booked is ever left with no
   * days without the office being told. A call that is part of a job takes
   * its job, phase and venue from the job, so those can only be typed for
   * a call that isn't.
   */
  'call.update': z
    .object({
      id,
      role: needed(100, 'The role', 'A role').optional(),
      start: day.optional(),
      end: day.optional(),
      callTime: time.nullable().optional(),
      needed: whole(1, 100, 'How many').optional(),
      dayRateCents: cents.nullable().optional(),
      details: text(4000, 'The details for crew').optional(),
      replyBy: day.nullable().optional(),
      project: needed(200, "The job's name", "The job's name").optional(),
      phase: text(100, 'The phase').optional(),
      venue: text(300, 'The venue').optional(),
      needsCertificates: needs.optional(),
      department: department.optional(),
    })
    .refine(...somethingToChange)
    .refine((c) => !c.start || !c.end || c.start <= c.end, { message: 'The call ends before it starts.' }),
  'call.cancel': z.object({ id }),
  /**
   * Give many calls one department at once (ADR 0046), such as the calls
   * brought in from the calendar with none: "Audio" for every one ticked.
   */
  'call.department': z.object({ ids: z.array(id).min(1, 'Tick at least one call.').max(500, 'Up to 500 calls at a time, please.'), department }),
  /**
   * Offer a call to one person. Send several for a shortlist: whoever
   * accepts first gets the place, and the rest are told it has been filled.
   * Its invites and WhatsApp wait OFFER_WAIT_SECONDS (and the grace), so a wrong pick can be
   * taken back first (offer.undo, ADR 0161).
   */
  'offer.send': z.object({ id, callId: id, personId: id, override: z.boolean() }),
  /**
   * Take back an offer just made, before anything of the app's has gone to its person (ADR 0161): it's gone, as if never
   * made, with no cancellation to send. Only while it waits and nobody has answered; after that it's withdrawn instead.
   */
  'offer.undo': z.object({ id }),
  /** The freelancer's answer, from their link, the app or Google Calendar. */
  'offer.respond': z.discriminatedUnion('answer', [
    z.object({
      id,
      answer: z.literal('accept'),
      days: offerDays,
      note: text(1000, 'The note'),
      /**
       * The days still asked, not yet answered, after a Yes in Google Calendar to some days (ADR 0152). Only the calendar
       * sends it: an answer on their page or in the app is for every day.
       */
      asked: z.array(day).max(MAX_OFFER_DAYS).optional(),
    }),
    z.object({ id, answer: z.literal('decline'), note: text(1000, 'The note') }),
    /**
     * A No in Google Calendar to every day they had said yes to, with days they haven't answered: the offer is open again
     * for those days, as it was before their yes (ADR 0152). Only the calendar sends it.
     */
    z.object({ id, answer: z.literal('undecided'), days: z.array(day).min(1).max(MAX_OFFER_DAYS), note: text(1000, 'The note') }),
    z.object({
      id,
      answer: z.literal('counter'),
      counterRateCents: cents,
      days: offerDays,
      note: text(1000, 'The note'),
    }),
    /** Can't make it, having accepted or been booked: the place is free again and the office finds cover. */
    z.object({ id, answer: z.literal('pullOut'), note: text(1000, 'The note') }),
  ]),
  /**
   * Ops confirm an acceptance, or agree a counter-offer at the asked rate. Confirming books the days they said yes to and
   * ends the ask for any they haven't answered; once the call is full, a rate still asked for closes with it (ADR 0152).
   */
  'offer.confirm': z.object({ id }),
  /**
   * Ops say no to the rate asked for (ADR 0152): the offer stands at the rate offered, for the days the rate was asked for,
   * for them to take or turn down. Withdrawing it is offer.cancel.
   */
  'offer.refuse': z.object({ id }),
  'offer.cancel': z.object({ id }),
  /** The office has seen a decline or a pull-out, so it leaves "Answers to check". */
  'offer.seen': z.object({ id }),
} as const

/**
 * Who a message is to. Staff are paid through payroll, so no message to
 * them names a rate, as their page doesn't (audit finding 21).
 */
type Addressee = Pick<Person, 'name' | 'kind'> & Partial<Pick<Person, 'knownAs'>>

/** "€320 a day", or "rate to agree"; a rate this device isn't sent (ADR 0046) is on the person's own page instead. */
const rateLine = (c: Pick<CrewCall, 'dayRateCents'> & Partial<Pick<CrewCall, 'rateHidden'>>) =>
  c.rateHidden ? 'The rate is on your page' : `${euro(c.dayRateCents)}${c.dayRateCents !== null ? ' a day' : ''}`

/**
 * The message ops paste into WhatsApp, SMS or email. Everything a freelancer
 * needs to decide is in it; the link is for answering. For a job the client
 * hasn't said yes to yet (`hold`), it asks them to hold the day, and says that
 * nothing is booked until the client does (ADR 0150).
 */
export function offerMessage(p: Addressee, c: CrewCall, link: string, hold = false): string {
  const first = firstName(p)
  const job = `${c.project}${c.phase ? ` (${c.phase})` : ''}`
  const lines = [
    hold
      ? `Hi ${first}, can you hold ${c.start === c.end ? 'the day' : 'the days'} for ${job}? The client hasn't said yes yet, so nothing is booked until they do.`
      : `Hi ${first}, are you free for ${job}?`,
    `${c.role}, ${daysLabel(eachDay(c.start, c.end))}${c.callTime ? `, call ${c.callTime}` : ''}`,
    c.venue ? `At ${c.venue}` : '',
    p.kind === 'staff' ? '' : rateLine(c),
    // Said up front, so nobody says yes without the card (ADR 0028).
    needsOf(c).length ? `Needs ${needsLabel(needsOf(c))}.` : '',
    c.replyBy ? `Please answer by ${dayLabel(c.replyBy)}.` : '',
    `Accept, decline or pick days here: ${link}`,
  ]
  return lines.filter(Boolean).join('\n')
}

/** The name the offer's template is approved under in Meta's WhatsApp Manager (ADR 0125); its words are in docs/whatsapp-setup.md. */
export const WHATSAPP_OFFER_TEMPLATE = 'job_offer'
/** The follow-up when a job they were asked to hold the day for is confirmed, some time after (ADR 0125, HOLD). */
export const WHATSAPP_CONFIRMED_TEMPLATE = 'job_confirmed'
/** The word when a job they were asked for or booked on is cancelled or lost (ADR 0125, HOLD). */
export const WHATSAPP_CANCELLED_TEMPLATE = 'job_cancelled'
/** They're booked: the office confirmed them on a job the client has said yes to, or the client said yes after (ADR 0154). */
export const WHATSAPP_BOOKED_TEMPLATE = 'job_booked'
/** The call time of a call they're asked for or booked on has moved (ADR 0154). */
export const WHATSAPP_CALL_TIME_TEMPLATE = 'job_call_time'
/** Their offer ended on the office's side: filled by someone else, or withdrawn by the office (ADR 0154). */
export const WHATSAPP_NOT_NEEDED_TEMPLATE = 'job_not_needed'
/**
 * A job the client hasn't said yes to yet: crew asked for it are asked to hold the day, and their messages say HOLD.
 * HOLD is short for "hold the day", never the job being on hold (Colly, 12 November 2026; ADR 0150, `HOLD_WORDS`).
 */
export const jobOnHold = (status: string | undefined) => status === 'enquiry' || status === 'quoted'

/** Where an offer's WhatsApp message has got to, in a few words for the offer's row (ADR 0125). */
export function whatsappWords(w: NonNullable<Offer['whatsapp']>): string {
  return { queued: 'going on WhatsApp', sent: 'sent on WhatsApp', delivered: 'delivered on WhatsApp', read: 'read on WhatsApp', failed: 'not sent on WhatsApp' }[w.state]
}

/**
 * The blanks in the offer's WhatsApp template (ADR 0125), in order, the same facts as offerMessage's: their first name,
 * the job, the role (with any card it needs), the days, the call time, the venue, the rate and the day to answer by.
 * Meta takes no blank empty and none with a line break in it, so a fact not set yet says so in words.
 */
export function offerTemplateValues(p: Addressee, c: CrewCall, hold = false): string[] {
  const needs = needsOf(c).length ? ` (needs ${needsLabel(needsOf(c))})` : ''
  return [
    firstName(p),
    // Before the client says yes, the job leads with HOLD, as its days do on the calendar (ADR 0008).
    heldJobWords(c, hold),
    `${c.role}${needs}`,
    daysLabel(eachDay(c.start, c.end)),
    c.callTime || 'to be confirmed',
    c.venue || 'to be confirmed',
    p.kind === 'staff' ? 'as a member of staff' : rateLine(c),
    c.replyBy ? dayLabel(c.replyBy) : 'as soon as you can',
  ].map(oneLine)
}

const jobWords = (c: Pick<CrewCall, 'project' | 'phase'>) => `${c.project}${c.phase ? ` (${c.phase})` : ''}`
/** The job as their offer named it: with HOLD before the client says yes, as the offer's message and their invites say it. */
const heldJobWords = (c: Pick<CrewCall, 'project' | 'phase'>, hold: boolean) => `${hold ? 'HOLD ' : ''}${jobWords(c)}`

/** Meta takes no blank with a line break in it, or empty. */
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Their own days on a call: the days of their offer, or the call's when it names none. */
const theirDays = (c: Pick<CrewCall, 'start' | 'end'>, days: readonly string[]) => daysLabel(days.length ? [...days] : eachDay(c.start, c.end))

/**
 * The blanks in the confirmed and cancelled templates (ADR 0125, HOLD): their first name, the job, and the days they
 * were asked for, in one line each, as Meta wants them.
 */
export function followUpTemplateValues(p: Addressee, c: Pick<CrewCall, 'project' | 'phase' | 'start' | 'end'>, days: readonly string[]): string[] {
  return [firstName(p), jobWords(c), theirDays(c, days)].map(oneLine)
}

/**
 * The blanks in the booked template (ADR 0154), the facts of the offer for the days they're booked: their first name,
 * the job, the role, the days, the call time and the venue, a fact not set yet said in words.
 */
export function bookedTemplateValues(p: Addressee, c: Pick<CrewCall, 'project' | 'phase' | 'role' | 'start' | 'end' | 'callTime' | 'venue'>, days: readonly string[]): string[] {
  return [firstName(p), jobWords(c), c.role, theirDays(c, days), c.callTime || 'to be confirmed', c.venue || 'to be confirmed'].map(oneLine)
}

/**
 * The blanks in the call time template (ADR 0154): their first name, the job, the call time as it is now, and their days.
 * Before the client says yes, the job leads with HOLD, as it did in their offer.
 */
export function callTimeTemplateValues(p: Addressee, c: Pick<CrewCall, 'project' | 'phase' | 'start' | 'end' | 'callTime'>, days: readonly string[], hold = false): string[] {
  return [firstName(p), heldJobWords(c, hold), c.callTime || 'to be confirmed', theirDays(c, days)].map(oneLine)
}

/**
 * The blanks in the not needed template (ADR 0154): their first name, the job, their days, and why, in the words their
 * page uses ("filled by someone else", "withdrawn by the office"). Never with HOLD: the day isn't theirs to hold any more,
 * as their invite's last title says (endedTitle).
 */
export function notNeededTemplateValues(p: Addressee, c: Pick<CrewCall, 'project' | 'phase' | 'start' | 'end'>, days: readonly string[], why: string): string[] {
  return [firstName(p), jobWords(c), theirDays(c, days), why].map(oneLine)
}

/** wa.me wants digits only, with the country code. Irish mobiles written 08x become +3538x. */
export function whatsappNumber(phone: string): string {
  let digits = phone.replace(/[^0-9+]/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('0')) digits = `353${digits.slice(1)}`
  return digits
}

/**
 * The code in a person's calendar feed address, /cal/<code>.ics (ADR 0012).
 * Worked out from their private link, so nothing more is stored: whoever
 * holds the link can find the feed, the feed can't be turned back into the
 * link, and a new link gives a new feed address. The server and the app
 * work it out the same way. 24 characters, like the link itself, so error
 * reports take it out as a secret (privacy.ts).
 */
export async function feedCodeFor(linkToken: string): Promise<string> {
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sh-feed:${linkToken}`)))
  return btoa(String.fromCharCode(...hash))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .slice(0, 24)
}

export const feedPath = (code: string) => `/cal/${code}.ics`

/**
 * What the office tells someone after an offer, in the voice of the offer
 * message: short, the job and days named, and what happens next. The app
 * sends nothing itself: the office opens WhatsApp, a text or an email with
 * the words, or copies them, as it does for the offer (audit finding 9).
 * One message for each thing that changes; the app prompts with it right
 * after the office's own action.
 */
export type TellEvent =
  /** Confirm, or a counter-offer agreed: it's a booking. */
  | 'confirmed'
  /** An offer withdrawn before an answer, or a counter-offer withdrawn rather than answered. */
  | 'withdrawn'
  /** The rate they asked for turned down, with the offer standing at the rate offered (ADR 0152). */
  | 'rate-refused'
  /** Someone who had said yes, or was booked, is let go. */
  | 'released'
  /** The job is cancelled or lost, taking its crew calls with it. */
  | 'job-stopped'
  /** One crew call cancelled. */
  | 'call-cancelled'
  /** The call's days, time, rate or details changed; the message reads them as they are now. */
  | 'call-changed'
  /** The phase moved and its crew with it; the message reads the call's new days. */
  | 'phase-moved'
  | 'timesheet-approved'
  | 'timesheet-reopened'

/** What a message needs besides the person: the call as it stands, and the booking's own figures where they differ. */
export interface TellContext {
  call: Pick<CrewCall, 'id' | 'project' | 'phase' | 'role' | 'start' | 'end' | 'callTime' | 'venue' | 'dayRateCents'> & Partial<Pick<CrewCall, 'needsCertificates' | 'rateHidden' | 'projectId'>>
  /** The job is one the client hasn't said yes to yet (ADR 0150): the office's pick is a hold on the day, not a booking, and the message says so. */
  hold?: boolean
  /** For a changed call: the certificates it needed before, so the message says what it needs now, or no longer (ADR 0028). */
  neededBefore?: readonly CertificateKind[]
  /** The person's own days, when they took only some. */
  days?: readonly string[]
  /** For a rate turned down: the rate they asked for (ADR 0152). */
  askedRateCents?: number | null
  /** For a rate turned down on a call that has filled meanwhile: the offer closes with it, rather than standing (ADR 0152). */
  filled?: boolean
  /** The booking, for the timesheet's address. */
  offerId?: string
  /**
   * They had heard of the offer when the office pressed (ADR 0154, offerHeard): its WhatsApp went, none was made, or they'd
   * answered. What follows it on WhatsApp goes only then.
   */
  heard?: boolean
  /** For a timesheet: the figures approved, in words ("2 days at €320, and €43.50 of extras: €683.50"). */
  summary?: string
  /** For a timesheet: what the office changed from what was sent, in words. */
  changes?: readonly string[]
}

const jobName = (c: TellContext['call']) => `${c.project}${c.phase ? ` (${c.phase})` : ''}`
const whenLine = (c: TellContext['call'], days?: readonly string[]) =>
  `${daysLabel(days?.length ? [...days] : eachDay(c.start, c.end))}${c.callTime ? `, call ${c.callTime}` : ''}`

/** The message, its subject for an email, and what it is, for the panel's name ("Send confirmation to …"). */
export function tellMessage(event: TellEvent, p: Addressee, ctx: TellContext, link: string): { text: string; subject: string; what: string } {
  const first = firstName(p)
  const c = ctx.call
  // Staff are paid through payroll, so their messages name no rate.
  const rated = p.kind !== 'staff'
  const job = jobName(c)
  const when = whenLine(c, ctx.days)
  const next = "we'll be in touch about the next one."
  const timesheet = `${link}/timesheet/${ctx.offerId ?? c.id}`
  const lines = (parts: (string | false | undefined | 0)[]) => parts.filter(Boolean).join('\n')
  switch (event) {
    case 'confirmed': {
      const many = (ctx.days?.length ? ctx.days.length : eachDay(c.start, c.end).length) > 1
      return {
        text: lines([
          // On a job the client hasn't agreed yet, the office's pick is a hold on the day, never "confirmed" (ADR 0150).
          ctx.hold
            ? `Hi ${first}, we have you down for ${job}, so please hold ${many ? 'the days' : 'the day'}. The client hasn't said yes yet: it's booked once they do.`
            : `Hi ${first}, you're confirmed for ${job}.`,
          `${c.role}, ${when}`,
          c.venue && `At ${c.venue}`,
          rated && (c.dayRateCents !== null || c.rateHidden) && rateLine(c),
          `Your call sheet, with who's on and who to ring on the day, is here: ${link}/sheet/${c.id}`,
          'If anything changes on your side, let us know.',
        ]),
        subject: `${ctx.hold ? 'Hold the day' : 'Confirmed'}: ${job}, ${when}`,
        what: 'confirmation',
      }
    }
    case 'withdrawn':
      return {
        text: lines([`Hi ${first}, we've withdrawn the offer of ${c.role} on ${job}, ${when}, so there's nothing to answer.`, `Sorry for the bother, and ${next}`]),
        subject: `Withdrawn: ${job}, ${when}`,
        what: 'withdrawal',
      }
    case 'released':
      return {
        text: lines([
          `Hi ${first}, sorry, we no longer need you for ${job}: ${c.role}, ${when}.`,
          `It's off your bookings and your calendar feed, so there's nothing to do. Thanks for holding the days, and ${next}`,
        ]),
        subject: `No longer needed: ${job}, ${when}`,
        what: 'release',
      }
    case 'job-stopped':
      return {
        text: lines([
          `Hi ${first}, ${c.project} isn't going ahead, so ${c.role} on ${when} is off. Sorry about that.`,
          `It's off your bookings and your calendar feed. Thanks, and ${next}`,
        ]),
        subject: `Not going ahead: ${c.project}, ${when}`,
        what: 'cancellation',
      }
    case 'call-cancelled':
      return {
        text: lines([
          `Hi ${first}, we no longer need ${c.role} on ${job}, ${when}, so that's off. Sorry about that.`,
          `It's off your bookings and your calendar feed. Thanks, and ${next}`,
        ]),
        subject: `Cancelled: ${job}, ${when}`,
        what: 'cancellation',
      }
    case 'call-changed': {
      // Said plainly, so nobody turns up without a card the site now asks for, or worries about one it no longer does.
      const now = needsOf(c)
      const was = ctx.neededBefore ? tidyNeeds(ctx.neededBefore) : now
      const added = now.filter((k) => !was.includes(k))
      const dropped = was.filter((k) => !now.includes(k))
      return {
        text: lines([
          `Hi ${first}, a change to ${job}: ${c.role} is now ${when}${c.venue ? `, at ${c.venue}` : ''}${rated && !c.rateHidden ? `, ${rateLine(c)}` : ''}.`,
          added.length && `This call now needs ${needsLabel(added)}.`,
          dropped.length && `This call no longer needs ${needsLabel(dropped)}.`,
          `The details are on your page: ${link}`,
          'If that no longer suits, say so there or ring the office.',
        ]),
        subject: `Changed: ${job}, ${when}`,
        what: 'change',
      }
    }
    case 'rate-refused':
      // The call filled while their rate was with the office: there's no offer left to take (ADR 0152).
      if (ctx.filled)
        return {
          text: lines([
            c.rateHidden || (ctx.askedRateCents ?? null) === null
              ? `Hi ${first}, we can't agree the rate you asked for on ${job}, and ${c.role}, ${when}, has filled meanwhile, so the offer is closed.`
              : `Hi ${first}, we can't do ${euro(ctx.askedRateCents ?? null)} a day for ${job}, and ${c.role}, ${when}, has filled meanwhile, so the offer is closed.`,
            `Sorry, and ${next}`,
          ]),
          subject: `Your rate: ${job}, ${when}`,
          what: 'answer about the rate',
        }
      return {
        text: lines([
          // Both rates where they read them; a role that doesn't sends the office's words without them (ADR 0046).
          c.rateHidden || (ctx.askedRateCents ?? null) === null
            ? `Hi ${first}, we can't agree the rate you asked for on ${job}, but the offer stands at the rate offered: ${c.role}, ${when}.`
            : `Hi ${first}, we can't do ${euro(ctx.askedRateCents ?? null)} a day for ${job}, but the offer stands at ${rateLine(c)}: ${c.role}, ${when}.`,
          `Accept, decline or pick days here: ${link}`,
        ]),
        subject: `Your rate: ${job}, ${when}`,
        what: 'answer about the rate',
      }
    case 'phase-moved':
      return {
        text: lines([
          `Hi ${first}, ${job} has moved: ${c.role} is now ${when}.`,
          `The details are on your page: ${link}`,
          "If the new days don't suit, say so there or ring the office.",
        ]),
        subject: `Moved: ${job}, ${when}`,
        what: 'change',
      }
    case 'timesheet-approved':
      return {
        text: lines([
          `Hi ${first}, your timesheet for ${job} is approved${ctx.summary ? `: ${ctx.summary}` : ''}.`,
          ctx.changes?.length && `We changed what you sent: ${ctx.changes.join('; ')}.`,
          `It's here, with any note from us: ${timesheet}`,
          'Payment follows the usual way.',
        ]),
        subject: `Timesheet approved: ${job}`,
        what: 'timesheet approval',
      }
    case 'timesheet-reopened':
      return {
        text: lines([`Hi ${first}, we've reopened your timesheet for ${job} to sort something out. You can change it again until we approve it: ${timesheet}`]),
        subject: `Timesheet reopened: ${job}`,
        what: 'timesheet reopening',
      }
  }
}
