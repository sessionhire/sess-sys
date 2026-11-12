import { expect, test } from '@playwright/test'

/**
 * A person's page (#crew/person/<id>): the People list on Crew is one line
 * each, and the name opens a page of their own with how to reach them, what
 * they're booked on and offered, their days off, what they hold, what
 * they've worked and their link. A booking's job opens from it, the call
 * card's name and the planner's lane open it, and archiving from it goes
 * back to the list, which says so with the way back. Their own page says
 * Your bookings, and an offer on it opens their link. A booking on a job
 * that was cancelled or lost says so with its word, beside it at a desk and
 * under it on a phone, and the question before stopping the job says what
 * their link will say. The test server is shared with the other browser
 * tests, so every name here is this run's own.
 */

const phoneSize = { width: 390, height: 844 }
const id = Math.random().toString(36).slice(2, 8)
const k = (key: string) => `${key}-${id}`
type M = [string, Record<string, unknown>]

test("a person's name opens their page, with what's ahead for them and the way back", async ({ browser }) => {
  const name = `Ciara Page ${id}`
  const job = `Page check ${id}`
  const on = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
  const mutations: M[] = [
    ['project.create', { id: k('job'), name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: k('show'), projectId: k('job'), name: 'Show', start: on(70), end: on(70), venueId: null, notes: '' }],
    [
      'call.create',
      { id: k('call'), projectId: k('job'), phaseId: k('show'), project: job, phase: 'Show', venue: '', role: 'Audio tech', start: on(70), end: on(70), callTime: null, needed: 1, dayRateCents: 25000, details: '', replyBy: null },
    ],
    ['person.upsert', { id: k('ciara'), name, kind: 'freelancer', email: `ciara.${id}@example.com`, phone: '087 123 4567', skills: ['Audio'], dayRateCents: 25000, notes: 'Has her own van' }],
    ['offer.send', { id: k('offer'), callId: k('call'), personId: k('ciara'), override: false }],
    ['unavailability.add', { id: k('away'), personId: k('ciara'), start: on(80), end: on(81), note: 'On tour' }],
  ]
  const context = await browser.newContext({ viewport: phoneSize })
  const res = await context.request.post('/api/sync/push', {
    data: { clientId: `person-${id}`, mutations: mutations.map(([n, args], i) => ({ id: `${k('m')}-${i}`, name: n, args, createdAt: new Date().toISOString() })) },
  })
  expect(res.ok()).toBe(true)
  expect((await res.json()).results.filter((r: { status: string }) => r.status !== 'applied')).toEqual([])

  const office = await context.newPage()
  await office.goto('/#crew/people')
  await expect(office.getByRole('status')).toHaveText('Up to date')
  const people = office.getByRole('region', { name: 'People' })
  await people.getByLabel('Find a person').fill(`ciara page ${id}`)
  await people.getByRole('link', { name: new RegExp(`^${name}`) }).click()

  // Her page: who she is and how to reach her, in the heading and the buttons above its parts; Coming up first.
  await expect(office).toHaveURL(new RegExp(`#crew/person/${k('ciara')}$`))
  await expect(office.getByRole('heading', { level: 1 })).toHaveText(name)
  await expect(office.getByRole('link', { name: 'Call 087 123 4567' })).toHaveAttribute('href', 'tel:0871234567')
  await expect(office.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/353871234567')
  await expect(office.getByRole('link', { name: 'Email' })).toHaveAttribute('href', `mailto:ciara.${id}@example.com`)

  // What's ahead: the offer waiting on her, opening its job, and her days off.
  const ahead = office.getByRole('region', { name: 'Coming up' })
  await expect(ahead.getByRole('link', { name: new RegExp(`^${job}`) })).toContainText('Offered')
  // Hers to answer, not the office's: her offer opens its job here, with nothing asking the reader to answer it.
  await expect(ahead.getByText('Answer it on your page ›')).toHaveCount(0)
  await expect(ahead).toContainText('Off ')
  await expect(ahead).toContainText('(On tour)')
  // The other parts, one at a time, each in the address.
  await office.getByRole('tab', { name: /^Details/ }).click()
  await expect(office).toHaveURL(new RegExp(`#crew/person/${k('ciara')}/details$`))
  await expect(office.locator('.person-page .notes')).toHaveText('Has her own van')
  // Change details hands the focus to the form's first field, and back to the button when it's left (audit, 5 November 2026, finding 87).
  await office.getByRole('button', { name: 'Change details' }).click()
  await expect(office.getByLabel('First name')).toBeFocused()
  await office.getByRole('button', { name: 'Cancel' }).click()
  await expect(office.getByRole('button', { name: 'Change details' })).toBeFocused()
  await office.getByRole('tab', { name: /^Past/ }).click()
  await expect(office.getByRole('region', { name: `Past: ${name}` })).toContainText('No jobs worked yet.')
  await office.getByRole('tab', { name: /^Their link/ }).click()
  await expect(office.getByRole('region', { name: 'Their link' }).getByRole('link', { name: 'Open their page' })).toHaveAttribute('href', /\/f\/[\w-]{24}$/)
  await office.getByRole('tab', { name: /^Coming up/ }).click()
  // Nothing on it is wider than a phone.
  expect(await office.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phoneSize.width)

  await ahead.getByRole('link', { name: new RegExp(`^${job}`) }).click()
  // To the job's Crew, where the offer is (ADR 0059).
  await expect(office).toHaveURL(new RegExp(`#jobs/${k('job')}/crew$`))
  await office.goBack()
  await expect(office.getByRole('heading', { level: 1 })).toHaveText(name)

  // While an offer waits on her she can't be archived, and it says why, here.
  await office.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(ahead.getByText(`${name} has an open offer for ${job} (Show); withdraw it first.`)).toBeVisible()

  // The way back is the list, as it was left.
  await office.getByRole('link', { name: '‹ All people' }).click()
  await expect(office).toHaveURL(/#crew\/people$/)
  await expect(people.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible()
})

test('their own page says Your bookings, as Home › Me does, and an offer there opens its job to answer it', async ({ browser }) => {
  // Proves (UX sweep, 6 November 2026, move 6): on the reader's own page the list of what's booked and offered is "Your
  // bookings", the name Home › Me and their link give it, each row the job, then role · phase · days · call, then the pill;
  // an offer on a job reads "Answer it ›" and opens the job, whose "You on this job" answers it (ADR 0111). Sign-in is off
  // here, so who they are is who this device says, as on Home › Me.
  const name = `Niamh Own ${id}`
  const job = `Own page ${id}`
  const on = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
  const mutations: M[] = [
    ['project.create', { id: k('own-job'), name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: k('own-show'), projectId: k('own-job'), name: 'Show', start: on(70), end: on(70), venueId: null, notes: '' }],
    [
      'call.create',
      { id: k('own-call'), projectId: k('own-job'), phaseId: k('own-show'), project: job, phase: 'Show', venue: '', role: 'Audio tech', start: on(70), end: on(70), callTime: '08:00', needed: 1, dayRateCents: null, details: '', replyBy: null },
    ],
    ['person.upsert', { id: k('niamh'), name, kind: 'staff', email: `niamh.${id}@example.com`, phone: null, skills: ['Audio'], dayRateCents: null, notes: '' }],
    ['offer.send', { id: k('own-offer'), callId: k('own-call'), personId: k('niamh'), override: false }],
  ]
  const context = await browser.newContext({ viewport: phoneSize })
  const res = await context.request.post('/api/sync/push', {
    data: { clientId: `person-own-${id}`, mutations: mutations.map(([n, args], i) => ({ id: `${k('o')}-${i}`, name: n, args, createdAt: new Date().toISOString() })) },
  })
  expect((await res.json()).results.filter((r: { status: string }) => r.status !== 'applied')).toEqual([])

  const page = await context.newPage()
  await page.goto('/#home')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Me', exact: true }).click()
  await page.getByLabel('Your name').selectOption({ label: name })
  await page.getByRole('button', { name: "That's me" }).click()

  await page.goto(`/#crew/person/${k('niamh')}`)
  // The tab over the list says it too, and her link's tab is her page, as everything else in the app calls it: one name for
  // each thing on the screen, by the one test of whose page it is.
  const tabs = page.getByRole('tablist', { name: `About ${name}` })
  await expect(tabs.getByRole('tab', { name: 'Your bookings' })).toHaveAttribute('aria-selected', 'true')
  await expect(tabs.getByRole('tab', { name: 'Your page' })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: /^(Coming up|Their link)$/ })).toHaveCount(0)
  const yours = page.getByRole('region', { name: 'Your bookings' })
  await expect(yours.getByRole('heading', { level: 2 })).toHaveText('Your bookings')
  await expect(page.getByRole('region', { name: 'Coming up' })).toHaveCount(0)
  const offered = yours.getByRole('link', { name: new RegExp(`^${job}`) })
  await expect(offered).toContainText(/Audio tech\s·\sShow\s·\s\w{3}\s\d{1,2}\s\w{3}(\s\d{4})?\s·\scall\s08:00/)
  await expect(offered).toContainText('Offered')
  await expect(offered).toContainText('Answer it ›')
  await expect(offered).toHaveAttribute('href', /^#jobs\//)
  await expect(offered).not.toHaveAttribute('target', '_blank')
  await context.close()
})

test('a booking on a job that was cancelled or lost stays in its place, saying so with its word', async ({ browser }) => {
  // Proves (UX sweep, 6 November 2026, move 6): stopping a job takes its calls, and with them her bookings, and the office's
  // question before it says what her link will say, in its words; her page keeps each booking in its place while its day is
  // to come, "Job cancelled" or "Job lost" with "Withdrawn", as her link says it as the booking's first line; a booking on
  // a job still going ahead says nothing of the kind.
  const name = `Siún Stop ${id}`
  const on = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
  const job = (key: string, title: string, day: string, status = 'confirmed'): M[] => [
    ['project.create', { id: k(key), name: title, clientId: null, venueId: null, status, notes: '' }],
    [
      'call.create',
      { id: k(`${key}-call`), projectId: k(key), phaseId: null, project: title, phase: '', venue: '', role: 'Audio tech', start: day, end: day, callTime: null, needed: 1, dayRateCents: 25000, details: '', replyBy: null },
    ],
    ['offer.send', { id: k(`${key}-offer`), callId: k(`${key}-call`), personId: k('siun'), override: false }],
    ['offer.respond', { id: k(`${key}-offer`), answer: 'accept', days: null, note: '' }],
  ]
  const mutations: M[] = [
    ['person.upsert', { id: k('siun'), name, kind: 'freelancer', email: null, phone: '087 765 4321', skills: ['Audio'], dayRateCents: 25000, notes: '' }],
    ...job('called-off', `Called off ${id}`, on(40)),
    // Still with the client, so its Confirmed task asks for their answer.
    ...job('elsewhere', `Went elsewhere ${id}`, on(41), 'quoted'),
    ...job('still-on', `Still on ${id}`, on(42)),
  ]
  const context = await browser.newContext({ viewport: phoneSize })
  const res = await context.request.post('/api/sync/push', {
    data: { clientId: `person-stop-${id}`, mutations: mutations.map(([n, args], i) => ({ id: `${k('s')}-${i}`, name: n, args, createdAt: new Date().toISOString() })) },
  })
  expect((await res.json()).results.filter((r: { status: string }) => r.status !== 'applied')).toEqual([])

  // The office cancels one from its details, and marks the other lost on the client's no: each asks first, saying what her
  // link will say in its words.
  const office = await context.newPage()
  await office.goto(`/#jobs/${k('called-off')}`)
  await expect(office.locator('.conn')).toHaveText('Up to date')
  const details = office.getByRole('region', { name: 'Details', exact: true })
  await details.getByRole('button', { name: 'Change details' }).click()
  await details.getByLabel('Status').selectOption('cancelled')
  await details.getByRole('button', { name: 'Save job' }).click()
  await details
    .getByRole('group', { name: `Marking Called off ${id} cancelled also cancels its crew calls: 1 person offered or booked will see the job was cancelled.` })
    .getByRole('button', { name: 'Mark it cancelled' })
    .click()
  await expect(office.locator('.conn')).toHaveText('Up to date')
  await office.goto(`/#jobs/${k('elsewhere')}`)
  const where = office.getByRole('region', { name: 'Status', exact: true })
  // The stage's tasks are a tap away under the stepper (ADR 0140, part 3).
  await where.getByRole('button', { name: /tasks? to do in Quoting$/ }).click()
  await where.getByRole('button', { name: /^Confirmed/ }).click()
  await where.getByRole('button', { name: 'The client said no' }).click()
  await where
    .getByRole('group', { name: `Marking Went elsewhere ${id} lost also cancels its crew calls: 1 person offered or booked will see the job didn't go ahead.` })
    .getByRole('button', { name: 'Mark it lost' })
    .click()
  await expect(office.locator('.conn')).toHaveText('Up to date')

  await office.goto(`/#crew/person/${k('siun')}`)
  await expect(office.getByRole('status')).toHaveText('Up to date')
  const ahead = office.getByRole('region', { name: 'Coming up' })
  const row = (title: string) => ahead.getByRole('link', { name: new RegExp(`^${title}`) })
  await expect(row(`Called off ${id}`).locator('.pill')).toHaveText('Withdrawn by the office')
  await expect(row(`Called off ${id}`).locator('.booking-state small')).toHaveText('Job cancelled')
  await expect(row(`Went elsewhere ${id}`).locator('.booking-state small')).toHaveText('Job lost')
  await expect(row(`Still on ${id}`)).not.toContainText('Job ')
  // Each opens its job, as any booking does, and nothing is wider than the phone.
  await expect(row(`Called off ${id}`)).toHaveAttribute('href', `#jobs/${k('called-off')}/crew`)
  expect(await office.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phoneSize.width)
  // On a phone the job's word goes under the booking's, so the job's name keeps its room beside them; at a desk, beside it.
  const under = async () => {
    const [pill, word] = await Promise.all(['.pill', '.booking-state small'].map((part) => row(`Called off ${id}`).locator(part).boundingBox()))
    return word!.y >= pill!.y + pill!.height - 1
  }
  expect(await under()).toBe(true)
  await office.setViewportSize({ width: 1440, height: 900 })
  expect(await under()).toBe(false)
  await context.close()
})

test('archiving from the page goes back to the list, which says so with the way back', async ({ browser }) => {
  const name = `Tadhg Page ${id}`
  const context = await browser.newContext({ viewport: phoneSize })
  const res = await context.request.post('/api/sync/push', {
    data: {
      clientId: `person-archive-${id}`,
      mutations: [
        {
          id: `${k('a')}-0`,
          name: 'person.upsert',
          args: { id: k('tadhg'), name, kind: 'freelancer', email: null, phone: null, skills: [], dayRateCents: null, notes: '' },
          createdAt: new Date().toISOString(),
        },
      ],
    },
  })
  expect(res.ok()).toBe(true)
  const office = await context.newPage()
  await office.goto(`/#crew/person/${k('tadhg')}`)
  await expect(office.getByRole('status')).toHaveText('Up to date')
  await expect(office.getByRole('heading', { level: 1 })).toHaveText(name)
  await office.getByRole('button', { name: 'Archive', exact: true }).click()

  await expect(office).toHaveURL(/#crew\/people$/)
  const people = office.getByRole('region', { name: 'People' })
  await expect(people.locator('.added')).toHaveText(`Archived ${name}. Bring ${name} back`)
  await people.getByRole('button', { name: `Bring ${name} back` }).click()
  await people.getByLabel('Find a person').fill(`tadhg page ${id}`)
  await expect(people.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible()
})

// Picking Director asks first, and any other role says what it became (ADR 0110, audit finding 39). The test server is shared,
// so nobody is made a director here: that would switch roles on for every other test.
test('making someone a director asks first, and a role picked says what they are now', async ({ browser }) => {
  const name = `Saoirse Role ${id}`
  const context = await browser.newContext({ viewport: phoneSize })
  const res = await context.request.post('/api/sync/push', {
    data: {
      clientId: `person-role-${id}`,
      mutations: [
        {
          id: `${k('r')}-0`,
          name: 'person.upsert',
          args: { id: k('saoirse'), name, kind: 'staff', email: `saoirse.${id}@example.com`, phone: null, skills: [], dayRateCents: null, notes: '' },
          createdAt: new Date().toISOString(),
        },
      ],
    },
  })
  expect(res.ok()).toBe(true)
  const office = await context.newPage()
  await office.goto(`/#crew/person/${k('saoirse')}`)
  await expect(office.getByRole('status')).toHaveText('Up to date')
  await office.getByRole('tab', { name: /^Details/ }).click()
  const role = office.getByRole('combobox', { name: `Role for ${name}` })
  await role.selectOption('director')
  const ask = office.getByText(`Make ${name} a director? Saoirse can then change roles, erase people and start fresh.`)
  await expect(ask).toBeVisible()
  await office.getByRole('button', { name: 'Keep Staff crew' }).click()
  await expect(ask).toHaveCount(0)
  await expect(role).toHaveValue('crew')

  await role.selectOption('head')
  await expect(office.getByText(`${name} is Head of department now.`)).toBeVisible()
  await expect(office.getByRole('status')).toHaveText('Up to date')
  await expect(role).toHaveValue('head')
  await context.close()
})
