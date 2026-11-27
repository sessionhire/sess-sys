import { expect, test } from '@playwright/test'

/**
 * Replacement values from a list (ADR 0204), at phone size: lines pasted on
 * Admin › Data show each value from what to what, a name not found and a
 * value that can't be read, before Set; Set replaces the value already on
 * the product. Uses the made-up data (ADR 0019), so it starts fresh before
 * and after: the other tests share this server.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }
const shots = process.env.E2E_SHOTS

test.beforeAll(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
})

test.afterAll(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('pasted values show from what to what, then replace the ones already set', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize, deviceScaleFactor: shots ? 2 : 1 })).newPage()
  await page.goto('/#admin/data')
  const card = page.getByRole('region', { name: 'Replacement values from a list' })
  await card.getByLabel('Or paste the lines').fill('Shure SM58, 129\nRobe Spiider: €7,250\nMystery box, 100\nXLR 10 m, lots\nPowercon 5 m, 20')

  await expect(card.getByText('2 values to set')).toBeVisible()
  await expect(card.getByText('Shure SM58: €110 → €129')).toBeVisible()
  await expect(card.getByText(/Robe Spiider: €6,500 → €7,250/)).toBeVisible()
  await expect(card.getByText('1 already the same')).toBeVisible()
  await card.getByText('1 not found here').click()
  await expect(card.getByText('Mystery box (row 3)')).toBeVisible()
  await card.getByText("1 that can't be read").click()
  await expect(card.getByText(/Row 4, XLR 10 m: Couldn|Row 4, XLR 10 m:/)).toBeVisible()
  if (shots) await card.screenshot({ path: `${shots}/values-from-list.png` })

  await card.getByRole('button', { name: 'Set 2 values' }).click()
  await expect(card.getByRole('status')).toHaveText('Set 2 replacement values. Each is in the history.')

  // The new value is the product's now; pasted again, there's nothing to set.
  await card.getByLabel('Or paste the lines').fill('Shure SM58, 129\nRobe Spiider, 7250')
  await expect(card.getByText('2 already the same')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Nothing to set' })).toBeDisabled()
})
