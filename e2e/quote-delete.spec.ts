import { expect, test } from '@playwright/test'

/**
 * Deleting a quote (ADR 0131): an admin opens the dialog at the foot of the quote, reads what makes the version matter,
 * finds Delete off until the quote's number is typed, deletes it, and puts it back from the job's history. Roles are off
 * on this server, so everyone is an admin here; the server's own tests hold the role. Uses the made-up data, so it
 * starts fresh before and after.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test.afterAll(async ({ request }) => {
  await request.post('/api/data/start-fresh', fresh)
})

test('an admin deletes a version of a quote only once its number is typed, and puts it back from the history', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#jobs')
  await page.locator('.job-row', { hasText: 'Harbour Lights Festival' }).click()
  await page.getByRole('tab', { name: 'Quote' }).click()
  await page.getByRole('link', { name: 'Open the quote' }).click()

  const facts = page.locator('.quote-facts')
  await expect(facts).toContainText(/^Quote \d+/)
  const number = /^Quote (\d+)/.exec((await facts.textContent()) ?? '')![1]!

  await page.getByRole('button', { name: 'Delete version 2…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete version 2 of the quote for Harbour Lights Festival?' })
  await expect(dialog).toBeVisible()
  // What makes it matter, first; the safe answer has the focus.
  await expect(dialog).toContainText('The client accepted it')
  await expect(dialog).toContainText(`as quote ${number}. Their link to it stops working.`)
  await expect(dialog).toContainText('The job is confirmed.')
  await expect(dialog).toContainText("It's the newest version: version 1 becomes the one that counts.")
  await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused()

  // Off until the number is typed, and Keep it leaves it as it was.
  const field = dialog.getByLabel(`Type the quote number, ${number}, to delete it`)
  const del = dialog.getByRole('button', { name: 'Delete version 2' })
  await expect(del).toBeDisabled()
  await field.fill('delete')
  await expect(del).toBeDisabled()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Delete version 2…' })).toBeFocused()

  await page.getByRole('button', { name: 'Delete version 2…' }).click()
  await field.fill(number)
  await del.click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('group', { name: 'Versions' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Version 1', exact: true })).toBeVisible()
  await expect(page.locator('.conn')).toHaveText('Up to date')

  // The job's history says so, and puts it back.
  await page.goto(`/#history/job/${encodeURIComponent(new URL(page.url()).hash.split('/')[1]!)}`)
  const entry = page.locator('.entry', { hasText: `Deleted version 2 of the quote for Harbour Lights Festival, quote ${number}` })
  await expect(entry).toBeVisible()
  await entry.getByRole('button', { name: 'Put the quote back' }).click()
  await expect(entry.getByRole('button', { name: 'Put the quote back' })).toHaveCount(0)
  await page.goBack()
  await expect(page.getByRole('group', { name: 'Versions' }).getByRole('button')).toHaveCount(2)
})
