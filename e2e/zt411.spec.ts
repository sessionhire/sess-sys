import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * Labels on the Zebra ZT411 (ADR 0178), at desk size. With no Zebra Browser
 * Print on the computer, a run downloads as a ZPL file for it, every label
 * in it, and says how to print straight from here. With Browser Print
 * answering (stood in for here, at its own address), the run goes to its
 * default printer in parts, and says so.
 */

const sh = (n: number) => `SH-${String(n).padStart(6, '0')}`

/** Browser Print as it answers on this computer, keeping what's sent to it. */
async function browserPrint(page: Page) {
  const sent: string[] = []
  await page.route('http://127.0.0.1:9100/**', async (route) => {
    const url = new URL(route.request().url())
    const headers = { 'access-control-allow-origin': '*' }
    if (url.pathname === '/default')
      return route.fulfill({
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'ZT411', uid: 'ZT411-1', connection: 'network', deviceType: 'printer', provider: 'com.zebra.ds.webdriver.desktop.provider.DefaultDeviceProvider', manufacturer: 'Zebra Technologies' }),
      })
    if (url.pathname === '/write') {
      const body = JSON.parse(route.request().postData() ?? '{}') as { device: { uid: string }; data: string }
      expect(body.device.uid).toBe('ZT411-1')
      sent.push(body.data)
      return route.fulfill({ headers, body: '' })
    }
    return route.fulfill({ status: 404, headers, body: '' })
  })
  return sent
}

async function newRun(page: Page, count: number): Promise<number> {
  await page.goto('/#stock/labels')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  const form = page.getByRole('form', { name: 'Set numbers aside' })
  await form.getByLabel('How many labels').fill(String(count))
  await form.getByLabel('What for').fill('ZT411 roll')
  await form.getByRole('button', { name: 'Set numbers aside' }).click()
  await form.getByRole('button', { name: 'Set them aside' }).click()
  await expect(form.locator('.added')).toHaveText(/^Set aside SH-\d{6} to SH-\d{6}\.$/)
  const first = Number((await form.locator('.added a').textContent())!.split(' to ')[0]!.slice(3))
  await form.locator('.added a').click()
  await expect(page.getByRole('heading', { level: 1, name: `${sh(first)} to ${sh(first + count - 1)}` })).toBeVisible()
  return first
}

test('a run downloads for the ZT411 when Browser Print is not here', async ({ page }) => {
  await page.route('http://127.0.0.1:9100/**', (route) => route.abort())
  await page.route('https://127.0.0.1:9101/**', (route) => route.abort())
  const first = await newRun(page, 600)
  const zt = page.getByRole('region', { name: 'On the ZT411' })
  // More than the 500 the print dialog takes: the whole run.
  await expect(zt.getByLabel('How many')).toHaveValue('600')
  await expect(zt).toContainText('install Zebra Browser Print')
  await expect(zt.getByRole('button', { name: /^Print/ })).toHaveCount(0)
  const [download] = await Promise.all([page.waitForEvent('download'), zt.getByRole('button', { name: 'Download for the ZT411' }).click()])
  expect(download.suggestedFilename()).toBe(`session-hire-labels-${sh(first)}-to-${sh(first + 599)}.zpl`)
  const zpl = readFileSync((await download.path())!, 'utf8')
  expect(zpl.match(/\^XA/g)).toHaveLength(600)
  expect(zpl).toContain(`^FDHA,${sh(first + 599)}^FS`)
  expect(zpl).toContain('^PW591^LL295')

  // The size is the printer's, kept for next time.
  await zt.getByRole('radio', { name: '25 × 25 mm' }).check()
  await page.reload()
  await expect(page.getByRole('region', { name: 'On the ZT411' }).getByRole('radio', { name: '25 × 25 mm' })).toBeChecked()
})

test('a run prints on the ZT411 through Browser Print', async ({ page }) => {
  const sent = await browserPrint(page)
  const first = await newRun(page, 250)
  const zt = page.getByRole('region', { name: 'On the ZT411' })
  await zt.getByRole('radio', { name: '50 × 25 mm' }).check()
  await zt.getByRole('button', { name: 'Print 250 labels' }).click()
  await expect(zt.getByRole('status')).toHaveText('250 labels sent to ZT411.')
  // In parts of 100, every label once, in order.
  expect(sent).toHaveLength(3)
  const numbers = sent.join('').match(/\^FDHA,(SH-\d{6})\^FS/g)!.map((f) => f.slice(6, 15))
  expect(numbers).toEqual(Array.from({ length: 250 }, (_, i) => sh(first + i)))

  // From a part of the run.
  await zt.getByLabel('From').fill(`sh ${first + 240}`)
  await zt.getByLabel('How many').fill('20')
  await expect(zt.locator('.alert')).toHaveText(`Only 10 from ${sh(first + 240)} to ${sh(first + 249)}.`)
  await expect(zt.getByRole('button', { name: /^Print/ })).toBeDisabled()
})
