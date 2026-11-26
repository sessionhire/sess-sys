import { isCable, lengthFromName, lengthLabel, lengthTidies, nameWithLength, nameWithoutLength, plural, productNameKey, type LengthTidy, type ModelView, type View } from '@sh/shared'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { Empty } from '../Empty.tsx'
import { Heading } from '../Icon.tsx'
import { Top } from '../jobs/common.tsx'
import { useAccess } from '../role.ts'
import { STOCK, type Step } from '../Up.tsx'
import { client } from '../sync.ts'
import { UnitBox } from '../UnitBox.tsx'

/**
 * A cable's length beside its name (Colly, 26 November 2026; ADR 0202). Left
 * under size and weight, the length went unseen and was typed into the name
 * instead, so "XLR 10m" and "XLR 10 m" were two spellings of one thing and a
 * cable's length couldn't be read, coloured or sorted by. Now a cable's
 * length is asked for right under its name, and a length typed in the name
 * is offered over to the field with one press.
 */

/** A length typed in metres: null for blank, NaN when it isn't one from 0.1 to 1,000. */
export function metresTyped(text: string): number | null {
  const t = text.trim().replace(',', '.').replace(/\s*m$/i, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0.1 && n <= 1000 ? Math.round(n * 10) / 10 : NaN
}

/** Whether the forms ask for a length under the name: a cable by its name or category, or anything with a length already. */
export const asksLength = (name: string, category: string, length: string) => length.trim() !== '' || isCable({ name, category })

/**
 * The Length field for a product's form, under its name, with the length the
 * name holds offered over to it: "Move 10 m to Length" takes it out of the
 * name and puts it here, so it's said once, the same way everywhere.
 */
export function LengthField({ name, length, onChange }: { name: string; length: string; onChange: (next: { name: string; length: string }) => void }) {
  const id = useId()
  const named = lengthFromName(name)
  const typed = metresTyped(length)
  const left = nameWithoutLength(name)
  const movable = named !== null && left !== name.trim()
  const differs = movable && typed !== null && !Number.isNaN(typed) && typed !== named
  return (
    <label className="wide length-field">
      Length
      <UnitBox unit="m">
        <input inputMode="decimal" value={length} onChange={(e) => onChange({ name, length: e.target.value })} placeholder="e.g. 10" aria-label="Length, in metres" aria-describedby={`${id}-hint`} />
      </UnitBox>
      {movable ? (
        <small id={`${id}-hint`}>
          {differs ? `The name says ${lengthLabel(named)} and Length says ${lengthLabel(typed!)}. ` : `The name says ${lengthLabel(named)}. `}
          <button type="button" className="link" onClick={() => onChange({ name: left, length: differs ? length : String(named) })}>
            {differs ? `Take ${lengthLabel(named)} out of the name` : `Move ${lengthLabel(named)} to Length`}
          </button>
        </small>
      ) : (
        <small id={`${id}-hint`}>In metres, such as 10 or 0.5. It's shown after the name everywhere, so leave it out of the name.</small>
      )}
    </label>
  )
}

/**
 * A cable's length on its page (ADR 0202): what it is, or a way to give it
 * there and then; and when the name still holds it, one press to move it
 * out of the name.
 */
export function LengthFact({ m, models, mayChange }: { m: ModelView; models: readonly ModelView[]; mayChange: boolean }) {
  const [adding, setAdding] = useState(false)
  const [typed, setTyped] = useState('')
  const { run, error, refuse } = useAct()
  const named = lengthFromName(m.name)
  const left = nameWithoutLength(m.name)
  const movable = named !== null && left !== m.name.trim() && (m.lengthM === null || m.lengthM === named)
  const save = (lengthM: number, name?: string) => {
    const next = { name: name ?? m.name, lengthM }
    const clash = models.find((x) => x.id !== m.id && productNameKey(x) === productNameKey(next))
    if (clash) return refuse(`There's already a product called ${nameWithLength(clash)}.`)
    void run(() => client.mutate('model.update', { id: m.id, lengthM, ...(name === undefined ? {} : { name }) })).then((ok) => ok && setAdding(false))
  }
  const add = (e: FormEvent) => {
    e.preventDefault()
    const n = metresTyped(typed)
    if (n === null || Number.isNaN(n)) return refuse('The length is a number of metres, such as 10 or 0.5.')
    save(n)
  }
  if (!isCable(m)) return null
  return (
    <div className="wide length-fact">
      <dt>Length</dt>
      <dd>
        {m.lengthM !== null ? <b>{lengthLabel(m.lengthM)}</b> : 'Not given'}
        {m.lengthM !== null && named !== null && named !== m.lengthM && <span className="flag warn"> · the name says {lengthLabel(named)}</span>}
        {mayChange && movable && (
          <>
            {' · '}
            <button type="button" className="link" onClick={() => save(named, left)}>
              Move {lengthLabel(named)} out of the name
            </button>
          </>
        )}
        {mayChange && m.lengthM === null && !movable && !adding && (
          <>
            {' · '}
            <button type="button" className="link" onClick={() => setAdding(true)}>
              Give its length
            </button>
          </>
        )}
        {adding && (
          <form className="inline-add length-add" onSubmit={add}>
            <UnitBox unit="m">
              <input inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. 10" aria-label={`Length of ${m.name}, in metres`} autoFocus />
            </UnitBox>
            <button type="submit" className="primary">
              Save length
            </button>
          </form>
        )}
        <Refusal error={error} />
      </dd>
    </div>
  )
}

/** Stock › Lengths in names (#stock/lengths): the one-off tidy. */
export const LENGTHS: Step = { href: '#stock/lengths', label: 'Lengths in names' }

/**
 * Lengths in names (ADR 0202): every product whose name holds a length, with
 * what it would be with the length moved to its own field, "XLR 10m" to
 * "XLR", 10 m long. Nothing changes until a person picks which and presses
 * Move; cables are picked to start with, other kit with a length in its name
 * (truss, drape) is left for a person to pick. One whose Length already says
 * something else, or that would then match another product, is shown but
 * can't be picked: it's sorted out on its own page.
 */
export function LengthTidyScreen({ view }: { view: View }) {
  const w = view.warehouse
  const mayChange = useAccess().can('stock')
  const all = useMemo(() => lengthTidies(w.models), [w.models])
  const movable = (t: LengthTidy) => !t.differs && !t.clash
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(all.filter((t) => t.cable && movable(t)).map((t) => t.id)))
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState('')
  const { run, error } = useAct()
  const chosen = all.filter((t) => picked.has(t.id) && movable(t))
  const toggle = (id: string) =>
    setPicked((now) => {
      const next = new Set(now)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const move = () => {
    setAsking(false)
    const said = `Moved the length out of ${plural(chosen.length, 'name')}. Each shows its length after its name, as before.`
    // One change a product, as Change details would make it, so each is in its history.
    void run(async () => {
      for (const t of chosen) await client.mutate('model.update', { id: t.id, name: t.to, lengthM: t.lengthM })
    }).then((ok) => ok && setDone(said))
  }
  const row = (t: LengthTidy) => {
    const why = t.differs ? `Its Length says ${lengthLabel(w.models.find((m) => m.id === t.id)?.lengthM ?? 0)}: sort it out on its page.` : t.clash ? `${t.clash} has that name and length already.` : ''
    return (
      <li key={t.id}>
        <label className="tick">
          <input type="checkbox" checked={picked.has(t.id) && movable(t)} disabled={!mayChange || !movable(t)} onChange={() => toggle(t.id)} />
          <span>
            <b>{t.name}</b>
            <small>
              {why ? (
                <>
                  {why} <a href={`#stock/product/${encodeURIComponent(t.id)}`}>Open it</a>
                </>
              ) : (
                `Becomes ${t.to}, ${lengthLabel(t.lengthM)} long`
              )}
            </small>
          </span>
        </label>
      </li>
    )
  }
  const cables = all.filter((t) => t.cable)
  const others = all.filter((t) => !t.cable)
  return (
    <div className="app warehouse length-tidy">
      <Top view={view} title="Stock" up={{ steps: [STOCK], here: LENGTHS.label }} />
      <section className="card">
        <header className="title">
          <h1>{LENGTHS.label}</h1>
        </header>
        <p className="hint">
          A cable's length has its own field, shown after its name everywhere: on lists, pick lists, quotes and labels. These products still have it in their name. Moving it changes how the name is
          stored, not how it reads.
        </p>
        {all.length === 0 && !done && <Empty>No product has a length in its name.</Empty>}
        {done && (
          <p className="added" role="status">
            {done}
          </p>
        )}
      </section>
      {cables.length > 0 && (
        <section className="card" aria-label="Cables">
          <Heading icon="cable">Cables</Heading>
          <ul className="length-list">{cables.map(row)}</ul>
        </section>
      )}
      {others.length > 0 && (
        <section className="card" aria-label="Other kit">
          <Heading icon="kit">Other kit with a length in its name</Heading>
          <p className="hint">Truss, drape and the like. Not picked to start with: pick any whose length should be its own too.</p>
          <ul className="length-list">{others.map(row)}</ul>
        </section>
      )}
      {mayChange && all.length > 0 && (
        <section className="card" aria-label="Move the lengths">
          <Refusal error={error} />
          {asking ? (
            <Confirm question={`Move the length out of ${plural(chosen.length, 'name')}?`} yes="Move them" no="Not now" onYes={move} onNo={() => setAsking(false)}>
              <p>Each can be changed back with Change details on its page.</p>
            </Confirm>
          ) : (
            <div className="actions">
              <button type="button" className="primary" disabled={chosen.length === 0} onClick={() => setAsking(true)}>
                {chosen.length === 0 ? 'Pick some to move' : `Move ${plural(chosen.length, 'length')}`}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
