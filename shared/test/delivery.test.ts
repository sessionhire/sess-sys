import { describe, expect, it } from 'vitest'
import { deliveryFor } from '../src/delivery.ts'
import { hireWhen, hireTerms } from '../src/jobs.ts'
import { kitHoldOf, holdOf } from '../src/sync/kit-view.ts'

// Colly's answers to the quote flow audit's questions, 14 November 2026 (ADR 0183).
const galway = { lat: 53.2707, lng: -9.0568 }
const warehouse = { lat: 53.3249, lng: -6.3368 }
let n = 0
const newId = () => `id-${++n}`

describe('delivery and collection on a quote', () => {
  const hire = { kind: 'hire' as const, hire: { handover: 'delivery' as const, address: 'Galway', pin: galway } }
  it("charges a dry hire by van the km from the warehouse to the delivery address at the price a km", () => {
    const d = deliveryFor({ job: hire, warehouse, price: { centsPerKm: 150 }, id: 'keep', newId })
    expect(d.shown).toBe(true)
    expect(d.by).toBe('van')
    expect(d.none).toBeNull()
    expect(d.line).toMatchObject({ id: 'keep', kind: 'other', group: 'Delivery and collection', per: 'once', days: 1, unitCents: 150, extra: 'delivery' })
    expect(d.line!.qty).toBe(d.km)
    expect(d.km).toBeGreaterThan(200)
    expect(d.line!.what).toBe(`Van, delivery and collection, ${d.km} km from the warehouse`)
  })
  it('says why there is none: no address, not on the map, no price', () => {
    const job = (h: object) => ({ kind: 'hire' as const, hire: { handover: 'delivery' as const, ...h } })
    expect(deliveryFor({ job: job({}), warehouse, price: { centsPerKm: 150 }, id: undefined, newId }).none).toMatch(/No delivery address/)
    expect(deliveryFor({ job: job({ address: 'Somewhere', pin: null }), warehouse, price: { centsPerKm: 150 }, id: undefined, newId }).none).toMatch(/isn't on the map/)
    const unpriced = deliveryFor({ job: hire, warehouse, price: { centsPerKm: undefined }, id: undefined, newId })
    expect(unpriced.line).toBeUndefined()
    expect(unpriced.none).toMatch(/Admin › Company › Delivery and collection/)
  })
  it("charges Colly's €160 within 25 km, then each km past them", () => {
    const km = deliveryFor({ job: hire, warehouse, price: { centsPerKm: 100 }, id: undefined, newId }).km!
    const past = deliveryFor({ job: hire, warehouse, price: { baseCents: 160_00, baseKm: 25, centsPerKm: 100 }, id: 'keep', newId })
    expect(past.line).toMatchObject({ id: 'keep', qty: 1, per: 'once', unitCents: 160_00 + (km - 25) * 100, extra: 'delivery' })
    expect(past.line!.what).toBe(`Dublin flat fee, then ${km - 25} km at €1.00 a km`)
    expect(past.how).toBe(`€160.00 for the first 25 km, then ${km - 25} km at €1.00 a km`)
    // Within the km the set amount covers, it's the set amount alone.
    const near = deliveryFor({ job: hire, warehouse, price: { baseCents: 160_00, baseKm: 500 }, id: undefined, newId })
    expect(near.line).toMatchObject({ qty: 1, unitCents: 160_00 })
    expect(near.how).toBe('€160.00 for up to 500 km')
    expect(near.line!.what).toBe('Dublin flat fee')
    // Past them with no price a km, it says so rather than charge the set amount alone.
    const unpriced = deliveryFor({ job: hire, warehouse, price: { baseCents: 160_00, baseKm: 25 }, id: undefined, newId })
    expect(unpriced.line).toBeUndefined()
    expect(unpriced.none).toMatch(/No van price a km past the first 25 km/)
  })
  it('measures from Dublin until the warehouse is on the map, and says so', () => {
    const d = deliveryFor({ job: hire, warehouse: null, price: { centsPerKm: 100 }, id: undefined, newId })
    expect(d.fromWarehouse).toBe(false)
    expect(d.line!.what).toMatch(/from Dublin$/)
  })
  it('takes a show to its venue, once the quote says van; until then it has none', () => {
    const gig = { kind: 'gig' as const }
    const before = deliveryFor({ job: gig, venue: galway, warehouse, price: { baseCents: 160_00, baseKm: 25, centsPerKm: 100 }, id: undefined, newId })
    expect(before).toMatchObject({ shown: true, by: 'none', line: undefined, none: null })
    const van = deliveryFor({ job: gig, venue: galway, warehouse, price: { baseCents: 160_00, baseKm: 25, centsPerKm: 100 }, by: 'van', id: undefined, newId })
    expect(van.to).toBe('venue')
    expect(van.line!.what).toMatch(/^Dublin flat fee, then \d+ km at €1\.00 a km$/)
    const nowhere = deliveryFor({ job: gig, venue: null, warehouse, price: { centsPerKm: 100 }, by: 'van', id: undefined, newId })
    expect(nowhere.none).toMatch(/venue isn't on the map/)
  })
  it('charges a truck the price typed for the job, with or without the distance', () => {
    const asked = deliveryFor({ job: { kind: 'gig' }, venue: galway, warehouse, price: { centsPerKm: 100 }, by: 'truck', id: undefined, newId })
    expect(asked.line).toBeUndefined()
    expect(asked.none).toMatch(/priced for each job/)
    const priced = deliveryFor({ job: { kind: 'gig' }, venue: galway, warehouse, price: {}, by: 'truck', truckCents: 950_00, id: 't', newId })
    expect(priced.line).toMatchObject({ id: 't', qty: 1, unitCents: 950_00, per: 'once', extra: 'delivery' })
    expect(priced.line!.what).toMatch(/^Delivery and collection by truck, \d+ km from the warehouse$/)
    const unmapped = deliveryFor({ job: { kind: 'gig' }, venue: null, warehouse, price: {}, by: 'truck', truckCents: 950_00, id: undefined, newId })
    expect(unmapped.line!.what).toBe('Delivery and collection by truck')
  })
  it('charges a delivery or a collection only at the one-way share, half unless Admin says', () => {
    const dublin = { lat: 53.35, lng: -6.26 }
    const price = { baseCents: 160_00, baseKm: 25, centsPerKm: 100 }
    const gig = { kind: 'gig' as const }
    const there = deliveryFor({ job: gig, venue: dublin, warehouse, price, by: 'van', trips: 'delivery', id: undefined, newId })
    expect(there.line).toMatchObject({ qty: 1, unitCents: 80_00 })
    expect(there.line!.what).toBe('Dublin flat fee, delivery only')
    expect(there.how).toBe('€160.00 for up to 25 km, 50% one way')
    const back = deliveryFor({ job: gig, venue: dublin, warehouse, price, by: 'van', trips: 'collection', oneWayPct: 60, id: undefined, newId })
    expect(back.line).toMatchObject({ unitCents: 96_00 })
    expect(back.line!.what).toBe('Dublin flat fee, collection only')
    // A truck is the price typed, whichever way.
    const truck = deliveryFor({ job: gig, venue: null, warehouse, price, by: 'truck', trips: 'delivery', truckCents: 400_00, id: undefined, newId })
    expect(truck.line).toMatchObject({ unitCents: 400_00 })
    expect(truck.line!.what).toBe('Delivery only by truck')
  })
  it('lets a dry hire we deliver go with no delivery charged, when the quote says so', () => {
    const d = deliveryFor({ job: hire, warehouse, price: { centsPerKm: 100 }, by: 'none', id: undefined, newId })
    expect(d).toMatchObject({ shown: true, by: 'none', line: undefined })
  })
  it('has no section for a collection, or a dry hire from before', () => {
    expect(deliveryFor({ job: { kind: 'hire', hire: { handover: 'collection' } }, warehouse, price: { centsPerKm: 100 }, by: 'van', id: undefined, newId }).shown).toBe(false)
    expect(deliveryFor({ job: { kind: 'hire' }, warehouse, price: { centsPerKm: 100 }, id: undefined, newId }).shown).toBe(false)
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
