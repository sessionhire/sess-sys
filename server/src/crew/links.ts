import { commandSchemas, eachDay, EURO_HINT, sinceYes, type SinceYes, normaliseNumber, PURCHASE_OPEN, feedCodeFor, feedPath, HOLDING, isDay, LATE_BY, lateDays, MAX_EXTRAS, newId, noTimesheetReason, OPEN, parseEuro, type CommandArgs, type CommandName, type LateBy, type CrewCall, type MutationResult, type Offer, type Person, type TimesheetExtra } from '@sh/shared'
import { FILE_TOO_BIG, NO_FILE, WEB_FILE, WRONG_FILE } from '@sh/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { applyMutation } from '../commands.ts'
import type { Db } from '../db.ts'
import { describeDevice } from '../devices.ts'
import { documentsSection } from '../documents/page.ts'
import { documentsOf } from '../documents/store.ts'
import { publicOrigin } from '../http.ts'
import { reportError } from '../monitoring.ts'
import { officeFor, timesheetAsking, usesTimesheets } from '../office/store.ts'
import { getPhase } from '../projects/store.ts'
import { sendFeed, type Feeds } from './feeds.ts'
import { getLate, lateFor, lateOf } from './late.ts'
import { renderGone, renderPage, type Flash, type Kept, type OnTheDay } from './page.ts'
import { renderNoSheet, renderSheet, sheetFor } from './sheet.ts'
import { awayFor, endedOn, getAway, getCall, getOffer, getPerson, heldByCall, heldElsewhereIn, offersFor, personByToken, yesLogs } from './store.ts'
import { renderTimesheet, type TimesheetPage } from './timesheet-page.ts'
import { paidOnFor } from '../finance/store.ts'
import { getTimesheet, timesheetsFor } from './timesheets.ts'
import { Refused } from '../kernel.ts'
import { getOwnCalendar, type OwnCalendars } from './own-calendars.ts'
import { leaveAheadFor } from '../leave/store.ts'
import { getPurchase, openPurchases, purchasesFor } from '../purchases/store.ts'
import { renderPurchases } from './purchase-page.ts'
import { renderBroken, type BrokenPage } from './broken-page.ts'
import { getAsset, numberUse } from '../stock/store.ts'

/**
 * A freelancer's private link, /f/<token>: their page, the answers they
 * post from it, their bookings' call sheets and timesheets, their calendar
 * feed and their data. The token is the only
 * credential, so every action checks the thing it touches belongs to the
 * link's person. Answers go through the same command handlers as the app,
 * so the same rules (first to accept, no double booking) hold.
 *
 * The calendar feed also has a read-only address of its own,
 * /cal/<code>.ics, safe to add to a shared calendar (ADR 0012).
 */

type Form = URLSearchParams
/**
 * The address after a post says which message to show, by code (m) or as
 * the refusal of the change just made (r), and where: the offer's card (o)
 * or their details (s). None of it is ever drawn as words.
 */
type Req = FastifyRequest<{ Params: { token: string; id?: string }; Querystring: { m?: string; r?: string; o?: string; s?: string } }>

/** Where a post's message goes: a section of its own, the running-late card (ADR 0028), their documents (ADR 0029), their days off, their own calendar (ADR 0044), or else the offer's card. */
const SECTIONS = ['details', 'late', 'documents', 'away', 'calendar'] as const

const today = (at = new Date()) => at.toLocaleDateString('sv-SE', { timeZone: 'Europe/Dublin' })

/**
 * Everything the pages say after a post, by the short code the address
 * carries (audit finding 21). The address used to carry the words
 * themselves, so anything typed into it was drawn on the page: escaped,
 * but drawn. Now a code the server doesn't know shows nothing.
 */
