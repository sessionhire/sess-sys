import { describe, expect, it } from 'vitest'
import type { CalendarDay, CalendarGuest, CalendarLink } from '../src/calendar.ts'
import type { CrewCall, Offer, Person } from '../src/crew.ts'
import {
  bookingWords,
  callEndingWords,
  askEndingWords,
  daysToCancel,
  endingWords,
  invitePlan,
  invitesHeld,
  jobEndingWords,
  nothingSentLine,
  noWhatsApp,
  offerHeard,
  offerPromise,
  offerReach,
  reachOnRow,
  toldOfBooking,
  toldOfChange,
  toldOfEnding,
  toldOfOffer,
  toldOfRefusal,
  toldNext,
  toldSentences,
  whatsappFollows,
  whatsappFollowsOffer,
  whatsappFollowsTell,
  whatsappReach,
  type ReachContext,
  type ReachJob,
} from '../src/reach.ts'

/**
 * What the app sends crew by itself and what it says of it (audit of 12 November 2026, findings 1, 5, 14, 16, 18 and
 * 20): the server's rules read from a device, the line on each offer's row, the Offer form's promise, the questions
 * before an offer is ended and the panel after a press. Made-up people throughout.
 */

const today = '2026-11-12'
const D1 = '2026-11-20'
const D2 = '2026-11-21'

const person = (id: string, name: string, over: Partial<Person> = {}): Person => ({
  id,
  name,
  kind: 'freelancer',
  email: `${id}@example.com`,
  phone: '+353871234567',
  skills: [],
  dayRateCents: 30000,
  notes: '',
  linkToken: `${id}-link-token-000000000000`,
  archived: false,
  approvesLeave: false,
  role: null,
  department: null,
  level: 1,
  knownAs: null,
  certificates: {},
  company: null,
  ...over,
})
const call = (over: Partial<CrewCall> = {}): CrewCall => ({
  id: 'riggers',
  projectId: 'arts',
  phaseId: 'show',
  project: 'Galway Arts',
  phase: 'Show',
  venue: 'Big Top',
  role: 'Rigger',
  start: D1,
  end: D2,
  callTime: '08:00',
  needed: 2,
  dayRateCents: 32000,
  details: '',
  replyBy: null,
  status: 'open',
  ...over,
})
const offer = (id: string, personId: string, status: Offer['status'] = 'offered', over: Partial<Offer> = {}): Offer => ({
  id,
  callId: 'riggers',
  personId,
  status,
  days: [D1, D2],
  dayRateCents: 32000,
  counterRateCents: null,
  note: '',
  respondedAt: null,
  respondedVia: null,
  override: false,
  seenAt: null,
  ...over,
})

const link = (over: Partial<CalendarLink> = {}): CalendarLink => ({
  id: 'main',
  state: 'on',
  account: 'operations@example.com',
  calendarId: 'jobs',
  calendarName: 'Jobs',
  problem: null,
  connectedBy: 'Orla',
  connectedAt: '2026-11-01T09:00:00.000Z',
  invites: true,
  ...over,
})
const job = (over: Partial<ReachJob> = {}): ReachJob => ({ status: 'confirmed', phases: [{ id: 'show', start: D1, end: D2 }], ...over })

/** A day on the calendar: the one everyone sees, or with `personId` that person's own copy, with them as its guest. */
const row = (day: string, personId?: string, guest?: Partial<CalendarGuest> & { offerId: string }, over: Partial<CalendarDay> = {}): CalendarDay => ({
  id: `show/${day}${personId ? `/${personId}` : ''}`,
  phaseId: 'show',
  projectId: 'arts',
  day,
  calendarId: personId ? 'operations@example.com' : 'jobs',
  title: 'Galway Arts - Show',
  state: 'on',
  problem: null,
  link: null,
  guests: guest && personId ? [{ personId, response: 'needsAction', problem: null, ...guest }] : [],
  ...over,
})
const days = (...rows: CalendarDay[]) => Object.fromEntries(rows.map((r) => [r.id, r]))

const ctx = (over: Partial<Omit<ReachContext, 'job' | 'calendar'>> & { link?: CalendarLink | null; days?: Record<string, CalendarDay>; job?: ReachJob | null } = {}): ReachContext => ({
  calendar: { link: over.link === null ? undefined : (over.link ?? link()), days: over.days ?? {} },
  job: () => (over.job === null ? undefined : (over.job ?? job())),
  whatsapp: over.whatsapp ?? { mode: 'off', testTo: [] },
  messages: over.messages ?? false,
  today,
})

const aoife = person('aoife', 'Aoife Byrne')
const sean = person('sean', 'Seán Walsh', { email: null })
const invitedBoth = days(row(D1, 'aoife', { offerId: 'o1' }), row(D2, 'aoife', { offerId: 'o1' }), row(D1), row(D2))

describe('who an offer goes to on WhatsApp', () => {
  it('goes by the mode, their own switch, their number and, when trying it out, the numbers listed', () => {
    const on = { mode: 'on' as const, testTo: [] }
    expect(whatsappReach(on, aoife)).toBe('353871234567')
    expect(whatsappReach({ mode: 'off', testTo: [] }, aoife)).toBeUndefined()
    expect(whatsappReach(on, { ...aoife, whatsappOff: true })).toBeUndefined()
    expect(whatsappReach(on, { ...aoife, phone: '061 12' })).toBeUndefined()
    expect(whatsappReach({ mode: 'test', testTo: ['087 123 4567'] }, aoife)).toBe('353871234567')
    expect(whatsappReach({ mode: 'test', testTo: ['+353 86 000 0000'] }, aoife)).toBeUndefined()
  })

  it('says why not, the first reason first', () => {
    expect(noWhatsApp({ mode: 'off', testTo: [] }, { ...aoife, whatsappOff: true })).toBe('off')
    expect(noWhatsApp({ mode: 'on', testTo: [] }, { ...aoife, whatsappOff: true })).toBe('theirs-off')
    expect(noWhatsApp({ mode: 'on', testTo: [] }, { ...aoife, phone: null })).toBe('no-number')
    expect(noWhatsApp({ mode: 'test', testTo: [] }, aoife)).toBe('not-tried')
    expect(noWhatsApp({ mode: 'on', testTo: [] }, aoife)).toBeUndefined()
  })
})

describe('who gets a calendar invite, by the server’s rule', () => {
  const plan = (c: ReachContext, over: Partial<CrewCall> = {}, p: Person | undefined = aoife, on = [D1, D2], o?: Pick<Offer, 'noOwnInvite'>) =>
    invitePlan(c, call(over), p, on, o)

  it('plans a day for each phase day the call covers, for someone with an address', () => {
    expect(plan(ctx())).toEqual({ rows: [{ phaseId: 'show', day: D1 }, { phaseId: 'show', day: D2 }], days: [D1, D2], why: undefined })
  })

  it('plans them on a job the client hasn’t said yes to, which goes on the calendar on hold once someone is asked', () => {
    expect(plan(ctx({ job: job({ status: 'enquiry' }) })).why).toBeUndefined()
    expect(plan(ctx({ job: job({ status: 'quoted' }) })).days).toEqual([D1, D2])
  })

  it('covers every phase of the job for a call across phases, and only its own for a call tied to one', () => {
    const two = job({ phases: [{ id: 'build', start: '2026-11-19', end: D1 }, { id: 'show', start: D1, end: D2 }] })
    expect(plan(ctx({ job: two }), { phaseId: null }, aoife, ['2026-11-19', D1, D2]).rows).toEqual([
      { phaseId: 'build', day: '2026-11-19' },
      { phaseId: 'build', day: D1 },
      { phaseId: 'show', day: D1 },
      { phaseId: 'show', day: D2 },
    ])
    expect(plan(ctx({ job: two }), { phaseId: 'build' }, aoife, ['2026-11-19', D1, D2]).days).toEqual(['2026-11-19', D1])
  })

  it('says why none goes, the first reason first', () => {
    expect(plan(ctx({ link: null })).why).toBe('off')
    expect(plan(ctx({ link: link({ invites: false }) })).why).toBe('off')
    expect(plan(ctx({ link: link({ state: 'choosing', calendarId: null }) })).why).toBe('off')
    expect(plan(ctx({ link: link({ state: 'reconnect' }) })).why).toBe('paused')
    expect(plan(ctx(), { projectId: null, phaseId: null }).why).toBe('no-job')
    expect(plan(ctx({ job: null })).why).toBe('unknown')
    expect(plan(ctx({ job: job({ sourceCalendar: 'Gigs' }) }), {}, aoife, [D1, D2], { noOwnInvite: 'organiser' }).why).toBe('organiser')
    expect(plan(ctx({ job: job({ sourceCalendar: 'Gigs' }) }), {}, aoife, [D1, D2], { noOwnInvite: 'before' }).why).toBe('before')
    expect(plan(ctx({ job: job({ sourceCalendar: 'Gigs' }), link: link({ account: null }) })).why).toBe('brought-in')
    expect(plan(ctx({ job: job({ status: 'lost' }) })).why).toBe('stopped')
    expect(plan(ctx(), { status: 'cancelled' }).why).toBe('stopped')
    expect(plan(ctx(), {}, aoife, ['2026-11-01']).why).toBe('past')
    expect(plan(ctx(), {}, aoife, ['2026-11-25']).why).toBe('outside-phases')
    expect(plan(ctx({ job: job({ phases: [{ id: 'other', start: D1, end: D2 }] }) })).why).toBe('outside-phases')
    expect(plan(ctx(), {}, sean).why).toBe('no-email')
    expect(plan(ctx(), {}, { ...aoife, email: '  ' }).why).toBe('no-email')
    // An offer on a job brought in from a calendar that has no invite of its own: that's the reason, whoever has no address.
    expect(plan(ctx({ job: job({ sourceCalendar: 'Gigs' }) }), {}, sean, [D1, D2], { noOwnInvite: 'organiser' }).why).toBe('organiser')
  })

  it('plans each person their own copy of a brought-in job’s days, but none for an offer that came before (ADR 0157)', () => {
    const theirs = ctx({ job: job({ sourceCalendar: 'Gigs' }) })
    // A new offer, and one made since: their own copies, as on the app's own jobs.
    expect(plan(theirs)).toEqual({ rows: [{ phaseId: 'show', day: D1 }, { phaseId: 'show', day: D2 }], days: [D1, D2], why: undefined })
    expect(plan(theirs, {}, aoife, [D1, D2], {}).why).toBeUndefined()
    // One that came in with the job, from the guests the organiser invited, or was made before such jobs sent their own.
    expect(plan(theirs, {}, aoife, [D1, D2], { noOwnInvite: 'organiser' })).toEqual({ rows: [], days: [], why: 'organiser' })
    expect(plan(theirs, {}, aoife, [D1, D2], { noOwnInvite: 'before' })).toEqual({ rows: [], days: [], why: 'before' })
    // A job of the app's own whose offer has the mark (a job handed over, or two combined) is planned as any other.
    expect(plan(ctx(), {}, aoife, [D1, D2], { noOwnInvite: 'organiser' }).why).toBeUndefined()
    // A copy of their own goes on the connected account's own calendar, so none without one.
    expect(plan(ctx({ job: job({ sourceCalendar: 'Gigs' }), link: link({ account: null }) })).why).toBe('brought-in')
    // Still no invite without an address.
    expect(plan(theirs, {}, sean).why).toBe('no-email')
  })
})

