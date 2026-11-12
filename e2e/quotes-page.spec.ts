import { expect, test } from '@playwright/test'

/**
 * Quotes isn't a page of its own (Colly, 12 November 2026: "quotes are generated within the context of a Job, and the quote is
 * just a status of it"). Each job's quote is its Quote tab; Jobs finds jobs by where their quote stands (Filter › Quote); the
 * ones waiting on the office are Money › To follow up, where Quotes' old addresses go. Uses the made-up data (ADR 0019): the
 * gala's quote invoiced, Harbour Lights' accepted, Corrib Arts Week's sent.
 */

const deskSize = { width: 1280, height: 900 }
const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test('quotes live on their jobs: no Quotes place, its addresses go to To follow up, and Jobs filters by the quote', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const desk = await (await browser.newContext({ viewport: deskSize })).newPage()
  await desk.goto('/#home')
  const bar = desk.getByRole('navigation', { name: 'Areas' })
  await expect(bar.getByRole('link')).toHaveText(['Home', 'Jobs', 'Stock', /^Crew/, 'Menu'])

  // An old link to Quotes, or one of its views, lands on what's waiting, under Money, with Jobs' tab lit.
  for (const old of ['#quotes', '#quotes/sent']) {
    await desk.goto(`/${old}`)
    await expect(desk).toHaveURL(/#jobs\/money\/follow-up$/)
    await expect(desk.getByRole('region', { name: 'To follow up' })).toContainText('Corrib Arts Week')
    await expect(bar.getByRole('link', { name: 'Jobs' })).toHaveAttribute('aria-current', 'page')
  }
  await expect(desk.getByRole('tab', { name: 'To follow up' })).toHaveAttribute('aria-selected', 'true')
  await expect(desk.locator('.page-title-row').getByRole('link', { name: 'New quote' })).toHaveAttribute('href', '#quotes/new')

  // New quote keeps its page, under Jobs.
  await desk.goto('/#quotes/new')
  await expect(desk.getByRole('form', { name: 'New quote' })).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Jobs' })).toHaveAttribute('aria-current', 'page')

  // Jobs narrows by where each job's quote stands.
  await desk.goto('/#jobs')
  await desk.getByRole('button', { name: /^Filter/ }).click()
  await desk.getByRole('combobox', { name: 'Quote', exact: true }).selectOption('accepted')
  const table = desk.locator('.job-table')
  await expect(table.getByRole('link', { name: /Harbour Lights/ })).toBeVisible()
  await expect(table.getByRole('link', { name: /Corrib Arts Week/ })).toHaveCount(0)

  // On a phone the Menu has no Quotes; Money says what it holds.
  const phone = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await phone.goto('/#menu')
  const places = phone.getByRole('navigation', { name: 'Every place' })
  await expect(places.getByRole('link', { name: /^Quotes/ })).toHaveCount(0)
  await expect(places.getByRole('link', { name: /^Money/ })).toContainText('Quotes to follow up')

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})
