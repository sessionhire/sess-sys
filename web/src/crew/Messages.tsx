import {
  daysLabel,
  offerRateFor,
  ownSharePct,
  daysToCancel,
  holdLeft,
  HOLDING,
  waitWords,
  invitesHeld,
  LIVE,
  newId,
  OFFER_WAIT_SECONDS,
  offerHeard,
  offerMessage,
  offerReach,
  OPEN,
  tellMessage,
  toldOfBooking,
  toldOfChange,
  toldOfConfirm,
  toldOfEnding,
  toldOfOffer,
  toldOfRefusal,
  toldSentences,
  undoneWords,
  whatsappFollowsTell,
  whatsappNumber,
  whatsappReach,
  type CallView,
  type OfferView,
  type Person,
  type PersonView,
  type TellContext,
  type TellEvent,
  type ToldPerson,
  type WhatsAppNews,
} from '@sh/shared'
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { AdminWords } from '../AdminWords.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
import { useView } from '../view.ts'
import { PlainContact, useHoldTheDay, useReach } from './reach.tsx'

/**
 * The messages for crew the office sends itself (audit finding 9): an offer,
 * or word of a change, on WhatsApp, a text or an email with the words filled
 * in. Nothing is sent for you.
 */

export const linkFor = (p: Pick<Person, 'linkToken'>) => (p.linkToken ? `${location.origin}/f/${p.linkToken}` : '')

/** An offer's subject for an email: on a job the client hasn't said yes to yet, it asks them to hold the day (ADR 0150). */
const offerSubject = (call: Pick<CallView, 'project' | 'days'>, hold: boolean) => `${hold ? 'Hold the day' : 'Work'}: ${call.project}, ${daysLabel(call.days)}`

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
  /** For a changed call: its days moved, which is the one change Google emails the people on it about (ADR 0149). */
  moved?: boolean
  /** For a changed call: its call time moved, which Google emails those whose invites tell them what happens next (ADR 0153). */
  timeMoved?: boolean
  /**
   * People whose rate asked for, or whose offer still waiting, the press closed by filling the call (ADR 0152, ADR 0169):
   * said among what was sent, as their offers end, and never sent this event's message.
   */
  closed?: TellTo[]
}

/**
 * The offers an Offer press just made (ADR 0162): their ids, and when it was pressed. Nothing of the app's goes to them for
 * OFFER_WAIT_SECONDS, so the panel offers Undo till then, counted from the press: the server's wait starts as it takes
 * them, which is never sooner, and runs a few seconds longer (OFFER_WAIT_GRACE_SECONDS) for an Undo pressed at the end.
 */
export interface Made {
  ids: readonly string[]
  at: number
}

/** What's open at the bottom of a screen: an offer to send (with the offers just made, after Offer), or people to tell. One at a time. */
export type Share = { kind: 'offer'; people: PersonView[]; call: CallView; made?: Made } | { kind: 'tell'; tell: Tell }

/**
 * Where a press deep in a screen opens the people to tell (ADR 0168): the job's page, or a list of quotes. A press that ends
 * the row or the card it's on, as confirming a job from its quote does, can't open them under itself.
 */
export const TellHere = createContext<((share: Share | undefined) => void) | undefined>(undefined)

/** The screen's own place to open the people to tell, if it has one. */
export const useTellHere = () => useContext(TellHere)

/**
 * The prompt after something the office did (audit finding 9): a message
 * for each person, written for what happened, to send by WhatsApp, text or
 * email as the offer is, or to copy. The app sends nothing itself. Nothing
 * when there's nobody to tell. A call changed or a phase moved prompts the
 * same way: setShare(promptFor('call-changed', peopleOn(call))).
 */
export function promptFor(event: TellEvent, to: TellTo[], moved = false, closed: TellTo[] = [], timeMoved = false): Share | undefined {
  return to.length ? { kind: 'tell', tell: { id: newId(), event, to, moved, ...(timeMoved ? { timeMoved } : {}), ...(closed.length ? { closed } : {}) } } : undefined
}

/**
 * Someone to tell about a call, with their own days and agreed rate when they have an offer on it, and whether they'd
 * heard of the offer as it stood before the press, which decides what follows it on WhatsApp (ADR 0154).
 */
