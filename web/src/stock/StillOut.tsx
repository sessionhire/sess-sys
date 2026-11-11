import { dsTiming, newId, plural, type KitToCheck, type View } from '@sh/shared'
import { useState } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { useMe } from '../crew/Leave.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'

/**
 * A job with kit to check back in (ADR 0109), as Home › Warehouse and
 * Stock's Pick lists both list it: what isn't back, and how long since the
 * job ended. Past the job's days to come back and two more it's late, said
 * in words and in amber, the system's "needs a look" (healthy is quiet).
 * Kit out opens the pick list, which opens on what's coming back; kit never
 * scanned out opens the job's Back in task, to check and tick off.
 */
export function StillOutRow({ k }: { k: KitToCheck }) {
  return (
    <li>
      <StillOutLink k={k} />
    </li>
  )
}

function StillOutLink({ k }: { k: KitToCheck }) {
  const id = encodeURIComponent(k.job.id)
  return (
    <a className="job-row" href={k.neverScanned ? `#jobs/${id}/task/back` : `#jobs/${id}/pick`}>
      <div>
        <b>{k.job.name}</b>
        <p>
          {k.said} · {k.when}
        </p>
      </div>
      {k.late && (
        <div className="side">
          <small className="flag warn">Late</small>
        </div>
      )}
    </a>
  )
}

/**
 * The jobs with kit to check back in, as Home › Warehouse and Stock's Pick lists list them: the ones that ended in the last month
 * first, each a row, then those more than a month gone folded under Long overdue (review of 11 November 2026, finding 10), so a
 * year of jobs nobody scanned back doesn't crowd out the ones back this week. `recent` draws the first part, as each list
 * already does (Stock's keeps its Show all); the fold is the same on both.
 */
export function splitStillOut(all: readonly KitToCheck[]): {
  recent: KitToCheck[]
  long: KitToCheck[]
} {
  return {
    recent: all.filter((k) => !k.longOverdue),
    long: all.filter((k) => k.longOverdue),
  }
}

export function LongOverdue({ view, kits }: { view: View; kits: readonly KitToCheck[] }) {
  if (!kits.length) return null
  return (
    <details className="long-overdue">
      <summary>
        <h3 className="group">Long overdue ({kits.length})</h3>
      </summary>
      <p className="hint">Ended more than a month ago. Settle each in one press: it's all back, or what's still out is missing.</p>
      <ul className="job-list">
        {kits.map((k) => (
          <LongOverdueRow key={k.job.id} view={view} k={k} />
        ))}
      </ul>
    </details>
  )
}

/**
 * A long-overdue job's row, with the two ways to settle it from here. "It's all back" scans back everything still out with the job
 * (each item by its number, counted kit by its count) and ticks its Back in task; "Mark missing" reports what's still out as
 * missing, which puts it on Repairs to be found or written off there, and ticks Back in too. Kit never scanned out has only the
 * first: nothing went out by the scans to call missing. Each asks first, saying how much it touches, as neither has an Undo.
 * Moving kit is stock's (roles.ts); a role without it reads the row and opens the pick list.
 */
function LongOverdueRow({ view, k }: { view: View; k: KitToCheck }) {
  const access = useAccess()
  const { me } = useMe(view)
  const { run, error } = useAct()
  const [asking, setAsking] = useState<'back' | 'missing'>()
  const may = access.can('stock')
  const job = k.job
  const items = k.pick.rows.flatMap((r) => r.items)
  const counted = k.pick.rows.filter((r) => r.counted > 0)
  const out = k.out
  const tick = () => {
    const step = view.steps.of(job.id)?.steps.find((s) => s.key === 'back')
    return step && !step.done && !step.skipped && access.can('steps')
      ? client.mutate('jobStep.set', {
          projectId: job.id,
          step: 'back',
          done: true,
          by: me?.id ?? null,
        })
      : Promise.resolve()
  }
  const settle = (how: 'back' | 'missing') =>
    void run(async () => {
      const at = new Date().toISOString()
      for (const a of items)
        await (how === 'back'
          ? client.mutate('move.record', {
              id: newId(),
              projectId: job.id,
              direction: 'in',
              assetId: a.id,
              modelId: a.modelId,
              qty: 1,
              at,
              undoes: null,
            })
          : client.mutate('fault.report', {
              id: newId(),
              at,
              kind: 'missing',
              assetId: a.id,
              modelId: a.modelId,
              qty: 1,
              projectId: job.id,
              usable: false,
              note: 'Not back a month after the job.',
            }))
      for (const r of counted)
        await (how === 'back'
          ? client.mutate('move.record', {
              id: newId(),
              projectId: job.id,
              direction: 'in',
              assetId: null,
              modelId: r.modelId,
              qty: r.counted,
              at,
              undoes: null,
            })
          : client.mutate('fault.report', {
              id: newId(),
              at,
              kind: 'missing',
              assetId: null,
              modelId: r.modelId,
              qty: r.counted,
              projectId: job.id,
              usable: false,
              note: 'Not back a month after the job.',
            }))
      await tick()
    }).then((ok) => {
      setAsking(undefined)
      // Said in a pop-up, as the settled job leaves the list at once, its row with it (and the list too, when it was the last).
      // notices.ts is loaded on its own, not imported: it reaches the crew screens, and Home, which lists these, would come round to itself.
      if (ok)
        void import('../notices.ts').then(({ showToast }) => showToast(
          how === 'back'
            ? { id: `settled-${job.id}`, title: `${job.name}: all back`, body: 'Its Back in is done.' }
            : { id: `settled-${job.id}`, title: `${job.name}: marked missing`, body: 'What was still out is on Repairs, to be found or written off.', href: '#stock/repairs', action: 'Repairs' },
          dsTiming.undo
        ))
    })
  const what = k.neverScanned ? `the ${plural(k.neverScanned, 'thing', 'things')} on its pick list` : `the ${plural(out, 'thing', 'things')} still out with it`
  return (
    <li className="long-overdue-row">
      <StillOutLink k={k} />
      {may && asking ? (
        <Confirm
          question={
            asking === 'back'
              ? `Mark ${what} as back from ${job.name}, and its Back in done?`
              : `Mark ${what} as missing from ${job.name}? They go on Repairs, to be found or written off there.`
          }
          yes={asking === 'back' ? "Yes, it's all back" : 'Mark missing'}
          loss={asking === 'missing'}
          onYes={() => settle(asking)}
          onNo={() => setAsking(undefined)}
        />
      ) : may ? (
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setAsking('back')} aria-label={`It's all back: ${job.name}`}>
            It's all back
          </button>
          {!k.neverScanned && out > 0 && (
            <button type="button" className="secondary" onClick={() => setAsking('missing')} aria-label={`Mark missing: ${job.name}`}>
              Mark missing
            </button>
          )}
        </div>
      ) : null}
      <Refusal error={error} />
    </li>
  )
}
