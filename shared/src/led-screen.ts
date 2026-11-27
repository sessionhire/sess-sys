import { lengthFromName, nameWithLength, nameWithoutLength } from './cable-colours.ts'
import { looksLikePanel } from './led-panel.ts'
import { MOST_SCREEN_COLS, MOST_SCREEN_ROWS, type ScreenStands } from './quotes.ts'
import type { Model, PanelFacts } from './stock.ts'
import LedWall from './vendor/ledwall.js'

/**
 * The LED screen builder's sums (ADR 0207): from a panel, a size and whether the screen is hung or ground stacked,
 * the kit from the stock list that makes it, each part with the reason for its count.
 *
 * What it knows came from two of the company's own tools. The pixel map project gave the screen's totals, the
 * power circuits, how many processors and where the hang points go. The tipping point project gave how many truss
 * uprights a ground-stacked screen stands against and the wind it holds to: its solver is used as it is
 * (vendor/ledwall.js). And both gave the rules for saying it: the answer before the working, a blank is never read
 * as zero, and every count names the limit that decides it.
 *
 * It's a first pass to quote from, and says so: it is not a structural check.
 *
 * Only the builder reads this file, by its own door (`@sh/shared/led-screen`): the server, which takes the rest of the
 * shared code whole, never loads the solver.
 */

/** A product as the builder reads it. */
export type ScreenProduct = Pick<Model, 'id' | 'name' | 'department' | 'category' | 'weightKg' | 'powerW' | 'lengthM' | 'dryHire'> & {
  aliases?: readonly string[]
  panel?: PanelFacts | null
  mistake?: boolean
  isCase?: boolean
}

/** No motor is asked to carry more than this much of its rating: a wall's weight is never shared evenly along a truss. */
export const MOTOR_SHARE = 0.75
/** Hang points and uprights are never further apart than this, in metres. */
export const MOST_SPACING_M = 3
/** The most wall an upright is asked to carry, in kilos. */
export const MOST_UPRIGHT_KG = 500
/** What a metre of 290 mm box truss weighs where its product doesn't say, in kilos. */
export const USUAL_TRUSS_KG_PER_M = 6.5
/** A base plate's size where its name doesn't say, in metres: the small end of what's usual, so nothing is flattered. */
export const USUAL_PLATE_M = 0.6
/** What a 16 A circuit is loaded to: four fifths of it, at 230 V. */
export const CIRCUIT_W = 230 * 16 * 0.8
/** What one Gigabit port carries at 60 Hz, 8 bit, in pixels: the planning figure processors are sized by. */
export const PORT_PIXELS = 650_000
/** The overturning safety factor a ground-stacked screen is held to. */
export const SAFETY = 1.5

