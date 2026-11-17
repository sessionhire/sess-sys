import type { Offer, OfferStatus } from './crew.ts'
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

/**
 * An offer cancelled along with its job (ADR 0164), as the office reads it: nobody withdrew it, and once the job is going
 * again its person may be asked again, beside this row.
 */
export const STOPPED_WITH_JOB_WORDS = ['Cancelled with the job', 'cancelled'] as const satisfies readonly [string, WordTone]

/** An offer's state as the office reads it, one cancelled along with its job said so. */
export const offerWords = (o: Pick<Offer, 'status' | 'stoppedOn'>): readonly [string, WordTone] =>
  o.status === 'cancelled' && o.stoppedOn ? STOPPED_WITH_JOB_WORDS : OFFER_WORDS[o.status]

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

/**
 * HOLD is short for "hold the day" (Colly, 12 November 2026; ADR 0150): the ask to keep a day free for a job the client
 * hasn't said yes to yet. It is never the job that is "on hold". The title of a day on the calendar and the job's name
 * on WhatsApp lead with HOLD; wherever a line explains it, or a person reads where they stand on such a job, it is said
 * in these words: the invite, their page, the call sheet and the office's own messages.
 */
export const HOLD_WORDS = {
  /** Where they stand, in place of Booked, once the office has picked them for a job the client hasn't agreed. */
  name: 'Hold the day',
  /** Under a day's title on the calendar, which starts HOLD. An invite is for one day. */
  onCalendar: "HOLD means hold the day: the client hasn't said yes yet, so please keep it free. Nothing is booked until they do.",
  /** To someone who has said yes or been picked, about the `days` they have. */
  toYou: (days: number) => `Hold the day: the client hasn't said yes yet, so please keep ${days === 1 ? 'it' : 'your days'} free. Nothing is booked until they do.`,
  /** What it means, straight under a pill that already reads "Hold the day", so it isn't said twice. */
  means: (days: number) => `The client hasn't said yes yet, so please keep ${days === 1 ? 'the day' : 'your days'} free. Nothing is booked until they do.`,
  /** Under an offer still waiting on their answer. */
  asked: (days: number) =>
    `Hold the day: the client hasn't said yes yet. A yes from you means you'll keep ${days === 1 ? 'the day' : 'your days'} free; nothing is booked until the client says yes.`,
  /** On the office's own sheet for the day. */
  toOffice: "Hold the day: the client hasn't said yes yet. Crew are asked to keep it free, and nothing is booked until they do.",
} as const

/**
 * Where someone stood on an offer of theirs before a change: asked (answered yes or not yet), booked, or picked to hold
 * the day on a job the client hasn't said yes to yet (ADR 0150).
 */
export type OfferStanding = 'asked' | 'booked' | 'hold'

/** What someone else's change did to a person's own offer, for the sentence that tells them (`offerNews`). */
export type OfferNews =
  | { kind: 'offered' }
  | { kind: 'booked'; hold: boolean; theirRate: boolean }
  | { kind: 'rate-not-agreed' }
  | { kind: 'withdrawn'; was: OfferStanding }
  | { kind: 'call-cancelled'; was: OfferStanding }
  | { kind: 'job-stopped'; job: 'cancelled' | 'lost'; was: OfferStanding }
  | { kind: 'filled'; taker: string | null }
  | { kind: 'job-confirmed' }

/**
 * Someone else's change to a person's own offer, said to them (audit of 12 November 2026, finding 17): on their
 * notifications, first, where the history names them as anyone else would ("Confirmed Aoife Byrne for…", "Withdrew the
 * offer of … to Aoife Byrne"). Booked and "Hold the day" in the words their invite, their page and Home use (ADR 0150), and
 * a job confirmed while they hold the day is their booking. Someone else's yes that filled the call was the first of these
 * (audit of 5 November 2026, finding 61).
 */
export function offerNews(n: OfferNews, role: string, project: string): string {
  const what = `${role} on ${project}`
  // What's over for them, ending a sentence, naming the role where the sentence hasn't.
  const over = (was: OfferStanding, named?: string) =>
    was === 'booked'
      ? `you're no longer booked${named ? ` as ${named}` : ''}`
      : was === 'hold'
        ? `you no longer need to hold the day${named ? ` for ${named}` : ''}`
        : `your offer${named ? ` of ${named}` : ''} is closed`
  switch (n.kind) {
    case 'offered':
      return `You've been offered ${what}`
    case 'booked':
      return n.hold ? `${HOLD_WORDS.name}: you're down as ${what}` : `You're booked as ${what}${n.theirRate ? ', at the rate you asked for' : ''}`
    case 'rate-not-agreed':
      return `Your rate for ${what} wasn't agreed, so the offer stands at the rate offered`
    case 'withdrawn':
      return n.was === 'booked' ? `You're no longer booked as ${what}` : n.was === 'hold' ? `You no longer need to hold the day for ${what}` : `Your offer of ${what} was withdrawn`
    case 'call-cancelled':
      return `${what} was cancelled, so ${over(n.was)}`
    case 'job-stopped':
      return `${project} ${n.job === 'lost' ? "didn't go ahead" : 'was cancelled'}, so ${over(n.was, role)}`
    case 'filled':
      return n.taker ? `${what} went to ${n.taker}, so your offer is closed` : `${what} is filled, so your offer is closed`
    case 'job-confirmed':
      return `${project} is confirmed, so you're booked as ${role}`
  }
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
 * Whose a task is when nobody is named on it: the role that does it, from the one table (UX sweep, 6 November 2026,
 * move 12). "For the warehouse (nobody named)." A default nobody has to set, said the same on the task card and in
 * the task filter's words.
 */
export const ownerByRole = (step: JobStep) => `For ${STEP_OWNERS[step]} (nobody named).`

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
