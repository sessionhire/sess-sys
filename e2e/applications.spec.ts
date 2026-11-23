import { expect, test } from '@playwright/test'

/**
 * Applications to join the crew (ADR 0190), as the office and an applicant meet them: the office turns the Apply page on
 * under Admin, someone fills it in on their phone, and the office takes one on and turns another down under Crew ›
 * Applications. The page is turned off again at the end, as the test server is shared. SHOTS=1 refreshes the
 * blueprint's pictures.
 */

const shot = (name: string) => (process.env.SHOTS ? { path: `docs/hub/img/${name}.png` } : undefined)
const phoneSize = { width: 390, height: 844 }

test('applying on the Apply page, then taken on or turned down under Crew › Applications', async ({ browser }) => {
  const id = Date.now().toString(36)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto('/#admin/company')
  await expect(office.locator('.conn')).toHaveText('Up to date')
  const card = office.getByRole('region', { name: 'Applications to join' })
  // By the keyboard, as the long Company tab can still move under a pointer while its pictures load.
  const on = card.getByRole('switch', { name: /Take applications/ })
  await expect(on).not.toBeChecked()
  await on.focus()
  await office.keyboard.press('Space')
  await expect(card.getByText(/On: anyone with the address can apply/)).toBeVisible()

  // Two people apply on their phones, each as a person would, taking their time over it.
  const applicant = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // A mobile of this run's own, so nobody from an earlier run is already on the Crew tab with it.
  const mobile = (n: number) => `087 ${String(Date.now() % 10_000_000 + n).padStart(7, '0').slice(-7)}`
  const apply = async (first: string, last: string, email: string, n: number) => {
    await applicant.goto('/join')
    await expect(applicant.getByRole('heading', { name: 'Apply to join our crew' })).toBeVisible()
    await applicant.getByLabel('First name').fill(first)
    await applicant.getByLabel('Last name').fill(last)
    await applicant.getByLabel('Email').fill(email)
    await applicant.getByLabel('Mobile').fill(mobile(n))
    // What they do as pills: one picked from the offers as it's typed, one of their own typed and left for the form to take.
    const roles = applicant.getByRole('combobox', { name: 'What you do' })
    await roles.pressSequentially('lx o')
    await expect(applicant.getByRole('option', { name: 'LX op' })).toHaveAttribute('aria-selected', 'true')
    await roles.press('Enter')
    await expect(applicant.getByRole('list', { name: 'Chosen' })).toContainText('LX op')
    await roles.fill('grandMA')
    await applicant.getByLabel(/Your usual day rate/).fill('240')
    await applicant.getByRole('radio', { name: 'Sole trader' }).check()
    await applicant.getByLabel(/Where you/).fill('Cork')
    await applicant.getByLabel(/Your experience/).fill('Busked lights at Indiependence for three years.')
    await applicant.getByRole('checkbox', { name: /can keep these details/ }).check()
    await applicant.waitForTimeout(4_500)
    await applicant.getByRole('button', { name: 'Send my application' }).click()
    await expect(applicant.getByRole('heading', { name: 'Thanks for applying' })).toBeVisible()
  }
  // Left out: the agreement, so the page says so, keeping what was typed.
  await applicant.goto('/join')
  await expect(applicant.getByRole('radio', { name: 'Lighting' })).toHaveCount(0)
  await applicant.screenshot({ fullPage: true, ...shot('apply-page') })
  await applicant.getByLabel('First name').fill('Nobody')
  await applicant.waitForTimeout(4_500)
  await applicant.getByRole('button', { name: 'Send my application' }).click()
  await expect(applicant).toHaveTitle('Error: Apply to join our crew')
  await expect(applicant.getByRole('alert').first()).toContainText('things to fix')
  await expect(applicant.getByLabel('First name')).toHaveValue('Nobody')
  await applicant.screenshot({ fullPage: true, ...shot('apply-page-errors') })

  await apply('Fionn', `Test${id}`, `fionn.${id}@example.com`, 1)
  await apply('Saoirse', `Test${id}`, `saoirse.${id}@example.com`, 2)

  await office.goto('/#crew/applications')
  await expect(office.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible()
  const fionn = office.getByRole('region', { name: `Fionn Test${id}` })
  const saoirse = office.getByRole('region', { name: `Saoirse Test${id}` })
  // Both in, newest first, before anything is pressed, so nothing moves under the press.
  await expect(saoirse).toBeVisible()
  await expect(fionn).toContainText('Lighting')
  await expect(fionn).toContainText('LX op, grandMA')
  await expect(fionn).toContainText('€240')
  await expect(fionn).toContainText('Sole trader')
  await office.screenshot({ fullPage: true, ...shot('crew-applications') })

  await fionn.getByRole('button', { name: 'Take on' }).click()
  await expect(fionn).toHaveCount(0)
  await expect(office.getByText(`Took on Fionn Test${id}`)).toBeVisible()
  // Put away, as the office would, so it doesn't sit over the next card's buttons on a phone.
  await office.getByRole('button', { name: `Dismiss: Took on Fionn Test${id}` }).click()

  await saoirse.getByRole('button', { name: 'Turn down' }).click()
  await saoirse.getByRole('button', { name: 'Turn down' }).click()
  await expect(saoirse).toHaveCount(0)

  // Fionn is on the Crew tab as an applicant.
  await office.goto('/#crew/people')
  await office.getByRole('searchbox').first().fill(`Test${id}`)
  const main = office.getByRole('main')
  await expect(main.getByRole('link', { name: new RegExp(`Fionn Test${id}.*Level 0 \\(applicant\\)`) })).toBeVisible()
  await expect(main.getByText(`Saoirse Test${id}`)).toHaveCount(0)

  // Off again for the tests after this one: the page says to get in touch instead.
  await office.goto('/#admin/company')
  await expect(office.locator('.conn')).toHaveText('Up to date')
  const off = office.getByRole('region', { name: 'Applications to join' })
  const offSwitch = off.getByRole('switch', { name: /Take applications/ })
  await expect(offSwitch).toBeChecked()
  await offSwitch.focus()
  await office.keyboard.press('Space')
  await expect(off.getByText(/Off: the page says/)).toBeVisible()
  await expect(office.locator('.conn')).toHaveText('Up to date')
  await applicant.goto('/join')
  await expect(applicant.getByText("We're not taking applications here just now")).toBeVisible()
})
