import { expect, test, type Page } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

/**
 * A client's quote link and a freelancer's pages on a device that has
 * opened the app before (ADR 0186): the server answers them, never the
 * app's shell, so nobody is asked to sign in. Colly opened a client's
 * accept link from a quote email on a phone with the app on it and got the
 * sign-in; a client's phone, which never had the app, was always fine.
 */

const dist = join(process.cwd(), 'web', 'dist')
const sw = join(dist, 'sw.js')
const before = readFileSync(sw, 'utf8')
const put = (file: string, text: string) => {
  writeFileSync(file, text)
  if (existsSync(`${file}.br`)) writeFileSync(`${file}.br`, brotliCompressSync(text))
  if (existsSync(`${file}.gz`)) writeFileSync(`${file}.gz`, gzipSync(text))
}
test.afterEach(() => put(sw, before))

/** A key of the right shape that opens no quote: the server's own page says so, the shell would ask to sign in. */
const quoteLink = '/q/AAAAAAAAAAAAAAAAAAAAAAAA'

async function workerInCharge(page: Page) {
  await page.goto('/#home')
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 }).catch(() => page.reload())
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null)
}

test("with the app's worker in charge, a quote link and the lost-link page come from the server", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await workerInCharge(page)
  await page.goto(quoteLink)
  await expect(page.getByText("This link doesn't open a quote")).toBeVisible()
  await expect(page.locator('#root')).toHaveCount(0)
  await page.goto('/link')
  await expect(page.locator('#root')).toHaveCount(0)
  // The app itself still opens from its worker.
  await page.goto('/#home')
  await expect(page.locator('#root')).toHaveCount(1)
})

test("an older worker that still answers a quote link as the app lets the server answer it, once", async ({ browser }) => {
  // The worker of a version before this one: quote links not on its list.
  const old = before.replace('/^\\/q\\//,', '')
  expect(old).not.toBe(before)
  put(sw, old)
  const page = await (await browser.newContext()).newPage()
  await workerInCharge(page)
  await page.goto(quoteLink)
  // The shell drew, saw where it was, let the worker go and loaded the page again from the server.
  await expect(page.getByText("This link doesn't open a quote")).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('#root')).toHaveCount(0)
  // Opening the app puts its worker back.
  put(sw, before)
  await page.goto('/#home')
  await expect(page.locator('#root')).toHaveCount(1)
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 }).catch(() => page.reload())
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null)
})
