import { expect, test } from '@playwright/test'

/**
 * A cable's length beside its name (ADR 0202), at phone size: New product
 * asks for a cable's length under its name and moves one typed in the name
 * over; the product's page shows the length in its heading and as a fact;
 * two cables of one name and different lengths are two products; and
 * Lengths in names moves a length out of a name once it's picked and
 * confirmed.
 */

const phoneSize = { width: 390, height: 844 }
const tag = () => Math.random().toString(36).slice(2, 8).toUpperCase()
const shots = process.env.E2E_SHOTS

test("a cable's length is asked for under its name, shown after it, and tidied out of names", async ({ browser }) => {
  const id = tag()
  const page = await (await browser.newContext({ viewport: phoneSize, deviceScaleFactor: shots ? 2 : 1 })).newPage()
  await page.goto('/#stock')
  await expect(page.locator('.conn')).toHaveText('Up to date')

  // Typed in the name, the length is offered over to its own box.
  await page.getByRole('button', { name: 'New product' }).click()
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add product' }) })
  await form.getByLabel('Name', { exact: true }).fill(`XLR ${id} 10m`)
  await expect(form.getByText('The name says 10 m.')).toBeVisible()
  if (shots) await form.screenshot({ path: `${shots}/new-product-length-phone.png` })
  await form.getByRole('button', { name: 'Move 10 m to Length' }).click()
  await expect(form.getByLabel('Name', { exact: true })).toHaveValue(`XLR ${id}`)
  await expect(form.getByLabel('Length, in metres')).toHaveValue('10')
  await form.getByRole('button', { name: 'Add product' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `XLR ${id} 10 m` })).toBeVisible()
  await page.getByRole('tab', { name: 'Details' }).click()
  const details = page.getByRole('region', { name: 'Details' })
  await expect(details.locator('.length-fact dd b')).toHaveText('10 m')
  if (shots) await page.screenshot({ path: `${shots}/product-page-length-phone.png` })

  // The same name 5 m long is another product; 10 m long again is not.
  await page.goto('/#stock')
  await page.getByRole('button', { name: 'New product' }).click()
  await form.getByLabel('Name', { exact: true }).fill(`XLR ${id}`)
  await form.getByLabel('Length, in metres').fill('10')
  await form.getByRole('button', { name: 'Add product' }).click()
  await expect(page.getByText(`There's already a product called XLR ${id} 10 m.`)).toBeVisible()
  await form.getByLabel('Length, in metres').fill('5')
  await form.getByRole('button', { name: 'Add product' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `XLR ${id} 5 m` })).toBeVisible()

  // An old name with the length in it: the page offers to move it, and so does Lengths in names.
  await page.goto('/#stock')
  await page.getByRole('button', { name: 'New product' }).click()
  await form.getByLabel('Name', { exact: true }).fill(`Speakon ${id} 15m`)
  await form.getByLabel('Length, in metres').fill('')
  await form.getByRole('button', { name: 'Add product' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Speakon ${id} 15m` })).toBeVisible()
  await page.getByRole('tab', { name: 'Details' }).click()
  await expect(details.getByRole('button', { name: 'Move 15 m out of the name' })).toBeVisible()

  await page.goto('/#stock/lengths')
  await expect(page.getByRole('heading', { level: 1, name: 'Lengths in names' })).toBeVisible()
  const row = page.locator('.length-list li').filter({ hasText: `Speakon ${id} 15m` })
  await expect(row.getByText(`Becomes Speakon ${id}, 15 m long`)).toBeVisible()
  await expect(row.getByRole('checkbox')).toBeChecked()
  if (shots) await page.screenshot({ path: `${shots}/lengths-in-names-phone.png`, fullPage: true })
  await page.getByRole('button', { name: /^Move \d+ lengths?$/ }).click()
  await page.getByRole('button', { name: 'Move them' }).click()
  await expect(page.locator('p.added')).toContainText('Moved the length out of')
  await expect(page.locator('.length-list li').filter({ hasText: `Speakon ${id} 15m` })).toHaveCount(0)

  // Found by its length as typed, and listed with it.
  await page.goto('/#stock')
  await page.getByRole('searchbox').first().fill(`speakon ${id} 15`)
  await expect(page.locator('.job-row b', { hasText: `Speakon ${id} 15 m` })).toBeVisible()
})
