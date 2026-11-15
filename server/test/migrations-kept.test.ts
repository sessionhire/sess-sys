import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MODULES } from '../src/modules.ts'

/**
 * A step of a module's schema, once it has run on the live database, is never changed: the database remembers only how
 * many steps it has taken, so an edit to one it took is never run there. Two columns for dry hire delivery were added to a
 * step already taken that way, and the live server failed on every quote email until they came as a step of their own.
 *
 * Each step's fingerprint is kept in migrations.lock.json. A changed one fails here: put the change in a new step at the
 * end instead. A new step fails until it's added to the file: run the tests with UPDATE_MIGRATIONS_LOCK=1, which adds new
 * steps only and never rewrites one that's there.
 */
const LOCK = new URL('./migrations.lock.json', import.meta.url)
const hash = (sql: string) => createHash('sha256').update(sql).digest('hex').slice(0, 16)

describe('schema steps already taken stay as they were', () => {
  it('matches every step against its kept fingerprint, and every step is kept', () => {
    const kept: Record<string, string[]> = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {}
    const now = Object.fromEntries(MODULES.map((m) => [m.versionTable, m.migrations.map(hash)]))
    for (const [table, hashes] of Object.entries(now)) {
      const before = kept[table] ?? []
      before.forEach((h, i) => expect(hashes[i], `${table} step ${i + 1} was changed after it shipped: undo the change and add a new step at the end`).toBe(h))
    }
    if (process.env.UPDATE_MIGRATIONS_LOCK) {
      writeFileSync(LOCK, `${JSON.stringify(Object.fromEntries(Object.entries(now).map(([t, h]) => [t, [...(kept[t] ?? []), ...h.slice((kept[t] ?? []).length)]])), null, 2)}\n`)
      return
    }
    for (const [table, hashes] of Object.entries(now)) expect(hashes.length, `${table} has a new step: run the tests with UPDATE_MIGRATIONS_LOCK=1 to keep it`).toBe((kept[table] ?? []).length)
  })
})
