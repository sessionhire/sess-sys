import { answersHeading, jobFilters, jobSorts, listed, quotesToFollow, standing, STOPPED, type StandingKey } from '@sh/shared'
import { describe, expect, it } from 'vitest'
import { call, checks, company, day, m, ok, person, phone, today } from './company.ts'

/**
 * How things stand (ADR 0033; Move 3 of the sweep of 6 November 2026): every
 * count Home shows is the number of rows in a list worked out in one place
 * (shared/src/sync/standing.ts), and the screen it opens heads that list
 * with the same number. Here a company with something in every list, put in
 * as the office would, so no count is checked against nothing: each list
 * holds what it says and leaves out what it doesn't, and where the screen it
 * opens reads its own rule, as the Jobs list's filters and the Quotes page
 * do, the two agree. Each count on Home is tapped in e2e/home.spec.ts.
 */

/** A day this many days from today, at ten in the morning, as a device records it. */
const at = (n: number) => `${day(n)}T10:00:00Z`

async function everythingWaiting() {
  const { app } = await company()
  await ok(
    app,
    // Running late on today's call, said for them by the office, and not yet noted.
    m('late.say', { id: 'late-dara', offerId: 'dara-now', day: today, by: '30', arriveAt: null, note: 'Traffic on the M50' }),
    // A yes to confirm on a call still short after it, and a call after the fortnight still needing crew.
    person('niamh', 'Niamh Kelly', 'freelancer'),
    call('lights', 'gala', 'show', 5, 5, { role: 'LX tech', needed: 2 }),
    m('offer.send', { id: 'niamh-lights', callId: 'lights', personId: 'niamh', override: false }),
    m('offer.respond', { id: 'niamh-lights', answer: 'accept', days: null, note: '' }),
    call('launch', 'enq', 'launch', 20, 20, { project: 'Spring Launch', role: 'Stagehand', needed: 1 }),
    // A certificate running out in twelve days.
    person('roisin', 'Róisín Farrell', 'freelancer', { certificates: { 'safe-pass': { held: true, expires: day(12), note: '' } } }),
    // Kit on the job that's over, never scanned out; kit on a job in nine days; more speakers on the gala's show than there are,
    // and on the enquiry, which would only be short if it went ahead.
    m('kit.add', { id: 'past-xlr', projectId: 'past', phaseId: null, modelId: 'xlr', qty: 5, subhireQty: 0, supplier: '', notes: '' }),
    m('project.create', { id: 'later', name: 'Winter Ball', clientId: null, venueId: null, status: 'confirmed', notes: '' }),
    m('phase.add', { id: 'ball', projectId: 'later', name: 'Show', start: day(9), end: day(9), venueId: null, notes: '' }),
    m('kit.add', { id: 'later-xlr', projectId: 'later', phaseId: null, modelId: 'xlr', qty: 4, subhireQty: 0, supplier: '', notes: '' }),
    m('kit.add', { id: 'more', projectId: 'gala', phaseId: 'show', modelId: 'y10p', qty: 3, subhireQty: 0, supplier: '', notes: '' }),
    m('kit.add', { id: 'enq-y10p', projectId: 'enq', phaseId: null, modelId: 'y10p', qty: 4, subhireQty: 0, supplier: '', notes: '' }),
    // Three cables damaged in one report, and not fit to go out, beside the speaker that is.
    m('fault.report', { id: 'f3', kind: 'damaged', assetId: null, modelId: 'xlr', qty: 3, projectId: null, usable: false, note: 'Pins bent', at: at(0) }),
    // One speaker failed its PAT; the other's is due in about ten days.
    m('inspection.record', { id: 'pat-a2', assetId: 'a2', kind: 'pat', passed: false, at: at(0), by: 'Cian Murphy', note: '' }),
    m('inspection.record', { id: 'pat-a1', assetId: 'a1', kind: 'pat', passed: true, at: at(-355), by: 'Cian Murphy', note: '' }),
    // A van whose test runs out in ten days.
    m('vehicle.save', { id: 'van2', name: 'Small Van', registration: '242-D-102', kind: 'van', seats: 3, payloadKg: 800, notes: '', checks: { ...checks, test: { needed: true, expires: day(10) } } }),
    // The gala's crew task was due yesterday.
    m('jobStep.set', { projectId: 'gala', step: 'crew', dueOn: day(-1) }),
    // An enquiry and a quote whose dates have passed with no answer.
    m('project.create', { id: 'old', name: 'Summer Party', clientId: null, venueId: null, status: 'enquiry', notes: '' }),
    m('phase.add', { id: 'party', projectId: 'old', name: 'Show', start: day(-5), end: day(-5), venueId: null, notes: '' }),
    m('project.create', { id: 'gone', name: 'Quay Awards', clientId: 'bw', venueId: null, status: 'quoted', notes: '' }),
    m('phase.add', { id: 'awards', projectId: 'gone', name: 'Show', start: day(-4), end: day(-4), venueId: null, notes: '' }),
    m('quote.save', { id: 'q2', projectId: 'gone', lines: [{ id: 'l2', kind: 'kit', what: 'XLR 10 m', ref: 'xlr', group: 'Audio', qty: 10, days: 1, unitCents: 500, vat: '23' }], discountPct: 0, notes: '' }),
    m('quote.sent', { id: 'q2', on: day(-12) })
  )
  const { client } = await phone(app)
  return client.view()
}

/** Ids, to compare lists by what's in them. */
const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id)

