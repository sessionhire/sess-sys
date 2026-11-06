import type { KitToCheck } from '@sh/shared'

/**
 * A job with kit to check back in (ADR 0109), as Home › Warehouse and
 * Stock's Pick lists both list it: what isn't back, and how long since the
 * job ended. Past the job's days to come back and two more it's late, said
 * in words and in amber, the system's "needs a look" (healthy is quiet).
 * Kit out opens the pick list, which opens on what's coming back; kit never
 * scanned out opens the job's Back in task, to check and tick off.
 */
export function StillOutRow({ k }: { k: KitToCheck }) {
  const id = encodeURIComponent(k.job.id)
  return (
    <li>
      <a className="job-row" href={k.neverScanned ? `#jobs/${id}/task/back` : `#jobs/${id}/pick`}>
        <div>
          <b>{k.job.name}</b>
          <p>
            {k.said} · {k.when}
          </p>
        </div>
        {k.late && (
          <div className="side">
            <small className="flag warn">Late</small>
          </div>
        )}
      </a>
    </li>
  )
}
