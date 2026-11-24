import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addDays, jobPhotoPath, LINK_PHOTOS_AT_ONCE, newId, type CommandInput, type CommandName, type JobPhoto, type Mutation } from '@sh/shared'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { dirStore } from '../src/backup/store.ts'
import { PHOTOS_SCRIPT } from '../src/crew/photos-page.ts'
import { jpegSize } from '../src/documents/jpeg.ts'
import { scriptHash } from '../src/http.ts'
import { scratchDb } from './scratch-db.ts'

/**
 * Photos of a job from a freelancer's own link (user flows of 24 November
 * 2026, gap 11): offered on their page for a booking from its first day
 * until a week after its last, sent as the page's script sends them (each
 * photo's small copy, then the photo), onto the job with their name, and
 * turned away for anyone else's booking, outside those days, or with
 * nowhere to keep them.
 */

const cleanup: (() => Promise<void> | void)[] = []
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn()
})

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' })

/** A JPEG as a phone's canvas makes one: its start, a JFIF block, then the frame that says its size. */
const jpeg = (width: number, height: number, what = 'pixels') => {
  const frame = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01])
  const jfif = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, frame, Buffer.from(what)])
}
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('a screenshot')])

const m = <N extends CommandName>(name: N, args: CommandInput<N>): Mutation => ({ id: newId(), name, args, createdAt: new Date().toISOString() }) as Mutation

