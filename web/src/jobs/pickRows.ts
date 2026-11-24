import type { Department, Direction, PickFrom, PickRow } from '@sh/shared'

/**
 * How a pick list's rows are read (ADRs 0017, 0072): on the phone and on
 * paper alike, so the printed list is in the order the screen showed.
 */

/** The department a row's kit is in; a product since removed is Other. */
export const departmentOfRow = (r: PickRow): Department => r.model?.department ?? 'other'

/**
 * Going out, the rows still to pick under the place most of each is kept,
 * places in the stock list's order, so the list reads as a walk round the
 * warehouse; a row with nothing left to find goes last.
 */
export function walk(rows: PickRow[]): [string, PickRow[]][] {
  const places = new Map<string, PickRow[]>()
  const nowhere: PickRow[] = []
  for (const r of rows) {
    const most = r.from.reduce<PickFrom | undefined>((best, f) => (!best || f.items.length + f.counted > best.items.length + best.counted ? f : best), undefined)
    if (most) places.set(most.where, [...(places.get(most.where) ?? []), r])
    else nowhere.push(r)
  }
  const out = [...places.entries()].sort(([a], [b]) => byWhere.compare(a, b))
  if (nowhere.length) out.push(['Nowhere in stock', nowhere])
  return out
}
const byWhere = new Intl.Collator('en-IE', { numeric: true })

/** "1 in Bay A2 can't go out (damaged)", the kit card's words, or "2 missing". */
export function heldText(h: PickRow['held'][number]): string {
  const n = h.items.length.toLocaleString('en-IE')
  if (h.why === 'missing') return `${n} missing`
  return `${n} ${h.where === 'Not said where' ? 'not placed' : `in ${h.where}`} can't go out (${h.why === 'damaged' ? 'damaged' : 'due a test'})`
}

/** All out that's needed, or all back: nothing left to do on the row. */
export const rowDone = (row: PickRow, mode: Direction) => (mode === 'out' ? row.lines.length > 0 && row.out >= row.need : row.out === 0 && row.missing === 0)
