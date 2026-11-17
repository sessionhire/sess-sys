import { describe, expect, it } from 'vitest'
import { callSheet, callSheetText, sheetMessage, type SheetInput, type SheetPerson } from '../src/callsheet.ts'

/**
 * Call sheets (ADR 0021): what the office, the contact on the day and the
 * rest of the crew each see of one phase.
 */

const people: SheetPerson[] = [
  { id: 'aoife', name: 'Aoife Brennan', phone: '+44 7700 900101' },
  { id: 'dara', name: 'Dara Quinn', phone: '+44 7700 900102' },
  { id: 'eimear', name: 'Eimear Nolan', phone: '+44 7700 900103' },
  { id: 'fionn', name: 'Fionn Gallagher', phone: '+44 7700 900104' },
  { id: 'tadhg', name: 'Tadhg Brady', phone: null },
]

function input(readerId?: string): SheetInput {
  return {
    job: { name: 'Harbour Lights Festival', notes: 'Two stages; the main stage is ours.' },
    client: { name: 'Shannonside Festivals', contacts: [{ name: 'Niamh Walsh', role: 'Producer', email: 'niamh@example.com', phone: '+44 7700 900200' }] },
    phase: { name: 'Show', start: '2026-10-08', end: '2026-10-09', notes: '12:00 Crew call\n17:30 Doors\n23:00 Curfew' },
    venue: { name: 'Riverside Park', address: 'Riverside Park\nLimerick', notes: 'Load in from the north gate.' },
    contact: people[0]!,
    people: new Map(people.map((p) => [p.id, p])),
    calls: [
      {
        id: 'lx',
        role: 'LX op',
        start: '2026-10-08',
        end: '2026-10-09',
        callTime: '12:00',
        needed: 1,
        details: '',
        status: 'open',
        offers: [{ personId: 'fionn', status: 'countered', days: ['2026-10-08', '2026-10-09'] }],
      },
      {
        id: 'sound',
        role: 'Sound No.1',
        start: '2026-10-08',
        end: '2026-10-09',
        callTime: '10:00',
        needed: 1,
        details: 'Food on site. Blacks, please.',
        status: 'open',
        offers: [{ personId: 'dara', status: 'confirmed', days: ['2026-10-08', '2026-10-09'] }],
      },
      {
        id: 'hands',
        role: 'Stagehand',
        start: '2026-10-08',
        end: '2026-10-08',
        callTime: '12:00',
        needed: 2,
        details: '',
        status: 'open',
        offers: [
          { personId: 'tadhg', status: 'confirmed', days: ['2026-10-08'] },
          { personId: 'eimear', status: 'accepted', days: ['2026-10-08'] },
          { personId: 'aoife', status: 'declined', days: [] },
        ],
      },
      { id: 'gone', role: 'Video', start: '2026-10-08', end: '2026-10-09', callTime: null, needed: 1, details: '', status: 'cancelled', offers: [] },
    ],
    kit: [
      { department: 'lighting', name: 'Robe Spiider', qty: 8, subhireQty: 0, supplier: '' },
      { department: 'audio', name: 'd&b Y10P', qty: 12, subhireQty: 4, supplier: 'Lumen Hire' },
      { department: 'audio', name: 'Shure SM58', qty: 10, subhireQty: 0, supplier: '' },
      { department: 'audio', name: 'Shure SM58', qty: 6, subhireQty: 0, supplier: '' },
    ],
    ...(readerId ? { readerId } : {}),
  }
}

