import { inShForm, newId, normaliseNumber, numberValue, stockId, wholeNumber, type View, type Where } from '@sh/shared'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { when } from '../format.ts'
import { client } from '../sync.ts'
import { ProductChoices } from './common.tsx'
import { holdingPlace } from './countSource.ts'

/**
 * A Session Hire label read on a count, as a label to put on something, not
 * any old code: "SH-000123" or "sh 123", or all six digits as a scanner
 * reads a label. A short run of digits could be a maker's serial, so it's
 * left as a code no item has.
 */
export const labelToPut = (code: string): string | undefined => (inShForm(code) ? normaliseNumber(code) : wholeNumber(code))

/** What labelling on a count did: the new item, its product, and whether it came off what was counted here unlabelled. */
export interface Labelled {
  assetId: string
  modelId: string
  number: string
  fromCount: boolean
}

/**
 * Labelling as the count goes (ADR 0175): a label no item has, scanned on a
 * count, is put on its item here and then, kept at the place or in the case
 * being counted, one of those counted there unlabelled until now, and found.
 * The product carries over from the last label, since a shelf is labelled a
 * product at a time, so each label after the first is a scan and a press.
 */
export function LabelOnCount({
  view,
  number,
  where,
  product,
  onLabelled,
  onClose,
}: {
  view: View
  number: string
  where: Where
  /** The product the last label went on, on this count. */
  product: string | undefined
  onLabelled: (l: Labelled) => void
  onClose: () => void
}) {
  const w = view.warehouse
  const last = product ? w.models.find((m) => m.id === product) : undefined
  const [name, setName] = useState(last?.name ?? '')
  // The maker's serial, if it's worth having (ADR 0175): never carried over, as each item has its own.
  const [serial, setSerial] = useState('')
  const { run, error, refuse } = useAct()
  const field = useRef<HTMLInputElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const m = w.models.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase())
  const runOf = view.labels.runOf(number)
  const beyond = !runOf && !!view.labels.next && numberValue(number) >= numberValue(view.labels.next)
  const unlabelledHere = m ? (m.counted.find((s) => s.id === stockId(m.id, where))?.qty ?? 0) : 0
  // None here without a label: one comes off the place it was all brought in at, never counted yet (ADR 0176).
  const source = m && unlabelledHere === 0 && where.placeId ? holdingPlace(view, m.id, where) : undefined

  // A product carried over is ready to press; none yet, and it's asked for.
  useEffect(() => {
    // Its button clear of the Finish bar, which sits over the foot of the screen.
    form.current?.scrollIntoView?.({ block: 'nearest' })
    if (last) button.current?.focus({ preventScroll: true })
    else field.current?.focus({ preventScroll: true })
    // Once for each label: the number is what changes.
  }, [number]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!m) return refuse(name.trim() ? `No product is called ${name.trim()}. Add it on the Stock page first.` : 'Which product is it on?')
    if (m.tracking !== 'serialised') return refuse(`${m.name} is counted, not numbered. Change it to numbered on its page to label them one by one.`)
    const id = newId()
    const fromCount = unlabelledHere > 0 || !!source
    void run(async () => {
      if (source && unlabelledHere === 0)
        await client.mutate('stock.move', { modelId: m.id, fromPlaceId: source.placeId, fromCaseId: null, toPlaceId: where.placeId, toCaseId: null, qty: 1 })
      await client.mutate('asset.add', { id, modelId: m.id, number, serial: serial.trim(), placeId: where.placeId, caseId: where.caseId, notes: '', fromCount })
    }).then(
      (ok) => ok && onLabelled({ assetId: id, modelId: m.id, number, fromCount })
    )
  }

  return (
    <form ref={form} className="grid-form claim label-on-count" onSubmit={submit} aria-label={`Put ${number} on an item`}>
      <h3 className="wide">{number} isn't on anything yet</h3>
      <p className="hint wide">
        {runOf
          ? `One of the labels set aside ${when(runOf.createdAt)}${runOf.name ? ` for ${runOf.name}` : ''}.`
          : beyond
            ? `No label with ${number} has been printed here or given out yet, so check the label.`
            : ''}{' '}
        Which product is it on? It's kept here, and counted as found.
      </p>
      <label className="wide">
        Product{' '}
        <input
          ref={field}
          list="product-names"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="e.g. d&b Y10P"
          autoComplete="off"
          required
        />
      </label>
      {m?.tracking === 'serialised' && (
        <p className="hint wide">
          {unlabelledHere > 0
            ? `One of the ${unlabelledHere.toLocaleString('en-IE')} here without a label until now.`
            : source
              ? `One of the ${source.qty.toLocaleString('en-IE')} at ${source.name} without a label: it comes off there and is kept here.`
              : `None of ${m.name} are recorded here without a label, so this one is added here.`}
        </p>
      )}
      <Refusal error={error} className="wide" />
      <button ref={button} type="submit" className="primary wide">
        {/* The product named, as it carries over from the last label: a shelf of something else shows here before it's pressed. */}
        Put {number} on {m ? `a ${m.name}` : 'it'}
      </button>
      {/* Below the button, so the scan-and-press of a shelf stays in reach (ADR 0175). */}
      <label className="wide">
        Maker's serial <small>If it has one worth keeping, before the button above. A scanner can read it in here.</small>
        <input value={serial} onChange={(e) => setSerial(e.target.value)} autoComplete="off" maxLength={100} enterKeyHint="done" />
      </label>
      <button type="button" className="link wide" onClick={onClose}>
        Not now
      </button>
      <ProductChoices w={w} />
    </form>
  )
}
