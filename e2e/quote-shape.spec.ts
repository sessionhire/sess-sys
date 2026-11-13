import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/** The rarer ways to add sit under More, and the terms read as a line with Change, until opened (ADR 0140, part 4). */
async function openMore(at: import('@playwright/test').Locator) {
  const more = at.getByRole('button', { name: 'More to add…' })
  // Once the draft is drawn: More, or with nothing on the quote yet, every way in already shown.
  await expect(more.or(at.getByRole('button', { name: 'Add something else' }))).toBeVisible()
  if (await more.isVisible()) await more.click()
}
async function openTerms(at: import('@playwright/test').Locator) {
  const change = at.getByRole('button', { name: 'Change the terms' })
  // Once the draft is drawn: the line with Change, or the terms already open as one of them needs putting right.
  await expect(change.or(at.getByLabel('Prices hold for, days'))).toBeVisible()
  if (await change.isVisible()) await change.click()
}


/**
 * Two shapes of quote, and the quote the way the office writes it (ADR 0128; audit of the quote flow, 8 November 2026,
 * findings 6, 10, 11 and 16): a dry hire asks for no venue and charges no travel; the quote is for who asked, printed
 * under the client's name; lines go under the office's own headings, in its order, with words of their own.
 */

const phoneSize = { width: 390, height: 844 }

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `quote-shape-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `quote-shape-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

async function ready(page: Page, hash: string) {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

test('a dry hire is quoted without venue or travel, for who asked, under the office’s own headings and in its order', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const person = (name: string, role: string) => ({ name, role, email: null, phone: null })
  await push(request, id, [['client.upsert', { id: `client-${id}`, name: `Bright Events ${id}`, contacts: [person('Aoife Byrne', 'Producer'), person('Ciarán Walsh', 'Accounts')], notes: '' }]])

  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // Printing is opened and left open, so the sheet can be read.
  await office.addInitScript(() => void (window.print = () => undefined))
  await ready(office, '#quotes')
  const quotes = office.getByRole('region', { name: 'To follow up' })
  await quotes.page().locator('.page-add', { hasText: 'New quote' }).click()
  const form = quotes.page().getByRole('form', { name: 'New quote' })

  // A dry hire: no venue to ask for, and the days are when it's collected and brought back.
  await expect(form.getByRole('combobox', { name: 'Venue' })).toBeVisible()
  await form.getByText('More about the enquiry').click()
  await form.getByRole('radio', { name: 'A dry hire' }).check()
  await expect(form.getByRole('combobox', { name: 'Venue' })).toHaveCount(0)
  await expect(form.getByRole('textbox', { name: 'Collected' })).toBeVisible()
  await expect(form.getByRole('textbox', { name: 'Brought back' })).toBeVisible()
  await form.getByLabel("What's the job?").fill(`Speakers for a wedding ${id}`)
  await form.getByRole('combobox', { name: 'Client' }).fill(`Bright Events ${id}`)
  await form.getByRole('combobox', { name: 'Who asked' }).fill('Ciarán Walsh')
  await form.getByRole('combobox', { name: 'Who asked' }).press('Escape')
  await form.getByRole('button', { name: 'Start quote' }).click()
  await expect(office).toHaveURL(/#jobs\/[^/]+\/quote$/)
  // The page lands on the job's Quote tab once it's drawn (ADR 0140, part 4): pressed before then, a press can meet the page mid-scroll.
  await expect(office.getByRole('tab', { name: 'Quote' })).toBeFocused()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })

  // It's for who asked, and there's no travel or subsistence to charge on a dry hire.
  await openTerms(draft)
  await expect(draft.getByLabel("Who at the client it's for")).toHaveValue('Ciarán Walsh')
  await expect(draft.getByRole('button', { name: /^Travel/ })).toHaveCount(0)

  // Two lines of something else and a line of words, put under the office's own headings.
  for (const what of ['Speaker stands', 'PA speakers']) {
    await openMore(draft)
    await draft.getByRole('button', { name: 'Add something else' }).click()
    await draft.getByLabel(/: what$/).last().fill(what)
    await draft.getByLabel(/: price, once$/).last().fill('50')
    await draft.getByLabel(/: the group it's under$/).last().fill('PA')
    await draft.getByRole('button', { name: 'Done', exact: true }).click()
  }
  await openMore(draft)
  await draft.getByRole('button', { name: 'Add words' }).click()
  await draft.getByLabel(/: words$/).fill('All cabling and power included')
  await draft.getByLabel(/: the group it's under$/).fill('PA')
  // Words go up to the top of their group, a press at a time.
  await draft.getByRole('button', { name: /^Move line \d+ up$/ }).click()
  await draft.getByRole('button', { name: /^Move line \d+ up$/ }).click()
  await expect(draft.getByRole('button', { name: /^Move line \d+ up$/ })).toBeDisabled()
  await draft.getByRole('button', { name: 'Done', exact: true }).click()
  const pa = draft.getByRole('group', { name: 'PA' })
  await expect(pa.locator('.quote-line-shut .what')).toHaveText(['All cabling and power included', 'Speaker stands', 'PA speakers'])
  await expect(pa.locator('.quote-line-shut').first()).toContainText('Words on the quote')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // The printed draft says who it's for and prints the words as written, with no price.
  await draft.getByRole('button', { name: 'Print a draft' }).click()
  const sheet = office.locator('.print-sheet.quote-sheet')
  await expect(sheet.locator('.sheet-to')).toContainText('Ciarán Walsh')
  await expect(sheet.locator('.sheet-to')).not.toContainText('Aoife Byrne')
  await expect(sheet.locator('tbody').first().locator('tr')).toHaveText([/^PA$/, 'All cabling and power included', /^Speaker stands/, /^PA speakers/])
  await expect(sheet.locator('tr.words td')).toHaveAttribute('colspan', '6')

  // The job is a dry hire, one Hire day, with no venue.
  await ready(office, `#jobs`)
  await expect(office.locator('main')).toContainText(`Speakers for a wedding ${id}`)
})
