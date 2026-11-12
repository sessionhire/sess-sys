import { createHash } from 'node:crypto'
import {
  ASKED_STATUSES,
  calendarDayId,
  calendarTitles,
  dayLabel,
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  eachDay,
  euroText,
  firstName,
  HOLD_WORDS,
  holdTitle,
  JOB_STAGES,
  STAGE_LABELS,
  type Department,
  type JobStage,
  type QuoteLine,
} from '@sh/shared'
import type { Queryable } from '../db.ts'
import type { EventBody } from './google.ts'

/**
 * What the calendar should hold (ADR 0008): one all-day event for every day
 * of every phase of a confirmed job, from today on, in the shape crew know
 * from today's calendar, worked out afresh from the jobs each time. And who
 * would be invited to each (ADR 0009): everyone offered the day or booked on
 * it, who has an email address in the app.
 */

/** Someone to invite to a day's event, because of an offer. */
export interface WantedGuest {
  personId: string
  offerId: string
  email: string
}

export interface Wanted {
  /** `calendarDayId(phaseId, day)`; a personal copy adds `/<person id>`. */
  key: string
  /**
   * Set on a person's own copy of the day (1.163.0, Colly's choice): the event goes on the connected account's own
   * calendar with that person as its only guest, greeting them and naming their role. The shared day on the jobs
   * calendar then has no guests.
   */
  personId?: string
  phaseId: string
  projectId: string
  day: string
  title: string
  body: EventBody
  /** Changes whenever anything in the event would, but its guests. */
  hash: string
  /** People offered the day or booked on it, with an address to invite, by person id. */
  guests: WantedGuest[]
  /** People offered the day or booked on it with no email address in the app, so never invited, by name. */
  noEmail: string[]
}

export interface CrewLine {
  role: string
  callTime: string | null
  confirmed: string[]
  /** Said yes, not yet confirmed by the office. */
  toConfirm: string[]
  /** Places nobody holds yet. */
  missing: number
}

export interface DayFacts {
  job: string
  /** Where the job is on its way (ADR 0104), worked out as the job page does from its status, dates and scans. */
  stage: JobStage
  /** Crew are asked before the client has said yes (ADR 0008, 1.162.0): they're asked to hold the day, and it isn't booked (ADR 0150). */
  hold: boolean
  client: string | null
  phase: string
  /** Where this day falls in the phase, from 1. */
  dayNumber: number
  phaseStart: string
  phaseEnd: string
  venue: { name: string; address: string; notes: string } | null
  jobNotes: string
  phaseNotes: string
  crew: CrewLine[]
  /** The day's pick list: the phase's kit and the whole job's, a line per product. */
  kit: KitItem[]
  /** Per diems and fuel, as the job's quote has them; null with no quote, when nothing is known. */
  allowances: Allowances | null
  /** The job in the app, when the app knows its own address. */
  appLink: string | null
}

export interface KitItem {
  department: Department
  category: string
  product: string
  qty: number
  /** How many of them are hired in from another company. */
  subhireQty: number
}

/** What the job's quote covers for the crew (ADR 0086), so they know before they say yes. */
export interface Allowances {
  /** The per diem a day when the quote charges subsistence, else null. */
  perDiemCents: number | null
  /** The job gives the crew their meals, so there's no per diem. */
  mealsProvided: boolean
  /** Fuel for a car there and back when the quote charges travel, else null. */
  fuelCents: number | null
  /** How far each way, when the travel line says. */
  km: number | null
}

/** What a person's own copy of a day says to them first: asking, thanking, or telling them where they stand. */
export interface Greeting {
  /** The name they go by, as their page and the office's messages greet them (audit of 12 November 2026, finding 15). */
  first: string
  role: string
  callTime: string | null
  status: string
  day: string
  /** The client hasn't said yes to the job yet (ADR 0150): they're asked to hold the day, and nothing says "booked". */
  hold?: boolean
}

