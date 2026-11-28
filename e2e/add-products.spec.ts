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

test('on a laptop, the webcam takes the item and its label, and one more for the label of an item being checked', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: shots ? 2 : 1 })).newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, e.stack))
  // A webcam made of a canvas, redrawn all the time as a camera's picture is.
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const g = canvas.getContext('2d')!
    let n = 0
    const draw = () => {
      g.fillStyle = '#4a5058'
      g.fillRect(0, 0, 1280, 720)
      g.fillStyle = '#d8d8d8'
      g.beginPath()
      g.arc(640, 330, 160 + (n++ % 10), 0, Math.PI * 2)
      g.fill()
    }
    setInterval(draw, 50)
    draw()
    const listeners = new Set<() => void>()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => canvas.captureStream(20),
        enumerateDevices: async () => [{ kind: 'videoinput', deviceId: '', groupId: '', label: '' }],
        addEventListener: (_: string, f: () => void) => listeners.add(f),
        removeEventListener: (_: string, f: () => void) => listeners.delete(f),
      },
    })
  })

  await page.goto('/#admin/claude')
  const toggle = page.getByRole('region', { name: 'Claude', exact: true }).getByRole('switch', { name: /Turn Claude on/ })
  await toggle.click()
  await expect(toggle).toBeChecked()
  await page.goto('/#stock')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await page.goto('/#stock/add')

  // A laptop's file field only opens the files, so the webcam is offered beside it.
  await expect(page.getByRole('button', { name: 'Use the webcam' })).toBeVisible()
  await expect(page.locator('.add-photo input[type=file]')).not.toHaveAttribute('capture')
  await expect(page.getByText('Upload photos')).toBeVisible()
  await page.getByRole('button', { name: 'Use the webcam' }).click()
  const cam = page.getByRole('group', { name: 'Webcam' })
  await expect(cam.getByRole('status')).toContainText('Hold the item up to the camera')
  await expect(cam.getByRole('button', { name: 'Look this item up' })).toBeDisabled()

  // The item, then its label: two photos for one item, either can be taken out again.
  await cam.getByRole('button', { name: 'Take photo' }).click()
  await expect(page.getByRole('list', { name: 'Photos of this item' }).getByRole('img')).toHaveCount(1)
  await cam.getByRole('button', { name: 'Take photo' }).click()
  await expect(page.getByRole('list', { name: 'Photos of this item' }).getByRole('img')).toHaveCount(2)
  await expect(cam.getByRole('status')).toContainText('Two photos of this item')
  if (shots) await page.locator('section.card').first().screenshot({ path: `${shots}/add-products-webcam-desk.png` })
  await cam.getByRole('button', { name: 'Look this item up' }).click()
  await expect(page.getByRole('list', { name: 'Photos of this item' })).toHaveCount(0)

  // Read as the SM58; the camera stays on for the next item.
  const item = page.locator('.check-item')
  await expect(page.getByLabel(/^Name/)).toHaveValue('Shure SM58')
  await expect(item.locator('.add-photos img')).toHaveCount(2)
  await expect(cam.getByRole('button', { name: 'Take photo' })).toBeEnabled()

  // One more of its label from the item being checked: the webcam there takes one and closes.
  await item.getByRole('button', { name: 'Photograph its label' }).click()
  const itemCam = item.getByRole('group', { name: 'Webcam' })
  await expect(itemCam.getByRole('status')).toContainText("Hold its maker's label up to the camera.")
  await itemCam.getByRole('button', { name: 'Take photo' }).click()
  await expect(item.locator('.add-photos img')).toHaveCount(3)
  await expect(item.getByRole('group', { name: 'Webcam' })).toHaveCount(0)
  // Three is the most, so there's no more to take.
  await expect(item.getByRole('button', { name: 'Photograph its label' })).toHaveCount(0)

  await cam.getByRole('button', { name: 'Close camera' }).click()
  await expect(page.getByRole('button', { name: 'Use the webcam' })).toBeVisible()
})

