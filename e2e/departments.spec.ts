import { expect, test, type Page } from '@playwright/test'
import { MONEY_ENTITY_NAMES } from '../shared/src/quotes.ts'

/**
 * A department on every crew call, and what each role reads (ADR 0046):
 * a call asked for starts on the department its role suggests; Crew › Calls
 * narrows to one, and gives the calls with none a department many at a
 * time; Home for a department counts the crew its calls still need; and a
 * head of department, seen on the demo, is told plainly what's hidden for
 * their role rather than shown a wrong figure or a dead button. Uses the
 * made-up data (ADR 0019), so it starts fresh before and after: the other
 * tests share this server.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test.beforeAll(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
})

test.afterAll(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('a call starts on the department its role suggests, and Calls narrows to one and gives many a department at once', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew/calls')
  await expect(page.getByRole('status')).toHaveText('Up to date')

  // Asked for with no department picked: the role's words say LX, and it says where that came from.
  await page.getByRole('button', { name: 'Ask for crew' }).click()
  const ask = page.locator('form').filter({ has: page.getByRole('button', { name: 'Ask for crew' }) })
  await ask.getByLabel('Project').fill('Dept Test Gig')
  await ask.getByLabel('Role').fill('LX op')
  await ask.getByLabel('From').fill('2030-09-01')
  await ask.getByLabel('To', { exact: true }).fill('2030-09-01')
  await expect(ask.getByLabel('Department')).toHaveValue('LX')
  await expect(ask.getByText("From the role. Change it if the call is another department's.")).toBeVisible()
  await ask.getByRole('button', { name: 'Ask for crew' }).click()

  // Narrowed to LX, the new call is there; narrowed to Audio, it isn't.
  const filter = page.getByLabel('Calls for department')
  await filter.selectOption('LX')
  const needed = page.locator('section', { has: page.getByRole('heading', { name: 'Coming up' }) })
  await expect(needed.getByText('Dept Test Gig')).toBeVisible()
  await filter.selectOption('Audio')
  await expect(needed.getByText('Dept Test Gig')).toHaveCount(0)

  // The load out's hands came with none. Nothing is ticked to start, and nothing is given until a department is picked.
  await filter.selectOption({ label: 'No department' })
  await needed.getByRole('button', { name: /a department…$/ }).click()
  const give = page.getByRole('form', { name: 'Give calls a department' })
  // Never greyed out (UX sweep, move 5): a press says what's missing.
  await give.getByRole('button', { name: 'Give them the department' }).click()
  await expect(give.getByRole('alert')).toHaveText('Tick the calls to give a department first.')
  await give.getByRole('checkbox').first().check()
  await give.getByRole('button', { name: 'Give them the department' }).click()
  await expect(give.getByRole('alert')).toHaveText('Choose the department first.')
  await give.getByLabel('Department').selectOption('Production')
  await give.getByRole('button', { name: /^Give 1 call Production$/ }).click()
  // The list moves to Production, where the call now is, and says what was done.
  await expect(page.getByText('Gave 1 call Production.')).toBeVisible()
  await expect(filter).toHaveValue('Production')
  await expect(needed.getByText(/Stagehand/).first()).toBeVisible()
  await expect(filter.locator('option', { hasText: 'No department' })).toHaveCount(0)
})

test('Home for a department counts the crew its calls still need', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew/calls')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  // A call for Video, in the fortnight ahead, that nobody has been offered yet.
  await page.getByRole('button', { name: 'Ask for crew' }).click()
  const ask = page.locator('form').filter({ has: page.getByRole('button', { name: 'Ask for crew' }) })
  const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
  await ask.getByLabel('Project').fill('Camera Day')
  await ask.getByLabel('Role').fill('Camera op')
  await ask.getByLabel('From').fill(soon)
  await ask.getByLabel('To', { exact: true }).fill(soon)
  await ask.getByRole('button', { name: 'Ask for crew' }).click()
  await expect(page.getByRole('status')).toHaveText('Up to date')

  await page.goto('/#home')
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Department' }).click()
  await page.getByLabel('Department').selectOption('Video')
  await expect(page.getByRole('heading', { name: 'Needs attention in Video' })).toBeVisible()
  await expect(page.locator('.standing').getByRole('link', { name: /call(s)? still need(s)? crew/ })).toBeVisible()

  // The count opens the list it counted (audit, 20 October 2026, finding 4): Crew needed's calls short of crew, in view,
  // narrowed to Video, headed with the count's own number (Move 3 of the sweep of 6 November 2026).
  const tile = page.locator('.standing').getByRole('link', { name: /call(s)? still need(s)? crew/ })
  const count = (await tile.locator('b').textContent())!
  await tile.click()
  const needed = page.getByRole('heading', { name: `Still needs crew (${count})`, exact: true })
  await expect(needed).toBeFocused()
  await expect(needed).toBeInViewport()
  await expect(page.getByLabel('Calls for department')).toHaveValue('Video')
  await expect(page.getByText(/Camera op/).first()).toBeVisible()
  // Opened from the tab bar, it's every department again.
  await page.goto('/#home')
  await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: /^Crew/ }).click()
  await expect(page.getByLabel('Calls for department')).toHaveValue('')
})

/**
 * The demo copy, seen as a head of department. This server has no
 * passcode, so the test answers for it as a demo copy would: it says who's
 * asking, and sends what a head of department reads, as the server's own
 * tests prove it does (server/test/roles.test.ts): no quotes or prices
 * (ADR 0042), no rates, and only their own department's private links.
 */
