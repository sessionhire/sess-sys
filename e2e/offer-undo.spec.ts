import { expect, test, type APIRequestContext } from '@playwright/test'
import { pickRecord } from './names.ts'

/**
 * Undo just after Offer (ADR 0161; audit of 12 November 2026, finding 13). Nothing of the app's goes to anyone for half a
 * minute after Offer, so a wrong pick is taken back with nobody sent an invite, a WhatsApp or a cancellation. The panel
 * after the press says when it goes and offers Undo till then; after Undo, that nothing went. Here nothing would go at
 * all (no addresses, invites and WhatsApp off), so the line says it can be undone, and for how long.
 */

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `undo-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `undo-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

/** A confirmed job with one call for one person, and two people to offer it to. */
async function job(request: APIRequestContext) {
  const id = Date.now().toString(36)
  const people = { fergal: `Fergal Undo${id}`, colm: `Colm Undo${id}` }
  await push(request, id, [
    ['messages.prompt', { on: false }],
    ['person.upsert', { id: `a-${id}`, name: people.fergal, kind: 'freelancer', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }],
    ['person.upsert', { id: `b-${id}`, name: people.colm, kind: 'freelancer', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }],
    ['project.create', { id: `j-${id}`, name: `Harbour Lights ${id}`, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `p-${id}`, projectId: `j-${id}`, name: 'Show', start: '2030-12-11', end: '2030-12-11', venueId: null, notes: '' }],
    [
      'call.create',
      { id: `c-${id}`, projectId: `j-${id}`, phaseId: `p-${id}`, project: `Harbour Lights ${id}`, phase: 'Show', venue: '', role: 'Rigger', start: '2030-12-11', end: '2030-12-11', callTime: null, needed: 1, dayRateCents: null, details: '', replyBy: null },
    ],
  ])
  return { id, people }
}

test('Undo takes back offers just made, with nothing sent to anyone', async ({ browser, request }) => {
  const { id, people } = await job(request)
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`/#jobs/j-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('region', { name: 'Next' }).getByRole('button', { name: 'Offer the Rigger · 0 of 1 offered' }).click()
  const form = page.locator('form.offer-form')
  await pickRecord(form, 'Offer to', people.fergal)
  await pickRecord(form, 'Offer to', people.colm)
  await form.getByRole('button', { name: 'Offer to 2 people' }).click()
  const call = page.getByRole('article', { name: '1 × Rigger' })
  await expect(call).toContainText(`${people.colm} (offered), ${people.fergal} (offered)`)
  // The panel says what the press did, and that it can be taken back for half a minute, the seconds counting down.
  const sent = page.getByRole('region', { name: 'Offered to 2 people: what was sent' })
  await expect(sent.locator('.offer-wait p')).toHaveText(/^They can be undone for (30|2\d) seconds\.$/)
  await expect(sent).toContainText('Nothing was sent to Fergal and Colm: calendar invites and WhatsApp are both off.')
  await sent.getByRole('button', { name: 'Undo' }).click()
  // Undone: nobody was sent anything, and the offers are gone from the call and from their pages.
  const undone = page.getByRole('region', { name: 'Undone' })
  await expect(undone).toContainText(`${people.fergal} and ${people.colm} weren't offered it after all: the app sent them nothing, and it's off their pages.`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(call).not.toContainText('(offered)')
  await expect(page.getByRole('region', { name: 'Next' }).getByRole('button', { name: 'Offer the Rigger · 0 of 1 offered' })).toBeVisible()
  await undone.getByRole('button', { name: 'Done' }).click()
  await expect(undone).toHaveCount(0)
})

test('Undo goes once the wait is over, and the focus with it stays on the panel', async ({ browser, request }) => {
  const { id, people } = await job(request)
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  // The phone's clock, so half a minute can pass without waiting for it.
  await page.clock.install()
  await page.goto(`/#jobs/j-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('region', { name: 'Next' }).getByRole('button', { name: 'Offer the Rigger · 0 of 1 offered' }).click()
  const form = page.locator('form.offer-form')
  await pickRecord(form, 'Offer to', people.fergal)
  await form.getByRole('button', { name: `Offer to ${people.fergal}` }).click()
  const sent = page.getByRole('region', { name: `Offered to ${people.fergal}: what was sent` })
  await expect(sent.locator('.offer-wait p')).toHaveText('It can be undone for 30 seconds.')
  await page.clock.fastForward(10_000)
  await expect(sent.locator('.offer-wait p')).toHaveText('It can be undone for 20 seconds.')
  const undo = sent.getByRole('button', { name: 'Undo' })
  await undo.focus()
  await page.clock.fastForward(21_000)
  await expect(undo).toHaveCount(0)
  await expect(sent.locator('.offer-wait')).toHaveCount(0)
  await expect(sent).toBeFocused()
  // The offer stands: withdrawing it is the way now.
  await expect(page.getByRole('article', { name: '1 × Rigger' })).toContainText(`${people.fergal} (offered)`)
})
