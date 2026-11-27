import { parseCsv } from './csv.ts'
import { parseEuro } from './money.ts'

/**
 * Replacement values from a list (ADR 0204): a sheet or pasted lines of
 * product and value, read and matched to the stock list, so Admin can show
 * every change before any is made. Unlike the stock import, a value set
 * here is replaced: that is what the list is for, after a price check.
 */

export interface ValueListRow {
  /** Its row in the sheet, or line of what was pasted, so the office can find it. */
  row: number
  name: string
  /** The value as written. */
  text: string
}

export interface ValueListModel {
  id: string
  name: string
  aliases?: readonly string[]
  code?: string
  valueCents: number | null
}

export interface ValueChange {
  row: number
  modelId: string
  name: string
  /** The name the list gave, when it isn't the product's own. */
  listName: string
  was: number | null
  valueCents: number
}

export interface ValueListPlan {
  changes: ValueChange[]
  same: number
  unmatched: ValueListRow[]
  /** Rows whose value can't be read as euro, or is nothing. */
  unreadable: (ValueListRow & { reason: string })[]
  /** Later rows naming a product already given a value above. */
  twice: ValueListRow[]
  /** Rows with a product but no value: left as they are, as a list with only some filled in has them. */
  blank: number
}

const MOST_CENTS = 1_000_000_00
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

const PRODUCT = /product|name|item|model|description/i
const NEW = /\bnew\b|to use|suggested|replacement|value|price|cost/i
/** The one mark between a pasted name and its value; the spaces round it are trimmed off after. */
const MARK = /[\t;:,]/g
const OLD = /\bnow\b|\bold\b|\bwas\b|current|before|rms figure|\bno\.?$/i

/**
 * The rows of a sheet with a header naming the product and the value, or of
 * lines typed or pasted as "name, value" (a tab, comma, semicolon or colon
 * between). With a header, the value column is the one saying new before
 * any other, and never one saying now, old or was.
 */
export function readValueList(text: string): { rows: ValueListRow[]; problem?: undefined } | { rows?: undefined; problem: string } {
  if (text.includes('�')) return { problem: "The file's letters didn't come through: save it from the spreadsheet as CSV UTF-8 and try again." }
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  if (!lines.some((l) => l.trim())) return { problem: 'Nothing to read yet.' }
  const firstAt = lines.findIndex((l) => l.trim())
  const first = lines[firstAt]!
  const sep = first.includes('\t') ? '\t' : (first.match(/;/g) ?? []).length > (first.match(/,/g) ?? []).length ? ';' : ','
  const header = (sep === '\t' ? first.split('\t') : parseCsv(first, sep)[0] ?? []).map((h) => h.trim())
  const productAt = header.findIndex((h) => PRODUCT.test(h))
  const candidates = header.map((h, i) => ({ h, i })).filter(({ h, i }) => i !== productAt && NEW.test(h) && !OLD.test(h))
  const valueAt = (candidates.find(({ h }) => /\bnew\b|to use|suggested/i.test(h)) ?? candidates[0])?.i ?? -1

  const rows: ValueListRow[] = []
  if (productAt >= 0 && valueAt >= 0) {
    const records = sep === '\t' ? lines.map((l) => l.split('\t')) : parseCsv(lines.join('\n'), sep)
    records.forEach((cells, i) => {
      if (i <= firstAt) return
      const name = (cells[productAt] ?? '').trim()
      const value = (cells[valueAt] ?? '').trim()
      if (name || value) rows.push({ row: i + 1, name, text: value })
    })
    if (!rows.length) return { problem: 'The sheet has column names but no rows under them.' }
    return { rows }
  }
  // No header: "Yamaha DM3, 1,999", "Yamaha DM3: €1,999", "Yamaha DM3<tab>1999". The name ends at the first mark after which all
  // that's left reads as euro, so "Xone:92, 1299" is the Xone:92 at €1,299 and "DM3, 1,999" is €1,999.
  lines.forEach((l, i) => {
    if (!l.trim()) return
    for (const m of l.matchAll(MARK)) {
      const name = l.slice(0, m.index).trim()
      const value = l.slice(m.index + 1).trim()
      if (name && /\d/.test(value) && parseEuro(value).reason === undefined) {
        rows.push({ row: i + 1, name, text: value })
        return
      }
    }
    // No euro after any mark: what follows the last one is the value, said as one that can't be read.
    const last = [...l.matchAll(MARK)].pop()
    rows.push(last ? { row: i + 1, name: l.slice(0, last.index).trim(), text: l.slice(last.index + 1).trim() } : { row: i + 1, name: l.trim(), text: '' })
  })
  return { rows }
}

/** What the list would change on the stock list as it is now. */
export function valueListPlan(rows: readonly ValueListRow[], models: readonly ValueListModel[]): ValueListPlan {
  const byName = new Map<string, ValueListModel>()
  // A product's own name before another's other name or code.
  for (const m of models) if (m.code && !byName.has(key(m.code))) byName.set(key(m.code), m)
  for (const m of models) for (const a of m.aliases ?? []) if (!byName.has(key(a))) byName.set(key(a), m)
  for (const m of models) byName.set(key(m.name), m)

  const plan: ValueListPlan = { changes: [], same: 0, unmatched: [], unreadable: [], twice: [], blank: 0 }
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r.name) {
      plan.unreadable.push({ ...r, reason: 'No product named.' })
      continue
    }
    const euro = parseEuro(r.text)
    if (euro.reason === undefined && euro.cents === null) {
      plan.blank++
      continue
    }
    if (euro.reason !== undefined || euro.cents === null || euro.cents === 0 || euro.cents > MOST_CENTS) {
      const reason = euro.reason ?? (euro.cents === 0 ? 'A value of nothing leaves it as it is.' : 'A value can be up to €1,000,000.')
      plan.unreadable.push({ ...r, reason })
      continue
    }
    const m = byName.get(key(r.name))
    if (!m) {
      plan.unmatched.push(r)
      continue
    }
    if (seen.has(m.id)) {
      plan.twice.push(r)
      continue
    }
    seen.add(m.id)
    if (m.valueCents === euro.cents) {
      plan.same++
      continue
    }
    plan.changes.push({ row: r.row, modelId: m.id, name: m.name, listName: key(r.name) === key(m.name) ? '' : r.name, was: m.valueCents, valueCents: euro.cents })
  }
  return plan
}
