import {
  acceptPath,
  dayLabel,
  daysWord,
  linesFor,
  MAX_LINES,
  money,
  newId,
  pctWord,
  QUOTE_STATUS_LABELS,
  type JobView,
  type QuoteLine,
  type QuoteTotals,
  type QuoteView,
  type View,
  depositCents,
  validUntil,
  versionChanges,
  lineCostOf,
  ownKitUncosted,
  quoteMargin,
} from '@sh/shared'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Refusal, useAct } from '../act.tsx'
import { Empty } from '../Empty.tsx'
import { Heading } from '../Icon.tsx'
import { client } from '../sync.ts'
import { useToday } from '../view.ts'
import { QuotePill } from './QuoteStatus.tsx'
import { MarginWords } from './QuoteLine.tsx'
import { Lines, QuoteSheet, QuoteSheetPage, Totals } from './QuoteSheet.tsx'
import { InCurrentRms, NewVersion, nextRecord, Records } from './QuoteRecords.tsx'
import { Draft } from './QuoteDraft.tsx'
import { DeleteQuote } from './QuoteDelete.tsx'
import { Emails, SendQuote } from './QuoteEmail.tsx'
import { useQuotesByEmail } from '../MailboxCard.tsx'

export { InStep, QuotePill } from './QuoteStatus.tsx'

/**
 * A job's quote (ADR 0042), #jobs/<id>/quote, for the office and directors:
 * built from the job's kit and crew at the price list, every line open to
 * change while it's a draft, then kept as it went once it's gone to the
 * client, with a new version for any change after. It prints as an A4 page
 * to save as a PDF, as the call sheet does, and once the office has turned
 * it on it goes to the client by email from the operations mailbox with
 * that page attached (ADR 0101). The client's answer, the invoice and the
 * payment are records the office keeps here of what happened outside it.
 */

/** "€1,250.00 before VAT": what a quote is talked about as. */
const netWords = (t: QuoteTotals) => `${money(t.net)} before VAT`

function MarginLine({ margin, costs }: { margin: number; costs: number }) {
  return (
    <p className={`margin-line${margin < 0 ? ' bad' : ''}`}>
      {/* What's left once the freelancers booked or approved so far are paid, as Money counts it; not the quote's own
          expected margin, which is worked from its lines' costs, so the two are named apart (audit, 5 November 2026, finding 24). */}
      Left after freelancers so far: <b>{money(margin)}</b>
      {costs > 0 && <span className="muted"> ({money(costs)} of freelancers booked or approved)</span>}
    </p>
  )
}

/**
 * The job's Quote tab (ADR 0140, part 4): the quote itself, worked on as the job's Quoting stage, under the job's own head and
 * Next, rather than on a page of its own with a head and a Next repeated. #jobs/<id>/quote opens it.
 */
