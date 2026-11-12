import { calendarDayId, offerOnCalendar, tells, type CalendarDay, type CalendarLink, type OfferOnCalendar } from './calendar.ts'
import { firstName, LIVE, whatsappWords, type CrewCall, type Offer, type Person, type TellContext } from './crew.ts'
import { daysLabel } from './crew-days.ts'
import { STOPPED, type Phase, type Project } from './jobs.ts'
import { whatsappDigits, type WhatsAppMode } from './office.ts'
import type { View } from './sync/client-types.ts'

/**
 * What the app sends crew by itself, and what it doesn't (audit of 12 November 2026, findings 1, 5, 14, 16, 18 and 20;
 * ADR 0149).
 *
 * Two things leave the app without anyone in the office sending them: a Google Calendar invite, which Google emails to
 * each person offered or booked (ADR 0009), and the offer on WhatsApp (ADR 0125). Each has its own switch and its own
 * rules, and both are the server's. This is those rules as a device can work them out, so the Offer form says what a
 * press will send before it's pressed, and each offer's row says what went, from what the server read back from Google
 * and Meta (design rule 10: say what will happen, then show what did). The messages the office sends by hand (ADR 0048)
 * are a third thing, and no part of this: the app can't know whether one was sent.
 */

/** "Fergal", "Fergal and Olan", "Fergal, Olan and Colm". */
export const namesInWords = (all: readonly string[]) => (all.length > 1 ? `${all.slice(0, -1).join(', ')} and ${all.at(-1)}` : (all[0] ?? ''))

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---- WhatsApp ----

export interface WhatsAppSetting {
  mode: WhatsAppMode
  /** The numbers WhatsApp goes to in test mode, as typed. */
  testTo: readonly string[]
}

/**
 * The number a person's offers go to on WhatsApp (ADR 0125), or undefined when they don't: it's off, they turned it
 * off, they have no mobile WhatsApp can take, or, in test mode, theirs isn't one of the numbers to try it on. The
 * server sends by this rule and the device says what will go by it, so the two can't differ.
 */
export function whatsappReach(setting: WhatsAppSetting, person: Pick<Person, 'phone' | 'whatsappOff'>): string | undefined {
  if (setting.mode === 'off' || person.whatsappOff) return undefined
  const to = whatsappDigits(person.phone)
  if (!to) return undefined
  if (setting.mode === 'test' && !setting.testTo.some((n) => whatsappDigits(n) === to)) return undefined
  return to
}

/**
 * Why an offer doesn't go to someone on WhatsApp: it's off for everyone; they turned it off; they have no mobile it can
 * take; it's being tried on other numbers only; or the rule would send one now and none went, as for an offer made
 * before WhatsApp was on.
 */
export type NoWhatsApp = 'off' | 'theirs-off' | 'no-number' | 'not-tried' | 'none-went'

export function noWhatsApp(setting: WhatsAppSetting, person: Pick<Person, 'phone' | 'whatsappOff'> | undefined): NoWhatsApp | undefined {
  if (setting.mode === 'off') return 'off'
  if (!person) return 'no-number'
  if (person.whatsappOff) return 'theirs-off'
  if (!whatsappDigits(person.phone)) return 'no-number'
  return whatsappReach(setting, person) ? undefined : 'not-tried'
}

const NO_WHATSAPP: Record<NoWhatsApp, string> = {
  off: 'WhatsApp is off',
  'theirs-off': 'they turned WhatsApp off',
  'no-number': 'they have no mobile number for WhatsApp',
  'not-tried': 'WhatsApp is only being tried on other numbers',
  'none-went': 'nothing went on WhatsApp',
}

/**
 * Whether a person has heard of an offer, as far as WhatsApp goes (ADR 0154): its own WhatsApp went; none was made,
 * as it was made before WhatsApp reached them and the calendar invite or the office told them; or they've answered it.
 * Nothing follows an offer whose WhatsApp is still waiting, or didn't go, and that nobody has answered: the news would
 * be of an offer they never had.
 */
export const offerHeard = (offer: Partial<Pick<Offer, 'whatsapp' | 'respondedAt'>>): boolean =>
  !offer.whatsapp || offer.whatsapp.state === 'sent' || offer.whatsapp.state === 'delivered' || offer.whatsapp.state === 'read' || !!offer.respondedAt

/**
 * Whether what follows an offer goes to its person on WhatsApp (ADR 0154; audit of 12 November 2026, findings 4, 8 and
 * 12): that they're booked, that their call time moved, that they're no longer needed, and that the job is going ahead
 * or is off. To anyone WhatsApp reaches who has heard of the offer, whether or not the offer itself went on WhatsApp
 * (Colly's answer to question 7). The server queues by this rule, and a device says what went by it.
 */
export function whatsappFollows(setting: WhatsAppSetting, person: Pick<Person, 'phone' | 'whatsappOff'> | null | undefined, heard: boolean): boolean {
  return heard && !!person && whatsappReach(setting, person) !== undefined
}

/**
 * What a press sends someone on WhatsApp after their offer (ADR 0154), for the panel that says what went: that they're
 * booked, their new call time, that they're no longer needed, or that the job is off.
 */
export type WhatsAppNews = 'booked' | 'call-time' | 'not-needed' | 'job-off'

const WHATSAPP_NEWS: Record<WhatsAppNews, string> = {
  booked: "A WhatsApp saying they're booked",
  'call-time': 'A WhatsApp with the new call time',
  'not-needed': "A WhatsApp saying they're no longer needed",
  'job-off': 'A WhatsApp saying the job is off',
}

/** "A WhatsApp saying they're booked is going to Aoife.", said of everyone it goes to. */
const whatsappSaid = (news: WhatsAppNews): Said => ({ key: `whatsapp:${news}`, say: (who) => `${WHATSAPP_NEWS[news]} is going to ${who}.` })

// ---- The calendar invite ----

/** What a device knows of a job that decides its invites: whether it came from a calendar, where it stands and its phases' days. */
export type ReachJob = Pick<Project, 'status'> & Partial<Pick<Project, 'sourceCalendar'>> & { phases: readonly Pick<Phase, 'id' | 'start' | 'end'>[] }

/** Everything the rules read besides the offer itself. */
export interface ReachContext {
  calendar: { link: CalendarLink | undefined; days: Readonly<Record<string, CalendarDay>> }
  /** The job a call is part of; undefined when this device isn't sent it. */
  job: (projectId: string) => ReachJob | undefined
  whatsapp: WhatsAppSetting
  /** Messages to crew are on (ADR 0048): Offer, Send and Tell open a message for the office to send. */
  messages: boolean
  today: string
}

