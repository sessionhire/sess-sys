import { z } from 'zod'
import { cleanText, text } from './plain.ts'
import { addDays } from './sync/plan.ts'
import { roleCan, type Role } from './roles.ts'

/**
 * Photos of a job (ADR 0182): what a show looked like, kept on its job as
 * a library to look back on and to show the next client what the company
 * can do. Put up from a phone at the gig or after it, several at a time,
 * each made smaller on the phone first and sent with a small copy for
 * browsing. Kept as documents' files are (ADR 0029): in the storage
 * bucket, read only through the server, on the list of files to delete
 * the moment one is removed. The database holds only what's said about
 * each: its job, a caption and tags, who put it up and when.
 *
 * Every member of staff can put one up and say what it shows (the
 * "photos" ability); taking one down is for whoever put it up and for the
 * roles that change jobs. Everyone signed in sees them, freelancers too:
 * they're pictures of the company's work, not of anyone's details.
 *
 * Freelancers, who are most of the people at a show, put theirs up from
 * their own link (Colly, 24 November 2026): on a booking, from its first
 * day until a week after its last, onto the job with their name, for the
 * office to take down if one isn't wanted.
 */

const id = z.string().min(1).max(64)

/** The longer side of a photo as the phone sends it: sharp full screen on a laptop or a client's big screen, about half a megabyte. */
export const JOB_PHOTO_SIDE = 2560
/** The longer side of its small copy, for the grids: twice the widest tile, for sharp screens, a few dozen kilobytes. */
export const JOB_PHOTO_THUMB_SIDE = 720
/** How many can be picked at once; a show's worth, sent one after another. */
export const JOB_PHOTOS_AT_ONCE = 60

/** How many go from someone's own link in one send: the page posts them as one form, so it stays a size a phone on site can send. */
export const LINK_PHOTOS_AT_ONCE = 10
/** How long after a booking's last day its photos can still be put up from the link. */
export const LINK_PHOTO_DAYS_AFTER = 7

/**
 * The last day someone can put photos on a booking's job from their own link, or nothing when they can't: the booking
 * is theirs to work (accepted or confirmed) on a call that's going ahead on a job, from its first day until a week
 * after its last.
 */
export function linkPhotosUntil(
  offer: { status: string; days: readonly string[] },
  call: { status: string; projectId: string | null; start: string; end: string },
  today: string,
): string | undefined {
  if ((offer.status !== 'accepted' && offer.status !== 'confirmed') || call.status !== 'open' || !call.projectId) return undefined
  const days = [...offer.days].sort()
  const first = days[0] ?? call.start
  const until = addDays(days[days.length - 1] ?? call.end, LINK_PHOTO_DAYS_AFTER)
  return today >= first && today <= until ? until : undefined
}

export const JOB_PHOTO_CAPTION = 300
export const JOB_PHOTO_TAG = 40
export const JOB_PHOTO_TAGS = 12

/** Tags offered before any are in use, so the first photos are tagged alike: what a client asks to see. */
export const STARTER_PHOTO_TAGS = ['Stage', 'Lighting', 'Audio', 'Video', 'Lasers', 'Set and staging', 'Front of house', 'Outdoor', 'Show clients'] as const

export interface JobPhoto {
  id: string
  jobId: string
  caption: string
  tags: string[]
  /** Its size in pixels as sent, so a grid keeps its shape before it loads. */
  width: number
  height: number
  /** Both copies together, for what the storage holds. */
  bytes: number
  /** Who put it up, while they're in the app. */
  addedBy: string | null
  addedAt: string
}

export interface JobPhotoEntities {
  jobPhoto: JobPhoto
}
export const JOB_PHOTO_ENTITY_NAMES = ['jobPhoto'] as const

/** A tag as it's kept: cleaned, single-spaced, no longer than a tag can be. */
export const tidyTag = (t: string) => cleanText(t).replace(/\s+/g, ' ').trim().slice(0, JOB_PHOTO_TAG)

/** Tags as kept: tidied, none empty, each once whatever its capitals (the first spelling stays), and no more than twelve. */
export function tidyTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tags.map(tidyTag)) {
    const k = t.toLocaleLowerCase('en-IE')
    if (!t || seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out.slice(0, JOB_PHOTO_TAGS)
}

const tags = z.array(z.string().max(200)).max(50).transform(tidyTags)

/** What's said about a photo, as typed: its caption and tags. Works with no signal. */
export const jobPhotoWords = z.object({
  id,
  caption: text(JOB_PHOTO_CAPTION, 'The caption'),
  tags,
})
export type JobPhotoWords = z.infer<typeof jobPhotoWords>

/** What a photo is put up with: its job and, as it's sent, what's said about it. */
export const jobPhotoDetails = jobPhotoWords.extend({ jobId: id })
export type JobPhotoDetails = z.infer<typeof jobPhotoDetails>

export const jobPhotoCommandSchemas = {
  /** Change a photo's caption and tags. */
  'jobPhoto.save': jobPhotoWords,
  /** Take a photo down; both its copies are deleted from the storage. */
  'jobPhoto.remove': z.object({ id }),
} as const

/** What the server records a photo put up as: not a command, as it carries the file. */
export const JOB_PHOTO_ADD_ACTION = 'jobPhoto.add'

export const JOB_PHOTOS_WAIT = "Photos wait on the storage bucket, which isn't set up on this server."
export const JOB_PHOTO_NOT_YOURS = 'Only whoever put this photo up, the office and directors can take it down.'
export const JOB_PHOTO_NOT_JPEG = "That isn't a photo the app can keep. Choose a JPEG, PNG, WebP or iPhone photo, or take one with the camera."

/** Which copy: the small one for grids, the whole one to look at. */
export type JobPhotoSize = 'thumb' | 'full'

/** The address of a photo: it never changes, as a photo is never replaced, only taken down. */
export const jobPhotoPath = (photoId: string, size: JobPhotoSize) => `/api/job-photos/${encodeURIComponent(photoId)}/${size}`

/** Whether someone can put photos up and say what they show: every member of staff. No role is held to nothing. */
export const mayAddJobPhotos = (role: Role | null | undefined) => !role || roleCan(role, 'photos')

/** Whether someone can take a photo down: whoever put it up, or a role that changes jobs. */
export const mayRemoveJobPhoto = (role: Role | null | undefined, myPersonId: string | undefined, photo: Pick<JobPhoto, 'addedBy'>) =>
  !role || roleCan(role, 'jobs') || (!!myPersonId && roleCan(role, 'photos') && photo.addedBy === myPersonId)

/** A photo's file name when it's saved or shared: "Electric Picnic 2026 - Main stage at dusk.jpg". */
export function jobPhotoFileName(jobName: string, photo: Pick<JobPhoto, 'caption' | 'id'>, n?: number): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()
  const caption = safe(photo.caption).slice(0, 60)
  const name = [safe(jobName).slice(0, 60) || 'Job', caption || (n ? `photo ${n}` : `photo ${photo.id.slice(-4)}`)].join(' - ')
  return `${name}.jpg`
}
