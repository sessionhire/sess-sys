import { expect, test } from '@playwright/test'

/**
 * Sole trader or company (ADR 0184), on a phone: Dara Quinn, from the made-up data, trades through a company; the office
 * changes him to a sole trader who is VAT-registered, the form asking only what that needs, and his page says so. Uses the
 * made-up data (ADR 0019), so it starts fresh before and after: the other tests share this server.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }
const shots = process.env.SHOTS_DIR

test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
})

test.afterEach(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('a freelancer is a sole trader or a company, and the form asks only what each needs', async ({ browser }) => {
  // Proves: a record from before reads as a company; Sole trader hides the company fields and asks VAT registered, the VAT number only after Yes; saved, the page says it.
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto('/#crew/people')
  await expect(office.getByRole('status')).toHaveText('Up to date')
  await office.getByRole('region', { name: 'People' }).getByRole('link', { name: /^Dara Quinn/ }).click()
  const page = office.locator('.person-page')
  await office.getByRole('tab', { name: /^Details/ }).click()
  await expect(page).toContainText('BusinessTrades as Quinn Audio Ltd, VAT-registered')

  await page.getByRole('button', { name: 'Change details' }).click()
  const form = office.getByRole('form', { name: 'Edit Dara Quinn' })
  const as = form.getByRole('group', { name: /^Works for us as/ })
  await expect(as.getByRole('radio', { name: 'Company' })).toBeChecked()
  await expect(form.getByLabel('Company name')).toHaveValue('Quinn Audio Ltd')
  await expect(form.getByLabel('CRO number')).toHaveValue('000001')
  await as.scrollIntoViewIfNeeded()
  if (shots) await office.screenshot({ path: `${shots}/company-phone.png` })

  await as.getByRole('radio', { name: 'Sole trader' }).check()
  await expect(form.getByLabel('Company name')).toHaveCount(0)
  await expect(form.getByLabel('CRO number')).toHaveCount(0)
  const vat = form.getByRole('group', { name: 'VAT registered?' })
  await vat.getByRole('radio', { name: 'No' }).check()
  await expect(form.getByLabel('VAT number')).toHaveCount(0)
  await vat.getByRole('radio', { name: 'Yes' }).check()
  await expect(form.getByLabel('VAT number')).toHaveValue('IE0000001A')
  await form.getByLabel('VAT number').fill('IE1234567T')
  if (shots) await office.screenshot({ path: `${shots}/sole-trader-phone.png` })
  await form.getByRole('button', { name: /^Save/ }).click()

  await expect(page).toContainText('BusinessSole trader, VAT-registered')
  await expect(page).toContainText('VAT numberIE1234567T')
  await expect(page).not.toContainText('CRO number')
  await expect(office.getByRole('status')).toHaveText('Up to date')
  // Kept by the server, not only on this phone.
  await office.reload()
  await office.getByRole('tab', { name: /^Details/ }).click()
  await expect(office.locator('.person-page')).toContainText('BusinessSole trader, VAT-registered')
})
