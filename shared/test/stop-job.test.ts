import { describe, expect, it } from 'vitest'
import { STOP_ABOUT, STOP_BUTTON, STOP_NOTHING, STOP_STATUSES, stopAfterWords, stopLines, stopNote, type StopFacts } from '../src/stop-job.ts'

/** A job with nothing on it, to add to. */
const bare: StopFacts = { status: 'cancelled', calls: 0, people: [], sends: '' }
const text = (f: StopFacts) => stopLines(f).map((l) => l.text)

describe('what stopping a job does, said before the press', () => {
  it('has no lines for a job with nothing on it, which is said in their place', () => {
    expect(stopLines(bare)).toEqual([])
    expect(STOP_NOTHING).toBe('Only its status changes: nobody is told, and no kit or transport is held for it.')
    expect(stopAfterWords(bare)).toBe('It can be taken up again under Change details.')
  })

  it('names who sees what, in their own words for each way of stopping, then how it reaches them', () => {
    const crew: StopFacts = {
      ...bare,
      calls: 3,
      people: ['Aoife Brennan', 'Tommo Daly', 'Niamh Doyle'],
      sends: " Google emails each of them that their days are cancelled. A WhatsApp tells each of them it's off.",
    }
    expect(stopLines(crew)).toEqual([
      {
        key: 'crew',
        warn: true,
        text: "Its 3 crew calls are cancelled. Aoife Brennan, Tommo Daly and Niamh Doyle will see the job was cancelled. Google emails each of them that their days are cancelled. A WhatsApp tells each of them it's off.",
      },
    ])
    expect(text({ ...crew, status: 'lost', calls: 1, people: ['Aoife Brennan'], sends: ' Google emails them that the day is cancelled.' })).toEqual([
      "Its crew call is cancelled. Aoife Brennan will see the job didn't go ahead. Google emails them that the day is cancelled.",
    ])
    expect(stopAfterWords(crew)).toBe("It can be taken up again under Change details, and its crew calls brought back with the same people picked, ready to ask again. What they've already been told can't be taken back.")
    expect(stopAfterWords({ calls: 1, people: ['Aoife Brennan'] })).toBe("It can be taken up again under Change details, and its crew call brought back with the same people picked, ready to ask again. What they've already been told can't be taken back.")
  })

  it('says so when the app sends them nothing, as their links are then all they have', () => {
    expect(text({ ...bare, calls: 2, people: ['Aoife Brennan', 'Tommo Daly'] })).toEqual([
      'Its 2 crew calls are cancelled. Aoife Brennan and Tommo Daly will see the job was cancelled. The app sends them nothing: their links say so whenever they open them.',
    ])
    expect(text({ ...bare, calls: 1, people: ['Aoife Brennan'] })).toEqual([
      'Its crew call is cancelled. Aoife Brennan will see the job was cancelled. The app sends them nothing: their link says so whenever they open it.',
    ])
  })

  it('is quiet about calls nobody is on', () => {
    expect(stopLines({ ...bare, calls: 2 })).toEqual([{ key: 'crew', text: 'Its 2 crew calls are cancelled. Nobody is offered or booked on them, so nobody is told.' }])
    expect(text({ ...bare, calls: 1 })).toEqual(['Its crew call is cancelled. Nobody is offered or booked on it, so nobody is told.'])
    expect(stopAfterWords({ calls: 2, people: [] })).toBe('It can be taken up again under Change details, and its crew calls brought back in one press.')
    expect(stopAfterWords({ calls: 1, people: [] })).toBe('It can be taken up again under Change details, and its crew call brought back in one press.')
  })

  it('names the first five of a big crew and counts the rest', () => {
    const people = ['A', 'B', 'C', 'D', 'E', 'F']
    expect(text({ ...bare, calls: 1, people, sends: ' x' })[0]).toBe('Its crew call is cancelled. A, B, C, D, E and F will see the job was cancelled. x')
    expect(text({ ...bare, calls: 1, people: [...people, 'G', 'H'], sends: ' x' })[0]).toBe('Its crew call is cancelled. A, B, C, D, E and 3 more will see the job was cancelled. x')
  })

  it('frees held kit for other jobs, and says pencilled kit is only that', () => {
    const kit = { own: 29, held: true, out: 0, hiredIn: 0, suppliers: [] }
    expect(stopLines({ ...bare, kit })).toEqual([{ key: 'kit', text: 'Its 29 items of kit are free for other jobs again.' }])
    expect(text({ ...bare, kit: { ...kit, own: 1, held: false } })).toEqual(['Its 1 item of kit is no longer pencilled in.'])
    expect(text({ ...bare, kit: { ...kit, own: 1200 } })).toEqual(['Its 1,200 items of kit are free for other jobs again.'])
    expect(stopLines({ ...bare, kit: { ...kit, own: 0 } })).toEqual([])
  })

  it('says what the app cannot do for kit: bring home what is out, or tell a supplier', () => {
    const kit = { own: 24, held: true, out: 3, hiredIn: 5, suppliers: ['PSI'] }
    expect(stopLines({ ...bare, kit })).toEqual([
      {
        key: 'kit',
        warn: true,
        text: "Its 24 items of kit are free for other jobs again. 3 are already out and still need checking back in. 5 more are hired in from PSI: the app doesn't tell them, so cancel those yourself.",
      },
    ])
    expect(text({ ...bare, kit: { own: 1, held: false, out: 1, hiredIn: 1, suppliers: [] } })).toEqual([
      "Its 1 item of kit is no longer pencilled in. 1 is already out and still needs checking back in. 1 more is hired in: the app doesn't tell the supplier, so cancel it yourself.",
    ])
    // All of it hired in: none of it is ours to free.
    expect(text({ ...bare, kit: { own: 0, held: true, out: 0, hiredIn: 2, suppliers: ['PSI', 'Audiotek'] } })).toEqual([
      "Its 2 items of kit are hired in from PSI and Audiotek: the app doesn't tell them, so cancel those yourself.",
    ])
    // Kit out on a job whose days have all gone: nothing is held, and what's out is still out.
    expect(text({ ...bare, kit: { own: 0, held: false, out: 4, hiredIn: 0, suppliers: [] } })).toEqual(['4 items of kit are already out and still need checking back in.'])
    expect(text({ ...bare, kit: { own: 0, held: false, out: 1, hiredIn: 0, suppliers: [] } })).toEqual(['1 item of kit is already out and still needs checking back in.'])
  })

  it('frees vehicles by name', () => {
    expect(stopLines({ ...bare, vehicles: { names: ['Sprinter 1'], held: true } })).toEqual([{ key: 'transport', text: 'Sprinter 1 is free for other jobs again.' }])
    expect(text({ ...bare, vehicles: { names: ['Sprinter 1', 'Luton'], held: false } })).toEqual(['Sprinter 1 and Luton are no longer pencilled in.'])
    expect(stopLines({ ...bare, vehicles: { names: [], held: true } })).toEqual([])
  })

  it('says whether its days come off the calendar, or stay on the one it came from', () => {
    expect(text({ ...bare, calendar: { on: 'Session Hire Jobs', days: 3 } })).toEqual(['Its 3 days come off Session Hire Jobs.'])
    expect(text({ ...bare, calendar: { on: 'the calendar', days: 1 } })).toEqual(['Its day comes off the calendar.'])
    expect(text({ ...bare, calendar: { on: 'the calendar', days: 0 } })).toEqual([])
    expect(text({ ...bare, calendar: { theirs: 'Gigs' } })).toEqual(["It stays on Gigs: the app doesn't change the calendar a job was brought in from."])
  })

  it('says where its quote stands', () => {
    expect(text({ ...bare, quote: 'sent' })).toEqual(["Its quote is set aside, so it counts in no totals unless it's invoiced."])
    expect(text({ ...bare, quote: 'invoiced' })).toEqual(['Its quote is invoiced, so it still counts in the totals.'])
  })

  it('puts the people first, then kit, transport, the calendar and the quote', () => {
    const all: StopFacts = {
      status: 'cancelled',
      calls: 1,
      people: ['Aoife Brennan'],
      sends: '',
      kit: { own: 2, held: true, out: 0, hiredIn: 0, suppliers: [] },
      vehicles: { names: ['Sprinter 1'], held: true },
      calendar: { on: 'Jobs', days: 2 },
      quote: 'sent',
    }
    expect(stopLines(all).map((l) => [l.key, !!l.warn])).toEqual([
      ['crew', true],
      ['kit', false],
      ['transport', false],
      ['calendar', false],
      ['quote', false],
    ])
  })
})

describe('the cancel form', () => {
  it('offers each way of stopping under its own status word, with a line and a button of its own', () => {
    for (const s of STOP_STATUSES) {
      expect(STOP_ABOUT[s]).toMatch(/\.$/)
      expect(STOP_BUTTON[s]).not.toBe('')
    }
    expect(STOP_BUTTON).toEqual({ cancelled: 'Cancel the job', lost: 'Mark lost' })
  })

  it('keeps the reason as the first line of the office notes', () => {
    expect(stopNote('Cancelled', 'Fri 27 Nov', '  The venue double-booked ', null)).toBe('Cancelled Fri 27 Nov: The venue double-booked')
    expect(stopNote('Lost', 'Fri 27 Nov', '', 'Deposit paid in June.')).toBe('Lost Fri 27 Nov\nDeposit paid in June.')
    expect(stopNote('Cancelled', 'Fri 27 Nov', 'x', 'y'.repeat(4000))).toHaveLength(4000)
  })
})
