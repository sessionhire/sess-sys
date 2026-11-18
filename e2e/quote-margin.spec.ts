import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * A quote line's discount box says how the line stands against its product's margin target (Colly, 18 November 2026;
 * ADR 0188): green while it makes the target, orange from half of it, red under half. The office sets the target for every
 * product in Admin, as a share of what one cost to buy, a day; a product can ask for more on its own page.
 */

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `margin-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `margin-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

async function ready(page: Page, hash: string) {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const product = (id: string, name: string, euro: number) => ({ id, name, department: 'audio', category: 'Amplifiers', tracking: 'bulk', isCase: false, valueCents: euro * 100, notes: '' })
const kit = (id: string, modelId: string, what: string, cents: number) => ({ id, kind: 'kit', what, ref: null, group: 'Audio', qty: 1, days: 1, unitCents: cents, vat: '23', per: 'day', modelId })

test('the discount box goes green, orange or red by the margin a line makes against its target', async ({ browser, request }) => {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  await push(request, id, [
    // €200 to buy, so at 10% a day it should make €20 a day; the second asks for 20% of its own, €40.
    ['model.create', product(`amp-${id}`, `Amp ${id}`, 200)],
    ['model.create', product(`sub-${id}`, `Sub ${id}`, 200)],
    ['model.update', { id: `sub-${id}`, marginPct: 20 }],
    ['project.create', { id: `job-${id}`, name: `Margin ${id}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `ph-${id}`, projectId: `job-${id}`, name: 'Show', start: day(30), end: day(30), venueId: null, notes: '' }],
    ['quote.save', { id: `q-${id}`, projectId: `job-${id}`, lines: [kit(`a-${id}`, `amp-${id}`, 'Amp', 3_000), kit(`b-${id}`, `sub-${id}`, 'Sub', 3_000)], discountPct: 0, notes: '' }],
  ])
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()

  // Admin › Company: the target for every product.
  await ready(page, '#admin/company')
  const card = page.getByRole('region', { name: 'Margin target' })
  await card.getByLabel('Each product should make').fill('200')
  await card.getByRole('button', { name: 'Save' }).click()
  await expect(card.getByRole('alert')).toContainText('from 0.1 to 100')
  await card.getByLabel('Each product should make').fill('10')
  await card.getByRole('button', { name: 'Save' }).click()
  await expect(card.getByRole('alert')).toHaveCount(0)

  try {
    await page.goto(`/#jobs/job-${id}/quote`)
    const draft = page.getByRole('form', { name: 'Version 1, a draft' })
    const box = (n: number) => draft.getByLabel(`Line ${n}: discount, %`).locator('xpath=..')
    // €30 a day against €20: green. Against the Sub's own €40: orange.
    await expect(box(1)).toHaveClass(/tone-good/)
    await expect(box(1)).toHaveAttribute('title', 'Makes its margin target')
    await expect(box(2)).toHaveClass(/tone-short/)
    // 40% off leaves €18, more than half of €20: orange. 70% off leaves €9, under half: red.
    await draft.getByLabel('Line 1: discount, %').fill('40')
    await expect(box(1)).toHaveClass(/tone-short/)
    await draft.getByLabel('Line 1: discount, %').fill('70')
    await expect(box(1)).toHaveClass(/tone-bad/)
    await expect(draft.getByLabel('Line 1: discount, %')).toHaveAttribute('aria-description', 'Under half its margin target')
    await draft.getByLabel('Line 1: discount, %').fill('')
    await expect(box(1)).toHaveClass(/tone-good/)
    await draft.locator('.quote-main').screenshot({ path: 'test-results/quote-margin-desk.png' })

    // The product's own page: its target only ever above the office's.
    await page.goto(`/#stock/product/amp-${id}`)
    await expect(page.getByText("10% of its value a day, the office's")).toBeVisible()
    await page.getByRole('button', { name: 'Change details' }).click()
    await page.getByLabel(/^Margin target, a day/).fill('5')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('alert')).toContainText("above the office's 10%")
    await page.getByLabel(/^Margin target, a day/).fill('20')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('20% of its value a day')).toBeVisible()
    // Now it should make €40, and €30 is orange.
    await page.goto(`/#jobs/job-${id}/quote`)
    await expect(box(1)).toHaveClass(/tone-short/)
  } finally {
    // Back as it was, for the other tests.
    await page.goto('/#admin/company')
    await card.getByLabel('Each product should make').fill('')
    await card.getByRole('button', { name: 'Save' }).click()
    await expect(card.getByLabel('Each product should make')).toHaveValue('')
  }
  // With no target for every product, a product's own still counts: both of these have one.
  await page.goto(`/#jobs/job-${id}/quote`)
  await expect(page.getByRole('form', { name: 'Version 1, a draft' }).locator('.unit-box.tone-short')).toHaveCount(2)
})
