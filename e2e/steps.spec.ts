import { expect, test, type APIRequestContext } from '@playwright/test'
import { pickRecord } from './names.ts'

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
  const where = page.getByRole('region', { name: 'Status', exact: true })
  const next = page.getByRole('region', { name: 'Next' })
  // Confirmed, so the quote and the yes are done and the job is in Planning; the crew is next, which the app ticks once every call is booked.
  await expect(where.locator('li[aria-current="step"] button')).toHaveAccessibleName('2. Planning, the stage the job is in, 0 of 2 done')
  // The head's right-hand column (ADR 0161): the status level with the name, who has the stage, then Next with no line over it.
  // Under the name, the stage it's in; what's outstanding is Next's own words.
  const head = page.locator('.job-position').first()
  await expect(head).toContainText('Planning')
  await expect(page.locator('.corner-status')).toHaveText('Confirmed')
  await expect(next.locator('.line')).toHaveCount(0)
  const assignee = page.getByRole('combobox', { name: 'Who has Planning' })
  await expect(assignee).toHaveValue('')
  await expect(assignee).toHaveAttribute('placeholder', 'Nobody yet')
  const tasksFold = where.getByRole('button', { name: '2 tasks to do in Planning' })
  await expect(tasksFold).toHaveAttribute('aria-expanded', 'false')
  await expect(where.locator('.task-list')).toHaveCount(0)
  // Pressed on a phone, it does what it says (ADR 0140): the Crew part opens on the first call with a place to fill, its Offer
  // already open with the cursor in it and in view, rather than a tab with the Offers still to find (audit, 5 November 2026, finding 1).
  await next.getByRole('button', { name: 'Offer the Audio tech · 2 to offer' }).click()
  const crewTab = page.getByRole('tab', { name: /^Crew/ })
  await expect(crewTab).toHaveAttribute('aria-selected', 'true')
  const offerTo = page.getByRole('combobox', { name: 'Offer to' })
  await expect(offerTo).toHaveCount(1)
  await expect(offerTo).toBeFocused()
  await expect(offerTo).toBeInViewport()
  // Next has no "Hand it on" (ADR 0161): the task opens from Status.
  await expect(next.getByRole('button', { name: /^Hand it/ })).toHaveCount(0)
  await tasksFold.click()
  await where.getByRole('button', { name: /^Crew booked/ }).click()
  await expect(where.getByRole('heading', { name: 'Crew booked' })).toBeVisible()
  await expect(where.getByText('0 of 2 booked. This is the task to do next.')).toBeVisible()
  // The open task is marked by the chevron every fold has, turned, never by the wash of a pointer resting on it; and on a phone the
  // stage names are at the 12px floor, a long one wrapping rather than going under it (UX sweep, 6 November 2026, move 2).
  const opened = where.locator('.task-list button[aria-expanded="true"]')
  await expect(opened).toHaveCount(1)
  await expect(opened).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect.poll(() => opened.evaluate((b) => getComputedStyle(b, '::after').rotate)).toBe('90deg')
  expect(await where.locator('.task-list button[aria-expanded="false"]').first().evaluate((b) => getComputedStyle(b, '::after').rotate)).toBe('none')
  expect(await where.locator('.stage-label').evaluateAll((labels) => labels.map((l) => getComputedStyle(l).fontSize))).toEqual(Array<string>(5).fill('12px'))
  // The app ticks this one itself once every call is booked; until then it can be ticked by hand, given to someone, and given a day it's due by.
  await expect(where.getByRole('button', { name: 'Mark it done' })).toBeVisible()
  await where.getByLabel('Down to').selectOption({ label: `${roisin} (you)` })
  await where.getByLabel('Due by').fill('2030-06-01')
  await expect(head).toContainText('by Sat 1 Jun')
  await expect(tasksFold).toHaveAttribute('aria-expanded', 'true')
  // One of the stage's two tasks is hers, so the field says it's split; picking her there gives her both, in place: a spinner
  // while it's sent, a tick once it's kept, and the chevron back after three seconds.
  await expect(assignee).toHaveValue(/^Split: Róisín, nobody$/)
  await assignee.click()
  await assignee.fill('Róis')
  await assignee.press('Enter')
  await expect(page.locator('.corner-owner .picker-saved')).toBeVisible()
  await expect(assignee).toHaveValue(`${roisin} (you)`)
  await expect(page.locator('.corner-owner .picker-toggle')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.corner-owner .picker-saved')).toHaveCount(0)

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
  await expect(page.locator('.job-row', { hasText: job }).locator('.job-position')).toContainText('Planning · 0 of 2 booked · No kit on the job yet')
  // On the Board (part 3), the job is a card in the Planning column, saying what is short.
  await page.goto('/#jobs/board')
  // Which jobs is in the Board's Filter panel (Colly, 10 November 2026).
  await page.getByRole('button', { name: /^Filter/ }).click()
  await page.getByRole('button', { name: 'All coming up' }).click()
  const planning = page.getByRole('region', { name: 'Planning' })
  // In Planning the crew and the kit are two dots in the card's footer (Colly, 10 November 2026): crew asked for and none booked is
  // amber with its count, no kit yet is hollow, and each says itself in words to a screen reader.
  const marks = planning.locator('.board-card', { hasText: job }).locator('.board-mark')
  await expect(marks).toHaveCount(2)
  await expect(marks.nth(0)).toHaveAttribute('data-state', 'warn')
  await expect(marks.nth(0)).toHaveText('Crew0/2: 0 of 2 booked')
  await expect(marks.nth(1)).toHaveAttribute('data-state', 'off')
  await expect(marks.nth(1)).toHaveAttribute('title', 'No kit on the job yet')
  // On Home, the task she's to do now is on top, whichever view, with the day it's due; the ticked one isn't.
  await page.goto('/#home')
  const mine = page.getByRole('region', { name: /^Your tasks/ })
  await expect(mine.getByRole('link', { name: new RegExp(`^Crew booked ${job}`) })).toBeVisible()
  await expect(mine).toContainText('By Sat 1 Jun')
  await expect(mine.getByText('Checked and deprepped')).toHaveCount(0)
  await mine.getByRole('link', { name: new RegExp(`^Crew booked ${job}`) }).click()
  await expect(page.getByRole('heading', { name: job })).toBeVisible()
  // It opens on her task, not only the job (audit, 5 November 2026, finding 17): landed on, with the focus on its name and the part it's
  // about open under it (UX sweep, 6 November 2026, move 8).
  await expect(page).toHaveURL(/\/task\/crew$/)
  await expect(page.getByRole('heading', { level: 3, name: /^Crew booked/ })).toBeInViewport()
  await expect(page.getByRole('heading', { level: 3, name: /^Crew booked/ })).toBeFocused()
  await expect(page.getByRole('tab', { name: /^Crew/ })).toHaveAttribute('aria-selected', 'true')

  if (process.env.SHOTS) {
    const desk = await (await browser.newContext({ viewport: deskSize })).newPage()
    await desk.goto(`/#jobs/j-${id}`)
    await expect(desk.getByRole('status')).toHaveText('Up to date')
    await desk.getByRole('region', { name: 'Status', exact: true }).screenshot(shot('job-steps'))
  }
})

