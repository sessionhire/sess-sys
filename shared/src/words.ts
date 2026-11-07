import type { OfferStatus } from './crew.ts'
import type { JobStep } from './steps.ts'

/**
 * The app's words for the states people meet on more than one surface, written once (UX sweep, 6 November 2026,
 * move 4). The pills, the call sheet, the freelancer's page, the dock and the "not yours" sentences read from here,
 * so a word met in one place is the word met in every other. Keys and wire names never change with them, and
 * history rows keep the words they were recorded with.
 *
 * - A crew booking is **Booked** on every surface, the office's and the crew's; **Confirmed** is only the client's
 *   yes and the job status it sets (ADR 0103).
 * - **Waiting** is never bare: waiting for approval, on the office, on you, to sync.
 * - A list of calls without their people is **Still needs crew**; "n short" is the count where crew is the subject.
 * - Lists split by time say **Coming up**, **Past** and **Not going ahead**.
 */

/** The office's tone for a state, as the status pill draws it: someone has to act, settled, off or over, or bad. */
export type WordTone = 'pending' | 'confirmed' | 'cancelled' | 'bad'

/** An offer's state as the office reads it, on Calls, a person's page and Home, with its pill's tone. */
export const OFFER_WORDS: Record<OfferStatus, readonly [string, WordTone]> = {
  offered: ['Offered', 'pending'],
  countered: ['Asked for more', 'pending'],
  accepted: ['To confirm', 'pending'],
  confirmed: ['Booked', 'confirmed'],
  declined: ['Declined', 'cancelled'],
  filled: ['Filled by someone else', 'cancelled'],
  cancelled: ['Withdrawn by the office', 'cancelled'],
  'pulled-out': ["Can't make it", 'cancelled'],
}

/** The same states as the person they were offered to reads them on their own page: a sentence where the office reads a word. */
export const OFFER_WORDS_TO_YOU: Record<OfferStatus, string> = {
  offered: 'Waiting on you',
  countered: 'Rate sent to the office',
  accepted: 'Accepted, the office will confirm',
  confirmed: OFFER_WORDS.confirmed[0],
  declined: 'You declined',
  filled: OFFER_WORDS.filled[0],
  cancelled: OFFER_WORDS.cancelled[0],
  'pulled-out': OFFER_WORDS['pulled-out'][0],
}

/** A crew member's state on a call sheet, which lists only those offered, holding or booked. */
export const SHEET_WORDS = {
  booked: OFFER_WORDS.confirmed,
  'to confirm': OFFER_WORDS.accepted,
  offered: [OFFER_WORDS.offered[0], 'cancelled'],
} as const satisfies Record<string, readonly [string, WordTone]>

/** A leave request's state: approved is settled, the rest waits on whoever approves. */
export const LEAVE_WORDS = { approved: 'Approved', waiting: 'Waiting for approval', declined: 'Declined', cancelled: 'Cancelled' } as const

/** The one name for the calls that still need people, as a heading, a list and a filter. */
export const STILL_NEEDS_CREW = 'Still needs crew'

/** The groups a list splits into by time, the same on every list that splits so. */
export const TIME_GROUPS = { coming: 'Coming up', past: 'Past', stopped: 'Not going ahead' } as const

/** Who does each of a job's tasks, as the dock, the task card and the "not yours" sentence name them. */
export const STEP_OWNERS: Record<JobStep, string> = {
  quote: 'the office',
  confirmed: 'the office',
  crew: 'the office and heads of department',
  kit: 'the heads of department',
  prep: 'the warehouse',
  show: 'the crew on it',
  back: 'the warehouse',
  deprep: 'the warehouse',
}

/** What each task is, said as the act its owner does: "The warehouse scans the kit back." */
const STEP_ACTS: Record<JobStep, string> = {
  quote: 'makes and sends the quote',
  confirmed: "hears the client's answer",
  crew: 'book the crew',
  kit: 'settle the kit and the vans',
  prep: 'picks and loads the kit',
  show: 'do the job',
  back: 'scans the kit back',
  deprep: 'checks and depreps the kit',
}

const sentence = (who: string, what: string) => `${who.charAt(0).toUpperCase()}${who.slice(1)} ${what}.`

/** Someone else's task, in one sentence a person can read and leave: "The warehouse scans the kit back." */
export const whoDoes = (step: JobStep) => sentence(STEP_OWNERS[step], STEP_ACTS[step])

/**
 * The "not yours" sentences for whole views a role reads but doesn't do (UX sweep, 6 November 2026, move 4): one
 * shape, the owner first and the act after, so no screen invents its own. An action that was tried and refused keeps
 * roles.ts's refusal, which says how a role changes.
 */
export const NOT_YOURS = {
  vans: 'The heads of department book the vans.',
  counts: 'The warehouse and heads of department do the counts.',
  quotes: 'The office and directors do the quotes.',
  scanning: 'The warehouse scans kit out and back here.',
  timesheets: "You send yours from your own page, once a booking's days are done.",
} as const

/** What a hidden detail says, in states.md's words: the reader's role isn't sent it. */
export const HIDDEN_FOR_YOUR_ROLE = 'Hidden for your role'

/** A department named both ways where its crew name and its stock name differ: "LX (Lighting)". */
export const bothNames = (crew: string, stock: string | undefined) => (stock && stock.trim().toLowerCase() !== crew.trim().toLowerCase() ? `${crew} (${stock})` : crew)
