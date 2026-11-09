import { DEFAULT_CREW_PER_CAR, QUOTE_SETTINGS_ID, type ClientDiscount, type CostPaid, type Department, type Package, type PackageItem, type ProductPrice, type Quote, type QuoteEmail, type QuoteSettings, type RateRule, type RolePrice } from '@sh/shared'
import { randomBytes } from 'node:crypto'
import type { Queryable } from '../db.ts'

/** Reading money's records back as the entities devices see (ADR 0042). */

type Row = Record<string, any>

const QUOTE = `id, project_id, version, status, lines, discount_pct, notes, made_at, saved_at,
  sent_on::text AS sent_on, answered_on::text AS answered_on, invoiced_on::text AS invoiced_on, invoice_ref, paid_on::text AS paid_on, number, valid_days, deposit_pct, agreed_cents, meals_provided, travel_km, declined_why, declined_note,
  accept_token, accepted_name, accepted_at, for_name`

const toQuote = (r: Row): Quote => ({
  id: r.id,
  projectId: r.project_id,
  version: r.version,
  status: r.status,
  lines: r.lines,
  discountPct: Number(r.discount_pct),
  notes: r.notes,
  madeAt: new Date(r.made_at).toISOString(),
  savedAt: new Date(r.saved_at).toISOString(),
  sentOn: r.sent_on,
  answeredOn: r.answered_on,
  invoicedOn: r.invoiced_on,
  invoiceRef: r.invoice_ref,
  paidOn: r.paid_on,
  number: r.number ?? null,
  validDays: r.valid_days,
  depositPct: r.deposit_pct ?? null,
  agreedCents: r.agreed_cents === null || r.agreed_cents === undefined ? null : Number(r.agreed_cents),
  mealsProvided: r.meals_provided,
  travelKm: r.travel_km ?? null,
  declinedWhy: r.declined_why ?? null,
  declinedNote: r.declined_note ?? '',
  // Who it's for (ADR 0128), only once set, so a device or a test that knows nothing of it sees the quote as before.
  ...(r.for_name ? { forName: r.for_name } : {}),
  // The client's link and their online yes (ADR 0121), only once there is one, so a device or a test that knows nothing of them sees the quote as before.
  ...(r.accept_token ? { acceptToken: r.accept_token } : {}),
  ...(r.accepted_name ? { acceptedOnline: { name: r.accepted_name, at: new Date(r.accepted_at).toISOString() } } : {}),
})

/** The version a client's link opens (ADR 0121), by its key. */
export async function quoteByToken(q: Queryable, token: string): Promise<Quote | undefined> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return undefined
  // A deleted version's link opens nothing (ADR 0131).
  const { rows } = await q.query(`SELECT ${QUOTE} FROM quotes WHERE accept_token = $1 AND deleted_at IS NULL`, [token])
  return rows[0] ? toQuote(rows[0]) : undefined
}

/** A new key for a client's link: 144 random bits, written as a link carries them. */
export const newAcceptToken = () => randomBytes(18).toString('base64url')

/** A version, unless it's been deleted (ADR 0131): then it's as if it weren't there, but to put it back. */
export async function getQuote(q: Queryable, id: string, lock = false, deleted = false): Promise<Quote | undefined> {
  const { rows } = await q.query(`SELECT ${QUOTE} FROM quotes WHERE id = $1${deleted ? '' : ' AND deleted_at IS NULL'}${lock ? ' FOR UPDATE' : ''}`, [id])
  return rows[0] ? toQuote(rows[0]) : undefined
}

/** Whether a version has been deleted (ADR 0131). */
export async function isDeleted(q: Queryable, id: string): Promise<boolean> {
  const { rows } = await q.query('SELECT 1 FROM quotes WHERE id = $1 AND deleted_at IS NOT NULL', [id])
  return rows.length > 0
}

