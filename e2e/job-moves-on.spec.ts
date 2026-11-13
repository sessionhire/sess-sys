import { expect, test } from '@playwright/test'

/**
 * How a job moves on (ADR 0103, ADR 0104): the Next dock in the job's page
 * head offers the one next thing for the task the job is at, and the
 * Confirmed task is the client's answer itself, so yes confirms the job and records the yes on
 * the quote that went, and the two never say different things. A past quote
 * from Current RMS for a job already here goes on that job's quote rather
 * than making the same job twice. Uses the made-up data (ADR 0019), so it
 * starts fresh before and after.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test("the client's yes, from the job's steps, confirms the job and the quote together", async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()

  // Corrib Arts Week's quote is with the client, so the job is quoted, in Quoting, and the client's answer is next (ADR 0104).
  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Corrib Arts Week' }).click()
  const next = office.getByRole('region', { name: 'Next' })
  const where = office.getByRole('region', { name: 'Status', exact: true })
  // Being sold, it opens on its quote (ADR 0140, part 8), whose What happened holds the answer, so Next says so in words.
  await expect(office.getByRole('tab', { name: /^Quote/ })).toHaveAttribute('aria-selected', 'true')
  await expect(next).toContainText("Record the client's answer below, under What happened.")
  // Away from the quote, Next holds the press.
  await office.getByRole('tab', { name: /^Phases/ }).click()
  // The stage under the job's name, what to do in Next's own words (ADR 0161).
  await expect(office.locator('.job-position').first()).toContainText('Quoting')
  if (process.env.SHOTS_DIR) await office.screenshot({ path: `${process.env.SHOTS_DIR}/next-thing.png` })
  await next.getByRole('button', { name: "Record the client's answer" }).click()
  await expect(where.getByRole('heading', { name: 'Confirmed', exact: true })).toBeVisible()
  // No tick that would say it's going ahead while it stays quoted: the answer is the job's own.
  await expect(where.getByRole('button', { name: 'Mark it done' })).toHaveCount(0)
  await expect(where).toContainText('records the yes on version 1 of the quote')
  if (process.env.SHOTS_DIR) await office.screenshot({ path: `${process.env.SHOTS_DIR}/confirm-step.png` })
  await where.getByRole('button', { name: 'Confirm job' }).click()

  // Confirmed, the job moves into Planning by its own status: the one gate between stages.
  await expect(where.locator('li[aria-current="step"] button')).toHaveAccessibleName(/^2\. Planning, the stage the job is in/)
  // Said once, under the job's name (ADR 0161): Next has no line of its own.
  await expect(office.locator('.job-position').first()).toContainText('Planning')
  await expect(next.locator('.line')).toHaveCount(0)
  await office.goto('/#jobs')
  await expect(office.locator('.job-row', { hasText: 'Corrib Arts Week' }).locator('.job-position')).toContainText('Planning')

  // The quote says the same: nothing left to put in step.
  await office.goto('/#jobs/money/follow-up')
  await expect(office.getByRole('region', { name: 'To follow up' })).not.toContainText('Corrib Arts Week')

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('a past quote for a job already here goes on its quote, not on a second job', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()

  const gala = {
    id: 9, number: '1099', subject: 'Corrib Arts Week', client: 'Corrib Arts Collective', state: 'Quotation', status: 'Provisional', startsAt: null, endsAt: null, netCents: 30000,
    venue: '', grossCents: 0, rentalCents: 0, saleCents: 0, serviceCents: 0, surchargeCents: 0, taxCents: 0, undiscountedCents: 0, chargeableDays: 1, discountCategory: '', priceCategory: '',
    tags: [], createdAt: null, updatedAt: null,
  }
  const line = {
    id: 1, opportunityId: 9, path: '0001', kind: 'Principal', transaction: 'Service', itemType: 'Service', itemId: null, name: 'Sound engineer', description: '', quantity: 1, priceCents: 30000,
    discountPct: 0, chargeableDays: 1, rateDefinition: '', period: '', unitCents: 30000, totalCents: 30000, taxCents: 0, subRent: false, startsAt: null, endsAt: null,
  }
  // Linked to the job already, as Match to jobs would have. Routed before the first page, so the app's own worker doesn't answer first.
  let jobId = ''
  await office.route('**/api/rms/opportunities/9', (route) => route.fulfill({ json: { opportunity: gala, lines: [line], job: { id: jobId, name: 'Corrib Arts Week' } } }))
  let linked = false
  await office.route('**/api/rms/matches', (route) => {
    linked = true
    return route.fulfill({ json: { linked: 1 } })
  })

  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Corrib Arts Week' }).click()
  jobId = decodeURIComponent(/#jobs\/([^/]+)/.exec(office.url())![1]!)

  await office.goto('/#jobs/money/current-rms/9')
  // The job it's for comes first; another job is the second choice.
  await expect(office.getByRole('button', { name: "Put it on Corrib Arts Week's quote" })).toHaveClass(/primary/)
  await office.getByRole('button', { name: 'New job from this' }).click()
  const making = office.getByRole('region', { name: 'Make a job from this' })
  await expect(making).toContainText('which is already a job here. Making another makes the same job twice.')
  if (process.env.SHOTS_DIR) await making.screenshot({ path: `${process.env.SHOTS_DIR}/same-job-twice.png` })
  await making.getByRole('button', { name: "Put it on Corrib Arts Week's quote instead" }).click()

  const onto = office.getByRole('region', { name: "Put it on a job's quote" })
  await expect(onto.getByLabel('The job')).toHaveValue('Corrib Arts Week')
  await expect(onto).toContainText('It has no draft, so these start one.')
  await onto.getByRole('button', { name: /^Add 1 line to quote$/ }).click()

  await expect(office).toHaveURL(new RegExp(`#jobs/${jobId}/quote$`))
  const draft = office.getByRole('form', { name: 'Version 2, a draft' })
  await expect(draft).toContainText('Sound engineer')
  // Already linked to this job, so nothing to link.
  expect(linked).toBe(false)

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})
