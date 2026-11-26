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

  // A dry hire: no venue to ask for. Delivered, its days are From and To with a delivery address (ADR 0183); collected,
  // they're Collection and Return, each with a time.
  await expect(form.getByRole('combobox', { name: 'Venue' })).toBeVisible()
  await form.getByRole('radio', { name: 'A dry hire' }).check()
  await expect(form.getByRole('combobox', { name: 'Venue' })).toHaveCount(0)
  await form.getByRole('radio', { name: 'Delivery' }).check()
  await expect(form.getByRole('textbox', { name: 'From', exact: true })).toBeVisible()
  await expect(form.getByRole('textbox', { name: 'To', exact: true })).toBeVisible()
  await expect(form.getByLabel('Delivery address')).toBeVisible()
  await form.getByRole('radio', { name: 'Collection' }).check()
  await expect(form.getByLabel('Delivery address')).toHaveCount(0)
  await expect(form.getByRole('textbox', { name: 'Collection', exact: true })).toBeVisible()
  await expect(form.getByRole('textbox', { name: 'Return', exact: true })).toBeVisible()
  await form.getByLabel('Collection time').fill('10:00')
  await form.getByText('More about the enquiry').click()
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
  await expect(sheet.locator('.sheet-to')).toContainText(/Collection \w{3} \d{1,2} \w{3}, 10:00/)
  await expect(sheet.locator('.sheet-to')).toContainText('Return ')
  await expect(sheet.locator('tbody').first().locator('tr')).toHaveText([/^PA$/, 'All cabling and power included', /^Speaker stands/, /^PA speakers/])
  await expect(sheet.locator('tr.words td')).toHaveAttribute('colspan', '6')

  // The job is a dry hire, one Hire day, with no venue.
  await ready(office, `#jobs`)
  await expect(office.locator('main')).toContainText(`Speakers for a wedding ${id}`)
})

test("a dry hire that's delivered puts a delivery line on its quote, by the km at Admin's price (ADR 0183)", async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const day = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
  // Galway, on the map: about 160 km from Dublin as the crow flies, so over 190 by road.
  const hire = { handover: 'delivery', outTime: '09:00', backTime: '18:00', address: 'Galway Racecourse, Ballybrit', pin: { lat: 53.2985, lng: -8.9839 } }
  await push(request, id, [
    ['quoting.delivery', { centsPerKm: 150 }],
    ['project.create', { id: `dh-${id}`, name: `Delivered hire ${id}`, clientId: null, venueId: null, status: 'enquiry', kind: 'hire', notes: '', hire }],
    ['phase.add', { id: `dh-p-${id}`, projectId: `dh-${id}`, name: 'Hire', start: day, end: day, venueId: null, notes: '' }],
    ['quote.save', { id: `dh-q-${id}`, projectId: `dh-${id}`, lines: [], discountPct: 0, notes: '' }],
  ])
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.addInitScript(() => void (window.print = () => undefined))
  await ready(office, `#jobs/dh-${id}/quote`)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  const delivery = draft.getByRole('group', { name: 'Delivery and collection' })
  await expect(delivery.locator('.quote-line-shut .what')).toHaveText(/^Van, delivery and collection, \d{3} km from (the warehouse|Dublin)$/)
  await expect(delivery.locator('.quote-line-shut .how')).toContainText('km × €1.50 a km')
  await expect(delivery.getByRole('radio', { name: 'Van' })).toBeChecked()
  await delivery.getByRole('button', { name: /where it goes$/ }).click()
  await expect(delivery).toContainText('Delivered to Galway Racecourse, Ballybrit')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // Printed: From and To with their times, where it's delivered, and the line.
  await draft.getByRole('button', { name: 'Print a draft' }).click()
  const sheet = office.locator('.print-sheet.quote-sheet')
  await expect(sheet.locator('.sheet-to')).toContainText(/From \w{3} \d{1,2} \w{3}, 09:00/)
  await expect(sheet.locator('.sheet-to')).toContainText(/To \w{3} \d{1,2} \w{3}, 18:00/)
  await expect(sheet.locator('.sheet-to')).toContainText('Delivered to Galway Racecourse, Ballybrit')
  await expect(sheet.locator('tbody').first()).toContainText(/Van, delivery and collection, \d{3} km/)
  await office.evaluate(() => dispatchEvent(new Event('afterprint')))

  // Admin › Company: a set amount covers the first 20 km, and each km after is €1.50 (Colly, 15 November 2026).
  await office.goto('/#admin/company')
  const card = office.getByRole('region', { name: 'Delivery and collection' })
  await card.getByLabel('Set amount').fill('60')
  await card.getByLabel('Covers up to').fill('20')
  await card.getByLabel('Each km after').fill('1.50')
  await card.getByRole('button', { name: 'Save' }).click()
  await expect(card).toContainText('Now: €60.00 for up to 20 km, then €1.50 a km.')
  await ready(office, `#jobs/dh-${id}/quote`)
  await expect(delivery.locator('.quote-line-shut .what')).toHaveText(/^Dublin flat fee, then \d{3} km at €1\.50 a km$/)
  await expect(delivery.locator('.quote-line-shut .how')).toContainText('€60.00 for the first 20 km, then')
  await push(request, `${id}-off`, [['quoting.delivery', { baseCents: null, baseKm: null, centsPerKm: null }]])
})

test('any quote can go by van or truck, a truck priced for the job (ADR 0201)', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const day = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
  await push(request, id, [
    ['project.create', { id: `dt-${id}`, name: `Trucked show ${id}`, clientId: null, venueId: null, status: 'enquiry', kind: 'gig', notes: '' }],
    ['phase.add', { id: `dt-p-${id}`, projectId: `dt-${id}`, name: 'Show', start: day, end: day, venueId: null, notes: '' }],
    ['quote.save', { id: `dt-q-${id}`, projectId: `dt-${id}`, lines: [], discountPct: 0, notes: '' }],
  ])
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office, `#jobs/dt-${id}/quote`)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  const delivery = draft.getByRole('group', { name: 'Delivery and collection' })
  // A show starts with none, so a quote from before comes to what it did.
  await expect(delivery.getByRole('radio', { name: 'No delivery' })).toBeChecked()
  await expect(delivery.locator('.quote-line-shut')).toHaveCount(0)
  // By van, it's measured to the venue: with none on the map, it says so.
  await delivery.getByRole('radio', { name: 'Van' }).check()
  await expect(delivery.locator('.quote-line-shut .how')).toHaveText("The venue isn't on the map, so the distance isn't known.")
  // By truck, the office types this job's price.
  await delivery.getByRole('radio', { name: 'Truck' }).check()
  await delivery.getByLabel("The truck's price for this job, before VAT").fill('950')
  await expect(delivery.locator('.quote-line-shut .what')).toHaveText('Delivery and collection by truck')
  await expect(delivery.locator('.quote-line-shut .amount')).toHaveText('€950.00')
  // Only delivered (Colly, 26 November 2026): the line says so.
  await delivery.getByRole('radio', { name: 'Delivery only' }).check()
  await expect(delivery.locator('.quote-line-shut .what')).toHaveText('Delivery only by truck')
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  // Kept: read again, it's still the truck at its price.
  await office.reload()
  await ready(office, `#jobs/dt-${id}/quote`)
  await expect(delivery.getByRole('radio', { name: 'Truck' })).toBeChecked()
  await expect(delivery.getByRole('radio', { name: 'Delivery only' })).toBeChecked()
  await expect(delivery.locator('.quote-line-shut .amount')).toHaveText('€950.00')
})
