import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Home and finding your way around (ADR 0033): the bare address opens Home,
 * shown for the company with counts that each open where they're sorted
 * out; it can be shown for a department, the warehouse or me, and the phone
 * remembers which; five places in the bar, History under Admin; and a long
 * screen names its parts at the top, each a tap away. Uses the made-up data
 * (ADR 0019), so it starts fresh before and after: the other tests share
 * this server.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test.beforeAll(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  // Beside the made-up quote sent three days ago, one sent nine days ago for a job in three weeks, with no answer yet: worth a
  // call (ADR 0081), so Home counts it for whoever reads quotes.
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
  const setUp: [string, Record<string, unknown>][] = [
    ['project.create', { id: 'e2e-docklands', name: 'Docklands Awards', clientId: null, venueId: null, status: 'quoted', notes: '' }],
    ['phase.add', { id: 'e2e-docklands-show', projectId: 'e2e-docklands', name: 'Show', start: day(21), end: day(21), venueId: null, notes: '' }],
    [
      'quote.save',
      {
        id: 'e2e-docklands-quote',
        projectId: 'e2e-docklands',
        lines: [{ id: 'e2e-docklands-pa', kind: 'other', what: 'PA for the awards', ref: null, group: 'Other', qty: 1, days: 1, unitCents: 90_000, vat: '23' }],
        discountPct: 0,
        notes: '',
      },
    ],
    ['quote.sent', { id: 'e2e-docklands-quote', on: day(-9) }],
  ]
  const at = new Date().toISOString()
  const res = await request.post('/api/sync/push', { data: { clientId: 'e2e-home', mutations: setUp.map(([name, args], i) => ({ id: `e2e-home-${i}`, name, args, createdAt: at })) } })
  expect((await res.json()).results.map((r: { status: string }) => r.status)).toEqual(['applied', 'applied', 'applied', 'applied'])
})

test.afterAll(async ({ request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

/** The demo copy, seen as one of its personas: this server has no passcode, so the test answers for it as a demo copy would. */
async function as(page: Page, role: 'director' | 'office' | 'head', persona: RegExp) {
  await page.route('**/api/me', (route) => route.fulfill({ json: { auth: 'passcode', role } }))
  await page.route('**/api/auth/preview', (route) => route.fulfill({ json: { role } }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'See it as…' })).toBeVisible()
  await page.getByRole('button', { name: persona }).click()
}

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `home-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `home-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

/** Whether what was landed on is at the top, just under the bar, or as near it as the page goes when it ends first. */
const landedOn = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const bar = document.querySelector('main .top')!.getBoundingClientRect().bottom
    const top = document.querySelector(selector)!.getBoundingClientRect().top
    const end = innerHeight + scrollY >= document.documentElement.scrollHeight - 2
    return top >= bar && (top - bar < 24 || end) && scrollY > 0
  }, selector)

