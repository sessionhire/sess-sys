import { expect, test } from '@playwright/test'

/**
 * Every view of the jobs has New job on its title's line, and Clients and Venues their own add (Colly, 10 November 2026).
 */

const id = Math.random().toString(36).slice(2, 8)

test('New job on the Board, the calendar and the week goes to the list with its form open', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const hash of ['#jobs/board', '#jobs/calendar', '#plan/week']) {
    await page.goto(`/${hash}`)
    await expect(page.getByRole('status')).toHaveText('Up to date')
    await page.getByRole('button', { name: 'New job', exact: true }).click()
    await expect(page).toHaveURL(/#jobs$/)
    await expect(page.getByRole('button', { name: 'Add job' })).toBeVisible()
    await expect(page.getByLabel('Job', { exact: true })).toBeFocused()
  }
})

test('New client and New venue add one and open its page, and a name already there is said', async ({ page }) => {
  await page.goto('/#jobs/clients')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('button', { name: 'New client' }).click()
  const client = page.getByRole('form', { name: 'New client' })
  await client.getByLabel('Name').fill(`Corrib Arts ${id}`)
  await client.getByRole('button', { name: 'Add client' }).click()
  await expect(page).toHaveURL(/#jobs\/clients\/[\w-]+$/)
  await expect(page.getByRole('heading', { level: 1, name: `Corrib Arts ${id}` })).toBeVisible()

  await page.goto('/#jobs/clients')
  await page.getByRole('button', { name: 'New client' }).click()
  await page.getByRole('form', { name: 'New client' }).getByLabel('Name').fill(`corrib arts ${id}`)
  await page.getByRole('form', { name: 'New client' }).getByRole('button', { name: 'Add client' }).click()
  await expect(page.getByText(`There's already a client called Corrib Arts ${id}.`)).toBeVisible()

  await page.goto('/#jobs/venues')
  await page.getByRole('button', { name: 'New venue' }).click()
  const venue = page.getByRole('form', { name: 'New venue' })
  await venue.getByLabel('Name').fill(`Town Hall ${id}`)
  await venue.getByLabel('Address').fill('Galway H91 X2YZ')
  await venue.getByRole('button', { name: 'Add venue' }).click()
  await expect(page).toHaveURL(/#jobs\/venues\/[\w-]+$/)
  await expect(page.getByRole('heading', { level: 1, name: `Town Hall ${id}` })).toBeVisible()
})
