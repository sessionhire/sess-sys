import { describe, expect, it } from 'vitest'
import type { CallView, OfferView } from '../src/sync/crew-view.ts'
import { crewNext } from '../src/sync/jobs-view.ts'

const day = '2030-07-04'
const offer = (id: string, status: OfferView['status']): OfferView => ({ id, personId: id, status, days: [day], person: { id, name: id } }) as unknown as OfferView
const call = (id: string, needed: number, offers: OfferView[], status = 'open'): CallView => {
  const held = new Set(offers.filter((o) => o.status === 'accepted' || o.status === 'confirmed').map((o) => o.personId)).size
  return { id, role: id, needed, status, offers, days: [day], heldByDay: { [day]: held }, openDays: held < needed ? [day] : [] } as unknown as CallView
}

describe('crewNext', () => {
  it('finds a yes to confirm first, even on a call whose places are all held', () => {
    const next = crewNext([call('Rigger', 1, [offer('aoife', 'accepted')]), call('LX op', 1, [])])
    expect(next.yes?.offer.id).toBe('aoife')
    expect(next.ask?.call.id).toBe('LX op')
  })
  it('asks on the first call with places nobody has been offered, counting those offered', () => {
    const next = crewNext([call('Rigger', 2, [offer('a', 'offered'), offer('b', 'offered')]), call('Stagehand', 3, [offer('c', 'confirmed')])])
    expect(next.ask).toMatchObject({ call: { id: 'Stagehand' }, places: 2, asked: 1 })
    expect(next.waiting).toBe(2)
  })
  it('leaves out cancelled calls and is quiet once every place is offered', () => {
    const next = crewNext([call('Rigger', 1, [offer('a', 'offered')]), call('Gone', 4, [], 'cancelled')])
    expect(next.ask).toBeUndefined()
    expect(next.yes).toBeUndefined()
    expect(next.waiting).toBe(1)
  })
})