test('Home is where the app opens, and says how things stand for whoever is looking', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
  await expect(page).toHaveTitle('Home · Session Hire')

  const bar = page.getByRole('navigation', { name: 'Areas' })
  await expect(bar.getByRole('link')).toHaveText(['Home', 'Jobs', 'Stock', /^Crew/, 'Menu'])
  await expect(bar.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')

  // The company: today's job, and counts that aren't nothing.
  const show = page.getByRole('group', { name: 'Show for' })
  await expect(show.getByRole('button', { name: 'Company' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Today (1)' })).toBeVisible()
  const attention = page.locator('.standing')
  await expect(attention.getByRole('link', { name: /answers to check/ })).toBeVisible()
  await expect(attention.getByRole('link', { name: /kit lines short/ })).toBeVisible()

  // A count opens the screen that sorts it out, at the part it counted (audit, 20 October 2026, finding 4).
  await attention.getByRole('link', { name: /answers to check/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Calls' })).toBeVisible()
  await expect(bar.getByRole('link', { name: /^Crew/ })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: /^Answers to check/ })).toBeFocused()
  await bar.getByRole('link', { name: 'Home' }).click()
  await attention.getByRole('link', { name: /kit lines short/ }).click()
  // The part it counted, under Kit short: the confirmed jobs' lines in the next fortnight, with the same number.
  const short = page.getByRole('heading', { name: /^For confirmed jobs in the next fortnight \(\d+\)$/ })
  await expect(short).toBeFocused()
  await expect(short).toBeInViewport()
  // Back to Home, and Back again comes to the part as it was left.
  await page.goBack()
  await expect(attention.getByRole('link', { name: /kit lines short/ })).toBeVisible()
  await page.goForward()
  await expect(short).toBeInViewport()

  // The warehouse: what's going out, opening its pick list. Remembered on this phone.
  await bar.getByRole('link', { name: 'Home' }).click()
  await show.getByRole('button', { name: 'Warehouse' }).click()
  await expect(show.getByRole('button', { name: 'Warehouse' })).toBeFocused()
  const going = page.locator('section', { has: page.getByRole('heading', { name: /^Going out/ }) })
  await expect(going.getByRole('link', { name: /Harbour Lights Festival/ })).toHaveAttribute('href', /#jobs\/.+\/pick$/)
  await page.reload()
  await expect(show.getByRole('button', { name: 'Warehouse' })).toHaveAttribute('aria-pressed', 'true')

  // A department: narrowed to its people and its kit.
  await show.getByRole('button', { name: 'Department' }).click()
  await page.getByLabel('Department').selectOption('Audio')
  await expect(page.getByRole('heading', { name: 'Needs attention in Audio' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Working this week/ })).toBeVisible()
})

test('every count on Home opens the list it counted, headed with the same number, for the company and the warehouse', async ({ browser }) => {
  // Proves (Move 3 of the sweep of 6 November 2026): each count, tapped, lands on the part of the next screen that lists what it
  // counted, focused, and that part's heading says the count's own number; the counts of jobs' tasks open the Jobs list on just
  // those, which says how many it shows. Running late is said in Answers to check's heading, after the answers, and the quotes
  // worth a call in Waiting for an answer's, after how many are waiting (Move 10).
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const show = page.getByRole('group', { name: 'Show for' })
  const tiles = page.locator('.standing a.tile')
  const landed = page.locator('main h2:focus, main h3:focus')
  for (const shownFor of ['Company', 'Warehouse']) {
    await show.getByRole('button', { name: shownFor, exact: true }).click()
    await expect(tiles.first()).toBeVisible()
    const n = await tiles.count()
    for (let i = 0; i < n; i++) {
      const tile = tiles.nth(i)
      const count = (await tile.locator('b').textContent())!
      const label = `${shownFor}: ${count} ${await tile.locator('span').textContent()}`
      const tasks = (await tile.getAttribute('href')) === '#jobs'
      const late = /running late/.test(label)
      const call = /worth a call/.test(label)
      await tile.click()
      if (tasks) await expect(page.locator('.list-count'), label).toHaveText(new RegExp(`^${count} of [\\d,]+ jobs\\.$`))
      else if (late) await expect(landed, label).toHaveText(new RegExp(`^Answers to check \\((?:[\\d,]+\\) · ${count}\\srunning late|${count}\\))$`))
      else if (call) await expect(landed, label).toHaveText(new RegExp(`^Waiting for an answer \\([\\d,]+\\) · ${count}\\sworth a call$`))
      else await expect(landed, label).toHaveText(new RegExp(`\\(${count}\\)(?: · [\\d,]+\\srunning late)?$`))
      if (!tasks) await expect(landed, label).toBeInViewport()
      await page.goBack()
      await expect(tiles.nth(i)).toBeVisible()
    }
  }
})

test("for the office, Home starts with what's waiting on the office, and the quotes worth a call open on Quotes", async ({ browser }) => {
  // Proves (Move 10 of the sweep of 6 November 2026): the Company view orders its counts for whoever is looking. For the office,
  // what's waiting on them comes first, in the order they work through it, under words that say so, and the warehouse's and the
  // heads' counts are the housekeeping under it; the quotes worth a call, offered to whoever reads quotes, are amber as their
  // rows are and open Quotes on Waiting for an answer, focused, its heading saying the same number, those quotes first.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await as(page, 'office', /^Office and production/)
  await expect(page.getByRole('heading', { level: 1, name: 'Calls' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Company' })).toHaveAttribute('aria-pressed', 'true')

  const attention = page.locator('.standing')
  await expect(attention.getByRole('heading', { level: 3 })).toHaveText(['Waiting on the office', 'Housekeeping'])
  await expect(attention.locator('.hint')).toHaveText("What's waiting on the office first, then the housekeeping. Each goes once it's sorted.")
  const office = [/running late/, /answers? to check/, /calls? still needs? crew/, /timesheets? to approve/, /quotes? worth a call/, /dates passed with no answer/, /documents? running out/]
  const ofOffice = (label: string) => office.findIndex((words) => words.test(label))
  const first = await attention.locator('.tiles:not(.housekeeping) a.tile span').allTextContents()
  const order = first.map(ofOffice)
  expect(order, first.join(', ')).not.toContain(-1)
  expect(order, first.join(', ')).toEqual([...order].sort((a, b) => a - b))
  expect(order, first.join(', ')).toEqual(expect.arrayContaining([1, 4]))
  // None of the office's own is left under the housekeeping, where what stops the next fortnight's work for the warehouse and
  // the heads goes for the office.
  const rest = await attention.locator('.tiles.housekeeping a.tile span').allTextContents()
  expect(rest.map(ofOffice), rest.join(', ')).toEqual(rest.map(() => -1))
  await expect(attention.locator('.tiles.housekeeping').getByRole('link', { name: /kit lines? short/ })).toBeVisible()

  const quotes = attention.getByRole('link', { name: /quotes? worth a call/ })
  await expect(quotes).toHaveClass(/\bwarn\b/)
  const count = (await quotes.locator('b').textContent())!
  await quotes.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Quotes' })).toBeVisible()
  const follow = page.getByRole('region', { name: 'To follow up' })
  const heading = page.getByRole('heading', { name: /^Waiting for an answer/ })
  const waiting = follow.locator(heading)
  await expect(waiting).toBeFocused()
  await expect(waiting).toBeInViewport()
  await expect(waiting).toHaveText(new RegExp(`^Waiting for an answer \\(\\d+\\) · ${count}\\sworth a call$`))
  // The group under that heading: `has` looks inside each group, so the heading is found from the page, not from the region.
  const rows = follow.locator('.follow-group', { has: heading }).getByRole('listitem')
  await expect(rows.first()).toContainText('Docklands Awards')
  await expect(rows.locator('.warn')).toHaveCount(Number(count))
  await expect(rows.locator('.warn').first()).toHaveText(/^Sent \d+ days ago: worth a call$/)

  // Notifications lists only those quotes, under the heading as it was: no count lands there, so it has no number to say.
  await page.goto('/#notifications')
  const chase = page.getByRole('region', { name: 'Quotes to follow up', exact: true })
  await expect(chase.getByRole('heading', { name: /^Waiting for an answer/ })).toHaveText('Waiting for an answer')
  await expect(chase.locator('.follow-group', { has: heading }).getByRole('listitem')).toHaveCount(Number(count))
})

test("a director's Home keeps what stops the next fortnight first, with the quotes worth a call among the housekeeping", async ({ browser }) => {
  // Proves (Move 10 of the sweep of 6 November 2026): only the office's order changed. A director's Company view is as it
  // was, and the quotes worth a call, a count for whoever reads quotes, are offered to them too, amber, with the housekeeping.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await as(page, 'director', /^Director/)
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Company' })).toHaveAttribute('aria-pressed', 'true')
  const attention = page.locator('.standing')
  await expect(attention.getByRole('heading', { level: 3 })).toHaveText(['The next fortnight', 'Housekeeping'])
  await expect(attention.locator('.tiles:not(.housekeeping)').getByRole('link', { name: /kit lines? short/ })).toBeVisible()
  const housekeeping = attention.locator('.tiles.housekeeping')
  await expect(housekeeping.getByRole('link', { name: /answers? to check/ })).toBeVisible()
  await expect(housekeeping.getByRole('link', { name: /quotes? worth a call/ })).toHaveClass(/\bwarn\b/)
})

test('a head of department is not offered the quotes worth a call, a count for whoever reads quotes', async ({ browser }) => {
  // Proves (ADR 0034 and 0042): a count is offered only to a role that can act on it. This server isn't told the persona, so
  // the device holds the quotes as a director's would: the app's own check keeps the count from a head while one is due.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await as(page, 'head', /^Head of department/)
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Company' }).click()
  const attention = page.locator('.standing')
  await expect(attention.getByRole('heading', { level: 3 })).toHaveText(['The next fortnight', 'Housekeeping'])
  await expect(attention.getByRole('link', { name: /answers? to check/ })).toBeVisible()
  await expect(attention.getByRole('link', { name: /worth a call/ })).toHaveCount(0)
})

test('the Menu names every place, and Admin, History and You keep its tab with the way back', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#home')
  const bar = page.getByRole('navigation', { name: 'Areas' })
  await bar.getByRole('link', { name: 'Menu' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()
  const places = page.getByRole('navigation', { name: 'Every place' })
  for (const group of ['Jobs', 'Stock', 'Crew', 'Company', 'You']) await expect(places.getByRole('group', { name: group })).toBeVisible()
  await expect(places.getByRole('link', { name: /^Week and month/ })).toHaveAttribute('href', '#jobs/plan')
  // Home too, whose line says its counts come in the order of whoever is looking (Move 10 of the sweep of 6 November 2026).
  await expect(places.getByRole('link', { name: /^Home/ })).toHaveAttribute('href', '#home')
  await expect(places.getByRole('link', { name: /^Home/ })).toContainText('How things stand, its counts ordered for whoever is looking')

  for (const [link, title] of [
    [/^History/, 'History'],
    [/^Admin/, 'Admin'],
    [/^You/, 'You'],
  ] as const) {
    await places.getByRole('link', { name: link }).click()
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(bar.getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('link', { name: '‹ Menu' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()
  }
})

test('a long screen names its parts on them, and a tap goes to one', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const parts = page.getByRole('navigation', { name: 'On this screen' })
  // Under the screen's title, out of the bar, and straight before the first part, so it reads as the page's contents.
  await expect(page.locator('header.top').getByRole('navigation', { name: 'On this screen' })).toHaveCount(0)
  expect(await parts.evaluate((nav) => nav.nextElementSibling?.querySelector('h2')?.textContent)).toMatch(/^Answers to check/)
  const title = (await page.getByRole('heading', { level: 1, name: 'Calls' }).boundingBox())!
  expect((await parts.boundingBox())!.y).toBeGreaterThanOrEqual(title.y + title.height)
  await parts.getByRole('button', { name: 'Coming up' }).click()
  const lists = page.getByRole('heading', { name: 'Coming up', exact: true })
  await expect(lists).toBeFocused()
  await expect(lists).toBeInViewport()
  await expect(parts.getByRole('button', { name: 'Coming up' })).toHaveAttribute('aria-current', 'location')
  // Scrolled to, a part clears the bar and the strip, which stays straight under the bar.
  const [bar, strip, heading] = await Promise.all([page.locator('header.top'), parts, lists].map(async (l) => (await l.boundingBox())!))
  expect(Math.round(strip!.y)).toBe(Math.round(bar!.y + bar!.height))
  expect(heading!.y).toBeGreaterThanOrEqual(strip!.y + strip!.height)
  // A heading's count is the part's count.
  await expect(parts.getByRole('button', { name: /^Answers to check/ }).locator('.count')).toHaveText(/^\d+$/)
})

test('Home draws the weeks, days and months ahead as charts, each column said in words (ADR 0054)', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Company', exact: true }).click()

  // Crew: today first, then a finger on another day says that day's crew in the line above.
  const crew = page.locator('section', { has: page.getByRole('heading', { name: 'Crew, the next fortnight' }) })
  const days = crew.getByRole('group', { name: 'Crew, the next fortnight' }).getByRole('button')
  // A week at a time on a phone, each column a finger wide, the other week behind a tap (audit, 20 October 2026, finding 58).
  await expect(days).toHaveCount(7)
  expect((await days.first().boundingBox())!.width).toBeGreaterThanOrEqual(40)
  await expect(days.first()).toHaveAttribute('aria-pressed', 'true')
  await expect(crew.locator('.chart-readout')).toHaveText(/^Today: /)
  await days.nth(3).click()
  await expect(days.nth(3)).toHaveAttribute('aria-pressed', 'true')
  await expect(crew.locator('.chart-readout')).toHaveText(/still needed/)
  await expect(crew.getByRole('listitem')).toHaveText(['booked', 'waiting to confirm', 'still needed'])
  // The column being read is marked as the part of a page in view is, by a 2px bar in the ink under it, never by the wash of a pointer
  // resting there; settled and not yet are the design system's chart marks (UX sweep, 6 November 2026, move 2).
  const marked = (col: Element) => {
    const bar = getComputedStyle(col, '::after')
    return { wash: getComputedStyle(col).backgroundColor, bar: bar.content === 'none' ? null : bar.height, inInk: bar.backgroundColor === getComputedStyle(document.body).color }
  }
  expect(await days.nth(3).evaluate(marked)).toEqual({ wash: 'rgba(0, 0, 0, 0)', bar: '2px', inInk: true })
  expect((await days.nth(2).evaluate(marked)).bar).toBeNull()
  for (const [part, role] of [
    ['settled', '--ds-chart-mark'],
    ['pending', '--ds-chart-pending'],
  ] as const) {
    const [drawn, wanted] = await crew.locator(`.chart-swatch.${part}`).evaluate((swatch, role) => {
      const probe = document.createElement('i')
      probe.style.backgroundColor = `var(${role})`
      swatch.after(probe)
      const out = [getComputedStyle(swatch).backgroundColor, getComputedStyle(probe).backgroundColor]
      probe.remove()
      return out
    }, role)
    expect(drawn, part).toBe(wanted)
  }

  // One stop for the keyboard; the arrows move along.
  await days.nth(3).focus()
  await page.keyboard.press('ArrowRight')
  await expect(days.nth(4)).toBeFocused()
  await expect(days.nth(4)).toHaveAttribute('aria-pressed', 'true')
  await expect(days.nth(4)).toHaveAttribute('tabindex', '0')
  await expect(days.nth(3)).toHaveAttribute('tabindex', '-1')
  // Past the week's end the arrow carries on into the second week, which the tap above it shows too.
  const weeks = crew.getByRole('group', { name: 'Which week' })
  await expect(weeks.getByRole('button', { name: 'First week' })).toHaveAttribute('aria-pressed', 'true')
  await days.nth(6).click()
  await page.keyboard.press('ArrowRight')
  await expect(weeks.getByRole('button', { name: 'Second week' })).toHaveAttribute('aria-pressed', 'true')
  await expect(days.first()).toBeFocused()
  await expect(days.first()).toHaveAttribute('aria-pressed', 'true')
  await weeks.getByRole('button', { name: 'First week' }).click()
  await expect(crew.locator('.chart-readout')).toHaveText(/^Today: /)

  await expect(page.getByRole('heading', { name: 'Jobs by week' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The season' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Money' })).toBeVisible()

  // The warehouse: kit booked out each day.
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Warehouse' }).click()
  const kit = page.locator('section', { has: page.getByRole('heading', { name: 'Kit booked out, the next fortnight' }) })
  await expect(kit.locator('.chart-col')).toHaveCount(7)
  await expect(kit.getByRole('button', { name: /for confirmed jobs/ }).first()).toBeVisible()
})

test("Home at a phone's size: the soon over the housekeeping, the week ahead a line a job, and Me their own day", async ({ browser }) => {
  // Proves (audit, 20 October 2026, findings 32, 33, 62, 69, 70, 80; 5 November 2026, finding 12): Needs attention puts the next
  // fortnight's work over the housekeeping; the week ahead lists a line a job (two at most, the name always showing), no enquiry,
  // counted as listed, with errands and meetings behind one line; the links under the charts are links a thumb can reach; Working this week leaves the role and job room; and Me shows
  // their own day and the day in lieu waiting beside the leave request.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Company' }).click()

  const attention = page.locator('.standing')
  await expect(attention.getByRole('heading', { level: 3 })).toHaveText(['The next fortnight', 'Housekeeping'])
  // Each a group head over its tiles, in the label capitals every group head inside a card has (UX sweep, 6 November 2026, move 2).
  for (const head of await attention.getByRole('heading', { level: 3 }).all()) {
    await expect(head).toHaveClass(/\bgroup\b/)
    await expect(head).toHaveCSS('font-size', '12px')
    await expect(head).toHaveCSS('text-transform', 'uppercase')
  }
  await expect(attention.locator('.tiles:not(.housekeeping)').getByRole('link', { name: /kit lines? short for confirmed jobs?/ })).toBeVisible()
  await expect(attention.locator('.tiles.housekeeping').getByRole('link', { name: /answers? to check/ })).toBeVisible()

  const week = page.locator('.week-ahead')
  const listed = week.locator(':scope > .job-list > li')
  const count = await listed.count()
  if (count > 0) await expect(week.getByRole('heading', { name: `The week ahead (${count})` })).toBeVisible()
  await expect(week.locator('.job-row:not(.today-row)')).toHaveCount(0)
  await expect(week.getByText('Enquiry', { exact: true })).toHaveCount(0)
  // A job is a line, or two where the date, stage and flags don't fit beside it, and never loses its name to them (audit,
  // 5 November 2026, finding 12: the jobs short of crew or kit showed no name at all on a phone).
  for (const row of await listed.locator('.job-row').all()) {
    expect((await row.boundingBox())!.height).toBeLessThan(80)
    expect((await row.locator(':scope > b').boundingBox())!.width).toBeGreaterThan(120)
  }
  const errands = week.locator('details.errands')
  if (await errands.count()) {
    await expect(errands.locator('summary')).toHaveText(/^(and )?\d+ (errands?|meetings?)/i)
    await errands.locator('summary').click()
    await expect(errands.locator('.job-row').first()).toBeVisible()
  }

  const crewCalls = page.getByRole('link', { name: 'Calls', exact: true })
  await expect(crewCalls).toHaveClass(/\blink\b/)
  expect((await crewCalls.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Department' }).click()
  await page.getByLabel('Department').selectOption('Audio')
  const working = page.locator('.working-row').first()
  await expect(working).toBeVisible()
  expect((await working.locator(":scope > div:not(.side)").boundingBox())!.width).toBeGreaterThan(220)

  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Me', exact: true }).click()
  await page.getByLabel('Your name').selectOption({ label: 'Cian Murphy' })
  await page.getByRole('button', { name: "That's me" }).click()
  await expect(page.getByRole('heading', { name: /^Your day/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Today/ })).toHaveCount(0)
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Your leave' }) })).toContainText('1 request and 1 day in lieu waiting to be approved.')
})

test('Me says Your bookings as their own link does: its glance line, a row each, and an offer that opens the link to answer it', async ({ browser, request }) => {
  // Proves (UX sweep, 6 November 2026, move 6): Home › Me's card and their link's section are both "Your bookings", with the
  // same glance line over them, "1 offer to answer · Next: <job>, <day>, call <time>"; a row is the job, then role · phase ·
  // days · call, then the pill; an offer reads "Answer it on your page ›" and opens their link at its offers, where it's
  // answered (ADR 0034), and a booking opens its job. The heading counts the bookings, as before, and the glance line the
  // offers, so the card's name in the strip at the top fits a phone.
  const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; id: string; data: { name: string; linkToken: string } }[] }
  const aoife = changes.find((c) => c.entity === 'person' && c.data.name === 'Aoife Brennan')!
  const run = Math.random().toString(36).slice(2, 8)
  const day = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10)
  const later = new Date(Date.now() + 41 * 86_400_000).toISOString().slice(0, 10)
  const createdAt = new Date().toISOString()
  const pushed = await request.post('/api/sync/push', {
    data: {
      clientId: `home-me-${run}`,
      mutations: [
        ['call.create', { id: `call-${run}`, project: `Bookings check ${run}`, phase: 'Show', venue: '', role: 'Crew chief', start: day, end: day, callTime: '09:00', needed: 1, dayRateCents: null, details: '', replyBy: null }],
        ['offer.send', { id: `offer-${run}`, callId: `call-${run}`, personId: aoife.id, override: false }],
        // One she has said yes to, which the office hasn't confirmed yet.
        ['call.create', { id: `held-${run}`, project: `Held check ${run}`, phase: 'Build', venue: '', role: 'Crew chief', start: later, end: later, callTime: '08:00', needed: 1, dayRateCents: null, details: '', replyBy: null }],
        ['offer.send', { id: `yes-${run}`, callId: `held-${run}`, personId: aoife.id, override: false }],
        ['offer.respond', { id: `yes-${run}`, answer: 'accept', days: null, note: '' }],
      ].map(([name, args], i) => ({ id: `m-${run}-${i}`, name, args, createdAt })),
    },
  })
  expect((await pushed.json()).results.map((r: { status: string }) => r.status)).toEqual(['applied', 'applied', 'applied', 'applied', 'applied'])

  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Me', exact: true }).click()
  await page.getByLabel('Your name').selectOption({ label: 'Aoife Brennan' })
  await page.getByRole('button', { name: "That's me" }).click()

  // Her bookings, two confirmed with today's shoot first and one accepted, counted in the heading; the offer waiting on her
  // is in the glance line and the list, not the count.
  const card = page.locator('section', { has: page.getByRole('heading', { name: /^Your bookings/ }) })
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('Your bookings (2 booked, 1 to confirm)')
  // Each part's name in the strip fits inside a 390 phone's gutters, so the one in view is read whole.
  const strip = page.getByRole('navigation', { name: 'On this screen' })
  await expect(strip.getByRole('button', { name: 'Your bookings (2 booked, 1 to confirm)' })).toBeVisible()
  for (const part of await strip.getByRole('button').all()) expect((await part.boundingBox())!.width).toBeLessThanOrEqual(358)
  const accepted = card.getByRole('link', { name: new RegExp(`^Held check ${run}`) })
  await expect(accepted.locator('.pill')).toHaveText('To confirm')
  await expect(accepted).not.toContainText('Answer it on your page')
  const glance = card.locator('.my-glance')
  await expect(glance).toHaveText('1 offer to answer · Next: Liffey Brands Shoot, today, call 07:30')
  const link = `${new URL(page.url()).origin}/f/${aoife.data.linkToken}`
  await expect(glance.getByRole('link', { name: '1 offer to answer' })).toHaveAttribute('href', `${link}#offers`)
  await expect(glance.getByRole('link', { name: /^Next: / })).toHaveAttribute('href', /^#jobs\//)
  const shoot = card.getByRole('link', { name: /^Liffey Brands Shoot/ })
  await expect(shoot).toHaveAttribute('href', /^#jobs\//)
  await expect(shoot).toContainText(/^Liffey Brands ShootCrew chief\s·\sShoot\s·\s\w{3}\s\d{1,2}\s\w{3}\s·\scall\s07:30Booked$/)
  const offered = card.getByRole('link', { name: new RegExp(`^Bookings check ${run}`) })
  await expect(offered).toContainText(/Crew chief\s·\sShow\s·\s\w{3}\s\d{1,2}\s\w{3}(\s\d{4})?\s·\scall\s09:00/)
  await expect(offered).toContainText('Offered')
  await expect(offered).toContainText('Answer it on your page ›')
  await expect(offered).toHaveAttribute('href', `${link}#offers`)
  await expect(offered).toHaveAttribute('target', '_blank')
  // A booking is two lines: the job with where it stands at its end, then the facts across the whole row, past the pill.
  // An offer has the way to answer it under them.
  expect((await shoot.boundingBox())!.height).toBeLessThan(80)
  const [job, facts, pill, answer] = await Promise.all(['b', 'p', '.pill', '.answer'].map(async (part) => (await offered.locator(part).boundingBox())!))
  expect(pill!.y).toBeLessThan(job!.y + job!.height)
  expect(facts!.y).toBeGreaterThanOrEqual(job!.y + job!.height)
  expect(facts!.x + facts!.width).toBeGreaterThanOrEqual(pill!.x + pill!.width - 1)
  expect(answer!.y).toBeGreaterThanOrEqual(facts!.y + facts!.height)

  // Opened, it's her link, at the offer, with the same words over it.
  const [hers] = await Promise.all([page.context().waitForEvent('page'), offered.click()])
  await expect(hers).toHaveURL(`${link}#offers`)
  await expect(hers.getByRole('heading', { level: 2, name: 'Your bookings' })).toBeVisible()
  await expect(hers.getByRole('navigation', { name: 'At a glance' })).toHaveText('1 offer to answer · Next: Liffey Brands Shoot, today, call 07:30')
  await expect(hers.getByRole('article').filter({ hasText: `Bookings check ${run}` }).locator('.tag')).toHaveText('Waiting on you')
})

test("a row on Home that names a job's part lands on that part, in view, with its tab open", async ({ browser, request }) => {
  // Proves (UX sweep, 6 November 2026, move 8): an address that names a part of a job lands on it however it's reached, as Next brings
  // its part (ADR 0109). A task from Your tasks comes to the top under the bar with the focus on its name and the part it's about open
  // under it, whichever part was looked at last; a link to the job's crew, as Crew needed and the planner have, brings the tab row up
  // with the focus on Crew, in the app or opened anew in a tab of its own. Neither is a step of its own: Back goes back to where it came
  // from.
  const id = Date.now().toString(36)
  const job = `Landing Gala ${id}`
  const aoife = `Aoife Lands${id}`
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
  await push(request, id, [
    ['person.upsert', { id: `p-${id}`, name: aoife, kind: 'staff', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }],
    ['project.create', { id: `j-${id}`, name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `ph-${id}`, projectId: `j-${id}`, name: 'Show', start: soon, end: soon, venueId: null, notes: '' }],
    [
      'call.create',
      { id: `c-${id}`, projectId: `j-${id}`, phaseId: `ph-${id}`, project: job, phase: 'Show', venue: '', role: 'Audio tech', start: soon, end: soon, callTime: '08:00', needed: 2, dayRateCents: null, details: '', replyBy: null },
    ],
    ['jobStep.set', { projectId: `j-${id}`, step: 'crew', ownerId: `p-${id}`, by: null }],
  ])
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // With sign-in off, the device takes the person's word for who they are.
  await page.goto('/#crew/leave')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByLabel('Your name').selectOption({ label: aoife })
  await page.getByRole('button', { name: "That's me" }).click()
  // Kit was the part last looked at; the task's own part is Crew.
  await page.evaluate(() => localStorage.setItem('sh.jobPart', 'kit'))

  await page.goto('/#home')
  await page.getByRole('region', { name: /^Your tasks/ }).getByRole('link', { name: new RegExp(`^Crew booked ${job}`) }).click()
  await expect(page).toHaveURL(new RegExp(`#jobs/j-${id}/task/crew$`))
  const task = page.getByRole('heading', { level: 3, name: /^Crew booked/ })
  await expect(task).toBeFocused()
  await expect(task).toBeInViewport()
  await expect.poll(() => landedOn(page, '#job-step-open')).toBe(true)
  await expect(page.getByRole('tab', { name: /^Crew/ })).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()

  // A link to the job's crew: the tab row under the bar, Crew open and focused.
  await page.goto(`/#jobs/j-${id}/crew`)
  const crew = page.getByRole('tab', { name: /^Crew/ })
  await expect(crew).toBeFocused()
  await expect(crew).toHaveAttribute('aria-selected', 'true')
  await expect(crew).toBeInViewport()
  await expect.poll(() => landedOn(page, '[role="tablist"]:has(#job-tab-crew)')).toBe(true)
  // The job's own address, naming no part, opens at its top as it always has.
  await page.goto(`/#jobs/j-${id}`)
  await expect(page.getByRole('heading', { level: 1, name: job })).toBeFocused()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await page.goBack()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()

  // The same link opened anew, in a tab of its own, as one from outside the app is: the page starts there, landed on Crew.
  const anew = await page.context().newPage()
  await anew.goto(`/#jobs/j-${id}/crew`)
  const crewAnew = anew.getByRole('tab', { name: /^Crew/ })
  await expect(crewAnew).toBeFocused()
  await expect(crewAnew).toHaveAttribute('aria-selected', 'true')
  await expect(crewAnew).toBeInViewport()
  await expect.poll(() => landedOn(anew, '[role="tablist"]:has(#job-tab-crew)')).toBe(true)
})
