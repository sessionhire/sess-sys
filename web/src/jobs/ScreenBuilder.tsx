import { daysWord, money, nameWithLength, newId, NO_CHARGE, panelPitch, panelWords, plural, SCREEN_STANDS, SCREEN_STANDS_LABELS, type ModelView, type PanelFacts, type ScreenStands, type View } from '@sh/shared'
import { gridFor, metresWords, panelChoices, screenIncludes, screenPlan, screenWhat, trussFamilies, type PlanRow, type ScreenFacts, type ScreenPart, type ScreenPicks } from '@sh/shared/led-screen'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { ProductPicker } from '../ProductPicker.tsx'
import { refuseField, settleField, settleRefusals, wholeIn } from '../required.ts'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
import { readPanel, typedFrom, type PanelField, type PanelRead, type PanelTyped } from '../stock/panelTyped.ts'
import { UnitBox } from '../UnitBox.tsx'
import { lineStands, screenChanges, screenComesTo, screenLines, type ScreenSet } from './screenLines.ts'

/**
 * The LED screen builder (ADR 0207), in a sheet over the quote: how big, which panel, and whether it's hung or ground
 * stacked, and as those are answered the kit from the stock list that makes the screen, each part with the reason for
 * its count and what it comes to. One press puts the screen on the quote with that kit under it.
 *
 * It asks the least it can. The panels we hold are offered first and the one used last time is already chosen; a
 * panel's size is asked the first time it's used and kept on its product; nothing else has to be typed. Every part is
 * ticked to begin with, since kit left off a quote is the mistake that costs, and taking a part off is one tick.
 *
 * The sums are in the shared code (`@sh/shared/led-screen`), which only this file reads. It comes with the rest of the
 * app, not as a file fetched when first shown (lazyPart.tsx): it's small (about 19 KB as it travels), and so the sheet
 * opens at once, with no signal too. The lines it makes are worked out by screenLines.ts as they're shown, so what the
 * foot says the screen comes to is what the quote says once it's there.
 */

/** A screen's answers as far as they'd got when the sheet was shut without adding it: opened on again next time. */
export interface ScreenDraft {
  width: string
  height: string
  panelId: string
  stands: ScreenStands | ''
  count: string
  typed: Record<string, PanelTyped>
  picks: ScreenPicks
  off: ScreenPart[]
}

export interface ScreenBuilderProps {
  view: View
  /** The days the job works, which the screen's kit is charged for. */
  days: number
  /** How many of a product are free on the job's days beyond what the rest of the quote wants; undefined where it can't run short. */
  free: (modelId: string) => number | undefined
  /** How many more lines the quote can hold. */
  room: number
  /** The screen being changed, as it is on the quote. */
  was?: ScreenSet | undefined
  /** How many, when a number was typed before it in Add kit. */
  count?: number | undefined
  /** What was typed the last time the sheet was shut without adding a screen. */
  kept?: ScreenDraft | undefined
  /** Told as the answers change, so the quote can keep them: undefined once there's nothing typed. */
  onKeep: (draft: ScreenDraft | undefined) => void
  /** Lets what was kept go, and starts from nothing. */
  onFresh: () => void
  onDone: (set: ScreenSet) => void
  /** Takes the screen being changed off the quote. */
  onRemove?: (() => void) | undefined
  onClose: () => void
}

/** What this device remembers of the last screen built: the panel, and the products picked for each part, offered again where they do the job. */
const USUAL_KEY = 'sh.screen.usual'
interface Usual {
  panel?: string
  hung?: ScreenPicks
  ground?: ScreenPicks
}
function readUsual(): Usual {
  try {
    const u = JSON.parse(localStorage.getItem(USUAL_KEY) ?? '{}') as unknown
    return u && typeof u === 'object' ? (u as Usual) : {}
  } catch {
    return {}
  }
}
function keepUsual(u: Usual) {
  try {
    localStorage.setItem(USUAL_KEY, JSON.stringify(u))
  } catch {
    // Storage that's off or full: the next screen starts from the stock list's own order.
  }
}

const STANDS_ABOUT: Record<ScreenStands, string> = {
  hung: 'From truss on motors.',
  ground: 'On the floor, against truss uprights on base plates.',
}