/** The rules' context from a device's view. */
export function reachContext(view: Pick<View, 'calendar' | 'jobs' | 'office'>, today: string): ReachContext {
  let byId: Map<string, ReachJob> | undefined
  return {
    calendar: view.calendar,
    job: (id) => (byId ??= new Map(view.jobs.jobs.map((j) => [j.id, j]))).get(id),
    whatsapp: { mode: view.office.whatsapp, testTo: view.office.whatsappTestTo },
    messages: view.office.promptMessages,
    today,
  }
}

/**
 * Why no calendar invite goes for an offer, first reason first:
 *
 * - `off`: crew invites are off, or no calendar is connected;
 * - `paused`: they're on, but the calendar needs connecting again;
 * - `no-job`: the call isn't part of a job, and only a job's days go on the calendar;
 * - `unknown`: the job isn't on this device, so it can't say;
 * - `brought-in`: the job came from a Google calendar, which keeps its own events (ADR 0011);
 * - `stopped`: the job is cancelled or lost, or the call is cancelled;
 * - `past`: none of the days is today or later;
 * - `outside-phases`: none of the days is inside a phase of the job the call covers;
 * - `no-email`: the person has no email address.
 */
export type NoInvite = 'off' | 'paused' | 'no-job' | 'unknown' | 'brought-in' | 'stopped' | 'past' | 'outside-phases' | 'no-email'

/** Where a person's invites go for some days of a call: each phase's day that gets one, or why none does. */
export interface InvitePlan {
  rows: readonly { phaseId: string; day: string }[]
  /** The days of those, each once, in order. */
  days: readonly string[]
  why: NoInvite | undefined
}

/**
 * The server's rule for who gets a calendar invite (server/src/calendar/events.ts, wantedEvents), read from a device:
 * invites on and a calendar connected; a job of the app's own that isn't stopped; and for each day from today on, a
 * phase of the job that the call covers and that holds the day; and an email address to send it to. A job the client
 * hasn't said yes to goes on the calendar as HOLD (hold the day) once anyone is asked for it, so an offer there gets
 * its invite too.
 */
export function invitePlan(
  ctx: ReachContext,
  call: Pick<CrewCall, 'projectId' | 'phaseId' | 'status'>,
  person: Pick<Person, 'email'> | undefined,
  days: readonly string[]
): InvitePlan {
  const none = (why: NoInvite): InvitePlan => ({ rows: [], days: [], why })
  const link = ctx.calendar.link
  if (link?.invites !== true) return none('off')
  if (link.state === 'reconnect') return none('paused')
  if (link.state !== 'on' || !link.calendarId) return none('off')
  if (!call.projectId) return none('no-job')
  const job = ctx.job(call.projectId)
  if (!job) return none('unknown')
  if (job.sourceCalendar) return none('brought-in')
  if (STOPPED.includes(job.status) || call.status !== 'open') return none('stopped')
  const ahead = days.filter((d) => d >= ctx.today)
  if (!ahead.length) return none('past')
  const rows = job.phases
    .filter((p) => p.end >= ctx.today && (call.phaseId === null || call.phaseId === p.id))
    .flatMap((p) => ahead.filter((d) => p.start <= d && d <= p.end).map((day) => ({ phaseId: p.id, day })))
  if (!rows.length) return none('outside-phases')
  if (!person?.email?.trim()) return none('no-email')
  return { rows, days: [...new Set(rows.map((r) => r.day))].sort(), why: undefined }
}

// ---- One offer: what went ----

type ReachOffer = Pick<Offer, 'id' | 'personId' | 'status' | 'days'> & Partial<Pick<Offer, 'whatsapp' | 'respondedVia' | 'counterRateCents'>>
type ReachCall = Pick<CrewCall, 'projectId' | 'phaseId' | 'status' | 'start' | 'end'>
type ReachPerson = Pick<Person, 'name' | 'email' | 'phone'> & Partial<Pick<Person, 'knownAs' | 'firstName' | 'whatsappOff'>>

/** Where one offer stands with what the app sends by itself, from what the server read back. */
export interface OfferReach {
  /** Where its invites go by the server's rule, or why none does. */
  plan: InvitePlan
  /** Its person's answers on the days they are a guest by it, as the job page says them; undefined when on none. */
  onCalendar: OfferOnCalendar | undefined
  /** The days, from today on, they hold an invite for by this offer. */
  invited: string[]
  /** Days whose invite they hold by another of their offers on the job: one invite a day, for the offer furthest on. */
  byAnother: string[]
  /** Days Google turned their invite down, and what it said of the first. */
  refused: string[]
  refusal: string | null
  /** Days an invite goes for by the rule and isn't on the calendar yet. */
  coming: string[]
  /** What holds those back while the calendar has a problem of its own, in the server's words. */
  held: string | null
  /** Their No to an earlier offer still stands on the days' events in Google, so this offer sent no email. */
  earlierNo: boolean
  /** Where the offer's WhatsApp message has got to, when one was made. */
  whatsapp: NonNullable<Offer['whatsapp']> | undefined
  /** Why none was, otherwise. */
  noWhatsApp: NoWhatsApp | undefined
  /** An invite or a WhatsApp of the app's has got to them. */
  reached: boolean
  /** One is on its way, with nothing known to hold it. */
  onItsWay: boolean
}

/**
 * `others` is everyone's offers on the call: an earlier offer of the same person's that ended in a No tells a No still
 * standing in Google from one they've just given to this offer, which the app takes in a moment later.
 */
export function offerReach(
  ctx: ReachContext,
  offer: ReachOffer,
  call: ReachCall,
  person: ReachPerson | undefined,
  others: readonly Pick<Offer, 'id' | 'personId' | 'status'>[] = []
): OfferReach {
  const plan = invitePlan(ctx, call, person, offer.days.filter((d) => call.start <= d && d <= call.end))
  const onCalendar = offerOnCalendar(offer, ctx.calendar.days, ctx.today)
  const invited = Object.keys(onCalendar?.answers ?? {}).sort()
  const byAnother = new Set<string>()
  const refused = new Set<string>()
  const coming = new Set<string>()
  let refusal: string | null = null
  // With no account to hold each person's own copy, guests are on the day everyone sees.
  const ownCopies = !!ctx.calendar.link?.account
  for (const r of plan.rows) {
    if (invited.includes(r.day)) continue
    const shared = ctx.calendar.days[calendarDayId(r.phaseId, r.day)]
    const own = ctx.calendar.days[`${calendarDayId(r.phaseId, r.day)}/${offer.personId}`]
    if ([own, shared].some((d) => d?.guests?.some((g) => g.personId === offer.personId))) byAnother.add(r.day)
    else if (own?.state === 'failed' || (!ownCopies && shared?.state === 'failed')) {
      refused.add(r.day)
      refusal ??= (own?.state === 'failed' ? own : shared)?.problem ?? null
    } else coming.add(r.day)
  }
  const earlierNo =
    offer.status === 'offered' &&
    invited.length > 0 &&
    invited.every((d) => onCalendar!.answers[d] === 'no') &&
    others.some((o) => o.id !== offer.id && o.personId === offer.personId && o.status === 'declined')
  const whatsapp = offer.whatsapp
  const held = coming.size > 0 ? (ctx.calendar.link?.problem ?? null) : null
  const whatsappWent = whatsapp !== undefined && whatsapp.state !== 'queued' && whatsapp.state !== 'failed'
  return {
    plan,
    onCalendar,
    invited,
    byAnother: [...byAnother].sort(),
    refused: [...refused].sort(),
    refusal,
    coming: [...coming].sort(),
    held,
    earlierNo,
    whatsapp,
    noWhatsApp: whatsapp ? undefined : (noWhatsApp(ctx.whatsapp, person) ?? 'none-went'),
    reached: (invited.length > 0 && !earlierNo) || byAnother.size > 0 || whatsappWent,
    onItsWay: (coming.size > 0 && !held) || whatsapp?.state === 'queued',
  }
}

