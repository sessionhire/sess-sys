import { expect, test, type APIRequestContext } from '@playwright/test'
import { dayLabel } from '../shared/src/crew-days.ts'

/**
 * The answers the office settles (ADR 0152; audit of 12 November 2026, findings 3 and 9, question 6): on the job's own call
 * rows, as on Crew's Answers to check. A yes has Confirm and Release; a rate asked for has Agree, Say no and Withdraw. Saying
 * no keeps the offer open at the rate offered, which the person's link says. A Yes in Google Calendar to one day is confirmed
 * for that day, said before the press. While the job is still a quote, Next says there are answers to check beside it.
 */

const phoneSize = { width: 390, height: 844 }

async function push(request: APIRequestContext, clientId: string, mutations: [string, Record<string, unknown>][]) {
  const createdAt = new Date().toISOString()
  const res = await request.post('/api/sync/push', { data: { clientId, mutations: mutations.map(([name, args], i) => ({ id: `${clientId}-${Date.now()}-${i}`, name, args, createdAt })) } })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

/** "Sun 13 Dec", as the office's rows write a day. */
const label = (d: string) => dayLabel(d)

test("the office answers a yes and a rate on the job's own rows, and saying no to a rate keeps the offer open", async ({ browser, request }) => {
  const run = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6).padEnd(6, 'x')
  const surname = `${run[0]!.toUpperCase()}${run.slice(1)}`
  const names = { conor: `Conor ${surname}`, niamh: `Niamh ${surname}`, dara: `Dara ${surname}`, aoife: `Aoife ${surname}` }
  const job = `Answers check ${run}`
  const day = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const next = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10)
  const ids = { job: `job-${run}`, show: `show-${run}`, call: `audio-${run}` }
  const freelancer = (who: keyof typeof names) => ['person.upsert', { id: `${who}-${run}`, name: names[who], kind: 'freelancer', email: `${who}.${run}@example.com`, phone: '+353 87 555 0143', skills: ['audio'], dayRateCents: 25000, notes: '' }] as [string, Record<string, unknown>]
  const offer = (who: keyof typeof names) => ['offer.send', { id: `${who}-o-${run}`, callId: ids.call, personId: `${who}-${run}`, override: false }] as [string, Record<string, unknown>]
  await push(request, `answers-${run}`, [
    // Messages to crew off, so a press says what the app sent by itself (ADR 0149).
    ['messages.prompt', { on: false }],
    freelancer('conor'),
    freelancer('niamh'),
    freelancer('dara'),
    freelancer('aoife'),
    // Still a quote: crew are asked to hold the day (ADR 0150), and Next leads with the quote.
    ['project.create', { id: ids.job, name: job, clientId: null, venueId: null, status: 'quoted', notes: '' }],
    ['phase.add', { id: ids.show, projectId: ids.job, name: 'Show', start: day, end: next, venueId: null, notes: '' }],
    ['call.create', { id: ids.call, projectId: ids.job, phaseId: ids.show, project: job, phase: 'Show', venue: '', role: 'Audio tech', start: day, end: next, callTime: '08:00', needed: 2, dayRateCents: 25000, details: '', replyBy: null }],
    offer('niamh'),
    ['offer.respond', { id: `niamh-o-${run}`, answer: 'accept', days: null, note: '' }],
    offer('conor'),
    ['offer.respond', { id: `conor-o-${run}`, answer: 'counter', counterRateCents: 30000, days: null, note: '' }],
    offer('dara'),
    ['offer.respond', { id: `dara-o-${run}`, answer: 'counter', counterRateCents: 32000, days: null, note: '' }],
    offer('aoife'),
    // As Google Calendar sends a Yes on the first day's invite alone: the second day is still asked.
    ['offer.respond', { id: `aoife-o-${run}`, answer: 'accept', days: [day], asked: [next], note: '' }],
  ])

  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto(`/#jobs/${ids.job}/crew`)
  await expect(office.getByRole('status')).toHaveText('Up to date')
  // Next leads with the quote, and says beside it that answers are waiting; its press opens the call's rows.
  const dock = office.getByRole('region', { name: 'Next' })
  await expect(dock.getByRole('button', { name: 'Make a quote' })).toBeVisible()
  await dock.getByRole('button', { name: '4 answers to check' }).click()
  const call = office.getByRole('article', { name: '2 × Audio tech' })
  const row = (who: keyof typeof names) => call.locator('.offers > li', { hasText: names[who] })
  await expect(row('niamh').getByRole('button', { name: 'Confirm', exact: true })).toBeVisible()
  await expect(row('niamh').getByRole('button', { name: 'Release' })).toBeVisible()
  await expect(row('conor').getByRole('button', { name: 'Agree €300' })).toBeVisible()
  await expect(row('dara').getByRole('button', { name: 'Agree €320' })).toBeVisible()

  // Say no to Conor's rate: asked first, and the offer stands at the rate offered.
  await row('conor').getByRole('button', { name: 'Say no' }).click()
  await expect(row('conor')).toContainText(`Say no to €300 a day for ${names.conor}? The offer stands at €250 a day, for Conor to take or turn down. Their link says so. Nothing is sent to them.`)
  await row('conor').getByRole('button', { name: 'Say no to the rate' }).click()
  const said = office.getByRole('region', { name: `Said no to ${names.conor}'s rate: what was sent` })
  await expect(said).toContainText('Nothing was sent to Conor: their link says the offer stands at the rate offered.')
  await expect(row('conor')).toContainText('Said no to €300 a day: the offer stands at €250 a day.')
  await expect(row('conor').getByRole('button', { name: 'Agree €300' })).toHaveCount(0)
  await said.getByRole('button', { name: 'Done' }).click()

  // Withdraw is its own choice, for an offer the office won't keep open.
  await row('dara').getByRole('button', { name: 'Withdraw' }).click()
  await expect(row('dara')).toContainText(`Withdraw the offer to ${names.dara}? Their link says it's withdrawn at once. Nothing is sent to them.`)
  await row('dara').getByRole('button', { name: 'Withdraw the offer' }).click()
  await office.getByRole('region', { name: `Offer to ${names.dara} withdrawn: what was sent` }).getByRole('button', { name: 'Done' }).click()

  // Aoife said yes to the first day in Google: Confirm books that day, and says so before the press.
  await row('aoife').getByRole('button', { name: `Confirm ${label(day)}` }).click()
  await expect(row('aoife')).toContainText(`Confirm ${names.aoife}? ${names.aoife} hasn't answered for ${label(next)}, so confirming books ${label(day)} only.`)
  await row('aoife').getByRole('button', { name: `Confirm ${label(day)}` }).click()
  await office.getByRole('region', { name: `${names.aoife} is booked: what was sent` }).getByRole('button', { name: 'Done' }).click()
  await expect(row('aoife').getByRole('button', { name: /^Confirm/ })).toHaveCount(0)
  await expect(office.getByRole('status')).toHaveText('Up to date')

  // Conor's link says the office can't do his rate and the offer stands; his yes is at the rate offered.
  const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; id: string; data: { linkToken: string } }[] }
  const link = `/f/${changes.filter((c) => c.entity === 'person' && c.id === `conor-${run}`).at(-1)!.data.linkToken}`
  const phone = await (await browser.newContext({ viewport: phoneSize, javaScriptEnabled: false })).newPage()
  await phone.goto(link)
  await expect(phone.getByText("The office can't do €300 a day, so the offer stands at €250 a day.")).toBeVisible()
  await phone.getByRole('button', { name: 'Accept these days' }).click()
  await expect(phone.getByText("Thanks, you're down for it.")).toBeVisible()
  await expect(phone.getByText("The office can't do")).toHaveCount(0)

  // The office sees his yes arrive on the same row, to confirm.
  await expect(row('conor').getByRole('button', { name: 'Confirm', exact: true })).toBeVisible()
  await expect(row('conor')).not.toContainText('Said no to')
})
