import { hirePriceLabel, plural, type RmsPriceRow, type RmsPricesStatus, type View } from '@sh/shared'
import { useEffect, useState, type ReactNode } from 'react'
import { Refusal, useAct } from './act.tsx'
import { markSignedOut } from './auth.ts'
import { when } from './format.ts'
import { client } from './sync.ts'

/**
 * Hire prices from Current RMS, on Admin under the Current RMS card (ADR
 * 0132). Reading the prices runs on the server, a product a second, with how
 * far it's got; then the card says what filling the price list in would do
 * (new, brought up to date, set here and kept, already the same, not
 * matched) before anything changes, and one press does just that. A price
 * set here by hand stays unless the tick says otherwise. The lists open in
 * place and grow the page, never a box of their own to scroll.
 */

const base = import.meta.env.VITE_API_BASE ?? ''

type Loaded = { state: 'loading' } | { state: 'offline' } | { state: 'ready'; status: RmsPricesStatus }

const STAGE_WORDS = { products: "Reading Current RMS's products", rates: 'Reading the price of each' } as const

/** The price list as it stands, so the card asks again once a fill-in or a price typed elsewhere reaches it. */
const pricesKey = (view: View) => view.warehouse.models.map((m) => `${m.id}:${view.money.productPrice(m.id) ?? ''}:${view.money.productRate(m.id) ?? ''}`).join(',')

