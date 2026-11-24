import { driveFacts, driveTitle, FACT_GAP, type Drive } from '@sh/shared'
import { StatusPill } from '../StatusPill.tsx'

/**
 * What someone is down to drive, a row each (user flows of 24 November 2026, gap 5): the van, the job, its days and when
 * it leaves the warehouse and is back, opening the job's Transport tab. Under Your bookings on Home › Me, on their page
 * in Crew and on their link, in the same words; a driver with no crew call on the job had only a bell to go on.
 */
export function DriveRows({ drives, today, label = 'Driving' }: { drives: readonly Drive[]; today: string; label?: string }) {
  if (drives.length === 0) return null
  return (
    <ul className="job-list drive-rows" aria-label={label}>
      {drives.map((d) => (
        <li key={d.id}>
          <a className="job-row booking-row" href={`#jobs/${encodeURIComponent(d.jobId)}/vans`}>
            <b>{driveTitle(d)}</b>
            <p>{driveFacts({ ...d, pencilled: false }, today).join(FACT_GAP)}</p>
            {d.pencilled && <StatusPill tone="pending">Pencilled in</StatusPill>}
          </a>
        </li>
      ))}
    </ul>
  )
}
