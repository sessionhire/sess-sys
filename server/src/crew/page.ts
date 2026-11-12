import { dayLabel, daysLabel, eachDay, euro, firstName, HOLDING, irishClock, noTimesheetReason, timesheetDue, timesheetTotal, type TimesheetAsking, type CrewCall, type Offer, type Person, type Timesheet, type Unavailability } from '@sh/shared'
import { bookingLine, FACT_GAP, glanceParts, leaveLabel, nextBooking, nextDayOf, soonestFirst, wholeFact, type BookingOf, type GlancePart, type LeaveRequest } from '@sh/shared'
import { LATE_BY, LATE_BY_LABELS, LATE_NOTE_LENGTH, lateDayWord, lateLine, needsLabel, needsOf, officeContact, telHref, type OfficeDetails, type RunningLate } from '@sh/shared'
import { dsColor, dsSize, dsSpace, dsText, newId, ownColours } from '@sh/shared'
import { busyByDay, ENDED_WORDS, HOLD_WORDS, isNews, LEAVE_WORDS, OFFER_WORDS_TO_YOU, type OwnCalendar, type SinceYes } from '@sh/shared'
import type { Ended, EndedBy } from './store.ts'

/**
 * The freelancer's private page. Plain server-rendered HTML with ordinary
 * forms: it works on any phone, in any in-app browser (WhatsApp, Gmail),
 * with no app, no login and no JavaScript. The one exception is the Copy
 * button beside the calendar address, which needs a few lines of script
 * and stays hidden without them.
 */