const SAID = {
  // Answering an offer.
  accepted: { ok: true, text: "Thanks, you're down for it. The office will confirm." },
  // Accepted after asking a different rate (audit, 20 October 2026, finding 6): said plainly which rate stands.
  'accepted-instead': { ok: true, text: "You're down for it at the rate offered, shown here; the rate you asked for is withdrawn. The office will confirm." },
  declined: { ok: true, text: "Thanks for letting us know. You're off this one." },
  // "Can't make it", the one name for it on both sides (UX sweep, 6 November 2026, move 6).
  'pulled-out': { ok: true, text: "Thanks for telling us you can't make it. You're off this one, and the office will find cover." },
  'rate-sent': { ok: true, text: 'Thanks, your rate has gone to the office.' },
  'tap-a-button': { ok: false, text: 'Tap Accept, Decline or Send rate.' },
  'tap-yes-or-no': { ok: false, text: 'Tap Accept or Decline.' },
  'tick-a-day': { ok: false, text: 'Tick at least one day, or press Decline.' },
  // A booking they hold has no Decline, only Can't make it (audit, 5 November 2026, finding 91).
  'tick-a-day-held': { ok: false, text: "Tick at least one day, or use Can't make it." },
  'no-rate': { ok: false, text: 'Put in the day rate you would do it for.' },
  'not-a-price': { ok: false, text: EURO_HINT },
  'not-your-offer': { ok: false, text: "That offer isn't one of yours." },
  'try-again': { ok: false, text: 'Something went wrong; please try again.' },
  // Their own details.
  'details-same': { ok: true, text: 'Nothing to change: those are the details we have.' },
  'details-saved': { ok: true, text: 'Saved. The office has your new details.' },
  // Days they can't work.
  'days-off-added': { ok: true, text: "Got it. We won't offer you work on those days." },
  'days-off-removed': { ok: true, text: 'Removed. You can be offered work on those days again.' },
  'days-off-gone': { ok: true, text: 'Already removed.' },
  'check-the-dates': { ok: false, text: 'Check the dates and try again.' },
  'days-off-first': { ok: false, text: 'Put in the first day off.' },
  'days-off-first-real': { ok: false, text: "The first day off isn't a real date. Pick it again." },
  'days-off-last-real': { ok: false, text: "The last day off isn't a real date. Pick it again, or leave it empty for one day." },
  // Staff time off is leave, approved in the app (ADR 0024): a page kept from before can't mark days off around it (UX sweep, 6 November 2026, move 6).
  'days-off-staff': { ok: false, text: 'Staff ask for leave in the app, under Leave, where whoever approves time off sees it.' },
  // A timesheet.
  'timesheet-sent': { ok: true, text: "Thanks, it's gone to the office. You can change it until they approve it." },
  'not-your-booking': { ok: false, text: "That booking isn't one of yours." },
  // The company doesn't use timesheets (ADR 0090): what they worked goes to the office as before.
  'no-timesheets': { ok: false, text: "Timesheets aren't used here just now. The office keeps your days; ask them if anything's not right." },
  'tick-a-day-worked': { ok: false, text: 'Tick at least one day you worked.' },
  'say-what-for': { ok: false, text: 'Say what each extra is for.' },
  'extra-amount': { ok: false, text: 'Put in the amount for each extra, in euro.' },
  'too-many-extras': { ok: false, text: `There's room for ${MAX_EXTRAS} extras: put the rest together, or in the note.` },
  // Running late (ADR 0028).
  'late-sent': { ok: true, text: "Thanks. The office, and whoever's running the day, can see it now." },
  'late-how': { ok: false, text: "Tap roughly how late you'll be, or put in the time you'll be there." },
  'late-here': { ok: true, text: "Thanks. The office can see you're there." },
  // Sending a document (ADR 0029), from server/src/documents/routes.ts.
  'doc-sent': { ok: true, text: "Thanks, it's gone to the office. They'll check it, and it's on your list meanwhile." },
  'doc-no-file': { ok: false, text: NO_FILE },
  'doc-too-big': { ok: false, text: FILE_TOO_BIG },
  'doc-web-page': { ok: false, text: WEB_FILE },
  'doc-not-a-file': { ok: false, text: WRONG_FILE },
  'doc-not-on': { ok: false, text: "Sending documents here isn't switched on yet. For now, send a photo or a PDF of it to the office by WhatsApp or email." },
  'doc-not-yours': { ok: false, text: "That document isn't one of yours." },
  'doc-not-kept': { ok: false, text: "The file couldn't be kept just now, so nothing was sent. Try again in a minute." },
  // Their own calendar (ADR 0044).
  'calendar-shared': { ok: true, text: "Thanks. We've read your calendar, and the office can see when you're busy." },
  'calendar-stopped': { ok: true, text: "Stopped. We've deleted your calendar's address and the times we read from it." },
  // The purchase list (ADR 0108).
  'buy-asked': { ok: true, text: "Thanks, it's on the list. The office will see it, and you'll see here where it's at." },
  'buy-voted': { ok: true, text: 'Thanks, your vote is in.' },
  'buy-unvoted': { ok: true, text: 'Your vote is taken back.' },
  'buy-gone': { ok: false, text: "That request isn't on the purchase list any more." },
  'buy-settled': { ok: false, text: "That one's been ordered or settled, so it can't be voted for now." },
  // Broken or missing kit (audit, 5 November 2026, finding 75).
  'broken-told': { ok: true, text: "Thanks, the warehouse has it. It's on their repairs list with your name on it." },
  'broken-what': { ok: false, text: "Give its number from the label, or the product's name if it has no label." },
  'broken-no-number': { ok: false, text: "Nothing here has that number. Check the label, or give the product's name instead." },
  'broken-no-product': { ok: false, text: "There's no product called that. Give its number from the label, or the name as it's on our kit lists." },
} satisfies Record<string, { ok: boolean; text: string }>
type Said = keyof typeof SAID
/**
 * A sent document comes back to the page by address (server/src/documents/routes.ts), so a refusal about its file or
 * the day it runs out is said under that field by its code (UX sweep, 6 November 2026, move 5).
 */
const DOCUMENT_FIELDS = new Map<string, 'file' | 'expires'>([
  ['doc-no-file', 'file'],
  ['doc-too-big', 'file'],
  ['doc-web-page', 'file'],
  ['doc-not-a-file', 'file'],
  ['check-the-dates', 'expires'],
])
/** A link's token without anything a message stuck on its end: tokens are letters, digits, - and _ (newLinkToken). */
const tokenOnly = (token: string) => {
  // Walked back from the end rather than a regular expression, which a long run of punctuation would make slow.
  let end = token.length
  while (end > 0 && !/[A-Za-z0-9_-]/.test(token[end - 1]!)) end--
  return token.slice(0, end)
}
/** The id the page gives a days-off form: one of the app's own (newId). */
const AWAY_ID = /^[a-z0-9]{8,32}$/
type Refusal = Extract<MutationResult, { status: 'rejected' }>

/** The address's part for a message: its code, or the id of the change that was refused. */
const told = (what: Said | Refusal): Record<string, string> => (typeof what === 'string' ? { m: what } : { r: what.id })