// ---- One offer: its row ----

/** A line under an offer's row. Plain is how it stands; `warn` is for the office to act on; `bad` is something that failed. */
export interface ReachLine {
  text: string
  tone: 'plain' | 'warn' | 'bad'
  /** The server's own words for what failed, for whoever wants them. */
  title?: string
}

export interface RowReach {
  lines: ReachLine[]
  /**
   * Nothing of the app's has reached them, nothing is on its way and no message opens for the office to send: the row
   * offers ringing them in Send's place, the plain contact ADR 0048 keeps.
   */
  contact: boolean
  /**
   * That is so because every way out is switched off. The row then says nothing of its own: it's the same for everyone
   * waiting, so the call says it once over them all (nothingSentLine).
   */
  allOff: boolean
}

/** How they answered when it wasn't on the invite, so an invite nobody answered doesn't read as no answer at all. */
const ANSWERED: Partial<Record<NonNullable<Offer['respondedVia']>, string>> = {
  link: 'Answered on their page.',
  whatsapp: 'Answered on WhatsApp.',
  app: 'Answered in the app.',
}

/** No invite, said for a row that something else reached, or that the office messages by hand. */
const NO_INVITE_LINE: Partial<Record<NoInvite, string>> = {
  paused: 'No calendar invite: the calendar needs connecting again.',
  'no-job': "No calendar invite: this call isn't part of a job.",
  'outside-phases': "No calendar invite: its days aren't inside one of the job's phases.",
  'no-email': 'No email address, so no calendar invite.',
  'brought-in': "No invite from the app: this job came from Google Calendar, so its days are the organiser's.",
}

/** The same reasons as the first half of "Nothing has reached Seán: …, and WhatsApp is off." */
const NO_INVITE_BECAUSE: Partial<Record<NoInvite, string>> = {
  off: 'calendar invites are off',
  paused: 'the calendar needs connecting again',
  'no-job': "a call that isn't part of a job gets no calendar invite",
  'outside-phases': "its days aren't inside one of the job's phases, so no calendar invite went",
  'no-email': 'they have no email address for a calendar invite',
}

/** The same reasons after "No calendar invite went to Seán: ", where the invite is already named. */
const NO_INVITE_SHORT: Partial<Record<NoInvite, string>> = {
  off: 'calendar invites are off',
  paused: 'the calendar needs connecting again',
  'no-job': "this call isn't part of a job",
  'outside-phases': "its days aren't inside one of the job's phases",
  'no-email': 'they have no email address',
}

const HELD_LINE = 'Calendar invite not sent yet: the calendar has a problem. See Admin › Connections.'
const EARLIER_NO_LINE = 'No new invite went: their No to an earlier offer still stands in Google Calendar.'
const BROUGHT_IN = "this job came from Google Calendar, so its days are the organiser's"

/** Why nothing went, as the words after "Nothing has reached Seán: "; undefined when there's nothing a row should say. */
function nothingBecause(r: Pick<OfferReach, 'plan' | 'whatsapp' | 'noWhatsApp'>): string | undefined {
  const invite = r.plan.why && NO_INVITE_BECAUSE[r.plan.why]
  if (!invite) return undefined
  const whatsapp = r.whatsapp?.state === 'failed' ? "the WhatsApp wasn't sent" : NO_WHATSAPP[r.noWhatsApp ?? 'none-went']
  return `${invite}, and ${whatsapp}`
}

/** Every way out is switched off: the office's own choice, said plainly and never as a warning. */
const allOff = (ctx: ReachContext, r: Pick<OfferReach, 'plan' | 'noWhatsApp'>) => !ctx.messages && r.plan.why === 'off' && r.noWhatsApp === 'off'
const ALL_OFF = 'calendar invites, WhatsApp and messages to crew are all off'
const ALL_OFF_LINE = `Nothing is sent: ${ALL_OFF}.`

/**
 * Who a sentence names: by the name they go by, or in full when two of them go by the same one; and their email address,
 * which says whether their invites tell them what happens next (ADR 0153).
 */
export type ToldWho = Pick<Person, 'id' | 'name'> & Partial<Pick<Person, 'knownAs' | 'firstName' | 'email'>>

/**
 * Whether a person's own invites tell them what happens next (ADR 0153): that they're booked, that their call time moved,
 * and why a day is cancelled, all of which Google then emails them.
 */
export const toldNext = (ctx: Pick<ReachContext, 'calendar'>, who: Partial<Pick<Person, 'email'>> | null | undefined) => tells(ctx.calendar.link, who?.email)

/** What Google's cancellation says when their invites tell them what happens next: why, in its title (ADR 0153). */
const andWhy = (ctx: Pick<ReachContext, 'calendar'>, who: Partial<Pick<Person, 'email'>> | null | undefined) => (toldNext(ctx, who) ? ' and why' : '')

/** Each by the name they go by, or in full where someone else among them goes by the same one. */
const called = (who: readonly ToldWho[], among: readonly ToldWho[] = who) => who.map((w) => (among.some((o) => o.id !== w.id && firstName(o) === firstName(w)) ? w.name : firstName(w)))

/**
 * What an offer's row says of how its person was reached (finding 5's "one line on every offer row, worked out from
 * what happened"), and whether it offers ringing them.
 *
 * An offer still waiting on them says the most, as nobody has heard from them: invited by email and how many days; on
 * WhatsApp and how far it got; or that nothing has reached them and why. One they've answered says only what the
 * office might otherwise misread or has to fix. One that's over says what Google still holds, as before. With every way
 * out switched off the row says nothing: that's everyone's, so the call says it once (nothingSentLine).
 */
