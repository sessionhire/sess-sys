import {
  dayLabel,
  daysBetween,
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  hireHandover,
  holdOf,
  oneLine,
  phoneShown,
  productCode,
  spanLabel,
  STATUS_LABELS,
  vehicleName,
  type Department,
  type Direction,
  type JobView,
  type PickList,
  type PickRow,
  type View,
} from '@sh/shared'
import { useEffect, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { departmentOfRow, heldText, rowDone, walk } from './pickRows.ts'

/**
 * A pick list on paper (Colly, 24 November 2026), for when it's picked by
 * hand: phones down, no signal, or a second pair of hands with a pen. What
 * the screen shows, in the order it shows it (a department's kit, by
 * department or by where it's kept), with a box to tick, how many, where
 * each is kept and its codes to circle, a box to write how many were
 * taken, room for what went that wasn't on it, and who picked and checked
 * it. Coming back, the same for what went out and what's still to come
 * back. Black on white whatever the screen's theme, as the call sheet is.
 * Nothing on paper is recorded: the foot says to scan or count it in
 * afterwards.
 */

const n = (x: number) => x.toLocaleString('en-IE')
const printedOn = () => new Date().toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
const rowName = (r: PickRow) => r.model?.name ?? 'A product since removed'

interface Props {
  view: View
  job: JobView
  pick: PickList
  /** The rows the screen shows: its department, or all. */
  rows: PickRow[]
  mode: Direction
  part: Department | 'all'
  byPlace: boolean
  today: string
}

/** The button that prints it, with the sheet on the page only while it prints; the browser's own Print gets the same sheet. */
export function PrintPickList(props: Props) {
  const [printing, setPrinting] = useState<false | 'button' | 'browser'>(false)
  useEffect(() => {
    // Drawn before the browser takes its picture of the page, so Ctrl+P prints the list rather than the screen.
    const before = () => flushSync(() => setPrinting((p) => p || 'browser'))
    addEventListener('beforeprint', before)
    return () => removeEventListener('beforeprint', before)
  }, [])
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    addEventListener('afterprint', done)
    const frame = printing === 'button' ? requestAnimationFrame(() => print()) : 0
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('afterprint', done)
    }
  }, [printing])
  return (
    <>
      <div className="actions print-pick">
        <button type="button" onClick={() => setPrinting('button')} disabled={!!printing}>
          Print to {props.mode === 'out' ? 'pick' : 'check back'} by hand
        </button>
      </div>
      {printing && createPortal(<PickSheet {...props} />, document.body)}
    </>
  )
}

