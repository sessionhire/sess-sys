import { euroText, money, parseEuro, type MoneyView } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * What a dry hire's delivery is charged (ADR 0183). A dry hire's quote puts a Delivery line on by itself, measured by
 * road from the warehouse to the delivery address. Colly, 15 November 2026: "a set amount (set in the admin section) for
 * a certain distance, and then km after that are charged at an individual rate (also set in the admin area)". So: a set
 * amount, the km it covers, and the price of each km past them. With no set amount every km is at the price a km; with
 * neither, a delivery puts no line on and the quote says why.
 */
interface Typed {
  base: string
  km: string
  rate: string
}

const typedOf = (m: MoneyView): Typed => ({
  base: m.quoting.deliveryBaseCents == null ? '' : euroText(m.quoting.deliveryBaseCents),
  km: m.quoting.deliveryBaseKm == null ? '' : String(m.quoting.deliveryBaseKm),
  rate: m.quoting.deliveryCentsPerKm == null ? '' : euroText(m.quoting.deliveryCentsPerKm),
})

const same = (a: Typed, b: Typed) => a.base === b.base && a.km === b.km && a.rate === b.rate

/** An amount typed in euro: null for left empty, or why it won't do. */
function cents(typed: string, what: string, max: number): { cents: number | null } | { reason: string } {
  if (!typed.trim()) return { cents: null }
  const read = parseEuro(typed)
  if (read.reason || read.cents == null) return { reason: `${what}: ${read.reason ?? 'type an amount, such as 1.50.'}` }
  if (read.cents > max) return { reason: `${what} is at most ${money(max)}.` }
  return { cents: read.cents }
}

export function DeliveryCard({ money: m }: { money: MoneyView }) {
  const saved = typedOf(m)
  const [typed, setTyped] = useState(saved)
  const [was, setWas] = useState(saved)
  // Another device's change is followed, unless someone is part way through typing here.
  if (!same(was, saved)) {
    setWas(saved)
    if (same(typed, was)) setTyped(saved)
  }
  const set = (k: keyof Typed) => (e: { target: { value: string } }) => setTyped((t) => ({ ...t, [k]: e.target.value }))
  const { run, error, refuse } = useAct()
  const save = (e: FormEvent) => {
    e.preventDefault()
    const base = cents(typed.base, 'The set amount', 10_000_00)
    if ('reason' in base) return refuse(base.reason)
    const rate = cents(typed.rate, 'Each km after', 100_00)
    if ('reason' in rate) return refuse(rate.reason)
    const km = typed.km.trim() ? Number(typed.km.trim()) : null
    if (km !== null && !(Number.isInteger(km) && km >= 0 && km <= 1000)) return refuse('The km the set amount covers is a whole number from 0 to 1000.')
    if (base.cents !== null && km === null) return refuse('Say how many km the set amount covers, such as 20.')
    void run(() => client.mutate('quoting.delivery', { baseCents: base.cents, baseKm: base.cents === null ? null : km, centsPerKm: rate.cents }))
  }
  const { deliveryBaseCents: b, deliveryBaseKm: k, deliveryCentsPerKm: r } = m.quoting
  const now =
    b == null && r == null
      ? 'Not set yet, so no delivery is charged.'
      : b == null
        ? `Now: every km at ${money(r!)}.`
        : `Now: ${money(b)} for up to ${k ?? 0} km, then ${r == null ? 'no price set for each km after, so a longer delivery is not charged until it is' : `${money(r)} a km`}.`
  return (
    <section className="card office" aria-labelledby="delivery-title">
      <h2 id="delivery-title">Dry hire delivery</h2>
      <p>
        A dry hire we deliver gets a Delivery line on its quote by itself, measured by road from the warehouse to the delivery address: the set amount covers
        the first so many km, and each km after that is charged at its own price. Collections have none.
      </p>
      <form className="office-form" onSubmit={save} aria-describedby="delivery-now">
        <label>
          Set amount{' '}
          <span className="with-unit">
            €<input inputMode="decimal" value={typed.base} onChange={set('base')} placeholder="Not set" />
          </span>
        </label>
        <label>
          Covers up to{' '}
          <span className="with-unit">
            <input inputMode="numeric" value={typed.km} onChange={set('km')} placeholder="Not set" />
            km
          </span>
        </label>
        <label>
          Each km after{' '}
          <span className="with-unit">
            €<input inputMode="decimal" value={typed.rate} onChange={set('rate')} placeholder="Not set" />
          </span>
        </label>
        <small id="delivery-now" className="wide">
          Before VAT, and measured one way, so set them to cover the trip there and back. With no set amount, every km is charged at the price a km. {now}
        </small>
        <div className="actions wide">
          <button type="submit" className="primary">
            Save
          </button>
          <Pending pending={m.quoting.pending} />
        </div>
      </form>
      <Refusal error={error} />
    </section>
  )
}
