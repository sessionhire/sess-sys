import { expect, test, type APIRequestContext } from '@playwright/test'
import { pickRecord } from './names.ts'

/**
 * A crew offer that wouldn't send (11 November 2026): on a phone the office picked two people in a call's Offer, then pressed the
 * page's one filled button, Next, which only opened the same form again, while the form's own Offer read as greyed out. With
 * people picked, Next now sends it to them; more people than places is said before it goes; and whatever stops it is said
 * beside the button.
 */

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `offer-next-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `offer-next-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

test("Next sends the offer to the people picked in it, across a job's phases", async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const job = `Winter Lights ${id}`
  const fergal = `Fergal Next${id}`
  const colm = `Colm Next${id}`
  await push(request, id, [
    ['messages.prompt', { on: false }],
    ['person.upsert', { id: `a-${id}`, name: fergal, kind: 'freelancer', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }],
    ['person.upsert', { id: `b-${id}`, name: colm, kind: 'staff', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }],
    ['project.create', { id: `j-${id}`, name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `p1-${id}`, projectId: `j-${id}`, name: 'Build', start: '2030-12-10', end: '2030-12-10', venueId: null, notes: '' }],
    ['phase.add', { id: `p2-${id}`, projectId: `j-${id}`, name: 'Show', start: '2030-12-11', end: '2030-12-12', venueId: null, notes: '' }],
    ['phase.add', { id: `p3-${id}`, projectId: `j-${id}`, name: 'Break', start: '2030-12-13', end: '2030-12-13', venueId: null, notes: '' }],
    [
      'call.create',
      { id: `c-${id}`, projectId: `j-${id}`, phaseId: null, project: job, phase: 'Build, Show, Break', venue: '', role: 'Audio - FOH', start: '2030-12-10', end: '2030-12-13', callTime: null, needed: 1, dayRateCents: null, details: '', replyBy: null },
    ],
  ])
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`/#jobs/j-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const next = page.getByRole('region', { name: 'Next' })
  await next.getByRole('button', { name: 'Offer the Audio - FOH · 0 of 1 offered' }).click()
  const form = page.locator('form.offer-form')
  await pickRecord(form, 'Offer to', fergal)
  await pickRecord(form, 'Offer to', colm)
  // Two for one place is allowed, and said before it goes.
  await expect(form).toContainText("2 offered for 1 place: whoever says yes first has it, and the rest are told it's filled.")
  // Next now names who it sends to, and sends it.
  await next.getByRole('button', { name: 'Offer to 2 people · 0 of 1 offered' }).click()
  // Made, with nothing sent while messages to crew are off (ADR 0048).
  await expect(page.getByRole('region', { name: /^Messages to crew are off/ })).toContainText('Nothing opened to send 2 people the offer.')
  await expect(page.getByRole('article', { name: '1 × Audio - FOH' })).toContainText(`${colm} (offered), ${fergal} (offered)`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  // Every place offered, Next waits on the answers.
  await expect(next).toContainText('Every place is offered: waiting on 2 answers.')
})
