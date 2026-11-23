import { expect, test } from '@playwright/test'

/**
 * Phone numbers with their country beside them (ADR 0190, then system-wide): a number typed as at home is kept in full,
 * one kept from before is written in full from Tidy up, and both are shown grouped for reading. SHOTS=1 keeps pictures.
 */

const shot = (name: string) => (process.env.SHOTS ? { path: `${process.env.SHOTS}/${name}.png` } : undefined)

test('a number typed as at home is kept in full, and one from before is written in full from Tidy up', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  // A number kept as it was typed, before the country picker.
  const before = await request.post('/api/sync/push', {
    data: { clientId: `e2e-phones-${id}`, mutations: [{ id: `e2e-phones-${id}`, name: 'person.upsert', args: { id: `before-${id}`, name: `Ciarán Before${id}`, kind: 'freelancer', email: null, phone: '086 831 9330', skills: [], dayRateCents: null, notes: '' }, createdAt: new Date().toISOString() }] },
  })
  expect(((await before.json()) as { results: { status: string }[] }).results.map((r) => r.status)).toEqual(['applied'])

  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto('/#crew/people')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('button', { name: 'New person' }).click()
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add person' }) })
  await form.getByLabel('First name').fill('Wiktoria')
  await form.getByLabel(/Last name/).fill(`Typed${id}`)
  await form.getByRole('combobox', { name: 'Country code' }).selectOption({ label: 'Poland +48' })
  await form.getByLabel('Mobile').fill('512 345 678')
  await page.screenshot(shot('person-phone-field'))
  await form.getByRole('button', { name: 'Add person' }).click()
  await page.getByRole('searchbox').first().fill(`Typed${id}`)
  await page.getByRole('main').getByRole('link', { name: new RegExp(`Wiktoria Typed${id}`) }).first().click()
  await expect(page.getByRole('link', { name: 'Call +48 512345678' })).toHaveAttribute('href', 'tel:+48512345678')

  // Tidy up writes the one from before in full, with a question first.
  const tall = await (await browser.newContext({ viewport: { width: 390, height: 2400 } })).newPage()
  await tall.goto('/#jobs/tidy')
  await expect(tall.getByRole('status')).toHaveText('Up to date')
  const card = tall.getByRole('region', { name: 'Phone numbers without their country code' })
  await expect(card).toContainText(`Ciarán Before${id}: 086 831 9330 → +353 86 831 9330`)
  await tall.screenshot(shot('tidy-phones'))
  await card.getByRole('button', { name: /in full$/ }).click()
  await card.getByRole('button', { name: 'Write them in full' }).click()
  await expect(tall.getByText(`Ciarán Before${id}: 086 831 9330`)).toHaveCount(0)

  await page.goto(`/#crew/person/before-${id}`)
  await expect(page.getByRole('link', { name: 'Call +353 86 831 9330' })).toHaveAttribute('href', 'tel:+353868319330')
})
