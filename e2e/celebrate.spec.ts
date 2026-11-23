import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Sparks when a gig is settled (23 November 2026): a freelancer's yes on their own page plays a burst over the words that
 * say it went in, once (reloading doesn't play it again), and not at all where they've asked for less motion; a change
 * to the days of a yes already given plays nothing. The office's Confirm on someone's yes plays a small one. Neither
 * takes a press: the canvas is gone once the sparks have faded.
 */

const phoneSize = { width: 390, height: 844 }

async function push(request: APIRequestContext, clientId: string, mutations: [string, Record<string, unknown>][]) {
  const createdAt = new Date().toISOString()
  const res = await request.post('/api/sync/push', { data: { clientId, mutations: mutations.map(([name, args], i) => ({ id: `${clientId}-${Date.now()}-${i}`, name, args, createdAt })) } })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

test('a yes on the freelancer’s page plays sparks once, and the office’s Confirm plays a small burst', async ({ browser, request }) => {
  const run = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6).padEnd(6, 'x')
  const surname = `${run[0]!.toUpperCase()}${run.slice(1)}`
  const job = `Sparks check ${run}`
  const day = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10)
  const ids = { job: `job-${run}`, show: `show-${run}`, call: `lx-${run}` }
  const who = ['orla', 'fionn'] as const
  await push(request, `sparks-${run}`, [
    ['messages.prompt', { on: false }],
    ...who.map((w) => ['person.upsert', { id: `${w}-${run}`, name: `${w[0]!.toUpperCase()}${w.slice(1)} ${surname}`, kind: 'freelancer', email: `${w}.${run}@example.com`, phone: '+353 87 555 0143', skills: ['lighting'], dayRateCents: 25000, notes: '' }] as [string, Record<string, unknown>]),
    ['project.create', { id: ids.job, name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: ids.show, projectId: ids.job, name: 'Show', start: day, end: day, venueId: null, notes: '' }],
    ['call.create', { id: ids.call, projectId: ids.job, phaseId: ids.show, project: job, phase: 'Show', venue: '', role: 'Lighting tech', start: day, end: day, callTime: '08:00', needed: 2, dayRateCents: 25000, details: '', replyBy: null }],
    ...who.map((w) => ['offer.send', { id: `${w}-o-${run}`, callId: ids.call, personId: `${w}-${run}`, override: false }] as [string, Record<string, unknown>]),
  ])
  const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; id: string; data: { linkToken: string } }[] }
  const link = (w: (typeof who)[number]) => `/f/${changes.findLast((c) => c.entity === 'person' && c.id === `${w}-${run}`)!.data.linkToken}`
  const sparks = 'canvas[aria-hidden="true"]'

  // Orla says yes: the sparks play over the words, and the mark comes off the address.
  const phone = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await phone.goto(link('orla'))
  await phone.getByRole('article').filter({ hasText: job }).getByRole('button', { name: /^Accept/ }).click()
  await expect(phone.locator('.flash[data-celebrate]')).toHaveText("Thanks, you're down for it. The office will confirm.")
  await expect(phone.locator(sparks)).toHaveCount(1)
  await expect(phone).not.toHaveURL(/[?&]c=1/)
  // Nothing under it is held up: the canvas takes no presses, and it's gone once the sparks fade.
  await expect(phone.locator(sparks)).toHaveCSS('pointer-events', 'none')
  await expect(phone.locator(sparks)).toHaveCount(0, { timeout: 5000 })
  // Reloaded, the words stay and nothing plays again.
  await phone.reload()
  await expect(phone.getByText("Thanks, you're down for it. The office will confirm.")).toBeVisible()
  await phone.waitForTimeout(400)
  await expect(phone.locator(sparks)).toHaveCount(0)

  // Fionn has asked for less motion: the words, and no sparks.
  const calm = await (await browser.newContext({ viewport: phoneSize, reducedMotion: 'reduce' })).newPage()
  await calm.goto(link('fionn'))
  await calm.getByRole('article').filter({ hasText: job }).getByRole('button', { name: /^Accept/ }).click()
  await expect(calm.locator('.flash[data-celebrate]')).toBeVisible()
  await calm.waitForTimeout(400)
  await expect(calm.locator(sparks)).toHaveCount(0)

  // The office confirms Orla on the job's own row: a small burst where Confirm was pressed.
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto(`/#jobs/${ids.job}/crew`)
  await expect(office.getByRole('status')).toHaveText('Up to date')
  const row = office.getByRole('article', { name: '2 × Lighting tech' }).locator('.offers > li', { hasText: `Orla ${surname}` })
  await row.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(office.locator(sparks)).toHaveCount(1)
  await expect(office.locator(sparks)).toHaveCount(0, { timeout: 5000 })
})
