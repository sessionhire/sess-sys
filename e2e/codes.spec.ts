import { expect, test, type Locator, type Page } from '@playwright/test'
import { createRequire } from 'node:module'

/**
 * Codes that say what something is (ADR 0195), at phone size: a product's
 * code on its page, its next codes set aside from its Items tab and printed
 * in each layout, each fitting its label and its QR code reading back as the
 * code; then one scanned in the Stock search goes on that product with no
 * question about which, and the product's code alone finds the product.
 */

const shot = (name: string) => (process.env.SHOTS ? { path: `docs/hub/img/${name}.png` } : undefined)
const phoneSize = { width: 390, height: 844 }
const tag = () => Math.random().toString(36).slice(2, 8)
const named = (name: string, id: string) => (process.env.SHOTS ? name : `${name} ${id}`)
const decoder = createRequire(import.meta.url).resolve('jsqr/dist/jsQR.js')

/** Scrolled so that an element sits right under the sticky header, for a screenshot. */
const startAt = (el: Locator) =>
  el.evaluate((e) => scrollBy(0, e.getBoundingClientRect().top - document.querySelector('.top')!.getBoundingClientRect().bottom + 12))

async function ready(page: Page, hash = '#stock') {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

/** A numbered product with some counted at a place, not labelled yet. */
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

/** What a label's QR code says, read from a picture of it as a camera would. */
async function readQr(label: Locator): Promise<string | undefined> {
  // From the app's own address, as its content security policy lets in no script written into the page (audit finding 24).
  const page = label.page()
  await page.route('**/e2e/jsQR.js', (route) => route.fulfill({ contentType: 'text/javascript', path: decoder }))
  await page.addScriptTag({ url: '/e2e/jsQR.js' })
  return label.locator('svg.qr').evaluate(async (svg) => {
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 264
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 264, 264)
    ctx.drawImage(img, 32, 32, 200, 200)
    const { data, width, height } = ctx.getImageData(0, 0, 264, 264)
    const jsQR = (window as unknown as { jsQR: (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null }).jsQR
    return jsQR(data, width, height)?.data
  })
}

/** The number fits on the label, whichever layout. */
async function fits(label: Locator) {
  const [scroll, client] = await label.locator('b').evaluate((b) => [b.scrollWidth, b.clientWidth])
  expect(scroll).toBeLessThanOrEqual(client!)
}


test("a product's codes are set aside, printed, and put on items with no question about the product", async ({ browser }) => {
  const id = tag()
  const speaker = named('d&b Y10P', id)
  const bay = named('Bay A3', id)
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(page)
  await newProduct(page, speaker, bay, 3)

  // Its product code, on its page.
  await page.getByRole('tab', { name: /^Details/ }).click()
  const code = (await page.locator('.facts div', { hasText: 'Product code' }).locator('dd').textContent())!
  expect(code).toMatch(/^\d{4}$/)

  // Its next codes set aside from the Items tab: as many as are still without a label.
  await page.getByRole('tab', { name: /^Items/ }).click()
  const labels = page.getByRole('region', { name: 'Labels' })
  await expect(labels).toContainText(`Its codes start ${code}, then the item's own number: ${code}-001, ${code}-002 and on.`)
  const form = labels.getByRole('form', { name: 'Set codes aside' })
  await expect(form.getByLabel('How many labels')).toHaveValue('3')
  await form.getByRole('button', { name: 'Set codes aside' }).click()
  await form.getByRole('button', { name: 'Set them aside' }).click()
  await expect(form.locator('.added')).toHaveText(`Set aside ${code}-001 to ${code}-003. Open them to print.`, { timeout: 20_000 })

  // The run, with the product named on each label, every layout fitting and reading back.
  await form.locator('.added a').click()
  await expect(page.getByRole('heading', { level: 1, name: `${code}-001 to ${code}-003` })).toBeVisible()
  await expect(page.locator('.facts')).toContainText(`Product${speaker}`)
  const print = page.getByRole('region', { name: 'On another printer' })
  const preview = print.getByLabel('Preview').locator('.label')
  await expect(preview.locator('b')).toHaveText([`${code}-001`, `${code}-002`, `${code}-003`])
  for (const layout of ['Label printer, 25 × 25 mm', 'Label printer, 100 × 25 mm, bigger type', 'A4 sheets of 65, 38 × 21 mm', 'Label printer, 50 × 25 mm']) {
    await print.getByRole('radio', { name: layout }).check()
    await fits(preview.first())
    expect(await readQr(preview.nth(1))).toBe(`${code}-002`)
  }
  await startAt(print.locator('fieldset'))
  await page.screenshot(shot('codes-run'))

  // Scanned in the Stock search, as a keyboard scanner types it: the code names its product, so only where it's kept is asked.
  await page.goto('/#stock')
  const find = page.getByLabel('Find')
  await find.fill(`${code}-002`)
  await find.press('Enter')
  const claim = page.getByRole('form', { name: `Put ${code}-002 on an item` })
  await expect(claim).toContainText(`A label for ${speaker}. Where is it kept?`)
  await expect(claim.getByLabel('Product')).toHaveCount(0)
  await expect(claim.getByLabel("Where it's kept")).toBeFocused()
  await claim.getByLabel("Where it's kept").fill(bay)
  await expect(claim.getByRole('checkbox', { name: `One of the 3 counted at ${bay}, not labelled until now` })).toBeChecked()
  await claim.getByRole('button', { name: `Put ${code}-002 on a ${speaker}` }).click()
  await expect(page.locator('p.added')).toHaveText(`Added ${code}-002 (${speaker}) at ${bay}. Scan the next label.`, { timeout: 20_000 })

  // Typed loosely, the code still finds its item; the product's code alone, as on a bag of cables, opens the product.
  await find.fill(`${Number(code)} 2`)
  await find.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: `${code}-002` })).toBeVisible()
  await page.goto('/#stock')
  await page.getByLabel('Find').fill(code)
  await expect(page.getByRole('region', { name: 'Catalogue' })).toContainText(speaker)
  await page.getByLabel('Find').press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: speaker })).toBeVisible()
})
