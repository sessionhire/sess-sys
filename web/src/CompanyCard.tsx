import { ADDRESS_LENGTH, addressOnOneLine, DIRECTORS_LENGTH, legalLine, TRADING_NAME, tradingNameOf, type OfficeView } from '@sh/shared'
import { useState, type FormEvent } from 'react'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

const KEYS = ['tradingName', 'legalName', 'croNumber', 'registeredAddress', 'directors', 'vatNumber', 'address'] as const
type Fields = Record<(typeof KEYS)[number], string>
const fieldsOf = (d: OfficeView['details']): Fields => Object.fromEntries(KEYS.map((k) => [k, d?.[k] ?? ''])) as Fields
const same = (a: Fields, b: Fields) => KEYS.every((k) => a[k] === b[k])
const orNull = (s: string) => s.trim() || null

/**
 * The company's details for the foot of every quote (ADR 0181): what it trades as, the company as the CRO has it, its
 * VAT number and the address it trades from. Irish company law asks a company's business letters and order forms to
 * say its registered name, that it's registered in Ireland and its number, its registered office, and its directors
 * (Companies Act 2014, section 151); a quote is the nearest thing this app sends. The foot as it will print is shown
 * under the form, so the office sees what the client will.
 */
export function CompanyCard({ office }: { office: OfficeView }) {
  const { details, pending } = office
  const saved = fieldsOf(details)
  const [f, setF] = useState(saved)
  // As the office card: a change synced from another device is taken in unless someone's part way through typing here.
  const [from, setFrom] = useState(saved)
  if (!same(from, saved)) {
    setFrom(saved)
    if (same(f, from)) setF(saved)
  }
  const { run, error } = useAct()
  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const save = (e: FormEvent) => {
    e.preventDefault()
    void run(() =>
      client.mutate('company.details', {
        tradingName: orNull(f.tradingName),
        legalName: orNull(f.legalName),
        croNumber: orNull(f.croNumber.replace(/\s+/g, '')),
        registeredAddress: orNull(f.registeredAddress),
        directors: orNull(f.directors),
        vatNumber: orNull(f.vatNumber),
        address: orNull(f.address),
      })
    )
  }
  const trade = tradingNameOf({ tradingName: f.tradingName })
  const foot = [[trade, addressOnOneLine(f.address)].filter(Boolean).join(' · '), f.vatNumber.trim() && `VAT number ${f.vatNumber.trim()}`, legalLine(f)].filter(Boolean)
  const missing = [!f.legalName.trim() && 'registered name', !f.croNumber.trim() && 'CRO number', !f.registeredAddress.trim() && 'registered office', !f.directors.trim() && 'directors'].filter(Boolean)
  return (
    <section className="card office" aria-labelledby="company-title">
      <h2 id="company-title">Company details</h2>
      <p>
        Along the foot of every quote, on the page and in the PDF. The law asks a company's letters and order forms to give its registered name and
        number, its registered office and its directors' names; the VAT number lets a client reclaim the VAT.
      </p>
      <form className="office-form" onSubmit={save}>
        <label>
          Trading name <input value={f.tradingName} onChange={set('tradingName')} maxLength={200} placeholder={TRADING_NAME} />
        </label>
        <label>
          Registered name <input value={f.legalName} onChange={set('legalName')} maxLength={200} placeholder="As on the CRO, with Limited or DAC" />
        </label>
        <label>
          CRO number <input value={f.croNumber} onChange={set('croNumber')} inputMode="numeric" maxLength={12} placeholder="612345" />
        </label>
        <label>
          VAT number <input value={f.vatNumber} onChange={set('vatNumber')} placeholder="IE 1234567T" autoCapitalize="characters" />
        </label>
        <label className="wide">
          Registered office{' '}
          <textarea rows={3} value={f.registeredAddress} onChange={set('registeredAddress')} maxLength={ADDRESS_LENGTH} placeholder="As registered with the CRO, a line each" />
        </label>
        <label className="wide">
          Address you trade from{' '}
          <textarea rows={3} value={f.address} onChange={set('address')} maxLength={ADDRESS_LENGTH} placeholder="Leave empty if it's the registered office" />
        </label>
        <label className="wide">
          Directors <input value={f.directors} onChange={set('directors')} maxLength={DIRECTORS_LENGTH} placeholder="First and last names, with commas between" />
          <small>Add a director's nationality in brackets if they aren't Irish, as the law asks: "Sam Lee (British)".</small>
        </label>
        <div className="actions wide">
          <button type="submit" className="primary" disabled={same(f, saved)}>
            Save company details
          </button>
          <Pending pending={pending} />
        </div>
      </form>
      <Refusal error={error} />
      <div className="company-foot" aria-label="The foot of a quote">
        <p className="hint">The foot of a quote will read:</p>
        <blockquote>
          {foot.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </blockquote>
        {missing.length > 0 && <p className="hint">Not given yet: {missing.join(', ')}.</p>}
      </div>
    </section>
  )
}
