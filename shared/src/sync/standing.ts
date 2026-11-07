import { offerOnCalendar } from '../calendar.ts'
import { departmentOf } from '../crew.ts'
import { sameDepartment } from '../crew-departments.ts'
import { runningOut, type RunningOut } from '../documents.ts'
import { STOPPED } from '../jobs.ts'
import { nobodySoon } from '../lists.ts'
import { STILL_NEEDS_CREW } from '../words.ts'
import type { Department } from '../stock.ts'
import type { View } from './client-types.ts'
import { answersToCheck, type AnswerToCheck, type CallView, type OfferView, type PersonView } from './crew-view.ts'
import { quotesToFollow, type QuoteToFollow } from './money-view.ts'
import type { PickList } from './pick-view.ts'
import { addDays } from './plan.ts'
import { kitToCheckBackIn, type JobSteps, type KitToCheck } from './steps-view.ts'

/**
 * How things stand (ADR 0033): every list a count on Home or along an
 * area's row opens, each worked out from this device's own copy, so it's
 * right with no signal too. A count is the number of rows in its list, and
 * the screen it opens draws that list under its words here
 * (STANDING_HEADINGS) and the same number (Move 3 of the sweep of 6
 * November 2026); the jobs' task counts open the Jobs list on the filters
 * that pick the same jobs, and it says how many it shows. Home picks which
 * counts to show and for whom (web/src/home/standing.ts); each list is
 * worked out when it's first read.
 */

/**
 * A crew department's kit, by the stock list's departments, so a head of
 * department sees their own kit as well as their own people. Departments
 * with no kit of their own (production, transport, stage managers) have
 * none.
 */
export const KIT_OF: Record<string, Department> = {
  audio: 'audio',
  backline: 'audio',
  lx: 'lighting',
  lighting: 'lighting',
  laser: 'lighting',
  video: 'video',
  'led tech': 'video',
  led: 'video',
  rigger: 'rigging',
  rigging: 'rigging',
  staging: 'staging',
  power: 'power',
}
export const kitOf = (department: string): Department | undefined => KIT_OF[department.trim().toLowerCase()]

/** Narrows to one department: people by their profile, kit by the matching stock department. Everything, with no department. */
export function narrower(department: string | undefined) {
  const wanted = department?.trim().toLowerCase()
  const kit = department ? kitOf(department) : undefined
  return {
    person: (p: Pick<PersonView, 'department'> | undefined) => !wanted || p?.department?.trim().toLowerCase() === wanted,
    kit: (d: Department | undefined) => !wanted || (!!kit && d === kit),
  }
}

/** An answer on Google Calendar the app couldn't act on, such as a No to a booked day, in words. */
export interface CalendarAnswer {
  c: CallView
  o: OfferView
  text: string
}

/** Answers on Google Calendar the app couldn't act on: for the office to sort out, counted in "Answers to check". */
export function calendarAnswersToSortOut(view: View, today: string): CalendarAnswer[] {
  return view.crew.calls
    .filter((c) => c.end >= today && c.status === 'open')
    .flatMap((c) =>
      c.offers
        .filter((o) => o.status === 'offered' || o.status === 'confirmed')
        .flatMap((o) => {
          const cal = offerOnCalendar(o, view.calendar.days, today)
          return cal?.warning ? [{ c, o, text: o.status === 'confirmed' ? cal.warning : `${cal.line} ${cal.warning}` }] : []
        }),
    )
}

/** Whose counts: the person looking, whose own leave request is another approver's, and the department they're narrowed to. */
export interface StandingFor {
  me?: { id: string }
  department?: string
}

