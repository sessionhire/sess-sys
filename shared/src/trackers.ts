import { z } from 'zod'
import { dayLabel } from './crew-days.ts'
import { pin, type Pin } from './jobs.ts'
import { text } from './plain.ts'
import { kmBetween } from './travel.ts'

/**
 * Trackers on expensive kit (ADR 0107): small cellular trackers, Digital
 * Matter's to begin with, fixed inside a case or behind a rack panel, that
 * send where they are to the server themselves. The server keeps each one
 * as a record, puts it on an item from the stock list, and at every report
 * compares where it is with where the app says it should be: in the
 * warehouse, or at a job's venue or on the road while the job holds it.
 * Kit away from the warehouse and on no job, or still out after its job,
 * is put in front of whoever looks after stock.
 *
 * Off until the office turns it on under Admin, like the other connections:
 * while off, the server takes no reports and the app shows no trackers.
 * Nothing here contacts anyone outside the app.
 */

/** The makers whose reports the server can read. Only Digital Matter's for now. */
export const TRACKER_MAKERS = ['digital-matter'] as const
export type TrackerMaker = (typeof TRACKER_MAKERS)[number]
export const TRACKER_MAKER_LABELS: Record<TrackerMaker, string> = { 'digital-matter': 'Digital Matter' }

/** How near the warehouse or a venue counts as there, unless the office says otherwise: a yard and a car park. */
export const DEFAULT_TRACKER_RADIUS_M = 300
export const MIN_TRACKER_RADIUS_M = 50
export const MAX_TRACKER_RADIUS_M = 5000
/**
 * A tracker not heard from in this many days is worth a look: one sending a
 * report a day has missed two, so its battery may be flat, or it is
 * somewhere with no signal, or someone has found it.
 */
export const TRACKER_QUIET_DAYS = 3
export const TRACKER_NAME_LENGTH = 100

/** Where a tracker last said it was. */
export interface TrackerPosition extends Pin {
  /** How far out the fix may be, in metres, when the tracker said. */
  accuracyM: number | null
  /** When the fix was taken, by the tracker's clock (UTC). */
  at: string
}

/**
 * Where a tracker is, against where the app says its item should be, as
 * the server read it at the tracker's last report (`placeOf`).
 *
 * - **home**: at the warehouse.
 * - **venue**: at the venue of a job it's out with or held for.
 * - **withJob**: away, while a job it's out with or held for has it: on
 *   the road, at a dry hire, or at a venue not on the map.
 * - **away**: away from the warehouse, and on no job. To check.
 * - **notBack**: scanned out with a job whose days are over, and not back
 *   at the warehouse. To check.
 * - **unknown**: can't be said: no fix yet, no warehouse on the map, or
 *   not on an item.
 */
export type TrackerPlace =
  | { kind: 'home' }
  | { kind: 'venue'; jobId: string; job: string; venue: string }
  | { kind: 'withJob'; jobId: string; job: string }
  | { kind: 'away'; km: number }
  | { kind: 'notBack'; jobId: string; job: string; ended: string; km: number }
  | { kind: 'unknown'; why: 'noFix' | 'noHome' | 'noItem' }

export type TrackerPlaceKind = TrackerPlace['kind']
/** The places that put a tracker in front of someone. */
export const TRACKER_ALERTS: readonly TrackerPlaceKind[] = ['away', 'notBack']

/** A tracker, as devices keep it. */
export interface Tracker {
  /** The maker and its serial number together, as "digital-matter:416581", so the same tracker is always the same record. */
  id: string
  maker: TrackerMaker
  /** The serial number printed on it, which its reports carry. */
  serial: string
  /** What the office calls it, or empty: "Desk case tracker". */
  name: string
  /** The item it's on, or null while it's on nothing. */
  assetId: string | null
  /** When the server first heard from it. */
  firstHeard: string
  /** When the server last heard from it, with a fix or without. */
  lastHeard: string
  /** Where it last said it was; null until it has a fix. */
  position: TrackerPosition | null
  /** Its battery at the last report, in millivolts, when it said. */
  batteryMv: number | null
  /** Where it is against where it should be, at the last report or change. */
  place: TrackerPlace
  /** Since when it's been in that kind of place, for "away since Tuesday". */
  placeSince: string
  /** Put away by the office (broken, or kept in a drawer): out of every list but Admin's, and never to check. */
  archived: boolean
}

