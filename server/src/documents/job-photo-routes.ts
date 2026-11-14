import { FILE_HEAD_BYTES, FILE_TOO_BIG, fileTypeOf, JOB_PHOTO_NOT_JPEG, JOB_PHOTOS_WAIT, jobPhotoDetails, MAX_FILE_BYTES, NO_FILE } from '@sh/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Db } from '../db.ts'
import { describeDevice } from '../devices.ts'
import { Refused } from '../kernel.ts'
import { FileGone, FileLocked, NotKept, type DocumentFiles } from './files.ts'
import { addJobPhoto, jobPhotoKeysOf } from './job-photos.ts'

/**
 * Photos of jobs (ADR 0182), put up and sent back through the server. The
 * phone sends both copies in one request, the small one first, so a photo
 * is never on a job without the copy its grid shows: the address says how
 * long the small one is. Each is checked by its first bytes to be a JPEG,
 * which is what the phone makes of any photo it can open. A photo is
 * shown, never run: sent as an image only, and kept by the browser for as
 * long as it likes, as its address never changes.
 */

/** The photo, its small copy, and room round them. */
const ROUTE_LIMIT = MAX_FILE_BYTES + 2 * 1024 * 1024

/** The largest side a photo's size in pixels can say: a big camera's, with room. */
const MAX_SIDE = 20_000

type AddReq = FastifyRequest<{ Params: { id: string }; Querystring: { client?: string; jobId?: string; caption?: string; tags?: string; thumb?: string; width?: string; height?: string } }>
type GetReq = FastifyRequest<{ Params: { id: string; size: string } }>

const isJpeg = (b: Buffer) => {
  const found = fileTypeOf(b.subarray(0, FILE_HEAD_BYTES))
  return !('refused' in found) && found.type === 'jpeg'
}

const whole = (s: string | undefined, max: number) => {
  const n = Number(s)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined
}

function readTags(s: string | undefined): unknown {
  if (!s) return []
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

export function registerJobPhotoRoutes(app: FastifyInstance, { db, files, onChange }: { db: Db; files: DocumentFiles; onChange: () => void }) {
  void app.register(async (scope) => {
    scope.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: ROUTE_LIMIT }, (_req, body, done) => done(null, body))

    scope.post('/api/job-photos/:id', { bodyLimit: ROUTE_LIMIT, config: { needs: 'photos' } }, async (req: AddReq, reply) => {
      if (!files.on) return reply.code(409).send({ error: JOB_PHOTOS_WAIT })
      const body = req.body
      if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: NO_FILE })
      const q = req.query
      const cut = whole(q.thumb, body.length - 1)
      const width = whole(q.width, MAX_SIDE)
      const height = whole(q.height, MAX_SIDE)
      if (!cut || !width || !height) return reply.code(400).send({ error: 'The photo came without its small copy or its size. Try again, or reload the app if it keeps happening.' })
      const thumb = body.subarray(0, cut)
      const full = body.subarray(cut)
      if (full.length > MAX_FILE_BYTES) return reply.code(413).send({ error: FILE_TOO_BIG })
      if (!isJpeg(thumb) || !isJpeg(full)) return reply.code(415).send({ error: JOB_PHOTO_NOT_JPEG })
      const details = jobPhotoDetails.safeParse({ id: req.params.id, jobId: q.jobId, caption: q.caption ?? '', tags: readTags(q.tags) })
      if (!details.success) return reply.code(400).send({ error: details.error.issues[0]?.message ?? 'Check the caption and tags, and try again.' })
      try {
        await addJobPhoto(db, files, details.data, Buffer.from(full), Buffer.from(thumb), { width, height, email: req.user?.email }, {
          clientId: q.client,
          userId: req.user?.id,
          device: describeDevice(req.headers['user-agent']),
        })
      } catch (err) {
        if (err instanceof Refused) return reply.code(409).send({ error: err.reason.message })
        if (err instanceof NotKept) return reply.code(502).send({ error: err.message })
        throw err
      }
      onChange()
      return { ok: true }
    })

    scope.get('/api/job-photos/:id/:size', async (req: GetReq, reply: FastifyReply) => {
      const notHere = () => reply.code(404).header('cache-control', 'no-store').send({ error: 'There is no photo here.' })
      const size = req.params.size
      if (size !== 'thumb' && size !== 'full') return notHere()
      const keys = await jobPhotoKeysOf(db.reads, req.params.id)
      if (!keys || !files.on) return notHere()
      let data: Buffer
      try {
        data = await files.read(size === 'thumb' ? keys.thumb : keys.full)
      } catch (err) {
        if (err instanceof FileGone || err instanceof FileLocked) return notHere()
        throw err
      }
      // Shown in the page, as an image only: nothing a browser could guess from, and nothing it could run.
      return reply
        .type('image/jpeg')
        .header('content-disposition', 'inline')
        .header('x-content-type-options', 'nosniff')
        .header('content-security-policy', "default-src 'none'; sandbox; frame-ancestors 'none'")
        .header('cache-control', 'private, max-age=31536000, immutable')
        .send(data)
    })
  })
}
