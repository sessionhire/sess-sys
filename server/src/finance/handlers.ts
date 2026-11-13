import { deleteTyped, deleteWord, mergeDraft, QUOTE_SETTINGS_ID, rmsPricePlan, rmsPriceWrites, roleKey, type CommandArgs, type PriceHere, type Quote, type RateRule, type RmsProductPrice } from '@sh/shared'
import { emit, emitRemoved, Refused, type Ctx } from '../kernel.ts'
import { getTimesheet } from '../crew/timesheets.ts'
import { getClient, getProject } from '../projects/store.ts'
import { getModel } from '../stock/store.ts'
import { emailsOf, getClientDiscount, getCostPaid, getPackage, getProductPrice, getQuote, getQuoteEmail, getQuoteSettings, getRolePrice, highestNumber, isDeleted, newAcceptToken, quotesOf, versionsEver } from './store.ts'

/**
 * Light finance (ADR 0042). The rules, wherever a change comes from:
 *
 * - a job has one draft at a time, and a new version is numbered after the
 *   last; only a draft changes, so what went to the client stays readable;
 * - the client's answer goes on the job's newest version that isn't a
 *   draft (or the draft itself, accepted by phone before it was sent):
 *   an older one has been replaced;
 * - only an accepted quote is invoiced, and only an invoiced one paid;
 *   each is a record of what happened outside the app, so it can be taken
 *   back, in the opposite order;
 * - once a quote is invoiced, the job's quote is settled: no new version;
 * - an admin can delete a version (ADR 0135), which the server keeps, out of
 *   sight, so it can be put back as it was.
 *
 * Sending the same change twice, as a phone may, changes nothing.
 */

type FinanceCommand = 'quote.save' | 'quote.sent' | 'quote.delete' | 'quote.drop' | 'quoting.update' | 'quoting.travel' | 'quoting.email' | 'quoting.online' | 'quoting.ownKit' | 'quote.answer' | 'quote.invoiced' | 'quote.paid' | 'price.product' | 'price.rulesFromRms' | 'price.fromRms' | 'package.save' | 'package.remove' | 'price.role' | 'price.client' | 'cost.paid'
type Handler<N extends FinanceCommand> = (ctx: Ctx, args: CommandArgs<N>) => Promise<void>

const emitQuote = async (ctx: Ctx, id: string) => emit(ctx, 'quote', id, await getQuote(ctx.tx, id))

async function quoteFor(ctx: Ctx, id: string): Promise<Quote> {
  const q = await getQuote(ctx.tx, id, true)
  if (!q) throw new Refused({ code: 'not-found', message: 'That quote is no longer here.' })
  return q
}

/** Version 2 has been replaced by version 3: the client's answer, the invoice and the payment go on the one that counts. */
async function refuseIfReplaced(ctx: Ctx, q: Quote) {
  const versions = await quotesOf(ctx.tx, q.projectId)
  const current = versions.find((v) => v.invoicedOn) ?? versions.find((v) => v.status !== 'draft') ?? versions[0]
  if (current && current.id !== q.id && !(q.status === 'draft' && q.version > current.version))
    throw new Refused({ code: 'conflict', message: `Version ${q.version} has been replaced by version ${current.version}, so this goes on that one.` })
}

/**
 * Give a job's quote its number as a version first goes to the client (ADR 0084): the number an earlier version had,
 * or else the next one, which moves on by one. The settings row is locked, so two quotes sent at once get two numbers.
 */
