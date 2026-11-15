import { expect, test } from '@playwright/test'

/**
 * The quote email as the client will see it (ADR 0187), shown in the compose box before Send: the message as typed,
 * inside the company's layout with the job, the total and the company's details, and drawn again after an edit. Nothing
 * is sent. Uses the made-up data (ADR 0019): Corrib Arts Week's quote is with the client.
 */

const phoneSize = { width: 390, height: 844 }

test('the compose box shows the email as it will go, and again after the message changes', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', { data: { confirm: 'delete everything' } })).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const office = await (await browser.newContext({ viewport: phoneSize })).newPage()
  // Connected to read and send: stood in for, as this server has no Google key.
  await office.route('**/api/assistant/mailbox', (route) =>
    route.fulfill({ json: { available: true, state: 'on', account: 'operations@sessionhire.com', problem: null, connectedAt: '2026-11-01T09:00:00.000Z', lookedAt: null, threads: 0, canSend: true } })
  )
  await office.goto('/#admin/connections')
  const emailing = office.getByRole('region', { name: 'The operations mailbox' }).getByRole('switch', { name: /Send quotes by email/ })
  await emailing.click()
  await expect(emailing).toBeChecked()

  await office.goto('/#jobs')
  await office.locator('.job-row', { hasText: 'Corrib Arts Week' }).click()
  await office.getByRole('tab', { name: 'Quote' }).click()
  await office.getByRole('button', { name: /^(Email quote|Send again)$/ }).click()
  const compose = office.getByRole('form', { name: 'Send the quote by email' })
  const message = compose.getByLabel('Message')
  await expect(message).not.toHaveValue('')

  await compose.getByRole('button', { name: 'Look at the email' }).click()
  const email = office.frameLocator('iframe[title="The email as the client will see it"]')
  await expect(email.locator('body')).toContainText('Corrib Arts Week')
  await expect(email.locator('body')).toContainText('Total including VAT')
  await expect(email.locator('body')).toContainText('is attached as a PDF')
  // As tall as the email, so the page scrolls rather than the frame.
  const frame = compose.locator('iframe.email-frame')
  expect((await frame.boundingBox())!.height).toBeGreaterThan(700)
  await frame.scrollIntoViewIfNeeded()
  if (process.env.SHOTS_DIR) await frame.screenshot({ path: `${process.env.SHOTS_DIR}/compose-email-look-phone.png` })

  // Changed: the email is drawn again on a press, with the new words.
  await message.fill('Hi Aisling,\n\nHere it is, with the stage added.\n\nAdam')
  await compose.getByRole('button', { name: 'Show my changes' }).click()
  await expect(email.locator('body')).toContainText('with the stage added')
  await expect(compose.getByRole('button', { name: 'Show my changes' })).toHaveCount(0)
  await compose.getByRole('button', { name: 'Hide the email' }).click()
  await expect(frame).toHaveCount(0)
})
