import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * A line's product page opened from the quote (Colly, 26 November 2026), in a sheet over it, so the office doesn't lose its
 * place: the whole screen on a phone, from the end at a desk. Its tabs don't change the quote's address, Close or Escape puts
 * focus back where it was with the line still open, and Full page goes to the product's own page.
 */

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

async function setUp(request: APIRequestContext) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  const mutations: [string, Record<string, unknown>][] = [
    ['model.create', { id: `mic-${id}`, name: `Shure SM58 ${id}`, department: 'audio', category: 'Microphones', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }],
    ['project.create', { id: `job-${id}`, name: `Sheet ${id}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `ph-${id}`, projectId: `job-${id}`, name: 'Show', start: day(30), end: day(30), venueId: null, notes: '' }],
    [
      'quote.save',
      {
        id: `q-${id}`,
        projectId: `job-${id}`,
        lines: [
          { id: `l1-${id}`, kind: 'kit', what: `Shure SM58 ${id}`, ref: null, group: 'Audio', qty: 4, days: 1, unitCents: 1_000, vat: '23', per: 'day', modelId: `mic-${id}` },
          { id: `l2-${id}`, kind: 'other', what: 'Delivery', ref: null, group: 'Transport', qty: 1, days: 1, unitCents: 15_000, vat: '23', per: 'once' },
        ],
        discountPct: 0,
        notes: '',
      },
    ],
  ]
  const res = await request.post('/api/sync/push', {
    data: { clientId: `sheet-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `sheet-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
  return id
}

for (const [where, width] of [
  ['phone', 390],
  ['desk', 1280],
] as const) {
  test(`on a ${where} a quote line's product page opens over the quote and closes back to it`, async ({ browser, request }) => {
    const id = await setUp(request)
    const page = await (await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: process.env.SHOTS ? 2 : 1 })).newPage()
    await page.goto(`/#jobs/job-${id}/quote`)
    await expect(page.locator('.conn')).toHaveText('Up to date')
    const draft = page.getByRole('form', { name: 'Version 1, a draft' })

    // Only a line that's a product in the catalogue has one.
    await draft.getByRole('button', { name: 'Line 2: Delivery, change it' }).click()
    await expect(draft.getByRole('button', { name: 'Line 2: open its product page' })).toHaveCount(0)
    await draft.getByRole('button', { name: 'Done' }).click()

    await draft.getByRole('button', { name: `Line 1: Shure SM58 ${id}, change it` }).click()
    const opener = draft.getByRole('button', { name: 'Line 1: open its product page' })
    await opener.click()
    const sheet = page.getByRole('dialog', { name: `Shure SM58 ${id}` })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('heading', { level: 1, name: `Shure SM58 ${id}` })).toBeVisible()
    // Once it has slid in: the whole width on a phone; from the end at a desk, the quote still there beside it under the veil.
    await expect.poll(async () => Math.round((await sheet.boundingBox())!.x + (await sheet.boundingBox())!.width)).toBe(width)
    const box = (await sheet.boundingBox())!
    if (where === 'phone') expect(Math.round(box.width)).toBe(width)
    else expect(box.width).toBeLessThanOrEqual(680)
    if (process.env.SHOTS) await page.screenshot({ path: `/mnt/project-files/product-sheet/product-sheet-${where}.png` })
    // Its parts change without changing the quote's address.
    await sheet.getByRole('tab', { name: /On jobs/ }).click()
    await expect(sheet.getByRole('tab', { name: /On jobs/ })).toHaveAttribute('aria-selected', 'true')
    expect(new URL(page.url()).hash).toBe(`#jobs/job-${id}/quote`)

    // Escape shuts it, back on the button it came from, the line still open.
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(opener).toBeFocused()
    await expect(draft.getByLabel('Line 1: charged')).toBeVisible()

    // Full page goes to the product's own page.
    await opener.click()
    await page.getByRole('dialog').getByRole('link', { name: 'Full page' }).click()
    await expect(page).toHaveURL(new RegExp(`#stock/product/mic-${id}`))
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: `Shure SM58 ${id}` })).toBeVisible()
  })
}
