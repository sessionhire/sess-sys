import { FILE_HEAD_BYTES, fileTypeOf, kindOf, linkPhotosUntil, LINK_PHOTOS_AT_ONCE, MAX_FILE_BYTES, type CrewCall, type Offer, type Person } from '@sh/shared'
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { renderGone } from '../crew/page.ts'
import { PHOTOS_SAID, photosSent, renderPhotos, type PhotosSaid } from '../crew/photos-page.ts'
import { getCall, getOffer, personByToken } from '../crew/store.ts'
import type { Db } from '../db.ts'
import { describeDevice } from '../devices.ts'
import { publicOrigin } from '../http.ts'
import { Refused } from '../kernel.ts'
import { officeFor } from '../office/store.ts'
import { getProject } from '../projects/store.ts'
import { NotKept, type DocumentFiles } from './files.ts'
import { NotAForm, readForm } from './form.ts'
import { addJobPhoto } from './job-photos.ts'
import { jpegSize } from './jpeg.ts'

/**
 * Photos of a job from a freelancer's own link (user flows of 24 November
 * 2026, gap 11): a page for one of their bookings, and its form. The page's
 * script sends each photo as two files, its small copy then the photo
 * (crew/photos-page.ts), up to ten photos a send. Each is checked to be a
 * JPEG by its first bytes and its size read from its own header; one that
 * isn't is left out and the rest go on. They go on the booking's job with
 * the person's name, as their own link's doing in the history.
 */

/** Ten photos with their small copies, and room for a phone that sends them larger than asked. */
const ROUTE_LIMIT = 40 * 1024 * 1024

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' })

type Req = FastifyRequest<{ Params: { token: string; id: string }; Querystring: { m?: string; n?: string; x?: string } }>

const isJpeg = (b: Buffer) => {
  const found = fileTypeOf(b.subarray(0, FILE_HEAD_BYTES))
  return !('refused' in found) && found.type === 'jpeg'
}

const count = (s: string | undefined) => {
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 && n <= LINK_PHOTOS_AT_ONCE ? n : 0
}

/** The booking, when it's this person's, with its call and the job's name. */
async function bookingOf(db: Db, person: Person, offerId: string): Promise<{ offer: Offer; call: CrewCall; jobId: string; job: string } | undefined> {
  const offer = await getOffer(db, offerId)
  const call = offer && offer.personId === person.id ? await getCall(db, offer.callId) : undefined
  if (!offer || !call?.projectId) return undefined
  const job = await getProject(db, call.projectId)
  // Errands and meetings have no Photos (ADR 0182).
  if (!job || kindOf(job) === 'errand' || kindOf(job) === 'meeting') return undefined
  return { offer, call, jobId: job.id, job: job.name }
}

export function registerLinkPhotoRoutes(app: FastifyInstance, { db, files, onChange }: { db: Db; files: DocumentFiles; onChange: () => void }) {
  const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store').header('x-robots-tag', 'noindex')
  const base = (req: FastifyRequest, token: string) => `${publicOrigin(req)}/f/${token}`
  const backTo = (reply: FastifyReply, token: string, offerId: string, query: Record<string, string>) =>
    reply.redirect(`/f/${encodeURIComponent(token)}/photos/${encodeURIComponent(offerId)}?${new URLSearchParams(query)}`, 303)

  app.get('/f/:token/photos/:id', async (req: Req, reply) => {
    noStore(reply)
    const person = await personByToken(db, req.params.token)
    if (!person) return reply.code(404).type('text/html').send(renderGone())
    const booking = await bookingOf(db, person, req.params.id)
    if (!booking) return reply.redirect(`/f/${person.linkToken}`, 303)
    const now = today()
    const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM job_photos WHERE project_id = $1 AND added_by = $2', [booking.jobId, person.id])
    const m = req.query.m
    const said = m === 'sent' ? photosSent(count(req.query.n), count(req.query.x)) : m && Object.hasOwn(PHOTOS_SAID, m) ? PHOTOS_SAID[m as PhotosSaid] : undefined
    return reply.type('text/html').send(
      renderPhotos({
        base: base(req, person.linkToken),
        offerId: booking.offer.id,
        job: booking.job,
        until: person.archived ? undefined : linkPhotosUntil(booking.offer, booking.call, now),
        today: now,
        mine: rows[0]?.n ?? 0,
        off: !files.on,
        office: await officeFor(db),
        flash: said,
      })
    )
  })

  /** Whose link a form is being sent on, found before its body is read. */
  const sender = new WeakMap<FastifyRequest, Person>()

  void app.register(async (scope) => {
    scope.addContentTypeParser('multipart/form-data', { parseAs: 'buffer', bodyLimit: ROUTE_LIMIT }, (_req, body, done) => done(null, body))

    scope.post(
      '/f/:token/photos/:id',
      {
        bodyLimit: ROUTE_LIMIT,
        // The link is looked up before the body is read, so a made-up link never has photos read into the server's memory for it.
        onRequest: async (req: Req, reply) => {
          const person = await personByToken(db, req.params.token)
          if (!person) return reply.code(404).type('text/html').send(renderGone())
          if (!files.on) return backTo(reply, person.linkToken, req.params.id, { m: 'off' })
          sender.set(req, person)
        },
        errorHandler: (err: FastifyError, req: Req, reply) => {
          if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return backTo(reply, req.params.token, req.params.id, { m: 'too-big' })
          throw err
        },
      },
      async (req: Req, reply) => {
        const person = sender.get(req)!
        const back = (m: PhotosSaid) => backTo(reply, person.linkToken, req.params.id, { m })
        const booking = await bookingOf(db, person, req.params.id)
        if (!booking) return reply.redirect(`/f/${person.linkToken}`, 303)
        if (person.archived || !linkPhotosUntil(booking.offer, booking.call, today())) return back('closed')
        let form
        try {
          form = readForm(req.body as Buffer, req.headers['content-type'], LINK_PHOTOS_AT_ONCE * 2)
        } catch (err) {
          if (err instanceof NotAForm) return back('try-again')
          throw err
        }
        const sent = form.files.filter((f) => f.length > 0)
        if (!sent.length) return back('none')
        // The page gives the form an id of its own, so the same form sent twice puts each photo up once.
        const given = form.fields.id ?? ''
        if (!/^[\w-]{8,40}$/.test(given)) return back('try-again')
        let added = 0
        let left = 0
        for (let i = 0; i + 1 < sent.length; i += 2) {
          const thumb = sent[i]!
          const full = sent[i + 1]!
          const size = isJpeg(thumb) && isJpeg(full) && full.length <= MAX_FILE_BYTES ? jpegSize(full) : undefined
          if (!size) {
            left++
            continue
          }
          try {
            await addJobPhoto(db, files, { id: `${given}-${i / 2}`, jobId: booking.jobId, caption: '', tags: [] }, full, thumb, { ...size, personId: person.id }, {
              link: person.id,
              device: describeDevice(req.headers['user-agent']),
            })
            added++
          } catch (err) {
            // Sent twice: the first send put it up.
            if (err instanceof Refused && err.reason.code === 'conflict') added++
            else if (err instanceof Refused) left++
            else if (err instanceof NotKept) return added ? backTo(reply, person.linkToken, req.params.id, { m: 'sent', n: String(added), x: String(sent.length / 2 - added) }) : back('not-kept')
            else throw err
          }
        }
        // A file with no pair is half a photo.
        if (sent.length % 2) left++
        if (added) onChange()
        if (!added) return back('not-photos')
        return backTo(reply, person.linkToken, req.params.id, { m: 'sent', n: String(added), x: String(left) })
      }
    )
  })
}