export function reachOnRow(
  ctx: ReachContext,
  offer: ReachOffer,
  call: ReachCall,
  person: ReachPerson | undefined,
  others: readonly Pick<Offer, 'id' | 'personId' | 'status'>[] = []
): RowReach {
  const r = offerReach(ctx, offer, call, person, others)
  const cal = r.onCalendar
  const lines: ReachLine[] = []
  if (!LIVE.includes(offer.status)) {
    if (cal) lines.push({ text: cal.line, tone: 'plain' })
    if (cal?.warning) lines.push({ text: cal.warning, tone: 'warn' })
    return { lines, contact: false, allOff: false }
  }
  const waiting = offer.status === 'offered'
  const why = r.plan.why
  // Nothing to say and nobody to ring for a call that's over, or a job this device can't read.
  const silent = why === 'past' || why === 'stopped' || why === 'unknown'
  let invite: ReachLine | undefined
  let off = false
  if (r.earlierNo) invite = { text: EARLIER_NO_LINE, tone: 'warn' }
  else if (cal) {
    const n = r.invited.length
    const unanswered = r.invited.every((d) => cal.answers[d] === 'none')
    const answered = waiting ? 'No answer yet.' : ((offer.respondedVia && ANSWERED[offer.respondedVia]) ?? '')
    invite = { text: unanswered ? `Invited by email${n > 1 ? `, ${n} days` : ''}.${answered ? ` ${answered}` : ''}` : cal.line, tone: 'plain' }
  } else if (r.byAnother.length) invite = { text: `The calendar invite for ${r.byAnother.length > 1 ? 'these days' : 'the day'} is for their other call on this job.`, tone: 'plain' }
  else if (r.refused.length) invite = { text: 'Invite not sent: Google turned it down. Check the address.', tone: 'bad', ...(r.refusal ? { title: r.refusal } : {}) }
  else if (r.coming.length) invite = r.held ? { text: HELD_LINE, tone: 'warn', title: r.held } : { text: 'Calendar invite on its way.', tone: 'plain' }
  else if (!waiting) invite = why === 'no-email' ? { text: NO_INVITE_LINE['no-email']!, tone: 'plain' } : undefined
  else if (silent) invite = undefined
  else if (why === 'brought-in') invite = { text: NO_INVITE_LINE['brought-in']!, tone: 'plain' }
  else if (r.reached || r.onItsWay || ctx.messages) invite = why && NO_INVITE_LINE[why] ? { text: NO_INVITE_LINE[why]!, tone: 'plain' } : undefined
  else if (allOff(ctx, r)) off = true
  else {
    const because = nothingBecause(r)
    invite = because ? { text: `Nothing has reached ${person ? firstName(person) : 'them'}: ${because}.`, tone: 'warn' } : undefined
  }
  // How far the offer's WhatsApp got, while it's still theirs to answer: after the invite, in the same line.
  const whatsapp = waiting && r.whatsapp && r.whatsapp.state !== 'failed' ? `${capital(whatsappWords(r.whatsapp))}.` : ''
  if (invite) lines.push(whatsapp && invite.tone === 'plain' ? { ...invite, text: `${invite.text} ${whatsapp}` } : invite)
  if (whatsapp && invite?.tone !== 'plain') lines.push({ text: whatsapp, tone: 'plain' })
  if (waiting && r.whatsapp?.state === 'failed')
    lines.push({ text: `${capital(whatsappWords(r.whatsapp))}${r.whatsapp.problem ? `: ${r.whatsapp.problem}` : '.'}`, tone: 'bad' })
  if (cal && r.refused.length) lines.push({ text: `Invite not sent for ${daysLabel(r.refused)}: Google turned it down.`, tone: 'bad', ...(r.refusal ? { title: r.refusal } : {}) })
  if (cal?.warning) lines.push({ text: cal.warning, tone: 'warn' })
  return { lines, contact: waiting && !ctx.messages && !silent && !r.reached && !r.onItsWay, allOff: off }
}

/**
 * Said once over a call's offers when every way out is switched off, in place of the same line under each of them: who
 * the app sent nothing to. The few by name; more as a count, of everyone still to answer or of some of them.
 */
export function nothingSentLine(people: readonly ToldWho[], waiting: number): string | undefined {
  const n = people.length
  if (!n) return undefined
  const who = n <= 3 ? namesInWords(called(people)) : n >= waiting ? `the ${n} people still to answer` : `${n} of the people still to answer`
  return `Nothing was sent to ${who}: ${ALL_OFF}.`
}

// ---- Before the press: the Offer form's promise ----

export interface OfferPromise {
  /** What pressing sends by itself and what it doesn't, a sentence each. */
  sentences: string[]
  /** Pressing tells nobody anything: no invite, no WhatsApp, and no message opens for the office to send. */
  silent: boolean
  /** An invite goes to someone picked, so Google emails whoever doesn't get the place that theirs is cancelled. */
  invites: boolean
}

/** What pressing Offer will send each person picked, by the server's own rules (finding 1). */
export function offerPromise(ctx: ReachContext, call: Pick<CrewCall, 'projectId' | 'phaseId' | 'status'> & { days: readonly string[] }, people: readonly ReachPerson[]): OfferPromise {
  const each = people.map((p) => ({ name: firstName(p), plan: invitePlan(ctx, call, p, call.days), whatsapp: whatsappReach(ctx.whatsapp, p) !== undefined, noWhatsApp: noWhatsApp(ctx.whatsapp, p) }))
  const all = each.length
  const them = all > 1 ? 'each of them' : 'them'
  const named = (some: typeof each) => (some.length === all ? them : namesInWords(some.map((e) => e.name)))
  const invited = each.filter((e) => !e.plan.why)
  const onWhatsApp = each.filter((e) => e.whatsapp)
  const sentences: string[] = []
  // A calendar with a problem is written to once it's put right, and the invites go then.
  if (invited.length) sentences.push(`Pressing it emails ${named(invited)} a calendar invite${invited.some((e) => e.plan.days.length > 1) ? ' for each day' : ''}${onceBack(ctx)}.`)
  if (onWhatsApp.length) sentences.push(`${invited.length ? 'The offer also goes' : 'Pressing it sends the offer'} to ${named(onWhatsApp)} on WhatsApp.`)
  // Nothing opens for the office to send, so what the app doesn't send, nobody does.
  const quiet = !ctx.messages
  const whatsappOff = ctx.whatsapp.mode === 'off'
  // The job's or the call's own reason is everyone's; only a missing address is one person's.
  const shared = each[0]?.plan.why !== 'no-email' ? each[0]?.plan.why : undefined
  const known = shared !== 'unknown' && shared !== 'past' && shared !== 'stopped'
  if (shared && quiet && !onWhatsApp.length) {
    const also = whatsappOff ? ', and WhatsApp is off' : ''
    const said: Partial<Record<NoInvite, string>> = {
      'brought-in': `Nothing is sent for this job from the app: it came from Google Calendar, so its days are the organiser's${whatsappOff ? '' : ', and WhatsApp reaches nobody picked'}.`,
      off: whatsappOff ? ALL_OFF_LINE : 'Nothing is sent: calendar invites are off, and WhatsApp reaches nobody picked.',
      paused: `Nothing is sent: the calendar needs connecting again before invites go${also}.`,
      'no-job': `Nothing is sent: a call that isn't part of a job gets no calendar invite${also}.`,
      'outside-phases': `Nothing is sent: the call's days aren't inside one of the job's phases, so no calendar invite goes${also}.`,
    }
    if (said[shared]) sentences.push(said[shared]!)
  } else if (shared) {
    const said: Partial<Record<NoInvite, string>> = {
      'brought-in': "No calendar invite goes for this job: it came from Google Calendar, so its days are the organiser's.",
      paused: 'No calendar invite goes until the calendar is connected again.',
      'no-job': "No calendar invite goes for a call that isn't part of a job.",
      'outside-phases': "No calendar invite goes: the call's days aren't inside one of the job's phases.",
    }
    if (said[shared]) sentences.push(said[shared]!)
  } else {
    const noEmail = each.filter((e) => e.plan.why === 'no-email')
    const unreached = quiet ? noEmail.filter((e) => !e.whatsapp) : []
    const reached = noEmail.filter((e) => !unreached.includes(e))
    if (reached.length) sentences.push(`${namesInWords(reached.map((e) => e.name))} ${reached.length > 1 ? 'have' : 'has'} no email address, so no calendar invite.`)
    // A sentence for each reason WhatsApp doesn't go either, with everyone it's true of.
    for (const no of [...new Set(unreached.map((e) => e.noWhatsApp ?? 'none-went'))]) {
      const who = unreached.filter((e) => (e.noWhatsApp ?? 'none-went') === no).map((e) => e.name)
      sentences.push(`Nothing goes to ${namesInWords(who)}: no email address for a calendar invite, and ${NO_WHATSAPP[no]}.`)
    }
  }
  return { sentences, silent: quiet && all > 0 && known && !invited.length && !onWhatsApp.length, invites: invited.length > 0 }
}

