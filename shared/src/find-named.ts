import { kitKey } from './kit-notes.ts'

/**
 * Finding a client, a venue or a contact by name as it's typed, for the name
 * fields that take one already here or a new one (the design system's
 * combobox, one value): what's typed can be anywhere in the name, and every
 * word typed has to be found, in the name or in what else it's known by (a
 * venue's address, a contact's client), in any order. Capitals, accents,
 * spaces and dashes don't count.
 */
export interface Named {
  name: string
}

export interface FoundNamed<T> {
  record: T
  /** Found by something other than its name, such as the town in a venue's address. */
  via?: string
}

const squash = (key: string) => key.replace(/ /g, '')
const within = (field: string, word: string) => field.includes(word) || squash(field).includes(squash(word))

/**
 * The records what's typed finds, best first: the name as typed, names starting with it, a word of the name starting
 * with it, names holding it, then those found only with the help of `also`. Alike ones keep the order given, so a list
 * given most used first offers the most used first. Each name once: a second record spelt the same is left out.
 */
export function findNamed<T extends Named>(records: readonly T[], typed: string, also?: (record: T) => string | undefined): FoundNamed<T>[] {
  const key = kitKey(typed)
  if (!key) return []
  const words = key.split(' ')
  const out: { f: FoundNamed<T>; rank: number; at: number }[] = []
  const seen = new Set<string>()
  records.forEach((record, at) => {
    const name = kitKey(record.name)
    if (!name || seen.has(name)) return
    let rank: number
    let via: string | undefined
    if (name === key || squash(name) === squash(key)) rank = 0
    else if (name.startsWith(key) || squash(name).startsWith(squash(key))) rank = 1
    else if (name.split(' ').some((w) => w.startsWith(key))) rank = 2
    else if (within(name, key)) rank = 3
    else {
      const other = also?.(record)
      const otherKey = other ? kitKey(other) : ''
      if (!words.every((w) => within(name, w) || within(otherKey, w))) return
      rank = 4
      if (!words.every((w) => within(name, w))) via = other
    }
    seen.add(name)
    out.push({ f: via ? { record, via } : { record }, rank, at })
  })
  return out.sort((a, b) => a.rank - b.rank || a.at - b.at).map((x) => x.f)
}

/** The record whose name this is, set aside capitals, accents, spaces and punctuation. */
export function namedExactly<T extends Named>(records: readonly T[], typed: string): T | undefined {
  const key = squash(kitKey(typed))
  return key ? records.find((r) => squash(kitKey(r.name)) === key) : undefined
}
