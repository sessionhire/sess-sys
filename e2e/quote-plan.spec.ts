import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * The quote is the job's plan (ADR 0126; audit of the quote flow, 8 November 2026, findings 4, 8 and 9): a line's days
 * are the days the job works, not the week between its build and its show; the draft's kit is on the job's kit list,
 * pencilled, so another quote for the same days sees it; and the quote's crew become the job's calls in one press.
 */

const phoneSize = { width: 390, height: 844 }

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `quote-plan-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `quote-plan-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

async function ready(page: Page, hash: string) {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

const dayFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

test("a draft's kit is pencilled on its job for other quotes to see, its days are the days worked, and its crew become calls", async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const build = dayFromNow(20)
  const show = dayFromNow(27)
  const bulk = { department: 'audio', category: 'Sound', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }
  await push(request, id, [
    ['model.create', { id: `mic-${id}`, name: `Shure SM58 ${id}`, ...bulk }],
    ['price.product', { modelId: `mic-${id}`, dayCents: 1_000 }],
    ['project.create', { id: `job-${id}`, name: `Launch ${id}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `build-${id}`, projectId: `job-${id}`, name: 'Build', start: build, end: build, venueId: null, notes: '' }],
    ['phase.add', { id: `show-${id}`, projectId: `job-${id}`, name: 'Show', start: show, end: show, venueId: null, notes: '' }],
    ['quote.save', { id: `q-${id}`, projectId: `job-${id}`, lines: [], discountPct: 0, notes: '' }],
    ['project.create', { id: `rival-${id}`, name: `Rival ${id}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `rival-show-${id}`, projectId: `rival-${id}`, name: 'Show', start: show, end: show, venueId: null, notes: '' }],
    ['quote.save', { id: `rq-${id}`, projectId: `rival-${id}`, lines: [], discountPct: 0, notes: '' }],
  ])

  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office, `#jobs/job-${id}/quote`)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })

  // Kit and crew are charged for the build and the show, two days, not the eight from the first to the last.
  await draft.getByRole('button', { name: 'Add kit' }).click()
  await office.keyboard.type(`4 SM58 ${id}`)
  await office.keyboard.press('Enter')
  await draft.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(draft.getByRole('button', { name: new RegExp(`Shure SM58 ${id}, change it$`) })).toContainText('2 days')
  await draft.getByRole('button', { name: 'Add crew' }).click()
  await draft.getByLabel('How many').fill('2')
  await draft.getByLabel('Crew role to add').fill('Rigger')
  await draft.getByLabel('Crew role to add').press('Enter')
  await draft.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(draft.getByRole('button', { name: /Rigger, change it$/ })).toContainText('2 days')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // The kit is on the job's kit list already, with nothing left to add from the quote.
  await ready(office, `#jobs/job-${id}/kit`)
  await expect(office.getByRole('region', { name: 'Kit' })).toContainText(`Shure SM58 ${id}`)
  await expect(office.getByRole('group', { name: 'Kit on the quote' })).toHaveCount(0)

  // A quote for another job on the show's day sees the four pencilled in.
  await ready(office, `#jobs/rival-${id}/quote`)
  const rival = office.getByRole('form', { name: 'Version 1, a draft' })
  await rival.getByRole('button', { name: 'Add kit' }).click()
  await office.keyboard.type(`SM58 ${id}`)
  await expect(rival.getByRole('option', { name: new RegExp(`Shure SM58 ${id}`) })).toContainText('4 pencilled for other quotes')
  await office.keyboard.press('Escape')

  // The quote's crew are made the job's calls in one press, and then there's nothing more to make.
  await ready(office, `#jobs/job-${id}/crew`)
  const fromQuote = office.getByRole('group', { name: 'Crew on the quote' })
  await expect(fromQuote).toContainText('2 × Rigger')
  await fromQuote.getByRole('button', { name: 'Make call' }).click()
  await expect(fromQuote).toHaveCount(0)
  await expect(office.locator('main')).toContainText('Rigger')

  // Taking the kit off the draft takes it off the job's list, since the quote put it there.
  await ready(office, `#jobs/job-${id}/quote`)
  await draft.getByRole('button', { name: new RegExp(`Shure SM58 ${id}, change it$`) }).click()
  await draft.getByRole('button', { name: /^Remove/ }).first().click()
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  await ready(office, `#jobs/job-${id}/kit`)
  await expect(office.getByRole('region', { name: 'Kit' })).not.toContainText(`Shure SM58 ${id}`)
})
