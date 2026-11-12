import { reachContext, telHref, whatsappNumber, type Person, type ReachContext } from '@sh/shared'
import { useMemo } from 'react'
import { useToday, useView } from '../view.ts'

/**
 * What the app sends crew by itself (ADR 0149), as the screens read it: the server's rules for the calendar invite and
 * the offer on WhatsApp, worked out on this device from what it holds (shared/src/reach.ts).
 */
export function useReach(): ReachContext {
  const view = useView()
  const today = useToday()
  return useMemo(() => reachContext(view, today), [view, today])
}

/**
 * Ring, WhatsApp or Email for someone nothing of the app's has reached (audit of 12 November 2026, finding 14): the
 * plain contact ADR 0048 keeps, a call or a chat with nothing written in it, so a mis-tap sends nothing. Email only
 * when there's no number to ring.
 */
export function PlainContact({ person }: { person: Pick<Person, 'name' | 'phone' | 'email'> }) {
  const phone = person.phone?.trim()
  const email = person.email?.trim()
  return (
    <>
      {phone && (
        <a className="link" href={telHref(phone)} aria-label={`Ring ${person.name}`}>
          Ring
        </a>
      )}
      {phone && (
        <a className="link" href={`https://wa.me/${whatsappNumber(phone)}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${person.name}`}>
          WhatsApp
        </a>
      )}
      {!phone && email && (
        <a className="link" href={`mailto:${email}`} aria-label={`Email ${person.name}`}>
          Email
        </a>
      )}
    </>
  )
}