export function greeting(g: Greeting): string {
  const what = `${g.role} on ${dayLabel(g.day)}${g.callTime ? `, call ${g.callTime}` : ''}`
  // A rate asked for waits on the office, and a Yes or No pressed on the invite settles nothing (finding 7), so it asks for neither.
  if (g.status === 'countered') return `Thanks ${g.first}, your rate request for ${what} is with the office. Nothing is agreed yet: we'll come back to you.`
  if (g.hold) {
    if (g.status === 'confirmed') return `Hi ${g.first}, we have you down as ${what}. Please hold the day: it's booked once the client says yes.`
    if (g.status === 'accepted') return `Thanks ${g.first}, you said yes to ${what}. Please hold the day: it isn't booked yet, and we'll confirm it with you.`
    return `Hi ${g.first}, can you hold ${dayLabel(g.day)} for us, to work as ${g.role}${g.callTime ? `, call ${g.callTime}` : ''}? Press Yes or No on this invite to let us know.`
  }
  if (g.status === 'confirmed') return `Hi ${g.first}, you're booked as ${what}. Here's the info for the day.`
  if (g.status === 'accepted') return `Thanks ${g.first}, you said yes to ${what}. We'll confirm it with you soon. Here's the info for the day.`
  return `Hi ${g.first}, are you available to work as ${what}? Press Yes or No on this invite to let us know.`
}

/**
 * The second line of a person's own copy (audit of 12 November 2026, finding 10): the day to answer by, and their page,
 * which has what the invite leaves out by rule, their rate and the call's own notes. The way to it was the description's
 * last line, under the crew, the notes and the pick list, and a Yes on the invite is a full acceptance. Staff are paid
 * through payroll, so theirs names no rate. Nothing when there's neither a day to say nor a page to point at.
 */
export function pageLine(g: { status: string; replyBy: string | null; staff: boolean; link: string | null }): string {
  const by = g.status === 'offered' && g.replyBy ? `Please answer by ${dayLabel(g.replyBy)}.` : ''
  if (!g.link) return by
  if (g.status === 'countered') return `To change your answer or see the details, use your page: ${g.link}`
  if (g.status === 'offered') return `${by ? `${by} ` : ''}${g.staff ? 'The details are' : 'Your rate and the details are'} on your page, where you can answer too: ${g.link}`
  return `${g.staff ? 'The call sheet and the details are' : 'Your rate, the call sheet and the details are'} on your page: ${g.link}`
}

const DESCRIPTION_MAX = 8000

/** The venue and its address on one line, for Google's location (which links it to Maps). */
export function location(v: DayFacts['venue']): string {
  if (!v) return ''
  const address = v.address
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(', ')
  const text = !address ? v.name : address.toLowerCase().startsWith(v.name.toLowerCase()) ? address : `${v.name}, ${address}`
  return text.slice(0, 1000)
}

/**
 * A role and who has it: the people the office has confirmed by name, and every other place as TBC (Colly, 11 November
 * 2026), so nobody reads a yes not yet confirmed, or an ask, as a booking.
 */
function crewLine(c: CrewLine): string {
  const tbc = c.toConfirm.length + c.missing
  const who = [...c.confirmed, ...(tbc ? [tbc === 1 ? 'TBC' : `${tbc} TBC`] : [])]
  return `${c.role}${c.callTime ? `, call ${c.callTime}` : ''}: ${who.join(', ')}`
}

/**
 * The event's description: the day's job sheet, names only (never rates or phone numbers). `max` is the room it has: a
 * person's own copy opens with lines of its own, and the whole stays inside what Google takes.
 */
export function description(f: DayFacts, max = DESCRIPTION_MAX): string {
  const days = eachDay(f.phaseStart, f.phaseEnd).length
  const when = days > 1 ? `${f.phase}, day ${f.dayNumber} of ${days}: ${dayLabel(f.phaseStart)} to ${dayLabel(f.phaseEnd)}` : `${f.phase}, ${dayLabel(f.phaseStart)}`
  const blocks: string[] = [stageLine(f), [f.client ? `Client: ${f.client}` : '', when].filter(Boolean).join('\n')]
  if (f.venue) {
    blocks.push(
      [`Venue: ${f.venue.name}`, f.venue.address.trim().replace(/\s*\r?\n\s*/g, ', '), f.venue.notes.trim() ? `At the venue: ${f.venue.notes.trim()}` : '']
        .filter(Boolean)
        .join('\n')
    )
  }
  if (f.crew.length) blocks.push(['Crew', ...f.crew.map(crewLine)].join('\n'))
  if (f.jobNotes.trim()) blocks.push(`Job notes\n${f.jobNotes.trim()}`)
  if (f.phaseNotes.trim()) blocks.push(`${f.phase} notes\n${f.phaseNotes.trim()}`)
  if (f.allowances) blocks.push(allowancesText(f.allowances))
  const kit = pickList(f.kit)
  if (kit) blocks.push(kit)
  const text = blocks.join('\n\n')
  // The link to the job always fits: a long pick list is cut short before it is.
  const link = f.appLink ? `\n\nThe job in the Session Hire app: ${f.appLink}` : ''
  const room = max - link.length
  return `${text.length > room ? `${text.slice(0, room - 1)}…` : text}${link}`
}

