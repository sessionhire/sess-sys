import { describe, expect, it } from 'vitest'
import type { Phase, Project } from '../src/jobs.ts'
import { jobsView } from '../src/sync/jobs-view.ts'
import { masterCalendar, weekBars } from '../src/sync/master-calendar.ts'

/**
 * Jobs › Calendar (ADR 0123): a month with every job on and every job that
 * might be, confirmed solid and enquiries and quotes (the potential ones) dashed, the
 * quote's state only for those sent quotes, and the jobs with no dates kept.
 */

const project = (id: string, name: string, status: Project['status'] = 'confirmed'): Project => ({ id, name, clientId: null, venueId: null, status, notes: '' })
const phase = (id: string, projectId: string, name: string, start: string, end: string): Phase => ({ id, projectId, name, start, end, venueId: null, notes: '', contactId: null, localCrew: 0 })

function view() {
  return jobsView(
    {
      project: {
        a: project('a', 'Arena gig'),
        b: project('b', 'Brand launch', 'quoted'),
        c: project('c', 'Conference', 'enquiry'),
        d: project('d', 'Dropped', 'lost'),
        e: project('e', 'Exhibition, no dates', 'enquiry'),
      },
      phase: {
        a1: phase('a1', 'a', 'Build', '2031-03-03', '2031-03-04'),
        a2: phase('a2', 'a', 'Show', '2031-03-05', '2031-03-05'),
        b1: phase('b1', 'b', 'Show', '2031-03-05', '2031-03-05'),
        c1: phase('c1', 'c', 'Show', '2031-02-28', '2031-03-01'),
        d1: phase('d1', 'd', 'Show', '2031-03-05', '2031-03-05'),
      },
    },
    [],
    0,
    []
  )
}

const day = (cal: ReturnType<typeof masterCalendar>, d: string) => cal.weeks.flat().find((x) => x.day === d)!

describe('the master calendar', () => {
  it('lays a month out Monday to Sunday, with the days either side that fill its weeks', () => {
    const cal = masterCalendar(view(), '2031-03-17')
    expect(cal.weeks[0]![0]!.day).toBe('2031-02-24')
    expect(cal.weeks.at(-1)!.at(-1)!.day).toBe('2031-04-06')
    expect(cal.weeks.every((w) => w.length === 7)).toBe(true)
    expect(day(cal, '2031-02-28').inMonth).toBe(false)
    expect(day(cal, '2031-03-01').inMonth).toBe(true)
    expect(day(cal, '2031-03-17').holiday).toBe("St Patrick's Day")
  })

  it('puts confirmed jobs and potential ones on the same days, the confirmed first, and leaves out what is not going ahead', () => {
    const cal = masterCalendar(view(), '2031-03-01', 'all', (id) => (id === 'b' ? 'sent' : undefined))
    expect(day(cal, '2031-03-05').entries.map((e) => [e.name, e.tentative, e.phases, e.quote])).toEqual([
      ['Arena gig', false, ['Show'], undefined],
      ['Brand launch', true, ['Show'], 'sent'],
    ])
    expect(day(cal, '2031-03-03').entries[0]).toMatchObject({ phases: ['Build 1/2'], first: true, last: false })
    expect(day(cal, '2031-03-05').entries[0]).toMatchObject({ first: false, last: true })
    expect(cal.confirmed).toBe(1)
    // The conference's first day is in February: it still counts for March, where it ends.
    expect(cal.potential).toBe(2)
    expect(cal.undated.map((j) => j.name)).toEqual(['Exhibition, no dates'])
  })

  it('shows only the confirmed, or only the enquiries and quotes', () => {
    const confirmed = masterCalendar(view(), '2031-03-01', 'confirmed')
    expect(day(confirmed, '2031-03-05').entries.map((e) => e.name)).toEqual(['Arena gig'])
    expect(confirmed.potential).toBe(0)
    expect(confirmed.undated).toEqual([])
    const potential = masterCalendar(view(), '2031-03-01', 'potential')
    expect(day(potential, '2031-03-05').entries.map((e) => e.name)).toEqual(['Brand launch'])
    expect(day(potential, '2031-03-01').entries.map((e) => [e.name, e.status])).toEqual([['Conference', 'enquiry']])
    expect(potential.confirmed).toBe(0)
  })
})

describe('a week as bars', () => {
  it('draws a job of several days as one bar, in lines that never overlap', () => {
    const cal = masterCalendar(view(), '2031-03-01')
    // Monday 3 to Sunday 9 March: the arena gig Monday to Wednesday, the launch on the Wednesday.
    const { bars, lanes } = weekBars(cal.weeks[1]!)
    expect(bars.map((b) => [b.name, b.from, b.span, b.lane, b.phases])).toEqual([
      ['Arena gig', 0, 3, 0, ['Build', 'Show']],
      ['Brand launch', 2, 1, 1, ['Show']],
    ])
    expect(lanes).toBe(2)
    // The conference runs Friday 28 February into Saturday 1 March: one bar in the first week.
    const first = weekBars(cal.weeks[0]!).bars
    expect(first.map((b) => [b.name, b.from, b.span, b.before, b.after])).toEqual([['Conference', 4, 2, false, false]])
  })
})
