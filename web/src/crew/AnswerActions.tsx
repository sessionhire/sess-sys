import {
  askEndingWords,
  bookingWords,
  daysLabel,
  daysToCancel,
  endingWords,
  euro,
  firstName,
  invitesHeld,
  namesInWords,
  ratesClosedBy,
  toldNext,
  type CallView,
  type OfferView,
  type Person,
} from '@sh/shared'
import { useState } from 'react'
import { Confirm } from '../act.tsx'
import { client } from '../sync.ts'
import { promptFor, tellTo, type Share } from './Messages.tsx'
import { useHoldTheDay, useReach } from './reach.tsx'

/** The rate an offer stands at once the office has said no to the one asked for, as their page says it (ADR 0152). */
export const standsAt = (cents: number | null | undefined, hidden?: boolean) => (hidden ? 'the rate offered' : cents === null || cents === undefined ? 'the rate the office sets' : `${euro(cents)} a day`)

/**
 * What the office presses on a yes or on a rate asked for (ADR 0152), the same on Crew's Answers to check and on the job's
 * own call rows (audit of 12 November 2026, finding 9): Confirm and Release on a yes; Agree, Say no and Withdraw on a rate.
 * A press that closes someone's ask, or that Google emails about, says so first; Say no keeps the offer at the rate
 * offered, and Withdraw is its own choice (audit question 6).
 */
