import { JOB_PHOTO_ADD_ACTION, JOB_PHOTO_NOT_YOURS, roleCan, type CommandArgs, type JobPhoto, type JobPhotoDetails } from '@sh/shared'
import { personByEmail } from '../crew/store.ts'
import type { Db, Queryable } from '../db.ts'
import { emit, emitRemoved, Refused, serverChange, type Ctx } from '../kernel.ts'
import { getProject } from '../projects/store.ts'
import { recordArgs, withFile, type Who } from './actions.ts'
import type { DocumentFiles } from './files.ts'
import { claimFile, queueFile } from './store.ts'

/**
 * Photos of jobs (ADR 0182): each two files in the storage, the photo and
 * its small copy for the grids, kept as documents' files are (ADR 0029),
 * on the same list of files to delete. Both are written before the change
 * that puts the photo on its job, and both go back on the list if that
 * change is turned down, or when the photo is taken down.
 */

const COLS = `id, project_id, caption, tags, width, height, bytes, added_by, added_at`

type Row = Record<string, any>

const toPhoto = (r: Row): JobPhoto => ({
  id: r.id,
  jobId: r.project_id,
  caption: r.caption,
  tags: r.tags ?? [],
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  addedBy: r.added_by ?? null,
  addedAt: new Date(r.added_at).toISOString(),
})

export async function getJobPhoto(q: Queryable, id: string): Promise<JobPhoto | undefined> {
  const { rows } = await q.query(`SELECT ${COLS} FROM job_photos WHERE id = $1`, [id])
  return rows[0] ? toPhoto(rows[0]) : undefined
}

/** Where its two files are kept, for the server alone. */
export async function jobPhotoKeysOf(q: Queryable, id: string): Promise<{ full: string; thumb: string } | undefined> {
  const { rows } = await q.query<{ file_key: string; thumb_key: string }>(`SELECT file_key, thumb_key FROM job_photos WHERE id = $1`, [id])
  return rows[0] ? { full: rows[0].file_key, thumb: rows[0].thumb_key } : undefined
}

const emitPhoto = async (ctx: Ctx, id: string) => emit(ctx, 'jobPhoto', id, await getJobPhoto(ctx.tx, id))

const GONE = () => new Refused({ code: 'not-found', message: 'That photo has been taken down.' })

type JobPhotoCommand = 'jobPhoto.save' | 'jobPhoto.remove'
type Handler<N extends JobPhotoCommand> = (ctx: Ctx, args: CommandArgs<N>) => Promise<void>

export const jobPhotoHandlers: { [N in JobPhotoCommand]: Handler<N> } = {
  async 'jobPhoto.save'(ctx, a) {
    if (!(await getJobPhoto(ctx.tx, a.id))) throw GONE()
    await ctx.tx.query('UPDATE job_photos SET caption = $2, tags = $3 WHERE id = $1', [a.id, a.caption, a.tags])
    await emitPhoto(ctx, a.id)
  },

  async 'jobPhoto.remove'(ctx, a) {
    const was = await getJobPhoto(ctx.tx, a.id)
    // Taken down once is taken down: a second device's Remove finds nothing to do.
    if (!was) return
    // Staff take down their own; the roles that change jobs take down any (the role table lets every member of staff this far).
    if (ctx.role && !roleCan(ctx.role, 'jobs')) {
      const me = ctx.user ? await personByEmail(ctx.tx, ctx.user.email) : undefined
      if (!me || me.id !== was.addedBy) throw new Refused({ code: 'forbidden', message: JOB_PHOTO_NOT_YOURS })
    }
    const keys = await jobPhotoKeysOf(ctx.tx, a.id)
    if (keys) {
      await queueFile(ctx.tx, keys.full, true)
      await queueFile(ctx.tx, keys.thumb, true)
    }
    await ctx.tx.query('DELETE FROM job_photos WHERE id = $1', [a.id])
    await emitRemoved(ctx, 'jobPhoto', a.id)
  },
}

/** What came with the files, checked by the route: the photo's size in pixels and who sent it. */
export interface Sent {
  width: number
  height: number
  email?: string
  /** Who sent it from their own link, which has no signed-in address to find them by. */
  personId?: string
}

/**
 * A photo put on a job: its small copy and the photo written to the
 * storage, then the photo added with its caption and tags. Never replaces
 * one: an id already used is turned down, and both files go again.
 */
export function addJobPhoto(db: Db, files: DocumentFiles, details: JobPhotoDetails, full: Buffer, thumb: Buffer, sent: Sent, who: Who) {
  const bytes = full.length + thumb.length
  const args = { ...details, width: sent.width, height: sent.height, bytes }
  return withFile(files, thumb, (thumbKey) =>
    withFile(files, full, (fullKey) =>
      serverChange(db, { name: JOB_PHOTO_ADD_ACTION, args, ...who }, async (ctx) => {
        const job = await getProject(ctx.tx, details.jobId, true)
        if (!job) throw new Refused({ code: 'not-found', message: 'That job is no longer in the app.' })
        if (await getJobPhoto(ctx.tx, details.id)) throw new Refused({ code: 'conflict', message: 'That photo is already on a job.' })
        const me = sent.personId ? { id: sent.personId } : sent.email ? await personByEmail(ctx.tx, sent.email) : undefined
        await claimFile(ctx.tx, fullKey)
        await claimFile(ctx.tx, thumbKey)
        await ctx.tx.query(
          `INSERT INTO job_photos (id, project_id, caption, tags, file_key, thumb_key, width, height, bytes, added_by, added_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
          [details.id, details.jobId, details.caption, details.tags, fullKey, thumbKey, sent.width, sent.height, bytes, me?.id ?? null]
        )
        await emitPhoto(ctx, details.id)
        await recordArgs(ctx, args)
      })
    )
  )
}