/** A job's versions, newest first, leaving out any deleted. */
export async function quotesOf(q: Queryable, projectId: string): Promise<Quote[]> {
  const { rows } = await q.query(`SELECT ${QUOTE} FROM quotes WHERE project_id = $1 AND deleted_at IS NULL ORDER BY version DESC`, [projectId])
  return rows.map(toQuote)
}

/**
 * A job's highest version and its quote number, counting deleted ones (ADR 0131): a new version is numbered after a
 * deleted one, so putting that back never finds its number taken, and the job keeps its one quote number.
 */
export async function versionsEver(q: Queryable, projectId: string): Promise<{ top: number; number: number | null }> {
  const { rows } = await q.query<{ top: number | null; number: number | null }>('SELECT max(version) AS top, max(number) AS number FROM quotes WHERE project_id = $1', [projectId])
  return { top: Number(rows[0]?.top ?? 0), number: rows[0]?.number ?? null }
}

/** The emails that went with a version (ADR 0101), so they go and come back with it (ADR 0131). */
export async function emailsOf(q: Queryable, quoteId: string): Promise<string[]> {
  const { rows } = await q.query<{ id: string }>('SELECT id FROM quote_emails WHERE quote_id = $1 ORDER BY sent_at', [quoteId])
  return rows.map((r) => r.id)
}

export async function getProductPrice(q: Queryable, modelId: string): Promise<ProductPrice | undefined> {
  const { rows } = await q.query<{ model_id: string; day_cents: number; rate: RateRule | null }>('SELECT model_id, day_cents, rate FROM product_prices WHERE model_id = $1', [modelId])
  // The rule only once set, so a device or a test that knows nothing of rules sees the price as before.
  return rows[0] ? { id: rows[0].model_id, dayCents: rows[0].day_cents, ...(rows[0].rate ? { rate: rows[0].rate } : {}) } : undefined
}

export async function getPackage(q: Queryable, id: string): Promise<Package | undefined> {
  const { rows } = await q.query<{ id: string; name: string; department: Department; day_cents: number; rate: RateRule; items: PackageItem[]; notes: string }>(
    'SELECT id, name, department, day_cents, rate, items, notes FROM packages WHERE id = $1',
    [id]
  )
  const r = rows[0]
  return r ? { id: r.id, name: r.name, department: r.department, dayCents: r.day_cents, rate: r.rate, items: r.items, notes: r.notes } : undefined
}

export async function getRolePrice(q: Queryable, id: string): Promise<RolePrice | undefined> {
  const { rows } = await q.query<{ id: string; role: string; day_cents: number }>('SELECT id, role, day_cents FROM role_prices WHERE id = $1', [id])
  return rows[0] ? { id: rows[0].id, role: rows[0].role, dayCents: rows[0].day_cents } : undefined
}

export async function getClientDiscount(q: Queryable, clientId: string): Promise<ClientDiscount | undefined> {
  const { rows } = await q.query<{ client_id: string; pct: string }>('SELECT client_id, pct FROM client_discounts WHERE client_id = $1', [clientId])
  return rows[0] ? { id: rows[0].client_id, pct: Number(rows[0].pct) } : undefined
}

export async function getCostPaid(q: Queryable, timesheetId: string): Promise<CostPaid | undefined> {
  const { rows } = await q.query<{ timesheet_id: string; paid_on: string }>('SELECT timesheet_id, paid_on::text AS paid_on FROM cost_payments WHERE timesheet_id = $1', [timesheetId])
  return rows[0] ? { id: rows[0].timesheet_id, paidOn: rows[0].paid_on } : undefined
}

/** The day each of these timesheets was paid, where the office has said (audit, 5 November 2026, finding 65). */
export async function paidOnFor(q: Queryable, timesheetIds: readonly string[]): Promise<Map<string, string>> {
  if (!timesheetIds.length) return new Map()
  const { rows } = await q.query<{ timesheet_id: string; paid_on: string }>('SELECT timesheet_id, paid_on::text AS paid_on FROM cost_payments WHERE timesheet_id = ANY($1::text[])', [
    [...timesheetIds],
  ])
  return new Map(rows.map((r) => [r.timesheet_id, r.paid_on]))
}