describe('the line on an offer’s row', () => {
  const row_ = (c: ReachContext, o: Offer, p: Person | undefined = aoife, cl: Partial<CrewCall> = {}, others: Offer[] = []) => reachOnRow(c, o, call(cl), p, others)
  /** Its lines and whether it offers ringing them; `allOff` has a test of its own. */
  const said = (c: ReachContext, o: Offer, p: Person | undefined = aoife, cl: Partial<CrewCall> = {}, others: Offer[] = []) => {
    const { lines, contact } = row_(c, o, p, cl, others)
    return { lines, contact }
  }
  const texts = (c: ReachContext, o: Offer, p: Person | undefined = aoife, cl: Partial<CrewCall> = {}, others: Offer[] = []) => said(c, o, p, cl, others).lines.map((l) => l.text)

  it('says an invite went and how many days, and that nobody has answered it', () => {
    expect(said(ctx({ days: invitedBoth }), offer('o1', 'aoife'))).toEqual({ lines: [{ text: 'Invited by email, 2 days. No answer yet.', tone: 'plain' }], contact: false })
    expect(texts(ctx({ days: days(row(D1, 'aoife', { offerId: 'o1' })) }), offer('o1', 'aoife', 'offered', { days: [D1] }))).toEqual(['Invited by email. No answer yet.'])
  })

  it('adds how far the offer got on WhatsApp, while it is theirs to answer', () => {
    const o = offer('o1', 'aoife', 'offered', { whatsapp: { state: 'read', at: '2026-11-12T10:00:00.000Z', problem: null } })
    expect(texts(ctx({ days: invitedBoth, whatsapp: { mode: 'on', testTo: [] } }), o)).toEqual(['Invited by email, 2 days. No answer yet. Read on WhatsApp.'])
    expect(texts(ctx({ days: invitedBoth }), { ...o, status: 'accepted', respondedVia: 'whatsapp' })).toEqual(['Invited by email, 2 days. Answered on WhatsApp.'])
  })

  it('keeps their answers in Google as they were said before', () => {
    const mixed = days(row(D1, 'aoife', { offerId: 'o1', response: 'accepted' }), row(D2, 'aoife', { offerId: 'o1', response: 'declined' }))
    expect(texts(ctx({ days: mixed }), offer('o1', 'aoife', 'accepted', { days: [D1], respondedVia: 'calendar' }))).toEqual(['On Google Calendar: yes to Fri 20 Nov; no to Sat 21 Nov.'])
    const yes = days(row(D1, 'aoife', { offerId: 'o1', response: 'accepted' }), row(D2, 'aoife', { offerId: 'o1', response: 'accepted' }))
    expect(texts(ctx({ days: yes }), offer('o1', 'aoife', 'confirmed', { respondedVia: 'calendar' }))).toEqual(['Said yes on Google Calendar.'])
  })

  it('says how they answered once they have, rather than "no answer yet" beside Booked (finding 16)', () => {
    expect(texts(ctx({ days: invitedBoth }), offer('o1', 'aoife', 'accepted', { respondedVia: 'link' }))).toEqual(['Invited by email, 2 days. Answered on their page.'])
    expect(texts(ctx({ days: invitedBoth }), offer('o1', 'aoife', 'confirmed', { respondedVia: 'app' }))).toEqual(['Invited by email, 2 days. Answered in the app.'])
    expect(texts(ctx({ days: invitedBoth }), offer('o1', 'aoife', 'countered', { respondedVia: null }))).toEqual(['Invited by email, 2 days.'])
  })

  it('says an invite is on its way until the server has written it, and that the calendar holds it up when it does', () => {
    expect(said(ctx(), offer('o1', 'aoife'))).toEqual({ lines: [{ text: 'Calendar invite on its way.', tone: 'plain' }], contact: false })
    const stuck = ctx({ link: link({ problem: 'Writing to Google Calendar is switched off on the server.' }) })
    expect(said(stuck, offer('o1', 'aoife'))).toEqual({
      lines: [{ text: 'Calendar invite not sent yet: the calendar has a problem. See Admin › Connections.', tone: 'warn', title: 'Writing to Google Calendar is switched off on the server.' }],
      contact: true,
    })
  })

  it('says Google turned the invite down, as a failure (finding 18)', () => {
    const failed = days(row(D1, 'aoife', undefined, { state: 'failed', problem: 'Google turned this day down (Invalid attendee email).' }), row(D2, 'aoife', undefined, { state: 'failed', problem: 'Google turned this day down.' }))
    expect(said(ctx({ days: failed }), offer('o1', 'aoife'))).toEqual({
      lines: [{ text: 'Invite not sent: Google turned it down. Check the address.', tone: 'bad', title: 'Google turned this day down (Invalid attendee email).' }],
      contact: true,
    })
    // One day went and one didn't: the day that didn't is named.
    const half = days(row(D1, 'aoife', { offerId: 'o1' }), row(D2, 'aoife', undefined, { state: 'failed', problem: 'Google turned this day down.' }))
    expect(said(ctx({ days: half }), offer('o1', 'aoife')).lines).toEqual([
      { text: 'Invited by email. No answer yet.', tone: 'plain' },
      { text: 'Invite not sent for Sat 21 Nov: Google turned it down.', tone: 'bad', title: 'Google turned this day down.' },
    ])
  })

  it('says nothing has reached someone and why, and offers ringing them (findings 5 and 14)', () => {
    expect(said(ctx(), offer('o1', 'sean'), sean)).toEqual({
      lines: [{ text: 'Nothing has reached Seán: they have no email address for a calendar invite, and WhatsApp is off.', tone: 'warn' }],
      contact: true,
    })
    expect(texts(ctx(), offer('o1', 'aoife'), aoife, { projectId: null, phaseId: null })).toEqual(["Nothing has reached Aoife: a call that isn't part of a job gets no calendar invite, and WhatsApp is off."])
    expect(texts(ctx(), offer('o1', 'aoife', 'offered', { days: ['2026-11-25'] }), aoife, { end: '2026-11-25' })).toEqual([
      "Nothing has reached Aoife: its days aren't inside one of the job's phases, so no calendar invite went, and WhatsApp is off.",
    ])
    expect(texts(ctx({ link: link({ state: 'reconnect' }) }), offer('o1', 'aoife'))).toEqual(['Nothing has reached Aoife: the calendar needs connecting again, and WhatsApp is off.'])
    // WhatsApp is on, and isn't a way to them either.
    const on = { mode: 'on' as const, testTo: [] }
    expect(texts(ctx({ whatsapp: on }), offer('o1', 'sean'), { ...sean, whatsappOff: true })).toEqual(['Nothing has reached Seán: they have no email address for a calendar invite, and they turned WhatsApp off.'])
    expect(texts(ctx({ whatsapp: on }), offer('o1', 'sean'), { ...sean, phone: null })).toEqual(['Nothing has reached Seán: they have no email address for a calendar invite, and they have no mobile number for WhatsApp.'])
    expect(texts(ctx({ whatsapp: { mode: 'test', testTo: [] } }), offer('o1', 'sean'), sean)).toEqual(['Nothing has reached Seán: they have no email address for a calendar invite, and WhatsApp is only being tried on other numbers.'])
    expect(texts(ctx({ whatsapp: on, link: link({ invites: false }) }), offer('o1', 'sean'), { ...sean, phone: null })).toEqual(['Nothing has reached Seán: calendar invites are off, and they have no mobile number for WhatsApp.'])
  })

  it('says a WhatsApp that failed as a failure, with the reason', () => {
    const o = offer('o1', 'sean', 'offered', { whatsapp: { state: 'failed', at: '2026-11-12T10:00:00.000Z', problem: 'The number is not on WhatsApp.' } })
    expect(said(ctx({ whatsapp: { mode: 'on', testTo: [] } }), o, sean)).toEqual({
      lines: [
        { text: "Nothing has reached Seán: they have no email address for a calendar invite, and the WhatsApp wasn't sent.", tone: 'warn' },
        { text: 'Not sent on WhatsApp: The number is not on WhatsApp.', tone: 'bad' },
      ],
      contact: true,
    })
  })

  it('says only that no invite went when WhatsApp reached them, or when the office sends its own messages', () => {
    const read = offer('o1', 'sean', 'offered', { whatsapp: { state: 'read', at: '2026-11-12T10:00:00.000Z', problem: null } })
    expect(said(ctx({ whatsapp: { mode: 'on', testTo: [] } }), read, sean)).toEqual({ lines: [{ text: 'No email address, so no calendar invite. Read on WhatsApp.', tone: 'plain' }], contact: false })
    const going = offer('o1', 'sean', 'offered', { whatsapp: { state: 'queued', at: '2026-11-12T10:00:00.000Z', problem: null } })
    expect(said(ctx({ whatsapp: { mode: 'on', testTo: [] } }), going, sean)).toEqual({ lines: [{ text: 'No email address, so no calendar invite. Going on WhatsApp.', tone: 'plain' }], contact: false })
    expect(said(ctx({ messages: true }), offer('o1', 'sean'), sean)).toEqual({ lines: [{ text: 'No email address, so no calendar invite.', tone: 'plain' }], contact: false })
    expect(texts(ctx({ messages: true }), offer('o1', 'aoife'), aoife, { projectId: null, phaseId: null })).toEqual(["No calendar invite: this call isn't part of a job."])
    // With invites off and the office sending its own messages, the row says nothing, as before.
    expect(said(ctx({ messages: true, link: link({ invites: false }) }), offer('o1', 'aoife'))).toEqual({ lines: [], contact: false })
  })

  it('says why an offer on a job brought in from Google Calendar has no invite of its own, plainly (finding 1, ADR 0157)', () => {
    const theirs = ctx({ job: job({ sourceCalendar: 'Gigs' }) })
    // Brought in with the job, from the guests the organiser invited.
    expect(said(theirs, offer('o1', 'aoife', 'offered', { noOwnInvite: 'organiser' }))).toEqual({
      lines: [{ text: 'No invite from the app: the organiser invited them in Google Calendar.', tone: 'plain' }],
      contact: true,
    })
    // Made by the office before such jobs sent their own.
    expect(said(theirs, offer('o1', 'aoife', 'offered', { noOwnInvite: 'before' }))).toEqual({
      lines: [{ text: 'No invite from the app: it was offered before jobs from Google Calendar sent their own.', tone: 'plain' }],
      contact: true,
    })
    // With nowhere of the app's own to put their copy.
    expect(texts(ctx({ job: job({ sourceCalendar: 'Gigs' }), link: link({ account: null }) }), offer('o1', 'aoife'))).toEqual([
      "No invite from the app: this job came from Google Calendar, so its days are the organiser's.",
    ])
    // Someone booked there says nothing: hundreds of bookings came in with their jobs.
    expect(said(theirs, offer('o1', 'aoife', 'confirmed', { respondedVia: 'calendar', noOwnInvite: 'organiser' }))).toEqual({ lines: [], contact: false })
    // An offer made since has its own, said as on any job.
    expect(said(theirs, offer('o1', 'aoife'))).toEqual({ lines: [{ text: 'Calendar invite on its way.', tone: 'plain' }], contact: false })
    expect(said(ctx({ job: job({ sourceCalendar: 'Gigs' }), days: days(row(D1, 'aoife', { offerId: 'o1' }), row(D2, 'aoife', { offerId: 'o1' })) }), offer('o1', 'aoife'))).toEqual({
      lines: [{ text: 'Invited by email, 2 days. No answer yet.', tone: 'plain' }],
      contact: false,
    })
  })

  it('leaves every way out being off to the call to say once, and still offers ringing them', () => {
    const off = ctx({ link: link({ invites: false }) })
    expect(row_(off, offer('o1', 'aoife'))).toEqual({ lines: [], contact: true, allOff: true })
    // Not when anything else is the reason, or once they've answered.
    expect(row_(ctx(), offer('o1', 'sean'), sean).allOff).toBe(false)
    expect(row_(off, offer('o1', 'aoife', 'accepted', { respondedVia: 'link' }))).toEqual({ lines: [], contact: false, allOff: false })
    expect(row_(ctx({ link: link({ invites: false }), messages: true }), offer('o1', 'aoife')).allOff).toBe(false)
    const all = 'calendar invites, WhatsApp and messages to crew are all off.'
    const tommo = person('tommo', 'Tomás Reilly', { knownAs: 'Tommo' })
    expect(nothingSentLine([], 0)).toBeUndefined()
    expect(nothingSentLine([aoife], 1)).toBe(`Nothing was sent to Aoife: ${all}`)
    expect(nothingSentLine([aoife, tommo, sean], 3)).toBe(`Nothing was sent to Aoife, Tommo and Seán: ${all}`)
    // Two who go by the same name are named in full.
    expect(nothingSentLine([aoife, person('aoife2', 'Aoife Quinn')], 2)).toBe(`Nothing was sent to Aoife Byrne and Aoife Quinn: ${all}`)
    // More than a few are counted: everyone still to answer, or some of them.
    const four = [aoife, tommo, sean, person('dara', 'Dara Kelly')]
    expect(nothingSentLine(four, 4)).toBe(`Nothing was sent to the 4 people still to answer: ${all}`)
    expect(nothingSentLine(four, 6)).toBe(`Nothing was sent to 4 of the people still to answer: ${all}`)
  })

  it('says a No to an earlier offer still stands in Google, so a second offer sent nothing new (finding 1)', () => {
    const no = days(row(D1, 'aoife', { offerId: 'o2', response: 'declined' }), row(D2, 'aoife', { offerId: 'o2', response: 'declined' }))
    const first = offer('o1', 'aoife', 'declined', { respondedVia: 'calendar' })
    const second = offer('o2', 'aoife')
    expect(said(ctx({ days: no }), second, aoife, {}, [first, second])).toEqual({
      lines: [{ text: 'No new invite went: their No to an earlier offer still stands in Google Calendar.', tone: 'warn' }],
      contact: true,
    })
    // With no earlier offer it is a No to this one, which the app takes in a moment.
    expect(said(ctx({ days: no }), second, aoife, {}, [second])).toEqual({ lines: [{ text: 'Said no on Google Calendar.', tone: 'plain' }], contact: false })
  })

  it('says the day’s invite is for their other call, when one invite covers both', () => {
    const other = days(row(D1, 'aoife', { offerId: 'driver' }), row(D2, 'aoife', { offerId: 'driver' }))
    expect(said(ctx({ days: other }), offer('o1', 'aoife'))).toEqual({ lines: [{ text: 'The calendar invite for these days is for their other call on this job.', tone: 'plain' }], contact: false })
  })

  it('says only what the office might misread or has to fix once they have answered', () => {
    expect(said(ctx(), offer('o1', 'sean', 'accepted', { respondedVia: 'link' }), sean)).toEqual({ lines: [{ text: 'No email address, so no calendar invite.', tone: 'plain' }], contact: false })
    expect(said(ctx(), offer('o1', 'aoife', 'confirmed', { respondedVia: 'link' }), aoife, { projectId: null, phaseId: null })).toEqual({ lines: [], contact: false })
    expect(said(ctx({ link: link({ invites: false }) }), offer('o1', 'aoife', 'accepted', { respondedVia: 'link' }))).toEqual({ lines: [], contact: false })
    // A WhatsApp's state is the offer's news, not the booking's.
    const o = offer('o1', 'aoife', 'confirmed', { respondedVia: 'link', whatsapp: { state: 'read', at: '2026-11-12T10:00:00.000Z', problem: null } })
    expect(texts(ctx({ days: invitedBoth }), o)).toEqual(['Invited by email, 2 days. Answered on their page.'])
  })

  it('keeps the warnings Google’s answers raise', () => {
    const no = days(row(D1, 'aoife', { offerId: 'o1', response: 'declined' }), row(D2, 'aoife', { offerId: 'o1', response: 'accepted' }))
    expect(said(ctx({ days: no }), offer('o1', 'aoife', 'confirmed', { respondedVia: 'link' })).lines).toEqual([
      { text: 'On Google Calendar: yes to Sat 21 Nov; no to Fri 20 Nov.', tone: 'plain' },
      { text: 'Said no to Fri 20 Nov on Google Calendar, but is booked for it. Call them to sort it out.', tone: 'warn' },
    ])
  })

  it('says nothing new of an offer that is over, or a call that has gone', () => {
    const no = days(row(D1, 'aoife', { offerId: 'o1', response: 'declined' }))
    expect(said(ctx({ days: no }), offer('o1', 'aoife', 'declined', { respondedVia: 'calendar' }))).toEqual({ lines: [{ text: 'Said no on Google Calendar.', tone: 'plain' }], contact: false })
    expect(said(ctx(), offer('o1', 'aoife', 'cancelled'))).toEqual({ lines: [], contact: false })
    expect(said(ctx(), offer('o1', 'sean', 'offered', { days: ['2026-11-01'] }), sean, { start: '2026-11-01', end: '2026-11-01' })).toEqual({ lines: [], contact: false })
    expect(said(ctx({ job: null }), offer('o1', 'sean'), sean)).toEqual({ lines: [], contact: false })
  })

  it('reads guests on the day everyone sees when no account holds each person’s own copy', () => {
    const shared = days(row(D1, undefined, undefined, { guests: [{ personId: 'aoife', offerId: 'o1', response: 'needsAction', problem: null }] }), row(D2, undefined, undefined, { state: 'failed', problem: 'Google turned this day down.' }))
    const r = offerReach(ctx({ link: link({ account: null }), days: shared }), offer('o1', 'aoife'), call(), aoife)
    expect(r).toMatchObject({ invited: [D1], refused: [D2], coming: [], reached: true })
  })
})

