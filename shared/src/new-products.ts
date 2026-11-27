import { z } from 'zod'
import { lengthFromName, nameWithoutLength } from './cable-colours.ts'
import type { CommandArgs } from './commands.ts'
import { findProducts } from './find-product.ts'
import { kitKey } from './kit-notes.ts'
import { parseEuro } from './money.ts'
import { DEPARTMENTS, MAX_UNITS, type Department, type Model, type Tracking } from './stock.ts'

/**
 * Adding many new products quickly (ADR 0203), on Stock › Add products and a
 * freelancer's link: a photo of the item, and one of its maker's label when
 * it has one, read by Claude, which looks the make and model up on the web
 * and fills in what it finds. A person checks it and adds it. Nothing is
 * counted here: counting and labelling are the stocktake's (ADRs 0175-0178).
 *
 * What Claude answers is read leniently, as the quote screens' answers are
 * (ADR 0096): anything out of range is dropped, never refused, so a person
 * is shown what it could tell and fills in the rest.
 */

/** Photos of one item: the item, its label, and one more. */
export const MOST_PRODUCT_PHOTOS = 3
/** How big a photo is sent to be read, on its longest side: what Claude reads at full detail. */
export const READ_PHOTO_SIDE = 1568
/** A photo sent to be read, as base64; a few hundred kilobytes once made small on the phone. */
export const MAX_READ_PHOTO_BYTES = 2_500_000
/** At most this many web searches for one item: enough for the maker's page and a price. */
export const MOST_SEARCHES = 3
/** What one web search costs, in US cents ($10 a thousand). */
export const SEARCH_CENTS = 1
/** Typed instead of a photo, or beside one: what someone can tell of it, such as "Shure SM58" or "the grey 4-way box". */
export const TYPED_LENGTH = 300

export const productReadAsk = z.object({
  photos: z
    .array(z.object({ type: z.enum(['image/jpeg', 'image/png', 'image/webp']), data: z.string().min(1).max(MAX_READ_PHOTO_BYTES) }))
    .max(MOST_PRODUCT_PHOTOS, `Up to ${MOST_PRODUCT_PHOTOS} photos of one item.`),
  typed: z.string().trim().max(TYPED_LENGTH, `What's typed can be up to ${TYPED_LENGTH} characters.`).default(''),
}).refine((a) => a.photos.length > 0 || a.typed.length >= 2, { message: 'Take a photo of it, or type what it is.' })
export type ProductReadAsk = z.input<typeof productReadAsk>

// --- Reading leniently ------------------------------------------------------

const words = (n: number) => z.preprocess((v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : ''), z.string())
const within = (lo: number, hi: number, step: number) =>
  z.preprocess((v) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Number((Math.round(v / step) * step).toFixed(step < 1 ? 1 : 0)) : null), z.number().nullable())
const flag = z.preprocess((v) => v === true, z.boolean())
const some = <T extends z.ZodTypeAny>(item: T, most: number) => z.preprocess((v) => (Array.isArray(v) ? v.slice(0, most) : []), z.array(item))

export const SURENESS = ['sure', 'likely', 'guess'] as const
export type Sureness = (typeof SURENESS)[number]

/** An item as Claude read it from its photos and found it on the web. */
export const productReading = z.object({
  /** Whether it could tell what it is at all. */
  known: flag,
  /** How the company would write it: maker and model, such as "Shure SM58"; never its length. */
  name: words(200),
  maker: words(100),
  model: words(100),
  /** What crew and the notes might call it, such as "58". */
  otherNames: some(words(100), 6),
  department: z.preprocess((v) => (DEPARTMENTS.includes(v as Department) ? v : 'other'), z.enum(DEPARTMENTS)),
  category: words(100),
  /** Numbered (worth a label of its own) or counted (cables, clamps and the like). */
  tracking: z.preprocess((v) => (v === 'bulk' ? 'bulk' : 'serialised'), z.enum(['serialised', 'bulk'])),
  /** It holds other kit: a road case, a bag, a cable trunk. */
  isCase: flag,
  lengthM: within(0.1, 1000, 0.1),
  weightKg: within(0.1, 5000, 0.1),
  powerW: within(1, 100_000, 1),
  rackMount: flag,
  rackUnits: within(1, MAX_UNITS, 1),
  depthMm: within(1, 3000, 1),
  /** What one would cost new, in euro. */
  valueEuro: within(1, 1_000_000, 1),
  /** It runs off the mains, so it needs a PAT. */
  needsPat: flag,
  /** The name of a product already on the list that this is, exactly as written there; "" when none is. */
  sameAs: words(200),
  sure: z.preprocess((v) => (SURENESS.includes(v as Sureness) ? v : 'guess'), z.enum(SURENESS)),
  /** A sentence or two: what it read off the photos and what it found. */
  said: words(600),
  /** Where it found what it says, for a person to check. */
  // Only https links are kept, so the page never links anywhere else.
  sources: some(z.object({ title: words(200), url: z.preprocess((v) => (typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v) && v.length <= 500 ? v : ''), z.string()) }), 4).transform((l) =>
    l.filter((s) => s.url)
  ),
  /** Another photo that would help, such as "the label on the back"; "" when none would. */
  photoToTake: words(200),
})
export type ProductReading = z.infer<typeof productReading>

