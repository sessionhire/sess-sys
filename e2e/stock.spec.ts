import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Stock end to end (ADR 0013), at phone size: a product counted at a new
 * place and then labelled one by one, with a typed number and with the next
 * free one; a case found by its number, an item put in it and cables
 * counted in it; the place showing it all; a new label and a retirement.
 * An item labelled with no signal gets its number once the signal is back.
 * A where that matches no place asks before making one, and a product
 * added by mistake is hidden with its items (audit finding 19). The test
 * server is shared with the other browser tests, so every name and number
 * here is this run's own. To refresh the blueprint screenshots, run this
 * file on its own with SHOTS=1: the names are then plain.
 */

const shot = (name: string) => (process.env.SHOTS ? { path: `docs/hub/img/${name}.png` } : undefined)
const phoneSize = { width: 390, height: 844 }
const deskSize = { width: 1440, height: 900 }
const tag = () => Math.random().toString(36).slice(2, 8)
const named = (name: string, id: string) => (process.env.SHOTS ? name : `${name} ${id}`)
const sh = (n: number) => `SH-${String(n).padStart(6, '0')}`
/** From the top of the page, for a screenshot. */
const top = (page: Page) => page.evaluate(() => scrollTo(0, 0))
/** Two frames: the strip of parts is found a frame after the screen changes. */
const drawn = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))

