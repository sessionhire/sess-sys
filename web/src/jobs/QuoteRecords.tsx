import { dayLabel, irishToday, money, rmsDay, newId, withNewIds, QUOTE_STATUS_LABELS, STOPPED, TURN_DOWN_LABELS, TURN_DOWN_NOTE_LENGTH, TURN_DOWN_REASONS, validUntil, type JobView, type QuoteView, type TurnDownReason } from '@sh/shared'
import { useState } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
import { useToday } from '../view.ts'
import { clientWords, getJson, useAsked, type RmsJob } from './rms.ts'
import { InStep } from './QuoteStatus.tsx'
import { pastDay } from './QuoteLine.tsx'

/**
 * Around a quote that's gone (ADR 0042, ADR 0092): its job's past quotes in
 * Current RMS, a new version, and the office's records of the client's
 * answer, the invoice and the payment.
 */

/** The job's past quotes in Current RMS, once linked (ADR 0092), and how its client's quotes went there. Needs signal; shows nothing without it. */
export function InCurrentRms({ jobId }: { jobId: string }) {
  const loaded = useAsked<RmsJob>(useAccess().can('money'), jobId, () => getJson(`/api/rms/jobs/${encodeURIComponent(jobId)}`))
  if (loaded.state !== 'ready' || (!loaded.data.opportunities.length && !loaded.data.client)) return null
  const { opportunities, client } = loaded.data
  return (
    <section className="card" aria-label="In Current RMS">
      <h2>In Current RMS</h2>
      {client && (
        <p>
          {client.client}: {clientWords(client)}.
        </p>
      )}
      {opportunities.length ? (
        <ul className="job-list">
          {opportunities.map((o) => (
            <li key={o.id}>
              <a className="job-row" href={`#jobs/money/current-rms/${o.id}`}>
                <div>
                  <b>{o.subject || o.number}</b>
                  <p className="hint">{[o.number, [o.state, o.status].filter(Boolean).join(', '), o.startsAt ? pastDay(rmsDay(o.startsAt)!) : ''].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="side">
                  {money(o.netCents)}
                  <span aria-hidden="true"> ›</span>
                </div>
              </a>
              {/* Its lines onto this job's quote, charged as they were there (ADR 0103). */}
              <a href={`#jobs/money/current-rms/${o.id}/onto`}>Put its lines on this quote</a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">
          No past quote is linked to this job. <a href="#jobs/money/current-rms/match">Match past quotes to jobs</a>
        </p>
      )}
    </section>
  )
}

/** A copy of a version that's gone, as the next draft. */
export function NewVersion({ q, onMade }: { q: QuoteView; onMade: (id: string) => void }) {
  const { run, error } = useAct()
  const make = () => {
    const id = newId()
    void run(() =>
      client.mutate('quote.save', { id, projectId: q.projectId, lines: withNewIds(q.lines, newId), discountPct: q.discountPct, agreedCents: q.agreedCents ?? null, notes: q.notes })
    ).then((ok) => ok && onMade(id))
  }
  return (
    <>
      <button type="button" onClick={make}>
        Start a new version
      </button>
      <Refusal error={error} />
    </>
  )
}

/** What the office records next on a job's current quote: the client's answer, the job put in step with it, the invoice, the payment. */
export type NextRecord = 'answer' | 'confirm' | 'lost' | 'invoice' | 'paid'

/**
 * What's next to record on the job's current quote under What happened, in the order it happens, or undefined once nothing is
 * left: the client's answer; then the job put in step with it (ADR 0081), confirmed or lost, with confirming before the invoice,
 * as the job's Next dock then says Confirm the job (ADR 0109); then the invoice; then the payment. The one place that says it:
 * Records draws it as the quote's one filled red, except losing the job, a loss, which stays plain; and the quote page keeps
 * sending and printing plain until nothing is left (UX sweep, 6 November 2026, move 1).
 */
export function nextRecord(q: QuoteView, job: JobView): NextRecord | undefined {
  const stopped = STOPPED.includes(job.status)
  if (q.status === 'sent') return 'answer'
  if (q.status === 'accepted' && !stopped && job.status !== 'confirmed') return 'confirm'
  if (q.status === 'declined' && !stopped) return 'lost'
  if (q.status === 'accepted' && !q.invoicedOn) return 'invoice'
  if (q.invoicedOn && !q.paidOn) return 'paid'
  return undefined
}

/** The office's records of what happened outside the app: the client's answer, the invoice, the payment. */
export function Records({ q, job, canEmail, quiet }: { q: QuoteView; job: JobView; canEmail: boolean; /** Draws nothing red: the PDF to send comes first. */ quiet?: boolean }) {
  const today = useToday()
  const [on, setOn] = useState(today)
  const [ref, setRef] = useState('')
  const [undo, setUndo] = useState<'answer' | 'invoice' | 'paid'>()
  // Turned down: why, asked in place before it's recorded (research/quoting.md, feature 5). Optional: Record it with none picked.
  const [why, setWhy] = useState<{ reason: TurnDownReason | null; note: string }>()
  const { run, error } = useAct()
  const next = nextRecord(q, job)
  const primaryIfNext = (record: NextRecord) => (next === record && !quiet ? 'primary' : undefined)
  const go = (fn: () => Promise<unknown>) => void run(fn).then((ok) => ok && setUndo(undefined))
  const when = (
    <label>
      On
      <input type="date" value={on} max={irishToday()} onChange={(e) => setOn(e.target.value)} />
    </label>
  )
  return (
    <section className="card" aria-label="What happened">
      <h2>What happened</h2>
      <dl className="facts">
        <div>
          <dt>Sent</dt>
          <dd>{q.sentOn ? `${dayLabel(q.sentOn)}${q.emails.length ? ', by email' : ''}` : 'Not yet'}</dd>
        </div>
        <div>
          <dt>Client's answer</dt>
          <dd>
            {q.answeredOn ? `${QUOTE_STATUS_LABELS[q.status]}, ${dayLabel(q.answeredOn)}` : 'Not yet'}
            {q.status === 'declined' && q.declinedWhy && `: ${TURN_DOWN_LABELS[q.declinedWhy].toLowerCase()}`}
            {q.status === 'declined' && q.declinedNote && <span className="why-note">{q.declinedNote}</span>}
          </dd>
        </div>
        {q.status === 'accepted' && (
          <div>
            <dt>Invoiced</dt>
            <dd>{q.invoicedOn ? `${dayLabel(q.invoicedOn)}${q.invoiceRef ? `, ${q.invoiceRef}` : ''}` : 'Not yet'}</dd>
          </div>
        )}
        {q.invoicedOn && (
          <div>
            <dt>Paid</dt>
            <dd>{q.paidOn ? dayLabel(q.paidOn) : `Not yet: ${money(q.totals.gross)} owed`}</dd>
          </div>
        )}
      </dl>
      <Refusal error={error} />
      {next === 'confirm' && <InStep job={job} want="confirmed" />}
      {next === 'lost' && <InStep job={job} want="lost" />}
      {/* Accepting after the prices ran out (research/quoting.md, feature 4) is allowed, with a word first: they may not stand. */}
      {q.status === 'sent' && q.sentOn && validUntil(q, today) < today && (
        <p className="warn-line">Its prices held until {dayLabel(validUntil(q, today))}. If the client accepts now, check they still stand, or start a new version.</p>
      )}
      {q.status === 'sent' && (
        <div className="quote-send">
          {when}
          <button type="button" className={primaryIfNext('answer')} onClick={() => go(() => client.mutate('quote.answer', { id: q.id, answer: 'accepted', on: on || today }))}>
            Client accepted
          </button>
          <button type="button" aria-expanded={!!why} onClick={() => setWhy(why ? undefined : { reason: null, note: '' })}>
            Client turned it down
          </button>
        </div>
      )}
      {q.status === 'sent' && why && (
        <fieldset className="turn-down">
          <legend>Why did they say no?</legend>
          <div className="choices">
            {TURN_DOWN_REASONS.map((r) => (
              <label key={r} className="choice">
                <input type="radio" name={`why-${q.id}`} checked={why.reason === r} onChange={() => setWhy({ ...why, reason: r })} />
                {TURN_DOWN_LABELS[r]}
              </label>
            ))}
          </div>
          <label className="field">
            Anything more <span className="optional">(optional)</span>
            <input value={why.note} onChange={(e) => setWhy({ ...why, note: e.target.value })} maxLength={TURN_DOWN_NOTE_LENGTH} placeholder="Went with a cheaper PA" />
          </label>
          <div className="actions">
            <button
              type="button"
              onClick={() =>
                go(() =>
                  client.mutate('quote.answer', {
                    id: q.id,
                    answer: 'declined',
                    on: on || today,
                    ...(why.reason ? { why: why.reason } : {}),
                    ...(why.note.trim() ? { note: why.note.trim() } : {}),
                  }).then(() => setWhy(undefined))
                )
              }
            >
              Record it as turned down
            </button>
            <button type="button" className="link" onClick={() => setWhy(undefined)}>
              Cancel
            </button>
          </div>
          <p className="hint">Why helps price the next one. Leave it if they didn't say.</p>
        </fieldset>
      )}
      {q.status === 'accepted' && !q.invoicedOn && (
        <div className="quote-send">
          {when}
          <label>
            Invoice number
            <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} placeholder="SH-1043" />
          </label>
          <button type="button" className={primaryIfNext('invoice')} onClick={() => go(() => client.mutate('quote.invoiced', { id: q.id, on: on || today, ref }))}>
            Mark invoiced
          </button>
        </div>
      )}
      {q.invoicedOn && !q.paidOn && (
        <div className="quote-send">
          {when}
          <button type="button" className={primaryIfNext('paid')} onClick={() => go(() => client.mutate('quote.paid', { id: q.id, on: on || today }))}>
            Mark paid
          </button>
        </div>
      )}
      {/* Taken back in the opposite order: the payment, then the invoice, then the answer. */}
      {(() => {
        const last = q.paidOn ? 'paid' : q.invoicedOn ? 'invoice' : q.answeredOn ? 'answer' : undefined
        if (!last) return null
        const words: [string, string] = { paid: ['Take the payment back', 'Take the payment back? The quote shows as owed again.'], invoice: ['Take the invoice back', 'Take the invoice back? It comes off the accountant’s files.'], answer: ["Take the client's answer back", "Take the client's answer back? The quote shows as sent, waiting on them."] }[last] as [string, string]
        return undo === last ? (
          <Confirm
            question={words[1]}
            yes={words[0]}
            onNo={() => setUndo(undefined)}
            onYes={() =>
              go(() =>
                last === 'paid'
                  ? client.mutate('quote.paid', { id: q.id, on: null })
                  : last === 'invoice'
                    ? client.mutate('quote.invoiced', { id: q.id, on: null, ref: '' })
                    : client.mutate('quote.answer', { id: q.id, answer: 'none', on: today })
              )
            }
          />
        ) : (
          <button type="button" className="link" onClick={() => setUndo(last)}>
            {words[0]}
          </button>
        )
      })()}
      <p className="hint">
        {canEmail
          ? "The quote itself goes by email from the operations mailbox; the rest here is the office's record of what happened outside the app."
          : "These are the office's records of what happened: the app sends nothing to the client."}
      </p>
    </section>
  )
}
