import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Asking for the same crew again (ADR 0164; audit of 12 November 2026, finding 19). A job cancelled takes its crew calls
 * with it; once it's set going again, its Crew tab says what was cancelled, when and who was on it, and one press brings
 * the calls back with the same people picked in Offer, ready to send. Nothing goes to anyone until Offer is pressed, and
 * here nothing would go at all (no addresses, invites and WhatsApp off).
 */

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `again-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `again-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

test('a job set going again asks for the same crew with one press of Next, and sends nothing until Offer', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const fergal = `Fergal Again${id}`
  const colm = `Colm Again${id}`
  const person = (key: string, name: string) => ['person.upsert', { id: `${key}-${id}`, name, kind: 'freelancer', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }] as [string, Record<string, unknown>]
  // Fergal booked and Colm offered the Rigger call for two, then the job cancelled and set going again.
  await push(request, id, [
    ['messages.prompt', { on: false }],
    person('a', fergal),
    person('b', colm),
    ['project.create', { id: `j-${id}`, name: `Harbour Lights ${id}`, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `p-${id}`, projectId: `j-${id}`, name: 'Show', start: '2030-12-11', end: '2030-12-11', venueId: null, notes: '' }],
    [
      'call.create',
      { id: `c-${id}`, projectId: `j-${id}`, phaseId: `p-${id}`, project: `Harbour Lights ${id}`, phase: 'Show', venue: '', role: 'Rigger', start: '2030-12-11', end: '2030-12-11', callTime: null, needed: 2, dayRateCents: null, details: '', replyBy: null },
    ],
    ['offer.send', { id: `oa-${id}`, callId: `c-${id}`, personId: `a-${id}`, override: false }],
    ['offer.respond', { id: `oa-${id}`, answer: 'accept', days: null, note: '' }],
    ['offer.confirm', { id: `oa-${id}` }],
    ['offer.send', { id: `ob-${id}`, callId: `c-${id}`, personId: `b-${id}`, override: false }],
    ['project.update', { id: `j-${id}`, status: 'cancelled' }],
    ['project.update', { id: `j-${id}`, status: 'confirmed' }],
  ])

  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`/#jobs/j-${id}/crew`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  // The Crew tab says what went with the job, when, and who was on it, first.
  const card = page.getByRole('region', { name: 'Cancelled with the job' })
  await expect(card.locator('p').first()).toHaveText(
    new RegExp(`^Its crew call was cancelled with the job on \\w{3} \\d{1,2} \\w{3}: 2 × Rigger\\. (${fergal} and ${colm}|${colm} and ${fergal}) were offered it or booked\\.$`)
  )
  await expect(card.locator('p.hint')).toHaveText('It comes back with nobody offered, and its Offer has the same people picked, ready to send. Nothing goes to anyone until you press Offer.')

  await expect(card.getByRole('button', { name: 'Ask for the same crew again' })).toBeVisible()

  // Next, the page's one filled button, does the same as the card's.
  const next = page.getByRole('region', { name: 'Next' })
  await next.getByRole('button', { name: 'Ask for the same crew again' }).click()
  // Back, with its Offer open and the two of them picked: nothing has gone to either, and Next sends it.
  const form = page.locator('form.offer-form')
  const offer = form.getByRole('button', { name: 'Offer to 2 people' })
  await expect(offer).toBeVisible()
  await expect(next.getByRole('button', { name: 'Offer to 2 people · 2 to offer' })).toBeVisible()
  await expect(card).toHaveCount(0)
  const call = page.getByRole('article', { name: '2 × Rigger' })
  await expect(call).not.toContainText('(offered)')
  await expect(call).not.toContainText('(booked)')
  await expect(page.getByRole('status')).toHaveText('Up to date')

  await offer.click()
  await expect(call).toContainText(`${colm} (offered), ${fergal} (offered)`)
  await expect(page.getByRole('region', { name: 'Offered to 2 people: what was sent' })).toContainText('Nothing was sent to Colm and Fergal: calendar invites and WhatsApp are both off.')
  // Their offers from before the job was cancelled read as what happened to them, not as withdrawn by the office.
  await call.locator('button.call-line').click()
  await expect(call.locator('ul.offers li').filter({ hasText: 'Cancelled with the job' })).toHaveCount(2)
  await expect(call.locator('ul.offers')).not.toContainText('Withdrawn')
})
