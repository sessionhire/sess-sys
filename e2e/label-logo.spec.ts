import { expect, test } from '@playwright/test'

/**
 * What every label says of the company (ADR 0106): the logo put up under
 * Admin › Company › Logo (ADR 0155) prints on item and cable labels, with an item's
 * stock code in words, and a cable's length
 * goes on in big type with the colour the company gives it, as a word in a
 * black band unless the printer prints colour. The length is read from the
 * name until one is given. The logo comes down again at the end, as other
 * tests print labels on the same server.
 */

const phoneSize = { width: 390, height: 844 }
const id = Math.random().toString(36).slice(2, 8)
/** A small PNG, as a logo file would be. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4YWRDEmIY1TCqYfhqAABa5TYQf4CqjAAAAABJRU5ErkJggg==',
  'base64'
)

test('the logo and a cable length with its colour go on cable labels', async ({ browser }) => {
  const context = await browser.newContext({ viewport: phoneSize })
  const page = await context.newPage()
  const name = `XLR 10m ${id}`
  const res = await context.request.post('/api/sync/push', {
    data: {
      clientId: `logo-${id}`,
      mutations: [
        {
          id: `m-${id}`,
          name: 'model.create',
          args: { id: `xlr-${id}`, name, department: 'audio', category: 'Cables', tracking: 'bulk', isCase: false, valueCents: null, notes: '', patMonths: null, liftingMonths: null, code: `XLR10-${id}` },
          createdAt: new Date().toISOString(),
        },
        {
          id: `m2-${id}`,
          name: 'model.create',
          args: { id: `amp-${id}`, name: `Amp ${id}`, department: 'audio', category: 'Amps', tracking: 'serialised', isCase: false, valueCents: null, notes: '', patMonths: null, liftingMonths: null, code: `D80-${id}` },
          createdAt: new Date().toISOString(),
        },
        {
          id: `m3-${id}`,
          name: 'asset.add',
          args: { id: `amp1-${id}`, modelId: `amp-${id}`, number: null, serial: '', placeId: null, caseId: null, notes: '', fromCount: false },
          createdAt: new Date().toISOString(),
        },
      ],
    },
  })
  expect((await res.json()).results.map((r: { status: string }) => r.status)).toEqual(['applied', 'applied', 'applied'])

  // The logo, put up under Admin › Company › Logo, as a quote and a label have it.
  await page.goto('/#admin/company')
  const card = page.getByRole('region', { name: 'Labels' })
  const logoCard = page.getByRole('region', { name: 'Logo' })
  await expect(logoCard.getByText('None yet. Quotes and labels say Session Hire')).toBeVisible()
  await expect(logoCard.getByText('Kind of file')).toBeVisible()
  // An SVG, wide and with only a viewBox, is drawn out to 1200 pixels: nothing to warn of.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><rect width="400" height="100" fill="#ee3744"/></svg>'
  await logoCard.getByText('Add the logo').locator('input[type=file]').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) })
  const shown = logoCard.getByRole('img', { name: 'as a label printer prints it' })
  await expect(shown).toHaveAttribute('src', /\/api\/settings\/logo\/photo\?v=/)
  await expect(logoCard.getByRole('img', { name: 'as a quote has it' })).toBeVisible()
  await expect.poll(() => shown.evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight])).toEqual([1200, 300])
  await expect(logoCard.locator('.warn-line')).toHaveCount(0)
  // A small square PNG goes up too, with a word on why it may print soft and small.
  const before = (await shown.getAttribute('src'))!
  await logoCard.getByText('Change logo').locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await expect(shown).not.toHaveAttribute('src', before)
  await expect(logoCard.getByRole('status')).toContainText("It's 16 pixels across, so it may print soft.")
  await expect(logoCard.getByRole('status')).toContainText('nearly square')
  // Made a PNG on white on the device, so its edges stay sharp.
  expect((await context.request.get((await shown.getAttribute('src'))!)).headers()['content-type']).toBe('image/png')

  // An item's own label carries the logo and its stock code in words, on a 25 mm square too (Colly, 8 November 2026).
  await page.goto(`/#stock/item/amp1-${id}`)
  await page.getByRole('button', { name: 'Print label' }).click()
  const own = page.getByLabel('Preview').locator('.label')
  for (const layout of ['Label printer, 50 × 25 mm', 'Label printer, 25 × 25 mm', 'Label printer, 100 × 25 mm, bigger type']) {
    await page.getByRole('radio', { name: layout }).check()
    await expect(own.locator('img.logo')).toHaveAttribute('src', /\/api\/settings\/logo\/photo\?v=/)
    await expect(own.locator('.code')).toHaveText(`D80-${id}`)
    const [sh, ch, sw, cw] = await own.evaluate((l) => [l.scrollHeight, l.clientHeight, l.scrollWidth, l.clientWidth])
    expect(sh).toBeLessThanOrEqual(ch! + 1)
    expect(sw).toBeLessThanOrEqual(cw! + 1)
  }
  await page.goto('/#admin/company')

  // The usual colours, and 10 m made pink.
  await expect(card.getByRole('listitem').filter({ hasText: 'Over 5 m, up to 10 m' })).toContainText('Green')
  await card.getByRole('button', { name: 'Change colours' }).click()
  const tenRow = card.getByRole('listitem').filter({ has: page.locator('input[value="10"]') })
  await tenRow.getByLabel('Colour').selectOption('pink')
  await card.getByRole('button', { name: 'Save colours' }).click()
  await expect(card.getByRole('listitem').filter({ hasText: 'Over 5 m, up to 10 m' })).toContainText('Pink')

  // The cable's labels: 10 m read from its name, pink as a word in a black band, and the logo.
  await page.goto(`/#stock/product/xlr-${id}`)
  await page.getByRole('tab', { name: 'Cable labels' }).click()
  const labels = page.getByRole('region', { name: 'Cable labels' })
  await expect(labels.getByText('Read from its name.')).toBeVisible()
  const label = labels.locator('.preview .label.cable')
  await expect(label.locator('.length')).toHaveText('10 m')
  const band = label.locator('.band')
  await expect(band).toHaveText('PINK')
  expect(await band.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgb(0, 0, 0)')
  await expect(label.locator('img.logo')).toHaveAttribute('src', /\/api\/settings\/logo\/photo\?v=/)
  const [scroll, client] = await label.locator('.face').first().evaluate((f) => [f.scrollHeight, f.clientHeight])
  expect(scroll).toBeLessThanOrEqual(client! + 1)

  // On a colour printer, the band in its colour; remembered on this device.
  await labels.getByLabel('This printer prints colour').check()
  expect(await band.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgb(236, 111, 174)')

  // Its own length, given under Details, is the one used.
  await page.getByRole('tab', { name: 'Details' }).click()
  await page.getByRole('button', { name: 'Change details' }).click()
  await page.getByLabel('Length, in m, for a cable').fill('15')
  await page.getByRole('button', { name: 'Save product' }).click()
  await page.getByRole('tab', { name: 'Cable labels' }).click()
  await expect(label.locator('.length')).toHaveText('15 m')
  await expect(band).toHaveText('BLUE')
  await expect(labels.getByText('Read from its name.')).toHaveCount(0)
  await expect(labels.getByLabel('This printer prints colour')).toBeChecked()

  // Back as it was, for the tests after this one.
  await page.goto('/#admin/company')
  await card.getByRole('button', { name: 'Change colours' }).click()
  await card.getByRole('button', { name: 'Start again from the usual list' }).click()
  await card.getByRole('button', { name: 'Save colours' }).click()
  await expect(card.getByRole('listitem').filter({ hasText: 'Over 5 m, up to 10 m' })).toContainText('Green')
  await logoCard.getByRole('button', { name: 'Remove logo' }).click()
  await logoCard.getByRole('button', { name: 'Take it down' }).click()
  await expect(logoCard.getByText('None yet. Quotes and labels say Session Hire')).toBeVisible()
  await context.close()
})