test("Next books a job's crew one press at a time, its count moving on, then lands on the short kit's Subhire", async ({ browser, request }) => {
  // Proves (ADR 0140, part 5): each press of Next does one thing and says how far it has got: a yes is confirmed where it is, the
  // next place nobody's been offered opens its Offer, the answers still out are waited on in words, and short kit opens its
  // Subhire with the first tick in focus.
  const id = Date.now().toString(36)
  const job = `Lough Derg Regatta ${id}`
  const aoife = `Aoife Moves${id}`
  const brian = `Brian Moves${id}`
  await push(request, id, [
    ['person.upsert', { id: `ma-${id}`, name: aoife, kind: 'staff', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }],
    ['person.upsert', { id: `mb-${id}`, name: brian, kind: 'staff', email: null, phone: null, skills: [], dayRateCents: null, notes: '' }],
    ['model.create', { id: `mm-${id}`, name: `Regatta mast ${id}`, department: 'staging', category: 'Truss', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }],
    ['project.create', { id: `m-${id}`, name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `mp-${id}`, projectId: `m-${id}`, name: 'Show', start: '2030-07-04', end: '2030-07-04', venueId: null, notes: '' }],
    [
      'call.create',
      { id: `mc-${id}`, projectId: `m-${id}`, phaseId: `mp-${id}`, project: job, phase: 'Show', venue: '', role: 'Rigger', start: '2030-07-04', end: '2030-07-04', callTime: null, needed: 2, dayRateCents: null, details: '', replyBy: null },
    ],
    ['offer.send', { id: `mo-${id}`, callId: `mc-${id}`, personId: `ma-${id}`, override: false }],
    ['offer.respond', { id: `mo-${id}`, answer: 'accept', days: null, note: '' }],
    ['kit.add', { id: `mk-${id}`, projectId: `m-${id}`, phaseId: null, modelId: `mm-${id}`, qty: 2, subhireQty: 0, supplier: '', notes: '' }],
  ])
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto(`/#jobs/m-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const next = page.getByRole('region', { name: 'Next' })
  const call = page.getByRole('article', { name: '2 × Rigger' })

  // Aoife's yes is confirmed in the press, and the page lands on her call with the focus on its line.
  await next.getByRole('button', { name: `Confirm Aoife's yes · 2 to book` }).click()
  await expect(call.getByRole('button', { name: /^2 × Rigger/ })).toBeFocused()
  await expect(call.locator('.who-line')).toContainText(aoife)
  // Then the place nobody's been offered: its Offer open, the cursor in it.
  await next.getByRole('button', { name: 'Offer the Rigger · 1 to offer' }).click()
  await expect(call.getByRole('combobox', { name: 'Offer to' })).toBeFocused()
  await pickRecord(call, 'Offer to', brian)
  await call.getByRole('button', { name: /^Offer to / }).click()
  // Every place offered: Next waits in words, with the count.
  await expect(next).toContainText('Every place is offered: waiting on 1 answer. 1 of 2 booked.')
  await expect(next.getByRole('button')).toHaveCount(0)

  // Brian says yes on his link; the next press confirms him and the crew are booked.
  // The offer reaches the server a moment after the press, so look until it's there.
  let offer = ''
  await expect.poll(async () => (offer = (await offerOf(request, `mc-${id}`, `mb-${id}`)) ?? ''), { timeout: 8000 }).not.toBe('')
  await push(request, `${id}-b`, [['offer.respond', { id: offer, answer: 'accept', days: null, note: '' }]])
  await expect(next).toContainText("Confirm Brian's yes", { timeout: 8000 })
  await next.getByRole('button', { name: `Confirm Brian's yes · 1 to book` }).click()
  // Then the short kit: Subhire open with the first tick in focus; subhiring it takes the count down to nothing.
  await next.getByRole('button', { name: 'Sort 1 short on the kit' }).click()
  const subhire = page.getByRole('form', { name: `Subhire what's short on ${job}` })
  await expect(subhire.getByRole('checkbox').first()).toBeFocused()
  await subhire.getByRole('checkbox').first().check()
  await subhire.getByRole('button', { name: 'Subhire 1 line' }).click()
  await expect(next.getByRole('button', { name: 'Settle the kit and vans' })).toBeVisible()
})

test('a job on its first day with nothing scanned out is due out, not out, and its pick list has only the one way', async ({ browser, request }) => {
  // Proves (ADR 0140, part 6): the stage is said from the scans, not only the date, so the warehouse isn't told the kit has gone.
  const id = Date.now().toString(36)
  const job = `Inch Strand Gig ${id}`
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' })
  await push(request, id, [
    ['model.create', { id: `dm-${id}`, name: `Strand lamp ${id}`, department: 'lighting', category: 'Lamp', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }],
    ['project.create', { id: `d-${id}`, name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `dp-${id}`, projectId: `d-${id}`, name: 'Show', start: today, end: today, venueId: null, notes: '' }],
    ['kit.add', { id: `dk-${id}`, projectId: `d-${id}`, phaseId: null, modelId: `dm-${id}`, qty: 6, subhireQty: 0, supplier: '', notes: '' }],
  ])
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto(`/#jobs/d-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(page.locator('.job-position').first()).toContainText('Going out')
  // Next counts what's out, as the pick list's own dock does.
  await page.getByRole('region', { name: 'Next' }).getByRole('link', { name: 'Pick the kit · 6 to go out' }).click()
  await expect(page.getByRole('region', { name: 'Next' })).toHaveText('Next · Due out today · 0 of 6 out')
  await expect(page.getByRole('group', { name: 'Going out or coming back' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Kit to go out' })).toBeVisible()
})

test("a job's tabs run in the order the job goes, and it opens on the one its next task is in", async ({ browser, request }) => {
  // Proves (ADR 0140, part 8): no hunting for the tab; a link to a tab still opens that tab.
  const id = Date.now().toString(36)
  const soon = new Date(Date.now() + 20 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' })
  await push(request, id, [
    ['project.create', { id: `ts-${id}`, name: `Tab Sale ${id}`, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `tsp-${id}`, projectId: `ts-${id}`, name: 'Show', start: soon, end: soon, venueId: null, notes: '' }],
    ['project.create', { id: `tp-${id}`, name: `Tab Plan ${id}`, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `tpp-${id}`, projectId: `tp-${id}`, name: 'Show', start: soon, end: soon, venueId: null, notes: '' }],
    [
      'call.create',
      { id: `tpc-${id}`, projectId: `tp-${id}`, phaseId: `tpp-${id}`, project: `Tab Plan ${id}`, phase: 'Show', venue: '', role: 'Rigger', start: soon, end: soon, callTime: '08:00', needed: 2, dayRateCents: null, details: '', replyBy: null },
    ],
  ])
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto(`/#jobs/ts-${id}`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const tabs = page.getByRole('tablist', { name: 'Parts of the job' }).getByRole('tab')
  await expect(tabs).toHaveText([/^Quote/, /^Crew/, /^Kit/, /^Transport/, /^Phases/, /^Show pack/])
  // Being sold: it opens on its quote.
  await expect(page.getByRole('tab', { name: /^Quote/ })).toHaveAttribute('aria-selected', 'true')
  // Confirmed with crew to book: it opens on Crew.
  await page.goto(`/#jobs/tp-${id}`)
  await expect(page.getByRole('heading', { level: 1, name: `Tab Plan ${id}` })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^Crew/ })).toHaveAttribute('aria-selected', 'true')
  // A link to a part opens that part.
  await page.goto(`/#jobs/tp-${id}/phases`)
  await expect(page.getByRole('tab', { name: /^Phases/ })).toHaveAttribute('aria-selected', 'true')
})

