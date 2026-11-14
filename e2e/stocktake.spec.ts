import { expect, test, type Page } from '@playwright/test'

/**
 * How far the stocktake has got, and who's counting where (ADR 0177), on two
 * phones. One starts counting a bay: the other sees who and since when on
 * the Counting page and on the bay's line, and pressing Count there asks
 * before a second count of it starts. Discarded, the bay is free again. The
 * Counting page also says how many places have been counted and how much
 * numbered kit is labelled. The test server is shared, so names are this
 * run's own and totals are read as they change.
 */

const phoneSize = { width: 390, height: 844 }
const tag = () => Math.random().toString(36).slice(2, 8)

async function openPlace(page: Page, name: string) {
  await page.goto('/#stock/places')
  const all = page.getByRole('button', { name: /^Show all \d+ places$/ })
  if (await all.isVisible()) await all.click()
  await page.locator('.job-row').filter({ has: page.locator('b').getByText(name, { exact: true }) }).click()
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
}

test('who is counting where, said on every phone, and how far the stocktake has got', async ({ browser }) => {
  const id = tag()
  const bay = `Bay T ${id}`
  const one = await (await browser.newContext({ viewport: phoneSize })).newPage()
  const two = await (await browser.newContext({ viewport: phoneSize })).newPage()

  // A bay, and a numbered product with 4 not labelled yet.
  await one.goto('/#stock/places')
  await one.getByRole('button', { name: 'New place' }).click()
  await one.getByLabel('New place').fill(bay)
  await one.getByRole('button', { name: 'Add place' }).click()
  await expect(one.locator('p.added')).toHaveText(`Added ${bay}.`)
  await one.goto('/#stock')
  await one.getByRole('button', { name: 'New product' }).click()
  const form = one.locator('form').filter({ has: one.getByRole('button', { name: 'Add product' }) })
  await form.getByLabel('Name').fill(`d&b Y10P ${id}`)
  await form.getByRole('button', { name: 'Add product' }).click()
  const add = one.locator('form').filter({ has: one.getByRole('heading', { name: 'Add a count', exact: true }) })
  await add.getByLabel('Counted at').fill(bay)
  await add.getByLabel('How many').fill('4')
  await add.getByRole('button', { name: 'Save count' }).click()
  await expect(one.locator('.count', { hasText: bay })).toContainText('4')
  await expect(one.locator('.conn')).toHaveText('Up to date')

  await two.goto('/#stock/count')
  const card = two.getByRole('region', { name: 'The stocktake' })
  await expect(card).toBeVisible()
  const placesLine = card.locator('.stocktake-line', { hasText: 'counted at least once' })
  const before = Number((await placesLine.locator('b').textContent())!.replace(/,/g, ''))

  // Phone one starts counting the bay.
  await openPlace(one, bay)
  await one.getByRole('button', { name: 'Count this place' }).click()
  await expect(one.getByRole('heading', { level: 1, name: `Counting ${bay}` })).toBeVisible()
  await expect(one.locator('.conn')).toHaveText('Up to date')

  // Phone two sees it, and is asked before counting it as well.
  await two.reload()
  await expect(card.locator('.under-way-list li', { hasText: bay })).toContainText(/since \d\d:\d\d/)
  await openPlace(two, bay)
  await two.getByRole('button', { name: 'Count this place' }).click()
  const ask = two.getByRole('group', { name: new RegExp(`has been counting ${bay} since`) })
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Leave it to them' }).click()
  await expect(two.getByRole('button', { name: 'Count this place' })).toBeVisible()
  await expect(two.getByRole('heading', { level: 1, name: `Counting ${bay}` })).toHaveCount(0)

  // Phone one discards it: the bay is free again.
  await one.getByRole('button', { name: 'Discard this count' }).click()
  await one.getByRole('button', { name: 'Discard it' }).click()
  await expect(one.locator('.conn')).toHaveText('Up to date')
  await two.goto('/#stock/count')
  await expect(card.locator('.under-way-list li', { hasText: bay })).toHaveCount(0)

  // Phone two counts it and finishes: one more place counted at least once.
  await openPlace(two, bay)
  await two.getByRole('button', { name: 'Count this place' }).click()
  await two.getByRole('button', { name: 'Finish the count' }).click()
  await expect(two.getByRole('heading', { level: 1, name: `Count of ${bay}` })).toBeVisible()
  await two.goto('/#stock/count')
  await expect(placesLine.locator('b')).toHaveText(String(before + 1))
  await expect(card.locator('.stocktake-line', { hasText: 'numbered items labelled' })).toContainText(/^\d[\d,]* of [\d,]+ numbered items labelled$/)
})
