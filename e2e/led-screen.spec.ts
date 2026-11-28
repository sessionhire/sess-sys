import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

/**
 * The LED screen builder on a quote (ADR 0207), end to end: Add LED screen opens a sheet that asks how big, which panel and
 * whether it's hung or ground stacked; a panel's size is asked the first time it's used and kept on its product; the kit that
 * makes the screen is listed with the reason for each count and what it comes to; and one press puts the screen on the quote
 * with that kit under it, in an LED screen group. Its line opens the builder again to change it, which says what the change
 * does before it's made. Its data lines are counted as it's cabled, with a data cable for each or, by one tick, fibre and
 * its converters (ADR 0208), and by another a backup on every line (ADR 0209).
 *
 * The stock is made once for all the tests, named as a hire company's really is. The tests run in order: the first gives the
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
  // What takes the data lines to the screen, named and filed as a stock list has them: two lengths of data cable, a fibre converter
  // and the fibre it runs on.
  ['reel', 'Cat 5 reel', { department: 'other', category: 'Cables', lengthM: 100 }, 1_500, 12],
  ['cat', 'cat5 cable', { department: 'other', category: 'Cables', lengthM: 20 }, 300, 40],
  ['cvt', 'Novastar CVT Pro', { department: 'video', category: 'Video equipment' }, 6_000, 4],
  ['fibre', 'Single Mode Fibre', { department: 'video', category: 'Cables', lengthM: 100 }, 2_500, 4],
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

/** How far a sheet scrolls sideways, and whatever in it reaches past its own right edge: nothing should, at any width. */
const runsOff = (sheet: Locator) =>
  sheet.evaluate((d) => {
    const edge = d.getBoundingClientRect().left + d.clientLeft + d.clientWidth
    return {
      sideways: d.scrollWidth - d.clientWidth,
      past: [...d.querySelectorAll<HTMLElement>('*')].filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().right > edge + 1).map((el) => el.className || el.tagName),
    }
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
  // The data lines are counted beside the pixels they carry.
  await expect(takes.getByRole('definition')).toHaveText(['6010 × 6', '5 × 3 m5:3', '1,280 × 7682 data lines', '450 kgpanels only', '9.6 kW4 circuits of 16 A'])
  // What hangs is said, and with it, ahead of the kit, that these are a first pass: read where the weights are, not after the list.
  const how = takes.locator('.screen-how')
  await expect(how).toContainText("Hangs from 3 points: about 583 kg in all, 194 kg a point if it's shared evenly.")
  await expect(how).toContainText('A first pass to quote from, not a structural check')
  expect(await how.evaluate((el) => !!(el.compareDocumentPosition(el.closest('section')!.querySelector('.screen-parts')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
  const parts = takes.getByRole('list', { name: 'Kit to add to the quote' }).getByRole('listitem')
  await expect(parts.locator('.screen-part-name')).toHaveText(['Panels', 'Fly bars', 'Truss', 'Motors', 'Motor control', 'Processor', 'Data cables', 'Fibre to the screen', 'Backup on every data line', 'Power distro'])
  await expect(parts.nth(0)).toContainText(`60 × ${named('Absen NT 3.9')}`)
  await expect(parts.nth(0)).toContainText('€2,400.00')
  await expect(parts.nth(0).getByRole('checkbox')).toBeDisabled()
  await expect(parts.nth(1)).toContainText(`10 × ${named('Absen fly bar')}`)
  // A data cable for each line, the longest we hold; fibre and the backup are the parts that start unticked, and each says what it would add.
  await expect(parts.nth(5)).toContainText('Drives 2.3 million pixels from 4 ports; this screen has 983,040 in 2 data lines')
  await expect(parts.nth(6)).toContainText('2 ×')
  await expect(parts.nth(6).getByRole('combobox', { name: 'Data cables: which' })).toHaveValue(`reel-${run}`)
  await expect(parts.nth(6)).toContainText('One for each of the 2 data lines, from the processor to the screen. A line takes 5 columns of panels.')
  await expect(parts.nth(7).getByRole('checkbox')).not.toBeChecked()
  await expect(parts.nth(7)).toContainText('Left off')
  await expect(parts.nth(7)).toContainText(`2 × ${named('Novastar CVT Pro')}, 1 × ${named('Single Mode Fibre')} 100 m`)
  await expect(parts.nth(8).getByRole('checkbox')).not.toBeChecked()
  await expect(parts.nth(8)).toContainText('Left off')
  await expect(parts.nth(8)).toContainText(`2 × ${named('Cat 5 reel')} 100 m`)
  // No price on the price list is said, not shown as nothing.
  await expect(parts.nth(9)).toContainText('No price yet')
  await expect(form.locator('.screen-comes-to')).toContainText('for 2 days, before VAT · 1 line with no price yet')
  if (shots) {
    await sheet.evaluate((d) => d.scrollTo(0, 0))
    await shot(page, 'builder-desk')
  }

  // Taking a part off is one tick, and what it comes to follows.
  const before = await form.locator('.screen-comes-to b').textContent()
  await parts.nth(9).getByRole('checkbox').uncheck()
  await expect(parts.nth(9)).toContainText('Left off')
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
  await expect(group.getByText(named('Cat 5 reel'))).toBeVisible()
  await expect(group.getByText(named('SES 18 way video distro'))).toHaveCount(0)
  await expect(group.getByText(named('Novastar CVT Pro'))).toHaveCount(0)
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
  // The part left off is still off, fibre and the backup with it, and nothing is asked of the panel now.
  for (const n of [7, 8, 9]) await expect(again.getByRole('list', { name: 'Kit to add to the quote' }).getByRole('listitem').nth(n).getByRole('checkbox')).not.toBeChecked()
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
  await expect(parts.locator('.screen-part-name')).toHaveText(['Panels', 'Fly bars', 'Truss uprights', 'Base plates', 'Processor', 'Data cables', 'Fibre to the screen', 'Backup on every data line', 'Power distro'])
  // Two screens of two lines each: a cable for every line of both.
  await expect(parts.nth(5)).toContainText('4 ×')
  await expect(parts.nth(5)).toContainText('One for each of the 4 data lines, from the processor to the screen, for 2 screens. A line takes 4 columns of panels.')
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
  if (shots) {
    await parts.nth(8).scrollIntoViewIfNeeded()
    await shot(page, 'builder-phone-data-lines')
  }

  // On the narrowest phone nothing runs off the side: the sheet doesn't scroll sideways, no part of it is wider than the screen,
  // and Add to quote is still in reach.
  await page.setViewportSize({ width: 320, height: 640 })
  await expect.poll(async () => Math.round((await sheet.boundingBox())!.width)).toBe(320)
  const wide = () => runsOff(sheet)
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

test('the data lines go to the screen by cable or, by one tick, by fibre, and the quote and the next screen keep which', async ({ browser, request }) => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: shots ? 2 : 1 })).newPage()
  const draft = await quoteFor(request, page, 'fibre')
  await draft.getByRole('button', { name: 'Add LED screen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add an LED screen' })
  const form = sheet.getByRole('form', { name: 'Add an LED screen' })
  await form.getByLabel('Width, m', { exact: true }).fill('8')
  await form.getByLabel('Height, m', { exact: true }).fill('3.5')
  await form.getByRole('radio', { name: named('Absen NT 3.9') }).check()
  await form.getByRole('radio', { name: 'Hung' }).check()
  const takes = form.getByRole('region', { name: 'What it takes' })
  await expect(takes.getByRole('definition').nth(2)).toHaveText('2,048 × 8964 data lines')
  const parts = takes.getByRole('list', { name: 'Kit to add to the quote' }).getByRole('listitem')
  const [processor, cables, fibre] = [parts.nth(5), parts.nth(6), parts.nth(7)]
  await expect(processor).toContainText('Drives 2.3 million pixels from 4 ports; this screen has 1,835,008 in 4 data lines')

  // A long data cable for every line: the longest we hold is offered, with the shorter one to choose.
  const which = cables.getByRole('combobox', { name: 'Data cables: which' })
  await expect(cables).toContainText('4 ×')
  await expect(which.getByRole('option')).toHaveText([`${named('Cat 5 reel')} 100 m`, `${named('cat5 cable')} 20 m`])
  await expect(which).toHaveValue(`reel-${run}`)
  await expect(cables).toContainText('One for each of the 4 data lines, from the processor to the screen. A line takes 4 columns of panels.')
  // Fibre is the one part that isn't ticked to begin with: it says what ticking it would add.
  const byFibre = fibre.getByRole('checkbox')
  await expect(byFibre).not.toBeChecked()
  await expect(fibre).toContainText('Left off')
  await expect(fibre).toContainText(`2 × ${named('Novastar CVT Pro')}, 1 × ${named('Single Mode Fibre')} 100 m`)
  await expect(fibre).toContainText('In place of a long data cable for every line: a converter at each end for every 10 data lines, and a fibre between each pair.')
  if (shots) {
    await parts.nth(9).scrollIntoViewIfNeeded()
    await shot(page, 'data-lines-desk')
  }

  // One tick: the converters and the fibre come on, and the cables are two short ones a line.
  const before = await form.locator('.screen-comes-to b').textContent()
  await byFibre.check()
  await expect(cables).toContainText('8 ×')
  await expect(which).toHaveValue(`cat-${run}`)
  await expect(cables).toContainText('Two for each of the 4 data lines: from the processor to its converter, and from the converter at the screen to the first panel.')
  await expect(fibre).not.toContainText('Left off')
  expect(await form.locator('.screen-comes-to b').textContent()).not.toBe(before)
  // How it was worked out says what a converter is taken to carry, and which cable was offered.
  await takes.getByText('How it was worked out').click()
  await expect(takes.locator('.screen-working')).toContainText('A fibre converter is taken to carry 10 data lines')
  await expect(takes.locator('.screen-working')).toContainText('The data cable offered is the shortest that reaches the far corner of the screen from a converter at one end: 11.5 m or more.')
  if (shots) {
    await fibre.scrollIntoViewIfNeeded()
    await shot(page, 'fibre-desk')
  }

  // On the quote the screen has its converters, its fibre and the short cables under it, and no reel.
  await form.getByRole('button', { name: 'Add to quote' }).click()
  await expect(sheet).toHaveCount(0)
  const group = draft.getByRole('group', { name: 'LED screen', exact: true })
  const howMany = (name: string) => group.getByText(named(name)).first().locator('xpath=ancestor::*[.//input[contains(@aria-label, ": how many")]][1]').getByLabel(/: how many$/)
  await expect(howMany('Novastar CVT Pro')).toHaveValue('2')
  await expect(howMany('Single Mode Fibre')).toHaveValue('1')
  await expect(howMany('cat5 cable')).toHaveValue('8')
  await expect(group.getByText(named('Cat 5 reel'))).toHaveCount(0)
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  await expect(page.locator('.conn')).toHaveText('Up to date')

  // Opened again from its line, it is as the quote has it: by fibre, with the short cable.
  await page.reload()
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await group.getByRole('button', { name: 'Line 1: LED screen 8 × 3.5 m, hung, change the screen' }).click()
  const again = page.getByRole('dialog', { name: 'Change the LED screen' }).getByRole('form', { name: 'Change the LED screen' })
  const rows = again.getByRole('list', { name: 'Kit to add to the quote' }).getByRole('listitem')
  await expect(rows.nth(7).getByRole('checkbox')).toBeChecked()
  await expect(rows.nth(6).getByRole('combobox', { name: 'Data cables: which' })).toHaveValue(`cat-${run}`)
  const does = again.getByRole('group', { name: 'What this changes on the quote' })
  await expect(does).toContainText('Nothing: the screen is as the quote has it.')
  // Unticked, the long cables come back, and what that does to the quote is said first.
  await rows.nth(7).getByRole('checkbox').uncheck()
  await expect(rows.nth(6).getByRole('combobox', { name: 'Data cables: which' })).toHaveValue(`reel-${run}`)
  await expect(does.getByRole('listitem')).toHaveText([
    `Added: 4 × ${named('Cat 5 reel')} 100 m.`,
    `Taken off: 8 × ${named('cat5 cable')} 20 m.`,
    `Taken off: 2 × ${named('Novastar CVT Pro')}.`,
    `Taken off: 1 × ${named('Single Mode Fibre')} 100 m.`,
  ])
  await again.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // The next screen starts by fibre, since the last one went that way.
  await draft.getByRole('button', { name: 'More to add…' }).click()
  await draft.getByRole('button', { name: 'Add LED screen' }).click()
  await form.getByLabel('Width, m', { exact: true }).fill('4')
  await form.getByLabel('Height, m', { exact: true }).fill('2.5')
  await form.getByRole('radio', { name: 'Hung' }).check()
  await expect(byFibre).toBeChecked()
  await expect(which).toHaveValue(`cat-${run}`)
})

test('a backup on every data line is one tick: a second port and a second cable for each, kept by the quote and the next screen', async ({ browser, request }) => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: shots ? 2 : 1 })).newPage()
  const draft = await quoteFor(request, page, 'backup')
  await draft.getByRole('button', { name: 'Add LED screen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add an LED screen' })
  const form = sheet.getByRole('form', { name: 'Add an LED screen' })
  await form.getByLabel('Width, m', { exact: true }).fill('8')
  await form.getByLabel('Height, m', { exact: true }).fill('3.5')
  await form.getByRole('radio', { name: named('Absen NT 3.9') }).check()
  await form.getByRole('radio', { name: 'Hung' }).check()
  const takes = form.getByRole('region', { name: 'What it takes' })
  const parts = takes.getByRole('list', { name: 'Kit to add to the quote' }).getByRole('listitem')
  const [processor, cables, backup] = [parts.nth(5), parts.nth(6), parts.nth(8)]
  const vx4s = named('Novastar vx4s Processor')
  const reel = `${named('Cat 5 reel')} 100 m`

  // Four lines from a VX4S's four ports. The backup isn't ticked to begin with: it says what ticking it would add, the
  // second processor among it, since each line would take two ports.
  await expect(processor).toContainText(`1 × ${vx4s}`)
  const ticked = backup.getByRole('checkbox')
  await expect(backup.locator('.screen-part-name')).toHaveText('Backup on every data line')
  await expect(ticked).not.toBeChecked()
  await expect(backup).toContainText('Left off')
  await expect(backup).toContainText(`4 × ${reel}`)
  await expect(backup).toContainText(
    `A second data cable for each of the 4 data lines, from its last panel back to a second port on the processor, which takes over if the first feed fails. With it the processor is 2 × ${vx4s}: each line takes two of its ports.`
  )

  // One tick: the cables come on at what they cost, and the processor is counted by two ports a line.
  const before = await form.locator('.screen-comes-to b').textContent()
  await ticked.check()
  await expect(backup).not.toContainText('Left off')
  await expect(backup.locator('.amount')).toHaveText('€120.00')
  await expect(cables).toContainText('4 ×')
  await expect(cables.locator('.amount')).toHaveText('€120.00')
  await expect(processor).toContainText(`2 × ${vx4s}`)
  await expect(processor).toContainText('One has 4 ports and this screen takes 4 data lines, each with a backup: 2 side by side, each driving part of it')
  await expect(processor).toContainText("Check it backs up one port with another: its maker's sheet doesn't say.")
  expect(await form.locator('.screen-comes-to b').textContent()).not.toBe(before)
  await takes.getByText('How it was worked out').click()
  await expect(takes.locator('.screen-working')).toContainText('A backup is a second port for every data line: the line runs through its panels and back into it, so a processor carries half as many lines.')
  if (shots) {
    await parts.nth(9).scrollIntoViewIfNeeded()
    await shot(page, 'backup-desk')
  }

  // Two screens want 16 cables, and there are 12 reels: the cable there are enough of is offered. With the reel picked all
  // the same, what's short is said once, on the last part that takes it, counted over both.
  const which = cables.getByRole('combobox', { name: 'Data cables: which' })
  await form.getByLabel('How many like this').fill('2')
  await expect(which).toHaveValue(`cat-${run}`)
  await which.selectOption(`reel-${run}`)
  await expect(backup).toContainText(`8 × ${reel}`)
  await expect(backup).toContainText('Only 12 of the 16 free on the job’s days.')
  await expect(cables).not.toContainText('free on the job’s days')
  await form.getByLabel('How many like this').fill('1')
  await expect(backup).not.toContainText('free on the job’s days')

  // On the quote the screen says it has a backup, and its kit is the two processors and twice the cables.
  await form.getByRole('button', { name: 'Add to quote' }).click()
  await expect(sheet).toHaveCount(0)
  const group = draft.getByRole('group', { name: 'LED screen', exact: true })
  const head = group.getByRole('button', { name: 'Line 1: LED screen 8 × 3.5 m, hung, change the screen' })
  await expect(head).toContainText('16 panels wide by 7 high · 2,048 × 896 pixels · a backup on every data line')
  const howMany = (name: string) => group.getByText(named(name)).first().locator('xpath=ancestor::*[.//input[contains(@aria-label, ": how many")]][1]').getByLabel(/: how many$/)
  await expect(howMany('Novastar vx4s Processor')).toHaveValue('2')
  await expect(howMany('Cat 5 reel')).toHaveValue('8')
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  await expect(page.locator('.conn')).toHaveText('Up to date')

  // Opened again from its line, it is as the quote has it: with the backup ticked.
  await page.reload()
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await head.click()
  const again = page.getByRole('dialog', { name: 'Change the LED screen' }).getByRole('form', { name: 'Change the LED screen' })
  const rows = again.getByRole('list', { name: 'Kit to add to the quote' }).getByRole('listitem')
  await expect(rows.nth(8).getByRole('checkbox')).toBeChecked()
  await expect(rows.nth(7).getByRole('checkbox')).not.toBeChecked()
  const does = again.getByRole('group', { name: 'What this changes on the quote' })
  await expect(does).toContainText('Nothing: the screen is as the quote has it.')
  // Unticked, what that does to the quote is said first: one processor, and half the cables.
  await rows.nth(8).getByRole('checkbox').uncheck()
  await expect(does.getByRole('listitem')).toHaveText([`${vx4s}: 1, where there were 2.`, `${reel}: 4, where there were 8.`])
  await again.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // The next screen starts with a backup, since the last one had it.
  await draft.getByRole('button', { name: 'More to add…' }).click()
  await draft.getByRole('button', { name: 'Add LED screen' }).click()
  await form.getByLabel('Width, m', { exact: true }).fill('4')
  await form.getByLabel('Height, m', { exact: true }).fill('2.5')
  await form.getByRole('radio', { name: 'Hung' }).check()
  await expect(ticked).toBeChecked()
  await expect(backup).toContainText(`2 × ${reel}`)
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

