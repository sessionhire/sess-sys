import {
  daysLabel,
  HOLDING,
  newId,
  offerMessage,
  OPEN,
  tellMessage,
  whatsappNumber,
  type CallView,
  type OfferView,
  type Person,
  type PersonView,
  type TellContext,
  type TellEvent,
} from '@sh/shared'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccess } from '../role.ts'
import { useView } from '../view.ts'

/**
 * The messages for crew the office sends itself (audit finding 9): an offer,
 * or word of a change, on WhatsApp, a text or an email with the words filled
 * in. Nothing is sent for you.
 */

export const linkFor = (p: Pick<Person, 'linkToken'>) => (p.linkToken ? `${location.origin}/f/${p.linkToken}` : '')

/** One person to tell, with the call it's about and whatever else the message needs. */
export interface TellTo {
  person: Person
  context: TellContext
}

/** People to tell after something the office did, and what happened. */
export interface Tell {
  /** Its own, so a new prompt starts from its first person even when it replaces one still open. */
  id: string
  event: TellEvent
  to: TellTo[]
}

/** What's open at the bottom of a screen: an offer to send, or people to tell. One at a time. */
export type Share = { kind: 'offer'; person: PersonView; call: CallView } | { kind: 'tell'; tell: Tell }

/**
 * The prompt after something the office did (audit finding 9): a message
 * for each person, written for what happened, to send by WhatsApp, text or
 * email as the offer is, or to copy. The app sends nothing itself. Nothing
 * when there's nobody to tell. A call changed or a phase moved prompts the
 * same way: setShare(promptFor('call-changed', peopleOn(call))).
 */
export function promptFor(event: TellEvent, to: TellTo[]): Share | undefined {
  return to.length ? { kind: 'tell', tell: { id: newId(), event, to } } : undefined
}

/** Someone to tell about a call, with their own days and agreed rate when they have an offer on it. */
export function tellTo(person: Person, call: CallView, offer?: Pick<OfferView, 'id' | 'days' | 'status' | 'dayRateCents' | 'counterRateCents'>): TellTo {
  const agreed = offer ? (offer.status === 'countered' ? offer.counterRateCents : offer.dayRateCents) : call.dayRateCents
  return { person, context: { call: { ...call, dayRateCents: agreed }, days: offer?.days, offerId: offer?.id } }
}

/** Everyone offered or holding a place on a call, to tell when it changes or goes. */
export function peopleOn(call: CallView, statuses: readonly OfferView['status'][] = [...OPEN, ...HOLDING]): TellTo[] {
  return call.offers.filter((o) => o.person && statuses.includes(o.status)).map((o) => tellTo(o.person as Person, call, o))
}

/**
 * The panel for whatever is open: the offer to send, or the people to tell one at a time. `inJob` is the job's page, under its
 * Next dock, which holds the page's one filled red (ADR 0104), so WhatsApp is plain there (UX sweep, 6 November 2026, move 1).
 */
export function SharePanelFor({ share, onClose, inJob = false }: { share: Share; onClose: () => void; inJob?: boolean }) {
  if (share.kind === 'offer') return <SharePanel person={share.person} call={share.call} onClose={onClose} inJob={inJob} />
  return <TellPanel key={share.tell.id} tell={share.tell} onClose={onClose} inJob={inJob} />
}

/**
 * WhatsApp, a text or an email with the words filled in, or a copy of them. Nothing is sent for you. WhatsApp is the panel's
 * red fill, except on the job's page (`inJob`), where the Next dock holds the page's one.
 */
export function SendButtons({ person, text, subject, inJob = false }: { person: Pick<Person, 'phone' | 'email'>; text: string; subject: string; inJob?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <>
      {person.phone && (
        <>
          <a className={inJob ? 'button' : 'button primary'} href={`https://wa.me/${whatsappNumber(person.phone)}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a className="button" href={`sms:${person.phone}?&body=${encodeURIComponent(text)}`}>
            Text
          </a>
        </>
      )}
      {person.email && (
        <a className="button" href={`mailto:${person.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}>
          Email
        </a>
      )}
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => setCopied(true))
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </>
  )
}

/** Whether Offer, Send, Tell and Ask open a message to a real person (ADR 0048): off until the office says so under Admin. */
export const usePromptsMessages = () => useView().office.promptMessages

/**
 * In a Send panel's place while messages to crew are off (ADR 0048): what
 * would have opened, for whom, that their link carries it regardless, and
 * where it's turned on. The mode shows itself where it bites, not only on
 * Admin (rule 14).
 */
/**
 * A panel opened by a press (Offer, Send, Confirm, Release) comes into view with the focus on it, so it's seen and read rather than
 * left under the fold with focus nowhere (audit, 20 October 2026, finding 77c; 5 November 2026, finding 5). The screens open it where
 * the press was, so this is a nudge, not a jump.
 */
function useInView() {
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    panel.current?.scrollIntoView?.({ block: 'nearest' })
    panel.current?.focus({ preventScroll: true })
  }, [])
  return panel
}

