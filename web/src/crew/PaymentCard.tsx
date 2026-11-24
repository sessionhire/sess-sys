import { ibanShown, type PaymentDetails, type PaymentDetailsShown, type PaymentField, type PersonView } from '@sh/shared'
import { useId, useState, type FormEvent } from 'react'
import { Refusal } from '../act.tsx'
import { markSignedOut } from '../auth.ts'
import { Heading } from '../Icon.tsx'
import { getJson, useAsked } from '../jobs/rms.ts'
import { useAccess } from '../role.ts'
import { useView } from '../view.ts'

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
  const access = useAccess()
  // A PPS number only where the company uses them with Revenue (ADR 0193): off, the form doesn't ask for one.
  const askPpsn = useView().office.askPpsn
  const money = access.can('money')
  // Only a director opens them in full (Colly, 24 November 2026); the office sees them masked, and changes them by typing them afresh.
  const seesFull = !access.role || access.role === 'director'
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
      <p className="hint">
        {seesFull ? 'Only directors and the office see these, and only directors in full.' : 'You see these masked; only a director sees them in full.'} They’re kept locked on the server, not on
        this device.
      </p>
      {loaded.state === 'loading' && <p className="hint">Asking the server…</p>}
      {loaded.state === 'offline' && <p className="hint">These need signal: they aren’t kept on this device. Try again once it’s back.</p>}
      {loaded.state === 'gone' && <Refusal error={loaded.error} />}
      {shown && editing ? (
        // The form fills in from the full ones, so it waits for them.
        shown.full || !shown.kept || !seesFull ? (
          <PaymentForm person={person} was={seesFull ? shown.details : NO_DETAILS} afresh={!seesFull && shown.kept} ppsn={askPpsn || !!shown.details.ppsn} onDone={done} onCancel={() => (setEditing(false), setFull(false))} />
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
          {shown.kept && shown.changedBy?.endsWith('on their own page') && (
            // Changed from a link, which can be passed on: the usual way money is sent to the wrong account, so said where it's read.
            <p className="warn-line">Changed on their own page. Before paying to a new account, ring them on the number you already have to check it’s theirs.</p>
          )}
          <div className="actions">
            {shown.kept && seesFull && (
              <button type="button" onClick={() => setFull(!shown.full)} aria-pressed={shown.full}>
                {shown.full ? 'Hide' : 'Show in full'}
              </button>
            )}
            <button type="button" onClick={() => (setFull(seesFull), setEditing(true))}>
              {shown.kept ? 'Change' : 'Add payment details'}
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}

const NO_DETAILS: PaymentDetails = { ppsn: '', vatNumber: '', accountName: '', iban: '', bic: '' }

function PaymentForm({ person, was, afresh, ppsn = true, onDone, onCancel }: { person: PersonView; was: PaymentDetails; afresh?: boolean; ppsn?: boolean; onDone: () => void; onCancel: () => void }) {
  const id = useId()
  const [f, setF] = useState<PaymentDetails>({ ...was, iban: was.iban ? ibanShown(was.iban) : '' })
  const [errors, setErrors] = useState<Partial<Record<PaymentField, string>>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    // Typing afresh, an empty form would wipe details its sender can't see: taking them off is for a director.
    if (afresh && Object.values(f).every((v) => !v.trim())) return setError('Type the new details first. Only a director can take them off.')
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
      {ppsn && field('ppsn', { placeholder: '1234567FA' })}
      {field('vatNumber', { placeholder: 'IE1234567T' })}
      {field('accountName')}
      {field('iban', { placeholder: 'IE29 AIBK 9311 5212 3456 78' })}
      {field('bic', { placeholder: 'AIBKIE2D' })}
      <p className="hint wide">{afresh ? 'Type them all as they are now: what you save replaces what’s kept.' : 'Clear them all and save to take them off.'}</p>
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