describe('the Offer form’s promise', () => {
  const promise = (c: ReachContext, people: Person[], over: Partial<CrewCall> = {}) => offerPromise(c, { ...call(over), days: [D1, D2] }, people)
  const tommo = person('tommo', 'Tomás Reilly', { knownAs: 'Tommo' })

  it('says an invite is emailed to each person who gets one, for each day', () => {
    expect(promise(ctx(), [aoife])).toEqual({ sentences: ['Pressing it emails them a calendar invite for each day.'], silent: false, invites: true })
    expect(promise(ctx(), [aoife, tommo]).sentences).toEqual(['Pressing it emails each of them a calendar invite for each day.'])
    expect(offerPromise(ctx(), { ...call(), days: [D1] }, [aoife]).sentences).toEqual(['Pressing it emails them a calendar invite.'])
    // A calendar with a problem is written to once it's put right: the invite is promised for then, not for the press.
    expect(promise(ctx({ link: link({ problem: 'Google Calendar isn’t answering.' }) }), [aoife]).sentences).toEqual(['Pressing it emails them a calendar invite for each day once the calendar is working again.'])
  })

  it('says who gets nothing and why, beside who gets an invite (finding 1)', () => {
    expect(promise(ctx(), [aoife, tommo, sean])).toEqual({
      sentences: ['Pressing it emails Aoife and Tommo a calendar invite for each day.', 'Nothing goes to Seán: no email address for a calendar invite, and WhatsApp is off.'],
      silent: false,
      invites: true,
    })
    expect(promise(ctx(), [sean])).toEqual({ sentences: ['Nothing goes to Seán: no email address for a calendar invite, and WhatsApp is off.'], silent: true, invites: false })
    // With messages on, a message opens for the office to send, so only the invite is spoken of.
    expect(promise(ctx({ messages: true }), [aoife, sean]).sentences).toEqual(['Pressing it emails Aoife a calendar invite for each day.', 'Seán has no email address, so no calendar invite.'])
  })

  it('promises a job brought in from Google Calendar its invites, as the app’s own jobs have them (ADR 0157)', () => {
    const theirs = job({ sourceCalendar: 'Gigs' })
    expect(promise(ctx({ job: theirs }), [aoife, sean])).toEqual(promise(ctx(), [aoife, sean]))
    expect(promise(ctx({ job: theirs }), [aoife]).sentences).toEqual(['Pressing it emails them a calendar invite for each day.'])
    expect(promise(ctx({ job: theirs, messages: true }), [aoife])).toEqual(promise(ctx({ messages: true }), [aoife]))
    const on = { mode: 'on' as const, testTo: [] }
    expect(promise(ctx({ job: theirs, whatsapp: on }), [aoife])).toEqual(promise(ctx({ whatsapp: on }), [aoife]))
  })

  it('says nothing is sent for a job brought in from Google Calendar without an account of its own, a call with no job, or days outside the phases', () => {
    // A person's own copy goes on the connected account's own calendar: with none, a brought-in job's days are the organiser's alone.
    expect(promise(ctx({ job: job({ sourceCalendar: 'Gigs' }), link: link({ account: null }) }), [aoife, sean])).toEqual({
      sentences: ["Nothing is sent for this job from the app: it came from Google Calendar, so its days are the organiser's."],
      silent: true,
      invites: false,
    })
    expect(promise(ctx(), [aoife], { projectId: null, phaseId: null }).sentences).toEqual(["Nothing is sent: a call that isn't part of a job gets no calendar invite, and WhatsApp is off."])
    expect(promise(ctx({ job: job({ phases: [] }) }), [aoife]).sentences).toEqual(["Nothing is sent: the call's days aren't inside one of the job's phases, so no calendar invite goes, and WhatsApp is off."])
    expect(promise(ctx({ link: link({ state: 'reconnect' }) }), [aoife]).sentences).toEqual(['Nothing is sent: the calendar needs connecting again before invites go, and WhatsApp is off.'])
    expect(promise(ctx({ link: link({ invites: false }) }), [aoife])).toEqual({ sentences: ['Nothing is sent: calendar invites, WhatsApp and messages to crew are all off.'], silent: true, invites: false })
  })

  it('says only that no invite goes when the office sends its own messages', () => {
    const on = { messages: true }
    expect(promise(ctx({ ...on, job: job({ sourceCalendar: 'Gigs' }), link: link({ account: null }) }), [aoife])).toEqual({
      sentences: ["No calendar invite goes for this job: it came from Google Calendar, so its days are the organiser's."],
      silent: false,
      invites: false,
    })
    expect(promise(ctx(on), [aoife], { projectId: null, phaseId: null }).sentences).toEqual(["No calendar invite goes for a call that isn't part of a job."])
    // Invites off is how it was before invites: nothing to say.
    expect(promise(ctx({ ...on, link: link({ invites: false }) }), [aoife])).toEqual({ sentences: [], silent: false, invites: false })
  })

  it('says who it goes to on WhatsApp, by the rule the server sends by', () => {
    const on = { mode: 'on' as const, testTo: [] }
    expect(promise(ctx({ whatsapp: on }), [aoife, sean]).sentences).toEqual([
      'Pressing it emails Aoife a calendar invite for each day.',
      'The offer also goes to each of them on WhatsApp.',
      'Seán has no email address, so no calendar invite.',
    ])
    expect(promise(ctx({ whatsapp: on, job: job({ sourceCalendar: 'Gigs' }), link: link({ account: null }) }), [aoife])).toEqual({
      sentences: ['Pressing it sends the offer to them on WhatsApp.', "No calendar invite goes for this job: it came from Google Calendar, so its days are the organiser's."],
      silent: false,
      invites: false,
    })
    const noPhone = { ...sean, phone: null }
    expect(promise(ctx({ whatsapp: on }), [aoife, noPhone]).sentences).toEqual([
      'Pressing it emails Aoife a calendar invite for each day.',
      'The offer also goes to Aoife on WhatsApp.',
      'Nothing goes to Seán: no email address for a calendar invite, and they have no mobile number for WhatsApp.',
    ])
  })

  it('makes no promise about a job this device can’t read', () => {
    expect(promise(ctx({ job: null }), [aoife])).toEqual({ sentences: [], silent: false, invites: false })
  })
})

