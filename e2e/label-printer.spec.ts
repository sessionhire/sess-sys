import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { FakeZt411 } from '../server/test/fake-zt411.ts'

/**
 * The label printer over the internet (ADR 0191). Admin › Connections ›
 * Label printer turns it on and makes the setup file; a pretend ZT411
 * (server/test/fake-zt411.ts, keeping to WebLink as Zebra describes it)
 * connects with the password in it. Then a run's page, on a phone, shows the
 * printer ready beside Print and prints on it, and shows the head open as
 * soon as the printer says. Off again at the end, since the test server is
 * shared and the Browser Print tests expect it off.
 */

const phoneSize = { width: 390, height: 844 }
const sh = (n: number) => `SH-${String(n).padStart(6, '0')}`
/** A folder to save screenshots in, for the pull request. */
const SHOTS = process.env.PRINTER_SHOTS

async function newRun(page: Page, count: number): Promise<number> {
  await page.goto('/#stock/labels')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  const form = page.getByRole('form', { name: 'Set numbers aside' })
  await form.getByLabel('How many labels').fill(String(count))
  await form.getByLabel('What for').fill('Printer over the internet')
  await form.getByRole('button', { name: 'Set numbers aside' }).click()
  await form.getByRole('button', { name: 'Set them aside' }).click()
  await expect(form.locator('.added')).toHaveText(/^Set aside SH-\d{6} to SH-\d{6}\.$/)
  const first = Number((await form.locator('.added a').textContent())!.split(' to ')[0]!.slice(3))
  await form.locator('.added a').click()
  return first
}

test('the ZT411 connects over the internet with its setup file, says how it is, and prints from a phone', async ({ page, baseURL }) => {
  await page.route('http://127.0.0.1:9100/**', (route) => route.abort())
  await page.route('https://127.0.0.1:9101/**', (route) => route.abort())
  await page.setViewportSize(phoneSize)
  await page.goto('/#admin/connections')
  const card = page.getByRole('region', { name: 'Label printer' })
  let zt: FakeZt411 | undefined
  try {
    await card.getByRole('switch', { name: /Print over the internet/ }).check()
    await expect(card).toContainText(`${baseURL}/api/printer/weblink/`)
    await card.getByRole('button', { name: 'Make the setup file' }).click()
    await expect(card.getByRole('group', { name: 'The setup file' })).toContainText('shown only now')
    // Served over plain http here, so there's no certificate to put in it; on the live app there is.
    await expect(card).toContainText('It has no certificate in it')
    const [download] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'Download the setup file' }).click()])
    expect(download.suggestedFilename()).toBe('zt411-setup.zpl')
    const file = readFileSync((await download.path())!, 'utf8')
    expect(file).toContain(`! U1 setvar "weblink.ip.conn1.location" "${baseURL}/api/printer/weblink/"`)
    const password = /authentication\.add" "\S+ zt411 (\S+)"/.exec(file)![1]!

    zt = new FakeZt411({ location: `${baseURL}/api/printer/weblink/`, password, serial: '99J204700123', name: 'ZT411 warehouse' })
    await zt.connect()
    await expect(card.locator('.printer-line')).toContainText('Ready', { timeout: 20_000 })
    await expect(card.locator('.printer-line')).toContainText('ZT411 warehouse, serial 99J204700123')
    if (SHOTS) await card.screenshot({ path: `${SHOTS}/label-printer-admin-phone.png` })

    const first = await newRun(page, 30)
    const run = page.getByRole('region', { name: 'On the ZT411' })
    await expect(run.locator('.printer-line')).toContainText('Ready', { timeout: 15_000 })
    await run.getByRole('button', { name: 'Print 30 labels' }).click()
    await expect(run.getByRole('status')).toHaveText('30 labels sent to ZT411 warehouse.')
    await expect.poll(() => (zt!.zpl.match(/\^XA/g) ?? []).length).toBe(30)
    expect(zt.zpl).toContain(`^FDHA,${sh(first + 29)}^FS`)
    // Browser Print isn't here, and isn't needed: no word of installing it.
    await expect(run).not.toContainText('install Zebra Browser Print')
    if (SHOTS) await run.screenshot({ path: `${SHOTS}/label-printer-ready-phone.png` })

    zt.systemStatus = '0,1,00000000,00000004,0,00000000,00000000'
    zt.alert('HEAD OPEN', 'SET')
    await expect(run.locator('.printer-line')).toContainText('Head open', { timeout: 15_000 })
    await expect(run.locator('.printer-line')).toContainText('Close the print head.')
    if (SHOTS) await run.screenshot({ path: `${SHOTS}/label-printer-head-open-phone.png` })
  } finally {
    zt?.close()
    await page.goto('/#admin/connections')
    const off = page.getByRole('region', { name: 'Label printer' }).getByRole('switch', { name: /Print over the internet/ })
    if (await off.isChecked()) await off.uncheck()
    await expect(off).not.toBeChecked()
  }
})
