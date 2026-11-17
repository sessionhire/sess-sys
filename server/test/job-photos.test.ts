import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JOB_PHOTO_NOT_JPEG, JOB_PHOTO_NOT_YOURS, JOB_PHOTOS_WAIT, jobPhotoPath, type JobPhoto } from '@sh/shared'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { dirStore } from '../src/backup/store.ts'
import { IPHONE, server, staff } from './people.ts'

/**
 * Photos of jobs (ADR 0182): put up from a phone with a small copy, kept
 * in the storage as documents' files are, read back by everyone signed
 * in, captioned and tagged by staff, taken down by whoever put one up or
 * the office, moved with the job when jobs are joined, and gone from the
 * storage when they're taken down.
 */

const folders: string[] = []
afterEach(() => {
  for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true })
})

const jpeg = (what: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(what)])
const THUMB = jpeg('a small made-up stage')
const FULL = jpeg('a whole made-up stage, much bigger than its small copy')
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('a screenshot')])

const person = (id: string, name: string) => ({ id, name, kind: 'staff' as const, email: `${id}@sessionhire.com`, phone: '+353871234567', skills: [], dayRateCents: null, notes: '' })

async function company(withStore = true) {
  const dir = mkdtempSync(join(tmpdir(), 'sh-job-photos-'))
  folders.push(dir)
  const { app, db } = await server(withStore ? { documentStore: dirStore(dir) } : {})
  const colly = await staff(app, db, 'Colly Hewson', IPHONE, 'phonec0ffee')
  const sean = await staff(app, db, 'Sean Walsh', IPHONE, 'phonebeef')
  for (const p of [person('colly', 'Colly Hewson'), person('sean', 'Sean Walsh')]) expect(await colly.send('person.upsert', p)).toMatchObject({ status: 'applied' })
  for (const [id, name] of [
    ['picnic', 'Electric Picnic'],
    ['picnic-lx', 'Electric Picnic LX'],
  ] as const)
    expect(await colly.send('project.create', { id, name, clientId: null, venueId: null, status: 'confirmed', kind: 'gig', notes: '' })).toMatchObject({ status: 'applied' })
  const put = (id: string, o: { job?: string; caption?: string; tags?: string[]; thumb?: Buffer; full?: Buffer; cookies?: Record<string, string> } = {}) => {
    const thumb = o.thumb ?? THUMB
    const q = new URLSearchParams({ client: 'phonec0ffee', jobId: o.job ?? 'picnic', caption: o.caption ?? '', tags: JSON.stringify(o.tags ?? []), thumb: String(thumb.length), width: '2560', height: '1707' })
    return app.inject({
      method: 'POST',
      url: `/api/job-photos/${id}?${q}`,
      headers: { 'content-type': 'application/octet-stream', 'user-agent': IPHONE },
      cookies: o.cookies ?? colly.cookies,
      payload: Buffer.concat([thumb, o.full ?? FULL]),
    })
  }
  const show = (id: string, size: 'thumb' | 'full', cookies = colly.cookies) => app.inject({ url: jobPhotoPath(id, size), cookies })
  const files = async () => {
    await app.documents.tidy()
    const docs = join(dir, 'documents')
    return existsSync(docs) ? readdirSync(docs) : []
  }
  return { app, db, colly, sean, put, show, files }
}

const photoOf = async (app: FastifyInstance, cookies: Record<string, string>, id: string): Promise<JobPhoto | null | undefined> => {
  const res = await app.inject({ url: '/api/sync/pull?after=0', cookies })
  const copies = res.json().changes.filter((c: { entity: string; id: string }) => c.entity === 'jobPhoto' && c.id === id)
  return copies.length ? copies[copies.length - 1].data : undefined
}

