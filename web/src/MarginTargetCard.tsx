import { MARGIN_TARGET_HINT, marginTargetPct, type MoneyView } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/** A percentage as typed back: "10", "2.5". */
export const pctText = (n: number | null | undefined) => (n == null ? '' : String(n))

/** What's typed in a percentage box: a number, null for blank, or NaN when it isn't one. */
export function pctTyped(typed: string): number | null {
  const t = typed.trim().replace(/%$/, '').trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return marginTargetPct.safeParse(n).success ? n : NaN
}

/**
 * The margin target (Colly, 18 November 2026; ADR 0188), for the office: what every product should make a day it's
 * charged, as a share of what one cost to buy. A quote line's discount box turns green while the line makes it, orange
 * from half of it, and red under half. A product can ask for more on its own page.
 */
export function MarginTargetCard({ money }: { money: MoneyView }) {
  const saved = pctText(money.quoting.marginTargetPct)
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
    const pct = pctTyped(typed)
    if (Number.isNaN(pct)) return refuse(MARGIN_TARGET_HINT)
    void run(() => client.mutate('quoting.marginTarget', { pct }))
  }
  return (
    <section className="card office" aria-labelledby="margin-target-title">
      <h2 id="margin-target-title">Margin target</h2>
      <p>
        What a product should make for each day it's charged, as a share of what one cost to buy. On a quote, each kit line's discount box goes green while the line
        makes it, orange when the discount leaves it between half and all of it, and red under half. A product can ask for more on its own page. Left blank, the
        boxes aren't coloured.
      </p>
      <form className="office-form" onSubmit={save}>
        <label>
          Each product should make{' '}
          <span className="with-unit">
            <input inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Not set" aria-describedby="margin-target-hint" />%
          </span>
          <small id="margin-target-hint">Of what one cost to buy, a day, after any discount and what it costs to run. A product with no value isn't coloured.</small>
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
