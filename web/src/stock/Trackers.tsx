import {
  batteryWords,
  DEFAULT_TRACKER_RADIUS_M,
  MAX_TRACKER_RADIUS_M,
  MIN_TRACKER_RADIUS_M,
  placeLine,
  plural,
  TRACKER_QUIET_DAYS,
  trackerQuiet,
  type AssetView,
  type Pin,
  type TrackerSetup,
  type TrackersView,
  type TrackerView,
  type View,
} from '@sh/shared'
import { useEffect, useState, type FormEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { when } from '../format.ts'
import { Heading } from '../Icon.tsx'
import { LazyMap, pinText } from '../jobs/VenueMaps.tsx'
import type { Mark } from '../jobs/Map.tsx'
import { useAccess } from '../role.ts'
import { ask } from '../server.ts'
import { Pending, StatusPill, type PillTone } from '../StatusPill.tsx'
import { client } from '../sync.ts'
import { useToday } from '../view.ts'
import { itemToPut, numberLabel } from './common.tsx'

/**
 * Trackers on kit (ADR 0107). Three places show them, and only while the
 * company uses them:
 *
 * - **the item's page**: where its tracker last said it was, against where
 *   the item should be, on a map, with a way to put a tracker on or take it
 *   off;
 * - **Notifications**: "Kit to check" for whoever looks after stock, with
 *   kit away on no job, kit out after its job, and trackers gone quiet;
 * - **Admin › Connections**: the switch, the warehouse on the map, how to
 *   set Digital Matter up, and every tracker heard from.
 *
 * Where a tracker is comes only from the tracker, by way of the server, so
 * nothing here can move one: only say which item it's on.
 */

/** How a place reads as a pill: the two worth a look in the bad tone, the warehouse settled, the rest neutral. */
function pillOf(t: TrackerView, now: Date): { tone: PillTone; words: string } {
  if (t.place.kind === 'away') return { tone: 'bad', words: 'Away' }
  if (t.place.kind === 'notBack') return { tone: 'bad', words: 'Not back' }
  if (trackerQuiet(t, now)) return { tone: 'pending', words: 'Gone quiet' }
  if (t.place.kind === 'home') return { tone: 'confirmed', words: 'At the warehouse' }
  if (t.place.kind === 'venue') return { tone: 'confirmed', words: 'At the venue' }
  if (t.place.kind === 'withJob') return { tone: 'pending', words: 'With a job' }
  return { tone: 'cancelled', words: 'Not known' }
}

/** "Last heard from today at 09:12", with the fix's own time when it's older. */
function heardLine(t: TrackerView): string {
  const heard = `Last heard from ${when(t.lastHeard)}`
  if (!t.position) return `${heard}, with no fix yet`
  const fixed = Date.parse(t.lastHeard) - Date.parse(t.position.at) > 60 * 60 * 1000 ? `; this fix is from ${when(t.position.at)}` : ''
  const near = t.position.accuracyM !== null ? `, to within ${Math.round(t.position.accuracyM)} m` : ''
  return `${heard}${near}${fixed}`
}

const directions = (p: Pin) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`

/** The tracker on an item, on its page. Nothing while trackers are off. */
export function TrackerCard({ view, a }: { view: View; a: AssetView }) {
  const trackers = view.trackers
  const mayChange = useAccess().can('stock')
  const today = useToday()
  const { run, error } = useAct()
  const [picked, setPicked] = useState('')
  if (!trackers.on) return null
  const t = trackers.onAsset(a.id)
  if (!t && (!mayChange || a.status !== 'active')) return null
  const now = new Date()

  if (!t)
    return (
      <section className="card" aria-labelledby="tracker">
        <Heading icon="venue" id="tracker">
          Tracker
        </Heading>
        {trackers.loose.length === 0 ? (
          <p className="empty">No tracker on it. A tracker shows here to put on once it has reported to the app: set it up under Admin › Connections.</p>
        ) : (
          <>
            <p className="empty">No tracker on it. Put one on to see where it is.</p>
            <div className="actions">
              <label className="field">
                Tracker
                <select value={picked} onChange={(e) => setPicked(e.target.value)}>
                  <option value="">Pick one</option>
                  {trackers.loose.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="primary" disabled={!picked} onClick={() => void run(() => client.mutate('tracker.attach', { id: picked, assetId: a.id })).then((ok) => ok && setPicked(''))}>
                Put it on
              </button>
            </div>
          </>
        )}
        <Refusal error={error} />
      </section>
    )

  const pill = pillOf(t, now)
  const home = trackers.settings.home
  const marks: Mark[] = [
    ...(t.position ? [{ id: t.id, name: `${numberLabel(a)}: ${t.label}`, pin: t.position, line: placeLine(t.place, today) }] : []),
    ...(home && t.place.kind !== 'home' ? [{ id: 'warehouse', name: 'The warehouse', pin: home }] : []),
  ]
  return (
    <section className="card" aria-labelledby="tracker">
      <Heading icon="venue" id="tracker">
        Tracker
      </Heading>
      <p>
        <b>{placeLine(t.place, today)}</b> <StatusPill tone={pill.tone} pending={t.pending}>{pill.words}</StatusPill>
      </p>
      <p className="hint">
        {heardLine(t)}.{t.batteryMv !== null ? ` Battery ${batteryWords(t.batteryMv)}.` : ''}
        {(t.place.kind === 'away' || t.place.kind === 'notBack') && ` Since ${when(t.placeSince)}.`}
        {trackerQuiet(t, now) && ` Nothing from it for over ${plural(TRACKER_QUIET_DAYS, 'day')}: its battery may be flat, it may have no signal, or it may have been found.`}
      </p>
      {marks.length > 0 && <LazyMap marks={marks} label={`Map of where ${numberLabel(a)} is`} />}
      <p className="hint">On it: {t.label}.</p>
      <div className="actions">
        {t.position && (
          <a className="button" href={directions(t.position)} target="_blank" rel="noreferrer">
            Open in Maps
          </a>
        )}
        {mayChange && (
          <button type="button" onClick={() => void run(() => client.mutate('tracker.attach', { id: t.id, assetId: null }))}>
            Remove tracker
          </button>
        )}
      </div>
      <Refusal error={error} />
    </section>
  )
}

/**
 * "Kit to check", at the top of Notifications for whoever looks after stock:
 * worked out on this device from the trackers' last reports, so it shows
 * without signal and goes as soon as the kit is back where it should be.
 * Not counted on the bell, as a clash isn't (ADR 0069): it stays until
 * it's sorted.
 */
export function KitToCheck({ view }: { view: View }) {
  const today = useToday()
  const looksAfterStock = useAccess().can('stock')
  if (!looksAfterStock) return null
  const now = new Date()
  const list = view.trackers.toCheck(now)
  if (list.length === 0) return null
  return (
    <section className="card attention" aria-labelledby="kit-to-check">
      <h2 id="kit-to-check">Kit to check</h2>
      <p className="hint">From the trackers: kit away from the warehouse on no job, kit not back after its job, and trackers gone quiet. Each goes once it's back where it should be.</p>
      {list.map((t) => {
        const pill = pillOf(t, now)
        return (
          <div className="row problem" key={t.id}>
            <div>
              <b>
                {t.asset ? `${numberLabel(t.asset)} (${t.asset.model?.name ?? 'an item'})` : t.label}
              </b>{' '}
              <StatusPill tone={pill.tone}>{pill.words}</StatusPill>
              <p>
                {trackerQuiet(t, now) && t.place.kind !== 'away' && t.place.kind !== 'notBack'
                  ? `Not heard from since ${when(t.lastHeard)}. Last: ${placeLine(t.place, today).toLowerCase()}.`
                  : `${placeLine(t.place, today)}, since ${when(t.placeSince)}.`}
              </p>
            </div>
            <a className="button" href={`#stock/item/${encodeURIComponent(t.assetId!)}`}>
              Open item
            </a>
          </div>
        )
      })}
    </section>
  )
}

