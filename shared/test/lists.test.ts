import { describe, expect, it } from 'vitest'
import {
  activeFilters,
  byName,
  jobFilters,
  jobSorts,
  nobodySoon,
  listed,
  NO_DEPARTMENT_KEY,
  optionCounts,
  peopleFilters,
  peopleSorts,
  placeFilters,
  PLACE_SORTS,
  PRODUCT_SORTS,
  productFilters,
  type ListFilter,
  type ListSort,
  type PlaceForList,
  REVERSED,
  sortKeyOf,
  sortReversed,
  type ProductForList,
} from '../src/lists.ts'
import type { JobView } from '../src/sync/jobs-view.ts'
import type { PersonView } from '../src/sync/crew-view.ts'

/**
 * Filter and sort for the long lists (ADR 0099): every list narrows and
 * orders the same way, ties keep the list's own order, a choice the list
 * no longer offers narrows nothing, and the counts beside a choice are what
 * pressing it would show.
 */

type N = { n: number; name: string }
const items: N[] = [
  { n: 3, name: 'c' },
  { n: 1, name: 'a' },
  { n: 2, name: 'b' },
  { n: 4, name: 'a' },
]
const odd: ListFilter<N> = {
  key: 'odd',
  label: 'Odd',
  any: 'Any',
  options: [
    { key: 'yes', label: 'Odd', test: (x) => x.n % 2 === 1 },
    { key: 'no', label: 'Even', test: (x) => x.n % 2 === 0 },
  ],
}
const big: ListFilter<N> = { key: 'big', label: 'Big', any: 'Any', options: [{ key: 'yes', label: 'Over 2', test: (x) => x.n > 2 }] }
const sorts: ListSort<N>[] = [
  { key: 'n', label: 'By number', compare: (a, b) => a.n - b.n },
  { key: 'name', label: 'By name', compare: (a, b) => byName(a.name, b.name) },
]

describe('listing', () => {
  it('sorts by the first order when none is chosen, or one not offered', () => {
    expect(listed(items, [], sorts, { sort: '', filters: {} }).map((x) => x.n)).toEqual([1, 2, 3, 4])
    expect(listed(items, [], sorts, { sort: 'gone', filters: {} }).map((x) => x.n)).toEqual([1, 2, 3, 4])
  })

  it('keeps the list’s own order for ties', () => {
    expect(listed(items, [], sorts, { sort: 'name', filters: {} }).map((x) => x.n)).toEqual([1, 4, 2, 3])
  })

  it('narrows by every filter chosen, and not by one it no longer offers', () => {
    expect(listed(items, [odd, big], sorts, { sort: 'n', filters: { odd: 'yes', big: 'yes' } }).map((x) => x.n)).toEqual([3])
    expect(listed(items, [odd], sorts, { sort: 'n', filters: { odd: 'maybe' } })).toHaveLength(4)
    expect(activeFilters([odd, big], { odd: 'maybe', big: 'yes' }).map((a) => a.filter.key)).toEqual(['big'])
  })

  it('counts each choice with the other filters as they are', () => {
    const { any, counts } = optionCounts(items, [odd, big], { odd: 'no', big: 'yes' }, odd)
    expect(any).toBe(2)
    expect(counts.get('yes')).toBe(1)
    expect(counts.get('no')).toBe(1)
  })

  it('reads names as a person does: case, fadas and numbers', () => {
    expect(['Seán', 'sean b', 'Item 10', 'Item 9'].sort(byName)).toEqual(['Item 9', 'Item 10', 'Seán', 'sean b'])
  })
})

const job = (id: string, start: string | undefined, more: Partial<JobView> = {}) =>
  ({ id, name: id, status: 'confirmed', kind: 'gig', calls: [], phases: [], span: start ? { start, end: start } : undefined, client: undefined, ...more }) as unknown as JobView

