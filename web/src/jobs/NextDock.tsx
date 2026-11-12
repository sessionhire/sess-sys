import { crewNext, dayLabel, firstName, jobPosition, plural, ratesClosedBy, STATUS_LABELS, STOPPED, whoDoes, type JobStep, type JobView, type View } from '@sh/shared'
import { Refusal, useAct } from '../act.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
import type { JobPart } from './JobScreen.tsx'
import { crewToCall, makeCallsFromQuote } from './crewFromQuote.ts'
import { promptFor, tellTo, type Share } from '../crew/Messages.tsx'
import { useToday } from '../view.ts'
import { offerFormId, useOfferPicks } from '../crew/offerPicks.ts'

/** Where a press of Next lands on the job page (ADR 0140): a call, with its Offer open or not, or the short kit's Subhire. */
/** Where a press lands on the job's page: a call, opening its Offer or its rows to answer a yes or a rate (ADR 0152); or the short kit. */
export type Landing = { call: string; offer?: boolean; answer?: boolean } | { short: true }

/**
 * The one Next button of a job (ADR 0104): drawn the same on every job and
 * in one place, right of the title on a desk and docked above the bar on a
 * phone, where the thumb is, staying put while the page scrolls. A line
 * says where the job is and how far (the stage, the task's count, whose it
 * is, when it's due); the one filled button says what to do, a verb and
 * its object; a quiet second choice hands the task to someone. It is never
 * greyed out and never gone: when there's nothing for this person to press
 * (the show is on, the task is another role's, the job is through) the
 * same place says so in plain words.
 *
 * It offers only what this person's role can do (ADR 0034, ADR 0109): booking
 * crew needs the crew ability, the kit the kit one, picking and scanning the
 * stock one; anyone else is told whose it is. Its label follows what has
 * happened: once the client has said yes it confirms the job in one press,
 * and once a job's dates pass while it's still being sold it asks what
 * happened.
 */

/** How many days before a job goes out its pick list takes the dock's quiet slot, for a role that picks (Move 8). */
const PICK_SOON_DAYS = 7

