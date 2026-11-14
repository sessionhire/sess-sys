import type { CommandArgs, Mutation } from '../commands.ts'
import { tidyTags, type JobPhoto } from '../job-photos.ts'

/**
 * Photos of jobs (ADR 0182) as a device sees them: what the server has
 * sent, with this device's own waiting captions, tags and removals laid
 * over them. Never the pictures: those come from the server by their
 * address, and the browser keeps the small ones it has shown.
 */

export interface JobPhotoView extends JobPhoto {
  pending: boolean
}

export interface JobPhotosView {
  /** Every photo, in the order they were put up. */
  all: readonly JobPhotoView[]
  /** A job's, in the order they were put up, which is the order of the show. */
  of(jobId: string): JobPhotoView[]
  /** The tags in use, the most used first, each with how many photos have it. */
  tags: readonly { tag: string; count: number }[]
}

export function jobPhotosView(entities: { jobPhoto?: Record<string, JobPhoto> }, outbox: readonly (Mutation & { appliedSeq?: number })[], cursor: number): JobPhotosView {
  const all = new Map<string, JobPhotoView>()
  // Snapshots saved before these existed have no table for them.
  for (const p of Object.values(entities.jobPhoto ?? {})) all.set(p.id, { ...p, pending: false })

  for (const m of outbox) {
    if (m.appliedSeq !== undefined && m.appliedSeq <= cursor) continue
    switch (m.name) {
      case 'jobPhoto.save': {
        const a = m.args as CommandArgs<'jobPhoto.save'>
        const was = all.get(a.id)
        // Only one already put up can be changed: the server says so of any other.
        if (was) all.set(a.id, { ...was, caption: a.caption, tags: tidyTags(a.tags), pending: true })
        break
      }
      case 'jobPhoto.remove':
        all.delete((m.args as CommandArgs<'jobPhoto.remove'>).id)
        break
    }
  }

  // Every order ends on the id, so two devices agree.
  const photos = [...all.values()].sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id))
  const byJob = new Map<string, JobPhotoView[]>()
  const counts = new Map<string, { tag: string; count: number }>()
  for (const p of photos) {
    const list = byJob.get(p.jobId)
    if (list) list.push(p)
    else byJob.set(p.jobId, [p])
    for (const t of p.tags) {
      const k = t.toLocaleLowerCase('en-IE')
      const c = counts.get(k)
      if (c) c.count++
      else counts.set(k, { tag: t, count: 1 })
    }
  }
  const tags = [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  return { all: photos, of: (jobId) => byJob.get(jobId) ?? [], tags }
}
