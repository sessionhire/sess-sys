import { lineCents, money, type JobChanges, type LineExtra, RATE_UNIT, type Package, FUEL_PRICE_FRESH_DAYS, type Extras, VEHICLE_KIND_LABELS } from '@sh/shared'
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AdminWords } from '../AdminWords.tsx'
import { Icon } from '../Icon.tsx'
import { toDraft, type LineDraft } from './lineDraft.ts'
import { UnitBox } from './QuoteLine.tsx'

/**
 * What's added to a draft quote beside its kit and crew (ADR 0042, ADR
 * 0086): the crew's travel, subsistence and accommodation (ADR 0156), transport, a package, crew, and
 * what's changed on the job since.
 */

/** Days since a day, for how old the fuel price is. */
const daysSince = (from: string, today: string) => Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)

/** The ids the two worked-out rows open under, beside the lines' own, so one row is open at a time. */
export const TRAVEL_ROW = 'extra:travel'
export const SUBSISTENCE_ROW = 'extra:subsistence'
export const ACCOMMODATION_ROW = 'extra:accommodation'

/**
 * The crew's travel and subsistence (ADR 0086), worked out by the quote, as two rows like any line: the line each comes
 * to, or why there isn't one. Pressing a row opens the one thing the office says about this job for it: the distance,
 * if the map's is wrong, and whether the job gives the crew their meals.
 */
export function TravelAndSubsistence(p: {
  extras: Extras
  meals: boolean
  setMeals: (b: boolean) => void
  rooms: boolean
  setRooms: (b: boolean) => void
  km: string
  setKm: (s: string) => void
  kmProblem: string | undefined
  onLeaveKm: () => void
  fuelSetOn: string | null
  today: string
  open: string | undefined
  setOpen: (id: string | undefined) => void
}) {
  const { travel, subsistence, accommodation, lines } = p.extras
  const kmId = useId()
  const line = (extra: LineExtra) => lines.find((l) => l.extra === extra)
  const t = line('travel')
  const s = line('subsistence')
  const a = line('accommodation')
  // What's waiting on a figure in Admin: the per diem, and the room price on a job the crew would stay over for.
  const wants = [!s && subsistence.none, !a && accommodation.far && accommodation.none].filter((w): w is string => !!w && w.includes('Admin ›'))
  const old = t && p.fuelSetOn && daysSince(p.fuelSetOn, p.today) > FUEL_PRICE_FRESH_DAYS
  const row = (id: string, what: string, how: string, amount: string, label: string, body: ReactNode) => {
    const open = p.open === id
    return (
      <div className={`quote-line-row extra${open ? ' open' : ''}`}>
        <button type="button" className="quote-line-shut" aria-expanded={open} aria-label={label} onClick={() => p.setOpen(open ? undefined : id)}>
          <span className="what">{what}</span>
          <span className="how">{how}</span>
          <span className="amount">{amount}</span>
          <Icon name="edit" className="opener" />
        </button>
        {open && <div className="quote-line extra-open">{body}</div>}
      </div>
    )
  }
  return (
    <section className="quote-group quote-extras" role="group" aria-label="Travel and subsistence">
      <div className="group-head">
        <h3 className="group">Travel and subsistence</h3>
      </div>
      {row(
        TRAVEL_ROW,
        t ? t.what : 'No travel',
        t ? `${t.qty} × ${money(t.unitCents)}, a car's fuel there and back${accommodation.stay ? ', once each as they stay over' : ''}` : (travel.none ?? ''),
        t ? money(lineCents(t)) : '–',
        `${t ? t.what : 'No travel'}: change the distance`,
        <label className="field extra-km">
          Distance each way
          <UnitBox unit="km">
            <input
              inputMode="numeric"
              value={p.km}
              onChange={(e) => p.setKm(e.target.value)}
              onBlur={p.onLeaveKm}
              placeholder={travel.from === 'none' ? '' : String(travel.km)}
              aria-label="Distance each way from Dublin city centre, km"
              aria-invalid={p.kmProblem ? true : undefined}
              aria-describedby={p.kmProblem ? kmId : undefined}
              autoFocus
            />
          </UnitBox>
          {p.kmProblem ? (
            <small className="error" id={kmId}>
              {p.kmProblem}
            </small>
          ) : (
            <small>{p.km.trim() ? 'As typed. Clear it to take it from the map again.' : travel.from === 'map' ? "From the map. Type the real distance if it's out." : 'From Dublin city centre to the venue.'}</small>
          )}
        </label>
      )}
      {old && <p className="kit-note warn-line">The fuel price was set {daysSince(p.fuelSetOn!, p.today)} days ago. Check it in <a href="#admin/company">Admin › Company</a>.</p>}
      {row(
        SUBSISTENCE_ROW,
        s ? s.what : 'No subsistence',
        // Said once (audit of the quote flow, finding 21): where it's set goes on the link under the row, not on the row too.
        s ? `${s.qty} × ${money(s.unitCents)} a day` : (subsistence.none?.replace(/: .*$/, '.') ?? ''),
        s ? money(lineCents(s)) : '–',
        `${s ? s.what : 'No subsistence'}: say if meals are provided`,
        <label className="signal">
          <input type="checkbox" role="switch" checked={p.meals} onChange={(e) => p.setMeals(e.target.checked)} />
          <span>
            <b>Meals provided</b>
            <small>{p.meals ? 'The job gives the crew their meals, so no subsistence is charged.' : 'On if the job gives the crew their meals.'}</small>
          </span>
        </label>
      )}
      {/* The crew's rooms (ADR 0156): only on a job far enough that they'd stay over, so a job near home doesn't say so. */}
      {(a || accommodation.far) &&
        row(
          ACCOMMODATION_ROW,
          a ? a.what : 'No accommodation',
          a ? `${a.qty} × ${money(a.unitCents)} a night` : (accommodation.none?.replace(/: .*$/, '.') ?? ''),
          a ? money(lineCents(a)) : '–',
          `${a ? a.what : 'No accommodation'}: say if the job puts the crew up`,
          <label className="signal">
            <input type="checkbox" role="switch" checked={p.rooms} onChange={(e) => p.setRooms(e.target.checked)} />
            <span>
              <b>Accommodation provided</b>
              <small>{p.rooms ? 'The job puts the crew up, so no accommodation is charged.' : 'On if the job puts the crew up.'}</small>
            </span>
          </label>
        )}
      {/* The way to the per diem and the room price, as a link, said once: the rows above are buttons, so they can't hold one. */}
      {wants.length > 0 && (
        <p className="hint">
          <AdminWords>{wants.length === 1 ? setWhere(wants[0]!) : `Set the per diem and the room price in ${wants[0]!.slice(wants[0]!.indexOf('Admin ›'))}`}</AdminWords>
        </p>
      )}
    </section>
  )
}

