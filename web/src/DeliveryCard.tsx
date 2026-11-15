import { euroText, parseEuro, type MoneyView } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * What a dry hire's delivery is charged (ADR 0183; Colly, 14 November 2026: "The unit charged per km should be set in
 * the admin section"). A dry hire's quote puts a Delivery line on by itself: the km by road from the warehouse to the
 * delivery address, at this price a km. Not set, a delivery puts no line on and the quote says why.
 */
export function DeliveryCard({ money }: { money: MoneyView }) {
  const cents = money.quoting.deliveryCentsPerKm
  const saved = cents == null ? '' : euroText(cents)
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
    if (!typed.trim()) return void run(() => client.mutate('quoting.delivery', { centsPerKm: null }))
    const read = parseEuro(typed)
    const cents = read.cents
    if (read.reason || cents == null) return refuse(`The price a km: ${read.reason ?? 'type an amount, such as 1.50.'}`)
    if (cents > 100_00) return refuse('The price a km is at most €100.00.')
    void run(() => client.mutate('quoting.delivery', { centsPerKm: cents }))
  }
  return (
    <section className="card office" aria-labelledby="delivery-title">
      <h2 id="delivery-title">Dry hire delivery</h2>
      <p>
        A dry hire we deliver gets a Delivery line on its quote by itself: the km by road from the warehouse to the delivery address, at this price a km. Collections
        have none.
      </p>
      <form className="office-form" onSubmit={save}>
        <label>
          Price a km{' '}
          <span className="with-unit">
            €<input inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Not set" aria-describedby="delivery-hint" />
          </span>
          <small id="delivery-hint">
            Before VAT, for each km one way, so set it to cover the trip there and back.{cents == null ? ' Not set yet, so no delivery is charged.' : ''}
          </small>
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
