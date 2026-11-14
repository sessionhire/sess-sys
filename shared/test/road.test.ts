import { describe, expect, it } from 'vitest'
import { DUBLIN_CENTRE, driveMinutesFor, driveWords, earliestCall, roadFor, roadKm, roadWords, warehouseFrom } from '../src/index.ts'

/** A van out on the road (ADR 0179): the drive from the map, typed over it, and when it leaves and is back. */

const galway = { lat: 53.2715, lng: -9.0533 }
const cork = { lat: 51.8985, lng: -8.4756 }

describe('the drive from the map', () => {
  it('measures from Dublin city centre until the warehouse is on the map', () => {
    expect(warehouseFrom(null)).toEqual({ pin: DUBLIN_CENTRE, set: false })
    expect(warehouseFrom(galway)).toEqual({ pin: galway, set: true })
  })

  it('takes a van to Galway in under three hours and Cork in a little over, longer for a truck', () => {
    const km = roadKm(DUBLIN_CENTRE, galway)
    expect(km).toBe(223)
    expect(driveMinutesFor(km, 'van')).toBe(165)
    expect(driveMinutesFor(roadKm(DUBLIN_CENTRE, cork), 'van')).toBeGreaterThan(180)
    expect(driveMinutesFor(km, 'truck')).toBeGreaterThan(driveMinutesFor(km, 'van'))
  })

  it('says a drive to the next five minutes, never none', () => {
    expect(driveMinutesFor(0, 'van')).toBe(5)
    expect(driveMinutesFor(3, 'van')).toBe(10)
    expect(driveWords(165)).toBe('2 h 45')
    expect(driveWords(40)).toBe('40 min')
    expect(driveWords(180)).toBe('3 h')
  })
})

describe('the road a booking takes', () => {
  const at = { from: DUBLIN_CENTRE, to: galway, kind: 'van' as const }

  it('is away on its own days while no time is said', () => {
    const r = roadFor({ start: '2031-03-04', end: '2031-03-05' }, at)
    expect(r).toMatchObject({ minutes: 165, km: 223, source: 'map', leaves: null, back: null, start: '2031-03-04', end: '2031-03-05' })
  })

  it('leaves the drive before it is due, and is back the drive after it leaves, into the next day', () => {
    const r = roadFor({ start: '2031-03-04', end: '2031-03-05', arriveBy: '08:00', leaveAt: '23:30' }, at)
    expect(r.leaves).toEqual({ day: '2031-03-04', time: '05:15' })
    expect(r.back).toEqual({ day: '2031-03-06', time: '02:15' })
    expect([r.start, r.end]).toEqual(['2031-03-04', '2031-03-06'])
    expect(roadWords(r).join(' · ')).toBe('Leaves the warehouse about 05:15 Tue 4 Mar · back about 02:15 Thu 6 Mar · about 2 h 45 each way (223 km)')
  })

  it('leaves the night before for an early call, and takes the crew’s call when none is typed', () => {
    const r = roadFor({ start: '2031-03-04', end: '2031-03-04' }, { ...at, crewCall: '02:00' })
    expect(r.arriveFrom).toBe('crew')
    expect(r.leaves).toEqual({ day: '2031-03-03', time: '23:15' })
    expect(r.start).toBe('2031-03-03')
  })

  it('takes a typed drive over the map, and has none with no pin and none typed', () => {
    expect(roadFor({ start: '2031-03-04', end: '2031-03-04', driveMinutes: 200 }, at)).toMatchObject({ minutes: 200, km: null, source: 'typed' })
    const none = roadFor({ start: '2031-03-04', end: '2031-03-04', arriveBy: '08:00' }, { ...at, to: null })
    expect(none).toMatchObject({ minutes: null, source: null, leaves: null })
    expect(roadWords(none)[0]).toMatch(/isn’t on the map/)
  })

  it('finds the earliest call of the job’s crew on the day, for its phase or the whole job', () => {
    const call = (callTime: string | null, phaseId: string | null, status = 'open') => ({ projectId: 'j', phaseId, start: '2031-03-04', end: '2031-03-05', callTime, status })
    const calls = [call('09:00', null), call('07:00', 'other'), call('08:00', 'p'), call('06:00', 'p', 'cancelled'), call(null, 'p')]
    expect(earliestCall(calls, 'j', 'p', '2031-03-04')).toBe('08:00')
    expect(earliestCall(calls, 'j', null, '2031-03-04')).toBe('07:00')
    expect(earliestCall(calls, 'j', 'p', '2031-03-06')).toBeNull()
  })
})