export const h = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** "Wed 30 Sep", in Ireland, from a timestamp; with its year when that isn't plain from today (audit, 20 October 2026, finding 89). */
const onDay = (iso: string, today: string) => dayLabel(new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' }), today)

/** The message after a post, and the offer it's about, when it's about one: it goes in that card. Or the section it's about. */
export interface Flash {
  ok: boolean
  text: string
  offer?: string
  /** Their details, the running-late card for the offer (ADR 0028), their documents (ADR 0029), their days off, or their own calendar (ADR 0044). */
  section?: 'details' | 'late' | 'documents' | 'away' | 'calendar'
  /**
   * A refusal about one field, said under it rather than at the top of the card or section (audit, 20 October 2026,
   * finding 90): an offer's rate or days, a day off's first or last day, their mobile, their calendar's address, or a
   * document's file or the day it runs out.
   */
  field?: 'rate' | 'days' | 'start' | 'end' | 'phone' | 'address' | 'file' | 'expires'
  /** Or, on a timesheet, one extra, by its place among those filled in. */
  extra?: number
}

/**
 * Where a refused post's page lands (rule 11). A form whose refusal can be about one of its fields posts to an address
 * ending in #refused, and the page drawn again with the refusal gives that id to the field it's about, or to the
 * refusal itself when it's about the whole form: a browser opens a page at the place its address names, with no
 * script (ADR 0002).
 */
export const REFUSED = 'refused'
/** The id that marks where a refused post's page lands, on the place it's given to when `here` is. */
export const landing = (here: string | boolean | undefined) => (here ? ` id="${REFUSED}"` : '')

/** A refusal about one field, under it and joined to it, in the bad wash, as the app's refusal line and the design system's invalid state are (audit, 20 October 2026, finding 90). */
export const fieldError = (id: string, text: string) => `<p class="field-error" id="${id}" role="alert">${h(text)}</p>`
/** The attributes a field takes while a refusal is about it: described by its hint, if it has one, and the refusal. */
export const invalid = (id: string, hint?: string) => ` aria-invalid="true" aria-describedby="${hint ? `${hint} ${id}` : id}"`
/** A page's title, which starts "Error: " while the page says a refusal, so it's the first thing a screen reader says (GOV.UK's error summary). */
export const titled = (title: string, f?: { ok: boolean }) => (f && !f.ok ? `Error: ${title}` : title)

/**
 * What a refused post typed (rule 11), drawn back into the form it came
 * from so nothing is lost: an offer's card ("offer:<id>"), a running-late
 * card ("late:<offer>"), their details, or the days-off form.
 */
export interface Kept {
  form: string
  values: URLSearchParams
}

/** What was typed into one form, when that's the form a refused post came from. */
const keptIn = (d: Pick<PageData, 'kept'>, form: string) => (d.kept?.form === form ? d.kept.values : undefined)

/** A booking on a day they can say they're running late for (ADR 0028): today, and tomorrow from 6pm. */
export interface OnTheDay {
  offer: Offer
  call: CrewCall
  /** The days it can be said for now, today first. */
  days: string[]
  /** What they've said for those days. */
  said: RunningLate[]
  /** Who's running the day, to ring if the page won't send; never themselves. */
  contact: { name: string; phone: string | null } | null
}

/** The message after a post. A refusal is an alert, so it's read out and looks like one, and a refused post's page lands on it; a thank-you is a status. */
export const flash = (f: { ok: boolean; text: string }) => `<p class="flash ${f.ok ? 'ok' : 'bad'}" role="${f.ok ? 'status' : 'alert'}"${landing(!f.ok)}>${h(f.text)}</p>`

/**
 * The way back to the office (audit finding 10), on every page: the phone
 * and email as links a phone taps. Nothing until the office sets them on
 * Admin.
 */
export function officeBlock(o: OfficeDetails | null | undefined): string {
  const c = officeContact(o)
  if (!c) return ''
  const parts = [
    h(c.name),
    c.phone && `<a href="${h(telHref(c.phone))}">${h(c.phone)}</a>`,
    c.email && `<a href="mailto:${h(c.email)}">${h(c.email)}</a>`,
  ].filter(Boolean)
  return `<p class="office">${parts.join(' · ')}</p>`
}

export interface PageData {
  person: Person
  /**
   * Each offer with its call, the days still open on it, and the days this person holds on another job, by the job's name.
   * `hold`: the client hasn't said yes to its job yet, so they're asked to hold the day, and nothing on it reads "Booked" (ADR 0150).
   */
  jobs: { offer: Offer; call: CrewCall; openDays: string[]; busy: Record<string, string>; hold?: boolean }[]
  away: Unavailability[]
  base: string
  /** The read-only calendar feed address (ADR 0012), safe to add to a shared calendar. */
  feed: string
  flash?: Flash
  /** What a refused post typed, to draw back into its form. */
  kept?: Kept
  today: string
  /** The moment the page is drawn for, `today` being its day in Ireland: what's still news on it is read against this one instant. */
  now: Date
  /** When and how each withdrawn or filled offer ended, by offer: a booking that ended says so on its card, and the rest in "Offers that ended". */
  ended: ReadonlyMap<string, Ended>
  /** What changed on each booking since its person said yes, by offer, while it's news (UX sweep, 6 November 2026, move 6); none where nothing did. */
  since?: ReadonlyMap<string, SinceYes>
  /** Their timesheets (ADR 0022), by booking. */
  timesheets: ReadonlyMap<string, Timesheet>
  /** The day the office paid each approved timesheet, by its booking, where it has said. */
  paid?: ReadonlyMap<string, string>
  /** The company doesn't use timesheets (ADR 0090): none asked for, none shown. */
  noTimesheets?: boolean
  /** Which bookings they're asked for a timesheet for (ADR 0110), while the company uses them. */
  asking?: TimesheetAsking
  /** The office's phone and email, once set. */
  office?: OfficeDetails | null
  /** Bookings on today, or tomorrow from 6pm, for "Running late?" (ADR 0028). */
  onTheDay?: OnTheDay[]
  /** "Your documents" (ADR 0029), drawn by server/src/documents/page.ts. */
  documents?: string
  /** On the demo copy (ADR 0033): a bar saying this is a freelancer's page, with the way back to choosing another view. */
  demo?: boolean
  /** Their own calendar, when they share it (ADR 0044): never its address, which the page doesn't show again. */
  ownCalendar?: OwnCalendar
  /** How many requests on the purchase list are still to decide or to buy (ADR 0108); absent, the way to it isn't drawn. */
  purchases?: number
  /**
   * Crew invites are on (ADR 0009) and they have an email address: a day they're offered also comes as a Google
   * Calendar invite, `from` the connected account, `to` their address. Google holds back the first invite from a sender
   * someone hasn't been in touch with ("unknown sender") until they press Add to calendar, so the page says so, under
   * the `offers` an invite has gone for: not every offer gets one (audit of 12 November 2026, finding 1).
   */
  invites?: { from: string; to: string; offers: ReadonlySet<string> }
  /** Offers on WhatsApp (ADR 0125), once the office sends them to this person's mobile: whether theirs go, and to what number. */
  whatsapp?: PageWhatsApp
  /** A member of staff's leave still to come, approved or waiting (ADR 0024); absent for a freelancer, whose time off is days off. */
  leave?: LeaveRequest[]
}

/** Offers on WhatsApp on their page (ADR 0125): whether they get them, and the number they go to, as they wrote it. */
export interface PageWhatsApp {
  on: boolean
  to: string
}

/** An offer's state as its person reads it, from the one word table (UX sweep, 6 November 2026, move 4): a booking is Booked here as in the office. */
const STATUS_TEXT: Record<Offer['status'], string> = OFFER_WORDS_TO_YOU

/**
 * Where an offer stands, as its pill. On a job the client hasn't said yes to yet, someone the office has picked is asked
 * to hold the day: "Booked" there, beside an invite titled HOLD, told them the day was theirs (audit of 12 November
 * 2026, finding 6; ADR 0150). In the tone of what isn't settled yet, as an accepted offer is.
 */
const standing = (j: Pick<PageData['jobs'][number], 'offer' | 'hold'>) =>
  j.hold && j.offer.status === 'confirmed' ? `<span class="tag hold">${HOLD_WORDS.name}</span>` : `<span class="tag ${j.offer.status}">${STATUS_TEXT[j.offer.status]}</span>`

/**
 * What holding the day means, on the card of an offer or a booking on such a job: before they answer, what a yes agrees
 * to; under the pill that reads "Hold the day", only what it means.
 */
const holdLine = (j: Pick<PageData['jobs'][number], 'offer' | 'call' | 'hold'>) => {
  if (!j.hold) return ''
  const { status, days } = j.offer
  const says = status === 'offered' || status === 'countered' ? HOLD_WORDS.asked(eachDay(j.call.start, j.call.end).length) : status === 'confirmed' ? HOLD_WORDS.means(days.length) : HOLD_WORDS.toYou(days.length)
  return `<p class="hold-line">${h(says)}</p>`
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Where their answer stands, where the page alone wouldn't say it (ADR 0152): the days they haven't answered yet after a
 * Yes in Google Calendar to others, which their invites still ask about; and a rate they asked for that the office said
 * no to, with the offer standing at the rate offered.
 */
const answerLine = (j: Pick<PageData['jobs'][number], 'offer'>, staff: boolean, today: string) => {
  const { offer } = j
  if (offer.status === 'accepted' && offer.asked?.length) {
    const it = offer.asked.length === 1 ? 'it' : 'them'
    return `<p class="small">You haven't answered for ${h(daysLabel(offer.asked, today))} yet. Tick ${it} if you can do ${it}, or leave ${it} unticked, and press Update my days.</p>`
  }
  if (offer.status === 'offered' && offer.counterRateCents !== null && !staff)
    return `<p class="news">The office can't do ${h(euro(offer.counterRateCents))} a day, so the offer stands at ${h(offer.dayRateCents === null ? 'the rate the office sets' : `${euro(offer.dayRateCents)} a day`)}.</p>`
  return ''
}

/**
 * How a booking ended on the office's side, as its card's first line and in "Offers that ended" (UX sweep, 6
 * November 2026, move 6): the client's cancelling, a job that didn't go ahead and the office taking someone off are three
 * different news, and "Withdrawn", the office's word for the last, said all three. A stopped job's words are the ones
 * the office's question before stopping it says they'll see.
 */
const ENDED_TEXT: Record<EndedBy, string> = ENDED_WORDS

/**
 * The way out of a job they said yes to (audit finding 10), folded away so
 * it's never pressed by accident: a note and one button, in a form of its
 * own so the day picker and the rate stay out of it. "Can't make it" on the
 * fold, the button, the pill after and the office's pill, one name for it on
 * both sides (UX sweep, 6 November 2026, move 6).
 */
function pullOut(d: PageData, action: string) {
  const phone = officeContact(d.office)?.phone
  return `<details class="pull-out"><summary>Can't make it?</summary>
      <form method="post" action="${action}">
        <p class="small">Tell us as soon as you can, so we can find cover.${phone ? ` Ringing ${h(phone)} is quickest.` : ''}</p>
        <label>Why, if you like <textarea name="note" rows="2" maxlength="1000"></textarea></label>
        <button class="no" name="answer" value="pullOut">Can't make it</button>
      </form>
    </details>`
}

/**
 * Turning an offer down (rule 1): it can't be taken back from here, so it's
 * folded away as "Can't make it" is, never a tap beside Accept. Any note
 * typed above goes with it.
 */
function decline(call: CrewCall) {
  return `<details class="decline"><summary>Can't do this one?</summary>
        <p class="small">Once declined, it's off your page: only the office can offer it to you again.</p>
        <button class="no" name="answer" value="decline">Decline ${h(call.project)}</button>
      </details>`
}

/** Staff are paid through payroll, so their page carries no rate (audit finding 21). */
const isStaff = (p: Pick<Person, 'kind'>) => p.kind === 'staff'

/**
 * What one of a booking's watched facts was when they said yes, in brackets after it as it is now, "07:30 (was 09:00)",
 * while the change is news (UX sweep, 6 November 2026, move 6): in the attention tone, as it needs a look, and in words,
 * so it doesn't rest on the colour.
 */
const was = (then: string | undefined) => (then === undefined ? '' : ` <span class="was">(was ${h(then)})</span>`)

/** A change to a booking that can't be said as now and was: plainly, with no bracket, rather than a guess. */
const UNCLEAR = 'Changed since you said yes · check the call'

function facts(call: CrewCall, offer: Offer, staff: boolean, today: string, since?: SinceYes) {
  const rate = offer.status === 'countered' ? `${euro(offer.counterRateCents)} a day asked (offered ${euro(offer.dayRateCents)})` : `${euro(offer.dayRateCents)}${offer.dayRateCents !== null ? ' a day' : ''}`
  const then = since?.was
  return `<dl class="facts">
    <dt>Role</dt><dd>${h(call.role)}</dd>
    <dt>Dates</dt><dd>${h(daysLabel(offer.status === 'offered' ? eachDay(call.start, call.end) : offer.days, today))}${was(then?.days && daysLabel(then.days, today))}</dd>
    ${call.callTime ? `<dt>Call time</dt><dd>${h(call.callTime)}${was(then?.callTime)}</dd>` : ''}
    ${call.venue ? `<dt>Venue</dt><dd><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(call.venue)}">${h(call.venue)}</a>${was(then?.venue)}</dd>` : ''}
    ${needsOf(call).length ? `<dt>Needs</dt><dd>${h(capital(needsLabel(needsOf(call))))}</dd>` : ''}
    ${staff ? '' : `<dt>Rate</dt><dd>${h(rate)}</dd>`}
    ${call.replyBy && offer.status === 'offered' ? `<dt>Reply by</dt><dd>${h(dayLabel(call.replyBy, today))}</dd>` : ''}
  </dl>
  ${call.details ? `<p class="details">${h(call.details).replace(/\n/g, '<br>')}</p>` : ''}`
}

function offerCard(d: PageData, job: PageData['jobs'][number]) {
  const { offer, call, openDays, busy } = job
  const days = eachDay(call.start, call.end)
  // A refusal drawn at this address lands on what it's about: the field, or its line at the top of the card.
  const action = `${d.base}/offers/${encodeURIComponent(offer.id)}#${REFUSED}`
  // What a refused answer typed, back in place of what's saved (rule 11).
  const typed = keptIn(d, `offer:${offer.id}`)
  const title = `${h(call.project)}${call.phase ? ` <span>${h(call.phase)}</span>` : ''}`
  // Someone who said yes can still change their days; on a one-day job there is nothing to change.
  const canAnswer = offer.status === 'offered' || offer.status === 'countered' || (offer.status === 'accepted' && days.length > 1)
  // Staff are paid through payroll (audit finding 21): no rate to ask for, only a note to go with the answer.
  const staff = isStaff(d.person)
  // The page lands on the card after an answer, so the answer's message is in the card, not off the top of the screen.
  // One about the rate or the days goes under that field where the card draws it, and at the top of the card where it
  // doesn't: a page sent from before the office confirmed the booking has days to tick that this one has no form for.
  const mine = d.flash?.offer === offer.id && !d.flash.section ? d.flash : undefined
  // What changed since they said yes, while it's news (UX sweep, 6 November 2026, move 6).
  const since = d.since?.get(offer.id)
  const rateError = mine?.field === 'rate' && canAnswer && !staff ? `rate-error-${h(offer.id)}` : undefined
  const daysError = mine?.field === 'days' && canAnswer && days.length > 1 ? `days-error-${h(offer.id)}` : undefined
  // Someone who said yes gives the place back with "Can't make it", not Decline.
  const holding = (offer.status === 'accepted' || offer.status === 'confirmed') && call.status === 'open'
  // A day they hold on another job is never ticked for them, and says so (audit finding 21), so the clash is seen before the server refuses it.
  const dayPicker =
    days.length > 1
      ? `<input type="hidden" name="picker" value="1"><fieldset class="days"${daysError ? ` aria-describedby="${daysError}"${landing(true)}` : ''}><legend>Your days</legend>${days
          .map((day) => {
            const open = openDays.includes(day) || (offer.status === 'accepted' && offer.days.includes(day))
            const checked = typed ? typed.getAll('days').includes(day) : (offer.status === 'offered' ? open : offer.days.includes(day)) && !busy[day]
            const note = !open ? 'filled' : busy[day] ? `booked on ${h(busy[day])}` : ''
            return `<label class="${open ? '' : 'gone'}"><input type="checkbox" name="days" value="${day}"${checked ? ' checked' : ''}${open ? '' : ' disabled'}> <span class="day">${h(dayLabel(day, d.today))}</span>${note ? ` <small>${note}</small>` : ''}</label>`
          })
          .join('')}</fieldset>${daysError && mine ? fieldError(daysError, mine.text) : ''}`
      : ''
  // Enter (or a phone keyboard's Go) in the rate field presses the form's first button. This one, so it's never Accept: the server sends the rate, or asks for a tap.
  // Drawn out of sight rather than hidden: Safari before 16.4 passes over a hidden button and presses the next, which is Accept.
  const onEnter = `<button class="on-enter" name="answer" value="implicit" tabindex="-1" aria-hidden="true"></button>`
  // A one-day job has no days to pick, so a clash with another job is said in words before the server has to say it.
  const clash = days.length === 1 && canAnswer && busy[days[0]!] ? `<p class="clash">You're booked on ${h(busy[days[0]!])} that day.</p>` : ''
  // After a counter, sending a rate is what they're doing, and Accept says what it agrees to (audit, 20 October 2026, finding 6):
  // a plain Accept under "Rate sent to the office" read as accepting their own rate, and booked them at the one offered.
  const countered = offer.status === 'countered' && !staff
  const offered = offer.dayRateCents ?? call.dayRateCents
  const these = days.length > 1 ? 'Accept these days' : 'Accept'
  const accept =
    offer.status === 'accepted' ? 'Update my days' : countered ? `${these} at ${offered === null ? 'the rate the office sets' : `${euro(offered)} a day`} instead` : these
  return `<article class="offer ${offer.status}${job.hold ? ' hold' : ''}" id="o-${h(offer.id)}">
    ${mine && !rateError && !daysError ? flash(mine) : ''}
    <header><h3>${title}</h3>${standing(job)}</header>
    ${holdLine(job)}
    ${answerLine(job, staff, d.today)}
    ${since?.unclear ? `<p class="news">${h(UNCLEAR)}</p>` : ''}
    ${facts(call, offer, staff, d.today, since)}
    ${clash}
    ${holding ? `<a class="sheet-link" href="${d.base}/sheet/${encodeURIComponent(call.id)}">Call sheet: who's on, where, and who to ring ›</a>` : ''}
    ${
      canAnswer
        ? `<form method="post" action="${action}">
      ${onEnter}
      ${dayPicker}
      <div class="buttons one">
        <button${countered ? '' : ' class="yes"'} name="answer" value="accept">${accept}</button>
      </div>
      <details${offer.status === 'countered' || rateError || typed?.get('rate')?.trim() || (typed?.get('note') ?? '') !== '' ? ' open' : ''}><summary>${staff ? 'Add a note for the office' : 'Ask for a different rate or add a note'}</summary>
        <div class="fold">
        ${
          // The euro is drawn in the box, before the number, as the app's quote does, and is in the field's name too, since what's drawn beside a field isn't read out with it.
          staff
            ? ''
            : `<label${landing(rateError)}>Day rate you'd do it for<span class="sr-only">, €</span> <span class="unit-box"><span class="unit" aria-hidden="true">€</span><input name="rate" inputmode="decimal"${rateError ? invalid(rateError) : ''} value="${h(typed ? (typed.get('rate') ?? '') : offer.status === 'countered' && offer.counterRateCents !== null ? (offer.counterRateCents / 100).toString() : '')}"></span></label>${rateError && mine ? fieldError(rateError, mine.text) : ''}`
        }
        <label>Note for the office <textarea name="note" rows="2" maxlength="1000">${h(typed ? (typed.get('note') ?? '') : offer.note)}</textarea></label>
        ${staff ? '<p class="small">It goes with your answer.</p>' : `<button${countered ? ' class="yes"' : ''} name="answer" value="counter">Send rate</button>`}
        </div>
      </details>
      ${holding ? '' : decline(call)}
    </form>`
        : ''
    }
    ${holding ? pullOut(d, action) : ''}
  </article>`
}

/** A booking, or an offer waiting on them, that ended on the office's side, and how, while that's news. */
type Ending = PageData['jobs'][number] & { end: Ended }

/**
 * A booking that ended on the office's side, in its place among their bookings while that's news (UX sweep, 6 November
 * 2026, move 6), and an offer that was waiting on them, in its place among their offers (ADR 0153): how it ended as the
 * card's first line, in its heading with the job, so moving through the page by its headings hears it too; then the
 * row's line. Nothing to answer or open.
 */
function endedCard(d: PageData, j: PageData['jobs'][number], end: Ended) {
  const { offer, call } = j
  const mine = d.flash?.offer === offer.id && !d.flash.section ? d.flash : undefined
  return `<article class="offer ended" id="o-${h(offer.id)}">
    ${mine ? flash(mine) : ''}
    <h3><span class="news">${h(ENDED_TEXT[end.by])}</span> ${h(call.project)}</h3>
    <p class="small">${h(bookingLine(offer, call, d.today))}</p>
  </article>`
}

/**
 * Today's work (ADR 0028), or tomorrow's from 6pm: at the top, since on the
 * day it's what they open the page for, with "Running late?" folded away
 * as "Can't make it" is. Sending needs signal, so the form says who to
 * ring if it won't go.
 */
function onTheDay(d: PageData): string {
  const list = d.onTheDay ?? []
  if (!list.length) return ''
  const heading = list.some((t) => t.days.includes(d.today)) ? 'Today' : 'Tomorrow'
  return `<section class="today" id="today"><h2>${heading}</h2>${list.map((t) => todayCard(d, t)).join('')}</section>`
}

function todayCard(d: PageData, t: OnTheDay): string {
  const { offer, call } = t
  const mine = d.flash?.section === 'late' && d.flash.offer === offer.id ? d.flash : undefined
  const late = t.said.filter((l) => !l.arrivedAt)
  const there = t.said.filter((l) => l.arrivedAt)
  // The call time and venue with what they said yes to, and a change that can't be said that way, as on the booking's card, so the two never disagree.
  const since = d.since?.get(offer.id)
  const then = since?.was
  const facts = [h(call.role), call.callTime && `call ${h(call.callTime)}${was(then?.callTime)}`, call.venue && `${h(call.venue)}${was(then?.venue)}`].filter(Boolean).join(' · ')
  const office = officeContact(d.office)
  const ring = t.contact?.phone ? { name: t.contact.name, phone: t.contact.phone } : office?.phone ? { name: 'the office', phone: office.phone } : null
  // With two days open (the evening of one booked day before another), each line says which day it's for.
  const which = (day: string) => (t.days.length > 1 ? ` for ${h(lateDayWord(day, d.today))}` : '')
  return `<article class="offer today-card" id="late-${h(offer.id)}">
    ${mine ? flash(mine) : ''}
    <header><h3>${h(call.project)}${call.phase ? ` <span>${h(call.phase)}</span>` : ''}</h3><span class="tag confirmed">${h(capital(t.days.map((x) => lateDayWord(x, d.today)).join(' and ')))}</span></header>
    ${since?.unclear ? `<p class="news">${h(UNCLEAR)}</p>` : ''}
    <p class="small">${facts}</p>
    <a class="sheet-link" href="${d.base}/sheet/${encodeURIComponent(call.id)}">Call sheet: who's on, where, and who to ring ›</a>
    ${late
      .map(
        (l) => `<p class="late-said">You've told us${which(l.day)}: ${h(lateLine(l))}.</p>
    <form method="post" action="${d.base}/late/here"><input type="hidden" name="id" value="${h(l.id)}"><button class="yes">I'm here now</button></form>`
      )
      .join('')}
    ${there.map((l) => `<p class="small">You've told us you're there${which(l.day)}. Thanks.</p>`).join('')}
    <details class="late"${mine && !mine.ok ? ' open' : ''}><summary>${late.length ? 'Change how late' : 'Running late?'}</summary>
      ${lateForm(d, t, late.at(-1), ring)}
    </details>
  </article>`
}

/** Roughly how late, or the time they'll be there, and a note; filled in with what they said last, to change it. */
function lateForm(d: PageData, t: OnTheDay, last: RunningLate | undefined, ring: { name: string; phone: string } | null): string {
  // What a refused post typed, back in place of what was said last (rule 11).
  const typed = keptIn(d, `late:${t.offer.id}`)
  const day =
    t.days.length > 1
      ? `<fieldset class="choice"><legend>Which day</legend>${t.days
          .map((x, i) => `<label><input type="radio" name="day" value="${h(x)}"${(typed?.get('day') ? typed.get('day') === x : i === 0) ? ' checked' : ''}> ${h(capital(lateDayWord(x, d.today)))}, ${h(dayLabel(x))}</label>`)
          .join('')}</fieldset>`
      : `<input type="hidden" name="day" value="${h(t.days[0])}">`
  const by = typed ? typed.get('by') : last?.by
  // Red marks the one thing to do next: with a late start already said, that's "I'm here now", so Send for a change is plain.
  return `<form method="post" action="${d.base}/late#late-${h(t.offer.id)}">
        <input type="hidden" name="offer" value="${h(t.offer.id)}">
        ${day}
        <fieldset class="choice"><legend>Roughly how late</legend>${LATE_BY.map(
          (b) => `<label><input type="radio" name="by" value="${h(b)}"${by === b ? ' checked' : ''}> ${h(LATE_BY_LABELS[b])}</label>`
        ).join('')}</fieldset>
        <label>Or the time you'll be there <input type="time" name="at" value="${h(typed ? typed.get('at') : (last?.arriveAt ?? ''))}"></label>
        <label>Note, if you like <input name="note" maxlength="${LATE_NOTE_LENGTH}" value="${h(typed ? typed.get('note') : (last?.note ?? ''))}" placeholder="e.g. traffic on the M50"></label>
        <p class="small">Sending this needs signal.${ring ? ` If it won't go, ring ${h(ring.name)} on <a href="${h(telHref(ring.phone))}">${h(ring.phone)}</a>.` : ''}</p>
        <button${last ? '' : ' class="yes"'}>Send</button>
      </form>`
}

/** Bookings whose timesheet is to send, sent, or lately approved: to send first. */
/**
 * "Work done" (UX sweep, 6 November 2026, move 6b): one list of the work that's over, or whose timesheet is out, from
 * the days through to paid, in place of Timesheets and Past work, which drew one job twice with two words. Each row is
 * the job's line with where it stands third: "Send your days and extras ›", "Sent €200, with the office ›", "Approved
 * €263, not paid yet ›", "Paid Sat 31 Oct, €200 ›". With timesheets off (ADR 0090) the rows carry only the days, so the
 * page is ready for the switch and costs nothing now. The ones to send come first, then the latest; the first few
 * show and the rest fold under "Earlier (n)".
 */
function workDone(d: PageData, past: PageData['jobs']): string {
  const rows = new Map<string, { j: PageData['jobs'][number]; t?: Timesheet }>()
  for (const j of past) rows.set(j.offer.id, { j })
  if (!d.noTimesheets)
    for (const j of d.jobs) {
      const t = d.timesheets.get(j.offer.id)
      if (t || noTimesheetReason(j.offer, j.call, d.person, d.today, d.asking) === null) rows.set(j.offer.id, { j, ...(t ? { t } : {}) })
    }
  if (!rows.size) return ''
  const toSend = (r: { j: PageData['jobs'][number]; t?: Timesheet }) =>
    !d.noTimesheets && !r.t && noTimesheetReason(r.j.offer, r.j.call, d.person, d.today, d.asking) === null
  const sorted = [...rows.values()].sort((a, b) => Number(toSend(b)) - Number(toSend(a)) || b.j.call.start.localeCompare(a.j.call.start))
  const line = ({ j, t }: { j: PageData['jobs'][number]; t?: Timesheet }) => {
    const { offer, call } = j
    const what = `${h(call.project)}${call.phase ? ` (${h(call.phase)})` : ''} · ${h(call.role)} · ${h(daysLabel(offer.days, d.today))}`
    const href = `${d.base}/timesheet/${encodeURIComponent(offer.id)}`
    if (d.noTimesheets || (!t && !toSend({ j }))) return `<li>${what} <small>${h(offer.status === 'confirmed' ? OFFER_WORDS_TO_YOU.confirmed : 'Accepted, never confirmed')}</small></li>`
    const paidOn = t ? d.paid?.get(t.id) : undefined
    const state = !t
      ? 'Send your days and extras ›'
      : t.status === 'sent'
        ? `Sent ${euro(timesheetTotal(t).total)}, with the office ›`
        : paidOn
          ? `Paid ${dayLabel(paidOn, d.today)}, ${euro(timesheetTotal(t).total)} ›`
          : `Approved ${euro(timesheetTotal(t).total)}, not paid yet ›`
    return `<li><a class="${!t ? 'to-send' : paidOn ? 'paid' : t.status}" href="${href}">${what} <small>${h(state)}</small></a></li>`
  }
  return `<section id="timesheets"><h2>Work done</h2>${overList(sorted.map(line))}</section>`
}
/** The next booking is in the Today card when it's on there, and under Your bookings otherwise. */
const nextHref = (d: PageData, offerId: string) => ((d.onTheDay ?? []).some((t) => t.offer.id === offerId) ? '#today' : '#bookings')
/** A booking on the page as the shared order reads one (UX sweep, 6 November 2026, move 6): its offer and its call. */
const asBooking: BookingOf<PageData['jobs'][number]> = (j) => [j.offer, j.call]

/**
 * What's waiting on them and what's next, in one line at the top, each part
 * a link down the page (ADR 0033): a long page says what matters before
 * anyone scrolls, and it stays at the top of the screen while they do
 * (audit, 20 October 2026, finding 48). Nothing when there's nothing to say.
 * In the words Home › Me says it in too (UX sweep, 6 November 2026, move 6).
 */
function glance(d: PageData, waiting: PageData['jobs'], booked: PageData['jobs']): string {
  // Counted from the evening of the booking's last day (ADR 0110), not while they're still on site; the list below still lets them send it.
  const clock = irishClock()
  const toSend = d.noTimesheets
    ? 0
    : d.jobs.filter((j) => !d.timesheets.get(j.offer.id) && noTimesheetReason(j.offer, j.call, d.person, d.today, d.asking) === null && timesheetDue(j.offer.days, d.today, clock)).length
  const next = nextBooking(booked, d.today, asBooking)
  const parts = glanceParts(
    { offers: waiting.length, timesheets: toSend, ...(next ? { next: { project: next.booking.call.project, callTime: next.booking.call.callTime, day: next.day } } : {}) },
    d.today
  )
  const at: Record<GlancePart['key'], string> = { offers: '#offers', timesheets: '#timesheets', next: next ? nextHref(d, next.booking.offer.id) : '#bookings' }
  return parts.length ? `<nav class="glance" aria-label="At a glance">${parts.map((p) => `<a href="${at[p.key]}">${h(p.text)}</a>`).join('<span aria-hidden="true"> · </span>')}</nav>` : ''
}

/**
 * Their own phone, to fix themselves (audit finding 7), and the email the
 * office has, which only the office changes: it's how an account finds a
 * person (audit finding 12). Folded away until wanted, and open with the
 * message after they save.
 */
function details(d: PageData): string {
  const mine = d.flash?.section === 'details' ? d.flash : undefined
  // What a refused save typed, back in place of what's saved (rule 11), and a refusal of the number said under it.
  const typed = keptIn(d, 'details')
  const wrong = mine?.field === 'phone' ? 'phone-error' : undefined
  // The way to write it is a hint under the label, read with the field, rather than words after it.
  return `<section class="me">
    <details id="details"${mine ? ' open' : ''}>
      <summary><h2>Your details</h2></summary>
      ${mine && !wrong ? flash(mine) : ''}
      <form method="post" action="${d.base}/details#${REFUSED}">
        <p class="small">You're down as <b>${h(d.person.name)}</b>${d.person.email ? `, with the email <b>${h(d.person.email)}</b>` : ''}. Ask the office to change your name or email; your number you can fix here.</p>
        <div class="field"${landing(wrong)}><label for="phone">Mobile</label>
          <small class="hint" id="phone-hint">Write your mobile with the country code, +353 for Ireland, so WhatsApp messages and texts reach you.</small>
          <input type="tel" id="phone" name="phone"${wrong ? invalid(wrong, 'phone-hint') : ' aria-describedby="phone-hint"'} value="${h(typed ? typed.get('phone') : (d.person.phone ?? ''))}" maxlength="40" placeholder="e.g. +353 87 123 4567" autocomplete="tel"></div>
        ${wrong && mine ? fieldError(wrong, mine.text) : ''}
        <button>Save my number</button>
      </form>
      ${whatsappForm(d)}
    </details>
  </section>`
}

/**
 * Offers on WhatsApp (ADR 0125): on until they say otherwise (Colly, 9 November 2026), and theirs to turn off or back on
 * here. Under their number, since that's where they go.
 */
function whatsappForm(d: PageData): string {
  const w = d.whatsapp
  if (!w) return ''
  const said = w.on
    ? `New offers come to <b>${h(w.to)}</b> on WhatsApp as well as here, with buttons to say yes or no. Only offers and changes to your bookings, nothing else.`
    : `You turned off offers on WhatsApp. They still come here, and the office may still message you itself.`
  return `<form method="post" action="${d.base}/whatsapp#details" class="whatsapp">
        <h3>Offers on WhatsApp</h3>
        <p class="small">${said}</p>
        <input type="hidden" name="on" value="${w.on ? 'no' : 'yes'}">
        <button>${w.on ? 'Stop offers on WhatsApp' : 'Send my offers on WhatsApp'}</button>
      </form>`
}

/**
 * How an offer in "Offers that ended" ended, and the day it did: when they answered, or when it ended on the
 * office's side, in the words its card says it in.
 */
function ended(o: Offer, end: Ended | undefined, today: string): string {
  const on = (iso: string | null | undefined) => (iso ? ` on ${onDay(iso, today)}` : '')
  switch (o.status) {
    case 'declined':
      return `You declined${on(o.respondedAt)}`
    // The one name for it on both sides (UX sweep, 6 November 2026, move 6), with the day they told us.
    case 'pulled-out':
      return `Can't make it: you told us${on(o.respondedAt)}`
    case 'cancelled':
    case 'filled': {
      const how = ENDED_TEXT[end?.by ?? (o.status === 'filled' ? 'filled' : 'withdrawn')]
      // "As of", so the day it was known isn't read as the job's own day.
      return end?.by === 'job-lost' ? `${how}, as of ${onDay(end.at, today)}` : `${how}${on(end?.at)}`
    }
    // The job went by while the office still had their rate to decide on.
    case 'countered':
      return "Your rate wasn't agreed"
    default:
      return 'Not answered'
  }
}

