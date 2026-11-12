import { expect, test } from '@playwright/test'

/**
 * The client accepts a quote online (ADR 0121): off until the office turns
 * it on under Admin; then a quote with the client has its link, the client
 * accepts there with their name and a tick, and the quote says who and when.
 * Uses the made-up data (ADR 0019): Corrib Arts Week's quote is with the client.
 */

const deskSize = { width: 1280, height: 900 }
const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test('a client accepts a quote on its link, once the office has turned it on', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: deskSize })).newPage()

  // Off: no link on the quote.
  await office.goto('/#jobs/money/follow-up')
  await office.getByRole('region', { name: 'To follow up' }).getByRole('link', { name: 'Corrib Arts Week' }).first().click()
  await expect(office.getByRole('heading', { level: 1, name: 'Corrib Arts Week' })).toBeVisible()
  await expect(office.getByRole('button', { name: "Copy the client's link" })).toHaveCount(0)
  const quoteAt = office.url()

  // Turned on under Admin › Company.
  await office.goto('/#admin')
  const card = office.getByRole('region', { name: 'Quotes accepted online' })
  await card.getByRole('switch', { name: /Let clients accept quotes online/ }).click()
  await expect(card).toContainText('On: each quote with the client has its link')
  await expect(office.locator('.conn')).toHaveText('Up to date')

  await office.goto(quoteAt)
  await expect(office.getByRole('button', { name: "Copy the client's link" })).toBeVisible()
  const link = (await office.getByRole('link', { name: 'Open it as they see it' }).getAttribute('href'))!
  expect(link).toMatch(/\/q\/[A-Za-z0-9_-]{24}$/)

  // The client, on a phone: the quote, then their name and a tick.
  const client = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await client.goto(link)
  await expect(client.getByRole('heading', { level: 1, name: 'Corrib Arts Week' })).toBeVisible()
  await expect(client.getByRole('region', { name: 'The quote' })).toContainText('Total')
  await client.getByRole('button', { name: 'Accept the quote' }).click()
  // The browser asks for the name first, as it's required.
  await client.getByLabel('Your full name').fill('Aisling Byrne')
  await client.getByRole('button', { name: 'Accept the quote' }).click()
  await client.getByRole('checkbox', { name: /I accept this quote/ }).check()
  await client.getByRole('button', { name: 'Accept the quote' }).click()
  await expect(client.getByRole('status')).toContainText('Accepted by Aisling Byrne')
  await expect(client.getByRole('button', { name: 'Accept the quote' })).toHaveCount(0)

  // The office sees who and when.
  await office.reload()
  await expect(office.getByText(/Accepted online by Aisling Byrne/)).toBeVisible()
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})
