import { STOPPED_WORDS } from './jobs.ts'
import { namesInWords } from './reach.ts'

/**
 * Stopping a job, said before it's pressed (the cancel form; Colly, 27 November 2026). Marking a job cancelled or lost
 * sets off more than its status: its crew calls are cancelled and the people on them see it, its kit and vehicles are
 * free for other jobs again, its days come off the calendar and its quote stops counting. The form says each in a line,
 * only what's true of this job and in the words the job's own tabs use, so the press is made knowing what it does; and
 * what can and can't be taken back after.
 *
 * The words are here, apart from the screen, so they're tested as sentences. What they're made from is read off the
 * device's own view (web/src/jobs/jobStatus.ts): nothing here asks the server.
 */

/** The two ways a job stops. */
export const STOP_STATUSES = ['cancelled', 'lost'] as const
export type StopStatus = (typeof STOP_STATUSES)[number]

/** Each as a choice, under the status's own word: what it is, in a line. */
export const STOP_ABOUT: Record<StopStatus, string> = {
  cancelled: 'It was called off.',
  lost: 'The client said no or went elsewhere.',
}

/** A reason of each kind, as the example in the box: only ever an example. */
export const STOP_WHY_EXAMPLE: Record<StopStatus, string> = {
  cancelled: 'e.g. The venue double-booked',
  lost: 'e.g. Went with a cheaper PA',
}

/** Where the reason goes, said under its box before anything is typed: its one audience. */
export const STOP_WHY_HINT = 'Kept at the top of the office notes: only in the app, for the office.'

/** The reason is one line of the office notes. */
export const STOP_WHY_LENGTH = 300

/** What the press is called: cancelling is the act itself, and lost is a word a job is marked with. */
export const STOP_BUTTON: Record<StopStatus, string> = { cancelled: 'Cancel the job', lost: 'Mark lost' }

/** What's true of a job that stopping it changes. */
export interface StopFacts {
  status: StopStatus
  /** Its crew calls still open. */
  calls: number
  /** Everyone offered or booked on them, by name, each once. */
  people: readonly string[]
  /** What Google emails them and WhatsApp tells them, as `jobEndingWords` says it without its "and why": '' when the app sends nothing. */
  sends: string
  /**
   * Its kit for days not yet over: how many come from our own stock, and whether they're held (a confirmed job's, or a
   * sent quote's) or only pencilled in; how many more are hired in for it (subhired, or dry hire stock), and from whom.
   * And how many are out with the job now.
   */
  kit?: { own: number; held: boolean; out: number; hiredIn: number; suppliers: readonly string[] }
  /** The vehicles booked for it and not yet back, by name, and whether they're held or pencilled in. */
  vehicles?: { names: readonly string[]; held: boolean }
  /** Its days from today on the jobs calendar; or the calendar it was brought in from, which keeps its own days. */
  calendar?: { on: string; days: number } | { theirs: string }
  /** Its quote that counts, once one has gone to the client: invoiced or not. */
  quote?: 'sent' | 'invoiced'
}

export interface StopLine {
  key: 'crew' | 'kit' | 'transport' | 'calendar' | 'quote'
  text: string
  /** It reaches people, or leaves the office something to do: said in amber. */
  warn?: true
}

/** How many names are said before "and 12 more": a festival's crew is a paragraph otherwise, and the panel after lists everyone. */
const NAMES_SAID = 6

const are = (n: number) => (n === 1 ? 'is' : 'are')
const count = (n: number) => n.toLocaleString('en-IE')
/** What was held for the job, in the words its Kit and Transport tabs use once it's stopped; and what was only pencilled in. */
const FREE = 'free for other jobs again'
const UNPENCILLED = 'no longer pencilled in'

/** "Aoife Brennan and Tommo Daly", or the first five "and 12 more". */
function someNames(names: readonly string[]): string {
  if (names.length <= NAMES_SAID) return namesInWords(names)
  return namesInWords([...names.slice(0, NAMES_SAID - 1), `${count(names.length - NAMES_SAID + 1)} more`])
}