/** Every list a count opens, by the count's key. */
export interface Standing {
  /** Running late, said on a link and not yet noted (ADR 0028): Crew › Calls, under Answers to check. */
  late: View['late']['toCheck']
  /** Documents sent in, answers on Google Calendar to sort out (not a department's) and crew's answers: Crew › Calls, Answers to check. */
  answers: (View['documents']['toCheck'][number] | CalendarAnswer | AnswerToCheck)[]
  /** Calls in the next fortnight still needing crew, by the call's own department (ADR 0046). */
  'crew-needed': CallView[]
  /** Only the timesheets this person can decide: one whose amounts they aren't sent is the office's (ADR 0062). */
  timesheets: View['timesheets']['toApprove']
  /**
   * Leave waiting, but their own request, which another approver decides (audit, 5 November 2026, finding 28). Never a
   * department's: approvers are people (ADR 0024), so what waits on a head is whoever's they approve (Move 3 of the sweep
   * of 6 November 2026).
   */
  leave: View['leave']['queue']
  certificates: RunningOut<PersonView>[]
  /** Confirmed jobs starting today or tomorrow with kit still to go out. */
  'to-pick': PickList[]
  /** The jobs with kit to check back in (ADR 0109). */
  'still-out': KitToCheck[]
  /** Kit short for confirmed jobs whose kit is held in the fortnight, as crew needed is counted (audit, 20 October 2026, finding 33). */
  'kit-short': View['kit']['short']
  faults: View['faults']['open']
  /**
   * Damaged and held back, apart from the repairs that don't stop anything (audit, 5 November 2026, finding 69): a repair
   * each, as the Repairs page lists them, so a report of three cables is one, as its row is.
   */
  'damaged-stopped': View['faults']['open']
  /** Inspections run out, or due with nothing to show for them: the items can't go out until tested. */
  'cant-go': View['inspections']['attention']
  'tests-soon': View['inspections']['attention']
  /** A vehicle's checks run out or running out (ADR 0047). */
  vehicles: View['vehicles']['reminders']
  counts: View['counts']['week']['due']
  /** Jobs still to come with a task late, as the Jobs list's Tasks filter counts them (audit, 5 November 2026, finding 20). */
  'tasks-late': JobSteps[]
  /** Jobs being planned that start within a fortnight with the next task down to nobody (Move 10 of the sweep of 6 November 2026). */
  'tasks-nobody': JobSteps[]
  /** Enquiries and quotes whose dates have passed with no answer (ADR 0109), the most recent first, as the Board's fold has them. */
  'no-answer': JobSteps[]
  /**
   * Quotes sent a week or more ago with no answer: worth a call to the client (ADR 0081), the longest waiting first, as
   * Quotes › To follow up marks them at the top of Waiting for an answer (Move 10 of the sweep of 6 November 2026).
   */
  quotes: QuoteToFollow[]
}

export type StandingKey = keyof Standing

/**
 * The heading of the list each count opens, without its number: the part of the screen Home's count lands on
 * (web/src/arrival.ts), and what that screen heads the list with, before the same number. Running late is said in the
 * answers' heading, after their number (answersHeading), and the quotes worth a call in the heading of those waiting for
 * an answer, after theirs (waitingHeading). The jobs' task counts open the Jobs list on its filters instead, which says
 * how many it shows.
 */
export const STANDING_HEADINGS = {
  late: 'Answers to check',
  answers: 'Answers to check',
  'crew-needed': STILL_NEEDS_CREW,
  timesheets: 'To approve',
  leave: 'To approve',
  certificates: 'Running out',
  'to-pick': 'To pick for today or tomorrow',
  'still-out': 'Still out after the job',
  'kit-short': 'For confirmed jobs in the next fortnight',
  faults: 'Repairs open',
  'damaged-stopped': "Damaged, can't go out",
  'cant-go': "Can't go out",
  'tests-soon': 'Due in the next 30 days',
  vehicles: 'Vehicle checks running out',
  counts: 'To count this week',
  'tasks-late': undefined,
  'tasks-nobody': undefined,
  'no-answer': 'Dates passed, no answer',
  quotes: 'Waiting for an answer',
} as const satisfies Record<StandingKey, string | undefined>

/** A list's heading with how many are in it, the number its count on Home says: "Repairs open (15)". */
export const listHeading = (heading: string, n: number) => `${heading} (${n.toLocaleString('en-IE')})`

/**
 * Answers to check's heading, with both of Home's counts that open it: "Answers to check (73) · 1 running late". With
 * no answers it counts whoever is running late, the rows under it, so it never says none over a card with something in
 * it (ADR 0033); the number and its words are kept together, so a phone doesn't break the line between them.
 */
export function answersHeading(answers: number, late: number): string {
  if (answers === 0) return listHeading(STANDING_HEADINGS.answers, late)
  return late ? `${listHeading(STANDING_HEADINGS.answers, answers)} · ${late.toLocaleString('en-IE')}\u00a0running late` : listHeading(STANDING_HEADINGS.answers, answers)
}