// ---- Before a press that ends an offer: what Google emails ----

/** The days, from today on, a person holds an invite for by an offer and hasn't turned down. */
export function invitesHeld(ctx: Pick<ReachContext, 'calendar' | 'today'>, offerId: string): string[] {
  const days = new Set<string>()
  for (const d of Object.values(ctx.calendar.days)) {
    if (d.day < ctx.today) continue
    if (d.guests?.some((g) => g.offerId === offerId && g.response !== 'declined')) days.add(d.day)
  }
  return [...days].sort()
}

/**
 * The days Google emails a person a cancellation for when an offer of theirs ends: the days they hold an invite for.
 * The server takes those events off the calendar with word to the guest; one they said No to is left where it is, so
 * no cancellation follows a No (ADR 0009). None with invites switched off since: the invites people already hold then
 * stay as they are (keptWords).
 */
export function daysToCancel(ctx: Pick<ReachContext, 'calendar' | 'today'>, offerId: string): string[] {
  return ctx.calendar.link?.invites === true ? invitesHeld(ctx, offerId) : []
}

/** Invites were switched off after someone was sent theirs: ending their offer leaves the days in their calendar. */
const KEPT = 'Crew invites are off, so Google sends no cancellation'
const keptAmong = (ctx: Pick<ReachContext, 'calendar' | 'today'>, offerIds: readonly (string | undefined)[]) =>
  ctx.calendar.link?.invites !== true && offerIds.some((id) => id !== undefined && invitesHeld(ctx, id).length > 0) ? ` ${KEPT}: the days stay in the calendars of those invited.` : ''

/**
 * What ending one person's offer does beyond the app, for the question asked first (finding 5): "Google emails them
 * that their 3 days are cancelled, and their link says it's withdrawn at once." `says` is what their link will say. With
 * their invites telling them what happens next, the cancellation says why (ADR 0153). `whatsapp` is that a WhatsApp
 * tells them they're no longer needed (ADR 0154, whatsappFollows).
 */
export function endingWords(ctx: ReachContext, offerId: string, says: string, who?: Partial<Pick<Person, 'email'>> | null, whatsapp = false): string {
  const n = daysToCancel(ctx, offerId).length
  const andWhatsApp = whatsapp ? ` ${NOT_NEEDED_ASKED}.` : ''
  if (n) return `Google emails them that ${n === 1 ? 'the day is' : `their ${n} days are`} cancelled${andWhy(ctx, who)}${onceBack(ctx)}, and their link says ${says} at once.${andWhatsApp}`
  const kept = invitesHeld(ctx, offerId).length
  if (kept) return `Their link says ${says} at once. ${KEPT}: the ${kept === 1 ? 'day stays' : `${kept} days stay`} in their calendar.${andWhatsApp}`
  if (whatsapp) return `Their link says ${says} at once, and a WhatsApp tells them they're no longer needed.`
  return `Their link says ${says} at once.${ctx.messages ? '' : ' Nothing is sent to them.'}`
}

/** Before a press that ends someone's offer: the WhatsApp that follows it (ADR 0154). */
const NOT_NEEDED_ASKED = "A WhatsApp tells them they're no longer needed"

/** The server takes nothing off a calendar it can't write to, so the cancellation waits for that. */
const onceBack = (ctx: Pick<ReachContext, 'calendar'>) => (ctx.calendar.link?.problem ? ' once the calendar is working again' : '')

/** An offer on a call, with what the rules read of its person: their address for invites, and their mobile for WhatsApp. */
export type EndingOffer = Pick<Offer, 'id' | 'status'> & Partial<Pick<Offer, 'whatsapp' | 'respondedAt'>> & { person?: Partial<Pick<Person, 'email' | 'phone' | 'whatsappOff'>> | null }

/**
 * Whether what follows an offer goes to its person on WhatsApp, as a device asks it before or after a press (ADR 0154,
 * whatsappFollows): nothing does about a call whose days are all past, which is a record by then.
 */
export function whatsappFollowsOffer(
  ctx: Pick<ReachContext, 'whatsapp' | 'today'>,
  call: Pick<CrewCall, 'end'>,
  offer: Partial<Pick<Offer, 'whatsapp' | 'respondedAt'>>,
  person: Partial<Pick<Person, 'phone' | 'whatsappOff'>> | null | undefined
): boolean {
  return call.end >= ctx.today && !!person && whatsappFollows(ctx.whatsapp, { phone: person.phone ?? null, whatsappOff: person.whatsappOff ?? false }, offerHeard(offer))
}

/** The same for someone told of a press, from what was known of their offer when it was pressed (TellContext.heard). */
export function whatsappFollowsTell(
  ctx: Pick<ReachContext, 'whatsapp' | 'today'>,
  t: { person: Pick<Person, 'phone' | 'whatsappOff'>; context: Pick<TellContext, 'call' | 'offerId' | 'heard'> }
): boolean {
  return t.context.offerId !== undefined && t.context.call.end >= ctx.today && whatsappFollows(ctx.whatsapp, t.person, t.context.heard !== false)
}