export function QuotePart({ view, job }: { view: View; job: JobView }) {
  const jobId = job.id
  const m = view.money
  const versions = m.quotesOf(jobId)
  const [picked, setPicked] = useState<string>()
  const [printing, setPrinting] = useState(false)
  const [composing, setComposing] = useState<string>()
  // The versions printed here since the page opened: one sent today and not printed yet keeps Print as its one red press
  // (audit of the quote flow, 8 November 2026, finding 14), since getting it to the client comes before their answer.
  const [printed, setPrinted] = useState<ReadonlySet<string>>(() => new Set())
  const shownId = useRef<string | undefined>(undefined)
  // The file a browser offers to save the PDF as is the tab's title: the quote's, as the emailed PDF is named, while it prints (ADR 0139).
  const fileName = useRef('')
  useEffect(() => {
    if (!printing) return
    const id = shownId.current
    const title = document.title
    if (fileName.current) document.title = fileName.current
    const done = () => {
      document.title = title
      setPrinting(false)
      if (id) setPrinted((was) => new Set(was).add(id))
    }
    addEventListener('afterprint', done)
    const frame = requestAnimationFrame(() => print())
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('afterprint', done)
      document.title = title
    }
  }, [printing])
  const today = useToday()
  // Send by email only while the mailbox can send (audit, 5 November 2026, finding 49).
  const byEmail = useQuotesByEmail(m)

  const q = versions.find((v) => v.id === picked) ?? m.draftOf(jobId) ?? m.currentOf(jobId) ?? versions[0]
  const current = m.currentOf(jobId)
  const settled = versions.some((v) => v.invoicedOn)
  const jm = m.job(jobId)
  // The quote's one filled red is what to record next on the current version, under What happened (nextRecord). Sending or printing
  // any version takes the red only once there's nothing left to record (UX sweep, 6 November 2026, move 1).
  // Once the job is past Quoting (ADR 0140), its own Next is here too, so the quote isn't a page that ends: the job's next step (the
  // crew, the kit, the pick) holds the one red, and the invoice and payment records wait plain until the work is done.
  const jobNext = view.steps.of(job.id)?.current
  const onTheJob = !!jobNext && jobNext.key !== 'quote' && jobNext.key !== 'confirmed'
  const toSend = !!q && q.status === 'sent' && q.id === current?.id && q.sentOn === today && !q.emails.length && !byEmail && !printed.has(q.id)
  const next = current ? nextRecord(current, job) : undefined
  const recording = !toSend && next !== undefined && !(onTheJob && (next === 'invoice' || next === 'paid'))
  // Sending and printing take the red only when nothing else holds it: not a record to make, nor the job's own Next.
  const plainSend = recording || onTheJob
  shownId.current = q?.id
  fileName.current = q ? `${q.number && q.status !== 'draft' && !q.numberPending ? `Quote ${q.number}` : 'Draft quote'} - ${job.name}` : ''

  return (
    // Under the job's own head, Next and stage line (ADR 0140, part 4): the version's own card says which it is and where it stands.
    <div className="quote-screen job-quote">
      {(versions.length > 1 || (q && !q.latest) || (jm && jm.margin !== null && q?.id === current?.id)) && (
      <section className="card plain quote-versions">
        {versions.length > 1 && (
          <div className="filters" role="group" aria-label="Versions">
            {versions.map((v) => (
              <button key={v.id} type="button" aria-pressed={v.id === q?.id} onClick={() => setPicked(v.id)}>
                Version {v.version} · {v.paidOn ? 'Paid' : v.invoicedOn ? 'Invoiced' : QUOTE_STATUS_LABELS[v.status]}
              </button>
            ))}
          </div>
        )}
        {q && !q.latest && <p className="hint">An older version, kept as it went to the client. The newest is version {versions[0]!.version}.</p>}
        {jm && jm.margin !== null && q?.id === current?.id && <MarginLine margin={jm.margin} costs={jm.costs + jm.toCome} />}
      </section>
      )}

      {q && <SinceBefore q={q} versions={versions} />}

      {!q ? (
        <FirstQuote view={view} job={job} plain={onTheJob} />
      ) : q.status === 'draft' ? (
        <Draft key={q.id} q={q} view={view} job={job} onPrint={() => setPrinting(true)} />
      ) : (
        <>
          <section className="card" aria-label={`Version ${q.version}`}>
            <header className="title">
              <h2>Version {q.version}</h2>
              <QuotePill q={q} />
            </header>
            <p className="quote-facts">
              {q.number ? `Quote ${q.number}${q.numberPending ? " (once it's saved)" : ''}` : 'Sent before quotes had numbers'} · Valid until {dayLabel(validUntil(q, today))}
              {q.depositPct ? ` · A deposit of ${pctWord(q.depositPct)}, ${money(depositCents(q.totals.gross, q.depositPct))}` : ''}
            </p>
            <Lines lines={q.lines} />
            <Totals totals={q.totals} agreed={q.agreedCents != null} />
            {/* What a quote makes (ADR 0089) is seen by all who see quotes: the office and directors, the only ones shown this tab. */}
            <p className="quote-margin">
              <MarginWords label="Expected margin" margin={quoteMargin(q.totals.net, q.lines.map((l) => lineCostOf(l, l.kind === 'crew' ? m.bookedRate(job.id, l) : undefined, m.quoting.ownKitCostPct)), ownKitUncosted(q.lines, m.quoting.ownKitCostPct))} />
              <small> From the quote's own costs. Not printed.</small>
            </p>
            {q.notes && <p className="notes">{q.notes}</p>}
            <Emails emails={q.emails} />
            <ClientLink q={q} on={!!m.quoting.acceptOnline} />
            {composing === q.id ? (
              <SendQuote q={q} onSent={() => setComposing(undefined)} onCancel={() => setComposing(undefined)} />
            ) : (
              <div className="actions">
                {byEmail && q.latest && (
                  <button type="button" className={plainSend || q.emails.length ? undefined : 'primary'} onClick={() => setComposing(q.id)}>
                    {q.emails.length ? 'Send again' : 'Send by email'}
                  </button>
                )}
                <button type="button" className={plainSend || (byEmail && q.latest && !q.emails.length) ? undefined : 'primary'} onClick={() => setPrinting(true)} disabled={printing}>
                  Print or save as PDF
                </button>
                {q.latest && !settled && <NewVersion q={q} onMade={setPicked} />}
              </div>
            )}
            {settled && q.latest && <p className="hint">The quote is invoiced, so it's settled: no new version.</p>}
          </section>
          {q.id === current?.id && <Records q={q} job={job} canEmail={byEmail} quiet={toSend || (onTheJob && (next === 'invoice' || next === 'paid'))} />}
        </>
      )}

      {/* At the foot, away from everything done every day: an admin's alone, and hard on purpose (ADR 0135). */}
      {q && <DeleteQuote q={q} job={job} versions={versions} onDeleted={() => setPicked(undefined)} />}

      <InCurrentRms jobId={job.id} />

      {printing &&
        q &&
        createPortal(
          <div className="print-sheet quote-sheet">
            <QuoteSheetPage q={q} />
            <QuoteSheet q={q} job={job} office={view.office} quoting={m.quoting} />
          </div>,
          document.body
        )}
    </div>
  )
}

