import {
  departmentsOfJob,
  involvesAny,
  JOB_DEPARTMENT_LABELS,
  JOB_DEPARTMENTS,
  tidyJobDepartments,
  type JobDepartment,
  type JobView,
  type View,
} from '@sh/shared'
import { useCallback, useSyncExternalStore, type MouseEvent } from 'react'

/**
 * The departments row (ADR 0137): Audio, Lighting, Video, Lasers and
 * Staging, pressed to show only the jobs involving them. One choice for the
 * Jobs list, the calendar, the planner's job rows and the Board, kept on this
 * device, so picking Lighting on the calendar still holds on the Board: the
 * row is on every one of them, pressed, so a list never narrows unseen.
 */

const KEY = 'sh.jobDepartments'
const listeners = new Set<() => void>()
let picked: JobDepartment[] = read()

function read(): JobDepartment[] {
  try {
    const was: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(was) ? tidyJobDepartments(was) : []
  } catch {
    return []
  }
}

function set(next: JobDepartment[]) {
  picked = tidyJobDepartments(next)
  try {
    if (picked.length) localStorage.setItem(KEY, JSON.stringify(picked))
    else localStorage.removeItem(KEY)
  } catch {
    // Kept for the tab's life all the same.
  }
  for (const fn of listeners) fn()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** The departments picked, and whether a job stays with them. */
export function useJobDepartments(view: View): { picked: JobDepartment[]; setPicked: (next: JobDepartment[]) => void; involves: (job: JobView) => boolean } {
  const now = useSyncExternalStore(subscribe, () => picked)
  const byJob = view.kit.byJob
  const involves = useCallback((job: JobView) => involvesAny(departmentsOfJob(job, byJob.get(job.id)), now), [byJob, now])
  return { picked: now, setPicked: set, involves }
}

/**
 * The row itself: All departments, then one toggle a department. Pressing
 * one adds it to what's shown; All clears them. `count` says how many a
 * department would show, where the screen counts.
 */
export function DepartmentFilter({
  picked,
  onChange,
  count,
  pills = false,
}: {
  picked: readonly JobDepartment[]
  onChange: (next: JobDepartment[]) => void
  count?: (d: JobDepartment) => number
  /** As pills in a list's filter panel, under the word Departments (the Jobs list, Colly, 10 November 2026), rather than a row on the page. */
  pills?: boolean
}) {
  // A toggle, not a move, so it keeps focus, as the calendar's and planner's do (Safari doesn't focus a button it presses).
  const press = (next: JobDepartment[]) => (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.focus()
    onChange(next)
  }
  const row = (
    <div className={pills ? 'pills departments' : 'filters departments'} role="group" aria-label="Departments">
      <button type="button" aria-pressed={picked.length === 0} onClick={press([])}>
        All departments
      </button>
      {JOB_DEPARTMENTS.map((d) => {
        const on = picked.includes(d)
        return (
          <button key={d} type="button" aria-pressed={on} onClick={press(on ? picked.filter((x) => x !== d) : [...picked, d])}>
            {JOB_DEPARTMENT_LABELS[d]}
            {count && ` (${count(d).toLocaleString('en-IE')})`}
          </button>
        )
      })}
    </div>
  )
  if (!pills) return row
  return (
    <div className="pill-group">
      <span className="pill-label" aria-hidden="true">
        Departments
      </span>
      {row}
    </div>
  )
}
