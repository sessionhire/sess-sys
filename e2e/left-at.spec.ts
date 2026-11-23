import { expect, test, type Page } from '@playwright/test'

/**
 * Where each area was left (leftAt.ts, Colly 23 November 2026): Jobs seen as
 * Week stays Week coming back from a job, by the way up, the Jobs tab or the
 * breadcrumbs; the way up is Back when it goes to the screen just left, so
 * the list comes back at the same place; and the area's "Also here" pages
 * have a way up too. Uses the made-up data (ADR 0019), so it starts fresh
 * before and after: the other tests share this server.
 */

const phoneSize = { width: 390, height: 844 }
const deskSize = { width: 1280, height: 800 }
const fresh = { data: { confirm: 'delete everything' } }

test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
})

test.afterEach(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

/** The first link on the screen to a job's own page. */
const firstJob = (page: Page) => page.locator('main a[href^="#jobs/"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')!).find((h) => /^#jobs\/[a-z0-9]{15,}(\/[a-z]+)?$/.test(h)))

test('on a phone, back from a job opened from Week is Week, by the way up and by the Jobs tab', async ({ browser }) => {
  // Proves: the way up from a job and the Jobs tab go to the view Jobs was left on, not the list; the way up is Back, so the
  // week comes back where it was scrolled to; Clients, an "Also here" page, has a way up to the same week.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#jobs')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('navigation', { name: 'Jobs pages' }).getByRole('link', { name: 'Week' }).click()
  await expect(page).toHaveURL(/#jobs\/plan\/week\//)
  const week = new URL(page.url()).hash
  // Past the frames a new screen's place is held for (places.ts), then down the week.
  await page.waitForTimeout(500)
  await page.evaluate(() => scrollTo(0, 300))
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(300)
  await page.waitForTimeout(300)
  const job = await firstJob(page)
  expect(job).toBeTruthy()
  await page.evaluate((h) => (location.hash = h), job!)
  await expect(page).toHaveURL(new RegExp(`${job}$`))

  const up = page.locator('.top .up-link')
  await expect(up).toHaveText('‹ All jobs')
  await expect(up).toHaveAttribute('href', week)
  await up.click()
  await expect(page).toHaveURL(new RegExp(`${week.replace(/[/]/g, '\\/')}$`))
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBeGreaterThan(200)
  // Back was used, so Forward is the job again.
  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`${job}$`))

  const tab = page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Jobs' })
  await expect(tab).toHaveAttribute('href', week)
  await tab.click()
  await expect(page).toHaveURL(new RegExp(`${week.replace(/[/]/g, '\\/')}$`))

  await page.getByRole('navigation', { name: 'Jobs pages' }).getByRole('link', { name: 'Clients' }).click()
  await expect(page.locator('.top .up-link')).toHaveText('‹ All jobs')
  await expect(page.locator('.top .up-link')).toHaveAttribute('href', week)

  // List chosen again: back to the list from then on.
  await page.getByRole('navigation', { name: 'Jobs pages' }).getByRole('link', { name: 'List' }).click()
  await expect(tab).toHaveAttribute('href', '#jobs')
})

test('on a desk, the breadcrumbs go to the view Jobs was left on, and Stock as it was left', async ({ browser }) => {
  // Proves: the Jobs crumb over a job opened from Board is Board; Stock's Racks is kept for Stock's crumb from a product; Labels has a way up.
  const page = await (await browser.newContext({ viewport: deskSize })).newPage()
  await page.goto('/#jobs/board')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const job = await firstJob(page)
  await page.evaluate((h) => (location.hash = h), job!)
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(crumbs.getByRole('link', { name: 'Jobs' })).toHaveAttribute('href', '#jobs/board')

  await page.evaluate(() => (location.hash = '#stock/racks'))
  await expect(page.getByRole('heading', { level: 1, name: 'Racks' })).toBeVisible()
  await page.evaluate(() => (location.hash = '#stock/labels'))
  await expect(crumbs.getByRole('link', { name: 'Stock' })).toHaveAttribute('href', '#stock/racks')
  await expect(crumbs.getByText('Labels')).toBeVisible()
})