/**
 * A part the stock list has more than one product for offers them in a drop-down, and a drop-down is as wide as its longest
 * name unless what holds it says otherwise. With the kit named as a hire company names it ("Santasom 18way socapex video
 * distro"), that made the whole sheet scroll sideways on a phone. Last in the file, so its products change nothing above.
 */
test('a part with long-named products to choose from never makes the sheet scroll sideways', async ({ browser, request }) => {
  const LONG: [key: string, name: string, more: Record<string, unknown>, dayCents: number][] = [
    ['distro2', 'Santasom 18way socapex video distro', { department: 'power', category: 'Power' }, 4_000],
    ['processor2', 'Nova star pro HD video processor', { department: 'video', category: 'Video equipment' }, 10_000],
  ]
  await push(request, 'long-stock', [
    ...LONG.map(([key, name, more]): [string, Record<string, unknown>] => ['model.create', { id: `${key}-${run}`, name: named(name), tracking: 'bulk', isCase: false, valueCents: null, notes: '', ...more }]),
    ...LONG.map(([key]): [string, Record<string, unknown>] => ['stock.set', { modelId: `${key}-${run}`, placeId: `bay-${run}`, caseId: null, qty: 2 }]),
    ...LONG.map(([key, , , dayCents]): [string, Record<string, unknown>] => ['price.product', { modelId: `${key}-${run}`, dayCents }]),
  ])
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: shots ? 2 : 1, hasTouch: true, isMobile: true })).newPage()
  const draft = await quoteFor(request, page, 'long')
  await draft.getByRole('button', { name: 'Add LED screen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add an LED screen' })
  const form = sheet.getByRole('form', { name: 'Add an LED screen' })
  await form.getByLabel('Width, m', { exact: true }).fill('6')
  await form.getByLabel('Height, m', { exact: true }).fill('3')
  await form.getByRole('radio', { name: named('Absen NT 3.9') }).check()
  await form.getByRole('radio', { name: 'Hung' }).check()
  // Four parts have a choice to make, each in a drop-down, three of them holding a long name.
  const takes = form.getByRole('region', { name: 'What it takes' })
  const picks = [takes.getByRole('combobox', { name: 'Motors: which' }), takes.getByRole('combobox', { name: 'Processor: which' }), takes.getByRole('combobox', { name: 'Power distro: which' }), takes.getByRole('combobox', { name: 'Data cables: which' })]
  for (const pick of picks) await expect(pick).toBeVisible()
  await expect(picks[2]!.getByRole('option', { name: named('Santasom 18way socapex video distro') })).toHaveCount(1)
  await expect(picks[1]!.getByRole('option', { name: named('Nova star pro HD video processor') })).toHaveCount(1)

  // From the narrowest phone to a desk, where the kit's column is narrow again beside the questions: the sheet never scrolls sideways,
  // nothing in it reaches past its edge, and each drop-down is cut to its row and still wide enough to press and read.
  for (const [width, height] of [[320, 640], [360, 740], [390, 844], [430, 932], [600, 900], [768, 1024], [1000, 800], [1100, 800], [1440, 900]] as const) {
    await page.setViewportSize({ width, height })
    await expect.poll(async () => Math.round((await sheet.boundingBox())!.x + (await sheet.boundingBox())!.width)).toBe(width)
    await takes.scrollIntoViewIfNeeded()
    expect({ width, ...(await runsOff(sheet)) }).toEqual({ width, sideways: 0, past: [] })
    for (const pick of picks) {
      const [box, row] = [(await pick.boundingBox())!, (await pick.locator('xpath=ancestor::div[1]').boundingBox())!]
      expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width + 1)
      expect(box.width).toBeGreaterThanOrEqual(150)
    }
    if (shots && (width === 320 || width === 390)) {
      await picks[2]!.scrollIntoViewIfNeeded()
      await shot(page, `builder-phone-${width}-long-names`)
    }
  }
})
