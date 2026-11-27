import { describe, expect, it } from 'vitest'
import { matcherFor, pastJobsLike, pastMatchWords, rmsMatched, pastJobSuggestions, suggestionLine, type PastJobRef, type Pricing, type QuoteLine } from '../src/index.ts'

/**
 * Start a quote from a past job (ADR 0115): jobs like the new one, closest first, and what each needed, taken at what
 * actually went out, with what went beyond its quote marked.
 */

const STOCK = [
  { id: 'sm58', name: 'Shure SM58', department: 'audio' as const },
  { id: 'di', name: 'DI box', department: 'audio' as const },
  { id: 'p5', name: 'SGM P5', department: 'lighting' as const },
  { id: 'haze', name: 'Hazer', department: 'lighting' as const },
]
const pricing: Pricing = {
  matcher: matcherFor(STOCK),
  model: (id) => STOCK.find((x) => x.id === id),
  productPrice: (id) => ({ sm58: 1_000, di: 500, p5: 9_000 })[id],
  productRate: () => 'daily',
  rolePrice: (role) => (role === 'Sound engineer' ? 45_000 : undefined),
  roles: ['Sound engineer'],
}

const job = (id: string, clientId: string | null, venueId: string | null, end: string, status: PastJobRef['status'] = 'confirmed'): PastJobRef => ({
  id,
  name: id,
  clientId,
  venueId,
  status,
  span: { start: end, end },
})

describe('pastJobsLike', () => {
  const jobs = [
    job('client-old', 'acme', 'other', '2026-03-01'),
    job('venue-new', 'someone', 'rds', '2026-09-01'),
    job('both-old', 'acme', 'rds', '2026-01-01'),
    job('both-new', 'acme', 'rds', '2026-06-01'),
    job('lost', 'acme', 'rds', '2026-07-01', 'lost'),
    job('ahead', 'acme', 'rds', '2026-12-01', 'confirmed'),
    job('neither', 'x', 'y', '2026-05-01'),
  ]
  it('puts the most in common first, latest first among those with as much', () => {
    const r = pastJobsLike(jobs, { clientId: 'acme', venueId: 'rds' }, '2026-11-08', () => true)
    expect(r.map((x) => [x.job.id, x.matched])).toEqual([
      ['both-new', ['client', 'venue']],
      ['both-old', ['client', 'venue']],
      ['venue-new', ['venue']],
      ['client-old', ['client']],
    ])
  })
  it('counts a name like it as a match, so all three come before two', () => {
    const named = [
      { ...job('a', 'acme', 'rds', '2026-02-01'), name: 'Nissan Launch 2025' },
      { ...job('b', 'acme', 'rds', '2026-08-01'), name: 'Christmas party' },
      { ...job('c', 'other', 'elsewhere', '2026-09-01'), name: 'Nissan launch' },
      { ...job('d', 'other', 'rds', '2026-10-01'), name: 'Launch party' },
    ]
    const r = pastJobsLike(named, { clientId: 'acme', venueId: 'rds', name: 'Nissan Launch' }, '2026-11-08', () => true)
    expect(r.map((x) => [x.job.id, x.matched])).toEqual([
      ['a', ['client', 'venue', 'name']],
      ['b', ['client', 'venue']],
      ['d', ['venue']],
      ['c', ['name']],
    ])
  })
  it('finds jobs by name alone, before a client or venue is known', () => {
    const named = [{ ...job('a', 'acme', 'rds', '2026-02-01'), name: 'Web Summit 2025' }, { ...job('b', 'x', 'y', '2026-03-01'), name: 'Summit dinner' }]
    expect(pastJobsLike(named, { clientId: null, venueId: null, name: 'Web Summit' }, '2026-11-08', () => true).map((x) => x.job.id)).toEqual(['a'])
  })
  it('leaves out jobs that are not over, did not go ahead, or have nothing to start from', () => {
    const r = pastJobsLike(jobs, { clientId: 'acme', venueId: null }, '2026-11-08', (id) => id !== 'both-old')
    expect(r.map((x) => x.job.id)).toEqual(['both-new', 'client-old'])
  })
  it('offers none for a new client at a new venue', () => {
    expect(pastJobsLike(jobs, { clientId: null, venueId: null }, '2026-11-08', () => true)).toEqual([])
  })
})

describe('pastMatchWords and rmsMatched', () => {
  it('says what matched', () => {
    expect(pastMatchWords(['name', 'client', 'venue'])).toBe('Same client, venue and name')
    expect(pastMatchWords(['venue'])).toBe('Same venue')
    expect(pastMatchWords(['client', 'name'])).toBe('Same client and name')
    expect(pastMatchWords(['name'])).toBe('Similar name')
  })
  it('reads a Current RMS quote the same way', () => {
    expect(rmsMatched({ client: 'Verve Live Ltd', venue: 'The RDS', subject: 'Coke Truck Tour' }, { client: 'Verve Live', venue: 'RDS', name: 'Coke truck tour' })).toEqual(['client', 'venue', 'name'])
    expect(rmsMatched({ client: 'Fuel', venue: '', subject: 'KPMG Launch' }, { client: 'Verve', venue: 'RDS', name: 'Launch party' })).toEqual([])
  })
})