/** What's over shows its latest three, as bookings show their next three; the rest fold, never cut off (UX sweep, 6 November 2026, move 6). */
const OVER_SHOWN = 3

/** One list of what's over, latest first: the first few, and the rest under "Earlier (n)", shut until opened. */
function overList(lines: readonly string[]): string {
  const rest = lines.slice(OVER_SHOWN)
  return `<ul class="closed">${lines.slice(0, OVER_SHOWN).join('')}</ul>${
    rest.length ? `<details class="later"><summary><b>Earlier (${rest.length})</b></summary><ul class="closed">${rest.join('')}</ul></details>` : ''
  }`
}

/** One line of "Past work" or "Offers that ended": the job, the role, the days, and how it ended. */
function earlierLine(j: PageData['jobs'][number], how: string, today: string): string {
  const { call, offer } = j
  const days = HOLDING.includes(offer.status) ? offer.days : eachDay(call.start, call.end)
  return `<li>${h(call.project)}${call.phase ? ` (${h(call.phase)})` : ''} · ${h(call.role)} · ${h(daysLabel(days, today))} <small>${h(how)}</small></li>`
}

/**
 * The Copy button's script, the one script on any of these pages. The pages' content security policy lets in this
 * script by its hash and no other (audit finding 24), so it is kept exactly as it is here.
 */
