import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * The LED screen builder on a quote (ADR 0207), end to end: Add LED screen opens a sheet that asks how big, which panel and
 * whether it's hung or ground stacked; a panel's size is asked the first time it's used and kept on its product; the kit that
 * makes the screen is listed with the reason for each count and what it comes to; and one press puts the screen on the quote
 * with that kit under it, in an LED screen group. Its line opens the builder again to change it, which says what the change
 * does before it's made.
 *
 * The stock is made once for both tests, named as a hire company's really is. The tests run in order: the first gives the
 * panel its size, and the second finds it kept.
 */

test.describe.configure({ mode: 'serial' })

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
// Letters only, so nothing in a product's name reads as a length or a weight.
const run = Array.from({ length: 6 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join('')
// Pictures for the pull request, taken only when asked for (SHOTS names the folder), once what's moving has arrived.
const shots = process.env.SHOTS
// Each run's stock has names of its own, since the tests share a server with every other file's. The pictures are taken
// with this file alone on a fresh server, so there the names are as a hire company has them.
const named = (name: string) => (shots ? name : `${name} ${run}`)
async function shot(page: Page, name: string) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${shots}/${name}.png` })
}

async function push(request: APIRequestContext, key: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `led-${run}-${key}`, mutations: mutations.map(([name, args], i) => ({ id: `led-${run}-${key}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

const PRODUCTS: [key: string, name: string, more: Record<string, unknown>, dayCents: number | null, stock: number][] = [
  ['panel', 'Absen NT 3.9', { department: 'video', category: 'Video equipment' }, 2_000, 120],
  ['second', 'Gloshine LS 4.8 led panel', { department: 'video', category: 'Video equipment' }, 1_800, 40],
  ['hired', 'ROE CB5 LED panel', { department: 'video', category: 'Video equipment', dryHire: true, supplier: 'PixelHire' }, 3_500, 0],
  ['bar', 'Absen fly bar', { department: 'video', category: 'Video equipment', weightKg: 10 }, 500, 30],
  ['half', '1/2 tonne stage maker motor', { department: 'rigging', category: 'Rigging', weightKg: 30 }, 6_000, 8],
  ['tonne', '1 tonne stage maker motor', { department: 'rigging', category: 'Rigging', weightKg: 50 }, 8_000, 8],
  ['control', 'LV12 ch motor control', { department: 'rigging', category: 'Rigging' }, 10_000, 2],
  ['truss1', '1M H30V truss', { department: 'rigging', category: 'Rigging' }, 800, 20],
  ['truss2', '2M H30V truss', { department: 'rigging', category: 'Rigging' }, 1_200, 20],
  ['truss3', '3M H30V truss', { department: 'rigging', category: 'Rigging' }, 1_500, 20],
  ['plate', 'H30V 1m base plate', { department: 'rigging', category: 'Rigging', weightKg: 40 }, 1_000, 2],
  ['processor', 'Novastar vx4s Processor', { department: 'video', category: 'Video equipment' }, 10_000, 3],
  ['distro', 'SES 18 way video distro', { department: 'power', category: 'Power' }, null, 2],
]

test.beforeAll(async ({ request }) => {
  await push(request, 'stock', [
    ['place.upsert', { id: `bay-${run}`, name: named('LED bay'), notes: '' }],
    ...PRODUCTS.map(([key, name, more]): [string, Record<string, unknown>] => ['model.create', { id: `${key}-${run}`, name: named(name), tracking: 'bulk', isCase: false, valueCents: null, notes: '', ...more }]),
    ...PRODUCTS.filter(([, , , , stock]) => stock > 0).map(([key, , , , qty]): [string, Record<string, unknown>] => ['stock.set', { modelId: `${key}-${run}`, placeId: `bay-${run}`, caseId: null, qty }]),
    ...PRODUCTS.filter(([, , , cents]) => cents !== null).map(([key, , , dayCents]): [string, Record<string, unknown>] => ['price.product', { modelId: `${key}-${run}`, dayCents }]),
  ])
})

/** A job two days long with an empty draft quote, opened on its Quote tab. */
async function quoteFor(request: APIRequestContext, page: Page, key: string) {
  await push(request, key, [
    ['project.create', { id: `job-${run}-${key}`, name: named(`Screens ${key}`), clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `ph-${run}-${key}`, projectId: `job-${run}-${key}`, name: 'Show', start: day(40), end: day(41), venueId: null, notes: '' }],
    ['quote.save', { id: `q-${run}-${key}`, projectId: `job-${run}-${key}`, lines: [], discountPct: 0, notes: '' }],
  ])
  await page.goto(`/#jobs/job-${run}-${key}/quote`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
  return page.getByRole('form', { name: 'Version 1, a draft' })
}

test('at a desk, an LED screen is built in a sheet, lands on the quote with its kit, and is changed from its line', async ({ browser, request }) => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: shots ? 2 : 1 })).newPage()
  const draft = await quoteFor(request, page, 'desk')

  // An empty quote offers every way to start, the screen builder among them.
  const opener = draft.getByRole('button', { name: 'Add LED screen' })
  await opener.click()
  const sheet = page.getByRole('dialog', { name: 'Add an LED screen' })
  await expect(sheet).toBeVisible()
  const form = sheet.getByRole('form', { name: 'Add an LED screen' })
  // With a mouse and keys the cursor starts in the first question.
  await expect(form.getByLabel('Width, m', { exact: true })).toBeFocused()
  // From the end, wide enough for the questions and their answer side by side.
  await expect.poll(async () => Math.round((await sheet.boundingBox())!.x + (await sheet.boundingBox())!.width)).toBe(1440)
  expect((await sheet.boundingBox())!.width).toBeGreaterThan(900)
  await expect(form.getByText('Still to give: its size, its panel and whether it’s hung or ground stacked.')).toBeVisible()
  if (shots) await shot(page, 'builder-desk-start')

  // The panels we hold come first, then what's hired in; either says what it is.
  const panels = form.getByRole('group', { name: 'Panel' }).getByRole('radio')
  await expect(panels).toHaveCount(4)
  await expect(panels.nth(0)).toHaveAccessibleName(named('Absen NT 3.9'))
  await expect(panels.nth(0)).toHaveAccessibleDescription('Size not given yet · €20.00 a day · 120 free')
  await expect(panels.nth(1)).toHaveAccessibleName(named('Gloshine LS 4.8 led panel'))
  await expect(panels.nth(2)).toHaveAccessibleName(named('ROE CB5 LED panel'))
  await expect(panels.nth(2)).toHaveAccessibleDescription('Size not given yet · €35.00 a day · hired in from PixelHire')
  await expect(panels.nth(3)).toHaveAccessibleName('Another product…')
  // With more than one of our own and none used before, none is picked for the office.
  for (const n of [0, 1, 2, 3]) await expect(panels.nth(n)).not.toBeChecked()

  // Add to quote with nothing answered says everything that's wanted at once, each on its field, and by the button.
  await form.getByRole('button', { name: 'Add to quote' }).click()
  await expect(form.getByText('Give the width in metres, such as 5 or 4.5.').first()).toBeVisible()
  await expect(form.getByLabel('Width, m', { exact: true })).toBeFocused()
  const sort = form.getByRole('group', { name: 'To sort first' })
  await expect(sort).toContainText('4 things to sort before “Add to quote”:')
  await expect(sort.getByRole('button')).toHaveText(['Give the width in metres, such as 5 or 4.5.', 'Give the height in metres, such as 3 or 2.5.', 'Pick the panel first.', 'Say whether it’s hung or ground stacked.'])

  // Each goes as it's answered.
  await form.getByLabel('Width, m', { exact: true }).fill('5')
  await form.getByLabel('Height, m', { exact: true }).fill('3')
  await panels.nth(0).check()
  await expect(sort.getByRole('button')).toHaveText(['Say whether it’s hung or ground stacked.'])
  // The panel's size is asked the first time it's used.
  const facts = form.getByRole('group', { name: new RegExp(`^One ${named('Absen NT 3.9')}`) })
  await expect(facts).toContainText('Asked once, then kept on its product.')
  await expect(form.getByText('Still to give: the panel’s size and whether it’s hung or ground stacked.')).toBeVisible()
  await facts.getByLabel('Panel width, mm').fill('500')
  await facts.getByLabel('Panel height, mm').fill('500')
  await facts.getByLabel('Pixels across').fill('128')
  await facts.getByLabel('Pixels down').fill('128')
  await facts.getByLabel('Weight of one panel, kg').fill('7.5')
  await facts.getByLabel('Most power one panel draws, W').fill('160')
  await expect(form.getByText('10 panels wide by 6 high.')).toBeVisible()
  await expect(panels.nth(0)).toHaveAccessibleDescription('500 × 500 mm, 128 × 128 pixels · 3.9 mm pitch · €20.00 a day · 120 free')
  await form.getByRole('radio', { name: 'Hung' }).check()
  await expect(sort).toHaveCount(0)

  // What it takes: the screen's figures, how it hangs, and the kit with the reason for each count.
  const takes = form.getByRole('region', { name: 'What it takes' })
  const figures = takes.getByRole('term')
  await expect(figures).toHaveText(['Panels', 'Size', 'Pixels', 'Weight', 'Power'])
  await expect(takes.getByRole('definition')).toHaveText(['6010 × 6', '5 × 3 m5:3', '1,280 × 768', '450 kgpanels only', '9.6 kW4 circuits of 16 A'])
  // What hangs is said, and with it, ahead of the kit, that these are a first pass: read where the weights are, not after the list.
  const how = takes.locator('.screen-how')
  await expect(how).toContainText("Hangs from 3 points: about 583 kg in all, 194 kg a point if it's shared evenly.")
  await expect(how).toContainText('A first pass to quote from, not a structural check')
  expect(await how.evaluate((el) => !!(el.compareDocumentPosition(el.closest('section')!.querySelector('.screen-parts')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
  const parts = takes.getByRole('list', { name: 'Kit to add to the quote' }).getByRole('listitem')
  await expect(parts.locator('.screen-part-name')).toHaveText(['Panels', 'Fly bars', 'Truss', 'Motors', 'Motor control', 'Processor', 'Power distro'])
  await expect(parts.nth(0)).toContainText(`60 × ${named('Absen NT 3.9')}`)
  await expect(parts.nth(0)).toContainText('€2,400.00')
  await expect(parts.nth(0).getByRole('checkbox')).toBeDisabled()
  await expect(parts.nth(1)).toContainText(`10 × ${named('Absen fly bar')}`)
  // No price on the price list is said, not shown as nothing.
  await expect(parts.nth(6)).toContainText('No price yet')
  await expect(form.locator('.screen-comes-to')).toContainText('for 2 days, before VAT · 1 line with no price yet')
  if (shots) {
    await sheet.evaluate((d) => d.scrollTo(0, 0))
    await shot(page, 'builder-desk')
  }

  // Taking a part off is one tick, and what it comes to follows.
  const before = await form.locator('.screen-comes-to b').textContent()
  await parts.nth(6).getByRole('checkbox').uncheck()
  await expect(parts.nth(6)).toContainText('Left off')
  await expect(form.locator('.screen-comes-to')).not.toContainText('no price yet')
  expect(await form.locator('.screen-comes-to b').textContent()).toBe(before)

  // One press puts it on the quote: the sheet shuts, the page goes to the screen's line, and a pop-up says what was added.
  const total = (await form.locator('.screen-comes-to b').textContent())!
  await form.getByRole('button', { name: 'Add to quote' }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('Added LED screen 5 × 3 m, hung')
  const group = draft.getByRole('group', { name: 'LED screen', exact: true })
  const head = group.getByRole('button', { name: 'Line 1: LED screen 5 × 3 m, hung, change the screen' })
  await expect(head).toBeFocused()
  await expect(head).toContainText('10 panels wide by 6 high · 1,280 × 768 pixels')
  // What the sheet said it comes to is what its line says.
  await expect(head.locator('.amount')).toContainText(total)
  // Its kit is under it, each an ordinary line at the price list's price.
  await expect(group.getByRole('button', { name: 'Hide what’s in it' })).toBeVisible()
  await expect(group.getByLabel('Line 2: how many')).toHaveValue('60')
  await expect(group.getByLabel('Line 2: price, a day')).toHaveValue('20')
  await expect(group.getByText(named('Absen fly bar'))).toBeVisible()
  await expect(group.getByText(named('SES 18 way video distro'))).toHaveCount(0)
  // The draft saves itself, the screen with it.
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  if (shots) await shot(page, 'on-the-quote-desk')

  // It's kept: the quote opened afresh has the screen, and the panel has its size on its product.
  await page.reload()
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await expect(head).toBeVisible()

  // Its line opens the builder on its answers.
  await head.click()
  const changing = page.getByRole('dialog', { name: 'Change the LED screen' })
  const again = changing.getByRole('form', { name: 'Change the LED screen' })
  await expect(again.getByLabel('Width, m', { exact: true })).toHaveValue('5')
  await expect(again.getByLabel('Height, m', { exact: true })).toHaveValue('3')
  await expect(again.getByRole('radio', { name: named('Absen NT 3.9') })).toBeChecked()
  await expect(again.getByRole('radio', { name: 'Hung' })).toBeChecked()
  // The part left off is still off, and nothing is asked of the panel now.
  await expect(again.getByRole('list', { name: 'Kit to add to the quote' }).getByRole('listitem').nth(6).getByRole('checkbox')).not.toBeChecked()
  await expect(again.getByLabel('Panel width, mm')).toHaveCount(0)
  const does = again.getByRole('group', { name: 'What this changes on the quote' })
  await expect(does).toContainText('Nothing: the screen is as the quote has it.')
  // A metre wider: what that does to the quote is said before it's done.
  await again.getByLabel('Width, m', { exact: true }).fill('6')
  await expect(does.getByRole('listitem')).toContainText([
    'Its line reads “LED screen 6 × 3 m, hung”, where it read “LED screen 5 × 3 m, hung”.',
    `${named('Absen NT 3.9')}: 72, where there were 60.`,
    `${named('Absen fly bar')}: 12, where there were 10.`,
  ])
  // And by the button, how much more it comes to than it does now.
  await expect(again.locator('.screen-comes-to')).toContainText('more than it is now')
  if (shots) {
    await does.scrollIntoViewIfNeeded()
    await shot(page, 'change-desk')
  }
  await again.getByRole('button', { name: 'Update the screen' }).click()
  await expect(changing).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('Changed LED screen 6 × 3 m, hung')
  const wider = group.getByRole('button', { name: 'Line 1: LED screen 6 × 3 m, hung, change the screen' })
  await expect(wider).toBeFocused()
  await expect(group.getByLabel('Line 2: how many')).toHaveValue('72')

  // A price changed on one of its lines is kept when the screen is changed again.
  await group.getByLabel('Line 2: price, a day').fill('18')
  await wider.click()
  await page.getByRole('dialog').getByLabel('Height, m', { exact: true }).fill('2')
  await page.getByRole('dialog').getByRole('button', { name: 'Update the screen' }).click()
  const lower = group.getByRole('button', { name: 'Line 1: LED screen 6 × 2 m, hung, change the screen' })
  await expect(lower).toBeVisible()
  await expect(group.getByLabel('Line 2: how many')).toHaveValue('48')
  await expect(group.getByLabel('Line 2: price, a day')).toHaveValue('18')

  // Removed from its builder, it goes with its kit, and Undo brings both back.
  await lower.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove from the quote' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(draft.getByRole('button', { name: /LED screen 6 × 2 m/ })).toHaveCount(0)
  await draft.getByRole('button', { name: 'Undo' }).click()
  await expect(lower).toBeVisible()
  await expect(group.getByLabel('Line 2: how many')).toHaveValue('48')
})

test('on a phone the builder is the whole screen, keeps what was typed when shut, and a ground stack says how it stands', async ({ browser, request }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: shots ? 2 : 1, hasTouch: true, isMobile: true })).newPage()
  const draft = await quoteFor(request, page, 'phone')

  // Found in Add kit too, by what a screen is called, with how many typed first.
  await draft.getByRole('button', { name: 'Add kit' }).click()
  await draft.getByRole('combobox', { name: 'Kit to add' }).fill('2 led wall')
  const offer = draft.getByRole('option').first()
  await expect(offer).toContainText('2 × LED screen')
  await expect(offer).toContainText('asks its size, its panel and whether it’s hung or ground stacked, then adds the kit that makes it')
  await offer.click()
  const sheet = page.getByRole('dialog', { name: 'Add an LED screen' })
  const form = sheet.getByRole('form', { name: 'Add an LED screen' })
  await expect(form).toBeVisible()
  // The whole screen, and the keyboard isn't put over the questions before they're read.
  await expect.poll(async () => Math.round((await sheet.boundingBox())!.width)).toBe(390)
  await expect(form.getByLabel('Width, m', { exact: true })).not.toBeFocused()
  await expect(form.getByLabel('How many like this')).toHaveValue('2')
  // The panel used last time on this device isn't known here, so nothing is picked; its size is on its product from the first test.
  const panel = form.getByRole('radio', { name: named('Absen NT 3.9') })
  await expect(panel).toHaveAccessibleDescription('500 × 500 mm, 128 × 128 pixels · 3.9 mm pitch · €20.00 a day · 120 free')
  await panel.check()
  await expect(form.getByLabel('Panel width, mm')).toHaveCount(0)
  await form.getByLabel('Width, m', { exact: true }).fill('4.2')
  await form.getByLabel('Height, m', { exact: true }).fill('2,5')
  // Asked for in metres, built in whole panels: said as it's typed.
  await expect(form.getByText('In whole panels that is 4 × 2.5 m: 8 panels wide by 5 high.')).toBeVisible()

  // Shut by Escape, it opens again as it was left, and can be started again.
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await draft.getByRole('button', { name: /^(Done|Cancel)$/ }).click()
  await draft.getByRole('button', { name: 'Add LED screen' }).click()
  await expect(form.getByText('Opened as you left it.')).toBeVisible()
  await expect(form.getByLabel('Width, m', { exact: true })).toHaveValue('4.2')
  await expect(form.getByLabel('How many like this')).toHaveValue('2')
  await expect(panel).toBeChecked()

  await form.getByRole('radio', { name: 'Ground stacked' }).check()
  const takes = form.getByRole('region', { name: 'What it takes' })
  // A ground stack says how it stands, and what it couldn't hold to.
  await expect(takes.locator('.screen-how')).toContainText('Each stands against 3 truss uprights, 1.86 m apart, each on a base plate.')
  await expect(takes.locator('.screen-how')).toContainText('Outdoors it holds to a wind of about')
  // The wind it holds to is a first pass, and says so in the same breath.
  await expect(takes.locator('.screen-how')).toContainText('A first pass to quote from, not a structural check')
  const parts = takes.getByRole('list', { name: 'Kit to add to the quote' }).getByRole('listitem')
  await expect(parts.locator('.screen-part-name')).toHaveText(['Panels', 'Fly bars', 'Truss uprights', 'Base plates', 'Processor', 'Power distro'])
  await expect(parts.nth(0)).toContainText(`80 × ${named('Absen NT 3.9')}`)
  // More base plates than are free on the job's days is said on its part.
  await expect(parts.nth(3)).toContainText('free on the job’s days')
  await expect(takes.getByText('Those are for each of the 2 screens. The kit below is for all of them.')).toBeVisible()
  // Nothing in the sheet scrolls inside something else that scrolls: the sheet is the one thing that does.
  const scrollers = await sheet.evaluate((d) => [...d.querySelectorAll<HTMLElement>('*')].filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1 && !el.closest('[hidden]')).map((el) => el.className))
  expect(scrollers).toEqual([])
  // Add to quote is in reach wherever the sheet is scrolled to.
  await expect(form.getByRole('button', { name: 'Add to quote' })).toBeInViewport()
  if (shots) await shot(page, 'builder-phone')
  await takes.scrollIntoViewIfNeeded()
  await parts.nth(3).scrollIntoViewIfNeeded()
  await expect(form.getByRole('button', { name: 'Add to quote' })).toBeInViewport()
  if (shots) await shot(page, 'builder-phone-kit')

  // On the narrowest phone nothing runs off the side: the sheet doesn't scroll sideways, no part of it is wider than the screen,
  // and Add to quote is still in reach.
  await page.setViewportSize({ width: 320, height: 640 })
  await expect.poll(async () => Math.round((await sheet.boundingBox())!.width)).toBe(320)
  const wide = () =>
    sheet.evaluate((d) => ({
      sideways: d.scrollWidth - d.clientWidth,
      past: [...d.querySelectorAll<HTMLElement>('*')].filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().right > innerWidth + 1).map((el) => el.className || el.tagName),
    }))
  expect(await wide()).toEqual({ sideways: 0, past: [] })
  await sheet.evaluate((d) => d.scrollTo(0, 0))
  expect(await wide()).toEqual({ sideways: 0, past: [] })
  await expect(form.getByRole('button', { name: 'Add to quote' })).toBeInViewport()
  if (shots) await shot(page, 'builder-phone-320')
  await takes.scrollIntoViewIfNeeded()
  if (shots) await shot(page, 'builder-phone-320-kit')
  await page.setViewportSize({ width: 390, height: 844 })

  await form.getByRole('button', { name: 'Add to quote' }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('Added 2 × LED screen 4 × 2.5 m, ground stacked')
  const head = draft.getByRole('button', { name: 'Line 1: 2 × LED screen 4 × 2.5 m, ground stacked, change the screen' })
  await expect(head).toBeVisible()
  await expect(head).toContainText('Each 8 panels wide by 5 high · 1,024 × 640 pixels')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  if (shots) await shot(page, 'on-the-quote-phone')
  // Its line fits the narrowest phone too, its name and what it comes to both whole.
  await page.setViewportSize({ width: 320, height: 640 })
  await head.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  expect(await head.evaluate((el) => [...el.querySelectorAll<HTMLElement>('*')].filter((x) => x.scrollWidth > x.clientWidth + 1 || x.getBoundingClientRect().right > innerWidth + 1).map((x) => x.className))).toEqual([])
  if (shots) await shot(page, 'on-the-quote-phone-320')
  await page.setViewportSize({ width: 390, height: 844 })
  // Added, there's nothing left over to open on next time.
  await draft.getByRole('button', { name: 'More to add…' }).click()
  await draft.getByRole('button', { name: 'Add LED screen' }).click()
  await expect(form.getByLabel('Width, m', { exact: true })).toHaveValue('')
  await expect(form.getByText('Opened as you left it.')).toHaveCount(0)
  // The panel used last is already chosen.
  await expect(panel).toBeChecked()
})

