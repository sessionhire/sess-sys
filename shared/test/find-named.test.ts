import { describe, expect, it } from 'vitest'
import { findNamed, namedExactly } from '../src/index.ts'

const v = (id: string, name: string, address = '') => ({ id, name, address })
// Most used first, as the forms give them.
const VENUES = [
  v('rds', 'RDS Main Hall', 'Ballsbridge, Dublin 4'),
  v('round', 'The Round Room', 'Mansion House, Dawson St, Dublin 2'),
  v('heritage', 'The Heritage', 'Killenard, Co. Laois'),
  v('mansion', 'Mansion House', 'Dawson St, Dublin 2'),
  v('hall', 'Hall of Fame', ''),
]
const ids = (typed: string) => findNamed(VENUES, typed, (x) => x.address).map((f) => f.record.id)

describe('finding a client, venue or contact by name as it is typed', () => {
  it('puts the name as typed first, then names starting with it, then a word starting with it, then anywhere', () => {
    expect(ids('hall')).toEqual(['hall', 'rds'])
    expect(ids('the')).toEqual(['round', 'heritage'])
    expect(ids('round')).toEqual(['round'])
    expect(ids('eritag')).toEqual(['heritage'])
  })

  it('needs every word, in any order, and minds no capitals, accents or dashes', () => {
    expect(ids('room round')).toEqual(['round'])
    expect(ids('RÓUND-room')).toEqual(['round'])
    expect(ids('round hall')).toEqual([])
  })

  it('finds by what else it is known by, and says so', () => {
    expect(findNamed(VENUES, 'laois', (x) => x.address)).toEqual([{ record: VENUES[2], via: 'Killenard, Co. Laois' }])
    expect(ids('mansion')).toEqual(['mansion', 'round'])
    expect(ids('laois')).toEqual(['heritage'])
    expect(findNamed(VENUES, 'laois')).toEqual([])
  })

  it('keeps the order given among alike ones, and each name once', () => {
    const clients = [{ name: 'Verve' }, { name: 'Velvet Events' }, { name: 'verve' }]
    expect(findNamed(clients, 've').map((f) => f.record.name)).toEqual(['Verve', 'Velvet Events'])
    expect(findNamed(clients, '  ')).toEqual([])
  })

  it('knows a name typed in another case or spacing as the same one', () => {
    expect(namedExactly(VENUES, 'the round  room')?.id).toBe('round')
    expect(namedExactly(VENUES, 'theroundroom')?.id).toBe('round')
    expect(namedExactly(VENUES, 'round')).toBeUndefined()
    expect(namedExactly(VENUES, '')).toBeUndefined()
  })
})
