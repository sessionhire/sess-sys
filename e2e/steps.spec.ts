import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * A job's stages and tasks (ADR 0073, ADR 0104), as the office and a member
 * of staff meet them: the job page shows the five stages with the one the
 * job is in, the tasks inside it, and the one Next button; the office gives
 * a task to someone with a day it's due by, and it's on their list on Home;
 * they tick their own. The test server is shared, so
 * names carry this run's own tag. SHOTS=1 refreshes the blueprint's pictures.
 */

const shot = (name: string) => (process.env.SHOTS ? { path: `docs/hub/img/${name}.png` } : undefined)
const phoneSize = { width: 390, height: 844 }
const deskSize = { width: 1280, height: 900 }

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `steps-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `steps-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

test("a job's tasks, given out on its page and ticked from the list on Home", async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const job = `Harbour Lights ${id}`
  const roisin = `Róisín Steps${id}`
  await push(request, id, [
    ['person.upsert', { id: `r-${id}`, name: roisin, kind: 'staff', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }],
    ['project.create', { id: `j-${id}`, name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `p-${id}`, projectId: `j-${id}`, name: 'Show', start: '2030-06-14', end: '2030-06-15', venueId: null, notes: '' }],
    [
      'call.create',
      { id: `c-${id}`, projectId: `j-${id}`, phaseId: `p-${id}`, project: job, phase: 'Show', venue: '', role: 'Audio tech', start: '2030-06-14', end: '2030-06-15', callTime: '08:00', needed: 2, dayRateCents: null, details: '', replyBy: null },
    ],
  ])

  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // With sign-in off, the device takes the person's word for who they are, as Leave does.
  await page.goto('/#crew/leave')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByLabel('Your name').selectOption({ label: roisin })
  await page.getByRole('button', { name: "That's me" }).click()

  await page.goto(`/#jobs/j-${id}`)
  const where = page.getByRole('region', { name: 'Where it is' })
  const next = page.getByRole('region', { name: 'Next' })
  // Confirmed, so the quote and the yes are done and the job is in Planning; the crew is next, which the app ticks once every call is booked.
  await expect(where.getByText('In Planning · 2 of 8 tasks done')).toBeVisible()
  await expect(where.locator('li[aria-current="step"] button')).toHaveAccessibleName('2. Planning, the stage the job is in, 0 of 2 done')
  // The one Next button (ADR 0104): a verb and its object, with the count on the line over it; the quiet second choice opens the task.
  await expect(next).toContainText('Next · Planning · 0 of 2 booked')
  await expect(next.getByRole('button', { name: 'Book 2 more crew' })).toBeVisible()
  await next.getByRole('button', { name: 'Hand it to someone' }).click()
  await expect(where.getByRole('heading', { name: 'Crew booked' })).toBeVisible()
  await expect(where.getByText('0 of 2 booked. This is the task to do next.')).toBeVisible()
  // The app ticks this one itself once every call is booked; until then it can be ticked by hand, given to someone, and given a day it's due by.
  await expect(where.getByRole('button', { name: 'Mark it done' })).toBeVisible()
  await where.getByLabel('Down to').selectOption({ label: `${roisin} (you)` })
  await where.getByLabel('Due by').fill('2030-06-01')
  await expect(next).toContainText('Next · Planning · 0 of 2 booked · Róisín · by Sat 1 Jun')
  await expect(next.getByRole('button', { name: 'Hand it on' })).toBeVisible()

  // The last stage's last task, given to herself and ticked by hand.
  await where.getByRole('button', { name: /^5\. Back, to come/ }).click()
  await where.getByRole('button', { name: /^Checked and deprepped/ }).click()
  await expect(where.getByRole('heading', { name: 'Checked and deprepped' })).toBeVisible()
  await where.getByRole('button', { name: 'Give it to me' }).click()
  await where.getByRole('button', { name: 'Mark it done' }).click()
  await expect(where.getByText(new RegExp(`^Ticked done by ${roisin}, `))).toBeVisible()
  await expect(where.getByRole('button', { name: /^Checked and deprepped.*Ticked by Róisín/ })).toBeVisible()
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await page.screenshot(shot('job-steps-phone'))

  // The jobs list says where the job is, under its dates (part 2 of ADR 0104).
  await page.goto('/#jobs')
  await page.getByLabel('Find').fill(job)
  await expect(page.locator('.job-row', { hasText: job }).locator('.stage-line')).toHaveText('Planning · 0 of 2 booked · No kit on the job yet')
  // On Home, the task she's to do now is on top, whichever view, with the day it's due; the ticked one isn't.
  await page.goto('/#home')
  const mine = page.getByRole('region', { name: /^Your tasks/ })
  await expect(mine.getByRole('link', { name: new RegExp(`^Crew booked ${job}`) })).toBeVisible()
  await expect(mine).toContainText('By Sat 1 Jun')
  await expect(mine.getByText('Checked and deprepped')).toHaveCount(0)
  await mine.getByRole('link', { name: new RegExp(`^Crew booked ${job}`) }).click()
  await expect(page.getByRole('heading', { name: job })).toBeVisible()

  if (process.env.SHOTS) {
    const desk = await (await browser.newContext({ viewport: deskSize })).newPage()
    await desk.goto(`/#jobs/j-${id}`)
    await expect(desk.getByRole('status')).toHaveText('Up to date')
    await desk.getByRole('region', { name: 'Where it is' }).screenshot(shot('job-steps'))
  }
})
