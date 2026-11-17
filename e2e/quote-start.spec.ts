import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Finding what to start from (ADR 0129; audit of the quote flow, 8 November 2026, findings 12 and 17): a package is
 * found in Add kit with the products, saying what it holds and costs; and New quote's one "Start from" finds this
 * app's past jobs and Current RMS's quotes, the client's last ones first. Current RMS's answers are stood in for, since
 * its copy comes from a real account.
 */

const phoneSize = { width: 390, height: 844 }

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `quote-start-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `quote-start-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

async function ready(page: Page, hash: string) {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

test('a package is found in Add kit, and New quote starts from a Current RMS quote found by the client', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const bulk = { department: 'audio', category: 'Sound', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }
  await push(request, id, [
    ['model.create', { id: `mic-${id}`, name: `Shure SM58 ${id}`, ...bulk }],
    ['model.create', { id: `di-${id}`, name: `DI box ${id}`, ...bulk }],
    ['price.product', { modelId: `mic-${id}`, dayCents: 1_000 }],
    ['package.save', { id: `pkg-${id}`, name: `Axient radio mics ${id}`, department: 'audio', dayCents: 9_000, rate: 'daily', items: [{ modelId: `mic-${id}`, qty: 4 }], notes: '' }],
    ['project.create', { id: `job-${id}`, name: `Launch ${id}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `ph-${id}`, projectId: `job-${id}`, name: 'Show', start: day(20), end: day(20), venueId: null, notes: '' }],
    ['quote.save', { id: `q-${id}`, projectId: `job-${id}`, lines: [], discountPct: 0, notes: '' }],
  ])
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()

  // Add kit finds the package by a word of its name, says what it holds and costs, and two of it is two packages' kit.
  await ready(office, `#jobs/job-${id}/quote`)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  await draft.getByRole('button', { name: 'Add kit', exact: true }).click()
  await office.keyboard.type(`2 axient ${id}`)
  const option = draft.getByRole('option', { name: new RegExp(`Axient radio mics ${id}`) })
  await expect(option).toContainText('Package')
  await expect(option).toContainText('€90.00 a day')
  await expect(option).toContainText(`holds 4 × Shure SM58 ${id}`)
  await office.keyboard.press('Enter')
  await draft.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(draft.getByRole('button', { name: new RegExp(`Axient radio mics ${id}, change it$`) })).toContainText('2 ×')
  await draft.getByRole('button', { name: /What’s in it/ }).first().click()
  await expect(draft.getByRole('button', { name: new RegExp(`Shure SM58 ${id}, change it$`) })).toContainText('8')

  // Current RMS's quotes, stood in for: the client's last ones, and one's lines.
  const asked: string[] = []
  await office.route('**/api/rms/opportunities?*', (route) => {
    asked.push(new URL(route.request().url()).searchParams.get('q') ?? '')
    return route.fulfill({
      json: {
        opportunities: [
          { id: 7, number: '1077', subject: 'Spring ball', client: `Harbour Events ${id}`, venue: 'The Round Room', state: 'Order', status: 'Completed', startsAt: '2026-04-01T10:00:00.000Z', endsAt: '2026-04-01T23:00:00.000Z', netCents: 120_000, grossCents: 147_600 },
        ],
        total: 1,
      },
    })
  })
  await office.route('**/api/rms/opportunities/7', (route) =>
    route.fulfill({
      json: {
        opportunity: { id: 7, number: '1077', subject: 'Spring ball', client: `Harbour Events ${id}`, venue: 'The Round Room', state: 'Order', status: 'Completed', startsAt: '2026-04-01T10:00:00.000Z', endsAt: '2026-04-01T23:00:00.000Z', netCents: 120_000 },
        lines: [
          { id: 1, opportunityId: 7, path: '0001', kind: 'Group', transaction: '', itemType: '', itemId: null, name: 'Audio', description: '', quantity: 0, priceCents: 0, discountPct: 0, chargeableDays: 1, rateDefinition: '', period: '', unitCents: 0, totalCents: 0, taxCents: 0 },
          { id: 2, opportunityId: 7, path: '00010001', kind: 'Principal', transaction: 'Rental', itemType: 'Product', itemId: 5, name: `Shure SM58 ${id}`, description: '', quantity: 6, priceCents: 1_200, discountPct: 0, chargeableDays: 1, rateDefinition: 'Daily Rate', period: 'Daily', unitCents: 1_200, totalCents: 7_200, taxCents: 1_656 },
        ],
        job: null,
      },
    })
  )
  await ready(office, '#quotes')
  await office.getByRole('link', { name: 'New quote' }).first().click()
  const form = office.getByRole('form', { name: 'New quote' })
  await form.getByLabel("What's the job?").fill(`Summer ball ${id}`)
  await form.getByRole('combobox', { name: 'Client' }).fill(`Harbour Events ${id}`)
  const start = form.getByRole('region', { name: 'Start from' })
  const ball = start.getByRole('list', { name: 'Current RMS quotes' }).getByRole('button', { name: /Spring ball/ })
  await expect(ball).toContainText('Current RMS 1077')
  expect(asked).toContain(`Harbour Events ${id}`)
  await ball.click()
  await expect(ball).toHaveAttribute('aria-pressed', 'true')
  const lines = form.getByRole('region', { name: 'Lines for the quote' })
  await expect(lines.getByRole('listitem').filter({ hasText: `Shure SM58 ${id}` })).toContainText('6 ×')

  // Typing finds by name, client or venue, across both.
  await start.getByRole('searchbox', { name: 'Find a past job or quote to start from' }).fill('round room')
  await expect.poll(() => asked.at(-1)).toBe('round room')
  await expect(start.getByRole('list', { name: 'Current RMS quotes' })).toContainText('Spring ball')
})