/**
 * The client's link (ADR 0121): while the office takes answers online, a version with the client has it to copy, for a
 * quote sent another way than the email that carries it. An accept there is said here, with the name typed and when,
 * whether or not it's still on.
 */
function ClientLink({ q, on }: { q: QuoteView; on: boolean }) {
  const [copied, setCopied] = useState(false)
  if (q.acceptedOnline) {
    const at = new Date(q.acceptedOnline.at)
    const day = at.toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' })
    return (
      <p className="accepted-online">
        Accepted online by <b>{q.acceptedOnline.name}</b>, {dayLabel(day)} at {at.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Dublin' })}.
      </p>
    )
  }
  if (!on || !q.acceptToken || !q.latest || q.status !== 'sent') return null
  const link = `${location.origin}${acceptPath(q.acceptToken)}`
  return (
    <div className="client-link">
      <p className="hint">The client can accept this version online, with their name and a tick, at its own link. An emailed quote carries it.</p>
      <div className="actions">
        <button type="button" onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopied(true))}>
          {copied ? 'Copied' : "Copy the client's link"}
        </button>
        <a className="button quiet" href={link} target="_blank" rel="noreferrer">
          Open it as they see it
        </a>
      </div>
    </div>
  )
}

/** What changed since the version before (ADR 0084), so the office can tell the client in a sentence. */
function SinceBefore({ q, versions }: { q: QuoteView; versions: QuoteView[] }) {
  const before = versions.find((v) => v.version < q.version)
  if (!before) return null
  const c = versionChanges(before, q)
  const gross = q.totals.gross - before.totals.gross
  const terms = (l: QuoteLine) => (l.per === 'once' ? `${l.qty} at ${money(l.unitCents)} once` : `${l.qty} for ${daysWord(l.days)} at ${money(l.unitCents)} a day`)
  const none = c.added.length + c.removed.length + c.changed.length === 0 && !c.discount && !c.agreed
  return (
    <section className="card version-changes" aria-label={`What changed since version ${before.version}`}>
      <h2>What changed since version {before.version}</h2>
      {none ? (
        <p>Nothing in the lines or the discount: the same {money(q.totals.gross)}.</p>
      ) : (
        <>
          <ul>
            {c.added.map((l) => (
              <li key={l.id}>
                Added {l.what}: {terms(l)}
              </li>
            ))}
            {c.removed.map((l) => (
              <li key={l.id}>Took off {l.what}</li>
            ))}
            {c.changed.map(({ line, was }) => (
              <li key={line.id}>
                {line.what}: {terms(line)}, was {terms(was)}
              </li>
            ))}
            {c.agreed && (
              <li>
                {c.agreed.now === null ? `No price agreed, was ${money(c.agreed.was!)}` : c.agreed.was === null ? `Price agreed at ${money(c.agreed.now)} before VAT` : `Price agreed ${money(c.agreed.now)}, was ${money(c.agreed.was)}`}
              </li>
            )}
            {c.discount && (
              <li>
                Discount {pctWord(c.discount.now)}, was {pctWord(c.discount.was)}
              </li>
            )}
          </ul>
          <p>
            The total is <b>{money(q.totals.gross)}</b>,{' '}
            {gross === 0 ? 'the same as before' : `${money(Math.abs(gross))} ${gross > 0 ? 'more' : 'less'} than version ${before.version}'s ${money(before.totals.gross)}`}.
          </p>
        </>
      )}
    </section>
  )
}

