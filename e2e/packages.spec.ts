import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * A package is a shortcut for its kit (ADR 0116): on a quote, its line with each product it holds a line under it,
 * folded on screen and printed open; a rack shows what's built into it the same way; a quote's kit can be saved as a
 * package; and a package's kit goes on a job's kit list in one press.
 */

const phoneSize = { width: 390, height: 844 }

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `packages-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `packages-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

async function ready(page: Page, hash: string) {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

test('a package and a rack go on a quote with their kit under them, and a quote’s kit is saved as a package', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const day = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
  const bulk = { department: 'audio', category: 'Sound', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }
  await push(request, id, [
    ['model.create', { id: `mic-${id}`, name: `Shure SM58 ${id}`, ...bulk }],
    ['model.create', { id: `di-${id}`, name: `DI box ${id}`, ...bulk }],
    ['model.create', { id: `amp-${id}`, name: `Lab Gruppen D80 ${id}`, ...bulk, tracking: 'serialised', rackMount: true, units: 2 }],
    ['model.create', { id: `rack-${id}`, name: `Amp rack ${id}`, department: 'audio', category: 'Racks', tracking: 'serialised', isCase: true, isRack: true, valueCents: null, notes: '', units: 6, depthMm: 600 }],
    ['rackSlot.set', { id: `slot-${id}`, rackId: `rack-${id}`, modelId: `amp-${id}`, top: 1, side: 'front', qty: 1, notes: '' }],
    ['price.product', { modelId: `mic-${id}`, dayCents: 1_000 }],
    ['price.product', { modelId: `di-${id}`, dayCents: 500 }],
    ['price.product', { modelId: `rack-${id}`, dayCents: 15_000 }],
    ['package.save', { id: `pkg-${id}`, name: `Small PA ${id}`, department: 'audio', dayCents: 0, rate: 'daily', items: [{ modelId: `mic-${id}`, qty: 4 }, { modelId: `di-${id}`, qty: 2 }], notes: '' }],
    ['project.create', { id: `job-${id}`, name: `Launch ${id}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `ph-${id}`, projectId: `job-${id}`, name: 'Show', start: day, end: day, venueId: null, notes: '' }],
    ['quote.save', { id: `q-${id}`, projectId: `job-${id}`, lines: [], discountPct: 0, notes: '' }],
  ])

  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office, `#jobs/job-${id}/quote`)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })

  // A package with no price of its own: its line comes to what its kit does, each at the price list's price.
  await draft.getByRole('button', { name: 'Add a package' }).click()
  await draft.getByRole('button', { name: 'Add', exact: true }).click()
  await draft.getByRole('button', { name: 'Done' }).click()
  const set = draft.locator('.quote-set', { hasText: `Small PA ${id}` })
  await expect(set.locator('.quote-line-shut').first()).toContainText('Its kit at its own prices')
  await expect(set.locator('.quote-line-shut').first()).toContainText('€50.00')
  await expect(set.locator('.set-lines .quote-line-shut')).toHaveCount(2)
  // Each is a line to change for this job: one more mic, and the package comes to more.
  await set.getByRole('button', { name: new RegExp(`Shure SM58 ${id}, change it`) }).click()
  await draft.getByLabel(/^Line \d+: how many$/).fill('5')
  await draft.getByRole('button', { name: 'Done' }).click()
  await expect(set.locator('.quote-line-shut').first()).toContainText('€60.00')
  // Folded away, a press brings it back.
  await set.getByRole('button', { name: 'Hide what’s in it' }).click()
  await expect(set.getByRole('button', { name: 'What’s in it (2 lines)' })).toBeVisible()
  await expect(set.locator('.set-lines')).toHaveCount(0)

  // A rack goes on with what's built into it, in its price.
  await draft.getByRole('button', { name: 'Add kit' }).click()
  await draft.getByLabel('Kit to add').fill(`Amp rack ${id}`)
  await draft.getByRole('option', { name: new RegExp(`Amp rack ${id}`) }).click()
  await draft.getByRole('button', { name: 'Done' }).click()
  const rack = draft.locator('.quote-set', { hasText: `Amp rack ${id}` })
  await rack.getByRole('button', { name: 'What’s in it (1 line)' }).click()
  await expect(rack.locator('.set-lines')).toContainText(`Lab Gruppen D80 ${id}`)
  await expect(rack.locator('.set-lines')).toContainText('Included')
  await expect(draft.getByRole('button', { name: /with no price/ })).toHaveCount(0)
  await expect(draft.getByRole('group', { name: 'What it comes to' })).toContainText('Before VAT €210.00')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // On paper, the package's kit and the rack's are printed under them.
  await office.evaluate(() => (window.print = () => undefined))
  await draft.getByRole('button', { name: 'Print a draft' }).click()
  const printed = office.locator('.print-sheet.quote-sheet')
  await expect(printed.locator('tr.set-line', { hasText: `DI box ${id}` })).toContainText('€10.00')
  await expect(printed.locator('tr.set-line', { hasText: `Lab Gruppen D80 ${id}` })).toContainText('Included')
  await office.evaluate(() => dispatchEvent(new Event('afterprint')))

  // The quote's kit saved as a package, to start the next from: each product once, with how many.
  await draft.getByRole('button', { name: 'Save the kit as a package' }).click()
  const save = draft.getByRole('form', { name: 'Save as a package' })
  await expect(save.getByLabel(`How many Shure SM58 ${id}`)).toHaveValue('5')
  await save.getByLabel('Name').fill(`Launch kit ${id}`)
  await save.getByLabel('Name').press('Enter')
  await expect(save).toHaveCount(0)
  await ready(office, '#jobs/money/prices')
  await expect(office.getByRole('region', { name: 'Packages', exact: true }).locator('.package-row', { hasText: `Launch kit ${id}` })).toContainText('Its products’ own prices')

  // A package's kit on the job's kit list in one press.
  await ready(office, `#jobs/job-${id}/kit`)
  await office.getByRole('button', { name: 'Add kit' }).click()
  const addPackage = office.getByRole('form', { name: 'Add a package' })
  await addPackage.getByLabel('Package').selectOption({ label: `Small PA ${id}` })
  await addPackage.getByRole('button', { name: 'Add its kit' }).click()
  await expect(addPackage.getByRole('status')).toHaveText(`Added what Small PA ${id} holds: 2 products.`)
  await expect(office.getByRole('region', { name: 'Kit' })).toContainText(`DI box ${id}`)
})
