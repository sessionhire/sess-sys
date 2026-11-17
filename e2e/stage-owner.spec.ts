import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Who has the stage a job is in, given on the Board (ADR 0144): from a card's foot, without opening the job, a member of
 * staff takes the stage themselves or hands it to someone else, and every open task of that stage is theirs, as the job page
 * says. The test server is shared, so names carry this run's own tag.
 */

const deskSize = { width: 1280, height: 900 }

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: {
      clientId: `stage-owner-${id}`,
      mutations: mutations.map(([name, args], i) => ({
        id: `stage-owner-${id}-${i}`,
        name,
        args,
        createdAt: new Date().toISOString(),
      })),
    },
  })
  const { results } = (await res.json()) as {
    results: { status: string; reason?: { message: string } }[]
  }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

test('a stage is taken, handed on and changed from its Board card, and its tasks follow', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const job = `Liffey Lights ${id}`
  const aoife = `Aoife Stage${id}`
  const ciaran = `Ciarán Stage${id}`
  await push(request, id, [
    [
      'person.upsert',
      {
        id: `a-${id}`,
        name: aoife,
        kind: 'staff',
        email: null,
        phone: null,
        skills: [],
        dayRateCents: null,
        notes: '',
      },
    ],
    [
      'person.upsert',
      {
        id: `c-${id}`,
        name: ciaran,
        kind: 'staff',
        email: null,
        phone: null,
        skills: [],
        dayRateCents: null,
        notes: '',
      },
    ],
    [
      'project.create',
      {
        id: `j-${id}`,
        name: job,
        clientId: null,
        venueId: null,
        status: 'confirmed',
        notes: '',
      },
    ],
    [
      'phase.add',
      {
        id: `p-${id}`,
        projectId: `j-${id}`,
        name: 'Show',
        start: '2030-07-14',
        end: '2030-07-15',
        venueId: null,
        notes: '',
      },
    ],
    [
      'call.create',
      {
        id: `k-${id}`,
        projectId: `j-${id}`,
        phaseId: `p-${id}`,
        project: job,
        phase: 'Show',
        venue: '',
        role: 'Audio tech',
        start: '2030-07-14',
        end: '2030-07-15',
        callTime: '08:00',
        needed: 1,
        dayRateCents: null,
        details: '',
        replyBy: null,
      },
    ],
  ])

  const page = await (await browser.newContext({ viewport: deskSize })).newPage()
  // With sign-in off, the device takes the person's word for who they are, as Leave does.
  await page.goto('/#crew/leave')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByLabel('Your name').selectOption({ label: aoife })
  await page.getByRole('button', { name: "That's me" }).click()

  await page.goto('/#jobs/board')
  await page.getByRole('button', { name: /^Filter/ }).click()
  await page.getByRole('button', { name: 'All coming up' }).click()
  const planning = page.getByRole('region', { name: 'Planning' })
  // Months off, so it's under Planning's Later.
  await planning.locator('details.board-later > summary').click()
  const card = planning.locator('.board-owned', { hasText: job })
  const who = card.getByRole('combobox', {
    name: `Who has Planning on ${job}`,
  })
  // Nobody has it yet, and you are first to pick.
  await expect(who.locator('option:checked')).toHaveText('Nobody yet')
  await expect(who.locator('option').nth(1)).toHaveText(`Me (Aoife)`)
  // Taken: both of Planning's tasks are yours, and the job is still on the Board, not opened.
  await who.selectOption({ label: 'Me (Aoife)' })
  await expect(page).toHaveURL(/#jobs\/board$/)
  await expect(who.locator('option:checked')).toHaveText('Me (Aoife)')
  // Handed on, and the job page says so of each task.
  await who.selectOption({ label: ciaran })
  await expect(who.locator('option:checked')).toHaveText(ciaran)
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await card.locator('.board-card').click()
  const where = page.getByRole('region', { name: 'Status', exact: true })
  await where.getByRole('button', { name: '2 tasks to do in Planning' }).click()
  for (const task of ['Crew booked', 'Kit and vans settled']) {
    await where.locator('.task-list button', { hasText: task }).click()
    await expect(where.getByLabel('Down to').locator('option:checked')).toHaveText(ciaran)
  }
})
