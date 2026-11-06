import { bookingLine, OPEN, type BookingOf, type CallView, type OfferView } from '@sh/shared'
import { StatusPill } from '../StatusPill.tsx'
import { STATUS } from './Calls.tsx'

/** A booking or an offer of someone's as the app's lists hold one, read by the order every surface lists them in. */
export const asBooking: BookingOf<{ c: CallView; o: OfferView }> = ({ o, c }) => [o, c]

/**
 * One booking or offer of someone's, drawn one way on Home › Me, on their page in the app and, folded, on their link
 * (UX sweep, 6 November 2026, move 6): the job, then role · phase · days · call, then where it stands. Read in that order;
 * drawn with where it stands at the end of the job's line, so the facts have the row's width (app.css). A booking opens
 * `href`. An offer waiting on them opens their own page, `link`, where it's answered (ADR 0034), and says so under the
 * facts; without it, an offer opens `href` like a booking.
 */
export function BookingRow({ c, o, today, href, link }: { c: CallView; o: OfferView; today: string; href?: string; link?: string }) {
  const [label, tone] = STATUS[o.status]
  const answer = link && OPEN.includes(o.status) ? `${link}#offers` : undefined
  const inner = (
    <>
      <b>{c.project}</b>
      <p>{bookingLine(o, c, today)}</p>
      <StatusPill tone={tone} pending={o.pending}>
        {label}
      </StatusPill>
      {answer && <small className="answer">Answer it on your page ›</small>}
    </>
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
