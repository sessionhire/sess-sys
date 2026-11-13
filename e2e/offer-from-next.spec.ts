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
    // Enough others that the picker's list, open again after each pick, reaches down over the dock on a phone.
    ...Array.from({ length: 8 }, (_, i): [string, Record<string, unknown>] => ['person.upsert', { id: `o${i}-${id}`, name: `Other${i} Next${id}`, kind: 'freelancer', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }]),
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
  await next.getByRole('button', { name: 'Offer the Audio - FOH · 1 to offer' }).click()
  const form = page.locator('form.offer-form')
  await pickRecord(form, 'Offer to', fergal)
  await pickRecord(form, 'Offer to', colm)
  // Two for one place is allowed, and said before it goes, with how whoever doesn't get it finds out (ADR 0149).
  await expect(form).toContainText("2 offered for 1 place: whoever says yes first has it. The rest see it's filled on their link; nothing else tells them.")
  // Picked is not offered, and the form says so above the one button that sends it, with what pressing sends by itself: here, nothing.
  await expect(form.locator('.offer-pending')).toHaveText(
    'Not offered yet. Pressing Offer to 2 people puts the offer on their pages. Nothing is sent: calendar invites, WhatsApp and messages to crew are all off.'
  )
  await expect(form.getByRole('button', { name: 'Offer to 2 people' })).toBeVisible()
  // Next now names who it sends to, and sends it.
  await next.getByRole('button', { name: 'Offer to 2 people · 1 to offer' }).click()
  // Made, and the panel says what the app sent by itself: nothing, to either. That no message opened (ADR 0048) is said last.
  const sent = page.getByRole('region', { name: 'Offered to 2 people: what was sent' })
  await expect(sent).toContainText('Nothing was sent to Fergal and Colm: calendar invites and WhatsApp are both off.')
  await expect(sent).toContainText('Their links show the offer, whenever they open them.')
  await expect(sent).toContainText('Messages to crew are off, so no message opened for you to send.')
  await expect(page.getByRole('article', { name: '1 × Audio - FOH' })).toContainText(`${colm} (offered), ${fergal} (offered)`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  // Every place offered, Next waits on the answers.
  await expect(next).toContainText('Every place is offered: waiting on 2 answers.')
})

test('what stops a crew form is said on its field, and listed by the button with a way to each', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const job = `Frost Fair ${id}`
  await push(request, id, [
    ['project.create', { id: `j-${id}`, name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `p-${id}`, projectId: `j-${id}`, name: 'Show', start: '2030-12-20', end: '2030-12-21', venueId: null, notes: '' }],
  ])
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`/#jobs/j-${id}/crew`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('button', { name: 'Add a role' }).first().click()
  const ask = page.getByRole('form', { name: 'Add a role' })
  // Spaces alone get past the browser's own check; a rate it can't read is said on the rate.
  await ask.getByLabel('Role').fill('   ')
  await ask.getByRole('button', { name: 'Add role' }).click()
  const role = ask.getByLabel('Role')
  await expect(role).toHaveAttribute('aria-invalid', 'true')
  await expect(role).toBeFocused()
  const summary = ask.getByRole('group', { name: 'To sort first' })
  await expect(summary).toContainText('One thing to sort before “Add role”:')
  await expect(summary.getByRole('button', { name: 'Fill in the role first.' })).toBeVisible()
  // Typing in it puts it right: the line and the summary go.
  await role.fill('Rigger')
  await expect(role).not.toHaveAttribute('aria-invalid')
  await expect(summary).toHaveCount(0)
  await ask.getByLabel('Day rate €').fill('two fifty')
  await ask.getByRole('button', { name: 'Add role' }).click()
  const rate = ask.getByLabel('Day rate €')
  await expect(rate).toHaveAttribute('aria-invalid', 'true')
  await expect(ask.getByRole('alert')).toHaveText('Put in a price like 250 or 1,250.50.')
  // The summary's line takes the focus back to its field from wherever the page has gone.
  await page.getByRole('combobox').first().focus().catch(() => {})
  await summary.getByRole('button', { name: 'Day rate: Put in a price like 250 or 1,250.50.' }).click()
  await expect(rate).toBeFocused()
  await rate.fill('250')
  await ask.getByRole('button', { name: 'Add role' }).click()
  await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('Added 1 × Rigger')

  // With nobody picked there's nothing to press: picking is the step, and the button that offers comes with the person it names.
  const call = page.getByRole('article', { name: '1 × Rigger' })
  await call.getByRole('button', { name: '1 × Rigger' }).click()
  await call.getByRole('button', { name: 'Offer…' }).click()
  await expect(call.getByRole('combobox', { name: 'Offer to' })).toBeVisible()
  await expect(call.getByRole('button', { name: /^Offer( to|$)/ })).toHaveCount(0)
})