describe('jobs', () => {
  const jobs = [job('later', '2026-11-20'), job('undated', undefined), job('soon', '2026-11-01')]

  it('by date runs soonest first coming up, with no dates first, and newest first in the past', () => {
    expect(listed(jobs, [], jobSorts(false), { sort: 'date', filters: {} }).map((j) => j.id)).toEqual(['undated', 'soon', 'later'])
    expect(listed(jobs, [], jobSorts(true), { sort: 'date', filters: {} }).map((j) => j.id)).toEqual(['later', 'soon', 'undated'])
  })

  it('offers only the statuses of the tab, and filters kit short by what it is told', () => {
    const going = jobFilters((j) => j.id === 'soon', false)
    expect(going[0]!.options.map((o) => o.key)).toEqual(['enquiry', 'quoted', 'confirmed'])
    expect(jobFilters(() => false, true)[0]!.options.map((o) => o.key)).toEqual(['cancelled', 'lost'])
    expect(listed(jobs, going, jobSorts(false), { sort: 'date', filters: { kit: 'short' } }).map((j) => j.id)).toEqual(['soon'])
  })

  it('filters by stage and by tasks late or down to nobody, when told where each job is', () => {
    // Proves (audit, 5 November 2026, finding 20): Home's counts of late and unowned tasks open a list of just those.
    const at = (stage: string, late: boolean, ownerId: string | null) => ({ stage: { key: stage }, finished: false, stopped: undefined, current: { ownerId }, steps: [{ late }] })
    const where: Record<string, unknown> = { soon: at('planning', true, null), later: at('planning', false, 'aoife'), undated: at('selling', false, null) }
    const filters = jobFilters(() => false, false, (j) => where[j.id] as never)
    expect(filters.map((f) => f.key)).toEqual(['status', 'kind', 'crew', 'kit', 'stage', 'tasks'])
    const ids = (f: Record<string, string>) => listed(jobs, filters, jobSorts(false), { sort: 'date', filters: f }).map((j) => j.id)
    expect(ids({ tasks: 'late' })).toEqual(['soon'])
    expect(ids({ stage: 'planning', tasks: 'nobody' })).toEqual(['soon'])
    expect(ids({ tasks: 'nobody' })).toEqual(['undated', 'soon'])
  })

  it("counts a job down to nobody on Home only when it starts within a fortnight", () => {
    // Move 10 of the sweep of 6 November 2026: one months off is how the company works, not a signal.
    const at = (daysTo: number | undefined, span = true) => ({ job: { span: span ? {} : undefined }, daysTo, daysAfter: undefined, stage: { key: 'planning' }, finished: false, current: { ownerId: null } }) as never
    expect([at(3), at(14), at(15), at(undefined), at(undefined, false)].map(nobodySoon)).toEqual([true, true, false, true, false])
    expect(nobodySoon({ ...(at(3) as object), current: { ownerId: 'aoife' } } as never)).toBe(false)
    expect(jobFilters(() => false, true, () => undefined).map((f) => f.key)).toEqual(['status', 'kind', 'crew', 'kit'])
  })

  it('a job with no calls asks for no crew', () => {
    const filters = jobFilters(() => false, false)
    expect(listed(jobs, filters, jobSorts(false), { sort: 'date', filters: { crew: 'none' } })).toHaveLength(3)
    expect(listed(jobs, filters, jobSorts(false), { sort: 'date', filters: { crew: 'short' } })).toHaveLength(0)
  })
})

const person = (name: string, more: Partial<PersonView> = {}) => ({ id: name, name, kind: 'freelancer', department: null, level: 1, ...more }) as unknown as PersonView

describe('people', () => {
  const people = [person('Áine Walsh', { department: 'Audio' }), person('Brian Byrne', { department: 'audio', kind: 'staff', level: 3 }), person('Cara Allen')]

  it('offers each department once, and none when someone has none', () => {
    const [department] = peopleFilters(people)
    expect(department!.options.map((o) => o.label)).toEqual(['Audio', 'No department'])
    expect(listed(people, peopleFilters(people), peopleSorts(() => 0), { sort: 'name', filters: { department: 'audio' } })).toHaveLength(2)
    expect(listed(people, peopleFilters(people), peopleSorts(() => 0), { sort: 'name', filters: { department: NO_DEPARTMENT_KEY } }).map((p) => p.name)).toEqual(['Cara Allen'])
  })

  it('sorts by last name, level and bookings ahead', () => {
    const s = peopleSorts((p) => (p.name === 'Cara Allen' ? 2 : 0))
    expect(listed(people, [], s, { sort: 'surname', filters: {} }).map((p) => p.name)).toEqual(['Cara Allen', 'Brian Byrne', 'Áine Walsh'])
    expect(listed(people, [], s, { sort: 'level', filters: {} })[0]!.name).toBe('Brian Byrne')
    expect(listed(people, [], s, { sort: 'booked', filters: {} })[0]!.name).toBe('Cara Allen')
  })

  it('offers only the levels in use', () => {
    expect(peopleFilters(people)[2]!.options.map((o) => o.key)).toEqual(['1', '3'])
  })
})

