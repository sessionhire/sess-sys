import { expect, test, type Page } from '@playwright/test'
import { iconFrame, icons } from '../shared/src/ds/icons.js'

/**
 * Moving about the screens (audit findings 8, 9 and 10): a new screen
 * opens at its top, or at the part its address names (UX sweep, 6 November
 * 2026, move 8), and Back finds the place it was left at; a button the
 * role can't use isn't drawn, for staff crew and the warehouse on a job
 * and on Crew; and Crew's calls show only those short of people, with the
 * filled ones folded under them. Uses the made-up data (ADR 0019), so it
 * starts fresh before and after: the other tests share this server.
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

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY))
/** Two frames: the Shell settles the page a frame after the new screen is drawn. */
const drawn = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
/**
 * Past the frames Back holds a place for against a screen still filling in (places.ts holds it twelve, until a hand moves the page).
 * A hand's scroll lets go of it at once; one from a script doesn't, so the page is held back where it was if it's moved sooner.
 */
const letGo = (page: Page) =>
  page.evaluate(() => new Promise((done) => {
    let frames = 16
    const next = () => (frames-- > 0 ? requestAnimationFrame(next) : done(undefined))
    requestAnimationFrame(next)
  }))
/** Twenty frames: a page landed on a part is held there for twelve against what is still filling in (places.ts), then left be. */
const settled = (page: Page) =>
  page.evaluate(
    () =>
      new Promise((done) => {
        let frames = 20
        const wait = () => (frames-- > 0 ? requestAnimationFrame(wait) : done(undefined))
        wait()
      })
  )

/** The shared icon set's "next", as a fold's chevron is cut to it: its paths and the stroke they are drawn at. */
const next = { paths: icons.next.map(([, a]) => a.d), stroke: iconFrame['stroke-width'] }

/** The same of an icon written into a stylesheet as a mask, read back from its data address. */
function iconShape(mask: string): typeof next {
  const svg = decodeURIComponent(mask)
  return { paths: [...svg.matchAll(/\sd=['"]([^'"]+)['"]/g)].map((m) => m[1]), stroke: svg.match(/stroke-width=['"]([^'"]+)['"]/)?.[1] }
}

test('a new screen opens at its top, and Back finds the place the last one was left at', async ({ browser }) => {
  // Proves: moving on from a page scrolled down starts the next at its top, by a tab or a link, or at the part a link names; the browser's Back and Forward put each screen back where it was.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew/calls')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(page.getByRole('link', { name: 'Open job' }).first()).toBeVisible()
  const far = await page.evaluate(() => Math.min(700, document.documentElement.scrollHeight - innerHeight))
  expect(far).toBeGreaterThan(200)
  await page.evaluate((y) => scrollTo(0, y), far)
  await drawn(page)
  expect(await scrollY(page)).toBe(far)

  // A tab: Home opens at its top, with its title in view.
  await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Home' }).click()
  await expect(page).toHaveTitle('Home · Session Hire')
  await drawn(page)
  expect(await scrollY(page)).toBe(0)

  // Back: the calls, where they were left.
  await page.goBack()
  await expect(page).toHaveTitle('Calls · Session Hire')
  await expect.poll(() => scrollY(page)).toBe(far)
  await letGo(page)

  // A link from far down the page to a job's crew lands on the part it names, as the job's Next does (UX sweep, 6 November 2026,
  // move 8): the tab row under the bar, the focus on Crew. Back comes back to the link. The link is held by its node: the rows are
  // drawn as they come near the screen (ADR 0050), so once the page moves the last link drawn may be another, further down, and
  // pressing that one would move the page again. The place is kept a frame after the page moves.
  const link = (await page.getByRole('link', { name: 'Open job' }).last().elementHandle())!
  await link.scrollIntoViewIfNeeded()
  await drawn(page)
  const at = await scrollY(page)
  expect(at).toBeGreaterThan(0)
  await link.click()
  const crew = page.getByRole('tab', { name: /^Crew/ })
  await expect(crew).toBeFocused()
  await expect(crew).toHaveAttribute('aria-selected', 'true')
  await expect(crew).toBeInViewport()
  await settled(page)
  const landed = await scrollY(page)
  expect(landed).toBeGreaterThan(0)
  await page.goBack()
  await expect.poll(() => scrollY(page)).toBe(at)
  // And Forward to the job, where it was left.
  await page.goForward()
  await expect.poll(() => scrollY(page)).toBe(landed)
})

