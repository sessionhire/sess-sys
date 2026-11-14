import { spanLabel, type JobPhotoView, type JobView, type View } from '@sh/shared'
import { useMemo, useState } from 'react'
import { plain, wordsOf } from '../crew/People.tsx'
import { Empty } from '../Empty.tsx'
import { PillGroup, ViewFilter } from '../ListTools.tsx'
import { useToday } from '../view.ts'
import { Top } from './common.tsx'
import { PhotoGrid, PhotoViewer } from './JobPhotos.tsx'
import { JobViews } from './PlanScreen.tsx'

/**
 * Jobs › Photos (ADR 0182): every job's photos in one place, to find what a
 * show looked like and pick examples for the next client. Found by what's
 * said of them or of their job (a caption, a tag, the job, its client or
 * venue), narrowed by tags in Filter, and grouped by job, newest show
 * first. Opened, a photo says which job it's from and steps through the
 * photos found.
 */

/** Jobs drawn at first, and each Show more: a few hundred small photos, not thousands. */
const JOBS_AT_ONCE = 12

/** The search and the tags picked, kept for the tab's life, so Back from a job finds the page as it was. */
let kept: { find: string; tags: string[] } = { find: '', tags: [] }

const same = (a: string, b: string) => a.toLocaleLowerCase('en-IE') === b.toLocaleLowerCase('en-IE')

interface Group {
  job: JobView | undefined
  jobId: string
  photos: JobPhotoView[]
  /** When the show was, else when its first photo went up, for the order. */
  when: string
}

export function PhotosScreen({ view }: { view: View }) {
  const today = useToday()
  const [find, setFindNow] = useState(kept.find)
  const [tags, setTagsNow] = useState<string[]>(kept.tags)
  const [jobsShown, setJobsShown] = useState(JOBS_AT_ONCE)
  const [open, setOpen] = useState<string>()
  const setFind = (f: string) => {
    kept = { ...kept, find: f }
    setFindNow(f)
    setJobsShown(JOBS_AT_ONCE)
  }
  const setTags = (t: string[]) => {
    kept = { ...kept, tags: t }
    setTagsNow(t)
    setJobsShown(JOBS_AT_ONCE)
  }
  const all = view.jobPhotos.all
  const byId = useMemo(() => new Map(view.jobs.jobs.map((j) => [j.id, j])), [view.jobs.jobs])

  const groups = useMemo(() => {
    const words = wordsOf(find)
    const found = all.filter((p) => {
      if (!tags.every((t) => p.tags.some((x) => same(x, t)))) return false
      if (!words.length) return true
      const j = byId.get(p.jobId)
      const said = plain([p.caption, ...p.tags, j?.name, j?.client?.name, j?.venue?.name].filter(Boolean).join(' '))
      return words.every((w) => said.includes(w))
    })
    const by = new Map<string, Group>()
    for (const p of found) {
      const g = by.get(p.jobId)
      if (g) g.photos.push(p)
      else {
        const job = byId.get(p.jobId)
        by.set(p.jobId, { job, jobId: p.jobId, photos: [p], when: job?.span?.start ?? p.addedAt.slice(0, 10) })
      }
    }
    // The newest show first; the order ends on the job's id, so two devices agree.
    return [...by.values()].sort((a, b) => b.when.localeCompare(a.when) || a.jobId.localeCompare(b.jobId))
  }, [all, byId, find, tags])

  const shownGroups = groups.slice(0, jobsShown)
  // The viewer steps through the photos on the page, job after job.
  const shownPhotos = useMemo(() => shownGroups.flatMap((g) => g.photos), [shownGroups])
  const count = groups.reduce((n, g) => n + g.photos.length, 0)
  const tagChoices = view.jobPhotos.tags

  return (
    <div className="app crew jobs">
      <Top
        view={view}
        views={<JobViews current="photos" />}
        heading="Photos"
        lead={<input className="search" type="search" placeholder="Find a caption, tag, job, client or venue" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find photos" />}
      />
      {tagChoices.length > 0 && (
        <ViewFilter
          name="photos"
          what="photos"
          pills={
            <PillGroup label="Tags">
              {tagChoices.map((t) => {
                const on = tags.some((x) => same(x, t.tag))
                return (
                  <button key={t.tag} type="button" aria-pressed={on} onClick={() => setTags(on ? tags.filter((x) => !same(x, t.tag)) : [...tags, t.tag])}>
                    {t.tag} <span className="count">{t.count}</span>
                  </button>
                )
              })}
            </PillGroup>
          }
          active={tags.map((t) => ({ key: `tag:${t}`, label: t, off: () => setTags(tags.filter((x) => x !== t)) }))}
          onClear={() => setTags([])}
        />
      )}
      <section className="card plain job-photo-library" aria-label="Photos of jobs">
        {all.length === 0 && <Empty>Photos go on a job, on its Photos tab: what the show looked like, from anyone's phone. Every job's photos show here.</Empty>}
        {all.length > 0 && groups.length === 0 && <p className="empty">No photo matches. Try fewer words or tags.</p>}
        {all.length > 0 && groups.length > 0 && (
          <p className="hint" aria-live="polite">
            {count === 1 ? '1 photo' : `${count.toLocaleString('en-IE')} photos`} from {groups.length === 1 ? '1 job' : `${groups.length} jobs`}
          </p>
        )}
        {shownGroups.map((g) => (
          <div key={g.jobId} className="photo-group">
            <h3>
              <a href={`#jobs/${encodeURIComponent(g.jobId)}/photos`}>{g.job?.name ?? 'A job'}</a>
            </h3>
            <p className="hint">{[g.job?.client?.name, g.job?.venue?.name, g.job?.span ? spanLabel(g.job.span, today) : undefined].filter(Boolean).join(' · ')}</p>
            <PhotoGrid photos={g.photos} onOpen={setOpen} label={`Photos of ${g.job?.name ?? 'a job'}`} />
          </div>
        ))}
        {groups.length > jobsShown && (
          <button type="button" onClick={() => setJobsShown((n) => n + JOBS_AT_ONCE)}>
            Show more jobs ({groups.length - jobsShown} more)
          </button>
        )}
      </section>
      {open && <PhotoViewer photos={shownPhotos} id={open} onPick={setOpen} onClose={() => setOpen(undefined)} withJob />}
    </div>
  )
}
