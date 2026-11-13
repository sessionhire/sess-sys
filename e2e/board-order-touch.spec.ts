import { devices, expect, test, type CDPSession, type Page } from '@playwright/test'

/**
 * The Board's order on a phone (ADR 0143; Colly, 11 November 2026): a finger held still on a card for a moment picks it up
 * and drags it; a swipe across a card scrolls the page and moves nothing. The test server is shared, so names carry this
 * run's own tag. SHOTS=1 takes the picture for the PR.
 */

const { defaultBrowserType: _, ...iPhone } = devices['iPhone 13']
test.use(iPhone)

// One session for the whole test: a touch begun through one can only be moved and ended through the same one.
const sessions = new WeakMap<Page, CDPSession>()
async function touch(page: Page, steps: [type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number, wait?: number][]) {
  if (!sessions.has(page)) sessions.set(page, await page.context().newCDPSession(page))
  const cdp = sessions.get(page)!
  for (const [type, x, y, wait] of steps) {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
    if (wait) await page.waitForTimeout(wait)
  }
}

test('on a phone a card held a moment drags; a swipe only scrolls', async ({ page, request }) => {
  const tag = Date.now().toString(36)
  const at = () => new Date().toISOString()
  // A year of its own, so cards from other runs on the shared server don't sit between these three.
  const year = 2040 + Math.floor(Math.random() * 400)
  const mutations = (
    [
      ['Alpha', `${year}-03-04`],
      ['Bravo', `${year}-03-03`],
      ['Charlie', `${year}-03-02`],
    ] as const
  ).flatMap(([name, day], i) => [
    { id: `tt-${tag}-p${i}`, name: 'project.create', args: { id: `tt-${tag}-${i}`, name: `${name} ${tag}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }, createdAt: at() },
    { id: `tt-${tag}-d${i}`, name: 'phase.add', args: { id: `ttp-${tag}-${i}`, projectId: `tt-${tag}-${i}`, name: 'Show', start: day, end: day, venueId: null, notes: '' }, createdAt: at() },
  ])
  await request.post('/api/sync/push', { data: { clientId: `tt-${tag}`, mutations } })
  await page.goto('/#jobs/board')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await page.getByRole('button', { name: /^Filter/ }).click()
  await page.getByRole('button', { name: 'All coming up' }).click()
  const quoting = page.getByRole('region', { name: 'Quoting' })
  const mine = async () => (await quoting.locator('.board-card b').allTextContents()).filter((t) => t.includes(tag)).map((t) => t.split(' ')[0])
  await expect.poll(mine).toEqual(['Charlie', 'Bravo', 'Alpha'])

  await quoting.locator('.board-item', { hasText: `Bravo ${tag}` }).scrollIntoViewIfNeeded()
  const card = (n: string) => quoting.locator('.board-item', { hasText: `${n} ${tag}` }).boundingBox().then((b) => b!)
  // A swipe up across Bravo's card: the page scrolls, nothing is picked up, nothing opens.
  const bravo = await card('Bravo')
  const before = await page.evaluate(() => scrollY)
  await touch(page, [
    ['touchStart', bravo.x + 40, bravo.y + 40],
    ['touchMove', bravo.x + 40, bravo.y + 60],
    ['touchMove', bravo.x + 40, bravo.y + 100],
    ['touchMove', bravo.x + 40, bravo.y + 140],
    ['touchEnd', 0, 0],
  ])
  await expect(quoting.locator('.board-item[data-dragging]')).toHaveCount(0)
  expect(await page.evaluate(() => scrollY)).not.toBe(before)
  await expect(page).toHaveURL(/#jobs\/board$/)
  // Let the page come to rest, as a finger landing on a moving page only stops it.
  let last = -1
  await expect.poll(async () => { const y = await page.evaluate(() => scrollY); const still = y === last; last = y; return still }, { intervals: [250] }).toBe(true)
  await quoting.locator('.board-item', { hasText: `Bravo ${tag}` }).evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await expect.poll(async () => (await card('Alpha')).y + 40 < page.viewportSize()!.height).toBe(true)

  // Held still on Alpha's card, then dragged above Bravo: it lands there.
  const alpha = await card('Alpha')
  const bravo2 = await card('Bravo')
  const x = alpha.x + 40
  await touch(page, [['touchStart', x, alpha.y + 30, 500]])
  await expect(quoting.locator('.board-item[data-dragging]', { hasText: `Alpha ${tag}` })).toHaveCount(1)
  const moves: [type: 'touchMove', x: number, y: number][] = Array.from({ length: 8 }, (_, i) => ['touchMove', x, alpha.y + 30 + ((bravo2.y + 10 - alpha.y - 30) * (i + 1)) / 8])
  await touch(page, moves)
  await expect(quoting.locator('.board-item[data-shift="down"]', { hasText: `Bravo ${tag}` })).toHaveCount(1)
  if (process.env.SHOTS) await page.screenshot({ path: 'test-results/board-order/dragging-phone.png' })
  await touch(page, [['touchEnd', 0, 0]])
  await expect(page).toHaveURL(/#jobs\/board$/)
  await expect.poll(mine).toEqual(['Charlie', 'Alpha', 'Bravo'])
  await expect(page.locator('.conn')).toHaveText('Up to date')

  // Put back as it was, as the other Board tests share the column.
  await quoting.getByRole('button', { name: 'Sort by date' }).click()
  await expect.poll(mine).toEqual(['Charlie', 'Bravo', 'Alpha'])
  await expect(page.locator('.conn')).toHaveText('Up to date')
})
