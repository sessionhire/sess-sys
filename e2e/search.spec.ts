import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * One search for everything (review of 11 November 2026, finding 13), as a command palette (ADR 0147): from the magnifier
 * beside the bell, Ctrl K or Command K, or / at a desk, over the screen you're on, across the places to go, jobs, clients,
 * venues, people, products and kit by its number, each result opening its own page.
 */

const phoneSize = { width: 390, height: 844 }
const deskSize = { width: 1280, height: 900 }

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: {
      clientId: `search-${id}`,
      mutations: mutations.map(([name, args], i) => ({
        id: `search-${id}-${i}`,
        name,
        args,
        createdAt: new Date().toISOString(),
      })),
    },
  })
  const { results } = (await res.json()) as {
    results: { status: string; reason?: { message: string } }[]
  }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

test('the magnifier opens the palette over the screen, finds a job, its client and venue and a product, and keeps what was typed', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const word = `Kilrush${id}`
  await push(request, id, [
    ['client.upsert', { id: `c-${id}`, name: `${word} Arts`, contacts: [], notes: '' }],
    ['venue.upsert', { id: `v-${id}`, name: `${word} Hall`, address: 'Kilrush, Co. Clare', notes: '' }],
    ['project.create', { id: `j-${id}`, name: `${word} Festival`, clientId: `c-${id}`, venueId: `v-${id}`, status: 'confirmed', notes: '' }],
    [
      'model.create',
      { id: `m-${id}`, name: `${word} wedge`, department: 'audio', category: 'Speaker', tracking: 'bulk', isCase: false, valueCents: null, notes: '' },
    ],
  ])
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#stock')
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const palette = page.getByRole('dialog', { name: 'Search' })
  await expect(palette).toBeVisible()
  // Over the screen, not a page of its own: the address stays, and the screen is dimmed and blurred behind.
  await expect(page).toHaveURL(/#stock$/)
  const veil = await palette.evaluate((d) => getComputedStyle(d, '::backdrop').backdropFilter)
  expect(veil).toContain('blur')
  const field = palette.getByLabel('Search everything')
  await expect(field).toBeFocused()
  // With nothing typed it offers the places to go.
  await expect(palette.getByRole('group', { name: 'Go to' }).getByRole('option', { name: /Jobs/ })).toBeVisible()

  await field.fill(word.toLowerCase())
  await expect(palette.getByRole('group', { name: /^Jobs/ }).getByRole('option', { name: new RegExp(`${word} Festival`) })).toBeVisible()
  await expect(palette.getByRole('group', { name: /^Clients/ }).getByRole('option', { name: new RegExp(`${word} Arts`) })).toBeVisible()
  await expect(palette.getByRole('group', { name: /^Venues/ }).getByRole('option', { name: new RegExp(`${word} Hall`) })).toBeVisible()
  await expect(palette.getByRole('group', { name: /^Products/ }).getByRole('option', { name: new RegExp(`${word} wedge`) })).toBeVisible()
  // The first is highlighted, the one Enter takes.
  await expect(palette.getByRole('option', { selected: true })).toContainText(`${word} Festival`)

  // A result opens its page and the palette goes; opened again, what was typed is there.
  await palette.getByRole('group', { name: /^Clients/ }).getByRole('option', { name: new RegExp(`${word} Arts`) }).click()
  await expect(palette).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: `${word} Arts` })).toBeVisible()
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByLabel('Search everything')).toHaveValue(word.toLowerCase())

  // Nothing found says so; Escape closes it.
  await page.getByLabel('Search everything').fill(`nothing-${id}`)
  await expect(page.getByText(`Nothing called “nothing-${id}” on this device.`)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()

  // An old link to the search page opens the palette over Home.
  await page.goto('/#search')
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible()
  await expect(page).toHaveURL(/#home$/)
})