describe('the catalogue', () => {
  const products: ProductForList[] = [
    { name: 'SM58', category: 'Microphones', department: 'audio', total: 12 },
    { name: 'Hazer', category: '', department: 'lighting', total: 0, dryHire: true },
    { name: 'Beta 91', category: 'microphones', department: 'audio', total: 4 },
  ]

  it('offers whose only once there is dry hire, and each category once', () => {
    const filters = productFilters(products)
    expect(filters.map((f) => f.key)).toEqual(['whose', 'category', 'stock'])
    expect(filters[1]!.options.map((o) => o.label)).toEqual(['Microphones'])
    expect(productFilters(products.filter((m) => !m.dryHire)).map((f) => f.key)).toEqual(['category', 'stock'])
  })

  it('sorts by most in stock, and a product with no category last', () => {
    expect(listed(products, [], PRODUCT_SORTS, { sort: 'most', filters: {} }).map((m) => m.name)).toEqual(['SM58', 'Beta 91', 'Hazer'])
    expect(listed(products, [], PRODUCT_SORTS, { sort: 'category', filters: {} }).at(-1)!.name).toBe('Hazer')
  })
})

describe('venues and clients', () => {
  const places: PlaceForList[] = [
    { name: 'Vicar Street', jobs: 3, lastJob: '2026-10-01', comingUp: 0, docs: 1, pinned: true },
    { name: '3Arena', jobs: 5, lastJob: '2026-12-01', comingUp: 2, docs: 0, pinned: false },
    { name: 'Olympia', jobs: 0, lastJob: undefined, comingUp: 0, docs: 0, pinned: false },
  ]

  it('sorts by most recent job, with none last', () => {
    expect(listed(places, [], PLACE_SORTS, { sort: 'recent', filters: {} }).map((p) => p.name)).toEqual(['3Arena', 'Vicar Street', 'Olympia'])
  })

  it('filters venues by the map, which clients have not', () => {
    expect(placeFilters(false).map((f) => f.key)).toEqual(['jobs', 'docs'])
    expect(listed(places, placeFilters(true), PLACE_SORTS, { sort: 'name', filters: { map: 'off', jobs: 'some' } }).map((p) => p.name)).toEqual(['3Arena'])
  })
})

describe('a sort turned round (Colly, 12 November 2026: a table head sorts one way, then the other)', () => {
  const items = [{ n: 'b' }, { n: 'a' }, { n: 'c' }]
  const sorts: ListSort<{ n: string }>[] = [{ key: 'name', label: 'Name, A to Z', compare: (a, b) => byName(a.n, b.n) }]
  it('runs the way its name says, and the other way with :desc', () => {
    expect(listed(items, [], sorts, { sort: 'name', filters: {} }).map((i) => i.n)).toEqual(['a', 'b', 'c'])
    expect(listed(items, [], sorts, { sort: `name${REVERSED}`, filters: {} }).map((i) => i.n)).toEqual(['c', 'b', 'a'])
    expect(sortKeyOf('name:desc')).toBe('name')
    expect(sortReversed('name')).toBe(false)
  })
  it("a sort no longer offered falls back to the list's first, the way it says", () => {
    expect(listed(items, [], sorts, { sort: 'gone:desc', filters: {} }).map((i) => i.n)).toEqual(['a', 'b', 'c'])
  })
  it('jobs offer venue always, and status and assignee only with their tasks', () => {
    expect(jobSorts(false).map((s) => s.key)).toEqual(['date', 'name', 'client', 'crew', 'venue'])
    expect(jobSorts(false, () => undefined).map((s) => s.key)).toEqual(['date', 'name', 'client', 'crew', 'venue', 'status', 'assignee'])
  })
})