/** What stopping the job does, a line for each part of it that changes, the people first. Nothing for a job with nothing on it. */
export function stopLines(f: StopFacts): StopLine[] {
  const out: StopLine[] = []

  if (f.calls > 0) {
    const calls = `Its ${f.calls === 1 ? 'crew call is' : `${count(f.calls)} crew calls are`} cancelled.`
    if (f.people.length) {
      // Who sees what, in their link's own words, then how it reaches them. With nothing sent, that is said too: the links are all they have.
      const sends = f.sends || ` The app sends them nothing: their ${f.people.length === 1 ? 'link says' : 'links say'} so whenever they open ${f.people.length === 1 ? 'it' : 'them'}.`
      out.push({ key: 'crew', warn: true, text: `${calls} ${someNames(f.people)} will see ${STOPPED_WORDS[f.status]}.${sends}` })
    } else out.push({ key: 'crew', text: `${calls} Nobody is offered or booked on ${f.calls === 1 ? 'it' : 'them'}, so nobody is told.` })
  }

  const kit = f.kit
  if (kit && (kit.own > 0 || kit.out > 0 || kit.hiredIn > 0)) {
    const said: string[] = []
    const items = (n: number) => (n === 1 ? '1 item of kit is' : `${count(n)} items of kit are`)
    // Ours: free for other jobs again, as its Kit tab says of a stopped job.
    if (kit.own > 0) said.push(`Its ${items(kit.own)} ${kit.held ? FREE : UNPENCILLED}.`)
    // Kit already out with the job stays out until it's scanned back: stopping the job doesn't bring it home.
    if (kit.out > 0) said.push(`${said.length ? `${count(kit.out)} ${are(kit.out)}` : items(kit.out)} already out and still ${kit.out === 1 ? 'needs' : 'need'} checking back in.`)
    // A supplier hears nothing from the app, so the hire with them is the office's to cancel.
    if (kit.hiredIn > 0) {
      const from = kit.suppliers.length ? ` from ${namesInWords(kit.suppliers)}` : ''
      const these = kit.own > 0 ? `${count(kit.hiredIn)} more ${are(kit.hiredIn)}` : `Its ${items(kit.hiredIn)}`
      said.push(`${these} hired in${from}: the app doesn't tell ${kit.suppliers.length ? 'them' : 'the supplier'}, so cancel ${kit.hiredIn === 1 ? 'it' : 'those'} yourself.`)
    }
    out.push({ key: 'kit', text: said.join(' '), ...(kit.out > 0 || kit.hiredIn > 0 ? { warn: true as const } : {}) })
  }

  const names = f.vehicles?.names ?? []
  if (names.length) out.push({ key: 'transport', text: `${namesInWords(names)} ${are(names.length)} ${f.vehicles!.held ? FREE : UNPENCILLED}.` })

  if (f.calendar) {
    if ('theirs' in f.calendar) out.push({ key: 'calendar', text: `It stays on ${f.calendar.theirs}: the app doesn't change the calendar a job was brought in from.` })
    else if (f.calendar.days > 0) out.push({ key: 'calendar', text: `Its ${f.calendar.days === 1 ? 'day comes' : `${count(f.calendar.days)} days come`} off ${f.calendar.on}.` })
  }

  if (f.quote === 'sent') out.push({ key: 'quote', text: "Its quote is set aside, so it counts in no totals unless it's invoiced." })
  if (f.quote === 'invoiced') out.push({ key: 'quote', text: 'Its quote is invoiced, so it still counts in the totals.' })

  return out
}

/** For a job with nothing on it: said in place of the lines, so the press is as certain as one with a list. */
export const STOP_NOTHING = 'Only its status changes: nobody is told, and no kit or transport is held for it.'

/**
 * Under the lines: the way back, and the one thing that has none. A job set going again offers its crew calls back in
 * one press, with nobody offered and the same people picked in each call's Offer (ADR 0164): nothing goes to them until
 * the office asks again.
 */
export function stopAfterWords(f: Pick<StopFacts, 'calls' | 'people'>): string {
  const again = 'It can be taken up again under Change details'
  const calls = `its crew ${f.calls === 1 ? 'call' : 'calls'} brought back`
  if (f.people.length) return `${again}, and ${calls} with the same people picked, ready to ask again. What they've already been told can't be taken back.`
  if (f.calls > 0) return `${again}, and ${calls} in one press.`
  return `${again}.`
}

/** The line the reason is kept in, first in the office notes: "Cancelled Fri 27 Nov: the venue double-booked". */
export function stopNote(label: string, day: string, why: string, notes: string | null | undefined): string {
  const reason = why.trim()
  return [`${label} ${day}${reason ? `: ${reason}` : ''}`, notes ?? ''].filter(Boolean).join('\n').slice(0, 4000)
}
