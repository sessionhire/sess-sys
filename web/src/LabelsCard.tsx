import {
  CABLE_COLOUR_KEYS,
  CABLE_COLOURS,
  cableColourList,
  DEFAULT_CABLE_COLOURS,
  MOST_CABLE_COLOURS,
  stepRange,
  type CableColour,
  type CableColourStep,
  type OfficeView,
} from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * What every label says of the company (ADR 0106), for the office: the
 * colour each cable length takes, a setting like any other, saved whole.
 * The logo each label prints has its own card, Logo (LogoCard.tsx, ADR
 * 0155), as quotes print it too.
 */

/** A colour's swatch, drawn in it, with its name for anyone who can't tell them apart. */
export function Swatch({ colour }: { colour: CableColour }) {
  return <span className={`swatch ${colour}`} style={{ background: CABLE_COLOURS[colour].hex }} aria-hidden />
}

interface Row {
  upTo: string
  colour: CableColour
}
const rowsOf = (steps: readonly CableColourStep[]): Row[] => steps.map((s) => ({ upTo: String(s.upToM), colour: s.colour }))

function Colours({ office }: { office: OfficeView }) {
  const [editing, setEditing] = useState<Row[] | null>(null)
  const { run, error, refuse } = useAct()
  const steps = office.cableColours
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const typed = editing.map((r) => ({ upToM: Number(r.upTo.trim().replace(',', '.')), colour: r.colour }))
    if (typed.some((t) => !Number.isFinite(t.upToM) || t.upToM <= 0)) return refuse('Each length is a number of metres, such as 10 or 0.5.')
    const sorted = [...typed].sort((a, b) => a.upToM - b.upToM)
    const checked = cableColourList.safeParse(sorted)
    if (!checked.success) return refuse(checked.error.issues[0]?.message ?? 'Each length once, please.')
    setEditing(null)
    void run(() => client.mutate('cables.colours', { colours: checked.data }))
  }
  return (
    <div className="cable-colours">
      <h3>
        Colours for cable lengths <Pending pending={office.cablesPending} />
      </h3>
      <p className="hint">
        Each cable label says its length's colour, and on screen shows it. A label printer prints in black, so the colour itself is the tape, sleeve
        or coloured label put on with it.
      </p>
      {editing ? (
        <form onSubmit={save}>
          <ul className="colour-rows">
            {editing.map((r, i) => (
              <li key={i}>
                <label>
                  Up to, in m
                  <input
                    inputMode="decimal"
                    value={r.upTo}
                    onChange={(e) => setEditing(editing.map((x, j) => (j === i ? { ...x, upTo: e.target.value } : x)))}
                    required
                  />
                </label>
                <label>
                  Colour
                  <select
                    value={r.colour}
                    onChange={(e) => setEditing(editing.map((x, j) => (j === i ? { ...x, colour: e.target.value as CableColour } : x)))}
                  >
                    {CABLE_COLOUR_KEYS.map((c) => (
                      <option key={c} value={c}>
                        {CABLE_COLOURS[c].name}
                      </option>
                    ))}
                  </select>
                </label>
                <Swatch colour={r.colour} />
                <button
                  type="button"
                  className="link"
                  aria-label={`Take out the length ${i + 1}`}
                  onClick={() => setEditing(editing.filter((_, j) => j !== i))}
                >
                  Take out
                </button>
              </li>
            ))}
          </ul>
          <div className="actions">
            {editing.length < MOST_CABLE_COLOURS && (
              <button type="button" onClick={() => setEditing([...editing, { upTo: '', colour: 'black' }])}>
                Add a length
              </button>
            )}
            <button type="button" className="link" onClick={() => setEditing(rowsOf(DEFAULT_CABLE_COLOURS))}>
              Reset to usual list
            </button>
          </div>
          <div className="actions">
            <button type="submit" className="primary">
              Save colours
            </button>
            <button type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <ul className="colour-list">
            {steps.map((s, i) => (
              <li key={s.upToM}>
                <Swatch colour={s.colour} />
                <b>{CABLE_COLOURS[s.colour].name}</b> <span>{stepRange(steps, i)}</span>
              </li>
            ))}
            <li className="hint">Longer than that: no colour.</li>
          </ul>
          <button type="button" onClick={() => setEditing(rowsOf(steps))}>
            Change colours
          </button>
        </>
      )}
      <Refusal error={error} />
    </div>
  )
}

export function LabelsCard({ office }: { office: OfficeView }) {
  return (
    <section className="card labels-card" aria-label="Labels">
      <h2>Labels</h2>
      <p className="hint">Each label prints the company's logo in black, from Logo above, or Session Hire in words until there is one.</p>
      <Colours office={office} />
    </section>
  )
}
