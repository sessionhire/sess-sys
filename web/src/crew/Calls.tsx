import { UnitBox } from '../UnitBox.tsx'
import {
  HOLD_WORDS,
  OFFER_WORDS,
  offerWords,
  plural,
  APPLICANT_LEVEL,
  daysLabel,
  dayLabel,
  daysOffPhase,
  MOVE_THE_PHASE,
  offPhaseLine,
  noPhaseLine,
  daysInNoPhase,
  phaseDaysRule,
  departmentOf,
  sameDepartment,
  eachDay,
  euro,
  euroText,
  firstName,
  HOLDING,
  levelLabel,
  newId,
  OPEN,
  parseEuro,
  personConflicts,
  REPLY_BY_AFTER,
  type CallView,
  type CommandInput,
  type CrewView,
  type OfferView,
  type PersonView,
  blocks,
  certificateGaps,
  certificateRefusal,
  certificateUnknowns,
  gapMarks,
  needsLabel,
  needsOf,
  type LateView,
  callEndingWords,
  daysToCancel,
  endingWords,
  namesInWords,
  nothingSentLine,
  offerPromise,
  reachOnRow,
  whatsappFollowsOffer,
  whatsappReach,
} from '@sh/shared'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Confirm, reasonOf, Refusal, useAct } from '../act.tsx'
import { forgetPicksWaiting, offerFormId, picksWaiting, setOfferPicks } from './offerPicks.ts'
import { refuseField, settleRefusals } from '../required.ts'
import { Fold } from '../Fold.tsx'
import { StatusPill, type PillTone } from '../StatusPill.tsx'
import { useAccess, useSeesRates } from '../role.ts'
import { rateText } from '../format.ts'
import { DepartmentField } from './Department.tsx'
import { RoleField } from './RoleField.tsx'
import { client } from '../sync.ts'
import { useToday, useView } from '../view.ts'
import { certificateWarnings, NeedsField } from './Certificates.tsx'
import { LateLines, NoteLate } from './Late.tsx'
import { personHref } from './PersonScreen.tsx'
import { Avatars } from '../Picture.tsx'
import { type Made, type Share, type TellTo, peopleOn, promptFor, tellTo } from './Messages.tsx'
import { PlainContact, useHoldTheDay, useReach } from './reach.tsx'
import { AnswerActions, standsAt } from './AnswerActions.tsx'
import { AdminWords } from '../AdminWords.tsx'
import { dept, found, wordsOf } from './People.tsx'
import { RecordPicker } from '../RecordPicker.tsx'

/**
 * Crew › Calls' parts: a call's card, changing it, offering it to someone
 * and asking for crew. The screen that lists them is CrewScreen.tsx.
 */

/** An offer's word and tone, from the one word table (UX sweep, 6 November 2026, move 4): a crew booking is Booked here as on the sheet and the link. */
export const STATUS: Record<OfferView['status'], readonly [string, PillTone]> = OFFER_WORDS

/** The other jobs someone holds on any of these days, and which days: what an offer over a booking can't have. */
function heldOn(crew: CrewView, personId: string, days: readonly string[], exceptCallId: string) {
  const jobs = new Set<string>()
  const held = new Set<string>()
  for (const c of crew.calls) {
    if (c.id === exceptCallId || c.status !== 'open') continue
    for (const o of c.offers) {
      if (o.personId !== personId || !HOLDING.includes(o.status)) continue
      const hit = o.days.filter((d) => days.includes(d))
      if (!hit.length) continue
      jobs.add(c.project)
      for (const d of hit) held.add(d)
    }
  }
  return { jobs: [...jobs], days: [...held] }
}

/** The picker's order (ADR 0025): by department, then the highest level first, then by name. */
function byDepartmentThenLevel(a: PersonView, b: PersonView): number {
  if (dept(a) !== dept(b)) {
    if (!a.department) return 1
    if (!b.department) return -1
    return dept(a).localeCompare(dept(b))
  }
  return b.level - a.level || a.name.localeCompare(b.name)
}

/** "Audio · Level 3 (Sound No.1, Audio)", the line under someone's name in the Offer to picker. */
function pickerLine(p: PersonView): string {
  return `${p.department ? `${p.department} · ` : ''}${levelLabel(p.level)}${p.skills.length ? ` (${p.skills.join(', ')})` : ''}`
}

/** Offered, holding or booked: the people a call's one line names. */
const ON_CALL: readonly OfferView['status'][] = [...OPEN, ...HOLDING]

/** How many on a call are named on its line at rest: the rest are counted, and listed once it's opened. */
const WHO_SHOWN = 8

/**
 * One crew call. At rest it's one line (audit finding 16): the role, its
 * phase or days and who's on it, with where it stands as a pill beside it
 * and "Offer…" under that while there are places to fill, the picker behind
 * it until it's wanted. A tap on the line opens its days, call time and rate,
 * who's been offered it, how each was reached and how they answered (ADR
 * 0149), and changing or cancelling the call.
 */
