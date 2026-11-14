import { describe, expect, it } from 'vitest'
import { deliveryFor } from '../src/delivery.ts'
import { hireWhen, hireTerms } from '../src/jobs.ts'
import { kitHoldOf, holdOf } from '../src/sync/kit-view.ts'

// Colly's answers to the quote flow audit's questions, 14 November 2026 (ADR 0183).
const galway = { lat: 53.2707, lng: -9.0568 }
const warehouse = { lat: 53.3249, lng: -6.3368 }
let n = 0
const newId = () => `id-${++n}`

describe("a dry hire's delivery line", () => {
  it('charges the km from the warehouse to the delivery address at the price a km', () => {
    const d = deliveryFor({ job: { kind: 'hire', hire: { handover: 'delivery', address: 'Galway', pin: galway } }, warehouse, centsPerKm: 150, id: 'keep', newId })
    expect(d.shown).toBe(true)
    expect(d.none).toBeNull()
    expect(d.line).toMatchObject({ id: 'keep', kind: 'other', group: 'Delivery', per: 'once', days: 1, unitCents: 150, extra: 'delivery' })
    expect(d.line!.qty).toBe(d.km)
    expect(d.km).toBeGreaterThan(200)
    expect(d.line!.what).toBe(`Delivery, ${d.km} km from the warehouse`)
  })
  it('says why there is none: no address, not on the map, no price', () => {
    const job = (hire: object) => ({ kind: 'hire' as const, hire: { handover: 'delivery' as const, ...hire } })
    expect(deliveryFor({ job: job({}), warehouse, centsPerKm: 150, id: undefined, newId }).none).toMatch(/No delivery address/)
    expect(deliveryFor({ job: job({ address: 'Somewhere', pin: null }), warehouse, centsPerKm: 150, id: undefined, newId }).none).toMatch(/isn't on the map/)
    const unpriced = deliveryFor({ job: job({ address: 'Galway', pin: galway }), warehouse, centsPerKm: undefined, id: undefined, newId })
    expect(unpriced.line).toBeUndefined()
    expect(unpriced.none).toMatch(/Admin › Company › Dry hire delivery/)
  })
  it('measures from Dublin until the warehouse is on the map, and says so', () => {
    const d = deliveryFor({ job: { kind: 'hire', hire: { handover: 'delivery', address: 'Galway', pin: galway } }, warehouse: null, centsPerKm: 100, id: undefined, newId })
    expect(d.fromWarehouse).toBe(false)
    expect(d.line!.what).toMatch(/from Dublin$/)
  })
  it('has no row for a collection, a dry hire from before, or a show', () => {
    expect(deliveryFor({ job: { kind: 'hire', hire: { handover: 'collection' } }, warehouse, centsPerKm: 100, id: undefined, newId }).shown).toBe(false)
    expect(deliveryFor({ job: { kind: 'hire' }, warehouse, centsPerKm: 100, id: undefined, newId }).shown).toBe(false)
    expect(deliveryFor({ job: { kind: 'gig', hire: { handover: 'delivery', address: 'Galway', pin: galway } }, warehouse, centsPerKm: 100, id: undefined, newId }).shown).toBe(false)
  })
})

describe("a dry hire's days on its quote", () => {
  const span = { start: '2026-11-20', end: '2026-11-23' }
  it('are From and To with their times for a delivery, with where it goes', () => {
    expect(hireWhen({ kind: 'hire', hire: { handover: 'delivery', outTime: '10:00', backTime: '17:30', address: 'Unit 4\nGalway' } }, span)).toEqual([
      { label: 'From', text: 'Fri 20 Nov, 10:00' },
      { label: 'To', text: 'Mon 23 Nov, 17:30' },
      { label: 'Delivered to', text: 'Unit 4, Galway' },
    ])
  })
  it('are Collection and Return for a collection, and for a dry hire from before', () => {
    expect(hireWhen({ kind: 'hire', hire: { handover: 'collection', outTime: '09:00' } }, span).map((w) => `${w.label} ${w.text}`)).toEqual(['Collection Fri 20 Nov, 09:00', 'Return Mon 23 Nov'])
    expect(hireWhen({ kind: 'hire' }, span).map((w) => w.label)).toEqual(['Collection', 'Return'])
  })
  it("aren't said for a show", () => expect(hireWhen({ kind: 'gig' }, span)).toEqual([]))
  it('takes a time of day only', () => {
    expect(hireTerms.safeParse({ handover: 'delivery', outTime: '24:00' }).success).toBe(false)
    expect(hireTerms.safeParse({ handover: 'delivery', outTime: '23:59' }).success).toBe(true)
  })
})

describe('stock on a quote', () => {
  it('is held once the quote is sent, pencilled while it is a draft', () => {
    expect(kitHoldOf('enquiry')).toBe('pencilled')
    expect(kitHoldOf('quoted')).toBe('held')
    expect(kitHoldOf('confirmed')).toBe('held')
    expect(kitHoldOf('lost')).toBe('none')
  })
  it('leaves vans and pick lists held only once confirmed', () => expect(holdOf('quoted')).toBe('pencilled'))
})
