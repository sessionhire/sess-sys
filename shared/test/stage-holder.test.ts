import { describe, expect, it } from 'vitest'
import type { PersonView } from '../src/sync/crew-view.ts'
import { stageHolder, type JobSteps, type StepView } from '../src/sync/steps-view.ts'

/** Who has the stage a job is in (ADR 0144): its open tasks, given together, and the one person they're all down to. */

const ana = { id: 'p-ana', name: 'Ana Byrne' } as PersonView
const ben = { id: 'p-ben', name: 'Ben Ryan' } as PersonView
const task = (key: string, stage: string, owner?: PersonView, done = false): StepView =>
  ({
    key,
    stage,
    ownerId: owner?.id ?? null,
    owner,
    done,
    skipped: undefined,
  }) as unknown as StepView
const job = (tasks: StepView[], current?: StepView, extra: Partial<JobSteps> = {}): JobSteps =>
  ({
    stage: { key: 'planning', label: 'Planning', tasks },
    current,
    stopped: undefined,
    finished: false,
    ...extra,
  }) as unknown as JobSteps

describe('stageHolder', () => {
  it('gives the open tasks of the stage, with the one person they are down to', () => {
    const crew = task('crew', 'planning', ana)
    const kit = task('kit', 'planning', ana)
    const h = stageHolder(job([crew, kit]))!
    expect(h.tasks).toEqual([crew, kit])
    expect(h.owner).toBe(ana)
    expect(h.split).toBe(false)
  })
  it('leaves out what is done, and says when the rest are split', () => {
    const h = stageHolder(job([task('crew', 'planning', ana, true), task('kit', 'planning', ben), task('x', 'planning')]))!
    expect(h.tasks.map((t) => t.key)).toEqual(['kit', 'x'])
    expect(h.owner).toBeUndefined()
    expect(h.split).toBe(true)
  })
  it('nobody named on any is not split', () => {
    const h = stageHolder(job([task('crew', 'planning')]))!
    expect(h.owner).toBeUndefined()
    expect(h.split).toBe(false)
  })
  it('hands over the task left from before when the stage has none open', () => {
    const quote = task('quote', 'selling', ben)
    const h = stageHolder(job([task('crew', 'planning', ana, true)], quote))!
    expect(h.tasks).toEqual([quote])
    expect(h.owner).toBe(ben)
  })
  it('has nothing to give on a job stopped, through, or with nothing open', () => {
    expect(stageHolder(job([task('crew', 'planning')], undefined, { stopped: 'Cancelled' }))).toBeUndefined()
    expect(stageHolder(job([task('crew', 'planning')], undefined, { finished: true }))).toBeUndefined()
    expect(stageHolder(job([task('crew', 'planning', ana, true)]))).toBeUndefined()
    expect(stageHolder(job([], undefined, { stage: undefined }))).toBeUndefined()
  })
})
