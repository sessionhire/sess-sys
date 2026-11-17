/**
 * Reading what Digital Matter's server sends (ADR 0107). Its HTTP connector
 * posts one of two shapes of JSON, both read here:
 *
 * - **Device Manager** (the Oyster, the older Yabby): the device's serial
 *   number with a list of `Records`, each a time and a list of `Fields` by
 *   type: 0 is a GPS fix (`Lat`, `Long`, `PosAcc` in metres, `GpsStat`
 *   above 0 when the fix is good), 6 the analogue readings, of which "1"
 *   is the battery in millivolts.
 * - **Location Engine** (the Edge trackers, such as the Yabby Edge
 *   Cellular, which work out where they are in Digital Matter's cloud):
 *   one report a post, with `device.sn`, `date`, `sqn`, and `lat`, `lng`
 *   and `posAcc` when it has a fix; analogue 1 is the battery.
 *
 * The shapes are as Digital Matter's connector sends them and as Traccar,
 * the open-source tracking server, reads them. Anything that isn't one of
 * them is turned away, so a mistake in the connector's set-up shows in
 * Digital Matter's own log rather than going missing here.
 */

export interface TrackerReport {
  /** The tracker's serial number. */
  serial: string
  /** When the report was made, by the tracker's clock (UTC, ISO). */
  at: string
  /** The report's number, which with its time tells a report sent twice. */
  seq: number
  /** Where it was, when it had a good fix. */
  fix: { lat: number; lng: number; accuracyM: number | null; at: string } | null
  batteryMv: number | null
  /** Why it reported, by Digital Matter's own numbers. */
  reason: number | null
}

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
/** A serial number as Digital Matter gives it: a number on older devices, text on newer. */
const serialOf = (v: unknown): string | null => (typeof v === 'number' && Number.isInteger(v) ? String(v) : typeof v === 'string' && /^[\w-]{1,40}$/.test(v.trim()) ? v.trim() : null)
/** "2017-05-11 05:58:44" (UTC, Device Manager's) or an ISO time (Location Engine's), as ISO; null for anything else. */
function timeOf(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) ? `${v.replace(' ', 'T')}Z` : v
  const ms = Date.parse(t)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}
/** A fix only where it could be one: 0,0 is a tracker that hasn't found itself. */
function fixOf(lat: unknown, lng: unknown, acc: unknown, at: string | null) {
  const la = num(lat)
  const lo = num(lng)
  if (la === null || lo === null || !at || Math.abs(la) > 90 || Math.abs(lo) > 180 || (la === 0 && lo === 0)) return null
  const a = num(acc)
  return { lat: la, lng: lo, accuracyM: a !== null && a >= 0 ? a : null, at }
}

/** The reports in a post, or a reason it isn't one. */
export function readDigitalMatter(body: unknown): { reports: TrackerReport[] } | { problem: string } {
  // A connector may send several posts' worth as a list.
  if (Array.isArray(body)) {
    const reports: TrackerReport[] = []
    for (const one of body) {
      const read = readDigitalMatter(one)
      if ('problem' in read) return read
      reports.push(...read.reports)
    }
    return { reports }
  }
  if (!isObject(body)) return { problem: 'Expected a JSON object from Digital Matter.' }
  if (isObject(body.device)) return locationEngine(body)
  if (Array.isArray(body.Records)) return deviceManager(body)
  return { problem: "This isn't a report Digital Matter's connector sends: there's no device or Records in it." }
}

function locationEngine(body: Json): { reports: TrackerReport[] } | { problem: string } {
  const device = body.device as Json
  const serial = serialOf(device.sn)
  if (!serial) return { problem: "The report has no device serial number (device.sn)." }
  const at = timeOf(body.date)
  if (!at) return { problem: `The report from ${serial} has no time (date).` }
  const analogues = Array.isArray(body.analogues) ? body.analogues.filter(isObject) : []
  const battery = num(analogues.find((a) => a.id === 1)?.val)
  return {
    reports: [{ serial, at, seq: num(body.sqn) ?? 0, fix: fixOf(body.lat, body.lng, body.posAcc, at), batteryMv: battery !== null && battery > 0 ? Math.round(battery) : null, reason: num(body.reason) }],
  }
}

function deviceManager(body: Json): { reports: TrackerReport[] } | { problem: string } {
  const serial = serialOf(body.SerNo)
  if (!serial) return { problem: 'The report has no device serial number (SerNo).' }
  const reports: TrackerReport[] = []
  for (const record of (body.Records as unknown[]).filter(isObject)) {
    const at = timeOf(record.DateUTC)
    if (!at) return { problem: `A record from ${serial} has no time (DateUTC).` }
    const fields = Array.isArray(record.Fields) ? record.Fields.filter(isObject) : []
    const gps = fields.find((f) => f.FType === 0)
    const good = gps && (num(gps.GpsStat) ?? 0) > 0
    const analogue = fields.find((f) => f.FType === 6)
    const battery = analogue && isObject(analogue.AnalogueData) ? num(analogue.AnalogueData['1']) : null
    reports.push({
      serial,
      at,
      seq: num(record.SeqNo) ?? 0,
      fix: good ? fixOf(gps.Lat, gps.Long, gps.PosAcc, timeOf(gps.GpsUTC) ?? at) : null,
      batteryMv: battery !== null && battery > 0 ? Math.round(battery) : null,
      reason: num(record.Reason),
    })
  }
  return { reports }
}
