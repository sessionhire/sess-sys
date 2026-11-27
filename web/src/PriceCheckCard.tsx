import {
  CONFIDENCE_LABELS,
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  plural,
  PRICE_CHECK_ABOUT_CENTS,
  PRICE_CHECKS_AT_ONCE,
  PRICE_CONFIDENCE,
  priceCheckCsv,
  valueLabel,
  type Department,
  type PriceCheck,
  type PriceCheckRow,
  type PriceCheckStatus,
  type PriceConfidence,
  type View,
} from '@sh/shared'
import { useState, useSyncExternalStore } from 'react'
import { Heading } from './Icon.tsx'
import { getJson, postJson, useAsked } from './jobs/rms.ts'
import { Part } from './ValuesFromListCard.tsx'

/**
 * Claude checks replacement values on the web (ADR 0206), on Admin › Data:
 * the price check done by hand on 27 November 2026, run again whenever the
 * stock list has grown. The office picks which products, sees about what it
 * will cost, and Claude looks each up, a few at a time, saying how sure it
 * is. Nothing is set here: the prices chosen, High by default, go into
 * "Replacement values from a list" below, which shows every change first.
 * The run is kept while the app is open, so moving to another page doesn't
 * lose it; closing the app does, and the sheet can be downloaded at any time.
 */

/** Claude looks for prices on the web: a minute and a half for one, at most. */
const PRICE_WAITS_MS = 150_000
const dollars = (c: number) => `$${(c / 100).toFixed(2)}`

type Run = {
  rows: PriceCheckRow[]
  done: number
  total: number
  going: boolean
  stopping: boolean
  cents: number
}
let run: Run = {
  rows: [],
  done: 0,
  total: 0,
  going: false,
  stopping: false,
  cents: 0,
}
const listeners = new Set<() => void>()
const change = (next: Partial<Run>) => {
  run = { ...run, ...next }
  listeners.forEach((l) => l())
}
const useRun = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => run
  )

