import { expect, test } from '@playwright/test'
import type { RmsMembersStatus } from '../shared/src/rms-members.ts'

/**
 * Clients and venues from Current RMS on Admin (ADR 0136): the card says what filling in would do, each kind opening in
 * place, and the tick to add those on Current RMS's quotes changes the count on the button. The server's answer is stood
 * in for, since the browser tests have no Current RMS; the server's side is in server/test/rms-members.test.ts.
 */

const phoneSize = { width: 390, height: 844 }

const status: RmsMembersStatus = {
  configured: true,
  running: null,
  last: { startedAt: '2026-11-09T10:00:00.000Z', finishedAt: '2026-11-09T10:02:00.000Z', members: 812, error: null, stopped: false },
  counts: { organisations: 640, venues: 120, contacts: 52 },
  plan: {
    clients: {
      fill: [
        {
          id: 'aiken',
          name: 'Aiken Promotions',
          rmsId: 11,
          address: 'Unit 4, Docklands\nDublin 1',
          contacts: [{ name: 'Accounts', role: '', email: 'accounts@aiken.ie', phone: null }],
        },
      ],
      add: [{ rmsId: 13, name: 'Wexford Arts Centre', address: 'Cornmarket\nWexford', contacts: [] }],
      same: 40,
      neverQuoted: 590,
    },
    venues: {
      fill: [{ id: '3arena', name: '3Arena', rmsId: 21, contacts: [{ name: 'Production office', role: '', email: 'production@3arena.ie', phone: null }] }],
      add: [{ rmsId: 22, name: 'Vicar Street', address: '58-59 Thomas St\nDublin 8', contacts: [] }],
      same: 12,
      neverQuoted: 100,
    },
  },
}

test('the card says what filling in would do before anything changes', async ({ browser }) => {
  const page = await browser.newPage({ viewport: phoneSize })
  await page.route('**/api/rms/members', (route) => route.fulfill({ json: status }))
  await page.route('**/api/rms', (route) => route.fulfill({ json: { configured: true, subdomain: 'sessionhire', running: null, last: null, opportunities: 0, lines: 0 } }))
  await page.goto('/#admin/connections')
  const card = page.getByRole('region', { name: 'Clients and venues from Current RMS' })
  await expect(card).toBeVisible()
  await expect(card.getByText('40 already have what Current RMS has')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Fill in 2 clients and venues' })).toBeVisible()

  await card.getByText('to fill in').first().click()
  await expect(card.getByText('address Unit 4, Docklands, Dublin 1; contact Accounts, accounts@aiken.ie')).toBeVisible()

  await card.getByLabel("Also add the 2 on Current RMS's quotes that aren't here yet").check()
  await expect(card.getByRole('button', { name: 'Fill in 4 clients and venues' })).toBeVisible()

  // Nothing wider than the phone: the lists grow the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (process.env.SHOTS) await card.screenshot({ path: 'docs/screens/rms-members-phone.png' })
  await page.close()
})
