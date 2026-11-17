import type { CommandArgs, Mutation } from '../commands.ts'
import { TRACKER_ALERTS, TRACKER_SETTINGS_ID, TRACKERS_OFF, trackerName, trackerQuiet, type Tracker, type TrackerEntities, type TrackerSettings } from '../trackers.ts'
import type { AssetView, WarehouseView } from './stock-view.ts'

/**
 * Trackers on kit (ADR 0107) as a device sees them: what the server has
 * said of each, with this device's own waiting changes laid over it, so a
 * tracker put on an item shows there the moment it's done, with no signal
 * too. Where each one is comes only from the server, which hears from the
 * trackers themselves.
 */

export interface TrackerView extends Tracker {
  pending: boolean
  /** The item it's on, when that's on this device. */
  asset: AssetView | undefined
  /** What it's called: its name, or the maker and serial number. */
  label: string
}

export interface TrackersView {
  /** The company's settings for trackers, with a waiting change laid over them. */
  settings: TrackerSettings
  /** Those changed on this device and not yet on the server. */
  settingsPending: boolean
  /** Whether the company uses trackers: everything about them is hidden while it doesn't. */
  on: boolean
  /** Every tracker in use, by what it's called. */
  all: TrackerView[]
  /** Those in use and on no item, for putting on one. */
  loose: TrackerView[]
  /** Those put away. */
  archived: TrackerView[]
  get(id: string): TrackerView | undefined
  /** The tracker on an item, when it has one in use. */
  onAsset(assetId: string): TrackerView | undefined
  /**
   * What to look at, as of `now`: trackers on items that are away on no
   * job, or out after their job, or not heard from in a while. Nothing
   * while trackers are off.
   */
  toCheck(now: Date): TrackerView[]
}

type Tables = { [E in keyof TrackerEntities]: Record<string, TrackerEntities[E]> }

const byLabel = (a: TrackerView, b: TrackerView) => a.label.localeCompare(b.label, 'en-IE', { numeric: true }) || a.id.localeCompare(b.id)

export function trackersView(entities: Partial<Tables>, outbox: readonly (Mutation & { appliedSeq?: number })[], cursor: number, warehouse: WarehouseView): TrackersView {
  // Snapshots saved before trackers existed have no tables for them.
  let settings: TrackerSettings = { ...TRACKERS_OFF, ...entities.trackerSettings?.[TRACKER_SETTINGS_ID] }
  let settingsPending = false
  const trackers = new Map<string, Tracker & { pending: boolean }>()
  for (const t of Object.values(entities.tracker ?? {})) trackers.set(t.id, { ...t, pending: false })

  for (const m of outbox) {
    if (m.appliedSeq !== undefined && m.appliedSeq <= cursor) continue
    switch (m.name) {
      case 'trackers.use':
        settings = { ...settings, on: (m.args as CommandArgs<'trackers.use'>).on }
        settingsPending = true
        break
      case 'trackers.home': {
        const a = m.args as CommandArgs<'trackers.home'>
        settings = { ...settings, home: a.home, radiusM: a.radiusM, address: a.address ?? settings.address }
        settingsPending = true
        break
      }
      case 'tracker.attach': {
        const a = m.args as CommandArgs<'tracker.attach'>
        const t = trackers.get(a.id)
        if (!t) break
        // The tracker that was on that item comes off it, as the server takes it off.
        if (a.assetId) for (const o of trackers.values()) if (o.id !== a.id && o.assetId === a.assetId && !o.archived) trackers.set(o.id, { ...o, assetId: null, pending: true })
        trackers.set(a.id, { ...t, assetId: a.assetId, pending: true })
        break
      }
      case 'tracker.name': {
        const a = m.args as CommandArgs<'tracker.name'>
        const t = trackers.get(a.id)
        if (t) trackers.set(a.id, { ...t, name: a.name, pending: true })
        break
      }
      case 'tracker.archive': {
        const a = m.args as CommandArgs<'tracker.archive'>
        const t = trackers.get(a.id)
        if (t) trackers.set(a.id, { ...t, archived: a.archived, assetId: a.archived ? null : t.assetId, pending: true })
        break
      }
    }
  }

  const views: TrackerView[] = [...trackers.values()].map((t) => ({ ...t, asset: t.assetId ? warehouse.assets.get(t.assetId) : undefined, label: trackerName(t) })).sort(byLabel)
  const all = views.filter((t) => !t.archived)
  const byId = new Map(views.map((t) => [t.id, t]))
  const byAsset = new Map(all.filter((t) => t.assetId).map((t) => [t.assetId!, t]))
  const on = settings.on
  return {
    settings,
    settingsPending,
    on,
    all,
    loose: all.filter((t) => !t.assetId),
    archived: views.filter((t) => t.archived),
    get: (id) => byId.get(id),
    onAsset: (assetId) => byAsset.get(assetId),
    toCheck: (now) => (on ? all.filter((t) => t.assetId && (TRACKER_ALERTS.includes(t.place.kind) || trackerQuiet(t, now))) : []),
  }
}
