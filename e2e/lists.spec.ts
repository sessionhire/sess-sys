import { expect, test, type APIRequestContext, type Locator } from '@playwright/test'

/**
 * Filter and sort on the long lists (ADR 0099): one shared part under each
 * list's search. On Jobs a filter narrows the tab, says itself as a chip and
 * in the Filter button's count, with how many of how many; another order
 * drops the week headings; Back from a job finds the same choices; and
 * Clear filters puts the list back. Venues sort by most jobs. Every list
 * opens with its add, a plain fold above its search and rows, whose form's
 * submit is then the page's one red. The test
 * server is shared with the other browser tests, so every name here is this
 * run's own, and found by a search that only this run's match.
 */

const phoneSize = { width: 390, height: 844 }
const tag = () => Math.random().toString(36).slice(2, 8)

async function push(request: APIRequestContext, from: string, mutations: (readonly [string, Record<string, unknown>])[]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: from, mutations: mutations.map(([name, args], i) => ({ id: `${from}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

test('jobs filter by status and kind, sort by name, and keep both on Back', async ({ browser, request }) => {
  const id = tag()
  const venue = `v-${id}`
  const job = (key: string, name: string, status: string, kind: string, day: number) =>
    [
      ['project.create', { id: `j-${id}-${key}`, name: `${name} ${id}`, clientId: null, venueId: key === 'b' ? null : venue, status, kind, notes: '' }],
      ['phase.add', { id: `ph-${id}-${key}`, projectId: `j-${id}-${key}`, name: 'Show', start: inDays(day), end: inDays(day), venueId: null, notes: '' }],
    ] as const
  await push(request, `lists-${id}`, [
    ['venue.upsert', { id: venue, name: `Hall ${id}`, address: '', notes: '' }],
    ['venue.upsert', { id: `${venue}-2`, name: `Barn ${id}`, address: '', notes: '' }],
    ...job('a', 'Zebra gala', 'confirmed', 'gig', 3),
    ...job('b', 'Apple launch', 'enquiry', 'gig', 5),
    ...job('c', 'Mango hire', 'confirmed', 'hire', 7),
  ])
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#jobs')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const list = page.getByRole('region', { name: 'Jobs' })
  const names = list.locator('.job-row b')
  await list.getByLabel('Find').fill(id)
  await expect(names).toHaveText([`Zebra gala ${id}`, `Apple launch ${id}`, `Mango hire ${id}`])
  await expect(list.locator('.week-head').first()).toBeVisible()

  // Name, A to Z: no week headings in an order that isn't by date.
  await list.getByLabel('Sort').selectOption('name')
  await expect(names).toHaveText([`Apple launch ${id}`, `Mango hire ${id}`, `Zebra gala ${id}`])
  await expect(list.locator('.week-head')).toHaveCount(0)

  // Confirmed, then Gig: each a chip, the count in the button, and how many of how many.
  await list.getByRole('button', { name: 'Filter', exact: true }).click()
  await expect(list.getByLabel('Status').locator('option', { hasText: 'Confirmed (2)' })).toHaveCount(1)
  await list.getByLabel('Status').selectOption('confirmed')
  await list.getByLabel('Kind').selectOption('gig')
  await expect(names).toHaveText([`Zebra gala ${id}`])
  await expect(list.getByRole('button', { name: 'Filter (2)' })).toBeVisible()
  await expect(list.locator('.list-count')).toHaveText('1 of 3 jobs.')
  // Each chip as tall as a thumb, as every target is (UX sweep, 6 November 2026, move 2).
  const chips = list.locator('.list-chip')
  await expect(chips).toHaveCount(2)
  for (const chip of await chips.all()) expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  // Back from the job finds the same order and filters.
  await names.first().click()
  await expect(page).toHaveURL(new RegExp(`#jobs/j-${id}-a`))
  await page.goBack()
  await expect(list.getByRole('button', { name: 'Filter (2)' })).toBeVisible()
  await expect(list.getByLabel('Sort')).toHaveValue('name')

  // A chip takes its own filter off; Clear filters the rest.
  await list.getByRole('button', { name: 'Take off the filter Kind: Gig' }).click()
  await list.getByLabel('Find').fill(id)
  await expect(names).toHaveText([`Mango hire ${id}`, `Zebra gala ${id}`])
  await list.getByRole('button', { name: 'Clear filters' }).click()
  await expect(names).toHaveCount(3)
  await expect(list.getByRole('button', { name: 'Filter', exact: true })).toBeVisible()
  await list.getByLabel('Sort').selectOption('date')

  // Venues: the one with jobs first by most jobs, and the one with none found by its filter.
  await page.goto('/#jobs/venues')
  const venues = page.getByRole('region', { name: 'Every venue' })
  await venues.getByLabel('Find a venue').fill(id)
  await venues.getByLabel('Sort').selectOption('jobs')
  await expect(venues.locator('.job-row b')).toHaveText([`Hall ${id}`, `Barn ${id}`])
  await venues.getByRole('button', { name: 'Filter', exact: true }).click()
  await venues.getByLabel('Jobs').selectOption('none')
  await expect(venues.locator('.job-row b')).toHaveText([`Barn ${id}`])
  await venues.getByRole('button', { name: 'Clear filters' }).click()
  await venues.getByLabel('Sort').selectOption('name')
})

test('every list opens with its add, a plain fold above its search and its rows, onto one red', async ({ browser, request }) => {
  // Proves: the way to add to a list is where the eye lands, as New job is on Jobs, and in the plain look: the red fill marks the one
  // thing to do next, so it isn't spent on an add, nor is the add left after two hundred rows (UX sweep, 6 November 2026, move 1).
  // Opened, the form's submit is the page's one next thing, so it's the one red.
  const id = tag()
  const plate = `241-D-${1000 + Math.floor(Math.random() * 9000)}`
  await push(request, `adds-${id}`, [
    ['person.upsert', { id: `p-${id}`, name: `Nuala Adds ${id}`, kind: 'freelancer', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }],
    ['model.create', { id: `m-${id}`, name: `Speaker ${id}`, department: 'audio', category: 'Speakers', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }],
    ['place.upsert', { id: `a-${id}`, name: `Bay ${id}`, notes: '' }],
    ['vehicle.save', { id: `v-${id}`, name: `Van ${id}`, registration: plate, kind: 'van', seats: 3, payloadKg: 1200, notes: '', checks: { test: { needed: true, expires: inDays(200) } } }],
    ['model.create', { id: `r-${id}`, name: `Rack ${id}`, department: 'audio', category: 'Racks', tracking: 'serialised', isCase: true, isRack: true, valueCents: null, notes: '', units: 6, depthMm: 600 }],
  ])
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  const top = async (l: Locator) => (await l.first().boundingBox())!.y
  const reds = () => page.evaluate(() => [...document.querySelectorAll('button.primary, a.button.primary')].filter((b) => b.getClientRects().length > 0).map((b) => b.textContent))
  const lists: readonly (readonly [string, string, string, (list: Locator) => Locator])[] = [
    ['#crew/people', 'People', 'Add person', (list) => list.getByLabel('Find a person')],
    ['#stock', 'Catalogue', 'Add product', (list) => list.getByRole('search')],
    ['#stock/places', 'Places', 'Add place', (list) => list.getByRole('link')],
    ['#stock/vehicles', 'Vehicles', 'Add vehicle', (list) => list.locator('.vehicle-row')],
    ['#stock/racks', 'Racks', 'Add rack', (list) => list.getByRole('link')],
  ]
  for (const [hash, name, add, rest] of lists) {
    await page.goto(`/${hash}`)
    await expect(page.getByRole('status')).toHaveText('Up to date')
    const list = page.getByRole('region', { name, exact: true })
    const opener = list.getByRole('button', { name: add, exact: true })
    await expect(opener).toBeVisible()
    await expect(opener).not.toHaveClass(/\bprimary\b/)
    expect(await top(opener), `${hash}: ${add} comes before the list`).toBeLessThan(await top(rest(list)))
    await opener.click()
    await expect(list.locator('form').getByRole('button', { name: add, exact: true })).toHaveClass(/\bprimary\b/)
    expect(await reds(), `${hash}: the reds with ${add} open`).toEqual([add])
  }
  // The purchase list's and the labels' adds are plain too.
  await page.goto('/#stock/buy')
  await expect(page.getByRole('button', { name: 'Ask for something to be bought' })).not.toHaveClass(/\bprimary\b/)
  await page.goto('/#stock/labels')
  await expect(page.getByRole('form', { name: 'Set numbers aside' }).getByRole('button', { name: 'Set numbers aside' })).not.toHaveClass(/\bprimary\b/)
})