export function QuietPanel({ names, what, onLink = true, onClose }: { names: readonly string[]; what: string; onLink?: boolean; onClose: () => void }) {
  const admin = useAccess().can('settings')
  const who = names.length === 1 ? names[0] : `${names.length} people`
  const panel = useInView()
  return (
    <section className="card share" aria-label={`Messages to crew are off: ${what} for ${who}`} ref={panel} tabIndex={-1}>
      <h2>Messages to crew are off</h2>
      <p className="empty">
        Nothing opened to send {who} the {what}.{onLink ? ` ${names.length === 1 ? 'Their link' : 'Their links'} already say${names.length === 1 ? 's' : ''} so.` : ''} Messages
        are turned on under {admin ? <a href="#admin/company">Admin › Company</a> : 'Admin, by the office'}.
      </p>
      <button type="button" onClick={onClose}>
        Done
      </button>
    </section>
  )
}

/**
 * Their private link isn't on this device: not made yet (the server makes it
 * when the person first syncs), or not sent to this role (ADR 0046), when
 * the office sends it, and whatever was done is already on their page.
 */
function NoLinkYet({ person, onClose }: { person: Pick<Person, 'name'> & Partial<Pick<Person, 'linkHidden'>>; onClose: () => void }) {
  const panel = useInView()
  return (
    <section className="card share" ref={panel} tabIndex={-1}>
      <h2>Send to {person.name}</h2>
      <p className="empty">
        {person.linkHidden
          ? `Your role doesn't see ${person.name}'s private link, so the office sends this one. It's already on their page.`
          : 'Their private link is made when this device next syncs. Try again once it says “Up to date”.'}
      </p>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </section>
  )
}

/** Send a person something on their private link: an offer, or with `message`, something else such as their call sheet (ADR 0021). */
export function SharePanel({
  person,
  call,
  onClose,
  message,
  inJob = false,
}: {
  person: PersonView
  call: CallView
  onClose: () => void
  message?: (link: string) => { text: string; subject: string; what: string }
  /** On the job's page, under its Next dock: WhatsApp is plain (SendButtons). */
  inJob?: boolean
}) {
  const prompts = usePromptsMessages()
  if (!prompts) return <QuietPanel names={[person.name]} what={message?.('').what ?? 'offer'} onClose={onClose} />
  const link = linkFor(person)
  if (!link) return <NoLinkYet person={person} onClose={onClose} />
  return <SendTo person={person} call={call} link={link} message={message} onClose={onClose} inJob={inJob} />
}

function SendTo({
  person,
  call,
  link,
  message,
  onClose,
  inJob,
}: {
  person: PersonView
  call: CallView
  link: string
  message?: (link: string) => { text: string; subject: string; what: string }
  onClose: () => void
  inJob: boolean
}) {
  const panel = useInView()
  const custom = message?.(link)
  const text = custom?.text ?? offerMessage(person, call, link)
  const subject = custom?.subject ?? `Work: ${call.project}, ${daysLabel(call.days)}`
  return (
    <section className="card share" aria-label={`Send ${custom?.what ?? 'offer'} to ${person.name}`} ref={panel} tabIndex={-1}>
      <h2>Send to {person.name}</h2>
      <textarea readOnly value={text} rows={6} />
      <div className="actions">
        <SendButtons key={person.id} person={person} text={text} subject={subject} inJob={inJob} />
        <button type="button" className="link" onClick={onClose}>
          Done
        </button>
      </div>
    </section>
  )
}

/**
 * The people to tell after something the office did, one at a time: the
 * message written for what happened, the ways to send it, and Done or Skip
 * to move to the next. "Tell 3 people" for a cancelled job; just the one
 * after a Confirm.
 */
export function TellPanel({ tell, onClose, inJob = false }: { tell: Tell; onClose: () => void; inJob?: boolean }) {
  const [at, setAt] = useState(0)
  const prompts = usePromptsMessages()
  const to = tell.to[at]
  if (!to) return null
  if (!prompts) return <QuietPanel names={tell.to.map((t) => t.person.name)} what={tellMessage(tell.event, to.person, to.context, '').what} onClose={onClose} />
  const { person, context } = to
  const n = tell.to.length
  const next = () => (at + 1 < n ? setAt(at + 1) : onClose())
  const link = linkFor(person)
  if (!link) return <NoLinkYet person={person} onClose={next} />
  const { text, subject, what } = tellMessage(tell.event, person, context, link)
  return (
    <TellOne key={at} label={`Send ${what} to ${person.name}`} title={n === 1 ? `Tell ${person.name}` : `Tell ${n} people: ${person.name} (${at + 1} of ${n})`} more={at + 1 < n} onNext={next}>
      <textarea readOnly value={text} rows={6} />
      <SendButtons key={person.id} person={person} text={text} subject={subject} inJob={inJob} />
    </TellOne>
  )
}

/** One person to tell, brought into view as it opens. */
function TellOne({ label, title, more, onNext, children }: { label: string; title: string; more: boolean; onNext: () => void; children: [ReactNode, ReactNode] }) {
  const panel = useInView()
  const [message, buttons] = children
  return (
    <section className="card share" aria-label={label} ref={panel} tabIndex={-1}>
      <h2>{title}</h2>
      {message}
      <div className="actions">
        {buttons}
        <button type="button" className="link" onClick={onNext}>
          {more ? 'Done, next' : 'Done'}
        </button>
        {more && (
          <button type="button" className="link" onClick={onNext}>
            Skip
          </button>
        )}
      </div>
    </section>
  )
}