export function CallCard({
  call,
  crew,
  late,
  onShare,
  onTell,
  inJob = false,
  phaseDays = false,
  phaseNamed = false,
  offerOpened,
  rowsOpened,
}: {
  call: CallView
  crew: CrewView
  /** Who on it is running late today (ADR 0028), said at rest under its line. */
  late?: LateView
  onShare: (people: PersonView[], made?: Made) => void
  /** Opens the message for whoever should hear about a withdrawal or a cancelled call; without it, nobody is prompted. */
  onTell?: (share: Share | undefined) => void
  inJob?: boolean
  /** Under a phase on the job's page, for the phase's own days, which its header says already. */
  phaseDays?: boolean
  /** On the job's page away from its phase, as a head's own department's are, first: the phase is said with the days. */
  phaseNamed?: boolean
  /** Opens its Offer from outside each time it changes: the job's Next button landing on the first place to fill (ADR 0140). */
  offerOpened?: number
  /** Opens its rows from outside each time it changes: the job's Next button landing on a yes or a rate to answer (ADR 0152). */
  rowsOpened?: number
}) {
  const mayOffer = useAccess().can('crew')
  const [open, setOpen] = useState(rowsOpened !== undefined)
  useEffect(() => {
    if (rowsOpened !== undefined) setOpen(true)
  }, [rowsOpened])
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  // The offer or booking being withdrawn, asked first on its line: it can't be taken back, and their link says so at once (rule 1).
  const [withdrawing, setWithdrawing] = useState<string | undefined>()
  const { run, error } = useAct()
  const today = useToday()
  const view = useView()
  // A call left outside its phase's days from before the rule (ADR 0159): nobody on it has an invite for those days, said at rest.
  const job = call.status === 'open' && call.projectId ? view.jobs.jobs.find((j) => j.id === call.projectId) : undefined
  const phase = call.phaseId ? job?.phases.find((p) => p.id === call.phaseId) : undefined
  const offPhase = phase ? daysOffPhase(call, phase).filter((d) => d >= today) : []
  // A call across the job's phases holds every day from its first to its last, a gap between two phases too, which no
  // invite is for: said at rest, as a call outside its own phase is (ADR 0159).
  const inNoPhase = job && !call.phaseId && job.phases.length > 0 ? daysInNoPhase(call, job.phases).filter((d) => d >= today) : []
  const filled = call.openDays.length === 0
  // A yes not yet confirmed holds the place but isn't a booking, as the job's head counts it: the call says so, in amber, rather
  // than a green Filled with someone still to confirm under it (review of 11 November 2026, finding 3).
  const toConfirm = new Set(call.offers.filter((o) => o.status === 'accepted').map((o) => o.personId)).size
  const live = call.status === 'open'
  // What the app sent each person by itself, and what ending their offer sends (ADR 0149).
  const reach = useReach()
  // Who's on it, with their answer where it isn't yet a booking: "Dara Quinn (booked), Niamh Kelly (offered)". The first few at rest, then
  // "and 17 more", which opening the line lists (audit of 18 October, finding 20).
  // Booked and not yet booked side by side, everyone's state is said, so "(offered)" can't read as the pair's (audit, 20 October 2026, finding 72).
  const onIt = call.offers.filter((o) => o.person && ON_CALL.includes(o.status))
  const mixed = onIt.some((o) => o.status === 'confirmed') && onIt.some((o) => o.status !== 'confirmed')
  // On a job the client hasn't said yes to, those picked hold the day: nobody is booked until the client says yes (ADR 0150, ADR 0168).
  const hold = useHoldTheDay()(call.projectId)
  const picked = hold ? ` (${HOLD_WORDS.name.toLowerCase()})` : ' (booked)'
  const who = onIt
    .slice(0, WHO_SHOWN)
    .map((o) => `${o.person!.name}${o.status === 'confirmed' ? (mixed || hold ? picked : '') : ` (${STATUS[o.status][0].toLowerCase()})`}`)
    .join(', ')
  const more = onIt.length - WHO_SHOWN

  // How each person was reached, from what the server read back: the invite Google emailed, the offer on WhatsApp, or nothing and why.
  const rows = open ? call.offers.map((o) => ({ o, said: reachOnRow(reach, o, call, o.person, call.offers) })) : []
  // With every way out switched off that's the same for everyone waiting, so it's said once over them, not under each name.
  const unsent = nothingSentLine(
    rows.flatMap((r) => (r.said.allOff && r.o.person ? [r.o.person] : [])),
    call.offers.filter((o) => o.status === 'offered').length
  )

  const withdraw = (o: OfferView) => {
    void run(() => client.mutate('offer.cancel', { id: o.id })).then(
      (ok) => ok && o.person && onTell?.(promptFor(HOLDING.includes(o.status) ? 'released' : 'withdrawn', [tellTo(o.person, call, o)]))
    )
  }
  const cancel = () => {
    setCancelling(false)
    void run(() => client.mutate('call.cancel', { id: call.id })).then((ok) => ok && onTell?.(promptFor('call-cancelled', peopleOn(call))))
  }

  return (
    <article className={`job call${call.pending ? ' is-pending' : ''}`} id={`call-${call.id}`} aria-label={`${call.needed} × ${call.role}`}>
      <button type="button" className="call-line" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>
          {call.needed} × {call.role}
          {/* On the Crew tab the days are the heading over it. On the job's page the phase shows only for a call across phases or away from its phase, and the days unless they're the phase's. */}
          {(!inJob || !call.phaseId || phaseNamed) && call.phase && <span className="muted"> · {call.phase}</span>}
          {inJob && !phaseDays && <span className="muted"> · {daysLabel(call.days)}</span>}
        </b>
      </button>
      {/* The one word at rest on where it stands: a cancelled call kept for the record says so, and a change to it or an offer on it still on its way says that. */}
      {/* Filled on a job the client hasn't said yes to is in amber: its people hold the day, and nothing is settled till the client says yes. */}
      <StatusPill tone={!live ? 'cancelled' : filled && toConfirm === 0 && !hold ? 'confirmed' : 'pending'} pending={call.pending || call.offers.some((o) => o.pending)}>
        {!live
          ? 'Cancelled'
          : `${filled ? 'Filled' : heldLabel(call)}${toConfirm > 0 ? `, ${toConfirm} to confirm` : ''}`}
      </StatusPill>
      {/* Under the line at the card's full width, not squeezed beside the pill into a column of one word a line (audit of 18 October, finding 20). */}
      {who && (
        <p className="who-line">
          <Avatars names={onIt.map((o) => o.person!.name)} />
          <span>
            {who}
            {more > 0 &&
              (open ? (
                ` and ${more} more`
              ) : (
                <>
                  {' '}
                  <button type="button" className="link" aria-expanded={false} onClick={() => setOpen(true)}>
                    and {more} more
                  </button>
                </>
              ))}
          </span>
        </p>
      )}
      {/* Lines that need acting on stay out at rest (audit finding 16): anyone short of a certificate it needs, and anyone running late (ADR 0028). */}
      {certificateWarnings(call, today).map((w) => (
        <p key={w} className="warn-line">
          {w}
        </p>
      ))}
      {phase && offPhase.length > 0 && <p className="warn-line">{offPhaseLine(offPhase, phase, today)}</p>}
      {inNoPhase.length > 0 && <p className="warn-line">{noPhaseLine(inNoPhase, job?.phases ?? [], today)}</p>}
      <LateLines call={call} late={late} today={today} />
      {/* Someone booked who rang to say they're late, noted where their line is (ADR 0028). */}
      <NoteLate call={call} late={late} inJob={inJob} />

      {open && (
        <>
          <p className="facts-line">
            {[
              daysLabel(call.days),
              call.callTime && `call ${call.callTime}`,
              rateText(call.dayRateCents, call.rateHidden),
              departmentOf(call) ?? 'no department',
              needsOf(call).length && `needs ${needsLabel(needsOf(call))}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {unsent && <p className="sent-line">{unsent}</p>}
          {call.offers.length > 0 && (
            <ul className="offers">
              {rows.map(({ o, said }) => {
                // Picked on a job the client hasn't said yes to: Hold the day, as their own page and invite say it (ADR 0150, ADR 0168).
                const [label, tone] = hold && o.status === 'confirmed' ? [HOLD_WORDS.name, 'pending' as const] : offerWords(o)
                const partial = o.days.length < call.days.length && (o.status === 'accepted' || o.status === 'confirmed' || o.status === 'countered')
                const answering = o.status === 'offered' || o.status === 'countered' || o.status === 'accepted' || o.status === 'confirmed'
                return (
                  <li key={o.id}>
                    <span>
                      {o.person ? (
                        <a className="link" href={personHref(o.personId)}>
                          {o.person.name}
                        </a>
                      ) : (
                        'Unknown'
                      )}
                      {partial && <small> {daysLabel(o.days)}</small>}
                      {o.override && <small> (override)</small>}
                    </span>
                    <span className="actions">
                      <StatusPill tone={tone} pending={o.pending}>
                        {label}
                      </StatusPill>
                      {/* Nothing has reached them and no message opens to send (ADR 0048): ringing them is the way, so it's here in Send's place (finding 14). */}
                      {mayOffer && o.status === 'offered' && o.person && said.contact && <PlainContact person={o.person} />}
                      {/* Send opens the message for the office to send, so it's there only while messages are on (ADR 0149): off, it opened a panel saying nothing had opened. */}
                      {mayOffer && o.status === 'offered' && o.person && reach.messages && (
                        <button type="button" className="link" onClick={() => onShare([o.person as PersonView])}>
                          Send
                        </button>
                      )}
                      {mayOffer && (o.status === 'offered' || o.status === 'confirmed') && withdrawing !== o.id && (
                        <button type="button" className="link" onClick={() => setWithdrawing(o.id)}>
                          Withdraw
                        </button>
                      )}
                    </span>
                    {withdrawing === o.id && (
                      <Confirm
                        question={
                          // The email Google sends is named, or that nothing is sent (finding 5).
                          o.status === 'confirmed'
                            ? `Release ${o.person?.name ?? 'them'} from this call? The days they're ${hold ? 'holding' : 'booked for'} go back to it. ${endingWords(reach, o.id, 'so', o.person, whatsappFollowsOffer(reach, call, o, o.person))}`
                            : `Withdraw the offer to ${o.person?.name ?? 'them'}? ${endingWords(reach, o.id, "it's withdrawn", o.person, whatsappFollowsOffer(reach, call, o, o.person))}`
                        }
                        yes={o.status === 'confirmed' ? `Release ${o.person ? firstName(o.person) : 'them'}` : 'Withdraw the offer'}
                        loss
                        no={o.status === 'confirmed' ? 'Keep them' : 'Keep it open'}
                        onYes={() => {
                          setWithdrawing(undefined)
                          withdraw(o)
                        }}
                        onNo={() => setWithdrawing(undefined)}
                      />
                    )}
                    {said.lines.map((l) => (
                      <small key={l.text} className={l.tone === 'warn' ? 'warn-line' : l.tone === 'bad' ? 'on-cal bad' : 'on-cal'} title={l.title}>
                        <AdminWords>{l.text}</AdminWords>
                      </small>
                    ))}
                    {/* A rate the office said no to: the offer stands at the rate offered, as their page says (ADR 0152). */}
                    {o.status === 'offered' && o.counterRateCents !== null && !o.rateHidden && (
                      <small className="on-cal">
                        Said no to {euro(o.counterRateCents)} a day: the offer stands at {standsAt(o.dayRateCents ?? call.dayRateCents, call.rateHidden)}.
                      </small>
                    )}
                    {/* A yes to confirm, or a rate to answer, settled here as on Crew's Answers to check (audit of 12 November 2026, finding 9). */}
                    {mayOffer && (o.status === 'accepted' || o.status === 'countered') && (
                      <AnswerActions o={o} call={call} run={run} onDone={(share) => onTell?.(share)} />
                    )}
                    {/* Not known is allowed, and said on the offer (ADR 0028). */}
                    {answering && o.person && certificateUnknowns(o.person, needsOf(call), o.days, today).map((w) => (
                      <small key={w} className="warn-line">
                        {w}
                      </small>
                    ))}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {live && !filled && mayOffer && (
        <Fold label="Offer…" className="offer" opened={offerOpened}>
          <OfferForm call={call} crew={crew} onShare={onShare} />
        </Fold>
      )}

      {open && (
        <>
          {editing && mayOffer && (
            <EditCall
              call={call}
              inJob={inJob}
              onDone={() => setEditing(false)}
              onSaved={(after, datesMoved) =>
                onTell?.(promptFor('call-changed', peopleOn(after).map((t) => neededBefore(datesMoved ? forCallDays(t) : t, call)), datesMoved, [], after.callTime !== call.callTime))
              }
            />
          )}
          <Refusal error={error} />
          {!mayOffer ? null : cancelling ? (
            <Confirm
              question={`Cancel the call for ${call.needed} × ${call.role} on ${call.project}? ${callEndingWords(reach, call)}`}
              yes="Cancel it"
              loss
              onYes={cancel}
              onNo={() => setCancelling(false)}
            />
          ) : (
            <div className="actions end">
              {/* A cancelled call, kept on the job's page for the record, can't be changed or cancelled again. */}
              {live && !call.pending && (
                <button type="button" className="link" onClick={() => setEditing(!editing)} aria-expanded={editing}>
                  Change
                </button>
              )}
              {live && (
                <button type="button" className="link" onClick={() => setCancelling(true)}>
                  Cancel crew call
                </button>
              )}
            </div>
          )}
        </>
      )}
    </article>
  )
}

/**
 * Change a crew call. Only what was changed is sent (call.update), so
 * another device's change to something else stands. The job, phase and
 * venue of a call that's part of a job come from the job, so they're
 * changed there. Before saving, the office is told what the change does
 * to the offers out: booked days move with the call, and a new rate
 * reaches only offers nobody has answered.
 */
/** The same person, told the call's days rather than their own: after a date change their own days have moved too, and the page has the detail. */
const forCallDays = (t: TellTo): TellTo => ({ ...t, context: { ...t.context, days: undefined } })

/** What the crew would notice; how many are needed and the reply-by date aren't worth a message. */
const NOTICED = ['role', 'start', 'end', 'callTime', 'dayRateCents', 'details', 'project', 'phase', 'venue', 'needsCertificates'] as const

/** The same person, told what the call needed before, so the message says what it needs now (ADR 0028). */
const neededBefore = (t: TellTo, call: CallView): TellTo => ({ ...t, context: { ...t.context, neededBefore: needsOf(call) } })

/** The call as the change leaves it, for the message to the people on it; undefined when nobody would notice. */
function afterChange(call: CallView, changes: CommandInput<'call.update'>): CallView | undefined {
  if (!NOTICED.some((k) => changes[k] !== undefined)) return undefined
  const start = changes.start ?? call.start
  const end = changes.end ?? call.end
  return {
    ...call,
    role: changes.role ?? call.role,
    start,
    end,
    days: eachDay(start, end),
    callTime: changes.callTime === undefined ? call.callTime : changes.callTime,
    dayRateCents: changes.dayRateCents === undefined ? call.dayRateCents : changes.dayRateCents,
    details: changes.details ?? call.details,
    project: changes.project ?? call.project,
    phase: changes.phase ?? call.phase,
    venue: changes.venue ?? call.venue,
    needsCertificates: changes.needsCertificates ?? call.needsCertificates,
  }
}

function EditCall({
  call,
  inJob = false,
  onDone,
  onSaved,
}: {
  call: CallView
  /** On the job's page, under its Next dock, which holds the page's one filled red (ADR 0104): Save changes is plain there. */
  inJob?: boolean
  onDone: () => void
  onSaved?: (after: CallView, datesMoved: boolean) => void
}) {
  const tied = !!call.projectId
  const view = useView()
  const today = useToday()
  // A call on a phase is for the phase's days (ADR 0159): the days can be picked inside them, and the phase moves the call further.
  // One left outside them from before says so, and keeps its days until they're changed.
  const phase = call.phaseId ? view.jobs.jobs.find((j) => j.id === call.projectId)?.phases.find((p) => p.id === call.phaseId) : undefined
  const offNow = phase ? daysOffPhase(call, phase) : []
  const within = phase && offNow.length === 0 ? phase : undefined
  // Said only for days still to come: the calendar has nothing before today to invite anyone to.
  const offAhead = offNow.filter((d) => d >= today)
  // A rate this device isn't sent stays the office's to change (ADR 0046).
  const seesRates = useSeesRates() && !call.rateHidden
  const [department, setDepartment] = useState<string | null>(departmentOf(call))
  const [f, setF] = useState({
    project: call.project,
    phase: call.phase,
    venue: call.venue,
    role: call.role,
    start: call.start,
    end: call.end,
    callTime: call.callTime ?? '',
    needed: call.needed,
    rate: call.dayRateCents === null ? '' : euroText(call.dayRateCents),
    details: call.details,
    replyBy: call.replyBy ?? '',
  })
  // What the call needs (ADR 0028): kept apart, as it's ticks rather than text.
  const [needs, setNeeds] = useState(needsOf(call))
  const { run, error, refuse } = useAct()
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === 'needed' ? Number(e.target.value) : e.target.value })
  const booked = Math.max(0, ...call.days.map((d) => call.heldByDay[d] ?? 0))
  const agreed = call.offers.filter((o) => o.status === 'accepted' || o.status === 'countered' || o.status === 'confirmed').length
  const rate = parseEuro(f.rate)
  const rateChanged = rate.cents !== undefined && rate.cents !== call.dayRateCents
  const datesChanged = f.start !== call.start || f.end !== call.end
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    // A reason left from the last press goes; this press says its own.
    refuse('')
    // Each said on its field, never a press that does nothing (spaces alone get past the browser's own check).
    if (!tied && !f.project.trim()) return void refuseField(form, '[name="project"]', 'Fill in the project first.')
    if (!f.role.trim()) return void refuseField(form, '[name="role"]', 'Fill in the role first.')
    if (rate.reason !== undefined) return void refuseField(form, 'input[aria-label="Day rate €"]', rate.reason)
    const changes: CommandInput<'call.update'> = { id: call.id }
    if (f.role.trim() !== call.role) changes.role = f.role.trim()
    if (f.start !== call.start) changes.start = f.start
    const end = f.end < f.start ? f.start : f.end
    if (end !== call.end) changes.end = end
    // Said on the day that's out, as the server would refuse it (ADR 0159).
    if (phase && (changes.start !== undefined || changes.end !== undefined) && daysOffPhase({ start: f.start, end }, phase).length)
      return void refuseField(form, f.start < phase.start || f.start > phase.end ? '[name="start"]' : '[name="end"]', `${phaseDaysRule(phase, today)} ${MOVE_THE_PHASE}`)
    // Dates moved earlier can leave the reply-by day after the job; it's here to fix, as when a call is made (audit finding 21).
    if (f.replyBy && f.replyBy > end) return void refuseField(form, '[name="replyBy"]', `${REPLY_BY_AFTER} Make it ${dayLabel(end)} or before, or clear it.`)
    if ((f.callTime || null) !== call.callTime) changes.callTime = f.callTime || null
    if (Math.max(1, f.needed) !== call.needed) changes.needed = Math.max(1, f.needed)
    if (rateChanged && seesRates) changes.dayRateCents = rate.cents
    if (department !== departmentOf(call)) changes.department = department
    if (f.details.trim() !== call.details) changes.details = f.details.trim()
    if ((f.replyBy || null) !== call.replyBy) changes.replyBy = f.replyBy || null
    if (needs.join() !== needsOf(call).join()) changes.needsCertificates = needs
    if (!tied) {
      if (f.project.trim() !== call.project) changes.project = f.project.trim()
      if (f.phase.trim() !== call.phase) changes.phase = f.phase.trim()
      if (f.venue.trim() !== call.venue) changes.venue = f.venue.trim()
    }
    if (Object.keys(changes).length === 1) return onDone()
    void run(() => client.mutate('call.update', changes)).then((ok) => {
      if (!ok) return
      onDone()
      const after = afterChange(call, changes)
      if (after) onSaved?.(after, changes.start !== undefined || changes.end !== undefined)
    })
  }
  return (
    <form className="grid-form" onSubmit={save} aria-label={`Change the call for ${call.role}`}>
      {!tied && (
        <>
          <label className="wide">
            Project <input name="project" value={f.project} onChange={set('project')} required />
          </label>
          <label>
            Phase <input value={f.phase} onChange={set('phase')} placeholder="Build, Show…" />
          </label>
          <label>
            Venue <input value={f.venue} onChange={set('venue')} />
          </label>
        </>
      )}
      <RoleField value={f.role} onChange={(role) => setF((now) => ({ ...now, role }))} />
      <label>
        How many <input type="number" min={Math.max(1, booked)} value={f.needed} onChange={set('needed')} />
      </label>
      <div className="pair">
        <label>
          From{' '}
          <input
            type="date"
            name="start"
            value={f.start}
            min={within?.start}
            max={within?.end}
            onChange={(e) => setF({ ...f, start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end })}
            aria-describedby={phase ? `call-days-${call.id}` : undefined}
          />
        </label>
        <label>
          To{' '}
          <input
            type="date"
            name="end"
            value={f.end}
            min={f.start}
            max={within?.end}
            onChange={set('end')}
            aria-describedby={phase ? `call-days-${call.id}` : undefined}
          />
        </label>
      </div>
      {phase &&
        (offAhead.length ? (
          <p className="warn-line wide" id={`call-days-${call.id}`}>
            {offPhaseLine(offAhead, phase, today)}
          </p>
        ) : (
          <p className="hint wide" id={`call-days-${call.id}`}>
            {phaseDaysRule(phase, today)} {MOVE_THE_PHASE}
          </p>
        ))}
      <label>
        Call time <input type="time" value={f.callTime} onChange={set('callTime')} />
      </label>
      {seesRates ? (
        <label>
          Day rate <UnitBox unit="€" before><input aria-label="Day rate €" inputMode="decimal" value={f.rate} onChange={set('rate')} placeholder="250" /></UnitBox>
        </label>
      ) : (
        <p className="hint">The office sets the rate: your role doesn't see crew rates.</p>
      )}
      <DepartmentField view={view} value={department} onChange={setDepartment} />
      <label className="wide">
        Reply by <input type="date" name="replyBy" value={f.replyBy} onChange={set('replyBy')} />
      </label>
      <label className="wide">
        Details for crew <textarea rows={2} value={f.details} onChange={set('details')} placeholder="Travel, food, parking, dress" />
      </label>
      <NeedsField value={needs} onChange={setNeeds} />
      {needs.some((k) => !needsOf(call).includes(k)) && agreed + call.offers.filter((o) => o.status === 'offered').length > 0 && (
        <p className="hint wide">Nobody already on it is taken off: anyone without it is warned about on the call's line.</p>
      )}
      {datesChanged && booked > 0 && (
        <p className="hint wide">
          {booked === 1 ? '1 person is' : `${booked} people are`} booked: the days they hold move with the call. Anyone who would be left with no days stops the
          change, so release them first or keep their days.
        </p>
      )}
      {rateChanged && seesRates && agreed > 0 && (
        <p className="hint wide">
          The new rate goes to offers still waiting on an answer. {agreed === 1 ? 'The 1 person who has' : `The ${agreed} people who have`} accepted, asked for
          a rate or been confirmed keep what was agreed.
        </p>
      )}
      {f.needed > call.needed && call.openDays.length === 0 && (
        <p className="hint wide">The call is filled: needing more opens it again. Anyone told it had filled gets a new offer, not the old one back.</p>
      )}
      <Refusal error={error} className="wide" />
      {/* Not "Cancel", beside "Cancel crew call": this one only closes the form (rule 10). */}
      <div className="actions wide">
        <button type="submit" className={inJob ? undefined : 'primary'}>
          Save changes
        </button>
        <button type="button" onClick={onDone}>
          Keep as it was
        </button>
      </div>
    </form>
  )
}

