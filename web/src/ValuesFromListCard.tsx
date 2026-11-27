import { plural, readValueList, valueLabel, valueListPlan, type ValueListPlan, type View } from '@sh/shared'
import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { Refusal, useAct } from './act.tsx'
import { client } from './sync.ts'

/**
 * Replacement values from a list, on Admin › Data (ADR 0204). After a price
 * check, the office chooses the sheet (or pastes "name, value" lines); the
 * card shows every value it would change, from what to what, and what it
 * couldn't match or read, before one press sets them. Unlike the stock
 * import, a value set here is replaced: that is the point of the list. Each
 * change is an ordinary product change, so it's in the history.
 */

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error("Couldn't read that file."))
    reader.readAsText(file)
  })

export function ValuesFromListCard({ view }: { view: View }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const { run, error } = useAct()

  const models = view.warehouse.models
  const read = useMemo(() => (text.trim() ? readValueList(text) : undefined), [text])
  const plan = useMemo<ValueListPlan | undefined>(() => (read?.rows ? valueListPlan(read.rows, models) : undefined), [read, models])

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setProblem('')
    setNote('')
    try {
      setText(await readFile(file))
      setFileName(file.name)
    } catch (err) {
      setProblem((err as Error).message)
    }
  }

  const n = plan?.changes.length ?? 0
  const apply = () =>
    void run(async () => {
      if (!plan) return
      setBusy(true)
      try {
        for (const c of plan.changes) await client.mutate('model.update', { id: c.modelId, valueCents: c.valueCents })
        setNote(`Set ${plural(n, 'replacement value')}. Each is in the history.`)
        setText('')
        setFileName('')
      } finally {
        setBusy(false)
      }
    })

  const problemText = problem || read?.problem
  return (
    <section className="card values-from-list" aria-labelledby="values-from-list-title">
      <h2 id="values-from-list-title">Replacement values from a list</h2>
      <p>
        After a price check, set many products' replacement value at once. Choose the sheet saved as CSV, with a column for the product and one for the new value
        (a column saying new is taken first, never one saying now or old), or paste lines such as “Yamaha DM3, 1,999”. A product is found by its name, another name it
        goes by, or its stock code. Every change shows below before anything is set, and a value already here is replaced.
      </p>
      <label className="field">
        Sheet <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void choose(e)} disabled={busy} />
      </label>
      <label className="field">
        Or paste the lines
        <textarea
          rows={4}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFileName('')
            setNote('')
          }}
          placeholder={'Yamaha DM3, 1,999\nAvolites Arena, 24,090'}
          disabled={busy}
        />
      </label>
      {fileName && <p className="hint">Read from {fileName}.</p>}
      {problemText && text.trim() && (
        <p className="alert" role="alert">
          {problemText}
        </p>
      )}

      {plan && (
        <ul className="rms-price-plan">
          <Part n={plan.changes.length} title={plan.changes.length === 1 ? 'value to set' : 'values to set'} open>
            <ul className="hint">
              {plan.changes.map((c) => (
                <li key={c.modelId}>
                  <b>{c.name}</b>
                  {c.listName && ` (${c.listName} in the list)`}: {c.was === null ? 'none yet' : valueLabel(c.was)} → {valueLabel(c.valueCents)}
                </li>
              ))}
            </ul>
          </Part>
          <Part n={plan.same} title="already the same" />
          <Part n={plan.blank} title={plan.blank === 1 ? 'row with no value, left as it is' : 'rows with no value, left as they are'} />
          <Part n={plan.unmatched.length} title="not found here" hint="No product has this name, other name or stock code. Add it as another name the product goes by, on its page, and choose the list again.">
            <p className="hint">{plan.unmatched.map((r) => `${r.name} (row ${r.row})`).join(', ')}</p>
          </Part>
          <Part n={plan.unreadable.length} title="that can't be read">
            <ul className="hint">
              {plan.unreadable.map((r) => (
                <li key={r.row}>
                  Row {r.row}
                  {r.name ? `, ${r.name}` : ''}: {r.reason}
                </li>
              ))}
            </ul>
          </Part>
          <Part n={plan.twice.length} title="named again further down" hint="The first row for a product is the one used.">
            <p className="hint">{plan.twice.map((r) => `${r.name} (row ${r.row})`).join(', ')}</p>
          </Part>
        </ul>
      )}

      <Refusal error={error} />
      {note && (
        <p className="hint" role="status">
          {note}
        </p>
      )}
      {plan && (
        <div className="row">
          <button type="button" className="primary" onClick={apply} disabled={!n || busy} aria-busy={busy}>
            {n ? `Set ${plural(n, 'value')}` : 'Nothing to set'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setText('')
              setFileName('')
            }}
            disabled={busy}
          >
            Clear
          </button>
        </div>
      )}
    </section>
  )
}

/** One kind of row: its count, and what it holds a tap away. Nothing shows for none. */
function Part({ n, title, hint, open, children }: { n: number; title: string; hint?: string; open?: boolean; children?: ReactNode }) {
  if (n === 0) return null
  const head = (
    <span>
      <b>{n.toLocaleString('en-IE')}</b> {title}
    </span>
  )
  return (
    <li>
      {children ? (
        <details open={open}>
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