/** "No per diem set yet: set it in Admin › …" → "Set it in Admin › …": the way there, without saying again what's missing. */
const setWhere = (none: string) => {
  const rest = none.slice(none.indexOf(': ') + 2)
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

/** "Van and driver", "Luton": how a vehicle reads on a quote. */
export const transportWords = (kind: keyof typeof VEHICLE_KIND_LABELS, driver: boolean) => `${kind === 'luton' ? 'Luton van' : VEHICLE_KIND_LABELS[kind]}${driver ? ' and driver' : ''}`

/** Transport to add (ADR 0089): one of the vans booked on the job, or transport typed. */
export function AddTransport({ vans, onAdd, onCancel }: { vans: { id: string; what: string; name: string }[]; onAdd: (what: string, ref: string | null) => void; onCancel: () => void }) {
  const [chosen, setChosen] = useState(vans[0]?.id ?? '')
  const van = vans.find((v) => v.id === chosen)
  const hint = useId()
  return (
    <div className="adding">
      <label className="field">
        Transport to add
        <select value={chosen} onChange={(e) => setChosen(e.target.value)} aria-describedby={hint} autoFocus>
          {vans.map((v) => (
            <option key={v.id} value={v.id}>
              {v.what}: {v.name}
            </option>
          ))}
          <option value="">Transport, typed</option>
        </select>
      </label>
      <small className="adding-hint" id={hint}>
        Charged once. What it costs us goes beside it, not printed.
      </small>
      <button type="button" onClick={() => onAdd(van ? van.what : 'Transport', van ? van.id : null)}>
        Add
      </button>
      <button type="button" className="link" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

/** A package from the price list to add (ADR 0087). */
export function AddPackage({ packages, onAdd, onCancel }: { packages: readonly Package[]; onAdd: (id: string) => void; onCancel: () => void }) {
  const [chosen, setChosen] = useState(packages[0]?.id ?? '')
  const p = packages.find((x) => x.id === chosen)
  const hint = useId()
  return (
    <div className="adding">
      <label className="field">
        Package to add
        <select value={chosen} onChange={(e) => setChosen(e.target.value)} aria-describedby={hint} autoFocus>
          {packages.map((x) => (
            <option key={x.id} value={x.id}>
              {x.dayCents ? `${x.name}, ${money(x.dayCents)} a ${RATE_UNIT[x.rate ?? 'daily']}` : x.name}
            </option>
          ))}
        </select>
      </label>
      <small className="adding-hint" id={hint}>
        {p?.dayCents
          ? "At its price, with the kit it holds listed under it, each to change for this job."
          : "Its kit, each at the price list's price, listed under its name to change for this job."}
      </small>
      <button type="button" onClick={() => onAdd(chosen)} disabled={!chosen}>
        Add
      </button>
      <button type="button" className="link" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

/** A crew role to add: one already priced or asked for, or one typed. */
export function AddCrew({ roles, onAdd, onCancel }: { roles: readonly string[]; onAdd: (role: string, count: number) => void; onCancel: () => void }) {
  const [typed, setTyped] = useState('')
  // How many of the role (research/quoting.md, feature 1), so two riggers is one line added, not one line and a change.
  const [count, setCount] = useState('1')
  const listId = useId()
  const hint = useId()
  const n = Number(count)
  const countOk = Number.isInteger(n) && n >= 1 && n <= 10_000
  const add = () => typed.trim() && countOk && onAdd(typed.trim().replace(/\s+/g, ' '), n)
  const enter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      add()
    }
  }
  return (
    <div className="adding adding-crew">
      <label className="field count">
        How many
        <input
          inputMode="numeric"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={enter}
          aria-invalid={!countOk}
          aria-describedby={hint}
        />
      </label>
      <label className="field">
        Crew role to add
        <input list={listId} value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={enter} placeholder="Audio tech" maxLength={100} aria-describedby={hint} autoFocus />
      </label>
      {/* Under both boxes, not inside one: a line under the role pushed How many out of line with it (Colly, 12 November 2026). */}
      <small className={countOk ? 'adding-hint' : 'adding-hint error'} id={hint}>
        {countOk ? "Priced from the price list, for the job's days." : 'How many is a whole number from 1 to 10,000.'}
      </small>
      <datalist id={listId}>
        {roles.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <button type="button" onClick={add} disabled={!typed.trim() || !countOk}>
        Add
      </button>
      <button type="button" className="link" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

/**
 * The job's kit and crew since the quote was built from them: what's new on the job, what's gone, and how many have
 * changed, to take in with one press. "Leave it as it is" hides these until the job changes again, on this device.
 */
export function JobChangesCard({ changes, quoteId, onTake }: { changes: JobChanges; quoteId: string; onTake: (next: (ls: LineDraft[]) => LineDraft[]) => void }) {
  const { added, gone, changed } = changes
  const print = JSON.stringify([added.map((l) => l.ref), gone.map((l) => l.id), changed.map((c) => [c.line.id, c.qty])])
  const storeKey = `sh.quoteLeft.${quoteId}`
  const [left, setLeft] = useState(() => {
    try {
      return localStorage.getItem(storeKey)
    } catch {
      return null
    }
  })
  if (added.length + gone.length + changed.length === 0 || left === print) return null
  const take = () =>
    onTake((ls) => [
      ...ls
        .filter((l) => !gone.some((g) => g.id === l.id))
        .map((l) => {
          const c = changed.find((x) => x.line.id === l.id)
          return c ? { ...l, qty: String(c.qty) } : l
        }),
      ...added.map(toDraft),
    ])
  const leave = () => {
    setLeft(print)
    try {
      localStorage.setItem(storeKey, print)
    } catch {
      // Only for this visit, then.
    }
  }
  return (
    <section className="job-changes attention" aria-label="The job has changed">
      <p>
        <b>The job has changed since this quote was built.</b>
      </p>
      <ul>
        {added.map((l) => (
          <li key={l.id}>New on the job: {l.qty} × {l.what}</li>
        ))}
        {changed.map((c) => (
          <li key={c.line.id}>
            {c.line.what}: {c.qty} on the job, {c.line.qty} on the quote
          </li>
        ))}
        {gone.map((l) => (
          <li key={l.id}>No longer on the job: {l.what}</li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" className="primary" onClick={take}>
          Update the quote
        </button>
        <button type="button" className="link" onClick={leave}>
          Leave it as it is
        </button>
      </div>
    </section>
  )
}
