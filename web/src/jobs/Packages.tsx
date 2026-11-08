import {
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  euroText,
  MOST_PACKAGE_ITEMS,
  money,
  newId,
  packageIncludes,
  parseEuro,
  RATE_LABELS,
  RATE_RULES,
  RATE_UNIT,
  type Department,
  type Package,
  type RateRule,
  type View,
} from '@sh/shared'
import { useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { Empty } from '../Empty.tsx'
import { Heading } from '../Icon.tsx'
import { ProductPicker } from '../ProductPicker.tsx'
import { Pending } from '../StatusPill.tsx'
import { client } from '../sync.ts'

/**
 * Packages on the price list (ADR 0087, ADR 0116): named sets of kit, as the office's "Mic package" and "Cable package"
 * were in Current RMS. Each has a name, the department it's listed under, what it holds and, if it's charged as a whole,
 * a price and its rule. On a quote it's a shortcut for its kit: its line, with each product a line under it. One is open
 * to change at a time.
 */
export function PackagesCard({ view }: { view: View }) {
  const m = view.money
  const [open, setOpen] = useState<string>()
  const nameOf = (id: string) => view.warehouse.models.find((x) => x.id === id)?.name
  return (
    <section className="card packages" aria-label="Packages">
      <Heading icon="kit">Packages</Heading>
      <p className="hint">
        Named sets of kit, such as a mic package or a small PA: a shortcut for adding the kit. On a quote it's one line with its kit listed under it, each to change for the
        job. With a price, it's charged at that and its kit is included; with none, its kit is charged at the price list's prices.
      </p>
      {/* First in the list, as every list's add is (UX sweep, 6 November 2026, move 1). */}
      {open === 'new' ? (
        <PackageEditor view={view} onDone={() => setOpen(undefined)} />
      ) : (
        <button type="button" onClick={() => setOpen('new')}>
          Add a package
        </button>
      )}
      {m.packages.length === 0 && open !== 'new' && <Empty>No packages yet.</Empty>}
      {m.packages.map((p) =>
        open === p.id ? (
          <PackageEditor key={p.id} view={view} was={p} onDone={() => setOpen(undefined)} />
        ) : (
          <div key={p.id} className="row package-row">
            <div>
              <b>{p.name}</b>
              <p>{packageIncludes(p, nameOf) || 'Holds nothing yet'}</p>
            </div>
            <div className="actions">
              <span className="amount">{p.dayCents ? `${money(p.dayCents)} a ${RATE_UNIT[p.rate ?? 'daily']}` : 'Its products’ own prices'}</span>
              <span className="muted">{DEPARTMENT_LABELS[p.department]}</span>
              <Pending pending={p.pending} />
              <button type="button" onClick={() => setOpen(p.id)} aria-label={`Change ${p.name}`}>
                Change
              </button>
            </div>
          </div>
        )
      )}
    </section>
  )
}

interface ItemDraft {
  modelId: string
  qty: string
}

/** The products and how many a new package starts with: a quote's kit, saved as a package (ADR 0116). */
export interface PackageStart {
  items: readonly { modelId: string; qty: number }[]
  department: Department
}

export function PackageEditor({ view, was, start, onDone }: { view: View; was?: Package; start?: PackageStart; onDone: (saved?: string) => void }) {
  // Inside a quote's own form when saved from one (ADR 0116), where a form can't sit: a group, saved by its button or Enter.
  const nested = !!start
  const [name, setName] = useState(was?.name ?? '')
  const [department, setDepartment] = useState<Department>(was?.department ?? start?.department ?? 'audio')
  const [price, setPrice] = useState(was?.dayCents ? euroText(was.dayCents) : '')
  const [rate, setRate] = useState<RateRule>(was?.rate ?? 'daily')
  const [items, setItems] = useState<ItemDraft[]>((was?.items ?? start?.items ?? []).map((i) => ({ modelId: i.modelId, qty: String(i.qty) })))
  const [notes, setNotes] = useState(was?.notes ?? '')
  const { run, error, refuse } = useAct()
  const models = view.warehouse.models
  const nameOf = (id: string) => models.find((x) => x.id === id)?.name ?? 'A product no longer listed'

  const add = (modelId: string) => {
    if (!modelId) return
    if (items.some((i) => i.modelId === modelId)) return refuse(`${nameOf(modelId)} is in the package already: change how many.`)
    // The first product says where the package is listed, unless that's been chosen.
    if (!was && !start && items.length === 0) {
      const d = models.find((x) => x.id === modelId)?.department
      if (d) setDepartment(d)
    }
    setItems((is) => [...is, { modelId, qty: '1' }])
  }
  const save = (e: FormEvent | KeyboardEvent | MouseEvent) => {
    e.preventDefault()
    const p = parseEuro(price)
    if (p.reason) return refuse(p.reason)
    const read = items.map((i) => ({ modelId: i.modelId, qty: Number(i.qty.trim()) }))
    if (read.some((i) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 10_000)) return refuse('How many of each is a whole number from 1 to 10,000.')
    // No price: charged by its kit (ADR 0116), so it needs some.
    if (!p.cents && read.length === 0) return refuse('A package with no price of its own is charged by its kit: add at least one product.')
    const id = was?.id ?? newId()
    void run(async () => {
      await client.mutate('package.save', { id, name, department, dayCents: p.cents ?? 0, rate, items: read, notes })
      onDone(id)
    })
  }
  const remove = () =>
    void run(async () => {
      await client.mutate('package.remove', { id: was!.id })
      onDone()
    })

  const Form = nested ? 'div' : 'form'
  return (
    <Form
      className="package-editor"
      role={nested ? 'form' : undefined}
      onSubmit={nested ? undefined : save}
      onKeyDown={nested ? (e: KeyboardEvent) => e.key === 'Enter' && e.target instanceof HTMLInputElement && save(e) : undefined}
      aria-label={was ? `Change ${was.name}` : start ? 'Save as a package' : 'New package'}
    >
      <div className="package-fields">
        <label className="field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="Mic package" autoFocus />
        </label>
        <label className="field">
          Listed under
          <select value={department} onChange={(e) => setDepartment(e.target.value as Department)}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Price, € a {RATE_UNIT[rate]} <span className="optional">(optional)</span>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="100" />
          <small>Empty: its kit is priced from the price list.</small>
        </label>
        <label className="field">
          Charged
          <select value={rate} onChange={(e) => setRate(e.target.value as RateRule)}>
            {RATE_RULES.map((r) => (
              <option key={r} value={r}>
                {RATE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="package-items">
        <legend>What it holds</legend>
        {items.map((i, n) => (
          <div key={i.modelId} className="package-item">
            <span>{nameOf(i.modelId)}</span>
            <label>
              How many
              <input
                inputMode="numeric"
                value={i.qty}
                onChange={(e) => setItems((is) => is.map((x, k) => (k === n ? { ...x, qty: e.target.value } : x)))}
                aria-label={`How many ${nameOf(i.modelId)}`}
              />
            </label>
            <button type="button" className="link" onClick={() => setItems((is) => is.filter((_, k) => k !== n))} aria-label={`Take ${nameOf(i.modelId)} out`}>
              Take out
            </button>
          </div>
        ))}
        {items.length < MOST_PACKAGE_ITEMS && <ProductPicker label="Add a product to it" products={models} value="" onPick={add} />}
      </fieldset>
      <label className="field">
        Anything else it includes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="with clips and stands" />
        <small>Printed after what it holds.</small>
      </label>
      <Refusal error={error} />
      <div className="actions">
        <button type={nested ? 'button' : 'submit'} className="primary" onClick={nested ? save : undefined}>
          {was ? 'Save the package' : 'Add the package'}
        </button>
        <button type="button" className="link" onClick={() => onDone()}>
          Cancel
        </button>
        {was && (
          <button type="button" className="link" onClick={remove}>
            Take it off the price list
          </button>
        )}
      </div>
    </Form>
  )
}
