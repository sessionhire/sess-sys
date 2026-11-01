import { describe, expect, it } from 'vitest'
import { cableColourList, colourForLength, DEFAULT_CABLE_COLOURS, lengthFromName, lengthLabel, stepRange } from '../src/cable-colours.ts'
import { stockCommandSchemas } from '../src/stock.ts'

describe('cable lengths and their colours (ADR 0105)', () => {
  it('gives a length the first colour it fits under, and none past the last or without a length', () => {
    expect(colourForLength(0.5, DEFAULT_CABLE_COLOURS)).toBe('brown')
    expect(colourForLength(1, DEFAULT_CABLE_COLOURS)).toBe('brown')
    expect(colourForLength(1.5, DEFAULT_CABLE_COLOURS)).toBe('red')
    expect(colourForLength(10, DEFAULT_CABLE_COLOURS)).toBe('green')
    expect(colourForLength(15, DEFAULT_CABLE_COLOURS)).toBe('blue')
    expect(colourForLength(50, DEFAULT_CABLE_COLOURS)).toBe('white')
    expect(colourForLength(100, DEFAULT_CABLE_COLOURS)).toBeUndefined()
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