/** "A WhatsApp tells them", "each of them", or "2 of them", that they're no longer needed, or that the job is off. */
const whatsappTells = (told: number, everyone: number, news: string) =>
  told ? ` A WhatsApp tells ${told < everyone ? `${told} of them` : everyone === 1 ? 'them' : 'each of them'} ${news}.` : ''

/**
 * The same for a whole call being cancelled: how many of the people on it Google emails, and that their links say so;
 * and that the cancellations say why, when every one of them goes to someone told what happens next (ADR 0153). And how
 * many of them a WhatsApp tells they're no longer needed (ADR 0154).
 */
export function callEndingWords(ctx: ReachContext, call: Pick<CrewCall, 'end'> & { offers: readonly EndingOffer[] }): string {
  const on = call.offers.filter((o) => LIVE.includes(o.status))
  const k = on.length
  if (!k) return 'Nobody is offered or booked on it.'
  const held = on.map((o) => daysToCancel(ctx, o.id).length)
  const emailed = held.filter((n) => n > 0).length
  const onWhatsApp = on.filter((o) => whatsappFollowsOffer(ctx, call, o, o.person)).length
  const andWhatsApp = whatsappTells(onWhatsApp, k, "they're no longer needed")
  const people = k === 1 ? 'the person' : `the ${k} people`
  const links = k === 1 ? 'their link says' : 'their links say'
  const days = cancelledDays(held)
  const why = on.every((o, i) => !held[i] || toldNext(ctx, o.person)) ? ' and why' : ''
  if (emailed === k) return `Google emails ${people} on it that ${days} cancelled${why}${onceBack(ctx)}, and ${links} it's withdrawn at once.${andWhatsApp}`
  if (emailed > 0)
    return `Google emails ${emailed} of ${people} on it that ${days} cancelled${why}${onceBack(ctx)}. Everyone's link says it's withdrawn at once${ctx.messages || onWhatsApp ? '' : ', and nothing else is sent'}.${andWhatsApp}`
  const kept = keptAmong(ctx, on.map((o) => o.id))
  return (ctx.messages || onWhatsApp ? `${capital(links)} it's withdrawn at once.` : `Nothing is sent to ${people} on it: ${links} it's withdrawn at once.`) + andWhatsApp + kept
}

/** "the day is" when nobody holds an invite for more than one, "their days are" otherwise. */
const cancelledDays = (held: readonly number[]) => (Math.max(0, ...held) > 1 ? 'their days are' : 'the day is')

/**
 * The same for a job being stopped, after "3 people offered or booked will see it's cancelled.": how many of them
 * Google emails. Nothing when it emails nobody, as the sentence before it has said who sees what.
 */
export function jobEndingWords(
  ctx: Pick<ReachContext, 'calendar' | 'today'>,
  on: readonly { personId: string; offerId?: string | undefined; email?: string | null | undefined; whatsapp?: boolean }[]
): string {
  const everyone = new Set(on.map((o) => o.personId)).size
  // One WhatsApp to each person it reaches, however many of the job's calls they're on (ADR 0154, whatsappFollows).
  const andWhatsApp = whatsappTells(new Set(on.filter((o) => o.whatsapp).map((o) => o.personId)).size, everyone, "it's off")
  // Their days across the job's calls: someone on two of them is one person, emailed for the days of both.
  const held = new Map<string, Set<string>>()
  for (const o of on) for (const d of o.offerId ? daysToCancel(ctx, o.offerId) : []) held.set(o.personId, (held.get(o.personId) ?? new Set<string>()).add(d))
  const emailed = held.size
  if (!emailed) return keptAmong(ctx, on.map((o) => o.offerId)) + andWhatsApp
  const who = emailed < everyone ? `${emailed} of them` : everyone === 1 ? 'them' : 'each of them'
  // Each cancellation says why, the job's being cancelled or not going ahead, where their invites tell them what happens next (ADR 0153).
  const why = on.every((o) => !held.has(o.personId) || toldNext(ctx, o)) ? ' and why' : ''
  return ` Google emails ${who} that ${cancelledDays([...held.values()].map((d) => d.size))} cancelled${why}${onceBack(ctx)}.${andWhatsApp}`
}

// ---- After a press: what was sent ----

/** One thing that happened to one person, said of everyone it's true of in one sentence. */
interface Said {
  /** People with the same key share a sentence. */
  key: string
  say: (who: string, many: boolean) => string
}

/** A person after a press: what's said of them, and whether the app got word to them at all. */
export interface ToldPerson {
  who: ToldWho
  said: Said[]
  /** False when nothing of the app's reached them, so the panel offers ringing them. */
  reached: boolean
}

/**
 * The sentences for everyone, each said once with the names it's true of, in the order they first come up. Someone on
 * two of a job's calls is named once.
 */
export function toldSentences(people: readonly ToldPerson[]): string[] {
  const order: Said[] = []
  const whoBy = new Map<string, ToldWho[]>()
  for (const p of people)
    for (const s of p.said) {
      if (!whoBy.has(s.key)) {
        whoBy.set(s.key, [])
        order.push(s)
      }
      const had = whoBy.get(s.key)!
      if (!had.some((w) => w.id === p.who.id)) had.push(p.who)
    }
  const everyone = [...new Map(people.map((p) => [p.who.id, p.who])).values()]
  return order.map((s) => {
    const who = whoBy.get(s.key)!
    return s.say(namesInWords(called(who, everyone)), who.length > 1)
  })
}

