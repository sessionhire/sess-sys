import { expect, test, type Page } from '@playwright/test'

/**
 * A crew call on a phase keeps to the phase's days (audit of crew offers, 12 November 2026, finding 11; ADR 0159). Moved off them,
 * a call held its crew for a day the calendar had nothing for: they were sent a cancellation for the old day, nothing for the new
 * one, and stayed booked. Now the days are picked among the phase's, a day past them is refused in the app's words, and a phase
 * that moves where keeping its crew's dates would leave them out takes them along. The test server is shared with the other
 * browser tests, so the job's name is this run's own.
 */

const phoneSize = { width: 390, height: 844 }
const tag = () => Math.random().toString(36).slice(2, 8)

async function ready(page: Page) {
  await page.goto('/#jobs')
  await expect(page.getByRole('status')).toHaveText('Up to date')
}

test("a crew call keeps to its phase's days, and goes with the phase when it moves", async ({ browser }) => {
  const job = `Riverside Sessions ${tag()}`
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office)
  await office.getByRole('button', { name: 'New', exact: true }).click()
  const form = office.locator('form').filter({ has: office.getByRole('button', { name: 'Add gig' }) })
  await form.getByLabel('Name', { exact: true }).fill(job)
  await form.getByLabel('Status').selectOption({ label: 'Confirmed' })
  await form.getByLabel('Phase 1', { exact: true }).fill('Build')
  await form.getByLabel('Phase 1 from').fill('2030-12-11')
  await form.getByLabel('Phase 1 to').fill('2030-12-12')
  await form.getByRole('button', { name: 'Add a phase' }).click()
  await form.getByLabel('Phase 2', { exact: true }).fill('Show')
  await form.getByLabel('Phase 2 from').fill('2030-12-13')
  await form.getByLabel('Phase 2 to').fill('2030-12-13')
  await form.getByRole('button', { name: 'Add gig' }).click()
  await expect(office.getByRole('heading', { name: job })).toBeVisible()
  await expect(office.locator('.conn')).toHaveText('Up to date')

  // Asked for on the Show: its one day, said under the days, and a day past it refused on its field in the app's words.
  await office.getByRole('tab', { name: /^Crew/ }).click()
  await office.getByRole('button', { name: 'Add a role' }).click()
  const ask = office.getByRole('form', { name: 'Add a role' })
  await ask.getByLabel('For which phase').selectOption({ label: 'Show, Fri 13 Dec' })
  await expect(ask.getByLabel('From')).toHaveValue('2030-12-13')
  await expect(ask.getByLabel('From')).toHaveAccessibleDescription('Show is Fri 13 Dec 2030: crew on it are asked for that day. For another day, add a phase.')
  await ask.getByLabel('Role').fill('LX op')
  await ask.getByLabel('How many').fill('1')
  await ask.getByLabel('From').fill('2030-12-14')
  await ask.getByRole('button', { name: 'Add role' }).click()
  await expect(ask.locator('.field-refusal', { hasText: 'From can be Fri 13 Dec 2030 at the latest.' })).toBeVisible()
  await expect(office.getByRole('article', { name: '1 × LX op' })).toHaveCount(0)
  await ask.getByLabel('From').fill('2030-12-13')
  await ask.getByLabel('To', { exact: true }).fill('2030-12-13')
  await ask.getByRole('button', { name: 'Add role' }).click()
  const call = office.getByRole('article', { name: '1 × LX op' })
  await expect(call).toBeVisible()
  await expect(office.locator('.conn')).toHaveText('Up to date')

  // Its Change form keeps to the Show's day too, and says how to move it further.
  await call.locator('.call-line').click()
  await call.getByRole('button', { name: 'Change', exact: true }).click()
  const change = office.getByRole('form', { name: 'Change the call for LX op' })
  await expect(change.getByLabel('From')).toHaveAccessibleDescription(
    'Show is Fri 13 Dec 2030: crew on it are asked for that day. To move the call, move the phase: its crew go with it.'
  )
  await change.getByRole('button', { name: 'Keep as it was' }).click()
  // The form folds away and the page goes back to the call's line, not to whatever was under the form.
  await expect(call.locator('.call-line')).toBeFocused()

  // The Show moves a day later. Keeping its crew's dates would leave the call on a day the Show no longer has, so that isn't offered:
  // the call goes with it.
  await office.getByRole('tab', { name: /^Phases/ }).click()
  const show = office.getByRole('article', { name: 'Show', exact: true })
  await show.getByRole('button', { name: 'Change', exact: true }).click()
  await show.getByLabel('From').fill('2030-12-14')
  await show.getByRole('button', { name: 'Save phase' }).click()
  await expect(show.getByText("Its crew call moves with it, as Fri 13 Dec 2030 won't be one of its days. The days its crew hold move too.")).toBeVisible()
  await expect(show.getByRole('button', { name: 'Keep their dates' })).toHaveCount(0)
  await show.getByRole('button', { name: 'Move them' }).click()
  await expect(show.locator('header')).toContainText('Sat 14 Dec')
  await expect(office.locator('.conn')).toHaveText('Up to date')

  await office.getByRole('tab', { name: /^Crew/ }).click()
  const line = call.locator('.call-line')
  if ((await line.getAttribute('aria-expanded')) !== 'true') await line.click()
  await expect(call.locator('.facts-line')).toContainText('Sat 14 Dec')
})