/** Trackers under Admin › Connections, for the office: the switch, the warehouse on the map, setting Digital Matter up, and each tracker. */
export function TrackersCard({ view }: { view: View }) {
  const trackers = view.trackers
  const { run, error } = useAct()
  const on = trackers.on
  return (
    <section className="card" aria-labelledby="trackers-card">
      <Heading icon="venue" id="trackers-card">
        Trackers <Pending pending={trackers.settingsPending} />
      </Heading>
      <p>
        Small trackers fixed inside the most expensive cases send where they are to the app. Each item's page shows its tracker on a map, and
        Notifications list kit away from the warehouse on no job, or not back after its job. Turning this off hides them everywhere and keeps every
        tracker and report.
      </p>
      <label className="signal">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => void run(() => client.mutate('trackers.use', { on: e.target.checked }))} />
        <span>
          <b>Use trackers</b>
          <small>{on ? 'Reports are taken in, and kit is checked against its jobs.' : 'Off: no report is taken in, and no tracker shows.'}</small>
        </span>
      </label>
      <Refusal error={error} />
      {on && (
        <>
          <Warehouse trackers={trackers} />
          <Setup />
          <TrackerList view={view} />
        </>
      )}
    </section>
  )
}

/**
 * How near the warehouse or a venue counts as there. The warehouse itself, its address and pin, is kept under
 * Admin › Company (ADR 0180), since the vans measure their drives from it too; this says where it is and links there.
 */