/** When it's needed and where, the vans, and a dry hire's handover: the screen's Before you start, in words for paper. */
function briefLines(view: View, job: JobView, today: string): string[] {
  const lines: string[] = []
  const hire = hireHandover(job)
  if (hire && job.span) {
    const where = oneLine(job.hire?.address)
    const who = job.client?.contacts[0]
    const to = hire.delivered
      ? where && ` to ${where}`
      : `${job.client ? ` · ${job.client.name}` : ''}${who ? `, ${who.name}` : ''}${who?.phone ? ` ${phoneShown(who.phone)}` : ''}`
    lines.push(`Out: ${hire.out}, ${dayLabel(job.span.start)}${to}`, `Due back: ${hire.back}, ${dayLabel(job.span.end)}`)
  } else {
    const next = job.phases.find((p) => p.end >= today)
    if (next) {
      const days = daysBetween(today, next.start)
      const when = next.start < today ? 'On now' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${n(days)} days`
      lines.push(`${when}: ${next.name}, ${dayLabel(next.start)}${next.venue ? ` at ${next.venue.name}` : ''}`)
    }
  }
  const vans = new Set<string>()
  for (const b of view.vehicles.ofJob(job.id).filter((b) => b.end >= today))
    vans.add(`${b.vehicle ? vehicleName(b.vehicle) : 'a vehicle since removed'}${b.driver ? `, ${b.driver.name} driving` : ''}`)
  if (vans.size) lines.push(`Going in: ${[...vans].join('; ')}`)
  return lines
}

export function PickSheet({ view, job, pick, rows, mode, part, byPlace, today }: Props) {
  const out = mode === 'out'
  const kit = rows.filter((r) => r.lines.length > 0)
  const extras = rows.filter((r) => r.lines.length === 0)
  // Going out, what's still to pick first, in the screen's order; what's already out at the end, so it isn't picked twice.
  const groups: [string, PickRow[]][] = []
  if (out) {
    const left = kit.filter((r) => !rowDone(r, 'out'))
    if (byPlace) groups.push(...walk(left))
    else for (const d of DEPARTMENTS) {
      const here = left.filter((r) => departmentOfRow(r) === d)
      if (here.length) groups.push([DEPARTMENT_LABELS[d], here])
    }
    const done = kit.filter((r) => rowDone(r, 'out'))
    if (done.length) groups.push(['Already out', done])
    if (extras.length) groups.push(['Out, not on the kit', extras])
  } else {
    for (const d of DEPARTMENTS) {
      const here = rows.filter((r) => departmentOfRow(r) === d)
      if (here.length) groups.push([DEPARTMENT_LABELS[d], here])
    }
  }
  const need = kit.reduce((t, r) => t + r.need, 0)
  const already = kit.reduce((t, r) => t + Math.min(r.out, r.need), 0)
  const stillOut = rows.reduce((t, r) => t + r.out, 0)
  const total = out
    ? `${n(need)} to go out, ${plural(kit.length, 'product')}${already ? `; ${n(already)} already out` : ''}`
    : `${n(stillOut)} still out, ${plural(rows.filter((r) => r.out > 0).length, 'product')}`
  const brief = out ? briefLines(view, job, today) : []
  const notConfirmed = holdOf(job.status) !== 'held'

  return (
    <div className="print-sheet pick-sheet">
      <style>{'@page { size: A4; margin: 12mm; }'}</style>
      <header className="sheet-head">
        <div>
          <p className="kicker">Session Hire · {out ? 'pick list' : 'coming back'}{part !== 'all' ? ` · ${DEPARTMENT_LABELS[part]} only` : ''}</p>
          <h1>{job.name}</h1>
          <p>
            {job.span ? spanLabel(job.span) : 'No dates yet'}
            {job.client && ` · for ${job.client.name}`}
            {notConfirmed && ` · ${STATUS_LABELS[job.status]}, not confirmed`}
          </p>
          {brief.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <dl className="sheet-facts">
          <dt>{total}</dt>
          <dd>Printed {printedOn()}</dd>
          <dd>{byPlace && out ? "By where it's kept" : 'By department'}</dd>
        </dl>
      </header>

      <table className="pick-table">
        <thead>
          <tr>
            <th scope="col" className="tick">
              <span className="sr-only">Done</span>
            </th>
            <th scope="col">What</th>
            <th scope="col" className="n">{out ? 'Need' : 'Went'}</th>
            <th scope="col">{out ? "Where it's kept" : 'Still out'}</th>
            <th scope="col" className="write">{out ? 'Took' : 'Back'}</th>
          </tr>
        </thead>
        {groups.map(([title, here]) => (
          <tbody key={title}>
            <tr className="group">
              <th colSpan={5} scope="colgroup">
                {title}
              </th>
            </tr>
            {here.map((r) => (out ? <OutRow key={r.modelId} r={r} /> : <BackRow key={r.modelId} r={r} />))}
          </tbody>
        ))}
      </table>

      <section className="sheet-more">
        <h2>{out ? 'Also went, not on the list' : 'Damaged or missing'}</h2>
        <div className="ruled" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <h2>Notes</h2>
        <div className="ruled" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </section>

      <footer className="sheet-sign">
        <p>
          {out ? 'Picked by' : 'Checked in by'} <span className="blank" />
        </p>
        <p>
          {out ? 'Checked by' : 'Put away by'} <span className="blank" />
        </p>
        <p>
          Date and time <span className="blank" />
        </p>
        <p className="muted wide">
          {out
            ? `Paper isn't recorded: once it's picked, scan the labels on ${job.name}'s pick list, or count it out there, so the app knows it's gone.`
            : `Paper isn't recorded: scan each label back on ${job.name}'s pick list, or count it back there, and report damage or anything missing there too.`}
          {pick.missing > 0 && ` ${n(pick.missing)} already reported missing.`}
        </p>
      </footer>
    </div>
  )
}

const plural = (count: number, word: string) => `${n(count)} ${word}${count === 1 ? '' : 's'}`

/** What a row is: its name and product code, the phases it's split over, the kit's notes, and what's subhired besides. */
function What({ r }: { r: PickRow }) {
  const code = r.model ? productCode(r.model) : ''
  const split = r.lines.length > 1 ? r.lines.map((l) => `${n(l.own)} for ${l.phase?.name ?? (l.phaseId ? 'a phase' : 'the whole job')}`).join(', ') : ''
  const notes = r.lines.filter((l) => l.notes?.trim()).map((l) => (r.lines.length > 1 ? `${l.phase?.name ?? 'Whole job'}: ${l.notes!.trim()}` : l.notes!.trim()))
  const hired = r.lines.filter((l) => l.subhireQty > 0)
  return (
    <>
      <b>{rowName(r)}</b>
      {code && <span className="code"> {code}</span>}
      {split && <span className="sub">{split}</span>}
      {notes.map((note, i) => (
        <span className="sub note" key={i}>
          Note: {note}
        </span>
      ))}
      {hired.map((l) => (
        <span className="sub" key={l.id}>
          Plus {n(l.subhireQty)} subhired{l.supplier ? ` from ${l.supplier}` : ''}: not from our shelves
        </span>
      ))}
    </>
  )
}

/** Codes on a line, each kept whole, to circle the ones taken. */
const Codes = ({ codes }: { codes: string[] }) => (
  <span className="codes">
    {codes.map((c, i) => (
      <span key={`${c}${i}`} className="number">
        {c}
      </span>
    ))}
  </span>
)

function OutRow({ r }: { r: PickRow }) {
  const done = r.lines.length > 0 && r.out >= r.need
  const left = Math.max(0, r.need - r.out)
  return (
    <tr className={done ? 'done' : ''}>
      <td className="tick">
        <span className="box">{done ? '✓' : ''}</span>
      </td>
      <td>
        <What r={r} />
      </td>
      <td className="n">
        <b>{n(r.lines.length ? r.need : r.out)}</b>
        {r.out > 0 && !done && r.lines.length > 0 && <span className="sub">{n(r.out)} out, {n(left)} to go</span>}
      </td>
      <td>
        {done || r.lines.length === 0 ? (
          <span className="sub">{r.items.length ? <Codes codes={r.items.map((a) => a.number || 'no number')} /> : `${n(r.out)} out`}</span>
        ) : r.from.length ? (
          r.from.map((f) => (
            <span key={f.where} className="from">
              <b>{f.where}</b>: {n(f.items.length + f.counted)} here{f.counted && f.items.length ? ` (${n(f.counted)} counted)` : ''}
              {f.items.length > 0 && <Codes codes={f.items.map((a) => a.number || 'no number')} />}
            </span>
          ))
        ) : (
          <span className="warn">{r.held.length ? `None fit to go: ${r.held.map(heldText).join('; ')}` : 'None in stock: ask the office about a subhire'}</span>
        )}
      </td>
      <td className="write">{done ? '' : <span className="blank" />}</td>
    </tr>
  )
}

function BackRow({ r }: { r: PickRow }) {
  const went = r.out + r.back + r.missing
  const done = r.out === 0 && r.missing === 0
  return (
    <tr className={done ? 'done' : ''}>
      <td className="tick">
        <span className="box">{done ? '✓' : ''}</span>
      </td>
      <td>
        <What r={r} />
      </td>
      <td className="n">
        <b>{n(went)}</b>
        {r.back > 0 && <span className="sub">{n(r.back)} back</span>}
        {r.missing > 0 && <span className="sub">{n(r.missing)} missing</span>}
      </td>
      <td>
        {r.out === 0 ? (
          <span className="sub">{done ? 'All back' : 'None out'}</span>
        ) : (
          <>
            <b>{n(r.out)}</b>
            {r.counted > 0 && r.items.length > 0 && <span className="sub">{n(r.counted)} counted</span>}
            {r.items.length > 0 && <Codes codes={r.items.map((a) => a.number || 'no number')} />}
          </>
        )}
      </td>
      <td className="write">{done ? '' : <span className="blank" />}</td>
    </tr>
  )
}
