import { bookingLine, HOLDING, OPEN, type JobView, type View } from '@sh/shared'
import { useMe } from '../crew/Leave.tsx'
import { linkFor } from '../crew/Messages.tsx'
import { Heading } from '../Icon.tsx'
import { useToday } from '../view.ts'

/**
 * "You on this job" (Move 9 of the sweep of 6 November 2026): for anyone
 * with a booking or an offer on the job, staff, a freelancer signed in (ADR
 * 0051) or a head booked as crew, what they're on, first, in the words their
 * own page and Home › Me use: the role, phase, days and call, the venue
 * with its map, the call's details, the call sheet, and the way to pull
 * out, which is their own page (ADR 0034: answering stays there until Colly
 * says otherwise). Built from the job's calls the device already holds, so
 * it reads nothing the role isn't sent. Nothing for anyone not on it.
 */
export function YouOnThisJob({ job, view }: { job: JobView; view: View }) {
  const { me } = useMe(view)
  const today = useToday()
  if (!me) return null
  const mine = job.calls.flatMap((c) => c.offers.filter((o) => o.personId === me.id && (HOLDING.includes(o.status) || OPEN.includes(o.status))).map((o) => ({ c, o })))
  if (mine.length === 0) return null
  const link = linkFor(me)
  return (
    <section className="card you-on-job" aria-label="You on this job">
      <Heading icon="person">You on this job</Heading>
      <ul>
        {mine.map(({ c, o }) => {
          const phase = c.phaseId ? job.phases.find((p) => p.id === c.phaseId) : undefined
          const venue = phase?.venue ?? job.venue
          const offered = OPEN.includes(o.status)
          return (
            <li key={o.id}>
              <p>
                <b>{bookingLine(o, c, today)}</b>
                {venue && (
                  <>
                    {' · '}
                    {venue.name}
                  </>
                )}
              </p>
              {c.details && <p className="hint">{c.details}</p>}
              <p className="you-links">
                {phase && <a href={`#jobs/${encodeURIComponent(job.id)}/sheet/${encodeURIComponent(phase.id)}`}>Call sheet ›</a>}
                {link &&
                  (offered ? (
                    <a href={`${link}#o-${encodeURIComponent(o.id)}`} target="_blank" rel="noreferrer">
                      Answer it on your page ›
                    </a>
                  ) : (
                    <a href={`${link}#o-${encodeURIComponent(o.id)}`} target="_blank" rel="noreferrer">
                      Can't make it any more? ›
                    </a>
                  ))}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