test('at a desk Ctrl K, even in a field, and / open the palette; arrows and Enter go; F still finds on the page', async ({ browser }) => {
  const desk = await (await browser.newContext({ viewport: deskSize })).newPage()
  await desk.goto('/#jobs')
  await expect(desk.locator('.conn')).toHaveText('Up to date')
  await desk.keyboard.press('f')
  const find = desk.getByLabel('Find', { exact: true })
  await expect(find).toBeFocused()
  // Held with Ctrl it's the palette's key, typed into a field or not; pressed again it shuts.
  await desk.keyboard.press('Control+k')
  const palette = desk.getByRole('dialog', { name: 'Search' })
  await expect(palette.getByLabel('Search everything')).toBeFocused()
  await desk.keyboard.press('Control+k')
  await expect(palette).toBeHidden()

  await find.blur()
  await desk.keyboard.press('/')
  await expect(palette.getByLabel('Search everything')).toBeFocused()
  await desk.keyboard.type('stock')
  await expect(palette.getByRole('option', { selected: true })).toContainText('Stock')
  await desk.keyboard.press('Enter')
  await expect(palette).toBeHidden()
  await expect(desk).toHaveURL(/#stock$/)

  // Down from nothing typed lands on the first place; a press on the veil closes it.
  await desk.keyboard.press('Control+k')
  await desk.getByLabel('Search everything').fill('')
  await desk.keyboard.press('ArrowDown')
  await expect(palette.getByRole('option', { selected: true })).toContainText('Home')
  await desk.mouse.click(10, 10)
  await expect(palette).toBeHidden()
})

test('with nothing typed, Recent lists what was opened lately on this device, newest first, as it is now', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const word = `Ennis${id}`
  await push(request, id, [
    ['client.upsert', { id: `c-${id}`, name: `${word} Arts`, contacts: [], notes: '' }],
    ['venue.upsert', { id: `v-${id}`, name: `${word} Hall`, address: 'Ennis, Co. Clare', notes: '' }],
    ['project.create', { id: `j-${id}`, name: `${word} Festival`, clientId: `c-${id}`, venueId: `v-${id}`, status: 'confirmed', notes: '' }],
  ])
  const desk = await (await browser.newContext({ viewport: deskSize })).newPage()
  await desk.goto('/#home')
  await expect(desk.locator('.conn')).toHaveText('Up to date')
  // Nothing opened yet: no Recent, the places first.
  await desk.keyboard.press('Control+k')
  const palette = desk.getByRole('dialog', { name: 'Search' })
  await expect(palette.getByRole('group', { name: 'Go to' })).toBeVisible()
  await expect(palette.getByRole('group', { name: 'Recent' })).toHaveCount(0)
  await desk.keyboard.press('Escape')

  // Opened one way or another: from the palette, a link, a tab of a job.
  await desk.goto(`/#jobs/clients/c-${id}`)
  await expect(desk.getByRole('heading', { level: 1, name: `${word} Arts` })).toBeVisible()
  await desk.goto(`/#jobs/venues/v-${id}`)
  await expect(desk.getByRole('heading', { level: 1, name: `${word} Hall` })).toBeVisible()
  await desk.goto(`/#jobs/j-${id}/crew`)
  await expect(desk.getByRole('heading', { level: 1, name: `${word} Festival` })).toBeVisible()
  await desk.goto('/#stock')

  await desk.keyboard.press('Control+k')
  await desk.getByLabel('Search everything').fill('')
  const recent = palette.getByRole('group', { name: 'Recent' })
  await expect(recent.getByRole('option')).toHaveText([new RegExp(`${word} Festival`), new RegExp(`${word} Hall`), new RegExp(`${word} Arts`)])
  // Above the places, so Down then Enter goes back to the last one.
  await desk.keyboard.press('ArrowDown')
  await expect(palette.getByRole('option', { selected: true })).toContainText(`${word} Festival`)
  await desk.keyboard.press('Enter')
  await expect(desk).toHaveURL(new RegExp(`#jobs/j-${id}$`))

  // The one on the screen behind isn't offered; a renamed one shows its name now; typing hides Recent.
  await push(request, `${id}-r`, [['venue.upsert', { id: `v-${id}`, name: `${word} Theatre`, address: 'Ennis, Co. Clare', notes: '' }]])
  await desk.keyboard.press('Control+k')
  await expect(recent.getByRole('option')).toHaveText([new RegExp(`${word} Theatre`), new RegExp(`${word} Arts`)])
  await desk.getByLabel('Search everything').fill(word.toLowerCase())
  await expect(palette.getByRole('group', { name: 'Recent' })).toHaveCount(0)
})