/** A role as it's compared: "Stage hand" and "stagehand " are the same. */
const roleWords = (role: string) => role.trim().replace(/[\s-]+/g, '').toLowerCase()

/**
 * Offer a call to people not yet offered it, several in one press (review of 11 November 2026, finding 12), with a warning when
 * anyone's days clash. Also beside a decline or a pull-out in "Answers to check".
 */
export function OfferForm({ call, crew, onShare }: { call: CallView; crew: CrewView; onShare: (people: PersonView[], made?: Made) => void }) {
  // Picked already when the same crew are asked for again (ADR 0164): those on it before the job stopped, not yet offered.
  const [ids, setIds] = useState<string[]>(() => [...picksWaiting(call.id)])
  useEffect(() => forgetPicksWaiting(call.id), [call.id])
  const [override, setOverride] = useState(false)
  const [applicants, setApplicants] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  // Someone who declined, couldn't make it or was told it's filled can be offered it again.
  const offered = new Set(call.offers.filter((o) => !['declined', 'filled', 'cancelled', 'pulled-out'].includes(o.status)).map((o) => o.personId))
  const everyone = crew.people.filter((p) => !offered.has(p.id) && !p.archived)
  // Applicants nobody has vetted (Level 0) stay out of the way unless asked for (ADR 0025).
  const hidden = everyone.filter((p) => p.level === APPLICANT_LEVEL).length
  const candidates = everyone.filter((p) => applicants || p.level !== APPLICANT_LEVEL).sort(byDepartmentThenLevel)
  const chosen = ids.map((id) => candidates.find((p) => p.id === id)).filter((p): p is PersonView => !!p)
  const clashOf = (p: PersonView) => personConflicts(crew, p.id, call.days, call.id)
  const clashing = chosen.filter((p) => clashOf(p).length > 0)
  // Busy in their own calendar (ADR 0044): said, never in the way. It may be something they can move, and they may still say yes.
  const own = useView().ownCalendars
  const reach = useReach()
  const { run, error, refuse } = useAct()
  // What the call needs (ADR 0028): those who hold it first, then those not known, then those missing one, each in the order above.
  const today = useToday()
  const needs = needsOf(call)
  const gapsOf = (p: PersonView) => certificateGaps(p, needs, call.days, today)
  const byNeeds = (people: PersonView[]) =>
    needs.length ? [people.filter((p) => gapsOf(p).length === 0), people.filter((p) => gapsOf(p).length > 0 && !gapsOf(p).some(blocks)), people.filter((p) => gapsOf(p).some(blocks))] : [people]
  // The call's own department first (audit, 5 November 2026, finding 62), the certificate groups inside each.
  const callDept = departmentOf(call)
  const ours = callDept ? candidates.filter((p) => !!p.department && sameDepartment(p.department, callDept)) : []
  const grouped = callDept && ours.length && ours.length < candidates.length ? [...byNeeds(ours), ...byNeeds(candidates.filter((p) => !ours.includes(p)))].flat() : byNeeds(candidates).flat()
  // Then who fits best on top (review of 11 November 2026, finding 12): those whose skills name the call's role and are free on its
  // days, then the rest who are free, then anyone not free at the bottom; the order above holds inside each.
  const role = roleWords(call.role)
  const doesIt = (p: PersonView) => p.skills.some((s) => roleWords(s) === role)
  const free = new Map(grouped.map((p) => [p.id, clashOf(p).length === 0]))
  const tier = (p: PersonView) => (!free.get(p.id) ? 2 : doesIt(p) ? 0 : 1)
  const ordered = grouped.map((p, i) => ({ p, i })).sort((a, b) => tier(a.p) - tier(b.p) || a.i - b.i).map((x) => x.p)
  const fits = ordered.filter((p) => tier(p) === 0).length
  const firstLabel = fits ? `Free and doing ${call.role} first` : 'Free first'
  // Those already chosen stay out of the list, so each pick is the next person.
  const pickable = ordered.filter((p) => !ids.includes(p.id))
  const findIn = (_: readonly PersonView[], text: string) => {
    const words = wordsOf(text)
    return pickable.filter((p) => found(p, words)).map((record) => ({ record }))
  }
  // What tells two people apart and what to know before offering: their department, level and skills, what they hold of what the
  // call needs, a clash and their own calendar.
  const metaOf = ({ record: p }: { record: PersonView }) =>
    [pickerLine(p), gapMarks(gapsOf(p)), free.get(p.id) === false ? '⚠ not free then' : '', own.busyOn(p.id, call.days).size ? 'busy in own calendar' : ''].filter(Boolean).join(' · ')
  // Offering anyway over a booking sends an offer they can only take the free days of: nobody holds two jobs on a day (ADR 0002),
  // so the checkbox says so, rather than reading as it does for days off (audit, 20 October 2026, finding 81).
  const onlyFreeOf = (p: PersonView) => {
    const bookedOn = heldOn(crew, p.id, call.days, call.id)
    if (!bookedOn.jobs.length) return ''
    return bookedOn.days.length >= call.days.length
      ? `${firstName(p)} can't take any of it unless they say they can't make ${bookedOn.jobs.join(' and ')}.`
      : `${firstName(p)} can only take the days not on ${bookedOn.jobs.join(' or ')} unless they say they can't make ${bookedOn.jobs.length === 1 ? 'it' : 'them'}.`
  }

  // Who's picked and not yet sent, so the job's Next button sends to them rather than opening this form again; gone with the form.
  const pickedNames = chosen.map((p) => p.name).join('\n')
  useEffect(() => {
    setOfferPicks(call.id, pickedNames ? pickedNames.split('\n') : [])
  }, [call.id, pickedNames])
  useEffect(() => () => setOfferPicks(call.id, []), [call.id])

  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Whatever stops it is said, even a fault in the checks themselves, never a press that does nothing.
    try {
      check(e.currentTarget)
    } catch (err) {
      console.error(err)
      refuse(`The offer couldn't be made: ${reasonOf(err)}`)
    }
  }
  const check = (form: HTMLFormElement) => {
    refuse('')
    // Never a dead Offer (UX sweep, 6 November 2026, move 5): a press says what's missing, on the field it's about.
    if (!chosen.length) return refuseField(form, '[role="combobox"]', 'Choose someone to offer it to first: type a name, or pick from the list.')
    if (clashing.length > 0 && !override)
      return refuseField(form, '.warn input[type="checkbox"]', `Tick Offer anyway first, or take ${clashing.length === 1 ? firstName(clashing[0]!) : 'those not free'} off.`)
    // Said here, in the server's own words, rather than after a round trip; "Offer anyway" doesn't pass it.
    for (const p of chosen) {
      const short = certificateRefusal(p, needs, call.days, today)
      if (short) return refuse(chosen.length > 1 ? `${p.name}: ${short}` : short)
    }
    const people = chosen
    // What the press made, and when, for the Undo that holds while nothing of the app's has gone to them (ADR 0162).
    const made: Made = { ids: people.map(() => newId()), at: Date.now() }
    void run(async () => {
      for (const [i, p] of people.entries()) await client.mutate('offer.send', { id: made.ids[i]!, callId: call.id, personId: p.id, override: clashOf(p).length > 0 && override })
    }).then((ok) => {
      if (!ok) return
      setIds([])
      setOverride(false)
      onShare(people, made)
    })
  }

  // What the press is called: the person it goes to, so it reads as the step and not as another search button.
  const sendLabel = chosen.length === 1 ? `Offer to ${chosen[0]!.name}` : `Offer to ${chosen.length} people`
  // What the press sends by itself and what it doesn't, by the rules the server sends by (finding 1).
  const promise = offerPromise(reach, call, chosen)
  // Whoever doesn't get the place has their invite cancelled, which Google emails them.
  const invitesOut = promise.invites || call.offers.some((o) => OPEN.includes(o.status) && daysToCancel(reach, o.id).length > 0)
  // And hears it on WhatsApp, where it reaches them (ADR 0154): anyone picked once their offer has gone there, and anyone
  // already asked who heard of it.
  const whatsappOut =
    call.end >= reach.today && (chosen.some((p) => whatsappReach(reach.whatsapp, p) !== undefined) || call.offers.some((o) => OPEN.includes(o.status) && whatsappFollowsOffer(reach, call, o, o.person)))

  return (
    <form className="offer-form" id={offerFormId(call.id)} onSubmit={send} ref={formRef}>
      {/* Who's picked and the button that offers it come above the search, so the list it keeps open for the next pick never
          covers them. */}
      {chosen.length > 0 && (
        <ul className="offer-to" aria-label="To offer it to">
          {chosen.map((p) => (
            <li key={p.id}>
              <span>
                <b>{p.name}</b>
                <small>{metaOf({ record: p })}</small>
                {certificateUnknowns(p, needs, call.days, today).map((w) => (
                  <small key={w} className="warn-line">
                    {w}
                  </small>
                ))}
                {own.warning(p.id, call.days) && <small className="warn-line">{own.warning(p.id, call.days)}. The offer can still go: it may be something they can move, and they can still say yes.</small>}
              </span>
              <button type="button" className="link" aria-label={`Take ${p.name} off`} onClick={() => (setIds((now) => now.filter((x) => x !== p.id)), refuse(''), settleRefusals(formRef.current))}>
                Take off
              </button>
            </li>
          ))}
        </ul>
      )}
      {clashing.length > 0 && (
        <label className="warn">
          <input type="checkbox" checked={override} onChange={(e) => (setOverride(e.target.checked), refuse(''))} />
          <span>
            {clashing.map((p) => `${clashing.length > 1 ? `${firstName(p)}: ` : ''}${clashOf(p).join('. ')}. ${onlyFreeOf(p)}`).join(' ')} <b>Offer anyway</b>
          </span>
        </label>
      )}
      {/* Picked is not offered (crew offer with no clear next step, 11 November 2026): with someone picked, what hasn't happened
          yet, what pressing does, and the one filled button that does it, under the people it names and above the search. With nobody picked there's
          nothing to press, so there's no button: picking is the step. */}
      {chosen.length > 0 && (
        <div className="offer-send">
          <p className="offer-pending">
            <b>Not offered yet.</b>{' '}
            {/* A press that tells nobody anything says so, rather than that they don't know until it's pressed. */}
            {promise.silent
              ? `Pressing ${sendLabel} puts the offer on ${chosen.length > 1 ? 'their pages' : 'their page'}.`
              : `${namesInWords(chosen.map(firstName))} ${chosen.length > 1 ? "don't" : "doesn't"} know until you press ${sendLabel}.`}
            {promise.sentences.map((s) => ` ${s}`).join('')}
          </p>
          {clashing.length > 0 && !override && !error && (
            <p className="hint warn-line">Tick Offer anyway above first, or take {clashing.length === 1 ? firstName(clashing[0]!) : 'those not free'} off.</p>
          )}
          <button type="submit" className="primary">
            {sendLabel}
          </button>
        </div>
      )}
      {/* Beside the button that was pressed, so a phone sees it without scrolling. */}
      <Refusal error={error} />
      {chosen.length > 0 && offered.size + chosen.length > call.needed && (
        <p className="hint">
          {chosen.length + offered.size} offered for {plural(call.needed, 'place')}: whoever says yes first has it. The rest see it's filled on their link
          {invitesOut ? `, and Google emails anyone invited that it's cancelled${reach.calendar.link?.tell === 'on' ? ', filled by someone else' : ''}` : ''}
          {whatsappOut ? ". A WhatsApp tells anyone it reaches that they're no longer needed. Nothing else tells them." : '; nothing else tells them.'}
        </p>
      )}
      <RecordPicker
        label={chosen.length ? 'Offer to someone else too' : 'Offer to'}
        records={pickable}
        value=""
        find={findIn}
        meta={metaOf}
        first={pickable}
        firstLabel={firstLabel}
        keepOpen
        nothingFound={(t) => `Nobody matches “${t}”${!applicants && hidden > 0 ? ': applicants are left out unless shown' : ''}`}
        onPick={(id) => {
          setIds((now) => (now.includes(id) ? now : [...now, id]))
          // A reason given for someone else no longer applies.
          refuse('')
          settleRefusals(formRef.current)
        }}
        placeholder="Name, phone, email, department or skill"
      />
      {(hidden > 0 || applicants) && (
        <label className="applicants">
          <input type="checkbox" checked={applicants} onChange={(e) => setApplicants(e.target.checked)} />
          <span>Show applicants{hidden > 0 ? ` (${hidden})` : ''}</span>
        </label>
      )}
    </form>
  )
}

/**
 * How many are held against how many are needed (audit of 18 October,
 * finding 20): "25 of 40, both days", "3 of 6", or "20 to 25 of 40 a day"
 * when the days differ, rather than "0/2 days filled" for a call most of the
 * way there.
 */
export function heldLabel(call: Pick<CallView, 'days' | 'heldByDay' | 'needed'>): string {
  const held = call.days.map((d) => call.heldByDay[d] ?? 0)
  const least = Math.min(...held)
  const most = Math.max(...held)
  if (held.length <= 1) return `${least} of ${call.needed}`
  if (least !== most) return `${least} to ${most} of ${call.needed} a day`
  return `${least} of ${call.needed}, ${held.length === 2 ? 'both days' : `all ${held.length} days`}`
}
