import { MAX_LINES, type Quote, type QuoteLine } from './quotes.ts'

/**
 * Two people on one draft keep both their changes (ADR 0113). A save says what the draft held when the device's
 * changes began, its base, and the server keeps from the draft as it now stands whatever the save didn't change:
 * a line changed only by someone else stays as they left it, a line someone else added stays, and a line changed on
 * both is the later save's, which the device that had it open is told of. The device's own view of a save does the
 * same, so what's shown before the server answers is what the server makes of it.
 */

/** A line as two devices compare it: every field, a field left out read as its default (as a typed line is saved). */
export function lineMark(l: QuoteLine): string {
  const fields = [
    l.kind,
    l.what,
    l.ref,
    l.group,
    l.qty,
    l.days,
    l.unitCents,
    l.vat,
    l.per ?? 'day',
    l.modelId ?? null,
    l.rate ?? null,
    l.out ?? null,
    l.discountPct ?? 0,
    l.packageId ?? null,
    l.includes ?? '',
    l.subhireQty ?? 0,
    l.supplier ?? '',
    l.costCents ?? null,
    l.extra ?? null,
    // Only when there is one, so a line marked before packages had lines under them reads the same.
    ...(l.under ? [l.under] : []),
  ]
  return hash(JSON.stringify(fields))
}

/** A short, steady hash (cyrb53): enough to tell a changed line from one that isn't, and small to send. */
function hash(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** What a draft held when a device's changes to it began: each line's mark, and the terms as they were. */
export interface DraftBase {
  lines: Record<string, string>
  discountPct: number
  notes: string
  validDays: number | null
  depositPct: number | null
  agreedCents: number | null
  mealsProvided: boolean
  travelKm: number | null
}

type DraftTerms = Pick<Quote, 'lines' | 'discountPct' | 'notes' | 'validDays' | 'depositPct' | 'agreedCents' | 'mealsProvided' | 'travelKm'>

export function draftBase(q: DraftTerms): DraftBase {
  return {
    lines: Object.fromEntries(q.lines.map((l) => [l.id, lineMark(l)])),
    discountPct: q.discountPct,
    notes: q.notes.trim(),
    validDays: q.validDays ?? null,
    depositPct: q.depositPct ?? null,
    agreedCents: q.agreedCents ?? null,
    mealsProvided: q.mealsProvided ?? false,
    travelKm: q.travelKm ?? null,
  }
}

/** A save's lines and terms, as quote.save carries them: a term left out is left as the draft has it. */
export interface DraftSave {
  lines: QuoteLine[]
  discountPct: number
  notes: string
  validDays?: number
  depositPct?: number | null
  agreedCents?: number | null
  mealsProvided?: boolean
  travelKm?: number | null
}

/**
 * The save, with what changed elsewhere since its base taken in. `both` names the lines changed on both, where the save
 * wins. Travel and subsistence are worked out from the rest on the device (ADR 0086), so the save's own are kept.
 */
export function mergeDraft<S extends DraftSave>(now: DraftTerms, save: S, base: DraftBase): { save: S; both: string[] } {
  const theirs = new Map(now.lines.map((l) => [l.id, l]))
  const mine = new Set(save.lines.map((l) => l.id))
  const both: string[] = []
  const out: QuoteLine[] = []
  for (const m of save.lines) {
    const was = base.lines[m.id]
    const t = theirs.get(m.id)
    // Added here, or worked out here: the save's.
    if (was === undefined || m.extra) {
      out.push(m)
      continue
    }
    const changedHere = lineMark(m) !== was
    if (!t) {
      // Taken off elsewhere: it stays off, unless it was changed here since, as the later word.
      if (changedHere) out.push(m)
      continue
    }
    if (!changedHere) out.push(t)
    else {
      out.push(m)
      const theirMark = lineMark(t)
      if (theirMark !== was && theirMark !== lineMark(m)) both.push(m.id)
    }
  }
  // Added elsewhere since: put in after the line it followed there.
  now.lines.forEach((t, i) => {
    if (mine.has(t.id) || base.lines[t.id] !== undefined || t.extra) return
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const k = out.findIndex((o) => o.id === now.lines[j]!.id)
      if (k >= 0) {
        at = k + 1
        break
      }
    }
    out.splice(at, 0, t)
  })
  // A term the save didn't change is the draft's as it now stands; one it left out stays left out.
  const nowBase = draftBase(now)
  const pick = <T>(v: T | undefined, was: T, current: T): T | undefined => (v === undefined ? undefined : v === was ? current : v)
  const merged: S = {
    ...save,
    lines: out.slice(0, MAX_LINES),
    discountPct: pick(save.discountPct, base.discountPct, nowBase.discountPct)!,
    notes: save.notes.trim() === base.notes ? now.notes : save.notes,
  }
  if (save.validDays !== undefined) merged.validDays = pick<number | null>(save.validDays, base.validDays, nowBase.validDays) ?? save.validDays
  if (save.depositPct !== undefined) merged.depositPct = pick(save.depositPct, base.depositPct, nowBase.depositPct)
  if (save.agreedCents !== undefined) merged.agreedCents = pick(save.agreedCents, base.agreedCents, nowBase.agreedCents)
  if (save.mealsProvided !== undefined) merged.mealsProvided = pick(save.mealsProvided, base.mealsProvided, nowBase.mealsProvided)
  if (save.travelKm !== undefined) merged.travelKm = pick(save.travelKm, base.travelKm, nowBase.travelKm)
  return { save: merged, both }
}