test('on a phone, no webcam button: the one field opens the camera', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize, hasTouch: true, isMobile: true })).newPage()
  await page.goto('/#stock/add')
  await expect(page.getByRole('heading', { name: 'Photograph an item' })).toBeVisible()
  await expect(page.locator('.add-photo input[type=file]')).toHaveAttribute('capture', 'environment')
  await expect(page.getByRole('button', { name: 'Use the webcam' })).toHaveCount(0)
})

test("on a laptop, a freelancer's link takes the item's photos with the webcam, under the page's strict policy", async ({ browser, request }) => {
  const id = Math.random().toString(36).slice(2, 8)
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
  await page.goto('/#admin/claude')
  const toggle = page.getByRole('region', { name: 'Claude', exact: true }).getByRole('switch', { name: /Turn Claude on/ })
  await toggle.click()
  await expect(toggle).toBeChecked()
  const res = await request.post('/api/sync/push', {
    data: {
      clientId: `e2e${id}`,
      mutations: [{ id: `${id}fl`, name: 'person.upsert', args: { id: `p${id}`, name: `Webcam Freelancer ${id}`, kind: 'freelancer', email: `cam-${id}@example.com`, phone: null, skills: [], dayRateCents: 30000, notes: '' }, createdAt: new Date().toISOString() }],
    },
  })
  expect((await res.json()).results[0].status).toBe('applied')
  const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; id: string; data: { linkToken: string } }[] }
  const link = `/f/${changes.filter((c) => c.entity === 'person' && c.id === `p${id}`).pop()!.data.linkToken}`

  const laptop = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
  const refused: string[] = []
  laptop.on('console', (m) => {
    if (m.type() === 'error') refused.push(m.text())
  })
  await laptop.addInitScript(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const g = canvas.getContext('2d')!
    const draw = () => {
      g.fillStyle = '#4a5058'
      g.fillRect(0, 0, 1280, 720)
      g.fillStyle = '#d8d8d8'
      g.fillRect(500, 200, 280, 320)
    }
    // A camera gives no picture for a moment after it's allowed: nothing is drawn until the test says the picture is on.
    ;(window as unknown as { cameraPicture: () => void }).cameraPicture = () => {
      setInterval(draw, 50)
      draw()
    }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => canvas.captureStream(20),
        enumerateDevices: async () => [{ kind: 'videoinput', deviceId: '', groupId: '', label: '' }],
      },
    })
  })
  await laptop.goto(`${link}/add`)
  await expect(laptop.getByRole('heading', { name: 'An item at a time' })).toBeVisible()
  await expect(laptop.locator('#pick')).not.toHaveAttribute('capture')
  await laptop.getByRole('button', { name: 'Use the webcam' }).click()
  const cam = laptop.getByRole('group', { name: 'Webcam' })
  // Until the camera's picture is on, Take photo is off and the page says what it waits for: a press then took nothing.
  await expect(laptop.locator('#photo-status')).toHaveText('Turning the camera on…')
  await expect(cam.getByRole('button', { name: 'Take photo' })).toBeDisabled()
  await laptop.evaluate(() => (window as unknown as { cameraPicture: () => void }).cameraPicture())
  await expect(laptop.locator('#photo-status')).toContainText('Hold the item up to the camera')
  await expect(cam.getByRole('button', { name: 'Take photo' })).toBeFocused()
  await cam.getByRole('button', { name: 'Take photo' }).click()
  await cam.getByRole('button', { name: 'Take photo' }).click()
  const taken = laptop.getByRole('list', { name: 'Photos of this item' })
  await expect(taken.getByRole('img')).toHaveCount(2)
  await expect(laptop.locator('#photo-status')).toContainText('Two photos of this item. Take its label too, or read it.')
  await taken.getByRole('button', { name: 'Take out photo 2' }).click()
  await expect(taken.getByRole('img')).toHaveCount(1)
  if (shots) await laptop.screenshot({ path: `${shots}/add-products-link-webcam-desk.png` })
  await laptop.getByRole('button', { name: 'Read it' }).click()
  await expect(laptop.getByText('Suggested by Claude.')).toBeVisible()
  await expect(laptop.getByLabel(/^Name/)).toHaveValue('Shure SM58')
  expect(refused.filter((t) => /Content Security Policy|Refused/i.test(t))).toEqual([])
})
