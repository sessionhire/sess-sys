import { firstName, kitKey, stageHolder, type JobSteps, type PersonView, type View } from '@sh/shared'
import { useEffect, useRef, useState } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { useMe } from '../crew/Leave.tsx'
import { Icon } from '../Icon.tsx'
import { RecordPicker, type PickRecord, type RecordOffer } from '../RecordPicker.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'

/** How long the tick stays once a pick is kept, before the chevron comes back (Colly, 12 November 2026). */
const SAVED_FOR = 3000

const NOBODY = 'nobody'

/**
 * Who the job is with, changed where it's read (ADR 0161): the second line of the job page's top-right corner, under its status
 * and over Next. It is the stage the job is in, given to one member of staff, as the Board card's foot gives it (ADR 0144): every
 * open task of the stage goes to them together, so they find it on Home and hear of it in Notifications, in the app only.
 *
 * The system's combobox, picking one: type a name, or press the chevron for everyone, you first. While the pick is sent the
 * chevron turns to a spinner; once it's kept, a tick in the ok ink says it took, and after three seconds the chevron is back.
 * Staff crew can't hand work on (ADR 0073), so they read the name as words.
 */
export function JobAssignee({ view, steps }: { view: View; steps: JobSteps }) {
  const access = useAccess()
  const { me } = useMe(view)
  const { run, error } = useAct()
  const [saving, setSaving] = useState<'busy' | 'saved'>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const holder = stageHolder(steps)
  if (!holder) return null
  const stage = holder.stage.label
  const split = holder.split ? [...new Set(holder.tasks.map((t) => (t.owner ? firstName(t.owner) : 'nobody')))].join(', ') : ''
  const said = holder.split ? `Split: ${split}` : holder.owner ? holder.owner.name : 'Nobody yet'
  const label = `Who has ${stage}`
  if (!access.can('steps') || access.role === 'crew')
    return (
      <p className="job-assignee" data-none={!holder.owner && !holder.split ? '' : undefined}>
        <Icon name="person" />
        <span>
          <span className="sr-only">{label}: </span>
          {said}
        </span>
      </p>
    )

  const staff = view.leave.staff
  // Someone no longer on the staff list who still has it stays named, so the field doesn't claim nobody has it.
  const gone = holder.owner && !staff.some((p) => p.id === holder.owner!.id) ? [holder.owner] : []
  const mine = me && staff.some((p) => p.id === me.id) ? [me] : []
  // You first, so taking it yourself is the same two presses wherever you are in the staff (ADR 0144).
  const people: PersonView[] = [...mine, ...gone, ...staff.filter((p) => p.id !== me?.id)]
  const records = people.map((p) => ({ id: p.id, name: p.id === me?.id ? `${p.name} (you)` : p.name }))
  const give = (ownerId: string | null) => {
    if (!holder.split && (holder.owner?.id ?? null) === ownerId) return
    clearTimeout(timer.current)
    setSaving('busy')
    void run(async () => {
      for (const t of holder.tasks) {
        if (t.ownerId === ownerId) continue
        await client.mutate('jobStep.set', { projectId: steps.job.id, step: t.key, ownerId, by: me?.id ?? null })
      }
    }).then((ok) => {
      if (!ok) return setSaving(undefined)
      setSaving('saved')
      timer.current = setTimeout(() => setSaving(undefined), SAVED_FOR)
    })
  }
  return (
    <div className="job-assignee" data-none={!holder.owner && !holder.split ? '' : undefined}>
      <Icon name="person" />
      <RecordPicker
        label={label}
        className="assignee-picker"
        records={records}
        value={holder.split ? '' : (holder.owner?.id ?? '')}
        shownAs={holder.split ? `Split: ${split}` : undefined}
        placeholder="Nobody yet"
        find={findPeople}
        first={records}
        firstLabel="Staff"
        actions={holder.owner || holder.split ? [{ key: NOBODY, label: 'Nobody yet' }] : []}
        nothingFound={(t) => `No one on the staff matches “${t}”`}
        onPick={(id) => give(id)}
        onAction={(key) => key === NOBODY && give(null)}
        toggle
        saving={saving}
      />
      <Refusal error={error} className="assignee-refusal" />
    </div>
  )
}

/** Staff whose name, or a word of it, starts with what's typed. */
function findPeople<T extends PickRecord>(records: readonly T[], text: string): RecordOffer<T>[] {
  const typed = kitKey(text)
  const starts = records.filter((r) => kitKey(r.name).startsWith(typed))
  const words = records.filter((r) => !starts.includes(r) && r.name.split(/\s+/).some((w) => kitKey(w).startsWith(typed)))
  return [...starts, ...words].map((record) => ({ record }))
}
