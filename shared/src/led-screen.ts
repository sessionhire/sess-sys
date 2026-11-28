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
 * The data lines are counted as a screen is cabled (ADR 0208): each a tidy block of whole panels, no more than a port
 * carries, with a data cable for every line or, by one tick, fibre converters and a fibre in their place. A backup on
 * every line (ADR 0209) is one more tick: a second port for each, and as much again of what carries them to the screen.
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
/** What one Gigabit port carries at 60 Hz, 8 bit, in pixels: the planning figure NovaStar's older sheets size a processor by. */
export const PORT_PIXELS = 650_000
/** The same by the maker's own sum, which its COEX range (MX, KU) is held to: pixels × 24 bits × 60 Hz, under 95% of a gigabit. */
export const COEX_PORT_PIXELS = 659_722
/** The narrowest a panel is counted on a COEX line, in pixels: one narrower takes as much of the line as if it were this wide. */
export const COEX_THIN_PIXELS = 128
/** The longest data cable sent from a processor to a screen, in metres: as far as CAT5e carries a line. */
export const MOST_DATA_CABLE_M = 100
/** The data lines one fibre converter carries: ten on NovaStar's CVT10 Pro, the one whose sheet was read. */
export const CONVERTER_LINES = 10
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

/** What's printed under it: "10 panels wide by 6 high · 1,280 × 768 pixels", "each" for more than one, and that its data lines have a backup where they do. */
export function screenIncludes(f: ScreenFacts, count: number, backup = false): string {
  const grid = `${count > 1 ? 'Each ' : ''}${plural(f.cols, 'panel')} wide by ${num(f.rows)} high`
  return [grid, ...(f.pixelsW && f.pixelsH ? [`${num(f.pixelsW)} × ${num(f.pixelsH)} pixels`] : []), ...(backup ? ['a backup on every data line'] : [])].join(' · ')
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
/** The box that puts a processor's data lines on one fibre and takes them off it at the screen: NovaStar's CVT10 Pro, or anything said to be one. */
const FIBRE_CONVERTER = /\bcvt(?![a-z])|\b(?:fib(?:er|re)|optical|media) ?conver(?:ter|tor)s?\b/i
/** What a processor's maker also makes that drives nothing, with that converter: the card inside a panel. */
const RECEIVING_CARD = /\breceiving cards?\b/i
/** A fibre to run between two converters: a length or a drum of it, by its own name or its connector's, not the patch leads, modules and sockets that go with it. */
const FIBRE_RUN = /\bfib(?:er|re)s?\b|\boptical\b|\bopti(?:cal)? ?con\b/i
const NOT_A_FIBRE_RUN =
  /\b(?:conver(?:ter|tor)s?|patch(?:es)?|modules?|sfps?|couplers?|barrels?|connectors?|cleaners?|testers?|tools?|adapt[eo]rs?|attenuators?|sockets?|panels?|plates?|tails?|pigtails?|breakouts?|cases?|kits?|switch(?:es)?|multiplexers?)\b/i
/** A cable that takes one data line from a processor to the screen, by what it's called, whichever department holds it. */
const DATA_CABLE = /\bcat ?[5-8][ae]?\b|\bether ?con\b|\b(?:data|network|ethernet|lan) (?:cables?|leads?)\b|\brj ?45 (?:cables?|leads?)\b/i
/** What has one of those words in its name and isn't a cable for one line: a multicore, the short link between two panels, a box, an adapter. */
const NOT_A_DATA_CABLE =
  /\b(?:multi ?cores?|looms?|snakes?|adapt[eo]rs?|couplers?|barrels?|joiners?|connectors?|plugs?|crimp(?:er|ing)?s?|tools?|testers?|splitters?|switch(?:es)?|patch ?(?:bays?|panels?)|panel mounts?|stage ?box(?:es)?|links?|dmx|nodes?|box(?:es)?|extenders?|senders?|receivers?|hdmi|sdi|baluns?|kvm|usb|dante|racks?|sockets?|plates?|cases?|bags?|conver(?:ter|tor)s?)\b/i

/** What a processor drives, from its maker's spec sheet. */
interface Drives {
  /** The pixels one loads in all. */
  pixels: number
  /** Its Gigabit ports. */
  ports: number
  /** The pixels one of those ports carries, where its maker gives another figure than `PORT_PIXELS`. */
  line?: number
  /** The widest and tallest picture it sends, in pixels. Left out where its sheet doesn't say, and then not checked. */
  widest?: number
  tallest?: number
  /** The narrowest a panel is counted on a line, in pixels: one narrower takes as much of the line as if it were this wide. */
  thin?: number
  /** A line needn't be a tidy block of panels: it's counted by its panels' own pixels, so it can carry on from one column into part of the next. */
  runsOn?: boolean
  /** More ports, on top of `ports`, that only leave by fibre, and what its maker says the mode that opens them wants. */
  byFibre?: number
  byFibreWants?: string
  /** It has fibre outputs of its own, each carrying this many of its data lines: a converter is then only wanted at the screen. */
  fibre?: number
  /** Its maker's sheet doesn't say it backs up one port with another: asked to be checked where a backup is wanted. */
  backupUnsaid?: true
}

/** What NovaStar's COEX range (MX, KU) has in common, from its own wiki: what a port carries, and how a line is counted. */
const COEX = { line: COEX_PORT_PIXELS, thin: COEX_THIN_PIXELS, runsOn: true } as const

/**
 * What the processors we're likely to meet drive, each from its maker's own sheet (the research and its sources are in
 * docs/research/led-processors.md). Told by the model in the name, the longer name before the one it starts with: a VX400s is
 * not a VX400, nor an MCTRL660 PRO an MCTRL660. A processor not here is still offered, with its capacity to be checked.
 */
const PROCESSORS: readonly ({ is: RegExp } & Drives)[] = [
  { is: /\bvx ?2000/i, pixels: 13_000_000, ports: 20, widest: 16_384, tallest: 8_192 },
  { is: /\bvx ?1000/i, pixels: 6_500_000, ports: 10, widest: 10_240, tallest: 8_192 },
  { is: /\bvx ?600/i, pixels: 3_900_000, ports: 6, widest: 10_240, tallest: 8_192 },
  { is: /\bvx ?400s/i, pixels: 2_300_000, ports: 4 },
  { is: /\bvx ?400/i, pixels: 2_600_000, ports: 4, widest: 10_240, tallest: 8_192 },
  { is: /\bvx ?16s/i, pixels: 10_400_000, ports: 16, widest: 16_384, tallest: 8_192 },
  { is: /\bvx ?6s/i, pixels: 3_900_000, ports: 6, widest: 4_096, tallest: 4_096 },
  { is: /\bvx ?4[su]?\b/i, pixels: 2_300_000, ports: 4, widest: 3_840, tallest: 1_920, backupUnsaid: true },
  // NovaStar's COEX range, from its own wiki (coex.wiki) rather than the first sheets: what each loads at 60 Hz, what a port
  // carries, and the widest and tallest screen each sends. Each sends all its ports down one fibre. An MX40 Pro sends ten
  // down each of four in its 40-port mode, where ports 21 to 40 only leave by fibre: still 9 million pixels in all.
  { is: /\bmx ?40(?!\d)/i, pixels: 9_000_000, ports: 20, ...COEX, widest: 16_384, tallest: 16_384, byFibre: 20, byFibreWants: 'VMP and its firmware at 1.4.0 or later', fibre: 10 },
  { is: /\bmx ?30(?!\d)/i, pixels: 6_500_000, ports: 10, ...COEX, widest: 16_384, tallest: 16_384, fibre: 10 },
  { is: /\bmx ?20(?!\d)/i, pixels: 3_900_000, ports: 6, ...COEX, widest: 4_096, tallest: 4_096, fibre: 6 },
  { is: /\bku ?20(?!\d)/i, pixels: 3_900_000, ports: 6, ...COEX, widest: 4_096, tallest: 4_096, fibre: 6 },
  // 3840 by 2160 on its own sheet; the maker's 2021 catalogue says 4096 by 2160, and the sheet is the one kept to.
  { is: /\bmctrl ?4k/i, pixels: 3_840 * 2_160, ports: 16, widest: 3_840, tallest: 3_840 },
  { is: /\bmctrl ?660 ?pro/i, pixels: 2_300_000, ports: 6, widest: 3_840, tallest: 3_840 },
  { is: /\bmctrl ?660/i, pixels: 2_300_000, ports: 4, widest: 3_840, tallest: 3_840 },
  { is: /\bmctrl ?600/i, pixels: 2_300_000, ports: 4, widest: 3_840, tallest: 2_560 },
  { is: /\bmctrl ?300/i, pixels: 1_300_000, ports: 2, widest: 2_048, tallest: 1_200 },
  // As they're said as well as as they're sold: "UHD Junior", "UHD Jnr", "NovaPro UHD Jr", "Nova star pro UHD". A UHD Jr
  // sends eight lines down each of its two fibres.
  { is: /uhd[ -]?j(?:r|nr|unior)/i, pixels: 10_400_000, ports: 16, widest: 16_384, tallest: 8_192, fibre: 8 },
  { is: /\bnova ?(?:star)? ?pro[ -]?uhd/i, pixels: 8_800_000, ports: 16, widest: 8_192, tallest: 8_192 },
  { is: /\bnova ?(?:star)? ?pro[ -]?hd/i, pixels: 2_300_000, ports: 4, widest: 3_840, tallest: 1_920 },
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

export const SCREEN_PARTS = ['panels', 'bars', 'truss', 'motors', 'control', 'plates', 'processor', 'data', 'fibre', 'backup', 'distro'] as const
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
  /** The data lines go to the screen by fibre: asked for only where the stock list holds a fibre converter, and left out otherwise. */
  fibre?: boolean
  /** Every data line has a backup: it runs through its panels and back into a second port, which takes over if the first feed fails. */
  backup?: boolean
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
  /** The data lines one screen takes, as it's cabled; null where the panel's pixels aren't given. */
  lines: number | null
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
  const picture = f.pixelsW && f.pixelsH ? { cols: f.cols, rows: f.rows, pixelsW: f.pixelsW, pixelsH: f.pixelsH } : null
  // What takes the data lines to the screen by fibre. It's only asked about where the stock list holds a converter.
  const converters = preferred(
    all.filter((m) => FIBRE_CONVERTER.test(said(m))),
    (m) => priced(m.id),
    (m) => (m.dryHire ? 1 : 0)
  )
  const byFibre = !!ask.fibre && converters.length > 0
  const cables = all.filter((m) => DATA_CABLE.test(m.name) && !NOT_A_DATA_CABLE.test(m.name) && (lengthOf(m) ?? 0) <= MOST_DATA_CABLE_M)
  // A backup is asked for only where there's something to run it with: a data cable, or the converters.
  const backed = !!ask.backup && (byFibre || cables.length > 0)
  /** The processor, and how it takes the screen's data lines: each with a backup, or without. */
  const processors = (backup: boolean) => {
    const found = preferred(
      all
        .map((m) => ({ m, can: PROCESSORS.find((p) => p.is.test(said(m))) }))
        // Named as one, filed as one ("LED Processor"), or video kit with a model we know in its name: "MX30" says neither
        // NovaStar nor processor.
        .filter(
          (p) =>
            !FIBRE_CONVERTER.test(said(p.m)) &&
            !RECEIVING_CARD.test(p.m.name) &&
            (LED_PROCESSOR.test(said(p.m)) || LED_PROCESSOR.test(p.m.category) || (p.m.department === 'video' && (!!p.can || /\bprocessors?\b/i.test(p.m.name))))
        )
        // Worked out once for each: the lines are a search, and putting them in order asks for them many times over.
        .map((p) => ({ ...p, d: p.can && picture ? drivenBy(p.can, picture, count, byFibre, backup) : null })),
      (p) => (p.can ? 0 : 1),
      // The fewest that drive it, ours before one hired in, one that takes its lines as they're cabled before one that has to
      // carry them on, then the smallest that does: a big processor isn't sent to a small screen.
      (p) => p.d?.units ?? 1,
      (p) => (p.m.dryHire ? 1 : 0),
      (p) => (p.d?.runsOn ? 1 : 0),
      (p) => priced(p.m.id),
      (p) => p.can?.pixels ?? 0,
      (p) => enough(p.m.id, 1)
    )
    const p = pick('processor', found, (x) => x.m.id, (x) => x.d?.units ?? 1)
    const d = p?.d ?? null
    const checks: string[] = []
    if (p && !picture) checks.push("The panel's pixels aren't given, so check it drives this screen.")
    else if (p && !p.can) checks.push(`Check it drives ${num(picture!.pixelsW * picture!.pixelsH * count)} pixels${backup ? ', with a second port for every data line' : ''}: what it loads isn't known here.`)
    else if (p?.can && picture && d) {
      const kind = tidyKind(d.laid)
      if (d.runsOn)
        checks.push(
          `Fits the ${num(d.ports)} ports ${d.units === 1 ? 'it has' : 'each has'}${backup ? ', with a backup on every line,' : ''} only if a data line ${kind ? `carries on from one ${kind} into part of the next` : "isn't kept to a tidy block of panels"}: in ${kind ? `whole ${kind}s` : 'tidy blocks'} ${d.each ? (count > 1 ? 'each screen' : 'this screen') : 'the biggest part'} takes ${plural(d.tidy, 'line')}.`
        )
      // An MX40 Pro past its own 20 ports is in its 40-port mode, which not every one of them has.
      const each = backup ? 2 : 1
      if (d.ports > p.can.ports && d.loads.some((x) => x.lines * each > p.can!.ports))
        checks.push(`More than ${num(Math.floor(p.can.ports / each))} lines${backup ? ' with a backup on each' : ''} takes its ${num(d.ports)}-port mode${p.can.byFibreWants ? `, which wants ${p.can.byFibreWants}` : ''}.`)
      // Its other 20 ports: said where they'd do it with fewer of them, or keep every line as it's cabled.
      if (!byFibre && p.can.byFibre && converters.length) {
        const more = drivenBy(p.can, picture, count, true, backup)
        const has = `It has ${num(p.can.byFibre)} more ports that only leave by fibre: with Fibre to the screen ticked, `
        if (more.units < d.units) checks.push(`${has}${more.units === 1 ? 'one drives' : `${num(more.units)} drive`} ${count > 1 ? 'these screens' : 'this screen'}.`)
        else if (!more.runsOn && more.laid?.down === 1 && (d.runsOn || d.laid?.down !== 1)) checks.push(`${has}every line keeps to whole columns.`)
      }
      if (backup && p.can.backupUnsaid) checks.push("Check it backs up one port with another: its maker's sheet doesn't say.")
    }
    const row: PlanRow = {
      part: 'processor',
      label: 'Processor',
      items: p ? [{ modelId: p.m.id, qty: d?.units ?? 1 }] : [],
      why: !p ? '' : p.can && picture && d ? drivenWords(p.can, d, picture, count) : 'One to drive it',
      ...(checks.length ? { check: checks.join(' ') } : {}),
      choices: found.map((x) => ({ id: x.m.id, name: nameWithLength(x.m) })),
      chosen: p?.m.id ?? null,
      ...(p ? {} : { none: 'No LED processor found in the stock list.' }),
    }
    return { row, can: p?.can, driven: d }
  }
  const drive = processors(backed)
  // As it would be with a backup on every line, for saying what that tick adds while it's off.
  const backedDrive = backed ? drive : processors(true)
  // How a screen's lines are laid: by the processor chosen, or by the planning figures where there's none we know.
  const lined: Lined | null = drive.driven ?? (picture ? plainLines(picture, count) : null)
  /** Every screen's data lines; one a screen where they can't be counted. */
  const lines = lined ? lined.lines * count : count
  /** How far a data cable goes from a converter at one corner of the screen to a line that starts at the far one, in metres. */
  const reachM = f.widthM + f.heightM
  const dataRow = (): PlanRow => {
    // By fibre the cable is the short one from a converter to the first panel of its line, and a second one at the
    // processor where that has no fibre output of its own.
    const each = byFibre && !drive.can?.fibre ? 2 : 1
    const need = lines * each
    const reaches = (m: ScreenProduct) => (lengthOf(m) ?? 0) >= reachM
    const found = preferred(
      cables,
      // One whose length is known and that there are enough of, then the longest, to reach from the processor. Where the
      // fibre does the reaching, one that crosses the screen comes before one that doesn't, and the shortest of those. A
      // price only parts two of one length: a cable is picked for how far it goes.
      (m) => (lengthOf(m) === null ? 1 : 0),
      (m) => (byFibre && !reaches(m) ? 1 : 0),
      // The backups run on the same cable, so there have to be enough for both.
      (m) => enough(m.id, need * (backed ? 2 : 1)),
      (m) => (byFibre && reaches(m) ? 1 : -1) * (lengthOf(m) ?? 0),
      (m) => priced(m.id)
    )
    // The length used last time comes back for the long run only: by fibre it's the short one, whatever was used then.
    const cable = byFibre ? (found.find((m) => m.id === picks.data) ?? found[0]) : pick('data', found, (m) => m.id)
    const run = lined && picture ? laidWords(lined, picture, count) : ''
    const at = count > 1 ? 'at the screens' : 'at the screen'
    const from = !byFibre ? 'from the processor to the screen' : each === 1 ? `from the converter ${at} to its first panel` : `from the processor to its converter, and from the converter ${at} to the first panel`
    const counted =
      lines === 1 ? `${each === 1 ? 'One data line,' : 'Two for the one data line:'} ${from}` : `${each === 1 ? 'One' : 'Two'} for each of the ${num(lines)} data lines${each === 1 ? ',' : ':'} ${from}${twice}`
    const checks = [
      !lined ? "The panel's pixels aren't given, so its data lines aren't counted: check how many it takes." : '',
      cable && lengthOf(cable) === null ? "Check it reaches: its length isn't on its product." : cable && byFibre && !reaches(cable) ? `Check it reaches every line from the converter: the screen is ${metresWords(f.widthM)} wide and ${metresWords(f.heightM)} tall.` : '',
    ].filter(Boolean)
    return {
      part: 'data',
      label: 'Data cables',
      items: cable ? [{ modelId: cable.id, qty: need }] : [],
      why: !lined ? (!byFibre ? 'One for each screen, from the processor.' : each === 1 ? 'One for each screen, from its converter at the screen.' : 'Two for each screen, one at each converter.') : `${counted}.${run ? ` ${run}` : ''}`,
      ...(cable && checks.length ? { check: checks.join(' ') } : {}),
      choices: found.map((m) => ({ id: m.id, name: nameWithLength(m) })),
      chosen: cable?.id ?? null,
      ...(cable ? {} : { none: 'No data cable found in the stock list.' }),
    }
  }
  /**
   * The converters and the fibre that take a processor's lines to the screen, as they would be with the lines on fibre,
   * ticked or not. With a backup the same again carries the backups, so there have to be enough of the fibre for both.
   */
  const fibreKit = (of: Pick<typeof drive, 'can' | 'driven'>, backup: boolean) => {
    const converter = pick('fibre', converters, (m) => m.id)!
    const loads = of.can && picture ? drivenBy(of.can, picture, count, true, backup).loads : ((of.driven ?? (picture ? plainLines(picture, count) : null))?.loads ?? [{ units: 1, lines: count }])
    const own = of.can?.fibre
    const perFibre = Math.min(own ?? CONVERTER_LINES, CONVERTER_LINES)
    const atScreen = own ? loads.reduce((n, x) => n + x.units * Math.ceil(x.lines / perFibre), 0) : Math.ceil(loads.reduce((n, x) => n + x.units * x.lines, 0) / CONVERTER_LINES)
    const run = preferred(
      all.filter((m) => FIBRE_RUN.test(m.name) && !NOT_A_FIBRE_RUN.test(m.name) && !FIBRE_CONVERTER.test(said(m))),
      (m) => enough(m.id, atScreen * (backup ? 2 : 1)),
      (m) => -(lengthOf(m) ?? 0),
      (m) => priced(m.id)
    )[0]
    return { converter, own, perFibre, atScreen, run }
  }
  const fibreRow = (): PlanRow => {
    // The row says what ticking it adds.
    const { converter, own, perFibre, atScreen, run } = fibreKit(drive, backed)
    const checks = [
      run ? '' : 'No fibre found in the stock list to run between them: add what carries it.',
      // The converters are counted by the lines, not by the screens: one may feed more than one of them.
      count > 1 ? 'One converter may feed more than one screen: where they stand apart, check its data cables reach each, or add a converter.' : '',
    ].filter(Boolean)
    return {
      part: 'fibre',
      label: 'Fibre to the screen',
      items: [{ modelId: converter.id, qty: atScreen * (own ? 1 : 2) }, ...(run ? [{ modelId: run.id, qty: atScreen }] : [])],
      why: `In place of a long data cable for every line: ${own ? `a converter at the screen${count > 1 ? 's' : ''} for every ${num(perFibre)} data lines, each on a fibre from the processor` : `a converter at each end for every ${num(CONVERTER_LINES)} data lines, and a fibre between each pair`}${twice}.`,
      ...(checks.length ? { check: checks.join(' ') } : {}),
      choices: converters.map((m) => ({ id: m.id, name: nameWithLength(m) })),
      chosen: converter.id,
    }
  }
  /**
   * A backup on every data line: as much again of what takes the lines to the screen. It carries what it adds whether it's
   * ticked or not, counted as the screen would be with it, so the row says what ticking it adds.
   */
  const backupRow = (data: PlanRow): PlanRow => {
    const of = backedDrive
    const run: Lined | null = of.driven ?? (picture ? plainLines(picture, count) : null)
    const backups = run ? run.lines * count : count
    const kit = byFibre ? fibreKit(of, true) : null
    // By fibre a second cable at the screen for every line, and one more at the processor where that has no fibre output of its own.
    const each = byFibre && !of.can?.fibre ? 2 : 1
    const items: PlanItem[] = [
      ...(data.chosen ? [{ modelId: data.chosen, qty: backups * each }] : []),
      ...(kit ? [{ modelId: kit.converter.id, qty: kit.atScreen * (kit.own ? 1 : 2) }, ...(kit.run ? [{ modelId: kit.run.id, qty: kit.atScreen }] : [])] : []),
    ]
    const to = !run ? 'each screen' : backups === 1 ? 'the data line' : `each of the ${num(backups)} data lines${count > 1 ? ` of the ${num(count)} screens` : ''}`
    // Where it's off and ticking it would change the processor, that's part of what it adds.
    const p = of.row.items[0]
    const was = drive.row.items[0]
    const changes = !backed && p && (p.modelId !== was?.modelId || p.qty !== was?.qty)
    const name = (id: string) => nameWithLength(all.find((m) => m.id === id) ?? { name: 'a processor' })
    return {
      part: 'backup',
      label: 'Backup on every data line',
      items,
      why:
        (kit
          ? `A second way to ${to}, which takes over if the first fails: from its last panel back to a second port on the processor, through ${kit.own ? 'converters' : 'converters at each end'} and fibre of its own`
          : `A second data cable for ${to}, from its last panel back to a second port on the processor, which takes over if the first feed fails`) +
        '.' +
        (changes ? ` With it the processor is ${num(p.qty)} × ${name(p.modelId)}: each line takes two of its ports.` : ''),
      choices: [],
      chosen: null,
      ...(items.length ? {} : { none: 'No data cable found in the stock list to run a backup with.' }),
    }
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

  const data = dataRow()
  rows.push(drive.row, data, ...(converters.length ? [fibreRow()] : []), backupRow(data), distroRow())
  if (lined)
    working.push(
      `A data line is counted at ${num(drive.can?.line ?? PORT_PIXELS)} pixels, for 60 Hz in 8-bit colour, ${
        lined.runsOn
          ? "by its panels' own pixels: this processor doesn't ask for a line to be a tidy block of panels."
          : 'as a tidy block of whole panels: whole columns, cut shorter only where a column is more than one line carries or that saves a processor.'
      }`
    )
  if (lined && picture && drive.can?.thin && picture.pixelsW / picture.cols < drive.can.thin)
    working.push(`This processor counts a panel narrower than ${num(drive.can.thin)} pixels as ${num(drive.can.thin)} wide, so each of these takes more of a line than its own ${num(picture.pixelsW / picture.cols)}.`)
  if (byFibre) {
    working.push(`A fibre converter is taken to carry ${num(CONVERTER_LINES)} data lines, as NovaStar's CVT10 Pro does. The converters and the fibre between them have to be of one kind: single-mode with single-mode.`)
    working.push(`The data cable offered is the shortest that reaches the far corner of the screen from a converter at one end: ${metresWords(reachM)} or more.`)
  }
  if (backed)
    working.push(
      `A backup is a second port for every data line: the line runs through its panels and back into it, so a processor carries half as many lines.${
        byFibre ? ' The backups go through converters and fibre of their own, so that losing one converter or one fibre leaves every line fed.' : ''
      }`
    )
  if (f.circuits !== null) working.push(`Power is counted in 16 A circuits loaded to four fifths, ${num(Math.round(CIRCUIT_W))} W each.`)
  working.push('The links between panels, mains cables, slings and shackles are not counted: add what the job takes as kit.')
  return { facts: f, lines: lined?.lines ?? null, rows, stands: how, warns, working }
}

const millions = (pixels: number) => `${num(pixels / 1_000_000, 1)} million`

/** A screen as a processor sees it: its panels across and down, and its picture in pixels. */
interface Picture {
  cols: number
  rows: number
  pixelsW: number
  pixelsH: number
}

type Limit = 'width' | 'height' | 'pixels' | 'ports'

/**
 * How data lines are laid as a screen is cabled: each line a tidy block of whole panels, `across` blocks by `down`, none
 * bigger than `colsEach` by `rowsEach`. One block down is whole columns; one across is whole rows.
 */
interface Laid {
  lines: number
  across: number
  down: number
  colsEach: number
  rowsEach: number
}

/**
 * The tidy ways to lay a screen's lines, the one a crew reaches for first: whole columns, as many to a line as it
 * carries; then the columns cut in two, in three and so on, each kept only where it takes fewer lines than every way
 * before it. So the last is the fewest lines tidy blocks come to. `panel` is the pixels one panel takes of a line that
 * carries `perLine`. None where one panel alone is more than a line carries.
 */
function tidyWays(cols: number, rows: number, panel: number, perLine: number): Laid[] {
  const ways: Laid[] = []
  for (let down = 1; down <= rows; down++) {
    const tall = Math.ceil(rows / down)
    const wide = Math.min(cols, Math.floor(perLine / (tall * panel)))
    if (wide < 1) continue
    const across = Math.ceil(cols / wide)
    if (!ways.length || across * down < ways.at(-1)!.lines) ways.push({ lines: across * down, across, down, colsEach: Math.ceil(cols / across), rowsEach: tall })
    // One block across: cutting it further only adds lines.
    if (across === 1) break
  }
  return ways
}

/** The data lines a screen, or a part of one, takes from a processor: by the planning figures where there's none to go by. */
interface Lines {
  /** The tidy ways to lay them, whole columns first and the fewest lines last. */
  ways: Laid[]
  /** The fewest lines tidy blocks come to; by pixels alone where there's no tidy way. */
  tidy: number
  /** The fewest it can take: fewer than `tidy` only from a processor whose lines needn't be tidy blocks. */
  fewest: number
  /** The panels one line carries where it needn't be a tidy block; none where it must. */
  runEach: number
}

function linesFor(can: Pick<Drives, 'line' | 'thin' | 'runsOn'> | undefined, cols: number, rows: number, panelW: number, panelH: number): Lines {
  const perLine = can?.line ?? PORT_PIXELS
  // What one panel takes of a line: its own pixels, and where its maker counts a narrow panel wider, as that wide. NovaStar
  // writes its rule for "each rectangular load area" on a port and doesn't say whether two narrow columns side by side make
  // one: each panel is taken as its own, which never counts fewer lines than the screen needs.
  const panel = Math.max(panelW, can?.thin ?? 0) * panelH
  const ways = tidyWays(cols, rows, panel, perLine)
  const tidy = ways.at(-1)?.lines ?? Math.ceil((cols * rows * panel) / perLine)
  const runEach = can?.runsOn ? Math.floor(perLine / panel) : 0
  return { ways, tidy, fewest: runEach >= 1 ? Math.min(tidy, Math.ceil((cols * rows) / runEach)) : tidy, runEach }
}

/**
 * Every way a screen's lines can be laid, in the order they're tried: the tidy ways, then, where a line needn't be a
 * tidy block, lines that carry on from one column into part of the next.
 */
function waysToLay(l: Lines): { lines: number; laid: Laid | null; runsOn: boolean }[] {
  const tidy = l.ways.length ? l.ways.map((w) => ({ lines: w.lines, laid: w as Laid | null, runsOn: false })) : [{ lines: l.tidy, laid: null, runsOn: false }]
  return [...tidy, { lines: l.fewest, laid: l.ways.at(-1) ?? null, runsOn: true }]
}

/** The first of a processor's limits that a screen, or a part of one, breaks; null where one drives it from so many ports. */
function breaks(can: Drives, cols: number, rows: number, panelW: number, panelH: number, ports: number): Limit | null {
  const w = cols * panelW
  const h = rows * panelH
  if (can.widest !== undefined && w > can.widest) return 'width'
  if (can.tallest !== undefined && h > can.tallest) return 'height'
  if (w * h > can.pixels) return 'pixels'
  return linesFor(can, cols, rows, panelW, panelH).fewest > ports ? 'ports' : null
}

/** How a processor drives the screens asked for. */
interface Driven {
  /** How many of it that takes. */
  units: number
  /** How many of the screens one drives; none where a screen is more than one drives, and is split between `across` by `down` of them. */
  each: number
  across: number
  down: number
  /** The limit that makes it more than one. `room`: its picture has no room for another screen beside or under the first. */
  by: Limit | 'room' | null
  /** The ports counted on one: with those that only leave by fibre, where the lines go by fibre. */
  ports: number
  /** Every line has a backup, which takes a second of those ports. */
  backed: boolean
  /** The data lines one screen takes from it, over all its parts where it's split. */
  lines: number
  /**
   * How those lines are laid as cabled: one screen's, or its biggest part's. In whole columns where that takes no more
   * of the processor, else the columns cut in as few as do. Null where one panel alone is more than a line carries.
   */
  laid: Laid | null
  /**
   * The lines only fit its ports where a line needn't be a tidy block, and carries on from one column into part of the
   * next. `tidy` is what a screen, or its biggest part, takes in tidy blocks, and `runEach` the panels on a line that
   * carries on.
   */
  runsOn: boolean
  tidy: number
  runEach: number
  /** Its units by the data lines each carries, for what takes them to the screen. */
  loads: { units: number; lines: number }[]
}

/** What the data cables and the fibre are counted from: how one screen's lines are laid, and what each unit carries. */
type Lined = Pick<Driven, 'lines' | 'laid' | 'runsOn' | 'runEach' | 'across' | 'down' | 'loads'>

/** A screen's lines by the planning figures, where there's no processor we know to count them by. */
function plainLines(s: Picture, count: number): Lined {
  const way = waysToLay(linesFor(undefined, s.cols, s.rows, s.pixelsW / s.cols, s.pixelsH / s.rows))[0]!
  return { lines: way.lines, laid: way.laid, runsOn: false, runEach: 0, across: 1, down: 1, loads: [{ units: 1, lines: way.lines * count }] }
}

/**
 * How many of a processor drive the screens, and the limit that decides it. One drives as many screens as its pixels,
 * its ports and the room in its picture allow. A screen that is more than one drives (too wide, too tall, too many
 * pixels, too many lines) is split into the fewest parts that each fit one, side by side before one above another, in
 * whole panels. The lines are counted as they're cabled, in whole columns, unless cutting the columns shorter is what
 * makes them fit, or fit fewer of it. By fibre they're counted against the ports that only leave that way too. With a
 * backup every line takes a second port, so one carries half as many lines.
 */
function drivenBy(can: Drives, s: Picture, count: number, byFibre: boolean, backed = false): Driven {
  const ports = can.ports + (byFibre ? (can.byFibre ?? 0) : 0)
  /** The lines one carries. */
  const carries = backed ? Math.max(1, Math.floor(ports / 2)) : ports
  const panelW = s.pixelsW / s.cols
  const panelH = s.pixelsH / s.rows
  const whole = breaks(can, s.cols, s.rows, panelW, panelH, carries)
  if (!whole) {
    const pixels = s.pixelsW * s.pixelsH
    const l = linesFor(can, s.cols, s.rows, panelW, panelH)
    const room = (can.widest === undefined ? Infinity : Math.floor(can.widest / s.pixelsW)) * (can.tallest === undefined ? Infinity : Math.floor(can.tallest / s.pixelsH))
    /** How many screens one drives at so many lines each, and the limit that stops it there. */
    const eachAt = (lines: number) => {
      const limits: [number, Driven['by']][] = [
        [Math.floor(can.pixels / pixels), 'pixels'],
        [Math.floor(carries / lines), 'ports'],
        [room, 'room'],
      ]
      return limits.reduce((least, x) => (x[0] < least[0] ? x : least))
    }
    // The first way of laying them that takes no more of the processor than the fewest lines would.
    const units = Math.ceil(count / eachAt(l.fewest)[0])
    const way = waysToLay(l).find((w) => eachAt(w.lines)[0] >= 1 && Math.ceil(count / eachAt(w.lines)[0]) === units)!
    const [each, by] = eachAt(way.lines)
    return {
      units,
      each,
      across: 1,
      down: 1,
      by: each >= count ? null : by,
      ports,
      backed,
      lines: way.lines,
      laid: way.laid,
      runsOn: way.runsOn,
      tidy: l.tidy,
      runEach: l.runEach,
      loads: [...(units > 1 ? [{ units: units - 1, lines: each * way.lines }] : []), { units: 1, lines: (count - (units - 1) * each) * way.lines }],
    }
  }
  let best = { across: s.cols, down: s.rows }
  for (let down = 1; down <= s.rows; down++)
    for (let across = 1; across <= s.cols && across * down < best.across * best.down; across++)
      if (!breaks(can, Math.ceil(s.cols / across), Math.ceil(s.rows / down), panelW, panelH, carries)) {
        best = { across, down }
        break
      }
  /** So many panels shared between so many parts as evenly as they go: each size of part, and how many parts are that size. */
  const shared = (panels: number, parts: number): [size: number, parts: number][] => {
    const size = Math.floor(panels / parts)
    const over = panels % parts
    return [...(over ? [[size + 1, over] as [number, number]] : []), [size, parts - over]]
  }
  const loads: Driven['loads'] = []
  let lines = 0
  let runsOn = false
  for (const [rows, tall] of shared(s.rows, best.down))
    for (const [cols, wide] of shared(s.cols, best.across)) {
      const ways = waysToLay(linesFor(can, cols, rows, panelW, panelH))
      const way = ways.find((w) => w.lines <= carries) ?? ways.at(-1)!
      runsOn ||= way.runsOn
      lines += way.lines * wide * tall
      loads.push({ units: wide * tall * count, lines: way.lines })
    }
  const most = linesFor(can, Math.ceil(s.cols / best.across), Math.ceil(s.rows / best.down), panelW, panelH)
  const way = waysToLay(most).find((w) => w.lines <= carries) ?? waysToLay(most).at(-1)!
  return { units: best.across * best.down * count, each: 0, across: best.across, down: best.down, by: whole, ports, backed, lines, laid: way.laid, runsOn, tidy: most.tidy, runEach: most.runEach, loads }
}

/** Why this many processors, naming the limit that decides it. */
function drivenWords(can: Drives, d: Driven, s: Picture, count: number): string {
  const pixels = s.pixelsW * s.pixelsH
  const ports = `${num(d.ports)} ports${d.ports > can.ports ? ' by fibre' : ''}`
  // One that drives it all: the ports that only leave by fibre are spoken of where the lines want them.
  const lines = d.lines * count
  // With a backup the ports the lines take are said too: they're what the processor is short of first.
  const withBackups = d.backed ? `, ${lines === 1 ? 'with a backup' : 'each with a backup'}: ${num(lines * 2)} ports` : ''
  if (d.units === 1) return `Drives ${millions(can.pixels)} pixels from ${lines * (d.backed ? 2 : 1) > can.ports ? ports : `${num(can.ports)} ports`}; ${count > 1 ? 'these screens have' : 'this screen has'} ${num(pixels * count)} in ${plural(lines, 'data line')}${withBackups}`
  if (d.each) {
    const some = d.each === 1 ? 'one of these screens' : `${num(d.each)} of these screens`
    if (d.by === 'ports') return `One has ${ports}, which is ${some} at ${plural(d.lines, 'data line')} each${d.backed ? ', every line with a backup' : ''}`
    if (d.by === 'room') return `One drives a picture up to ${num(can.widest!)} × ${num(can.tallest!)} pixels, which has room for ${some} at ${num(s.pixelsW)} × ${num(s.pixelsH)}`
    return `One drives ${millions(can.pixels)} pixels, which is ${some} at ${num(pixels)} each`
  }
  const screen = count > 1 ? 'each of these screens' : 'this screen'
  const limit =
    d.by === 'width'
      ? `One drives a picture ${num(can.widest!)} pixels wide at most and ${screen} is ${num(s.pixelsW)}`
      : d.by === 'height'
        ? `One drives a picture ${num(can.tallest!)} pixels tall at most and ${screen} is ${num(s.pixelsH)}`
        : d.by === 'ports'
          ? `One has ${ports} and ${screen} takes ${num(linesFor(can, s.cols, s.rows, s.pixelsW / s.cols, s.pixelsH / s.rows).fewest)} data lines${d.backed ? ', each with a backup' : ''}`
          : `One drives ${millions(can.pixels)} pixels and ${screen} has ${num(pixels)}`
  const parts = d.across * d.down
  const laid = d.across > 1 && d.down > 1 ? `, ${num(d.across)} across and ${num(d.down)} down` : d.across > 1 ? ' side by side' : `, one above ${parts === 2 ? 'the other' : 'another'}`
  return `${limit}: ${num(parts)}${laid}${count > 1 ? ' for every screen' : ''}, each driving part of it`
}

/** What the fewest tidy lines are made of, for saying what a line that carries on carries on from: whole columns, whole rows, or neither. */
const tidyKind = (laid: Laid | null) => (!laid || laid.down === 1 ? 'column' : laid.across === 1 ? 'row' : null)

/** How one data line runs across the panels, said with the cables that reach it. */
function laidWords(d: Lined, s: Picture, count: number): string {
  if (d.runsOn) {
    const kind = tidyKind(d.laid)
    return `A line takes up to ${plural(d.runEach, 'panel')}, ${kind ? `carrying on from one ${kind} into part of the next` : 'not kept to a tidy block'}.`
  }
  const l = d.laid
  if (!l) return ''
  const split = d.across * d.down > 1
  if (l.lines === 1) return split ? "One line takes each processor's part of the screen." : count > 1 ? 'Each takes a whole screen.' : 'It takes the whole screen.'
  const some = (n: number, parts: number, of: number) => `${!split && n * parts === of ? '' : 'up to '}${num(n)}`
  if (l.down === 1) return l.colsEach === 1 ? 'A line takes one column of panels.' : `A line takes ${some(l.colsEach, l.across, s.cols)} columns of panels.`
  if (l.across === 1) return l.rowsEach === 1 ? 'A line takes one row of panels.' : `A line takes ${some(l.rowsEach, l.down, s.rows)} rows of panels.`
  return `A line takes a block of up to ${num(l.colsEach)} panels across by ${num(l.rowsEach)} down.`
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
