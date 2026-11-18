import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * A quote line's everyday numbers changed on its row (Colly, 18 November 2026): how many, days, price and discount, with
 * the pencil for the rest and no words under the name; and each department's subtotal at the end of its group.
 */

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `quick-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `quick-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

async function ready(page: Page, hash: string) {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const line = (id: string, what: string, group: string, qty: number, cents: number, per: 'day' | 'once' = 'day') => ({ id, kind: 'other', what, ref: null, group, qty, days: 1, unitCents: cents, vat: '23', per })

async function setUp(request: APIRequestContext) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  await push(request, id, [
    ['project.create', { id: `job-${id}`, name: `Quick ${id}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `ph-${id}`, projectId: `job-${id}`, name: 'Show', start: day(30), end: day(30), venueId: null, notes: '' }],
    [
      'quote.save',
      {
        id: `q-${id}`,
        projectId: `job-${id}`,
        lines: [line(`a-${id}`, 'D&B D20 Amplifier', 'Audio', 2, 6_000), line(`b-${id}`, 'Shure SM58', 'Audio', 4, 1_000), line(`c-${id}`, 'Delivery', 'Transport', 1, 15_000, 'once')],
        discountPct: 0,
        notes: '',
      },
    ],
  ])
  return id
}

for (const width of [320, 390]) {
  test(`on a ${width}px phone the numbers change on the row, the row fits, and each department ends with its subtotal`, async ({ browser, request }) => {
    const id = await setUp(request)
    const page = await (await browser.newContext({ viewport: { width, height: 844 } })).newPage()
    await ready(page, `#jobs/job-${id}/quote`)
    const draft = page.getByRole('form', { name: 'Version 1, a draft' })
    const audio = draft.getByRole('group', { name: 'Audio' })

    // No words under the name: the boxes say it.
    await expect(draft.getByText('2 × €60.00 a day × 1 day')).toHaveCount(0)
    await expect(audio.locator('.group-total')).toHaveText(/Audio subtotal\s*€160\.00/)
    await expect(draft.getByRole('group', { name: 'Transport' }).locator('.group-total')).toHaveText(/Transport subtotal\s*€150\.00/)

    // Changed in place, without opening the line.
    await draft.getByLabel('Line 1: how many').fill('3')
    await draft.getByLabel('Line 1: days charged').fill('2')
    await draft.getByLabel('Line 1: discount, %').fill('10')
    await expect(audio.locator('.quote-line-shut').first().locator('.amount')).toHaveText('€324.00')
    await expect(audio.locator('.group-total')).toHaveText(/€364\.00/)
    // A once line has no days to change.
    await expect(draft.getByLabel(/^Line 3: days/)).toHaveCount(0)
    await expect(draft.getByLabel('Line 3: price, once')).toHaveValue('150')

    // The pencil still opens the line for the rest.
    await draft.getByRole('button', { name: 'Line 2: Shure SM58, change it' }).click()
    await expect(draft.getByLabel('Line 2: charged')).toBeVisible()
    await draft.getByRole('button', { name: 'Done', exact: true }).click()

    // A bad number shows once the line is left, beside the row.
    await draft.getByLabel('Line 2: how many').fill('0')
    await draft.getByLabel('Line 2: price, a day').focus()
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await expect(draft.getByLabel('Line 2: how many')).toHaveAttribute('aria-invalid', 'true')

    await draft.locator(".quote-main").screenshot({ path: `test-results/quick-edit-${width}-before.png` })
    // Nothing runs off the side, and no number box clips its number.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const clipped = await page.$$eval('.quick-fields input', (els) => els.filter((e) => (e as HTMLInputElement).scrollWidth > (e as HTMLInputElement).clientWidth + 1).map((e) => `${e.getAttribute('aria-label')} ${(e as HTMLInputElement).scrollWidth}>${(e as HTMLInputElement).clientWidth}`))
    expect(clipped).toEqual([])

    await draft.getByLabel('Line 2: how many').fill('4')
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await audio.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `test-results/quick-edit-${width}.png`, fullPage: true })
  })
}

test('on a desk the four keep their widths under the name, and on a wide screen a line is one row', async ({ browser, request }) => {
  const id = await setUp(request)
  for (const width of [1280, 1100]) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage()
    await ready(page, `#jobs/job-${id}/quote`)
    const draft = page.getByRole('form', { name: 'Version 1, a draft' })
    const row = draft.locator('.quote-line-shut').first()
    const box = async (s: string) => (await row.locator(s).first().boundingBox())!
    expect((await box('.quick-fields')).width).toBeLessThanOrEqual(24 * 16 + 1)
    await draft.locator('.quote-main').screenshot({ path: `test-results/quick-edit-desk-${width}.png` })
    await page.close()
  }
})
