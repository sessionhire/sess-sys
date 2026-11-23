import { ibanShown, type PaymentDetails, type PaymentDetailsShown, type PaymentField, type PersonView } from '@sh/shared'
import { useId, useState, type FormEvent } from 'react'
import { Refusal } from '../act.tsx'
import { markSignedOut } from '../auth.ts'
import { Heading } from '../Icon.tsx'
import { getJson, useAsked } from '../jobs/rms.ts'
import { useAccess } from '../role.ts'

const base = import.meta.env.VITE_API_BASE ?? ''

/**
 * A person's details for paying them (ADR 0193): PPS number, VAT number and bank account, for directors and the office
 * only. They stay on the server, locked, so the card asks for them each time and needs signal; they come masked, with
 * Show in full to read them (which the history records) and Change to put them in or correct them. Kept, not used:
 * invoicing waits until the office says how it pays people.
 */

const LABELS: Record<PaymentField, string> = {
  ppsn: 'PPS number',
  vatNumber: 'VAT number',
  accountName: 'Name on the account',
  iban: 'IBAN',
  bic: 'BIC',
}
const FIELDS = Object.keys(LABELS) as PaymentField[]

export function PaymentCard({ person }: { person: PersonView }) {
  const money = useAccess().can('money')
  const [full, setFull] = useState(false)
  const [editing, setEditing] = useState(false)
  const [again, setAgain] = useState(0)
  const loaded = useAsked<PaymentDetailsShown>(money, `${person.id}:${full}`, () => getJson(`/api/people/${encodeURIComponent(person.id)}/payment${full ? '?full=1' : ''}`), again)
  if (!money) return null
  const shown = loaded.state === 'ready' ? loaded.data : null
  // Saved: shown masked again, as the server now has them.
  const done = () => {
    setEditing(false)
    setFull(false)
    setAgain((n) => n + 1)
  }
  return (
    <section className="card payment-card" aria-label="Payment details">
      <Heading icon="locked">Payment details</Heading>
      <p className="hint">Only directors and the office see these. They’re kept locked on the server, not on this device.</p>
      {loaded.state === 'loading' && <p className="hint">Asking the server…</p>}
      {loaded.state === 'offline' && <p className="hint">These need signal: they aren’t kept on this device. Try again once it’s back.</p>}
      {loaded.state === 'gone' && <Refusal error={loaded.error} />}
      {shown && editing ? (
        // The form fills in from the full ones, so it waits for them.
        shown.full || !shown.kept ? (
          <PaymentForm person={person} was={shown.details} onDone={done} onCancel={() => (setEditing(false), setFull(false))} />
        ) : (
          <p className="hint">Asking the server…</p>
        )
      ) : shown ? (
        <>
          {shown.kept ? (
            <dl className="facts">
              {FIELDS.filter((f) => shown.details[f]).map((f) => (
                <div key={f}>
                  <dt>{LABELS[f]}</dt>
                  <dd>{f === 'iban' && shown.full ? ibanShown(shown.details.iban) : shown.details[f]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="empty">None yet. They can give them when they apply, or put them in here.</p>
          )}
          {shown.kept && shown.changedAt && (
            <p className="hint">
              Given or changed {new Date(shown.changedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
              {shown.changedBy ? (/apply page/i.test(shown.changedBy) ? ' on the Apply page' : ` by ${shown.changedBy}`) : ''}.
            </p>
          )}
          <div className="actions">
            {shown.kept && (
              <button type="button" onClick={() => setFull(!shown.full)} aria-pressed={shown.full}>
                {shown.full ? 'Hide' : 'Show in full'}
              </button>
            )}
            <button type="button" onClick={() => (setFull(true), setEditing(true))}>
              {shown.kept ? 'Change' : 'Add payment details'}
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}

function PaymentForm({ person, was, onDone, onCancel }: { person: PersonView; was: PaymentDetails; onDone: () => void; onCancel: () => void }) {
  const id = useId()
  const [f, setF] = useState<PaymentDetails>({ ...was, iban: was.iban ? ibanShown(was.iban) : '' })
  const [errors, setErrors] = useState<Partial<Record<PaymentField, string>>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${base}/api/people/${encodeURIComponent(person.id)}/payment`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(f),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })
      if (res.status === 401) markSignedOut()
      const body = (await res.json().catch(() => ({}))) as PaymentDetailsShown & { error?: string; errors?: Partial<Record<PaymentField, string>> }
      if (!res.ok) {
        setErrors(body.errors ?? {})
        setError(body.errors ? '' : (body.error ?? `The server answered ${res.status}.`))
        return
      }
      onDone()
    } catch {
      setError('They weren’t saved: there’s no signal. Try again once it’s back.')
    } finally {
      setBusy(false)
    }
  }
  const field = (k: PaymentField, extra: { placeholder?: string; autoComplete?: string } = {}) => (
    <label key={k}>
      {LABELS[k]}
      {k === 'bic' || k === 'vatNumber' ? ' (optional)' : ''}
      <input
        value={f[k]}
        onChange={(e) => setF((was) => ({ ...was, [k]: e.target.value }))}
        spellCheck={false}
        autoComplete={extra.autoComplete ?? 'off'}
        placeholder={extra.placeholder}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `${id}-${k}` : undefined}
      />
      {errors[k] && (
        <span className="alert" id={`${id}-${k}`}>
          {errors[k]}
        </span>
      )}
    </label>
  )
  return (
    <form className="grid-form" onSubmit={(e) => void save(e)} aria-label={`Payment details for ${person.name}`}>
      {field('ppsn', { placeholder: '1234567FA' })}
      {field('vatNumber', { placeholder: 'IE1234567T' })}
      {field('accountName')}
      {field('iban', { placeholder: 'IE29 AIBK 9311 5212 3456 78' })}
      {field('bic', { placeholder: 'AIBKIE2D' })}
      <p className="hint wide">Clear them all and save to take them off.</p>
      <Refusal error={error} className="wide" />
      <button type="submit" className="primary" aria-busy={busy || undefined} disabled={busy}>
        Save payment details
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}