/** The job's stage, and what HOLD in the title asks of the crew (ADR 0150), as the first thing on the event. */
export function stageLine(f: Pick<DayFacts, 'stage' | 'hold'>): string {
  const stage = `Job stage: ${STAGE_LABELS[f.stage]} (${JOB_STAGES.indexOf(f.stage) + 1} of ${JOB_STAGES.length})`
  return f.hold ? `${HOLD_WORDS.onCalendar}\n${stage}` : stage
}

/**
 * The stage from the job's records, as the job page works it out (shared/src/sync/steps-view.ts): not confirmed is
 * still Quoting; on its days it's On the job once kit has gone out (or Going out while there's kit and none has);
 * before them, Going out once any kit has gone, else Planning; after them, Back.
 */
export function stageOf(j: { status: string; start: string; end: string; hasKit: boolean; kitOut: boolean }, today: string): JobStage {
  if (j.status !== 'confirmed') return 'selling'
  if (j.end < today) return 'back'
  if (j.start <= today) return j.hasKit && !j.kitOut ? 'going' : 'on'
  return j.kitOut ? 'going' : 'planning'
}

const euro = (cents: number) => `€${euroText(cents)}`

/** Per diems and fuel in words for crew: what the quote covers, never what the client is charged for anything else. */
export function allowancesText(a: Allowances): string {
  const pd =
    a.perDiemCents !== null
      ? `Per diems: approved, ${euro(a.perDiemCents)} a day each`
      : a.mealsProvided
        ? 'Per diems: not approved, as meals are provided'
        : 'Per diems: not approved'
  const fuel = a.fuelCents !== null ? `Fuel: covered, about ${euro(a.fuelCents)} a car there and back${a.km !== null ? ` (${a.km} km each way)` : ''}` : 'Fuel: not covered'
  return ['Per diems and fuel', pd, fuel].join('\n')
}

/** What the quote covers for crew, from its travel and subsistence lines (ADR 0086). */
export function allowancesOf(lines: readonly QuoteLine[], mealsProvided: boolean): Allowances {
  const sub = lines.find((l) => l.extra === 'subsistence')
  const travel = lines.find((l) => l.extra === 'travel')
  const km = travel ? /(\d+) km each way/.exec(travel.what)?.[1] : undefined
  return {
    perDiemCents: sub ? sub.unitCents : null,
    mealsProvided,
    fuelCents: travel ? travel.unitCents : null,
    km: km ? Number(km) : null,
  }
}

/** The day's kit as a list under a heading for each department, in the departments' usual order. Quantities only, never prices. */
export function pickList(kit: readonly KitItem[]): string {
  if (!kit.length) return ''
  const groups = DEPARTMENTS.map((d) => ({
    d,
    items: kit.filter((k) => k.department === d).sort((a, b) => a.category.localeCompare(b.category) || a.product.localeCompare(b.product)),
  })).filter((g) => g.items.length)
  const item = (k: KitItem) => `• ${k.qty} × ${k.product}${k.subhireQty ? ` (${k.subhireQty === k.qty ? 'all' : k.subhireQty} hired in)` : ''}`
  return ['Pick list', ...groups.map((g) => [DEPARTMENT_LABELS[g.d], ...g.items.map(item)].join('\n'))].join('\n\n')
}

const BASE32HEX = '0123456789abcdefghijklmnopqrstuv'

