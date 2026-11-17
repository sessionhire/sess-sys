import { pinFromText, WAREHOUSE_ADDRESS_LENGTH, type Pin, type PlacesFound, type TrackersView } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from './act.tsx'
import { Heading } from './Icon.tsx'
import { LazyMap, pinText } from './jobs/VenueMaps.tsx'
import { ask } from './server.ts'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'
import { useLate } from './useLate.ts'

/**
 * The warehouse, under Admin › Company (ADR 0180): its address and its pin on the map, which the office can change
 * whenever it moves or was put in the wrong place. The pin is where the vans leave from and come back to, so every
 * drive to a venue is measured from it (ADR 0179), and where kit on no job belongs for trackers (ADR 0107). It's kept
 * with the trackers' settings, as it was before it had an address.
 */
export function WarehouseCard({ trackers }: { trackers: TrackersView }) {
  return (
    <section className="card" aria-labelledby="warehouse-card">
      <Heading icon="venue" id="warehouse-card">
        Warehouse <Pending pending={trackers.settingsPending} />
      </Heading>
      <p>Where the vans leave from and the kit comes home to. Every van's drive to a venue is measured from its pin, and trackers check kit against it.</p>
      <WarehouseForm trackers={trackers} />
    </section>
  )
}

const samePin = (a: Pin | null, b: Pin | null) => a?.lat === b?.lat && a?.lng === b?.lng

/** The address and the pin. Looking the address up offers what the map finds; nothing is saved until Save. */
function WarehouseForm({ trackers }: { trackers: TrackersView }) {
  const saved = trackers.settings
  const [address, setAddress] = useState(saved.address)
  const [draft, setDraft] = useState<Pin | null>(saved.home)
  const [found, setFound] = useState<PlacesFound>()
  const [looking, setLooking] = useState(false)
  const [problem, setProblem] = useState('')
  const [pasted, setPasted] = useState('')
  const late = useLate(looking)
  const { run, error, refuse } = useAct()
  const changed = address.trim() !== saved.address || !samePin(draft, saved.home)

  const look = async () => {
    setLooking(true)
    setProblem('')
    try {
      const answer = await ask<PlacesFound>(`/api/places?${new URLSearchParams({ address: address.trim() })}`)
      setFound(answer)
      if (answer.found[0]) setDraft({ lat: answer.found[0].lat, lng: answer.found[0].lng })
    } catch (err) {
      setProblem((err as Error).message)
    } finally {
      setLooking(false)
    }
  }
  const usePasted = (e: FormEvent) => {
    e.preventDefault()
    const p = pinFromText(pasted)
    if (!p) return refuse('That isn\'t a map link or coordinates. Paste a Google Maps link to the warehouse, or numbers like "53.3249, -6.3368".')
    refuse('')
    setDraft(p)
    setPasted('')
  }
  const save = (home: Pin | null) => void run(() => client.mutate('trackers.home', { home, radiusM: saved.radiusM, address: address.trim() })).then((ok) => ok && setDraft(home))

  return (
    <>
      <label className="field">
        Address
        <textarea rows={3} maxLength={WAREHOUSE_ADDRESS_LENGTH} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
      </label>
      <div className="actions">
        <button type="button" onClick={() => void look()} disabled={!address.trim() || looking} aria-busy={looking}>
          Find it on the map
        </button>
      </div>
      {looking && <p className="hint" aria-live="polite">{late ? 'Looking for the address…' : ' '}</p>}
      {problem && <p className="alert">{problem}</p>}
      {found && found.found.length === 0 && <p className="hint">Nothing found for that address. Tap the map where the warehouse is, or paste a link to it.</p>}
      {found && found.found.length > 1 && (
        <fieldset className="choices">
          <legend>Found for “{found.searched}”</legend>
          {found.found.map((f, i) => (
            <label key={i} className="signal">
              <input type="radio" name="warehouse-found" checked={samePin(draft, f)} onChange={() => setDraft({ lat: f.lat, lng: f.lng })} />
              <span>{f.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <LazyMap marks={[]} placing={draft} onPlace={setDraft} label="Map for placing the warehouse: tap where it is" />
      <p className="hint">{draft ? `Tap the map or drag the pin to move it. Now at ${pinText(draft)}.` : 'Not on the map yet: find the address, tap the map where it is, or paste a link.'}</p>
      <form className="paste-pin" onSubmit={usePasted} aria-label="Paste a map link">
        <label className="field">
          Or paste a map link or coordinates
          <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="A Google Maps link, or 53.3249, -6.3368" inputMode="url" autoComplete="off" />
        </label>
        <button type="submit" disabled={!pasted.trim()}>
          Use it
        </button>
      </form>
      <Refusal error={error} />
      <div className="actions">
        <button type="button" className="primary" onClick={() => save(draft)} disabled={!changed}>
          Save the warehouse
        </button>
        {saved.home && (
          <button type="button" onClick={() => save(null)}>
            Remove from map
          </button>
        )}
      </div>
    </>
  )
}