async function checkAll(products: { id: string; name: string; valueCents: number | null }[]) {
  change({
    rows: products.map((p) => ({
      modelId: p.id,
      name: p.name,
      was: p.valueCents,
      reading: null,
    })),
    done: 0,
    total: products.length,
    going: true,
    stopping: false,
    cents: 0,
  })
  let next = 0
  const one = async () => {
    while (next < products.length && !run.stopping) {
      const i = next++
      const p = products[i]!
      const l = await postJson<PriceCheck>('/api/assistant/price', { modelId: p.id }, PRICE_WAITS_MS)
      const rows = run.rows.slice()
      if (l.state === 'ready') rows[i] = { ...rows[i]!, reading: l.data.reading }
      else
        rows[i] = {
          ...rows[i]!,
          failed: l.state === 'gone' ? l.error : 'Claude didn’t answer in time, or there’s no signal.',
        }
      change({
        rows,
        done: run.done + 1,
        cents: run.cents + (l.state === 'ready' ? l.data.cents : 0),
      })
      // Turned off, or the month's limit spent: no use asking again.
      if (l.state === 'gone' && /turned off|limit|set up/.test(l.error)) change({ stopping: true })
    }
  }
  await Promise.all(Array.from({ length: PRICE_CHECKS_AT_ONCE }, one))
  // What wasn't reached stays on the list as not checked.
  change({
    going: false,
    stopping: false,
    rows: run.rows.map((r) => (r.reading || r.failed ? r : { ...r, failed: 'Stopped before it was checked.' })),
  })
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Which = 'empty' | 'all'

export function PriceCheckCard({ view, onList }: { view: View; onList: (sheet: string, label: string) => void }) {
  const r = useRun()
  const status = useAsked(true, `price-check-${r.going}`, () => getJson<PriceCheckStatus>('/api/assistant/price'))
  const s = status.state === 'ready' ? status.data : undefined
  const [which, setWhich] = useState<Which>('empty')
  const [department, setDepartment] = useState<Department | ''>('')
  const [take, setTake] = useState<Record<PriceConfidence, boolean>>({
    high: true,
    medium: false,
    low: false,
  })

  // Racks are built from other kit, so they have no shop price of their own.
  const products = view.warehouse.models.filter((m) => !m.isRack && (!department || m.department === department) && (which === 'all' || m.valueCents === null))
  const about = products.length * PRICE_CHECK_ABOUT_CENTS
  const tooMuch = s ? about > s.leftCents : false

  const found = (c: PriceConfidence) => r.rows.filter((x) => x.reading?.found && x.reading.euro !== null && x.reading.confidence === c)
  const notFound = r.rows.filter((x) => x.reading && !(x.reading.found && x.reading.euro !== null))
  const failed = r.rows.filter((x) => x.failed)
  const chosen = PRICE_CONFIDENCE.filter((c) => take[c]).flatMap(found)
  const finished = !r.going && r.rows.length > 0
  const day = new Date().toISOString().slice(0, 10)

  return (
    <section className="card price-check" aria-labelledby="price-check-title">
      <Heading icon="search" id="price-check-title">
        Check replacement values with Claude
      </Heading>
      <p>
        Claude looks up what each product costs new today at shops in Ireland and the EU, in euro with VAT, and says how sure it is: High for a Thomann price or
        two shops agreeing, Medium for one other shop, Low for anything less. Nothing is set here: the prices you choose go into the list below, which shows
        every change first.
      </p>
      {s && !s.ok && <p className="hint">Claude can’t look prices up just now: {s.why}</p>}
      {status.state === 'offline' && <p className="hint">Needs signal to ask Claude.</p>}

      {!r.going && (
        <>
          <div className="pills" role="group" aria-label="Which products">
            <button type="button" aria-pressed={which === 'empty'} onClick={() => setWhich('empty')}>
              No value yet
            </button>
            <button type="button" aria-pressed={which === 'all'} onClick={() => setWhich('all')}>
              Every product
            </button>
          </div>
          <label className="field">
            Department
            <select value={department} onChange={(e) => setDepartment(e.target.value as Department | '')}>
              <option value="">Every department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            {products.length
              ? `${plural(products.length, 'product')}, about ${dollars(about)} of Claude’s monthly limit${s ? ` (${dollars(s.leftCents)} left this month)` : ''}. It takes about a minute for every ${PRICE_CHECKS_AT_ONCE * 2}, and the app has to stay open while it runs.`
              : 'No products to check.'}
          </p>
          {tooMuch && (
            <p className="hint">
              That’s more than is left of this month’s limit, so it will stop part way. Check one department at a time, or raise the limit under Claude.
            </p>
          )}
          <div className="row">
            <button type="button" className="primary" disabled={!s?.ok || !products.length} onClick={() => void checkAll(products)}>
              {products.length ? `Look up ${plural(products.length, 'price')}` : 'Nothing to look up'}
            </button>
          </div>
        </>
      )}

      {r.going && (
        <div className="row" role="status">
          <progress max={r.total || 1} value={r.done} aria-label="Prices looked up" />
          <span>
            {r.done} of {r.total} looked up{r.stopping ? ', stopping…' : ''}
          </span>
          <button type="button" className="secondary" onClick={() => change({ stopping: true })} disabled={r.stopping}>
            Stop
          </button>
        </div>
      )}

      {r.rows.length > 0 && (
        <>
          <ul className="rms-price-plan">
            {PRICE_CONFIDENCE.map((c) => (
              <Part key={c} n={found(c).length} title={`${CONFIDENCE_LABELS[c]}`}>
                <Found rows={found(c)} />
              </Part>
            ))}
            <Part n={notFound.length} title="no price found">
              <ul className="hint">
                {notFound.map((x) => (
                  <li key={x.modelId}>
                    <b>{x.name}</b>: {x.reading?.said || 'Nothing worth going by.'}
                  </li>
                ))}
              </ul>
            </Part>
            <Part n={failed.length} title="couldn’t be checked">
              <ul className="hint">
                {failed.map((x) => (
                  <li key={x.modelId}>
                    <b>{x.name}</b>: {x.failed}
                  </li>
                ))}
              </ul>
            </Part>
          </ul>
          {finished && <p className="hint">That cost {dollars(r.cents)}.</p>}
          <p className="hint">Which to use: High is chosen to start with.</p>
          <div className="pills" role="group" aria-label="Prices to use">
            {PRICE_CONFIDENCE.map((c) => (
              <button key={c} type="button" aria-pressed={take[c]} onClick={() => setTake({ ...take, [c]: !take[c] })}>
                {CONFIDENCE_LABELS[c]} ({found(c).length})
              </button>
            ))}
          </div>
          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={!chosen.length || r.going}
              onClick={() =>
                onList(
                  priceCheckCsv(chosen),
                  `Claude's price check (${PRICE_CONFIDENCE.filter((c) => take[c])
                    .map((c) => CONFIDENCE_LABELS[c])
                    .join(', ')})`
                )
              }
            >
              {chosen.length ? `Use ${plural(chosen.length, 'price')}` : 'No prices chosen'}
            </button>
            <button type="button" className="secondary" disabled={r.going} onClick={() => download(`replacement-values-${day}.csv`, priceCheckCsv(r.rows))}>
              Download the results
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function Found({ rows }: { rows: PriceCheckRow[] }) {
  return (
    <ul className="hint">
      {rows.map((x) => {
        const g = x.reading!
        const link = g.sources[0]?.url
        return (
          <li key={x.modelId}>
            <b>{x.name}</b>: {x.was === null ? 'none yet' : valueLabel(x.was)} → {valueLabel(g.euro! * 100)}
            {g.shop && ` at ${g.shop}`}
            {g.priced && ` (${g.priced})`}. {g.said}{' '}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer">
                Source
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}
