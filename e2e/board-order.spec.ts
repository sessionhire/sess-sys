import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * The Board's order (ADR 0143): the office puts a column's cards in the order that matters, by dragging a card's Move
 * button, by the keyboard, or by pressing Move and then where it goes. The cards nobody has put in order go soonest
 * first, under them; dropping a card puts it and the cards above it in order; Back to date order undoes it. The order is
 * kept by the server, so it's the same after a reload. The test server is shared, so names carry this run's own tag.
 * SHOTS=1 takes the pictures for the PR.
 */

const shot = (name: string) => (process.env.SHOTS ? { path: `test-results/board-order/${name}.png` } : undefined)

async function mine(column: Locator, tag: string) {
  return (await column.locator('.board-card b').allTextContents()).filter((t) => t.includes(tag)).map((t) => t.split(' ')[0])
}

async function board(page: Page) {
  await page.goto('/#jobs/board')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await page.getByRole('button', { name: /^Filter/ }).click()
  await page.getByRole('button', { name: 'All coming up' }).click()
  await page.keyboard.press('Escape')
  return page.getByRole('region', { name: 'Quoting' })
}

test('the office puts a column of the Board in order, and can put it back by date', async ({ browser, request }) => {
  const tag = Date.now().toString(36)
  // A year of its own, so cards from other runs on the shared server don't sit between these three.
  const year = 2040 + Math.floor(Math.random() * 400)
  const jobs = [
    ['Alpha', `${year}-03-04`],
    ['Bravo', `${year}-03-03`],
    ['Charlie', `${year}-03-02`],
  ] as const
  const res = await request.post('/api/sync/push', {
    data: {
      clientId: `order-${tag}`,
      mutations: jobs.flatMap(([name, day], i) => [
        { id: `order-${tag}-p${i}`, name: 'project.create', args: { id: `o-${tag}-${i}`, name: `${name} ${tag}${name === 'Charlie' ? ' Intercontinentalballroomandconferencecentre' : ''}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }, createdAt: new Date().toISOString() },
        { id: `order-${tag}-d${i}`, name: 'phase.add', args: { id: `op-${tag}-${i}`, projectId: `o-${tag}-${i}`, name: 'Show', start: day, end: day, venueId: null, notes: '' }, createdAt: new Date().toISOString() },
      ]),
    },
  })
  expect(((await res.json()) as { results: { status: string }[] }).results.every((r) => r.status === 'applied')).toBe(true)

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1400 } })).newPage()
  let quoting = await board(page)
  // Nobody has put them in order: soonest first.
  await expect.poll(() => mine(quoting, tag)).toEqual(['Charlie', 'Bravo', 'Alpha'])
  await expect(quoting.getByRole('button', { name: 'Sort by date' })).toHaveCount(0)

  // By the keyboard: Space picks Alpha up, Home takes it to the top, Space puts it down; each move is said.
  const grip = (name: string) => quoting.getByRole('button', { name: `Move ${name} ${tag}` })
  await grip('Alpha').focus()
  await page.keyboard.press('Space')
  await expect(page.locator('[aria-live="polite"].sr-only')).toContainText(`Alpha ${tag} picked up`)
  await page.keyboard.press('Home')
  await expect(page.locator('[aria-live="polite"].sr-only')).toHaveText(/^1 of \d+\.$/)
  await page.keyboard.press('Space')
  await expect(page.locator('[aria-live="polite"].sr-only')).toContainText(`Alpha ${tag} put down, 1 of`)
  await expect.poll(() => mine(quoting, tag)).toEqual(['Alpha', 'Charlie', 'Bravo'])
  expect((await quoting.locator('.board-card b').first().textContent())!).toBe(`Alpha ${tag}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')

  // Kept by the server: the same after a reload.
  await page.reload()
  quoting = await board(page)
  await expect.poll(() => mine(quoting, tag)).toEqual(['Alpha', 'Charlie', 'Bravo'])

  // Dragged by its Move button: it follows the pointer and the cards it passes slide down to open its gap.
  const box = async (l: Locator) => (await l.boundingBox())!
  await quoting.locator('.board-item', { hasText: `Bravo ${tag}` }).scrollIntoViewIfNeeded()
  const from = await box(grip('Bravo'))
  const target = await box(quoting.locator('.board-item', { hasText: `Alpha ${tag}` }))
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 10, target.y + 8, { steps: 8 })
  await expect(quoting.locator('.board-item[data-shift="down"]', { hasText: `Alpha ${tag}` })).toHaveCount(1)
  await expect.poll(() => mine(quoting, tag)).toEqual(['Alpha', 'Charlie', 'Bravo'])
  await page.screenshot(shot('dragging-desk'))
  await page.mouse.up()
  await expect.poll(() => mine(quoting, tag)).toEqual(['Bravo', 'Alpha', 'Charlie'])

  // The press twin: Move on Charlie, then a press on Bravo's card puts Charlie in its place, without opening Bravo.
  await grip('Charlie').click()
  await expect(grip('Charlie')).toHaveAttribute('aria-pressed', 'true')
  await quoting.locator('.board-card', { hasText: `Bravo ${tag}` }).click()
  await expect(page).toHaveURL(/#jobs\/board$/)
  await expect.poll(() => mine(quoting, tag)).toEqual(['Charlie', 'Bravo', 'Alpha'])

  // Back to date order: soonest first again.
  await quoting.getByRole('button', { name: 'Sort by date' }).click()
  await expect.poll(() => mine(quoting, tag)).toEqual(['Charlie', 'Bravo', 'Alpha'])
  await expect(quoting.getByRole('button', { name: 'Sort by date' })).toHaveCount(0)

  // Dragged by the card itself, as on any kanban board (Colly, 11 November 2026); a click on a card still opens the job.
  await quoting.locator('.board-item', { hasText: `Bravo ${tag}` }).evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const alpha = await box(quoting.locator('.board-card', { hasText: `Alpha ${tag}` }))
  const charlie = await box(quoting.locator('.board-item', { hasText: `Charlie ${tag}` }))
  await page.mouse.move(alpha.x + 30, alpha.y + 20)
  await page.mouse.down()
  await page.mouse.move(alpha.x + 30, charlie.y + 8, { steps: 10 })
  await expect(quoting.locator('.board-item[data-shift="down"]', { hasText: `Charlie ${tag}` })).toHaveCount(1)
  await page.mouse.up()
  await expect(page).toHaveURL(/#jobs\/board$/)
  await expect.poll(() => mine(quoting, tag)).toEqual(['Alpha', 'Charlie', 'Bravo'])
  await expect(page.locator('.conn')).toHaveText('Up to date')
  // No card is wider than its column, however long its words (Colly, 12 November 2026: cards spilled over the next column).
  const spill = await page.evaluate(() =>
    [...document.querySelectorAll('.board-col')].flatMap((c) => {
      const r = c.getBoundingClientRect()
      return [...c.querySelectorAll('.board-item')].filter((i) => i.getBoundingClientRect().right > r.right + 1).map((i) => i.textContent)
    }),
  )
  expect(spill).toEqual([])

  // Put back by date, as the other Board tests share the column; then a click on a card still opens its job.
  await quoting.getByRole('button', { name: 'Sort by date' }).click()
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await quoting.locator('.board-card', { hasText: `Bravo ${tag}` }).click()
  await expect(page).toHaveURL(new RegExp(`#jobs/o-${tag}-1`))
})

test('a Planning card says its crew and its kit with a dot each', async ({ browser, request }) => {
  const tag = Date.now().toString(36)
  const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
  const at = () => new Date().toISOString()
  await request.post('/api/sync/push', {
    data: {
      clientId: `dots-${tag}`,
      mutations: [
        { id: `dots-${tag}-1`, name: 'project.create', args: { id: `d-${tag}`, name: `Delta ${tag}`, clientId: null, venueId: null, status: 'confirmed', notes: '' }, createdAt: at() },
        { id: `dots-${tag}-2`, name: 'phase.add', args: { id: `dp-${tag}`, projectId: `d-${tag}`, name: 'Show', start: soon, end: soon, venueId: null, notes: '' }, createdAt: at() },
        {
          id: `dots-${tag}-3`,
          name: 'call.create',
          args: { id: `dc-${tag}`, projectId: `d-${tag}`, phaseId: `dp-${tag}`, project: `Delta ${tag}`, phase: 'Show', venue: '', role: 'LX tech', start: soon, end: soon, callTime: '08:00', needed: 3, dayRateCents: null, details: '', replyBy: null },
          createdAt: at(),
        },
      ],
    },
  })
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage()
  await page.goto('/#jobs/board')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  const card = page.getByRole('region', { name: 'Planning' }).locator('.board-item', { hasText: `Delta ${tag}` })
  await expect(card.locator('.board-mark').first()).toHaveAttribute('data-state', 'warn')
  await expect(card.locator('.board-mark').first()).toContainText('0/3')
  await expect(card.getByRole('button', { name: `Move Delta ${tag}` })).toBeVisible()
  if (process.env.SHOTS) {
    await page.getByRole('region', { name: 'Planning' }).scrollIntoViewIfNeeded()
    await page.getByRole('region', { name: 'Planning' }).screenshot({ path: 'test-results/board-order/planning-phone.png' })
  }
})
