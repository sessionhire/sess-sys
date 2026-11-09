import { expect, test, type Page } from '@playwright/test'

/**
 * Starting a quote from a past job (ADR 0115): once the client and venue are ones worked for before, New quote offers
 * the jobs like this one, and starts the quote from what the closest actually needed: kit as much as went out, with
 * what went beyond its quote added and marked.
 */

const phoneSize = { width: 390, height: 844 }
const tag = () => Math.random().toString(36).slice(2, 8)
const dayAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

async function ready(page: Page, hash: string) {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

test('a new quote for a client at a venue worked before starts from what went out last time', async ({ browser, request }) => {
  const id = tag()
  const at = new Date().toISOString()
  const day = dayAgo(30)
  const kitLine = (modelId: string, qty: number) => ({ id: `k${modelId}`, projectId: `gala${id}`, phaseId: null, modelId, qty, subhireQty: 0, supplier: '', notes: '' })
  const quoteLine = (lineId: string, l: object) => ({ id: lineId, ref: null, vat: '23', per: 'day', days: 1, ...l })
  const setUp = [
    { name: 'client.upsert', args: { id: `c${id}`, name: `Liffey Brands ${id}`, contacts: [], notes: '' } },
    { name: 'venue.upsert', args: { id: `v${id}`, name: `Round Room ${id}`, address: '', notes: '' } },
    { name: 'model.create', args: { id: `mic${id}`, name: `Shure SM58 ${id}`, department: 'audio', category: 'Microphones', tracking: 'bulk', isCase: false, valueCents: null, notes: '' } },
    { name: 'model.create', args: { id: `di${id}`, name: `DI box ${id}`, department: 'audio', category: 'DI', tracking: 'bulk', isCase: false, valueCents: null, notes: '' } },
    { name: 'model.create', args: { id: `haze${id}`, name: `Hazer ${id}`, department: 'lighting', category: 'Effects', tracking: 'bulk', isCase: false, valueCents: null, notes: '' } },
    { name: 'price.product', args: { modelId: `mic${id}`, dayCents: 1_200 } },
    { name: 'project.create', args: { id: `gala${id}`, name: `Spring gala ${id}`, clientId: `c${id}`, venueId: `v${id}`, status: 'confirmed', notes: '' } },
    { name: 'phase.add', args: { id: `ph${id}`, projectId: `gala${id}`, name: 'Show', start: day, end: day, venueId: null, notes: '' } },
    {
      name: 'quote.save',
      args: {
        id: `q${id}`,
        projectId: `gala${id}`,
        discountPct: 0,
        notes: '',
        lines: [
          quoteLine(`l1${id}`, { kind: 'kit', what: `Shure SM58 ${id}`, group: 'Audio', qty: 4, unitCents: 1_000, modelId: `mic${id}` }),
          quoteLine(`l2${id}`, { kind: 'kit', what: `DI box ${id}`, group: 'Audio', qty: 2, unitCents: 500, modelId: `di${id}` }),
        ],
      },
    },
    { name: 'kit.add', args: kitLine(`mic${id}`, 4) },
    { name: 'kit.add', args: kitLine(`di${id}`, 2) },
    // On the night: two more mics and a hazer went out, and the DIs never did.
    { name: 'move.record', args: { id: `m1${id}`, projectId: `gala${id}`, direction: 'out', assetId: null, modelId: `mic${id}`, qty: 6, at } },
    { name: 'move.record', args: { id: `m2${id}`, projectId: `gala${id}`, direction: 'out', assetId: null, modelId: `haze${id}`, qty: 1, at } },
  ].map((m, i) => ({ ...m, id: `setup${id}${i}`, createdAt: at }))
  const pushed = await request.post('/api/sync/push', { data: { clientId: `office${id}`, mutations: setUp } })
  const res = await pushed.json()
  expect(res.results.map((r: { status: string }) => r.status)).toEqual(setUp.map(() => 'applied'))

  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office, '#quotes')
  await office.getByRole('button', { name: 'New quote' }).first().click()
  const form = office.getByRole('form', { name: 'New quote' })
  await form.getByLabel("What's the job?").fill(`Summer gala ${id}`)
  await expect(form.getByRole('region', { name: 'Start from a past job' })).toHaveCount(0)
  await form.getByLabel('Client').fill(`Liffey Brands ${id}`)
  await form.getByRole('combobox', { name: 'Venue' }).fill(`Round Room ${id}`)
  const past = form.getByRole('region', { name: 'Start from a past job' })
  const gala = past.getByRole('button', { name: new RegExp(`Spring gala ${id}`) })
  await expect(gala).toContainText('Same client and venue')
  await expect(gala).toContainText('3 lines, 2 went beyond its quote')
  await gala.click()
  await expect(gala).toHaveAttribute('aria-pressed', 'true')

  const lines = form.getByRole('region', { name: 'Lines for the quote' })
  const mic = lines.getByRole('listitem').filter({ hasText: `Shure SM58 ${id}` })
  await expect(mic).toContainText('6 ×')
  await expect(mic.locator('.line-note')).toHaveText('4 quoted, 6 went out')
  await expect(mic).toContainText('€12.00 a day')
  const di = lines.getByRole('listitem').filter({ hasText: `DI box ${id}` })
  await expect(di.locator('.line-note')).toHaveText('2 quoted, none went out')
  await expect(di.getByRole('checkbox')).not.toBeChecked()
  const haze = lines.getByRole('listitem').filter({ hasText: `Hazer ${id}` })
  await expect(haze.locator('.line-note')).toHaveText('Not on the quote: 1 went out')
  await expect(haze.getByRole('checkbox')).toBeChecked()

  if (process.env.SHOTS) await form.screenshot({ path: 'e2e/screens/past-job.png' })
  await form.getByRole('button', { name: /^Start the quote with 2 lines/ }).click()
  await expect(office).toHaveURL(/#jobs\/[^/]+\/quote$/)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  await expect(draft).toContainText(`Hazer ${id}`)
  await expect(draft).not.toContainText(`DI box ${id}`)
  await expect(office.locator('.conn')).toHaveText('Up to date')
})