export function NextDock({
  job,
  view,
  onPart,
  onOpenTask,
  headSays,
  quoteHere,
  onTell,
}: {
  job: JobView
  view: View
  /** The page's head already says where the job stands (ADR 0140, part 3): the line says only Next, so it's said once. */
  headSays?: boolean
  /** Opens a part of the job, landing on a call (its Offer open, or not) or the short kit's Subhire (ADR 0140). */
  onPart: (p: JobPart, land?: Landing) => void
  /** Opens the message for someone a press of Next has settled, as the Crew page's own Confirm does; without it, nobody is prompted. */
  onTell?: (share: Share | undefined) => void
  onOpenTask: (t: JobStep) => void
  /** The job's Quote tab is open under it (ADR 0140, part 4): the quote's own button there is the press, so the dock says so in words. */
  quoteHere?: boolean
}) {
  const access = useAccess()
  const { run, error } = useAct()
  const today = useToday()
  // Who's picked in the Offer of the call Next would offer, and not yet sent (offerPicks.ts).
  const askId = crewNext(job.calls).ask?.call.id
  const picked = { callId: askId, names: useOfferPicks(askId) }
  const steps = view.steps.of(job.id)
  // Errands and meetings have no stages, so no Next: the page is as it was.
  if (!steps || (steps.stopped && !steps.steps.some((s) => s.ownerId || s.ticked) && steps.stopped.startsWith('Errands'))) return null
  const href = `#jobs/${encodeURIComponent(job.id)}`
  const task = steps.current
  const stage = steps.stage
  const mayTask = access.can('steps') && (access.role !== 'crew' || (!!access.personId && task?.ownerId === access.personId))

  /** The line over the button: where the job stands, the head's own words (Move 7 of the sweep of 6 November 2026), so the two agree;
   * left to the head where it says them (ADR 0140, part 3), and said here where it doesn't, as on the quote. */
  const position = jobPosition(steps)
  const line = (
    <p className="line">
      <b>Next</b>
      {position && !headSays && (
        <>
          {' · '}
          <span className="position-words" data-tone={position.tone}>
            {[position.stage === 'Through' ? undefined : position.stage, position.hint, position.owner, position.time].filter(Boolean).join(' · ')}
          </span>
        </>
      )}
    </p>
  )
  const rest = (words: string, link?: { href: string; label: string } | { label: string; onPress: () => void }) => (
    <div className="next-dock" role="region" aria-label="Next" data-rest="true">
      {line}
      <p className="rest">
        {words}
        {link && (
          <>
            {' '}
            {'href' in link ? (
              <a href={link.href}>{link.label}</a>
            ) : (
              <button type="button" className="link" onClick={link.onPress}>
                {link.label}
              </button>
            )}
          </>
        )}
      </p>
    </div>
  )

  // The steps card says the tasks are stopped; the dock says how to take the job up again, rather than the same words twice (audit,
  // 5 November 2026, finding 88).
  if (steps.stopped)
    return STOPPED.includes(job.status)
      ? rest(
          access.can('jobs')
            ? `${STATUS_LABELS[job.status]}. To take it up again, change its status under Change details.`
            : `${STATUS_LABELS[job.status]}: the office can take it up again.`
        )
      : rest(steps.stopped)
  if (steps.finished) {
    const deprep = steps.steps.find((s) => s.key === 'deprep')
    return rest(`All done${deprep?.ticked ? `: deprepped ${dayLabel(deprep.ticked.at.slice(0, 10))}` : ''}. Nothing left to press.`)
  }
  if (!task) {
    // The stage's tasks are done and nothing is left behind: the job waits on its dates.
    const show = steps.steps.find((s) => s.key === 'show')
    return rest(`${stage?.label ?? 'This stage'} is done. ${show?.hint ?? ''}`.trim())
  }
  // Crew are asked while the job is still a quote (ADR 0150), so a yes or a rate to answer waits while Next leads with the
  // quote: said beside it, opening the call's rows to answer it there (audit of 12 November 2026, finding 9).
  const toAnswer =
    access.can('crew') && (task.key === 'quote' || task.key === 'confirmed')
      ? job.calls.flatMap((c) => (c.status === 'open' ? c.offers.filter((o) => o.status === 'accepted' || o.status === 'countered').map(() => c.id) : []))
      : []
  const answers = toAnswer.length ? { label: `${plural(toAnswer.length, 'answer')} to check`, onPress: () => onPart('crew', { call: toAnswer[0]!, answer: true }) } : undefined

  /** What to press for the task, or why there's nothing to. */
  let press: { label: string; href?: string; onPress?: () => void } | undefined
  let why: string | undefined
  switch (task.key) {
    case 'quote': {
      if (!access.can('money')) break
      const quotes = view.money.quotesOf(job.id)
      // A quote is built from the kit and crew, so a job with neither starts there (audit, 5 November 2026, finding 16).
      const empty = quotes.length === 0 && !(view.kit.byJob.get(job.id)?.length) && job.calls.length === 0
      if (empty && access.can('kit')) press = { label: 'Add the kit to quote', onPress: () => onPart('kit') }
      // The quote is the job's Quoting stage, worked on its own tab (ADR 0140, part 4). With that tab open, its Send or Build is the
      // one press, so the dock doesn't hold a second red that only goes where the page already is.
      else if (quoteHere)
        return rest(
          quotes.length === 0 ? 'Build the quote below, from the job or empty.' : quotes.some((q) => q.status === 'draft') ? 'Finish the quote below and send it to the client.' : "The quote is below, waiting on the client's answer.",
          answers
        )
      else press = { label: quotes.length === 0 ? 'Make a quote' : quotes.some((q) => q.status === 'draft') ? 'Finish the quote' : 'Open the quote', onPress: () => onPart('quote') }
      break
    }
    case 'confirmed': {
      if (!access.can('jobs')) break
      // The client's yes is on the quote, so the one press left is the job's own (audit, 5 November 2026, finding 25).
      const yes = access.can('money') && view.money.currentOf(job.id)?.status === 'accepted'
      // On the Quote tab, the answer is recorded under What happened, whose button is the one red (ADR 0140, part 4).
      if (quoteHere && access.can('money') && view.money.currentOf(job.id))
        return rest(yes ? 'The client said yes: confirm the job below.' : "Record the client's answer below, under What happened.", answers)
      press = yes
        ? { label: 'Confirm the job', onPress: () => void run(() => client.mutate('project.update', { id: job.id, status: 'confirmed' })) }
        : { label: steps.lapsed ? 'Record what happened' : "Record the client's answer", onPress: () => onOpenTask('confirmed') }
      break
    }
    case 'crew': {
      if (!access.can('crew')) break
      // From the task's fields, never its words read back (Move 7 of the sweep of 6 November 2026).
      const { booked = 0, needed = 0 } = task.facts
      // Each press does one thing and the count moves on with it (ADR 0140, part 5): crew on the quote are made calls (ADR 0126);
      // a yes is confirmed; a call with places nobody's been offered opens its Offer; then the answers still out are waited on.
      const fromQuote = crewToCall(view, job)
      const next = crewNext(job.calls)
      const count = `${booked} of ${needed} booked`
      if (fromQuote.length)
        press = {
          label: fromQuote.length === 1 ? `Make the call for ${fromQuote[0]!.needed} × ${fromQuote[0]!.role}` : `Make the ${fromQuote.length} crew calls from the quote`,
          onPress: () => void run(() => makeCallsFromQuote(view, job, today)).then((ok) => ok && onPart('crew')),
        }
      else if (next.yes) {
        const { call, offer } = next.yes
        const person = offer.person!
        // A yes with days they haven't answered, or one that fills the call over a rate still asked for, is confirmed on its
        // row, where what confirming ends is said first (ADR 0152).
        press =
          offer.asked?.length || ratesClosedBy(call, call.offers, offer.id).length
            ? { label: `Check ${firstName(person)}'s yes · ${count}`, onPress: () => onPart('crew', { call: call.id, answer: true }) }
            : {
                label: `Confirm ${firstName(person)}'s yes · ${count}`,
                onPress: () =>
                  void run(() => client.mutate('offer.confirm', { id: offer.id })).then((ok) => {
                    if (!ok) return
                    onPart('crew', { call: call.id })
                    onTell?.(promptFor('confirmed', [tellTo(person, call, offer)]))
                  }),
              }
      } else if (next.ask) {
        const { call, asked } = next.ask
        // With people already picked in its Offer, this press sends it to them (crew offer that wouldn't send, 11 November 2026):
        // otherwise the page's one filled button only opened the form they were in, and its own Offer read as greyed out. What
        // stops it is said in the form, which it lands on.
        const to = picked.callId === call.id ? picked.names : []
        press = to.length
          ? {
              label: `Offer to ${to.length === 1 ? firstName({ name: to[0]! }) : `${to.length} people`} · ${asked} of ${call.needed} offered`,
              onPress: () => {
                const form = document.getElementById(offerFormId(call.id))
                if (form instanceof HTMLFormElement) form.requestSubmit()
                onPart('crew', { call: call.id, offer: true })
              },
            }
          : { label: `Offer the ${call.role} · ${asked} of ${call.needed} offered`, onPress: () => onPart('crew', { call: call.id, offer: true }) }
      } else if (next.counter)
        // A different rate is settled on its own row, with the rate in view (audit of 12 November 2026, finding 9).
        press = { label: `Answer ${firstName(next.counter.offer.person!)}'s rate · ${count}`, onPress: () => onPart('crew', { call: next.counter!.call.id, answer: true }) }
      else if (next.waiting)
        return rest(`Every place is offered: waiting on ${plural(next.waiting, 'answer')}. ${count}.`, { href: `${href}/crew`, label: "See who's been asked" })
      else press = { label: needed === 0 ? 'Ask for the crew' : `Book ${needed - booked} more crew`, onPress: () => onPart('crew') }
      break
    }
    case 'kit': {
      if (!access.can('kit')) break
      const { short = 0, nothingYet } = task.facts
      // Short kit lands on its Subhire, open with the short lines ticked (ADR 0140, part 5); each one subhired takes the count down.
      press = short
        ? { label: `Sort ${short} short on the kit`, onPress: () => onPart('kit', { short: true }) }
        : { label: nothingYet ? 'Add the kit' : 'Settle the kit and vans', onPress: () => onPart('kit') }
      break
    }
    case 'prep':
      if (!access.can(task.facts.nothingYet ? 'kit' : 'stock')) break
      press = task.facts.nothingYet
        ? { label: 'Add the kit', onPress: () => onPart('kit') }
        : // With how far it has got, as the pick list's own dock says it, so each visit is seen to move it (ADR 0140, part 6).
          { label: `Pick the kit · ${task.facts.out ?? 0} of ${task.facts.of ?? 0} out`, href: `${href}/pick` }
      break
    case 'show':
      why = `Nothing to press: ${stage?.key === 'on' && task.facts.until ? `on the job until ${dayLabel(task.facts.until)}` : (task.hint?.toLowerCase() ?? 'the job is on')}.`
      break
    case 'back':
      if (!access.can('stock')) break
      press = { label: 'Scan the kit back', href: `${href}/pick` }
      break
    case 'deprep':
      if (!mayTask) break
      press = { label: 'Tick off the deprep', onPress: () => onOpenTask('deprep') }
      break
  }
  // Within a week of going out, the warehouse's own way in (Move 8 of the sweep of 6 November 2026): the pick list, with how far it
  // has got, in the quiet slot, while the filled verb stays the planner's. Not when picking is the task, which the button already is.
  const prep = steps.steps.find((s) => s.key === 'prep')
  const pickSoon =
    access.can('stock') && task.key !== 'prep' && task.key !== 'back' && !!prep?.facts.of && !prep.done && steps.daysTo !== undefined && steps.daysTo <= PICK_SOON_DAYS
      ? { href: `${href}/pick`, label: `Pick the kit · ${prep.facts.out} of ${prep.facts.of} out` }
      : undefined
  // Someone else's, said in the one shape the word table writes (UX sweep, 6 November 2026, move 4): who does it, and nothing to press.
  if (!press) {
    const aside = answers ?? pickSoon
    return rest(why ?? `Next is ${task.label.toLowerCase()}. ${task.owner ? `It's down to ${task.owner.name}.` : whoDoes(task.key)} ${aside ? '' : 'Nothing here for you to press.'}`.trim(), aside)
  }
  // The quiet second choice: an answer to check, else hand the task on, or open it. Not for the client's answer, whose button already opens it.
  const second = answers ? (
    <button type="button" className="link second" onClick={answers.onPress}>
      {answers.label}
    </button>
  ) : pickSoon ? (
    <a className="link second" href={pickSoon.href}>
      {pickSoon.label}
    </a>
  ) : (
    mayTask &&
    task.key !== 'confirmed' &&
    task.key !== 'deprep' && (
      <button type="button" className="link second" onClick={() => onOpenTask(task.key)}>
        {task.owner ? 'Hand it on' : 'Hand it to someone'}
      </button>
    )
  )
  return (
    <div className="next-dock" role="region" aria-label="Next">
      {line}
      {press.href ? (
        <a className="button primary" href={press.href}>
          {press.label}
        </a>
      ) : (
        <button type="button" className="primary" onClick={press.onPress}>
          {press.label}
        </button>
      )}
      {second}
      <Refusal error={error} />
    </div>
  )
}

/**
 * The same dock on the pick list (Move 8 of the sweep of 6 November 2026; ADR 0104 names it the dock's second place): the
 * warehouse reads where the job stands from the floor, in four wordings, and after the last scan what comes next rather than a
 * list that just stops. The scan is the act here, so while picking or bringing back there's no button; the deprep is ticked
 * on the job, so that one opens it. Drawn in the foot on a phone, as the job page's is, kept short so the list keeps its room.
 */
export function PickDock({ job, view }: { job: JobView; view: View }) {
  const today = useToday()
  const steps = view.steps.of(job.id)
  if (!steps || steps.stopped) return null
  const prep = steps.steps.find((s) => s.key === 'prep')!
  const back = steps.steps.find((s) => s.key === 'back')!
  const deprep = steps.steps.find((s) => s.key === 'deprep')!
  const open = (s: (typeof steps.steps)[number]) => !s.done && !s.skipped
  const started = steps.stage?.key === 'on' || steps.stage?.key === 'back' || steps.finished
  let line: string | undefined
  let rest: string | undefined
  let link: { href: string; label: string } | undefined
  // On its days with nothing scanned out, it's due out, said from the scans rather than the date (ADR 0140, part 6).
  const due = job.span && job.span.start <= today ? (job.span.start === today ? 'Due out today' : `Due out since ${dayLabel(job.span.start)}`) : undefined
  if (!started && open(prep) && prep.facts.of) line = `${due ?? 'Pick the kit'} · ${prep.facts.out} of ${prep.facts.of} out`
  else if (!started && prep.facts.of) rest = `All ${prep.facts.of} out: ready to load.${job.span ? ` On the job from ${dayLabel(job.span.start)}.` : ''}`
  else if (open(back) && back.facts.stillOut) line = `Scan the kit back · ${back.facts.stillOut} still out`
  else if (open(back) && back.facts.neverScanned) line = `Check the kit is back · ${back.facts.neverScanned} never scanned out`
  else if (open(deprep) && steps.stage?.key === 'back') {
    line = `Tick off the deprep${deprep.facts.faults ? ` · ${plural(deprep.facts.faults, 'fault')} open on its kit` : ''}`
    link = { href: `#jobs/${encodeURIComponent(job.id)}`, label: 'Open the job' }
  } else if (steps.stage?.key === 'on') rest = `Out on the job${job.span ? ` until ${dayLabel(job.span.end)}` : ''}.`
  else if (steps.finished) rest = 'All back and done. Nothing left to scan.'
  if (!line && !rest) return null
  return (
    <div className="next-dock pick-dock" role="region" aria-label="Next" data-rest={rest ? 'true' : undefined}>
      {line ? (
        <p className="line">
          <b>Next</b> · {line}
        </p>
      ) : (
        <p className="rest">{rest}</p>
      )}
      {link && (
        <a className="button" href={link.href}>
          {link.label}
        </a>
      )}
    </div>
  )
}
