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

/** How far the middle of what a line comes to (its first line, not its notes) is from the middle of the line's name. */
async function totalOffName(page: Page) {
  return page.locator('.quote-line-shut.quick').first().evaluate((row) => {
    const mid = (r: DOMRect) => r.top + r.height / 2
    const amount = row.querySelector('.amount')!
    const range = document.createRange()
    range.selectNodeContents(amount.firstChild!)
    const name = row.querySelector('.what')!
    const nameRange = document.createRange()
    nameRange.selectNodeContents(name)
    const pencil = row.querySelector('.opener')!.getBoundingClientRect()
    const nameLine = nameRange.getClientRects()[0]!
    return { total: Math.abs(mid(range.getBoundingClientRect()) - mid(nameLine)), pencil: Math.abs(mid(pencil) - mid(nameLine)) }
  })
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
        lines: [{ ...line(`a-${id}`, 'D&B D20 Amplifier', 'Audio', 2, 6_000), costCents: 2_000 }, line(`b-${id}`, 'Shure SM58', 'Audio', 4, 1_000), line(`c-${id}`, 'Delivery', 'Transport', 1, 15_000, 'once')],
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
    // What it comes to sits on the name's line, its notes under it, and the pencil on that line too (Colly, 18 November 2026).
    await expect(audio.locator('.quote-line-shut').first().locator('.line-margin')).toBeVisible()
    const off = await totalOffName(page)
    expect(off.total).toBeLessThan(2)
    expect(off.pencil).toBeLessThan(2)
    await expect(draft.getByRole('group', { name: 'Transport' }).locator('.group-total')).toHaveText(/Transport subtotal\s*€150\.00/)

    // Changed in place, without opening the line.
    await draft.getByLabel('Line 1: how many').fill('3')
    await draft.getByLabel('Line 1: days charged').fill('2')
    await draft.getByLabel('Line 1: discount, %').fill('10')
    await expect(audio.locator('.quote-line-shut').first().locator('.amount')).toHaveText('€324.00makes €304.00')
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
    const off = await totalOffName(page)
    expect(off.total).toBeLessThan(2)
    await draft.locator('.quote-main').screenshot({ path: `test-results/quick-edit-desk-${width}.png` })
    await page.close()
  }
})

test('a department is dragged into place by the grip at the right of its head, or moved with the keys', async ({ browser, request }) => {
  const id = await setUp(request)
  for (const width of [390, 1280]) {
    const page = await (await browser.newContext({ viewport: { width, height: 844 } })).newPage()
    await ready(page, `#jobs/job-${id}/quote`)
    const draft = page.getByRole('form', { name: 'Version 1, a draft' })
    const order = () => draft.locator('.quote-group-item .group-head h3').allTextContents()
    await expect.poll(order).toEqual(['Audio', 'Transport'])
    // No Up and Down links any more; the grip sits at the right of the head, in line with its name.
    await expect(draft.getByRole('button', { name: 'Move Audio up' })).toHaveCount(0)
    const audioHead = draft.getByRole('group', { name: 'Audio' }).locator('.group-head')
    const grip = draft.getByRole('button', { name: 'Move Audio', exact: true })
    const g = (await grip.boundingBox())!
    const h = (await audioHead.locator('h3').boundingBox())!
    const head = (await audioHead.boundingBox())!
    expect(Math.abs(g.y + g.height / 2 - (h.y + h.height / 2))).toBeLessThan(3)
    expect(Math.abs(g.x + g.width - (head.x + head.width))).toBeLessThan(10)
    await audioHead.screenshot({ path: `test-results/quote-grip-${width}.png` })

    if (width === 1280) {
      // Dragged by the grip: Transport above Audio.
      const t = (await draft.getByRole('button', { name: 'Move Transport', exact: true }).boundingBox())!
      await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2)
      await page.mouse.down()
      await page.mouse.move(t.x + t.width / 2, h.y - 10, { steps: 10 })
      await page.mouse.up()
      await expect.poll(order).toEqual(['Transport', 'Audio'])
    } else {
      // Pressed, then the arrow and Space: Audio below Transport.
      await grip.click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Space')
      await expect.poll(order).toEqual(['Transport', 'Audio'])
      await expect(draft.locator('[aria-live="polite"].sr-only')).toContainText('Audio put down, 2 of 2')
      // Back, for the desk's turn.
      await draft.getByRole('button', { name: 'Move Audio', exact: true }).click()
      await page.keyboard.press('ArrowUp')
      await page.keyboard.press('Space')
      await expect.poll(order).toEqual(['Audio', 'Transport'])
    }
    await expect(draft.locator('.save-state')).toHaveText('Saved')
    await page.close()
  }
})