test('a long list draws only the rows near the screen, and Back finds a place deep in it', async ({ browser, request }) => {
  // Proves (audit finding 11, ADR 0051): Jobs builds only the rows near the screen, each saying where it is in the whole list for a
  // screen reader, and builds the next ones as the page is scrolled; Back from a job opened deep in the list puts its row back where
  // it was. Some names wrap onto a second line, so the guessed height is wrong for those until they have been drawn.
  const mutations = Array.from({ length: 160 }, (_, i) => {
    const day = new Date(Date.UTC(2031, 0, 1 + i)).toISOString().slice(0, 10)
    const name = i % 5 === 0 ? `Long list job ${i} with a name long enough to wrap onto a second line on a phone` : `Long list job ${i}`
    return [
      { id: `long-${i}-a`, name: 'project.create', args: { id: `long-${i}`, name, clientId: null, venueId: null, status: 'confirmed', notes: '' } },
      { id: `long-${i}-b`, name: 'phase.add', args: { id: `long-${i}-show`, projectId: `long-${i}`, name: 'Show', start: day, end: day, venueId: null, notes: '' } },
    ]
  }).flat()
  const res = await request.post('/api/sync/push', { data: { clientId: 'long-list', mutations: mutations.map((m) => ({ ...m, createdAt: new Date().toISOString() })) } })
  expect((await res.json()).results.every((r: { status: string }) => r.status === 'applied')).toBe(true)

  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#jobs')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const list = page.getByRole('region', { name: 'Jobs' }).getByRole('list')
  // Coming up starts at the next fortnight (audit finding 22); these are in 2031, under Show all, which Back keeps.
  await page.getByRole('button', { name: /^Show all [\d,]+ coming up$/ }).click()
  await expect(list.getByRole('link').first()).toBeVisible()
  await expect(list.getByRole('link', { name: /Long list job 159\b/ })).toHaveCount(0)
  // The week headings are rows of the list too, but not counted among the jobs.
  const jobs = list.locator('li[aria-posinset]')
  const total = Number(await jobs.first().getAttribute('aria-setsize'))
  expect(total).toBeGreaterThanOrEqual(160)
  expect(await list.locator('li').count()).toBeLessThan(60)
  await expect(jobs.first()).toHaveAttribute('aria-posinset', '1')
  await expect(list.locator('li.week-head').first()).toBeVisible()

  // Scrolled by hand to a row far down, which is opened from where it is on the screen.
  const row = list.getByRole('link', { name: /Long list job 140\b/ })
  for (let i = 0; i < 100; i++) {
    // Not built until the page comes near it.
    const at = (await row.count()) ? await row.evaluate((a) => a.getBoundingClientRect().top) : Infinity
    if (at < 500) break
    await page.mouse.wheel(0, Math.min(600, at - 400))
    await drawn(page)
  }
  await page.waitForTimeout(300)
  const top = await row.evaluate((a) => Math.round(a.getBoundingClientRect().top))
  expect(top).toBeGreaterThan(100)
  expect(top).toBeLessThan(700)
  await row.click()
  await expect(page.getByRole('heading', { level: 1, name: /Long list job 140\b/ })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveTitle('Jobs · Session Hire')
  await expect.poll(() => row.evaluate((a) => Math.round(a.getBoundingClientRect().top))).toBe(top)
})

test('Show all on a long catalogue draws only the products near the screen', async ({ browser, request }) => {
  // Proves (audit, 20 October 2026, finding 97): three hundred products under Show all build a few dozen rows, each saying where it
  // is in the whole list, and the ones further down are built as the page comes near them. On a short screen the button is below
  // the fold, and the list opens where it was read rather than carrying the page to its end.
  const mutations = Array.from({ length: 150 }, (_, i) => ({
    id: `long-model-${i}`,
    name: 'model.create',
    args: { id: `long-model-${i}`, name: `Long list product ${String(i).padStart(3, '0')}`, department: 'audio', category: 'Long list', tracking: 'bulk', isCase: false, valueCents: null, notes: '' },
  }))
  const res = await request.post('/api/sync/push', { data: { clientId: 'long-catalogue', mutations: mutations.map((m) => ({ ...m, createdAt: new Date().toISOString() })) } })
  expect((await res.json()).results.every((r: { status: string }) => r.status === 'applied')).toBe(true)

  const page = await (await browser.newContext({ viewport: { width: 390, height: 500 } })).newPage()
  await page.goto('/#stock')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('button', { name: /^Show all [\d,]+ products$/ }).click()
  const list = page.locator('ul.job-list.windowed')
  const rows = list.locator('li[aria-posinset]')
  await expect(rows.first()).toHaveAttribute('aria-posinset', '1')
  expect(Number(await rows.first().getAttribute('aria-setsize'))).toBeGreaterThanOrEqual(150)
  expect(await rows.count()).toBeLessThan(60)

  // The search still finds one anywhere in the list.
  await page.getByLabel('Find').fill('Long list product 149')
  await expect(list.getByRole('link', { name: /Long list product 149/ })).toBeVisible()
})

/** The demo copy, seen as one of its personas: this server has no passcode, so the test answers for it as a demo copy would. */
async function as(page: Page, role: 'crew' | 'head', button: RegExp) {
  await page.route('**/api/me', (route) => route.fulfill({ json: { auth: 'passcode', role } }))
  await page.route('**/api/auth/preview', (route) => route.fulfill({ json: { role } }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'See it as…' })).toBeVisible()
  await page.getByRole('button', { name: button }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
}

async function openJob(page: Page, name: string) {
  await page.goto('/#jobs')
  await page.getByRole('link', { name: new RegExp(name) }).first().click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test('staff crew are offered nothing on a job or on Crew they could only be refused', async ({ browser }) => {
  // Proves: staff crew, who can change only their leave and report faults, see a job's phases, kit and crew with no Change, Add kit, Add phase or Ask for crew, and Crew's calls with nothing to settle or offer and no answers to check, which are the office's (audit finding 34).
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await as(page, 'crew', /^Staff crew/)
  await openJob(page, 'Harbour Lights Festival')
  const main = page.getByRole('main')
  // Nor is the job's one Next button theirs to press: it says whose the task is (audit, 5 November 2026, finding 2).
  const next = page.getByRole('region', { name: 'Next' })
  await expect(next).toContainText(/Nothing (here for you )?to press/)
  await expect(next.getByRole('button')).toHaveCount(0)
  await expect(next.getByRole('link')).toHaveCount(0)
  // Each part of the job in turn, in the order the job goes (ADR 0059, ADR 0140 part 8), and no Quote for a role that doesn't see money.
  await expect(main.getByRole('tab')).toHaveText([/^Crew/, 'Kit', /^Vans/, 'Phases 3', 'Show pack'])
  await main.getByRole('tab', { name: 'Phases 3' }).click()
  await expect(main.getByRole('region', { name: 'Phases' })).toBeVisible()
  // The quote's address, typed or kept from before, says what it refused under a heading of its own (audit, 5 November 2026, finding 87).
  const jobAt = page.url()
  expect(jobAt).toMatch(/#jobs\/[^/]+/)
  await page.goto(jobAt.replace(/#jobs\/([^/]+).*/, '#jobs/$1/quote'))
  // The quote is the job's Quote tab (ADR 0140, part 4): the job opens, saying why there's no quote to see.
  await expect(main.getByRole('region', { name: 'Quote' })).toContainText('Quotes and prices are for the office and directors.')
  await expect(main.getByRole('tab')).toHaveText([/^Crew/, 'Kit', /^Vans/, 'Phases 3', 'Show pack'])
  await page.goto(jobAt)
  for (const part of ['Phases', 'Crew', 'Kit', 'Vans', 'Show pack']) {
    await main.getByRole('tab', { name: new RegExp(`^${part}`) }).click()
    for (const name of ['Change', 'Change details', 'Add phase', 'Add kit', 'Ask for crew', 'Offer…', 'Running late…', 'Book a vehicle'])
      await expect(main.getByRole('button', { name, exact: true }), `${name} on ${part}`).toHaveCount(0)
  }
  await main.getByRole('tab', { name: /^Crew/ }).click()
  // A call opened still says who's on it, without Withdraw, Send, Change or Cancel.
  await main.getByRole('button', { name: /× Rigger/ }).first().click()
  await expect(main.getByRole('link', { name: 'Pádraig Kenny' })).toBeVisible()
  for (const name of ['Withdraw', 'Send', 'Cancel crew call']) await expect(main.getByRole('button', { name, exact: true })).toHaveCount(0)

  await page.goto('/#crew/calls')
  await expect(page.getByRole('heading', { level: 1, name: 'Calls' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Answers to check/ })).toHaveCount(0)
  for (const name of [/^Noted/, /^Confirm$/, /^Release$/, /^Offer…$/, /^Checked:/, /^Not right:/, /^Ask for crew$/]) await expect(main.getByRole('button', { name })).toHaveCount(0)
  // Reporting a fault is still theirs.
  await page.goto('/#stock')
  await page.getByRole('link', { name: /Shure SM58|d&b/ }).first().click()
  await expect(main.getByRole('button', { name: 'Change details' })).toHaveCount(0)
})

test("staff crew are not shown how to do stock work that is the warehouse's or the office's", async ({ browser }) => {
  // Proves: Counting doesn't tell staff to start a count they have no button for, Labels has no Set numbers aside card for them, and
  // bringing in the stock list says it's the office's before a file is chosen, not after the columns are matched (audit, 5 November 2026, finding 74).
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await as(page, 'crew', /^Staff crew/)
  await page.goto('/#stock/count')
  await expect(page.getByRole('main')).toContainText('The warehouse and heads of department do the counts.')
  await expect(page.getByRole('main')).not.toContainText("Start one from a place's page")
  await page.goto('/#stock/labels')
  await expect(page.getByRole('heading', { level: 1, name: 'Labels' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Set numbers aside' })).toHaveCount(0)
  await page.goto('/#stock/import')
  await expect(page.getByRole('main')).toContainText('The office brings the stock list in.')
  await expect(page.getByLabel('Stock list file')).toHaveCount(0)
})

test('the warehouse can add kit to a job, but not change the job itself', async ({ browser }) => {
  // Proves: the warehouse, held to a head of department's role since ADR 0051, are offered Add kit and the kit lines' Change, and nothing of the job's own.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await as(page, 'head', /^Warehouse/)
  await openJob(page, 'Harbour Lights Festival')
  const main = page.getByRole('main')
  await main.getByRole('tab', { name: 'Kit', exact: true }).click()
  await expect(main.getByRole('button', { name: 'Add kit' })).toBeVisible()
  const kit = main.getByRole('region', { name: 'Kit' })
  await expect(kit.getByRole('button', { name: 'Change', exact: true }).first()).toBeVisible()
  await main.getByRole('tab', { name: /^Phases/ }).click()
  const phases = main.getByRole('region', { name: 'Phases' })
  for (const name of ['Change', 'Add phase']) await expect(phases.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(main.getByRole('button', { name: 'Change details', exact: true })).toHaveCount(0)
})

test('Crew needed lists only the calls short of people, with the filled ones folded under them', async ({ browser }) => {
  // Proves: at rest every call shown is short; "Show N filled calls" says how many are folded and opens them; a department with none short says so plainly.
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew/calls')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const needed = page.locator('section.card', { has: page.getByRole('heading', { name: 'Coming up' }) })
  const fold = needed.locator('details.filled-calls')
  const summary = fold.locator('summary')
  await expect(summary).toHaveText(/^Show \d+ filled calls?$/)
  const n = Number((await summary.textContent())!.match(/\d+/)![0])
  // At rest: the calls short of people, and a filled one only with something on it to act on today; the folded ones are all filled.
  const inView = needed.locator(':scope > .call-groups > .call-group article.call')
  const onlyShortOrToActOn = async (shortOnes: boolean) => {
    for (const call of await inView.all()) {
      const filled = /^Filled/.test((await call.locator(':scope > .pill').textContent()) ?? '')
      if (!filled && shortOnes) continue
      expect(filled, `${await call.getAttribute('aria-label')} is filled`).toBe(true)
      expect(await call.locator('.late-line, .warn-line, .late-open').count(), `${await call.getAttribute('aria-label')} has something to act on`).toBeGreaterThan(0)
    }
  }
  expect(await inView.count()).toBeGreaterThan(0)
  await onlyShortOrToActOn(true)
  // Folded, the filled calls aren't built at all; opened, they are, in a window like the rest (ADR 0051).
  await expect(fold.locator('article.call')).toHaveCount(0)
  await summary.click()
  await expect(fold.locator('article.call').first()).toBeVisible()
  expect(await fold.locator('article.call').count()).toBeLessThanOrEqual(n)
  for (const t of await fold.locator('.pill').allTextContents()) expect(t).toMatch(/^Filled/)

  // A department whose calls are all filled says there are none short, and still has them a tap away.
  const filter = page.getByLabel('Calls for department')
  const options = await filter.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean))
  let found = false
  for (const value of options) {
    await filter.selectOption(value)
    if (await needed.getByText(/are short of people: every one still to come is filled\.$/).count()) {
      found = true
      await onlyShortOrToActOn(false)
      await expect(summary).toBeVisible()
      break
    }
  }
  expect(found, 'a department with every call filled').toBe(true)
})

test('Crew needed shows the next fortnight at rest, and every call still to come a tap away, kept while the tab is open', async ({ browser, request }) => {
  // Proves: at rest the short calls are the next fortnight's; "Show all N calls still needing something" says how many and shows them all; it stays
  // shown after going to another Crew page and back (audit, 20 October 2026, finding 23).
  const later = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const res = await request.post('/api/sync/push', {
    data: {
      clientId: 'screens-fortnight',
      mutations: [
        {
          id: `fortnight-${Date.now()}`,
          name: 'call.create',
          args: { id: `fortnight-call-${Date.now()}`, project: 'Far Off Fest', phase: '', venue: '', role: 'Rigger', start: later, end: later, callTime: null, needed: 2, dayRateCents: null, details: '', replyBy: null },
          createdAt: new Date().toISOString(),
        },
      ],
    },
  })
  expect(((await res.json()) as { results: { status: string }[] }).results[0]!.status).toBe('applied')
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#crew/calls')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const needed = page.locator('section.card', { has: page.getByRole('heading', { name: 'Coming up' }) })
  const shortCalls = needed.locator(':scope > .call-groups > .call-group article.call').filter({ hasNot: page.locator(':scope > .pill', { hasText: /^Filled/ }) })
  const showAll = needed.getByRole('button', { name: /^Show all \d+ calls? still needing something$/ })
  await expect(showAll).toBeVisible()
  const total = Number((await showAll.textContent())!.match(/\d+/)![0])
  const atRest = await shortCalls.count()
  expect(atRest).toBeLessThan(total)
  await expect(needed.locator('.call-group', { hasText: 'Far Off Fest' })).toHaveCount(0)
  await showAll.click()
  await expect(showAll).toHaveCount(0)
  // The list is drawn in a window, so not every call is built at once: more than at rest is enough to say they're there.
  await expect.poll(() => shortCalls.count()).toBeGreaterThan(atRest)
  await page.getByRole('navigation', { name: 'Crew pages' }).getByRole('link', { name: /^People/ }).click()
  await page.getByRole('navigation', { name: 'Crew pages' }).getByRole('link', { name: /^Calls/ }).click()
  await expect(needed.getByRole('heading', { name: 'Coming up' })).toBeVisible()
  await expect(showAll).toHaveCount(0)
})

test("Money's By month and Margin by job read on a phone, every figure under its column's name and nothing off the right edge", async ({ browser }) => {
  // Proves (UX sweep, 6 November 2026, director-f1): the phone rule that folds a sent quote's middle columns is the quote's own, so
  // Money's two tables keep every figure; on a phone each month and each job is a row with its figures under its name, each saying
  // which it is, with nothing to scroll sideways in the page or in the card; and a desk keeps the table with its heads.
  const tables = {
    'By month': ['Quoted', 'Confirmed', 'Invoiced', 'Freelancers', 'Lost'],
    'Margin by job': ['Quoted', 'Freelancers', 'After freelancers'],
  }
  // Each on its own part of Money (review of 11 November 2026, finding 20).
  const at: Record<string, string> = { 'By month': '/#jobs/money', 'Margin by job': '/#jobs/money/margins' }
  const figures = (page: Page, name: string) =>
    page
      .getByRole('region', { name })
      .locator('tbody tr:not(.group)')
      .evaluateAll((rows) =>
        rows.map((row) =>
          [...row.querySelectorAll('td')].map((td) => {
            const box = td.getBoundingClientRect()
            const said = getComputedStyle(td, '::before').content
            return { label: td.dataset.label, said: said !== 'none' && said !== 'normal', left: box.left, right: box.right, shown: box.width > 0 && box.height > 0 }
          })
        )
      )
  const phone = await (await browser.newContext({ viewport: phoneSize })).newPage()
  for (const [name, columns] of Object.entries(tables)) {
    await phone.goto(at[name]!)
    await expect(phone.getByRole('status')).toHaveText('Up to date')
    const region = phone.getByRole('region', { name })
    await expect(region.locator('tbody td').first()).toBeVisible()
    await expect(region.locator('thead')).toBeHidden()
    const rows = await figures(phone, name)
    expect(rows.length, name).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.map((c) => c.label)).toEqual(columns)
      for (const c of row) {
        expect(c.shown && c.said, `${name}: ${c.label} is shown and says which it is`).toBe(true)
        expect(c.left, `${name}: ${c.label}`).toBeGreaterThanOrEqual(0)
        expect(c.right, `${name}: ${c.label}`).toBeLessThanOrEqual(phoneSize.width)
      }
    }
    expect(await region.locator('.quote-table-wrap').evaluate((wrap) => wrap.scrollWidth - wrap.clientWidth), `${name} scrolls sideways`).toBeLessThanOrEqual(0)
  }
  expect(await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)

  const desk = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  for (const [name, columns] of Object.entries(tables)) {
    await desk.goto(at[name]!)
    await expect(desk.getByRole('status')).toHaveText('Up to date')
    const head = desk.getByRole('region', { name }).locator('thead th')
    await expect(head).toHaveText([name === 'By month' ? 'Month' : 'Job', ...columns])
    await expect(head.first()).toBeVisible()
    for (const row of await figures(desk, name)) for (const c of row) expect(c.said, `${name}: ${c.label} on a desk`).toBe(false)
  }
})

test('inside a card a head is a group or a section, a boxed row has one shape, and every fold opens the same way', async ({ browser }) => {
  // Proves (UX sweep, 6 November 2026, move 2): across Home, Jobs, a job's kit, Quotes, Money, Stock, Repairs, Calls and Timesheets, a
  // head over a run of rows is a group head (12px tracked capitals in the muted ink, with no box of its own) and any other head inside a
  // card is a section at 16px in sentence case, but an open task's name at 20px (ADR 0073); a row drawn as a box inside a card has the
  // one inset and corner; and every fold is a thumb-high line in the ink at 600 behind the one chevron, the shared icon set's "next",
  // which app.css copies (so a change to the icon shows here). At a phone's size, dark. Then in forced colours (a Windows contrast
  // theme), where a fill is painted the page's own colour: every chevron, a fold's, History's run line's and a task's, is still drawn,
  // in the colour its words take.
  const page = await (await browser.newContext({ viewport: phoneSize, colorScheme: 'dark' })).newPage()
  await page.goto('/#home')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const roles = await page.evaluate(() => {
    const probe = document.createElement('span')
    document.querySelector('.app')!.append(probe)
    const read = (role: string) => {
      probe.style.color = `var(${role})`
      return getComputedStyle(probe).color
    }
    const out = { ink: read('--ink'), muted: read('--muted') }
    probe.remove()
    return out
  })
  const pages: [string, (() => Promise<void>)?][] = [
    [
      '#home',
      async () => {
        await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Company', exact: true }).click()
        await expect(page.locator('.standing h3.group').first()).toBeVisible()
      },
    ],
    ['#jobs'],
    [
      'a job’s kit',
      async () => {
        await page.goto('/#jobs')
        await page.getByRole('link', { name: /Harbour Lights Festival/ }).first().click()
        await page.getByRole('tab', { name: /^Kit/ }).click()
        await expect(page.locator('.kit-group').first()).toBeVisible()
      },
    ],
    ['#quotes'],
    ['#jobs/money'],
    ['#stock/repairs'],
    ['#stock'],
    ['#crew/calls'],
    ['#crew/timesheets'],
  ]
  let groups = 0
  let folds = 0
  for (const [where, open] of pages) {
    if (open) await open()
    else await page.goto(`/${where}`)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    const drawn = await page.evaluate(() => {
      const shown = (el: Element) => el.getClientRects().length > 0
      const heads = [...document.querySelectorAll('.card h3')].filter(shown).map((h) => {
        const cs = getComputedStyle(h)
        return { text: h.textContent!.trim(), group: h.classList.contains('group'), task: h.closest('.step-open') !== null, size: cs.fontSize, caps: cs.textTransform, colour: cs.color, edge: cs.borderTopWidth }
      })
      const boxes = [...document.querySelectorAll('.home .tile, .jobs .phase .job, .crew .call-date .job, .app .board-card, .warehouse .fault, .warehouse .due, .vehicle-row')].filter(shown).map((b) => {
        const cs = getComputedStyle(b)
        return { box: b.className, corner: cs.borderTopLeftRadius, inset: cs.paddingLeft }
      })
      const summaries = [...document.querySelectorAll('summary')].filter(shown).map((s) => {
        const cs = getComputedStyle(s)
        const chevron = s.querySelector(':scope > .chevron') ?? null
        const mark = chevron ? getComputedStyle(chevron) : getComputedStyle(s, '::before')
        return {
          text: s.textContent!.trim(),
          height: s.getBoundingClientRect().height,
          weight: cs.fontWeight,
          colour: cs.color,
          chevron: chevron !== null || (mark.content !== 'none' && mark.maskImage !== 'none'),
          mask: chevron ? undefined : mark.maskImage,
        }
      })
      return { heads, boxes, summaries }
    })
    for (const h of drawn.heads) {
      if (h.group) {
        groups++
        expect([h.size, h.caps, h.colour, h.edge], `${where}: group head ${h.text}`).toEqual(['12px', 'uppercase', roles.muted, '0px'])
      } else {
        expect(h.caps, `${where}: section head ${h.text}`).toBe('none')
        expect(h.size, `${where}: section head ${h.text}`).toBe(h.task ? '20px' : '16px')
      }
    }
    for (const b of drawn.boxes) expect([b.corner, b.inset], `${where}: ${b.box}`).toEqual(['8px', '12px'])
    for (const s of drawn.summaries) {
      folds++
      expect(s.height, `${where}: fold ${s.text}`).toBeGreaterThanOrEqual(44)
      expect([s.weight, s.colour, s.chevron], `${where}: fold ${s.text}`).toEqual(['600', roles.ink, true])
      if (s.mask) expect(iconShape(s.mask), `${where}: fold ${s.text}`).toEqual(next)
    }
  }
  expect(groups).toBeGreaterThan(8)
  expect(folds).toBeGreaterThan(2)

  const forced = await (await browser.newContext({ viewport: phoneSize, forcedColors: 'active' })).newPage()
  const kinds = new Set<string>()
  for (const where of ['#crew/calls', '#history', 'a job']) {
    if (where === 'a job') {
      await forced.goto('/#jobs')
      await forced.getByRole('link', { name: /Harbour Lights Festival/ }).first().click()
      // Where it is folds to its stages (ADR 0140, part 3): its tasks are a press away, the fold's chevron drawn as every fold's.
      await forced.locator('.job-steps .stage-fold').click()
      await expect(forced.locator('.task-list button').first()).toBeVisible()
    } else {
      await forced.goto(`/${where}`)
      await expect(forced.locator(where === '#history' ? '.history .run-line' : 'details.filled-calls > summary').first()).toBeVisible()
    }
    const marks = await forced.evaluate(() => {
      const shown = (el: Element) => el.getClientRects().length > 0
      // Cut to the icon's shape, a chevron is painted by its border where it has one, else by its fill; the cost fold's icon by its stroke.
      const paint = (cs: CSSStyleDeclaration) => (parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : cs.backgroundColor)
      const out: { kind: string; text: string; paint: string; words: string; shaped: boolean }[] = []
      for (const s of [...document.querySelectorAll('summary')].filter(shown)) {
        const icon = s.querySelector(':scope > .chevron')
        const cs = icon ? getComputedStyle(icon) : getComputedStyle(s, '::before')
        out.push({ kind: 'fold', text: s.textContent!.trim(), paint: icon ? cs.stroke : paint(cs), words: getComputedStyle(s).color, shaped: icon !== null || cs.maskImage !== 'none' })
      }
      for (const c of [...document.querySelectorAll('.history .run-line .chevron')].filter(shown)) {
        const cs = getComputedStyle(c)
        out.push({ kind: 'run line', text: c.parentElement!.textContent!.trim(), paint: paint(cs), words: getComputedStyle(c.parentElement!).color, shaped: cs.maskImage !== 'none' })
      }
      for (const b of [...document.querySelectorAll('.job-steps .stage-fold')].filter(shown)) {
        const cs = getComputedStyle(b, '::before')
        out.push({ kind: 'stage fold', text: b.textContent!.trim(), paint: paint(cs), words: getComputedStyle(b).color, shaped: cs.maskImage !== 'none' })
      }
      for (const b of [...document.querySelectorAll('.task-list button')].filter(shown)) {
        const cs = getComputedStyle(b, '::after')
        out.push({ kind: 'task', text: b.querySelector('.task-name')!.textContent!.trim(), paint: paint(cs), words: getComputedStyle(b).color, shaped: cs.maskImage !== 'none' })
      }
      return { out, page: getComputedStyle(document.body).backgroundColor }
    })
    for (const m of marks.out) {
      kinds.add(m.kind)
      expect([m.paint, m.shaped], `${where}, forced colours: ${m.kind} ${m.text}`).toEqual([m.words, true])
      expect(m.paint, `${where}, forced colours: ${m.kind} ${m.text} on the page`).not.toBe(marks.page)
    }
  }
  expect([...kinds].sort()).toEqual(['fold', 'run line', 'stage fold', 'task'])
})
