import { describe, expect, it } from 'vitest'
import {
  cableColourList,
  colourForLength,
  DEFAULT_CABLE_COLOURS,
  isCable,
  lengthFromName,
  lengthLabel,
  lengthTidies,
  nameWithLength,
  nameWithoutLength,
  productNameKey,
  shownName,
  stepRange,
} from '../src/cable-colours.ts'
import { findProducts } from '../src/find-product.ts'
import { stockCommandSchemas } from '../src/stock.ts'

describe('cable lengths and their colours (ADR 0106)', () => {
  it('gives a length the first colour it fits under, and none past the last or without a length', () => {
    expect(colourForLength(0.5, DEFAULT_CABLE_COLOURS)).toBe('brown')
    expect(colourForLength(1, DEFAULT_CABLE_COLOURS)).toBe('brown')
    expect(colourForLength(1.5, DEFAULT_CABLE_COLOURS)).toBe('red')
    expect(colourForLength(10, DEFAULT_CABLE_COLOURS)).toBe('green')
    expect(colourForLength(15, DEFAULT_CABLE_COLOURS)).toBe('blue')
    expect(colourForLength(50, DEFAULT_CABLE_COLOURS)).toBe('white')
    expect(colourForLength(100, DEFAULT_CABLE_COLOURS)).toBe('pink')
    expect(colourForLength(150, DEFAULT_CABLE_COLOURS)).toBe('sky')
    expect(colourForLength(200, DEFAULT_CABLE_COLOURS)).toBeUndefined()
    expect(colourForLength(null, DEFAULT_CABLE_COLOURS)).toBeUndefined()
  })

  it('says lengths and ranges as the office reads them', () => {
    expect(lengthLabel(10)).toBe('10 m')
    expect(lengthLabel(0.5)).toBe('0.5 m')
    expect(stepRange(DEFAULT_CABLE_COLOURS, 0)).toBe('Up to 1 m')
    expect(stepRange(DEFAULT_CABLE_COLOURS, 4)).toBe('Over 5 m, up to 10 m')
  })

  it('reads a length from a product name, and none where the name says no metres', () => {
    expect(lengthFromName('XLR 10m')).toBe(10)
    expect(lengthFromName('10 m XLR')).toBe(10)
    expect(lengthFromName('Speakon NL4 1.5 metre')).toBe(1.5)
    expect(lengthFromName('DMX 5-pin 3M')).toBe(3)
    expect(lengthFromName('Cat6 0,5m')).toBe(0.5)
    expect(lengthFromName('25 way multicore')).toBeNull()
    expect(lengthFromName('Shure SM58')).toBeNull()
    expect(lengthFromName('3 pin XLR 20 mtr')).toBe(20)
    expect(lengthFromName('16mm truss')).toBeNull()
  })

  it('keeps a list shortest first, each length once', () => {
    expect(cableColourList.safeParse(DEFAULT_CABLE_COLOURS).success).toBe(true)
    expect(cableColourList.safeParse([{ upToM: 5, colour: 'red' }, { upToM: 2, colour: 'blue' }]).success).toBe(false)
    expect(cableColourList.safeParse([{ upToM: 5, colour: 'red' }, { upToM: 5, colour: 'blue' }]).success).toBe(false)
    expect(cableColourList.safeParse([{ upToM: 5, colour: 'tartan' }]).success).toBe(false)
  })

  it("keeps a product's length to a tenth of a metre", () => {
    const update = stockCommandSchemas['model.update']
    expect(update.parse({ id: 'm1', lengthM: 10.04 }).lengthM).toBe(10)
    expect(update.parse({ id: 'm1', lengthM: null }).lengthM).toBeNull()
    expect(update.safeParse({ id: 'm1', lengthM: 0 }).success).toBe(false)
  })
})

describe("a cable's length beside its name (ADR 0202)", () => {
  it('takes the length out of a name, tidying what was around it', () => {
    expect(nameWithoutLength('XLR 10m')).toBe('XLR')
    expect(nameWithoutLength('10 m XLR')).toBe('XLR')
    expect(nameWithoutLength('Speakon - 1.5 metre')).toBe('Speakon')
    expect(nameWithoutLength('DMX (5m)')).toBe('DMX')
    expect(nameWithoutLength('3 pin XLR 10m')).toBe('3 pin XLR')
    expect(nameWithoutLength('XLR - 10m - male')).toBe('XLR - male')
    expect(nameWithoutLength('XLR 10M, black')).toBe('XLR, black')
    expect(nameWithoutLength('25 way multicore')).toBe('25 way multicore')
    // Nothing would be left.
    expect(nameWithoutLength('10m')).toBe('10m')
  })

  it('shows the length after the name, unless the name says it already', () => {
    expect(nameWithLength({ name: 'XLR', lengthM: 10 })).toBe('XLR 10 m')
    expect(nameWithLength({ name: 'XLR', lengthM: 0.5 })).toBe('XLR 0.5 m')
    expect(nameWithLength({ name: 'XLR 10m', lengthM: 10 })).toBe('XLR 10m')
    expect(nameWithLength({ name: 'Shure SM58', lengthM: null })).toBe('Shure SM58')
    expect(shownName(undefined)).toBeUndefined()
  })

  it('counts a name and a length as one product, whichever holds the length', () => {
    expect(productNameKey({ name: 'XLR 10m' })).toBe(productNameKey({ name: 'xlr', lengthM: 10 }))
    expect(productNameKey({ name: 'XLR', lengthM: 5 })).not.toBe(productNameKey({ name: 'XLR', lengthM: 10 }))
    expect(productNameKey({ name: 'XLR' })).not.toBe(productNameKey({ name: 'XLR', lengthM: 10 }))
  })

  it('knows a cable by its name, category or length', () => {
    expect(isCable({ name: 'XLR' })).toBe(true)
    expect(isCable({ name: 'Mains', category: 'Cables' })).toBe(true)
    expect(isCable({ name: 'Truss', lengthM: 2 })).toBe(true)
    expect(isCable({ name: 'Shure SM58', category: 'Microphones' })).toBe(false)
  })

  it('lists the names to tidy, with any that would clash or already say another length', () => {
    const tidies = lengthTidies([
      { id: 'a', name: 'XLR 10m', category: 'Cables', lengthM: null },
      { id: 'b', name: 'Speakon 5m', category: 'Cables', lengthM: null },
      { id: 'c', name: 'Speakon', category: 'Cables', lengthM: 5 },
      { id: 'd', name: 'DMX 3m', category: 'Cables', lengthM: 15 },
      { id: 'e', name: 'Truss 2m', category: 'Truss', lengthM: null },
      { id: 'f', name: 'Shure SM58', category: 'Microphones', lengthM: null },
    ])
    expect(tidies.map((t) => [t.id, t.to, t.lengthM, t.cable, t.differs, t.clash ?? ''])).toEqual([
      ['a', 'XLR', 10, true, false, ''],
      ['b', 'Speakon', 5, true, false, 'Speakon'],
      ['d', 'DMX', 3, true, true, ''],
      ['e', 'Truss', 2, false, false, ''],
    ])
  })

  it('finds a cable by its length as typed', () => {
    const products = [
      { id: 'x5', name: 'XLR', department: 'audio' as const, category: 'Cables', lengthM: 5 },
      { id: 'x10', name: 'XLR', department: 'audio' as const, category: 'Cables', lengthM: 10 },
    ]
    expect(findProducts(products, 'xlr 10').map((f) => f.product.id)).toEqual(['x10'])
    expect(findProducts(products, 'xlr').map((f) => f.product.id)).toEqual(['x5', 'x10'])
  })
})