test('a call across phases says when it holds a day no phase has (the gap ADR 0159 left at 2)', async ({ browser }) => {
  // A call's days are one run, so one across a Build and a Show with a free day between holds that day too: crew on it are asked
  // for it with no calendar invite, which the card now says at rest, with the way out.
  const job = `Quay Street Nights ${tag()}`
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office)
  await office.getByRole('button', { name: 'New', exact: true }).click()
  const form = office.locator('form').filter({ has: office.getByRole('button', { name: 'Add gig' }) })
  await form.getByLabel('Name', { exact: true }).fill(job)
  await form.getByLabel('Status').selectOption({ label: 'Confirmed' })
  await form.getByLabel('Phase 1', { exact: true }).fill('Build')
  await form.getByLabel('Phase 1 from').fill('2030-12-11')
  await form.getByLabel('Phase 1 to').fill('2030-12-11')
  await form.getByRole('button', { name: 'Add a phase' }).click()
  await form.getByLabel('Phase 2', { exact: true }).fill('Show')
  await form.getByLabel('Phase 2 from').fill('2030-12-13')
  await form.getByLabel('Phase 2 to').fill('2030-12-13')
  await form.getByRole('button', { name: 'Add gig' }).click()
  await expect(office.getByRole('heading', { name: job })).toBeVisible()
  await expect(office.locator('.conn')).toHaveText('Up to date')

  await office.getByRole('tab', { name: /^Crew/ }).click()
  await office.getByRole('button', { name: 'Add a role' }).click()
  const ask = office.getByRole('form', { name: 'Add a role' })
  await ask.getByLabel('For which phase').selectOption({ label: 'Across several phases' })
  await ask.getByLabel('Which phases').fill('Build and Show')
  await ask.getByLabel('Role').fill('Rigger')
  await ask.getByLabel('How many').fill('1')
  await expect(ask.getByLabel('From')).toHaveValue('2030-12-11')
  await expect(ask.getByLabel('To', { exact: true })).toHaveValue('2030-12-13')
  await ask.getByRole('button', { name: 'Add role' }).click()
  const call = office.getByRole('article', { name: '1 × Rigger' })
  await expect(call).toBeVisible()
  await expect(call.locator('.warn-line')).toHaveText(
    'The call holds Thu 12 Dec 2030, which no phase of the job has: crew on it are asked for that day too, with no calendar invite for it. Add a phase for that day, or add crew to each phase on its own.'
  )

  // A phase for that day, and the line goes.
  await office.getByRole('tab', { name: /^Phases/ }).click()
  await office.getByRole('button', { name: 'Add phase', exact: true }).click()
  const add = office.getByRole('form', { name: 'Add a phase' })
  await add.getByLabel('New phase').fill('Rehearsal')
  await add.getByLabel('From').fill('2030-12-12')
  await add.getByLabel('To', { exact: true }).fill('2030-12-12')
  await add.getByRole('button', { name: 'Add phase' }).click()
  await expect(office.getByRole('article', { name: 'Rehearsal', exact: true })).toBeVisible()
  await office.getByRole('tab', { name: /^Crew/ }).click()
  await expect(call).toBeVisible()
  await expect(call.locator('.warn-line')).toHaveCount(0)
})
