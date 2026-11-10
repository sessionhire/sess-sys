import { expect, test } from '@playwright/test'

/**
 * The client, venue and who asked on New quote: each finds what's typed
 * anywhere in a name already here (a venue by its address too), offers
 * adding what's typed as a new one in words, and a new name for who asked is
 * kept among the client's contacts for the next quote. Uses the made-up data
 * (ADR 0019), so it starts fresh.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test('New quote finds clients, venues and who asked as they are typed, and keeps new ones', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto('/#quotes')
  await expect(office.getByRole('status')).toHaveText('Up to date')
  const quotes = office.getByRole('region', { name: 'To follow up' })

  await quotes.getByRole('link', { name: 'New quote' }).click()
  let form = quotes.page().getByRole('form', { name: 'New quote' })
  await form.getByLabel("What's the job?").fill('Spring launch')

  // Who asked, with no client yet: anyone at any client, and picking them brings their client.
  await form.getByText('More about the enquiry').click()
  const asker = form.getByRole('combobox', { name: 'Who asked' })
  await asker.fill('niamh')
  const found = form.getByRole('listbox', { name: 'Found' })
  await expect(found.getByRole('option').first()).toContainText('Niamh Walsh')
  await expect(found.getByRole('option').first()).toContainText('Producer · Shannonside Festivals')
  await found.getByRole('option', { name: /Niamh Walsh/ }).click()
  await expect(asker).toHaveValue('Niamh Walsh')
  await expect(form.getByRole('combobox', { name: 'Client' })).toHaveValue('Shannonside Festivals')

  // The client: a word from the middle of the name finds it, with how many jobs it has had.
  const clientBox = form.getByRole('combobox', { name: 'Client' })
  await clientBox.fill('brands')
  await expect(found.getByRole('option', { name: /Liffey Brands/ })).toHaveAttribute('aria-selected', 'false')
  await expect(found.getByRole('option', { name: /Liffey Brands/ })).toContainText(/\d+ jobs?/)
  await expect(found.getByRole('option').last()).toHaveText('Add “brands” as a new client')
  await clientBox.press('ArrowDown')
  await clientBox.press('Enter')
  await expect(clientBox).toHaveValue('Liffey Brands')

  // Who asked now offers the client's own people on focus, and a new name says where it goes.
  await asker.fill('')
  await expect(form.getByRole('listbox', { name: 'Their people' }).getByRole('option')).toHaveText(['Ruairí KellyAccount director'])
  await asker.fill('Orla Byrne')
  await expect(found.getByRole('option').last()).toHaveText('Add “Orla Byrne” as a new contact for Liffey Brands')
  await expect(found.getByRole('option').last()).toHaveAttribute('aria-selected', 'true')
  await asker.press('Enter')
  await expect(asker).toHaveValue('Orla Byrne')

  // The venue by the town in its address; Enter takes the highlighted one.
  const venueBox = form.getByRole('combobox', { name: 'Venue' })
  await venueBox.fill('galway')
  await expect(found.getByRole('option', { name: /The Granary Hall/ })).toContainText('Quay Street, Galway')
  await venueBox.press('ArrowDown')
  await venueBox.press('Enter')
  await expect(venueBox).toHaveValue('The Granary Hall')

  // A client typed in another case takes the list's spelling when the field is left.
  await clientBox.fill('liffey brands')
  await expect(found.getByRole('option', { name: /Liffey Brands/ })).toHaveAttribute('aria-selected', 'true')
  await venueBox.focus()
  await expect(clientBox).toHaveValue('Liffey Brands')

  await form.getByRole('button', { name: 'Start the quote' }).click()
  await expect(office).toHaveURL(/#jobs\/[^/]+\/quote$/)
  // The page lands on the job's Quote tab once it's drawn (ADR 0140, part 4): pressed before then, a press can meet the page mid-scroll.
  await expect(office.getByRole('tab', { name: 'Quote' })).toBeFocused()

  // The next quote for Liffey Brands offers Orla too.
  await office.goto('/#quotes')
  await quotes.getByRole('link', { name: 'New quote' }).click()
  form = quotes.page().getByRole('form', { name: 'New quote' })
  await form.getByRole('combobox', { name: 'Client' }).fill('Liffey Brands')
  await form.getByText('More about the enquiry').click()
  await form.getByRole('combobox', { name: 'Who asked' }).focus()
  await expect(form.getByRole('listbox', { name: 'Their people' }).getByRole('option')).toHaveCount(2)
  await expect(form.getByRole('listbox', { name: 'Their people' })).toContainText('Orla Byrne')
})

test('the start of a client left in the field is that client, said so with a way to keep it new (audit of the quote flow, 8 November 2026, finding 3)', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto('/#quotes')
  await expect(office.getByRole('status')).toHaveText('Up to date')
  const quotes = office.getByRole('region', { name: 'To follow up' })
  await quotes.getByRole('link', { name: 'New quote' }).click()
  const form = quotes.page().getByRole('form', { name: 'New quote' })
  const clientBox = form.getByRole('combobox', { name: 'Client' })
  const found = form.getByRole('listbox', { name: 'Found' })

  // Down and Enter on the highlighted name takes it, never the "Add as new" past it.
  await clientBox.fill('bright')
  await expect(found.getByRole('option', { name: /Brightwater Conferences/ })).toHaveAttribute('aria-selected', 'true')
  await clientBox.press('ArrowDown')
  await clientBox.press('Enter')
  await expect(clientBox).toHaveValue('Brightwater Conferences')

  // Left with the start of one name, the field takes that name and says so.
  await clientBox.fill('bright')
  await clientBox.press('Tab')
  await expect(clientBox).toHaveValue('Brightwater Conferences')
  const took = form.locator('.name-took')
  await expect(took).toContainText('Took Brightwater Conferences, the one client starting “bright”.')

  // Keeping what was typed makes it new, and leaving the field again keeps it.
  await took.getByRole('button', { name: 'Keep “bright” as a new client' }).click()
  await expect(clientBox).toHaveValue('bright')
  await clientBox.focus()
  await clientBox.press('Tab')
  await expect(clientBox).toHaveValue('bright')
  await expect(form).toContainText('“bright” is added as a new client.')
})