/** What the server sends back: the reading, and what it cost, so the page can say so. */
export interface ProductRead {
  reading: ProductReading
  cents: number
}

/** Whether photos can be read now, and why not when they can't: the page still adds products by hand. */
export interface ProductReadStatus {
  ok: boolean
  why?: string
}

// --- The JSON schema Claude answers in ----------------------------------------

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const str = { type: 'string' }
const bool = { type: 'boolean' }
const numOrNull = { anyOf: [{ type: 'number' }, { type: 'null' }] }

export const PRODUCT_READING_SCHEMA = obj({
  known: bool,
  name: str,
  maker: str,
  model: str,
  otherNames: { type: 'array', items: str },
  department: { type: 'string', enum: [...DEPARTMENTS] },
  category: str,
  tracking: { type: 'string', enum: ['serialised', 'bulk'] },
  isCase: bool,
  lengthM: numOrNull,
  weightKg: numOrNull,
  powerW: numOrNull,
  rackMount: bool,
  rackUnits: numOrNull,
  depthMm: numOrNull,
  valueEuro: numOrNull,
  needsPat: bool,
  sameAs: str,
  sure: { type: 'string', enum: [...SURENESS] },
  said: str,
  sources: { type: 'array', items: obj({ title: str, url: str }) },
  photoToTake: str,
})

// --- The form a person checks -------------------------------------------------

/** The form on Add products, as typed: every number as text, so what's typed is kept until it's added. */
export interface ProductDraft {
  name: string
  otherNames: string
  department: Department
  category: string
  tracking: Tracking
  isCase: boolean
  length: string
  value: string
  weight: string
  power: string
  rackMount: boolean
  units: string
  depth: string
  pat: boolean
  notes: string
}

export const blankDraft = (department: Department = 'audio'): ProductDraft => ({
  name: '',
  otherNames: '',
  department,
  category: '',
  tracking: 'serialised',
  isCase: false,
  length: '',
  value: '',
  weight: '',
  power: '',
  rackMount: false,
  units: '',
  depth: '',
  pat: false,
  notes: '',
})

const shown = (n: number | null) => (n === null ? '' : String(n))

/** Claude's reading as the form, with the category written as the company already writes it where one matches. */
export function draftOf(r: ProductReading, categories: readonly string[] = []): ProductDraft {
  const category = categories.find((c) => c.toLowerCase() === r.category.toLowerCase()) ?? r.category
  const name = withoutLength(r.name || [r.maker, r.model].filter(Boolean).join(' '))
  return {
    name,
    otherNames: r.otherNames.filter((o) => o.toLowerCase() !== name.toLowerCase()).join(', '),
    department: r.department,
    category,
    tracking: r.isCase ? 'serialised' : r.tracking,
    isCase: r.isCase,
    length: shown(r.lengthM),
    value: shown(r.valueEuro),
    weight: shown(r.weightKg),
    power: shown(r.powerW),
    rackMount: r.rackMount,
    units: shown(r.rackUnits),
    depth: shown(r.depthMm),
    pat: r.needsPat,
    notes: '',
  }
}

/** A length written into a name ("XLR 10m", "Powercon 1.5 m") taken out of it, as ADR 0202 reads one: a length goes in its own field. */
export const withoutLength = (name: string) => (lengthFromName(name) === null ? name.trim() : nameWithoutLength(name))

