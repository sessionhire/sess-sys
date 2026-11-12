import { QUOTE_STATUS_LABELS, type JobView, type QuoteStatus, type QuoteView } from '@sh/shared'
import { useState } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { promptFor, useTellHere } from '../crew/Messages.tsx'
import { useReach } from '../crew/reach.tsx'
import { StatusPill, type PillTone } from '../StatusPill.tsx'
import { client } from '../sync.ts'
import { useToday } from '../view.ts'
import { confirmQuestion, crewOnJob, holdingTheDay, stopQuestion } from './jobStatus.ts'

/**
 * A quote's status as a pill (ADR 0042), and the job's own step its client's
 * answer calls for (ADR 0081): parts other screens show too.
 */

const TONE: Record<QuoteStatus, PillTone> = { draft: 'pending', sent: 'pending', accepted: 'confirmed', declined: 'cancelled' }

export function QuotePill({ q }: { q: QuoteView }) {
  return (
    <StatusPill tone={q.paidOn ? 'confirmed' : TONE[q.status]} pending={q.pending}>
      {q.paidOn ? 'Paid' : q.invoicedOn ? 'Invoiced' : QUOTE_STATUS_LABELS[q.status]}
    </StatusPill>
  )
}

/**
 * The client has answered, and the job doesn't say so yet (ADR 0081): confirm it, or mark it lost, with one press.
 * Offered, not done by itself: confirming puts the job on the calendar and holds its kit, and losing it cancels its
 * crew calls, which the office should see happen. Either asks first when it reaches the crew, as Change details and the
 * Confirmed task do (ADR 0149, ADR 0168): losing a job with crew calls open cancels them, and confirming one its crew
 * hold the day for takes HOLD off their days. Who was told opens where the screen says (TellHere), as this row goes.
 */
export function InStep({ job, want, compact }: { job: JobView; want: 'confirmed' | 'lost'; compact?: boolean }) {
  const { run, error } = useAct()
  const reach = useReach()
  const today = useToday()
  const tell = useTellHere()
  const [asking, setAsking] = useState(false)
  // Read before the press: once the job's status changes, nobody holds the day for it, and its calls are cancelled.
  const people = want === 'lost' ? crewOnJob(job) : []
  const holding = want === 'confirmed' ? holdingTheDay(job, today) : []
  const question =
    want === 'confirmed' ? confirmQuestion(reach, job, holding) : job.calls.some((c) => c.status === 'open') ? stopQuestion(reach, job, 'lost', people) : undefined
  const go = () => {
    setAsking(false)
    void run(() => client.mutate('project.update', { id: job.id, status: want })).then((ok) => {
      if (!ok) return
      if (holding.length) tell?.(promptFor('job-confirmed', holding))
      if (people.length) tell?.(promptFor('job-stopped', people))
    })
  }
  return (
    <div className="in-step">
      {!compact && (
        <p>
          {want === 'confirmed'
            ? `The client accepted, and the job is still ${job.status === 'enquiry' ? 'an enquiry' : 'quoted'}. Confirming it puts it on the jobs calendar and holds its kit.`
            : `The client turned it down, and the job is still ${job.status === 'enquiry' ? 'an enquiry' : 'quoted'}. Marking it lost cancels any crew calls on it.`}
        </p>
      )}
      {asking && question ? (
        <Confirm
          question={question}
          yes={want === 'confirmed' ? 'Confirm the job' : 'Mark it lost'}
          loss={want === 'lost'}
          no="Keep it as it is"
          onYes={go}
          onNo={() => setAsking(false)}
        />
      ) : (
        // On the quote, confirming is the one thing to record next, its filled red (nextRecord); on a list (compact), one to a row,
        // it's plain, as a row's own action is (UX sweep, 6 November 2026, move 1). Losing the job is a loss, so never the red.
        <button type="button" className={want === 'confirmed' && !compact ? 'primary' : undefined} onClick={() => (question ? setAsking(true) : go())} disabled={job.pending}>
          {want === 'confirmed' ? 'Confirm the job' : 'Mark the job lost'}
        </button>
      )}
      <Refusal error={error} />
    </div>
  )
}
