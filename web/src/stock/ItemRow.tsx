import { RETIRED_LABELS, type AssetView, type View } from '@sh/shared'
import { Fragment } from 'react'
import { dayOf } from '../format.ts'
import { productPhotoOf, Thumb } from '../Picture.tsx'
import { Pending } from '../StatusPill.tsx'
import { numberLabel, whereLabel } from './common.tsx'
import { faultState, usableFault } from './Faults.tsx'
import { dueText } from './Inspections.tsx'
import { kitIcon } from './kitIcon.ts'

/**
 * One item on a list (UX sweep, 6 November 2026, move 3), lifted from the
 * product page's item rows and drawn the same on that page, in the
 * catalogue's search, under the Stock camera and on the pick list coming
 * back: its number and product, then the state it's in and where it's
 * kept. Out with a job is said plainly, in the item page's words, as out
 * is healthy; missing, damaged so it can't go out, or a test failed or
 * overdue is the bad flag, and damaged but fit to go out the warn, in the
 * repair list's words. It's read from what this device holds, so it works
 * with no signal, and while a change to the item made here hasn't synced
 * it says so in the dashed pill, never amber. On a pick list, where
 * buttons sit beside it, only its number opens the item.
 */

/** Whether anything said of an item is still only this device's: a change to it, a scan of it or its case, a fault or a test. */
export function itemWaiting(view: View, id: string): boolean {
  return (
    !!view.warehouse.assets.get(id)?.pending ||
    view.moves.waiting(id) ||
    view.faults.ofAsset(id).some((f) => f.pending) ||
    // Missing because its case is: the case's report.
    !!view.faults.stopping(id)?.pending ||
    view.inspections.ofAsset(id).some((i) => i.pending)
  )
}

type Fact = { text: string; flag?: 'bad' | 'warn' }

/** What the row says after the number, in order: the state it's in, where it's kept, its serial, and what the list adds. */
function factsOf(view: View, a: AssetView, job: string | undefined, note: string | undefined): Fact[] {
  const facts: Fact[] = []
  if (a.status === 'retired') {
    facts.push({ text: a.retiredReason === 'mistake' ? RETIRED_LABELS.mistake : a.retiredReason ? `Retired: ${RETIRED_LABELS[a.retiredReason].toLowerCase()}` : 'Retired' })
  } else {
    const stop = view.faults.stopping(a.id)
    const fit = stop ? undefined : usableFault(view.faults, a.id)
    if (stop) facts.push({ text: faultState(stop), flag: 'bad' })
    else if (fit) facts.push({ text: faultState(fit), flag: 'warn' })
    const test = view.inspections.blocks(a.id)
    if (test) facts.push({ text: dueText(test), flag: 'bad' })
    const out = view.moves.outOf(a.id)
    // On the job's own pick list, out with it goes without saying. Kit out since another year says which.
    if (out && out.projectId !== job) facts.push({ text: `Out with ${view.jobs.jobs.find((j) => j.id === out.projectId)?.name ?? 'a job'} since ${dayOf(out.since, true)}` })
    facts.push({ text: whereLabel(a, view.warehouse) })
  }
  if (a.serial) facts.push({ text: `Serial ${a.serial}` })
  if (note) facts.push({ text: note })
  return facts
}

export function ItemRow({
  view,
  a,
  product = true,
  job,
  note,
}: {
  view: View
  a: AssetView
  /** The product's name and picture after the number: not on the product's own page, or under the product on a pick list. */
  product?: boolean
  /**
   * The job whose pick list the row is on. There, out with it goes without saying, and only the number opens the item, so a
   * gloved miss for Back, Missing or Report damage beside the row stays on the list (audit, 5 November 2026, finding 92).
   */
  job?: string
  /** What the list knows of it besides, said last: "Had SH-000012 before". */
  note?: string
}) {
  const href = `#stock/item/${a.id}`
  const row = (
    <>
      {product && <Thumb icon={kitIcon(a.model)} src={productPhotoOf(a.model)} />}
      <div>
        {job ? <a href={href}>{numberLabel(a)}</a> : <b>{numberLabel(a)}</b>}
        {product && ` ${a.model?.name ?? 'A product since removed'}`}
        <p>
          {factsOf(view, a, job, note).map((f, i) => (
            <Fragment key={i}>
              {i > 0 && ' · '}
              {f.flag ? <span className={`flag ${f.flag}`}>{f.text}</span> : f.text}
            </Fragment>
          ))}
        </p>
      </div>
      <Pending pending={itemWaiting(view, a.id)} />
    </>
  )
  return job ? (
    <div className="item-row">{row}</div>
  ) : (
    <a className="item-row" href={href}>
      {row}
    </a>
  )
}
