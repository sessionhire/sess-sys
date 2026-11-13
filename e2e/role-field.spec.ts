import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * The role on a crew call is the combobox the client and venue fields are (13 November 2026): it offers the roles already
 * asked for and the crew list's skills, most asked for first, and still takes one nobody has asked for before.
 */

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `role-field-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `role-field-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

const shots = process.env.SHOTS

test('the role on a crew call offers the roles already known, and takes a new one', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const job = `Role field ${id}`
  await push(request, id, [
    ['project.create', { id: `j-${id}`, name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `p-${id}`, projectId: `j-${id}`, name: 'Show', start: '2030-12-20', end: '2030-12-21', venueId: null, notes: '' }],
    ['person.upsert', { id: `a-${id}`, name: `Aoife Role ${id}`, kind: 'freelancer', email: null, phone: null, skills: [`Lampie ${id}`], dayRateCents: null, notes: '' }],
    ['person.upsert', { id: `b-${id}`, name: `Brian Role ${id}`, kind: 'freelancer', email: null, phone: null, skills: [`lampie ${id}`, 'Rigger'], dayRateCents: null, notes: '' }],
  ])
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: shots ? 2 : 1 })).newPage()
  await page.goto(`/#jobs/j-${id}/crew`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('button', { name: 'Add crew' }).first().click()
  const ask = page.getByRole('form', { name: 'Add crew' })
  const role = ask.getByRole('combobox', { name: 'Role' })

  // A tap offers the most used; typing finds the crew list's skill in the spelling most have, and Enter takes it.
  await role.click()
  await expect(ask.getByRole('listbox', { name: 'Most used' })).toBeVisible()
  await role.fill(`lamp`)
  const found = ask.getByRole('listbox', { name: 'Found' })
  const lampie = found.getByRole('option', { name: new RegExp(`Lampie ${id}`) })
  await expect(lampie).toContainText('2 people on the crew list')
  // The list stays inside the phone's width.
  const box = (await found.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  if (shots) await page.screenshot({ path: `${shots}/role-found-phone.png` })
  await role.press('Enter')
  await expect(role).toHaveValue(`Lampie ${id}`)
  await ask.getByRole('button', { name: 'Add crew' }).click()
  // Added, the form closes and the page goes to the new call's card, out of sight above it on a phone, whose line takes the focus;
  // a pop-up at the bottom says what was added and that nobody has been offered it yet (13 November 2026).
  await expect(ask).toBeHidden()
  const line = page.getByRole('article', { name: `1 × Lampie ${id}` }).locator('.call-line')
  await expect(line).toBeFocused()
  await expect(line).toBeInViewport()
  const toasts = page.getByRole('region', { name: 'Notifications' })
  await expect(toasts).toContainText(`Added 1 × Lampie ${id}`)
  await expect(toasts).toContainText('Nobody offered it yet: Offer… is on its card.')
  if (shots) await page.screenshot({ path: `${shots}/role-added-phone.png` })

  // Added once, it's offered first with how many calls it's on; a role nobody has used is kept as typed.
  await page.getByRole('button', { name: 'Add crew' }).click()
  await role.click()
  await expect(ask.getByRole('listbox', { name: 'Most used' })).toBeVisible()
  await role.fill(`Lampie ${id}`)
  await expect(ask.getByRole('listbox', { name: 'Found' }).getByRole('option', { name: new RegExp(`Lampie ${id}`) })).toContainText('On 1 call · 2 people on the crew list')
  await role.fill('Pyro technician')
  const fresh = ask.getByRole('option', { name: 'Add “Pyro technician” as a new role' })
  await expect(fresh).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/role-new-phone.png` })
  await fresh.click()
  await expect(role).toHaveValue('Pyro technician')
  await ask.getByRole('button', { name: 'Add crew' }).click()
  await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('Added 1 × Pyro technician')
  await expect(page.getByRole('article', { name: '1 × Pyro technician' }).locator('.call-line')).toBeFocused()
})
