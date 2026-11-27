import { expect, test, type APIRequestContext, type Locator } from '@playwright/test'

/**
 * Stopping a job from its own page (Colly, 27 November 2026: "This UI for cancelling a gig can be improved a lot").
 * Cancel this job… under a job's details opens a card in the buttons' place. It asks what happened, as two choices each
 * with a line of what it is, and why, with the box saying where the words go. Beside them it says what the press does to
 * this job, a line for each part and only what's true of it: who sees what and how it reaches them, the kit and vehicles
 * free for other jobs again, the days that come off the calendar, the quote. One press then does it: the form has said everything a second
 * question would, Enter in the reason box does nothing, and Keep the job is the plain way out.
 *
 * Nothing goes to anyone here: the people have no addresses or mobiles, and the test server has no calendar. The last
 * test plays a server with the calendar connected and invites on, as the calendar's own tests do, and stops before the
 * press. SHOTS=1 refreshes the Blueprint's picture of the form from it.
 */

const shot = (name: string) => (process.env.SHOTS ? { path: `docs/hub/img/${name}.png` } : undefined)

type M = [string, Record<string, unknown>]

async function push(request: APIRequestContext, id: string, mutations: M[]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `stop-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `stop-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

const tag = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
const person = (id: string, name: string, email: string | null = null): M => ['person.upsert', { id, name, kind: 'freelancer', email, phone: null, skills: [], dayRateCents: null, notes: '' }]
const DAYS = { start: '2030-12-11', end: '2030-12-12' }
/** A confirmed gig over two days with a Rigger call for two: the first person booked, the second offered. */
const gig = (id: string, name: string, a: string, b: string): M[] => [
  ['project.create', { id: `j-${id}`, name, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
  ['phase.add', { id: `p-${id}`, projectId: `j-${id}`, name: 'Show', ...DAYS, venueId: null, notes: '' }],
  ['call.create', { id: `c-${id}`, projectId: `j-${id}`, phaseId: `p-${id}`, project: name, phase: 'Show', venue: '', role: 'Rigger', ...DAYS, callTime: null, needed: 2, dayRateCents: null, details: '', replyBy: null }],
  ['offer.send', { id: `oa-${id}`, callId: `c-${id}`, personId: a, override: false }],
  ['offer.respond', { id: `oa-${id}`, answer: 'accept', days: null, note: '' }],
  ['offer.confirm', { id: `oa-${id}` }],
  ['offer.send', { id: `ob-${id}`, callId: `c-${id}`, personId: b, override: false }],
]
/** Two names in either order: the people on a job's calls come as its calls and offers do. */
const both = (a: string, b: string) => `(${a} and ${b}|${b} and ${a})`
/** What the press does, by a word of the line. */
const lineOf = (form: Locator, about: string) => form.getByRole('list', { name: 'What this does' }).getByRole('listitem').filter({ hasText: about })

test('Cancel this job says what the press does before it is made, and one press then does it', async ({ browser, request }) => {
  const id = tag()
  const aoife = `Aoife Stop${id}`
  const tommo = `Tommo Stop${id}`
  const job = `Harbour Stop ${id}`
  const today = new Date().toISOString().slice(0, 10)
  await push(request, id, [
    ['messages.prompt', { on: false }],
    person(`a-${id}`, aoife),
    person(`b-${id}`, tommo),
    ['model.create', { id: `m-${id}`, name: `Speaker ${id}`, department: 'audio', category: 'Speakers', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }],
    ['vehicle.save', { id: `v-${id}`, name: `Van ${id}`, registration: `251-G-${1000 + Math.floor(Math.random() * 9000)}`, kind: 'van', seats: 3, payloadKg: 1200, notes: '', checks: { test: { needed: true, expires: '2031-06-01' } } }],
    ...gig(id, job, `a-${id}`, `b-${id}`),
    // Twelve speakers, two of them from a supplier; a van for both days; and a quote that has gone to the client.
    ['kit.add', { id: `k-${id}`, projectId: `j-${id}`, phaseId: null, modelId: `m-${id}`, qty: 12, subhireQty: 2, supplier: 'PSI', notes: '' }],
    ['vehicleBooking.add', { id: `vb-${id}`, vehicleId: `v-${id}`, projectId: `j-${id}`, phaseId: null, ...DAYS, driverId: `a-${id}`, notes: '', override: false }],
    ['quote.save', { id: `q-${id}`, projectId: `j-${id}`, lines: [{ id: `l-${id}`, kind: 'other', what: 'PA system', ref: null, group: 'Other', qty: 1, days: 1, unitCents: 50000, vat: '23' }], discountPct: 0, notes: '' }],
    ['quote.sent', { id: `q-${id}`, on: today }],
  ])

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  await page.goto(`/#jobs/j-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const details = page.getByRole('region', { name: 'Details', exact: true })
  const opener = details.getByRole('button', { name: 'Cancel this job…' })
  await opener.click()

  // A card of its own in the buttons' place, as wide as the details, named for the job, with the focus on its name.
  const form = details.getByRole('form', { name: 'Cancel this job' })
  await expect(form.getByRole('heading', { name: 'Cancel this job' })).toBeFocused()
  await expect(details.getByRole('button', { name: 'Change details' })).toHaveCount(0)
  await expect(form.locator('.cancel-job-head .hint')).toHaveText(`${job} · Wed 11 Dec to Thu 12 Dec`)
  expect(Math.abs((await form.boundingBox())!.width - (await details.boundingBox())!.width)).toBeLessThanOrEqual(1)

  // What happened, as two choices under the status's own words, each with a line of what it is; a confirmed job was called off
  // unless said otherwise. Each radio sits beside its words, not over them.
  const ways = form.getByRole('group', { name: 'What happened?' })
  const cancelled = ways.getByRole('radio', { name: 'Cancelled' })
  const lost = ways.getByRole('radio', { name: 'Lost' })
  await expect(ways.getByRole('radio')).toHaveCount(2)
  await expect(cancelled).toBeChecked()
  await expect(cancelled).toHaveAccessibleDescription('It was called off.')
  await expect(lost).toHaveAccessibleDescription('The client said no or went elsewhere.')
  for (const card of await ways.locator('label').all()) {
    const dot = (await card.getByRole('radio').boundingBox())!
    const name = (await card.locator('b').boundingBox())!
    expect(dot.x + dot.width).toBeLessThanOrEqual(name.x)
    expect(Math.abs(dot.y + dot.height / 2 - (name.y + name.height / 2))).toBeLessThan(dot.height / 2)
  }

  // Why: its name outside the box, an example in it, and where the words go said under it before anything is typed.
  const why = form.getByLabel('Why (optional)')
  await expect(why).toHaveAttribute('placeholder', 'e.g. The venue double-booked')
  await expect(why).toHaveAccessibleDescription('Kept at the top of the office notes: only in the app, for the office.')

  // What the press does, the people first: who sees what, in their link's words, and that nothing is sent them here; the kit of
  // our own freed, and the two from a supplier the app can't tell; the van; the quote. What leaves the app or leaves the office
  // something to do is in amber.
  await expect(form.getByRole('list', { name: 'What this does' }).getByRole('listitem').first()).toHaveText(
    new RegExp(`^Its crew call is cancelled\\. ${both(aoife, tommo)} will see the job was cancelled\\. The app sends them nothing: their links say so whenever they open them\\.$`)
  )
  await expect(lineOf(form, 'crew call')).toHaveClass('warn')
  await expect(lineOf(form, 'items of kit')).toHaveText("Its 10 items of kit are free for other jobs again. 2 more are hired in from PSI: the app doesn't tell them, so cancel those yourself.")
  await expect(lineOf(form, 'items of kit')).toHaveClass('warn')
  await expect(lineOf(form, `Van ${id}`)).toHaveText(`Van ${id} is free for other jobs again.`)
  await expect(lineOf(form, `Van ${id}`)).not.toHaveClass('warn')
  await expect(lineOf(form, 'quote')).toHaveText("Its quote is set aside, so it counts in no totals unless it's invoiced.")
  // Then the way back, and the one thing that has none.
  await expect(form.locator('.cancel-job-does > .hint')).toHaveText(
    "It can be taken up again under Change details, and its crew call brought back with the same people picked, ready to ask again. What they've already been told can't be taken back."
  )
  // At a desk what's asked sits beside what it does, so both are read before the buttons under them.
  const asked = (await form.locator('.cancel-job-ask').boundingBox())!
  const does = (await form.locator('.cancel-job-does').boundingBox())!
  expect(does.x).toBeGreaterThanOrEqual(asked.x + asked.width)
  expect(Math.abs(does.y - asked.y)).toBeLessThanOrEqual(1)

  // The press is the one in the bad fill, named for what it does, and read out with what it does; Keep the job is plain.
  const press = form.getByRole('button', { name: 'Cancel the job' })
  await expect(press).toHaveClass('danger')
  await expect(press).toHaveAccessibleDescription(/^What this does Its crew call is cancelled\./)
  await expect(form.getByRole('button', { name: 'Keep the job' })).not.toHaveClass(/danger|primary|link/)

  // Lost instead: their links say so in its own words, the example and the press follow.
  await lost.check()
  await expect(lineOf(form, 'crew call')).toContainText("will see the job didn't go ahead.")
  await expect(why).toHaveAttribute('placeholder', 'e.g. Went with a cheaper PA')
  await expect(form.getByRole('button', { name: 'Mark lost' })).toHaveClass('danger')
  await expect(form.getByRole('button', { name: 'Cancel the job' })).toHaveCount(0)
  await cancelled.check()

  // Enter in the reason box does nothing: a stray key never cancels a gig. Keep the job closes the form, gives the focus back to
  // the button that opened it, and has changed nothing.
  await why.fill('The venue double-booked')
  await why.press('Enter')
  await expect(form).toBeVisible()
  await form.getByRole('button', { name: 'Keep the job' }).click()
  await expect(form).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect(page.locator('.corner-status')).toHaveText('Confirmed')
  await expect(details.getByText(/^Office notes:/)).toHaveCount(0)

  // Opened again it starts afresh. One press stops the job: its status says so, the reason is kept with the day at the top of
  // the office notes, and the panel that says what was sent to whom opens with the focus.
  await opener.click()
  await expect(why).toHaveValue('')
  await why.fill('The venue double-booked')
  await press.click()
  await expect(page.locator('.corner-status')).toHaveText('Cancelled')
  await expect(details.getByText(/^Office notes: Cancelled \w{3} \d{1,2} \w{3}: The venue double-booked$/)).toBeVisible()
  const sent = page.getByRole('region', { name: 'Crew calls cancelled: what was sent' })
  await expect(sent).toBeFocused()
  await expect(sent).toContainText('Nothing was sent to')
  await expect(form).toHaveCount(0)
  await expect(opener).toHaveCount(0)
  await expect(details.getByRole('button', { name: 'Change details' })).toBeVisible()
  // And it's the server's too.
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.reload()
  await expect(page.locator('.corner-status')).toHaveText('Cancelled')
})

test('on a phone the form is one column in the page, a job with nothing on it says so, and an errand is only ever cancelled', async ({ browser, request }) => {
  const id = tag()
  const gala = `Spring Gala ${id}`
  await push(request, id, [
    ['project.create', { id: `g-${id}`, name: gala, clientId: null, venueId: null, status: 'enquiry', notes: 'Deposit to be agreed.' }],
    ['phase.add', { id: `gp-${id}`, projectId: `g-${id}`, name: 'Show', start: '2031-03-05', end: '2031-03-05', venueId: null, notes: '' }],
    ['project.update', { id: `g-${id}`, officeNotes: 'Niamh rang about it in October.' }],
    ['project.create', { id: `e-${id}`, name: `Collect truss ${id}`, clientId: null, venueId: null, status: 'confirmed', kind: 'errand', notes: '' }],
    ['phase.add', { id: `ep-${id}`, projectId: `e-${id}`, name: 'Errand', start: '2031-03-06', end: '2031-03-06', venueId: null, notes: '' }],
  ])
  const phone = { width: 390, height: 844 }
  const page = await (await browser.newContext({ viewport: phone, hasTouch: true })).newPage()
  await page.goto(`/#jobs/g-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const details = page.getByRole('region', { name: 'Details', exact: true })
  await details.getByRole('button', { name: 'Cancel this job…' }).click()
  const form = details.getByRole('form', { name: 'Cancel this job' })
  await expect(form.locator('.cancel-job-head .hint')).toHaveText(`${gala} · Wed 5 Mar`)

  // Not yet confirmed, so it's lost unless said otherwise; and with nothing on it, that's said in the list's place.
  await expect(form.getByRole('radio', { name: 'Lost' })).toBeChecked()
  await expect(form.getByRole('list', { name: 'What this does' })).toHaveCount(0)
  await expect(form.locator('.cancel-job-does')).toHaveText(
    'What this doesOnly its status changes: nobody is told, and no kit or transport is held for it.It can be taken up again under Change details.'
  )

  // One column, nothing wider than the phone: what it does is under what's asked, and each button is the width of the card.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width)
  const asked = (await form.locator('.cancel-job-ask').boundingBox())!
  const does = (await form.locator('.cancel-job-does').boundingBox())!
  expect(does.y).toBeGreaterThanOrEqual(asked.y + asked.height)
  expect(Math.abs(does.x - asked.x)).toBeLessThanOrEqual(1)
  const press = (await form.getByRole('button', { name: 'Mark lost' }).boundingBox())!
  const keep = (await form.getByRole('button', { name: 'Keep the job' }).boundingBox())!
  expect(Math.abs(press.width - asked.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(keep.width - asked.width)).toBeLessThanOrEqual(1)
  expect(keep.y).toBeGreaterThanOrEqual(press.y + press.height)
  // Each example fits its box: an example cut off mid-word says less than none.
  const why = form.getByLabel('Why (optional)')
  for (const way of ['Cancelled', 'Lost']) {
    await form.getByRole('radio', { name: way }).check()
    expect(
      await why.evaluate((el: HTMLInputElement) => {
        const style = getComputedStyle(el)
        const pen = document.createElement('canvas').getContext('2d')!
        pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        return pen.measureText(el.placeholder).width <= el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      })
    ).toBe(true)
  }

  // Marked lost with no reason: the day alone goes first in the office notes, over what was there; nobody was on it, so no panel
  // opens, and the focus goes to the details' first button rather than nowhere.
  await form.getByRole('button', { name: 'Mark lost' }).click()
  await expect(form).toHaveCount(0)
  await expect(details.getByRole('button', { name: 'Change details' })).toBeFocused()
  await expect(details.getByText(/^Office notes: Lost \w{3} \d{1,2} \w{3}\sNiamh rang about it in October\.$/)).toBeVisible()
  await expect(page.getByRole('region', { name: /what was sent/ })).toHaveCount(0)
  await expect(details.getByRole('button', { name: 'Cancel this job…' })).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('Up to date')

  // An errand is called off, never lost to a no: it isn't asked which.
  await page.goto(`/#jobs/e-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await details.getByRole('button', { name: 'Cancel this job…' }).click()
  await expect(form.getByRole('heading', { name: 'Cancel this job' })).toBeFocused()
  await expect(form.getByRole('radio')).toHaveCount(0)
  await expect(form.getByRole('group', { name: 'What happened?' })).toHaveCount(0)
  await expect(form.getByLabel('Why (optional)')).toHaveAttribute('placeholder', 'e.g. The venue double-booked')
  await form.getByRole('button', { name: 'Cancel the job' }).click()
  await expect(details.getByText(/^Office notes: Cancelled \w{3} \d{1,2} \w{3}$/)).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Up to date')
})

test('with the calendar connected the form says what Google emails each person, and which days come off it', async ({ browser, request }) => {
  // The test server runs without Google, so a server with the calendar connected and crew invites on is played here, as
  // e2e/calendar.spec.ts does: the connection, and each of the job's days on the calendar with both people invited, arrive in
  // the normal pull. Nothing is pressed: the form is read, and the job kept.
  const id = tag()
  // In a run the names carry the run's tag, as the server is shared; for the Blueprint's picture, taken with this file on its own, they're plain.
  const [aoife, tommo, job] = process.env.SHOTS ? ['Aoife Brennan', 'Tommo Daly', 'Harbour Lights Festival'] : [`Aoife Mail${id}`, `Tommo Mail${id}`, `Harbour Mail ${id}`]
  await push(request, id, [['messages.prompt', { on: false }], person(`a-${id}`, aoife, `aoife-${id}@example.com`), person(`b-${id}`, tommo, `tommo-${id}@example.com`), ...gig(id, job, `a-${id}`, `b-${id}`)])

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const calendarId = 'test-cal@group.calendar.google.com'
  await page.route(/\/api\/sync\/pull/, async (route) => {
    const res = await route.fetch()
    const body = (await res.json()) as { cursor: number; changes: { seq: number; entity: string; id: string; op: string; data: unknown }[] }
    const put = (entity: string, key: string, data: unknown) => body.changes.push({ seq: body.cursor, entity, id: key, op: 'put', data })
    put('calendarLink', 'main', {
      id: 'main',
      state: 'on',
      account: 'ops@example.com',
      calendarId,
      calendarName: 'Test calendar',
      problem: null,
      connectedBy: 'The office',
      connectedAt: new Date().toISOString(),
      invites: true,
    })
    const guests = [`a-${id}`, `b-${id}`].map((personId, i) => ({ personId, offerId: `${i ? 'ob' : 'oa'}-${id}`, response: 'needsAction', problem: null }))
    for (const day of [DAYS.start, DAYS.end])
      put('calendarDay', `p-${id}/${day}`, { id: `p-${id}/${day}`, phaseId: `p-${id}`, projectId: `j-${id}`, day, calendarId, state: 'on', title: job, problem: null, link: null, guests })
    return route.fulfill({ response: res, json: body })
  })
  await page.goto(`/#jobs/j-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const details = page.getByRole('region', { name: 'Details', exact: true })
  await details.getByRole('button', { name: 'Cancel this job…' }).click()
  const form = details.getByRole('form', { name: 'Cancel this job' })

  // Who sees what, then what Google emails them: no "and why" beside a Why box that is the office's alone.
  await expect(lineOf(form, 'crew call')).toHaveText(
    new RegExp(`^Its crew call is cancelled\\. ${both(aoife, tommo)} will see the job was cancelled\\. Google emails each of them that their days are cancelled\\.$`)
  )
  await expect(lineOf(form, 'come off')).toHaveText('Its 2 days come off Test calendar.')
  await expect(lineOf(form, 'come off')).not.toHaveClass('warn')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot(shot('cancel-job'))

  await form.getByRole('button', { name: 'Keep the job' }).click()
  await expect(page.locator('.corner-status')).toHaveText('Confirmed')
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await context.close()
})
