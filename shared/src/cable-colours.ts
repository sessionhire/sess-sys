import { z } from 'zod'

/**
 * A colour for each cable length (ADR 0106), so a 10 m and a 15 m XLR are
 * told apart across a truck by the tape or heat-shrink at each end, and
 * crew coiling them back in put each on the right pile without reading.
 * There's no one standard across the trade, so the company keeps its own
 * list under Admin, starting from the order of the colours on a resistor
 * (brown, red, orange, yellow, green, blue, violet, grey, white), which
 * many in the trade already know, shortest first.
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

/**
 * A length read from a product's name, to fill the field in once: "XLR 10m",
 * "10 m XLR", "Speakon 1.5 metre", "DMX 5M". The last one in the name, as
 * "3 pin XLR 10m" ends with it; none for "25 way multicore", which says no
 * metres.
 */
export function lengthFromName(name: string): number | null {
  const found = [...name.matchAll(/(?:^|[^\d.,])(\d{1,4}(?:[.,]\d)?)\s*(?:m|mtr|mtrs|metres?|meters?)(?![a-z])/gi)].pop()
  if (!found) return null
  const n = Number(found[1]!.replace(',', '.'))
  return n >= 0.1 && n <= 1000 ? Math.round(n * 10) / 10 : null
}