describe('the question before an offer is ended', () => {
  const half = days(row(D1, 'aoife', { offerId: 'o1' }), row(D2, 'aoife', { offerId: 'o1', response: 'declined' }), row('2026-11-01', 'aoife', { offerId: 'o1' }))

  it('counts the days Google emails a cancellation for: invited, from today on, and not turned down', () => {
    expect(daysToCancel(ctx({ days: invitedBoth }), 'o1')).toEqual([D1, D2])
    expect(daysToCancel(ctx({ days: half }), 'o1')).toEqual([D1])
    expect(daysToCancel(ctx({ days: invitedBoth }), 'other')).toEqual([])
    // Invites switched off since: the invites people hold stay as they are, and no cancellation goes.
    const offSince = ctx({ days: invitedBoth, link: link({ invites: false }) })
    expect(daysToCancel(offSince, 'o1')).toEqual([])
    expect(invitesHeld(offSince, 'o1')).toEqual([D1, D2])
    expect(endingWords(offSince, 'o1', "it's withdrawn")).toBe("Their link says it's withdrawn at once. Crew invites are off, so Google sends no cancellation: the 2 days stay in their calendar.")
    expect(callEndingWords(offSince, { end: D2, offers: [offer('o1', 'aoife'), offer('o2', 'sean')] })).toBe(
      "Nothing is sent to the 2 people on it: their links say it's withdrawn at once. Crew invites are off, so Google sends no cancellation: the days stay in the calendars of those invited."
    )
    expect(jobEndingWords(offSince, [{ personId: 'aoife', offerId: 'o1' }])).toBe(' Crew invites are off, so Google sends no cancellation: the days stay in the calendars of those invited.')
    expect(toldSentences([toldOfEnding(offSince, aoife, { cancel: 0, left: 0, invited: true, kept: 2 })])).toEqual([
      'Nothing was sent to Aoife, and the days stay in their calendar: crew invites are off, so Google sends no cancellation.',
    ])
  })

  it('names the email Google sends, or says nothing is sent (finding 5)', () => {
    expect(endingWords(ctx({ days: invitedBoth }), 'o1', "it's withdrawn")).toBe("Google emails them that their 2 days are cancelled, and their link says it's withdrawn at once.")
    expect(endingWords(ctx({ days: half }), 'o1', 'so')).toBe('Google emails them that the day is cancelled, and their link says so at once.')
    expect(endingWords(ctx(), 'o1', "it's withdrawn")).toBe("Their link says it's withdrawn at once. Nothing is sent to them.")
    expect(endingWords(ctx({ messages: true }), 'o1', "it's withdrawn")).toBe("Their link says it's withdrawn at once.")
    // A calendar the server can't write to takes nothing off until it can.
    const stuck = ctx({ days: invitedBoth, link: link({ problem: 'Google Calendar isn’t answering.' }) })
    expect(endingWords(stuck, 'o1', 'so')).toBe('Google emails them that their 2 days are cancelled once the calendar is working again, and their link says so at once.')
    expect(callEndingWords(stuck, { end: D2, offers: [offer('o1', 'aoife')] })).toBe("Google emails the person on it that their days are cancelled once the calendar is working again, and their link says it's withdrawn at once.")
    expect(jobEndingWords(stuck, [{ personId: 'aoife', offerId: 'o1' }])).toBe(' Google emails them that their days are cancelled once the calendar is working again.')
  })

  it("names the days Google cancels when Confirm ends the ask for days they haven't answered (ADR 0152)", () => {
    // A Yes on the first day's invite only: confirming books that day, and the second day's invite comes off.
    expect(askEndingWords(ctx({ days: invitedBoth }), 'o1', [D2])).toBe('Google emails them that Sat 21 Nov is cancelled.')
    expect(askEndingWords(ctx({ days: invitedBoth }), 'o1', [D1, D2])).toBe('Google emails them that Fri 20 Nov to Sat 21 Nov are cancelled.')
    const stuck = ctx({ days: invitedBoth, link: link({ problem: 'Google Calendar isn’t answering.' }) })
    expect(askEndingWords(stuck, 'o1', [D2])).toBe('Google emails them that Sat 21 Nov is cancelled once the calendar is working again.')
    // No invite of theirs for it, or invites off since: nothing to say.
    expect(askEndingWords(ctx(), 'o1', [D2])).toBe('')
    expect(askEndingWords(ctx({ days: invitedBoth, link: link({ invites: false }) }), 'o1', [D2])).toBe('')
  })

  it('says how many of the people on a call Google emails when the call is cancelled (finding 20)', () => {
    const both = days(row(D1, 'aoife', { offerId: 'o1' }), row(D1, 'tommo', { offerId: 'o2' }))
    const offers = [offer('o1', 'aoife'), offer('o2', 'tommo', 'confirmed'), offer('o3', 'sean', 'declined')]
    expect(callEndingWords(ctx({ days: both }), { end: D2, offers })).toBe("Google emails the 2 people on it that the day is cancelled, and their links say it's withdrawn at once.")
    expect(callEndingWords(ctx({ days: invitedBoth }), { end: D2, offers })).toBe("Google emails 1 of the 2 people on it that their days are cancelled. Everyone's link says it's withdrawn at once, and nothing else is sent.")
    expect(callEndingWords(ctx(), { end: D2, offers })).toBe("Nothing is sent to the 2 people on it: their links say it's withdrawn at once.")
    expect(callEndingWords(ctx(), { end: D2, offers: [offers[0]!] })).toBe("Nothing is sent to the person on it: their link says it's withdrawn at once.")
    expect(callEndingWords(ctx({ messages: true }), { end: D2, offers: [offers[0]!] })).toBe("Their link says it's withdrawn at once.")
    expect(callEndingWords(ctx({ days: invitedBoth }), { end: D2, offers: [offers[0]!] })).toBe("Google emails the person on it that their days are cancelled, and their link says it's withdrawn at once.")
    expect(callEndingWords(ctx(), { end: D2, offers: [offers[2]!] })).toBe('Nobody is offered or booked on it.')
  })

  it('adds how many of a stopped job’s people Google emails, and nothing when it emails nobody', () => {
    const c = ctx({ days: days(row(D1, 'aoife', { offerId: 'o1' }), row(D2, 'aoife', { offerId: 'o1b' }), row(D1, 'tommo', { offerId: 'o2' })) })
    const aoifes = [{ personId: 'aoife', offerId: 'o1' }, { personId: 'aoife', offerId: 'o1b' }]
    expect(jobEndingWords(ctx(), aoifes)).toBe('')
    // Someone on two of the job's calls is one person, with the days of both.
    expect(jobEndingWords(c, aoifes)).toBe(' Google emails them that their days are cancelled.')
    expect(jobEndingWords(c, [aoifes[0]!])).toBe(' Google emails them that the day is cancelled.')
    expect(jobEndingWords(c, [...aoifes, { personId: 'tommo', offerId: 'o2' }])).toBe(' Google emails each of them that their days are cancelled.')
    expect(jobEndingWords(c, [...aoifes, { personId: 'tommo', offerId: 'o2' }, { personId: 'sean', offerId: 'o3' }, { personId: 'niamh' }])).toBe(' Google emails 2 of them that their days are cancelled.')
  })
})

