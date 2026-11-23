import { DIAL_CODES, normalisePhone, PHONE_FIELD_HINT, phoneWithCountry, splitPhone } from '@sh/shared'
import { useId, useRef, useState } from 'react'

/**
 * Every phone number the app takes (ADR 0190, then system-wide): the country picked beside it, Ireland first, and the
 * number typed as at home. It hands its form the number in international form (+353868319330) once it can read it,
 * else what was typed, which `phoneProblem` then refuses on save. A number already kept opens split into its country
 * and the rest, so editing someone tidies their number too.
 */
export function PhoneField({
  label,
  value,
  onChange,
  className,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (phone: string) => void
  className?: string
  placeholder?: string
  required?: boolean
}) {
  const id = useId()
  const [typed, setTyped] = useState(() => splitPhone(value))
  // What this field last handed the form: anything else arriving (the form cleared, another record) starts it afresh.
  const sent = useRef(value)
  if (value !== sent.current) {
    sent.current = value
    const fresh = splitPhone(value)
    if (fresh.country !== typed.country || fresh.national !== typed.national) setTyped(fresh)
  }
  const change = (next: { country: string; national: string }) => {
    setTyped(next)
    const read = phoneWithCountry(next.country, next.national)
    const phone = !next.national.trim() ? '' : read.problem === undefined && read.phone ? read.phone : next.national
    sent.current = phone
    onChange(phone)
  }
  const wrong = !!phoneProblem(value)
  return (
    <div className={`phone-field${className ? ` ${className}` : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="dial">
        <select aria-label="Country code" value={typed.country} onChange={(e) => change({ ...typed, country: e.target.value })}>
          {DIAL_CODES.map(([code, country]) => (
            <option key={`${code}-${country}`} value={code}>
              {country} +{code}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          autoComplete="tel-national"
          maxLength={40}
          value={typed.national}
          placeholder={placeholder ?? '087 123 4567'}
          required={required}
          aria-invalid={wrong || undefined}
          onChange={(e) => change({ ...typed, national: e.target.value })}
        />
      </div>
    </div>
  )
}

/** Why a phone can't be saved as it stands, or nothing: the words every form refuses it with. */
export function phoneProblem(phone: string | null | undefined): string | undefined {
  const typed = (phone ?? '').trim()
  if (!typed) return undefined
  return normalisePhone(typed).problem !== undefined ? PHONE_FIELD_HINT : undefined
}
