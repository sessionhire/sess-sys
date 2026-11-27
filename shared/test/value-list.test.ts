import { describe, expect, it } from 'vitest'
import { readValueList, valueListPlan, type ValueListModel } from '../src/value-list.ts'

/**
 * Replacement values from a list (ADR 0204): a price check's sheet, or lines
 * pasted, read and matched to the stock list so every change shows first.
 */

const models: ValueListModel[] = [
  { id: 'a', name: 'Yamaha DM3', valueCents: 2300_00 },
  { id: 'b', name: 'XONE 92 mixer', aliases: ['Xone:92'], valueCents: 1000_00 },
  { id: 'c', name: 'Avolites Arena', valueCents: null },
  { id: 'd', name: 'Antari IP-1500', code: '0123', valueCents: 1248_00 },
]

describe('reading a list of values', () => {
  it("takes the new value's column from a price check's sheet, never the one with today's figure", () => {
    const sheet = 'No.,Product,Now (EUR),New value of one (EUR; with VAT),Source\n1,Yamaha DM3,2300,"1,999",Thomann\n2,Xone:92,1000,1299,Thomann\n'
    const read = readValueList(sheet)
    expect(read.rows).toEqual([
      { row: 2, name: 'Yamaha DM3', text: '1,999' },
      { row: 3, name: 'Xone:92', text: '1299' },
    ])
  })

  it('reads lines pasted with no header, a comma or colon or tab before the value', () => {
    const read = readValueList('Yamaha DM3, 1,999\nAvolites Arena: €24,090\nXONE 92 mixer\t1299\nJust a name\n')
    expect(read.rows).toEqual([
      { row: 1, name: 'Yamaha DM3', text: '1,999' },
      { row: 2, name: 'Avolites Arena', text: '€24,090' },
      { row: 3, name: 'XONE 92 mixer', text: '1299' },
      { row: 4, name: 'Just a name', text: '' },
    ])
  })

  it("keeps a pasted value that isn't euro apart from the name, so it shows as one that can't be read", () => {
    const { rows } = readValueList('XLR 10 m, lots\n')
    expect(rows).toEqual([{ row: 1, name: 'XLR 10 m', text: 'lots' }])
    expect(valueListPlan(rows!, [{ id: 'x', name: 'XLR 10 m', valueCents: 25_00 }]).unreadable.map((r) => r.row)).toEqual([1])
  })

  it('says so when there is nothing to read, or the letters are broken', () => {
    expect(readValueList('  \n').problem).toBeTruthy()
    expect(readValueList('Caf�, 10').problem).toMatch(/CSV UTF-8/)
  })
})

describe('what a list would change', () => {
  it('replaces a value set here, fills an empty one, and leaves the same alone', () => {
    const { rows } = readValueList('Yamaha DM3, 1999\nxone:92, 1299\nAvolites Arena, 24090\n0123, 1248\n')
    const plan = valueListPlan(rows!, models)
    expect(plan.changes).toEqual([
      { row: 1, modelId: 'a', name: 'Yamaha DM3', listName: '', was: 2300_00, valueCents: 1999_00 },
      { row: 2, modelId: 'b', name: 'XONE 92 mixer', listName: 'xone:92', was: 1000_00, valueCents: 1299_00 },
      { row: 3, modelId: 'c', name: 'Avolites Arena', listName: '', was: null, valueCents: 24090_00 },
    ])
    expect(plan.same).toBe(1)
  })

  it('lists what it can’t match or read, a product named twice, and passes over rows left blank', () => {
    const { rows } = readValueList('Product,Value\nMystery box,100\nYamaha DM3,lots\nYamaha DM3,2000\nYamaha DM3,2100\nXONE 92 mixer,\nAvolites Arena,0\n')
    const plan = valueListPlan(rows!, models)
    expect(plan.unmatched.map((r) => r.name)).toEqual(['Mystery box'])
    expect(plan.unreadable.map((r) => r.row)).toEqual([3, 7])
    expect(plan.changes.map((c) => c.valueCents)).toEqual([2000_00])
    expect(plan.twice.map((r) => r.row)).toEqual([5])
    expect(plan.blank).toBe(1)
  })
})