describe('telling crew what happens next (ADR 0153)', () => {
  const telling = (tell: CalendarLink['tell'], tellTo: string[] = []) => ctx({ days: invitedBoth, link: link({ tell, tellTo }) })
  const tommo = person('tommo', 'Tomás Reilly', { knownAs: 'Tommo' })

  it('reaches everyone invited when on, and only the addresses listed when being tried', () => {
    expect(toldNext(ctx(), aoife)).toBe(false)
    expect(toldNext(telling('off', ['aoife@example.com']), aoife)).toBe(false)
    expect(toldNext(telling('on'), aoife)).toBe(true)
    expect(toldNext(telling('on'), sean)).toBe(false)
    // Compared as Google compares addresses.
    expect(toldNext(telling('test', ['Aoife@Example.com ']), aoife)).toBe(true)
    expect(toldNext(telling('test', ['tommo@example.com']), aoife)).toBe(false)
  })

  it('says before Confirm that Google emails them the booking, or to hold the day', () => {
    expect(bookingWords(telling('on'), 'o1', aoife)).toBe("Google emails them that they're booked.")
    expect(bookingWords(telling('on'), 'o1', aoife, true)).toBe('Google emails them to hold the day.')
    expect(bookingWords(ctx({ days: invitedBoth, link: link({ tell: 'on', problem: 'Google Calendar isn’t answering.' }) }), 'o1', aoife)).toBe(
      "Google emails them that they're booked once the calendar is working again."
    )
    // Off, not on the list, or no invite of theirs: nothing is sent, so nothing is said.
    expect(bookingWords(ctx({ days: invitedBoth }), 'o1', aoife)).toBe('')
    expect(bookingWords(telling('test', ['tommo@example.com']), 'o1', aoife)).toBe('')
    expect(bookingWords(telling('on'), 'other', aoife)).toBe('')
  })

  it('says the cancellation says why, before and after the press', () => {
    expect(endingWords(telling('on'), 'o1', "it's withdrawn", aoife)).toBe("Google emails them that their 2 days are cancelled and why, and their link says it's withdrawn at once.")
    expect(endingWords(telling('on'), 'o1', "it's withdrawn")).toBe("Google emails them that their 2 days are cancelled, and their link says it's withdrawn at once.")
    expect(endingWords(telling('test', ['tommo@example.com']), 'o1', "it's withdrawn", aoife)).toBe(
      "Google emails them that their 2 days are cancelled, and their link says it's withdrawn at once."
    )
    // A call or a job: only when every cancellation says why.
    const both = days(row(D1, 'aoife', { offerId: 'o1' }), row(D1, 'tommo', { offerId: 'o2' }))
    const offers = [{ ...offer('o1', 'aoife'), person: aoife }, { ...offer('o2', 'tommo', 'confirmed'), person: tommo }]
    expect(callEndingWords(ctx({ days: both, link: link({ tell: 'on' }) }), { end: D2, offers })).toBe(
      "Google emails the 2 people on it that the day is cancelled and why, and their links say it's withdrawn at once."
    )
    expect(callEndingWords(ctx({ days: both, link: link({ tell: 'test', tellTo: ['aoife@example.com'] }) }), { end: D2, offers })).toBe(
      "Google emails the 2 people on it that the day is cancelled, and their links say it's withdrawn at once."
    )
    const c = ctx({ days: both, link: link({ tell: 'on' }) })
    expect(jobEndingWords(c, [{ personId: 'aoife', offerId: 'o1', email: aoife.email }])).toBe(' Google emails them that the day is cancelled and why.')
    expect(jobEndingWords(c, [{ personId: 'aoife', offerId: 'o1', email: aoife.email }, { personId: 'tommo', offerId: 'o2', email: null }])).toBe(
      ' Google emails each of them that the day is cancelled.'
    )
    // Someone with no invite to cancel doesn't stop the rest being told why.
    expect(jobEndingWords(c, [{ personId: 'aoife', offerId: 'o1', email: aoife.email }, { personId: 'sean', offerId: 'o3', email: null }])).toBe(
      ' Google emails 1 of them that the day is cancelled and why.'
    )
    expect(toldSentences([toldOfEnding(telling('on'), aoife, { cancel: 2, left: 2, invited: true })])).toEqual(['Google is emailing Aoife that their days are cancelled and why.'])
    expect(toldSentences([toldOfEnding(telling('on'), aoife, { cancel: 1, left: 0, invited: true })])).toEqual(['Google has emailed Aoife that the day is cancelled and why.'])
  })

  it('says after Confirm that Google is emailing them, so there is nobody to ring', () => {
    const booked = toldOfBooking(telling('on'), aoife, { invited: true })
    expect(toldSentences([booked])).toEqual(["Google is emailing Aoife that they're booked, and their link says so."])
    expect(booked.reached).toBe(true)
    expect(toldSentences([toldOfBooking(telling('on'), aoife, { invited: true }), toldOfBooking(telling('on'), tommo, { invited: true })])).toEqual([
      "Google is emailing Aoife and Tommo that they're booked, and their links say so.",
    ])
    expect(toldSentences([toldOfBooking(telling('on'), aoife, { invited: true }, true)])).toEqual([
      "Google is emailing Aoife to hold the day, as the client hasn't said yes yet, and their link says so.",
    ])
    // Not on the list being tried, or no invite: as before.
    expect(toldSentences([toldOfBooking(telling('test', ['tommo@example.com']), aoife, { invited: true })])).toEqual([
      "Nothing was sent to Aoife: their link and their calendar invite say they're booked, and no email goes with that.",
    ])
    expect(toldSentences([toldOfBooking(telling('on'), sean, { invited: false })])).toEqual(["Nothing was sent to Seán: their link says they're booked."])
  })

  it('says after a call changes that Google emails the new call time, and nothing for the rest', () => {
    expect(toldSentences([toldOfChange(telling('on'), aoife, { invited: true }, false, true)])).toEqual(['Google is emailing Aoife the new call time.'])
    expect(toldSentences([toldOfChange(telling('on'), aoife, { invited: true }, true, true)])).toEqual(['Google is emailing Aoife about the days that changed.'])
    expect(toldSentences([toldOfChange(telling('on'), aoife, { invited: true }, false)])).toEqual([
      'Nothing was sent to Aoife: the change is on their link, and Google emails nothing unless the days or the call time move.',
    ])
    expect(toldSentences([toldOfChange(ctx({ days: invitedBoth }), aoife, { invited: true }, false, true)])).toEqual([
      'Nothing was sent to Aoife: the change is on their link, and Google emails nothing unless the days move.',
    ])
    const stuck = ctx({ days: invitedBoth, link: link({ tell: 'on', problem: 'Google Calendar isn’t answering.' }) })
    expect(toldSentences([toldOfChange(stuck, aoife, { invited: true }, false, true)])).toEqual(['Google emails Aoife the new call time once the calendar is working again.'])
  })
})

