import { ASSISTANT_SETTING_ID, CABLES_SETTING_ID, LINKS_SETTING_ID, LOGO_SETTING_ID, WHATSAPP_SETTING_ID, type WhatsAppMode, MESSAGES_SETTING_ID, OFFICE_SETTING_ID, officeContact, READING_SETTING_ID, TIMESHEETS_SETTING_ID, type OfficeDetails, type Setting, type TimesheetAsking } from '@sh/shared'
import type { Queryable } from '../db.ts'

/** Reading settings back as the entity devices see, and the office's details for the freelancer pages. */

type Row = Record<string, any>

const toSetting = (r: Row): Setting => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  // Only once set, so a device or a test that knows nothing of them sees the office as before.
  ...(r.id === OFFICE_SETTING_ID && r.vat_number ? { vatNumber: r.vat_number } : {}),
  ...(r.id === OFFICE_SETTING_ID && r.address ? { address: r.address } : {}),
  ...(r.id === READING_SETTING_ID ? { headsSeeRates: r.heads_see_rates === true } : {}),
  ...(r.id === MESSAGES_SETTING_ID ? { promptMessages: r.prompt_messages === true } : {}),
  ...(r.id === TIMESHEETS_SETTING_ID ? { useTimesheets: r.use_timesheets === true, timesheetsFrom: r.timesheets_from ?? null } : {}),
  ...(r.id === ASSISTANT_SETTING_ID ? { useAssistant: r.use_assistant === true } : {}),
  ...(r.id === LINKS_SETTING_ID ? { checkLinks: r.check_links === true } : {}),
  ...(r.id === WHATSAPP_SETTING_ID ? { whatsapp: (r.whatsapp_mode ?? 'off') as WhatsAppMode, whatsappTestTo: r.whatsapp_test_to ?? [] } : {}),
  ...(r.id === CABLES_SETTING_ID && r.cable_colours ? { cableColours: r.cable_colours } : {}),
  ...(r.id === LOGO_SETTING_ID ? { logo: r.photo_at ? { at: new Date(r.photo_at).toISOString() } : null } : {}),
})

export async function getSetting(q: Queryable, id: string) {
  const { rows } = await q.query(`SELECT id, name, phone, email, vat_number, address, heads_see_rates, prompt_messages, use_timesheets, timesheets_from, use_assistant, check_links, whatsapp_mode, whatsapp_test_to, cable_colours, photo_at FROM settings WHERE id = $1`, [id])
  return rows[0] ? toSetting(rows[0]) : undefined
}

/** Whether a director has let heads of department see crew rates (ADR 0046); off unless said. */
export async function headsSeeRates(q: Queryable): Promise<boolean> {
  const { rows } = await q.query<{ heads_see_rates: boolean | null }>(`SELECT heads_see_rates FROM settings WHERE id = $1`, [READING_SETTING_ID])
  return rows[0]?.heads_see_rates === true
}

/** Whether the company uses timesheets (ADR 0090); off unless the office said. */
export async function usesTimesheets(q: Queryable): Promise<boolean> {
  const { rows } = await q.query<{ use_timesheets: boolean | null }>(`SELECT use_timesheets FROM settings WHERE id = $1`, [TIMESHEETS_SETTING_ID])
  return rows[0]?.use_timesheets === true
}

/** Who is asked for a timesheet (ADR 0110): bookings from the day they went on, or none while they're off. */
export async function timesheetAsking(q: Queryable): Promise<TimesheetAsking | null> {
  const { rows } = await q.query<{ use_timesheets: boolean | null; timesheets_from: string | null }>(
    `SELECT use_timesheets, timesheets_from FROM settings WHERE id = $1`,
    [TIMESHEETS_SETTING_ID]
  )
  return rows[0]?.use_timesheets === true ? { from: rows[0].timesheets_from } : null
}

/** Whether Claude is offered inside the app (ADR 0096); off unless the office said. */
export async function usesAssistant(q: Queryable): Promise<boolean> {
  const { rows } = await q.query<{ use_assistant: boolean | null }>(`SELECT use_assistant FROM settings WHERE id = $1`, [ASSISTANT_SETTING_ID])
  return rows[0]?.use_assistant === true
}

/** Whether freelancers' links check new phones and can be emailed when lost (ADR 0114); off unless the office said. */
export async function checksLinks(q: Queryable): Promise<boolean> {
  const { rows } = await q.query<{ check_links: boolean | null }>(`SELECT check_links FROM settings WHERE id = $1`, [LINKS_SETTING_ID])
  return rows[0]?.check_links === true
}

/** Whether offers go on WhatsApp by themselves (ADR 0125), and the numbers test mode sends to; off unless the office said. */
export async function whatsappSetting(q: Queryable): Promise<{ mode: WhatsAppMode; testTo: string[] }> {
  const { rows } = await q.query<{ whatsapp_mode: WhatsAppMode | null; whatsapp_test_to: string[] | null }>(`SELECT whatsapp_mode, whatsapp_test_to FROM settings WHERE id = $1`, [WHATSAPP_SETTING_ID])
  return { mode: rows[0]?.whatsapp_mode ?? 'off', testTo: rows[0]?.whatsapp_test_to ?? [] }
}

/** The office's details when there's a phone or an email to show; null until they're set. */
export async function officeFor(q: Queryable): Promise<OfficeDetails | null> {
  return officeContact(await getSetting(q, OFFICE_SETTING_ID))
}
