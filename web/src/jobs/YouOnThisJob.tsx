import { bookingLine, HOLDING, OPEN, type CallView, type JobView, type OfferView, type View } from '@sh/shared'
import { useState } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
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
 * out, which is their own page. Staff answer an offer here, yes to every day
 * or no (ADR 0111); only some of the days, and pulling out, stay on their
 * page, as does every answer of a freelancer's (ADR 0051). Built from the
 * job's calls the device already holds, so it reads nothing the role isn't
 * sent. Nothing for anyone not on it.
 */
export function YouOnThisJob({ job, view }: { job: JobView; view: View }) {
  const { me } = useMe(view)
  const today = useToday()
  const access = useAccess()
  if (!me) return null
  const mine = job.calls.flatMap((c) => c.offers.filter((o) => o.personId === me.id && (HOLDING.includes(o.status) || OPEN.includes(o.status))).map((o) => ({ c, o })))
  if (mine.length === 0) return null
  const link = linkFor(me)
  const answers = access.can('answer')
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
              {offered && answers && <AnswerHere c={c} o={o} job={job.name} />}
              <p className="you-links">
                {phase && <a href={`#jobs/${encodeURIComponent(job.id)}/sheet/${encodeURIComponent(phase.id)}`}>Call sheet ›</a>}
                {link &&
                  (offered ? (
                    <a href={`${link}#o-${encodeURIComponent(o.id)}`} target="_blank" rel="noreferrer">
                      {answers ? 'Only some of the days? On your page ›' : 'Answer it on your page ›'}
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

/**
 * Yes or no to an offer, from the app (ADR 0111): the link's own answers, through the same command and the same checks,
 * with the server holding staff to their own. Yes is the card's one thing to do; no can't be taken back, so it asks first,
 * in the link's words.
 */
function AnswerHere({ c, o, job }: { c: CallView; o: OfferView; job: string }) {
  const [asking, setAsking] = useState(false)
  const { run, error } = useAct()
  const answer = (yes: boolean) =>
    void run(() => client.mutate('offer.respond', yes ? { id: o.id, answer: 'accept', days: null, note: '' } : { id: o.id, answer: 'decline', note: '' }))
  if (asking)
    return (
      <Confirm
        question={`Say no to ${c.role} on ${job}?`}
        yes="Say no"
        no="Keep the offer"
        loss
        onYes={() => {
          setAsking(false)
          answer(false)
        }}
        onNo={() => setAsking(false)}
      >
        It comes off your bookings, and only the office can offer it to you again.
      </Confirm>
    )
  return (
    <>
      <p className="you-answer">
        <button type="button" className="primary" onClick={() => answer(true)}>
          Yes, I can do it
        </button>
        <button type="button" onClick={() => setAsking(true)}>
          No, I can't
        </button>
      </p>
      <Refusal error={error} />
    </>
  )
}
