import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APP_VERSION, CHANGELOG, isNewerVersion, releasesSince } from '../src/index.ts'

/** The changelog every change to the app adds to (ADR 0071). */
describe('the changelog', () => {
  const parse = (v: string) => v.split('.').map(Number)

  it('is newest first, each version one step up from the one before it', () => {
    expect(APP_VERSION).toBe(CHANGELOG[0]!.version)
    for (let i = 0; i < CHANGELOG.length - 1; i++) {
      const [a, b] = [parse(CHANGELOG[i + 1]!.version), parse(CHANGELOG[i]!.version)]
      const next = [
        [a[0]! + 1, 0, 0],
        [a[0]!, a[1]! + 1, 0],
        [a[0]!, a[1]!, a[2]! + 1],
      ].map((v) => v.join('.'))
      expect(next, `${CHANGELOG[i]!.version} after ${CHANGELOG[i + 1]!.version}`).toContain(b.join('.'))
      expect(CHANGELOG[i]!.date >= CHANGELOG[i + 1]!.date, `${CHANGELOG[i]!.version}'s date`).toBe(true)
    }
  })

  it('says something for each, with a pull request, and decisions that exist', () => {
    const adrs = new Set(readdirSync(new URL('../../docs/adr/', import.meta.url)).map((f) => Number(f.slice(0, 4))))
    for (const r of CHANGELOG) {
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r.title.trim()).not.toBe('')
      expect(r.what.trim()).not.toBe('')
      expect(r.prs.length, r.version).toBeGreaterThan(0)
      for (const n of r.adrs ?? []) expect(adrs.has(n), `ADR ${n} in ${r.version}`).toBe(true)
    }
  })
})

/** What a "Load the new version" says came in. */
describe('releasesSince', () => {
  const [a, b, c] = [CHANGELOG[0]!, CHANGELOG[1]!, CHANGELOG[2]!]
  it('lists the versions after the one they had, up to the one loaded, newest first', () => {
    expect(releasesSince(c.version, a.version).map((r) => r.version)).toEqual([a.version, b.version])
    expect(releasesSince(c.version, b.version).map((r) => r.version)).toEqual([b.version])
  })
  it('says nothing for the same version, an older one loaded, or one it does not know', () => {
    expect(releasesSince(a.version, a.version)).toEqual([])
    expect(releasesSince(a.version, c.version)).toEqual([])
    expect(releasesSince('dev')).toEqual([])
    expect(releasesSince('9.9.9')).toEqual([])
  })
  it('compares number by number, not as text', () => {
    expect(isNewerVersion('1.10.0', '1.9.9')).toBe(true)
    expect(isNewerVersion('1.9.9', '1.10.0')).toBe(false)
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false)
  })
})