async function ready(page: Page, hash = '#stock') {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `stock-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `stock-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

const part = (page: Page, heading: string) => page.locator('form').filter({ has: page.getByRole('heading', { name: heading, exact: true }) })

/** Every product and place on the Stock tab, past the first few of each it shows (audit finding 16; twenty products on a laptop, finding 97), so one missing from either is missing. */
async function showAll(page: Page) {
  await expect(page.getByRole('region', { name: 'Catalogue', exact: true })).toBeVisible()
  for (const what of ['products', 'places']) {
    const all = page.getByRole('button', { name: new RegExp(`^Show all \\d+ ${what}$`) })
    if (await all.count()) await all.click()
  }
}

async function newProduct(page: Page, name: string, how: 'numbered' | 'counted' | 'case') {
  await page.goto('/#stock')
  await page.getByRole('button', { name: 'New product' }).click()
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add product' }) })
  await form.getByLabel('Name').fill(name)
  if (how === 'counted') await form.getByRole('radio', { name: /^Counted/ }).check()
  if (how === 'case') await form.getByRole('checkbox', { name: /^Holds other kit/ }).check()
  await form.getByRole('button', { name: 'Add product' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test('counted, labelled, put in a case, found by number, and kept at a place', async ({ browser }) => {
  const id = tag()
  const speaker = named('d&b Y10P', id)
  const rack = named('Amp rack', id)
  const cable = named('XLR 10 m', id)
  const bay = named('Bay A3', id)
  // Numbers are never used twice, so this run has its own.
  const first = process.env.SHOTS ? 101 : 100_000 + Math.floor(Math.random() * 800_000)
  const rackNumber = sh(first + 50)
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(page)

  await newProduct(page, cable, 'counted')
  await newProduct(page, rack, 'case')
  await newProduct(page, speaker, 'numbered')

  // Six speakers counted at a new place before they have labels: a slip of the thumb is asked about first.
  const count = part(page, 'Add a count')
  await count.getByLabel('Counted at').fill(`${bay}3`)
  await count.getByLabel('How many').fill('6')
  await count.getByRole('button', { name: 'Save count' }).click()
  await expect(count.getByRole('group', { name: `Make a new place called “${bay}3”? It joins the places on the Stock tab.` })).toBeVisible()
  await expect(count.getByLabel('Counted at')).toBeDisabled()
  await count.getByRole('button', { name: 'Go back' }).click()
  await expect(count.getByLabel('Counted at')).toHaveValue(`${bay}3`)
  await count.getByLabel('Counted at').fill(bay)
  await count.getByRole('button', { name: 'Save count' }).click()
  await count.getByRole('button', { name: 'Make the place' }).click()
  const notLabelled = page.getByRole('region', { name: 'Not labelled yet' })
  await expect(notLabelled.locator('.count', { hasText: bay })).toContainText('6')

  // Labelled one by one: the number from the label, then the next free one. Each comes off the count.
  const add = part(page, 'Add an item')
  await add.getByLabel("Where it's kept").fill(bay)
  await expect(add.getByRole('checkbox', { name: /One of the 6 counted at/ })).toBeChecked()
  await add.getByRole('textbox', { name: 'Number (optional)', exact: true }).fill(`sh ${first}`)
  await add.getByRole('button', { name: 'Add item' }).click()
  await expect(add.locator('.added')).toHaveText(`Added ${sh(first)}.`)
  await expect(notLabelled.locator('.count', { hasText: bay })).toContainText('5')
  await expect(add.getByRole('textbox', { name: 'Number (optional)', exact: true })).toBeFocused()
  await add.getByRole('button', { name: 'Add item' }).click()
  await expect(add.locator('.added')).toHaveText(`Added ${sh(first + 1)}.`)
  await expect(notLabelled.locator('.count', { hasText: bay })).toContainText('4')
  const items = page.getByRole('region', { name: 'Items' })
  await expect(items.locator('.item-row')).toHaveText([new RegExp(`^${sh(first)}${bay}`), new RegExp(`^${sh(first + 1)}${bay}`)])
  await expect(page.locator('.page-sub')).toContainText('6 in all: 4 not labelled yet')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await top(page)
  await page.screenshot(shot('stock-product'))

  // The rack gets its label and a place.
  await page.goto('/#stock')
  await page.locator('.job-row', { hasText: rack }).click()
  await page.getByRole('tab', { name: /^Items/ }).click()
  const addRack = part(page, 'Add an item')
  await addRack.getByRole('textbox', { name: 'Number (optional)', exact: true }).fill(rackNumber)
  await addRack.getByLabel("Where it's kept").fill(bay)
  await addRack.getByRole('button', { name: 'Add item' }).click()
  await expect(addRack.locator('.added')).toHaveText(`Added ${rackNumber}.`)

  // Scanned or typed, the whole number opens the item, with nothing to press (UX sweep, 6 November 2026, move 8).
  await page.goto('/#stock')
  await page.getByLabel('Find').fill(rackNumber.toLowerCase())
  await expect(page.getByRole('heading', { level: 1, name: rackNumber })).toBeVisible()
  await expect(page.locator('.facts')).toContainText(`Where${bay}`)

  // A speaker goes in the rack, and eight cables are counted in it.
  await page.getByRole('tab', { name: 'In it' }).click()
  const inIt = page.getByRole('region', { name: 'In it' })
  await expect(inIt).toContainText('Nothing here yet.')
  const put = part(page, 'Put an item in')
  await put.getByLabel('Its number').fill(sh(first))
  await put.getByRole('button', { name: `Put it in ${rackNumber}` }).click()
  await expect(inIt.locator('.item-row')).toHaveText(new RegExp(`^${sh(first)} ${speaker}`))
  const countIn = part(page, "Count what's in it")
  await countIn.getByLabel('Product').fill(cable)
  await countIn.getByLabel('How many').fill('8')
  await countIn.getByRole('button', { name: 'Save count' }).click()
  await expect(inIt.locator('.count', { hasText: cable })).toContainText('8')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await top(page)
  await page.screenshot(shot('stock-item'))
  // Nothing goes inside itself.
  await put.getByLabel('Its number').fill(rackNumber)
  await put.getByRole('button', { name: `Put it in ${rackNumber}` }).click()
  await expect(put.locator('.alert')).toHaveText(`${rackNumber} is that case itself, and nothing can go inside itself.`)

  // The speaker in the rack is at the bay too.
  await inIt.locator('.item-row', { hasText: sh(first) }).click()
  await expect(page.locator('.facts')).toContainText(`WhereIn ${rackNumber} (${rack}), ${bay}`)

  // The place: the rack and what's in it, the other speaker, and the four not labelled yet.
  await page.locator('.facts').getByRole('link', { name: bay }).click()
  await expect(page.getByRole('heading', { level: 1, name: bay })).toBeVisible()
  await expect(page.locator('.facts')).toHaveText('Items3Counted12')
  const here = page.getByRole('region', { name: 'Here' })
  await expect(here.locator('.item-row', { hasText: rackNumber })).toContainText('1 item and 8 counted in it')
  await expect(here.locator('.group', { hasText: speaker }).getByRole('link', { name: sh(first + 1) })).toBeVisible()
  await expect(here.locator('.count', { hasText: speaker })).toContainText('4')
  await top(page)
  await page.screenshot(shot('stock-place'))

  // A worn label replaced: the old number stays with it, and finds it.
  await here.getByRole('link', { name: sh(first + 1) }).click()
  await page.getByRole('button', { name: 'New label' }).click()
  await page.getByLabel('New number').fill(sh(first))
  await page.getByRole('button', { name: 'Save new label' }).click()
  await expect(page.locator('.alert')).toHaveText(`${sh(first)} is already in use (${speaker}).`)
  await page.getByLabel('New number').fill('')
  await page.getByRole('button', { name: 'Give it the next free number' }).click()
  await page.getByRole('group').getByRole('button', { name: 'Give it the next free number' }).click()
  await expect(page.getByRole('heading', { level: 1, name: sh(first + 51) })).toBeVisible()
  await expect(page.locator('.facts')).toContainText(`Labels before${sh(first + 1)}`)
  await page.goto('/#stock')
  await page.getByLabel('Find').fill(sh(first + 1))
  await expect(page.getByRole('list', { name: 'Items found' })).toContainText(`${sh(first + 51)} ${speaker}`)
  await expect(page.getByRole('list', { name: 'Items found' })).toContainText(`Had ${sh(first + 1)} before`)

  // Retired as lost, then found again.
  await page.getByLabel('Find').press('Enter')
  await page.getByRole('button', { name: 'Retire' }).click()
  await page.getByRole('radio', { name: 'Lost' }).check()
  await page.getByLabel('Note').fill('Not back from the Point')
  await page.getByRole('button', { name: `Retire ${sh(first + 51)}` }).click()
  await expect(page.locator('.page-title-row .pill')).toHaveText('Retired')
  await expect(page.locator('.facts')).toContainText('RetiredLost: Not back from the Point')
  await page.getByRole('button', { name: 'Bring back' }).click()
  await expect(page.locator('.page-title-row .pill')).toHaveCount(0)
  await expect(page.locator('.facts')).toContainText('WhereNot placed yet')
  await expect(page.locator('.conn')).toHaveText('Up to date')

  await ready(page)
  // The catalogue shows its first few (five on a phone, twenty on a laptop), with the rest behind "Show all" (audit finding 16), drawn
  // only near the screen (finding 97); with other tests' products about, this test's two are found by name.
  if (process.env.SHOTS) {
    const all = page.getByRole('button', { name: /^Show all \d+ products$/ })
    if (await all.count()) await all.click()
  } else await page.getByLabel('Find').fill(id)
  await expect(page.locator('.job-row', { hasText: speaker })).toContainText('6 in all: 4 not labelled yet')
  await expect(page.locator('.job-row', { hasText: cable })).toContainText('8 counted')
  await page.screenshot(shot('stock-list'))
})

test('an item labelled with no signal gets its number when the signal is back', async ({ browser }) => {
  const id = tag()
  const mic = named('Shure SM58', id)
  const cabinet = named('Mic cabinet', id)
  const context = await browser.newContext({ viewport: phoneSize })
  const phone = await context.newPage()
  await ready(phone)
  await newProduct(phone, mic, 'numbered')
  await expect(phone.locator('.conn')).toHaveText('Up to date')

  await context.setOffline(true)
  const add = part(phone, 'Add an item')
  await add.getByLabel("Where it's kept").fill(cabinet)
  await add.getByRole('button', { name: 'Add item' }).click()
  await add.getByRole('button', { name: 'Make the place' }).click()
  await expect(add.locator('.added')).toHaveText('Added. It gets the next free number when it syncs.')
  const row = phone.getByRole('region', { name: 'Items' }).locator('.item-row')
  await expect(row).toContainText('Number when synced')
  await expect(row).toContainText('Waiting to sync')
  await expect(phone.locator('.conn')).toContainText('No signal')

  await context.setOffline(false)
  await phone.evaluate(() => dispatchEvent(new Event('online')))
  await expect(phone.locator('.conn')).toHaveText('Up to date', { timeout: 20_000 })
  await expect(row).toHaveText(new RegExp(`^SH-\\d{6}${cabinet}$`))
  const number = (await row.locator('b').textContent()) ?? ''
  await expect(add.locator('.added')).toHaveText(`Added ${number}.`)
})

test('a product added by mistake is hidden with its items and counts, and its labels say so', async ({ browser }) => {
  // Something made by mistake can be taken back, asked about first, with nothing of it left in a list or a count.
  const id = tag()
  const light = named('Martin MAC Aura', id)
  const bay = named('Bay L1', id)
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(page)
  await newProduct(page, light, 'numbered')

  // One labelled, two counted, so it can't simply be removed.
  const add = part(page, 'Add an item')
  await add.getByLabel("Where it's kept").fill(bay)
  await add.getByRole('button', { name: 'Add item' }).click()
  await add.getByRole('button', { name: 'Make the place' }).click()
  // The number comes back with a sync round trip, slower when the machine is busy (audit, 20 October 2026, finding 109).
  await expect(add.locator('.added')).toHaveText(/^Added SH-\d{6}\.$/, { timeout: 20_000 })
  // The question answered, the number field is ready for the next label.
  await expect(add.getByRole('textbox', { name: 'Number (optional)', exact: true })).toBeFocused()
  const number = (await add.locator('.added').textContent())!.slice(6, -1)
  const count = part(page, 'Add a count')
  await count.getByLabel('Counted at').fill(bay)
  await count.getByLabel('How many').fill('2')
  await count.getByRole('button', { name: 'Save count' }).click()
  await expect(page.locator('.page-sub')).toContainText('3 in all: 2 not labelled yet')
  await page.getByRole('tab', { name: /^Details/ }).click()
  await expect(page.getByRole('button', { name: 'Remove product' })).toHaveCount(0)

  // Asked first, with what goes; then it's gone from the list, the place and the search, but its label still answers.
  await page.getByRole('button', { name: 'Added by mistake' }).click()
  await expect(
    page.getByRole('group', {
      name: `Mark ${light} as added by mistake? It leaves every list and count, with its 1 item and 2 counted, and is kept only in the history. This can't be undone.`,
    })
  ).toBeVisible()
  await page.getByRole('button', { name: 'It was a mistake' }).click()
  await expect(page).toHaveURL(/#stock$/)
  await showAll(page)
  await expect(page.locator('.job-row', { hasText: light })).toHaveCount(0)
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await expect(page.locator('.job-row', { hasText: light })).toHaveCount(0)
  await page.goto('/#stock/places')
  const places = page.getByRole('button', { name: /^Show all \d+ places$/ })
  if (await places.count()) await places.click()
  await expect(page.locator('.job-row', { hasText: bay })).toContainText('Nothing here yet')
  // Its whole number opens it, saying so (UX sweep, 6 November 2026, move 8).
  await page.goto('/#stock')
  await page.getByLabel('Find').fill(number)
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible()
  await expect(page.getByText(`${light} was marked as added by mistake, so this is kept for the history only.`)).toBeVisible()
  await page.goto('/#stock/places')
  if (await places.count()) await places.click()
  await page.locator('.job-row', { hasText: bay }).click()
  const put = part(page, 'Put an item here')
  await put.getByLabel('Its number').fill(number)
  await put.getByRole('button', { name: 'Put it here' }).click()
  await expect(put.locator('.alert')).toHaveText(`${number} (${light}) was added by mistake.`)

  // A product whose only item was retired as added by mistake still has that item kept, so it's marked rather than removed, as the server has it.
  const spot = named('Martin MAC Viper', id)
  await newProduct(page, spot, 'numbered')
  await add.getByLabel("Where it's kept").fill(bay)
  await add.getByRole('button', { name: 'Add item' }).click()
  // The number comes back with a sync round trip, slower when the machine is busy (audit, 20 October 2026, finding 109).
  await expect(add.locator('.added')).toHaveText(/^Added SH-\d{6}\.$/, { timeout: 20_000 })
  await add.locator('.added a').click()
  await page.getByRole('button', { name: 'Retire' }).click()
  await page.getByRole('radio', { name: 'Added by mistake' }).check()
  await page.getByRole('button', { name: /^Retire SH-/ }).click()
  await expect(page.locator('.facts')).toContainText('RetiredAdded by mistake')
  await page.getByRole('link', { name: `‹ ${spot}` }).click()
  await expect(page.getByRole('button', { name: 'Remove product' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Added by mistake' }).click()
  await page.getByRole('button', { name: 'It was a mistake' }).click()
  await expect(page).toHaveURL(/#stock$/)
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await showAll(page)
  await expect(page.locator('.job-row', { hasText: spot })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '1 not done' })).toHaveCount(0)
})

test('Back from a product to the catalogue opened in full keeps it open, at the row that was opened', async ({ browser }) => {
  // Proves (audit, 5 November 2026, finding 9): on a phone, Show all is kept for Back, so going down the catalogue product by product
  // doesn't mean Show all and a long scroll each time; a new move to Stock starts short again.
  const id = Math.random().toString(36).slice(2, 8)
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  const createdAt = new Date().toISOString()
  const mutations = Array.from({ length: 8 }, (_, i) => ({
    id: `back${id}${i}`,
    createdAt,
    name: 'model.create',
    args: { id: `m${id}${i}`, name: `Back ${id} ${i}`, department: 'audio', category: 'Speakers', tracking: 'bulk', isCase: false, valueCents: null, notes: '' },
  }))
  await page.request.post('/api/sync/push', { data: { clientId: `back${id}`, mutations } })
  await ready(page)
  const catalogue = page.getByRole('region', { name: 'Catalogue', exact: true })
  await catalogue.getByRole('button', { name: /^Show all \d+ products$/ }).click()
  const rows = catalogue.locator('.job-row')
  await expect.poll(() => rows.count()).toBeGreaterThan(7)
  const opened = rows.nth(7)
  await opened.scrollIntoViewIfNeeded()
  const name = await opened.locator('b').innerText()
  await opened.click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/#stock$/)
  await expect(catalogue.getByRole('button', { name: /^Show all \d+ products$/ })).toHaveCount(0)
  await expect(catalogue.locator('.job-row', { hasText: name })).toBeInViewport()
  // A new move to Stock is a list opened afresh: its first few.
  await page.goto('/#home')
  await page.goto('/#stock')
  await expect(catalogue.getByRole('button', { name: /^Show all \d+ products$/ })).toBeVisible()
})

test('on a phone the catalogue is a part the strip names and a search has the screen to itself; a whole number opens its item', async ({ browser, request }) => {
  // Proves (UX sweep, 6 November 2026, move 8): on a phone the catalogue has a heading of its own, so On this screen names Catalogue,
  // Pick lists and Kit short (ADR 0033); while anything is typed in the search, the day's cards under it step aside, and come back once
  // it's cleared; part of a number lists the items it's part of, and a label's whole number on one item opens it, with nothing to press.
  // On a laptop the catalogue is the column beside the day's cards or a record, which keeps its place as the page scrolls: unheaded, so
  // no strip is drawn over it.
  const id = tag()
  const speaker = named('Strip speaker', id)
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
  await push(request, id, [
    ['model.create', { id: `m-${id}`, name: speaker, department: 'audio', category: 'Speakers', tracking: 'serialised', isCase: false, valueCents: null, notes: '' }],
    ['place.upsert', { id: `b-${id}`, name: named('Bay S1', id), notes: '' }],
    ['asset.add', { id: `a-${id}`, modelId: `m-${id}`, number: null, serial: '', placeId: `b-${id}`, caseId: null, notes: '', fromCount: false }],
    ['project.create', { id: `j-${id}`, name: named('Strip gala', id), clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `p-${id}`, projectId: `j-${id}`, name: 'Show', start: day(2), end: day(3), venueId: null, notes: '' }],
    ['kit.add', { id: `k-${id}`, projectId: `j-${id}`, phaseId: null, modelId: `m-${id}`, qty: 3, subhireQty: 0, supplier: '', notes: '' }],
  ])
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(page, `#stock/item/a-${id}`)
  const number = (await page.getByRole('heading', { level: 1 }).textContent())!.match(/SH-\d{6}/)![0]

  await ready(page)
  const strip = page.getByRole('navigation', { name: 'On this screen' })
  await expect(strip.getByRole('button')).toHaveText([/^Catalogue\d/, /^Pick lists/, /^Kit short/])
  await expect(page.getByRole('heading', { level: 2, name: /^Catalogue \(\d+\)$/ })).toBeVisible()
  const pickLists = page.getByRole('region', { name: 'Pick lists' })
  const short = page.getByRole('region', { name: 'Kit short' })
  await expect(pickLists).toBeVisible()
  await expect(short.locator('.job-row', { hasText: speaker })).toContainText('short 2')

  const find = page.getByLabel('Find')
  await find.fill(speaker)
  await expect(page.locator('.job-row', { hasText: speaker })).toBeVisible()
  await expect(pickLists).toHaveCount(0)
  await expect(short).toHaveCount(0)
  await expect(strip).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await find.fill('')
  await expect(pickLists).toBeVisible()
  await expect(short).toBeVisible()
  await expect(strip).toBeVisible()

  // Part of the number: what it's part of, on the one item row, and nothing opens.
  await find.fill(number.slice(-5))
  await expect(page.getByRole('list', { name: 'Items found' }).locator('.item-row', { hasText: number })).toBeVisible()
  await expect(page).toHaveURL(/#stock$/)
  // The whole number: its item, with nothing to press.
  await find.fill(number)
  await expect(page).toHaveURL(new RegExp(`#stock/item/a-${id}$`))
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible()

  // On a laptop, beside the day's cards and beside a place: the catalogue's column has no heading, and no strip comes over it.
  const desk = await (await browser.newContext({ viewport: deskSize })).newPage()
  for (const [hash, open] of [
    ['#stock', desk.getByRole('region', { name: 'Kit short' }).locator('.job-row', { hasText: speaker })],
    [`#stock/place/b-${id}`, desk.getByRole('heading', { level: 1, name: named('Bay S1', id) })],
  ] as const) {
    await ready(desk, hash)
    await expect(open).toBeVisible()
    await expect(desk.getByRole('region', { name: 'Catalogue', exact: true }).getByLabel('Find')).toBeVisible()
    await drawn(desk)
    await expect(desk.getByRole('heading', { level: 2, name: /^Catalogue/ })).toHaveCount(0)
    await expect(desk.getByRole('navigation', { name: 'On this screen' })).toBeHidden()
  }
})