describe('the panel after a press', () => {
  const reach = (c: ReachContext, o: Offer, p: Person, cl: Partial<CrewCall> = {}) => offerReach(c, o, call(cl), p)
  const tommo = person('tommo', 'Tomás Reilly', { knownAs: 'Tommo' })
  const dara = person('dara', 'Dara Kelly')
  const niamh = person('niamh', 'Niamh Doyle')

  it('says in one sentence each who was emailed and who nothing reached (finding 5)', () => {
    const c = ctx({ days: days(row(D1, 'aoife', { offerId: 'o1' }), row(D2, 'aoife', { offerId: 'o1' }), row(D1, 'tommo', { offerId: 'o2' }), row(D2, 'tommo', { offerId: 'o2' })) })
    const people = [
      toldOfOffer(aoife, reach(c, offer('o1', 'aoife'), aoife)),
      toldOfOffer(tommo, reach(c, offer('o2', 'tommo'), tommo)),
      toldOfOffer(sean, reach(c, offer('o3', 'sean'), sean)),
    ]
    expect(toldSentences(people)).toEqual([
      'Aoife and Tommo were emailed a calendar invite for each day.',
      'Nothing has reached Seán: they have no email address for a calendar invite, and WhatsApp is off.',
    ])
    expect(people.map((p) => p.reached)).toEqual([true, true, false])
  })

  it('says an invite is on its way until it is written, and each other way it can stand', () => {
    const one = (c: ReachContext, o: Offer = offer('o1', 'aoife'), p: Person = aoife, cl: Partial<CrewCall> = {}) => toldSentences([toldOfOffer(aoife, reach(c, o, p, cl))])
    expect(one(ctx())).toEqual(['A calendar invite is on its way to Aoife by email.'])
    expect(one(ctx({ days: days(row(D1, 'aoife', { offerId: 'o1' })) }), offer('o1', 'aoife', 'offered', { days: [D1] }))).toEqual(['Aoife was emailed a calendar invite.'])
    expect(one(ctx({ link: link({ problem: 'Google Calendar isn’t answering.' }) }))).toEqual(["The calendar invite to Aoife hasn't gone: the calendar has a problem. See Admin › Connections."])
    expect(one(ctx({ days: days(row(D1, 'aoife', undefined, { state: 'failed' }), row(D2, 'aoife', undefined, { state: 'failed' })) }))).toEqual(['Google turned down the calendar invite to Aoife: check the address.'])
    // On a job brought in from Google Calendar, an offer that has no invite of its own says why (ADR 0157).
    expect(one(ctx({ job: job({ sourceCalendar: 'Gigs' }) }), offer('o1', 'aoife', 'offered', { noOwnInvite: 'organiser' }))).toEqual([
      'Nothing was sent to Aoife from the app: the organiser invited them in Google Calendar.',
    ])
    expect(one(ctx({ job: job({ sourceCalendar: 'Gigs' }) }), offer('o1', 'aoife', 'offered', { noOwnInvite: 'before' }))).toEqual([
      'Nothing was sent to Aoife from the app: it was offered before jobs from Google Calendar sent their own.',
    ])
    const two = ctx({ job: job({ sourceCalendar: 'Gigs' }) })
    expect(
      toldSentences([
        toldOfOffer(aoife, reach(two, offer('o1', 'aoife', 'offered', { noOwnInvite: 'before' }), aoife)),
        toldOfOffer(tommo, reach(two, offer('o2', 'tommo', 'offered', { noOwnInvite: 'before' }), tommo)),
      ])
    ).toEqual(['Nothing was sent to Aoife and Tommo from the app: they were offered before jobs from Google Calendar sent their own.'])
    expect(one(ctx({ job: job({ sourceCalendar: 'Gigs' }), link: link({ account: null }) }))).toEqual([
      "Nothing was sent to Aoife from the app: this job came from Google Calendar, so its days are the organiser's.",
    ])
    // An offer made since on such a job has its own invite (ADR 0157).
    expect(one(ctx({ job: job({ sourceCalendar: 'Gigs' }) }))).toEqual(['A calendar invite is on its way to Aoife by email.'])
    expect(one(ctx({ link: link({ invites: false }) }))).toEqual(['Nothing was sent to Aoife: calendar invites and WhatsApp are both off.'])
    const read = offer('o1', 'aoife', 'offered', { whatsapp: { state: 'read', at: '2026-11-12T10:00:00.000Z', problem: null } })
    expect(one(ctx({ whatsapp: { mode: 'on', testTo: [] } }), read)).toEqual(['A calendar invite is on its way to Aoife by email.', 'The offer went to Aoife on WhatsApp.'])
    expect(one(ctx({ whatsapp: { mode: 'on', testTo: [] } }), read, aoife, { projectId: null, phaseId: null })).toEqual([
      "No calendar invite went to Aoife: this call isn't part of a job.",
      'The offer went to Aoife on WhatsApp.',
    ])
    // The invite is named once: its reason doesn't say "for a calendar invite" again.
    expect(one(ctx({ whatsapp: { mode: 'on', testTo: [] } }), read, { ...aoife, email: null })).toEqual(['No calendar invite went to Aoife: they have no email address.', 'The offer went to Aoife on WhatsApp.'])
    expect(one(ctx({ whatsapp: { mode: 'on', testTo: [] }, job: job({ phases: [{ id: 'other', start: D1, end: D2 }] }) }), read)).toEqual([
      "No calendar invite went to Aoife: its days aren't inside one of the job's phases.",
      'The offer went to Aoife on WhatsApp.',
    ])
  })

  it('says whether Google told them after an offer or a booking is ended', () => {
    const c = ctx()
    const people = [
      toldOfEnding(c, dara, { cancel: 3, left: 3, invited: true }),
      toldOfEnding(c, niamh, { cancel: 2, left: 2, invited: true }),
      toldOfEnding(c, sean, { cancel: 0, left: 0, invited: false }),
    ]
    expect(toldSentences(people)).toEqual(['Google is emailing Dara and Niamh that their days are cancelled.', 'Nothing was sent to Seán.'])
    expect(people.map((p) => p.reached)).toEqual([true, true, false])
    expect(toldSentences([toldOfEnding(c, dara, { cancel: 1, left: 0, invited: true })])).toEqual(['Google has emailed Dara that the day is cancelled.'])
    const stuck = ctx({ link: link({ problem: 'Google Calendar isn’t answering.' }) })
    expect(toldSentences([toldOfEnding(stuck, dara, { cancel: 2, left: 2, invited: true })])).toEqual([
      "Dara still has the days in their calendar: the calendar has a problem, so Google hasn't told them. See Admin › Connections.",
    ])
    // A WhatsApp going is what was sent, so "Nothing was sent" isn't said beside it (ADR 0154).
    expect(toldSentences([toldOfEnding(c, dara, { cancel: 0, left: 0, invited: false, whatsapp: 'job-off' })])).toEqual(['A WhatsApp saying the job is off is going to Dara.'])
  })

  it('says nobody is told they are booked, and that a change emails nobody unless the days move', () => {
    const c = ctx()
    expect(toldSentences([toldOfBooking(c, aoife, { invited: true })])).toEqual(["Nothing was sent to Aoife: their link and their calendar invite say they're booked, and no email goes with that."])
    expect(toldSentences([toldOfBooking(c, sean, { invited: false })])).toEqual(["Nothing was sent to Seán: their link says they're booked."])
    expect(toldSentences([toldOfChange(c, aoife, { invited: true }, true), toldOfChange(c, sean, { invited: false }, true)])).toEqual([
      'Google is emailing Aoife about the days that changed.',
      'Nothing was sent to Seán: the change is on their link.',
    ])
    expect(toldSentences([toldOfChange(c, aoife, { invited: true }, false)])).toEqual(['Nothing was sent to Aoife: the change is on their link, and Google emails nothing unless the days move.'])
  })

  it('says the offer stands at the rate offered after the office says no to a rate, with no email (ADR 0152)', () => {
    const c = ctx()
    expect(toldSentences([toldOfRefusal(c, aoife, { invited: true })])).toEqual([
      'Nothing was sent to Aoife: their link and their calendar invite say the offer stands at the rate offered, and no email goes with that.',
    ])
    expect(toldSentences([toldOfRefusal(c, sean, { invited: false })])).toEqual(['Nothing was sent to Seán: their link says the offer stands at the rate offered.'])
    expect(toldSentences([toldOfRefusal(ctx({ link: link({ invites: false }) }), aoife, { invited: false, kept: 2 })])).toEqual([
      "Nothing was sent to Aoife: their link says the offer stands at the rate offered. Crew invites are off, so what's in their calendar stays as it was.",
    ])
    // A calendar with a problem writes nothing, so only the link says it yet.
    expect(toldSentences([toldOfRefusal(ctx({ link: link({ problem: 'Google Calendar isn’t answering.' }) }), aoife, { invited: true })])).toEqual([
      'Nothing was sent to Aoife: their link says the offer stands at the rate offered.',
    ])
  })

  it("says their link and invite ask them to hold the day, not that they're booked, while the client hasn't said yes", () => {
    // Proves: finding 6 of the audit of 12 November 2026 (ADR 0150). After the office picks someone for a job the client hasn't
    // agreed, the panel says what their link and their invite now tell them, which is to hold the day.
    const c = ctx()
    expect(toldSentences([toldOfBooking(c, aoife, { invited: true }, true)])).toEqual([
      "Nothing was sent to Aoife: their link and their calendar invite say to hold the day, as the client hasn't said yes yet, and no email goes with that.",
    ])
    expect(toldSentences([toldOfBooking(c, sean, { invited: false }, true)])).toEqual(["Nothing was sent to Seán: their link says to hold the day, as the client hasn't said yes yet."])
    const off = ctx({ link: link({ invites: false }) })
    expect(toldSentences([toldOfBooking(off, aoife, { invited: false, kept: 2 }, true)])).toEqual([
      "Nothing was sent to Aoife: their link says to hold the day, as the client hasn't said yes yet. Crew invites are off, so what's in their calendar stays as it was.",
    ])
    // Two people, one sentence, and a booking on a job that is agreed is never folded into it.
    expect(toldSentences([toldOfBooking(c, aoife, { invited: true }, true), toldOfBooking(c, dara, { invited: true }, true)])).toEqual([
      "Nothing was sent to Aoife and Dara: their links and calendar invites say to hold the day, as the client hasn't said yes yet, and no email goes with that.",
    ])
    expect(toldSentences([toldOfBooking(c, aoife, { invited: true }, true), toldOfBooking(c, dara, { invited: true })])).toHaveLength(2)
  })

  it('says Google emails a cancellation for the days still asked that Confirm ended, before the rest (ADR 0152)', () => {
    // Proves: the panel after Confirm on a yes with days not answered says what the question before it said would go, and
    // that nothing else did. While the server takes the invite off it's "is emailing", then "has emailed".
    const c = ctx()
    expect(toldSentences([toldOfBooking(c, aoife, { invited: true }, true, { gone: [D2], left: 1 })])).toEqual([
      'Google is emailing Aoife that Sat 21 Nov is cancelled.',
      "Nothing else went to Aoife: their link and their calendar invite say to hold the day, as the client hasn't said yes yet, and no email goes with that.",
    ])
    expect(toldSentences([toldOfBooking(c, aoife, { invited: true }, false, { gone: [D2], left: 0 })])).toEqual([
      'Google has emailed Aoife that Sat 21 Nov is cancelled.',
      "Nothing else went to Aoife: their link and their calendar invite say they're booked, and no email goes with that.",
    ])
    const stuck = ctx({ link: link({ problem: 'Google Calendar isn’t answering.' }) })
    expect(toldSentences([toldOfBooking(stuck, aoife, { invited: true }, false, { gone: [D2], left: 1 })])).toEqual([
      "Aoife still has that day in their calendar: the calendar has a problem, so Google hasn't told them. See Admin › Connections.",
      "Nothing else went to Aoife: their link says they're booked.",
    ])
    // With no day ended, it reads as before.
    expect(toldSentences([toldOfBooking(c, aoife, { invited: true }, false, { gone: [], left: 0 })])).toEqual([
      "Nothing was sent to Aoife: their link and their calendar invite say they're booked, and no email goes with that.",
    ])
  })

  it('says an invite goes out of date once invites are switched off, and waits on a calendar with a problem', () => {
    // Switched off since they were invited: the server leaves their own copies alone, so neither a booking nor a change reaches their calendar.
    const off = ctx({ link: link({ invites: false }) })
    expect(toldSentences([toldOfBooking(off, aoife, { invited: false, kept: 2 })])).toEqual(["Nothing was sent to Aoife: their link says they're booked. Crew invites are off, so what's in their calendar stays as it was."])
    expect(toldSentences([toldOfChange(off, aoife, { invited: false, kept: 2 }, true)])).toEqual(["Nothing was sent to Aoife: the change is on their link. Crew invites are off, so what's in their calendar stays as it was."])
    // Nothing is written to a calendar with a problem, so the invite doesn't say booked yet, and the days that moved are emailed once it's put right.
    const stuck = ctx({ link: link({ problem: 'Google Calendar isn’t answering.' }) })
    expect(toldSentences([toldOfBooking(stuck, aoife, { invited: true })])).toEqual(["Nothing was sent to Aoife: their link says they're booked."])
    const moved = toldOfChange(stuck, aoife, { invited: true }, true)
    expect(toldSentences([moved])).toEqual(['Google emails Aoife about the days that changed once the calendar is working again.'])
    expect(moved.reached).toBe(false)
  })

  it('names someone once, however many of the job’s calls they were on, and in full when two go by the same name', () => {
    const c = ctx()
    expect(toldSentences([toldOfEnding(c, dara, { cancel: 2, left: 2, invited: true }), toldOfEnding(c, dara, { cancel: 2, left: 2, invited: true })])).toEqual([
      'Google is emailing Dara that their days are cancelled.',
    ])
    const other = person('dara2', 'Dara Quinn')
    expect(toldSentences([toldOfEnding(c, dara, { cancel: 2, left: 2, invited: true }), toldOfEnding(c, other, { cancel: 2, left: 2, invited: true }), toldOfEnding(c, sean, { cancel: 0, left: 0, invited: false })])).toEqual([
      'Google is emailing Dara Kelly and Dara Quinn that their days are cancelled.',
      'Nothing was sent to Seán.',
    ])
  })
})

