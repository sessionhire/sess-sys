import { expect, test } from '@playwright/test'

/**
 * A freelancer answering an offer from their link on a phone, with no app
 * and no script: a day they hold on another job starts unticked and says
 * so; the office's refusal lands in the offer's card, where they can see
 * it; a rate it can't read is refused under the field, where the page
 * lands; Enter in the rate field sends the rate, never accepting the job
 * at the offered rate; the calendar address is a field to copy, with
 * Subscribe; what's over is two dated lists; and what changed on a
 * booking since the yes is said on it, as is a job that was cancelled. A
 * member of staff's link has their leave in place of days off, with the
 * way to ask for it in the app, and turns down days off posted from a page
 * kept from before. Uses the made-up data (ADR 0019), so it starts fresh
 * before and after: the other tests share this server.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test('a clash is shown before the server says it, a refusal shows in the offer’s card, and Enter in the rate field sends the rate', async ({ browser, request }) => {
  // Proves: on a phone with no script the page warns of a clash, keeps a refusal on screen in its card or under its field, never accepts on Enter, offers the calendar address to copy, and dates what's over.
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)

  // Dara's link, as the office would send it.
  const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; data: { name: string; linkToken: string } }[] }
  const dara = changes.find((c) => c.entity === 'person' && c.data.name === 'Dara Quinn')!
  const phone = await (await browser.newContext({ viewport: phoneSize, javaScriptEnabled: false })).newPage()
  await phone.goto(`/f/${dara.data.linkToken}`)
  const card = phone.getByRole('article').filter({ hasText: 'Brightwater Tech Summit' })
  await expect(card.locator('.tag')).toHaveText('Waiting on you')

  // The first day is one Dara holds at Harbour Lights: it starts unticked and says so, so the clash is seen before the server has to say it.
  const clash = card.getByRole('checkbox').first()
  await expect(clash).not.toBeChecked()
  await expect(card.locator('fieldset.days label').first()).toContainText('booked on Harbour Lights Festival (Show)')
  await expect(card.getByRole('checkbox').nth(1)).toBeChecked()

  // Ticked anyway and accepted: the refusal comes back in the card, on screen, as an alert.
  await clash.check()
  await card.getByRole('button', { name: 'Accept these days' }).click()
  const alert = card.getByRole('alert')
  await expect(alert).toHaveText(/^Already booked on Harbour Lights Festival/)
  const box = await alert.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(phoneSize.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(phoneSize.height)
  await expect(card.locator('.tag')).toHaveText('Waiting on you')
  // What was ticked is kept, so nothing has to be done again; the clashing day is unticked by hand.
  await expect(card.getByRole('checkbox').first()).toBeChecked()
  await card.getByRole('checkbox').first().uncheck()

  // Asks for a different rate for the day that's free. The euro is drawn in the box, before the number, and is in the field's name.
  await card.getByText('Ask for a different rate or add a note').click()
  const rate = card.getByLabel("Day rate you'd do it for, €")
  await expect(card.locator('.unit-box .unit')).toHaveText('€')
  // A rate it can't read is refused under the field in the page's words, the field marked and described by it, with "Error: "
  // first in the tab's title; the page lands on the field, so both are on screen, with what was typed still in it.
  await rate.fill('lots')
  await rate.press('Enter')
  await expect(phone).toHaveTitle('Error: Session Hire: your work')
  const refusal = card.locator('.field-error')
  await expect(refusal).toHaveText('Put in a price like 250 or 1,250.50.')
  await expect(rate).toHaveAttribute('aria-invalid', 'true')
  await expect(rate).toHaveAccessibleDescription('Put in a price like 250 or 1,250.50.')
  await expect(rate).toHaveValue('lots')
  for (const shown of [rate, refusal]) {
    const at = (await shown.boundingBox())!
    expect(at.y).toBeGreaterThanOrEqual(0)
    expect(at.y + at.height).toBeLessThanOrEqual(phoneSize.height)
  }
  // It sits under the euro box, and the note's label under it, each clear of the one above (UX sweep, 6 November 2026, move 5).
  const euroBox = (await card.locator('.unit-box').boundingBox())!
  const said = (await refusal.boundingBox())!
  expect(said.y).toBeGreaterThanOrEqual(euroBox.y + euroBox.height)
  expect((await card.getByText('Note for the office').boundingBox())!.y).toBeGreaterThanOrEqual(said.y + said.height)

  // Then with Enter in the rate field: the rate goes to the office, nothing is accepted.
  // Typed with a euro sign and a comma, as the audit found it (finding 15): the browser lets it through and the page reads it as €1,250.
  await rate.fill('€1,250')
  await rate.press('Enter')
  await expect(card.getByRole('status')).toHaveText('Thanks, your rate has gone to the office.')
  await expect(card.locator('.tag')).toHaveText('Rate sent to the office')
  await expect(card.getByText('€1250 a day asked (offered €320)')).toBeVisible()

  // The calendar address is a field to copy by hand, with Subscribe for the calendar apps that take a webcal: link. Without script there's no Copy button to press for nothing.
  const address = phone.getByLabel('Calendar address')
  await expect(address).toHaveValue(/^http:\/\/localhost:\d+\/cal\/[\w-]{24}\.ics$/)
  await expect(address).toHaveAttribute('readonly', '')
  await expect(phone.getByRole('link', { name: 'Subscribe' })).toHaveAttribute('href', /^webcal:\/\/localhost:\d+\/cal\/[\w-]{24}\.ics$/)
  await expect(phone.getByRole('button', { name: 'Copy address' })).toBeHidden()

  // What's over is two lists, each line with its days: the gala Dara worked, and Laoise's no to the load-in.
  await expect(phone.getByRole('heading', { name: 'Earlier' })).toHaveCount(0)
  const past = phone.locator('section', { has: phone.getByRole('heading', { name: 'Past work' }) })
  await expect(past.locator('li').first()).toContainText(/^Autumn Gala \(Show\) · Sound No\.1 · \w{3} \d{1,2} \w{3} to \w{3} \d{1,2} \w{3} Booked$/)
  const laoise = changes.find((c) => c.entity === 'person' && c.data.name === 'Laoise Keane')!
  await phone.goto(`/f/${laoise.data.linkToken}`)
  const turned = phone.locator('section', { has: phone.getByRole('heading', { name: 'Declined and withdrawn' }) })
  await expect(turned.locator('li').first()).toContainText(/^Harbour Lights Festival \(Load in\) · Stagehand · \w{3} \d{1,2} \w{3} to \w{3} \d{1,2} \w{3} You declined on \w{3} \d{1,2} \w{3}$/)

  // With script, Copy address puts the address on the clipboard and says so.
  const withScript = await browser.newContext({ viewport: phoneSize, permissions: ['clipboard-read', 'clipboard-write'] })
  const scripted = await withScript.newPage()
  await scripted.goto(`/f/${dara.data.linkToken}`)
  // Found by its place, not its words: pressed, it says "Copied".
  const copy = scripted.locator('button.copy')
  await expect(copy).toHaveText('Copy address')
  await copy.click()
  await expect(copy).toHaveText('Copied')
  expect(await scripted.evaluate(() => navigator.clipboard.readText())).toMatch(/\/cal\/[\w-]{24}\.ics$/)

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test("the link says what changed on a booking since the yes, and a booking on a cancelled job says so first", async ({ browser, request }) => {
  // Proves (UX sweep, 6 November 2026, move 6): moving a call sends nothing (ADR 0048), so the next time the link is opened
  // the booking says the new call time with what was said yes to in brackets; a booking on a job the client cancelled says
  // so as its card's first line, where the booking was; and giving a booking back is "Can't make it" on the fold, the
  // button and the message after.
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  const id = Math.random().toString(36).slice(2, 8)
  const on = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
  let sent = 0
  const office = async (mutations: [string, Record<string, unknown>][]) => {
    const res = await request.post('/api/sync/push', {
      data: { clientId: `office-${id}`, mutations: mutations.map(([name, args]) => ({ id: `${id}-${sent++}`, name, args, createdAt: new Date().toISOString() })) },
    })
    expect(res.ok()).toBe(true)
    expect((await res.json()).results.filter((r: { status: string }) => r.status !== 'applied')).toEqual([])
  }
  const job = (key: string, name: string, day: string): [string, Record<string, unknown>][] => [
    ['project.create', { id: `${key}-${id}`, name, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    [
      'call.create',
      { id: `${key}-call-${id}`, projectId: `${key}-${id}`, phaseId: null, project: name, phase: '', venue: '', role: 'Audio tech', start: day, end: day, callTime: '09:00', needed: 1, dayRateCents: 25000, details: '', replyBy: null },
    ],
    ['offer.send', { id: `${key}-offer-${id}`, callId: `${key}-call-${id}`, personId: `nora-${id}`, override: false }],
  ]
  await office([
    ['person.upsert', { id: `nora-${id}`, name: 'Nora Lynch', kind: 'freelancer', email: null, phone: '+353871234567', skills: ['Audio'], dayRateCents: 25000, notes: '' }],
    ...job('gala', 'Autumn Gala', on(20)),
    ...job('fair', 'Craft Fair', on(21)),
  ])
  const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; id: string; data: { linkToken: string } }[] }
  const nora = changes.find((c) => c.entity === 'person' && c.id === `nora-${id}`)!

  // She says yes to both on her phone, with no script.
  const phone = await (await browser.newContext({ viewport: phoneSize, javaScriptEnabled: false })).newPage()
  await phone.goto(`/f/${nora.data.linkToken}`)
  for (const name of ['Autumn Gala', 'Craft Fair']) {
    await phone.getByRole('article').filter({ hasText: name }).getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(phone.getByRole('article').filter({ hasText: name }).locator('.tag')).toHaveText('Accepted, the office will confirm')
  }

  // The office moves the gala's call to 07:30, and the client cancels the fair. Nothing is sent.
  await office([
    ['call.update', { id: `gala-call-${id}`, callTime: '07:30' }],
    ['project.update', { id: `fair-${id}`, status: 'cancelled' }],
  ])
  await phone.goto(`/f/${nora.data.linkToken}`)
  const bookings = phone.locator('#bookings')
  const gala = bookings.getByRole('article').filter({ hasText: 'Autumn Gala' })
  await expect(gala.locator('dd').filter({ hasText: '07:30' })).toHaveText('07:30 (was 09:00)')
  // The fair's card is where the booking was, after the gala's, and how it ended is its first line and its heading's, so
  // moving through the page by headings hears it too.
  const fair = bookings.getByRole('article').nth(1)
  await expect(fair.locator(':scope > :first-child .news')).toHaveText('The job was cancelled')
  await expect(fair.getByRole('heading', { level: 3 })).toHaveText('The job was cancelled Craft Fair')
  await expect(fair.getByRole('button')).toHaveCount(0)
  // Nothing on it is wider than the phone.
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phoneSize.width)

  // Giving the gala back is "Can't make it", on the fold, the button and the message after.
  await gala.getByText("Can't make it?").click()
  await gala.getByRole('button', { name: "Can't make it", exact: true }).click()
  await expect(phone.getByRole('status').first()).toHaveText("Thanks for telling us you can't make it. You're off this one, and the office will find cover.")
  const turned = phone.locator('section', { has: phone.getByRole('heading', { name: 'Declined and withdrawn' }) })
  await expect(turned.locator('li').filter({ hasText: 'Autumn Gala' })).toContainText(/Can't make it: you told us on \w{3} \d{1,2} \w{3}$/)

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test("a member of staff's link lists their leave, with the way to ask for it in the app, and turns down days off in the app's words", async ({ browser, request }) => {
  // Proves (UX sweep, 6 November 2026, move 6): staff time off is leave, approved in the app (ADR 0024), so a staff link lists
  // what's asked for and approved under Leave, with the way to the app's Leave, and draws no Add days off; and a page kept from
  // before, the form still on it, has its days off turned down in the app's words where it lands, with nothing marked.
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; data: { name: string; linkToken: string } }[] }
  const cian = changes.find((c) => c.entity === 'person' && c.data.name === 'Cian Murphy')!

  // On his phone with no script: his week away, asked for in the app and waiting on Aoife, and no form to mark days off.
  const phone = await (await browser.newContext({ viewport: phoneSize, javaScriptEnabled: false })).newPage()
  await phone.goto(`/f/${cian.data.linkToken}`)
  const leave = phone.locator('section', { has: phone.getByRole('heading', { level: 2, name: 'Leave', exact: true }) })
  await expect(leave.getByRole('listitem')).toHaveCount(1)
  await expect(leave.getByRole('listitem')).toContainText(/^\w{3} \d{1,2} \w{3}.* to \w{3} \d{1,2} \w{3}.* Annual leave · Flights booked, if that suits\./)
  await expect(leave.locator('.tag')).toHaveText('Waiting for approval')
  await expect(leave.getByRole('link', { name: 'Ask for leave in the app ›' })).toHaveAttribute('href', /^http:\/\/localhost:\d+\/#crew\/leave$/)
  await expect(phone.getByRole('heading', { name: "Days you can't work" })).toHaveCount(0)
  await expect(phone.getByRole('button', { name: 'Add days off' })).toHaveCount(0)

  // A page kept from before has the form still on it: drawn back in here, as it was, and sent. Turned down in the app's
  // words, said in Leave where the page lands, and nothing marked.
  const kept = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await kept.goto(`/f/${cian.data.linkToken}`)
  expect(await kept.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phoneSize.width)
  await kept.locator('section#away').evaluate((section) => {
    section.insertAdjacentHTML(
      'beforeend',
      `<form method="post" action="${location.pathname}/away#refused" class="add-away"><label>From <input type="date" name="start" required></label><label>Until <input type="date" name="end"></label><label>Note (optional) <input name="note"></label><button>Add days off</button></form>`
    )
  })
  const form = kept.locator('form.add-away')
  await form.getByLabel('From').fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10))
  await form.getByLabel('Note (optional)').fill('Gig in Galway')
  await form.getByRole('button', { name: 'Add days off' }).click()
  await expect(kept).toHaveTitle('Error: Session Hire: your work')
  const said = kept.locator('section', { has: kept.getByRole('heading', { level: 2, name: 'Leave', exact: true }) })
  await expect(said.getByRole('alert')).toHaveText('Staff ask for leave in the app, under Leave, where whoever approves time off sees it.')
  await expect(said.getByRole('alert')).toBeInViewport()
  await expect(said.getByRole('listitem')).toHaveCount(1)
  await expect(said.getByRole('button', { name: 'Add days off' })).toHaveCount(0)

  // Ask for leave in the app opens the app's Leave, where he asks and Aoife approves.
  await said.getByRole('link', { name: 'Ask for leave in the app ›' }).click()
  await expect(kept).toHaveURL(/\/#crew\/leave$/)
  await expect(kept.getByRole('heading', { level: 1, name: 'Leave' })).toBeVisible()

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})
