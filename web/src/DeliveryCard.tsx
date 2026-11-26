import { DEFAULT_ONE_WAY_PCT, euroText, money, parseEuro, type MoneyView } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * What a van's delivery and collection is charged (ADR 0183, ADR 0201). A quote that goes by van puts a Delivery and
 * collection line on by itself, measured by road from the warehouse to the delivery address or venue. Colly, 26 November
 * 2026: €160 within Dublin (25 km), then €1 a km, editable here. A truck is priced for each job on its quote, so it has
 * nothing here. Colly, 15 November 2026: "a set amount (set in the admin section) for
 * a certain distance, and then km after that are charged at an individual rate (also set in the admin area)". So: a set
 * amount, the km it covers, and the price of each km past them. With no set amount every km is at the price a km; with
 * neither, a delivery puts no line on and the quote says why.
 */
interface Typed {
  base: string
  km: string
  rate: string
  oneWay: string
}

const typedOf = (m: MoneyView): Typed => ({
  base: m.quoting.deliveryBaseCents == null ? '' : euroText(m.quoting.deliveryBaseCents),
  km: m.quoting.deliveryBaseKm == null ? '' : String(m.quoting.deliveryBaseKm),
  rate: m.quoting.deliveryCentsPerKm == null ? '' : euroText(m.quoting.deliveryCentsPerKm),
  oneWay: m.quoting.deliveryOneWayPct == null ? '' : String(m.quoting.deliveryOneWayPct),
})

const same = (a: Typed, b: Typed) => a.base === b.base && a.km === b.km && a.rate === b.rate && a.oneWay === b.oneWay

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
    const oneWay = typed.oneWay.trim() ? Number(typed.oneWay.trim()) : null
    if (oneWay !== null && !(Number.isInteger(oneWay) && oneWay >= 10 && oneWay <= 100)) return refuse('One way is a whole percentage from 10 to 100, such as 50.')
    void run(() => client.mutate('quoting.delivery', { baseCents: base.cents, baseKm: base.cents === null ? null : km, centsPerKm: rate.cents, oneWayPct: oneWay }))
  }
  const { deliveryBaseCents: b, deliveryBaseKm: k, deliveryCentsPerKm: r } = m.quoting
  const now =
    b == null && r == null
      ? 'Not set yet, so no van delivery is charged.'
      : b == null
        ? `Now: every km at ${money(r!)}.`
        : `Now: ${money(b)} for up to ${k ?? 0} km, then ${r == null ? 'no price set for each km after, so a longer delivery is not charged until it is' : `${money(r)} a km`}.`
  return (
    <section className="card office" aria-labelledby="delivery-title">
      <h2 id="delivery-title">Delivery and collection</h2>
      <p>
        A quote that goes by van gets a Delivery and collection line by itself, measured by road from the warehouse to the delivery address or venue: the set
        amount covers the first so many km, and each km after that is charged at its own price. A truck is priced for each job, on its quote.
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
        <label>
          One way only{' '}
          <span className="with-unit">
            <input inputMode="numeric" value={typed.oneWay} onChange={set('oneWay')} placeholder={String(DEFAULT_ONE_WAY_PCT)} />%
          </span>
        </label>
        <small id="delivery-now" className="wide">
          Before VAT, and measured one way, so set them to cover the trip there and back. Within the km it covers, the set amount is the Dublin flat fee. A delivery or a collection only is charged the share of that price under One way only, half unless you set it. With no set amount, every km is charged at the price a km. {now}
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