/** After Offer or Send (finding 5): who was emailed an invite, who it went to on WhatsApp, and who nothing reached and why. */
export function toldOfOffer(who: ToldWho, r: OfferReach): ToldPerson {
  const said: Said[] = []
  const whatsapp = r.whatsapp?.state
  const whatsappComing = whatsapp !== undefined && whatsapp !== 'failed'
  const why = r.plan.why
  if (r.earlierNo) said.push({ key: 'earlier-no', say: (who) => `${who} got no new invite: their No to an earlier offer still stands in Google Calendar.` })
  else if (r.invited.length) {
    const each = r.invited.length > 1
    said.push({ key: each ? 'emailed-each' : 'emailed', say: (who, many) => `${who} ${many ? 'were' : 'was'} emailed a calendar invite${each ? ' for each day' : ''}.` })
  } else if (r.byAnother.length) said.push({ key: 'another', say: (who, many) => `${who} already ${many ? 'have' : 'has'} the calendar invite, for another call on this job.` })
  else if (r.refused.length) said.push({ key: 'refused', say: (who) => `Google turned down the calendar invite to ${who}: check the address.` })
  else if (r.coming.length)
    said.push(
      r.held
        ? { key: 'held', say: (who) => `The calendar invite to ${who} hasn't gone: the calendar has a problem. See Admin › Connections.` }
        : { key: 'coming', say: (who) => `A calendar invite is on its way to ${who} by email.` }
    )
  else if (why === 'brought-in')
    said.push(
      whatsappComing
        ? { key: 'brought-in-invite', say: (who) => `No calendar invite went to ${who}: ${BROUGHT_IN}.` }
        : { key: 'brought-in', say: (who) => `Nothing was sent to ${who} from the app: ${BROUGHT_IN}.` }
    )
  else if (why === 'off' && r.noWhatsApp === 'off') said.push({ key: 'all-off', say: (who) => `Nothing was sent to ${who}: calendar invites and WhatsApp are both off.` })
  else if (!whatsappComing) {
    const because = nothingBecause(r)
    if (because) said.push({ key: `nothing:${because}`, say: (who) => `Nothing has reached ${who}: ${because}.` })
  } else if (why && NO_INVITE_SHORT[why]) said.push({ key: `no-invite:${why}`, say: (who) => `No calendar invite went to ${who}: ${NO_INVITE_SHORT[why]}.` })
  if (whatsapp === 'queued') said.push({ key: 'whatsapp-going', say: (who) => `The offer is going to ${who} on WhatsApp.` })
  else if (whatsapp === 'failed') said.push({ key: 'whatsapp-failed', say: (who) => `The WhatsApp to ${who} wasn't sent.` })
  else if (whatsapp) said.push({ key: 'whatsapp-went', say: (who) => `The offer went to ${who} on WhatsApp.` })
  // Nobody to ring for a call that's over, or a job this device can't read.
  return { who, said, reached: r.reached || r.onItsWay || why === 'past' || why === 'stopped' || why === 'unknown' }
}

/** What a device knew of one person's invites when the office pressed, for what the press then did to them. */
export interface ToldBefore {
  /** The days Google emails them a cancellation for (daysToCancel), read as the press was made. */
  cancel: number
  /** How many of those are still on the calendar now. */
  left: number
  /** They hold an invite for the offer and crew invites are on, so the server keeps it in step with the offer. */
  invited: boolean
  /** What a WhatsApp tells them after the press (ADR 0154, whatsappFollows), when one goes. */
  whatsapp?: WhatsAppNews | undefined
  /** Days they hold an invite for that stay in their calendar, invites having been switched off since. */
  kept?: number
}

/**
 * After Withdraw, Release, a cancelled call or a stopped job: whether Google told them, from the invites they held, and
 * the WhatsApp that tells them they're no longer needed, or that the job is off (ADR 0154).
 */
export function toldOfEnding(ctx: Pick<ReachContext, 'calendar'>, who: ToldWho, b: ToldBefore): ToldPerson {
  const said: Said[] = []
  const one = b.cancel === 1
  const days = one ? 'the day is' : 'their days are'
  if (!b.cancel && b.kept)
    said.push(
      b.whatsapp
        ? { key: `kept-whatsapp:${b.kept === 1}`, say: (who) => `Google sends ${who} no cancellation, as crew invites are off: the ${b.kept === 1 ? 'day stays' : 'days stay'} in their calendar.` }
        : { key: `kept:${b.kept === 1}`, say: (who) => `Nothing was sent to ${who}, and the ${b.kept === 1 ? 'day stays' : 'days stay'} in their calendar: crew invites are off, so Google sends no cancellation.` }
    )
  // Nothing from Google: a WhatsApp going is said on its own, below, and otherwise nothing was sent.
  else if (!b.cancel) {
    if (!b.whatsapp) said.push({ key: 'nothing', say: (who) => `Nothing was sent to ${who}.` })
  }
  // With their invites telling them what happens next, the cancellation says why (ADR 0153).
  else if (b.left === 0) {
    const why = andWhy(ctx, who)
    said.push({ key: `cancelled:${one}${why}`, say: (who) => `Google has emailed ${who} that ${days} cancelled${why}.` })
  } else if (ctx.calendar.link?.problem)
    said.push({ key: 'cancel-held', say: (who, many) => `${who} still ${many ? 'have' : 'has'} the days in their calendar: the calendar has a problem, so Google hasn't told them. See Admin › Connections.` })
  else {
    const why = andWhy(ctx, who)
    said.push({ key: `cancelling:${one}${why}`, say: (who) => `Google is emailing ${who} that ${days} cancelled${why}.` })
  }
  if (b.whatsapp) said.push(whatsappSaid(b.whatsapp))
  return { who, said, reached: b.cancel > 0 || !!b.whatsapp }
}

/** Invites switched off since someone was sent theirs: the server leaves their own copies alone, so they go out of date. */
const STALE = "Crew invites are off, so what's in their calendar stays as it was."

/**
 * After Confirm: unless their invites tell them what happens next, the app tells nobody they're booked (finding 4), so
 * the panel says so. Their invite's first line follows the booking only while the server is writing to the calendar.
 * With their invites telling them what happens next (ADR 0153), Google emails them the booking, their invite's title
 * then saying "Booked:". On a job the client hasn't said yes to yet (`hold`), what their link and their invite say is to
 * hold the day, never that they're booked (ADR 0150). `ending` is days they were still asked for that Confirm ended
 * (ADR 0152): their invites come off with word from Google, as the question said first, and `left` is how many are
 * still on the calendar.
 */
export function toldOfBooking(
  ctx: Pick<ReachContext, 'calendar'>,
  who: ToldWho,
  b: Pick<ToldBefore, 'invited' | 'kept' | 'whatsapp'>,
  hold = false,
  ending?: { gone: readonly string[]; left: number }
): ToldPerson {
  const what = hold ? "to hold the day, as the client hasn't said yes yet" : "they're booked"
  const gone = ending?.gone ?? []
  // A WhatsApp tells them they're booked (ADR 0154): never while they only hold the day, as the client's yes tells them then.
  const whatsapp = !hold && b.whatsapp === 'booked'
  const key = (k: string) => `${k}${hold ? ':hold' : ''}${gone.length ? ':else' : ''}`
  const links = (many: boolean) => `their ${many ? 'links say' : 'link says'} ${what}`
  const nothing = (who: string) => (gone.length ? `Nothing else went to ${who}` : `Nothing was sent to ${who}`)
  const cancelled = `${daysLabel([...gone])} ${gone.length === 1 ? 'is' : 'are'} cancelled`
  const ended: Said[] = !gone.length
    ? []
    : ending!.left === 0
      ? [{ key: `asked-cancelled:${cancelled}`, say: (who) => `Google has emailed ${who} that ${cancelled}.` }]
      : ctx.calendar.link?.problem
        ? [{ key: `asked-held:${cancelled}`, say: (who) => `${who} still ${gone.length === 1 ? 'has that day' : 'has those days'} in their calendar: the calendar has a problem, so Google hasn't told them. See Admin › Connections.` }]
        : [{ key: `asked-cancelling:${cancelled}`, say: (who) => `Google is emailing ${who} that ${cancelled}.` }]
  const telling = b.invited && !ctx.calendar.link?.problem && toldNext(ctx, who)
  const invitedQuietly = b.invited && !ctx.calendar.link?.problem
  const said: Said = telling
    ? {
        key: key('booked-told'),
        say: (who, many) => `Google is emailing ${who} ${hold ? "to hold the day, as the client hasn't said yes yet" : "that they're booked"}, and their ${many ? 'links say' : 'link says'} so.`,
      }
    : whatsapp
      ? invitedQuietly
        ? {
            key: key('booked-invited:whatsapp'),
            say: (who, many) => `${WHATSAPP_NEWS.booked} is going to ${who}. Their ${many ? 'links and calendar invites say' : 'link and calendar invite say'} so too, with no email from Google.`,
          }
        : { key: key(`booked${b.kept ? '-kept' : ''}:whatsapp`), say: (who, many) => `${WHATSAPP_NEWS.booked} is going to ${who}, and their ${many ? 'links say' : 'link says'} so.${b.kept ? ` ${STALE}` : ''}` }
      : invitedQuietly
        ? { key: key('booked-invited'), say: (who, many) => `${nothing(who)}: their ${many ? 'links and calendar invites' : 'link and their calendar invite'} say ${what}, and no email goes with that.` }
        : b.kept
          ? { key: key('booked-kept'), say: (who, many) => `${nothing(who)}: ${links(many)}. ${STALE}` }
          : { key: key('booked'), say: (who, many) => `${nothing(who)}: ${links(many)}.` }
  return { who, said: [...ended, said, ...(telling && whatsapp ? [whatsappSaid('booked')] : [])], reached: telling || whatsapp }
}

