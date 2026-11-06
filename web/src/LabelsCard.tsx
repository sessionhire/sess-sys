import {
  CABLE_COLOUR_KEYS,
  CABLE_COLOURS,
  cableColourList,
  DEFAULT_CABLE_COLOURS,
  LOGO_SIDE,
  MOST_CABLE_COLOURS,
  mayChangeLogo,
  PHOTOS_WAIT,
  stepRange,
  type CableColour,
  type CableColourStep,
  type OfficeView,
} from '@sh/shared'
import { useRef, useState, type FormEvent } from 'react'
import { Confirm, Refusal, useAct } from './act.tsx'
import { refusal, useDocumentStorage } from './crew/Documents.tsx'
import { Icon } from './Icon.tsx'
import { shrinkPhoto } from './photo-file.ts'
import { logoOf } from './Picture.tsx'
import { useAccess } from './role.ts'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'
import { useLate } from './useLate.ts'

/**
 * What every label says of the company (ADR 0106), for the office: the
 * logo printed on each label in black, and the colour each cable length
 * takes. The logo goes straight to the server, as a product's photo does;
 * the colours are a setting like any other, saved whole.
 */

const base = import.meta.env.VITE_API_BASE ?? ''

async function call(init: RequestInit) {
  let res: Response
  try {
    res = await fetch(`${base}/api/settings/logo/photo?${new URLSearchParams({ client: client.clientId })}`, { ...init, signal: AbortSignal.timeout(120_000) })
  } catch {
    throw new Error('Not changed: the logo needs signal. Try again when you have it.')
  }
  if (!res.ok) throw await refusal(res)
}

function Logo({ office }: { office: OfficeView }) {
  const access = useAccess()
  const storage = useDocumentStorage()
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const late = useLate(busy)
  const [removing, setRemoving] = useState(false)
  const { run, error } = useAct()
  const src = logoOf(office)
  const may = mayChangeLogo(access.role) && !(storage && !storage.files)

  const send = async (file: File | undefined) => {
    if (picker.current) picker.current.value = ''
    if (!file) return
    setBusy(true)
    await run(async () => call({ method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: await shrinkPhoto(file, { side: LOGO_SIDE, square: false, png: true }) }))
    setBusy(false)
  }
  return (
    <div className="company-logo">
      <h3>Logo</h3>
      {src ? (
        <img src={src} alt="The company logo, as labels print it" className="on-label" />
      ) : (
        <p className="hint">None yet: labels say the company's name in words.</p>
      )}
      {storage && !storage.files ? (
        <p className="hint">{PHOTOS_WAIT}</p>
      ) : may && removing ? (
        <Confirm
          question="Take the logo down? Labels say the company's name in words again."
          yes="Take it down"
          loss
          onYes={() => {
            setRemoving(false)
            void run(() => call({ method: 'DELETE' }))
          }}
          onNo={() => setRemoving(false)}
        />
      ) : may ? (
        <div className="actions">
          <label className="button" aria-busy={busy}>
            <Icon name="camera" />
            {late ? 'Sending…' : src ? 'Change logo' : 'Add the logo'}
            <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => void send(e.target.files?.[0])} />
          </label>
          {src && (
            <button type="button" onClick={() => setRemoving(true)} disabled={busy}>
              Remove logo
            </button>
          )}
        </div>
      ) : null}
      <p className="hint">A PNG of the logo, dark on white or see-through, prints best. A label printer prints it in black only.</p>
      <Refusal error={error} />
    </div>
  )
}

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
        Each cable label says its length's colour, and on screen shows it. A label printer prints in black, so the colour itself is the tape, sleeve or coloured label
        put on with it.
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
                  <select value={r.colour} onChange={(e) => setEditing(editing.map((x, j) => (j === i ? { ...x, colour: e.target.value as CableColour } : x)))}>
                    {CABLE_COLOUR_KEYS.map((c) => (
                      <option key={c} value={c}>
                        {CABLE_COLOURS[c].name}
                      </option>
                    ))}
                  </select>
                </label>
                <Swatch colour={r.colour} />
                <button type="button" className="link" aria-label={`Take out the length ${i + 1}`} onClick={() => setEditing(editing.filter((_, j) => j !== i))}>
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
              Start again from the usual list
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
      <Logo office={office} />
      <Colours office={office} />
    </section>
  )
}
