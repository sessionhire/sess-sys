import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Jobs › Calendar end to end (ADR 0123): the master calendar, a month with
 * confirmed jobs and enquiries and quotes together, told apart, on a laptop
 * as a grid and on a phone as a list that adds to the page. Made in March
 * 2033, a month no other browser test uses, since the test server is shared.
 * SHOTS=1 refreshes its blueprint screenshots.
 */

const shot = (name: string) => (process.env.SHOTS ? { path: `docs/hub/img/${name}.png` } : undefined)
const id = Math.random().toString(36).slice(2, 8)
const named = (name: string) => (process.env.SHOTS ? name : `${name} ${id}`)
const k = (key: string) => `${key}-${id}`
type M = [string, Record<string, unknown>]

async function seed(request: APIRequestContext) {
  const job = (key: string, name: string, status: string): M => ['project.create', { id: k(key), name: named(name), clientId: null, venueId: null, status, notes: '' }]
  const phase = (key: string, of: string, name: string, start: string, end = start): M => [
    'phase.add',
    { id: k(key), projectId: k(of), name, start, end, venueId: null, notes: '' },
  ]
  const mutations: M[] = [
    job('arena', 'Arena tour', 'confirmed'),
    phase('arena-build', 'arena', 'Build', '2033-03-07', '2033-03-08'),
    phase('arena-show', 'arena', 'Show', '2033-03-09'),
    job('launch', 'Brand launch', 'quoted'),
    phase('launch-show', 'launch', 'Show', '2033-03-09'),
    ['quote.save', { id: k('q'), projectId: k('launch'), lines: [{ id: k('l'), kind: 'other', what: 'PA system', ref: null, group: 'Other', qty: 1, days: 1, unitCents: 50000, vat: '23' }], discountPct: 0, notes: '' }],
    ['quote.sent', { id: k('q'), on: '2033-02-01' }],
    job('conf', 'Medical conference', 'enquiry'),
    phase('conf-show', 'conf', 'Show', '2033-03-24', '2033-03-25'),
    job('gone', 'Gala that fell through', 'lost'),
    phase('gone-show', 'gone', 'Show', '2033-03-09'),
    job('undated', 'Wedding, dates to come', 'enquiry'),
  ]
  const res = await request.post('/api/sync/push', {
    data: { clientId: `cal-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `${k('m')}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = await res.json()
  expect(results.map((r: { status: string; reason?: { message: string } }) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext()
  await seed(context.request)
  await context.close()
})

async function ready(page: Page, hash: string) {
  await page.goto(`/${hash}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
}

const day = (page: Page, n: number) => page.locator('.cal-day:not(.out)').nth(n - 1)

test('a laptop sees the month as a grid, confirmed and potential together and told apart', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await ready(page, '#jobs/calendar/2033-03-01')
  await expect(page.getByRole('heading', { level: 1, name: 'March 2033' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Jobs pages' }).getByRole('link', { name: 'Calendar' })).toHaveAttribute('aria-current', 'page')

  // Google's shape: each job one bar over its days. The arena tour is one solid bar, Monday 7 to Wednesday 9; the quote dashed with
  // its word and where the quote is; the lost job not at all.
  const grid = page.locator('.cal-grid')
  const bar = (name: string) => grid.locator('.cal-span', { hasText: named(name) })
  await expect(bar('Arena tour')).toHaveCount(1)
  await expect(bar('Arena tour')).toHaveClass(/solid/)
  await expect(bar('Arena tour')).toContainText('Build, Show')
  await expect(bar('Arena tour')).toContainText('Mon 7 Mar to Wed 9 Mar')
  await expect(bar('Brand launch')).toHaveClass(/dashed/)
  await expect(bar('Brand launch')).toContainText('Quoted, quote sent · Show')
  await expect(bar('Gala that fell through')).toHaveCount(0)
  await expect(bar('Medical conference')).toHaveCount(1)
  await expect(bar('Medical conference')).toContainText('Thu 24 Mar to Fri 25 Mar')
  // The bars sit side by side in a week, never on top of each other: the quote is a line below the tour.
  const top = async (name: string) => (await bar(name).boundingBox())!.y
  expect(await top('Brand launch')).toBeGreaterThan(await top('Arena tour'))
  await expect(grid.locator('.cal-cell', { hasText: "St Patrick's Day" })).toHaveCount(1)
  await expect(page.locator('.cal-undated')).toContainText(named('Wedding, dates to come'))
  await page.screenshot(shot('master-calendar-desk'))

  // Only the confirmed: the address keeps it, the enquiries go, from the days and from the ones with no dates.
  await page.getByRole('group', { name: 'Which jobs' }).getByRole('button', { name: 'Confirmed' }).click()
  await expect(page).toHaveURL(/#jobs\/calendar\/2033-03-01\/confirmed$/)
  await expect(bar('Brand launch')).toHaveCount(0)
  await expect(bar('Arena tour')).toBeVisible()
  await expect(page.locator('.cal-undated', { hasText: named('Wedding, dates to come') })).toHaveCount(0)

  // Today and the arrows move by a month; a day opens its week on the planner; a job, its page.
  await page.getByRole('button', { name: 'Everything' }).click()
  await page.getByRole('link', { name: 'Next month' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'April 2033' })).toBeVisible()
  await page.getByRole('link', { name: 'Previous month' }).click()
  await grid.getByRole('link', { name: 'Thu 24 Mar', exact: true }).click()
  await expect(page).toHaveURL(/#jobs\/plan\/week\/2033-03-21$/)
  await page.goBack()
  await bar('Medical conference').click()
  await expect(page).toHaveURL(new RegExp(`#jobs/${k('conf')}$`))
})

test('a phone sees the days with something on as a list that adds to the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page, '#jobs/calendar/2033-03-01/potential')
  await expect(page.getByRole('heading', { level: 1, name: 'March 2033' })).toBeVisible()
  const shown = page.locator('.cal-day:visible')
  await expect(shown.filter({ hasText: named('Brand launch') })).toHaveCount(1)
  await expect(shown.filter({ hasText: named('Medical conference') })).toHaveCount(2)
  // A free day isn't drawn; a day says itself in full.
  await expect(day(page, 10)).toBeHidden()
  await expect(shown.filter({ hasText: named('Brand launch') }).locator('h3')).toContainText('Wed 9 Mar')
  // Nothing scrolls inside the page, and the page doesn't scroll sideways.
  expect(await page.evaluate(() => document.scrollingElement!.scrollWidth)).toBeLessThanOrEqual(390)
  expect(await page.locator('.cal-card').evaluate((el) => getComputedStyle(el).overflowY)).toBe('visible')
  await page.screenshot({ ...shot('master-calendar-phone'), fullPage: true })
})

test('an open quote in Current RMS with no job here is on the calendar as a potential, and opens its past quote', async ({ page }) => {
  // The server's copy of Current RMS comes from a real account, so its answer is stood in for, as in rms-history.spec.ts.
  let asked = ''
  await page.route('**/api/rms/calendar?*', (route) => {
    asked = new URL(route.request().url()).search
    return route.fulfill({ json: [{ id: 77, number: '0000001200', subject: 'Summer party', client: 'Acme Ltd', status: 'Provisional', start: '2033-03-15', end: '2033-03-16' }] })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await ready(page, '#jobs/calendar/2033-03-01')
  // Asked for the weeks shown: Monday 28 February to Sunday 3 April.
  await expect.poll(() => asked).toBe('?from=2033-02-28&to=2033-04-03')
  const quote = page.locator('.cal-grid .cal-span', { hasText: 'Summer party' })
  await expect(quote).toHaveCount(1)
  await expect(quote).toHaveClass(/dashed/)
  await expect(quote).toContainText('Current RMS quote 0000001200 · Acme Ltd')
  await expect(quote).toContainText('Tue 15 Mar to Wed 16 Mar')
  await expect(quote).toHaveAttribute('href', '#jobs/money/current-rms/77')
  await expect(page.locator('.cal-key')).toContainText('or a quote still open in Current RMS with no job here yet')
  // Confirmed only leaves it out, as it does the enquiries.
  await page.getByRole('group', { name: 'Which jobs' }).getByRole('button', { name: 'Confirmed' }).click()
  await expect(page.locator('.cal-grid .cal-span', { hasText: 'Summer party' })).toHaveCount(0)
})
