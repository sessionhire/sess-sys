import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * The last of the audit of the quote flow, 8 November 2026 (ADR 0133): findings 13, 15, 19 and 20. One half-made line
 * holds back only itself; a long draft on a phone opens folded to its groups, and picking kit there has the room; the
 * margin says when own kit isn't costed, and takes off the share set for it once it is; and a number guessed with no
 * signal is said to be one, and printed on a draft until the server gives it.
 */

const phoneSize = { width: 390, height: 844 }
const deskSize = { width: 1280, height: 900 }

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `quote-polish-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `quote-polish-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

async function ready(page: Page, hash: string) {
  await page.goto(`/${hash}`)
  await expect(page.locator('.conn')).toHaveText('Up to date')
}

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const other = (id: string, what: string, cents: number, group = 'Other') => ({ id, kind: 'other', what, ref: null, group, qty: 1, days: 1, unitCents: cents, vat: '23', per: 'once' })

/** A job one day long with a quote of these lines. */
function job(id: string, name: string, lines: object[]): [string, Record<string, unknown>][] {
  return [
    ['project.create', { id: `job-${id}`, name, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `ph-${id}`, projectId: `job-${id}`, name: 'Show', start: day(30), end: day(30), venueId: null, notes: '' }],
    ['quote.save', { id: `q-${id}`, projectId: `job-${id}`, lines, discountPct: 0, notes: '' }],
  ]
}

test('a half-made line holds back only itself, and own kit is costed once the office says what it costs to run', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const bulk = { department: 'audio', category: 'Sound', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }
  await push(request, id, [
    ['quoting.ownKit', { costPct: null }],
    ['model.create', { id: `mic-${id}`, name: `Shure SM58 ${id}`, ...bulk }],
    ['price.product', { modelId: `mic-${id}`, dayCents: 1_000 }],
    ...job(id, `Gala ${id}`, [
      { id: `l1-${id}`, kind: 'kit', what: `Shure SM58 ${id}`, ref: null, group: 'Audio', qty: 4, days: 1, unitCents: 1_000, vat: '23', per: 'day', modelId: `mic-${id}` },
      other(`l2-${id}`, 'Delivery', 5_000),
    ]),
  ])
  const office = await (await browser.newContext({ viewport: deskSize })).newPage()
  await ready(office, `#jobs/job-${id}/quote`)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  const summary = draft.getByRole('group', { name: 'What it comes to' })

  // Own kit counts as costing nothing until a share is set, and the margin says so.
  await expect(summary).toContainText('own kit not costed')

  // A new line left with nothing in it, then the delivery changed: the delivery saves, the empty line doesn't.
  await draft.getByRole('button', { name: 'Add something else' }).click()
  await draft.getByRole('button', { name: 'Delivery, change it' }).click()
  await draft.getByLabel(/: price, once$/).fill('60')
  await draft.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(draft.locator('.save-state')).toHaveText('Line 3 not saved')
  const second = await (await browser.newContext({ viewport: deskSize })).newPage()
  await ready(second, `#jobs/job-${id}/quote`)
  const theirs = second.getByRole('form', { name: 'Version 1, a draft' })
  await expect(theirs.getByRole('button', { name: 'Delivery, change it' })).toContainText('€60.00')
  await expect(theirs.getByRole('button', { name: /, change it$/ })).toHaveCount(2)

  // Admin › Company: own kit costs 15% of its price to run, and the margin takes it off: €40 of kit costs €6.
  await second.goto('/#admin/company')
  const card = second.getByRole('region', { name: 'Own kit in the margin' })
  await card.getByLabel('Own kit costs to run').fill('15')
  await card.getByRole('button', { name: 'Save' }).click()
  await expect(summary).not.toContainText('own kit not costed')
  await expect(summary).toContainText('€94.00')

  // Back as it was, for the other tests.
  await card.getByLabel('Own kit costs to run').fill('')
  await card.getByRole('button', { name: 'Save' }).click()
  await expect(summary).toContainText('own kit not costed')
})

test('a long draft on a phone opens folded to its groups, and picking kit there has the screen', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const lines = Array.from({ length: 14 }, (_, i) => other(`l${i}-${id}`, `Line ${i + 1}`, 1_000, i < 8 ? 'FOH' : 'Monitors'))
  await push(request, id, job(id, `Festival ${id}`, lines))
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office, `#jobs/job-${id}/quote`)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })

  // Each group is its title, how many lines and what they come to; a tap opens it.
  const foh = draft.getByRole('button', { name: /^FOH/ })
  await expect(foh).toHaveAttribute('aria-expanded', 'false')
  await expect(foh).toContainText('8 lines · €80.00')
  await expect(draft.getByRole('button', { name: 'Line 1, change it' })).toHaveCount(0)
  await foh.click()
  await expect(foh).toHaveAttribute('aria-expanded', 'true')
  await expect(draft.getByRole('button', { name: 'Line 1, change it' })).toBeVisible()
  await expect(draft.getByRole('button', { name: /^Monitors/ })).toHaveAttribute('aria-expanded', 'false')

  // Picking kit: the readout is one line and the bar steps aside.
  await expect(office.locator('.foot')).toBeVisible()
  await draft.getByRole('button', { name: 'Add kit' }).click()
  await expect(draft.locator('.quote-summary .figure').filter({ hasText: 'Total' })).toBeHidden()
  await expect(office.locator('.foot')).toBeHidden()
  await office.keyboard.press('Escape')
  await expect(office.locator('.foot')).toBeVisible()
})

test("a quote marked sent with no signal says its number is a guess, and prints as a draft until it's saved", async ({ browser, request }) => {
  const id = Date.now().toString(36)
  await push(request, id, job(id, `Awards ${id}`, [other(`l-${id}`, 'PA system', 50_000)]))
  const context = await browser.newContext({ viewport: phoneSize })
  const office = await context.newPage()
  // Printing is opened and left open, so the sheet can be read.
  await office.addInitScript(() => void (window.print = () => undefined))
  await ready(office, `#jobs/job-${id}/quote`)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })

  await context.setOffline(true)
  await draft.getByRole('button', { name: 'Get the PDF to send' }).click()
  const sent = office.getByRole('region', { name: 'Version 1' })
  await expect(sent.locator('.quote-facts')).toContainText("(once it's saved)")
  const sheet = office.locator('.print-sheet.quote-sheet')
  await expect(sheet.locator('.sheet-facts')).toContainText('Draft quote')
  await expect(sheet.locator('.sheet-facts')).toContainText("(once it's saved)")
  await expect(sheet).not.toContainText('as the reference')

  // Back online, the server's number stands, and the quote is a quote.
  await context.setOffline(false)
  await expect(office.locator('.conn')).toHaveText('Up to date')
  await expect(sent.locator('.quote-facts')).not.toContainText("(once it's saved)")
  await expect(sent.locator('.quote-facts')).toContainText(/Quote \d+/)
})
