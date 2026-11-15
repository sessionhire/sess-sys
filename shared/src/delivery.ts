import type { HireTerms, Pin, ProjectKind } from './jobs.ts'
import { money, STANDARD_VAT, type QuoteLine } from './quotes.ts'
import { roadKm, warehouseFrom } from './road.ts'

/**
 * A dry hire's delivery on its quote (ADR 0183; Colly, 14 November 2026: "Using that field can autopopulate a delivery
 * line item on the quote. This is calculated based on the distance from the warehouse to the delivery address. The unit
 * charged per km should be set in the admin section.")
 *
 * Worked out on the draft as travel is (ADR 0086), so nobody does the sum: the road km from the warehouse's pin to the
 * delivery address's, as the vans' drives are measured (ADR 0179: as the crow flies and a fifth more), times what
 * Admin › Company says a km of delivery costs. Until the warehouse is on the map it's measured from Dublin city centre,
 * as the vans are, and the row says so. A collection has no delivery and no row.
 *
 * Priced as Colly asked on 15 November 2026 ("a set amount … for a certain distance, and then km after that are charged
 * at an individual rate"): a set amount covers the first so many km, and each km past them is charged at the price a km.
 * With no set amount, every km is charged at the price a km, as at first.
 */

/** What Admin › Company › Dry hire delivery says a delivery costs. */
export interface DeliveryPrice {
  /** The set amount, in cents, covering the first `baseKm`. */
  baseCents?: number | null
  /** How many km the set amount covers. */
  baseKm?: number | null
  /** Each km past them, or every km with no set amount. */
  centsPerKm?: number | null
}


export const DELIVERY_GROUP = 'Delivery'

export interface Delivery {
  /** Whether the quote has a delivery row at all: a dry hire to be delivered. */
  shown: boolean
  line: QuoteLine | undefined
  km: number | null
  /** Measured from the warehouse's own pin, not Dublin city centre standing in for it. */
  fromWarehouse: boolean
  /** Why there's no line, in words, or null when there is one. */
  none: string | null
  /** How the line's amount is made up, in words, when there is one. */
  how: string
}

const WHERE = 'Admin › Company › Dry hire delivery'

export function deliveryFor(o: {
  job: { kind?: ProjectKind; hire?: HireTerms | null | undefined }
  warehouse: Pin | null | undefined
  price: DeliveryPrice
  id: string | undefined
  newId: () => string
}): Delivery {
  const from = warehouseFrom(o.warehouse)
  const h = o.job.hire
  if (o.job.kind !== 'hire' || h?.handover !== 'delivery') return { shown: false, line: undefined, km: null, fromWarehouse: from.set, none: null, how: '' }
  const pin = h.address?.trim() ? h.pin : null
  const km = pin ? Math.max(1, roadKm(from.pin, pin)) : null
  const { baseCents, centsPerKm: rate } = o.price
  const baseKm = baseCents == null ? 0 : (o.price.baseKm ?? 0)
  const over = km === null ? 0 : Math.max(0, km - baseKm)
  const none = !h.address?.trim()
    ? 'No delivery address yet: add it under Change details.'
    : km === null
      ? "The delivery address isn't on the map, so the distance isn't known: find it under Change details."
      : baseCents == null && rate == null
        ? `No delivery price set yet: set it in ${WHERE}.`
        : over > 0 && rate == null
          ? `No price a km past the first ${baseKm} km set yet: set it in ${WHERE}.`
          : null
  if (none || km === null) return { shown: true, line: undefined, km, fromWarehouse: from.set, none, how: '' }
  const at = `${km} km from ${from.set ? 'the warehouse' : 'Dublin'}`
  const each = (n: number) => `${n} km at ${money(rate ?? 0)} a km`
  // No set amount: every km at the price a km, as a line of so many km.
  const byTheKm = baseCents == null
  const how = byTheKm ? `${km} km × ${money(rate!)} a km` : over > 0 ? `${money(baseCents)} for the first ${baseKm} km, then ${each(over)}` : `${money(baseCents)} for up to ${baseKm} km`
  const line: QuoteLine = {
    id: o.id ?? o.newId(),
    kind: 'other',
    what: byTheKm ? `Delivery, ${at}` : over > 0 ? `Delivery, ${at}: the first ${baseKm} km, then ${each(over)}` : `Delivery, ${at}`,
    ref: null,
    group: DELIVERY_GROUP,
    qty: byTheKm ? Math.min(km, 10_000) : 1,
    days: 1,
    unitCents: byTheKm ? rate! : baseCents + over * (rate ?? 0),
    vat: STANDARD_VAT,
    per: 'once',
    extra: 'delivery',
  }
  return { shown: true, line, km, fromWarehouse: from.set, none: null, how }
}