/** With no quote yet: one built from the job, which the office then changes. */
function FirstQuote({ view, job, plain }: { view: View; job: JobView; plain?: boolean }) {
  const m = view.money
  const { run, error } = useAct()
  const source = m.sourceOf(job.id)
  const unpriced = source.kit.filter((k) => m.productPrice(k.modelId) === undefined).length
  const discount = m.discountOf(job.clientId)
  const build = (withLines: boolean) => {
    const lines = withLines ? linesFor(source.kit, source.crew, { product: m.productPrice, role: m.rolePrice, rate: m.productRate }, newId) : []
    void run(() => client.mutate('quote.save', { id: newId(), projectId: job.id, lines: lines.slice(0, MAX_LINES), discountPct: discount ?? 0, notes: '' }))
  }
  return (
    <section className="card" aria-label="Make a quote">
      <h2>Make a quote</h2>
      {source.kit.length + source.crew.length === 0 ? (
        // Where to add them, from here (audit, 5 November 2026, finding 16): a quote is built from the job's kit and crew.
        <Empty>
          The job has no kit or crew yet, so a quote would start empty. <a href={`#jobs/${encodeURIComponent(job.id)}/kit`}>Add the kit</a> or{' '}
          <a href={`#jobs/${encodeURIComponent(job.id)}/crew`}>add crew</a> first, or start one empty and type the lines.
        </Empty>
      ) : (
        <p>
          {source.kit.length} kit line{source.kit.length === 1 ? '' : 's'} and {source.crew.length} crew call{source.crew.length === 1 ? '' : 's'}, each for the days
          it's out or worked, at the price list's day prices
          {discount ? `, with ${job.client?.name}'s ${pctWord(discount)} off` : ''}. You can change any of it before it goes.
        </p>
      )}
      {unpriced > 0 && (
        <p className="warn-line">
          {unpriced} product{unpriced === 1 ? " has" : 's have'} no day price yet, so {unpriced === 1 ? 'it goes' : 'they go'} in at nothing to price. Set prices on the{' '}
          <a href="#jobs/money/prices">price list</a> for next time.
        </p>
      )}
      <Refusal error={error} />
      <div className="actions">
        {source.kit.length + source.crew.length > 0 && (
          // Plain once the job is past Quoting: its own Next, in the head, holds the page's one red (ADR 0140, part 4).
          <button type="button" className={plain ? undefined : 'primary'} onClick={() => build(true)}>
            Build it from the job
          </button>
        )}
        <button type="button" onClick={() => build(false)}>
          Start one empty
        </button>
      </div>
    </section>
  )
}