const TRUSS_FACE_M = 0.29
const WALL_DEPTH_M = 0.1
const num = (x: number, places = 0) => x.toLocaleString('en-IE', { maximumFractionDigits: places })
/** Metres as they're said: "5 m", "4.5 m", "2.88 m". */
export const metresWords = (m: number) => `${num(m, 2)} m`
const kg = (x: number) => `${num(Math.round(x))} kg`
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`
const said = (m: ScreenProduct) => [m.name, ...(m.aliases ?? [])].join(', ')
const live = (models: readonly ScreenProduct[]) => models.filter((m) => !m.mistake && !m.isCase)
const lengthOf = (m: ScreenProduct) => m.lengthM ?? lengthFromName(m.name)

// The panel, and the screen it makes.

export interface PanelChoice {
  model: ScreenProduct
  /** It has its size, so a screen can be worked out from it at once. */
  sized: boolean
  /** Ours rather than hired in. */
  ours: boolean
}

/**
 * The panels to offer, the ones we hold first: products with a panel's size, and those that read like panels and
 * haven't been given one yet. Ours before hired in, sized before not, then by name.
 */
export function panelChoices(models: readonly ScreenProduct[]): PanelChoice[] {
  return live(models)
    .filter((m) => m.panel || looksLikePanel(m))
    .map((m) => ({ model: m, sized: !!m.panel, ours: !m.dryHire }))
    .sort((a, b) => Number(b.ours) - Number(a.ours) || Number(b.sized) - Number(a.sized) || a.model.name.localeCompare(b.model.name))
}

/** The whole panels nearest a size asked for, at least one each way: a screen is only ever built in whole panels. */
export function gridFor(panel: Pick<PanelFacts, 'widthMm' | 'heightMm'>, widthM: number, heightM: number): { cols: number; rows: number } {
  const whole = (m: number, mm: number, most: number) => Math.min(most, Math.max(1, Math.round((m * 1000) / mm)))
  return { cols: whole(widthM, panel.widthMm, MOST_SCREEN_COLS), rows: whole(heightM, panel.heightMm, MOST_SCREEN_ROWS) }
}

export interface ScreenFacts {
  cols: number
  rows: number
  /** Panels in one screen. */
  panels: number
  widthM: number
  heightM: number
  /** "16:9", or "1.67:1" where it isn't a tidy one. */
  ratio: string
  /** Null where the panel's pixels aren't given. */
  pixelsW: number | null
  pixelsH: number | null
  /** One screen's panels in kilos; null where the panel's weight isn't on its product. Never read as nothing. */
  weightKg: number | null
  /** What one screen draws at most, in watts; null where the panel's power isn't on its product. */
  powerW: number | null
  /** The 16 A circuits one screen takes, each loaded to four fifths; null without the power. */
  circuits: number | null
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

export function screenFacts(panel: PanelFacts, weightKg: number | null, powerW: number | null, cols: number, rows: number): ScreenFacts {
  const panels = cols * rows
  const w = cols * panel.widthMm
  const h = rows * panel.heightMm
  const g = gcd(w, h)
  const perCircuit = powerW ? Math.max(1, Math.floor(CIRCUIT_W / powerW)) : null
  return {
    cols,
    rows,
    panels,
    widthM: w / 1000,
    heightM: h / 1000,
    ratio: w / g <= 40 && h / g <= 40 ? `${w / g}:${h / g}` : `${(w / h).toFixed(2)}:1`,
    pixelsW: panel.pixelsW ? cols * panel.pixelsW : null,
    pixelsH: panel.pixelsH ? rows * panel.pixelsH : null,
    weightKg: weightKg ? Math.round(panels * weightKg * 10) / 10 : null,
    powerW: powerW ? panels * powerW : null,
    circuits: perCircuit ? Math.ceil(panels / perCircuit) : null,
  }
}

/** What the screen is called on the quote: "LED screen 5 × 3 m, hung". */
export function screenWhat(f: Pick<ScreenFacts, 'widthM' | 'heightM'>, stands: ScreenStands): string {
  return `LED screen ${num(f.widthM, 2)} × ${num(f.heightM, 2)} m, ${stands === 'hung' ? 'hung' : 'ground stacked'}`
}

/** What's printed under it: "10 panels wide by 6 high · 1,280 × 768 pixels", and "each" for more than one. */
export function screenIncludes(f: ScreenFacts, count: number): string {
  const grid = `${count > 1 ? 'Each ' : ''}${plural(f.cols, 'panel')} wide by ${num(f.rows)} high`
  return f.pixelsW && f.pixelsH ? `${grid} · ${num(f.pixelsW)} × ${num(f.pixelsH)} pixels` : grid
}

// The kit that goes with panels, found in the stock list by what it's called.

const BAR = /\b(fly(?:ing)? ?bars?|hanging (?:bars?|beams?)|rigging bars?|header bars?|bumpers?)\b/i
const TRUSS = /\btruss(?:ing)?\b/i
/** Truss that isn't a straight length, and things with truss in their name that aren't truss. */
const NOT_STRAIGHT = /\b(circles?|circular|curved?|corners?|blocks?|box(?:es)?|bases?|plates?|hinges?|clamps?|couplers?|pins?|doll(?:y|ies)|carts?|adapt[eo]rs?|sleeves?|towers?|rings?|arcs?|angles?|junctions?|tees?|cross(?:es)?|covers?|cases?|bags?|motors?)\b/i
const MOTOR = /\b(motors?|hoists?)\b/i
const CONTROL = /\bcon(?:tr|t)ol(?:ler)?s?\b/i
const NOT_A_MOTOR = /\b(cables?|looms?|links?|cases?|bags?|covers?|remotes?|distros?|truss|faders?)\b/i
const PLATE = /\bbase ?plates?\b/i
const NOT_A_TRUSS_PLATE = /\b(pipe|drape|stack|adapt[eo]rs?|speakers?|mics?|stands?)\b|d&b/i
const DISTRO = /\bdistro(?:s|bution)?\b/i
const FOR_SCREENS = /\b(video|led|screens?|soca|socapex)\b/i
const LED_PROCESSOR = /\bnova ?star|\bnovapro|\bvx ?\d|\bmctrl|\bbrompton|\btessera|\bcolorlight|\blinsn|\bled (?:wall |screen |video )?(?:processor|controller)s?\b|\bsending (?:box|card)/i

/**
 * What the processors we're likely to meet drive, from their makers' spec sheets: the pixels one loads, and its
 * Gigabit ports. Told by the model in the name; a processor not here is still offered, with its capacity to be checked.
 */
const PROCESSORS: readonly { is: RegExp; pixels: number; ports: number }[] = [
  { is: /\bvx ?2000/i, pixels: 13_000_000, ports: 20 },
  { is: /\bvx ?1000/i, pixels: 6_500_000, ports: 10 },
  { is: /\bvx ?600/i, pixels: 3_900_000, ports: 6 },
  { is: /\bvx ?400/i, pixels: 2_600_000, ports: 4 },
  { is: /\bvx ?16s/i, pixels: 10_400_000, ports: 16 },
  { is: /\bvx ?6s/i, pixels: 3_900_000, ports: 6 },
  { is: /\bvx ?4[su]?\b/i, pixels: 2_300_000, ports: 4 },
  { is: /\bmctrl ?4k/i, pixels: 8_800_000, ports: 16 },
  { is: /\bmctrl ?6[06]0/i, pixels: 2_300_000, ports: 4 },
  { is: /\bmctrl ?300/i, pixels: 1_300_000, ports: 2 },
  { is: /\bnova.*\bpro ?uhd ?jr/i, pixels: 10_400_000, ports: 16 },
  { is: /\bnova.*\bpro ?uhd/i, pixels: 8_800_000, ports: 16 },
  { is: /\bnova.*\bpro ?hd/i, pixels: 2_300_000, ports: 4 },
]

/**
 * A name as the two readers below take it: in lower case, with each run of spaces as one. Their patterns then ask for
 * one space at most and a number no longer than a real one, so none of them can be slow on a long name, whatever is
 * typed into it: a pattern that takes any run of digits or spaces goes over the same run again from each place in it.
 */
const plainName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ')

/** What a motor lifts, from its name: "1/2 tonne", "1 tonne", "CM 1000 kg", "250kg", "half tonne". */
export function liftFromName(name: string): number | null {
  const s = plainName(name).replace(/½/g, '1/2').replace(/¼/g, '1/4')
  const part = /(\d{1,3}) ?\/ ?(\d{1,3}) ?-? ?(?:tonnes?|tons?|t)\b/.exec(s)
  if (part && Number(part[2]) > 0) return Math.round((Number(part[1]) / Number(part[2])) * 1000)
  if (/\bhalf(?: a)?[ -]?(?:ton|tonne)\b/.test(s)) return 500
  if (/\bquarter(?: of a)?[ -]?(?:ton|tonne)\b/.test(s)) return 250
  const tonnes = /(\d{1,3}(?:[.,]\d{1,3})?) ?-? ?(?:tonnes?|tons?|t)\b/.exec(s)
  if (tonnes) return Math.round(Number(tonnes[1]!.replace(',', '.')) * 1000)
  const kilos = /(\d{2,5}) ?(?:kg|kgs|kilos?)\b/.exec(s)
  return kilos ? Number(kilos[1]) : null
}

/** How many ways a distro has, or how many motors a control runs, from its name: "18 way", "12way", "LV12 ch". */
export function waysFromName(name: string): number | null {
  const found = /(\d{1,3}) ?-? ?(?:ways?|ch|chan|channels?)\b/.exec(plainName(name))
  return found ? Number(found[1]) : null
}

/** A truss as its lengths: "H30V truss" in 1, 2 and 3 m. */
export interface TrussFamily {
  /** What picks it. */
  key: string
  name: string
  pieces: { model: ScreenProduct; lengthM: number }[]
  /** What a metre weighs, from the pieces that say; null where none does. */
  kgPerM: number | null
}

const familyKey = (m: ScreenProduct) =>
  nameWithoutLength(m.name)
    .toLowerCase()
    .replace(/\btruss(?:ing)?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** The straight truss in the stock list, by family: lengths of the same truss, told by the name without its length. */
export function trussFamilies(models: readonly ScreenProduct[]): TrussFamily[] {
  const straight = (m: ScreenProduct) => {
    const l = lengthOf(m)
    return !NOT_STRAIGHT.test(m.name) && l !== null && l >= 0.25 && l <= 6
  }
  const all = live(models)
  const named = all.filter((m) => (TRUSS.test(m.name) || TRUSS.test(m.category)) && straight(m))
  const keys = new Set(named.map(familyKey).filter(Boolean))
  // A length of the same truss whose name leaves the word out: "3m Black a type" beside "1m black a type truss".
  const more = all.filter((m) => !named.includes(m) && straight(m) && keys.has(familyKey(m)) && ['rigging', 'staging', 'lighting', 'other'].includes(m.department))
  const out = new Map<string, TrussFamily>()
  for (const m of [...named, ...more]) {
    const key = familyKey(m)
    if (!key) continue
    let f = out.get(key)
    if (!f) out.set(key, (f = { key, name: TRUSS.test(m.name) ? nameWithoutLength(m.name) : `${nameWithoutLength(m.name)} truss`, pieces: [], kgPerM: null }))
    const lengthM = lengthOf(m)!
    // One product a length: the first by name stands for it.
    if (!f.pieces.some((p) => p.lengthM === lengthM)) f.pieces.push({ model: m, lengthM })
  }
  for (const f of out.values()) {
    f.pieces.sort((a, b) => a.lengthM - b.lengthM)
    const weighed = f.pieces.filter((p) => p.model.weightKg)
    f.kgPerM = weighed.length ? Math.round((weighed.reduce((n, p) => n + p.model.weightKg! / p.lengthM, 0) / weighed.length) * 10) / 10 : null
  }
  return [...out.values()].sort((a, b) => b.pieces.length - a.pieces.length || a.name.localeCompare(b.name))
}

/**
 * The fewest lengths that reach at least `needM`, with the least over: [3, 2] for 5 m from 1, 2 and 3 m lengths.
 * Longer lengths are taken first where the count is the same.
 */
export function lengthsFor(lengths: readonly number[], needM: number): number[] {
  const tenths = [...new Set(lengths.map((l) => Math.round(l * 10)).filter((l) => l > 0))].sort((a, b) => b - a)
  const need = Math.max(1, Math.round(needM * 10 - 1e-6))
  if (!tenths.length) return []
  const top = need + tenths[0]!
  const fewest = new Array<number>(top + 1).fill(Infinity)
  const last = new Array<number>(top + 1).fill(0)
  fewest[0] = 0
  for (let t = 1; t <= top; t++)
    for (const l of tenths)
      if (l <= t && fewest[t - l]! + 1 < fewest[t]!) {
        fewest[t] = fewest[t - l]! + 1
        last[t] = l
      }
  let at = need
  while (at <= top && !Number.isFinite(fewest[at]!)) at++
  if (at > top) return []
  const out: number[] = []
  for (let t = at; t > 0; t -= last[t]!) out.push(last[t]! / 10)
  return out.sort((a, b) => b - a)
}

// The plan.

export const SCREEN_PARTS = ['panels', 'bars', 'truss', 'motors', 'control', 'plates', 'processor', 'distro'] as const
export type ScreenPart = (typeof SCREEN_PARTS)[number]

export interface PlanItem {
  modelId: string
  qty: number
}

export interface PlanRow {
  part: ScreenPart
  /** "Fly bars". */
  label: string
  /** What goes on the quote for it; none when nothing in the stock list fits. */
  items: PlanItem[]
  /** Why this many: the limit that decides it. */
  why: string
  /** What couldn't be worked out, and so wants a look. */
  check?: string
  /** The products, or truss, that could do it. More than one is a choice. */
  choices: { id: string; name: string }[]
  chosen: string | null
  /** Said in place of products when nothing in the stock list fits. */
  none?: string
}

export interface ScreenAsk {
  /** The panel's product, with its size and whatever else is known of it: as typed in the builder, before it's saved. */
  panel: ScreenProduct
  facts: PanelFacts
  cols: number
  rows: number
  /** How many screens like it. */
  count: number
  stands: ScreenStands
}

/** What picks between products that could each do a part, by part: a product's id, or a truss family's key. */
export type ScreenPicks = Partial<Record<ScreenPart, string>>

export interface PlanLookups {
  /** A product's day price in cents, undefined for none: one that's charged for is offered before one that isn't. */
  price?: (modelId: string) => number | undefined
  /** How many are free on the job's days, undefined where it can't run short or isn't known: enough free comes first. */
  free?: (modelId: string) => number | undefined
  /**
   * What was chosen last time, by part: taken again where it does the job with no more than the plan's own choice
   * would, so the office's usual truss comes back but a half-tonne motor isn't sent to a wall that wants a tonne.
   */
  usual?: ScreenPicks
}

export interface ScreenPlan {
  facts: ScreenFacts
  rows: PlanRow[]
  /** How it hangs or stands, in a sentence or two: read out above the list. */
  stands: string[]
  /** What wants a look before it's built, said in the warning's tone: ballast it needs, or a stack that doesn't stand as worked out. */
  warns: string[]
  /** What it took as read and what it couldn't work out, for whoever checks it. */
  working: string[]
}

/** In order of preference: the lowest of each key first, the keys in turn. */
function preferred<T>(list: readonly T[], ...keys: ((x: T) => number)[]): T[] {
  return [...list].sort((a, b) => {
    for (const k of keys) {
      const d = k(a) - k(b)
      if (d) return d
    }
    return 0
  })
}

/**
 * Everything a screen takes, part by part, from what the stock list holds. `picks` chooses between products that could
 * each do a part; left out, the plan takes the one that does it with the fewest, has a price and is free.
 */
export function screenPlan(ask: ScreenAsk, models: readonly ScreenProduct[], picks: ScreenPicks = {}, look: PlanLookups = {}): ScreenPlan {
  const { panel, stands } = ask
  const count = Math.max(1, Math.round(ask.count))
  const f = screenFacts(ask.facts, panel.weightKg, panel.powerW, ask.cols, ask.rows)
  const all = live(models).filter((m) => m.id !== panel.id && !m.panel)
  const priced = (id: string) => ((look.price?.(id) ?? 0) > 0 ? 0 : 1)
  const enough = (id: string, qty: number) => {
    const free = look.free?.(id)
    return free !== undefined && free < qty ? 1 : 0
  }
  /** The one asked for; else the usual one where it takes no more than the first would; else the first. */
  const pick = <T,>(part: ScreenPart, options: readonly T[], idOf: (x: T) => string, takes: (x: T) => number = () => 0): T | undefined => {
    const asked = options.find((o) => idOf(o) === picks[part])
    if (asked) return asked
    const first = options[0]
    const usual = options.find((o) => idOf(o) === look.usual?.[part])
    return usual && first && takes(usual) <= takes(first) ? usual : first
  }
  const rows: PlanRow[] = []
  const working: string[] = []
  const how: string[] = []
  const warns: string[] = []
  const twice = count > 1 ? `, for ${num(count)} screens` : ''

  rows.push({
    part: 'panels',
    label: 'Panels',
    items: [{ modelId: panel.id, qty: f.panels * count }],
    why: `${num(f.cols)} across by ${num(f.rows)} down${twice}`,
    choices: [{ id: panel.id, name: nameWithLength(panel) }],
    chosen: panel.id,
  })

  // Fly bars: the panel maker's own first. One a column, unless the bar's length says it spans more.
  const maker = panel.name.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  const sameMaker = (m: ScreenProduct) => (maker.length >= 3 && said(m).toLowerCase().includes(maker) ? 0 : 1)
  const bars = preferred(
    all.filter((m) => BAR.test(m.name) && (m.department === 'video' || sameMaker(m) === 0)),
    sameMaker,
    (m) => priced(m.id),
    (m) => (m.dryHire ? 1 : 0)
  )
  const spans = (m: ScreenProduct) => {
    const l = lengthOf(m)
    return l ? Math.max(1, Math.floor((l * 1000) / ask.facts.widthMm + 1e-9)) : 1
  }
  const bar = pick('bars', bars, (m) => m.id, (m) => Math.ceil(f.cols / spans(m)))
  const perBar = bar ? spans(bar) : 1
  const barsEach = Math.ceil(f.cols / perBar)
  rows.push({
    part: 'bars',
    label: 'Fly bars',
    items: bar ? [{ modelId: bar.id, qty: barsEach * count }] : [],
    why:
      (stands === 'hung' ? (perBar > 1 ? `One for every ${num(perBar)} columns of panels, to hang them from` : 'One for each column of panels, to hang them from') : perBar > 1 ? `One for every ${num(perBar)} columns, to stand the bottom row on` : 'One for each column, to stand the bottom row on') +
      twice,
    ...(stands === 'ground' ? { check: 'Take these off if your bars only hang.' } : {}),
    choices: bars.map((m) => ({ id: m.id, name: nameWithLength(m) })),
    chosen: bar?.id ?? null,
    ...(bar ? {} : { none: 'No fly bar found in the stock list.' }),
  })
  const barsKg = bar?.weightKg ? barsEach * bar.weightKg : null

  const families = trussFamilies(all)
  const processorsRow = () => {
    const found = preferred(
      all
        .filter((m) => LED_PROCESSOR.test(said(m)) || (m.department === 'video' && /\bprocessors?\b/i.test(m.name)))
        .map((m) => ({ m, can: PROCESSORS.find((p) => p.is.test(said(m))) })),
      (p) => (p.can ? 0 : 1),
      // The fewest that drive it, then the smallest that does: a big processor isn't sent to a small screen.
      (p) => (p.can && f.pixelsW && f.pixelsH ? processorsFor(p.can, f.pixelsW * f.pixelsH, count) : 1),
      (p) => priced(p.m.id),
      (p) => p.can?.pixels ?? 0,
      (p) => enough(p.m.id, 1)
    )
    const pixels = f.pixelsW && f.pixelsH ? f.pixelsW * f.pixelsH : null
    const p = pick('processor', found, (x) => x.m.id, (x) => (x.can && pixels ? processorsFor(x.can, pixels, count) : 1))
    const need = p?.can && pixels ? processorsFor(p.can, pixels, count) : 1
    const row: PlanRow = {
      part: 'processor',
      label: 'Processor',
      items: p ? [{ modelId: p.m.id, qty: need }] : [],
      why: !p
        ? ''
        : p.can && pixels
          ? `Drives ${millions(p.can.pixels)} pixels from ${num(p.can.ports)} ports; ${count > 1 ? 'these screens have' : 'this screen has'} ${num(pixels * count)}`
          : 'One to drive it',
      ...(p && !pixels ? { check: "The panel's pixels aren't given, so check it drives this screen." } : p && !p.can ? { check: `Check it drives ${num(pixels! * count)} pixels: what it loads isn't known here.` } : {}),
      choices: found.map((x) => ({ id: x.m.id, name: nameWithLength(x.m) })),
      chosen: p?.m.id ?? null,
      ...(p ? {} : { none: 'No LED processor found in the stock list.' }),
    }
    return row
  }
  const distroRow = () => {
    const circuits = f.circuits === null ? null : f.circuits * count
    const found = preferred(
      all.filter((m) => DISTRO.test(m.name) && FOR_SCREENS.test(said(m))).map((m) => ({ m, ways: waysFromName(m.name) })),
      (d) => (circuits && d.ways ? Math.ceil(circuits / d.ways) : 1),
      (d) => priced(d.m.id),
      (d) => enough(d.m.id, 1),
      (d) => (d.ways ? 0 : 1)
    )
    const d = pick('distro', found, (x) => x.m.id, (x) => (circuits && x.ways ? Math.ceil(circuits / x.ways) : 1))
    const need = d?.ways && circuits ? Math.ceil(circuits / d.ways) : 1
    const row: PlanRow = {
      part: 'distro',
      label: 'Power distro',
      items: d ? [{ modelId: d.m.id, qty: need }] : [],
      why: !d ? '' : circuits && d.ways ? `${num(d.ways)} ways; ${count > 1 ? 'these screens take' : 'this screen takes'} ${plural(circuits, 'circuit')} of 16 A` : circuits ? `${plural(circuits, 'circuit')} of 16 A to feed` : 'One to feed it',
      ...(d && !circuits ? { check: "The panel's power isn't on its product, so check one is enough." } : d && !d.ways ? { check: `Check it has ${plural(circuits!, 'way')}: its name doesn't say.` } : {}),
      choices: found.map((x) => ({ id: x.m.id, name: nameWithLength(x.m) })),
      chosen: d?.m.id ?? null,
      ...(d ? {} : { none: 'No video power distro found in the stock list.' }),
    }
    return row
  }

  if (stands === 'hung') {
    // Truss across the top, the fewest lengths that reach the screen's width.
    const runOf = (x: TrussFamily) => lengthsFor(x.pieces.map((p) => p.lengthM), f.widthM)
    const across = preferred(
      families,
      (x) => (piecesOf(x, runOf(x), count).some((i) => enough(i.modelId, i.qty)) ? 1 : 0),
      (x) => (x.pieces.some((p) => priced(p.model.id)) ? 1 : 0),
      (x) => runOf(x).length
    )
    const family = pick('truss', across, (x) => x.key, (x) => runOf(x).length)
    const run = family ? runOf(family) : []
    const runM = run.reduce((n, l) => n + l, 0)
    rows.push({
      part: 'truss',
      label: 'Truss',
      items: family ? piecesOf(family, run, count) : [],
      why: family ? `${metresWords(runM)} across the top of a ${metresWords(f.widthM)} screen${twice}` : '',
      choices: across.map((x) => ({ id: x.key, name: x.name })),
      chosen: family?.key ?? null,
      ...(family ? {} : { none: 'No straight truss found in the stock list.' }),
    })
    // What hangs: the panels, their bars and the truss. Without the panel's weight there's no load to share out.
    const trussKg = family ? runM * (family.kgPerM ?? USUAL_TRUSS_KG_PER_M) : 0
    const hungKg = f.weightKg === null ? null : f.weightKg + (barsKg ?? 0) + trussKg
    const bySpacing = Math.max(2, Math.ceil(f.widthM / MOST_SPACING_M - 1e-9) + 1)
    const pointsFor = (lift: number | null) => (hungKg !== null && lift ? Math.max(bySpacing, Math.ceil(hungKg / (lift * MOTOR_SHARE) - 1e-9)) : bySpacing)
    const motors = preferred(
      all.filter((m) => MOTOR.test(m.name) && !CONTROL.test(m.name) && !NOT_A_MOTOR.test(m.name)).map((m) => ({ m, lift: liftFromName(m.name) })),
      (x) => (hungKg !== null && !x.lift ? 1 : 0),
      (x) => pointsFor(x.lift),
      (x) => priced(x.m.id),
      (x) => enough(x.m.id, pointsFor(x.lift) * count),
      (x) => x.lift ?? Infinity,
      (x) => (x.m.dryHire ? 1 : 0)
    )
    const motor = pick('motors', motors, (x) => x.m.id, (x) => (hungKg !== null && !x.lift ? Infinity : pointsFor(x.lift)))
    const points = pointsFor(motor?.lift ?? null)
    const share = hungKg === null ? null : hungKg / points
    const byWeight = points > bySpacing
    rows.push({
      part: 'motors',
      label: 'Motors',
      items: motor ? [{ modelId: motor.m.id, qty: points * count }] : [],
      why: !motor
        ? ''
        : byWeight
          ? `Weight decides: ${kg(hungKg!)} hangs, and each is kept to three quarters of its ${kg(motor.lift!)}${twice}`
          : `One every ${num(MOST_SPACING_M)} m or less across ${metresWords(f.widthM)}${share !== null ? `, about ${kg(share)} each` : ''}${twice}`,
      ...(motor && hungKg === null
        ? { check: "The panel's weight isn't on its product, so these are by spacing alone: check what they carry." }
        : motor && !motor.lift
          ? { check: `Check each lifts ${kg(share! / MOTOR_SHARE)} or more: its name doesn't say what it lifts.` }
          : {}),
      choices: motors.map((x) => ({ id: x.m.id, name: nameWithLength(x.m) })),
      chosen: motor?.m.id ?? null,
      ...(motor ? {} : { none: 'No motor found in the stock list.' }),
    })
    const controls = preferred(
      all.filter((m) => MOTOR.test(m.name) && CONTROL.test(m.name)).map((m) => ({ m, runs: waysFromName(m.name) })),
      (c) => (c.runs ? Math.ceil((points * count) / c.runs) : 1),
      (c) => (c.runs ? 0 : 1),
      (c) => priced(c.m.id),
      (c) => enough(c.m.id, 1)
    )
    const control = pick('control', controls, (x) => x.m.id, (c) => (c.runs ? Math.ceil((points * count) / c.runs) : 1))
    rows.push({
      part: 'control',
      label: 'Motor control',
      items: control ? [{ modelId: control.m.id, qty: control.runs ? Math.ceil((points * count) / control.runs) : 1 }] : [],
      why: !control ? '' : control.runs ? `Runs ${num(control.runs)} motors; there are ${num(points * count)}` : `For ${plural(points * count, 'motor')}`,
      ...(control && !control.runs ? { check: `Check it runs ${plural(points * count, 'motor')}: its name doesn't say how many.` } : {}),
      choices: controls.map((x) => ({ id: x.m.id, name: nameWithLength(x.m) })),
      chosen: control?.m.id ?? null,
      ...(control ? {} : { none: 'No motor control found in the stock list.' }),
    })
    const hangs = count > 1 ? 'Each hangs' : 'Hangs'
    how.push(
      hungKg === null
        ? `${hangs} from ${plural(points, 'point')}, one every ${num(MOST_SPACING_M)} m or less. What they carry isn't worked out: the panel's weight isn't on its product.`
        : `${hangs} from ${plural(points, 'point')}: about ${kg(hungKg)} in all, ${kg(share!)} a point if it's shared evenly.`
    )
    if (hungKg !== null) {
      if (bar && barsKg === null) working.push("The fly bars' weight isn't on their product, so it isn't counted in what hangs.")
      if (family && family.kgPerM === null) working.push(`The truss's weight isn't on its product: taken as ${num(USUAL_TRUSS_KG_PER_M, 1)} kg a metre.`)
      working.push(`No motor is asked for more than three quarters of what it lifts, since a wall's weight is never shared evenly.`)
    }
  } else {
    // Stood on the floor against truss uprights, each on its own base plate: the tipping point project's solver says how many.
    const plates = (family: TrussFamily | undefined) =>
      preferred(
        all.filter((m) => PLATE.test(m.name) && !NOT_A_TRUSS_PLATE.test(m.name)),
        // The plate made for the truss first: "H30V 1m base plate" for H30V truss.
        (m) => (family && family.key.split(' ').some((w) => w.length >= 3 && m.name.toLowerCase().includes(w)) ? 0 : 1),
        (m) => priced(m.id),
        (m) => (m.dryHire ? 1 : 0)
      )
    // The truss a base plate is made for comes first, where there's a choice of truss.
    const anyPlate = all.filter((m) => PLATE.test(m.name) && !NOT_A_TRUSS_PLATE.test(m.name))
    const upOf = (x: TrussFamily) => lengthsFor(x.pieces.map((p) => p.lengthM), f.heightM)
    const suited = preferred(
      families,
      (x) => (anyPlate.some((m) => x.key.split(' ').some((w) => w.length >= 3 && m.name.toLowerCase().includes(w))) ? 0 : 1),
      (x) => (x.pieces.some((p) => priced(p.model.id)) ? 1 : 0),
      (x) => upOf(x).length
    )
    const family = pick('truss', suited, (x) => x.key, (x) => upOf(x).length)
    const found = plates(family)
    const plate = pick('plates', found, (m) => m.id)
    const up = family ? upOf(family) : []
    const upM = up.reduce((n, l) => n + l, 0) || f.heightM
    const plateM = plate ? lengthOf(plate) : null
    const s = standsOn(
      { widthM: f.widthM, heightM: f.heightM, kgPerM2: f.weightKg === null ? null : f.weightKg / (f.widthM * f.heightM) },
      { heightM: upM, kgPerM: family?.kgPerM ?? null },
      { sizeM: plateM, kg: plate?.weightKg ?? null }
    )
    const decided =
      s.decides === 'fit'
        ? `Only ${plural(s.uprights, 'base plate')} ${s.uprights === 1 ? 'fits' : 'fit'} across ${metresWords(f.widthM)}`
        : s.decides === 'load'
          ? `Weight decides: no upright carries more than ${kg(MOST_UPRIGHT_KG)} of wall`
          : s.decides === 'stability'
            ? 'Standing up decides: this many to hold it at a safety factor of 1.5'
            : s.uprights === 1
              ? 'One behind a screen this narrow'
              : `One every ${num(MOST_SPACING_M)} m or less across ${metresWords(f.widthM)}`
    rows.push({
      part: 'truss',
      label: 'Truss uprights',
      items: family ? piecesOf(family, up, s.uprights * count) : [],
      why: family ? `${plural(s.uprights, 'upright')} of ${metresWords(upM)} behind a ${metresWords(f.heightM)} screen${twice}. ${decided}` : '',
      ...(s.squeezed
        ? { check: 'Fewer uprights than the spacing asks for: have it looked at before it is built.' }
        : s.overloaded
          ? { check: `Each upright carries more than the ${kg(MOST_UPRIGHT_KG)} of wall it's kept to: have it looked at before it is built.` }
          : {}),
      choices: suited.map((x) => ({ id: x.key, name: x.name })),
      chosen: family?.key ?? null,
      ...(family ? {} : { none: 'No straight truss found in the stock list.' }),
    })
    rows.push({
      part: 'plates',
      label: 'Base plates',
      items: plate ? [{ modelId: plate.id, qty: s.uprights * count }] : [],
      why: `One under each upright${twice}`,
      choices: found.map((m) => ({ id: m.id, name: nameWithLength(m) })),
      chosen: plate?.id ?? null,
      ...(plate ? {} : { none: 'No truss base plate found in the stock list.' }),
    })
    how.push(
      `${count > 1 ? 'Each stands' : 'Stands'} against ${s.uprights === 1 ? 'one truss upright on a base plate' : `${num(s.uprights)} truss uprights, ${metresWords(Math.round(s.spacingM! * 100) / 100)} apart, each on a base plate`}.`
    )
    if (f.weightKg === null) how.push("Whether it stands safely isn't worked out: the panel's weight isn't on its product.")
    else if (s.safe === false && s.ballastKg && Number.isFinite(s.ballastKg)) warns.push(`Wants about ${kg(Math.ceil(s.ballastKg / 5) * 5)} of ballast on each base plate to stand safely, even indoors.`)
    else if (s.safe === false) warns.push('It does not stand safely on its own as worked out here: it wants ballast or bracing, and a proper look.')
    else if (s.windMs === null) how.push("Stands without ballast indoors. The wind it holds to isn't worked out: the base plate's weight isn't on its product.")
    else if (!Number.isFinite(s.windMs)) how.push('Stands without ballast indoors.')
    else {
      const b = LedWall.beaufort(s.windMs)
      how.push(`Stands without ballast indoors. Outdoors it holds to a wind of about ${num(Math.floor(s.windMs))} m/s (${num(Math.floor(s.windMs * 3.6))} km/h, ${(LedWall.BEAUFORT_NAMES[b] ?? '').toLowerCase()}) before it wants ballast.`)
    }
    if (f.weightKg !== null) {
      working.push(`Worked out with the tipping point solver at a safety factor of ${num(SAFETY, 1)}: the wall on the front of the uprights, no upright carrying more than ${kg(MOST_UPRIGHT_KG)}.`)
      if (family && family.kgPerM === null) working.push(`The truss's weight isn't on its product: taken as ${num(USUAL_TRUSS_KG_PER_M, 1)} kg a metre.`)
      if (plate && plateM === null) working.push(`The base plate's size isn't in its name: taken as ${metresWords(USUAL_PLATE_M)} square.`)
    }
  }

  rows.push(processorsRow(), distroRow())
  if (f.circuits !== null) working.push(`Power is counted in 16 A circuits loaded to four fifths, ${num(Math.round(CIRCUIT_W))} W each.`)
  working.push('Cables, slings and shackles are not counted: add what the job takes as kit.')
  return { facts: f, rows, stands: how, warns, working }
}

