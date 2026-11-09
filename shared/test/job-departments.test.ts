import { describe, expect, it } from 'vitest'
import { departmentsOfJob, involvesAny, jobDepartmentNamed, jobDepartmentOfCall, jobDepartmentsInWords, tidyJobDepartments } from '../src/job-departments.ts'
import { DEPARTMENTS } from '../src/stock.ts'
import { kitOf } from '../src/sync/standing.ts'
import { departmentNamed } from '../src/stock-import-file.ts'

/**
 * The departments a job involves (ADR 0136): by its crew calls' departments,
 * or their roles' words, and by its kit's stock departments; several picked
 * keep a job involving any of them.
 */

describe('departments a job involves', () => {
  it('reads a call by its department, or else by its role', () => {
    expect(jobDepartmentOfCall({ department: 'LX' })).toBe('lighting')
    expect(jobDepartmentOfCall({ department: ' laser ' })).toBe('lasers')
    expect(jobDepartmentOfCall({ department: 'LED Tech' })).toBe('video')
    expect(jobDepartmentOfCall({ department: 'Backline' })).toBe('audio')
    expect(jobDepartmentOfCall({ department: 'Staging' })).toBe('staging')
    expect(jobDepartmentOfCall({ department: 'Production', role: 'Sound No.1' })).toBeUndefined()
    expect(jobDepartmentOfCall({ department: null, role: 'Sound No.1' })).toBe('audio')
    expect(jobDepartmentOfCall({ role: 'Stagehand' })).toBeUndefined()
    expect(jobDepartmentNamed('lx')).toBe('lighting')
  })

  it('counts open calls and kit, not cancelled calls or rigging', () => {
    const job = {
      calls: [
        { status: 'open', department: 'LX' },
        { status: 'cancelled', department: 'Video' },
      ],
    }
    const kit = [{ model: { department: 'lasers' as const } }, { model: { department: 'rigging' as const } }, { model: undefined }]
    expect([...departmentsOfJob(job, kit)].sort()).toEqual(['lasers', 'lighting'])
  })

  it('keeps a job involving any department picked, and every job when none are', () => {
    const has = new Set(['audio'] as const)
    expect(involvesAny(has, [])).toBe(true)
    expect(involvesAny(has, ['lighting'])).toBe(false)
    expect(involvesAny(has, ['lighting', 'audio'])).toBe(true)
  })

  it('tidies what was kept and says it in words', () => {
    expect(tidyJobDepartments(['video', 'nonsense', 'audio', 'audio'])).toEqual(['audio', 'video'])
    expect(jobDepartmentsInWords(['lighting'])).toBe('Lighting')
    expect(jobDepartmentsInWords(['audio', 'lighting', 'lasers'])).toBe('Audio, Lighting or Lasers')
  })

  it('gives lasers kit a department of its own', () => {
    expect(DEPARTMENTS).toContain('lasers')
    expect(kitOf('Laser')).toBe('lasers')
    expect(departmentNamed('Lasers')).toBe('lasers')
  })
})
