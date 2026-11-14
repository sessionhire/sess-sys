import { DELIVERY_ADDRESS_LENGTH, HANDOVER_DAYS, HANDOVERS, type Handover, type HireTerms, type Pin, type PlacesFound } from '@sh/shared'
import { useId, useState } from 'react'
import { ask } from '../server.ts'
import { useLate } from '../useLate.ts'

/**
 * A dry hire's handover, as asked on New quote, on New for a dry hire, and under the job's Change details (ADR 0183;
 * Colly, 14 November 2026): Delivery or Collection, a time with each of its two days, and, for a delivery only, the
 * address it goes to. Collection calls the days Collection and Return; a delivery keeps From and To.
 *
 * The address is looked up on the map when it's left, so the quote's delivery line can be measured to it; with no
 * signal it's kept as typed and looked up when the job is saved, or later under Change details.
 */

export interface HireDraft {
  handover: Handover
  outTime: string
  backTime: string
  address: string
  pin: Pin | null
  /** The address the pin was found for, so a changed address is looked up again. */
  pinFor: string
  /** What the map found it as, said under the box. */
  found: string
}

export const hireDraftOf = (h: HireTerms | null | undefined): HireDraft => ({
  // A dry hire from before had no say: it was collected (ADR 0128).
  handover: h?.handover ?? 'collection',
  outTime: h?.outTime ?? '',
  backTime: h?.backTime ?? '',
  address: h?.address ?? '',
  pin: h?.pin ?? null,
  pinFor: h?.pin ? (h.address ?? '').trim() : '',
  found: '',
})

/** What's stored: the address and its pin only for a delivery, and a time only when one is given. */
export function hireTermsOf(d: HireDraft): HireTerms {
  const address = d.address.trim()
  const delivery = d.handover === 'delivery' && !!address
  return {
    handover: d.handover,
    ...(d.outTime ? { outTime: d.outTime } : {}),
    ...(d.backTime ? { backTime: d.backTime } : {}),
    ...(delivery ? { address, pin: d.pinFor === address ? d.pin : null } : {}),
  }
}

/** The same handover as stored, so Change details only sends it when something changed. */
export const sameHire = (a: HireTerms | null | undefined, b: HireTerms) => JSON.stringify(hireTermsOf(hireDraftOf(a))) === JSON.stringify(b)

/** The first place the map finds for an address, or none: no signal or nothing found leaves it off the map. */
async function lookUp(address: string): Promise<{ pin: Pin | null; found: string }> {
  try {
    const answer = await ask<PlacesFound>(`/api/places?${new URLSearchParams({ address })}`)
    const f = answer.found[0]
    return f ? { pin: { lat: f.lat, lng: f.lng }, found: f.label } : { pin: null, found: '' }
  } catch {
    return { pin: null, found: '' }
  }
}

/** The draft with its delivery address on the map, looked up if it changed since; for saving with. */
export async function placed(d: HireDraft): Promise<HireDraft> {
  const address = d.address.trim()
  if (d.handover !== 'delivery' || !address || d.pinFor === address) return d
  return { ...d, ...(await lookUp(address)), pinFor: address }
}

export function HireFields({
  value,
  onChange,
  days,
  disabled,
}: {
  value: HireDraft
  onChange: (next: (now: HireDraft) => HireDraft) => void
  /** The hire's first and last days, asked here beside their times on a new one; left out where the days are its phase's. */
  days?: { start: string; end: string; min?: string; set: (d: { start: string; end: string }) => void }
  disabled?: boolean
}) {
  const id = useId()
  const [looking, setLooking] = useState(false)
  const late = useLate(looking)
  const words = HANDOVER_DAYS[value.handover]
  const address = value.address.trim()
  const look = async () => {
    if (value.handover !== 'delivery' || !address || value.pinFor === address) return
    setLooking(true)
    const r = await lookUp(address)
    setLooking(false)
    onChange((now) => (now.address.trim() === address ? { ...now, ...r, pinFor: address } : now))
  }
  const onMap = value.pinFor === address && !!value.pin
  return (
    <>
      <fieldset className="choices wide hire-handover" disabled={disabled}>
        <legend>How it gets there</legend>
        {HANDOVERS.map((h) => (
          <label className="signal" key={h}>
            <input
              type="radio"
              name={`${id}-handover`}
              checked={value.handover === h}
              onChange={() => onChange((now) => ({ ...now, handover: h }))}
              aria-labelledby={`${id}-${h}-name`}
              aria-describedby={`${id}-${h}-about`}
            />
            <span>
              <b id={`${id}-${h}-name`}>{h === 'delivery' ? 'Delivery' : 'Collection'}</b>{' '}
              <span id={`${id}-${h}-about`}>{h === 'delivery' ? 'We take it to them and bring it back' : 'They collect it and return it'}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="pair">
        {days && (
          <label>
            {words.out}
            <input type="date" value={days.start} min={days.min} onChange={(e) => days.set({ start: e.target.value, end: days.end < e.target.value ? e.target.value : days.end })} required disabled={disabled} />
          </label>
        )}
        <label>
          {days ? 'Time' : `${words.out} time`} <span className="optional">(optional)</span>
          <input type="time" value={value.outTime} onChange={(e) => onChange((now) => ({ ...now, outTime: e.target.value }))} aria-label={`${words.out} time`} disabled={disabled} />
        </label>
      </div>
      <div className="pair">
        {days && (
          <label>
            {words.back}
            <input type="date" value={days.end} min={days.start} onChange={(e) => days.set({ start: days.start, end: e.target.value })} required disabled={disabled} />
          </label>
        )}
        <label>
          {days ? 'Time' : `${words.back} time`} <span className="optional">(optional)</span>
          <input type="time" value={value.backTime} onChange={(e) => onChange((now) => ({ ...now, backTime: e.target.value }))} aria-label={`${words.back} time`} disabled={disabled} />
        </label>
      </div>
      {value.handover === 'delivery' && (
        <label className="wide">
          Delivery address
          <textarea
            rows={2}
            maxLength={DELIVERY_ADDRESS_LENGTH}
            value={value.address}
            onChange={(e) => onChange((now) => ({ ...now, address: e.target.value }))}
            onBlur={() => void look()}
            autoComplete="street-address"
            aria-describedby={`${id}-where`}
            disabled={disabled}
          />
          <small id={`${id}-where`} aria-live="polite">
            {looking
              ? late
                ? 'Finding it on the map…'
                : ' '
              : !address
                ? 'The quote charges the delivery by the km from the warehouse to here.'
                : onMap
                  ? `On the map${value.found ? ` as ${value.found}` : ''}: the quote charges the km from the warehouse.`
                  : value.pinFor === address
                    ? "Not found on the map, so the quote can't measure the delivery yet. Add an Eircode or the town."
                    : 'Found on the map once you move on, to measure the delivery.'}
          </small>
        </label>
      )}
    </>
  )
}
