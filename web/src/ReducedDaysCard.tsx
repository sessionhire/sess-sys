import { DEFAULT_REDUCED_DAY_PCT, reducedDayPct, type MoneyView } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * Travel and warehouse days (ADR 0174), for the office, beside Travel and subsistence: the share of a day rate a day of
 * crew on a Travel or Warehouse phase is paid, and charged on the quote. Half until it's changed.
 */
export function ReducedDaysCard({ money }: { money: MoneyView }) {
  const saved = String(reducedDayPct(money.quoting))
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
    const pct = Number(typed.trim().replace(/%$/, '').trim())
    if (!(Number.isInteger(pct) && pct >= 10 && pct <= 100)) return refuse('A travel or warehouse day is a whole percentage of the day rate from 10 to 100, such as 50.')
    void run(() => client.mutate('quoting.reducedDays', { pct }))
  }
  return (
    <section className="card office" aria-labelledby="reduced-days-title">
      <h2 id="reduced-days-title">Travel and warehouse days</h2>
      <p>
        A phase called Travel or Warehouse is paid at a share of the day rate. Crew asked for on one are offered that share of the standard rate typed on
        the call, or of their own day rate if they have one. On the quote, its crew are charged the same share of their role's price. Either can still be
        changed on the call or the quote.
      </p>
      <form className="office-form" onSubmit={save}>
        <label>
          Paid and charged at{' '}
          <span className="with-unit">
            <input inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} aria-describedby="reduced-days-hint" />%
          </span>
          <small id="reduced-days-hint">Of the day rate. {DEFAULT_REDUCED_DAY_PCT}% is half, as it starts.</small>
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