export function RmsPricesCard({ view, canRead }: { view: View; canRead: boolean }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [busy, setBusy] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>()
  const { run, error } = useAct()
  const key = pricesKey(view)

  const refresh = async () => {
    try {
      const res = await fetch(`${base}/api/rms/prices`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      if (res.status === 401) return markSignedOut()
      if (!res.ok) throw new Error(`Server answered ${res.status}`)
      setLoaded({ state: 'ready', status: (await res.json()) as RmsPricesStatus })
    } catch {
      setLoaded((l) => (l.state === 'ready' ? l : { state: 'offline' }))
    }
  }
  // Again a moment after the price list changes, so what's shown is what pressing would do now.
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 400)
    return () => clearTimeout(t)
  }, [key])

  const running = loaded.state === 'ready' && loaded.status.running !== null
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => void refresh(), 3_000)
    return () => clearInterval(t)
  }, [running])

  const post = async (what: 'read' | 'stop') => {
    setBusy(true)
    setNote(undefined)
    try {
      const res = await fetch(`${base}/api/rms/prices/${what}`, { method: 'POST', signal: AbortSignal.timeout(30_000) })
      if (res.status === 401) return markSignedOut()
      if (!res.ok) setNote({ ok: false, text: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.` })
      await refresh()
    } catch {
      setNote({ ok: false, text: "Couldn't reach the server. Try again when you have signal." })
    } finally {
      setBusy(false)
    }
  }

  if (loaded.state === 'loading') return null
  if (loaded.state === 'offline')
    return (
      <section className="card">
        <h2>Hire prices from Current RMS</h2>
        <p className="hint">Can't read Current RMS's prices without signal.</p>
      </section>
    )
  const { status } = loaded
  // The Current RMS card above says what the server needs.
  if (!status.configured) return null

  const { plan, last, running: progress } = status
  const writes = plan ? plan.fill.length + plan.update.length + (overwrite ? plan.differs.length : 0) : 0
  const fill = () =>
    void run(async () => {
      await client.mutate('price.fromRms', { overwrite })
      setNote({ ok: true, text: `Filling in ${plural(writes, 'price')}. The lists here catch up as the server takes it.` })
      setOverwrite(false)
    })

  return (
    <section className="card rms-prices" aria-labelledby="rms-prices-title">
      <h2 id="rms-prices-title">Hire prices from Current RMS</h2>
      <p>
        Fills in the price list from each product's rental price in Current RMS, and how it's charged there: Daily, 3 Day Week or Weekly. A product is found by the
        Current RMS id it came in with, else by its name or another name it goes by. Nothing changes in Current RMS.
      </p>
      {progress ? (
        <div role="status">
          <p>
            {STAGE_WORDS[progress.stage]}: {progress.done.toLocaleString('en-IE')}
            {progress.total ? ` of ${progress.total.toLocaleString('en-IE')}` : ''}.
          </p>
          <progress max={progress.total || 1} value={progress.done} aria-label={STAGE_WORDS[progress.stage]} />
          <p className="hint">Current RMS answers about a request a second, so this takes a few minutes. You can leave this page; it carries on.</p>
          {canRead && (
            <button type="button" className="secondary" onClick={() => void post('stop')} disabled={busy}>
              Stop reading
            </button>
          )}
        </div>
      ) : (
        <>
          {last?.error && (
            <p className="alert" role="alert">
              The last read of the prices stopped{last.finishedAt ? ` ${when(last.finishedAt)}` : ''}: {last.error}
            </p>
          )}
          {last && !last.error && last.finishedAt && (
            <p className="hint">
              Prices last read {when(last.finishedAt)}
              {last.stopped ? ', stopped part way, so the read before it stands' : `: ${plural(status.products, 'product')}`}.
            </p>
          )}
          {!plan && <p className="hint">{canRead ? 'Read the prices first; the card then shows what would change before anything does.' : 'The prices haven’t been read from Current RMS yet: someone who looks after the settings reads them here.'}</p>}
        </>
      )}

      {plan && (
        <>
          <ul className="rms-price-plan">
            <Part n={plan.fill.length} title="to fill in" hint="No price here yet.">
              <Rows rows={plan.fill} />
            </Part>
            <Part n={plan.update.length} title="to bring up to date" hint="Their price came from Current RMS, and it has changed there, or only how it's charged is new.">
              <Rows rows={plan.update} />
            </Part>
            <Part n={plan.differs.length} title="set here by hand, and different" hint="Kept as they are unless you tick below.">
              <Rows rows={plan.differs} />
            </Part>
            <Part n={plan.same} title="already the same" />
            <Part n={plan.noPrice.length} title="with no hire price in Current RMS" hint="Matched, but Current RMS has no rental price for them, or none it charges by day or week. Price them on the price list.">
              <Names names={plan.noPrice.map((x) => x.name)} />
            </Part>
            <Part
              n={plan.unmatched.length}
              title="priced in Current RMS but not found here"
              hint="No product on the stock list has this name or id. Add the Current RMS name as another name the product goes by, on its page, and it's found next time."
            >
              <Names names={plan.unmatched.map((x) => x.name)} />
            </Part>
            <Part n={plan.notInRms} title={plan.notInRms === 1 ? 'product here that Current RMS doesn’t have' : 'products here that Current RMS doesn’t have'} />
          </ul>
          {plan.differs.length > 0 && (
            <label className="tick">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Use Current RMS's price for {plan.differs.length === 1 ? 'the one' : `the ${plan.differs.length}`} set here too
            </label>
          )}
        </>
      )}

      <Refusal error={error} />
      {note && (
        <p className={note.ok ? 'hint' : 'alert'} role={note.ok ? 'status' : 'alert'}>
          {note.text}
        </p>
      )}
      {!progress && (
        <div className="row">
          {plan && (
            <button type="button" className="primary" onClick={fill} disabled={writes === 0}>
              {writes === 0 ? 'Nothing to fill in' : `Fill in ${plural(writes, 'price')}`}
            </button>
          )}
          {canRead && (
            <button type="button" className={plan ? 'secondary' : 'primary'} onClick={() => void post('read')} disabled={busy} aria-busy={busy}>
              {plan ? 'Read again' : 'Read prices'}
            </button>
          )}
        </div>
      )}
      {plan && (
        <p className="hint">
          Each change is kept in the history. See and change any price on the <a href="#jobs/money/prices">price list</a>.
        </p>
      )}
    </section>
  )
}

/** One kind of change: its count, and what it holds a tap away. Nothing shows for none. */
function Part({ n, title, hint, children }: { n: number; title: string; hint?: string; children?: ReactNode }) {
  if (n === 0) return null
  const head = (
    <span>
      <b>{n.toLocaleString('en-IE')}</b> {title}
    </span>
  )
  return (
    <li>
      {children ? (
        <details>
          <summary>{head}</summary>
          {hint && <p className="hint">{hint}</p>}
          {children}
        </details>
      ) : (
        head
      )}
    </li>
  )
}

function Rows({ rows }: { rows: readonly RmsPriceRow[] }) {
  return (
    <ul className="hint">
      {rows.map((r) => (
        <li key={r.modelId}>
          <b>{r.name}</b>
          {r.rmsName && ` (${r.rmsName} in Current RMS)`}: {r.was ? `${hirePriceLabel(r.was.dayCents, r.was.rate ?? 'daily')} here, ` : ''}
          {hirePriceLabel(r.dayCents, r.rate)}
          {r.was ? ' in Current RMS' : ''}
        </li>
      ))}
    </ul>
  )
}

function Names({ names }: { names: readonly string[] }) {
  return <p className="hint">{names.join(', ')}</p>
}
