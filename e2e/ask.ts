import { expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Crew are asked for from a job only (ADR 0142): a test that wants a call makes a confirmed job with one phase through the
 * server, as the office would have it in Jobs, and returns the job's id.
 */
export async function jobWithPhase(request: APIRequestContext, job: { name: string; phase?: string; start: string; end?: string }): Promise<string> {
  const run = Math.random().toString(36).slice(2, 10)
  const id = `ask-${run}`
  const createdAt = new Date().toISOString()
  const pushed = await request.post('/api/sync/push', {
    data: {
      clientId: `e2e-ask-${run}`,
      mutations: [
        ['project.create', { id, name: job.name, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
        ['phase.add', { id: `${id}-ph`, projectId: id, name: job.phase ?? 'Show', start: job.start, end: job.end ?? job.start, venueId: null, notes: '' }],
      ].map(([name, args], i) => ({ id: `${id}-m${i}`, name, args, createdAt })),
    },
  })
  expect(((await pushed.json()) as { results: { status: string }[] }).results.map((r) => r.status)).toEqual(['applied', 'applied'])
  return id
}

/** Opens the job's Crew tab and its "Add a role" form, as the office adds a role, and returns the form. */
export async function askForCrewOn(page: Page, jobId: string) {
  await page.goto(`/#jobs/${jobId}/crew`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('button', { name: 'Add a role' }).click()
  return page.getByRole('form', { name: 'Add a role' })
}

/** Crew › Calls, with every call still needing something drawn, not only the next fortnight's. */
export async function allCalls(page: Page) {
  await page.goto('/#crew/calls')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const showAll = page.getByRole('button', { name: /^Show all \d+ calls? still needing something$/ })
  if (await showAll.count()) await showAll.click()
}

/** Added: the form closes, the page goes to the new call's card and a pop-up says what was added; the top bar's status says it's saved. */
export async function asked(page: Page) {
  await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('Added')
  await expect(page.getByRole('form', { name: 'Add a role' })).toBeHidden()
  await expect(page.locator('.conn[role="status"]')).toHaveText('Up to date')
}