/**
 * The event's id, worked out rather than made up, so writing the same day
 * twice (after a crash, or from two servers during a deploy) finds the
 * first event instead of making a second. Google allows only the base32hex
 * letters a to v and digits. `generation` moves on when an event has gone
 * for good and a new one has to be made.
 */
export function eventId(appKey: string, calendarId: string, phaseId: string, day: string, generation: number): string {
  const digest = createHash('sha256').update([appKey, calendarId, phaseId, day, generation].join('|')).digest()
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of digest) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32HEX[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= 0xff
  }
  return out.slice(0, 40)
}

interface PhaseRow {
  phase_id: string
  phase: string
  start_day: string
  end_day: string
  phase_notes: string
  project_id: string
  job: string
  status: string
  job_start: string
  job_end: string
  has_kit: boolean
  kit_out: boolean
  job_notes: string
  client: string | null
  venue_name: string | null
  venue_address: string | null
  venue_notes: string | null
}

interface KitRow {
  project_id: string
  phase_id: string | null
  model_id: string
  product: string
  department: Department
  category: string
  qty: number
  subhire_qty: number
}

interface QuoteRow {
  project_id: string
  lines: QuoteLine[]
  meals_provided: boolean
}

interface CallRow {
  id: string
  project_id: string
  phase_id: string | null
  role: string
  call_time: string | null
  needed: number
  start_day: string
  end_day: string
  /** The day to answer by, when the office set one. */
  reply_by: string | null
  offers: { id: string; status: string; days: string[]; personId: string; name: string; first: string; knownAs: string | null; kind: string; email: string | null; token: string }[]
}

/** Which offer a person is invited by when two cover the same day: the one that holds it, then the one furthest on. */
const RANK: Record<string, number> = { confirmed: 0, accepted: 1, countered: 2, offered: 3 }