function Warehouse({ trackers }: { trackers: TrackersView }) {
  const saved = trackers.settings
  const [radius, setRadius] = useState(String(saved.radiusM))
  const { run, error, refuse } = useAct()
  const radiusM = Number(radius)
  const save = () => {
    if (!Number.isInteger(radiusM) || radiusM < MIN_TRACKER_RADIUS_M || radiusM > MAX_TRACKER_RADIUS_M)
      return refuse(`How near can be ${MIN_TRACKER_RADIUS_M} to ${MAX_TRACKER_RADIUS_M.toLocaleString('en-IE')} metres.`)
    void run(() => client.mutate('trackers.home', { home: saved.home, radiusM }))
  }
  const where = saved.address.trim().split(/\s*\n\s*/).filter(Boolean).join(', ')
  return (
    <fieldset className="choices">
      <legend>The warehouse</legend>
      <p className="hint">
        Kit on no job belongs here.{' '}
        {saved.home ? `It's at ${where || pinText(saved.home)}.` : 'It isn’t on the map yet, so no tracker can be said to be home.'}{' '}
        <a href="#admin/company">{saved.home ? 'Change it' : 'Put it on the map'} under Admin › Company</a>.
      </p>
      <label className="field">
        How near counts as there, in metres
        <input type="number" inputMode="numeric" min={MIN_TRACKER_RADIUS_M} max={MAX_TRACKER_RADIUS_M} step={10} value={radius} onChange={(e) => setRadius(e.target.value)} />
        <small>The same for the warehouse and for venues. {DEFAULT_TRACKER_RADIUS_M} m takes in a yard and a car park; a tracker's fix can be out by 50 m or more indoors.</small>
      </label>
      <Refusal error={error} />
      <div className="actions">
        <button type="button" className="primary" onClick={save} disabled={radiusM === saved.radiusM}>
          Save how near
        </button>
      </div>
    </fieldset>
  )
}

/** How to point Digital Matter's server at the app: the address, and whether the server has the key. */
function Setup() {
  const [setup, setSetup] = useState<TrackerSetup | 'offline'>()
  useEffect(() => {
    ask<TrackerSetup>('/api/trackers/setup').then(setSetup, () => setSetup('offline'))
  }, [])
  return (
    <details className="tracker-setup">
      <summary>Setting up Digital Matter</summary>
      {setup === 'offline' && <p className="hint">This needs signal: it's asked of the server.</p>}
      {setup && setup !== 'offline' && (
        <ol>
          <li>
            {setup.keySet ? (
              'The server has a key for trackers (TRACKERS_KEY).'
            ) : (
              <>
                <b>First, give the server a key:</b> in Railway, add a variable TRACKERS_KEY with a long random password, and redeploy. Until then no
                report is taken.
              </>
            )}
          </li>
          <li>
            In Digital Matter's Device Manager (or the Location Engine, for Edge trackers), add an HTTP connector to <code>{setup.address}</code>, with
            basic sign-in: any user name, and the key as the password.
          </li>
          <li>Each tracker shows below the first time it reports. Give it a name, then put it on its item from the item's page.</li>
        </ol>
      )}
    </details>
  )
}

/** Every tracker heard from: what it's on, when it last reported, its name, and putting it away. */
function TrackerList({ view }: { view: View }) {
  const trackers = view.trackers
  const all = [...trackers.all, ...trackers.archived]
  if (all.length === 0) return <p className="empty">No tracker has reported yet.</p>
  return (
    <div role="list" aria-label="Trackers">
      {all.map((t) => (
        <TrackerRow key={t.id} t={t} view={view} />
      ))}
    </div>
  )
}

function TrackerRow({ t, view }: { t: TrackerView; view: View }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(t.name)
  const [number, setNumber] = useState('')
  const { run, error, refuse } = useAct()
  const today = useToday()
  const putOn = (e: FormEvent) => {
    e.preventDefault()
    const { item, problem } = itemToPut(number, view.warehouse)
    if (!item) return refuse(problem)
    void run(() => client.mutate('tracker.attach', { id: t.id, assetId: item.id })).then((ok) => ok && setNumber(''))
  }
  return (
    <div className="row" role="listitem">
      <div>
        <b>{t.label}</b> <Pending pending={t.pending} />
        {t.archived && <StatusPill tone="cancelled">Put away</StatusPill>}
        <p>
          {t.asset ? (
            <>
              On <a href={`#stock/item/${encodeURIComponent(t.asset.id)}`}>{numberLabel(t.asset)}</a> ({t.asset.model?.name ?? 'an item'}).{' '}
            </>
          ) : t.archived ? '' : 'On no item. '}
          {heardLine(t)}.{t.asset ? ` ${placeLine(t.place, today)}.` : ''}
        </p>
        {editing && (
          <form
            className="paste-pin"
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => client.mutate('tracker.name', { id: t.id, name })).then((ok) => ok && setEditing(false))
            }}
          >
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Desk case tracker" maxLength={100} />
            </label>
            <button type="submit" className="primary">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        )}
        {!t.archived && !t.asset && (
          <form className="paste-pin" onSubmit={putOn} aria-label={`Put ${t.label} on an item`}>
            <label className="field">
              Put it on item number
              <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="SH-000123" autoComplete="off" />
            </label>
            <button type="submit" disabled={!number.trim()}>
              Put it on
            </button>
          </form>
        )}
        <Refusal error={error} />
      </div>
      <div className="actions">
        {!editing && (
          <button type="button" onClick={() => setEditing(true)}>
            Name it
          </button>
        )}
        <button type="button" onClick={() => void run(() => client.mutate('tracker.archive', { id: t.id, archived: !t.archived }))}>
          {t.archived ? 'Bring it back' : 'Put it away'}
        </button>
      </div>
    </div>
  )
}