/** The warehouse on the map and how near counts as there: one record, id "trackers". */
export interface TrackerSettings {
  id: typeof TRACKER_SETTINGS_ID
  /** Whether the company uses trackers. Off until the office says. */
  on: boolean
  /** The warehouse, where kit on no job belongs; null until it's on the map. */
  home: Pin | null
  /** How near the warehouse or a venue counts as there, in metres. */
  radiusM: number
}
export const TRACKER_SETTINGS_ID = 'trackers'

export interface TrackerEntities {
  tracker: Tracker
  trackerSettings: TrackerSettings
}
export const TRACKER_ENTITY_NAMES = ['tracker', 'trackerSettings'] as const

/** The settings before anyone has changed them. */
export const TRACKERS_OFF: TrackerSettings = { id: TRACKER_SETTINGS_ID, on: false, home: null, radiusM: DEFAULT_TRACKER_RADIUS_M }

const id = z.string().min(1).max(200)

export const trackerCommandSchemas = {
  /** Whether the company uses trackers (ADR 0107). The office's to decide, under Admin. */
  'trackers.use': z.object({ on: z.boolean() }),
  /** Where the warehouse is, and how near counts as there. */
  'trackers.home': z.object({
    home: pin.nullable(),
    radiusM: z
      .number()
      .int('Say how near in whole metres.')
      .min(MIN_TRACKER_RADIUS_M, `How near can be ${MIN_TRACKER_RADIUS_M} metres at least.`)
      .max(MAX_TRACKER_RADIUS_M, `How near can be ${MAX_TRACKER_RADIUS_M.toLocaleString('en-IE')} metres at most.`),
  }),
  /** Put a tracker on an item, move it to another, or take it off (null). */
  'tracker.attach': z.object({ id, assetId: z.string().min(1).max(64).nullable() }),
  /** What the office calls a tracker. */
  'tracker.name': z.object({ id, name: text(TRACKER_NAME_LENGTH, "The tracker's name").transform((s) => s.trim()) }),
  /** Put a tracker away, or bring it back into use. */
  'tracker.archive': z.object({ id, archived: z.boolean() }),
} as const

/** GET /api/trackers/setup, for Admin: whether the server has a key for reports, and the address to give the maker. */
export interface TrackerSetup {
  keySet: boolean
  address: string
}

/** "digital-matter:416581": the record for a maker's serial number. */
export const trackerId = (maker: TrackerMaker, serial: string) => `${maker}:${serial}`

/** What a tracker is called: its name, or the maker and serial number. */
export const trackerName = (t: Pick<Tracker, 'name' | 'maker' | 'serial'>) => t.name || `${TRACKER_MAKER_LABELS[t.maker]} ${t.serial}`

/** A job's days as kit is held for it: the first day ready to go out to the last day it's due back (ADR 0031). */
export interface HeldJob {
  id: string
  name: string
  /** First and last days kit is held for it, prep and return days included. */
  from: string
  to: string
  /** Where its venues are on the map, by name: the job's and its phases'. */
  venues: { name: string; pin: Pin }[]
}

/** What `placeOf` reads: the fix, the warehouse, and the jobs the item is out with or held for. */
export interface PlaceInput {
  position: TrackerPosition | null
  settings: Pick<TrackerSettings, 'home' | 'radiusM'>
  /** Whether it's on an item. */
  onItem: boolean
  /** The job the item was last scanned out with and not back from, if any. */
  outWith?: HeldJob
  /** Jobs that hold the item's product on the day of the fix, which may have taken it without a scan. */
  heldFor: readonly HeldJob[]
  /** The day of the fix, in Ireland. */
  day: string
}