export function AnswerActions({
  o,
  call,
  run,
  onDone,
  onPress,
}: {
  o: OfferView
  call: CallView
  run: (fn: () => Promise<unknown>) => Promise<boolean>
  /** The panel to open once it's done: who was told what. */
  onDone: (share: Share | undefined) => void
  /** Just before the press goes, so a list can keep its place. */
  onPress?: () => void
}) {
  const reach = useReach()
  const holdTheDay = useHoldTheDay()
  const [asking, setAsking] = useState<'confirm' | 'release' | 'refuse' | 'withdraw'>()
  if (o.status !== 'accepted' && o.status !== 'countered') return null
  const who = o.person?.name ?? 'them'
  const first = o.person ? firstName(o.person) : 'them'
  const asked = o.status === 'accepted' ? (o.asked ?? []) : []
  // A rate still asked for that this confirm leaves without a place: closed with it, so said first.
  const closing = ratesClosedBy(call, call.offers, o.id)
  const full = call.openDays.length === 0
  const go = (command: 'offer.confirm' | 'offer.cancel' | 'offer.refuse', share: () => Share | undefined) => {
    setAsking(undefined)
    onPress?.()
    void run(() => client.mutate(command, { id: o.id })).then((ok) => ok && onDone(share()))
  }
  // The rates asked for that this fills the call over close with it, and their invites come off: said among what was sent.
  const confirm = () =>
    go('offer.confirm', () => o.person && promptFor('confirmed', [tellTo(o.person, call, o)], false, closing.flatMap((c) => (c.person ? [tellTo(c.person as Person, call, c)] : []))))
  const release = () => go('offer.cancel', () => o.person && promptFor(o.status === 'countered' ? 'withdrawn' : 'released', [tellTo(o.person, call, o)]))
  const refuse = () =>
    go('offer.refuse', () => {
      if (!o.person) return undefined
      // The offer as it stands now: the days they asked about, at the rate offered, with the rate asked for said with it.
      const to = tellTo(o.person as Person, call, { ...o, status: 'offered' })
      return promptFor('rate-refused', [{ ...to, context: { ...to.context, askedRateCents: o.counterRateCents, ...(full ? { filled: true } : {}) } }])
    })

  if (asking === 'confirm') {
    // Whose invites come off as their ask closes, by name where it's one person, as the panel after says.
    const emailed = closing.filter((c) => daysToCancel(reach, c.id).length)
    const one = emailed.length === 1 ? emailed[0]! : undefined
    // With their invites telling them what happens next, the cancellation says why: filled by someone else (ADR 0153).
    const why = emailed.every((c) => toldNext(reach, c.person)) ? ' and why' : ''
    const closedEmails = one
      ? ` Google emails ${one.person ? firstName(one.person) : 'them'} that ${daysToCancel(reach, one.id).length === 1 ? 'the day is' : 'their days are'} cancelled${why}.`
      : emailed.length
        ? ` Google emails each of them that their days are cancelled${why}.`
        : ''
    const parts = [
      // Where their invites tell them what happens next, Google emails them the booking (ADR 0153).
      bookingWords(reach, o.id, o.person, holdTheDay(call.projectId)),
      asked.length && `${who} hasn't answered for ${daysLabel(asked)}, so confirming books ${daysLabel(o.days)} only. ${askEndingWords(reach, o.id, asked)}`.trim(),
      closing.length &&
        `${o.status === 'countered' ? 'Agreeing it' : 'Confirming them'} fills the call, so ${namesInWords(closing.map((c) => `${c.person?.name ?? 'someone'}'s`))} ${closing.length === 1 ? 'ask' : 'asks'} for ${
          closing.length === 1 && !closing[0]!.rateHidden ? `${euro(closing[0]!.counterRateCents)} a day` : 'a different rate'
        } ${closing.length === 1 ? 'closes' : 'close'} unanswered.${closedEmails}`,
    ].filter(Boolean)
    return (
      <Confirm
        className="answer"
        question={`${o.status === 'countered' ? `Agree ${euro(o.counterRateCents)} a day for ${who}` : `Confirm ${who}`}? ${parts.join(' ')}`}
        yes={o.status === 'countered' ? `Agree ${euro(o.counterRateCents)}` : asked.length ? `Confirm ${daysLabel(o.days)}` : `Confirm ${first}`}
        loss
        no="Not yet"
        onYes={confirm}
        onNo={() => setAsking(undefined)}
      />
    )
  }
  if (asking === 'release' || asking === 'withdraw')
    return (
      <Confirm
        className="answer"
        question={
          // The email Google sends is named, or that nothing is sent (finding 5).
          asking === 'release'
            ? `Release ${who} from ${call.project}? Their place goes back to the call. ${endingWords(reach, o.id, 'so', o.person)}`
            : `Withdraw the offer to ${who}? ${endingWords(reach, o.id, "it's withdrawn", o.person)}`
        }
        yes={asking === 'release' ? `Release ${first}` : 'Withdraw the offer'}
        loss
        no={asking === 'release' ? 'Keep them' : 'Keep it open'}
        onYes={release}
        onNo={() => setAsking(undefined)}
      />
    )
  if (asking === 'refuse') {
    const rate = o.rateHidden ? 'the rate they asked for' : `${euro(o.counterRateCents)} a day`
    const stands = standsAt(o.dayRateCents ?? call.dayRateCents, o.rateHidden || call.rateHidden)
    // Nothing is sent: their link says the offer stands, and so does their invite's first line, with no email (ADR 0009).
    const invited = reach.calendar.link?.invites === true && invitesHeld(reach, o.id).length > 0
    const after = full
      ? `The call has filled meanwhile, so the offer closes. ${endingWords(reach, o.id, "it's filled", o.person)}`
      : `The offer stands at ${stands}, for ${first} to take or turn down. ${invited ? 'Their link and their calendar invite say so, with no email.' : 'Their link says so.'}${reach.messages || invited ? '' : ' Nothing is sent to them.'}`
    return (
      <Confirm
        className="answer"
        question={`Say no to ${rate} for ${who}? ${after}`}
        yes="Say no to the rate"
        loss={full}
        no="Not yet"
        onYes={refuse}
        onNo={() => setAsking(undefined)}
      />
    )
  }
  // A yes with days not answered, or one that fills the call over a rate still asked for, is asked about first.
  const pressConfirm = () => (asked.length || closing.length ? setAsking('confirm') : confirm())
  if (o.status === 'accepted')
    return (
      <div className="actions answer">
        {/* Plain, as a row's own action is, beside its other answer (UX sweep, 6 November 2026, move 1). */}
        <button type="button" onClick={pressConfirm}>
          {asked.length ? `Confirm ${daysLabel(o.days)}` : 'Confirm'}
        </button>
        <button type="button" onClick={() => setAsking('release')}>
          Release
        </button>
      </div>
    )
  return (
    <div className="actions answer">
      {o.rateHidden ? (
        // Agreeing a rate is for someone who sees it (ADR 0046): said here, with Say no and Withdraw still to hand.
        <p className="hint">The office agrees rates: your role doesn't see them.</p>
      ) : (
        <button type="button" onClick={pressConfirm}>
          Agree {euro(o.counterRateCents)}
        </button>
      )}
      <button type="button" onClick={() => setAsking('refuse')}>
        Say no
      </button>
      <button type="button" className="link" onClick={() => setAsking('withdraw')}>
        Withdraw
      </button>
    </div>
  )
}