/** The id of the offer the office made to a person on a call, from what the server sends; undefined while it hasn't arrived. */
async function offerOf(request: APIRequestContext, callId: string, personId: string): Promise<string | undefined> {
  let after = 0
  for (;;) {
    const { changes, cursor, more } = (await (await request.get(`/api/sync/pull?after=${after}`)).json()) as {
      changes: { entity: string; id: string; data: { callId?: string; personId?: string } | null }[]
      cursor: number
      more: boolean
    }
    const found = changes.find((c) => c.entity === 'offer' && c.data?.callId === callId && c.data.personId === personId)
    if (found) return found.id
    if (!more) return undefined
    after = cursor
  }
}

test('an enquiry whose dates passed with no answer is counted on Home, folded on the Board, and asks what happened', async ({ browser, request }) => {
  // Proves (ADR 0109; audit, 5 November 2026, finding 18): a job still being sold after its last day leaves the top of Quoting for a
  // fold of its own, Home counts it as housekeeping and opens that fold, and the job's Next asks what happened.
  const id = Date.now().toString(36)
  const job = `Brosna Concert ${id}`
  await push(request, id, [
    ['project.create', { id: `e-${id}`, name: job, clientId: null, venueId: null, status: 'enquiry', notes: '' }],
    ['phase.add', { id: `ep-${id}`, projectId: `e-${id}`, name: 'Show', start: '2026-02-20', end: '2026-02-20', venueId: null, notes: '' }],
  ])
  const page = await (await browser.newContext({ viewport: deskSize })).newPage()
  await page.goto('/#home')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Company' }).click()
  await page.locator('.standing').getByRole('link', { name: /jobs? whose dates passed with no answer$/ }).click()
  await expect(page).toHaveURL(/#jobs\/board$/)
  const selling = page.getByRole('region', { name: 'Quoting' })
  const fold = selling.locator('details.board-lapsed')
  await expect(fold).toHaveAttribute('open', '')
  await expect(fold.locator('.board-card', { hasText: job })).toContainText('Dates passed, no answer: mark it lost?')
  await expect(selling.locator(':scope > .board-card', { hasText: job })).toHaveCount(0)
  await fold.locator('.board-card', { hasText: job }).click()
  const next = page.getByRole('region', { name: 'Next' })
  await expect(page.locator('.job-position').first()).toContainText('Quoting · no answer')
  await next.getByRole('button', { name: 'Record what happened' }).click()
  await expect(page.getByRole('region', { name: 'Status', exact: true }).getByRole('button', { name: 'Client said no' })).toBeVisible()
})

test('kit never scanned out after a job is still to check back in, said the same on Home and the Board, with how long ago it ended', async ({ browser, request }) => {
  // Proves (ADR 0109; the sweep of 6 November 2026, Move 3): one list behind Home's count, Home › Warehouse and the Board's Back column,
  // each saying what isn't back and when the job ended, late (amber) past the job's days to come back and two more.
  const id = Date.now().toString(36)
  const job = `Vartry Fair ${id}`
  const today = new Date(`${new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' })}T12:00:00Z`)
  const ended = new Date(today.getTime() - 4 * 86_400_000).toISOString().slice(0, 10)
  await push(request, id, [
    ['model.create', { id: `vx-${id}`, name: `Vartry cable ${id}`, department: 'audio', category: 'Cable', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }],
    ['project.create', { id: `v-${id}`, name: job, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `vp-${id}`, projectId: `v-${id}`, name: 'Show', start: ended, end: ended, venueId: null, notes: '' }],
    ['kit.add', { id: `vk-${id}`, projectId: `v-${id}`, phaseId: null, modelId: `vx-${id}`, qty: 5, subhireQty: 0, supplier: '', notes: '' }],
  ])
  const said = "5 never scanned out: check they're back · ended 4 days ago"

  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await page.goto('/#home')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('group', { name: 'Show for' }).getByRole('button', { name: 'Warehouse' }).click()
  const row = page.locator('.job-row', { hasText: job })
  await expect(row).toContainText(said)
  await expect(row.locator('.flag.warn')).toHaveText('Late')
  // Home's count is the length of the list under it.
  const heading = page.getByRole('heading', { level: 2, name: /^Still out after the job \(\d+\)$/ })
  const listed = /\((\d+)\)/.exec((await heading.textContent()) ?? '')![1]!
  const tile = page.locator('.standing').getByRole('link', { name: /with kit still out after/ })
  await expect(tile.locator('b')).toHaveText(listed)
  await expect(tile).toHaveClass(/\bwarn\b/)
  // Never scanned out, it opens the job's Back in task, to check and tick off.
  await row.click()
  await expect(page).toHaveURL(new RegExp(`#jobs/v-${id}/task/back$`))
  await expect(page.locator('.step-open h3')).toHaveText(/^Back in/)

  // The Board's Back column says it in the same words, amber, and its head counts it late.
  await page.goto('/#jobs/board')
  const back = page.getByRole('region', { name: 'Back' })
  const card = back.locator('.board-card', { hasText: job })
  await expect(card.locator('.board-line')).toHaveText(said)
  await expect(card.locator('.board-line')).toHaveAttribute('data-tone', 'warn')
  await expect(back.locator('header small')).toHaveText(/^\d+ · [1-9]\d* late/)
})

test('kit more than a month overdue folds away under Long overdue, and is settled in one press', async ({ browser, request }) => {
  // Proves (review of 11 November 2026, finding 10): a job that ended more than a month ago with kit not back leaves the Board's Back
  // column for a Long overdue fold under it, and on Stock's Pick lists it's folded under Long overdue, where It's all back scans
  // back what's out and ticks Back in, and Mark missing puts what's out on Repairs. Each asks first.
  const id = Date.now().toString(36)
  const fair = `Lough Fair ${id}`
  const show = `Tallaght Show ${id}`
  const today = new Date(`${new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' })}T12:00:00Z`)
  const ago = (n: number) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10)
  await push(request, id, [
    ['model.create', { id: `lx-${id}`, name: `Lough cable ${id}`, department: 'audio', category: 'Cable', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }],
    ['project.create', { id: `l-${id}`, name: fair, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `lp-${id}`, projectId: `l-${id}`, name: 'Show', start: ago(45), end: ago(45), venueId: null, notes: '' }],
    ['kit.add', { id: `lk-${id}`, projectId: `l-${id}`, phaseId: null, modelId: `lx-${id}`, qty: 5, subhireQty: 0, supplier: '', notes: '' }],
    ['move.record', { id: `lm-${id}`, projectId: `l-${id}`, direction: 'out', assetId: null, modelId: `lx-${id}`, qty: 5, at: `${ago(46)}T09:00:00.000Z` }],
    ['project.create', { id: `t-${id}`, name: show, clientId: null, venueId: null, status: 'confirmed', notes: '' }],
    ['phase.add', { id: `tp-${id}`, projectId: `t-${id}`, name: 'Show', start: ago(40), end: ago(40), venueId: null, notes: '' }],
    ['kit.add', { id: `tk-${id}`, projectId: `t-${id}`, phaseId: null, modelId: `lx-${id}`, qty: 3, subhireQty: 0, supplier: '', notes: '' }],
    ['move.record', { id: `tm-${id}`, projectId: `t-${id}`, direction: 'out', assetId: null, modelId: `lx-${id}`, qty: 3, at: `${ago(41)}T09:00:00.000Z` }],
  ])

  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // On the Board: not a card in Back, but under its Long overdue fold.
  await page.goto('/#jobs/board')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const back = page.getByRole('region', { name: 'Back' })
  await expect(back.locator('> .board-card, .ordered .board-card', { hasText: fair })).toHaveCount(0)
  const fold = back.locator('details', { hasText: 'Long overdue' })
  await fold.locator('summary').click()
  await expect(fold.locator('.board-card', { hasText: fair })).toBeVisible()

  // On Stock, under Pick lists.
  await page.goto('/#stock')
  const lists = page.getByRole('region', { name: 'Pick lists' })
  const long = lists.locator('details.long-overdue')
  await expect(long.locator('summary')).toContainText(/^Long overdue \(\d+\)$/)
  await long.locator('summary').click()
  const fairRow = long.locator('.long-overdue-row', { hasText: fair })
  await expect(fairRow).toContainText('5 of 5 not scanned back · ended 45 days ago')
  await fairRow.getByRole('button', { name: `It's all back: ${fair}` }).click()
  await expect(fairRow.getByRole('group')).toContainText(`Mark the 5 things still out with it as back from ${fair}, and its Back in done?`)
  await fairRow.getByRole('button', { name: "Yes, it's all back" }).click()
  await expect(page.locator('.toast', { hasText: `${fair}: all back` })).toContainText('Its Back in is done.')

  const showRow = long.locator('.long-overdue-row', { hasText: show })
  await expect(showRow).toContainText('3 of 3 not scanned back · ended 40 days ago')
  await showRow.getByRole('button', { name: `Mark missing: ${show}` }).click()
  await showRow.getByRole('button', { name: 'Mark missing', exact: true }).click()
  await expect(page.locator('.toast', { hasText: `${show}: marked missing` })).toContainText('What was still out is on Repairs')
  await expect(page.locator('.conn')).toHaveText('Up to date')

  // Settled, both leave the list.
  await page.reload()
  await expect(page.locator('.conn')).toHaveText('Up to date')
  await expect(page.locator('.job-row', { hasText: fair })).toHaveCount(0)
  await expect(page.locator('.job-row', { hasText: show })).toHaveCount(0)
})