describe('a call sheet', () => {
  it('shows the office everything: who is still to answer, numbers, the client and the kit', () => {
    const s = callSheet(input(), 'office')
    expect(s.when).toBe('Thu 8 Oct to Fri 9 Oct')
    // The venue's name once, not again as the first line of its address.
    expect(s.venue).toMatchObject({ name: 'Riverside Park', address: 'Limerick', notes: 'Load in from the north gate.' })
    expect(s.venue!.map).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//)
    expect(s.contact).toEqual({ name: 'Aoife Brennan', phone: '+44 7700 900101', me: false })
    expect(s.client).toEqual({ name: 'Shannonside Festivals', contacts: input().client!.contacts })
    // By call time, then role; the cancelled call left out.
    expect(s.calls.map((c) => [c.callTime, c.role, c.days, c.toFind])).toEqual([
      ['10:00', 'Sound No.1', undefined, 0],
      ['12:00', 'LX op', undefined, 1],
      ['12:00', 'Stagehand', 'Thu 8 Oct', 0],
    ])
    expect(s.calls[1]!.crew).toEqual([{ personId: 'fionn', name: 'Fionn Gallagher', phone: '+44 7700 900104', status: 'offered', me: false }])
    expect(s.calls[2]!.crew.map((p) => [p.name, p.status, p.phone])).toEqual([
      ['Eimear Nolan', 'to confirm', '+44 7700 900103'],
      ['Tadhg Brady', 'booked', null],
    ])
    expect(s.kit).toEqual([
      {
        department: 'Audio',
        lines: [
          { name: 'd&b Y10P', qty: 12, note: '8 ours, 4 from Lumen Hire' },
          { name: 'Shure SM58', qty: 16, note: '' },
        ],
      },
      { department: 'Lighting', lines: [{ name: 'Robe Spiider', qty: 8, note: '' }] },
    ])
  })

  it('shows the contact on the day the crew booked, with their numbers, and the kit; not the client or who was only offered', () => {
    const s = callSheet(input('aoife'), 'contact')
    expect(s.contact).toMatchObject({ me: true })
    expect(s.client).toEqual({ name: 'Shannonside Festivals' })
    expect(s.calls.find((c) => c.role === 'LX op')!.crew).toEqual([])
    expect(s.calls.find((c) => c.role === 'Stagehand')!.crew.map((p) => [p.name, p.phone])).toEqual([
      ['Eimear Nolan', '+44 7700 900103'],
      ['Tadhg Brady', null],
    ])
    expect(s.kit).toHaveLength(2)
  })

  it('shows the rest of the crew who else is on by name and role, and never anyone else\'s number or the kit', () => {
    const s = callSheet(input('eimear'), 'crew')
    const everyone = s.calls.flatMap((c) => c.crew)
    expect(everyone.every((p) => !('phone' in p))).toBe(true)
    expect(s.calls.every((c) => c.toFind === undefined)).toBe(true)
    expect(s.kit).toBeUndefined()
    expect(s.client).toEqual({ name: 'Shannonside Festivals' })
    // Only those confirmed, and the reader, first, even while still to confirm.
    expect(s.calls.find((c) => c.role === 'Stagehand')!.crew.map((p) => [p.name, p.status, p.me])).toEqual([
      ['Eimear Nolan', 'to confirm', true],
      ['Tadhg Brady', 'booked', false],
    ])
    expect(s.calls.find((c) => c.role === 'LX op')!.crew).toEqual([])
    // The contact's number is the one number crew get.
    expect(s.contact).toEqual({ name: 'Aoife Brennan', phone: '+44 7700 900101', me: false })
    expect(JSON.stringify(s)).not.toContain('900102')
    expect(JSON.stringify(s)).not.toContain('900200')
  })

  it('works for a crew call that is not for one phase', () => {
    const i = input('dara')
    const s = callSheet({ ...i, phase: null, calls: [i.calls[1]!] }, 'crew')
    expect(s.phase).toBe('')
    expect(s.when).toBe('Thu 8 Oct to Fri 9 Oct')
    expect(s.notes).toEqual({ job: 'Two stages; the main stage is ours.', phase: '' })
  })

  it('reads as a message for the crew\'s group, with no number but the contact\'s', () => {
    const text = callSheetText(callSheet(input(), 'office'))
    expect(text).toContain('Harbour Lights Festival: Show\nThu 8 Oct to Fri 9 Oct')
    expect(text).toContain('At Riverside Park, Limerick')
    expect(text).toContain('On the day, ring Aoife Brennan on +44 7700 900101')
    expect(text).toContain('10:00 Sound No.1: Dara Quinn')
    expect(text).toContain('12:00 LX op: to be confirmed')
    expect(text).toContain('12:00 Stagehand (Thu 8 Oct): Tadhg Brady')
    expect(text).toContain('12:00 Crew call\n17:30 Doors')
    expect(text).not.toMatch(/9001(02|03|04)|900200/)
    expect(text).not.toContain('Eimear')
  })

  it("opens by saying it's to hold the day while the client hasn't said yes, in the reader's words", () => {
    // Proves: finding 6 of the audit of 12 November 2026 (ADR 0150). A sheet with someone's name on it read as a booking; on a
    // job the client hasn't agreed, it says first that it is to hold the day, to the office about the crew and to the crew
    // about their days, and so do the message that sends it and the text pasted to the crew's group.
    const i = input('dara')
    const held: SheetInput = { ...i, job: { ...i.job, hold: true } }
    const toCrew = "Hold the day: the client hasn't said yes yet, so please keep your days free. Nothing is booked until they do."
    expect(callSheet(held, 'office').hold).toBe("Hold the day: the client hasn't said yes yet. Crew are asked to keep it free, and nothing is booked until they do.")
    expect(callSheet(held, 'contact').hold).toBe(toCrew)
    expect(callSheet(held, 'crew').hold).toBe(toCrew)
    // It is about the days they hold themselves: Tadhg is on one of the sheet's two, so "it".
    expect(callSheet({ ...held, readerId: 'tadhg' }, 'crew').hold).toBe("Hold the day: the client hasn't said yes yet, so please keep it free. Nothing is booked until they do.")
    // Someone with no place of their own on it, as the contact on the day can be, reads it about the sheet's days.
    expect(callSheet({ ...held, readerId: 'aoife' }, 'contact').hold).toBe(toCrew)
    // Pasted to the crew's group it is said to them, whoever copies it, straight under the days.
    expect(callSheetText(callSheet(held, 'office'))).toContain(`Harbour Lights Festival: Show\nThu 8 Oct to Fri 9 Oct\n${toCrew}\n`)
    expect(sheetMessage({ name: 'Dara Quinn' }, callSheet(held, 'crew'), 'https://app.example/f/abc/sheet/sound').text).toBe(
      "Hi Dara, here's the call sheet for Harbour Lights Festival (Show), Thu 8 Oct to Fri 9 Oct: who's on, where, and who to ring on the day. It's to hold the day for now: the client hasn't said yes yet.\nhttps://app.example/f/abc/sheet/sound"
    )
    // A job the client has agreed says none of it.
    expect(callSheet(i, 'crew')).not.toHaveProperty('hold')
    expect(callSheetText(callSheet(i, 'office'))).not.toMatch(/hold the day/i)
    expect(sheetMessage({ name: 'Dara Quinn' }, callSheet(i, 'crew'), 'https://app.example/f/abc/sheet/sound').text).not.toMatch(/hold the day/i)
  })

  it("names who to ask for at the venue (ADR 0119) for everyone, with their number but never their email", () => {
    const i = input('tadhg')
    const venue = { ...i.venue!, contact: { name: 'Gráinne Nolan', role: 'Venue technical manager', email: 'grainne@example.com', phone: '+353 87 123 4567' } }
    for (const reader of ['office', 'contact', 'crew'] as const) {
      const s = callSheet({ ...i, venue }, reader)
      expect(s.venue!.contact).toEqual({ name: 'Gráinne Nolan', role: 'Venue technical manager', phone: '+353 87 123 4567' })
    }
    const text = callSheetText(callSheet({ ...i, venue }, 'crew'))
    expect(text).toContain('At the venue, ask for Gráinne Nolan (Venue technical manager) on +353 87 123 4567.')
    expect(text).not.toContain('grainne@example.com')
    // None named, nothing said.
    expect(callSheet(i, 'crew').venue).not.toHaveProperty('contact')
  })
})