const metres = (a: Pin, b: Pin) => kmBetween(a, b) * 1000
const oneDecimal = (n: number) => Math.round(n * 10) / 10

/**
 * Where a tracker is against where its item should be. Lenient on purpose:
 * while a job holds the item's product, anywhere is somewhere it could be
 * (the road, a dry hire, a venue not on the map), so the only things put
 * in front of anyone are kit away on no job at all, and kit scanned out
 * with a job that's over and not back. A tracker that cried wolf every
 * time a van left the yard would soon be ignored.
 */
export function placeOf(input: PlaceInput): TrackerPlace {
  const { position, settings, outWith, heldFor, day } = input
  if (!position) return { kind: 'unknown', why: 'noFix' }
  const { home, radiusM } = settings
  if (home && metres(home, position) <= radiusM) return { kind: 'home' }
  if (!input.onItem) return { kind: 'unknown', why: home ? 'noItem' : 'noHome' }
  const jobs = [...(outWith ? [outWith] : []), ...heldFor.filter((j) => j.id !== outWith?.id)]
  for (const j of jobs) {
    const at = j.venues.find((v) => metres(v.pin, position) <= radiusM)
    if (at) return { kind: 'venue', jobId: j.id, job: j.name, venue: at.name }
  }
  const km = home ? oneDecimal(kmBetween(home, position)) : null
  if (outWith) {
    if (day <= outWith.to) return { kind: 'withJob', jobId: outWith.id, job: outWith.name }
    // Out with a job that's over: held for another today is the office moving it on, not left behind.
    const next = heldFor.find((j) => j.id !== outWith.id)
    if (next) return { kind: 'withJob', jobId: next.id, job: next.name }
    return km === null ? { kind: 'unknown', why: 'noHome' } : { kind: 'notBack', jobId: outWith.id, job: outWith.name, ended: outWith.to, km }
  }
  const held = heldFor[0]
  if (held) return { kind: 'withJob', jobId: held.id, job: held.name }
  return km === null ? { kind: 'unknown', why: 'noHome' } : { kind: 'away', km }
}

/** Whether two places are the same kind about the same job, so "since" carries on. */
export const samePlace = (a: TrackerPlace, b: TrackerPlace) =>
  a.kind === b.kind && ('jobId' in a ? a.jobId : '') === ('jobId' in b ? b.jobId : '')

/** "At the warehouse", "At Vicar Street for Nissan launch", "Away, 12.4 km from the warehouse, on no job". */
export function placeLine(p: TrackerPlace, today?: string): string {
  switch (p.kind) {
    case 'home':
      return 'At the warehouse'
    case 'venue':
      return `At ${p.venue}, for ${p.job}`
    case 'withJob':
      return `Out with ${p.job}`
    case 'away':
      return `${kmWords(p.km)} from the warehouse, and on no job`
    case 'notBack':
      return `Not back from ${p.job}, which ended ${dayLabel(p.ended, today)}: ${kmWords(p.km)} from the warehouse`
    case 'unknown':
      return p.why === 'noFix' ? 'No fix yet' : p.why === 'noHome' ? 'Put the warehouse on the map to tell' : 'Not on an item'
  }
}

const kmWords = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('en-IE', { maximumFractionDigits: 1 })} km`)

/** Whether a tracker hasn't been heard from in `TRACKER_QUIET_DAYS`. */
export function trackerQuiet(t: Pick<Tracker, 'lastHeard'>, now: Date): boolean {
  return now.getTime() - Date.parse(t.lastHeard) > TRACKER_QUIET_DAYS * 24 * 60 * 60 * 1000
}

/** "3.61 V": a battery reading as the tracker gave it. Each model's full and flat differ, so it's left as the number. */
export const batteryWords = (mv: number) => `${(mv / 1000).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} V`
