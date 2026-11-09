import { expect, test } from '@playwright/test'

/**
 * A quote from a day on the planner, and keys at a desk (ADR 0120). Uses the
 * made-up data (ADR 0019) for someone who sees money.
 */

const deskSize = { width: 1280, height: 900 }
const fresh = { data: { confirm: 'delete everything' } }

test('a day on the planner starts a quote on that day, from a card on the day', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const desk = await (await browser.newContext({ viewport: deskSize })).newPage()
  // This week, whose days from today on each offer one (made-up jobs fill it).
  await desk.goto('/#jobs/plan')
  const day = desk.getByRole('button', { name: /^New quote starting/ }).last()
  const on = /starting (.+)$/.exec((await day.getAttribute('aria-label'))!)![1]!
  await day.click()
  // The card opens on the day (ADR 0123), with the day filled in and the job's name waiting to be typed; the week stays where it was.
  const card = desk.getByRole('dialog', { name: `Quote starting ${on}` })
  await expect(card).toBeVisible()
  await expect(desk).toHaveURL(/#jobs\/plan/)
  await expect(card.getByLabel("What's the job?")).toBeFocused()
  const from = await card.getByLabel('From').inputValue()
  expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await expect(card.getByLabel('To')).toHaveValue(from)
  // Escape closes it and puts focus back on the day's button, as the design system's dialog does.
  await desk.keyboard.press('Escape')
  await expect(card).toHaveCount(0)
  await expect(day).toBeFocused()
  // More options carries what was typed to the full form on that day.
  await day.click()
  await card.getByLabel("What's the job?").fill('Quick launch')
  await card.getByRole('link', { name: 'More options' }).click()
  await expect(desk).toHaveURL(new RegExp(`#quotes/new/${from}$`))
  const form = desk.getByRole('form', { name: 'New quote' })
  await expect(form.getByLabel("What's the job?")).toHaveValue('Quick launch')
  await expect(form.getByLabel('From', { exact: true })).toHaveValue(from)
  await form.getByRole('button', { name: 'Cancel' }).click()
  // Starting from the card makes the job and its quote, and opens the quote, as the full form does.
  await desk.goto('/#jobs/plan')
  await day.click()
  await card.getByLabel("What's the job?").fill('Card launch')
  await card.getByRole('button', { name: 'Start the quote' }).click()
  await expect(desk).toHaveURL(/#jobs\/[^/]+\/quote$/)
  await expect(desk.getByRole('heading', { name: 'Card launch' })).toBeVisible()
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})

test('keys at a desk move around, start a quote, and stand down while typing', async ({ browser, request }) => {
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
  expect((await request.post('/api/data/made-up')).ok()).toBe(true)
  const desk = await (await browser.newContext({ viewport: deskSize })).newPage()
  await desk.goto('/#home')
  await expect(desk.getByRole('heading', { level: 1 })).toBeVisible()

  // Shown where the slow way is.
  const bar = desk.getByRole('navigation', { name: 'Areas' })
  await expect(bar.getByRole('link', { name: 'Jobs' })).toHaveAttribute('title', 'Shortcut: G then J')

  await desk.keyboard.press('g')
  await desk.keyboard.press('j')
  await expect(desk).toHaveURL(/#jobs$/)
  await desk.keyboard.press('g')
  await desk.keyboard.press('q')
  await expect(desk).toHaveURL(/#quotes$/)

  // N then Q opens New quote; typing in it is typing, not a shortcut.
  await desk.keyboard.press('n')
  await desk.keyboard.press('q')
  const form = desk.getByRole('form', { name: 'New quote' })
  await expect(form).toBeVisible()
  await form.getByLabel("What's the job?").pressSequentially('gj')
  await expect(form.getByLabel("What's the job?")).toHaveValue('gj')
  await expect(desk).toHaveURL(/#quotes\/new$/)

  // ? lists them; Escape shuts it.
  await form.getByLabel("What's the job?").blur()
  await desk.keyboard.press('?')
  const sheet = desk.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('definition')).toContainText(['Home', 'Jobs', 'The planner', 'Quotes'])
  await desk.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)

  // Not on a phone.
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await phone.goto('/#home')
  await expect(phone.getByRole('heading', { level: 1 })).toBeVisible()
  await phone.keyboard.press('g')
  await phone.keyboard.press('j')
  await expect(phone).toHaveURL(/#home$/)
  expect((await request.post('/api/data/start-fresh', fresh)).ok()).toBe(true)
})
