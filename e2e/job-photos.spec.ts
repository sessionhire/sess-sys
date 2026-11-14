import { expect, test } from '@playwright/test'
import { jobWithPhase } from './ask.ts'

/**
 * Photos of a job (ADR 0182): several picked at once on a phone go up with
 * their tags, open whole over the page, are found under Jobs › Photos by a
 * tag, and come off again after a question. Every name here is this run's own.
 */

const phoneSize = { width: 390, height: 844 }
const id = Math.random().toString(36).slice(2, 8)
/** A small PNG, as a phone's photo picker would hand one over; the phone makes a JPEG of it. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4YWRDEmIY1TCqYfhqAABa5TYQf4CqjAAAAABJRU5ErkJggg==',
  'base64'
)

test('photos go on a job several at a time, open whole, show under Jobs › Photos, and come off', async ({ browser }) => {
  const name = `Picnic Photos ${id}`
  const context = await browser.newContext({ viewport: phoneSize })
  const jobId = await jobWithPhase(context.request, { name, start: '2026-08-29' })
  const page = await context.newPage()
  await page.goto(`/#jobs/${jobId}/photos`)
  const card = page.getByRole('region', { name: 'Photos', exact: true })
  await expect(card.getByRole('heading', { name: 'Photos' })).toBeVisible()

  await card.getByRole('button', { name: 'Tags and a caption for them' }).click()
  await card.getByRole('group', { name: 'Tags for the photos you add' }).getByRole('button', { name: 'Lighting' }).click()
  await card.getByPlaceholder('Another tag').fill(`Tent ${id}`)
  await card.getByRole('button', { name: 'Add tag' }).click()
  await card.getByLabel(/Caption for them/).fill('Main stage at dusk')
  await card.getByText('Add photos').locator('input[type=file]').setInputFiles([
    { name: 'IMG_1.png', mimeType: 'image/png', buffer: PNG },
    { name: 'IMG_2.png', mimeType: 'image/png', buffer: PNG },
  ])
  await expect(card.getByText('Added 2 photos.')).toBeVisible()
  const grid = card.getByRole('list', { name: `Photos of ${name}` })
  await expect(grid.getByRole('listitem')).toHaveCount(2)
  await expect(page.getByRole('tab', { name: /^Photos/ })).toContainText('2')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phoneSize.width)
  await page.screenshot({ path: 'test-results/job-photos-tab-phone.png', fullPage: true })

  await grid.getByRole('button', { name: /^Open photo 1 of 2/ }).click()
  const viewer = page.getByRole('dialog')
  await expect(viewer.getByText('1 of 2')).toBeVisible()
  await expect(viewer.getByText('Main stage at dusk')).toBeVisible()
  await viewer.getByRole('button', { name: 'The next photo' }).click()
  await expect(viewer.getByText('2 of 2')).toBeVisible()
  await page.screenshot({ path: 'test-results/job-photos-viewer-phone.png' })
  await viewer.getByRole('button', { name: 'Close' }).click()

  await page.goto('/#jobs/photos')
  await page.getByLabel('Find photos').fill(`tent ${id}`)
  await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible()
  await expect(page.getByText('2 photos from 1 job')).toBeVisible()
  await page.screenshot({ path: 'test-results/job-photos-library-phone.png', fullPage: true })

  await page.goto(`/#jobs/${jobId}/photos`)
  await grid.getByRole('button', { name: /^Open photo 2 of 2/ }).click()
  await viewer.getByRole('button', { name: 'Take photo off' }).click()
  await viewer.getByRole('button', { name: 'Take it off' }).click()
  await expect(grid.getByRole('listitem')).toHaveCount(1)
  await context.close()
})