describe('how things stand', () => {
  it('has something in every list a count opens, each holding what it says and leaving out what it does not', async () => {
    const view = await everythingWaiting()
    const lists = standing(view, today)
    // No count is checked against nothing.
    const empty = (Object.keys(lists) as StandingKey[]).filter((k) => lists[k].length === 0)
    expect(empty).toEqual([])

    // Crew: Dara running late, Niamh's yes, the calls short in the fortnight (not those filled, nor the launch in twenty days),
    // Dara's timesheet, Aoife's leave for Cian to decide, and Róisín's Safe Pass.
    expect(lists.late.map((l) => l.person?.name)).toEqual(['Dara Quinn'])
    expect(lists.answers).toHaveLength(1)
    expect(lists.answers.map((a) => ('offer' in a ? a.offer.id : undefined))).toEqual(['niamh-lights'])
    expect(ids(lists['crew-needed']).sort()).toEqual(['lights', 'sound'])
    expect(lists.timesheets.map((r) => r.offer.id)).toEqual(['dara-then'])
    expect(standing(view, today, { me: { id: 'cian' } }).leave.map((q) => q.person?.id)).toEqual(['aoife'])
    // Her own request is another approver's to decide (audit, 5 November 2026, finding 28).
    expect(standing(view, today, { me: { id: 'aoife' } }).leave).toEqual([])
    expect(lists.certificates.map((r) => r.person.name)).toEqual(['Róisín Farrell'])

    // Stock: the gala, going out today, to pick; the Winter Ball, in nine days, is in the fortnight's pick lists and not to pick yet.
    expect(lists['to-pick'].map((p) => p.job.id)).toEqual(['gala'])
    expect(view.moves.soon.map((p) => p.job.id)).toEqual(['gala', 'later'])
    expect(lists['still-out'].map((k) => [k.job.id, k.said])).toEqual([['past', "5 never scanned out: check they're back"]])
    // Short for the confirmed gala in the fortnight; the enquiry's line is short only if it goes ahead, under the rest on Stock.
    expect(lists['kit-short'].every((l) => l.projectId === 'gala')).toBe(true)
    expect(view.kit.short.filter((l) => !lists['kit-short'].includes(l)).map((l) => l.id)).toEqual(['enq-y10p'])
    // Every repair open, and of them the one that stops kit going out: a report of three cables is one repair, as its row is.
    expect(ids(lists.faults).sort()).toEqual(['f1', 'f3'])
    expect(lists['damaged-stopped'].map((f) => [f.id, f.qty])).toEqual([['f3', 3]])
    expect(lists['cant-go'].map((d) => [d.asset.id, d.state])).toEqual([['a2', 'failed']])
    expect(lists['tests-soon'].map((d) => [d.asset.id, d.state])).toEqual([['a1', 'soon']])
    expect(lists.vehicles.map((r) => [r.vehicle.id, r.kind])).toEqual([['van2', 'test']])
    expect(lists.counts.length).toBeGreaterThan(0)

    // Jobs: the gala's crew task late; the Winter Ball being planned with its next task down to nobody; the enquiry and the
    // quote whose dates passed, the most recent first.
    expect(lists['tasks-late'].map((s) => s.job.id)).toEqual(['gala'])
    expect(lists['tasks-nobody'].map((s) => s.job.id)).toEqual(['later'])
    expect(lists['no-answer'].map((s) => s.job.id)).toEqual(['gone', 'old'])
  })

  it('is the list the screen it opens shows, where that screen reads a rule of its own', async () => {
    const view = await everythingWaiting()
    const lists = standing(view, today)
    // The Jobs list, coming up, on the filters the count opens it with (audit, 5 November 2026, finding 20).
    const coming = view.jobs.jobs.filter((j) => !STOPPED.includes(j.status) && !(j.span && j.span.end < today))
    const filters = jobFilters(() => false, false, (j) => view.steps.of(j.id))
    const jobsList = (chosen: Record<string, string>) => listed(coming, filters, jobSorts(false), { sort: 'date', filters: chosen }).map((j) => j.id)
    expect(lists['tasks-late'].map((s) => s.job.id).sort()).toEqual(jobsList({ tasks: 'late' }).sort())
    expect(lists['tasks-nobody'].map((s) => s.job.id).sort()).toEqual(jobsList({ stage: 'planning', tasks: 'nobody' }).sort())
    // Quotes' "Dates passed with no answer" is the quotes sent among them, the Board's fold all of them.
    const passed = quotesToFollow(view.money, today).passed.map((q) => q.job.id)
    expect(passed).toEqual(['gone'])
    for (const id of passed) expect(lists['no-answer'].map((s) => s.job.id)).toContain(id)
    // Answers to check heads the answers and says who's running late after them, each a count Home shows.
    expect(answersHeading(lists.answers.length, lists.late.length)).toBe('Answers to check (1) · 1 running late')
  })

  it("narrows a department's lists to its people and its kit, and leaves out the jobs' own", async () => {
    const view = await everythingWaiting()
    const audio = standing(view, today, { department: 'Audio' })
    const lx = standing(view, today, { department: 'LX' })
    // The cables and speakers are Audio's kit, so its repairs, tests and kit short are Audio's and none of LX's.
    expect(ids(audio.faults).sort()).toEqual(['f1', 'f3'])
    expect([lx.faults.length, lx['cant-go'].length, lx['tests-soon'].length, lx['kit-short'].length]).toEqual([0, 0, 0, 0])
    // Kit still out, tasks and dates passed are the job's, not a department's.
    for (const d of [audio, lx]) expect([d['still-out'].length, d['tasks-late'].length, d['tasks-nobody'].length, d['no-answer'].length]).toEqual([0, 0, 0, 0])
  })
})