/**
 * The quotes sent with no answer, on Quotes › To follow up, with how many of them are worth a call, Home's count of them:
 * "Waiting for an answer (9) · 3 worth a call". Those are the longest waiting, so they're the first rows under it.
 */
export function waitingHeading(waiting: number, chase: number): string {
  const heading = listHeading(STANDING_HEADINGS.quotes, waiting)
  return chase ? `${heading} · ${chase.toLocaleString('en-IE')}\u00a0worth a call` : heading
}

/**
 * The lists, narrowed to a department when one is given. The jobs' own
 * counts (kit still out, tasks, dates passed, quotes worth a call) are the
 * job's, not a department's, so they're empty for one; leave waits on its
 * approver (ADR 0024), so it isn't narrowed.
 */
export function standing(view: View, today: string, { me, department }: StandingFor = {}): Standing {
  const by = narrower(department)
  const fortnight = addDays(today, 14)
  const coming = () => (department ? [] : view.jobs.jobs.filter((j) => !STOPPED.includes(j.status) && !(j.span && j.span.end < today)))
  const stepsOf = (jobs: readonly View['jobs']['jobs'][number][]) => jobs.map((j) => view.steps.of(j.id)).filter((s): s is JobSteps => !!s)
  const faults = () => view.faults.open.filter((f) => by.kit(f.model?.department))
  const tests = () => view.inspections.attention.filter((d) => by.kit(d.asset.model?.department))
  const lists: { [K in StandingKey]: () => Standing[K] } = {
    late: () => view.late.toCheck.filter((n) => by.person(n.person)),
    answers: () => [
      ...view.documents.toCheck.filter((d) => by.person(d.person)),
      ...(department ? [] : calendarAnswersToSortOut(view, today)),
      ...answersToCheck(view.crew, today).filter((a) => by.person(a.offer.person)),
    ],
    'crew-needed': () =>
      view.crew.calls.filter(
        (c) => c.status === 'open' && c.end >= today && c.start <= fortnight && c.openDays.some((d) => d >= today) && (!department || sameDepartment(departmentOf(c), department)),
      ),
    timesheets: () => view.timesheets.toApprove.filter((r) => by.person(r.person) && !r.amountsHidden),
    leave: () => view.leave.queue.filter((q) => q.person?.id !== me?.id),
    certificates: () => runningOut(view.crew.people, view.documents.all, today).filter((r) => by.person(r.person)),
    'to-pick': () => view.moves.soon.filter((p) => p.job.span && p.job.span.start <= addDays(today, 1) && p.out < p.need),
    'still-out': () => (department ? [] : kitToCheckBackIn(view.jobs, view.steps, view.moves, today)),
    'kit-short': () => view.kit.short.filter((l) => by.kit(l.model?.department) && l.hold === 'held' && l.held && l.held.start <= fortnight),
    faults,
    'damaged-stopped': () => faults().filter((f) => f.kind === 'damaged' && f.stops),
    'cant-go': () => tests().filter((d) => d.state !== 'soon'),
    'tests-soon': () => tests().filter((d) => d.state === 'soon'),
    vehicles: () => view.vehicles.reminders,
    counts: () => view.counts.week.due,
    'tasks-late': () => stepsOf(coming()).filter((s) => s.steps.some((t) => t.late)),
    'tasks-nobody': () => stepsOf(coming()).filter(nobodySoon),
    'no-answer': () =>
      department
        ? []
        : stepsOf(view.jobs.jobs)
            .filter((s) => s.lapsed)
            .sort((a, b) => (b.job.span?.start ?? '').localeCompare(a.job.span?.start ?? '') || b.job.name.localeCompare(a.job.name)),
    // Empty on a device that isn't sent money (ADR 0042), which has no quotes to count.
    quotes: () => (department ? [] : quotesToFollow(view.money, today).chase),
  }
  const kept: Partial<Standing> = {}
  const out = {} as Standing
  for (const key of Object.keys(lists) as StandingKey[])
    Object.defineProperty(out, key, { enumerable: true, get: () => (kept[key] ??= lists[key]() as never) })
  return out
}
