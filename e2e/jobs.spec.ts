import { expect, test, type Page } from '@playwright/test'

/**
 * Jobs end to end (ADR 0007): the office adds a job with its client, venue
 * and phases, sees how each day will read on the calendar, and asks for crew
 * for a phase; renaming the job renames it for the crew too. A job added
 * with no signal waits on the phone, its phase can be changed meanwhile, and
 * both go through once the signal is back.
 * The test server is shared with the other browser tests, so every name here
 * is this run's own. To refresh the blueprint screenshots, run this file on
 * its own with SHOTS=1: the names are then plain, as the office would type them.
 */

const shot = (name: string) => (process.env.SHOTS ? { path: `docs/hub/img/${name}.png` } : undefined)
const phoneSize = { width: 390, height: 844 }
const tag = () => Math.random().toString(36).slice(2, 8)
const named = (name: string, id: string) => (process.env.SHOTS ? name : `${name} ${id}`)

async function ready(page: Page, hash = '#jobs') {
  await page.goto(`/${hash}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
}

/** New job waits behind its button at the top of the list on a phone (audit finding 22). */
async function newJobForm(page: Page) {
  await page.getByRole('button', { name: 'New', exact: true }).click()
  return page.locator('form').filter({ has: page.getByRole('button', { name: 'Add gig' }) })
}

test('a job with its phases and crew, renamed for the crew too', async ({ browser }) => {
  const id = tag()
  const job = named('Nissan launch', id)
  const renamed = named('Nissan Qashqai launch', id)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office)

  const form = await newJobForm(office)
  await form.getByLabel('Name', { exact: true }).fill(job)
  await expect(form.getByLabel('Status')).toHaveValue('enquiry')
  await form.getByLabel('Status').selectOption({ label: 'Confirmed' })
  await expect(form.getByText('A confirmed job goes on the jobs calendar and holds its kit.')).toBeVisible()
  await form.getByLabel('Client').fill(named('Nissan Ireland', id))
  // A client not known yet says it will be added (audit, 5 November 2026, finding 21).
  await expect(form.getByText(`“${named('Nissan Ireland', id)}” is added as a new client.`)).toBeVisible()
  await form.getByLabel('Venue').fill(named('The Heritage', id))
  await form.getByLabel('Phase 1', { exact: true }).fill('Build')
  await form.getByLabel('Phase 1 from').fill('2030-10-07')
  await form.getByLabel('Phase 1 to').fill('2030-10-08')
  await form.getByRole('button', { name: 'Add a phase' }).click()
  await form.getByLabel('Phase 2', { exact: true }).fill('Show')
  await form.getByLabel('Phase 2 from').fill('2030-10-09')
  await form.getByLabel('Phase 2 to').fill('2030-10-09')
  await form.getByRole('button', { name: 'Add gig' }).click()

  // The job opens on its own page, with each day as it will read on the calendar.
  await expect(office.getByRole('heading', { name: job })).toBeVisible()
  await expect(office.locator('.conn')).toHaveText('Up to date')
  await expect(office.locator('.page-sub .job-position')).toContainText('Planning')
  await expect(office.locator('.page-sub')).toContainText(named('Nissan Ireland', id))
  await expect(office.locator('.page-sub')).toContainText('Mon 7 Oct to Wed 9 Oct')
  // A phase's call sheet and calendar line wait behind a tap on its details (audit finding 16), under Phases.
  await office.getByRole('tab', { name: /^Phases/ }).click()
  for (const phase of ['Build', 'Show']) await office.getByRole('article', { name: phase }).locator('summary').click()
  await expect(office.getByText(`Goes on the calendar as “${job} - Build 1/2” and “${job} - Build 2/2” once one is connected in Admin.`)).toBeVisible()
  await expect(office.getByText(`Goes on the calendar as “${job} - Show” once one is connected in Admin.`)).toBeVisible()

  // Crew for the build.
  await office.getByRole('tab', { name: /^Crew/ }).click()
  await office.getByRole('button', { name: 'Add a role' }).click()
  const ask = office.getByRole('form', { name: 'Add a role' })
  await ask.getByLabel('For which phase').selectOption({ label: 'Build, Mon 7 Oct to Tue 8 Oct' })
  await ask.getByLabel('Role').fill('Audio tech')
  await ask.getByLabel('How many').fill('2')
  await ask.getByLabel('Day rate €').fill('250')
  await ask.getByRole('button', { name: 'Add role' }).click()
  const build = office.getByRole('article', { name: 'Build' })
  await expect(build.locator('.job b')).toHaveText('2 × Audio tech')
  // The call is one line under its phase (audit finding 16); a tap opens its days, rate and department (ADR 0046), which "Audio tech" suggests.
  await build.getByRole('button', { name: '2 × Audio tech' }).click()
  await expect(build.locator('.job p').first()).toHaveText('Mon 7 Oct to Tue 8 Oct · €250 · Audio')
  await expect(office.locator('.conn')).toHaveText('Up to date')
  // Said once in the head: by the name's line when the job's under way, else as the Crew fact (review of 11 November 2026, finding 4).
  await expect(office.locator('.page-head')).toContainText('0 of 2 booked')
  await office.evaluate(() => scrollTo(0, 0))
  await office.screenshot(shot('jobs-job'))

  // Renamed, and the crew screen says so too. Each box for notes says who reads it (ADR 0151): the office's never leave the app.
  await office.getByRole('button', { name: 'Change details' }).click()
  await office.getByLabel('Job', { exact: true }).fill(renamed)
  await expect(office.getByLabel('Notes for the crew', { exact: true })).toHaveAccessibleDescription(
    "On the call sheet and the jobs calendar, and in each person's invite once they've said yes."
  )
  const officeNotes = office.getByLabel('Office notes', { exact: true })
  await expect(officeNotes).toHaveAccessibleDescription('Only in the app, for the office: never on the calendar, a call sheet or a message.')
  await officeNotes.fill('Client pays late: chase the deposit.')
  await office.getByRole('button', { name: 'Save job' }).click()
  await expect(office.getByRole('heading', { name: renamed })).toBeVisible()
  await expect(office.getByRole('region', { name: 'Details', exact: true })).toContainText('Office notes: Client pays late: chase the deposit.')
  await expect(office.locator('.conn')).toHaveText('Up to date')
  await office.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Crew' }).click()
  // The job's call is past the fortnight Crew needed shows at rest (audit, 20 October 2026, finding 23).
  await office.getByRole('button', { name: /^Show all \d+ calls? still needing something$/ }).click()
  // Grouped by job (audit finding 16): the job's name and Open job on the group, the call as one line under it.
  const group = office.locator('.call-group', { hasText: renamed })
  await expect(group.locator('header b')).toHaveText(renamed)
  await expect(group.locator('.job', { hasText: '2 × Audio tech' })).toContainText('Build')
  await expect(group.getByRole('link', { name: 'Open job' })).toBeVisible()

  // Back on the list, the job shows its crew still to find.
  await office.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Jobs' }).click()
  await office.getByLabel('Find').fill(renamed)
  const row = office.locator('.job-row', { hasText: renamed })
  await expect(row).toContainText('Mon 7 Oct to Wed 9 Oct · Build, Show')
  // Said once, in where the job stands, not again at the side (review of 11 November 2026, finding 5).
  await expect(row).toContainText('Planning · 0 of 2 booked')
  await expect(row).not.toContainText('Crew 0 of 2 booked')
  await office.getByLabel('Find').fill('')
  await office.getByLabel('Find').blur()
  await office.screenshot(shot('jobs-list'))
})

test('a job added with no signal waits on the phone, then goes through', async ({ browser }) => {
  const job = named('Fuel conference', tag())
  const context = await browser.newContext({ viewport: phoneSize })
  const phone = await context.newPage()
  await ready(phone)
  await context.setOffline(true)

  const form = await newJobForm(phone)
  await form.getByLabel('Name', { exact: true }).fill(job)
  await form.getByLabel('Client').fill('Fuel Events')
  await form.getByLabel('Phase 1 from').fill('2030-11-02')
  await form.getByLabel('Phase 1 to').fill('2030-11-02')
  await form.getByRole('button', { name: 'Add gig' }).click()

  await expect(phone.getByRole('heading', { name: job })).toBeVisible()
  await expect(phone.locator('.corner-status .pill')).toHaveText('Waiting to sync')
  await expect(phone.getByRole('status')).toContainText('No signal')

  // Its phase can be changed while it waits too; the change goes up after it (audit finding 23).
  await phone.getByRole('tab', { name: /^Phases/ }).click()
  const phase = phone.getByRole('article', { name: 'Show', exact: true })
  await expect(phase.locator('.pill')).toHaveText('Waiting to sync')
  await phase.getByRole('button', { name: 'Change', exact: true }).click()
  await phase.getByLabel('To', { exact: true }).fill('2030-11-03')
  await phase.getByRole('button', { name: 'Save phase' }).click()
  await expect(phase.locator('header')).toContainText('Sat 2 Nov to Sun 3 Nov')

  await context.setOffline(false)
  await phone.evaluate(() => dispatchEvent(new Event('online')))
  await expect(phone.getByRole('status')).toHaveText('Up to date', { timeout: 20_000 })
  // Nobody chose a status, so it came in as an enquiry: nothing on the jobs calendar, no kit held.
  await expect(phone.locator('.corner-status .pill')).toHaveText('Enquiry')

  // And another device has it.
  const laptop = await (await browser.newContext()).newPage()
  await ready(laptop)
  await laptop.getByLabel('Find').fill(job)
  // A laptop's list is a table (review of 11 November 2026, finding 14): its days and its phases in their own columns.
  const row = laptop.locator('.job-row', { hasText: job })
  await expect(row.locator('.c-when')).toHaveText('Sat 2 Nov to Sun 3 Nov')
  await expect(row.locator('.c-name small')).toHaveText('Show')
})

test('New asks what kind it is first, then only what that kind needs', async ({ browser }) => {
  // Proves (Colly, 12 November 2026): the kind is the first question; a dry hire asks for the day out and back, not phases or a
  // venue; an errand for a day and where to, not a client or a status, and is added confirmed with its one day named Errand.
  const id = tag()
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office)
  await newJobForm(office)
  // The form goes by its kind, so it's found by its class rather than its Add button, whose words change with it.
  const form = office.locator('form.new-job')
  await expect(form.getByRole('radio', { name: 'Gig' })).toBeChecked()
  await expect(form.getByRole('group', { name: 'Phases' })).toBeVisible()
  await form.getByLabel('Name', { exact: true }).fill(`Van run ${id}`)

  await form.getByRole('radio', { name: 'Dry hire' }).check()
  await expect(form.getByLabel('Going out')).toBeVisible()
  await expect(form.getByLabel('Coming back')).toBeVisible()
  await expect(form.getByRole('group', { name: 'Phases' })).toHaveCount(0)
  await expect(form.getByRole('combobox', { name: 'Venue' })).toHaveCount(0)
  await expect(form.getByLabel('Status')).toBeVisible()

  await form.getByRole('radio', { name: 'Errand' }).check()
  // What was typed stays when the kind changes.
  await expect(form.getByLabel('Name', { exact: true })).toHaveValue(`Van run ${id}`)
  await expect(form.getByRole('combobox', { name: 'Client' })).toHaveCount(0)
  await expect(form.getByLabel('Status')).toHaveCount(0)
  await expect(form.getByRole('combobox', { name: 'Where to' })).toBeVisible()
  await form.getByLabel('Day').fill('2026-12-03')
  await form.getByLabel('Notes for whoever goes').fill('Ask for Sean at the desk')
  await form.getByRole('button', { name: 'Add errand' }).click()

  await expect(office.getByRole('heading', { level: 1, name: `Van run ${id}` })).toBeVisible()
  await expect(office.locator('.page-head')).toContainText('Errand')
  await expect(office.locator('.conn')).toHaveText('Up to date')
  // Only the parts an errand uses, named for it, and the dock says who's going (user flows of 13 November 2026, finding 5).
  const tabs = office.getByRole('tablist', { name: 'Parts of the job' })
  await expect(tabs.getByRole('tab', { name: /When/ })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: /Who's going/ })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: /Quote|Show pack/ })).toHaveCount(0)
  await expect(office.getByRole('region', { name: 'Next' }).first()).toContainText('Nobody is down for this errand yet.')
})

test('a client typed a letter off offers the one already here, in one press', async ({ browser }) => {
  // Proves (audit, 5 November 2026, finding 21): "Shannonside Festival" against "Shannonside Festivals" asks "Did you mean",
  // and taking it fills the field, so a typo doesn't quietly make a second client.
  const id = tag()
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await ready(office)
  const first = await newJobForm(office)
  await first.getByLabel('Name', { exact: true }).fill(`First ${id}`)
  await first.getByLabel('Client').fill(`Shannonside Festivals ${id}`)
  await first.getByRole('button', { name: 'Add gig' }).click()
  await expect(office.getByRole('heading', { name: `First ${id}` })).toBeVisible()
  await expect(office.locator('.conn')).toHaveText('Up to date')

  await ready(office)
  const next = await newJobForm(office)
  await next.getByLabel('Client').fill(`Shannonside Festival ${id}`)
  // As it's typed, the one already here is offered first; adding a new one is last, in words.
  const offers = next.getByRole('listbox', { name: 'Found' })
  await expect(offers.getByRole('option').first()).toContainText(`Shannonside Festivals ${id}`)
  await expect(offers.getByRole('option').last()).toHaveText(`Add “Shannonside Festival ${id}” as a new client`)
  await next.getByLabel('Client').press('Escape')
  await expect(next.locator('.new-or-near')).toHaveText(`Did you mean Shannonside Festivals ${id}? If not, “Shannonside Festival ${id}” is added as a new client.`)
  await next.locator('.new-or-near').getByRole('button', { name: `Shannonside Festivals ${id}` }).click()
  await expect(next.getByLabel('Client')).toHaveValue(`Shannonside Festivals ${id}`)
  await expect(next.locator('.new-or-near')).toHaveCount(0)
})
