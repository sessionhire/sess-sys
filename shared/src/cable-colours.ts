import { z } from 'zod'

/**
 * A colour for each cable length (ADR 0106), so a 10 m and a 15 m XLR are
 * told apart across a truck by the tape or heat-shrink at each end, and
 * crew coiling them back in put each on the right pile without reading.
 * There's no one standard across the trade, so the company keeps its own
 * list under Admin, starting from the order of the colours on a resistor
 * (brown, red, orange, yellow, green, blue, violet, grey, white), which
 * many in the trade already know, shortest first, then pink and light blue
 * for the long runs of 100 m and 150 m.
 *
 * A label printer prints black only, so a cable label says the colour as a
 * word in a black band; the colour itself is the tape, sleeve or coloured
 * label put on with it. On screen the band is drawn in the colour.
 */

export const CABLE_COLOURS = {
  black: { name: 'Black', hex: '#1a1a1a' },
  brown: { name: 'Brown', hex: '#7a4a21' },
  red: { name: 'Red', hex: '#d42a2a' },
  orange: { name: 'Orange', hex: '#f07c12' },
  yellow: { name: 'Yellow', hex: '#f2cc1b' },
  green: { name: 'Green', hex: '#2e9b3e' },
  blue: { name: 'Blue', hex: '#2563c9' },
  violet: { name: 'Violet', hex: '#7c3fbf' },
  grey: { name: 'Grey', hex: '#8a8a8a' },
  white: { name: 'White', hex: '#ffffff' },
  pink: { name: 'Pink', hex: '#ec6fae' },
  sky: { name: 'Light blue', hex: '#7cc4f0' },
} as const
export type CableColour = keyof typeof CABLE_COLOURS
export const CABLE_COLOUR_KEYS = Object.keys(CABLE_COLOURS) as CableColour[]

/** One step of the list: a cable up to this long, in metres, takes this colour. */
export const cableColourStep = z.object({
  upToM: z.number().min(0.1, 'A length is at least 0.1 m.').max(1000, 'A length can be up to 1,000 m.').transform((n) => Math.round(n * 10) / 10),
  colour: z.enum(CABLE_COLOUR_KEYS as [CableColour, ...CableColour[]]),
})
export type CableColourStep = z.infer<typeof cableColourStep>

export const MOST_CABLE_COLOURS = 20

/** The whole list, shortest first, each length once. */
export const cableColourList = z
  .array(cableColourStep)
  .max(MOST_CABLE_COLOURS, `Up to ${MOST_CABLE_COLOURS} lengths, please.`)
  .refine((l) => l.every((s, i) => i === 0 || s.upToM > l[i - 1]!.upToM), 'Each length once, shortest first.')

/** What a company starts with: the resistor order, over the lengths most hired. */
export const DEFAULT_CABLE_COLOURS: readonly CableColourStep[] = [
  { upToM: 1, colour: 'brown' },
  { upToM: 2, colour: 'red' },
  { upToM: 3, colour: 'orange' },
  { upToM: 5, colour: 'yellow' },
  { upToM: 10, colour: 'green' },
  { upToM: 15, colour: 'blue' },
  { upToM: 20, colour: 'violet' },
  { upToM: 30, colour: 'grey' },
  { upToM: 50, colour: 'white' },
  { upToM: 100, colour: 'pink' },
  { upToM: 150, colour: 'sky' },
]

/** The colour a cable this long takes: the first step it fits under; none when it's longer than the last, or has no length. */
export function colourForLength(lengthM: number | null | undefined, steps: readonly CableColourStep[]): CableColour | undefined {
  if (lengthM == null) return undefined
  return steps.find((s) => lengthM <= s.upToM)?.colour
}

/** "10 m", "0.5 m", "1.5 m": as it's said. */
export const lengthLabel = (m: number) => `${m.toLocaleString('en-IE', { maximumFractionDigits: 1 })} m`

/** The ranges as the office reads them: "Up to 1 m", "Over 1 m, up to 2 m"… */
export function stepRange(steps: readonly CableColourStep[], i: number): string {
  const s = steps[i]!
  return i === 0 ? `Up to ${lengthLabel(s.upToM)}` : `Over ${lengthLabel(steps[i - 1]!.upToM)}, up to ${lengthLabel(s.upToM)}`
}

/** A length in a name: "10m", "10 m", "1.5 metre", "5M", taking the one before it so as not to read "1.10m" as 10 m. */
const LENGTH_IN_NAME = /(?:^|[^\d.,])(\d{1,4}(?:[.,]\d)?)\s*(?:m|mtr|mtrs|metres?|meters?)(?![a-z])/gi

