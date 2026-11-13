import { dayLabel, type StepView } from '@sh/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { madeUpData } from '../src/data/madeup.ts'
import { pgliteDb } from '../src/db.ts'
import { ok, phone, today } from './company.ts'

/**
 * A task's hint and its fields say the same thing (Move 7 of the sweep of 6
 * November 2026). The dock and the Board choose a button or a tone from a
 * task's fields, and people read its hint, so the two must never disagree:
 * here every job of the made-up company, the bench the sweep walked, has
 * each task's numbers read out of its words and held against its fields.
 * A change to a hint's words that drops or moves a number fails here.
 */

let close: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const fn of close.reverse()) await fn()
  close = []
})

async function bench() {
  const db = await pgliteDb()
  const app = await buildApp({ db })
  close.push(async () => {
    await app.close()
    await db.close()
  })
  await ok(app, ...madeUpData(today))
  const { client } = await phone(app)
  return client.view()
}

/** The numbers and days a task's hint says, read back out of its words, to hold against its fields. */
function said(step: StepView): Record<string, unknown> {
  const h = step.hint
  if (!h) return {}
  const n = (re: RegExp) => {
    const m = h.match(re)
    return m ? Number(m[1]) : undefined
  }
  switch (step.key) {
    case 'quote':
      return { quoteHidden: h === 'Quote: with the office' || undefined, draft: h === 'A draft is started' || undefined }
    case 'crew': {
      if (h === 'No roles added yet') return { nothingYet: true }
      const m = h.match(/^(\d+) of (\d+) booked(?:, (\d+) to confirm)?$/)
      return { booked: Number(m![1]), needed: Number(m![2]), toConfirm: Number(m![3] ?? 0) }
    }
    case 'kit':
      if (h === 'No kit on the job yet') return { nothingYet: true }
      return { lines: n(/(\d+) lines? of kit/) ?? 0, short: n(/(\d+) short/) ?? 0, vans: n(/(\d+) vehicles?/) ?? 0 }
    case 'prep': {
      if (h === 'No kit to pick yet') return { nothingYet: true }
      const m = h.match(/^(\d+) of (\d+) out$/)
      return { out: Number(m![1]), of: Number(m![2]) }
    }
    case 'show':
      if (h === 'No dates yet') return { nothingYet: true }
      return h.startsWith('On until ') ? { until: h.slice('On until '.length) } : { starts: h.slice('Starts '.length) }
    case 'back':
      if (h === 'Nothing out yet') return {}
      return h.includes('never scanned') ? { neverScanned: n(/^(\d+) never/) } : { stillOut: n(/^(\d+) still out/) }
    case 'deprep':
      return { faults: n(/^(\d+) faults? open/) }
    default:
      return {}
  }
}

/** The same keys from the task's fields, days as the hint writes them. */
function fields(step: StepView, keys: string[]): Record<string, unknown> {
  const f = step.facts as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const v = f[k] ?? (['quoteHidden', 'draft', 'nothingYet'].includes(k) ? undefined : 0)
    out[k] = (k === 'until' || k === 'starts') && typeof v === 'string' ? dayLabel(v) : v
  }
  return out
}

describe("a task's hint and its fields", () => {
  it('agree on every task of every job the made-up company has', async () => {
    const view = await bench()
    let checked = 0
    let hinted = 0
    for (const job of view.jobs.jobs) {
      const steps = view.steps.of(job.id)
      if (!steps || steps.stopped) continue
      checked++
      for (const step of steps.steps) {
        if (!step.hint) continue
        hinted++
        const words = said(step)
        expect(fields(step, Object.keys(words)), `${job.name}: ${step.label} "${step.hint}"`).toEqual(words)
      }
    }
    // The made-up company's gigs and hires, from an enquiry to a job back with kit still out, with a hint on most tasks.
    expect(checked).toBeGreaterThanOrEqual(7)
    expect(hinted).toBeGreaterThan(checked)
  })

  it('give the dock and the Board their numbers on a crew gap and a kit shortfall', async () => {
    const view = await bench()
    const open = view.jobs.jobs.flatMap((j) => view.steps.of(j.id)?.steps.filter((s) => !s.done && !s.skipped) ?? [])
    // The made-up company has a job short of crew and two short of speakers between them (madeup.ts).
    expect(open.some((s) => s.key === 'crew' && (s.facts.booked ?? 0) < (s.facts.needed ?? 0))).toBe(true)
    expect(open.some((s) => s.key === 'kit' && (s.facts.short ?? 0) > 0)).toBe(true)
  })
})
