import { STARTER_PACKAGES, STARTER_PRODUCTS } from '../shared/src/starter-packages.ts'
import { expect, test } from '@playwright/test'

/**
 * The starter packages (ADR 0117): Money's price list offers the packages drawn from Current RMS's quotes, matched to
 * the stock list by name, and adds them in one press with the mics and DIs the stock list lacked.
 */
test('the starter packages go on the price list in one press, with the mics and DIs the stock list lacked', async ({ page, request }) => {
  const id = Date.now().toString(36)
  // The stock list as it came from Current RMS: every product the packages name but the eight the starter adds.
  const names = [...new Set(STARTER_PACKAGES.flatMap((p) => p.items.map(([n]) => n)))].filter((n) => !STARTER_PRODUCTS.some((s) => s.name === n))
  const res = await request.post('/api/sync/push', {
    data: {
      clientId: `starter-${id}`,
      mutations: names.map((name, i) => ({
        id: `starter-${id}-${i}`,
        name: 'model.create',
        args: { id: `rms-${id}-${i}`, name, department: 'audio', category: '', tracking: 'bulk', isCase: false, valueCents: null, notes: '' },
        createdAt: new Date().toISOString(),
      })),
    },
  })
  const { results } = (await res.json()) as { results: { status: string }[] }
  expect(results.every((r) => r.status === 'applied')).toBe(true)

  await page.goto('/#jobs/money/prices')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  const card = page.getByRole('region', { name: 'Starter packages' })
  await expect(card).toContainText('41 packages drawn from the quotes in Current RMS')
  await expect(card).toContainText('Shure SM57')
  await card.getByRole('button', { name: 'Add the 41 packages' }).click()
  await expect(card).toHaveCount(0)

  const packages = page.getByRole('region', { name: 'Packages' })
  // Other tests' packages may be there too.
  await expect(packages.locator('.package-row b')).toContainText(STARTER_PACKAGES.map((p) => p.name).sort((a, b) => a.localeCompare(b, 'en-IE')))
  const band = packages.locator('.package-row', { hasText: 'Mic package, band' })
  await expect(band).toContainText('2 × Shure SM57')
  await expect(packages.locator('.package-row', { hasText: 'Decor LX' })).toContainText('€1,800.00 a week')

  // The mics and DIs are on the stock list, with nothing counted.
  await page.goto('/#stock')
  await page.getByRole('searchbox').first().fill('DI box')
  await expect(page.getByText('DI box, passive').first()).toBeVisible()
})
