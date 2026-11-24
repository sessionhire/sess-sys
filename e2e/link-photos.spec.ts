import { expect, test } from '@playwright/test'
import { jobWithPhase } from './ask.ts'

/**
 * Photos of a job from a freelancer's own link (user flows of 24 November
 * 2026, gap 11): on a phone, someone booked on a job today finds "Add
 * photos" on their page, picks two, and they go on the job with their name,
 * where the office sees them. The page's script makes each photo's two
 * copies on the phone, under the page's strict policy. With script off the
 * page says to send them to the office instead. Every name here is this
 * run's own.
 */

const phoneSize = { width: 390, height: 844 }
const id = Math.random().toString(36).slice(2, 8)
/** A small PNG, as a phone's photo picker would hand one over; the page makes JPEGs of it. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4YWRDEmIY1TCqYfhqAABa5TYQf4CqjAAAAABJRU5ErkJggg==',
  'base64'
)

test('a freelancer puts photos on the job they’re on from their own page, and the office sees them with their name', async ({ browser, request }) => {
  const job = `Quay Photos ${id}`
  const name = `Dervla Photos ${id}`
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' })
  const jobId = await jobWithPhase(request, { name: job, start: today })
  const push = async (...mutations: { name: string; args: unknown }[]) => {
    const res = await request.post('/api/sync/push', {
      data: { clientId: `e2e${id}`, mutations: mutations.map((m, i) => ({ id: `${id}lp${Date.now().toString(36)}${i}`, ...m, createdAt: new Date().toISOString() })) },
    })
    for (const r of (await res.json()).results) expect(r.status === 'applied' ? 'applied' : JSON.stringify(r)).toBe('applied')
  }
  await push(
    { name: 'person.upsert', args: { id: `p${id}`, name, kind: 'freelancer', email: `dervla-${id}@example.com`, phone: null, skills: [], dayRateCents: 30000, notes: '' } },
    { name: 'call.create', args: { id: `c${id}`, projectId: jobId, phaseId: null, project: job, phase: '', venue: '', role: 'Stagehand', start: today, end: today, callTime: null, needed: 1, dayRateCents: 30000, details: '', replyBy: null } },
    { name: 'offer.send', args: { id: `o${id}`, callId: `c${id}`, personId: `p${id}`, override: true } },
    { name: 'offer.respond', args: { id: `o${id}`, answer: 'accept', days: null, note: '' } },
    { name: 'offer.confirm', args: { id: `o${id}` } }
  )
  const { changes } = (await (await request.get('/api/sync/pull?after=0')).json()) as { changes: { entity: string; id: string; data: { linkToken: string } }[] }
  const link = `/f/${changes.filter((c) => c.entity === 'person' && c.id === `p${id}`).pop()!.data.linkToken}`

  const context = await browser.newContext({ viewport: phoneSize })
  const phone = await context.newPage()
  const refused: string[] = []
  phone.on('console', (m) => {
    if (m.type() === 'error') refused.push(m.text())
  })
  await phone.goto(link)
  await phone.getByRole('link', { name: `Add photos of ${job}` }).click()
  await expect(phone.getByRole('heading', { name: `Photos of ${job}`, level: 1 })).toBeVisible()
  // The script has run: the form shows, and the line for a browser that can't is gone.
  await expect(phone.getByText("This browser can't get photos ready")).toBeHidden()
  await phone.getByLabel('Choose photos').setInputFiles([
    { name: 'IMG_1.png', mimeType: 'image/png', buffer: PNG },
    { name: 'IMG_2.png', mimeType: 'image/png', buffer: PNG },
  ])
  await expect(phone.getByText('2 photos chosen.')).toBeVisible()
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phoneSize.width)
  await phone.screenshot({ path: 'test-results/link-photos-form-phone.png', fullPage: true })
  await phone.getByRole('button', { name: 'Add photos' }).click()
  await expect(phone.getByRole('status').filter({ hasText: '2 photos are on the job. Thanks.' })).toBeVisible()
  await expect(phone.getByText("You've put 2 photos on this job.")).toBeVisible()
  await phone.screenshot({ path: 'test-results/link-photos-sent-phone.png', fullPage: true })
  // Nothing the page did was turned away by its content security policy.
  expect(refused.filter((t) => /Content Security Policy|Refused/i.test(t))).toEqual([])

  // The office: both on the job's Photos tab, as JPEGs with a small copy each, and whose they are when one is opened.
  const office = await context.newPage()
  await office.goto(`/#jobs/${jobId}/photos`)
  const grid = office.getByRole('region', { name: 'Photos', exact: true }).getByRole('list', { name: `Photos of ${job}` })
  await expect(grid.getByRole('listitem')).toHaveCount(2)
  await grid.getByRole('button', { name: /^Open photo 1 of 2/ }).click()
  await expect(office.getByRole('dialog')).toContainText(name)
  await context.close()

  // With script off, the form never shows and the page says what to do instead.
  const plain = await (await browser.newContext({ viewport: phoneSize, javaScriptEnabled: false })).newPage()
  await plain.goto(`${link}/photos/o${id}`)
  await expect(plain.getByText("This browser can't get photos ready to send from here. Send them to the office instead.")).toBeVisible()
  await expect(plain.getByRole('button', { name: 'Add photos' })).toBeHidden()
})
