import { ASSISTANT_SETTING_ID, CABLES_SETTING_ID, LINKS_SETTING_ID, LOGO_SETTING_ID, MESSAGES_SETTING_ID, WHATSAPP_SETTING_ID, OFFICE_NAME, OFFICE_SETTING_ID, READING_SETTING_ID, TIMESHEETS_SETTING_ID, irishToday, type CommandArgs } from '@sh/shared'
import { emit, type Ctx } from '../kernel.ts'
import { getSetting } from './store.ts'

/**
 * The office's details (audit finding 10): set from Admin, shown
 * on every freelancer page. One office, so the command replaces them whole.
 */

type OfficeCommand = 'office.update' | 'company.details' | 'reading.heads' | 'messages.prompt' | 'timesheets.use' | 'assistant.use' | 'links.check' | 'whatsapp.use' | 'cables.colours' | 'logo.blackWhite'
type Handler<N extends OfficeCommand> = (ctx: Ctx, args: CommandArgs<N>) => Promise<void>

export const officeHandlers: { [N in OfficeCommand]: Handler<N> } = {
  async 'office.update'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, name, phone, email) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, updated_at = now()`,
      [OFFICE_SETTING_ID, a.name, a.phone, a.email]
    )
    // Left as they were by a change that doesn't say them, as one from an app older than them doesn't.
    if (a.vatNumber !== undefined) await ctx.tx.query(`UPDATE settings SET vat_number = $2 WHERE id = $1`, [OFFICE_SETTING_ID, a.vatNumber || null])
    if (a.address !== undefined) await ctx.tx.query(`UPDATE settings SET address = $2 WHERE id = $1`, [OFFICE_SETTING_ID, a.address || null])
    await emit(ctx, 'setting', OFFICE_SETTING_ID, await getSetting(ctx.tx, OFFICE_SETTING_ID))
  },

  /** The company's details for the foot of every quote (ADR 0181). The office's row is made with its usual name if there's none yet. */
  async 'company.details'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [OFFICE_SETTING_ID, OFFICE_NAME]
    )
    await ctx.tx.query(
      `UPDATE settings SET trading_name = $2, legal_name = $3, cro_number = $4, registered_address = $5, directors = $6, vat_number = $7, address = $8, updated_at = now() WHERE id = $1`,
      [OFFICE_SETTING_ID, a.tradingName, a.legalName, a.croNumber || null, a.registeredAddress, a.directors, a.vatNumber || null, a.address]
    )
    await emit(ctx, 'setting', OFFICE_SETTING_ID, await getSetting(ctx.tx, OFFICE_SETTING_ID))
  },

  /**
   * Whether heads of department see crew rates (ADR 0046). Their devices
   * hear of it at their next sync, and read their copy again with the rates
   * in or out.
   */
  async 'reading.heads'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, heads_see_rates) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET heads_see_rates = EXCLUDED.heads_see_rates, updated_at = now()`,
      [READING_SETTING_ID, a.rates]
    )
    await emit(ctx, 'setting', READING_SETTING_ID, await getSetting(ctx.tx, READING_SETTING_ID))
  },

  /** Whether Offer, Send, Tell and Ask open a message to a real person (ADR 0048). Every device hears at its next sync. */
  async 'messages.prompt'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, prompt_messages) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET prompt_messages = EXCLUDED.prompt_messages, updated_at = now()`,
      [MESSAGES_SETTING_ID, a.on]
    )
    await emit(ctx, 'setting', MESSAGES_SETTING_ID, await getSetting(ctx.tx, MESSAGES_SETTING_ID))
  },

  /** Whether the company uses timesheets (ADR 0090). Only shows or hides them: every timesheet kept stays as it was. */
  async 'timesheets.use'(ctx, a) {
    // From the day they're turned on, or the day the office gives (ADR 0110): turning them on isn't a backlog of every booking since the calendar came in.
    const was = await getSetting(ctx.tx, TIMESHEETS_SETTING_ID)
    const from = a.from ?? (was?.useTimesheets && was.timesheetsFrom ? was.timesheetsFrom : a.on ? irishToday() : (was?.timesheetsFrom ?? null))
    await ctx.tx.query(
      `INSERT INTO settings (id, use_timesheets, timesheets_from) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET use_timesheets = EXCLUDED.use_timesheets, timesheets_from = EXCLUDED.timesheets_from, updated_at = now()`,
      [TIMESHEETS_SETTING_ID, a.on, from]
    )
    await emit(ctx, 'setting', TIMESHEETS_SETTING_ID, await getSetting(ctx.tx, TIMESHEETS_SETTING_ID))
  },

  /** Whether Claude is offered inside the app (ADR 0096). Only shows or hides it: nothing Claude suggested and someone took changes. */
  async 'assistant.use'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, use_assistant) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET use_assistant = EXCLUDED.use_assistant, updated_at = now()`,
      [ASSISTANT_SETTING_ID, a.on]
    )
    await emit(ctx, 'setting', ASSISTANT_SETTING_ID, await getSetting(ctx.tx, ASSISTANT_SETTING_ID))
  },

  /** Whether freelancers' links check new phones and can be emailed when lost (ADR 0114). Phones already remembered stay remembered either way. */
  async 'links.check'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, check_links) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET check_links = EXCLUDED.check_links, updated_at = now()`,
      [LINKS_SETTING_ID, a.on]
    )
    await emit(ctx, 'setting', LINKS_SETTING_ID, await getSetting(ctx.tx, LINKS_SETTING_ID))
  },

  /**
   * Whether offers go on WhatsApp by themselves (ADR 0125), and the numbers to try it on. Turning it on sends nothing
   * at once: only offers made from then on go, as they're made.
   */
  async 'whatsapp.use'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, whatsapp_mode, whatsapp_test_to) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET whatsapp_mode = EXCLUDED.whatsapp_mode, whatsapp_test_to = EXCLUDED.whatsapp_test_to, updated_at = now()`,
      [WHATSAPP_SETTING_ID, a.mode, a.testTo]
    )
    await emit(ctx, 'setting', WHATSAPP_SETTING_ID, await getSetting(ctx.tx, WHATSAPP_SETTING_ID))
  },

  /** The colour each cable length takes (ADR 0106), the whole list at once. Every device hears at its next sync. */
  async 'cables.colours'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, cable_colours) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET cable_colours = EXCLUDED.cable_colours, updated_at = now()`,
      [CABLES_SETTING_ID, JSON.stringify(a.colours)]
    )
    await emit(ctx, 'setting', CABLES_SETTING_ID, await getSetting(ctx.tx, CABLES_SETTING_ID))
  },

  /** Whether labels print the logo in pure black and white (ADR 0163), on the logo's own row; the logo itself is untouched. */
  async 'logo.blackWhite'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO settings (id, logo_black_white) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET logo_black_white = EXCLUDED.logo_black_white, updated_at = now()`,
      [LOGO_SETTING_ID, a.on]
    )
    await emit(ctx, 'setting', LOGO_SETTING_ID, await getSetting(ctx.tx, LOGO_SETTING_ID))
  },
}
