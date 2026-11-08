import { describe, expect, it } from 'vitest'
import { STARTER_PACKAGES, STARTER_PRODUCTS, starterPlan } from '../src/starter-packages.ts'
import { MOST_PACKAGE_ITEMS, quoteCommandSchemas } from '../src/quotes.ts'

/** Every product the starter packages name, as the stock list would have them, less the ones the starter adds. */
const listed = [...new Set(STARTER_PACKAGES.flatMap((p) => p.items.map(([n]) => n)))]
  .filter((n) => !STARTER_PRODUCTS.some((s) => s.name === n))
  .map((name, i) => ({ id: `m${i}`, name }))

describe('the starter packages', () => {
  it('are generic, with fixed ids, each product once and within the limit', () => {
    expect(STARTER_PACKAGES).toHaveLength(41)
    expect(new Set(STARTER_PACKAGES.map((p) => p.id)).size).toBe(41)
    expect(STARTER_PACKAGES.some((p) => /ipsc|nama/i.test(p.name))).toBe(false)
    for (const p of STARTER_PACKAGES) {
      expect(new Set(p.items.map(([n]) => n)).size).toBe(p.items.length)
      expect(p.items.length).toBeLessThanOrEqual(MOST_PACKAGE_ITEMS)
    }
  })

  it('all go in on a full stock list, adding the mic and DI products it lacks, each one a valid package.save', () => {
    const plan = starterPlan(listed, [])
    expect(plan.waiting).toEqual([])
    expect(plan.packages).toHaveLength(41)
    expect(plan.products.map((p) => p.name)).toEqual(STARTER_PRODUCTS.map((p) => p.name))
    for (const p of plan.packages) expect(quoteCommandSchemas['package.save'].safeParse(p).success).toBe(true)
    const band = plan.packages.find((p) => p.id === 'pkg-mic-band')!
    expect(band.items).toContainEqual({ modelId: 'model-starter-sm57', qty: 2 })
  })

  it('priced by their kit, but for Decor LX, charged as one line in Current RMS', () => {
    const plan = starterPlan(listed, [])
    expect(plan.packages.filter((p) => p.dayCents > 0).map((p) => [p.name, p.dayCents, p.rate])).toEqual([['Decor LX', 180000, 'weekly']])
  })

  it('find a product whatever its capitals and spacing, or by another name', () => {
    const renamed = listed.map((m) => (m.name === 'NL4 Link  cable 1m' ? { ...m, name: 'nl4 link cable 1M' } : m.name === 'Sgm P5' ? { ...m, name: 'SGM P5 wash', aliases: ['Sgm P5'] } : m))
    expect(starterPlan(renamed, []).waiting).toEqual([])
  })

  it('wait, saying what is missing, for a product not on the stock list; and leave ones already there', () => {
    const plan = starterPlan(
      listed.filter((m) => m.name !== 'Cdj 3000'),
      ['pkg-speech-pa-small']
    )
    expect(plan.already).toBe(1)
    expect(plan.waiting).toEqual([
      { name: 'DJ booth', missing: ['Cdj 3000'] },
      { name: 'DJ booth, three decks', missing: ['Cdj 3000'] },
    ])
    expect(plan.packages).toHaveLength(38)
  })

  it('add a mic or DI product only when one is already on the list by none of its names, and only for a package going in', () => {
    const withSm57 = [...listed, { id: 'own57', name: 'shure sm-57' }]
    const plan = starterPlan(withSm57, ['pkg-mic-di-small', 'pkg-mic-band', 'pkg-mic-festival'])
    expect(plan.products).toEqual([])
    const fresh = starterPlan(withSm57, [])
    expect(fresh.products.map((p) => p.name)).not.toContain('Shure SM57')
    expect(fresh.packages.find((p) => p.id === 'pkg-mic-band')!.items).toContainEqual({ modelId: 'own57', qty: 2 })
  })
})
