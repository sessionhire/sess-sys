import { deliveredTo, earliestCall, roadFor, roadTimes, STOPPED, jobOnHold, vehicleName, warehouseFrom, type Drive, type Road, type VehicleBooking } from '@sh/shared'
import type { Queryable } from '../db.ts'
import { openCallsFor } from '../crew/store.ts'
import { getPhase, getProject, getVenue } from '../projects/store.ts'
import { getTrackerSettings } from '../trackers/store.ts'
import { getVehicle, toBooking } from './store.ts'

/**
 * The road a booking takes, worked out on the server as devices work it out (shared/src/sync/vehicles-view.ts): for the
 * pages drawn here, which a driver and the crew read without the app (user flows of 24 November 2026, gap 5). The drive
 * is to the phase's venue or the job's, or the address a delivered dry hire goes to, and it's due there when the booking
 * says, else at the crew's earliest call, else at the hire's own time.
 */
export async function roadOf(q: Queryable, b: VehicleBooking): Promise<Road> {
  const [job, phase, vehicle, settings, calls, span] = await Promise.all([
    getProject(q, b.projectId),
    b.phaseId ? getPhase(q, b.phaseId) : undefined,
    getVehicle(q, b.vehicleId),
    getTrackerSettings(q),
    openCallsFor(q, { projectId: b.projectId }),
    q.query<{ first: string | null; last: string | null }>('SELECT min(start_day)::text AS first, max(end_day)::text AS last FROM phases WHERE project_id = $1', [b.projectId]),
  ])
  const venueId = phase?.venueId ?? job?.venueId ?? null
  const venue = venueId ? await getVenue(q, venueId) : undefined
  const delivered = job && deliveredTo(job)
  const { first, last } = span.rows[0] ?? { first: null, last: null }
  return roadFor(b, {
    from: warehouseFrom(settings.home).pin,
    to: venue?.pin ?? (delivered ? delivered.pin : undefined),
    place: !venue && delivered ? 'address' : 'venue',
    kind: vehicle?.kind ?? 'van',
    crewCall: earliestCall(calls, b.projectId, b.phaseId, b.start),
    hireDue: delivered ? (b.start === first ? (delivered.outTime ?? null) : b.start === last ? (delivered.backTime ?? null) : null) : null,
  })
}

/**
 * What someone is down to drive from today on, soonest first, on jobs going ahead or pencilled in: a drive is theirs
 * whether or not they have a crew call on the job, as every dry hire delivery and most errands are a van and a driver
 * and nothing else.
 */
export async function drivesFor(q: Queryable, personId: string, today: string): Promise<Drive[]> {
  const { rows } = await q.query(
    `SELECT b.id, b.vehicle_id, b.project_id, b.phase_id, b.start_day::text, b.end_day::text, b.driver_id, b.notes, b.override, b.drive_minutes, b.arrive_by, b.leave_at,
            v.name AS vehicle_name, v.registration, p.name AS job, p.status
       FROM vehicle_bookings b JOIN vehicles v ON v.id = b.vehicle_id JOIN projects p ON p.id = b.project_id
      WHERE b.driver_id = $1 AND b.end_day >= $2::date - 1 AND p.status <> ALL($3::text[])
      ORDER BY b.start_day, b.end_day, b.id`,
    [personId, today, STOPPED]
  )
  const out: Drive[] = []
  for (const r of rows as Record<string, any>[]) {
    const b = toBooking(r)
    const road = await roadOf(q, b)
    // Still theirs while it's away: back after midnight is the day after its last.
    if (road.end < today) continue
    out.push({
      id: b.id,
      vehicle: vehicleName({ name: r.vehicle_name, registration: r.registration }),
      job: r.job,
      jobId: b.projectId,
      start: b.start,
      end: b.end,
      awayFrom: road.start,
      awayTo: road.end,
      times: roadTimes(road, b),
      pencilled: jobOnHold(r.status),
    })
  }
  return out
}
