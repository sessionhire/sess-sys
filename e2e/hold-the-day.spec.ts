import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * HOLD is short for "hold the day" (ADR 0150): on a job the client hasn't said yes to yet, crew are asked to keep the
 * day free, and nothing is booked until the client does. Wherever its person or the office reads where they stand, it
 * says that in those words, and never "Booked" or that the job is "on hold": the office's messages, Home › Me, "You on
 * this job", the call sheet and their own link. Once the client says yes, each reads as any booking does.
 */

const phoneSize = { width: 390, height: 844 }

async function push(request: APIRequestContext, clientId: string, mutations: [string, Record<string, unknown>][]) {
  const createdAt = new Date().toISOString()
  const res = await request.post('/api/sync/push', { data: { clientId, mutations: mutations.map(([name, args], i) => ({ id: `${clientId}-${Date.now()}-${i}`, name, args, createdAt })) } })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

test("a place on a job the client hasn't said yes to is a day to hold, wherever it's read, until they do", async ({ browser, request }) => {
  // Proves: finding 6 of the audit of 12 November 2026. A member of staff is offered one call and picked for another on a quoted
  // job. The office's offer and its word after the pick ask them to hold the day; their row on Home › Me and their link say
  // "Hold the day" where a booking says "Booked", and "Your weeks" draws it as waiting; "You on this job", the call sheet and their
  // link's cards say what that means.
  // Confirming the job puts every one of them back to a booking's words.
  const run = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6).padEnd(6, 'x')
  const surname = `${run[0]!.toUpperCase()}${run.slice(1)}`
  const name = `Orla ${surname}`
  const job = `Hold check ${run}`
  // Two show days, a call on each: nobody holds two places on one day. Inside the eight weeks "Your weeks" draws.
  const day = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const next = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10)
  const ids = { person: `orla-${run}`, job: `job-${run}`, show: `show-${run}`, stage: `stage-${run}`, runner: `runner-${run}`, picked: `picked-${run}`, asked: `asked-${run}` }
  const call = (id: string, role: string, on: string, callTime: string) => ({ id, projectId: ids.job, phaseId: ids.show, project: job, phase: 'Show', venue: '', role, start: on, end: on, callTime, needed: 1, dayRateCents: null, details: '', replyBy: null })
  await push(request, `hold-${run}`, [
    // Messages to crew on, so Send and Confirm open the message the office would send (ADR 0048). Put back off at the end.
    ['messages.prompt', { on: true }],
    ['person.upsert', { id: ids.person, name, kind: 'staff', email: `orla.${run}@example.com`, phone: '+353 87 555 0142', skills: ['stage'], dayRateCents: null, notes: '' }],
    ['project.create', { id: ids.job, name: job, clientId: null, venueId: null, status: 'quoted', notes: '' }],
    ['phase.add', { id: ids.show, projectId: ids.job, name: 'Show', start: day, end: next, venueId: null, notes: '' }],
    ['call.create', call(ids.stage, 'Stage manager', day, '09:00')],
    ['offer.send', { id: ids.picked, callId: ids.stage, personId: ids.person, override: false }],
    ['offer.respond', { id: ids.picked, answer: 'accept', days: null, note: '' }],
    ['call.create', call(ids.runner, 'Runner', next, '07:00')],
    ['offer.send', { id: ids.asked, callId: ids.runner, personId: ids.person, override: false }],
  ])
  const hold = {
    toYou: "Hold the day: the client hasn't said yes yet, so please keep it free. Nothing is booked until they do.",
    // Under the pill that already reads "Hold the day".
    means: "The client hasn't said yes yet, so please keep the day free. Nothing is booked until they do.",
    asked: "Hold the day: the client hasn't said yes yet. A yes from you means you'll keep the day free; nothing is booked until the client says yes.",
    toOffice: "Hold the day: the client hasn't said yes yet. Crew are asked to keep it free, and nothing is booked until they do.",
  }

  try {
    // The office: the offer it sends asks them to hold the day, and so does the email's subject.
    const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
    await office.goto(`/#jobs/${ids.job}/crew`)
    await expect(office.getByRole('status')).toHaveText('Up to date')
    const runner = office.getByRole('article', { name: '1 × Runner' })
    await runner.getByRole('button', { name: '1 × Runner' }).click()
    await runner.getByRole('button', { name: 'Send' }).click()
    const share = office.getByRole('region', { name: `Send offer to ${name}` })
    const offer = await share.locator('textarea').inputValue()
    expect(offer.split('\n')[0]).toBe(`Hi Orla, can you hold the day for ${job} (Show)? The client hasn't said yes yet, so nothing is booked until they do.`)
    expect(offer).not.toMatch(/on hold|are you free/i)
    expect(await share.getByRole('link', { name: 'Email' }).getAttribute('href')).toContain(`?subject=${encodeURIComponent(`Hold the day: ${job}, `)}`)

    // It picks them for the other call, from Answers to check: the message says they're down for it and to hold the day, never "confirmed".
    await office.goto('/#crew/calls')
    const answers = office.locator('section').filter({ has: office.getByRole('heading', { name: 'Answers to check' }) })
    await answers.locator('.row', { hasText: name }).getByRole('button', { name: 'Confirm' }).click()
    const tell = office.getByRole('region', { name: `Send confirmation to ${name}` })
    const picked = await tell.locator('textarea').inputValue()
    expect(picked.split('\n')[0]).toBe(`Hi Orla, we have you down for ${job} (Show), so please hold the day. The client hasn't said yes yet: it's booked once they do.`)
    expect(picked).not.toMatch(/on hold|confirmed/i)
    expect(await tell.getByRole('link', { name: 'Email' }).getAttribute('href')).toContain(`?subject=${encodeURIComponent(`Hold the day: ${job} (Show), `)}`)
    await expect(office.getByRole('status')).toHaveText('Up to date')

    // The call sheet the office opens and prints says first that it's to hold the day.
    await office.goto(`/#jobs/${ids.job}/sheet/${ids.show}`)
    await expect(office.locator('.warn-line').filter({ hasText: 'Hold the day' })).toHaveText(hold.toOffice)

    // Orla, on Home › Me: the place she was picked for is a day to hold, counted as that, and never "Booked".
    const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Up to date')
    await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Me', exact: true }).click()
    await page.getByLabel('Your name').selectOption({ label: name })
    await page.getByRole('button', { name: "That's me" }).click()
    const card = page.locator('section', { has: page.getByRole('heading', { name: /^Your bookings/ }) })
    await expect(card.getByRole('heading', { level: 2 })).toHaveText('Your bookings (1 to hold)')
    const held = card.getByRole('link', { name: new RegExp(`^${job}.*Stage manager`) })
    await expect(held.locator('.pill')).toHaveText('Hold the day')
    await expect(held).not.toContainText('Booked')
    // The whole pill is on the phone's screen, beside the job's name.
    const pill = (await held.locator('.pill').boundingBox())!
    expect(pill.x + pill.width).toBeLessThanOrEqual(phoneSize.width)
    // "Your weeks" draws the day as waiting to confirm, never as a confirmed one. The offer she hasn't answered isn't a day yet.
    const weeks = page.locator('section.chart', { has: page.getByRole('heading', { name: 'Your weeks' }) })
    await expect(weeks.locator('.chart-col[aria-label$=": 1 day waiting to confirm"]')).toHaveCount(1)
    await expect(weeks.locator('.chart-col[aria-label*="day confirmed"], .chart-col[aria-label*="days confirmed"]')).toHaveCount(0)

    // On the job, "You on this job" says what holding the day means: before she answers, what a yes agrees to.
    await held.click()
    const you = page.getByRole('region', { name: 'You on this job' })
    await expect(you.getByRole('listitem').filter({ hasText: 'Stage manager' }).locator('.warn-line')).toHaveText(hold.toYou)
    await expect(you.getByRole('listitem').filter({ hasText: 'Runner' }).locator('.warn-line')).toHaveText(hold.asked)

    // Her own link, a plain page with no sign-in: the same pill and the same words on each card.
    const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; id: string; data: { linkToken: string } }[] }
    const link = `/f/${changes.filter((c) => c.entity === 'person' && c.id === ids.person).at(-1)!.data.linkToken}`
    const phone = await (await browser.newContext({ viewport: phoneSize, javaScriptEnabled: false })).newPage()
    await phone.goto(link)
    const hers = phone.locator(`#o-${ids.picked}`)
    await expect(hers.locator('.tag')).toHaveText('Hold the day')
    await expect(hers.locator('.hold-line')).toHaveText(hold.means)
    await expect(phone.locator(`#o-${ids.asked}`).locator('.hold-line')).toHaveText(hold.asked)
    await expect(phone.locator(`#o-${ids.asked}`).locator('.tag')).toHaveText('Waiting on you')
    await expect(phone.locator('body')).not.toContainText(/on hold/i)
    // Nothing on the page is wider than the phone.
    expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phoneSize.width)
    await phone.goto(`${link}/sheet/${ids.stage}`)
    await expect(phone.locator('.hold-line')).toHaveText(hold.toYou)

    // The client says yes: a booking, in a booking's words, everywhere.
    await push(request, `hold-yes-${run}`, [['project.update', { id: ids.job, status: 'confirmed' }]])
    await page.goto('/')
    const booked = page.locator('section', { has: page.getByRole('heading', { name: /^Your bookings/ }) }).getByRole('link', { name: new RegExp(`^${job}.*Stage manager`) })
    await expect(booked.locator('.pill')).toHaveText('Booked')
    await expect(page.locator('section', { has: page.getByRole('heading', { name: /^Your bookings/ }) }).getByRole('heading', { level: 2 })).toHaveText('Your bookings (1 booked)')
    await expect(page.locator('section.chart', { has: page.getByRole('heading', { name: 'Your weeks' }) }).locator('.chart-col[aria-label$=": 1 day confirmed"]')).toHaveCount(1)
    await booked.click()
    await expect(page.getByRole('region', { name: 'You on this job' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'You on this job' }).locator('.warn-line')).toHaveCount(0)
    await phone.goto(link)
    await expect(phone.locator(`#o-${ids.picked}`).locator('.tag')).toHaveText('Booked')
    await expect(phone.locator('.hold-line')).toHaveCount(0)
  } finally {
    // As the other tests expect to find it (ADR 0048).
    await push(request, `hold-quiet-${run}`, [['messages.prompt', { on: false }]])
  }
})
