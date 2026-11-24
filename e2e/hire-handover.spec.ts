import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * How a dry hire is handed over, said where the work is done (user flows of 24 November 2026, gaps 1 and 2). A hire we
 * deliver is sent on to Transport by Next as a gig is, its van drives to the delivery address and is due there at the
 * hire's time, and the Transport tab says where and when. The pick list says who moves the kit, when, to where or to
 * whom, and when it's due back; a hire the client collects still isn't sent to Transport.
 */

const phoneSize = { width: 390, height: 844 }

async function push(request: APIRequestContext, id: string, mutations: [string, Record<string, unknown>][]) {
  const res = await request.post('/api/sync/push', {
    data: { clientId: `hire-handover-${id}`, mutations: mutations.map(([name, args], i) => ({ id: `hire-handover-${id}-${i}`, name, args, createdAt: new Date().toISOString() })) },
  })
  const { results } = (await res.json()) as { results: { status: string; reason?: { message: string } }[] }
  expect(results.map((r) => r.reason?.message ?? r.status)).toEqual(mutations.map(() => 'applied'))
}

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

test('a delivered dry hire goes on to Transport, its van drives to the delivery address, and the pick list says the handover', async ({ browser, request }) => {
  const id = Date.now().toString(36)
  const [out, back] = [inDays(20), inDays(22)]
  const plate = `241-G-${1000 + Math.floor(Math.random() * 9000)}`
  const kit = { phaseId: null, modelId: `hm-${id}`, qty: 2, subhireQty: 2, supplier: 'A friend', notes: '' }
  // Galway, on the map: far enough from Dublin that the drive is hours, so the van leaves well before 10:00.
  const hire = { handover: 'delivery', outTime: '10:00', backTime: '17:00', address: 'Galway Racecourse\nBallybrit', pin: { lat: 53.2985, lng: -8.9839 } }
  await push(request, id, [
    ['model.create', { id: `hm-${id}`, name: `Hire speaker ${id}`, department: 'audio', category: 'Speakers', tracking: 'bulk', isCase: false, valueCents: null, notes: '' }],
    ['vehicle.save', { id: `hv-${id}`, name: `Hire van ${id}`, registration: plate, kind: 'van', seats: 3, payloadKg: 1200, notes: '', checks: { test: { needed: true, expires: inDays(200) } } }],
    ['client.upsert', { id: `hc-${id}`, name: `Shannonside ${id}`, contacts: [{ name: 'Niamh Walsh', role: '', email: null, phone: '+353 87 123 4567' }], notes: '' }],
    ['project.create', { id: `hd-${id}`, name: `Delivered ${id}`, clientId: `hc-${id}`, venueId: null, status: 'confirmed', kind: 'hire', notes: '', hire }],
    ['phase.add', { id: `hdp-${id}`, projectId: `hd-${id}`, name: 'Hire', start: out, end: back, venueId: null, notes: '' }],
    ['kit.add', { id: `hdk-${id}`, projectId: `hd-${id}`, ...kit }],
    ['project.create', { id: `hx-${id}`, name: `Collected ${id}`, clientId: `hc-${id}`, venueId: null, status: 'confirmed', kind: 'hire', notes: '', hire: { handover: 'collection', outTime: '09:30', backTime: '16:00' } }],
    ['phase.add', { id: `hxp-${id}`, projectId: `hx-${id}`, name: 'Hire', start: out, end: back, venueId: null, notes: '' }],
    ['kit.add', { id: `hxk-${id}`, projectId: `hx-${id}`, ...kit }],
  ])
  const page = await (await browser.newContext({ viewport: phoneSize })).newPage()
  const next = page.getByRole('region', { name: 'Next' })

  // Delivered: from the Kit tab Next goes on to Transport, which says where it goes and when.
  await page.goto(`/#jobs/hd-${id}/kit`)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await next.getByRole('button', { name: 'Book transport' }).click()
  await expect(page.getByRole('tab', { name: /Transport/, selected: true })).toBeVisible()
  const vans = page.getByRole('region', { name: 'Vehicles' })
  await expect(vans).toContainText('We deliver this hire to Galway Racecourse, Ballybrit')
  await expect(vans).toContainText(/there by \w{3} \d{1,2} \w{3}, 10:00, brought back \w{3} \d{1,2} \w{3}, 17:00/)

  // The booking starts as the day it goes; the van is due at the address at the hire's time, and the drive is the map's.
  await vans.getByRole('button', { name: 'Book a vehicle' }).click()
  const form = vans.getByRole('form', { name: 'Book a vehicle' })
  await expect(form.getByLabel('From', { exact: true })).toHaveValue(out)
  await expect(form.getByLabel('To', { exact: true })).toHaveValue(out)
  await form.getByLabel('Vehicle').selectOption({ label: `Hire van ${id} (${plate})` })
  await expect(form.getByLabel('At the address by')).toBeVisible()
  await expect(form).toContainText('Blank: the hire’s time that day, 10:00.')
  await form.getByRole('button', { name: 'Book vehicle' }).click()
  await expect(vans.locator('.van-line .van-road')).toContainText(/^Leaves the warehouse about \d\d:\d\d \w{3} \d{1,2} \w{3}, to be there by 10:00 · about \d h( \d\d)? each way \(\d{3} km\)$/)
  // The form moves on to the day it comes back, due there at the hire's To time.
  await expect(form.getByLabel('From', { exact: true })).toHaveValue(back)
  await form.getByLabel('Vehicle').selectOption({ label: `Hire van ${id} (${plate})` })
  await expect(form).toContainText('Blank: the hire’s time that day, 17:00.')

  // The pick list says the handover: delivered by when and to where, and when it's brought back.
  await page.goto(`/#jobs/hd-${id}/pick`)
  const brief = page.getByRole('list', { name: 'Before you start' })
  await expect(brief).toContainText('Deliver by 10:00')
  await expect(brief).toContainText('to Galway Racecourse, Ballybrit')
  await expect(brief).toContainText('Due back: We bring it back 17:00')

  // Collected: who comes for it and their number, and Next doesn't send it to Transport.
  await page.goto(`/#jobs/hx-${id}/pick`)
  await expect(brief).toContainText(`Client collects 09:30`)
  await expect(brief).toContainText(`Shannonside ${id}, Niamh Walsh`)
  await expect(brief.getByRole('link', { name: '+353 87 123 4567' })).toHaveAttribute('href', 'tel:+353871234567')
  await expect(brief).toContainText('Due back: Client returns 16:00')
  await page.goto(`/#jobs/hx-${id}/kit`)
  await expect(next.getByRole('button', { name: 'Mark kit and vans settled' })).toBeVisible()
  await page.getByRole('tab', { name: /Transport/ }).click()
  await expect(page.getByRole('region', { name: 'Vehicles' })).toContainText('The client collects this hire')
})