const millions = (pixels: number) => `${num(pixels / 1_000_000, 1)} million`

/** How many of a processor drive the screens: enough for the pixels, and a port for each 650,000 pixels of each screen. */
function processorsFor(can: { pixels: number; ports: number }, pixels: number, count: number): number {
  const ports = Math.ceil(pixels / PORT_PIXELS) * count
  return Math.max(1, Math.ceil((pixels * count) / can.pixels), Math.ceil(ports / can.ports))
}

/** A run of lengths as products and how many of each, `times` over. */
function piecesOf(family: TrussFamily, run: readonly number[], times: number): PlanItem[] {
  const out: PlanItem[] = []
  for (const l of run) {
    const piece = family.pieces.find((p) => p.lengthM === l)
    if (!piece) continue
    const had = out.find((i) => i.modelId === piece.model.id)
    if (had) had.qty += times
    else out.push({ modelId: piece.model.id, qty: times })
  }
  return out
}

interface Standing {
  uprights: number
  /** Which limit set the count: how far apart, the weight each carries, standing up, or how many base plates fit across. */
  decides: 'spacing' | 'load' | 'stability' | 'fit'
  /** Centre to centre; null for one upright. */
  spacingM: number | null
  /** Whether it stands at the safety factor in still air; null where the wall's weight isn't known. */
  safe: boolean | null
  /** Ballast each plate wants in still air, in kilos; null where it isn't worked out. */
  ballastKg: number | null
  /** The wind at which the safety factor runs out, in m/s; null where it isn't worked out. */
  windMs: number | null
  /** Fewer uprights than the rules ask for, since no more base plates fit across. */
  squeezed: boolean
  /** An upright carries more wall than it's kept to, since no more of them fit. */
  overloaded: boolean
}