export async function numberIt(ctx: Ctx, q: Quote) {
  if (q.number) return
  // A deleted version's number too (ADR 0135): it's still the job's.
  const had = (await versionsEver(ctx.tx, q.projectId)).number
  let n = had ?? 0
  if (!n) {
    await ctx.tx.query('INSERT INTO quote_settings (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [QUOTE_SETTINGS_ID])
    const { rows } = await ctx.tx.query<{ next_number: number | null }>('SELECT next_number FROM quote_settings WHERE id = $1 FOR UPDATE', [QUOTE_SETTINGS_ID])
    n = Math.max(rows[0]?.next_number ?? 1, (await highestNumber(ctx.tx)) + 1)
    await ctx.tx.query('UPDATE quote_settings SET next_number = $2 WHERE id = $1', [QUOTE_SETTINGS_ID, n + 1])
    await emit(ctx, 'quoteSettings', QUOTE_SETTINGS_ID, await getQuoteSettings(ctx.tx))
  }
  await ctx.tx.query('UPDATE quotes SET number = $2 WHERE id = $1', [q.id, n])
}

const settled = (q: Quote) =>
  q.status === 'accepted' ? `Version ${q.version} has been accepted` : q.status === 'declined' ? `Version ${q.version} was turned down` : `Version ${q.version} has gone to the client`

export const financeHandlers: { [N in FinanceCommand]: Handler<N> } = {
  async 'quote.save'(ctx, a) {
    // Kept trimmed, as the job's kit keeps its supplier (ADR 0089).
    a = { ...a, lines: a.lines.map((l) => (l.supplier === undefined ? l : { ...l, supplier: l.supplier.trim() })) }
    const job = await getProject(ctx.tx, a.projectId, true)
    if (!job) throw new Refused({ code: 'not-found', message: 'That job no longer exists.' })
    const was = await getQuote(ctx.tx, a.id, true)
    // A draft open on a phone while an admin deleted it (ADR 0135): the save doesn't bring it back.
    if (!was && (await isDeleted(ctx.tx, a.id))) throw new Refused({ code: 'conflict', message: 'This quote has been deleted. An admin can put it back from the history.' })
    if (was) {
      if (was.projectId !== a.projectId) throw new Refused({ code: 'invalid', message: 'That quote belongs to another job.' })
      if (was.status !== 'draft') throw new Refused({ code: 'conflict', message: `${settled(was)}, so it stays as it was. Start a new version to change it.` })
      // Two people on one draft (ADR 0113): what changed elsewhere since this save's base, and it didn't touch, stays.
      if (a.base) a = { ...a, ...mergeDraft(was, a, a.base).save }
      await ctx.tx.query(`UPDATE quotes SET lines = $2, discount_pct = $3, notes = $4, saved_at = now() WHERE id = $1`, [
        a.id,
        JSON.stringify(a.lines),
        a.discountPct,
        a.notes.trim(),
      ])
      // Left as they were by a save that doesn't say them, as one from an app older than them doesn't.
      if (a.validDays !== undefined) await ctx.tx.query('UPDATE quotes SET valid_days = $2 WHERE id = $1', [a.id, a.validDays])
      if (a.depositPct !== undefined) await ctx.tx.query('UPDATE quotes SET deposit_pct = $2 WHERE id = $1', [a.id, a.depositPct])
      if (a.agreedCents !== undefined) await ctx.tx.query('UPDATE quotes SET agreed_cents = $2 WHERE id = $1', [a.id, a.agreedCents])
      if (a.mealsProvided !== undefined) await ctx.tx.query('UPDATE quotes SET meals_provided = $2 WHERE id = $1', [a.id, a.mealsProvided])
      if (a.travelKm !== undefined) await ctx.tx.query('UPDATE quotes SET travel_km = $2 WHERE id = $1', [a.id, a.travelKm])
      if (a.accommodationProvided !== undefined) await ctx.tx.query('UPDATE quotes SET accommodation_provided = $2 WHERE id = $1', [a.id, a.accommodationProvided])
      if (a.forName !== undefined) await ctx.tx.query('UPDATE quotes SET for_name = $2 WHERE id = $1', [a.id, a.forName.trim()])
      return emitQuote(ctx, a.id)
    }
    const versions = await quotesOf(ctx.tx, a.projectId)
    const invoiced = versions.find((v) => v.invoicedOn)
    if (invoiced) throw new Refused({ code: 'conflict', message: `Version ${invoiced.version} is invoiced, so the quote for ${job.name} is settled.` })
    const draft = versions.find((v) => v.status === 'draft')
    if (draft) throw new Refused({ code: 'conflict', message: `There's already a draft of this quote, version ${draft.version}: change that one.` })
    // A new version holds its prices as long as the one before, and asks the same deposit, unless it says otherwise.
    const before = versions[0]
    // Numbered after every version the job has had, a deleted one too (ADR 0135).
    const top = (await versionsEver(ctx.tx, a.projectId)).top
    await ctx.tx.query(
      `INSERT INTO quotes (id, project_id, version, status, lines, discount_pct, notes, valid_days, deposit_pct, agreed_cents, meals_provided, travel_km, accept_token, for_name, accommodation_provided)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        a.id,
        a.projectId,
        top + 1,
        JSON.stringify(a.lines),
        a.discountPct,
        a.notes.trim(),
        a.validDays ?? before?.validDays ?? 30,
        a.depositPct !== undefined ? a.depositPct : (before?.depositPct ?? null),
        // A price agreed is for the lines it was agreed on, so a new version starts without one unless it says.
        a.agreedCents ?? null,
        // The job's meals and the distance are the job's, so a new version keeps them unless it says.
        a.mealsProvided ?? before?.mealsProvided ?? false,
        a.travelKm !== undefined ? a.travelKm : (before?.travelKm ?? null),
        // The key to the client's link (ADR 0121): there from the start, answering only once the office turns it on.
        newAcceptToken(),
        // Who it's for (ADR 0128): a new version is for the same person unless it says.
        (a.forName ?? before?.forName ?? '').trim(),
        // Whether the job puts the crew up (ADR 0156) is the job's too.
        a.accommodationProvided ?? before?.accommodationProvided ?? false,
      ]
    )
    await emitQuote(ctx, a.id)
  },

  async 'quote.sent'(ctx, a) {
    const q = await quoteFor(ctx, a.id)
    if (q.status !== 'draft') return
    if (q.lines.length === 0) throw new Refused({ code: 'invalid', message: 'This quote has no lines yet. Add what it is for first.' })
    // A version made before the client's link (ADR 0121), or by a way in that doesn't give one, gets its key as it goes.
    await ctx.tx.query(`UPDATE quotes SET status = 'sent', sent_on = $2, accept_token = coalesce(accept_token, $3) WHERE id = $1`, [a.id, a.on, newAcceptToken()])
    await numberIt(ctx, q)
    await emitQuote(ctx, a.id)
  },

  /** What every printed quote says (ADR 0084). The next number can't go back to one already given. */
  async 'quoting.update'(ctx, a) {
    if (a.nextNumber !== null) {
      const top = await highestNumber(ctx.tx)
      if (a.nextNumber <= top)
        throw new Refused({ code: 'conflict', message: `Quote ${top} has been given already, so the next number is ${top + 1} or more.` })
    }
    await ctx.tx.query(
      `INSERT INTO quote_settings (id, next_number, terms, bank) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET next_number = EXCLUDED.next_number, terms = EXCLUDED.terms, bank = EXCLUDED.bank`,
      [QUOTE_SETTINGS_ID, a.nextNumber, a.terms.trim(), a.bank.trim()]
    )
    await emit(ctx, 'quoteSettings', QUOTE_SETTINGS_ID, await getQuoteSettings(ctx.tx))
  },

  /** How travel, subsistence and accommodation are charged (ADR 0086, ADR 0156). The day the fuel price was set moves only when it changes. */
  async 'quoting.travel'(ctx, a) {
    await ctx.tx.query(
      `INSERT INTO quote_settings (id, travel_from_km, fuel_cents_per_litre, litres_per_100_km, per_diem_cents, fuel_set_on)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $3::numeric IS NULL THEN NULL ELSE $6::date END)
       ON CONFLICT (id) DO UPDATE SET
         travel_from_km = EXCLUDED.travel_from_km,
         fuel_set_on = CASE WHEN quote_settings.fuel_cents_per_litre IS NOT DISTINCT FROM EXCLUDED.fuel_cents_per_litre THEN quote_settings.fuel_set_on ELSE $6::date END,
         fuel_cents_per_litre = EXCLUDED.fuel_cents_per_litre,
         litres_per_100_km = EXCLUDED.litres_per_100_km,
         per_diem_cents = EXCLUDED.per_diem_cents,
         fuel_month = CASE WHEN quote_settings.fuel_cents_per_litre IS NOT DISTINCT FROM EXCLUDED.fuel_cents_per_litre THEN quote_settings.fuel_month ELSE NULL END`,
      [QUOTE_SETTINGS_ID, a.travelFromKm, a.fuelCentsPerLitre, a.litresPer100Km, a.perDiemCents, a.on]
    )
    // A price typed in came from no survey; one read from the AA's says which (ADR 0086). Left as they were unless said.
    if (a.fuelMonth !== undefined) await ctx.tx.query('UPDATE quote_settings SET fuel_month = $2 WHERE id = $1', [QUOTE_SETTINGS_ID, a.fuelMonth])
    if (a.fuelAuto !== undefined) await ctx.tx.query('UPDATE quote_settings SET fuel_auto = $2 WHERE id = $1', [QUOTE_SETTINGS_ID, a.fuelAuto])
    if (a.crewPerCar !== undefined) await ctx.tx.query('UPDATE quote_settings SET crew_per_car = $2 WHERE id = $1', [QUOTE_SETTINGS_ID, a.crewPerCar])
    // The crew's accommodation (ADR 0156), left as it was by a save from an app older than it.
    if (a.stayFromKm !== undefined) await ctx.tx.query('UPDATE quote_settings SET stay_from_km = $2 WHERE id = $1', [QUOTE_SETTINGS_ID, a.stayFromKm])
    if (a.roomCents !== undefined) await ctx.tx.query('UPDATE quote_settings SET room_cents = $2 WHERE id = $1', [QUOTE_SETTINGS_ID, a.roomCents])
    await emit(ctx, 'quoteSettings', QUOTE_SETTINGS_ID, await getQuoteSettings(ctx.tx))
  },

  /** Whether quotes can be sent to the client by email from the operations mailbox (ADR 0101): off until the office says. */
  /** What own kit costs to run, as a share of its price (finding 19 of the quote flow audit): the margin's cost for it. */
  async 'quoting.ownKit'(ctx, a) {
    await ctx.tx.query(`INSERT INTO quote_settings (id, own_kit_cost_pct) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET own_kit_cost_pct = EXCLUDED.own_kit_cost_pct`, [QUOTE_SETTINGS_ID, a.costPct])
    await emit(ctx, 'quoteSettings', QUOTE_SETTINGS_ID, await getQuoteSettings(ctx.tx))
  },

  async 'quoting.email'(ctx, a) {
    await ctx.tx.query(`INSERT INTO quote_settings (id, email_quotes) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET email_quotes = EXCLUDED.email_quotes`, [QUOTE_SETTINGS_ID, a.on])
    await emit(ctx, 'quoteSettings', QUOTE_SETTINGS_ID, await getQuoteSettings(ctx.tx))
  },

  /**
   * Whether a client can accept a quote on its own link (ADR 0121): off until the office says. Turned on, every version
   * out with a client that has no key yet is given one, so its link works when the office copies it.
   */
  async 'quoting.online'(ctx, a) {
    await ctx.tx.query(`INSERT INTO quote_settings (id, accept_online) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET accept_online = EXCLUDED.accept_online`, [QUOTE_SETTINGS_ID, a.on])
    await emit(ctx, 'quoteSettings', QUOTE_SETTINGS_ID, await getQuoteSettings(ctx.tx))
    if (!a.on) return
    const { rows } = await ctx.tx.query<{ id: string }>(`SELECT id FROM quotes WHERE status = 'sent' AND accept_token IS NULL AND deleted_at IS NULL`)
    for (const r of rows) {
      await ctx.tx.query('UPDATE quotes SET accept_token = $2 WHERE id = $1', [r.id, newAcceptToken()])
      await emitQuote(ctx, r.id)
    }
  },

  async 'quote.answer'(ctx, a) {
    const q = await quoteFor(ctx, a.id)
    if (q.invoicedOn) throw new Refused({ code: 'conflict', message: "This quote is invoiced, so the client's answer stays. Take the invoice back first." })
    if (a.answer === 'none') {
      if (q.status !== 'accepted' && q.status !== 'declined') return
      // A yes given online (ADR 0121) goes with it, so the link asks again.
      await ctx.tx.query(`UPDATE quotes SET status = 'sent', answered_on = NULL, declined_why = NULL, declined_note = '', accepted_name = NULL, accepted_at = NULL WHERE id = $1`, [a.id])
      return emitQuote(ctx, a.id)
    }
    // Why it was turned down is kept with a "turned down" only, and a quick "no" says nothing of why.
    const why = a.answer === 'declined' ? (a.why ?? null) : null
    const note = a.answer === 'declined' ? (a.note ?? '').trim() : ''
    if (q.status === a.answer && q.answeredOn === a.on && (q.declinedWhy ?? null) === why && (q.declinedNote ?? '') === note) return
    await refuseIfReplaced(ctx, q)
    if (q.status === 'draft' && q.lines.length === 0) throw new Refused({ code: 'invalid', message: 'This quote has no lines yet. Add what it is for first.' })
    await ctx.tx.query(`UPDATE quotes SET status = $2, answered_on = $3, sent_on = coalesce(sent_on, $3), declined_why = $4, declined_note = $5,
       accepted_name = CASE WHEN $2 = 'accepted' THEN accepted_name END, accepted_at = CASE WHEN $2 = 'accepted' THEN accepted_at END WHERE id = $1`, [
      a.id,
      a.answer,
      a.on,
      why,
      note,
    ])
    // Answered straight from a draft, it went to the client all the same, so it's numbered as if marked sent.
    if (q.status === 'draft') await numberIt(ctx, q)
    await emitQuote(ctx, a.id)
  },

  /**
   * Delete a version (ADR 0135): an admin's, once they've typed its number (or "delete", for one never sent), which is
   * checked here too, so nothing deletes one by a slip. It goes from every device with the emails that went with it, and
   * its link to the client stops; the server keeps it, out of sight, so it can be put back from the history.
   */
  async 'quote.delete'(ctx, a) {
    const q = await getQuote(ctx.tx, a.id, true)
    if (!q) {
      if (await isDeleted(ctx.tx, a.id)) return
      throw new Refused({ code: 'not-found', message: 'That quote is no longer here.' })
    }
    if (!deleteTyped(q, a.typed)) throw new Refused({ code: 'invalid', message: `Type ${deleteWord(q)} to delete version ${q.version} of this quote.` })
    await ctx.tx.query('UPDATE quotes SET deleted_at = now() WHERE id = $1', [a.id])
    for (const e of await emailsOf(ctx.tx, a.id)) await emitRemoved(ctx, 'quoteEmail', e)
    await emitRemoved(ctx, 'quote', a.id)
  },

  /**
   * Drop an amendment (ADR 0173): a draft made after a version went to the client, never sent itself. It's kept out of sight
   * as a deleted one is, so an admin can put it back from the history, and the version the client has is the quote again.
   */
  async 'quote.drop'(ctx, a) {
    const q = await getQuote(ctx.tx, a.id, true)
    if (!q) {
      if (await isDeleted(ctx.tx, a.id)) return
      throw new Refused({ code: 'not-found', message: 'That quote is no longer here.' })
    }
    if (q.status !== 'draft') throw new Refused({ code: 'conflict', message: `Version ${q.version} has gone to the client, so it stays.` })
    const before = (await quotesOf(ctx.tx, q.projectId)).find((v) => v.id !== q.id && v.status !== 'draft')
    if (!before) throw new Refused({ code: 'conflict', message: `Version ${q.version} is the job's only quote, so there's nothing to go back to. An admin can delete it.` })
    await ctx.tx.query('UPDATE quotes SET deleted_at = now() WHERE id = $1', [a.id])
    await emitRemoved(ctx, 'quote', a.id)
  },

  async 'quote.invoiced'(ctx, a) {
    const q = await quoteFor(ctx, a.id)
    if (a.on === null) {
      if (!q.invoicedOn) return
      if (q.paidOn) throw new Refused({ code: 'conflict', message: 'This invoice is marked paid. Take the payment back first.' })
      await ctx.tx.query(`UPDATE quotes SET invoiced_on = NULL, invoice_ref = '' WHERE id = $1`, [a.id])
      return emitQuote(ctx, a.id)
    }
    if (q.status !== 'accepted') throw new Refused({ code: 'conflict', message: "Only a quote the client accepted is invoiced. Record their answer first." })
    if (q.invoicedOn === a.on && q.invoiceRef === a.ref.trim()) return
    await refuseIfReplaced(ctx, q)
    await ctx.tx.query(`UPDATE quotes SET invoiced_on = $2, invoice_ref = $3 WHERE id = $1`, [a.id, a.on, a.ref.trim()])
    await emitQuote(ctx, a.id)
  },

  async 'quote.paid'(ctx, a) {
    const q = await quoteFor(ctx, a.id)
    if (q.paidOn === a.on) return
    if (a.on !== null && !q.invoicedOn) throw new Refused({ code: 'conflict', message: 'Mark it invoiced first: a payment is for an invoice.' })
    await ctx.tx.query(`UPDATE quotes SET paid_on = $2 WHERE id = $1`, [a.id, a.on])
    await emitQuote(ctx, a.id)
  },

  async 'price.product'(ctx, a) {
    if (!(await getModel(ctx.tx, a.modelId))) throw new Refused({ code: 'not-found', message: 'That product is no longer in the stock list.' })
    if (a.dayCents === null) {
      const { rows: gone } = await ctx.tx.query('DELETE FROM product_prices WHERE model_id = $1 RETURNING 1', [a.modelId])
      if (gone.length) await emitRemoved(ctx, 'productPrice', a.modelId)
      return
    }
    // Set here by hand, so a fill-in from Current RMS keeps it (ADR 0132).
    await ctx.tx.query(
      `INSERT INTO product_prices (model_id, day_cents) VALUES ($1, $2) ON CONFLICT (model_id) DO UPDATE SET day_cents = EXCLUDED.day_cents, from_rms = false`,
      [a.modelId, a.dayCents]
    )
    // Left as it was by a change that doesn't say it, as one from an app older than rules doesn't (ADR 0085).
    if (a.rate !== undefined) await ctx.tx.query('UPDATE product_prices SET rate = $2 WHERE model_id = $1', [a.modelId, a.rate])
    await emit(ctx, 'productPrice', a.modelId, await getProductPrice(ctx.tx, a.modelId))
  },

  /**
   * Each priced product's rule from the quotes read from Current RMS (ADR 0085): the rate definition its lines were
   * charged by most, matched by the product's name or one of its other names. Unless asked for all, only those with no
   * rule chosen yet, so one the office chose stays.
   */
  async 'price.rulesFromRms'(ctx, a) {
    const { rows } = await ctx.tx.query<{ model_id: string; rule: string }>(
      `WITH names AS (
         SELECT m.id, lower(m.name) AS name FROM models m JOIN product_prices pp ON pp.model_id = m.id
         UNION SELECT m.id, lower(alias) FROM models m JOIN product_prices pp ON pp.model_id = m.id, jsonb_array_elements_text(m.aliases) AS alias
       ),
       counted AS (
         SELECT n.id, l.rate_definition, count(*) AS c,
                row_number() OVER (PARTITION BY n.id ORDER BY count(*) DESC, l.rate_definition) AS rank
         FROM names n JOIN rms_lines l ON lower(l.name) = n.name
         WHERE l.rate_definition IN ('Daily Rate', '3 Day Week Rate', 'Weekly Rate')
         GROUP BY n.id, l.rate_definition
       )
       SELECT c.id AS model_id, c.rate_definition AS rule FROM counted c JOIN product_prices pp ON pp.model_id = c.id
       WHERE c.rank = 1 ${a.all ? '' : 'AND pp.rate IS NULL'}`
    )
    const RULE: Record<string, RateRule> = { 'Daily Rate': 'daily', '3 Day Week Rate': 'week3', 'Weekly Rate': 'weekly' }
    for (const r of rows) {
      const rule = RULE[r.rule]!
      const { rows: changed } = await ctx.tx.query('UPDATE product_prices SET rate = $2 WHERE model_id = $1 AND rate IS DISTINCT FROM $2 RETURNING 1', [r.model_id, rule])
      if (changed.length) await emit(ctx, 'productPrice', r.model_id, await getProductPrice(ctx.tx, r.model_id))
    }
  },

  /**
   * The price list filled in from Current RMS's hire prices (ADR 0132), as Admin last read them, worked out the way the
   * preview showed it (rmsPricePlan): products with no price, and those whose price came from Current RMS before; one
   * set here by hand only when asked to. Each written is marked as from Current RMS.
   */
  async 'price.fromRms'(ctx, a) {
    const { rows: rms } = await ctx.tx.query<{ id: number; name: string; price_cents: number | null; rate_definition: string }>(
      'SELECT id, name, price_cents, rate_definition FROM rms_products'
    )
    if (!rms.length) throw new Refused({ code: 'conflict', message: 'Read the prices from Current RMS first, under Admin.' })
    const { rows: models } = await ctx.tx.query<{ id: string; name: string; aliases: string[]; list_id: string }>('SELECT id, name, aliases, list_id FROM models')
    const { rows: had } = await ctx.tx.query<{ model_id: string; day_cents: number; rate: RateRule | null; from_rms: boolean }>(
      'SELECT model_id, day_cents, rate, from_rms FROM product_prices'
    )
    const prices = new Map<string, PriceHere>(had.map((p) => [p.model_id, { dayCents: p.day_cents, ...(p.rate ? { rate: p.rate } : {}), fromRms: p.from_rms }]))
    const plan = rmsPricePlan(
      rms.map((r): RmsProductPrice => ({ id: r.id, name: r.name, priceCents: r.price_cents, rateDefinition: r.rate_definition })),
      models.map((m) => ({ id: m.id, name: m.name, aliases: m.aliases, listId: m.list_id })),
      (id) => prices.get(id)
    )
    for (const w of rmsPriceWrites(plan, a.overwrite)) {
      await ctx.tx.query(
        `INSERT INTO product_prices (model_id, day_cents, rate, from_rms) VALUES ($1, $2, $3, true)
         ON CONFLICT (model_id) DO UPDATE SET day_cents = EXCLUDED.day_cents, rate = EXCLUDED.rate, from_rms = true`,
        [w.modelId, w.dayCents, w.rate]
      )
      await emit(ctx, 'productPrice', w.modelId, await getProductPrice(ctx.tx, w.modelId))
    }
  },

  async 'package.save'(ctx, a) {
    for (const i of a.items)
      if (!(await getModel(ctx.tx, i.modelId))) throw new Refused({ code: 'not-found', message: 'One of the products in the package is no longer in the stock list.' })
    await ctx.tx.query(
      `INSERT INTO packages (id, name, department, day_cents, rate, items, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department, day_cents = EXCLUDED.day_cents,
         rate = EXCLUDED.rate, items = EXCLUDED.items, notes = EXCLUDED.notes`,
      [a.id, a.name.trim(), a.department, a.dayCents, a.rate, JSON.stringify(a.items), a.notes.trim()]
    )
    await emit(ctx, 'package', a.id, await getPackage(ctx.tx, a.id))
  },

  async 'package.remove'(ctx, a) {
    const { rows } = await ctx.tx.query('DELETE FROM packages WHERE id = $1 RETURNING 1', [a.id])
    if (rows.length) await emitRemoved(ctx, 'package', a.id)
  },

  async 'price.role'(ctx, a) {
    const key = roleKey(a.role)
    if (a.dayCents === null) {
      const { rows: gone } = await ctx.tx.query('DELETE FROM role_prices WHERE id = $1 RETURNING 1', [key])
      if (gone.length) await emitRemoved(ctx, 'rolePrice', key)
      return
    }
    await ctx.tx.query(`INSERT INTO role_prices (id, role, day_cents) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, day_cents = EXCLUDED.day_cents`, [
      key,
      a.role.trim().replace(/\s+/g, ' '),
      a.dayCents,
    ])
    await emit(ctx, 'rolePrice', key, await getRolePrice(ctx.tx, key))
  },

  async 'price.client'(ctx, a) {
    if (!(await getClient(ctx.tx, a.clientId))) throw new Refused({ code: 'not-found', message: 'That client no longer exists.' })
    if (a.pct === null) {
      const { rows: gone } = await ctx.tx.query('DELETE FROM client_discounts WHERE client_id = $1 RETURNING 1', [a.clientId])
      if (gone.length) await emitRemoved(ctx, 'clientDiscount', a.clientId)
      return
    }
    await ctx.tx.query(`INSERT INTO client_discounts (client_id, pct) VALUES ($1, $2) ON CONFLICT (client_id) DO UPDATE SET pct = EXCLUDED.pct`, [a.clientId, a.pct])
    await emit(ctx, 'clientDiscount', a.clientId, await getClientDiscount(ctx.tx, a.clientId))
  },

  async 'cost.paid'(ctx, a) {
    if (a.on === null) {
      const { rows: gone } = await ctx.tx.query('DELETE FROM cost_payments WHERE timesheet_id = $1 RETURNING 1', [a.id])
      if (gone.length) await emitRemoved(ctx, 'costPaid', a.id)
      return
    }
    const t = await getTimesheet(ctx.tx, a.id)
    if (t?.status !== 'approved') throw new Refused({ code: 'conflict', message: 'Only an approved timesheet is marked paid. Approve it first.' })
    if ((await getCostPaid(ctx.tx, a.id))?.paidOn === a.on) return
    await ctx.tx.query(`INSERT INTO cost_payments (timesheet_id, paid_on) VALUES ($1, $2) ON CONFLICT (timesheet_id) DO UPDATE SET paid_on = EXCLUDED.paid_on`, [a.id, a.on])
    await emit(ctx, 'costPaid', a.id, await getCostPaid(ctx.tx, a.id))
  },
}

/**
 * Put a deleted version back (ADR 0135), as it was, unless the job has a draft of its own since or is settled. A server
 * route (finance/email-routes.ts), not a command: no device has the version any more to show while it waits.
 */
export async function restoreQuote(ctx: Ctx, id: string): Promise<Quote> {
  const q = await getQuote(ctx.tx, id, true, true)
  if (!q) throw new Refused({ code: 'not-found', message: 'That quote is no longer here.' })
  if (!(await isDeleted(ctx.tx, id))) return q
  if (q.status === 'draft') {
    const versions = await quotesOf(ctx.tx, q.projectId)
    const draft = versions.find((v) => v.status === 'draft')
    if (draft) throw new Refused({ code: 'conflict', message: `Version ${draft.version} is the job's draft now, and a job has one at a time. Delete it or mark it sent first.` })
    const invoiced = versions.find((v) => v.invoicedOn)
    if (invoiced) throw new Refused({ code: 'conflict', message: `Version ${invoiced.version} is invoiced, so the job's quote is settled: a draft can't come back to it.` })
  }
  await ctx.tx.query('UPDATE quotes SET deleted_at = NULL WHERE id = $1', [id])
  await emitQuote(ctx, id)
  for (const e of await emailsOf(ctx.tx, id)) await emit(ctx, 'quoteEmail', e, await getQuoteEmail(ctx.tx, e))
  return q
}
