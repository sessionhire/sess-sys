import { firstName, stageHolder, type JobSteps, type View } from '@sh/shared'
import { Refusal, useAct } from '../act.tsx'
import { useMe } from '../crew/Leave.tsx'
import { Icon } from '../Icon.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'

/**
 * Who has the stage a job is in, on its Board card (ADR 0144): the open tasks of that stage, given to one member of staff
 * together, so "picking is Ana's" is one choice and not three. It's the job page's own "Down to", for the stage rather than one
 * task, and it writes the same records, so the tasks land on that person's list on Home and they hear of it in Notifications,
 * in the app only.
 *
 * The column already names the stage, so the foot is a person and a name. A native select, as Down to is on the job page: one press opens the phone's own picker (no list scrolling inside the card),
 * and the keyboard and screen reader get what they already know. You are first in it, so taking a stage yourself is the same
 * two presses wherever you are in the list of staff. Staff crew can't hand work to others (ADR 0073), so they see whose it is
 * as words.
 */
export function StageOwner({ view, steps }: { view: View; steps: JobSteps }) {
  const access = useAccess()
  const { me } = useMe(view)
  const { run, error } = useAct()
  const holder = stageHolder(steps)
  if (!holder) return null
  const staff = view.leave.staff
  const stage = holder.stage.label
  const value = holder.split ? SPLIT : (holder.owner?.id ?? '')
  const said = holder.split ? 'Split' : holder.owner ? firstName(holder.owner) : 'Nobody yet'
  const mayGive = access.can('steps') && access.role !== 'crew'
  if (!mayGive) {
    return (
      <p className="stage-owner" data-none={!holder.owner && !holder.split ? '' : undefined}>
        <Icon name="person" />
        <span>
          <span className="sr-only">{stage}: </span>
          {said}
        </span>
      </p>
    )
  }
  const give = (ownerId: string | null) =>
    void run(async () => {
      for (const t of holder.tasks) {
        if (t.ownerId === ownerId) continue
        await client.mutate('jobStep.set', {
          projectId: steps.job.id,
          step: t.key,
          ownerId,
          by: me?.id ?? null,
        })
      }
    })
  const mine = !!me && staff.some((p) => p.id === me.id)
  // Someone no longer on the staff list who still has it stays named, so the select doesn't claim nobody has it.
  const gone = holder.owner && !staff.some((p) => p.id === holder.owner!.id) ? holder.owner : undefined
  return (
    <div className="stage-owner">
      <label data-none={!holder.owner && !holder.split ? '' : undefined}>
        <Icon name="person" />
        <select aria-label={`Who has ${stage} on ${steps.job.name}`} value={value} onChange={(e) => e.target.value !== SPLIT && give(e.target.value || null)}>
          {holder.split && (
            <option value={SPLIT} disabled>
              Split: {[...new Set(holder.tasks.map((t) => (t.owner ? firstName(t.owner) : 'nobody')))].join(', ')}
            </option>
          )}
          <option value="">Nobody yet</option>
          {mine && <option value={me!.id}>Me ({firstName(me!)})</option>}
          {gone && <option value={gone.id}>{gone.name}</option>}
          {staff
            .filter((p) => p.id !== me?.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <Refusal error={error} className="stage-owner-refusal" />
    </div>
  )
}

const SPLIT = '__split'
