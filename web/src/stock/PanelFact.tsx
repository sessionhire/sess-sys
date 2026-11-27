import { looksLikePanel, panelPitch, panelWords, type ModelView } from '@sh/shared'
import { useRef, useState, type FormEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { refuseField, settleRefusals } from '../required.ts'
import { client } from '../sync.ts'
import { UnitBox } from '../UnitBox.tsx'
import { readPanel, typedFrom, type PanelField, type PanelTyped } from './panelTyped.ts'

/**
 * An LED panel's size on its product page (ADR 0207): one panel's width and height in mm, and its pixels across and
 * down, which the screen builder on a quote works a screen out from. The builder asks for them the first time a panel
 * is used; here they're seen, and put right. The row is there for a product that has them, or one that reads like a
 * panel that hasn't yet (led-panel.ts), and for nothing else: a truss or a cable never shows it.
 *
 * A panel's weight and power are with the rest of its size, under Change details, as every product's are.
 */
export function PanelFact({ m, mayChange }: { m: ModelView; mayChange: boolean }) {
  const form = useRef<HTMLFormElement>(null)
  // What's typed while the form is open: undefined shut.
  const [typed, setTyped] = useState<PanelTyped>()
  const { run, error } = useAct()
  if (!m.panel && !looksLikePanel(m)) return null
  const pitch = m.panel ? panelPitch(m.panel) : null
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!typed) return
    settleRefusals(form.current)
    const read = readPanel({ ...typed, weightKg: '', powerW: '' })
    if (read.fault) return void refuseField(form.current, `[name="${read.fault.field}"]`, read.fault.why)
    void run(() => client.mutate('model.update', { id: m.id, panel: read.facts })).then((ok) => ok && setTyped(undefined))
  }
  // Given a panel's size by mistake, it stops being offered as a panel: screens already quoted from it keep their lines.
  const forget = () => void run(() => client.mutate('model.update', { id: m.id, panel: null })).then((ok) => ok && setTyped(undefined))
  const box = (field: PanelField, label: string, unit?: string) => {
    const input = (
      <input
        name={field}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={field === 'widthMm'}
        value={typed?.[field] ?? ''}
        onChange={(e) => setTyped((now) => now && { ...now, [field]: e.target.value })}
        {...(unit ? { 'aria-label': `${label}, ${unit}` } : {})}
      />
    )
    return (
      <label className="screen-field">
        {unit ? (
          label
        ) : (
          <span>
            {label} <span className="optional">(optional)</span>
          </span>
        )}
        {unit ? <UnitBox unit={unit}>{input}</UnitBox> : input}
      </label>
    )
  }
  return (
    <div className="wide panel-fact">
      <dt>LED panel</dt>
      <dd>
        {m.panel ? <b>{panelWords(m.panel)}</b> : 'Size not given'}
        {pitch !== null && ` · ${pitch} mm pitch`}
        {mayChange && !typed && (
          <>
            {' · '}
            <button type="button" className="link" onClick={() => setTyped(typedFrom(m))}>
              {m.panel ? 'Change its size' : 'Give its size'}
            </button>
          </>
        )}
        {typed && (
          <form className="panel-add" ref={form} onSubmit={save} noValidate aria-label={`The size of one ${m.name}`}>
            <div className="screen-pair">
              {box('widthMm', 'Panel width', 'mm')}
              {box('heightMm', 'Panel height', 'mm')}
            </div>
            <div className="screen-pair">
              {box('pixelsW', 'Pixels across')}
              {box('pixelsH', 'Pixels down')}
            </div>
            <p className="hint">One panel, as it's built into a screen. An LED screen on a quote is worked out from it in whole panels.</p>
            <div className="actions">
              <button type="submit" className="primary">
                Save
              </button>
              <button type="button" onClick={() => setTyped(undefined)}>
                Cancel
              </button>
              {m.panel && (
                <button type="button" className="link quiet" onClick={forget}>
                  It isn’t an LED panel
                </button>
              )}
            </div>
          </form>
        )}
        <Refusal error={error} />
      </dd>
    </div>
  )
}