test('a panel’s size is on its product page, where it can be put right', async ({ page }) => {
  await page.goto(`/#stock/product/panel-${run}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
  // What the builder was told the first time the panel was used.
  const row = page.getByRole('region', { name: 'Details' }).locator('.panel-fact')
  await expect(row).toContainText('500 × 500 mm, 128 × 128 pixels · 3.9 mm pitch')
  await row.getByRole('button', { name: 'Change its size' }).click()
  const form = row.getByRole('form', { name: `The size of one ${named('Absen NT 3.9')}` })
  await expect(form.getByLabel('Panel width, mm')).toBeFocused()
  await expect(form.getByLabel('Panel width, mm')).toHaveValue('500')
  // Pixels are given both ways or not at all, said on the box that's missing.
  await form.getByLabel('Pixels down').fill('')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByText('Give the pixels both across and down, or neither.').first()).toBeVisible()
  await expect(form.getByLabel('Pixels down')).toBeFocused()
  await form.getByLabel('Pixels down').fill('256')
  await form.getByLabel('Panel height, mm').fill('1000')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(row).toContainText('500 × 1,000 mm, 128 × 256 pixels · 3.9 mm pitch')
  await expect(form).toHaveCount(0)
  if (shots) await shot(page, 'panel-on-its-product')

  // A product that reads like a panel and hasn't its size yet says so, and one that isn't a panel has no such row.
  await page.goto(`/#stock/product/second-${run}`)
  await expect(page.getByRole('region', { name: 'Details' }).locator('.panel-fact')).toContainText('Size not given')
  await page.goto(`/#stock/product/truss2-${run}`)
  await expect(page.getByRole('region', { name: 'Details' })).toContainText('Rigging')
  await expect(page.getByRole('region', { name: 'Details' }).locator('.panel-fact')).toHaveCount(0)
})
