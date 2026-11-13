import { describe, expect, it } from 'vitest'
import { PLACE_RANGE_MAX, placeRange } from '../src/counts.ts'

/** Making many places at once from a range (ADR 0176). */
describe('placeRange', () => {
  it('reads a range with its stem said once or twice', () => {
    expect(placeRange('Bay A1 to A4')).toEqual(['Bay A1', 'Bay A2', 'Bay A3', 'Bay A4'])
    expect(placeRange('Bay A1 to Bay A3')).toEqual(['Bay A1', 'Bay A2', 'Bay A3'])
    expect(placeRange('Shelf 1-3')).toEqual(['Shelf 1', 'Shelf 2', 'Shelf 3'])
    expect(placeRange('Shelf 9 – 11')).toEqual(['Shelf 9', 'Shelf 10', 'Shelf 11'])
    expect(placeRange('bay a1 TO a2')).toEqual(['bay a1', 'bay a2'])
  })
  it('keeps the first number’s leading noughts', () => {
    expect(placeRange('Rack 08 to 10')).toEqual(['Rack 08', 'Rack 09', 'Rack 10'])
  })
  it('is no range for one name, a different stem, backwards, or too many', () => {
    expect(placeRange('Bay A3')).toBeUndefined()
    expect(placeRange('Van 1')).toBeUndefined()
    expect(placeRange('Bay A1 to B9')).toBeUndefined()
    expect(placeRange('Bay 5 to 2')).toBeUndefined()
    expect(placeRange('Bay 3 to 3')).toBeUndefined()
    expect(placeRange(`Bay 1 to ${PLACE_RANGE_MAX + 1}`)).toBeUndefined()
    expect(placeRange(`Bay 1 to ${PLACE_RANGE_MAX}`)).toHaveLength(PLACE_RANGE_MAX)
    expect(placeRange('Room 1-2 upstairs')).toBeUndefined()
  })
})
