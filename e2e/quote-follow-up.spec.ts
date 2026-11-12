import { expect, test } from '@playwright/test'

/** The rarer ways to add sit under More, and the terms read as a line with Change, until opened (ADR 0140, part 4). */
async function openMore(at: import('@playwright/test').Locator) {
  const more = at.getByRole('button', { name: 'More to add…' })
  // Once the draft is drawn: More, or with nothing on the quote yet, every way in already shown.
  await expect(more.or(at.getByRole('button', { name: 'Add something else' }))).toBeVisible()
  if (await more.isVisible()) await more.click()
}
async function openTerms(at: import('@playwright/test').Locator) {
  const change = at.getByRole('button', { name: 'Change the terms' })
  // Once the draft is drawn: the line with Change, or the terms already open as one of them needs putting right.
  await expect(change.or(at.getByLabel('Prices hold for, days'))).toBeVisible()
  if (await change.isVisible()) await change.click()
}


/**
 * Starting a quote and following it up (ADR 0081): the office starts a quote
 * from Money with the job in a few words, which makes an enquiry and opens
 * its draft; marking it sent makes the job quoted and lists it as waiting
 * for an answer; the client accepting it offers to confirm the job, from the
 * quote and from Quotes. Uses the made-up data (ADR 0019), so it starts fresh
 * before and after.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test('the office starts a quote from Quotes, sends it, and puts the job in step when the client says yes', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // Printing is counted, not shown: Get the PDF to send opens the print dialog (audit of the quote flow, finding 14).
  await office.addInitScript(() => void (window.print = () => void ((window as unknown as { printed: number }).printed = ((window as unknown as { printed?: number }).printed ?? 0) + 1)))

  // Corrib Arts Week's quote went three days ago, so it's waiting, but not yet worth a call: Home counts none, and a count of
  // nothing isn't shown (ADR 0033).
  await office.goto('/')
  await expect(office.getByRole('status')).toHaveText('Up to date')
  const attention = office.locator('.standing')
  await expect(attention.getByRole('link', { name: /answers? to check/ })).toBeVisible()
  await expect(attention.getByRole('link', { name: /worth a call/ })).toHaveCount(0)
  await office.goto('/#quotes')
  const quotes = office.getByRole('region', { name: 'To follow up' })
  await expect(quotes).toContainText('Waiting for an answer')
  await expect(quotes).toContainText('Sent 3 days ago')
  await expect(quotes).not.toContainText('worth a call')
  // Its heading says how many are waiting, and how many are worth a call only once one is, as Home counts them (Move 10).
  await expect(quotes.getByRole('heading', { name: /^Waiting for an answer/ })).toHaveText('Waiting for an answer (1)')

  // A phone call turns into a quote: the job in a few words.
  await quotes.page().locator('.page-add', { hasText: 'New quote' }).click()
  const form = quotes.page().getByRole('form', { name: 'New quote' })
  await form.getByLabel("What's the job?").fill('Docklands Awards')
  await form.getByLabel('Client').fill('Liffey Brands')
  const today = await office.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Dublin' }))
  await form.getByText('More about the enquiry').click()
  await form.getByLabel(/Wanted by/).fill(today)
  await form.getByRole('button', { name: 'Start the quote' }).click()
  await expect(office).toHaveURL(/#jobs\/[^/]+\/quote$/)
  // The page lands on the job's Quote tab once it's drawn (ADR 0140, part 4): pressed before then, a press can meet the page mid-scroll.
  await expect(office.getByRole('tab', { name: 'Quote' })).toBeFocused()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  await expect(draft).toContainText('No lines yet')
  await openMore(draft)
  await draft.getByRole('button', { name: 'Add something else' }).click()
  await draft.getByLabel('Line 1: what').fill('PA for the awards')
  await draft.getByLabel('Line 1: price').fill('900')
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  // The quote is the job's Quote tab, under its head and Next (ADR 0140, part 4). With the quote whole, Next is its Send (ADR 0166),
  // and the strip's own Send is plain, so there's one red on the page.
  await expect(office.getByRole('tab', { name: 'Quote' })).toHaveAttribute('aria-selected', 'true')
  await expect(office.getByRole('region', { name: 'Next' }).getByRole('button', { name: 'Get the PDF to send' })).toBeVisible()
  const onePress = () => office.evaluate(() => [...document.querySelectorAll('button.primary, a.button.primary')].filter((b) => b.getClientRects().length > 0).map((b) => b.textContent))
  expect(await onePress()).toEqual(['Get the PDF to send'])

  // Wanted today, it leads Quotes and Home counts it, until it's sent (ADR 0127; audit of the quote flow, finding 7).
  const back = office.url()
  await office.goto('/#quotes')
  await expect(quotes.getByRole('heading', { name: /^Wanted today/ })).toHaveText('Wanted today (1)')
  await expect(quotes.getByRole('listitem').filter({ hasText: 'Docklands Awards' })).toContainText('Wanted today')
  await office.goto('/')
  await expect(attention.getByRole('link', { name: /quote wanted today/ })).toBeVisible()
  await office.goto(back)

  // Sent: the job is quoted now, and Quotes lists it as waiting.
  await draft.getByRole('button', { name: 'Get the PDF to send' }).click()
  const records = office.getByRole('region', { name: 'What happened' })
  await expect(records).toBeVisible()
  // It's numbered and opened to print or save at once; until it has been printed, printing it is the one red press, not the answer.
  await expect.poll(() => office.evaluate(() => (window as unknown as { printed?: number }).printed ?? 0)).toBe(1)
  await expect(office.getByRole('button', { name: 'Print or save as PDF' })).toHaveClass(/\bprimary\b/)
  await expect(records.getByRole('button', { name: 'Client accepted' })).not.toHaveClass(/\bprimary\b/)
  await office.goto('/#quotes')
  await expect(quotes.getByRole('listitem').filter({ hasText: 'Docklands Awards' })).toContainText('Sent today')
  await office.goto('/#jobs')
  await expect(office.locator('.job-row', { hasText: 'Docklands Awards' })).toContainText('Quoted')

  // The client said yes: one press records it and confirms the job (ADR 0140, part 4), as the Confirmed task's own Yes does,
  // rather than a Confirm the job to find after it.
  await office.locator('.job-row', { hasText: 'Docklands Awards' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  await expect(records).toContainText('Their yes confirms the job: it goes on the jobs calendar and its kit is held.')
  await records.getByRole('button', { name: 'Client accepted: confirm the job' }).click()
  await expect(records.getByRole('button', { name: 'Mark invoiced' })).toBeVisible()
  await expect(records).not.toContainText('still quoted')
  await expect(records.getByRole('button', { name: 'Confirm the job' })).toHaveCount(0)
  // Nothing is left to put in step, so Quotes has nothing to follow up on it.
  await office.goto('/#quotes')
  await expect(quotes.getByRole('listitem').filter({ hasText: 'Docklands Awards' })).toHaveCount(0)
  await office.goto('/#jobs')
  // Confirmed, its row says where it stands rather than the pill (Move 7 of the sweep of 6 November 2026).
  const docklands = office.locator('.job-row', { hasText: 'Docklands Awards' })
  await expect(docklands.locator('.job-position')).toBeVisible()
  await expect(docklands.locator('.pill')).toHaveCount(0)

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('before a quote goes it says what to look at, and a quote whose prices ran out says so (research/quoting.md, features 3 and 4)', async ({ browser, request }) => {
  // Proves: Mark as sent with crew on a quote whose venue isn't on the map asks first, Look first opens the travel row, and
  // marking it sent anyway sends it; sent forty days ago, Quotes says its prices held until a day that has passed, and so
  // does the quote above Client accepted.
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // Printing is counted, not shown: Get the PDF to send opens the print dialog (audit of the quote flow, finding 14).
  await office.addInitScript(() => void (window.print = () => void ((window as unknown as { printed: number }).printed = ((window as unknown as { printed?: number }).printed ?? 0) + 1)))
  await office.goto('/#quotes')
  await expect(office.getByRole('status')).toHaveText('Up to date')
  const quotes = office.getByRole('region', { name: 'To follow up' })
  await quotes.page().locator('.page-add', { hasText: 'New quote' }).click()
  const form = quotes.page().getByRole('form', { name: 'New quote' })
  await form.getByLabel("What's the job?").fill('Quayside Gala')
  // Who asked, how, and the day they want it by (research/quoting.md, feature 6): a line in the job's notes, and the Quote sent task's due day.
  const quoteBy = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
  await form.getByText('More about the enquiry').click()
  await form.getByLabel('Wanted by').fill(quoteBy)
  await form.getByLabel('How it came').selectOption('Phone')
  await form.getByLabel('Who asked').fill('Aoife Byrne')
  await form.getByRole('button', { name: 'Start the quote' }).click()
  await expect(office).toHaveURL(/#jobs\/[^/]+\/quote$/)
  // The page lands on the job's Quote tab once it's drawn (ADR 0140, part 4): pressed before then, a press can meet the page mid-scroll.
  await expect(office.getByRole('tab', { name: 'Quote' })).toBeFocused()
  const job = office.url().replace(/\/quote$/, '')
  await office.goto(job)
  await expect(office.locator('main')).toContainText('Enquiry by phone from Aoife Byrne.')
  // The quote's day is on its task, a press away under the stages (ADR 0140, part 3).
  await office.getByRole('region', { name: 'Status', exact: true }).getByRole('button', { name: /tasks? to do in Quoting$/ }).click()
  await expect(office.locator('main')).toContainText(/Due by|· by /)
  await office.goto(`${job}/quote`)
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  await draft.getByRole('button', { name: 'Add crew' }).click()
  await draft.getByLabel('Crew role to add').fill('Rigger')
  await draft.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  const sentOn = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10)
  await draft.getByLabel('Sent to the client on').fill(sentOn)
  await draft.getByRole('button', { name: 'Get the PDF to send' }).click()
  const ask = draft.locator('.before-it-goes')
  await expect(ask).toContainText("Before it goes: No travel for the crew: the venue isn't on the map, so the distance isn't known.")
  await ask.getByRole('button', { name: 'Look first' }).click()
  await expect(draft.getByRole('button', { name: /^No travel/ })).toHaveAttribute('aria-expanded', 'true')
  await draft.getByRole('button', { name: 'Get the PDF to send' }).click()
  await ask.getByRole('button', { name: 'Get the PDF anyway' }).click()
  const records = office.getByRole('region', { name: 'What happened' })
  await expect(records).toBeVisible()
  await expect(records).toContainText(/Its prices held until .+\. If the client accepts now, check they still stand/)

  await office.goto('/#quotes')
  await expect(quotes.getByRole('listitem').filter({ hasText: 'Quayside Gala' })).toContainText(/Prices held until .+: check they stand, or start a new version/)
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('a finished quote is sent from Next: the email to the client with the PDF on it, and the PDF to download apart (ADR 0166)', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // Connected to read and send, and quotes go by email: stood in for, as this server has no Google key.
  await office.route('**/api/assistant/mailbox', (route) =>
    route.fulfill({ json: { available: true, state: 'on', account: 'operations@sessionhire.com', problem: null, connectedAt: '2026-11-01T09:00:00.000Z', lookedAt: null, threads: 0, canSend: true } })
  )
  const prefill = {
    to: ['ruairi@example.com'],
    subject: 'Quote from Session Hire: Docklands Awards',
    message: 'Hi Ruairí,\n\nPlease find our quote attached.\n\nKind regards,\nSession Hire',
    from: 'operations@sessionhire.com',
    fileName: 'Quote - Docklands Awards.pdf',
    number: 1200,
    canSend: true,
    why: null,
  }
  await office.route('**/api/quotes/*/email', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: prefill }) : route.abort()))
  await office.goto('/#admin/connections')
  const emailing = office.getByRole('region', { name: 'The operations mailbox' }).getByRole('switch', { name: /Send quotes by email/ })
  await emailing.click()
  await expect(emailing).toBeChecked()
  await expect(office.locator('.conn')).toHaveText('Up to date')

  await office.goto('/#quotes/new')
  const form = office.getByRole('form', { name: 'New quote' })
  await form.getByLabel("What's the job?").fill('Docklands Awards')
  await form.getByLabel('Client').fill('Liffey Brands')
  await form.getByRole('button', { name: 'Start the quote' }).click()
  await expect(office.getByRole('tab', { name: 'Quote' })).toBeFocused()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  const next = office.getByRole('region', { name: 'Next' })
  await openMore(draft)
  await draft.getByRole('button', { name: 'Add something else' }).click()
  // While a line is being typed, Next says what stops it, as the draft's own Send does.
  await draft.getByLabel('Line 1: price').fill('900')
  await office.goto('/#crew')
  await office.goBack()
  // A press of it opens the line, as the draft's own does.
  await next.getByRole('button', { name: 'Send: 1 line to finish' }).click()
  await draft.getByLabel('Line 1: what').fill('PA for the awards')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // Whole, Next is Send quote, the page's one red, with the PDF to download beside it.
  await expect(next.getByRole('button', { name: 'Send quote' })).toBeVisible()
  await expect(next.getByRole('link', { name: 'Download the PDF' })).toHaveAttribute('href', /\/api\/quotes\/[^/]+\/pdf\?download=1$/)
  const reds = () => office.evaluate(() => [...document.querySelectorAll('button.primary, a.button.primary')].filter((b) => b.getClientRects().length > 0).map((b) => b.textContent))
  expect(await reds()).toEqual(['Send quote'])
  if (process.env.SHOTS_DIR) await office.screenshot({ path: `${process.env.SHOTS_DIR}/next-send-quote-phone.png` })

  // From another tab, Next opens the quote with the email to the client in it.
  await office.getByRole('tab', { name: /^Phases/ }).click()
  await next.getByRole('button', { name: 'Send quote' }).click()
  const compose = draft.getByRole('form', { name: 'Send the quote by email' })
  await expect(compose.getByLabel('To')).toHaveValue('ruairi@example.com')
  await expect(compose).toContainText('with Quote - Docklands Awards.pdf attached')
  // The email's own Send is the press now, so Next says so in words.
  await expect(next).toContainText('The email to the client is below, with the quote attached')
  if (process.env.SHOTS_DIR) await office.screenshot({ path: `${process.env.SHOTS_DIR}/next-email-open-phone.png` })
  await compose.getByRole('button', { name: 'Cancel' }).click()
  await expect(next.getByRole('button', { name: 'Send quote' })).toBeVisible()
  // On the Quote tab, Next opens the same email.
  await next.getByRole('button', { name: 'Send quote' }).click()
  await expect(compose.getByLabel('Subject')).toHaveValue('Quote from Session Hire: Docklands Awards')
})
