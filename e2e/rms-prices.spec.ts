import { expect, test } from '@playwright/test'
import type { RmsPricesStatus } from '../shared/src/rms-prices.ts'

/**
 * Hire prices from Current RMS on Admin (ADR 0132): the card says what filling in would do, each kind opening in place,
 * and the tick for prices set by hand changes the count on the button. The server's answer is stood in for, since the
 * browser tests have no Current RMS; the server's side is in server/test/rms-prices.test.ts.
 */

const phoneSize = { width: 390, height: 844 }

const status: RmsPricesStatus = {
  configured: true,
  running: null,
  last: { startedAt: '2026-11-09T10:00:00.000Z', finishedAt: '2026-11-09T10:05:00.000Z', products: 304, error: null, stopped: false },
  products: 304,
  plan: {
    fill: [
      { modelId: 'y10p', name: 'd&b Y10P', rmsName: '', dayCents: 9000, rate: 'week3' },
      { modelId: 'lx', name: 'Lighting multicore 100 m', rmsName: '100m Lighting multi core', dayCents: 15000, rate: 'weekly' },
    ],
    update: [{ modelId: 'sm58', name: 'Shure SM58', rmsName: '', dayCents: 1200, rate: 'daily', was: { dayCents: 1000, rate: 'daily' } }],
    differs: [{ modelId: 'di', name: 'DI box', rmsName: '', dayCents: 3000, rate: 'daily', was: { dayCents: 2500 } }],
    same: 180,
    unmatched: [{ id: 155, name: 'Mystery haze machine' }],
    noPrice: [{ modelId: 'tape', name: 'Gaffer tape' }],
    notInRms: 12,
  },
}

test('the card says what filling in would do before anything changes', async ({ browser }) => {
  const page = await browser.newPage({ viewport: phoneSize })
  await page.route('**/api/rms/prices', (route) => route.fulfill({ json: status }))
  await page.route('**/api/rms', (route) => route.fulfill({ json: { configured: true, subdomain: 'sessionhire', running: null, last: null, opportunities: 0, lines: 0 } }))
  await page.goto('/#admin/connections')
  const card = page.getByRole('region', { name: 'Hire prices from Current RMS' })
  await expect(card).toBeVisible()
  await expect(card.getByText('180 already the same')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Fill in 3 prices' })).toBeVisible()

  await card.getByText('to fill in').click()
  await expect(card.getByText('€150 a week, Weekly')).toBeVisible()
  await expect(card.getByText('(100m Lighting multi core in Current RMS)')).toBeVisible()
  await card.getByText('set here by hand, and different').click()
  await expect(card.getByText('€25 a day, Daily here, €30 a day, Daily in Current RMS')).toBeVisible()

  await card.getByLabel("Use Current RMS's price for the one set here too").check()
  await expect(card.getByRole('button', { name: 'Fill in 4 prices' })).toBeVisible()

  // Nothing wider than the phone: the lists grow the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (process.env.SHOTS) await card.screenshot({ path: 'docs/screens/rms-prices-phone.png' })
  await page.close()
})
