import { expect, test } from '@playwright/test'

/**
 * What comes back to a quote's email (ADR 0172): a bounce is said on the quote, on Next, on the Board and on top of Home,
 * and sending it again to the address put right is one press away; a reply is said quietly, with the conversation to open
 * in Gmail. The server's watcher reads Gmail, which this server hasn't: the email it would have recorded is laid into the
 * device's copy as the server would send it. Uses the made-up data (ADR 0019): Corrib Arts Week's quote is with the client.
 */

const phoneSize = { width: 390, height: 844 }
const fresh = { data: { confirm: 'delete everything' } }

test('a quote email that bounced is said everywhere the office looks, and sent again from Next', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // Connected to read and send, and quotes go by email: stood in for, as this server has no Google key.
  await office.route('**/api/assistant/mailbox', (route) =>
    route.fulfill({ json: { available: true, state: 'on', account: 'operations@sessionhire.com', problem: null, connectedAt: '2026-11-01T09:00:00.000Z', lookedAt: null, threads: 0, canSend: true } })
  )
  await office.route('**/api/quotes/email/check?*', (route) => route.fulfill({ json: { addresses: [] } }))
  // The email the server sent with Corrib Arts Week's quote, as its watcher left it: bounced for one address, and a reply.
  const sentAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
  let bounce = true
  // Remembered from the first pull that carries them: a later pull (after a reload, the device's own copy picks up where it
  // left off) has only what changed since, and the email as the watcher now has it still has to come with it.
  let arts: { id: string } | undefined
  let quote: { id: string } | undefined
  await office.route('**/api/sync/pull?*', async (route) => {
    const res = await route.fetch()
    const body = (await res.json()) as { changes: { seq: number; entity: string; id: string; op: string; data: Record<string, unknown> }[]; cursor: number }
    arts ??= body.changes.find((c) => c.entity === 'project' && c.data.name === 'Corrib Arts Week')
    if (arts) quote ??= body.changes.findLast((c) => c.entity === 'quote' && c.data.projectId === arts!.id && c.data.status === 'sent')
    if (quote)
      body.changes.push({
        seq: body.cursor,
        entity: 'quoteEmail',
        id: 'watched-email',
        op: 'put',
        data: {
          id: 'watched-email', quoteId: quote.id, projectId: arts!.id, version: 1, number: 1101, at: sentAt, by: 'Office', from: 'operations@sessionhire.com',
          to: ['aisling@corribarts.ie', 'accounts@corribarts.ie'], subject: 'Quote 1101 from Session Hire: Corrib Arts Week', copyTo: null, inSentAt: sentAt, threadId: '18c0ffee',
          bounced: bounce ? { at: new Date(Date.now() - 60 * 60_000).toISOString(), to: ['accounts@corribarts.ie'], why: 'the address doesn’t exist' } : null,
          delayed: null, replies: 1, reply: { at: new Date(Date.now() - 30 * 60_000).toISOString(), from: 'Aisling Byrne' },
        },
      })
    await route.fulfill({ response: res, json: body })
  })
  await office.goto('/#admin/connections')
  const emailing = office.getByRole('region', { name: 'The operations mailbox' }).getByRole('switch', { name: /Send quotes by email/ })
  await emailing.click()
  await expect(emailing).toBeChecked()

  // On top of Home, whichever view.
  await office.goto('/#home')
  const card = office.getByRole('region', { name: 'A quote email bounced' })
  await expect(card).toContainText('Corrib Arts Week')
  await expect(card).toContainText('accounts@corribarts.ie: the address doesn’t exist')
  if (process.env.SHOTS_DIR) await office.screenshot({ path: `${process.env.SHOTS_DIR}/home-bounced-phone.png` })

  // The quote's email says what came back, in order: sent, in Sent, bounced (bad), the reply (quiet) with Gmail to open.
  await card.getByRole('link', { name: /Corrib Arts Week/ }).click()
  const emails = office.getByRole('list', { name: 'Emailed to the client' })
  await expect(emails).toContainText('In the Sent folder of operations@sessionhire.com')
  await expect(emails).toContainText('Bounced')
  await expect(emails).toContainText('for accounts@corribarts.ie: the address doesn’t exist.')
  await expect(emails).toContainText('Aisling Byrne replied')
  await expect(emails.getByRole('link', { name: 'Open in Gmail' })).toHaveAttribute('href', 'https://mail.google.com/mail/u/operations%40sessionhire.com/#all/18c0ffee')
  await emails.scrollIntoViewIfNeeded()
  if (process.env.SHOTS_DIR) await office.screenshot({ path: `${process.env.SHOTS_DIR}/quote-bounced-phone.png` })

  // Next: put the address right and send again comes before the client's answer.
  const next = office.getByRole('region', { name: 'Next' })
  await next.getByRole('button', { name: 'Fix address and resend' }).click()
  const compose = office.getByRole('form', { name: 'Send the quote by email' })
  await expect(compose).toContainText('The last one bounced for accounts@corribarts.ie: the address doesn’t exist.')
  await expect(compose.getByLabel('To')).toHaveValue('aisling@corribarts.ie, accounts@corribarts.ie')
  if (process.env.SHOTS_DIR) await office.screenshot({ path: `${process.env.SHOTS_DIR}/resend-after-bounce-phone.png` })
  await compose.getByRole('button', { name: 'Cancel' }).click()

  // On the Board, the card says so in the bad tone.
  await office.goto('/#jobs/board')
  await expect(office.locator('.board-card', { hasText: 'Corrib Arts Week' }).locator('.board-line')).toHaveText('Quote email bounced: accounts@corribarts.ie')

  // With no bounce, Home has nothing to say, and the reply is the quiet line it was.
  bounce = false
  await office.reload()
  await office.goto('/#home')
  await expect(office.getByRole('region', { name: 'A quote email bounced' })).toHaveCount(0)
  // A pull still in flight as the page goes would otherwise fail outside the test.
  await office.unrouteAll({ behavior: 'ignoreErrors' })
  await office.context().close()
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})
