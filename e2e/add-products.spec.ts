import { createServer, type Server } from 'node:http'
import { expect, test } from '@playwright/test'

/**
 * Adding products from photos (ADR 0203), at phone size: Claude turned on,
 * a photo of an item read as one already on the list, and "It's this one"
 * adds nothing; an item typed in is read, filled in, checked and added, and
 * shows under Done just now. Anthropic is a stand-in on the port the server
 * was told, as in the Claude test. Uses the made-up data (ADR 0019).
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }
const standInPort = Number(process.env.E2E_PORT ?? '3099') + 1001
const shots = process.env.E2E_SHOTS

const base = {
  known: true,
  maker: '',
  model: '',
  otherNames: [],
  department: 'audio',
  category: '',
  tracking: 'serialised',
  isCase: false,
  lengthM: null,
  weightKg: null,
  powerW: null,
  rackMount: false,
  rackUnits: null,
  depthMm: null,
  valueEuro: null,
  needsPat: false,
  sameAs: '',
  sure: 'sure',
  said: '',
  sources: [],
  photoToTake: '',
}
const mic = { ...base, name: 'Shure SM58', maker: 'Shure', model: 'SM58', category: 'Microphones', tracking: 'bulk', sameAs: 'Shure SM58', said: 'Shure SM58 on the grille and the label.' }
const hazer = {
  ...base,
  name: 'Chauvet Hurricane Haze 4D',
  maker: 'Chauvet DJ',
  model: 'Hurricane Haze 4D',
  otherNames: ['Haze 4D'],
  department: 'lighting',
  category: 'Hazers',
  weightKg: 10.2,
  powerW: 600,
  valueEuro: 499,
  needsPat: true,
  sure: 'likely',
  said: 'Read from what was typed; the maker’s page gives the weight and power.',
  sources: [{ title: 'Hurricane Haze 4D – Chauvet DJ', url: 'https://www.chauvetdj.com/products/hurricane-haze-4d/' }],
}

let standIn: Server
test.beforeAll(async () => {
  standIn = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      if (req.method !== 'POST' || !req.url?.startsWith('/v1/messages')) return res.writeHead(404).end()
      const sent = JSON.parse(body) as { model: string }
      const answer = body.includes('Hurricane') ? hazer : mic
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          id: 'msg_stand_in',
          type: 'message',
          role: 'assistant',
          model: sent.model,
          content: [{ type: 'text', text: JSON.stringify(answer) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 4_000, output_tokens: 600, server_tool_use: { web_search_requests: 1 } },
        })
      )
    })
  })
  await new Promise<void>((resolve) => standIn.listen(standInPort, '127.0.0.1', resolve))
})
test.afterAll(async ({ request }) => {
  await new Promise((resolve) => standIn.close(resolve))
  await request.post('/api/data/start-fresh', fresh)
})

test('a photo read as kit already on the list adds nothing; a typed item is read, checked and added', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const page = await (await browser.newContext({ viewport: phoneSize, deviceScaleFactor: shots ? 2 : 1 })).newPage()

  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, e.stack))
  await page.goto('/#admin/claude')
  const toggle = page.getByRole('region', { name: 'Claude', exact: true }).getByRole('switch', { name: /Turn Claude on/ })
  await toggle.click()
  await expect(toggle).toBeChecked()

  // In Stock's Views.
  await page.goto('/#stock')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await page.goto('/#stock/add')
  await expect(page.getByRole('heading', { name: 'Photograph an item' })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/add-products-phone.png` })

  // A photo, made on the page as a phone's camera would give it.
  const jpeg = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 480
    const g = c.getContext('2d')!
    g.fillStyle = '#333'
    g.fillRect(0, 0, 640, 480)
    g.fillStyle = '#ccc'
    g.beginPath()
    g.arc(320, 200, 90, 0, Math.PI * 2)
    g.fill()
    const blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/jpeg', 0.9))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await page.locator('.add-photo input[type=file]').setInputFiles({ name: 'mic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg) })

  // Read, it's the SM58 already on the list: said above the form, and It's this one adds nothing.
  const alike = page.getByRole('group', { name: 'Already on the stock list?' })
  await expect(alike).toContainText('Shure SM58')
  await expect(page.getByText('Suggested by Claude.')).toBeVisible()
  await expect(page.getByLabel(/^Name/)).toHaveValue('Shure SM58')
  if (shots) await page.locator('.check-item').screenshot({ path: `${shots}/add-products-already-phone.png` })
  await alike.getByRole('button', { name: "It's this one" }).click()
  await expect(page.getByRole('heading', { name: /Done just now/ })).toBeVisible()

  // Typed in: read, filled in from the maker's page, checked and added.
  await page.getByLabel(/Or type what it is/).fill('Chauvet Hurricane hazer')
  await page.getByRole('button', { name: 'Look it up' }).click()
  await expect(page.getByLabel(/^Name/)).toHaveValue('Chauvet Hurricane Haze 4D')
  await expect(page.getByLabel(/^Department/).last()).toHaveValue('lighting')
  await expect(page.getByLabel(/^Weight, in kg/)).toHaveValue('10.2')
  await expect(page.getByLabel(/^Value of one, in euro/)).toHaveValue('499')
  await expect(page.getByLabel(/PAT tested every year/)).toBeChecked()
  await expect(page.getByRole('link', { name: /Hurricane Haze 4D – Chauvet DJ/ })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Already on the stock list?' })).toHaveCount(0)
  if (shots) await page.locator('.check-item').screenshot({ path: `${shots}/add-products-check-phone.png` })
  await page.getByRole('button', { name: 'Add product' }).click()
  const done = page.locator('section.card').filter({ has: page.getByRole('heading', { name: /Done just now/ }) })
  await expect(done).toContainText('Chauvet Hurricane Haze 4D')
  await expect(page.getByRole('heading', { name: /To check/ })).toHaveCount(0)
  if (shots) await page.screenshot({ path: `${shots}/add-products-done-phone.png`, fullPage: true })

  // It's on the stock list.
  await page.goto('/#stock')
  await page.getByRole('searchbox').first().fill('Hurricane')
  await expect(page.getByText('Chauvet Hurricane Haze 4D').first()).toBeVisible()
})