async function asHeadOf(page: Page, department: string) {
  await page.route('**/api/me', (route) => route.fulfill({ json: { auth: 'passcode', role: 'head' } }))
  await page.route('**/api/auth/preview', (route) => route.fulfill({ json: { role: 'head' } }))
  await page.route('**/api/sync/pull**', async (route) => {
    // A pull still on its way when the test ends finds the page closed: nothing to answer.
    const res = await route.fetch().catch(() => null)
    if (!res) return
    const body = await res.json()
    type Change = { entity: string; op: string; data: Record<string, unknown> }
    body.changes = (body.changes as Change[]).filter((c) => !MONEY_ENTITY_NAMES.includes(c.entity))
    for (const c of body.changes as Change[]) {
      if (c.op !== 'put') continue
      const d = c.data
      if (c.entity === 'person') {
        Object.assign(d, { dayRateCents: null, rateHidden: true })
        if (String(d.department ?? '').toLowerCase() !== department.toLowerCase()) Object.assign(d, { linkToken: '', linkHidden: true })
      }
      if (c.entity === 'crewCall') Object.assign(d, { dayRateCents: null, rateHidden: true })
      if (c.entity === 'offer') Object.assign(d, { dayRateCents: null, counterRateCents: null, rateHidden: true })
      if (c.entity === 'timesheet') {
        const zero = (extras: { cents: number }[]) => extras.map((e) => ({ ...e, cents: 0 }))
        const sent = d.sent as { extras: { cents: number }[] }
        Object.assign(d, { dayRateCents: null, extras: zero(d.extras as { cents: number }[]), sent: { ...sent, dayRateCents: null, extras: zero(sent.extras) }, amountsHidden: true })
      }
    }
    await route.fulfill({ response: res, json: { ...body, money: false, reading: { rates: false, links: 'department', department } } })
  })
}

