import {
  confirmingWords,
  crewAsked,
  jobEndingWords,
  jobOnHold,
  LIVE,
  phaseOnCalendar,
  STATUS_LABELS,
  STOPPED_WORDS,
  whatsappFollowsTell,
  type JobView,
  type Person,
  type ReachContext,
  type StopFacts,
  type StopStatus,
  type View,
} from '@sh/shared'
import { peopleOn, tellTo, type TellTo } from '../crew/Messages.tsx'

/**
 * What a change of a job's status sends its crew, asked first and said after, wherever it's pressed: Change details, the
 * Confirmed task, Next, the quote's What happened and the lists of quotes to follow up (ADR 0149, ADR 0168).
 */

/** Everyone offered or booked on the job's open calls: told it's off once it's stopped. */
export const crewOnJob = (job: Pick<JobView, 'calls'>): TellTo[] => job.calls.filter((c) => c.status === 'open').flatMap((c) => peopleOn(c))

/**
 * Everyone asked to hold the day for a job the client hasn't said yes to yet (ADR 0150): offered, asking a rate, said yes or
 * picked, on its open calls that aren't over. Confirming the job tells them it's going ahead, and books those picked (ADR 0168).
 * Nobody once it's confirmed or stopped.
 */
export function holdingTheDay(job: Pick<JobView, 'status' | 'calls'>, today: string): TellTo[] {
  if (!jobOnHold(job.status)) return []
  return job.calls
    .filter((c) => c.status === 'open' && c.end >= today)
    .flatMap((c) =>
      c.offers
        .filter((o) => o.person && LIVE.includes(o.status))
        .map((o) => {
          const t = tellTo(o.person as Person, c, o)
          return { ...t, context: { ...t.context, picked: o.status === 'confirmed' } }
        })
    )
}

/**
 * Before Confirm on a job its crew were asked to hold the day for (ADR 0168): "Confirm Harbour Lights? The 3 people asked to
 * hold the day will see it's going ahead: Google emails each of them that HOLD is off their days, and a WhatsApp tells them
 * so." Nothing to ask when nobody was asked, as nothing goes to anyone.
 */
export function confirmQuestion(reach: ReachContext, job: Pick<JobView, 'name'>, people: readonly TellTo[]): string | undefined {
  const words = confirmingWords(
    reach,
    people.map((t) => ({ personId: t.person.id, offerId: t.context.offerId, picked: t.context.picked === true, whatsapp: whatsappFollowsTell(reach, t) }))
  )
  return words && `Confirm ${job.name}? ${words}`
}

/**
 * Before a job with crew calls open is marked cancelled or lost (ADR 0149): who sees what, in their link's own words (UX sweep,
 * 6 November 2026, move 6), and what Google emails them. Someone on two of its calls is one person.
 */
export function stopQuestion(reach: ReachContext, job: Pick<JobView, 'name'>, status: 'cancelled' | 'lost', people: readonly TellTo[]): string {
  const n = new Set(people.map((t) => t.person.id)).size
  const theySee = status === 'lost' ? STOPPED_WORDS.lost : STOPPED_WORDS.cancelled
  const ending = jobEndingWords(
    reach,
    people.map((t) => ({ personId: t.person.id, offerId: t.context.offerId, email: t.person.email, whatsapp: whatsappFollowsTell(reach, t) }))
  )
  return `Marking ${job.name} ${STATUS_LABELS[status].toLowerCase()} also cancels its crew calls${n ? `: ${n === 1 ? '1 person' : `${n} people`} offered or booked will see ${theySee}` : ''}.${ending}`
}

/**
 * What's true of a job that stopping it changes, for the cancel form to say before the press (shared/src/stop-job.ts): read
 * off this device's own view, by the rules each screen already goes by, so the form and the screens can't disagree.
 *
 * - Its crew: the calls still open, and everyone offered or booked on them, with what Google and WhatsApp send them.
 * - Its kit for days not yet over, held or pencilled in as its Kit tab has it: how many are our own; how many more are
 *   hired in, whose supplier the app tells nothing; and how many are out with it now, which stay out until they're
 *   checked back.
 * - The vehicles booked for it that aren't back yet.
 * - Its days from today on the jobs calendar, which the server takes off; or the calendar it was brought in from, whose
 *   days the app never changes (ADR 0011).
 * - Its quote that counts, once the client has one: set aside while the job is stopped, unless it's invoiced.
 */
export function stopFacts(view: Pick<View, 'kit' | 'moves' | 'vehicles' | 'calendar' | 'money'>, reach: ReachContext, job: JobView, status: StopStatus, people: readonly TellTo[], today: string): StopFacts {
  const facts: StopFacts = {
    status,
    calls: job.calls.filter((c) => c.status === 'open').length,
    people: [...new Map(people.map((t) => [t.person.id, t.person.name])).values()],
    // "And why" is left unsaid: the form has just said what they'll see, and its own Why box is the office's alone.
    sends: jobEndingWords(
      reach,
      people.map((t) => ({ personId: t.person.id, offerId: t.context.offerId, email: t.person.email, whatsapp: whatsappFollowsTell(reach, t) })),
      { why: false }
    ),
  }

  const lines = (view.kit.byJob.get(job.id) ?? []).filter((l) => l.hold !== 'none' && l.held && l.held.end >= today)
  const out = view.moves.pickList(job.id)?.stillOut ?? 0
  if (lines.length || out) {
    // What isn't from our own stock is hired in: a line's subhire from its supplier, or dry hire stock from the product's (ADR 0075).
    const hiredIn = lines.filter((l) => l.qty > l.own)
    facts.kit = {
      own: lines.reduce((n, l) => n + l.own, 0),
      held: lines.some((l) => l.hold === 'held'),
      out,
      hiredIn: hiredIn.reduce((n, l) => n + l.qty - l.own, 0),
      suppliers: [...new Set(hiredIn.map((l) => (l.model?.dryHire ? (l.model.supplier ?? '') : l.supplier).trim()).filter(Boolean))],
    }
  }

  const bookings = view.vehicles.ofJob(job.id).filter((b) => b.hold !== 'none' && b.vehicle && b.road.end >= today)
  if (bookings.length) facts.vehicles = { names: [...new Set(bookings.map((b) => b.vehicle!.name))], held: bookings.some((b) => b.hold === 'held') }

  if (job.sourceCalendar) {
    if (job.span && job.span.end >= today) facts.calendar = { theirs: job.sourceCalendar }
  } else {
    const asked = crewAsked(job.calls)
    const on = job.phases.map((p) => phaseOnCalendar(job, p, view.calendar.link, view.calendar.days, today, asked)).flatMap((o) => (o.state === 'on' || o.state === 'going' ? [o] : []))
    if (on.length) facts.calendar = { on: on[0]!.calendar, days: on.reduce((n, o) => n + o.days, 0) }
  }

  const quote = view.money.currentOf(job.id)
  if (quote && (quote.status === 'sent' || quote.status === 'accepted')) facts.quote = quote.invoicedOn ? 'invoiced' : 'sent'

  return facts
}
