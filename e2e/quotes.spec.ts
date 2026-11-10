import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

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
 * Quotes and money (ADR 0042): the office builds a quote from a job's kit
 * and crew at the price list, changes a line and adds one charged once at
 * the lower VAT rate, the draft saving itself, removes it and puts it back,
 * prints it to save as a PDF, marks it sent, makes a second version, and
 * records the client accepting it and the invoice. Money then
 * shows who owes what, a freelancer is marked paid, and the accountant's
 * file comes down. Uses the made-up data (ADR 0019), so it starts fresh
 * before and after: the other tests share this server.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }
/** The browser's own print dialog would end printing at once and take the sheet away before it's read, so it's left out. */
const noPrintDialog = (page: Page) => page.addInitScript(() => void (window.print = () => undefined))
/** A colour role (`--bad`) as the browser draws it, read off a probe in the page. */
const roleColour = (page: Page, role: string) =>
  page.evaluate((role) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${role})`
    document.querySelector('.app')!.append(probe)
    const colour = getComputedStyle(probe).color
    probe.remove()
    return colour
  }, role)

test('the office quotes a job, records the answer and the invoice, and sees who owes', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)

  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // Printing opens the browser's own dialog; here it's counted instead.
  await office.addInitScript(() => {
    ;(window as unknown as { printed: number }).printed = 0
    window.print = () => void (window as unknown as { printed: number }).printed++
  })
  // The company's VAT number and address, from Admin's office details, go on the printed quote.
  await office.goto('/#admin')
  await office.getByLabel('VAT number').fill('IE 1234567T')
  await office.getByLabel('Address').fill('Unit 4, Docklands Business Park\nDublin 3')
  await office.getByRole('button', { name: 'Save office details' }).click()
  // Numbers carry on from the last system's, and the terms and bank details go under every quote (ADR 0084).
  const quoting = office.getByRole('region', { name: 'Printed quotes' })
  await quoting.getByLabel('Next quote number').fill('1115')
  await quoting.getByLabel('Terms').fill('Payment within 30 days of the invoice.')
  await quoting.getByLabel('Bank details').fill('Session Hire Ltd\nIBAN IE00 BANK 0000 0000 0000 00')
  await quoting.getByRole('button', { name: 'Save printed quotes' }).click()
  await expect(office.locator('.conn')).toHaveText('Up to date')
  await expect(quoting).toContainText('The next one sent will be 1115.')
  // Sending quotes by email (ADR 0101) is off until the office turns it on, under Connections with the mailbox.
  await office.goto('/#admin/connections')
  const mailbox = office.getByRole('region', { name: 'The operations mailbox' })
  await expect(mailbox).toContainText('needs the Google key')
  const emailing = mailbox.getByRole('switch', { name: /Send quotes by email/ })
  await expect(emailing).not.toBeChecked()
  // Not offered while the mailbox can't send, so it's never on with nothing behind it (audit, 5 November 2026, finding 49).
  await expect(emailing).toBeDisabled()
  await expect(mailbox).toContainText('Connect operations@ above, allowing sending, to turn this on.')
  // Connected to read and send: stood in for, as this server has no Google key.
  await office.route('**/api/assistant/mailbox', (route) =>
    route.fulfill({ json: { available: true, state: 'on', account: 'operations@sessionhire.com', problem: null, connectedAt: '2026-11-01T09:00:00.000Z', lookedAt: null, threads: 0, canSend: true } })
  )
  await office.reload()
  await expect(mailbox).toContainText('Connected as operations@sessionhire.com, to read and send')
  await emailing.click()
  await expect(emailing).toBeChecked()
  await expect(office.locator('.conn')).toHaveText('Up to date')
  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  // The Next dock holds the job page's one filled red (ADR 0104; UX sweep, 6 November 2026, move 1). The quote is the job's Quote tab
  // (ADR 0140, part 4); this job is past Quoting, so the quote's own Build is plain, and so is the submit of every form opened under
  // the dock, on Crew and on Kit and vans as well.
  const redsBesideTheDock = () =>
    office.evaluate(() =>
      [...document.querySelectorAll('.app button.primary, .app a.button.primary')].filter((b) => !b.closest('.next-dock') && b.getClientRects().length > 0).map((b) => b.textContent),
    )
  await expect(office.getByRole('button', { name: 'Build it from the job' })).toBeVisible()
  expect(await redsBesideTheDock()).toEqual([])
  await office.getByRole('tab', { name: /^Crew/ }).click()
  await office.getByRole('button', { name: 'Ask for crew' }).click()
  await expect(office.getByRole('form', { name: 'Ask for crew' })).toBeVisible()
  const lxOp = office.getByRole('article', { name: '1 × LX op' })
  await lxOp.locator('.call-line').click()
  await lxOp.getByRole('button', { name: 'Change', exact: true }).click()
  await expect(office.getByRole('form', { name: 'Change the call for LX op' })).toBeVisible()
  expect(await redsBesideTheDock()).toEqual([])
  await office.getByRole('tab', { name: 'Kit and vans' }).click()
  await office.locator('.kit-days').getByRole('button', { name: 'Change' }).click()
  await office.getByRole('button', { name: 'Add kit' }).click()
  await office.getByRole('button', { name: 'Book a vehicle' }).click()
  for (const form of ['Days to get kit ready and back', 'Add kit', 'Book a vehicle']) await expect(office.getByRole('form', { name: form })).toBeVisible()
  expect(await redsBesideTheDock()).toEqual([])
  await office.getByRole('tab', { name: 'Quote' }).click()

  // Built from the job: its 12 Spiiders for the two days, and its LX op at the price list's €360 rather than the €280 they were booked at.
  await expect(office.getByRole('heading', { name: 'Liffey Brands Launch' })).toBeVisible()
  await office.getByRole('button', { name: 'Build it from the job' }).click()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  // On a phone the lines read as a list, each opened to change it, one at a time.
  await expect(draft.getByRole('button', { name: 'Line 1: Robe Spiider, change it' })).toContainText('12 × €55.00 a day × 2 days')
  await draft.getByRole('button', { name: 'Line 2: LX op (Show), change it' }).click()
  await expect(draft.getByLabel('Line 2: price')).toHaveValue('360')
  await expect(draft.getByRole('group', { name: 'What it comes to' })).toContainText('Before VAT €2,040.00')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // The kit charged for one day, and delivery added, charged once, at 13.5%. It saves itself.
  await draft.getByRole('button', { name: 'Line 1: Robe Spiider, change it' }).click()
  await draft.getByLabel('Line 1: days charged').fill('1')
  await openMore(draft)
  await draft.getByRole('button', { name: 'Add something else' }).click()
  await draft.getByLabel('Line 3: what').fill('Delivery')
  await expect(draft.getByLabel('Line 3: days charged')).toHaveCount(0)
  await expect(draft.getByRole('group', { name: 'What it comes to' })).toContainText('1 line with no price')
  await draft.getByLabel('Line 3: price').fill('150')
  await draft.getByRole('button', { name: 'Line 3: VAT is 23%, change it' }).click()
  await draft.getByLabel('Line 3: VAT').selectOption('13.5')
  await expect(draft.locator('.quote-totals')).toContainText('VAT at 13.5% on €150.00€20.25')
  await expect(draft.locator('.quote-totals')).toContainText('Total€1,867.65')
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  await expect(office.getByRole('status')).toHaveText('Up to date')

  // Removed by mistake, and put back.
  await draft.getByRole('button', { name: 'Remove line 3' }).click()
  await draft.getByRole('button', { name: 'Undo' }).click()
  await expect(draft.getByRole('button', { name: 'Line 3: Delivery, change it' })).toContainText('€150.00 once')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // A deposit of half, and the prices held for 14 days.
  await openTerms(draft)
  await draft.getByLabel('Prices hold for, days').fill('14')
  await openTerms(draft)
  await draft.getByLabel('Deposit, %').fill('50')
  await expect(draft.locator('.quote-terms:not(.quote-discount)')).toContainText('€933.83 before the job')
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  await expect(draft).toContainText('becomes quote 1115')

  // A line half typed when a call comes in can't save yet, but going to Crew and back keeps it (audit finding 27). The rest
  // of the draft saves without it (audit of the quote flow, 8 November 2026, finding 13).
  await openMore(draft)
  await draft.getByRole('button', { name: 'Add something else' }).click()
  await draft.getByLabel('Line 4: price').fill('400')
  // Nothing faults the line while it's still being typed (design system rule 18): the readout says it's not saved, quietly.
  await expect(draft.locator('.save-state')).toHaveText('Line 4 not saved')
  await expect(draft.locator('.line-problem')).toHaveCount(0)
  await expect(draft.locator('.warn-line')).toHaveCount(0)
  await office.goto('/#crew')
  await office.goBack()
  // Back, the line was left, so what stops it saving is said. Send stays in the strip and says what stops it (ADR 0140,
  // part 2), and leads to the line.
  await expect(draft.getByRole('button', { name: 'Line 4: not named yet, change it' })).toBeVisible()
  await expect(draft.locator('.warn-line')).toContainText("Line 4: say what it's for. The rest is saved")
  await expect(draft.getByRole('group', { name: 'What it comes to' }).getByRole('button', { name: 'Send: 1 line to finish' })).toBeVisible()
  await draft.getByRole('button', { name: 'Send: 1 line to finish' }).click()
  await expect(draft.getByLabel('Line 4: price')).toHaveValue('400')
  await expect(draft.locator('.line-problem')).toHaveText("Line 4: say what it's for.")
  // Wrong is drawn as on every other form, the bad edge on the field and the fault by it in the bad ink, never amber (UX sweep,
  // 6 November 2026, move 2).
  const bad = await roleColour(office, '--bad')
  await expect(draft.locator('.line-problem')).toHaveCSS('color', bad)
  await expect(draft.getByLabel('Line 4: what')).toHaveCSS('border-top-color', bad)
  await draft.getByRole('button', { name: 'Remove line 4' }).click()
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // Printed as an A4 page to save as a PDF: only the quote is on the page. Not sent yet, it says it's a draft.
  await draft.getByRole('button', { name: 'Print a draft' }).click()
  const printed = office.locator('.print-sheet.quote-sheet')
  await expect(printed.locator('.sheet-to')).toContainText('Liffey Brands')
  await expect(printed).toContainText('Delivery')
  await expect(printed).toContainText('€1,867.65')
  await expect(printed.locator('.sheet-facts')).toContainText('Draft quoteNot sent yet')
  await expect(printed.locator('.from')).toContainText('Unit 4, Docklands Business Park, Dublin 3')
  await expect(printed.locator('.from')).toContainText('VAT number IE 1234567T')
  await expect(printed).toContainText('A deposit of 50%, €933.83, confirms the booking.')
  await expect(printed.locator('.sheet-terms')).toHaveCount(2)
  await expect.poll(() => office.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)
  await office.emulateMedia({ media: 'print' })
  await expect(printed).toBeVisible()
  await office.emulateMedia({ media: 'screen' })
  await office.evaluate(() => dispatchEvent(new Event('afterprint')))
  await expect(printed).toHaveCount(0)

  // Send to the client opens a compose box the server fills in (stood in for here: this server has no mailbox to send from).
  const prefill = {
    to: ['ruairi@example.com'],
    subject: 'Quote 1115 from Session Hire: Liffey Brands Launch',
    message: 'Hi Ruairí,\n\nPlease find our quote attached.\n\nKind regards,\nSession Hire',
    from: 'operations@sessionhire.com',
    fileName: 'Quote 1115 - Liffey Brands Launch.pdf',
    number: 1115,
    canSend: true,
    why: null,
  }
  await office.route('**/api/quotes/*/email', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: prefill }) : route.continue()))
  await expect(draft).toContainText('it goes by email from the operations mailbox')
  await draft.getByRole('button', { name: 'Send to the client' }).click()
  const compose = draft.getByRole('form', { name: 'Send the quote by email' })
  await expect(compose.getByLabel('To')).toHaveValue('ruairi@example.com')
  await expect(compose.getByLabel('Subject')).toHaveValue('Quote 1115 from Session Hire: Liffey Brands Launch')
  await expect(compose.getByLabel('Message')).toHaveValue(/Please find our quote attached/)
  await expect(compose).toContainText('From operations@sessionhire.com, with Quote 1115 - Liffey Brands Launch.pdf attached.')
  await expect(compose).toContainText('Sending marks it sent, as quote 1115')
  // A wrong address is said once the field is left, not while it's typed.
  await compose.getByLabel('To').fill('ruairi@example.com, not-an-address')
  await expect(compose.locator('.line-problem')).toHaveCount(0)
  await compose.getByLabel('Subject').focus()
  await expect(compose.locator('.line-problem')).toHaveText('“not-an-address” doesn’t look like an email address.')
  await compose.getByRole('button', { name: 'Cancel' }).click()
  await expect(compose).toHaveCount(0)

  // Sent another way by the office itself, then a second version with Liffey's 10% off; the first is kept as it went.
  await draft.getByRole('button', { name: 'Sent another way? Mark as sent' }).click()
  await draft.getByRole('button', { name: 'Mark as sent', exact: true }).click()
  const v1 = office.getByRole('region', { name: 'Version 1' })
  await expect(v1.getByText('Sent', { exact: true })).toBeVisible()
  // On a phone the version as sent is what and the amount, the rest in a line under the name (audit, 5 November 2026, finding 59).
  const sentLines = v1.locator('table.quote-lines')
  await expect(sentLines.getByRole('columnheader', { name: 'What' })).toBeVisible()
  await expect(sentLines.getByRole('columnheader', { name: 'Amount' })).toBeVisible()
  for (const hidden of ['How many', 'Days', 'Price', 'VAT']) await expect(sentLines.getByRole('columnheader', { name: hidden })).toBeHidden()
  await expect(sentLines.locator('.line-sum').first()).toBeVisible()
  await expect(v1.getByRole('button', { name: 'Send by email' })).toBeVisible()
  await expect(v1.locator('.quote-facts')).toContainText('Quote 1115 · Valid until')
  await v1.getByRole('button', { name: 'Print or save as PDF' }).click()
  await expect(printed.locator('.sheet-facts')).toContainText('Quote1115')
  await expect(printed).toContainText('Please give quote 1115 as the reference.')
  await office.evaluate(() => dispatchEvent(new Event('afterprint')))
  await v1.getByRole('button', { name: 'Start a new version' }).click()
  const v2 = office.getByRole('form', { name: 'Version 2, a draft' })
  await openTerms(v2)
  await v2.getByLabel('Discount, %').fill('10')
  await expect(v2.locator('.quote-totals')).toContainText('Total€1,680.89')
  await expect(v2.locator('.save-state')).toHaveText('Saved')
  // What changed, to tell the client in a sentence; the deposit and days carry over.
  const since = office.getByRole('region', { name: 'What changed since version 1' })
  await expect(since).toContainText('Discount 10%, was 0%')
  await expect(since).toContainText('€186.76 less than version 1')
  await openTerms(v2)
  await expect(v2.getByLabel('Deposit, %')).toHaveValue('50')
  await v2.getByRole('button', { name: 'Sent another way? Mark as sent' }).click()
  await v2.getByRole('button', { name: 'Mark as sent', exact: true }).click()
  await expect(office.getByRole('region', { name: 'Version 2' }).locator('.quote-facts')).toContainText('Quote 1115')

  // The client said yes; the office invoiced it outside the app and records that here.
  const records = office.getByRole('region', { name: 'What happened' })
  // The client's answer is what's next, so it's the quote's one filled red: sending it again and printing it are plain (move 1).
  await expect(records.getByRole('button', { name: 'Client accepted' })).toHaveClass(/\bprimary\b/)
  const sentV2 = office.getByRole('region', { name: 'Version 2' })
  await expect(sentV2.getByRole('button', { name: 'Print or save as PDF' })).not.toHaveClass(/\bprimary\b/)
  await expect(sentV2.getByRole('button', { name: 'Send by email' })).not.toHaveClass(/\bprimary\b/)
  await records.getByRole('button', { name: 'Client accepted' }).click()
  await records.getByLabel('Invoice number').fill('SH-1050')
  await records.getByRole('button', { name: 'Mark invoiced' }).click()
  await expect(records).toContainText('Not yet: €1,680.89 owed')
  // The job is confirmed and has its own work ahead, so its Next is on the quote page too and holds the one red (ADR 0140): the
  // payment is recorded, plain, once it comes.
  await expect(office.getByRole('region', { name: 'Next' })).toBeVisible()
  await expect(records.getByRole('button', { name: 'Mark paid' })).not.toHaveClass(/\bprimary\b/)
  await expect(office.getByText("The quote is invoiced, so it's settled: no new version.")).toBeVisible()
  await office.getByRole('button', { name: 'Version 1 · Sent' }).click()
  await expect(office.getByText('An older version, kept as it went to the client. The newest is version 2.')).toBeVisible()
  // While the quote that counts still waits on its payment, printing an older version isn't the next thing either.
  await expect(office.getByRole('region', { name: 'Version 1' }).getByRole('button', { name: 'Print or save as PDF' })).not.toHaveClass(/\bprimary\b/)
  await expect(office.getByRole('status')).toHaveText('Up to date')

  // The job's tasks end on the invoice, said the same as here and a tap from it (batch 5, Q6).
  const quoteAt = office.url()
  await office.goto(quoteAt.replace(/\/quote$/, ''))
  const invoiceRow = office.getByRole('list', { name: 'Invoice' })
  await expect(invoiceRow).toContainText(/Invoiced \w+/)
  await invoiceRow.getByRole('link').click()
  await expect(office).toHaveURL(quoteAt)

  // Money: what's accepted and unpaid, with VAT, invoiced apart from not invoiced yet (audit findings 29 and 71), a row
  // a client with its quotes folded under it (finding 31); freelancers to pay, and the accountant's file.
  await office.goto('/#jobs/money')
  await expect(office.locator('.money-facts')).toContainText(/Accepted, unpaid€[\d,.]+with VAT, of which €[\d,.]+ not invoiced yet/)
  const owed = office.getByRole('region', { name: 'Accepted, unpaid' })
  await expect(owed).toContainText('Shannonside Festivals')
  await expect(owed).toContainText('Brightwater Conferences')
  const invoiced = owed.getByRole('group', { name: 'Invoiced', exact: true })
  await expect(invoiced).toContainText('Liffey Brands1 quote€1,680.89')
  await expect(invoiced.getByRole('link', { name: 'Liffey Brands Launch' })).toBeHidden()
  await invoiced.getByText('Liffey Brands', { exact: true }).click()
  await expect(invoiced).toContainText('Version 2 · €1,680.89 with VAT · invoiced')
  await expect(invoiced.getByRole('link', { name: 'Liffey Brands Launch' })).toBeVisible()
  await expect(office.getByRole('region', { name: 'Margin by job' })).toContainText('Liffey Brands Launch')

  const freelancers = office.getByRole('region', { name: 'Owed to freelancers' })
  await expect(freelancers).toContainText('Tadhg Brady')
  await freelancers.getByRole('button', { name: /^Mark Tadhg Brady paid/ }).click()
  await expect(freelancers.getByRole('group', { name: 'Paid lately' })).toContainText('Tadhg Brady')

  const accountant = office.getByRole('region', { name: 'For the accountant' })
  await accountant.getByLabel('Period').selectOption({ index: 0 })
  const downloading = office.waitForEvent('download')
  await accountant.getByRole('button', { name: 'Invoices' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^session-hire-invoices-\d{4}-\d{2}-01-to-\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = readFileSync((await download.path())!, 'utf8')
  expect(csv).toContain('Invoice date,Invoice number,Client,Job,Quote version,VAT rate,Net (EUR),VAT (EUR),Gross (EUR),Paid on')
  expect(csv).toMatch(/\d{4}-\d{2}-\d{2},SH-1050,Liffey Brands,Liffey Brands Launch,2,23%,1242\.00,285\.66,1527\.66,\r\n/)
  expect(csv).toContain(',SH-1050,Liffey Brands,Liffey Brands Launch,2,13.5%,135.00,18.23,153.23,')

  // The price list it was built from.
  await office.getByRole('link', { name: 'Price list' }).click()
  const kit = office.getByRole('region', { name: 'Kit' })
  await kit.getByLabel('Robe Spiider: price a day').fill('60')
  await kit.getByRole('button', { name: 'Save' }).click()
  await expect(kit.getByRole('button', { name: 'Save' })).toHaveCount(0)
  await expect(office.getByRole('region', { name: 'Crew' })).toContainText('LX op')

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('a quote turned down: losing the job is left to record, and a loss, so nothing on the quote is red until it is recorded', async ({ browser, request }) => {
  // Proves: the quote's one filled red is the next thing to record (UX sweep, 6 November 2026, move 1), which is never a loss, and
  // printing takes it only once nothing is left.
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await noPrintDialog(office)
  const reds = () =>
    office.evaluate(() => [...document.querySelectorAll('button.primary, a.button.primary')].filter((b) => b.getClientRects().length > 0).map((b) => b.textContent))

  // Corrib Arts Week's quote is with the client and the job is quoted: the client's answer is next.
  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Corrib Arts Week' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  const records = office.getByRole('region', { name: 'What happened' })
  await expect(records.getByRole('button', { name: 'Client accepted: confirm the job' })).toBeVisible()
  expect(await reds()).toEqual(['Client accepted: confirm the job'])

  // Turned down, with the job still quoted: marking it lost is left, which takes its crew calls, so it's plain, and printing waits.
  // Why is asked in place before it's recorded (research/quoting.md, feature 5), and shows on the answer.
  await records.getByRole('button', { name: 'Client turned it down' }).click()
  const why = records.getByRole('group', { name: 'Why did they say no?' })
  await why.getByRole('radio', { name: 'Went with someone else' }).check()
  await why.getByRole('textbox', { name: /Anything more/ }).fill('A cheaper PA from Galway')
  await why.getByRole('button', { name: 'Record it as turned down' }).click()
  await expect(why).toHaveCount(0)
  await expect(records).toContainText('went with someone else')
  await expect(records).toContainText('A cheaper PA from Galway')
  await expect(records).toContainText('The client turned it down, and the job is still quoted.')
  await expect(records.getByRole('button', { name: 'Mark the job lost' })).toBeVisible()
  expect(await reds()).toEqual([])

  // Recorded, nothing is left: printing it is the page's one next thing.
  await records.getByRole('button', { name: 'Mark the job lost' }).click()
  await expect(records.getByRole('button', { name: 'Mark the job lost' })).toHaveCount(0)
  await expect(office.getByRole('region', { name: 'Version 1' }).getByRole('button', { name: 'Print or save as PDF' })).toHaveClass(/\bprimary\b/)
  expect(await reds()).toEqual(['Print or save as PDF'])
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('kit charged by the week, a line discounted, and a total agreed with the client (ADR 0085)', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await noPrintDialog(office)

  // The Spiiders are hired by the week: the price list says so beside the price.
  await office.goto('/#jobs/money/prices')
  const kit = office.getByRole('region', { name: 'Kit' })
  await kit.getByLabel('Robe Spiider: charged').selectOption('weekly')
  await kit.getByLabel('Robe Spiider: price a week').fill('150')
  await kit.getByRole('button', { name: 'Save' }).click()
  await expect(kit.getByRole('button', { name: 'Save' })).toHaveCount(0)
  await expect(office.locator('.rate-rules')).toContainText('1 Weekly')

  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  await office.getByRole('button', { name: 'Build it from the job' }).click()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  // Two days out is one week charged.
  await expect(draft.getByRole('button', { name: 'Line 1: Robe Spiider, change it' })).toContainText('12 × €150.00 a week × 1 week')
  await expect(draft.getByRole('group', { name: 'What it comes to' })).toContainText('Before VAT €2,520.00')

  // Half off the Spiiders, then a 3 Day Week for ten days out: six days charged.
  await draft.getByRole('button', { name: 'Line 1: Robe Spiider, change it' }).click()
  await draft.getByLabel('Line 1: discount, %').fill('50')
  await expect(draft.getByRole('group', { name: 'What it comes to' })).toContainText('Before VAT €1,620.00')
  await draft.getByLabel('Line 1: charged').selectOption('week3')
  await draft.getByLabel('Line 1: days out').fill('10')
  await expect(draft).toContainText('Charged 6 days')
  await draft.getByLabel('Line 1: charged').selectOption('weekly')
  await draft.getByLabel('Line 1: days out').fill('2')

  // The client agreed €1,500 before VAT: the discount is whatever comes to it.
  await openTerms(draft)
  await draft.getByLabel('Agreed price before VAT, €').fill('1500')
  await expect(draft.getByLabel('Discount, %', { exact: true })).toHaveCount(0)
  await expect(draft.locator('.quote-totals')).toContainText('Agreed discount, 7.4%−€120.00')
  await expect(draft.locator('.quote-totals')).toContainText('Before VAT€1,500.00')
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  await draft.getByRole('button', { name: 'Print a draft' }).click()
  const printed = office.locator('.print-sheet.quote-sheet')
  await expect(printed).toContainText('less 50%')
  await expect(printed).toContainText('Agreed discount, 7.4%')
  await office.evaluate(() => dispatchEvent(new Event('afterprint')))

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test("the crew's travel to a venue far from Dublin, and their subsistence unless meals are provided (ADR 0086)", async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await noPrintDialog(office)

  // Admin says how they're charged: past 50 km, diesel at €1.749, a car using 10 litres for 100 km, €39.08 a day each.
  await office.goto('/#admin')
  const travel = office.getByRole('region', { name: 'Travel and subsistence' })
  await travel.getByLabel('Travel after').fill('50')
  await travel.getByLabel('Fuel price, € a litre').fill('1.749')
  await travel.getByLabel('A car uses, litres for 100 km').fill('10')
  await travel.getByLabel('Per diem, € a day').fill('39.08')
  await travel.getByRole('button', { name: 'Save travel and subsistence' }).click()
  await expect(office.locator('.conn')).toHaveText('Up to date')
  await expect(travel).toContainText('Set today.')
  await expect(travel).toContainText('So 100 km each way comes to €34.98 of fuel for one car.')
  // The price keeps up with the AA's survey unless turned off, to keep one typed in.
  const auto = travel.getByRole('switch', { name: /Update the fuel price from the AA each month/ })
  await expect(auto).toBeChecked()
  await auto.click()
  await expect(auto).not.toBeChecked()
  await expect(travel).toContainText('Off: the fuel price stays as saved here')
  await expect(travel.getByLabel('Fuel price, € a litre')).toHaveValue('1.749')

  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  await office.getByRole('button', { name: 'Build it from the job' }).click()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  const extras = draft.getByRole('group', { name: 'Travel and subsistence' })

  // The crew's subsistence comes in by itself; the venue is in Dublin, so there's no travel until it's said to be 200 km.
  await expect(extras).toContainText(/Crew subsistence, \d+ crew days?/)
  await expect(extras).toContainText('No travel')
  // Each is a row like a line: pressing it opens the one thing the office says about this job for it.
  await extras.getByRole('button', { name: /^No travel/ }).click()
  await extras.getByLabel('Distance each way from Dublin city centre, km').fill('200')
  await expect(extras).toContainText(/Crew travel, 200 km each way from Dublin, \d+ car trips?/)
  await expect(extras).toContainText('€69.96')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // The job feeds the crew: no subsistence.
  await extras.getByRole('button', { name: /^Crew subsistence/ }).click()
  await extras.getByRole('switch', { name: /Meals provided/ }).check()
  await expect(extras).toContainText('No subsistence')
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  await draft.getByRole('button', { name: 'Print a draft' }).click()
  const printed = office.locator('.print-sheet.quote-sheet')
  await expect(printed).toContainText('Crew travel, 200 km each way from Dublin')
  await expect(printed).not.toContainText('Crew subsistence')
  await office.evaluate(() => dispatchEvent(new Event('afterprint')))

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('a package made on the price list goes on a quote at its price, with its kit under it (ADR 0087, ADR 0116)', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await noPrintDialog(office)

  await office.goto('/#jobs/money/prices')
  const packages = office.getByRole('region', { name: 'Packages', exact: true })
  await packages.getByRole('button', { name: 'Add a package' }).click()
  const editor = packages.getByRole('form', { name: 'New package' })
  await editor.getByLabel('Name').fill('Mic package')
  await editor.getByLabel('Add a product to it').fill('SM58')
  await editor.getByRole('option', { name: /Shure SM58/ }).click()
  await editor.getByLabel('How many Shure SM58').fill('4')
  await editor.getByLabel('Charged').selectOption('weekly')
  await editor.getByLabel('Price, € a week').fill('100')
  await editor.getByLabel('Anything else it includes').fill('with clips and stands')
  await editor.getByRole('button', { name: 'Add the package' }).click()
  await expect(packages).toContainText('4 × Shure SM58, with clips and stands')
  await expect(packages).toContainText('€100.00 a week')

  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  await office.getByRole('button', { name: 'Build it from the job' }).click()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  await openMore(draft)
  await draft.getByRole('button', { name: 'Add a package' }).click()
  await draft.getByRole('button', { name: 'Add', exact: true }).click()
  // Its line at its price, and the four mics under it, included, shown as it's just been added.
  await expect(draft.getByLabel('Line 3: includes')).toHaveValue('with clips and stands')
  await draft.getByRole('button', { name: 'Done' }).click()
  const set = draft.locator('.quote-set')
  await expect(set.getByRole('button', { name: 'Hide what’s in it' })).toBeVisible()
  await expect(set.locator('.set-lines')).toContainText('Shure SM58')
  await expect(set.locator('.set-lines')).toContainText('Included')
  await expect(draft.getByRole('button', { name: /with no price/ })).toHaveCount(0)
  await expect(draft.getByRole('group', { name: 'What it comes to' })).toContainText('Before VAT €2,140.00')
  await expect(draft.locator('.save-state')).toHaveText('Saved')
  await draft.getByRole('button', { name: 'Print a draft' }).click()
  // On paper, its kit is printed under it.
  const printed = office.locator('.print-sheet.quote-sheet')
  await expect(printed).toContainText('Mic packagewith clips and stands')
  await expect(printed.locator('tr.set-line', { hasText: 'Shure SM58' })).toContainText('Included')
  await office.evaluate(() => dispatchEvent(new Event('afterprint')))

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test("a line short of kit hires in what it's short of, transport is added at a cost, and the office sees the margin, none of it printed (ADR 0089)", async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await noPrintDialog(office)

  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  await office.getByRole('button', { name: 'Build it from the job' }).click()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  const summary = draft.getByRole('group', { name: 'What it comes to' })
  await expect(summary).toContainText('Expected margin')

  // Far more Spiiders than there are: the line says it's short, and hires in what it's short of.
  await draft.getByRole('button', { name: 'Line 1: Robe Spiider, change it' }).click()
  await draft.getByLabel('Line 1: how many').fill('500')
  await expect(draft.locator('.kit-note')).toContainText('Short by')
  await expect(summary).toContainText('1 line short of kit')
  await draft.getByRole('button', { name: /^Hire \d+ in$/ }).click()
  await expect(draft.getByLabel('Line 1: hired in')).not.toHaveValue('')
  await expect(summary).not.toContainText('short of kit')
  await expect(summary).toContainText('1 line with no cost yet')
  await draft.getByLabel('Line 1: supplier').fill('  Hire Co ')
  await draft.getByLabel('Line 1: costs us').fill('2000')
  await expect(summary).not.toContainText('no cost yet')
  await draft.getByRole('button', { name: 'Done' }).click()
  await expect(draft.getByRole('button', { name: 'Line 1: Robe Spiider, change it' })).toContainText('hired in from Hire Co')

  // Transport, charged once, and what it costs us: the job's Luton is booked with a driver, so it's offered first.
  await openMore(draft)
  await draft.getByRole('button', { name: 'Add transport' }).click()
  await draft.getByRole('button', { name: 'Add', exact: true }).click()
  await draft.getByLabel('Line 3: price').fill('180')
  await draft.getByLabel('Line 3: costs us').fill('120')
  await draft.getByRole('button', { name: 'Done' }).click()
  await expect(draft.getByRole('button', { name: 'Line 3: Luton van and driver, change it' })).toContainText('makes €60.00')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // The client's copy has none of it.
  await draft.getByRole('button', { name: 'Print a draft' }).click()
  const printed = office.locator('.print-sheet.quote-sheet')
  await expect(printed).toContainText('Luton van and driver')
  for (const word of ['Hire Co', 'hired in', 'Margin', 'makes', '€2,000.00', '€120.00']) await expect(printed).not.toContainText(word)
  await office.evaluate(() => dispatchEvent(new Event('afterprint')))

  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('Add kit takes the cursor and stays open for the next product, Done closing it (audit, 5 November 2026, finding 58)', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  await office.getByRole('button', { name: 'Start one empty' }).click()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  await draft.getByRole('button', { name: 'Add kit' }).click()
  const picker = draft.getByRole('combobox', { name: 'Kit to add' })
  await expect(picker).toBeFocused()
  await office.keyboard.type('SM58')
  await office.keyboard.press('ArrowDown')
  await office.keyboard.press('Enter')
  // Still open, with the cursor in it for the next.
  await expect(draft.getByRole('combobox', { name: 'Kit to add' })).toBeFocused()
  await expect(draft).toContainText('1 line added. Pick the next, or Done.')
  await office.keyboard.type('Spiider')
  await office.keyboard.press('ArrowDown')
  await office.keyboard.press('Enter')
  await expect(draft).toContainText('2 lines added.')
  await expect(draft.getByRole('button', { name: /Shure SM58, change it$/ })).toBeVisible()
  await expect(draft.getByRole('button', { name: /Robe Spiider, change it$/ })).toBeVisible()
  await draft.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(draft.getByRole('combobox', { name: 'Kit to add' })).toHaveCount(0)
  await expect(draft.getByRole('button', { name: 'Add kit' })).toBeVisible()
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test("how many is typed with the product or the role, and the picker says the price and how many are free (research/quoting.md, features 1 and 2)", async ({ browser, request }) => {
  // Proves: "12 SM58" in Add kit offers 12 × the product with its price and free count and adds a line of 12; Add crew takes how many beside the role; a name that starts with a number is still found by it.
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  await office.getByRole('button', { name: 'Start one empty' }).click()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })
  await draft.getByRole('button', { name: 'Add kit' }).click()
  await expect(draft).toContainText('Type how many first, as 12 y10.')
  await office.keyboard.type('12 SM58')
  const offer = draft.getByRole('option', { name: /^12 × Shure SM58/ })
  await expect(offer).toBeVisible()
  await expect(offer).toContainText(/(a day|a week|No price yet)/)
  await expect(offer).toContainText(/free/)
  await expect(draft.getByRole('listbox')).toContainText('12 of the one you pick')
  await office.keyboard.press('Enter')
  await expect(draft).toContainText('1 line added.')
  await expect(draft.getByRole('button', { name: /Shure SM58, change it$/ })).toContainText('12 ×')
  await draft.getByRole('button', { name: 'Done', exact: true }).click()

  await draft.getByRole('button', { name: 'Add crew' }).click()
  await draft.getByLabel('How many').fill('2')
  await draft.getByLabel('Crew role to add').fill('Rigger')
  await draft.getByLabel('Crew role to add').press('Enter')
  // The crew line opens for its price as before, at two.
  await expect(draft.getByRole('textbox', { name: 'Line 2: how many' })).toHaveValue('2')
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test("on a desk a line's amount and Remove sit inside the quote's card at every width (audit finding 28)", async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await page.goto('/#jobs')
  await page.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await page.getByRole('tab', { name: 'Quote' }).click()
  await page.getByRole('button', { name: 'Build it from the job' }).click()
  const draft = page.getByRole('form', { name: 'Version 1, a draft' })
  await draft.getByRole('button', { name: 'Line 1: Robe Spiider, change it' }).click()
  for (const width of [1024, 1200, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    const card = (await draft.boundingBox())!
    expect(card.x + card.width, `at ${width}px`).toBeLessThanOrEqual(width)
    for (const part of [draft.getByRole('button', { name: 'Remove line 1' }), draft.locator('.quote-line .amount').first()]) {
      const box = (await part.boundingBox())!
      expect(box.x + box.width, `at ${width}px`).toBeLessThanOrEqual(card.x + card.width)
    }
  }
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('two people on one draft keep both their changes, one of them with no signal (ADR 0113)', async ({ browser, request }) => {
  // Proves: a save made from an older draft keeps the change made elsewhere since, on the server and on both devices, and
  // a draft left open takes in the other's change instead of saving its own old copy over it.
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const one = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await one.goto('/#jobs')
  await one.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await one.getByRole('tab', { name: 'Quote' }).click()
  await one.getByRole('button', { name: 'Start one empty' }).click()
  const draftOne = one.getByRole('form', { name: 'Version 1, a draft' })
  await draftOne.getByRole('button', { name: 'Add kit' }).click()
  await one.keyboard.type('4 SM58')
  await one.keyboard.press('Enter')
  await expect(draftOne).toContainText('1 line added.')
  await one.keyboard.type('2 y10')
  await one.keyboard.press('Enter')
  await expect(draftOne).toContainText('2 lines added.')
  await draftOne.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(draftOne.locator('.save-state')).toHaveText('Saved')

  // The other device opens the same draft, then loses signal and changes the second line.
  const twoContext = await browser.newContext({ viewport: phoneSize })
  const two = await twoContext.newPage()
  await two.goto(one.url())
  const draftTwo = two.getByRole('form', { name: 'Version 1, a draft' })
  await expect(draftTwo).toContainText('Shure SM58')
  await twoContext.setOffline(true)
  await draftTwo.getByRole('button', { name: /^Line 2: .*, change it$/ }).click()
  await draftTwo.getByLabel('Line 2: how many').fill('3')
  await draftTwo.getByLabel('Line 2: how many').press('Tab')

  // Meanwhile the first changes the first line, and the second, with signal back, keeps it.
  await draftOne.getByRole('button', { name: /^Line 1: .*, change it$/ }).click()
  await draftOne.getByLabel('Line 1: how many').fill('6')
  await draftOne.getByLabel('Line 1: how many').press('Tab')
  await expect(draftOne.locator('.save-state')).toHaveText('Saved')
  await twoContext.setOffline(false)

  // Each takes in the other's line live, keeping its own, open as it was.
  await expect(draftOne.getByRole('button', { name: 'Line 2: d&b Y10P, change it' })).toContainText('3 ×')
  await expect(draftOne.getByLabel('Line 1: how many')).toHaveValue('6')
  await expect(draftTwo.getByRole('button', { name: 'Line 1: Shure SM58, change it' })).toContainText('6 ×')
  await expect(draftTwo.getByLabel('Line 2: how many')).toHaveValue('3')
  // And neither saved its old copy back over the other's: both read so from the server.
  await expect(draftOne.locator('.save-state')).toHaveText('Saved')
  await expect(draftTwo.locator('.save-state')).toHaveText('Saved')
  for (const page of [one, two]) {
    await page.reload()
    const draft = page.getByRole('form', { name: 'Version 1, a draft' })
    await expect(draft.getByRole('button', { name: 'Line 1: Shure SM58, change it' })).toContainText('6 ×')
    await expect(draft.getByRole('button', { name: 'Line 2: d&b Y10P, change it' })).toContainText('3 ×')
  }
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('a count before a name with digits in it is still a count, and a line given free is Included, not asked about (audit of the quote flow, 8 November 2026, findings 1 and 2)', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Liffey Brands Launch' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  await office.getByRole('button', { name: 'Start one empty' }).click()
  const draft = office.getByRole('form', { name: 'Version 1, a draft' })

  // "8 SM58" as a whole finds the SM58 by the 8 in its name; it's still eight of it.
  await draft.getByRole('button', { name: 'Add kit' }).click()
  await office.keyboard.type('8 SM58')
  await expect(draft.getByRole('option', { name: /^8 × Shure SM58/ })).toBeVisible()
  await office.keyboard.press('Enter')
  await expect(draft.getByRole('button', { name: /Shure SM58, change it$/ })).toContainText('8 ×')
  await draft.getByRole('button', { name: 'Done', exact: true }).click()

  // A line with no price says so, and one press gives it as included: it reads Included and the readout stops counting it.
  await openMore(draft)
  await draft.getByRole('button', { name: 'Add something else' }).click()
  await draft.getByRole('textbox', { name: 'Line 2: what' }).fill('Cables and power')
  await expect(draft.getByText('Needs a price, or')).toBeVisible()
  await expect(draft.getByRole('button', { name: /lines? with no price/ })).toBeVisible()
  await draft.getByRole('button', { name: 'Line 2: included at no charge' }).click()
  await expect(draft.locator('.quote-line .included-word')).toContainText('Included')
  await expect(draft.getByRole('button', { name: /lines? with no price/ })).toHaveCount(0)
  await draft.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(draft.getByRole('button', { name: 'Line 2: Cables and power, change it' })).toContainText('Included at no charge')
  await expect(draft.locator('.save-state')).toHaveText('Saved')

  // It goes without being asked about, and the sent quote says Included.
  await draft.getByRole('button', { name: 'Get the PDF to send' }).click()
  await expect(office.getByRole('dialog')).toHaveCount(0)
  await expect(office.getByRole('table').first()).toContainText('Included')
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})
