import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * The departments row end to end (ADR 0137): Audio, Lighting, Video, Lasers
 * and Staging narrow the calendar, the Jobs list, the planner's job rows and
 * the Board to the jobs involving them, by their crew calls or their kit;
 * several at once keep a job with any of them; and the choice holds from one
 * view to the next. Made in April 2034, a month no other browser test uses.
 * SHOTS=1 saves screenshots for the PR in test-results/departments.
 */

const id = Math.random().toString(36).slice(2, 8)
const k = (key: string) => `${key}-${id}`
const named = (name: string) => `${name} ${id}`
type M = [string, Record<string, unknown>]
const shot = (name: string) => (process.env.SHOTS ? { path: `test-results/departments/${name}.png` } : undefined)

async function seed(request: APIRequestContext) {
  const job = (key: string, name: string, status: string): M => ['project.create', { id: k(key), name: named(name), clientId: null, venueId: null, status, notes: '' }]
  const phase = (key: string, of: string, start: string, end = start): M => ['phase.add', { id: k(`${key}-ph`), projectId: k(of), name: 'Show', start, end, venueId: null, notes: '' }]
  const call = (key: string, of: string, name: string, role: string, department: string | null, day: string): M => [
    'call.create',
    { id: k(`${key}-call`), projectId: k(of), phaseId: k(`${of}-ph`), project: named(name), phase: 'Show', venue: '', role, department, start: day, end: day, callTime: '09:00', needed: 1, dayRateCents: null, details: '', replyBy: null },
  ]
  const mutations: M[] = [
    ['model.create', { id: k('laser'), name: named('Kvant Clubmax'), department: 'lasers', category: 'Lasers', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }],
    job('lx', 'Arena LX', 'confirmed'),
    phase('lx', 'lx', '2034-04-11', '2034-04-12'),
    call('lx', 'lx', 'Arena LX', 'LX op', 'LX', '2034-04-11'),
    job('laser', 'Laser show', 'quoted'),
    phase('laser', 'laser', '2034-04-12'),
    ['kit.add', { id: k('kit'), projectId: k('laser'), phaseId: null, modelId: k('laser'), qty: 2, subhireQty: 0, supplier: '', notes: '' }],
    job('sound', 'Sound only', 'confirmed'),
    phase('sound', 'sound', '2034-04-12'),
    // No department given: the role's words say Audio.
    call('sound', 'sound', 'Sound only', 'Sound No.1', null, '2034-04-12'),
  ]
  const res = await request.post('/api/sync/push', {
    data: { clientId: `dept-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `${k('m')}-${i}`, name, args, createdAt: new Date().toISOString() })) },
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

const row = (page: Page) => page.getByRole('group', { name: 'Departments' })

test('the calendar shows only the jobs involving the departments picked, and the choice holds on the Jobs list and the Board', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await ready(page, '#jobs/calendar/2034-04-01')
  const cal = page.locator('.cal-grid')
  await expect(cal.getByText(named('Arena LX'))).toHaveCount(1)
  await expect(cal.getByText(named('Sound only'))).toHaveCount(1)
  await expect(row(page).getByRole('button', { name: 'All departments' })).toHaveAttribute('aria-pressed', 'true')

  // Lighting: the LX call's job, nothing else.
  await row(page).getByRole('button', { name: 'Lighting' }).click()
  await expect(row(page).getByRole('button', { name: 'Lighting' })).toHaveAttribute('aria-pressed', 'true')
  await expect(row(page).getByRole('button', { name: 'All departments' })).toHaveAttribute('aria-pressed', 'false')
  await expect(cal.getByText(named('Sound only'))).toHaveCount(0)
  await expect(cal.getByText(named('Laser show'))).toHaveCount(0)
  await expect(cal.getByText(named('Arena LX')).first()).toBeVisible()
  await expect(page.getByText(/, with Lighting\.$/)).toBeVisible()

  // Lasers too: the job with lasers kit joins it.
  await row(page).getByRole('button', { name: 'Lasers' }).click()
  await expect(cal.getByText(named('Laser show'))).toHaveCount(1)
  await expect(cal.getByText(named('Sound only'))).toHaveCount(0)
  await page.screenshot(shot('calendar-desk'))

  // The Jobs list holds the same choice, and counts each department.
  await page.goto('/#jobs')
  // There the departments are pills in the filter panel (Colly, 10 November 2026), and each one picked is a chip under it.
  await expect(page.getByRole('button', { name: 'Take off the filter Lasers' })).toBeVisible()
  await page.getByRole('button', { name: /^Filter/ }).click()
  await expect(row(page).getByRole('button', { name: /^Lasers/ })).toHaveAttribute('aria-pressed', 'true')
  const find = page.getByLabel('Find', { exact: true })
  await find.fill(id)
  await expect(row(page).getByRole('button', { name: 'Audio (1)' })).toBeVisible()
  await expect(page.locator('.job-list').getByText(named('Arena LX'))).toBeVisible()
  await expect(page.locator('.job-list').getByText(named('Laser show'))).toBeVisible()
  await expect(page.locator('.job-list').getByText(named('Sound only'))).toHaveCount(0)

  // Audio alone: the role's words put the sound job in it.
  await row(page).getByRole('button', { name: /^Lighting/ }).click()
  await row(page).getByRole('button', { name: /^Lasers/ }).click()
  await row(page).getByRole('button', { name: /^Audio/ }).click()
  await expect(page.locator('.job-list').getByText(named('Sound only'))).toBeVisible()
  await expect(page.locator('.job-list').getByText(named('Arena LX'))).toHaveCount(0)

  // Video: nothing here has any, and it says so.
  await row(page).getByRole('button', { name: /^Audio/ }).click()
  await row(page).getByRole('button', { name: /^Video/ }).click()
  await expect(page.getByText('No job here involves Video.')).toBeVisible()

  // All departments clears it everywhere.
  await row(page).getByRole('button', { name: 'All departments' }).click()
  await page.goto('/#jobs/board')
  await expect(row(page).getByRole('button', { name: 'All departments' })).toHaveAttribute('aria-pressed', 'true')
})

test('the planner narrows its job rows, and a phone keeps the row in the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page, '#plan/week/2034-04-10')
  const table = page.locator('.scroller table.timeline')
  await expect(table.getByText(named('Sound only'))).toBeVisible()
  await row(page).getByRole('button', { name: 'Lighting' }).click()
  await expect(table.getByText(named('Sound only'))).toHaveCount(0)
  await expect(table.getByText(named('Arena LX'))).toBeVisible()
  await page.screenshot(shot('planner-phone'))

  await page.goto('/#jobs/calendar/2034-04-01')
  await expect(row(page).getByRole('button', { name: 'Lighting' })).toHaveAttribute('aria-pressed', 'true')
  const list = page.locator('.cal-days')
  await expect(list.getByText(named('Arena LX')).first()).toBeVisible()
  await expect(list.getByText(named('Sound only'))).toHaveCount(0)
  // The row wraps rather than scrolling sideways: nothing wider than the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot(shot('calendar-phone'))
  await row(page).getByRole('button', { name: 'All departments' }).click()
})

test("on a phone every department button's words fit inside it, on Jobs, the calendar, the week and the Board", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    for (const hash of ['#jobs', '#jobs/calendar/2034-04-01', '#plan/week/2034-04-10', '#jobs/board']) {
      await ready(page, hash)
      await expect(row(page).getByRole('button', { name: 'All departments' })).toBeVisible()
      // Smaller than the page's other buttons, and none cut: each button's words are no wider than the button.
      const cut = await row(page).getByRole('button').evaluateAll((buttons) => buttons.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent))
      expect(cut, `${hash} at ${width}px`).toEqual([])
      const size = await row(page).getByRole('button', { name: 'All departments' }).evaluate((b) => parseFloat(getComputedStyle(b).fontSize))
      expect(size).toBeLessThan(16)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${hash} at ${width}px`).toBeLessThanOrEqual(width)
    }
  }
  await page.screenshot(shot('jobs-phone-320'))
})
