import { dayLabel } from './crew-days.ts'
import type { Pin } from './jobs.ts'
import { DUBLIN_CENTRE, kmBetween, ROAD_FACTOR } from './travel.ts'
import type { VehicleKind } from './vehicles.ts'

/**
 * A van out on the road (ADR 0179): how long the drive is from the warehouse
 * to the venue and back, and so when it leaves and when it's home, which is
 * how long it's away and can't be on another job.
 *
 * The drive comes from the map, worked out on the device so it works with no
 * signal: as the crow flies from the warehouse's pin to the venue's, a fifth
 * more for the roads (as a quote's travel is, ADR 0086), the first few km at
 * town speed and the rest at what a vehicle of its kind keeps up on Irish
 * roads with a load on. It's an estimate and says so; a drive typed on the
 * booking is the office's own and always wins.
 */

/** The steady speed on the open road, in km/h, with a load on and stops left out. A truck and a towed trailer are limited to less. */
export const OPEN_ROAD_KMH: Record<VehicleKind, number> = { car: 95, van: 90, luton: 85, truck: 75, trailer: 75 }
/** Getting out of town and into the venue: the first few km at town speed. */
export const TOWN_KM = 10
export const TOWN_KMH = 30
/** A drive is said to the next five minutes, longer rather than shorter, since a van early is better than a van late. */
const STEP = 5
/** Longer than a day each way is a typing slip: nothing in Ireland or Britain is that far by road. */
export const MAX_DRIVE_MINUTES = 24 * 60

/** About how far by road between two pins, in whole km. */
export const roadKm = (from: Pin, to: Pin) => Math.round(kmBetween(from, to) * ROAD_FACTOR)

/** About how long a drive of so many road km takes a vehicle of this kind, in minutes, to the next five. */
export function driveMinutesFor(km: number, kind: VehicleKind): number {
  const town = Math.min(km, TOWN_KM)
  const open = Math.max(0, km - TOWN_KM)
  const minutes = (town / TOWN_KMH) * 60 + (open / OPEN_ROAD_KMH[kind]) * 60
  return Math.max(STEP, Math.ceil(minutes / STEP) * STEP)
}

/** "2 h 45", "40 min", "3 h": a drive as the office says it. */
export function driveWords(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** Where the vans leave from: the warehouse's pin, or Dublin city centre until it's on the map. */
export function warehouseFrom(pin: Pin | null | undefined): { pin: Pin; set: boolean } {
  return pin ? { pin, set: true } : { pin: DUBLIN_CENTRE, set: false }
}

/** A time of day and the day it falls on. */
export interface DayTime {
  day: string
  time: string
}

export interface Road {
  /** The drive each way in minutes, or null with no venue on the map and none typed. */
  minutes: number | null
  /** The road km each way, from the map; null when the drive was typed or nothing's on the map. */
  km: number | null
  /** Typed on the booking, worked out from the map, or not known. */
  source: 'typed' | 'map' | null
  /** When it's due at the venue on the first day: typed on the booking, the crew's call, or null when neither is said. */
  arriveBy: string | null
  arriveFrom: 'typed' | 'crew' | null
  /** When it leaves the venue on the last day, as typed; null when not said. */
  leaveAt: string | null
  /** When it leaves the warehouse and when it's back, once the times and the drive are known. */
  leaves: DayTime | null
  back: DayTime | null
  /** The days it's away: the booking's, and the day before or after when it leaves before midnight or gets back after. */
  start: string
  end: string
}

/** The day so many days after another, which may be negative. */
const plusDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** A time of day so many minutes after midnight on a day, which can run into the days either side. */
function at(day: string, minutes: number): DayTime {
  const days = Math.floor(minutes / 1440)
  const m = minutes - days * 1440
  return { day: plusDays(day, days), time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
}

/**
 * The road a booking takes: the drive each way, and, once there's a time to
 * work from, when it leaves the warehouse (the drive before it's due at the
 * venue on its first day) and when it's back (the drive after it leaves the
 * venue on its last). With no time it's away on the booking's days, as
 * before. The crew's call is the time it's due when the booking says none:
 * the kit is there when they are.
 */
export function roadFor(
  b: { start: string; end: string; driveMinutes?: number | null; arriveBy?: string | null; leaveAt?: string | null },
  opts: { from: Pin; to: Pin | null | undefined; kind: VehicleKind; crewCall?: string | null }
): Road {
  const typed = b.driveMinutes ?? null
  const km = typed === null && opts.to ? roadKm(opts.from, opts.to) : null
  const minutes = typed ?? (km === null ? null : driveMinutesFor(km, opts.kind))
  const arriveBy = b.arriveBy ?? opts.crewCall ?? null
  const arriveFrom = b.arriveBy ? 'typed' : opts.crewCall ? 'crew' : null
  const leaveAt = b.leaveAt ?? null
  const leaves = minutes !== null && arriveBy ? at(b.start, toMinutes(arriveBy) - minutes) : null
  const back = minutes !== null && leaveAt ? at(b.end, toMinutes(leaveAt) + minutes) : null
  return {
    minutes,
    km,
    source: typed !== null ? 'typed' : km !== null ? 'map' : null,
    arriveBy,
    arriveFrom,
    leaveAt,
    leaves,
    back,
    start: leaves && leaves.day < b.start ? leaves.day : b.start,
    end: back && back.day > b.end ? back.day : b.end,
  }
}

/**
 * The earliest call time of a job's crew on a day, for the van's arrival when
 * the booking says none: the calls still wanted, for the booking's phase or
 * the whole job, that cover the day.
 */
export function earliestCall(
  calls: readonly { projectId: string | null; phaseId: string | null; start: string; end: string; callTime: string | null; status: string }[],
  jobId: string,
  phaseId: string | null,
  day: string
): string | null {
  let first: string | null = null
  for (const c of calls) {
    if (c.projectId !== jobId || c.status === 'cancelled' || !c.callTime || c.start > day || c.end < day) continue
    if (phaseId && c.phaseId && c.phaseId !== phaseId) continue
    if (first === null || c.callTime < first) first = c.callTime
  }
  return first
}

/** "about 2 h 45 each way (230 km)", "2 h 45 each way, as typed": the drive in a line. */
export function driveLine(r: Pick<Road, 'minutes' | 'km' | 'source'>): string {
  if (r.minutes === null) return ''
  return r.source === 'typed' ? `${driveWords(r.minutes)} each way, as typed` : `about ${driveWords(r.minutes)} each way (${r.km} km)`
}

/**
 * The road in words, for a booking's line (ADR 0179): "Leaves the warehouse about 05:10 Fri 14 Nov · back about 01:40
 * Sun 16 Nov · about 2 h 50 each way (230 km)". What isn't known yet is left out, and a booking with no drive at all
 * says why, so the office knows what would tell it.
 */
export function roadWords(r: Road): string[] {
  if (r.minutes === null) return ['Drive not known: the venue isn’t on the map. Put it there, or type the drive.']
  const out: string[] = []
  if (r.leaves) out.push(`Leaves the warehouse about ${r.leaves.time} ${dayLabel(r.leaves.day)}${r.arriveFrom === 'crew' ? ', for the crew’s call' : ''}`)
  if (r.back) out.push(`back about ${r.back.time} ${dayLabel(r.back.day)}`)
  out.push(driveLine(r))
  return out
}