async function show({ start = addDays(today, -1), end = today, store = true }: { start?: string; end?: string; store?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sh-link-photos-'))
  const db = await scratchDb()
  const app = await buildApp({ db, ...(store ? { documentStore: dirStore(dir) } : {}) })
  cleanup.push(async () => {
    await app.close()
    await db.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const send = async (...mutations: Mutation[]) => {
    const res = await app.inject({ method: 'POST', url: '/api/sync/push', payload: { clientId: 'office', mutations } })
    for (const r of res.json().results) expect(r.status === 'applied' ? 'applied' : JSON.stringify(r)).toBe('applied')
  }
  const person = (id: string, name: string) => m('person.upsert', { id, name, kind: 'freelancer', email: `${id}@example.com`, phone: null, skills: [], dayRateCents: 30000, notes: '' })
  const call = (id: string, projectId: string | null, project: string) =>
    m('call.create', { id, projectId, phaseId: null, project, phase: '', venue: '', role: 'Stagehand', start, end, callTime: null, needed: 2, dayRateCents: 30000, details: '', replyBy: null })
  await send(
    m('project.create', { id: 'harbour', name: 'Harbour Lights', clientId: null, venueId: null, status: 'confirmed', kind: 'gig', notes: '' }),
    person('dara', 'Dara Quinn'),
    person('eimear', 'Eimear Nolan'),
    call('hands', 'harbour', 'Harbour Lights'),
    m('offer.send', { id: 'o-dara', callId: 'hands', personId: 'dara', override: true }),
    m('offer.respond', { id: 'o-dara', answer: 'accept', days: null, note: '' }),
    m('offer.confirm', { id: 'o-dara' }),
    // Offered, never answered: not a booking.
    m('offer.send', { id: 'o-eimear', callId: 'hands', personId: 'eimear', override: true })
  )
  const token = async (id: string) => (await db.query<{ link_token: string }>('SELECT link_token FROM people WHERE id = $1', [id])).rows[0]!.link_token
  const page = async (url: string) => {
    const res = await app.inject({ url })
    return { status: res.statusCode, html: res.body.replace(/&#39;/g, "'"), to: res.headers.location as string | undefined, policy: String(res.headers['content-security-policy'] ?? '') }
  }
  /** The form as the page's script sends it: an id, then each photo's small copy and the photo, all as "file". */
  const post = async (url: string, files: Buffer[], id = newId()) => {
    const boundary = '----photos' + newId()
    const part = (head: string, body: Buffer) => Buffer.concat([Buffer.from(`--${boundary}\r\n${head}\r\n\r\n`), body, Buffer.from('\r\n')])
    const payload = Buffer.concat([
      part('Content-Disposition: form-data; name="id"', Buffer.from(id)),
      ...files.map((f, i) => part(`Content-Disposition: form-data; name="file"; filename="${i % 2 ? 'photo' : 'small'}.jpg"\r\nContent-Type: image/jpeg`, f)),
      Buffer.from(`--${boundary}--\r\n`),
    ])
    const res = await app.inject({ method: 'POST', url, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload })
    expect(res.statusCode).toBe(303)
    return page(res.headers.location as string)
  }
  const photos = async (): Promise<JobPhoto[]> => {
    const res = await app.inject({ url: '/api/sync/pull?after=0' })
    const last = new Map<string, JobPhoto | null>()
    for (const c of res.json().changes) if (c.entity === 'jobPhoto') last.set(c.id, c.data)
    return [...last.values()].filter((p): p is JobPhoto => !!p)
  }
  return { app, db, send, token, page, post, photos, call }
}

describe("a JPEG's size", () => {
  it('is read from its frame, and is nothing for what is not a JPEG or has no frame', () => {
    expect(jpegSize(jpeg(2560, 1707))).toEqual({ width: 2560, height: 1707 })
    expect(jpegSize(PNG)).toBeUndefined()
    expect(jpegSize(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('not much of a photo')]))).toBeUndefined()
    expect(jpegSize(Buffer.from([0xff, 0xd8]))).toBeUndefined()
  })
})

describe('photos from a freelancer’s own link', () => {
  it('are offered on their page for a booking, sent with their small copies, and land on the job with their name', async () => {
    // Proves: Dara, booked on Harbour Lights yesterday and today, finds "Add photos" on his page, sends two, and the
    // office sees both on the job as his; sending the same form twice puts them up once.
    const { app, token, page, post, photos } = await show()
    const dara = await token('dara')
    const home = await page(`/f/${dara}`)
    expect(home.html).toContain(`/f/${dara}/photos/o-dara`)
    expect(home.html).toContain('Add photos of Harbour Lights')

    const form = await page(`/f/${dara}/photos/o-dara`)
    expect(form.status).toBe(200)
    expect(form.html).toContain('Photos of Harbour Lights')
    expect(form.html).toContain(`Up to ${LINK_PHOTOS_AT_ONCE} at a time`)
    // The form waits behind a line until its script has run, and the page's policy lets that script in by its hash.
    expect(form.html).toMatch(/<form id="add-photos"[^>]* hidden>/)
    expect(form.policy).toContain(scriptHash(PHOTOS_SCRIPT))
    expect(form.html).toContain(`<script>${PHOTOS_SCRIPT}</script>`)

    const id = newId()
    const sent = await post(`/f/${dara}/photos/o-dara`, [jpeg(720, 480, 'small one'), jpeg(2560, 1707, 'photo one'), jpeg(480, 720, 'small two'), jpeg(1707, 2560, 'photo two')], id)
    expect(sent.html).toContain('2 photos are on the job. Thanks.')
    expect(sent.html).toContain("You've put 2 photos on this job.")
    const on = await photos()
    expect(on).toHaveLength(2)
    expect(on.map((p) => [p.jobId, p.addedBy, p.width, p.height]).sort()).toEqual([
      ['harbour', 'dara', 1707, 2560],
      ['harbour', 'dara', 2560, 1707],
    ])
    // Both copies come back as images to anyone in the app.
    const first = on.find((p) => p.width === 2560)!
    expect((await app.inject({ url: jobPhotoPath(first.id, 'thumb') })).rawPayload.equals(jpeg(720, 480, 'small one'))).toBe(true)
    expect((await app.inject({ url: jobPhotoPath(first.id, 'full') })).rawPayload.equals(jpeg(2560, 1707, 'photo one'))).toBe(true)

    await post(`/f/${dara}/photos/o-dara`, [jpeg(720, 480, 'small one'), jpeg(2560, 1707, 'photo one'), jpeg(480, 720, 'small two'), jpeg(1707, 2560, 'photo two')], id)
    expect(await photos()).toHaveLength(2)
    // The history says it came by his link.
    const history = await app.inject({ url: '/api/history' })
    expect(JSON.stringify(history.json())).toContain('Dara Quinn')
  })

  it('leaves out what is not a photo and says how many went, and says so when none did', async () => {
    const { token, post, photos } = await show()
    const dara = await token('dara')
    const mixed = await post(`/f/${dara}/photos/o-dara`, [jpeg(720, 480), jpeg(2560, 1707), PNG, PNG])
    expect(mixed.html).toContain("1 photo is on the job. 1 couldn't be kept: try it again.")
    expect(await photos()).toHaveLength(1)
    const none = await post(`/f/${dara}/photos/o-dara`, [PNG, PNG])
    expect(none.html).toContain("Those weren't photos the job can keep.")
    const empty = await post(`/f/${dara}/photos/o-dara`, [])
    expect(empty.html).toContain('No photos came with that.')
    expect(await photos()).toHaveLength(1)
  })

  it('is only for their own booking: an offer never answered, someone else’s, or a call on no job gets no way in', async () => {
    const { send, call, token, page, post, photos } = await show()
    const [dara, eimear] = [await token('dara'), await token('eimear')]
    expect((await page(`/f/${eimear}`)).html).not.toContain('/photos/')
    // Her own offer, not yet a booking: the page says when photos can be added, and a post puts nothing up.
    expect((await page(`/f/${eimear}/photos/o-eimear`)).html).toContain("from a booking's first day until a week after its last")
    expect((await post(`/f/${eimear}/photos/o-eimear`, [jpeg(720, 480), jpeg(2560, 1707)])).html).toContain("from a booking's first day until a week after its last")
    // Dara's booking through her link: back to her own page.
    const others = await page(`/f/${eimear}/photos/o-dara`)
    expect(others.status).toBe(303)
    expect(others.to).toBe(`/f/${eimear}`)
    // A call that isn't part of a job has nowhere for photos to go.
    await send(
      call('loose', null, 'Warehouse day'),
      m('offer.send', { id: 'o-loose', callId: 'loose', personId: 'eimear', override: true }),
      m('offer.respond', { id: 'o-loose', answer: 'accept', days: null, note: '' })
    )
    expect((await page(`/f/${eimear}/photos/o-loose`)).status).toBe(303)
    expect((await page(`/f/${eimear}`)).html).not.toContain('/photos/')
    expect((await page(`/f/${dara}`)).html).toContain('/photos/o-dara')
    expect(await photos()).toHaveLength(0)
  })

  it('opens on the first day and closes a week after the last', async () => {
    const ahead = await show({ start: addDays(today, 1), end: addDays(today, 2) })
    const soon = await ahead.token('dara')
    expect((await ahead.page(`/f/${soon}`)).html).not.toContain('/photos/')
    expect((await ahead.post(`/f/${soon}/photos/o-dara`, [jpeg(720, 480), jpeg(2560, 1707)])).html).toContain("from a booking's first day until a week after its last")
    expect(await ahead.photos()).toHaveLength(0)

    const lastDay = await show({ start: addDays(today, -9), end: addDays(today, -7) })
    const still = await lastDay.token('dara')
    expect((await lastDay.page(`/f/${still}`)).html).toContain('/photos/o-dara')
    expect((await lastDay.post(`/f/${still}/photos/o-dara`, [jpeg(720, 480), jpeg(2560, 1707)])).html).toContain('1 photo is on the job.')

    const over = await show({ start: addDays(today, -10), end: addDays(today, -8) })
    const late = await over.token('dara')
    expect((await over.page(`/f/${late}`)).html).not.toContain('/photos/')
    expect((await over.page(`/f/${late}/photos/o-dara`)).html).not.toContain('id="add-photos"')
  })

  it('says so, and offers nothing on their page, where the server has nowhere to keep files', async () => {
    const { token, page, post, photos } = await show({ store: false })
    const dara = await token('dara')
    expect((await page(`/f/${dara}`)).html).not.toContain('/photos/')
    expect((await page(`/f/${dara}/photos/o-dara`)).html).toContain("Photos can't be kept here yet.")
    expect((await post(`/f/${dara}/photos/o-dara`, [jpeg(720, 480), jpeg(2560, 1707)])).html).toContain("Photos can't be kept here yet.")
    expect(await photos()).toHaveLength(0)
  })
})