/** The most a screen can be asked for, in metres, and the most of them at once: past these it's a typing slip. */
/** Said for a part whose product has no price on the price list: as the quote says of its line, never shown as nothing. */
const NO_PRICE = 'No price yet'
const MOST_WIDE_M = 200
const MOST_HIGH_M = 100
const MOST_SCREENS = 20

/** Metres as typed: "5", "4.5", "4,5" or "5 m". */
function readMetres(typed: string, most: number): number | undefined {
  const t = typed.trim().replace(/\s*m$/i, '').replace(',', '.')
  if (!t) return undefined
  const n = Number(t)
  return n > 0 && n <= most ? n : undefined
}

/** A number of metres as it goes back in a box: "5", "2.5". */
const metresText = (m: number) => String(Math.round(m * 1000) / 1000)

const listOf = (words: readonly string[]) => (words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`)

/**
 * Where the builder opens. A new screen starts on what was typed last time the sheet was shut, or else on the panel
 * used last time, or the only one we hold. One being changed opens on its answers, with each part as it is on the
 * quote: the product its line has, and unticked where it has none.
 */
function startOf(models: readonly ModelView[], was: ScreenSet | undefined, usual: Usual, count: number | undefined, kept?: ScreenDraft): ScreenDraft {
  const screen = was?.head.screen
  if (!was || !screen) {
    if (kept) return { ...kept, count: count === undefined ? kept.count : String(count) }
    const choices = panelChoices(models)
    const ours = choices.filter((c) => c.ours)
    const last = usual.panel ? models.find((m) => m.id === usual.panel && !m.mistake) : undefined
    const panelId = last?.id ?? (ours.length === 1 ? ours[0]!.model.id : choices.length === 1 ? choices[0]!.model.id : '')
    return { panelId, width: '', height: '', stands: '', count: String(count ?? 1), typed: {}, picks: {}, off: [] }
  }
  const panel = models.find((m) => m.id === screen.panel)
  const made = Number(was.head.qty) || 1
  const start: ScreenDraft = {
    panelId: panel?.id ?? '',
    width: panel?.panel ? metresText((screen.cols * panel.panel.widthMm) / 1000) : '',
    height: panel?.panel ? metresText((screen.rows * panel.panel.heightMm) / 1000) : '',
    stands: screen.stands,
    count: String(made),
    typed: {},
    picks: {},
    off: [],
  }
  if (!panel?.panel) return start
  const had = new Set(was.under.map((u) => u.modelId))
  const pieces = new Map(trussFamilies(models).map((f) => [f.key, f.pieces.map((p) => p.model.id)]))
  for (const row of screenPlan({ panel, facts: panel.panel, cols: screen.cols, rows: screen.rows, count: made, stands: screen.stands }, models).rows) {
    if (row.part === 'panels') continue
    // Truss is chosen by its kind, which is several products: the one any of whose lengths is on the quote.
    const productsOf = (choice: string) => (row.part === 'truss' ? (pieces.get(choice) ?? []) : [choice])
    const onQuote = row.choices.find((c) => productsOf(c.id).some((id) => had.has(id)))
    if (onQuote) start.picks[row.part] = onQuote.id
    else if (row.items.length) start.off.push(row.part)
  }
  return start
}

export function ScreenBuilder({ view, days, free, room, was, count: asked, kept, onKeep, onFresh, onDone, onRemove, onClose }: ScreenBuilderProps) {
  const m = view.money
  const models = view.warehouse.models
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  const mayKeep = useAccess().can('stock')
  const { run, error, refuse } = useAct()
  const [usual] = useState(readUsual)
  const [start] = useState(() => startOf(models, was, usual, asked, kept))
  const [width, setWidth] = useState(start.width)
  const [height, setHeight] = useState(start.height)
  const [panelId, setPanelId] = useState(start.panelId)
  // "Another product…" chosen and nothing picked from it yet.
  const [finding, setFinding] = useState(false)
  const [stands, setStands] = useState<ScreenStands | ''>(start.stands)
  const [count, setCount] = useState(start.count)
  // What's typed of each panel, so going to another and back loses nothing.
  const [typed, setTyped] = useState(start.typed)
  // The chosen panel's kept facts, open to add to.
  const [changing, setChanging] = useState(!!start.typed[start.panelId])
  const [picks, setPicks] = useState(start.picks)
  const [off, setOff] = useState<readonly ScreenPart[]>(start.off)
  const [sending, setSending] = useState(false)

  // With a mouse and keys the cursor starts in the first box; on a touch screen that would put the keyboard over the questions before they're read.
  useEffect(() => {
    if (typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches) form.current?.querySelector<HTMLInputElement>('[name="width"]')?.focus()
  }, [])

  // A new screen's answers are kept as they're typed, so a stray press outside the sheet loses nothing: it opens on them next time.
  const answers = JSON.stringify({ width, height, panelId, stands, count, typed, picks, off: [...off] } satisfies ScreenDraft)
  const [untouched] = useState(() => JSON.stringify(startOf(models, undefined, usual, asked)))
  useEffect(() => {
    if (!was) onKeep(answers === untouched ? undefined : (JSON.parse(answers) as ScreenDraft))
  }, [answers])

  const choices = useMemo(() => panelChoices(models), [models])
  const panel = panelId ? models.find((x) => x.id === panelId) : undefined
  // The chosen panel is always in the list, though it was found under Another product.
  const offered = [...choices.map((c) => c.model), ...(panel && !choices.some((c) => c.model.id === panel.id) ? [panel] : [])] as ModelView[]
  const asking = !!panel && (!panel.panel || changing)
  const typedNow = panel ? (typed[panel.id] ?? typedFrom(panel)) : undefined
  const read: PanelRead | undefined = !panel ? undefined : asking ? readPanel(typedNow!) : { facts: panel.panel!, weightKg: panel.weightKg || null, powerW: panel.powerW || null }
  const setFact = (field: PanelField, value: string) => panel && setTyped((all) => ({ ...all, [panel.id]: { ...(all[panel.id] ?? typedFrom(panel)), [field]: value } }))

  const wide = readMetres(width, MOST_WIDE_M)
  const high = readMetres(height, MOST_HIGH_M)
  const grid = read?.facts && wide !== undefined && high !== undefined ? gridFor(read.facts, wide, high) : undefined
  const screens = wholeIn(count, 1, MOST_SCREENS)
  const usualPicks = stands ? usual[stands] : undefined
  const plan = useMemo(() => {
    if (!panel || !read?.facts || !grid || !stands || screens === undefined) return undefined
    const as = { ...panel, panel: read.facts, weightKg: read.weightKg, powerW: read.powerW }
    return screenPlan({ panel: as, facts: read.facts, cols: grid.cols, rows: grid.rows, count: screens, stands }, models, picks, { price: (x) => m.productPrice(x), free, ...(usualPicks ? { usual: usualPicks } : {}) })
    // What's read of the panel is made afresh each draw: the plan turns on its numbers.
  }, [models, panel, read?.facts?.widthMm, read?.facts?.heightMm, read?.facts?.pixelsW, read?.facts?.pixelsH, read?.weightKg, read?.powerW, grid?.cols, grid?.rows, stands, screens, picks, m, free, usualPicks])

  // The kit the ticked parts come to, each product once, in the order it's listed.
  const built = useMemo(() => {
    if (!plan || !panel || !stands || !grid || screens === undefined) return undefined
    const items: { modelId: string; qty: number }[] = []
    for (const row of plan.rows) {
      if (row.part !== 'panels' && off.includes(row.part)) continue
      for (const i of row.items) {
        const had = items.find((x) => x.modelId === i.modelId)
        if (had) had.qty += i.qty
        else items.push({ ...i })
      }
    }
    return { screen: { panel: panel.id, cols: grid.cols, rows: grid.rows, stands }, count: screens, what: screenWhat(plan.facts, stands), includes: screenIncludes(plan.facts, screens), items }
  }, [plan, off, panel, stands, grid?.cols, grid?.rows, screens])
  const prices = { days, model: (x: string) => models.find((y) => y.id === x), price: (x: string) => m.productPrice(x), rate: (x: string) => m.productRate(x) }
  // As it would land, with stand-in ids: the real ones are made when it's added.
  let made = 0
  const set = built ? screenLines(built, { ...prices, newId: () => `new-${made++}` }, was) : undefined
  const comesTo = set ? screenComesTo(set) : undefined
  const changes = set && was ? screenChanges(was, set) : undefined
  // Changing a screen: how much more or less it comes to than it does on the quote now, said by the button that makes the change.
  const dearer = comesTo && was ? comesTo.cents - screenComesTo(was).cents : 0
  const nameOf = (modelId: string) => nameWithLength(models.find((x) => x.id === modelId) ?? { name: 'A product no longer in the stock list' })

  /** What a part comes to on the quote: its share of its products' lines, or why there's no amount to say. */
  const amountOf = (row: PlanRow): string => {
    let cents = 0
    let unpriced = 0
    let given = 0
    for (const i of row.items) {
      const line = set?.under.find((u) => u.modelId === i.modelId)
      const stands = line && lineStands(line)
      if (!line || !stands) return ''
      if (line.included) given++
      else if (stands.unpriced) unpriced++
      else cents += Math.round((stands.cents * i.qty) / (Number(line.qty) || i.qty))
    }
    return unpriced ? NO_PRICE : given === row.items.length ? NO_CHARGE : money(cents)
  }

  const aboutPanel = (x: ModelView) => {
    const facts = x.id === panel?.id && read?.facts ? read.facts : x.panel
    const pitch = facts ? panelPitch(facts) : null
    const cents = m.productPrice(x.id)
    const left = free(x.id)
    return [
      facts ? panelWords(facts) : 'Size not given yet',
      pitch ? `${pitch} mm pitch` : '',
      cents === undefined ? 'no price yet' : cents === 0 ? NO_CHARGE.toLowerCase() : `${money(cents)} ${m.productRate(x.id) === 'weekly' ? 'a week' : 'a day'}`,
      left === undefined ? '' : left === 0 ? 'none free' : `${left.toLocaleString('en-IE')} free`,
      x.dryHire ? (x.supplier ? `hired in from ${x.supplier}` : 'hired in') : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }
  const panelRadios = `${id}-panel`
  const standsRadios = `${id}-stands`
  const choose = (to: string) => {
    setFinding(false)
    setChanging(!!typed[to])
    setPanelId(to)
    // Picked from the list or found: either answers "pick the panel".
    settleField(form.current, `input[name="${panelRadios}"][value=""]`)
    settleField(form.current, '.screen-ask-panel [role="combobox"]')
  }
  // What a panel that has its size still lacks, said once under the list with the way to give it.
  const gaps = panel?.panel && !asking ? [!panel.weightKg && 'weight', !panel.powerW && 'power', !panel.panel.pixelsW && 'pixels'].filter((x): x is string => !!x) : []

  const sizeWords = !grid
    ? 'Built from whole panels, so its size is taken to the nearest panel.'
    : (() => {
        const w = (grid.cols * read!.facts!.widthMm) / 1000
        const h = (grid.rows * read!.facts!.heightMm) / 1000
        const exact = Math.abs(w - wide!) < 0.0005 && Math.abs(h - high!) < 0.0005
        const across = `${plural(grid.cols, 'panel')} wide by ${grid.rows.toLocaleString('en-IE')} high`
        return exact ? `${across}.` : `In whole panels that is ${metresWords(w).replace(/ m$/, '')} × ${metresWords(h)}: ${across}.`
      })()
  // What's still wanted before there's anything to list, in the order it's asked.
  const still = [(wide === undefined || high === undefined) && 'its size', !panel && 'its panel', !!panel && !read?.facts && 'the panel’s size', !stands && 'whether it’s hung or ground stacked', screens === undefined && 'how many'].filter((x): x is string => !!x)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    const f = form.current
    settleRefusals(f)
    // A group of options is refused under its last one, and the focus goes to its first.
    const group = (name: string, last: string, why: string) => (focus: boolean) => {
      refuseField(f, `input[name="${name}"][value="${last}"]`, why, { focus: false })
      const first = focus ? f?.querySelector<HTMLInputElement>(`input[name="${name}"]`) : null
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      first?.focus({ preventScroll: true })
    }
    const field = (selector: string, why: string) => (focus: boolean) => void refuseField(f, selector, why, { focus })
    // Every fault at once, each on its field, and the focus on the first: a press that finds one thing at a time is a slow form.
    const faults: ((focus: boolean) => void)[] = []
    if (wide === undefined) faults.push(field('[name="width"]', width.trim() ? `The width is a number of metres up to ${MOST_WIDE_M}, such as 5 or 4.5.` : 'Give the width in metres, such as 5 or 4.5.'))
    if (high === undefined) faults.push(field('[name="height"]', height.trim() ? `The height is a number of metres up to ${MOST_HIGH_M}, such as 3 or 2.5.` : 'Give the height in metres, such as 3 or 2.5.'))
    if (!panel) faults.push(finding || !offered.length ? field('.screen-ask-panel [role="combobox"]', 'Find the panel’s product first.') : group(panelRadios, '', 'Pick the panel first.'))
    else if (read?.fault) faults.push(field(`[name="${read.fault.field}"]`, read.fault.why))
    if (!stands) faults.push(group(standsRadios, SCREEN_STANDS.at(-1)!, 'Say whether it’s hung or ground stacked.'))
    if (screens === undefined) faults.push(field('[name="count"]', `How many is a whole number from 1 to ${MOST_SCREENS}.`))
    if (faults.length) return faults.forEach((fault, i) => fault(i === 0))
    if (!panel || !read?.facts || !built || !stands || !plan) return
    const adds = 1 + built.items.length - (was ? 1 + was.under.length : 0)
    if (adds > room) return refuse(`This adds ${plural(adds, 'line')} and the quote has room for ${room <= 0 ? 'no more' : room === 1 ? 'one more' : `${room} more`}. Take some lines off the quote first.`)
    // What was typed of the panel is kept on its product, so it's asked once.
    const keep: { panel?: PanelFacts; weightKg?: number | null; powerW?: number | null } = {}
    if (asking) {
      const had = panel.panel
      if (!had || had.widthMm !== read.facts.widthMm || had.heightMm !== read.facts.heightMm || (had.pixelsW ?? null) !== read.facts.pixelsW || (had.pixelsH ?? null) !== read.facts.pixelsH) keep.panel = read.facts
      if ((panel.weightKg || null) !== read.weightKg) keep.weightKg = read.weightKg
      if ((panel.powerW || null) !== read.powerW) keep.powerW = read.powerW
    }
    const land = () => {
      // The panel and each part's product are offered first next time, where they do the job.
      keepUsual({ ...usual, panel: panel.id, [stands]: Object.fromEntries(plan.rows.flatMap((r) => (r.part !== 'panels' && r.chosen && !off.includes(r.part) ? [[r.part, r.chosen]] : []))) })
      onDone(screenLines(built, { ...prices, newId }, was))
    }
    if (!mayKeep || !Object.keys(keep).length) return land()
    setSending(true)
    void run(() => client.mutate('model.update', { id: panel.id, ...keep })).then((ok) => {
      setSending(false)
      if (ok) land()
    })
  }

  const tick = (part: ScreenPart, on: boolean) => setOff((now) => (on ? now.filter((x) => x !== part) : [...now.filter((x) => x !== part), part]))
  const wantsPicker = finding || offered.length === 0

  return (
    <form className="screen-builder" ref={form} onSubmit={submit} noValidate aria-label={was ? 'Change the LED screen' : 'Add an LED screen'}>
      <div className="screen-asks">
        {kept && !was && (
          <p className="hint screen-kept">
            Opened as you left it.{' '}
            <button type="button" className="link" onClick={onFresh}>
              Start again
            </button>
          </p>
        )}
        <fieldset className="screen-ask">
          <legend>Size</legend>
          <div className="screen-pair">
            <label className="screen-field">
              Width
              <UnitBox unit="m">
                <input name="width" inputMode="decimal" autoComplete="off" value={width} onChange={(e) => setWidth(e.target.value)} aria-label="Width, m" aria-describedby={`${id}-size`} />
              </UnitBox>
            </label>
            <label className="screen-field">
              Height
              <UnitBox unit="m">
                <input name="height" inputMode="decimal" autoComplete="off" value={height} onChange={(e) => setHeight(e.target.value)} aria-label="Height, m" aria-describedby={`${id}-size`} />
              </UnitBox>
            </label>
          </div>
          <p className="hint" id={`${id}-size`}>
            {sizeWords}
          </p>
        </fieldset>

        <fieldset className="choices screen-ask screen-ask-panel">
          <legend>Panel</legend>
          {offered.map((x, i) => (
            <label className="signal" key={x.id}>
              <input type="radio" name={panelRadios} value={x.id} checked={!finding && panelId === x.id} onChange={() => choose(x.id)} aria-labelledby={`${id}-p${i}`} aria-describedby={`${id}-p${i}-about`} />
              <span>
                <b id={`${id}-p${i}`}>{nameWithLength(x)}</b> <span id={`${id}-p${i}-about`}>{aboutPanel(x)}</span>
              </span>
            </label>
          ))}
          {offered.length > 0 && (
            <label className="signal">
              <input
                type="radio"
                name={panelRadios}
                value=""
                checked={finding}
                onChange={() => {
                  setFinding(true)
                  setPanelId('')
                  settleField(form.current, `input[name="${panelRadios}"][value=""]`)
                }}
                aria-labelledby={`${id}-other`}
                aria-describedby={`${id}-other-about`}
              />
              <span>
                <b id={`${id}-other`}>Another product…</b> <span id={`${id}-other-about`}>Any product in the stock list.</span>
              </span>
            </label>
          )}
          {wantsPicker && (
            <ProductPicker
              autoFocus={finding}
              label="The panel’s product"
              products={models}
              value=""
              onPick={(to) => choose(to)}
              hint={offered.length ? 'It’s offered here first from then on.' : 'Nothing in the stock list reads like an LED panel yet. Find the product that is one, and it’s offered here first from then on.'}
            />
          )}
          {panel && asking && typedNow && (
            <div className="screen-panel-facts" role="group" aria-labelledby={`${id}-facts`}>
              <p className="screen-panel-facts-head" id={`${id}-facts`}>
                <b>One {nameWithLength(panel)}</b> <span>{mayKeep ? 'Asked once, then kept on its product.' : 'Used for this screen.'}</span>
              </p>
              <div className="screen-pair">
                <label className="screen-field">
                  Panel width
                  <UnitBox unit="mm">
                    <input name="widthMm" inputMode="numeric" autoComplete="off" value={typedNow.widthMm} onChange={(e) => setFact('widthMm', e.target.value)} aria-label="Panel width, mm" />
                  </UnitBox>
                </label>
                <label className="screen-field">
                  Panel height
                  <UnitBox unit="mm">
                    <input name="heightMm" inputMode="numeric" autoComplete="off" value={typedNow.heightMm} onChange={(e) => setFact('heightMm', e.target.value)} aria-label="Panel height, mm" />
                  </UnitBox>
                </label>
              </div>
              <div className="screen-pair">
                <label className="screen-field">
                  <span>
                    Pixels across <span className="optional">(optional)</span>
                  </span>
                  <input name="pixelsW" inputMode="numeric" autoComplete="off" value={typedNow.pixelsW} onChange={(e) => setFact('pixelsW', e.target.value)} />
                </label>
                <label className="screen-field">
                  <span>
                    Pixels down <span className="optional">(optional)</span>
                  </span>
                  <input name="pixelsH" inputMode="numeric" autoComplete="off" value={typedNow.pixelsH} onChange={(e) => setFact('pixelsH', e.target.value)} />
                </label>
              </div>
              <div className="screen-pair">
                <label className="screen-field">
                  <span>
                    Weight <span className="optional">(optional)</span>
                  </span>
                  <UnitBox unit="kg">
                    <input name="weightKg" inputMode="decimal" autoComplete="off" value={typedNow.weightKg} onChange={(e) => setFact('weightKg', e.target.value)} aria-label="Weight of one panel, kg (optional)" />
                  </UnitBox>
                </label>
                <label className="screen-field">
                  <span>
                    Power <span className="optional">(optional)</span>
                  </span>
                  <UnitBox unit="W">
                    <input name="powerW" inputMode="numeric" autoComplete="off" value={typedNow.powerW} onChange={(e) => setFact('powerW', e.target.value)} aria-label="Most power one panel draws, W (optional)" />
                  </UnitBox>
                </label>
              </div>
              <p className="hint">Its weight sizes the motors and uprights, its power the circuits and distro, and its pixels the processor. Any left out is said as not worked out, never guessed.</p>
            </div>
          )}
          {gaps.length > 0 && (
            <p className="hint screen-panel-gaps">
              Not on this panel’s product yet: its {listOf(gaps)}.{' '}
              <button type="button" className="link" onClick={() => setChanging(true)}>
                Add {gaps.length === 1 ? 'it' : 'them'}
              </button>
            </p>
          )}
        </fieldset>

        <fieldset className="choices screen-ask screen-stands">
          <legend>Hung or ground stacked</legend>
          {SCREEN_STANDS.map((s) => (
            <label className="signal" key={s}>
              <input
                type="radio"
                name={standsRadios}
                value={s}
                checked={stands === s}
                onChange={() => {
                  setStands(s)
                  settleField(form.current, `input[name="${standsRadios}"][value="${SCREEN_STANDS.at(-1)}"]`)
                }}
                aria-labelledby={`${id}-${s}`}
                aria-describedby={`${id}-${s}-about`}
              />
              <span>
                <b id={`${id}-${s}`}>{SCREEN_STANDS_LABELS[s]}</b> <span id={`${id}-${s}-about`}>{STANDS_ABOUT[s]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="screen-field screen-count">
          How many like this
          <input name="count" inputMode="numeric" autoComplete="off" value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
      </div>

      <section className="screen-answer" aria-labelledby={`${id}-takes`}>
        <h3 className="group" id={`${id}-takes`}>
          What it takes
        </h3>
        {!plan || !set ? (
          <p className="hint screen-waits">The kit that makes the screen is listed here as the questions are answered: its panels, what it hangs from or stands on, and what drives and powers it.</p>
        ) : (
          <>
            <Facts facts={plan.facts} count={screens ?? 1} />
            <div className="screen-how">
              {plan.stands.map((words) => (
                <p key={words}>{words}</p>
              ))}
              {plan.warns.map((words) => (
                <p key={words} className="warn-line">
                  {words}
                </p>
              ))}
              {/* Said with the weights and the wind it speaks of: under the list it would be read after them, or not at all. */}
              <p className="screen-caveat">A first pass to quote from, not a structural check: whoever rigs it checks what it hangs from or stands on.</p>
            </div>
            <ul className="screen-parts" aria-label="Kit to add to the quote">
              {plan.rows.map((row) => {
                const always = row.part === 'panels'
                const none = row.items.length === 0
                const on = !none && (always || !off.includes(row.part))
                const short = on
                  ? row.items.flatMap((i) => {
                      const left = free(i.modelId)
                      return left !== undefined && left < i.qty ? [`${left === 0 ? 'None' : `Only ${left.toLocaleString('en-IE')}`} of the ${i.qty.toLocaleString('en-IE')} free on the job’s days${row.items.length > 1 ? `: ${nameOf(i.modelId)}` : ''}.`] : []
                    })
                  : []
                const pick = !always && row.choices.length > 1
                const amount = on ? amountOf(row) : none ? '' : 'Left off'
                return (
                  <li key={row.part} className={`screen-part${on ? '' : ' off'}`}>
                    {/* Every part has its box, so the ticks read down the list as what goes on the quote: the panels' is always ticked, and a part
                        nothing in the stock list fits can't be. */}
                    <label className="screen-part-name">
                      <input type="checkbox" checked={on} disabled={always || none} onChange={(e) => tick(row.part, e.target.checked)} aria-describedby={`${id}-${row.part}`} />
                      <b>{row.label}</b>
                    </label>
                    <span className={`amount${amount === NO_PRICE ? ' unpriced' : ''}`}>{amount}</span>
                    <div className="screen-part-what" id={`${id}-${row.part}`}>
                      {none ? (
                        <p className="how">{row.none}</p>
                      ) : (
                        <>
                          {pick && (
                            <p className="screen-part-pick">
                              {row.items.length === 1 && <span>{row.items[0]!.qty.toLocaleString('en-IE')} ×</span>}
                              <select aria-label={`${row.label}: which`} value={row.chosen ?? ''} onChange={(e) => setPicks((now) => ({ ...now, [row.part]: e.target.value }))}>
                                {row.choices.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </p>
                          )}
                          {(!pick || row.items.length > 1) && <p className="screen-part-items">{row.items.map((i) => `${i.qty.toLocaleString('en-IE')} × ${nameOf(i.modelId)}`).join(', ')}</p>}
                          <p className="how">{row.why}</p>
                          {on && row.check && <p className="check">{row.check}</p>}
                          {short.map((words) => (
                            <p key={words} className="check">
                              {words}
                            </p>
                          ))}
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {changes && (
              <div className="screen-changes" role="group" aria-labelledby={`${id}-changes`}>
                <p className="screen-changes-head" id={`${id}-changes`}>
                  What this changes on the quote
                </p>
                {changes.length ? (
                  <ul>
                    {changes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Nothing: the screen is as the quote has it.</p>
                )}
              </div>
            )}
            <details className="screen-working">
              <summary>How it was worked out</summary>
              <ul>
                {plan.working.map((words) => (
                  <li key={words}>{words}</li>
                ))}
              </ul>
            </details>
          </>
        )}
      </section>

      <div className="screen-foot">
        {/* Here before it has anything to say, so that what it comes to is read out as the answers change it. */}
        <p className="screen-comes-to" aria-live="polite">
          {comesTo ? (
            <>
              <b>{money(comesTo.cents)}</b> for {daysWord(days)}, before VAT
              {dearer !== 0 && (
                <small>
                  {' '}
                  · {money(Math.abs(dearer))} {dearer > 0 ? 'more' : 'less'} than it is now
                </small>
              )}
              {comesTo.unpriced > 0 && <small className="unpriced"> · {plural(comesTo.unpriced, 'line')} with no price yet</small>}
            </>
          ) : (
            <span className="still">Still to give: {listOf(still)}.</span>
          )}
        </p>
        <Refusal error={error} />
        <div className="actions">
          <button type="submit" className="primary" aria-busy={sending || undefined}>
            {was ? 'Update the screen' : 'Add to quote'}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          {was && onRemove && (
            <button type="button" className="link quiet screen-remove" onClick={onRemove}>
              Remove from the quote
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

const kilowatts = (w: number) => (w >= 1000 ? `${(w / 1000).toLocaleString('en-IE', { maximumFractionDigits: 1 })} kW` : `${w.toLocaleString('en-IE')} W`)

/** One screen at a glance. What isn't known of it is said as that, never as nothing. */
function Facts({ facts: f, count }: { facts: ScreenFacts; count: number }) {
  const figures: [label: string, value: string, more?: string][] = [
    ['Panels', f.panels.toLocaleString('en-IE'), `${f.cols} × ${f.rows}`],
    ['Size', `${metresWords(f.widthM).replace(/ m$/, '')} × ${metresWords(f.heightM)}`, f.ratio],
    ['Pixels', f.pixelsW && f.pixelsH ? `${f.pixelsW.toLocaleString('en-IE')} × ${f.pixelsH.toLocaleString('en-IE')}` : 'Not given'],
    ['Weight', f.weightKg === null ? 'Not given' : `${Math.round(f.weightKg).toLocaleString('en-IE')} kg`, f.weightKg === null ? undefined : 'panels only'],
    ['Power', f.powerW === null ? 'Not given' : kilowatts(f.powerW), f.circuits === null ? undefined : `${plural(f.circuits, 'circuit')} of 16 A`],
  ]
  return (
    <>
      <dl className="screen-facts" aria-label={count > 1 ? `Each of the ${count} screens` : 'The screen'}>
        {figures.map(([label, value, more]) => (
          <div key={label} className={value === 'Not given' ? 'unknown' : undefined}>
            <dt>{label}</dt>
            <dd>
              {value}
              {more && <small>{more}</small>}
            </dd>
          </div>
        ))}
      </dl>
      {count > 1 && <p className="hint">Those are for each of the {count} screens. The kit below is for all of them.</p>}
    </>
  )
}
