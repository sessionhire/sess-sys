import { expect, test, type Page } from '@playwright/test'

/**
 * Labelling as the count goes (ADR 0175), at phone size: a bay with 10
 * speakers counted and none labelled. On the count, a new label scanned asks
 * which product it's on, and once said, it's that product's item here, one
 * fewer without a label, and found; the next label offers the same product,
 * so it's a scan and a press. A number typed for those without a label
 * before a label went on comes down by one. A short run of digits, maybe a
 * maker's serial, is only noted. A label put on from the Stock search while
 * the count is under way is found on it too. At the finish, the speakers
 * without a label are as recorded, not over. The test server is shared, so
 * names are this run's own and numbers are read off the screen.
 */

const phoneSize = { width: 390, height: 844 }
const tag = () => Math.random().toString(36).slice(2, 8)

async function newProduct(page: Page, name: string, at: string, count: number) {
  await page.goto('/#stock')
  await page.getByRole('button', { name: 'New product' }).click()
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add product' }) })
  await form.getByLabel('Name').fill(name)
  await form.getByRole('button', { name: 'Add product' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  const add = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Add a count', exact: true }) })
  await add.getByLabel('Counted at').fill(at)
  await add.getByLabel('How many').fill(String(count))
  await add.getByRole('button', { name: 'Save count' }).click()
  await add.getByRole('button', { name: 'Make the place' }).click()
  await expect(page.locator('.count', { hasText: at })).toContainText(String(count))
}

/** Numbers set aside for a roll, the first of them read off the screen. */
async function setAside(page: Page, count: number, roll: string): Promise<number> {
  await page.goto('/#stock/labels')
  const form = page.getByRole('form', { name: 'Set numbers aside' })
  await form.getByLabel('How many labels').fill(String(count))
  await form.getByLabel('What for').fill(roll)
  await form.getByRole('button', { name: 'Set numbers aside' }).click()
  await form.getByRole('button', { name: 'Set them aside' }).click()
  await expect(form.locator('.added')).toHaveText(/^Set aside SH-\d{6} to SH-\d{6}\.$/, { timeout: 20_000 })
  return Number(/SH-(\d{6})/.exec((await form.locator('.added').textContent())!)![1])
}

const sh = (n: number) => `SH-${String(n).padStart(6, '0')}`

async function typeIn(page: Page, code: string) {
  await page.getByLabel('Number or serial').fill(code)
  await page.getByLabel('Number or serial').press('Enter')
}

test('labels put on as the count goes, found, and taken off those without a label', async ({ browser }) => {
  const id = tag()
  const speaker = `d&b Y10P ${id}`
  const bay = `Bay L ${id}`
  const context = await browser.newContext({ viewport: phoneSize })
  const page = await context.newPage()
  await page.goto('/#stock')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await newProduct(page, speaker, bay, 10)
  const first = await setAside(page, 5, `Roll ${id}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')

  await page.goto('/#stock/places')
  const all = page.getByRole('button', { name: /^Show all \d+ places$/ })
  if (await all.isVisible()) await all.click()
  await page.locator('.job-row', { hasText: bay }).click()
  await page.getByRole('button', { name: 'Count this place' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Counting ${bay}` })).toBeVisible()

  // Numbered kit is counted without a label only, and says so; 10 typed before any label goes on.
  const field = page.locator('label.count-field', { hasText: speaker })
  await expect(field).toContainText('Without a label only')
  await field.locator('input').fill('10')

  // The first label: which product, then it's found here.
  await typeIn(page, sh(first))
  const form = page.getByRole('form', { name: `Put ${sh(first)} on an item` })
  await expect(form.getByRole('heading')).toHaveText(`${sh(first)} isn't on anything yet`)
  await expect(form.getByLabel('Product')).toBeFocused()
  await form.getByLabel('Product').fill(speaker)
  await expect(form).toContainText('One of the 10 here without a label until now.')
  await form.getByRole('button', { name: `Put ${sh(first)} on a ${speaker}` }).click()
  const said = page.getByRole('status', { name: 'Last scan' })
  await expect(said).toHaveText(`${sh(first)} is on a ${speaker} now, and found. Scan the next label.`)
  await expect(page.locator('.count-tally')).toHaveText('1 of 1 found')
  await expect(field.locator('input')).toHaveValue('9')

  // The next: the product carries over, so a press does it.
  await typeIn(page, sh(first + 1))
  const next = page.getByRole('form', { name: `Put ${sh(first + 1)} on an item` })
  await expect(next.getByRole('button', { name: `Put ${sh(first + 1)} on a ${speaker}` })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(said).toHaveText(`${sh(first + 1)} is on a ${speaker} now, and found. Scan the next label.`)
  await expect(page.locator('.count-tally')).toHaveText('2 of 2 found')
  await expect(field.locator('input')).toHaveValue('8')
  await expect(field).toContainText('the 2 labelled here are scanned instead')

  // A maker's serial isn't a label to put on: noted, nothing asked.
  await typeIn(page, '4471')
  await expect(said).toHaveText("No item has SH-004471. It's noted on the count.")
  await expect(page.getByRole('form', { name: /^Put / })).toHaveCount(0)

  // A label scanned and left: noted, and put on later from the list.
  await typeIn(page, sh(first + 2))
  await page.getByRole('form', { name: `Put ${sh(first + 2)} on an item` }).getByRole('button', { name: 'Not now' }).click()
  await expect(page.locator('.said-list')).toContainText(`${sh(first + 2)} No item has this number.`)
  await page.locator('.said-list li', { hasText: sh(first + 2) }).getByRole('button', { name: 'Put it on its item' }).click()
  await page.getByRole('form', { name: `Put ${sh(first + 2)} on an item` }).getByRole('button', { name: `Put ${sh(first + 2)} on a ${speaker}` }).click()
  await expect(page.locator('.count-tally')).toHaveText('3 of 3 found')
  await expect(page.locator('.said-list')).not.toContainText(sh(first + 2))

  // One put on from the Stock search, the count still under way: found on the count too.
  await page.goto('/#stock')
  const find = page.getByLabel('Find')
  await find.fill(sh(first + 3))
  await find.press('Enter')
  const claim = page.getByRole('form', { name: `Put ${sh(first + 3)} on an item` })
  await claim.getByLabel('Product').fill(speaker)
  await claim.getByLabel("Where it's kept").fill(bay)
  await claim.getByRole('button', { name: `Put ${sh(first + 3)} on a ${speaker}` }).click()
  await expect(page.locator('p.added')).toContainText(`Added ${sh(first + 3)}`)
  await page.goto('/#stock/count')
  await expect(page.locator('.count-tally')).toHaveText('4 of 4 found')
  await expect(field.locator('input')).toHaveValue('6')
  await expect(page.getByText('4 labels put on during this count.')).toBeVisible()

  // Finished: every label found, and the six without a label as recorded.
  await page.getByRole('button', { name: 'Finish the count' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Count of ${bay}` })).toBeVisible()
  await expect(page.locator('.app')).toContainText('All 4 found')
  await expect(page.locator('.app')).toContainText(`${speaker} without a label`)
  await expect(page.locator('.app')).toContainText('6 counted, 6 recorded: as recorded.')
  await context.close()
})