/** The last length in a name, in metres, and where it sits in the name, or none. */
function lengthIn(name: string): { m: number; start: number; end: number } | null {
  const found = [...name.matchAll(LENGTH_IN_NAME)].pop()
  if (!found) return null
  const m = Number(found[1]!.replace(',', '.'))
  if (!(m >= 0.1 && m <= 1000)) return null
  const start = found.index + found[0].search(/\d/)
  return { m: Math.round(m * 10) / 10, start, end: found.index + found[0].length }
}

/**
 * A length read from a product's name, to fill the field in once: "XLR 10m",
 * "10 m XLR", "Speakon 1.5 metre", "DMX 5M". The last one in the name, as
 * "3 pin XLR 10m" ends with it; none for "25 way multicore", which says no
 * metres.
 */
export function lengthFromName(name: string): number | null {
  return lengthIn(name)?.m ?? null
}

/**
 * A name with its length taken out, for the length to live in its own field
 * (Colly, 26 November 2026; ADR 0202): "XLR 10m" is "XLR", "10 m XLR" is
 * "XLR", "Speakon - 1.5 metre" is "Speakon", "DMX (5m)" is "DMX". A name
 * that's only a length stays as it is, as there'd be nothing left.
 */
export function nameWithoutLength(name: string): string {
  const at = lengthIn(name)
  if (!at) return name.trim()
  const left = (name.slice(0, at.start) + ' ' + name.slice(at.end))
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+([,;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([-–—/|·,])(\s*[-–—/|·,])+/g, '$1')
    .replace(/^[\s\-–—,;:/|·]+|[\s\-–—,;:/|·]+$/g, '')
  return left || name.trim()
}

type Lengthed = { name: string; lengthM?: number | null }

/**
 * A product's name as people see it, with its length when it has one
 * (ADR 0202): "XLR" 10 m long is "XLR 10 m", so the length is beside the
 * name wherever it's listed, picked, quoted or printed. A name that already
 * says that length is left as it is.
 */
export function nameWithLength(m: Lengthed): string {
  if (m.lengthM == null) return m.name
  if (lengthFromName(m.name) === m.lengthM) return m.name
  return `${m.name} ${lengthLabel(m.lengthM)}`
}

/**
 * What makes two products the same to the stock list (ADR 0202): the name
 * without its length, and the length, from the field or else the name. So
 * "XLR" 5 m long and "XLR" 10 m long are two products, and "XLR 10m" and
 * "XLR" 10 m long are one.
 */
export function productNameKey(m: Lengthed): string {
  const length = m.lengthM ?? lengthFromName(m.name)
  return `${nameWithoutLength(m.name).toLowerCase()}|${length ?? ''}`
}

/** Words in a name or category that say a product is a cable: what its picture goes by, and the connectors cables are called by. */
export const CABLE_WORDS = /\b(cables?|leads?|looms?|xlr|tails|extensions?|multicores?|snakes?|speakons?|powercons?|ethercons?|dmx|iec|socapex|soca|cat ?5e?|cat ?6a?|bnc|sdi|hdmi|jacks?|trs)\b/i

/** A cable, or kit with a length (ADR 0202): its length is shown and asked for beside its name. */
export function isCable(m: Lengthed & { category?: string }): boolean {
  return m.lengthM != null || CABLE_WORDS.test(m.name) || CABLE_WORDS.test(m.category ?? '') || lengthFromName(m.name) !== null
}

/** A product whose name holds a length, and what tidying it would make it (ADR 0202). */
export interface LengthTidy {
  id: string
  name: string
  /** The name without the length. */
  to: string
  lengthM: number
  /** Its own length field already says something else: left for a person to sort out. */
  differs: boolean
  cable: boolean
  /** Another product would then have the same name and length. */
  clash?: string
}

/**
 * Every product with a length in its name, for the one-off tidy (ADR 0202):
 * what the name and length would be with the length taken out. Nothing is
 * changed here; a person picks which to change.
 */
export function lengthTidies(models: readonly (Lengthed & { id: string; category?: string })[]): LengthTidy[] {
  const out: LengthTidy[] = []
  for (const m of models) {
    const lengthM = lengthFromName(m.name)
    if (lengthM === null) continue
    const to = nameWithoutLength(m.name)
    if (to === m.name.trim()) continue
    const key = productNameKey({ name: to, lengthM })
    const clash = models.find((x) => x.id !== m.id && productNameKey(x) === key)
    out.push({
      id: m.id,
      name: m.name,
      to,
      lengthM,
      differs: m.lengthM != null && m.lengthM !== lengthM,
      cable: CABLE_WORDS.test(m.name) || CABLE_WORDS.test(m.category ?? ''),
      ...(clash ? { clash: clash.name } : {}),
    })
  }
  return out
}

/** A product's name as shown, with its length (ADR 0202), or nothing for a product since removed. */
export function shownName(m: Lengthed | undefined | null): string | undefined {
  return m ? nameWithLength(m) : undefined
}
