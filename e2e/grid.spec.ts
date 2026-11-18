import { expect, test, type Page } from '@playwright/test'

/**
 * The 4px grid (GridOverlay.tsx): the switch at the foot of the sidebar is
 * there for one signed-in account only, the grid it lays over the app lets
 * every press through, and on or off is kept on the device.
 */
const signedInAs = (page: Page, email: string) =>
  page.route('**/api/me', (route) => route.fulfill({ json: { auth: 'google', user: { id: 'u1', email, name: 'Someone' }, role: 'director', rolesOn: true } }))

test.use({ viewport: { width: 1280, height: 800 } })

test('the grid switch is only there for the one account, and the grid can be pressed through', async ({ page }) => {
  await signedInAs(page, 'colly@sessionhire.com')
  await page.goto('/#jobs')
  const toggle = page.getByRole('button', { name: '4px grid' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.grid-overlay')).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.grid-overlay')).toBeVisible()
  // Under the grid, the places still take a press.
  await page.getByRole('link', { name: 'Stock' }).click()
  await expect(page).toHaveURL(/#stock/)

  // Kept on this device.
  await page.reload()
  await expect(page.locator('.grid-overlay')).toBeVisible()
  await page.getByRole('button', { name: '4px grid' }).click()
  await expect(page.locator('.grid-overlay')).toHaveCount(0)
})

test('nobody else gets the switch or the grid, even with it left on', async ({ page }) => {
  await signedInAs(page, 'ciara@sessionhire.com')
  await page.addInitScript(() => localStorage.setItem('sh.grid', 'on'))
  await page.goto('/#jobs')
  await expect(page.getByRole('link', { name: 'Jobs' })).toBeVisible()
  await expect(page.getByRole('button', { name: '4px grid' })).toHaveCount(0)
  await expect(page.locator('.grid-overlay')).toHaveCount(0)
})
