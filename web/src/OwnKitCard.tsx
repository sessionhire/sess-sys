import type { MoneyView } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * What our own kit costs to run (audit of the quote flow, 8 November 2026,
 * finding 19), for the office: a share of what it's charged at, standing for
 * wear, repairs, testing and the store. A quote's margin takes it off for own
 * kit as it takes off what hired-in kit and crew cost. Not set, own kit
 * counts as costing nothing and the margin says "own kit not costed", so a
 * quote of our own kit never reads 100% without saying why.
 */
export function OwnKitCard({ money }: { money: MoneyView }) {
  const saved = money.quoting.ownKitCostPct == null ? '' : String(money.quoting.ownKitCostPct)
  const [typed, setTyped] = useState(saved)
  const [was, setWas] = useState(saved)
  // Another device's change is followed, unless someone is part way through typing here.
  if (was !== saved) {
    setWas(saved)
    if (typed === was) setTyped(saved)
  }
  const { run, error, refuse } = useAct()
  const save = (e: FormEvent) => {
    e.preventDefault()
    const t = typed.trim().replace(/%$/, '').trim()
    const pct = t ? Number(t) : null
    if (pct !== null && !(Number.isInteger(pct) && pct >= 0 && pct <= 90)) return refuse('What own kit costs to run is a whole percentage from 0 to 90.')
    void run(() => client.mutate('quoting.ownKit', { costPct: pct }))
  }
  return (
    <section className="card office" aria-labelledby="own-kit-title">
      <h2 id="own-kit-title">Own kit in the margin</h2>
      <p>
        A quote's margin takes off what hired-in kit and crew cost. Our own kit costs something to run too: wear, repairs, testing and the store. Say it as a
        share of what the kit is charged at, and every margin takes it off. Left blank, own kit counts as costing nothing, and the margin says so.
      </p>
      <form className="office-form" onSubmit={save}>
        <label>
          Own kit costs to run{' '}
          <span className="with-unit">
            <input inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Not set" aria-describedby="own-kit-hint" />%
          </span>
          <small id="own-kit-hint">Of what it's charged at, before VAT. A line typed with its own cost keeps it.</small>
        </label>
        <div className="actions wide">
          <button type="submit" className="primary">
            Save
          </button>
          <Pending pending={money.quoting.pending} />
        </div>
      </form>
      <Refusal error={error} />
    </section>
  )
}