export function tellTo(
  person: Person,
  call: CallView,
  offer?: Pick<OfferView, 'id' | 'days' | 'status' | 'dayRateCents' | 'counterRateCents'> & Partial<Pick<OfferView, 'whatsapp' | 'respondedAt'>>
): TellTo {
  const agreed = offer ? (offer.status === 'countered' ? offer.counterRateCents : offer.dayRateCents) : call.dayRateCents
  return { person, context: { call: { ...call, dayRateCents: agreed }, days: offer?.days, offerId: offer?.id, ...(offer ? { heard: offerHeard(offer) } : {}) } }
}

/**
 * The call as an offer to this person reads it (ADR 0167): at the rate their offer was made at, or, before it's made, the
 * call's or their own where that's above it.
 */
function atTheirRate(call: CallView, person: Pick<Person, 'id' | 'kind' | 'dayRateCents'>, share: number): CallView {
  const made = call.offers.find((o) => o.personId === person.id && o.status === 'offered')
  return { ...call, dayRateCents: made ? made.dayRateCents : offerRateFor(call.dayRateCents, person, share) }
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
  if (share.kind === 'offer') return <OfferPanel key={share.made?.at ?? 'send'} share={share} onClose={onClose} inJob={inJob} />
  return <TellPanel key={share.tell.id} tell={share.tell} onClose={onClose} inJob={inJob} />
}

/**
 * After Offer, or Send on someone's row: the message to send, or what the app sent by itself. While the offers Offer just
 * made wait (ADR 0162; audit of 12 November 2026, finding 13), when their invites go and Undo, which takes back any still
 * unanswered with nothing sent to anyone; after it, that nothing went.
 */
function OfferPanel({ share, onClose, inJob }: { share: Extract<Share, { kind: 'offer' }>; onClose: () => void; inJob: boolean }) {
  const [undone, setUndone] = useState<readonly Person[]>()
  const wait = useWait(share, setUndone)
  if (undone) return <Undone people={undone} onClose={onClose} />
  return share.people.length === 1 ? (
    <SharePanel person={share.people[0]!} call={share.call} onClose={onClose} inJob={inJob} wait={wait} />
  ) : (
    <OffersPanel people={share.people} call={share.call} onClose={onClose} inJob={inJob} wait={wait} />
  )
}

/** Offers just made, while they wait: what goes when they stop, and Undo. */
interface Wait {
  words: string
  undo: () => void
  error: string
}

/**
 * The wait of the offers a press made, counted down a second at a time from the press, with Undo for those nobody has
 * answered. Nothing once it's over, or none is left to take back.
 */
function useWait(share: Extract<Share, { kind: 'offer' }>, onUndone: (people: readonly Person[]) => void): Wait | undefined {
  const { made } = share
  const reach = useReach()
  const call = useView().crew.calls.find((c) => c.id === share.call.id) ?? share.call
  const [clock, setClock] = useState(() => Date.now())
  const { run, error } = useAct()
  const end = made ? made.at + OFFER_WAIT_SECONDS * 1000 : 0
  const left = Math.ceil((end - clock) / 1000)
  useEffect(() => {
    if (left <= 0) return
    // On the second, counted from the press, so the number steps as a clock does.
    const t = setTimeout(() => setClock(Date.now()), Math.max(50, ((end - Date.now()) % 1000) + 20))
    return () => clearTimeout(t)
  }, [clock, end, left])
  const waiting = made ? call.offers.filter((o) => made.ids.includes(o.id) && o.status === 'offered' && !o.respondedAt) : []
  if (!made || left <= 0 || waiting.length === 0) return undefined
  // What goes as the wait ends: each day's invite the server will write, unless the calendar has a problem holding them
  // back, and each WhatsApp queued (or, before the server has answered, one it will queue).
  let invites = 0
  let whatsapps = 0
  for (const o of waiting) {
    const r = offerReach(reach, o, call, o.person, call.offers)
    if (!r.held) invites += r.coming.length
    if (o.whatsapp ? o.whatsapp.state === 'queued' : o.pending && !!o.person && whatsappReach(reach.whatsapp, o.person) !== undefined) whatsapps++
  }
  const undo = () => {
    // Named in the order they were picked, as the press named them.
    const people = share.people.filter((p) => waiting.some((o) => o.personId === p.id))
    void run(async () => {
      for (const o of waiting) await client.mutate('offer.undo', { id: o.id })
    }).then((ok) => ok && onUndone(people))
  }
  return { words: waitWords({ invites, whatsapps, offers: waiting.length }, left), undo, error }
}