/**
 * A ground-stacked wall on truss uprights, each on its own base plate: how many, by the tipping point project's solver
 * in still air with no ballast. Without the wall's weight only the spacing can be said, so only the spacing is.
 */
export function standsOn(
  wall: { widthM: number; heightM: number; kgPerM2: number | null },
  truss: { heightM: number; kgPerM: number | null },
  plate: { sizeM: number | null; kg: number | null }
): Standing {
  const plateM = plate.sizeM ?? USUAL_PLATE_M
  const fit = Math.max(1, Math.floor(wall.widthM / plateM + 1e-9))
  if (wall.kgPerM2 === null) {
    const wanted = wall.widthM < 2 * TRUSS_FACE_M ? 1 : Math.max(2, Math.ceil((wall.widthM - TRUSS_FACE_M) / MOST_SPACING_M - 1e-9) + 1)
    const n = Math.min(wanted, fit)
    return { uprights: n, decides: n < wanted ? 'fit' : 'spacing', spacingM: n > 1 ? (wall.widthM - TRUSS_FACE_M) / (n - 1) : null, safe: null, ballastKg: null, windMs: null, squeezed: n < wanted, overloaded: false }
  }
  const input = {
    wallWidth: wall.widthM,
    wallHeight: wall.heightM,
    wallBottom: 0.02,
    wallDepth: WALL_DEPTH_M,
    wallArealMass: wall.kgPerM2,
    trussHeight: truss.heightM,
    trussDepth: TRUSS_FACE_M,
    trussLinearMass: truss.kgPerM ?? USUAL_TRUSS_KG_PER_M,
    plateFront: plateM / 2,
    plateBack: plateM / 2,
    plateWidth: plateM,
    // A plate whose weight isn't known holds nothing down here: the count is then the least it could be flattered by.
    plateMass: plate.kg ?? 0,
    ballastMass: 0,
    windSpeed: 0,
    safetyFactor: SAFETY,
    forceCoefficient: 1.3,
    maxSpacing: MOST_SPACING_M,
    maxLoadPerUpright: MOST_UPRIGHT_KG,
  }
  let r = LedWall.solve(input)
  // The limit that set the count, of those a count can meet: one that no number of uprights meets (a stack that
  // won't stand however many hold it) is said as what it wants instead, by `safe` and the ballast.
  const met = r.constraints.filter((c) => Number.isFinite(c.n))
  let decides: Standing['decides'] = met.reduce((worst, c) => (c.n > worst.n ? c : worst), met[0] ?? r.governingConstraint)?.id ?? 'spacing'
  let squeezed = false
  // More uprights than base plates fit side by side: as many as do fit, said as that.
  if (r.uprights > fit || (r.uprights > 1 && r.spacing + 1e-9 < plateM)) {
    const n = Math.max(1, Math.min(r.uprights, fit))
    squeezed = n < r.uprights
    r = LedWall.solve({ ...input, uprights: n })
    decides = 'fit'
  }
  const weighed = plate.kg !== null
  return {
    uprights: r.uprights,
    decides,
    spacingM: r.uprights > 1 ? r.spacing : null,
    safe: r.passes,
    ballastKg: weighed ? r.ballastNeededPerUpright : null,
    windMs: weighed && r.passes ? r.limitingWindSpeed : null,
    squeezed,
    overloaded: r.wallMassPerUpright > MOST_UPRIGHT_KG + 1e-6,
  }
}