describe('photos of a job', () => {
  it('are put up with a small copy, sent back as images, captioned and taken down, leaving nothing in the storage', async () => {
    const { app, colly, put, show, files } = await company()
    const res = await put('p1', { caption: '  Main stage at dusk ', tags: ['Lighting', 'lighting', ' Stage  '] })
    expect(res.statusCode).toBe(200)
    const p = await photoOf(app, colly.cookies, 'p1')
    expect(p).toMatchObject({ jobId: 'picnic', caption: 'Main stage at dusk', tags: ['Lighting', 'Stage'], width: 2560, height: 1707, bytes: THUMB.length + FULL.length, addedBy: 'colly' })
    // Devices never hear where it's kept.
    expect(JSON.stringify((await app.inject({ url: '/api/sync/pull?after=0', cookies: colly.cookies })).json())).not.toContain('documents/')
    expect(await files()).toHaveLength(2)

    const small = await show('p1', 'thumb')
    expect(small.statusCode).toBe(200)
    expect(small.headers['content-type']).toBe('image/jpeg')
    expect(small.headers['content-disposition']).toBe('inline')
    expect(small.headers['x-content-type-options']).toBe('nosniff')
    expect(small.headers['cache-control']).toContain('immutable')
    expect(small.rawPayload.equals(THUMB)).toBe(true)
    expect((await show('p1', 'full')).rawPayload.equals(FULL)).toBe(true)

    expect(await colly.send('jobPhoto.save', { id: 'p1', caption: 'Main stage, Saturday', tags: ['Show clients'] })).toMatchObject({ status: 'applied' })
    expect(await photoOf(app, colly.cookies, 'p1')).toMatchObject({ caption: 'Main stage, Saturday', tags: ['Show clients'] })

    expect(await colly.send('jobPhoto.remove', { id: 'p1' })).toMatchObject({ status: 'applied' })
    expect(await photoOf(app, colly.cookies, 'p1')).toBeNull()
    expect((await show('p1', 'thumb')).statusCode).toBe(404)
    expect(await files()).toHaveLength(0)

    const said = (await colly.history()).entries.map((e) => e.what)
    expect(said).toEqual(
      expect.arrayContaining(['Put a photo on Electric Picnic: “Main stage at dusk”', 'Changed what a photo of Electric Picnic says: “Main stage, Saturday”', 'Took a photo off Electric Picnic: “Main stage, Saturday”'])
    )
  })

  it('takes only JPEGs with their small copy, never replaces one, and says so when there is nowhere to keep them', async () => {
    const { put, files } = await company()
    const png = await put('p1', { full: PNG })
    expect(png.statusCode).toBe(415)
    expect(png.json().error).toBe(JOB_PHOTO_NOT_JPEG)
    expect((await put('p1', { job: 'gone' })).statusCode).toBe(409)
    expect(await files()).toHaveLength(0)
    expect((await put('p1')).statusCode).toBe(200)
    expect((await put('p1')).statusCode).toBe(409)
    expect(await files()).toHaveLength(2)

    const none = await company(false)
    const res = await none.put('p1')
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe(JOB_PHOTOS_WAIT)
  })

  it('are put up by any member of staff, taken down by whoever put one up or the office, and seen by freelancers', async () => {
    const { app, colly, sean, put, show } = await company()
    expect(await colly.send('person.role', { id: 'colly', role: 'director' })).toMatchObject({ status: 'applied' })
    expect(await colly.send('person.role', { id: 'sean', role: 'crew' })).toMatchObject({ status: 'applied' })
    expect((await put('mine', { cookies: sean.cookies })).statusCode).toBe(200)
    expect(await photoOf(app, colly.cookies, 'mine')).toMatchObject({ addedBy: 'sean' })
    expect((await put('theirs')).statusCode).toBe(200)
    expect(await sean.send('jobPhoto.save', { id: 'theirs', caption: 'Front of house', tags: [] })).toMatchObject({ status: 'applied' })
    expect(await sean.send('jobPhoto.remove', { id: 'theirs' })).toMatchObject({ status: 'rejected', reason: { message: JOB_PHOTO_NOT_YOURS } })
    expect(await sean.send('jobPhoto.remove', { id: 'mine' })).toMatchObject({ status: 'applied' })

    expect(await colly.send('person.role', { id: 'sean', role: 'freelancer' })).toMatchObject({ status: 'applied' })
    const refused = await put('more', { cookies: sean.cookies })
    expect(refused.statusCode).toBe(403)
    expect(refused.json().error).toContain('can put photos on a job')
    expect((await photoOf(app, sean.cookies, 'theirs'))?.caption).toBe('Front of house')
    expect((await show('theirs', 'thumb', sean.cookies)).statusCode).toBe(200)
  })

  it('go with the job kept when jobs are joined', async () => {
    const { app, colly, put, files } = await company()
    expect((await put('lx', { job: 'picnic-lx' })).statusCode).toBe(200)
    expect(await colly.send('project.merge', { id: 'picnic', from: ['picnic-lx'], name: 'Electric Picnic' })).toMatchObject({ status: 'applied' })
    expect(await photoOf(app, colly.cookies, 'lx')).toMatchObject({ jobId: 'picnic' })
    expect(await files()).toHaveLength(2)
  })
})