let n = 0
const q = (l: Partial<QuoteLine>): QuoteLine => ({ id: `l${++n}`, kind: 'kit', what: '', ref: null, group: 'Audio', qty: 1, days: 2, unitCents: 0, vat: 23, per: 'day', modelId: null, ...l }) as QuoteLine

describe('pastJobSuggestions', () => {
  const quoteLines = [
    q({ what: 'Shure SM58', modelId: 'sm58', qty: 4, unitCents: 800 }),
    q({ what: 'DI box', modelId: 'di', qty: 2, unitCents: 500 }),
    q({ what: 'SGM P5', modelId: 'p5', qty: 8, unitCents: 9_000, group: 'Lighting' }),
    q({ kind: 'crew', what: 'Sound engineer', qty: 1, days: 2, unitCents: 40_000, group: 'Crew' }),
    q({ kind: 'other', what: 'Travel', qty: 1, days: 1, per: 'once', unitCents: 5_000, extra: 'travel' } as Partial<QuoteLine>),
  ]
  const kit = [
    { modelId: 'sm58', listed: 6, subhired: 0, wentOut: 6 },
    { modelId: 'di', listed: 2, subhired: 0, wentOut: 0 },
    { modelId: 'p5', listed: 8, subhired: 2, wentOut: 4 },
    { modelId: 'haze', listed: 1, subhired: 0, wentOut: 1 },
  ]
  const lines = pastJobSuggestions({ quoteLines, kit, scanned: true, days: 3, pastDays: 2 }, pricing)
  const of = (what: string) => lines.find((x) => x.s.what === what)!

  it('takes kit at what went out, and says how it differed from the quote', () => {
    expect(of('Shure SM58').s).toMatchObject({ qty: 6, note: '4 quoted, 6 went out', beyond: true, days: 3, modelId: 'sm58' })
    expect(of('SGM P5').s).toMatchObject({ qty: 6, note: '8 quoted, 6 went out' })
    expect(of('SGM P5').s.beyond).toBeFalsy()
  })
  it('offers what was quoted and never went out unticked', () => {
    expect(of('DI box')).toMatchObject({ take: false, s: { qty: 2, note: '2 quoted, none went out' } })
  })
  it('adds what went out beyond the quote, after the quote’s own lines', () => {
    expect(lines.at(-1)).toMatchObject({ take: true, s: { what: 'Hazer', qty: 1, note: 'Not on the quote: 1 went out', beyond: true } })
  })
  it('prices from today’s price list, keeping what was charged where there is none', () => {
    expect(of('Shure SM58').s.cents).toBe(1_000)
    expect(of('Hazer').s.cents).toBeUndefined()
    expect(of('Sound engineer').s).toMatchObject({ kind: 'crew', cents: 45_000, days: 3, note: 'As quoted' })
  })
  it('leaves out travel and subsistence, which are worked out again', () => {
    expect(lines.some((x) => x.s.what === 'Travel')).toBe(false)
  })
  it('falls back to the kit list when nothing was scanned out', () => {
    const r = pastJobSuggestions({ quoteLines, kit, scanned: false, days: 2, pastDays: 2 }, pricing)
    expect(r.find((x) => x.s.what === 'Shure SM58')!.s.note).toBe('4 quoted, 6 on the kit list')
    expect(r.find((x) => x.s.what === 'DI box')!.s.note).toBe('As quoted')
  })
  it('keeps a package as its line, and does not offer its products again beside it', () => {
    const pack = q({ what: 'Mic package', qty: 1, unitCents: 5_000, packageId: 'mics', includes: '4 × Shure SM58' } as Partial<QuoteLine>)
    const r = pastJobSuggestions(
      { quoteLines: [pack], kit: [{ modelId: 'sm58', listed: 4, subhired: 0, wentOut: 5 }], scanned: true, days: 1, pastDays: 1, packageItems: () => [{ modelId: 'sm58', qty: 4 }] },
      pricing
    )
    expect(r.map((x) => [x.s.what, x.s.qty, x.s.note])).toEqual([
      ['Mic package', 1, 'As quoted'],
      ['Shure SM58', 1, 'Not on the quote: 1 went out'],
    ])
    expect(suggestionLine(r[0]!.s, 'x')).toMatchObject({ packageId: 'mics', includes: '4 × Shure SM58', unitCents: 5_000 })
  })
  it('brings an LED screen as the kit that made it, not as a line with no price (ADR 0207)', () => {
    const screen = q({ id: 'screen', what: 'LED screen 5 × 3 m, hung', group: 'LED screen', screen: { panel: 'sm58', cols: 10, rows: 6, stands: 'hung' } } as Partial<QuoteLine>)
    const r = pastJobSuggestions(
      { quoteLines: [screen, q({ what: 'Shure SM58', modelId: 'sm58', qty: 60, unitCents: 800, group: 'LED screen', under: 'screen' })], kit: [{ modelId: 'sm58', listed: 60, subhired: 0, wentOut: 60 }], scanned: true, days: 1, pastDays: 1 },
      pricing
    )
    expect(r.map((x) => [x.s.what, x.s.qty, x.s.note])).toEqual([['Shure SM58', 60, 'As quoted']])
  })
})
