import { DEPARTMENT_LABELS, DEPARTMENTS, plural, type View } from '@sh/shared'
import { Heading } from '../Icon.tsx'
import { ShowAll } from '../Fold.tsx'
import { time } from './countWords.ts'

/**
 * How far the stocktake has got (ADR 0177), on the Counting page: who's
 * counting where right now, on any phone, so two people don't take the same
 * bay; how many places have been counted; and how much of the numbered kit
 * has its label, by department. Worked out on each phone from what it
 * holds, so it needs no signal beyond what's synced.
 */
export function Stocktake({ view, mine }: { view: View; mine: string | undefined }) {
  const w = view.warehouse
  const underWay = view.counts.underWay
  const places = w.places.length
  const counted = w.places.filter((p) => view.counts.of({ placeId: p.id }).length > 0).length
  // Numbered kit: items with their label, and those still counted without one.
  const numbered = w.models.filter((m) => m.tracking === 'serialised' && !m.isCase)
  const byDept = DEPARTMENTS.map((d) => {
    const ms = numbered.filter((m) => m.department === d)
    const labelled = ms.reduce((n, m) => n + m.items.length, 0)
    return { d, labelled, all: labelled + ms.reduce((n, m) => n + m.countedTotal, 0) }
  }).filter((x) => x.all > 0)
  const labelled = byDept.reduce((n, x) => n + x.labelled, 0)
  const all = byDept.reduce((n, x) => n + x.all, 0)
  if (places === 0 && all === 0 && underWay.length === 0) return null
  return (
    <section className="card stocktake" aria-label="The stocktake">
      <Heading icon="count">The stocktake</Heading>
      <h3 className="group">Counting now</h3>
      {underWay.length === 0 ? (
        <p className="hint">Nobody is counting right now.</p>
      ) : (
        <ShowAll items={underWay} limit={8} what="counts under way">
          {(rows) => (
            <ul className="job-list under-way-list">
              {rows.map((u) => (
                <li key={u.id}>
                  <a className="job-row" href={u.placeId ? `#stock/place/${u.placeId}` : `#stock/item/${u.caseId}`}>
                    <div>
                      <b>{u.what}</b>
                      <p>
                        {u.id === mine ? 'You, on this phone' : (u.person?.name ?? 'Someone not named')}, since {time(u.startedAt)}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </ShowAll>
      )}
      {places > 0 && (
        <div className="stocktake-line">
          <p>
            <b>{counted.toLocaleString('en-IE')}</b> of {plural(places, 'place')} counted at least once
          </p>
          <progress max={places} value={counted} aria-label="Places counted" />
        </div>
      )}
      {all > 0 && (
        <>
          <div className="stocktake-line">
            <p>
              <b>{labelled.toLocaleString('en-IE')}</b> of {all.toLocaleString('en-IE')} numbered items labelled
            </p>
            <progress max={all} value={labelled} aria-label="Numbered items labelled" />
          </div>
          {byDept.length > 1 && (
            <ul className="stocktake-depts">
              {byDept.map((x) => (
                <li key={x.d}>
                  <span>{DEPARTMENT_LABELS[x.d]}</span>
                  <span className="figure">
                    {x.labelled.toLocaleString('en-IE')} of {x.all.toLocaleString('en-IE')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
