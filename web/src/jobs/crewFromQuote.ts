import { callsFromQuote, departmentForRole, newId, suggestedReplyBy, venueLabel, type CallToMake, type JobView, type View } from '@sh/shared'
import { client } from '../sync.ts'

/**
 * The crew on a job's quote not asked for yet (ADR 0126): each a call to make, in one press. The job's own quote, the newest
 * version, says what's wanted.
 */
export function crewToCall(view: View, job: JobView): CallToMake[] {
  const quote = view.money.quotesOf(job.id)[0]
  return quote ? callsFromQuote(quote.lines, job.calls) : []
}

/**
 * Makes them: for the one phase when the job has one, else across the job's days, with nobody offered yet and the reply-by
 * day suggested. The same from the Crew card and from the job's Next button (ADR 0140), so the button does what it says.
 */
export async function makeCallsFromQuote(view: View, job: JobView, today: string): Promise<void> {
  const span = job.span
  if (!span) return
  const only = job.phases.length === 1 ? job.phases[0] : undefined
  const across = job.phases.map((p) => p.name).join(', ')
  const venue = only?.venue ?? job.venue
  for (const c of crewToCall(view, job))
    await client.mutate('call.create', {
      id: newId(),
      projectId: job.id,
      phaseId: only?.id ?? null,
      project: job.name,
      phase: only?.name ?? across.slice(0, 100),
      venue: venue ? venueLabel(venue) : '',
      role: c.role.slice(0, 100),
      start: only?.start ?? span.start,
      end: only?.end ?? span.end,
      callTime: null,
      needed: c.needed,
      dayRateCents: null,
      details: '',
      replyBy: suggestedReplyBy(only?.start ?? span.start, only?.end ?? span.end, today) ?? null,
      department: departmentForRole(c.role, { calls: view.crew.calls, people: view.crew.people }),
    })
}
