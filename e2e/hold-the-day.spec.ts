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

test('confirming a job its crew hold the day for asks first, and says after what went, wherever it is pressed', async ({ browser, request }) => {
  // Proves: the office's side of "Hold the day" (ADR 0168; audit of 12 November 2026, the gap ADR 0154 left at 3). On a job the
  // client hasn't said yes to, the call card says "Hold the day" of those picked, where a booking says "Booked". Confirming the job
  // reaches everyone asked to hold the day, so from its details, its Confirmed task, Next and the quote's What happened it asks
  // first, saying what they'll see and how it reaches them, and the panel after says what went. "Keep it as it is" changes nothing.
  // With no calendar connected and WhatsApp off, as here, their links are what tell them; the words for Google's emails and
  // WhatsApp are proved beside the rules (shared/test/reach.test.ts).
  const run = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6).padEnd(6, 'x')
  const surname = `${run[0]!.toUpperCase()}${run.slice(1)}`
  const orla = `Orla ${surname}`
  const sean = `Seán ${surname}`
  const today = new Date().toISOString().slice(0, 10)
  const jobs = { details: `Held job ${run}`, next: `Said yes ${run}`, quote: `On the quote ${run}`, lost: `Went elsewhere ${run}` }
  // A day each, as nobody is offered two places on one day.
  const days = { details: 30, next: 31, quote: 32, lost: 33 }
  const k = (s: string) => `${s}-${run}`
  const job = (key: keyof typeof jobs, people: [string, 'asked' | 'picked'][], answer?: 'accepted' | 'declined'): [string, Record<string, unknown>][] => {
    const day = new Date(Date.now() + days[key] * 86_400_000).toISOString().slice(0, 10)
    return [
    ['project.create', { id: k(key), name: jobs[key], clientId: null, venueId: null, status: 'quoted', notes: '' }],
    ['phase.add', { id: k(`${key}-show`), projectId: k(key), name: 'Show', start: day, end: day, venueId: null, notes: '' }],
    [
      'call.create',
      { id: k(`${key}-call`), projectId: k(key), phaseId: k(`${key}-show`), project: jobs[key], phase: 'Show', venue: '', role: 'Stage manager', start: day, end: day, callTime: '09:00', needed: 2, dayRateCents: null, details: '', replyBy: null },
    ],
    ...people.flatMap(([who, how]): [string, Record<string, unknown>][] => [
      ['offer.send', { id: k(`${key}-${who}`), callId: k(`${key}-call`), personId: k(who), override: false }],
      ...(how === 'picked'
        ? ([
            ['offer.respond', { id: k(`${key}-${who}`), answer: 'accept', days: null, note: '' }],
            ['offer.confirm', { id: k(`${key}-${who}`) }],
          ] as [string, Record<string, unknown>][])
        : []),
    ]),
    // A quote that went, and with `answer` what the client said, the job left quoted: out of step until the office puts it in step.
    ...(key === 'details'
      ? []
      : ([
          ['quote.save', { id: k(`${key}-q`), projectId: k(key), lines: [{ id: k(`${key}-l`), kind: 'other', what: 'PA system', ref: null, group: 'Other', qty: 1, days: 1, unitCents: 50000, vat: '23' }], discountPct: 0, notes: '' }],
          ['quote.sent', { id: k(`${key}-q`), on: today }],
          ...(answer ? [['quote.answer', { id: k(`${key}-q`), answer, on: today }]] : []),
        ] as [string, Record<string, unknown>][])),
    ]
  }
  await push(request, `confirm-${run}`, [
    ['person.upsert', { id: k('orla'), name: orla, kind: 'freelancer', email: `orla.${run}@example.com`, phone: '+353 87 555 0142', skills: ['stage'], dayRateCents: null, notes: '' }],
    ['person.upsert', { id: k('sean'), name: sean, kind: 'freelancer', email: `sean.${run}@example.com`, phone: '+353 87 555 0143', skills: ['stage'], dayRateCents: null, notes: '' }],
    ...job('details', [
      ['orla', 'picked'],
      ['sean', 'asked'],
    ]),
    ...job('next', [['orla', 'picked']], 'accepted'),
    ...job('quote', [['sean', 'asked']]),
    ...job('lost', [['orla', 'asked']], 'declined'),
  ])

  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto(`/#jobs/${k('details')}/crew`)
  await expect(office.getByRole('status')).toHaveText('Up to date')
  // The call card: Orla is picked, so she holds the day, and the call isn't settled while the client hasn't said yes.
  const card = office.getByRole('article', { name: '2 × Stage manager' })
  await expect(card).toContainText(`${orla} (hold the day)`)
  await card.getByRole('button', { name: '2 × Stage manager' }).click()
  const hers = card.getByRole('listitem').filter({ hasText: orla })
  await expect(hers.locator('.pill')).toHaveText('Hold the day')
  await expect(card).not.toContainText('Booked')

  // From its details: asked first, and Keep it as it is leaves it quoted.
  const asked = `Confirm ${jobs.details}? The 2 people asked to hold the day will see it's going ahead on their links. Nothing is sent to them.`
  const details = office.getByRole('region', { name: 'Details', exact: true })
  await details.getByRole('button', { name: 'Change details' }).click()
  await details.getByLabel('Status').selectOption('confirmed')
  await details.getByRole('button', { name: 'Save job' }).click()
  await details.getByRole('group', { name: asked }).getByRole('button', { name: 'Keep it as it is' }).click()
  await expect(details.getByRole('group', { name: asked })).toHaveCount(0)
  await expect(office.locator('.job-position').first()).toContainText('Quoting')

  // From its Confirmed task: the same question, and after Confirm the job, the panel says what went to whom.
  const where = office.getByRole('region', { name: 'Status', exact: true })
  // With no quote here, the task is a tap away under the stepper (ADR 0140, part 3).
  await where.getByRole('button', { name: /tasks? to do in Quoting$/ }).click()
  await where.getByRole('button', { name: /^Confirmed/ }).click()
  await where.getByRole('button', { name: 'Confirm the job' }).click()
  await where.getByRole('group', { name: asked }).getByRole('button', { name: 'Confirm the job' }).click()
  const sent = office.getByRole('region', { name: `${jobs.details} is confirmed: what was sent` })
  await expect(sent.locator('.sent-lines')).toHaveText(`Nothing was sent to Orla and Seán: their links say it's going ahead.`)
  await expect(office.locator('.job-position').first()).toContainText('Planning')
  // Booked now, in a booking's words.
  await expect(card.getByRole('listitem').filter({ hasText: orla }).locator('.pill')).toHaveText('Booked')
  await expect(office.locator('body')).not.toContainText(/on hold/i)

  // Next, where the client's yes is on the quote: its press lands on the Confirmed task with the question already asked,
  // its safe answer to hand.
  await office.goto(`/#jobs/${k('next')}/crew`)
  await office.getByRole('region', { name: 'Next' }).getByRole('button', { name: 'Confirm the job' }).click()
  const fromNext = where.getByRole('group', { name: `Confirm ${jobs.next}? The person asked to hold the day will see it's going ahead on their link. Nothing is sent to them.` })
  await expect(fromNext.getByRole('button', { name: 'Keep it as it is' })).toBeFocused()
  await fromNext.getByRole('button', { name: 'Confirm the job' }).click()
  await expect(office.getByRole('region', { name: `${jobs.next} is confirmed: what was sent` }).locator('.sent-lines')).toHaveText(
    "Nothing was sent to Orla: their link says it's going ahead."
  )

  // The quote's What happened: the client's yes asks first too, and the panel opens on the job's page.
  await office.goto(`/#jobs/${k('quote')}/quote`)
  const records = office.getByRole('region', { name: 'What happened' })
  await records.getByRole('button', { name: 'Client accepted: confirm the job' }).click()
  await records
    .getByRole('group', { name: `Confirm ${jobs.quote}? The person asked to hold the day will see it's going ahead on their link. Nothing is sent to them.` })
    .getByRole('button', { name: 'Confirm the job' })
    .click()
  await expect(office.getByRole('region', { name: `${jobs.quote} is confirmed: what was sent` }).locator('.sent-lines')).toHaveText(
    "Nothing was sent to Seán: their link says it's going ahead."
  )
  await expect(records.getByRole('button', { name: 'Mark invoiced' })).toBeVisible()

  // Quotes to follow up: a no the job isn't in step with yet, and Mark the job lost asks first, as the job's own No does (ADR 0149).
  await office.goto('/#jobs/money/follow-up')
  const follow = office.getByRole('region', { name: 'To follow up' })
  const more = follow.getByRole('button', { name: /^Show all \d+ quotes$/ })
  if (await more.count()) await more.first().click()
  await follow.getByRole('listitem').filter({ hasText: jobs.lost }).getByRole('button', { name: 'Mark the job lost' }).click()
  await follow
    .getByRole('group', { name: `Marking ${jobs.lost} lost also cancels its crew calls: 1 person offered or booked will see the job didn't go ahead.` })
    .getByRole('button', { name: 'Mark it lost' })
    .click()
  await expect(office.getByRole('region', { name: 'Crew calls cancelled: what was sent' }).locator('.sent-lines')).toContainText('Nothing was sent to Orla')
  await expect(follow).not.toContainText(jobs.lost)
})
