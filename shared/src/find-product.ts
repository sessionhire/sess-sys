import { kitKey } from './kit-notes.ts'
import { DEPARTMENT_LABELS, type Model } from './stock.ts'

/**
 * Finding a product as it's typed (ADR 0070), for the product picker: what's
 * typed can be anywhere in the name ("58" finds Shure SM58), in another name
 * it goes by ("beta" finds it by "Beta 58"), or in its category or
 * department ("cable"), or its stock code (ADR 0074). Every word typed has to be found, in any of those and
 * in any order, so "shure 58" and "58 shure" find the same. Capitals,
 * accents, spaces and dashes don't count: "sm-58" is "SM58".
 */

type Findable = Pick<Model, 'id' | 'name' | 'department' | 'category'> & {
  aliases?: readonly string[]
  /** Its stock code (ADR 0074), found as another name is. */
  code?: string
}

export interface Found<P> {
  product: P
  /** The other name it was found by, when not its own: shown beside it, so it's plain why it's offered. */
  via?: string
}

const squash = (key: string) => key.replace(/ /g, '')
/** Found in a field: as typed, or with the spaces out of both ("sm 58" in "sm58"). */
const within = (field: string, word: string) => field.includes(word) || squash(field).includes(squash(word))

/**
 * The products what's typed finds, best first: the name as typed, then names
 * starting with it, a word of the name starting with it, the name holding it,
 * another name holding it, and last those found only by a mix of fields or by
 * category and department. Alike ones are in name order.
 */
export function findProducts<P extends Findable>(products: readonly P[], typed: string): Found<P>[] {
  const key = kitKey(typed)
  if (!key) return []
  const words = key.split(' ')
  const out: { f: Found<P>; rank: number }[] = []
  for (const p of products) {
    const name = kitKey(p.name)
    const others = [...(p.aliases ?? []), ...(p.code ? [p.code] : [])].map((a) => ({ a, key: kitKey(a) }))
    const meta = `${kitKey(p.category)} ${kitKey(DEPARTMENT_LABELS[p.department] ?? '')}`
    let rank: number
    let via: string | undefined
    const other = others.find((o) => o.key === key) ?? others.find((o) => within(o.key, key))
    if (name === key || squash(name) === squash(key)) rank = 0
    else if (name.startsWith(key) || squash(name).startsWith(squash(key))) rank = 1
    else if (name.split(' ').some((w) => w.startsWith(key))) rank = 2
    else if (within(name, key)) rank = 3
    else if (other) {
      rank = other.key === key ? 0.5 : 4
      via = other.a
    } else {
      const all = [name, ...others.map((o) => o.key), meta]
      if (!words.every((w) => all.some((f) => within(f, w)))) continue
      rank = 5
      via = others.find((o) => words.some((w) => within(o.key, w)))?.a
    }
    out.push({ f: via ? { product: p, via } : { product: p }, rank })
  }
  return out.sort((a, b) => a.rank - b.rank || a.f.product.name.localeCompare(b.f.product.name)).map((x) => x.f)
}

/** The most a count typed before a product's name can be, as a quote line's How many (lineDraft's 10,000). */
export const MOST_COUNTED = 10_000

/**
 * How many, typed before what's looked for (research/quoting.md, feature 1): "12 y10", "12x y10", "12 × y10" and
 * "12 * y10" are 12 of whatever "y10" finds; "12xlr" is not a count. A number and a space alone are not yet a search. Whether the number is a
 * count or part of a name ("4 way box") is for `countedFind` to say.
 */
export function leadingCount(typed: string): { count: number; rest: string } | undefined {
  const m = /^\s*(\d{1,5})(?:\s*[x×*]\s+|\s+)(\S.*)$/i.exec(typed)
  if (!m) return undefined
  const count = Number(m[1])
  if (count < 1 || count > MOST_COUNTED) return undefined
  return { count, rest: (m[2] ?? '').trim() }
}

/**
 * What's typed in a picker that takes a count, read as a count first (audit of the quote flow, 8 November 2026, finding
 * 2): "2 d20" is two of what "d20" finds, though "2 d20" whole would find the D20 by the 2 in its name. The whole text
 * is what's looked for when the number is a word of a name it finds ("4 way box", "72-way split", "XLR 10 m" for
 * "10 m xlr"), or when the rest finds nothing.
 */
export function countedFind<F>(typed: string, find: (text: string) => F[], nameOf: (f: F) => string): { count?: number; found: F[] } {
  const whole = () => find(typed)
  const counting = leadingCount(typed)
  if (!counting) return { found: whole() }
  const number = String(counting.count)
  const all = whole()
  if (all.some((f) => kitKey(nameOf(f)).split(' ').includes(number))) return { found: all }
  const rest = find(counting.rest)
  return rest.length ? { count: counting.count, found: rest } : { found: all }
}
