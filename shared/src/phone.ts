import { normalisePhone } from './crew-import.ts'

/**
 * Phone numbers as every form takes them (ADR 0190, then system-wide): a country picked beside the number, the number
 * typed as at home, and the two kept together in international form (+353868319330), so a call, a text or WhatsApp
 * needs nothing added. Shown grouped for reading (+353 86 831 9330).
 */

/**
 * The country codes every phone field offers beside the number (the Apply page's first, ADR 0190), Ireland first and then the neighbours crew most often come
 * from, then the rest by name. A number typed with its own + or 00 keeps that code, whatever is picked.
 */
export const DIAL_CODES: readonly (readonly [code: string, country: string])[] = [
  ['353', 'Ireland'],
  ['44', 'United Kingdom'],
  ...([
    ['61', 'Australia'],
    ['43', 'Austria'],
    ['32', 'Belgium'],
    ['55', 'Brazil'],
    ['359', 'Bulgaria'],
    ['385', 'Croatia'],
    ['357', 'Cyprus'],
    ['420', 'Czechia'],
    ['45', 'Denmark'],
    ['372', 'Estonia'],
    ['358', 'Finland'],
    ['33', 'France'],
    ['49', 'Germany'],
    ['30', 'Greece'],
    ['36', 'Hungary'],
    ['354', 'Iceland'],
    ['91', 'India'],
    ['39', 'Italy'],
    ['371', 'Latvia'],
    ['370', 'Lithuania'],
    ['352', 'Luxembourg'],
    ['356', 'Malta'],
    ['31', 'Netherlands'],
    ['64', 'New Zealand'],
    ['47', 'Norway'],
    ['48', 'Poland'],
    ['351', 'Portugal'],
    ['40', 'Romania'],
    ['421', 'Slovakia'],
    ['386', 'Slovenia'],
    ['27', 'South Africa'],
    ['34', 'Spain'],
    ['46', 'Sweden'],
    ['41', 'Switzerland'],
    ['380', 'Ukraine'],
    ['1', 'United States and Canada'],
  ] as const),
]

/** Countries where a number's leading 0 is dialled from abroad too, so it's kept after the code. */
const KEEPS_ZERO = new Set(['39'])

/**
 * A mobile typed beside a country code, in international form: one typed with + or 00 keeps its own code, else the
 * picked code goes before it, less the 0 dialled only at home (087 123 4567 with Ireland is +353871234567).
 */
export function phoneWithCountry(country: string, typed: string) {
  const code = DIAL_CODES.some(([c]) => c === country) ? country : '353'
  const kept = typed.slice(0, 40).trim()
  if (!kept || /^(\+|00)/.test(kept)) return normalisePhone(kept)
  const digits = kept.replace(/\(0\)/g, '').replace(/[\s\-().]/g, '')
  if (!/^\d+$/.test(digits)) return { phone: kept, problem: PHONE_FIELD_HINT }
  return normalisePhone(`+${code}${KEEPS_ZERO.has(code) ? digits : digits.replace(/^0/, '')}`)
}

/** Ireland, which every phone field starts on. */
export const HOME_DIAL = '353'

/** Each code's numbers after it, grouped as people say them at home, for reading. */
function grouped(code: string, n: string): string {
  if (code === '353') {
    // Mobiles 8x and Dublin's 1 have their own shapes; the rest are two-digit areas.
    if (/^8\d{8}$/.test(n)) return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`
    if (/^1\d{7}$/.test(n)) return `${n.slice(0, 1)} ${n.slice(1, 4)} ${n.slice(4)}`
    if (/^\d{8,9}$/.test(n)) return `${n.slice(0, 2)} ${n.slice(2, n.length - 4)} ${n.slice(-4)}`
  }
  if (code === '44' && /^7\d{9}$/.test(n)) return `${n.slice(0, 4)} ${n.slice(4)}`
  if (code === '1' && /^\d{10}$/.test(n)) return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  // Elsewhere as one run: a wrong guess at a country's shape reads worse than none.
  return n
}

/**
 * A number kept in international form split into its country and the rest, for a form to show beside its picker: the
 * longest code that fits, Ireland when two share it. A number the app can't read is all "rest", with Ireland picked,
 * so nobody loses what was typed before.
 */
export function splitPhone(kept: string | null | undefined): { country: string; national: string } {
  const typed = (kept ?? '').trim()
  const read = normalisePhone(typed)
  if (!typed || read.problem !== undefined || !read.phone) return { country: HOME_DIAL, national: typed }
  const digits = read.phone.slice(1)
  const code = [...DIAL_CODES.map(([c]) => c)].sort((a, b) => b.length - a.length).find((c) => digits.startsWith(c) && digits.length > c.length + 5)
  if (!code) return { country: HOME_DIAL, national: read.phone }
  const rest = digits.slice(code.length)
  return { country: code, national: grouped(code, rest) }
}

/** A number as it's shown to read: +353 86 831 9330. One the app can't read is shown as it was typed. */
export function phoneShown(kept: string | null | undefined): string {
  const typed = (kept ?? '').trim()
  const read = normalisePhone(typed)
  if (!typed || read.problem !== undefined || !read.phone) return typed
  const { country, national } = splitPhone(read.phone)
  return national.startsWith('+') ? national : `+${country} ${national}`
}

/** The form's words for a number it can't read, the same everywhere. */
export const PHONE_FIELD_HINT = 'Pick the country, then type the number as you would at home, such as 087 123 4567 for Ireland.'
