import { expect, test, type Page } from '@playwright/test'

/**
 * Counting bay by bay out of the one place a stock list came in at (ADR
 * 0176), at phone size. Bays are made twenty at a time from a range. Kit
 * counted at a bay that is recorded at a place never counted is moved from
 * there, not added on top; a label put on at a bay takes its item off that
 * place; and the place everything came in at is emptied in one press once
 * the bays have their share. The test server is shared, so names are this
 * run's own.
 */

const phoneSize = { width: 390, height: 844 }
// Letters only: a bay's name ends in its number, so a tag ending in a digit would run into it.
const tag = () => Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('')

async function newProduct(page: Page, name: string, at: string, count: number, counted = false) {
  await page.goto('/#stock')
  await page.getByRole('button', { name: 'New product' }).click()
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add product' }) })
  await form.getByLabel('Name').fill(name)
  if (counted) await form.getByRole('radio', { name: /^Counted/ }).check()
  await form.getByRole('button', { name: 'Add product' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  const add = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Add a count', exact: true }) })
  await add.getByLabel('Counted at').fill(at)
  await add.getByLabel('How many').fill(String(count))
  await add.getByRole('button', { name: 'Save count' }).click()
  const yes = add.getByRole('button', { name: 'Make the place' })
  if (await yes.isVisible()) await yes.click()
  await expect(page.locator('.count', { hasText: at })).toContainText(String(count))
}

async function openPlace(page: Page, name: string) {
  await page.goto('/#stock/places')
  const all = page.getByRole('button', { name: /^Show all \d+ places$/ })
  if (await all.isVisible()) await all.click()
  await page.locator('.job-row').filter({ has: page.locator('b').getByText(name, { exact: true }) }).click()
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
}

test('bays made from a range, counted out of the place it all came in at, which is then emptied', async ({ browser }) => {
  const id = tag()
  const store = `Store ${id}`
  const speaker = `d&b Y10P ${id}`
  const cable = `XLR 10 m ${id}`
  const context = await browser.newContext({ viewport: phoneSize })
  const page = await context.newPage()
  await page.goto('/#stock')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await newProduct(page, speaker, store, 6)
  await newProduct(page, cable, store, 50, true)

  // Twenty bays from one line.
  await page.goto('/#stock/places')
  await page.getByRole('button', { name: 'New place' }).click()
  await page.getByLabel('New place').fill(`Bay ${id}1 to ${id}20`)
  await expect(page.locator('.hint', { hasText: `Bay ${id}1, Bay ${id}2 … Bay ${id}20` })).toBeVisible()
  await page.getByRole('button', { name: 'Add 20 places' }).click()
  await expect(page.locator('p.added')).toHaveText(`Added Bay ${id}1 and 19 more places.`)
  await page.getByLabel('New place').fill(`Bay ${id}19 to ${id}21`)
  await page.getByRole('button', { name: 'Add 3 places' }).click()
  await expect(page.locator('p.added')).toHaveText(`Added Bay ${id}21; 2 were here already.`)
  await expect(page.locator('.conn')).toHaveText('Up to date')

  // A labels run for the speaker.
  await page.goto('/#stock/labels')
  const runForm = page.getByRole('form', { name: 'Set numbers aside' })
  await runForm.getByLabel('How many labels').fill('2')
  await runForm.getByLabel('What for').fill(`Roll ${id}`)
  await runForm.getByRole('button', { name: 'Set numbers aside' }).click()
  await runForm.getByRole('button', { name: 'Set them aside' }).click()
  await expect(runForm.locator('.added')).toHaveText(/^Set aside SH-\d{6} to SH-\d{6}\.$/, { timeout: 20_000 })
  const label = /SH-\d{6}/.exec((await runForm.locator('.added').textContent())!)![0]

  // Counting the first bay: the label comes off the store, the cables are added to the count.
  await openPlace(page, `Bay ${id}1`)
  await page.getByRole('button', { name: 'Count this place' }).click()
  await page.getByLabel('Number or serial').fill(label)
  await page.getByLabel('Number or serial').press('Enter')
  const put = page.getByRole('form', { name: `Put ${label} on an item` })
  await put.getByLabel('Product').fill(speaker)
  await expect(put).toContainText(`One of the 6 at ${store} without a label: it comes off there and is kept here.`)
  await put.getByRole('button', { name: `Put ${label} on a ${speaker}` }).click()
  await expect(page.locator('.count-tally')).toHaveText('1 of 1 found')
  const kit = page.getByRole('region', { name: 'Counted kit' })
  await kit.getByLabel("A product that's here but not on the list").fill(cable)
  await kit.getByRole('button', { name: 'Add' }).click()
  await kit.locator('label.count-field', { hasText: cable }).locator('input').fill('20')
  await page.getByRole('button', { name: 'Finish the count' }).click()

  // The cables over here are moved from the store, not added on top.
  const lines = page.getByRole('region', { name: 'Counted kit' })
  await expect(lines).toContainText(`20 counted, 0 recorded: 20 over. 50 are recorded at ${store}, never counted.`)
  await lines.getByRole('button', { name: `Move 20 here from ${store}` }).click()
  await expect(lines.locator('.done')).toHaveText('Set to 20')
  await expect(page.locator('.conn')).toHaveText('Up to date')

  // The store now holds 5 speakers without a label and 30 cables; its count, once the bays are done, is emptied in one press.
  await openPlace(page, store)
  await page.getByRole('button', { name: 'Count this place' }).click()
  const left = page.getByRole('region', { name: 'Counted kit' })
  await left.getByRole('button', { name: 'None of the other 2 here' }).click()
  await expect(left.locator('label.count-field', { hasText: cable }).locator('input')).toHaveValue('0')
  await page.getByRole('button', { name: 'Finish the count' }).click()
  const fixes = page.getByRole('region', { name: 'Counted kit' })
  await expect(fixes).toContainText('0 counted, 30 recorded: 30 short.')
  await expect(fixes).toContainText('0 counted, 5 recorded: 5 short.')
  await context.close()
})