/**
 * Before Confirm (ADR 0153): that Google emails them they're booked, or to hold the day, where their invites tell them
 * what happens next; and that a WhatsApp tells them they're booked (`whatsapp`, ADR 0154), never while they only hold the
 * day. Nothing otherwise, as nothing is sent.
 */
export function bookingWords(ctx: Pick<ReachContext, 'calendar' | 'today'>, offerId: string, who: Partial<Pick<Person, 'email'>> | null | undefined, hold = false, whatsapp = false): string {
  const google = daysToCancel(ctx, offerId).length > 0 && toldNext(ctx, who)
  const onWhatsApp = whatsapp && !hold
  if (google && onWhatsApp) return `Google emails them that they're booked${onceBack(ctx)}, and a WhatsApp tells them too.`
  if (onWhatsApp) return "A WhatsApp tells them they're booked."
  if (!google) return ''
  return `Google emails them ${hold ? 'to hold the day' : "that they're booked"}${onceBack(ctx)}.`
}

/**
 * After the office said no to a rate (ADR 0152): the offer stands at the rate offered, which their link says, and their
 * invite's first line too, with no email, as a change of its description never sends one (ADR 0009).
 */
export function toldOfRefusal(ctx: Pick<ReachContext, 'calendar'>, who: ToldWho, b: Pick<ToldBefore, 'invited' | 'kept'>): ToldPerson {
  const said: Said =
    b.invited && !ctx.calendar.link?.problem
      ? { key: 'refused-invited', say: (who, many) => `Nothing was sent to ${who}: their ${many ? 'links and calendar invites' : 'link and their calendar invite'} say the offer stands at the rate offered, and no email goes with that.` }
      : b.kept
        ? { key: 'refused-kept', say: (who, many) => `Nothing was sent to ${who}: their ${many ? 'links say' : 'link says'} the offer stands at the rate offered. ${STALE}` }
        : { key: 'refused', say: (who, many) => `Nothing was sent to ${who}: their ${many ? 'links say' : 'link says'} the offer stands at the rate offered.` }
  return { who, said: [said], reached: false }
}

/**
 * Before Confirm on a yes with days not answered (ADR 0152): confirming books the days they said yes to and ends the ask
 * for the rest, whose invites come off with word from Google. Nothing when no invite of theirs goes.
 */
export function askEndingWords(ctx: Pick<ReachContext, 'calendar' | 'today'>, offerId: string, asked: readonly string[]): string {
  const gone = daysToCancel(ctx, offerId).filter((d) => asked.includes(d))
  return gone.length ? `Google emails them that ${daysLabel(gone)} ${gone.length === 1 ? 'is' : 'are'} cancelled${onceBack(ctx)}.` : ''
}

/**
 * After a call changed or a phase moved: Google emails only when the days themselves move, or, where their invites tell
 * them what happens next (ADR 0153), when their call time moves (`timeMoved`). A WhatsApp with the new call time goes
 * to whoever it reaches (`b.whatsapp`, ADR 0154).
 */
export function toldOfChange(ctx: Pick<ReachContext, 'calendar'>, who: ToldWho, b: Pick<ToldBefore, 'invited' | 'kept' | 'whatsapp'>, moved: boolean, timeMoved = false): ToldPerson {
  const whatsapp = timeMoved && b.whatsapp === 'call-time'
  const told = (t: ToldPerson): ToldPerson => (whatsapp ? { who, said: [...t.said, whatsappSaid('call-time')], reached: true } : t)
  if (b.invited && moved)
    return told(
      ctx.calendar.link?.problem
        ? { who, said: [{ key: 'moved-held', say: (names) => `Google emails ${names} about the days that changed once the calendar is working again.` }], reached: false }
        : { who, said: [{ key: 'moved', say: (names) => `Google is emailing ${names} about the days that changed.` }], reached: true }
    )
  if (b.invited && timeMoved && toldNext(ctx, who))
    return told(
      ctx.calendar.link?.problem
        ? { who, said: [{ key: 'time-held', say: (names) => `Google emails ${names} the new call time once the calendar is working again.` }], reached: false }
        : { who, said: [{ key: 'time', say: (names) => `Google is emailing ${names} the new call time.` }], reached: true }
    )
  // With a WhatsApp going, it's said first, and the rest is what their link and calendar do.
  if (whatsapp) {
    const rest = b.invited ? ' Google emails nothing for it, as the days stay the same.' : b.kept ? ` ${STALE}` : ''
    return { who, said: [{ key: `changed:whatsapp${b.invited ? ':invited' : b.kept ? ':kept' : ''}`, say: (who) => `${WHATSAPP_NEWS['call-time']} is going to ${who}, and the change is on their link.${rest}` }], reached: true }
  }
  const said: Said = b.invited
    ? toldNext(ctx, who)
      ? { key: 'changed-told', say: (who) => `Nothing was sent to ${who}: the change is on their link, and Google emails nothing unless the days or the call time move.` }
      : { key: 'changed-invited', say: (who) => `Nothing was sent to ${who}: the change is on their link, and Google emails nothing unless the days move.` }
    : b.kept
      ? { key: 'changed-kept', say: (who) => `Nothing was sent to ${who}: the change is on their link. ${STALE}` }
      : { key: 'changed', say: (who) => `Nothing was sent to ${who}: the change is on their link.` }
  return { who, said: [said], reached: false }
}
