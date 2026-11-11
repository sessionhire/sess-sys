import { expect, test } from '@playwright/test'

/**
 * Quotes (ADR 0088): every quote in one place. On a desk it's in the
 * sidebar beside Jobs; a phone's bar keeps its five, so there it's on the
 * Menu and lights the Menu's tab. The list finds a quote by its client or
 * invoice, narrows to what it is, and opens on the job's quote. Uses the
 * made-up data (ADR 0019): the gala's quote invoiced, Harbour Lights'
 * accepted, Corrib Arts Week's sent.
 */

const deskSize = { width: 1280, height: 900 }
const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test('Quotes is in the sidebar on a desk and lists every quote, to find and open', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const desk = await (await browser.newContext({ viewport: deskSize })).newPage()
  await desk.goto('/#home')
  const bar = desk.getByRole('navigation', { name: 'Areas' })
  await expect(bar.getByRole('link')).toHaveText(['Home', 'Jobs', 'Quotes', 'Stock', /^Crew/, 'Menu'])
  await bar.getByRole('link', { name: 'Quotes' }).click()
  await expect(desk.getByRole('heading', { level: 1, name: 'Quotes' })).toBeVisible()
  await expect(desk).toHaveTitle('Quotes · Session Hire')
  await expect(bar.getByRole('link', { name: 'Quotes' })).toHaveAttribute('aria-current', 'page')

  // What's waiting first; then every quote, a view each by where it stands (review of 11 November 2026, finding 7), with New quote
  // on the title's line and the search above the views.
  await expect(desk.getByRole('region', { name: 'To follow up' })).toContainText('Corrib Arts Week')
  await expect(desk.locator('.page-title-row').getByRole('link', { name: 'New quote' })).toHaveAttribute('href', '#quotes/new')
  const views = desk.getByRole('navigation', { name: 'Quotes views' })
  await expect(views.getByRole('link')).toHaveText(['To follow up', 'Not sent', 'Sent', 'Accepted', 'Turned down', 'All'])
  await views.getByRole('link', { name: 'All' }).click()
  const all = desk.getByRole('region', { name: 'All quotes' })
  await expect(all.getByRole('listitem')).toHaveCount(3)
  await expect(all.getByRole('listitem').filter({ hasText: 'Autumn Gala' })).toContainText('Invoiced')

  // Narrowed by what it is, and found by its invoice; the search holds from one view to the next.
  await views.getByRole('link', { name: 'Accepted' }).click()
  const accepted = desk.getByRole('region', { name: 'Accepted quotes' })
  await expect(accepted.getByRole('listitem')).toHaveCount(2)
  await expect(accepted).not.toContainText('Corrib Arts Week')
  await desk.getByLabel('Find a quote').fill('sh-1042')
  await expect(accepted.getByRole('listitem')).toHaveCount(1)
  await views.getByRole('link', { name: 'All' }).click()
  await expect(all.getByRole('listitem')).toHaveCount(1)
  await all.getByRole('link', { name: 'Autumn Gala' }).click()
  await expect(desk).toHaveURL(/#jobs\/[^/]+\/quote$/)
  // The page lands on the job's Quote tab once it's drawn (ADR 0140, part 4): pressed before then, a press can meet the page mid-scroll.
  await expect(desk.getByRole('tab', { name: 'Quote' })).toBeFocused()

  // On a phone the bar keeps its five: Quotes is on the Menu, and keeps the Menu's tab.
  const phone = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await phone.goto('/#menu')
  const phoneBar = phone.getByRole('navigation', { name: 'Areas' })
  await expect(phoneBar.getByRole('link')).toHaveText(['Home', 'Jobs', 'Stock', /^Crew/, 'Menu'])
  await phone.getByRole('navigation', { name: 'Every place' }).getByRole('link', { name: /^Quotes/ }).click()
  await expect(phone.getByRole('heading', { level: 1, name: 'Quotes' })).toBeVisible()
  await expect(phoneBar.getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page')

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})
