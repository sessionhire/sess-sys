import { bookingLine, OPEN, STOPPED, type BookingOf, type CallView, type OfferView, type ProjectStatus, type View } from '@sh/shared'
import { StatusPill } from '../StatusPill.tsx'
import { STATUS } from './Calls.tsx'

/** A job that was stopped, said with the booking's own word on a row (UX sweep, 6 November 2026, move 6): their link says it as the card's first line. */
const STOPPED_JOB: Partial<Record<ProjectStatus, string>> = { cancelled: 'Job cancelled', lost: 'Job lost' }

/** A booking or an offer of someone's as the app's lists hold one, read by the order every surface lists them in. */
export const asBooking: BookingOf<{ c: CallView; o: OfferView }> = ({ o, c }) => [o, c]

/**
 * Someone's bookings on a job that was stopped, cancelled or lost, while their days are still to come (UX sweep, 6
 * November 2026, move 6), for Home › Me and their page to list in their place, the job's word with the booking's, as
 * their link says it as the card's first line. One they never answered was only an offer, so it isn't one of them.
 */
export function stoppedBookings(view: View, personId: string, today: string): { c: CallView; o: OfferView; job: ProjectStatus }[] {
  const stopped = new Map(view.jobs.jobs.filter((j) => STOPPED.includes(j.status)).map((j) => [j.id, j.status]))
  return view.crew.calls.flatMap((c) => {
    const job = c.projectId ? stopped.get(c.projectId) : undefined
    return job && c.status === 'cancelled' && c.end >= today
      ? c.offers.filter((o) => o.personId === personId && o.status === 'cancelled' && o.respondedAt !== null).map((o) => ({ c, o, job }))
      : []
  })
}

/**
 * One booking or offer of someone's, drawn one way on Home › Me, on their page in the app and, folded, on their link
 * (UX sweep, 6 November 2026, move 6): the job, then role · phase · days · call, then where it stands. Read in that order;
 * drawn with where it stands at the end of the job's line, so the facts have the row's width (app.css). A booking opens
 * `href`. An offer waiting on them opens their own page, `link`, where it's answered (ADR 0034), and says so under the
 * facts; without it, an offer opens `href` like a booking. Someone who answers in the app (ADR 0111) is given `answerAt`, the
 * job's page, whose "You on this job" answers it, and the row opens that instead. One on a job that was stopped says so
 * beside its word, `job`, and under it on a phone.
 */
export function BookingRow({ c, o, today, href, link, answerAt, job }: { c: CallView; o: OfferView; today: string; href?: string; link?: string; answerAt?: string; job?: ProjectStatus }) {
  const [label, tone] = STATUS[o.status]
  const waiting = OPEN.includes(o.status)
  const here = waiting && answerAt ? answerAt : undefined
  const answer = !here && link && waiting ? `${link}#offers` : undefined
  const pill = (
    <StatusPill tone={tone} pending={o.pending}>
      {label}
    </StatusPill>
  )
  const stopped = job && STOPPED_JOB[job]
  const inner = (
    <>
      <b>{c.project}</b>
      <p>{bookingLine(o, c, today)}</p>
      {stopped ? (
        <span className="booking-state">
          {pill}
          <small>{stopped}</small>
        </span>
      ) : (
        pill
      )}
      {answer && <small className="answer">Answer it on your page ›</small>}
      {here && <small className="answer">Answer it ›</small>}
    </>
  )
  if (here)
    return (
      <a className="job-row booking-row" href={here}>
        {inner}
      </a>
    )
  if (answer)
    return (
      <a className="job-row booking-row" href={answer} target="_blank" rel="noreferrer">
        {inner}
      </a>
    )
  return href ? (
    <a className="job-row booking-row" href={href}>
      {inner}
    </a>
  ) : (
    <div className="job-row booking-row">{inner}</div>
  )
}
