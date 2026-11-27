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
  await office.getByRole('link', { name: 'New quote' }).first().click()
  const form = office.getByRole('form', { name: 'New quote' })
  // A name not like the gala's, so the client and venue are what find it.
  await form.getByLabel("What's the job?").fill(`Product launch ${id}`)
  await expect(form.getByRole('region', { name: 'Start from' }).getByRole('list', { name: 'Past jobs' })).toHaveCount(0)
  await form.getByLabel('Client').fill(`Liffey Brands ${id}`)
  await form.getByRole('combobox', { name: 'Venue' }).fill(`Round Room ${id}`)
  const past = form.getByRole('region', { name: 'Start from' })
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
  await form.getByRole('button', { name: /^Start quote with 2 lines/ }).click()
  await expect(office).toHaveURL(/#jobs\/[^/]+\/quote$/)
  // The page lands on the job's Quote tab once it's drawn (ADR 0140, part 4): pressed before then, a press can meet the page mid-scroll.
  await expect(office.getByRole('tab', { name: 'Quote' })).toBeFocused()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  await expect(draft).toContainText(`Hazer ${id}`)
  await expect(draft).not.toContainText(`DI box ${id}`)
  await expect(office.locator('.conn')).toHaveText('Up to date')

  // New quote is a page of its own, the client first (ADR 0140, part 7): the cursor starts there, and picking a past job straight
  // under it fills the name and the venue still empty, to change.
  await office.goto('/#quotes/new')
  const again = office.getByRole('form', { name: 'New quote' })
  await expect(office.getByRole('heading', { level: 1 })).toHaveText('New quote')
  await expect(again.getByRole('combobox', { name: 'Client' })).toBeFocused()
  await again.getByRole('combobox', { name: 'Client' }).fill(`Liffey Brands ${id}`)
  await again.getByRole('combobox', { name: 'Client' }).press('Escape')
  await again.getByRole('region', { name: 'Start from' }).getByRole('button', { name: new RegExp(`Spring gala ${id}`) }).click()
  await expect(again.getByLabel("What's the job?")).toHaveValue(`Spring gala ${id}`)
  await expect(again.getByRole('combobox', { name: 'Venue' })).toHaveValue(`Round Room ${id}`)
  // Who asked and the rest wait under one fold.
  await expect(again.getByRole('combobox', { name: 'Who asked' })).toBeHidden()
  await again.getByText('More about the enquiry').click()
  await expect(again.getByRole('combobox', { name: 'Who asked' })).toBeVisible()
  if (process.env.WALK) await office.screenshot({ path: process.env.WALK, fullPage: true })
  await again.getByRole('button', { name: 'Cancel' }).click()
  await expect(office).toHaveURL(/#jobs$/)
})

test("a job's own quote starts from a past gig like it, the most in common first", async ({ browser, request }) => {
  const id = tag()
  const at = new Date().toISOString()
  const ahead = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
  const quoteLine = (lineId: string, l: object) => ({ id: lineId, ref: null, vat: '23', per: 'day', days: 1, ...l })
  const past = (key: string, name: string, clientId: string, venueId: string, daysAgo: number, modelId: string) => [
    { name: 'project.create', args: { id: `${key}${id}`, name, clientId, venueId, status: 'confirmed', notes: '' } },
    { name: 'phase.add', args: { id: `ph${key}${id}`, projectId: `${key}${id}`, name: 'Show', start: dayAgo(daysAgo), end: dayAgo(daysAgo), venueId: null, notes: '' } },
    {
      name: 'quote.save',
      args: { id: `q${key}${id}`, projectId: `${key}${id}`, discountPct: 0, notes: '', lines: [quoteLine(`l${key}${id}`, { kind: 'kit', what: `Kit ${modelId}`, group: 'Audio', qty: 2, unitCents: 1_000, modelId: `${modelId}${id}` })] },
    },
  ]
  const setUp = [
    { name: 'client.upsert', args: { id: `c${id}`, name: `Docklands Media ${id}`, contacts: [], notes: '' } },
    { name: 'client.upsert', args: { id: `o${id}`, name: `Someone Else ${id}`, contacts: [], notes: '' } },
    { name: 'venue.upsert', args: { id: `v${id}`, name: `Hall One ${id}`, address: '', notes: '' } },
    { name: 'venue.upsert', args: { id: `w${id}`, name: `Hall Two ${id}`, address: '', notes: '' } },
    { name: 'model.create', args: { id: `mic${id}`, name: `Radio mic ${id}`, department: 'audio', category: 'Microphones', tracking: 'bulk', isCase: false, valueCents: null, notes: '' } },
    { name: 'model.create', args: { id: `spk${id}`, name: `Speaker ${id}`, department: 'audio', category: 'Speakers', tracking: 'bulk', isCase: false, valueCents: null, notes: '' } },
    // Older but with the client, venue and name in common; newer with only the venue; newest with only the name.
    ...past('all', `Annual awards ${id}`, `c${id}`, `v${id}`, 300, 'mic'),
    ...past('venue', `Staff party ${id}`, `o${id}`, `v${id}`, 60, 'spk'),
    ...past('name', `Annual awards dinner ${id}`, `o${id}`, `w${id}`, 30, 'spk'),
    { name: 'project.create', args: { id: `next${id}`, name: `Annual awards ${id}`, clientId: `c${id}`, venueId: `v${id}`, status: 'enquiry', notes: '' } },
    { name: 'phase.add', args: { id: `phnext${id}`, projectId: `next${id}`, name: 'Show', start: ahead, end: ahead, venueId: null, notes: '' } },
  ].map((m, i) => ({ ...m, id: `setup${id}${i}`, createdAt: at }))
  const pushed = await request.post('/api/sync/push', { data: { clientId: `office${id}`, mutations: setUp } })
  const res = await pushed.json()
  expect(res.results.map((r: { status: string }) => r.status)).toEqual(setUp.map(() => 'applied'))

  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office, `#jobs/next${id}/quote`)
  const start = office.getByRole('group', { name: 'Start from a past gig' })
  const found = start.getByRole('list', { name: 'Past jobs' }).getByRole('button')
  await expect(found).toHaveCount(3)
  await expect(found.nth(0)).toContainText(`Annual awards ${id}`)
  await expect(found.nth(0)).toContainText('Same client, venue and name')
  await expect(found.nth(1)).toContainText(`Annual awards dinner ${id}`)
  await expect(found.nth(1)).toContainText('Similar name')
  await expect(found.nth(2)).toContainText('Same venue')
  if (process.env.SHOTS) await start.screenshot({ path: 'e2e/screens/past-gig.png' })
  await found.nth(0).click()
  await expect(start.getByRole('region', { name: 'Lines to add' })).toContainText(`Radio mic ${id}`)
  await start.getByRole('button', { name: /^Start quote with 1 line/ }).click()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  await expect(draft).toContainText(`Radio mic ${id}`)

  // With lines on it, another gig's lines are added after them, from under More.
  await draft.getByRole('button', { name: 'More to add…' }).click()
  await draft.getByRole('button', { name: 'Add from a past gig' }).click()
  const more = draft.getByRole('group', { name: 'Start from a past gig' })
  await more.getByRole('button', { name: new RegExp(`Staff party ${id}`) }).click()
  await more.getByRole('button', { name: /^Add 1 line to the quote/ }).click()
  await expect(more).toHaveCount(0)
  await expect(draft).toContainText(`Radio mic ${id}`)
  await expect(draft).toContainText(`Speaker ${id}`)
  await expect(office.locator('.conn')).toHaveText('Up to date')
})
