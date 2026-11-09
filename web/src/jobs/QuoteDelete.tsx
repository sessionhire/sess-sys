import { dayLabel, deleteTyped, deleteWord, type JobView, type QuoteView } from '@sh/shared'
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { Icon } from '../Icon.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'

/**
 * Deleting a version of a quote (ADR 0135), for admins only: a director or a
 * system admin, as erasing a person is, and the server holds to it. It's
 * meant to be hard. The button sits at the foot of the quote, away from
 * everything done every day, and opens a dialog that names the version,
 * says what's true of it that makes deleting it matter (gone to the client,
 * accepted, invoiced, emailed, the job's only one), and asks for its number
 * to be typed, or the word "delete" for one never sent. Delete stays off
 * until it matches, and the safe answer has the focus.
 *
 * The server keeps it, out of sight: the history says who deleted it, and
 * an admin can put it back from there.
 */
export function DeleteQuote({ q, job, versions, onDeleted }: { q: QuoteView; job: JobView; versions: readonly QuoteView[]; onDeleted: () => void }) {
  const may = useAccess().can('company')
  const [open, setOpen] = useState(false)
  if (!may || q.pending) return null
  return (
    <div className="delete-quote">
      <button type="button" className="link delete-quote-open" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="delete" />
        Delete version {q.version}…
      </button>
      {open && <DeleteDialog q={q} job={job} versions={versions} onClose={() => setOpen(false)} onDeleted={onDeleted} />}
    </div>
  )
}

function DeleteDialog({ q, job, versions, onClose, onDeleted }: { q: QuoteView; job: JobView; versions: readonly QuoteView[]; onClose: () => void; onDeleted: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const safe = useRef<HTMLButtonElement>(null)
  const [typed, setTyped] = useState('')
  const { run, error } = useAct()
  const word = deleteWord(q)
  const ready = deleteTyped(q, typed)

  // A modal, so Escape closes it and the focus goes back to the button; it lands on Keep it, the safe answer.
  useLayoutEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    safe.current?.focus()
  }, [])

  const facts = warnings(q, job, versions)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    void run(() => client.mutate('quote.delete', { id: q.id, typed: typed.trim() })).then((ok) => {
      if (!ok) return
      ref.current?.close()
      onDeleted()
    })
  }

  const title = `Delete version ${q.version} of the quote for ${job.name}?`
  return (
    <dialog className="delete-quote-dialog" ref={ref} aria-labelledby="delete-quote-title" aria-describedby="delete-quote-what" onClose={onClose}>
      <form onSubmit={submit}>
        <h2 id="delete-quote-title">{title}</h2>
        <div id="delete-quote-what">
          {facts.length > 0 && (
            <ul className="delete-quote-facts">
              {facts.map((f) => (
                <li key={f}>
                  <Icon name="attention" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
          <p>
            It goes from every device, and from Quotes and the job. The job itself stays as it is. An admin can put it back from the{' '}
            <a href={`#history/job/${encodeURIComponent(job.id)}`}>job's history</a>.
          </p>
        </div>
        <label className="field">
          {q.number ? `Type the quote number, ${word}, to delete it` : `Type “${word}” to delete it`}
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            inputMode={q.number ? 'numeric' : 'text'}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={typed.trim() !== '' && !ready ? true : undefined}
          />
        </label>
        <Refusal error={error} />
        <div className="actions">
          <button type="button" ref={safe} onClick={() => ref.current?.close()}>
            Keep it
          </button>
          <button type="submit" className="danger" disabled={!ready}>
            Delete version {q.version}
          </button>
        </div>
      </form>
    </dialog>
  )
}

/** What's true of this version that makes deleting it matter, each in a line, worst first. */
export function warnings(q: QuoteView, job: Pick<JobView, 'status'>, versions: readonly QuoteView[]): string[] {
  const out: string[] = []
  if (q.paidOn) out.push(`It's marked paid, on ${dayLabel(q.paidOn)}.`)
  if (q.invoicedOn) out.push(`It's marked invoiced, on ${dayLabel(q.invoicedOn)}${q.invoiceRef ? `, as ${q.invoiceRef}` : ''}.`)
  if (q.status === 'accepted') out.push(`The client accepted it${q.answeredOn ? ` on ${dayLabel(q.answeredOn)}` : ''}${q.acceptedOnline ? `, online, as ${q.acceptedOnline.name}` : ''}.`)
  if (q.status === 'declined') out.push(`The client turned it down${q.answeredOn ? ` on ${dayLabel(q.answeredOn)}` : ''}.`)
  if (q.status !== 'draft') out.push(`It went to the client${q.sentOn ? ` on ${dayLabel(q.sentOn)}` : ''}${q.number ? ` as quote ${q.number}` : ''}. Their link to it stops working.`)
  if (q.emails.length) out.push(`${q.emails.length === 1 ? 'The email' : `The ${q.emails.length} emails`} it went in ${q.emails.length === 1 ? 'goes' : 'go'} from the job with it.`)
  if (job.status === 'confirmed') out.push('The job is confirmed.')
  if (versions.length === 1) out.push("It's the job's only version, so the job will have no quote.")
  else if (q.latest) out.push(`It's the newest version: version ${versions.find((v) => v.id !== q.id)?.version} becomes the one that counts.`)
  return out
}