/** `demo`: the passcode-locked demo copy (ADR 0033), whose freelancer pages say so and lead back to choosing whose eyes to see the app through. */
export function registerCrewLinks(app: FastifyInstance, db: Db, onChange: () => void, feeds: Feeds, { demo = false, ownCalendars }: { demo?: boolean; ownCalendars?: OwnCalendars } = {}) {
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) =>
    done(null, new URLSearchParams(String(body)))
  )

  const base = (req: FastifyRequest, token: string) => `${publicOrigin(req)}/f/${token}`

  /**
   * The message the address asks for: one of the pages' own, by its code,
   * or the refusal the server recorded for one of this link's own changes,
   * in the words the rules gave it (they name the job and the days). A code
   * it doesn't know, or someone else's change, shows nothing.
   */
  async function flashFor(personId: string, q: Req['query']): Promise<Omit<Flash, 'field' | 'extra'> | undefined> {
    const said = q.m && Object.hasOwn(SAID, q.m) ? SAID[q.m as Said] : undefined
    let refused: string | undefined
    if (!said && q.r && /^[\w-]{1,64}$/.test(q.r)) {
      const { rows } = await db.query<{ message: string | null }>(
        `SELECT result->'reason'->>'message' AS message FROM mutations WHERE id = $1 AND client_id = $2 AND status = 'rejected'`,
        [q.r, `link:${personId}`]
      )
      refused = rows[0]?.message ?? undefined
    }
    const text = said?.text ?? refused
    if (text === undefined) return undefined
    const section = SECTIONS.find((x) => x === q.s)
    return { ok: said?.ok ?? false, text, ...(q.o ? { offer: q.o } : {}), ...(section ? { section } : {}) }
  }

  async function run<N extends CommandName>(req: FastifyRequest, personId: string, name: N, args: CommandArgs<N>): Promise<MutationResult> {
    const result = await applyMutation(
      db,
      `link:${personId}`,
      { id: newId(), name, args, createdAt: new Date().toISOString() },
      { via: 'link', device: describeDevice(req.headers['user-agent']) }
    )
    if (result.status === 'applied') onChange()
    return result
  }

  /**
   * After a post, back to the page with a message, so a refresh never
   * resubmits. An answer names its offer, so the page lands on that card
   * with the message in it.
   */
  const back = (reply: FastifyReply, token: string, what: Said | Refusal, offer?: string) =>
    reply.redirect(`/f/${token}?${new URLSearchParams({ ...told(what), ...(offer ? { o: offer } : {}) })}${offer ? `#o-${offer}` : ''}`, 303)

  /** Back to Days you can't work, with the message over the list rather than at the top of the page (audit, 5 November 2026, finding 31). */
  const toAway = (reply: FastifyReply, token: string, what: Said | Refusal) =>
    reply.redirect(`/f/${token}?${new URLSearchParams({ ...told(what), s: 'away' })}#away`, 303)

  const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store').header('x-robots-tag', 'noindex')

  /** A link that doesn't work any more, with the office's number and email to ask for a new one. */
  const gone = async (reply: FastifyReply) => reply.code(404).type('text/html').send(renderGone(await officeFor(db)))

  /** A refusal in words: one of the pages' own, or the reason the rules gave. */
  const reasonOf = (what: Said | Refusal) => (typeof what === 'string' ? SAID[what].text : what.reason.message)

  /**
   * A refused post (rule 11): the page drawn again at once, with the reason
   * where the form is and everything typed still in it, rather than a
   * redirect, which could carry only the reason. The form's address ends in
   * its place on the page, so the browser lands there.
   */
  const refused = async (req: Req, reply: FastifyReply, person: Person, what: Said | Refusal, kept: Kept, where: Pick<Flash, 'offer' | 'section' | 'field'>) =>
    noStore(reply)
      .code(422)
      .type('text/html')
      .send(await home(req, person, { ok: false, text: reasonOf(what), ...where }, kept))

  /**
   * What changed on each of these bookings since its person said yes, while it's news, by offer (UX sweep, 6 November
   * 2026, move 6): one read of the log for them all, and nothing written for the opening.
   */
  async function sinceYesFor(booked: readonly { offer: Offer; call: CrewCall }[], at: Date): Promise<Map<string, SinceYes>> {
    const since = new Map<string, SinceYes>()
    for (const [id, log] of await yesLogs(db, booked, at)) {
      const said = sinceYes(log.yes, log.before, log.steps, at)
      if (said) since.set(id, said)
    }
    return since
  }

  /** Their page, with a message, and with what a refused post typed drawn back into its form. */
  async function home(req: Req, person: Person, flash: Flash | undefined, kept?: Kept): Promise<string> {
    const rows = await offersFor(db, person.id)
    const held = await heldByCall(db, rows.map((r) => r.call))
    // One moment for the whole page: its day, and what's still news on it.
    const at = new Date()
    const now = today(at)
    const jobs = rows.map(({ offer, call }) => {
      const byDay = held.get(call.id)!
      // Days they hold on another job, for the picker to leave unticked and say so (audit finding 21), where there's still an answer to give.
      // Worked out from the offers just read, as the rules work it out, so a person offered many jobs costs no query more.
      const busy: Record<string, string> = {}
      if ((OPEN.includes(offer.status) || offer.status === 'accepted') && call.status === 'open' && call.end >= now)
        for (const c of heldElsewhereIn(rows, eachDay(call.start, call.end), call.id)) for (const d of c.days) busy[d] = c.project
      return { offer, call, openDays: Object.keys(byDay).filter((d) => byDay[d]! < call.needed), busy }
    })
    const feed = `${publicOrigin(req)}${feedPath(await feedCodeFor(person.linkToken))}`
    // A day they hold, from 6pm the evening before (ADR 0028): what they've said about being late, and who to ring if it won't send.
    const onTheDay: OnTheDay[] = []
    for (const { offer, call } of rows) {
      if (!HOLDING.includes(offer.status) || call.status !== 'open') continue
      const days = lateDays(offer.days)
      if (!days.length) continue
      const said = (await Promise.all(days.map((d) => lateFor(db, offer.id, d)))).filter((l) => l !== undefined)
      const phase = call.phaseId ? await getPhase(db, call.phaseId) : undefined
      const lead = phase?.contactId && phase.contactId !== person.id ? await getPerson(db, phase.contactId) : undefined
      onTheDay.push({ offer, call, days, said, contact: lead && !lead.archived ? { name: lead.name, phone: lead.phone } : null })
    }
    return renderPage({
      person,
      jobs,
      away: await awayFor(db, person.id),
      base: base(req, person.linkToken),
      feed,
      flash,
      kept,
      today: now,
      now: at,
      ended: await endedOn(db, rows.map((r) => r.offer)),
      since: await sinceYesFor(rows.filter(({ offer, call }) => HOLDING.includes(offer.status) && call.status === 'open' && call.end >= now), at),
      ...(await (async () => {
        const timesheets = await timesheetsFor(db, person.id)
        return { timesheets, paid: await paidOnFor(db, [...timesheets.keys()]) }
      })()),
      ...(await (async () => {
        const asking = await timesheetAsking(db)
        return { noTimesheets: !asking, asking: asking ?? undefined }
      })()),
      office: await officeFor(db),
      onTheDay,
      demo,
      ownCalendar: await getOwnCalendar(db, person.id),
      // A member of staff's time off is their leave (ADR 0024), read from the requests rather than the days it marks off.
      ...(person.kind === 'staff' ? { leave: await leaveAheadFor(db, person.id, now) } : {}),
      // Their documents (ADR 0029), with forms to send a new one where the server can keep files.
      purchases: await openPurchases(db),
      documents: documentsSection({ person, list: await documentsOf(db, person.id), files: app.documents.on, base: base(req, person.linkToken), today: now, flash }),
    })
  }

  app.get('/f/:token', async (req: Req, reply) => {
    noStore(reply)
    const person = await personByToken(db, req.params.token)
    // A full stop or bracket picked up with the link from a message isn't part of it (audit, 5 November 2026, finding 66).
    const bare = tokenOnly(req.params.token)
    if (!person && bare !== req.params.token && (await personByToken(db, bare))) return reply.redirect(`/f/${bare}`, 303)
    if (!person) return gone(reply)
    const flash = await flashFor(person.id, req.query)
    const field = flash?.section === 'documents' && !flash.ok ? DOCUMENT_FIELDS.get(req.query.m ?? '') : undefined
    return reply.type('text/html').send(await home(req, person, flash && field ? { ...flash, field } : flash))
  })

  // Anything else under a link: a slash on the end goes to the same place without it, and a part of the address that isn't
  // one goes to their page, rather than a bare "Not found" in code (audit, 5 November 2026, finding 66).
  app.get('/f/*', async (req: Req, reply) => {
    noStore(reply)
    const path = req.url.split('?')[0]!
    const query = req.url.slice(path.length)
    const trimmed = path.replace(/\/+$/, '')
    if (trimmed !== path && trimmed.length > '/f/'.length) return reply.redirect(trimmed + query, 303)
    const token = tokenOnly(decodeURIComponent(path.slice('/f/'.length).split('/')[0] ?? ''))
    const person = await personByToken(db, token)
    if (!person) return gone(reply)
    return reply.redirect(`/f/${person.linkToken}`, 303)
  })

  // A booking's call sheet (ADR 0021): only the person's own, while it's going ahead.
  app.get('/f/:token/sheet/:id', async (req: Req, reply) => {
    noStore(reply)
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const sheet = await sheetFor(db, person.id, req.params.id ?? '')
    if (!sheet) return reply.code(404).type('text/html').send(renderNoSheet(base(req, person.linkToken)))
    return reply.type('text/html').send(renderSheet(sheet, base(req, person.linkToken), await officeFor(db)))
  })

  /** A booking's timesheet page, with a message, and with what a refused post typed drawn back into the form. */
  async function timesheetPage(req: Req, person: Person, offer: Offer, call: CrewCall, flash: TimesheetPage['flash'], kept?: URLSearchParams) {
    return renderTimesheet({
      offer,
      call,
      timesheet: await getTimesheet(db, offer.id),
      paidOn: (await paidOnFor(db, [offer.id])).get(offer.id) ?? null,
      why: noTimesheetReason(offer, call, person, today(), (await timesheetAsking(db)) ?? undefined),
      staff: person.kind === 'staff',
      base: base(req, person.linkToken),
      flash,
      kept,
      office: await officeFor(db),
    })
  }

  // A booking's timesheet (ADR 0022): the person's own, from its first day. None while the company doesn't use them (ADR 0090).
  app.get('/f/:token/timesheet/:id', async (req: Req, reply) => {
    noStore(reply)
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    // Said as the post says it, not as if the booking had gone (audit, 5 November 2026, finding 67).
    if (!(await usesTimesheets(db))) return reply.code(404).type('text/html').send(renderNoSheet(base(req, person.linkToken), 'timesheet', SAID['no-timesheets'].text))
    const offer = await getOffer(db, req.params.id ?? '')
    const call = offer && offer.personId === person.id ? await getCall(db, offer.callId) : undefined
    if (!offer || !call) return reply.code(404).type('text/html').send(renderNoSheet(base(req, person.linkToken), 'timesheet'))
    return reply.type('text/html').send(await timesheetPage(req, person, offer, call, await flashFor(person.id, req.query)))
  })

  app.post('/f/:token/timesheet/:id', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const offer = await getOffer(db, req.params.id ?? '')
    if (!offer || offer.personId !== person.id) return back(reply, person.linkToken, 'not-your-booking')
    if (!(await usesTimesheets(db))) return back(reply, person.linkToken, 'no-timesheets')
    const again = (what: Said | Refusal) => reply.redirect(`/f/${person.linkToken}/timesheet/${encodeURIComponent(offer.id)}?${new URLSearchParams(told(what))}`, 303)
    const form = (req.body ?? new URLSearchParams()) as Form
    // A refusal keeps the days, extras and note as they were typed (rule 11).
    const call = await getCall(db, offer.callId)
    // A refusal about the days, or about one extra, by its place among the ones filled in, is said under it (audit, 20 October 2026, finding 90).
    const turnedDown = async (what: Said | Refusal, about: Pick<NonNullable<TimesheetPage['flash']>, 'extra' | 'field'> = {}) =>
      call ? noStore(reply).code(422).type('text/html').send(await timesheetPage(req, person, offer, call, { ok: false, text: reasonOf(what), ...about }, form)) : again(what)
    const days = form.getAll('days')
    if (days.length === 0) return turnedDown('tick-a-day-worked', { field: 'days' })
    const whats = form.getAll('what')
    const euros = form.getAll('euro')
    const extras: TimesheetExtra[] = []
    for (let i = 0; i < Math.max(whats.length, euros.length); i++) {
      const what = (whats[i] ?? '').trim().slice(0, 100)
      const typed = (euros[i] ?? '').trim()
      if (!what && !typed) continue
      if (!what) return turnedDown('say-what-for', { extra: extras.length })
      // As typed on a phone: "€12.50", "12,50" or "1,250" all read as a person means them (audit finding 15).
      const amount = parseEuro(typed)
      if (amount.reason !== undefined || !amount.cents) return turnedDown('extra-amount', { extra: extras.length })
      extras.push({ what, cents: amount.cents })
    }
    if (extras.length > MAX_EXTRAS) return turnedDown('too-many-extras')
    const note = (form.get('note') ?? '').slice(0, 1000)
    const result = await run(req, person.id, 'timesheet.send', { id: offer.id, days, extras, note })
    if (result.status === 'rejected') return turnedDown(result)
    return again('timesheet-sent')
  })

  app.post('/f/:token/offers/:id', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const offer = await getOffer(db, req.params.id!)
    if (!offer || offer.personId !== person.id) return back(reply, person.linkToken, 'not-your-offer')
    const form = (req.body ?? new URLSearchParams()) as Form
    // A refusal keeps the days ticked, the rate and the note as they were typed, in the offer's card (rule 11), and one
    // about the days or the rate is said under them, not at the top of the card (audit, 20 October 2026, finding 90).
    const turnedDown = (what: Said | Refusal, field?: 'days' | 'rate') =>
      refused(req, reply, person, what, { form: `offer:${offer.id}`, values: form }, { offer: offer.id, ...(field ? { field } : {}) })
    let answer = form.get('answer')
    // Enter in the rate field presses the form's hidden first button. With a rate that's a counter; without one there's only a tap to ask for. Never an accept.
    if (answer === 'implicit') {
      // Staff have no rate to send (audit finding 21), so there are only two buttons to name.
      if (!(form.get('rate') ?? '').trim()) return turnedDown(person.kind === 'staff' ? 'tap-yes-or-no' : 'tap-a-button')
      answer = 'counter'
    }
    const note = (form.get('note') ?? '').slice(0, 1000)
    const picked = form.getAll('days')
    if (form.get('picker') && picked.length === 0 && answer !== 'decline')
      return turnedDown(offer.status === 'accepted' || offer.status === 'confirmed' ? 'tick-a-day-held' : 'tick-a-day', 'days')
    const days = picked.length ? picked : null

    let result: MutationResult
    if (answer === 'accept') result = await run(req, person.id, 'offer.respond', { id: offer.id, answer: 'accept', days, note })
    else if (answer === 'decline') result = await run(req, person.id, 'offer.respond', { id: offer.id, answer: 'decline', note })
    // "Can't make it" (audit finding 10): a job they had said yes to, given back.
    else if (answer === 'pullOut') result = await run(req, person.id, 'offer.respond', { id: offer.id, answer: 'pullOut', note })
    else if (answer === 'counter') {
      // Staff are paid through payroll, so their page has no rate to send (audit finding 21), and a post that sends one anyway is asked for a tap.
      if (person.kind === 'staff') return turnedDown('tap-yes-or-no')
      // "€300", "1,250" or "1 250,50" read as the person means them (audit finding 15); anything else says what to put in.
      const rate = parseEuro(form.get('rate') ?? '')
      if (rate.reason !== undefined) return turnedDown('not-a-price', 'rate')
      if (!rate.cents) return turnedDown('no-rate', 'rate')
      result = await run(req, person.id, 'offer.respond', { id: offer.id, answer: 'counter', counterRateCents: rate.cents, days, note })
    } else return back(reply, person.linkToken, 'try-again')

    if (result.status === 'rejected') return turnedDown(result)
    const said: Said = answer === 'accept' ? (offer.status === 'countered' ? 'accepted-instead' : 'accepted') : answer === 'decline' ? 'declined' : answer === 'pullOut' ? 'pulled-out' : 'rate-sent'
    // A pull-out leaves the card for "Declined and withdrawn", so its message goes at the top.
    return back(reply, person.linkToken, said, answer === 'pullOut' ? undefined : offer.id)
  })

  /**
   * Running late (ADR 0028), on a day they hold: roughly how late or the
   * time they'll be there, and a note. Said again, it replaces what was
   * said. The message lands in the running-late card.
   */
  app.post('/f/:token/late', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const form = (req.body ?? new URLSearchParams()) as Form
    const offer = await getOffer(db, form.get('offer') ?? '')
    if (!offer || offer.personId !== person.id) return back(reply, person.linkToken, 'not-your-booking')
    const inCard = (what: Said | Refusal) => reply.redirect(`/f/${person.linkToken}?${new URLSearchParams({ ...told(what), s: 'late', o: offer.id })}#late-${offer.id}`, 303)
    const typed = form.get('by') ?? ''
    const by = (LATE_BY as readonly string[]).includes(typed) ? (typed as LateBy) : null
    const arriveAt = (form.get('at') ?? '').trim() || null
    // A refusal keeps how late, the time and the note as they were typed, in the running-late card (rule 11).
    const turnedDown = (what: Said | Refusal) => refused(req, reply, person, what, { form: `late:${offer.id}`, values: form }, { section: 'late', offer: offer.id })
    if (!by && !arriveAt) return turnedDown('late-how')
    const day = form.get('day') ?? ''
    // The same record each time, so the office sees one line for the day, however often it changes.
    const was = isDay(day) ? await lateFor(db, offer.id, day) : undefined
    const note = (form.get('note') ?? '').trim().slice(0, 200)
    const result = await run(req, person.id, 'late.say', { id: was?.id ?? newId(), offerId: offer.id, day, by, arriveAt, note })
    return result.status === 'rejected' ? turnedDown(result) : inCard('late-sent')
  })

  app.post('/f/:token/late/here', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const form = (req.body ?? new URLSearchParams()) as Form
    const late = await getLate(db, form.get('id') ?? '')
    if (!late || late.personId !== person.id) return back(reply, person.linkToken, 'not-your-booking')
    const result = await run(req, person.id, 'late.arrived', { id: late.id })
    return reply.redirect(`/f/${person.linkToken}?${new URLSearchParams({ ...told(result.status === 'rejected' ? result : 'late-here'), s: 'late', o: late.offerId })}#late-${late.offerId}`, 303)
  })

  // Their own phone (audit finding 7). Only what differs is sent, so the history can say which changed; an email from a page
  // from before audit finding 12 is sent too, and refused in plain words.
  app.post('/f/:token/details', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const inSection = (what: Said | Refusal) => reply.redirect(`/f/${person.linkToken}?${new URLSearchParams({ ...told(what), s: 'details' })}#details`, 303)
    const form = (req.body ?? new URLSearchParams()) as Form
    // A field the form didn't send is left alone; one sent empty is cleared.
    const typed = (name: string) => (form.has(name) ? form.get(name)!.trim().slice(0, 200) || null : undefined)
    const changes: CommandArgs<'person.contact'> = { id: person.id }
    const email = typed('email')
    const phone = typed('phone')
    if (email !== undefined && email !== person.email) changes.email = email
    if (phone !== undefined && phone !== person.phone) changes.phone = phone
    if (changes.email === undefined && changes.phone === undefined) return inSection('details-same')
    const result = await run(req, person.id, 'person.contact', changes)
    // A refusal keeps the number as it was typed (rule 11), and one of the number is said under it. One about an email
    // from an old page, which has no field for it, is said above the form.
    if (result.status === 'rejected')
      return refused(req, reply, person, result, { form: 'details', values: form }, { section: 'details', ...(result.reason.code === 'invalid' && changes.email === undefined ? { field: 'phone' } : {}) })
    return inSection('details-saved')
  })

  // The purchase list (ADR 0108): the same list as Stock › Purchase list in the app, to see, ask on and vote, as the link's person.
  const buyPage = async (req: Req, person: Person, flash?: Parameters<typeof renderPurchases>[0]['flash'], kept?: URLSearchParams) =>
    renderPurchases({ requests: await purchasesFor(db, person.id), base: base(req, person.linkToken), today: today(), office: await officeFor(db), flash, kept })

  app.get('/f/:token/buy', async (req: Req, reply) => {
    noStore(reply)
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const said = req.query.m && Object.hasOwn(SAID, req.query.m) && (req.query.m.startsWith('buy-') || req.query.m === 'try-again') ? SAID[req.query.m as Said] : undefined
    return reply.type('text/html').send(await buyPage(req, person, said))
  })

  const toBuy = (reply: FastifyReply, token: string, what: Said, at?: string) =>
    reply.redirect(`/f/${token}/buy?${new URLSearchParams({ m: what })}${at ? `#p-${at}` : ''}`, 303)

  app.post('/f/:token/buy', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const form = (req.body ?? new URLSearchParams()) as Form
    // The page gives the form an id of its own, so the same form sent twice (a double tap, the browser resending it) asks once.
    const given = form.get('id') ?? ''
    const id = AWAY_ID.test(given) ? given : newId()
    if (await getPurchase(db, id)) return toBuy(reply, person.linkToken, 'buy-asked', id)
    const ask = {
      id,
      title: form.get('title') ?? '',
      details: form.get('details') ?? '',
      link: form.get('link') ?? '',
      // Theirs, as the Crew tab has it, so a head looking down their department's list sees it.
      department: person.department ?? null,
      by: person.id,
    }
    const result = await run(req, person.id, 'purchase.ask', ask).catch((err: unknown) => {
      reportError(err, { route: '/f/:token/buy', method: 'POST' })
      return undefined
    })
    // A refusal is said under the field the rules name, read as they read it, or else above the form, with everything
    // typed still in it (rule 11).
    if (!result || result.status === 'rejected') {
      const named = result?.reason.code === 'invalid' ? commandSchemas['purchase.ask'].safeParse(ask).error?.issues[0]?.path[0] : undefined
      const field = named === 'title' || named === 'details' || named === 'link' ? named : 'ask'
      return noStore(reply)
        .code(422)
        .type('text/html')
        .send(await buyPage(req, person, { ok: false, text: reasonOf(result ?? 'try-again'), field }, form))
    }
    return toBuy(reply, person.linkToken, 'buy-asked', id)
  })

  app.post('/f/:token/buy/:id/vote', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const form = (req.body ?? new URLSearchParams()) as Form
    const r = await getPurchase(db, req.params.id!)
    if (!r) return toBuy(reply, person.linkToken, 'buy-gone')
    const vote = form.get('vote') !== 'no'
    // Voting is for what's still to decide or to buy, as the page offers it; taking a vote back is always allowed.
    if (vote && !PURCHASE_OPEN.includes(r.status)) return toBuy(reply, person.linkToken, 'buy-settled', r.id)
    const result = await run(req, person.id, 'purchase.vote', { requestId: r.id, vote, by: person.id })
    if (result.status === 'rejected') return toBuy(reply, person.linkToken, 'try-again', r.id)
    return toBuy(reply, person.linkToken, vote ? 'buy-voted' : 'buy-unvoted', r.id)
  })

  // Broken or missing kit, reported from the link (audit, 5 November 2026, finding 75): as the app's Report damage, onto Repairs.
  const brokenPage = async (req: Req, person: Person, flash?: BrokenPage['flash'], kept?: URLSearchParams) =>
    renderBroken({ base: base(req, person.linkToken), office: await officeFor(db), flash, kept })

  app.get('/f/:token/broken', async (req: Req, reply) => {
    noStore(reply)
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const said = req.query.m && Object.hasOwn(SAID, req.query.m) && req.query.m.startsWith('broken-') ? SAID[req.query.m as Said] : undefined
    return reply.type('text/html').send(await brokenPage(req, person, said))
  })

  app.post('/f/:token/broken', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const form = (req.body ?? new URLSearchParams()) as Form
    // A refusal is said under the number or the product when it's about one, or else above the form, with everything
    // typed still in it (rule 11).
    const turnedDown = async (what: Said | Refusal, field?: 'number' | 'product') =>
      noStore(reply)
        .code(422)
        .type('text/html')
        .send(await brokenPage(req, person, { ok: false, text: reasonOf(what), ...(field ? { field } : {}) }, form))
    const typed = (form.get('number') ?? '').trim()
    const named = (form.get('product') ?? '').trim()
    // Neither given: said under the number, the form's first question, which says to give one or the other.
    if (!typed && !named) return turnedDown('broken-what', 'number')
    let assetId: string | null = null
    let modelId: string | undefined
    if (typed) {
      const n = normaliseNumber(typed)
      const use = n ? await numberUse(db, n) : undefined
      const asset = use?.current ? await getAsset(db, use.assetId) : undefined
      if (!asset) return turnedDown('broken-no-number', 'number')
      assetId = asset.id
      modelId = asset.modelId
    } else {
      const { rows } = await db.query<{ id: string }>('SELECT id FROM models WHERE lower(name) = lower($1) AND NOT mistake LIMIT 1', [named])
      modelId = rows[0]?.id
      if (!modelId) return turnedDown('broken-no-product', 'product')
    }
    const kind = form.get('kind') === 'missing' ? 'missing' : 'damaged'
    const note = (form.get('note') ?? '').trim().slice(0, 1500)
    // The page gives the form an id of its own, so the same form sent twice reports once (fault.report keeps the first).
    const given = form.get('id') ?? ''
    const result = await run(req, person.id, 'fault.report', {
      id: AWAY_ID.test(given) ? given : newId(),
      kind,
      assetId,
      modelId,
      qty: 1,
      projectId: null,
      usable: kind === 'damaged' && form.get('usable') === 'yes',
      // Who said so, for the warehouse reading Repairs: a link has no signed-in name.
      note: `From ${person.name}'s link${note ? `: ${note}` : '.'}`,
      at: new Date().toISOString(),
    }).catch((err: unknown) => {
      reportError(err, { route: '/f/:token/broken', method: 'POST' })
      return undefined
    })
    if (!result) return turnedDown('try-again')
    if (result.status === 'rejected') return turnedDown(result)
    return reply.redirect(`/f/${person.linkToken}/broken?${new URLSearchParams({ m: 'broken-told' })}`, 303)
  })

  app.post('/f/:token/away', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const form = (req.body ?? new URLSearchParams()) as Form
    const start = form.get('start') ?? ''
    const end = form.get('end') || start
    // A refusal keeps the dates and the note as they were typed, beside the form (rule 11), and is said under the date it's about.
    const turnedDown = (what: Said | Refusal, field?: 'start' | 'end') =>
      refused(req, reply, person, what, { form: 'away', values: form }, { section: 'away', ...(field ? { field } : {}) })
    if (person.kind === 'staff') return turnedDown('days-off-staff')
    if (!start) return turnedDown('days-off-first', 'start')
    if (!isDay(start)) return turnedDown('days-off-first-real', 'start')
    if (!isDay(end)) return turnedDown('days-off-last-real', 'end')
    // The page gives each form an id of its own, so the same form sent again (a double tap, or the browser resending it)
    // adds the days once (audit, P3: words). Sent from anywhere else, a new one.
    const given = form.get('id') ?? ''
    const result = await run(req, person.id, 'unavailability.add', {
      id: AWAY_ID.test(given) ? given : newId(),
      personId: person.id,
      start,
      end,
      note: (form.get('note') ?? '').slice(0, 500),
    }).catch((err: unknown) => {
      reportError(err, { route: '/f/:token/away', method: 'POST' })
      return undefined
    })
    if (!result) return turnedDown('try-again')
    // The rules turn down a last day before the first, then a first day gone by, then a last day too far after it.
    if (result.status === 'rejected') return turnedDown(result, result.reason.code === 'invalid' ? (end < start ? 'end' : start < today() ? 'start' : 'end') : undefined)
    return toAway(reply, person.linkToken, 'days-off-added')
  })

  app.post('/f/:token/away/:id/remove', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const away = await getAway(db, req.params.id!)
    if (!away || away.personId !== person.id) return toAway(reply, person.linkToken, 'days-off-gone')
    const result = await run(req, person.id, 'unavailability.remove', { id: away.id })
    if (result.status === 'rejected') return toAway(reply, person.linkToken, result)
    return toAway(reply, person.linkToken, 'days-off-removed')
  })

  /**
   * Share their own calendar (ADR 0044): read there and then, so a wrong
   * address is said beside where it was pasted, with what was pasted kept
   * (rule 11). The address goes in the body, which no log writes down.
   */
  app.post('/f/:token/calendar', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const form = (req.body ?? new URLSearchParams()) as Form
    const inSection = (what: Said) => reply.redirect(`/f/${person.linkToken}?${new URLSearchParams({ ...told(what), s: 'calendar' })}#calendar`, 303)
    if (!ownCalendars) return back(reply, person.linkToken, 'try-again')
    try {
      await ownCalendars.share({ personId: person.id, address: form.get('address') ?? '', by: 'self', who: { link: person.id, device: describeDevice(req.headers['user-agent']) } })
    } catch (err) {
      if (!(err instanceof Refused)) throw err
      // What's wrong with the address, or with reading it, is said under it.
      return refused(req, reply, person, { id: '', status: 'rejected', reason: err.reason }, { form: 'calendar', values: form }, { section: 'calendar', ...(err.reason.code === 'invalid' ? { field: 'address' } : {}) })
    }
    return inSection('calendar-shared')
  })

  // Stop sharing it, in one tap: the address and the busy times deleted.
  app.post('/f/:token/calendar/stop', async (req: Req, reply) => {
    const person = await personByToken(db, req.params.token)
    if (!person) return gone(reply)
    const result = await run(req, person.id, 'ownCalendar.stop', { personId: person.id })
    return reply.redirect(`/f/${person.linkToken}?${new URLSearchParams({ ...told(result.status === 'rejected' ? result : 'calendar-stopped'), s: 'calendar' })}#calendar`, 303)
  })

  // Both feed addresses answer from memory, so calendar apps looking every hour don't wake the database.
  app.get('/cal/:token', async (req: Req, reply) => {
    const code = req.params.token.replace(/\.ics$/, '')
    return sendFeed(req, reply, /^[\w-]{24}$/.test(code) ? await feeds.byCode(code) : undefined)
  })

  /** The first address, at the private link (ADR 0002): kept so no one already subscribed is cut off. */
  app.get('/f/:token/calendar.ics', async (req: Req, reply) => {
    const token = req.params.token
    return sendFeed(req, reply, token.length >= 16 ? await feeds.byLink(token) : undefined)
  })

  /** Everything held on this person, as the "download your data" promise says. */
  app.get('/f/:token/data.json', async (req: Req, reply) => {
    noStore(reply)
    const person = await personByToken(db, req.params.token)
    if (!person) return reply.code(404).send({ error: 'Not found' })
    const { linkToken: _secret, ...profile } = person
    return reply.header('content-disposition', 'attachment; filename="session-hire-my-data.json"').send({
      exportedAt: new Date().toISOString(),
      profile,
      daysOff: await awayFor(db, person.id),
      jobs: await offersFor(db, person.id),
      timesheets: [...(await timesheetsFor(db, person.id)).values()],
      runningLate: await lateOf(db, person.id),
      // The details; each file is on their page (ADR 0029).
      documents: await documentsOf(db, person.id),
      // When they're busy, as read from their own calendar (ADR 0044); its address stays out, as their link does.
      ownCalendar: (await getOwnCalendar(db, person.id)) ?? null,
      // What they asked to be bought, and what they voted for (ADR 0108).
      purchases: await purchasesFor(db, person.id).then((all) => ({
        asked: all.filter((r) => r.askedBy === person.id).map(({ askerName: _a, mine: _m, ...r }) => r),
        votedFor: all.filter((r) => r.mine).map((r) => r.title),
      })),
    })
  })
}