const number = (typed: string, what: string): { n: number | null; reason?: string } => {
  const t = typed.trim().replace(',', '.')
  if (!t) return { n: null }
  const n = Number(t)
  return Number.isFinite(n) ? { n } : { n: null, reason: `${what} is a number, such as ${what === 'The length' ? '10' : '12.5'}.` }
}

/**
 * The form made into a new product, or why not: the same rules as New product, said in words. A length typed into the name is
 * refused while the length field is empty, so it's written once, where it's printed big on its labels.
 */
export function addArgsOf(f: ProductDraft, id: string): { args: CommandArgs<'model.add'>; reason?: undefined } | { reason: string } {
  const name = f.name.trim()
  if (!name) return { reason: 'Give it a name: the maker and model, such as Shure SM58.' }
  const parts = { length: number(f.length, 'The length'), weight: number(f.weight, 'The weight'), power: number(f.power, 'The power'), units: number(f.units, 'The height in rack units'), depth: number(f.depth, 'The depth') }
  const bad = Object.values(parts).find((p) => p.reason)
  if (bad) return { reason: bad.reason! }
  if (parts.length.n === null && lengthFromName(name) !== null) return { reason: `Put the length in the Length box rather than the name, as ${withoutLength(name)}.` }
  const value = parseEuro(f.value)
  if (value.reason !== undefined) return { reason: value.reason }
  const rackMount = f.rackMount
  const args = {
    id,
    name,
    department: f.department,
    category: f.category.trim(),
    tracking: f.isCase ? 'serialised' : f.tracking,
    isCase: f.isCase,
    valueCents: value.cents,
    notes: f.notes.trim(),
    patMonths: f.pat ? 12 : null,
    aliases: f.otherNames
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a && a.toLowerCase() !== name.toLowerCase())
      .slice(0, 20),
    units: parts.units.n === null ? null : Math.round(parts.units.n),
    depthMm: parts.depth.n === null ? null : Math.round(parts.depth.n),
    weightKg: parts.weight.n === null ? null : Math.round(parts.weight.n * 10) / 10,
    powerW: parts.power.n === null ? null : Math.round(parts.power.n),
    rackMount,
    lengthM: parts.length.n === null ? null : Math.round(parts.length.n * 10) / 10,
  } satisfies CommandArgs<'model.add'>
  return { args }
}

// --- Already on the list? -------------------------------------------------------

type Findable = Pick<Model, 'id' | 'name' | 'department' | 'category'> & { aliases?: readonly string[]; code?: string; mistake?: boolean; lengthM?: number | null }

/** A model number in a name, letters and figures together, such as "sm58" or "y10p", for telling one product from another. */
const modelKeys = (s: string) => kitKey(s).split(' ').filter((w) => /\d/.test(w) && /[a-z]/.test(w) && w.length >= 3)

/**
 * Products already on the list that the one being added might be, best first, at most four: the one Claude named, then those
 * found by its name, by maker and model, and by a model number they share ("SM58" in "Shure SM58 vocal mic"). A cable of another
 * length is another product, so it isn't offered.
 */
export function alikeProducts<P extends Findable>(products: readonly P[], seen: { name: string; maker?: string; model?: string; sameAs?: string; lengthM?: number | null }): P[] {
  const live = products.filter((p) => !p.mistake)
  const out: P[] = []
  const add = (p: P | undefined) => {
    if (!p || out.includes(p)) return
    if (seen.lengthM != null && p.lengthM != null && p.lengthM !== seen.lengthM) return
    out.push(p)
  }
  const named = seen.sameAs?.trim().toLowerCase()
  if (named) add(live.find((p) => p.name.trim().toLowerCase() === named))
  const name = withoutLength(seen.name)
  for (const typed of [name, [seen.maker, seen.model].filter(Boolean).join(' '), seen.model ?? '']) {
    if (kitKey(typed).length < 3) continue
    for (const f of findProducts(live, typed).slice(0, 3)) add(f.product)
  }
  const keys = new Set([...modelKeys(name), ...modelKeys(seen.model ?? '')])
  if (keys.size)
    for (const p of live) if ([p.name, ...(p.aliases ?? [])].some((n) => modelKeys(n).some((k) => keys.has(k)))) add(p)
  return out.slice(0, 4)
}
