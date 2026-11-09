import { departmentInWords } from './crew-departments.ts'
import type { Department } from './stock.ts'

/**
 * Which departments a job involves (ADR 0135): the departments the Jobs
 * list, the master calendar, the planner and the Board narrow by. A job
 * involves a department when one of its crew calls is that department's, or
 * a line of its kit is in that department's stock, so picking Lighting hides
 * the jobs with no lighting on them at all. Several can be picked; a job
 * involving any of them stays. None picked narrows nothing.
 */

export const JOB_DEPARTMENTS = ['audio', 'lighting', 'video', 'lasers', 'staging'] as const
export type JobDepartment = (typeof JOB_DEPARTMENTS)[number]
export const JOB_DEPARTMENT_LABELS: Record<JobDepartment, string> = {
  audio: 'Audio',
  lighting: 'Lighting',
  video: 'Video',
  lasers: 'Lasers',
  staging: 'Staging',
}

/** A crew department's words, as the profiles and calls type them, to the department a job is filtered by. */
const OF_CREW: Record<string, JobDepartment> = {
  audio: 'audio',
  sound: 'audio',
  backline: 'audio',
  lx: 'lighting',
  lighting: 'lighting',
  lights: 'lighting',
  video: 'video',
  vision: 'video',
  'led tech': 'video',
  led: 'video',
  laser: 'lasers',
  lasers: 'lasers',
  staging: 'staging',
  stage: 'staging',
}

/** The department a crew call counts for: its own, or else what its role's words say ("Sound No.1" is Audio). */
export function jobDepartmentOfCall(c: { department?: string | null; role?: string }): JobDepartment | undefined {
  const named = c.department?.trim().toLowerCase()
  if (named) return OF_CREW[named]
  const said = c.role ? departmentInWords(c.role) : null
  return said ? OF_CREW[said.toLowerCase()] : undefined
}

/** A crew department, as typed, as one of these, if it is one: a head of LX's is Lighting. */
export const jobDepartmentNamed = (name: string | null | undefined): JobDepartment | undefined => (name ? OF_CREW[name.trim().toLowerCase()] : undefined)

/** A stock department as one of these: rigging, power and other aren't. */
export const jobDepartmentOfKit = (d: Department | undefined): JobDepartment | undefined => (JOB_DEPARTMENTS as readonly string[]).includes(d ?? '') ? (d as JobDepartment) : undefined

/** The departments a job involves, from its open calls and its kit. */
export function departmentsOfJob(
  job: { calls: readonly { status?: string; department?: string | null; role?: string }[] },
  kit: readonly { model?: { department: Department } | undefined }[] | undefined
): Set<JobDepartment> {
  const out = new Set<JobDepartment>()
  for (const c of job.calls) {
    if (c.status && c.status !== 'open') continue
    const d = jobDepartmentOfCall(c)
    if (d) out.add(d)
  }
  for (const l of kit ?? []) {
    const d = jobDepartmentOfKit(l.model?.department)
    if (d) out.add(d)
  }
  return out
}

/** Whether a job with these departments stays when `picked` are chosen: any of them, or everything when none are. */
export const involvesAny = (has: ReadonlySet<JobDepartment>, picked: readonly JobDepartment[]) => picked.length === 0 || picked.some((d) => has.has(d))

/** Departments as kept: known ones only, each once, in the list's own order. */
export const tidyJobDepartments = (keys: readonly unknown[]): JobDepartment[] => JOB_DEPARTMENTS.filter((d) => keys.includes(d))

/** "Lighting", "Audio or Video": the departments picked, in words. */
export function jobDepartmentsInWords(picked: readonly JobDepartment[]): string {
  const names = picked.map((d) => JOB_DEPARTMENT_LABELS[d])
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`
}
