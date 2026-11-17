import { confirmingWords, jobEndingWords, jobOnHold, LIVE, STATUS_LABELS, STOPPED_WORDS, whatsappFollowsTell, type JobView, type Person, type ReachContext } from '@sh/shared'
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