export const COPY_SCRIPT = `
    (function () {
      var field = document.getElementById('feed'), copy = document.querySelector('.copy')
      field.addEventListener('focus', function () { field.select() })
      if (!navigator.clipboard) return
      copy.hidden = false
      copy.addEventListener('click', function () {
        // Where the browser won't copy after all, the address is selected for copying by hand.
        navigator.clipboard.writeText(field.value).then(function () { copy.textContent = 'Copied' }, function () { field.focus(); field.select() })
      })
    })()
    `

/**
 * The calendar feed address (ADR 0012), in a field that can be copied by
 * hand on any phone, with Subscribe for the calendar apps that take a
 * webcal: link and Copy where the browser can copy. The Copy button is the
 * page's one piece of script: it stays hidden until the script has run
 * and found a clipboard to write to.
 */
function feedBlock(feed: string): string {
  // Set up once, so folded to a line (UX sweep, 6 November 2026, move 6b): the address is needed the day it's added, not on every visit.
  return `<details class="later feed-fold"><summary><b>Your calendar feed</b><span class="line">Your bookings in your own calendar app</span></summary><div class="feed">
      <p class="small">Put your bookings in your calendar, kept up to date. It shows your bookings and what each pays, so share it only with people you'd tell that to. If our Google Calendar invites already reach you, you don't need it as well.</p>
      <label>Calendar address <input id="feed" readonly value="${h(feed)}"></label>
      <div class="feed-buttons"><a class="button" href="${h(feed.replace(/^https?:/, 'webcal:'))}">Subscribe</a><button type="button" class="copy" hidden>Copy address</button></div>
      <p class="small">On a phone, Subscribe adds it to your calendar app. Google Calendar can't take it on a phone: copy the address and add it on a laptop, under Other calendars, From URL.</p>
    </div></details>
    <script>${COPY_SCRIPT}</script>`
}