/** Everything that should be on the calendar from `today` on, by `calendarDayId`. */
export async function wantedEvents(
  q: Queryable,
  {
    today,
    appKey,
    appUrl,
    personal = false,
  }: {
    today: string
    appKey: string
    appUrl: string | null
    /** Each guest gets their own copy of the day, and the shared day has none (invites on). */
    personal?: boolean
  }
): Promise<Map<string, Wanted>> {
  const { rows: phases } = await q.query<PhaseRow>(
    `SELECT ph.id AS phase_id, ph.name AS phase, ph.start_day::text, ph.end_day::text, ph.notes AS phase_notes,
            p.id AS project_id, p.name AS job, p.status, p.notes AS job_notes, c.name AS client,
            (SELECT min(start_day)::text FROM phases WHERE project_id = p.id) AS job_start,
            (SELECT max(end_day)::text FROM phases WHERE project_id = p.id) AS job_end,
            EXISTS (SELECT 1 FROM kit_lines WHERE project_id = p.id) AS has_kit,
            EXISTS (SELECT 1 FROM movements m WHERE m.project_id = p.id AND m.direction = 'out' AND m.undoes IS NULL
                     AND NOT EXISTS (SELECT 1 FROM movements u WHERE u.undoes = m.id)) AS kit_out,
            v.name AS venue_name, v.address AS venue_address, v.notes AS venue_notes
       FROM phases ph
       JOIN projects p ON p.id = ph.project_id
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN venues v ON v.id = coalesce(ph.venue_id, p.venue_id)
      WHERE p.source_calendar IS NULL AND ph.end_day >= $1::date
        AND (p.status = 'confirmed'
             -- Not yet a yes, but crew are asked for it: on the calendar as HOLD, hold the day (ADR 0008, 1.162.0; ADR 0150).
             OR (p.status IN ('enquiry', 'quoted') AND EXISTS (
                   SELECT 1 FROM crew_calls cc JOIN offers o ON o.call_id = cc.id
                    WHERE cc.project_id = p.id AND cc.status = 'open' AND o.status = ANY($2::text[]))))
      ORDER BY ph.start_day, ph.id`,
    [today, ASKED_STATUSES]
  )
  const projectIds = [...new Set(phases.map((p) => p.project_id))]
  const { rows: calls } = projectIds.length
    ? await q.query<CallRow>(
        `SELECT cc.id, cc.project_id, cc.phase_id, cc.role, cc.call_time, cc.needed, cc.start_day::text, cc.end_day::text, cc.reply_by::text,
                coalesce(json_agg(json_build_object('id', o.id, 'status', o.status, 'days', o.days, 'personId', pe.id, 'name', pe.name, 'first', pe.first_name,
                                                    'knownAs', pe.known_as, 'kind', pe.kind, 'email', pe.email, 'token', pe.link_token)
                                  ORDER BY pe.name, o.id)
                         FILTER (WHERE o.id IS NOT NULL), '[]') AS offers
           FROM crew_calls cc
           LEFT JOIN offers o ON o.call_id = cc.id AND o.status IN ('offered', 'countered', 'accepted', 'confirmed')
           LEFT JOIN people pe ON pe.id = o.person_id
          WHERE cc.status = 'open' AND cc.project_id = ANY($1::text[]) AND cc.end_day >= $2::date
          GROUP BY cc.id
          ORDER BY cc.role, cc.call_time NULLS LAST, cc.id`,
        [projectIds, today]
      )
    : { rows: [] as CallRow[] }
  const { rows: kitRows } = projectIds.length
    ? await q.query<KitRow>(
        `SELECT k.project_id, k.phase_id, k.model_id, m.name AS product, m.department, m.category,
                sum(k.qty)::int AS qty, sum(k.subhire_qty)::int AS subhire_qty
           FROM kit_lines k
           JOIN models m ON m.id = k.model_id
          WHERE k.project_id = ANY($1::text[])
          GROUP BY k.project_id, k.phase_id, k.model_id, m.name, m.department, m.category`,
        [projectIds]
      )
    : { rows: [] as KitRow[] }
  // Each job's quote that counts: the one accepted, else the latest.
  const { rows: quoteRows } = projectIds.length
    ? await q.query<QuoteRow>(
        `SELECT DISTINCT ON (project_id) project_id, lines, meals_provided
           FROM quotes
          WHERE project_id = ANY($1::text[]) AND deleted_at IS NULL AND status <> 'declined'
          ORDER BY project_id, (status = 'accepted') DESC, version DESC`,
        [projectIds]
      )
    : { rows: [] as QuoteRow[] }
  const allowancesByJob = new Map(quoteRows.map((r) => [r.project_id, allowancesOf(r.lines, r.meals_provided)]))

  const out = new Map<string, Wanted>()
  for (const p of phases) {
    // The phase's own kit and the whole job's, a line per product.
    const kitByModel = new Map<string, KitItem>()
    for (const k of kitRows) {
      if (k.project_id !== p.project_id || (k.phase_id !== null && k.phase_id !== p.phase_id)) continue
      const had = kitByModel.get(k.model_id)
      if (had) {
        had.qty += k.qty
        had.subhireQty += k.subhire_qty
      } else kitByModel.set(k.model_id, { department: k.department, category: k.category, product: k.product, qty: k.qty, subhireQty: k.subhire_qty })
    }
    const kit = [...kitByModel.values()]
    const days = eachDay(p.start_day, p.end_day)
    const hold = p.status !== 'confirmed'
    const stage = stageOf({ status: p.status, start: p.job_start, end: p.job_end, hasKit: p.has_kit, kitOut: p.kit_out }, today)
    const titles = calendarTitles(p.job, { name: p.phase, start: p.start_day, end: p.end_day }).map((t) => (hold ? holdTitle(t) : t))
    days.forEach((day, i) => {
      if (day < today) return
      const covering = calls.filter(
        (c) => c.project_id === p.project_id && (c.phase_id === p.phase_id || c.phase_id === null) && c.start_day <= day && day <= c.end_day
      )
      const crew = covering.map((c): CrewLine => {
        const on = c.offers.filter((o) => (o.status === 'accepted' || o.status === 'confirmed') && o.days.includes(day))
        return {
          role: c.role,
          callTime: c.call_time,
          confirmed: on.filter((o) => o.status === 'confirmed').map((o) => o.name),
          toConfirm: on.filter((o) => o.status === 'accepted').map((o) => o.name),
          missing: Math.max(0, c.needed - on.length),
        }
      })
      const invited = new Map<string, WantedGuest & { rank: number; offer: CallRow['offers'][number]; call: CallRow }>()
      const noEmail = new Set<string>()
      for (const [c, o] of covering.flatMap((c) => c.offers.map((o) => [c, o] as const))) {
        if (!o.days.includes(day)) continue
        const email = o.email?.trim()
        if (!email) {
          noEmail.add(o.name)
          continue
        }
        const had = invited.get(o.personId)
        const rank = RANK[o.status] ?? 9
        if (!had || rank < had.rank || (rank === had.rank && o.id < had.offerId)) invited.set(o.personId, { personId: o.personId, offerId: o.id, email, rank, offer: o, call: c })
      }
      const guests = [...invited.values()]
        .map(({ personId, offerId, email }) => ({ personId, offerId, email }))
        .sort((a, b) => a.personId.localeCompare(b.personId))
      const facts: DayFacts = {
        job: p.job,
        stage,
        hold,
        client: p.client,
        phase: p.phase,
        dayNumber: i + 1,
        phaseStart: p.start_day,
        phaseEnd: p.end_day,
        venue: p.venue_name !== null ? { name: p.venue_name, address: p.venue_address ?? '', notes: p.venue_notes ?? '' } : null,
        jobNotes: p.job_notes,
        phaseNotes: p.phase_notes,
        crew,
        kit,
        allowances: allowancesByJob.get(p.project_id) ?? null,
        appLink: appUrl ? `${appUrl}/#jobs/${p.project_id}` : null,
      }
      const next = new Date(`${day}T12:00:00Z`)
      next.setUTCDate(next.getUTCDate() + 1)
      const body: EventBody = {
        summary: titles[i]!,
        location: location(facts.venue),
        description: description(facts),
        start: { date: day },
        end: { date: next.toISOString().slice(0, 10) },
        status: 'confirmed',
        extendedProperties: { private: { sh: appKey, shJob: p.project_id, shPhase: p.phase_id, shDay: day } },
        guestsCanSeeOtherGuests: false,
        guestsCanInviteOthers: false,
      }
      const key = calendarDayId(p.phase_id, day)
      const hash = (b: EventBody) => createHash('sha256').update(JSON.stringify(b)).digest('base64url').slice(0, 32)
      out.set(key, {
        key,
        phaseId: p.phase_id,
        projectId: p.project_id,
        day,
        title: titles[i]!,
        body,
        hash: hash(body),
        guests: personal ? [] : guests,
        noEmail: [...noEmail].sort(),
      })
      if (!personal) return
      // Each person's own copy: their greeting first, by the name they go by, and where they stand; then their page, which has their
      // rate and how to answer; then the day as everyone sees it. All of it description, so a change to it is never emailed (ADR 0009).
      for (const g of invited.values()) {
        const first = firstName({ name: g.offer.name, knownAs: g.offer.knownAs, firstName: g.offer.first }) || 'there'
        const hello = greeting({ first, role: g.call.role, callTime: g.call.call_time, status: g.offer.status, day, hold })
        const page = pageLine({
          status: g.offer.status,
          // A day to answer by that has gone isn't asked for again.
          replyBy: g.call.reply_by !== null && g.call.reply_by >= today ? g.call.reply_by : null,
          staff: g.offer.kind === 'staff',
          link: appUrl ? `${appUrl}/f/${g.offer.token}` : null,
        })
        const lead = [hello, page].filter(Boolean).join('\n')
        const mine: EventBody = {
          ...body,
          description: `${lead}\n\n${description({ ...facts, appLink: null }, DESCRIPTION_MAX - lead.length - 2)}`,
          extendedProperties: { private: { ...body.extendedProperties.private, shPerson: g.personId } },
        }
        const personKey = `${key}/${g.personId}`
        out.set(personKey, {
          key: personKey,
          personId: g.personId,
          phaseId: p.phase_id,
          projectId: p.project_id,
          day,
          title: titles[i]!,
          body: mine,
          hash: hash(mine),
          guests: [{ personId: g.personId, offerId: g.offerId, email: g.email }],
          noEmail: [],
        })
      }
    })
  }
  return out
}