/** What every printed quote says (ADR 0084), once anything about it is saved or a number given. */
export async function getQuoteSettings(q: Queryable): Promise<QuoteSettings | undefined> {
  const { rows } = await q.query<Row>(
    `SELECT id, next_number, terms, bank, travel_from_km, fuel_cents_per_litre, litres_per_100_km, per_diem_cents, fuel_set_on::text AS fuel_set_on, fuel_auto, fuel_month, crew_per_car, email_quotes, accept_online
     FROM quote_settings WHERE id = $1`,
    [QUOTE_SETTINGS_ID]
  )
  const r = rows[0]
  if (!r) return undefined
  // Sending quotes by email (ADR 0101) only once it's on, so a device or a test that knows nothing of it sees the settings as before.
  const settings: QuoteSettings = { id: r.id, nextNumber: r.next_number, terms: r.terms, bank: r.bank, ...(r.email_quotes ? { emailQuotes: true } : {}), ...(r.accept_online ? { acceptOnline: true } : {}) }
  // Travel and subsistence (ADR 0086) once they've been set, which sets them all: until then each takes its default.
  if (r.travel_from_km === null) return settings
  const n = (v: unknown) => (v === null ? null : Number(v))
  return {
    ...settings,
    travelFromKm: r.travel_from_km,
    fuelCentsPerLitre: n(r.fuel_cents_per_litre),
    litresPer100Km: Number(r.litres_per_100_km),
    perDiemCents: r.per_diem_cents,
    fuelSetOn: r.fuel_set_on,
    fuelAuto: r.fuel_auto,
    fuelMonth: r.fuel_month,
    crewPerCar: r.crew_per_car ?? DEFAULT_CREW_PER_CAR,
  }
}

/** The highest quote number given so far, or 0: a deleted version's too, so no number is given twice (ADR 0131). */
export async function highestNumber(q: Queryable): Promise<number> {
  const { rows } = await q.query<{ n: number | null }>('SELECT max(number) AS n FROM quotes')
  return Number(rows[0]?.n ?? 0)
}

// A quote emailed to the client (ADR 0101): the record every device sees, and the PDF that went, kept here.

const QUOTE_EMAIL = `e.id, e.quote_id, e.project_id, e.version, e.number, e.sent_at, e.from_address, e.to_addresses, e.subject, coalesce(u.name, '') AS by`
const toQuoteEmail = (r: Row): QuoteEmail => ({
  id: r.id,
  quoteId: r.quote_id,
  projectId: r.project_id,
  version: r.version,
  number: r.number ?? null,
  at: new Date(r.sent_at).toISOString(),
  by: r.by,
  from: r.from_address,
  to: r.to_addresses,
  subject: r.subject,
})

export async function getQuoteEmail(q: Queryable, id: string): Promise<QuoteEmail | undefined> {
  const { rows } = await q.query<Row>(`SELECT ${QUOTE_EMAIL} FROM quote_emails e LEFT JOIN users u ON u.id = e.sent_by WHERE e.id = $1`, [id])
  return rows[0] ? toQuoteEmail(rows[0]) : undefined
}

/** The PDF that went in an email, with what to call the file. */
export async function getQuoteEmailPdf(q: Queryable, id: string): Promise<{ bytes: Buffer; version: number; number: number | null; projectId: string } | undefined> {
  const { rows } = await q.query<Row>('SELECT pdf_base64, version, number, project_id FROM quote_emails WHERE id = $1', [id])
  const r = rows[0]
  return r ? { bytes: Buffer.from(r.pdf_base64, 'base64'), version: r.version, number: r.number ?? null, projectId: r.project_id } : undefined
}