/**
 * When what an offer just made sends goes, and Undo beside it (ADR 0162). Gone when the wait is over; the focus, if it was on
 * Undo, goes to the panel rather than nowhere.
 */
function WaitLine({ wait }: { wait: Wait }) {
  const line = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const here = line.current
    return () => {
      if (here?.contains(document.activeElement)) here.closest<HTMLElement>('section')?.focus()
    }
  }, [])
  return (
    <div className="offer-wait" ref={line}>
      <p>{wait.words}</p>
      <button type="button" onClick={wait.undo}>
        Undo
      </button>
      <Refusal error={wait.error} />
    </div>
  )
}

/** After Undo (ADR 0162): who wasn't offered it after all, and that nothing of the app's went to them. */
function Undone({ people, onClose }: { people: readonly Person[]; onClose: () => void }) {
  const panel = useInView()
  const prompts = usePromptsMessages()
  return (
    <section className="card share sent" aria-label="Undone" ref={panel} tabIndex={-1}>
      <h2>Undone</h2>
      <p>{undoneWords(people.map((p) => p.name), prompts)}</p>
      <button type="button" onClick={onClose}>
        Done
      </button>
    </section>
  )
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

/** Where messages to crew are turned on, for whoever can: said wherever the mode bites (rule 14). */
function TurnedOn() {
  const admin = useAccess().can('settings')
  return admin ? <a href="#admin/company">Admin › Company</a> : <>Admin, by the office</>
}

/**
 * In a Send panel's place while messages to crew are off (ADR 0048), for a message that isn't about an offer (a call
 * sheet, a certificate reminder, a timesheet): what would have opened, for whom, that their link carries it regardless,
 * and where it's turned on. The mode shows itself where it bites, not only on Admin (rule 14). An offer, and what
 * happens to one, has SentPanel, which says what the app sent by itself.
 */
export function QuietPanel({ names, what, onLink = true, onClose }: { names: readonly string[]; what: string; onLink?: boolean; onClose: () => void }) {
  const who = names.length === 1 ? names[0] : `${names.length} people`
  const panel = useInView()
  return (
    <section className="card share" aria-label={`Messages to crew are off: ${what} for ${who}`} ref={panel} tabIndex={-1}>
      <h2>Messages to crew are off</h2>
      <p className="empty">
        Nothing opened to send {who} the {what}.{onLink ? ` ${names.length === 1 ? 'Their link' : 'Their links'} already say${names.length === 1 ? 's' : ''} so.` : ''} Messages
        are turned on under <TurnedOn />.
      </p>
      <button type="button" onClick={onClose}>
        Done
      </button>
    </section>
  )
}

/**
 * After a press about an offer while messages to crew are off (ADR 0149; audit of 12 November 2026, finding 5): what
 * was done as the heading, then what the app sent by itself, worked out from what happened to each person: who Google
 * emailed, who it went to on WhatsApp, and who nothing reached and why. Anyone nothing reached is named with their
 * number a press away, the plain contact ADR 0048 keeps (finding 14). That no message opened to send is said last,
 * with where that's turned on: it was the heading, over a list of people Google had just emailed.
 */
function SentPanel({
  title,
  people,
  links,
  wait,
  onClose,
}: {
  title: string
  people: readonly { person: Person; told: ToldPerson }[]
  links?: string
  /** Offers just made, while they wait (ADR 0162). */
  wait?: Wait | undefined
  onClose: () => void
}) {
  const panel = useInView()
  const toRing = people.filter((p, i) => !p.told.reached && people.findIndex((x) => x.person.id === p.person.id) === i && (p.person.phone?.trim() || p.person.email?.trim()))
  return (
    <section className="card share sent" aria-label={`${title}: what was sent`} ref={panel} tabIndex={-1}>
      <h2>{title}</h2>
      {wait && <WaitLine wait={wait} />}
      <div className="sent-lines">
        {toldSentences(people.map((p) => p.told)).map((s) => (
          <p key={s}>
            <AdminWords>{s}</AdminWords>
          </p>
        ))}
        {links && <p>{links}</p>}
      </div>
      {toRing.length > 0 && (
        <div className="sent-ring">
          {toRing.map(({ person }) => (
            <div className="row" key={person.id}>
              <span>{person.name}</span>
              <span className="actions">
                <PlainContact person={person} />
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="hint">
        Messages to crew are off, so no message opened for you to send. They're turned on under <TurnedOn />.
      </p>
      <button type="button" onClick={onClose}>
        Done
      </button>
    </section>
  )
}

/** After Offer or Send: read from the call as it stands now, so "on its way" becomes "emailed" as the server writes each day. */
function OfferSent({ people, call, wait, onClose }: { people: readonly PersonView[]; call: CallView; wait?: Wait | undefined; onClose: () => void }) {
  const reach = useReach()
  const now = useView().crew.calls.find((c) => c.id === call.id) ?? call
  const told = people.flatMap((person) => {
    const offer = now.offers.find((o) => o.personId === person.id && LIVE.includes(o.status))
    return offer ? [{ person, told: toldOfOffer(person, offerReach(reach, offer, now, person, now.offers)) }] : []
  })
  const n = people.length
  return (
    <SentPanel
      title={n === 1 ? `Offered to ${people[0]!.name}` : `Offered to ${n} people`}
      people={told}
      links={told.length ? (told.length === 1 ? 'Their link shows the offer, whenever they open it.' : 'Their links show the offer, whenever they open them.') : undefined}
      wait={wait}
      onClose={onClose}
    />
  )
}

/** What was done, as the panel's heading; none for a timesheet, which the app sends nothing about. */
const DONE: Partial<Record<TellEvent, (to: readonly TellTo[]) => string>> = {
  confirmed: (to) => `${to[0]!.person.name} is booked`,
  withdrawn: (to) => `Offer to ${to[0]!.person.name} withdrawn`,
  'rate-refused': (to) => `Said no to ${to[0]!.person.name}'s rate`,
  released: (to) => `${to[0]!.person.name} released`,
  'call-cancelled': () => 'Crew call cancelled',
  'job-stopped': () => 'Crew calls cancelled',
  'job-confirmed': (to) => `${to[0]!.context.call.project} is confirmed`,
  'call-changed': () => 'Crew call changed',
  'phase-moved': () => 'Phase moved',
}
const ENDED: readonly TellEvent[] = ['withdrawn', 'released', 'call-cancelled', 'job-stopped']

/**
 * After Confirm, Withdraw, Release, a cancelled or changed call, a moved phase or a stopped job. The invites each person
 * held are read as the panel opens: the server takes them off the calendar a moment later, and the panel then says
 * Google has emailed them, where until then it says it is.
 */
function TellSent({ tell, onClose }: { tell: Tell; onClose: () => void }) {
  const reach = useReach()
  const holdTheDay = useHoldTheDay()
  const everyone = [...tell.to, ...(tell.closed ?? [])]
  const [held] = useState(() =>
    everyone.map((t) => (t.context.offerId ? { cancel: daysToCancel(reach, t.context.offerId), invites: invitesHeld(reach, t.context.offerId).length } : { cancel: [] as string[], invites: 0 }))
  )
  const people = everyone.map((t, i) => {
    const id = t.context.offerId
    const had = held[i] ?? { cancel: [] as string[], invites: 0 }
    const was = { cancel: had.cancel.length, invites: had.invites }
    // Invited is an invite the server keeps in step with the offer. With invites switched off since, it leaves theirs as
    // it was (kept): ending their offer sends no cancellation, and a booking or a change doesn't reach their calendar.
    const before = { cancel: was.cancel, left: id ? daysToCancel(reach, id).length : 0, invited: was.cancel > 0, kept: was.cancel ? 0 : was.invites }
    // What follows on WhatsApp, by the rule the server queues by (ADR 0154): to whoever it reaches who'd heard of the offer,
    // about a call that isn't over.
    const follows = whatsappFollowsTell(reach, t)
    const news = (n: WhatsAppNews) => ({ ...before, whatsapp: follows ? n : undefined })
    // A rate asked for, or an offer still waiting, that the press closed by filling the call ends as any offer does (ADR 0152).
    if (i >= tell.to.length) return { person: t.person, told: toldOfEnding(reach, t.person, news('not-needed')) }
    // The client said yes to a job its crew were asked to hold the day for (ADR 0168): HOLD comes off their days, which Google
    // emails them, as `left` of them still say it; and on WhatsApp those picked hear they're booked, the rest that it's going ahead.
    if (tell.event === 'job-confirmed')
      return {
        person: t.person,
        told: toldOfConfirm(reach, t.person, { invited: was.cancel, left: id ? holdLeft(reach, id) : 0, kept: before.kept, whatsapp: follows ? (t.context.picked ? 'booked' : 'going-ahead') : undefined }),
      }
    // On a job the client hasn't said yes to yet, their link and their invite say to hold the day, not that they're booked (ADR 0150).
    // Days they were still asked for, outside the days booked, came off with word from Google, as the question said (ADR 0152).
    if (tell.event === 'confirmed') {
      const gone = had.cancel.filter((d) => !(t.context.days ?? had.cancel).includes(d))
      const left = id ? daysToCancel(reach, id).filter((d) => gone.includes(d)).length : 0
      return { person: t.person, told: toldOfBooking(reach, t.person, news('booked'), holdTheDay(t.context.call.projectId), { gone, left }) }
    }
    // Saying no to a rate keeps the offer (ADR 0152): their link and their invite's first line say it stands. On a call that
    // filled meanwhile it closes, and their invites come off as for any offer that ends.
    if (tell.event === 'rate-refused') return { person: t.person, told: t.context.filled ? toldOfEnding(reach, t.person, news('not-needed')) : toldOfRefusal(reach, t.person, before) }
    if (tell.event === 'call-changed' || tell.event === 'phase-moved')
      return { person: t.person, told: toldOfChange(reach, t.person, news('call-time'), tell.event === 'phase-moved' || tell.moved === true, tell.timeMoved === true) }
    // A stopped job tells them it's off; anything else that ends an offer, that they're no longer needed (ADR 0154).
    return { person: t.person, told: toldOfEnding(reach, t.person, news(tell.event === 'job-stopped' ? 'job-off' : 'not-needed')) }
  })
  const many = new Set(tell.to.map((t) => t.person.id)).size > 1
  // Picked for a job the client hasn't said yes to yet, they hold the day: nobody is booked till then (ADR 0150).
  const holds = tell.event === 'confirmed' && holdTheDay(tell.to[0]!.context.call.projectId)
  return (
    <SentPanel
      title={holds ? `${tell.to[0]!.person.name} holds the day` : (DONE[tell.event]?.(tell.to) ?? 'Done')}
      people={people}
      links={ENDED.includes(tell.event) ? (many ? 'Their links say so, whenever they open them.' : 'Their link says so, whenever they open it.') : undefined}
      onClose={onClose}
    />
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
  wait,
}: {
  person: PersonView
  call: CallView
  onClose: () => void
  message?: (link: string) => { text: string; subject: string; what: string }
  /** On the job's page, under its Next dock: WhatsApp is plain (SendButtons). */
  inJob?: boolean
  /** The offer Offer just made, while it waits (ADR 0162). */
  wait?: Wait | undefined
}) {
  const prompts = usePromptsMessages()
  // An offer says what the app sent by itself (ADR 0149); anything else only that no message opened.
  if (!prompts) return message ? <QuietPanel names={[person.name]} what={message('').what} onClose={onClose} /> : <OfferSent people={[person]} call={call} wait={wait} onClose={onClose} />
  const link = linkFor(person)
  if (!link) return <NoLinkYet person={person} onClose={onClose} />
  return <SendTo person={person} call={call} link={link} message={message} onClose={onClose} inJob={inJob} wait={wait} />
}

function SendTo({
  person,
  call,
  link,
  message,
  onClose,
  inJob,
  wait,
}: {
  person: PersonView
  call: CallView
  link: string
  message?: (link: string) => { text: string; subject: string; what: string }
  onClose: () => void
  inJob: boolean
  wait?: Wait | undefined
}) {
  const panel = useInView()
  const hold = useHoldTheDay()(call.projectId)
  const custom = message?.(link)
  // A travel or warehouse day takes the same share of an own rate as of the call's (ADR 0174).
  const share = ownSharePct(call.phase, useView().money.quoting)
  const text = custom?.text ?? offerMessage(person, atTheirRate(call, person, share), link, hold)
  const subject = custom?.subject ?? offerSubject(call, hold)
  return (
    <section className="card share" aria-label={`Send ${custom?.what ?? 'offer'} to ${person.name}`} ref={panel} tabIndex={-1}>
      <h2>Send to {person.name}</h2>
      {wait && <WaitLine wait={wait} />}
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
  const holdTheDay = useHoldTheDay()
  const to = tell.to[at]
  if (!to) return null
  if (!prompts)
    return DONE[tell.event] ? (
      <TellSent tell={tell} onClose={onClose} />
    ) : (
      <QuietPanel names={tell.to.map((t) => t.person.name)} what={tellMessage(tell.event, to.person, to.context, '').what} onClose={onClose} />
    )
  const { person, context } = to
  const n = tell.to.length
  const next = () => (at + 1 < n ? setAt(at + 1) : onClose())
  const link = linkFor(person)
  if (!link) return <NoLinkYet person={person} onClose={next} />
  // Picked for a job the client hasn't said yes to yet: the message asks them to hold the day (ADR 0150).
  const { text, subject, what } = tellMessage(tell.event, person, { ...context, hold: holdTheDay(context.call.projectId) }, link)
  return (
    <TellOne key={at} label={`Send ${what} to ${person.name}`} title={n === 1 ? `Tell ${person.name}` : `Tell ${n} people: ${person.name} (${at + 1} of ${n})`} more={at + 1 < n} onNext={next}>
      <textarea readOnly value={text} rows={6} />
      <SendButtons key={person.id} person={person} text={text} subject={subject} inJob={inJob} />
    </TellOne>
  )
}

/**
 * Several offered in one press (review of 11 November 2026, finding 12): their messages one at a time, as Tell does, each on their
 * own link, with Done, next and Skip.
 */
function OffersPanel({ people, call, onClose, inJob, wait }: { people: PersonView[]; call: CallView; onClose: () => void; inJob: boolean; wait?: Wait | undefined }) {
  const [at, setAt] = useState(0)
  const prompts = usePromptsMessages()
  const hold = useHoldTheDay()(call.projectId)
  const share = ownSharePct(call.phase, useView().money.quoting)
  const person = people[at]
  if (!person) return null
  if (!prompts) return <OfferSent people={people} call={call} wait={wait} onClose={onClose} />
  const n = people.length
  const next = () => (at + 1 < n ? setAt(at + 1) : onClose())
  const link = linkFor(person)
  if (!link) return <NoLinkYet key={at} person={person} onClose={next} />
  const text = offerMessage(person, atTheirRate(call, person, share), link, hold)
  return (
    <TellOne key={at} label={`Send offer to ${person.name}`} title={`Send to ${n} people: ${person.name} (${at + 1} of ${n})`} more={at + 1 < n} onNext={next} wait={wait}>
      <textarea readOnly value={text} rows={6} />
      <SendButtons key={person.id} person={person} text={text} subject={offerSubject(call, hold)} inJob={inJob} />
    </TellOne>
  )
}

/** One person to tell, brought into view as it opens. */
function TellOne({
  label,
  title,
  more,
  onNext,
  wait,
  children,
}: {
  label: string
  title: string
  more: boolean
  onNext: () => void
  /** The offers Offer just made, while they wait (ADR 0162). */
  wait?: Wait | undefined
  children: [ReactNode, ReactNode]
}) {
  const panel = useInView()
  const [message, buttons] = children
  return (
    <section className="card share" aria-label={label} ref={panel} tabIndex={-1}>
      <h2>{title}</h2>
      {wait && <WaitLine wait={wait} />}
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