/** How long a list of busy days the page shows: the next few are what someone checks. */
const BUSY_SHOWN = 8

/** Where each calendar keeps the address to share, in the words its own settings use. */
const WHERE_TO_FIND = `<details class="where"><summary>Where do I find it?</summary>
      <ul>
        <li><b>Google Calendar</b>, on a laptop: Settings, then your calendar's name on the left, then <i>Integrate calendar</i>. Copy the <i>Secret address in iCal format</i>.</li>
        <li><b>Outlook</b>: Settings, Calendar, <i>Shared calendars</i>, then <i>Publish a calendar</i>. Pick <i>Can view when I'm busy</i>, publish, and copy the ICS link.</li>
        <li><b>iPhone or Mac (iCloud)</b>: in Calendar, the <i>i</i> beside the calendar, then turn on <i>Public Calendar</i> and share the link. Anyone with it can see the calendar, so keep it to us.</li>
      </ul>
    </details>`

/**
 * Their own calendar, read only (ADR 0044): share it by pasting its
 * private address, see what we read from it, and stop in one tap. What is
 * kept is said plainly before anything is pasted: only when they're busy,
 * never what, where or who with, and nothing is ever written to it.
 */
function ownCalendarBlock(d: PageData): string {
  const mine = d.flash?.section === 'calendar' ? d.flash : undefined
  // What a refused share typed, back in the field (rule 11): it's their own page, kept from every cache. Why it was refused is said under it.
  const typed = keptIn(d, 'calendar')
  const wrong = mine?.field === 'address' ? 'address-error' : undefined
  const cal = d.ownCalendar
  // Its button is plain, never the red fill (audit, 20 October 2026, finding 92): the fill marks the thing to do next,
  // answering, arriving or sending, and sharing a calendar is something asked of them, not their next step.
  const field = (label: string, button: string) => `<form method="post" action="${d.base}/calendar#${REFUSED}" class="share-cal">
      <label${landing(wrong)}>${label} <input name="address" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="2000" placeholder="e.g. webcal://… or https://….ics"${wrong ? invalid(wrong) : ''} value="${h(typed?.get('address'))}"></label>${wrong && mine ? fieldError(wrong, mine.text) : ''}
      ${WHERE_TO_FIND}
      <button>${button}</button>
    </form>`
  const promise = 'We keep only the times you\'re busy: never what, where or who with. Nothing is ever added to your calendar, and Session Hire bookings in it aren\'t counted.'
  // Set-once prose folded to its state (UX sweep, 6 November 2026, move 6b), open on its own when there's news in it.
  const fold = (state: string, open: boolean) =>
    `<section id="calendar" class="me"><details${open || mine || typed ? ' open' : ''}><summary><h2>Let us see when you're busy</h2> <span class="line">${h(state)}</span></summary>`
  if (!cal)
    return `${fold('Not shared', false)}
    ${mine && !wrong ? flash(mine) : ''}
    <p class="small">${
      // A member of staff marks no days here: their time off is leave, asked for in the app (UX sweep, 6 November 2026, move 6).
      isStaff(d.person) ? 'You can' : 'Rather than marking days here, you can'
    } let us see when you're busy in the calendar you already use, so the office knows before it asks. ${promise} You can stop at any time.</p>
    ${field("Your calendar's private address", "Share when I'm busy")}
  </details></section>`
  const busy = [...busyByDay(cal)].filter(([day]) => day >= d.today)
  const read = cal.readAt ? (new Date(cal.readAt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' }) === d.today ? 'today' : `on ${onDay(cal.readAt, d.today)}`) : ''
  return `${fold(cal.problem ? "Shared, but we couldn't read it last time" : `Shared${busy.length ? `, ${busy.length === 1 ? '1 busy day' : `${busy.length} busy days`} ahead` : ''}`, !!cal.problem)}
    ${mine && !wrong ? flash(mine) : ''}
    <p class="small">You're sharing when you're busy${cal.addedBy === 'office' ? ', from the address you sent the office' : ''}. We read it every few hours${read ? `, last ${read}` : ''}. ${promise} The office sees "busy" on those days: you can still be offered work, and still say yes.</p>
    ${cal.problem ? `<p class="flash warn" role="status">We couldn't read it last time: ${h(cal.problem)} What we read before still shows.</p>` : ''}
    ${
      busy.length
        ? `<ul class="away busy">${busy
            .slice(0, BUSY_SHOWN)
            .map(([day, words]) => `<li><span>${h(dayLabel(day, d.today))} <small>Busy ${h(words)}</small></span></li>`)
            .join('')}</ul>${busy.length > BUSY_SHOWN ? `<p class="small">And ${busy.length - BUSY_SHOWN} more busy day${busy.length - BUSY_SHOWN === 1 ? '' : 's'} in the next four months.</p>` : ''}`
        : '<p class="empty">Nothing busy in the next four months.</p>'
    }
    <form method="post" action="${d.base}/calendar/stop#calendar"><button>Stop sharing my calendar</button></form>
    <details class="again"${typed ? ' open' : ''}><summary>Share a different calendar</summary>
      ${field('Its private address', 'Share this one instead')}
    </details>
  </details></section>`
}

/**
 * "Since you said yes" (UX sweep, 6 November 2026, move 6b): one line for each booking the office changed or ended while
 * it's news, above the bookings, each a link to its card. Drawn only when there's something to say, so the glance line
 * keeps its three parts and a quiet week adds nothing to the page. Nothing is sent: the page reads differently the next
 * time it's opened.
 */
function sinceYes(d: PageData, booked: PageData['jobs'], ending: readonly Ending[]): string {
  const lines: string[] = []
  for (const j of soonestFirst(booked, d.today, asBooking)) {
    const since = d.since?.get(j.offer.id)
    if (!since) continue
    const was = since.was
    const parts = [
      was.callTime !== undefined && j.call.callTime ? `call ${j.call.callTime} (was ${was.callTime})` : '',
      was.days ? `${daysLabel(j.offer.days, d.today)} (was ${daysLabel(was.days, d.today)})` : '',
      was.venue !== undefined && j.call.venue ? `at ${j.call.venue} (was ${was.venue})` : '',
    ].filter(Boolean)
    const what = parts.length && !since.unclear ? parts.join(', ') : 'changed: check the call'
    lines.push(`<li><a href="#o-${h(j.offer.id)}"><b>${h(j.call.project)}</b> ${h(what)} ›</a></li>`)
  }
  for (const j of ending) lines.push(`<li><a href="#o-${h(j.offer.id)}"><b>${h(j.call.project)}</b> ${h(ENDED_TEXT[j.end.by].toLowerCase())} ›</a></li>`)
  return lines.length ? `<section id="since" class="since"><h2>Since you said yes</h2><ul class="since-list">${lines.join('')}</ul></section>` : ''
}

/** How many of the next bookings are drawn as full cards; the rest are a line each, opening in place. */
const BOOKINGS_IN_FULL = 3

/**
 * A booking or an offer folded to its row, the row Home › Me and their own page in the app draw (UX sweep, 6 November
 * 2026, move 6): the job, then role · phase · days · call, and anything more the row needs, then where it stands.
 */
const laterRow = (d: PageData, j: PageData['jobs'][number], more = '') =>
  `<summary><b>${h(j.call.project)}</b><span class="line">${h(bookingLine(j.offer, j.call, d.today))}${more} ${standing(j)}</span></summary>`

/**
 * With crew invites on (ADR 0009): each day offered also comes as a Google Calendar invite, and the first one from the
 * office may arrive marked as from an unknown sender, not yet in their calendar, until they press Add to calendar
 * (Fergal's first invite, 11 November 2026). Said once, under the offers, so the first invite isn't taken for spam.
 */
function invitesNote(d: PageData): string {
  if (!d.invites) return ''
  return `<p class="small invites-note">We also send a Google Calendar invite for each day to ${h(d.invites.to)}, from ${h(d.invites.from)}. If the first one says it's from an unknown sender, press <b>Add to calendar</b>: after that, they go straight into your calendar.</p>`
}

/**
 * The offers waiting on them, the soonest to answer first: the first few as full cards, the rest a line each with the
 * reply-by day, opening in place with its answers, as bookings are (audit, 5 November 2026, findings 32 and 53). One a
 * message or a refused answer is about opens, so the page lands on it.
 */
function offers(d: PageData, waiting: PageData['jobs']): string {
  // Its first day still to come, or the call's first once the days it holds are over, as the soonest to answer.
  const firstDay = (j: PageData['jobs'][number]) => nextDayOf(j.offer, j.call, d.today) ?? j.call.start
  const answerBy = (j: PageData['jobs'][number]) => j.call.replyBy ?? firstDay(j)
  const sorted = [...waiting].sort((a, b) => answerBy(a).localeCompare(answerBy(b)) || firstDay(a).localeCompare(firstDay(b)))
  const later = sorted.slice(BOOKINGS_IN_FULL)
  return `${sorted.slice(0, BOOKINGS_IN_FULL).map((j) => offerCard(d, j)).join('')}${
    later.length
      ? `<p class="small">${later.length === 1 ? 'One more offer' : `${later.length} more offers`} after these, a line each: tap one to answer it.</p>${later
          .map((j) => {
            const about = d.flash?.offer === j.offer.id || d.kept?.form === `offer:${j.offer.id}`
            const by = j.call.replyBy && j.offer.status === 'offered' ? `${FACT_GAP}${h(wholeFact(`reply by ${dayLabel(j.call.replyBy, d.today)}`))}` : ''
            return `<details class="later"${about ? ' open' : ''}>${laterRow(d, j, by)}${offerCard(d, j)}</details>`
          })
          .join('')}`
      : ''
  }`
}

/**
 * Their bookings, soonest first (audit, 20 October 2026, finding 48): the next few as full cards, and the rest folded to
 * one line each, the job, the role, the days and where it stands, opening in place with no script. Forty bookings drawn
 * in full was a thirty-five-screen scroll. One a message or a refused post is about opens, so the page lands on it.
 */
function bookings(d: PageData, booked: PageData['jobs'], ending: readonly Ending[]): string {
  // In the order Home › Me and their page in the app list them (UX sweep, 6 November 2026, move 6).
  const later = soonestFirst(booked, d.today, asBooking).slice(BOOKINGS_IN_FULL)
  const more = `<p class="small">${later.length === 1 ? 'One more booking' : `${later.length} more bookings`} after these, a line each: tap one to open it.</p>`
  // One that ended on the office's side is in its place among them, as their page in the app has it: a card wherever it falls, as it's news.
  return soonestFirst<PageData['jobs'][number] & { end?: Ended }>([...booked, ...ending], d.today, asBooking)
    .map((j) => {
      if (j.end) return endedCard(d, j, j.end)
      if (!later.includes(j)) return offerCard(d, j)
      // Open on its own when a message is about it, or it changed since they said yes (the design system's Disclosure).
      const about = d.flash?.offer === j.offer.id || d.kept?.form === `offer:${j.offer.id}` || d.since?.has(j.offer.id)
      return `${j === later[0] ? more : ''}<details class="later"${about ? ' open' : ''}>${laterRow(d, j)}${offerCard(d, j)}</details>`
    })
    .join('')
}

/**
 * Days off marked over a booking they hold (audit, 20 October 2026, finding 50): said beside the row, since marking
 * themselves away doesn't take them off the job, and the way that does is on the booking. Nothing for approved leave,
 * which the office approved knowing the bookings.
 */
function stillBooked(u: Unavailability, booked: PageData['jobs'], today: string): string {
  if (u.source === 'leave') return ''
  const hits = booked
    .map((j) => ({ j, days: j.offer.days.filter((x) => x >= u.start && x <= u.end) }))
    .filter((x) => x.days.length)
  if (!hits.length) return ''
  const on = hits.map(({ j, days }) => `<a href="#o-${h(j.offer.id)}">${h(j.call.project)}</a> ${days.length === 1 && hits.length === 1 ? 'that day' : `on ${h(daysLabel(days, today))}`}`).join(' and ')
  const which = hits.length === 1 ? 'that booking' : 'each booking'
  return `<p class="clash">You're booked on ${on}. Days off don't take you off it: use Can't make it on ${which}.</p>`
}

/**
 * Add days off: From and Until as a pair, one under the other on a phone and side by side where both fit, then a note.
 * What a refused one typed is back in the form (rule 11), and a refusal about one of the days is said under it. The
 * page lands on the pair, as a refusal of the last day can be about both ("end before they start"): landing on Until
 * alone would leave From, above it on a phone, under the bar at the top.
 */
function awayForm(d: PageData): string {
  const away = keptIn(d, 'away')
  const wrong = d.flash?.section === 'away' ? d.flash.field : undefined
  const day = (name: 'start' | 'end', label: string, required: boolean) => {
    const error = wrong === name ? `away-${name}-error` : undefined
    return `<div><label>${label} <input type="date" name="${name}"${required ? ' required' : ''} min="${d.today}"${error ? invalid(error) : ''} value="${h(away?.get(name))}"></label>${error ? fieldError(error, d.flash!.text) : ''}</div>`
  }
  return `<form method="post" action="${d.base}/away#${REFUSED}" class="add-away">
      <input type="hidden" name="id" value="${newId()}">
      <div class="pair"${landing(wrong === 'start' || wrong === 'end')}>${day('start', 'From', true)}${day('end', 'Until', false)}</div>
      <label>Note (optional) <input name="note" maxlength="500" placeholder="e.g. on tour" value="${h(away?.get('note'))}"></label>
      <button>Add days off</button>
    </form>`
}

/** One run of days off: the days and what's said of them, and Remove, or "Approved leave", which is cancelled in the app. */
function awayLine(d: PageData, u: Unavailability, booked: PageData['jobs'], said: string): string {
  return `<li><span>${h(daysLabel(eachDay(u.start, u.end), d.today))}${said ? ` <small>${h(said)}</small>` : ''}</span>
          ${
            // Approved leave is cancelled in the app, never taken off here, so the two never disagree (ADR 0024).
            u.source === 'leave' ? '<small>Approved leave</small>' : `<form method="post" action="${d.base}/away/${encodeURIComponent(u.id)}/remove#away"><button>Remove</button></form>`
          }${stillBooked(u, booked, d.today)}</li>`
}

/** A freelancer's days they can't work, marked and taken off here, with the form to add more. */
function awayBlock(d: PageData, booked: PageData['jobs']): string {
  return `<section id="away">
    <h2>Days you can't work</h2>
    ${d.flash?.section === 'away' && !d.flash.field ? flash(d.flash) : ''}
    ${
      d.away.length
        ? `<ul class="away">${d.away
            .filter((u) => u.end >= d.today)
            .map((u) => awayLine(d, u, booked, u.note))
            .join('')}</ul>`
        : ''
    }
    ${awayForm(d)}
  </section>`
}

/**
 * A member of staff's time off is their leave (ADR 0024; UX sweep, 6 November 2026, move 6): what's still to come,
 * approved or waiting on a decision, read from the requests, with where each stands in the app's Leave words, and the way
 * to ask for more there, where whoever approves time off sees it. No form: days off marked here went round the approval.
 * Days off marked before, here or by the office, stay to read and take back until they've passed.
 */
function leaveBlock(d: PageData, leave: readonly LeaveRequest[], booked: PageData['jobs']): string {
  const rows = [
    ...leave.map((r) => ({
      start: r.start,
      html: `<li><span>${h(daysLabel(eachDay(r.start, r.end), d.today))} <small>${h([leaveLabel(r.type, r.days), r.note].filter(Boolean).join(' · '))}</small></span><span class="tag ${r.status}">${r.status === 'approved' ? LEAVE_WORDS.approved : LEAVE_WORDS.waiting}</span></li>`,
    })),
    // Approved leave marks its days off too: the request above says it once, with where it stands.
    ...d.away.filter((u) => u.source !== 'leave' && u.end >= d.today).map((u) => ({ start: u.start, html: awayLine(d, u, booked, ['Days off', u.note].filter(Boolean).join(' · ')) })),
  ].sort((a, b) => a.start.localeCompare(b.start))
  return `<section id="away">
    <h2>Leave</h2>
    ${d.flash?.section === 'away' && !d.flash.field ? flash(d.flash) : ''}
    ${rows.length ? `<ul class="away leave">${rows.map((r) => r.html).join('')}</ul>` : '<p class="empty">No leave coming up.</p>'}
    <a class="sheet-link" href="${h(new URL('/#crew/leave', d.base).href)}">Ask for leave in the app ›</a>
  </section>`
}

/** The way to the purchase list (ADR 0108): kit they'd find useful, asked for and voted on from their own link. */
function purchasesBlock(base: string, open: number): string {
  return `<section id="buy">
    <a class="sheet-link" href="${base}/buy">The purchase list${open ? `: ${open} asked for` : ''} ›</a>
    <p class="small">Ask for kit you'd find useful on our jobs, and vote for what others have asked for.</p>
  </section>`
}

/** The way to report broken or missing kit (audit, 5 November 2026, finding 75), as their role allows. */
function brokenBlock(base: string): string {
  return `<section id="broken">
    <h2>Broken or missing kit</h2>
    <a class="sheet-link" href="${base}/broken">Tell the warehouse ›</a>
    <p class="small">So it's checked before it goes out again.</p>
  </section>`
}

export function renderPage(d: PageData): string {
  const current = d.jobs.filter((j) => j.call.end >= d.today && j.call.status === 'open')
  const waiting = current.filter((j) => j.offer.status === 'offered' || j.offer.status === 'countered')
  const booked = current.filter((j) => j.offer.status === 'accepted' || j.offer.status === 'confirmed')
  // Bookings that ended on the office's side, said in their place while that's news, as a change to one is: a week, or until the call.
  const ending: Ending[] = d.jobs.flatMap((j) => {
    const end = d.ended.get(j.offer.id)
    return j.offer.status === 'cancelled' && end?.held && isNews(new Date(end.at), { days: j.offer.days, callTime: j.call.callTime }, d.now) ? [{ ...j, end }] : []
  })
  // Offers that were waiting on them and ended on the office's side, filled, withdrawn or the job stopped, said in their place
  // the same way (ADR 0153; audit of 12 November 2026, finding 8), so the page they open after Google's cancellation says why
  // at the top. Their own No or Can't make it is theirs, and only in the list of what ended.
  const endedWaiting: Ending[] = d.jobs.flatMap((j) => {
    const end = d.ended.get(j.offer.id)
    const days = j.offer.days.length ? j.offer.days : eachDay(j.call.start, j.call.end)
    return (j.offer.status === 'cancelled' || j.offer.status === 'filled') && end && !end.held && isNews(new Date(end.at), { days, callTime: j.call.callTime }, d.now)
      ? [{ ...j, end }]
      : []
  })
  const endingIds = new Set([...ending, ...endedWaiting].map((j) => j.offer.id))
  // Jobs they held that are over, apart from offers that ended another way: declined, withdrawn, filled, can't make it, or never answered. Latest first, all of them.
  const past = d.jobs.filter((j) => !booked.includes(j) && HOLDING.includes(j.offer.status)).reverse()
  const turned = d.jobs.filter((j) => !waiting.includes(j) && !booked.includes(j) && !endingIds.has(j.offer.id) && !HOLDING.includes(j.offer.status)).reverse()
  const first = firstName(d.person)
  // A message about an offer sits in that offer's card, one about their details in that section, one about running late in today's card; any other at the top.
  const inCard =
    d.flash?.section === 'late'
      ? (d.onTheDay ?? []).some((t) => t.offer.id === d.flash?.offer)
      : [...waiting, ...booked, ...ending, ...endedWaiting].some((j) => j.offer.id === d.flash?.offer) || d.flash?.section === 'details' || d.flash?.section === 'documents' || d.flash?.section === 'away' || d.flash?.section === 'calendar'

  return `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#ee3744">
<title>${titled('Session Hire: your work', d.flash)}</title>
<style>${CSS}</style>
</head>
<body>
${d.demo ? `<p class="demo-bar" role="note"><span>Seeing it as <b>a freelancer</b>: ${h(d.person.name)}'s own page</span><a href="/#preview">Choose someone else</a></p>` : ''}
<main>
  <header class="top"><span class="mark">SH</span><div><b>Session Hire</b><h1>Hi ${h(first)}</h1><small>This page is just for you.</small></div></header>
  ${officeBlock(d.office)}
  ${d.flash && !inCard ? flash(d.flash) : ''}

  ${glance(d, waiting, booked)}

  ${onTheDay(d)}

  <section id="offers">
    <h2>Offers waiting on you</h2>
    ${endedWaiting.map((j) => endedCard(d, j, j.end)).join('')}
    ${waiting.length ? offers(d, waiting) : `<p class="empty">Nothing ${endedWaiting.length ? 'else ' : ''}waiting right now.</p>`}
    ${waiting.some((j) => d.invites?.offers.has(j.offer.id)) ? invitesNote(d) : ''}
  </section>

  ${sinceYes(d, booked, ending)}

  <section id="bookings">
    <h2>Your bookings</h2>
    ${bookings(d, booked, ending)}
    ${booked.length ? '' : '<p class="empty">No upcoming bookings.</p>'}
    ${feedBlock(d.feed)}
  </section>

  ${workDone(d, past)}

  ${isStaff(d.person) ? leaveBlock(d, d.leave ?? [], booked) : awayBlock(d, booked)}

  ${ownCalendarBlock(d)}

  ${d.documents ?? ''}

  ${d.purchases === undefined ? '' : purchasesBlock(d.base, d.purchases)}
  ${d.purchases === undefined ? '' : brokenBlock(d.base)}

  ${details(d)}


  ${turned.length ? `<section><h2>Offers that ended</h2>${overList(turned.map((j) => earlierLine(j, ended(j.offer, d.ended.get(j.offer.id), d.today), d.today)))}</section>` : ''}

  <footer>
    <a href="${d.base}/data.json">Download everything we hold on you</a>
    <span>Keep this link to yourself: anyone with it can answer for you. Ask the office for a new one if it gets shared.</span>
  </footer>
</main>
</body>
</html>`
}

/** A link that no longer works, with the office's number and email, once set, so they know who to ask (rule 15). */
export function renderGone(office?: OfficeDetails | null): string {
  return `<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Session Hire</title><style>${CSS}</style></head>
<body><main><header class="top"><span class="mark">SH</span><div><b>Session Hire</b></div></header>
<p class="flash bad">This link doesn't work any more. Ask the office to send you a new one.</p>${officeBlock(office)}<p class="small"><a href="/link">Lost your link?</a></p></main></body></html>`
}

/** Why a member of staff's page didn't open, and what to do (ADR 0052). */
export type StaffSignIn =
  | { why: 'sign-in' | 'cancelled' | 'failed' | 'denied' }
  | { why: 'not-theirs'; as: string }

/**
 * A member of staff's own page asks for their Google account before it
 * opens (ADR 0052): the link alone is no longer enough, as Google is the
 * only way in for staff. One button, which comes back to the page.
 */
export function renderStaffSignIn(name: string, start: string, said: StaffSignIn, office?: OfficeDetails | null): string {
  const first = h(firstName({ name }))
  const line =
    said.why === 'not-theirs'
      ? `<p class="flash warn">You're signed in as ${h(said.as)}, which isn't ${first}'s account. Sign in as ${first}, or ask the office to check the email they have for you.</p>`
      : said.why === 'denied'
        ? `<p class="flash bad">That account can't open Session Hire. Use your Session Hire Google account.</p>`
        : said.why === 'failed'
          ? `<p class="flash bad">Signing in didn't work. Please try again.</p>`
          : said.why === 'cancelled'
            ? `<p class="flash warn">Signing in was stopped before it finished.</p>`
            : ''
  return `<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Session Hire</title><style>${CSS}</style></head>
<body><main><header class="top"><span class="mark">SH</span><div><b>Session Hire</b><small>${first}'s page</small></div></header>
${line}<p>Sign in with your Session Hire Google account to see your calls and your leave. You'll stay signed in on this device.</p>
<a class="button yes" href="${h(start)}">Sign in with Google</a>${officeBlock(office)}</main></body></html>`
}

/**
 * The page's colour names pointed at the shared design system's roles, as
 * web/src/app.css does for the app, written out as values: the page has no
 * stylesheet of its own to import. The red accent and the bad tone are
 * Session Hire's own (shared/src/own-colours.ts).
 */
const roles = (theme: keyof typeof ownColours) => {
  const t = dsColor[theme]
  return Object.entries({
    bg: t.surface.ground,
    panel: t.surface.panel,
    ink: t.ink.primary,
    muted: t.ink.tertiary,
    line: t.line.subtle,
    'field-line': t.line.control,
    good: t.ok.ink,
    'good-soft': t.ok.soft,
    warn: t.warn.ink,
    'warn-soft': t.warn.soft,
    'wash-hover': t.wash.hover,
    'wash-pressed': t.wash.pressed,
    ...ownColours[theme],
  })
    .map(([name, value]) => `--${name}:${value}`)
    .join(';')
}

/**
 * Fields and buttons as the app draws them, from the shared design system's touch density (UX sweep, 6 November 2026,
 * move 5): what's typed is never under 16px, so a phone doesn't zoom the page into a field, and every control is as
 * tall as a thumb.
 */
const FIELD_TEXT = `max(${dsText.touch.field.size}px,1rem)`
const CONTROL = `${dsSize.touch.control}px`
const CONTROL_PAD = `${dsSpace[2]}px ${dsSpace[3]}px`

export const CSS = `
:root{${roles('light')};color-scheme:light;font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
@media (prefers-color-scheme:dark){:root{${roles('dark')};color-scheme:dark}}
@media print{:root{${roles('light')};color-scheme:light}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}
main{max-width:560px;margin:0 auto;padding:max(14px,env(safe-area-inset-top)) 16px 48px;display:grid;gap:18px}
a{color:inherit;text-decoration-color:var(--accent);text-underline-offset:2px}
.top{display:flex;gap:12px;align-items:center}.top b{display:block;text-transform:uppercase;letter-spacing:.03em}.top small{display:block;color:var(--muted)}.top h1{margin:0;font-size:1.25rem;line-height:1.2}
.mark{width:40px;height:40px;border-radius:9px;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:800;flex:none}
h2{font-size:.85rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 8px}
section{display:grid;gap:10px}
.offer{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:12px;padding:14px;display:grid;gap:10px}
.offer.offered{border-left-color:var(--accent)}.offer.confirmed{border-left-color:var(--ink)}.offer.accepted,.offer.countered{border-left-color:var(--warn)}
.office{margin:0;font-size:.92rem;color:var(--muted)}.office a{font-weight:600;white-space:nowrap}
.pull-out summary,.decline summary{color:var(--bad)}.decline[open]{display:grid;gap:8px}.pull-out[open]{display:grid;gap:8px}.tag.pulled-out{background:var(--bad-soft);color:var(--bad)}
.buttons.one{grid-template-columns:1fr}
.offer header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
h3{margin:0;font-size:1.1rem}h3 span{font-weight:500;color:var(--muted)}
.tag{font-size:.75rem;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--line);white-space:nowrap}
.tag.offered{background:var(--accent-fill);color:#fff}.tag.confirmed,.tag.approved{background:var(--line);color:var(--ink)}.tag.accepted,.tag.countered,.tag.waiting,.tag.hold{background:var(--warn-soft);color:var(--warn)}
.facts{display:grid;grid-template-columns:auto 1fr;gap:2px 14px;margin:0}.facts dt{color:var(--muted)}.facts dd{margin:0}
.details{margin:0;padding:10px;background:var(--bg);border-radius:8px;font-size:.92rem}
form{display:grid;gap:10px;margin:0}
fieldset.days{border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px}fieldset.days legend{font-size:.85rem;color:var(--muted);margin-bottom:4px}
fieldset.days label{display:flex;gap:6px;align-items:center;min-height:${CONTROL};padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg)}
fieldset.days label.gone{opacity:.55}fieldset.days label{flex-wrap:wrap}fieldset.days .day{white-space:nowrap}fieldset.days small{flex-basis:100%;padding-left:26px;color:var(--muted)}fieldset.days input{width:20px;height:20px;accent-color:var(--accent)}
.buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px}
button{font:600 1rem system-ui,sans-serif;padding:${CONTROL_PAD};border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;min-height:${CONTROL}}
.on-enter{position:absolute;width:1px;height:1px;min-height:0;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
/* The one thing to do next in a card is the app's primary, the brand red's fill. Giving a job up is quiet, in the bad tone, behind the fold that asks first. */
button.yes,a.button.yes{background:var(--accent-fill);border-color:var(--accent-fill);color:var(--on-accent)}
button.no{background:transparent;border-color:transparent;color:var(--bad)}
details{border-top:1px solid var(--line);padding-top:8px}summary{cursor:pointer;color:var(--muted);font-size:.92rem;padding:11px 0;min-height:44px}
details[open]{display:grid;gap:8px}
/* The fields in a fold, spaced as a form's are: a browser draws what a fold holds as one box, so the fold's own gap falls only under its summary. */
.fold{display:grid;gap:8px}
label{display:grid;gap:4px;font-size:.9rem}input,textarea,select{font:inherit;font-size:${FIELD_TEXT};min-height:${CONTROL};padding:${CONTROL_PAD};border-radius:8px;border:1px solid var(--field-line);background:var(--bg);color:var(--ink);min-width:0;width:100%}
input[type=checkbox],input[type=radio]{min-height:0}fieldset.days input{width:20px}
/* A field with a hint: the hint under the label, read with the field. */
.field{display:grid;gap:4px}.hint{margin:0;color:var(--muted);font-size:.85rem}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
/* A sum with its euro drawn in the box, before it, never typed, as the app's quote draws it. */
.unit-box{display:flex;align-items:center;min-height:${CONTROL};border:1px solid var(--field-line);border-radius:8px;background:var(--bg);color:var(--ink)}
.unit-box .unit{flex:none;padding-inline-start:${dsSpace[3]}px;color:var(--muted);font-size:${FIELD_TEXT}}
.unit-box input{flex:1;min-height:0;border:0;background:transparent;padding-inline-start:${dsSpace[1]}px}
.unit-box input:focus-visible{outline:none}.unit-box:focus-within{outline:2px solid var(--accent);outline-offset:2px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.flash{margin:0;padding:12px 14px;border-radius:10px;font-weight:600}.flash.ok{background:var(--panel);color:var(--ink);border:1px solid var(--line)}.flash.bad{background:var(--bad-soft);color:var(--bad)}.flash.warn{background:var(--warn-soft);color:var(--warn)}
/* A refusal about one field is the app's refusal line, under it: the bad wash, never amber, with the field's edge in the bad tone, drawn twice as heavy inside the box so the field keeps its size beside its pair. */
.field-error{margin:-4px 0 0;padding:${CONTROL_PAD};border-radius:8px;background:var(--bad-soft);color:var(--bad)}input[aria-invalid=true],textarea[aria-invalid=true],.unit-box:has([aria-invalid=true]){border-color:var(--bad);box-shadow:inset 0 0 0 1px var(--bad)}.unit-box input[aria-invalid=true]{box-shadow:none}
.clash,.news,.hold-line{margin:0;padding:10px 12px;border-radius:10px;background:var(--warn-soft);color:var(--warn);font-weight:600}.offer.confirmed.hold{border-left-color:var(--warn)}
/* A booking's change since the yes, "07:30 (was 09:00)", and how one that ended went, as its first line: attention, as each needs a look (UX sweep, 6 November 2026, move 6). */
.was{color:var(--warn);font-weight:600}.offer.ended{border-left-color:var(--warn)}.offer.ended h3 .news{display:block;margin-bottom:10px;font-size:1rem}
.empty,.small{color:var(--muted);margin:0;font-size:.92rem}
.demo-bar{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0;padding:8px 16px;background:var(--ink);color:var(--bg);font-size:.9rem}
.demo-bar a{color:inherit;font-weight:700;white-space:nowrap}
/* A jump down the page (an answer's card, a section) lands under the glance, which sticks at the top: room for it as it wraps on a
   phone to two or three lines, and for one line on a wider screen (audit, 5 November 2026, finding 7). */
html:has(.glance){scroll-padding-top:104px}@media (min-width:600px){html:has(.glance){scroll-padding-top:76px}}
.glance{display:flex;flex-wrap:wrap;gap:4px;font-weight:600;font-size:.95rem;position:sticky;top:0;z-index:1;margin:0 -16px;padding:8px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
details.later{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:0 12px}details.later[open]{padding-bottom:12px}
details.later summary{color:var(--ink);font-size:.95rem;padding:12px 0}details.later summary .tag{margin-left:4px}details.later .offer{border:0;padding:0;background:none}
/* Giving a job up keeps its bad tone inside a folded booking too, where the row's summary rule would draw it in ink. */
details.later :is(.pull-out,.decline) summary{color:var(--bad)}
/* A folded row as the app draws one: the job, then role · phase · days · call under it, then where it stands. */
details.later summary .line{display:block;margin-top:2px;color:var(--muted);font-size:.9rem;text-wrap:pretty}.me summary .line{display:block;margin-top:2px;color:var(--muted);font-size:.9rem;text-wrap:pretty}.since-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.since-list a{display:block;padding:12px;border:1px solid var(--line);border-left:4px solid var(--warn);border-radius:12px;background:var(--panel);color:var(--ink);text-decoration:none}.feed-fold{margin-top:12px}
.glance a{color:inherit}
.feed{display:grid;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}.feed input{color:var(--muted)}
.feed-buttons{display:flex;gap:8px}.feed-buttons>*{flex:1}.feed-buttons .copy[hidden]{display:none}
a.button{display:inline-flex;align-items:center;justify-content:center;min-height:${CONTROL};padding:${CONTROL_PAD};border-radius:8px;border:1px solid var(--line);background:var(--panel);font-weight:600;text-decoration:none}
/* Pressed, and hovered where there's a pointer, as the app's buttons are: a wash over a plain or quiet one, the primary's fill darkened. A quiet
   bad one pressed keeps the lighter wash and takes an edge in its tone, as its words fall under 4.5:1 on the pressed wash. Colour only, so reduced motion has nothing to stop. */
@media (hover:hover){button:not(.yes,.no,[aria-pressed=true]):hover,a.button:not(.yes):hover{background-image:linear-gradient(var(--wash-hover),var(--wash-hover));border-color:var(--field-line)}button.no:hover{background:var(--wash-hover)}button.yes:hover,a.button.yes:hover{filter:brightness(.92)}}
button:not(.yes,.no):active,a.button:not(.yes):active{background-image:linear-gradient(var(--wash-pressed),var(--wash-pressed))}button.no:active{background:var(--wash-hover);border-color:var(--bad)}button.yes:active,a.button.yes:active{filter:brightness(.84)}
.away,.closed{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.away li{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 6px 6px 12px}
/* Leave keeps where it stands, or Remove, at the end of its first line, the days and what's said of them wrapping beside it. */
.away.leave li>span:first-child{flex:1;min-width:0}
.away li .clash{flex-basis:100%;margin-right:6px;font-size:.92rem}.away li button{min-height:44px;padding:6px 10px;font-size:.85rem}.away small,.closed small{color:var(--muted);display:block}
.closed li{font-size:.92rem}
.add-away{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}
/* Two fields that belong together, such as From and Until: one under the other on a phone, side by side where both fit. */
.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12em),1fr));gap:10px}.pair>div{display:grid;gap:10px;align-content:start}
footer{display:grid;gap:6px;font-size:.85rem;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}
.sheet-link{font-weight:600;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);text-decoration:none}
.me details{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:4px 14px}.me details[open]{padding-bottom:14px}
.me summary{padding:10px 0;list-style-position:inside}.me summary h2{display:inline;margin:0}.me form{margin-top:4px}
.ts-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.ts-list a{display:grid;gap:2px;padding:12px 14px;border:1px solid var(--line);border-left:4px solid var(--line);border-radius:12px;background:var(--panel);text-decoration:none}
.ts-list a.to-send{border-left-color:var(--accent)}.ts-list a.sent{border-left-color:var(--warn)}.ts-list a.approved{border-left-color:var(--ink)}
.ts-list small{color:var(--muted)}.ts-list b span{font-weight:500;color:var(--muted)}.ts-list a>span{font-weight:600}
.offer.today-card{border-left-color:var(--ink)}
.late-said{margin:0;padding:10px 12px;border-radius:10px;background:var(--warn-soft);color:var(--warn);font-weight:600}
fieldset.choice{border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px}fieldset.choice legend{font-size:.85rem;color:var(--muted);margin-bottom:4px;padding:0}
fieldset.choice label{display:flex;gap:6px;align-items:center;min-height:44px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg)}
fieldset.choice input{width:20px;height:20px;accent-color:var(--accent)}
.doc h3{overflow-wrap:anywhere}
.share-cal{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}
.where ul{margin:0;padding-left:18px;display:grid;gap:6px;font-size:.92rem}
.again{border:0;padding:0}
.glance a,.office a,a[href^="tel:"],.facts a,.demo-bar a,footer a{position:relative}.glance a::after,.office a::after,a[href^="tel:"]::after,.facts a::after,.demo-bar a::after,footer a::after{content:'';position:absolute;inset:-12px -4px}
`