describe('what follows an offer on WhatsApp (ADR 0154)', () => {
  const on = { mode: 'on' as const, testTo: [] }
  const wa = (over: Partial<Omit<ReachContext, 'job' | 'calendar'>> & { link?: CalendarLink | null; days?: Record<string, CalendarDay> } = {}) => ctx({ whatsapp: on, ...over })
  const at = '2026-11-12T10:00:00.000Z'
  const message = (state: NonNullable<Offer['whatsapp']>['state']) => ({ whatsapp: { state, at, problem: null } })
  const dara = person('dara', 'Dara Kelly')
  const tommo = person('tommo', 'Tomás Reilly', { knownAs: 'Tommo' })

  it('goes to someone who heard of the offer: its WhatsApp went, none was made, or they answered', () => {
    expect(offerHeard({})).toBe(true)
    expect(offerHeard(message('sent'))).toBe(true)
    expect(offerHeard(message('read'))).toBe(true)
    expect(offerHeard(message('queued'))).toBe(false)
    expect(offerHeard(message('failed'))).toBe(false)
    expect(offerHeard({ ...message('failed'), respondedAt: at })).toBe(true)
  })

  it('goes by WhatsApp’s switch, their own and their number, whether or not the offer itself went there (question 7)', () => {
    expect(whatsappFollows(on, aoife, true)).toBe(true)
    expect(whatsappFollows(on, aoife, false)).toBe(false)
    expect(whatsappFollows({ mode: 'off', testTo: [] }, aoife, true)).toBe(false)
    expect(whatsappFollows({ mode: 'test', testTo: ['087 123 4567'] }, aoife, true)).toBe(true)
    expect(whatsappFollows(on, { ...aoife, whatsappOff: true }, true)).toBe(false)
    expect(whatsappFollows(on, { ...aoife, phone: null }, true)).toBe(false)
    expect(whatsappFollows(on, undefined, true)).toBe(false)
  })

  it('says nothing about a call whose days are all past, nor about someone who never heard of the offer', () => {
    expect(whatsappFollowsOffer(wa(), call(), {}, aoife)).toBe(true)
    expect(whatsappFollowsOffer(wa(), call({ start: '2026-11-01', end: today }), {}, aoife)).toBe(true)
    expect(whatsappFollowsOffer(wa(), call({ start: '2026-11-01', end: '2026-11-11' }), {}, aoife)).toBe(false)
    expect(whatsappFollowsOffer(wa(), call(), message('failed'), aoife)).toBe(false)
    expect(whatsappFollowsOffer(wa(), call(), {}, null)).toBe(false)
    const told = { person: aoife, context: { call: call(), offerId: 'o1', heard: true } }
    expect(whatsappFollowsTell(wa(), told)).toBe(true)
    expect(whatsappFollowsTell(wa(), { ...told, context: { ...told.context, heard: false } })).toBe(false)
    expect(whatsappFollowsTell(wa(), { ...told, context: { ...told.context, offerId: undefined } })).toBe(false)
    expect(whatsappFollowsTell(wa(), { ...told, context: { ...told.context, call: call({ start: '2026-11-01', end: '2026-11-02' }) } })).toBe(false)
  })

  it('says before Confirm that a WhatsApp tells them they are booked, never while they only hold the day', () => {
    expect(bookingWords(wa(), 'o1', aoife, false, true)).toBe("A WhatsApp tells them they're booked.")
    expect(bookingWords(wa(), 'o1', aoife, true, true)).toBe('')
    const telling = wa({ days: invitedBoth, link: link({ tell: 'on' }) })
    expect(bookingWords(telling, 'o1', aoife, false, true)).toBe("Google emails them that they're booked, and a WhatsApp tells them too.")
    expect(bookingWords(telling, 'o1', aoife, true, true)).toBe('Google emails them to hold the day.')
  })

  it('says before an offer is ended that a WhatsApp tells them they are no longer needed', () => {
    expect(endingWords(wa(), 'o1', "it's withdrawn", aoife, true)).toBe("Their link says it's withdrawn at once, and a WhatsApp tells them they're no longer needed.")
    expect(endingWords(wa({ days: invitedBoth }), 'o1', 'so', aoife, true)).toBe(
      "Google emails them that their 2 days are cancelled, and their link says so at once. A WhatsApp tells them they're no longer needed."
    )
    expect(endingWords(wa({ days: invitedBoth, link: link({ invites: false }) }), 'o1', "it's withdrawn", aoife, true)).toBe(
      "Their link says it's withdrawn at once. Crew invites are off, so Google sends no cancellation: the 2 days stay in their calendar. A WhatsApp tells them they're no longer needed."
    )
  })

  it('says how many of the people on a cancelled call a WhatsApp tells, and nothing about one that is over', () => {
    const offers = [
      { ...offer('o1', 'aoife'), person: aoife },
      { ...offer('o2', 'tommo', 'confirmed'), person: tommo },
    ]
    expect(callEndingWords(wa(), { end: D2, offers })).toBe("Their links say it's withdrawn at once. A WhatsApp tells each of them they're no longer needed.")
    expect(callEndingWords(wa(), { end: D2, offers: [offers[0]!, { ...offers[1]!, person: { ...tommo, phone: null } }] })).toBe(
      "Their links say it's withdrawn at once. A WhatsApp tells 1 of them they're no longer needed."
    )
    expect(callEndingWords(wa(), { end: D2, offers: [offers[0]!] })).toBe("Their link says it's withdrawn at once. A WhatsApp tells them they're no longer needed.")
    expect(callEndingWords(wa({ days: invitedBoth }), { end: D2, offers })).toBe(
      "Google emails 1 of the 2 people on it that their days are cancelled. Everyone's link says it's withdrawn at once. A WhatsApp tells each of them they're no longer needed."
    )
    expect(callEndingWords(wa(), { end: '2026-11-11', offers })).toBe("Nothing is sent to the 2 people on it: their links say it's withdrawn at once.")
  })

  it('says how many of a stopped job’s people a WhatsApp tells it’s off, each once', () => {
    expect(jobEndingWords(wa(), [{ personId: 'aoife', offerId: 'o1', whatsapp: true }, { personId: 'aoife', offerId: 'o2', whatsapp: true }, { personId: 'dara', offerId: 'o3', whatsapp: true }])).toBe(
      " A WhatsApp tells each of them it's off."
    )
    expect(jobEndingWords(wa({ days: invitedBoth }), [{ personId: 'aoife', offerId: 'o1', whatsapp: false }, { personId: 'dara', offerId: 'o3', whatsapp: true }])).toBe(
      " Google emails 1 of them that their days are cancelled. A WhatsApp tells 1 of them it's off."
    )
    expect(jobEndingWords(wa(), [{ personId: 'aoife', offerId: 'o1', whatsapp: true }])).toBe(" A WhatsApp tells them it's off.")
    expect(jobEndingWords(wa(), [{ personId: 'aoife', offerId: 'o1' }])).toBe('')
  })

  it('says after a press what went on WhatsApp, beside what Google emailed', () => {
    const c = wa()
    // Booked: with no invite, with an invite that changes quietly, and with Google emailing it too.
    expect(toldSentences([toldOfBooking(c, sean, { invited: false, whatsapp: 'booked' })])).toEqual(["A WhatsApp saying they're booked is going to Seán, and their link says so."])
    expect(toldSentences([toldOfBooking(c, aoife, { invited: true, whatsapp: 'booked' })])).toEqual([
      "A WhatsApp saying they're booked is going to Aoife. Their link and calendar invite say so too, with no email from Google.",
    ])
    expect(toldSentences([toldOfBooking(wa({ days: invitedBoth, link: link({ tell: 'on' }) }), aoife, { invited: true, whatsapp: 'booked' })])).toEqual([
      "Google is emailing Aoife that they're booked, and their link says so.",
      "A WhatsApp saying they're booked is going to Aoife.",
    ])
    expect(toldOfBooking(c, sean, { invited: false, whatsapp: 'booked' }).reached).toBe(true)
    // Picked to hold the day: no WhatsApp yet, so nobody is told otherwise.
    const held = toldOfBooking(c, sean, { invited: false, whatsapp: 'booked' }, true)
    expect(toldSentences([held])).toEqual(["Nothing was sent to Seán: their link says to hold the day, as the client hasn't said yes yet."])
    expect(held.reached).toBe(false)
    // Ended: the WhatsApp beside Google's cancellation, or alone.
    expect(toldSentences([toldOfEnding(c, aoife, { cancel: 2, left: 2, invited: true, whatsapp: 'not-needed' }), toldOfEnding(c, dara, { cancel: 0, left: 0, invited: false, whatsapp: 'not-needed' })])).toEqual([
      'Google is emailing Aoife that their days are cancelled.',
      "A WhatsApp saying they're no longer needed is going to Aoife and Dara.",
    ])
    expect(toldSentences([toldOfEnding(ctx({ link: link({ invites: false }), whatsapp: on }), aoife, { cancel: 0, left: 0, invited: false, kept: 2, whatsapp: 'not-needed' })])).toEqual([
      'Google sends Aoife no cancellation, as crew invites are off: the days stay in their calendar.',
      "A WhatsApp saying they're no longer needed is going to Aoife.",
    ])
    // A new call time: the WhatsApp, and what their invite does.
    expect(toldSentences([toldOfChange(c, aoife, { invited: true, whatsapp: 'call-time' }, false, true)])).toEqual([
      'A WhatsApp with the new call time is going to Aoife, and the change is on their link. Google emails nothing for it, as the days stay the same.',
    ])
    expect(toldSentences([toldOfChange(wa({ days: invitedBoth, link: link({ tell: 'on' }) }), aoife, { invited: true, whatsapp: 'call-time' }, false, true)])).toEqual([
      'Google is emailing Aoife the new call time.',
      'A WhatsApp with the new call time is going to Aoife.',
    ])
    // Another change, with the call time as it was: no WhatsApp.
    expect(toldSentences([toldOfChange(c, sean, { invited: false, whatsapp: 'call-time' }, false, false)])).toEqual(['Nothing was sent to Seán: the change is on their link.'])
  })
})