test('a head of department is told what is hidden for their role, and never shown a wrong figure', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await asHeadOf(page, 'Audio')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'See it as…' })).toBeVisible()
  await expect(page.getByText(/hidden for your role/)).toBeVisible()
  await page.getByRole('button', { name: /^Head of department/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
  // Home offers only what they can act on (audit, 20 October 2026, finding 3): timesheets they can't decide aren't a count for them.
  await expect(page.locator('.standing h2')).toBeVisible()
  await expect(page.locator('.standing').getByRole('link', { name: /timesheets? to approve/ })).toHaveCount(0)

  // Crew needed starts on their own department, and no rate is shown as one.
  await page.goto('/#crew/calls')
  await expect(page.getByLabel('Calls for department')).toHaveValue('Audio')
  // So do the answers to check (audit, 5 November 2026, finding 6): none from Audio, said, with the way to the others' answers.
  const answers = page.locator('section.card', { has: page.getByRole('heading', { name: /^Answers to check/ }) })
  await expect(answers.getByRole('heading', { name: /^Answers to check/ })).toHaveText('Answers to check (0)')
  await expect(answers).toContainText('Showing Audio only.')
  await expect(answers).toContainText('Nothing waiting from Audio.')
  await answers.getByRole('button', { name: 'Show all departments' }).click()
  await expect(answers).toContainText("Tadhg Brady can't make it")
  await expect(answers).not.toContainText('any more')
  await expect(page.locator('main')).not.toContainText('NaN')
  await expect(page.locator('main')).not.toContainText('€')

  // People starts on their own department too, said in the filter's chip, with the way to everyone (audit, 5 November 2026, finding 42).
  await page.goto('/#crew/people')
  await expect(page.getByRole('button', { name: 'Take off the filter Department: Audio' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'People' }).getByRole('link', { name: /^Fionn Gallagher/ })).toHaveCount(0)
  // Someone in Audio: their link is there to send. Someone in LX: no link tab, and nothing that would break their link.
  await page.getByRole('region', { name: 'People' }).getByRole('link', { name: /^Dara Quinn/ }).click()
  await page.getByRole('tab', { name: /^Details/ }).click()
  await expect(page.getByText('Hidden for your role')).toBeVisible()
  await page.getByRole('tab', { name: /^Their link/ }).click()
  await expect(page.getByRole('link', { name: 'Open their page' })).toBeVisible()
  await page.goto('/#crew/people')
  await page.getByRole('button', { name: 'Take off the filter Department: Audio' }).click()
  await page.getByRole('region', { name: 'People' }).getByRole('link', { name: /^Fionn Gallagher/ }).click()
  // No tab holding only "your role doesn't see it" (audit, 5 November 2026, finding 94).
  await expect(page.getByRole('tab', { name: /^Details/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^Their link/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Open their page' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New link' })).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText('€')

  // Timesheets: what came in, with the amounts said to be hidden, and the deciding left to the office. Nothing of it is counted
  // on Crew's row, as on Home: it's the office's to decide (Move 3 of the sweep of 6 November 2026).
  await page.goto('/#crew/timesheets')
  await expect(page.getByText("Your role doesn't see crew rates, so the amounts are hidden")).toBeVisible()
  await expect(page.getByRole('group', { name: 'To approve' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Waiting on the office' }).getByRole('heading')).toHaveText(/^Waiting on the office \(\d+\)$/)
  await expect(page.getByRole('navigation', { name: 'Crew pages' }).getByRole('link', { name: /^Timesheets/ })).toHaveText('Timesheets')
  await expect(page.locator('main')).not.toContainText('NaN')
  await expect(page.locator('main')).not.toContainText('€')

  // You says what this role reads.
  await page.goto('/#me')
  await expect(page.getByText("You don't see crew rates or timesheet amounts, other than your own, and the private links of people in your department.")).toBeVisible()
})

test("a head's own department is where Stock's lists and counts and the job's crew start, and a quote they aren't sent is with the office", async ({ browser, request }) => {
  // LX's own kit beside the made-up company's Audio speaker in for repair: a moving head that failed its PAT, with a repair open.
  const at = new Date().toISOString()
  const setUp: [string, Record<string, unknown>][] = [
    ['model.create', { id: 'lens-spot', name: 'Lens Spot', department: 'lighting', category: 'Moving heads', tracking: 'serialised', isCase: false, valueCents: null, notes: '', patMonths: 12, liftingMonths: null }],
    ['asset.add', { id: 'lens-spot-1', modelId: 'lens-spot', number: null, serial: '', placeId: null, caseId: null, notes: '', fromCount: false }],
    ['inspection.record', { id: 'lens-pat', assetId: 'lens-spot-1', kind: 'pat', passed: false, at, by: 'Orla Hayes', note: '' }],
    ['fault.report', { id: 'lens-fault', kind: 'damaged', assetId: 'lens-spot-1', modelId: 'lens-spot', qty: 1, projectId: null, usable: true, note: 'Gobo wheel sticks', at }],
  ]
  const res = await request.post('/api/sync/push', { data: { clientId: 'e2e-lens', mutations: setUp.map(([name, args], i) => ({ id: `e2e-lens-${i}`, name, args, createdAt: at })) } })
  expect((await res.json()).results.map((r: { status: string }) => r.status)).toEqual(['applied', 'applied', 'applied', 'applied'])

  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await asHeadOf(page, 'LX')
  await page.goto('/')
  await page.getByRole('button', { name: /^Head of department/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()

  // Stock's row counts LX's kit, as the lists it opens start on it: one of the company's two repairs, and the test it failed.
  await page.goto('/#stock/repairs')
  const row = page.getByRole('navigation', { name: 'Stock pages' })
  const rowRepairs = row.getByRole('link', { name: /^Repairs/ })
  await expect(rowRepairs).toHaveText('Repairs 1')
  await expect(row.getByRole('link', { name: /^Testing/ })).toHaveText('Testing 1')
  const repairs = page.getByRole('region', { name: 'Repairs open' })
  const repairsHead = repairs.getByRole('heading', { name: /^Repairs open/ })
  await expect(repairsHead).toHaveText('Repairs open (1)')
  await expect(repairs).toContainText('Showing LX (Lighting) only.')
  await expect(repairs).toContainText('Lens Spot')
  await expect(repairs).not.toContainText('d&b Y10P')
  // One tap to the rest, which Back from one of them finds as it was left (navigation.md).
  await repairs.getByRole('button', { name: 'Show all departments' }).click()
  await expect(repairsHead).toHaveText('Repairs open (2)')
  await repairs.getByRole('link', { name: /d&b Y10P/ }).click()
  await expect(page).toHaveURL(/#stock\/item\//)
  await page.goBack()
  await expect(repairsHead).toHaveText('Repairs open (2)')
  await expect(repairs).not.toContainText('Showing LX (Lighting) only.')

  // Kit short starts on LX's kit too: the moving heads the arts week would be short of, not Audio's speakers.
  await row.getByRole('link', { name: 'Catalogue' }).click()
  const short = page.getByRole('region', { name: 'Kit short' })
  await expect(short).toContainText('Showing LX (Lighting) only.')
  await expect(short).toContainText('Robe Spiider')
  await expect(short).not.toContainText('d&b Y10P')
  // Opened again from the row, Repairs starts on LX's once more: the row's number is the list's as it opens.
  await rowRepairs.click()
  await expect(rowRepairs).toHaveText('Repairs 1')
  await expect(repairsHead).toHaveText('Repairs open (1)')
  await expect(repairs).toContainText('Showing LX (Lighting) only.')

  // So does Testing.
  await row.getByRole('link', { name: /^Testing/ }).click()
  const due = page.getByRole('region', { name: 'Inspections due' })
  await expect(due).toContainText('Showing LX (Lighting) only.')
  await expect(due.getByRole('heading', { name: /^Can't go out/ })).toHaveText("Can't go out (1)")

  // A count on Home opens the list it counted: LX's for Home for LX, everyone's for Home for the warehouse, each headed with the
  // tile's own number.
  await page.goto('/#home')
  const showFor = page.getByRole('group', { name: 'Show for' })
  await showFor.getByRole('button', { name: 'Department' }).click()
  // The select, not the persona's "Head of department" link beside the app's name.
  await page.getByRole('combobox', { name: /^Department/ }).selectOption('LX')
  const tile = page.locator('.standing').getByRole('link', { name: /repairs? open/ })
  await expect(tile.locator('b')).toHaveText('1')
  await tile.click()
  await expect(repairsHead).toHaveText('Repairs open (1)')
  await expect(repairs).toContainText('Showing LX (Lighting) only.')
  await page.goto('/#home')
  await showFor.getByRole('button', { name: 'Warehouse' }).click()
  await expect(tile.locator('b')).toHaveText('2')
  await tile.click()
  await expect(repairsHead).toHaveText('Repairs open (2)')
  await expect(repairs).not.toContainText('Showing LX (Lighting) only.')
  await page.goto('/#home')
  const shortTile = page.locator('.standing').getByRole('link', { name: /kit lines? short for confirmed jobs?/ })
  const shortCount = (await shortTile.locator('b').textContent())!
  await shortTile.click()
  await expect(short.getByRole('heading', { name: /^For confirmed jobs in the next fortnight/ })).toHaveText(`For confirmed jobs in the next fortnight (${shortCount})`)
  await expect(short).not.toContainText('Showing LX (Lighting) only.')
  // And the company's on Crew: every department's calls short of crew, though Crew starts on LX's from the tab.
  await page.goto('/#home')
  await showFor.getByRole('button', { name: 'Company', exact: true }).click()
  const crewTile = page.locator('.standing').getByRole('link', { name: /calls? still needs? crew/ })
  const crewCount = (await crewTile.locator('b').textContent())!
  await crewTile.click()
  await expect(page.getByRole('heading', { name: `Still needs crew (${crewCount})`, exact: true })).toBeVisible()
  await expect(page.getByLabel('Calls for department')).toHaveValue('')

  // A quote this role isn't sent is with the office, never missing, on the Jobs list and the Board alike.
  await page.goto('/#jobs')
  // The list starts on LX (Move 9 of the sweep of 6 November 2026); the wedding is everyone's.
  await page.getByRole('button', { name: 'Take off the filter Department: LX' }).click()
  // The wedding is three weeks off, past the fortnight the list starts on.
  await page.getByRole('button', { name: /^Show all \d+ coming up$/ }).click()
  await expect(page.getByRole('link', { name: /Clonmore Wedding/ }).first()).toContainText('Quote: with the office')
  await expect(page.locator('main')).not.toContainText(/No quote yet|A draft is started/)
  await page.goto('/#jobs/board')
  await expect(page.locator('.board-card', { hasText: 'Clonmore Wedding' })).toContainText('Quote: with the office')
  await expect(page.locator('main')).not.toContainText(/No quote yet|A draft is started/)

  // The job's head says LX's own crew beside the whole job's, and its Crew tab starts on LX's calls, each saying its phase.
  await page.goto('/#jobs')
  await page.getByRole('link', { name: /Harbour Lights Festival/ }).first().click()
  const crewFact = page.locator('.job-facts > div', { has: page.locator('dt', { hasText: /^Crew$/ }) }).locator('dd')
  // Fionn asked for more for the one LX op, so none of LX's is booked; five of the job's ten are.
  await expect(crewFact).toHaveText('LX 0 of 1 · all 5 of 10')
  await page.getByRole('tab', { name: /^Crew/ }).click()
  const theirs = page.getByRole('region', { name: 'LX crew' })
  await expect(page.locator('#job-part .card').first()).toHaveAttribute('aria-label', 'LX crew')
  await expect(theirs).toContainText('LX op · Show')
  await expect(page.getByRole('article', { name: 'Show' })).not.toContainText('LX op')
  await expect(page.locator('main')).not.toContainText('€')
})

test("a head whose department has no kit short is told so quietly, with the way to everyone's", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await asHeadOf(page, 'Staging')
  await page.goto('/')
  await page.getByRole('button', { name: /^Head of department/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
  await page.goto('/#stock')
  const short = page.getByRole('region', { name: 'Kit short' })
  await expect(short).toContainText('Showing Staging only.')
  await expect(short).toContainText("None of this department's kit is short.")
  // Healthy is quiet: neither its edge nor its heading takes the colour that asks for a look until there's something to look at.
  const warn = await short.evaluate((card) => {
    const probe = card.appendChild(document.createElement('span'))
    probe.style.color = 'var(--warn)'
    const colour = getComputedStyle(probe).color
    probe.remove()
    return colour
  })
  const colours = () => short.evaluate((card) => [getComputedStyle(card).borderTopColor, getComputedStyle(card.querySelector('h2')!).color])
  expect(await colours()).not.toContain(warn)
  await short.getByRole('button', { name: 'Show all departments' }).click()
  await expect(short).toContainText('d&b Y10P')
  expect(await colours()).toEqual([warn, warn])
})

test('Home for a department counts the leave waiting on the approver looking, whoever asked for it', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew/leave')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByLabel('Your name').selectOption({ label: 'Aoife Brennan' })
  await page.getByRole('button', { name: "That's me" }).click()
  const queue = page.getByRole('region', { name: 'To approve' })
  await expect(queue.getByRole('heading', { level: 2 })).toHaveText('To approve (2)')

  // Cian, in Transport, waits on Aoife, an approver (ADR 0024): on Home for LX it's still hers to decide, and its count opens
  // the whole queue rather than LX's people's (Move 3 of the sweep of 6 November 2026).
  await page.goto('/#home')
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Department' }).click()
  await page.getByLabel('Department').selectOption('LX')
  const tile = page.locator('.standing').getByRole('link', { name: /leave requests? waiting on you/ })
  await expect(tile.locator('b')).toHaveText('2')
  await tile.click()
  await expect(queue.getByRole('heading', { level: 2 })).toHaveText('To approve (2)')
  await expect(queue).toContainText('Cian Murphy')
  await expect(page.locator('main')).not.toContainText('Showing LX (Lighting) only.')
})

test("each role meets its own app: a head's Jobs list starts on their department, and someone booked finds theirs first", async ({ browser }) => {
  // A head of LX: the Jobs list opens on LX, said in the filter's chip, with the way to every job (Move 9 of the sweep of 6 November 2026).
  const head = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await asHeadOf(head, 'LX')
  await head.goto('/')
  await head.getByRole('button', { name: /^Head of department/ }).click()
  await expect(head.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
  await head.goto('/#jobs')
  const off = head.getByRole('button', { name: 'Take off the filter Department: LX' })
  await expect(off).toBeVisible()
  await expect(head.locator('.job-row', { hasText: 'Liffey Brands Launch' })).toBeVisible()
  await expect(head.locator('.job-row', { hasText: 'Brightwater Tech Summit' })).toHaveCount(0)
  await off.click()
  await expect(head.locator('.job-row', { hasText: 'Brightwater Tech Summit' })).toBeVisible()

  // Aoife, booked as crew chief on two jobs: "Mine" on Jobs, and the job opens with what she's on.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew/leave')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByLabel('Your name').selectOption({ label: 'Aoife Brennan' })
  await page.getByRole('button', { name: "That's me" }).click()
  await page.goto('/#jobs')
  const mine = page.getByRole('group', { name: 'Whose' }).getByRole('button', { name: /^Mine \(\d+\)$/ })
  await expect(mine).toBeVisible()
  await mine.click()
  await expect(page.locator('.job-row', { hasText: 'Harbour Lights Festival' })).toBeVisible()
  await expect(page.locator('.job-row', { hasText: 'Corrib Arts Week' })).toHaveCount(0)
  await page.locator('.job-row', { hasText: 'Harbour Lights Festival' }).click()
  const you = page.getByRole('region', { name: 'You on this job' })
  await expect(you).toContainText('Crew chief')
  await expect(you).toContainText('call 11:00')
  await expect(you.getByRole('link', { name: 'Call sheet ›' })).toBeVisible()
})
