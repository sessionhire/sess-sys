import { expect, test, type Page } from '@playwright/test'

/**
 * The logo goes Home, and each person chooses the screen the app opens on (ADR 0122). The choice is kept with their
 * account, so here the server's answer to "who is this?" is played by the test, keeping what was chosen as the server would.
 */

const phoneSize = { width: 390, height: 844 }
const deskSize = { width: 1280, height: 800 }

test('the mark and the name top left go Home from any screen, on a phone and at a desk', async ({ browser }) => {
  for (const viewport of [phoneSize, deskSize]) {
    const page = await (await browser.newContext({ viewport })).newPage()
    await page.goto('/#stock/labels')
    const home = page.locator('.top').getByRole('link', { name: 'Session Hire: Home' })
    await expect(home).toBeVisible()
    // The whole block, mark and all, is the target: a thumb on the mark goes Home too.
    const mark = (await page.locator('.top .mark').boundingBox())!
    await page.mouse.click(mark.x + mark.width / 2, mark.y + mark.height / 2)
    await expect(page).toHaveURL(/#home$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home')
    await page.close()
  }
})

/** Signed in as Aoife, whose account keeps `start`; choosing under You changes it as the server would. */
async function signedIn(page: Page, start?: string) {
  const kept = { start }
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { auth: 'google', user: { id: 'u1', email: 'aoife@sessionhire.com', name: 'Aoife Byrne', ...(kept.start ? { start: kept.start } : {}) }, role: 'director', rolesOn: false } })
  )
  await page.route('**/api/me/start', async (route) => {
    const body = route.request().postDataJSON() as { start: string }
    kept.start = body.start === '#home' ? undefined : body.start
    await route.fulfill({ json: { ok: true } })
  })
  return kept
}

test("opens on the screen the person chose, only from the app's own address, and they choose it under You", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  const kept = await signedIn(page, '#jobs/plan')
  await page.goto('/')
  await expect(page).toHaveURL(/#jobs\/plan/)

  // A link to somewhere else lands where it points.
  await page.goto('/#stock')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Catalogue')

  // Under You, the choice is a list of screens; Jobs is kept with the account.
  await page.goto('/#me')
  const choice = page.getByRole('radiogroup', { name: 'Open the app on' })
  await expect(choice.getByRole('radio', { name: /^Planner/ })).toBeChecked()
  await choice.getByText('Jobs', { exact: true }).click()
  await expect(choice.getByRole('radio', { name: /^Jobs/ })).toBeChecked()
  await expect.poll(() => kept.start).toBe('#jobs')

  await page.goto('/')
  await expect(page).toHaveURL(/#jobs$/)
  await expect(page.locator('.job-row').first().or(page.getByRole('heading', { level: 1 }))).toBeVisible()

  // Back to Home, the default: the bare address stays Home.
  await page.goto('/#me')
  await page.getByRole('radiogroup', { name: 'Open the app on' }).getByText('Home', { exact: true }).click()
  await expect.poll(() => kept.start).toBeUndefined()
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home')
  expect(new URL(page.url()).hash).toBe('')
})
