import type { HireTerms, Pin, ProjectKind } from './jobs.ts'
import { money, STANDARD_VAT, type DeliveryBy, type QuoteLine } from './quotes.ts'
import { roadKm, warehouseFrom } from './road.ts'

/**
 * Delivery and collection on a quote (ADR 0183, widened by ADR 0201).
 *
 * At first a dry hire's alone (Colly, 14 November 2026: "Using that field can autopopulate a delivery line item on the
 * quote. This is calculated based on the distance from the warehouse to the delivery address. The unit charged per km
 * should be set in the admin section."). Then every quote (Colly, 26 November 2026: "add a section to the quote for
 * delivery/collection. Stipulate Van or Truck, if Van then base price is 160 within Dublin and then charge additional
 * for distances travelled more than that"): the quote says No delivery, Van or Truck. A van is priced by Admin as below;
 * a truck is priced for each job ("Trucks are priced individually per job"), so its price is typed on the quote.
 *
 * Worked out on the draft as travel is (ADR 0086), so nobody does the sum: the road km from the warehouse's pin to where
 * it goes, as the vans' drives are measured (ADR 0179: as the crow flies and a fifth more). A dry hire goes to its
 * delivery address; anything else to its venue. Until the warehouse is on the map it's measured from Dublin city centre,
 * as the vans are, and the row says so. A dry hire the client collects has no delivery.
 *
 * Priced as Colly asked on 15 November 2026 ("a set amount … for a certain distance, and then km after that are charged
 * at an individual rate"): a set amount covers the first so many km (the €160 "within Dublin"), and each km past them is
 * charged at the price a km. With no set amount, every km is charged at the price a km.
 */

/** What Admin › Company › Delivery and collection says a van's delivery costs. */
export interface DeliveryPrice {
  /** The set amount, in cents, covering the first `baseKm`. */
  baseCents?: number | null
  /** How many km the set amount covers. */
  baseKm?: number | null
  /** Each km past them, or every km with no set amount. */
  centsPerKm?: number | null
}

export const DELIVERY_BY_LABELS: Record<DeliveryBy, string> = { none: 'No delivery', van: 'Van', truck: 'Truck' }

export const DELIVERY_GROUP = 'Delivery and collection'

/** Where the prices are set, as the quote points to it. */
export const DELIVERY_WHERE = 'Admin › Company › Delivery and collection'

/**
 * What a quote that hasn't said starts on: a dry hire we deliver goes by van, as it did before the choice; anything else
 * has no delivery, so a quote from before it comes to what it did.
 */
export const deliveryByDefault = (job: { kind?: ProjectKind; hire?: HireTerms | null | undefined }): DeliveryBy =>
  job.kind === 'hire' && job.hire?.handover === 'delivery' ? 'van' : 'none'

export interface Delivery {
  /** Whether the quote has the section at all: not for a dry hire the client collects. */
  shown: boolean
  /** What the quote says, or what it starts on. */
  by: DeliveryBy
  line: QuoteLine | undefined
  km: number | null
  /** Measured from the warehouse's own pin, not Dublin city centre standing in for it. */
  fromWarehouse: boolean
  /** Where it goes: a dry hire's delivery address, or the venue. */
  to: 'address' | 'venue'
  /** Why there's no line, in words, or null when there is one or none is wanted. */
  none: string | null
  /** How the line's amount is made up, in words, when there is one. */
  how: string
}

export function deliveryFor(o: {
  job: { kind?: ProjectKind; hire?: HireTerms | null | undefined }
  /** The venue's pin, for anything that isn't a dry hire. */
  venue?: Pin | null | undefined
  warehouse: Pin | null | undefined
  /** The van's price, from Admin. */
  price: DeliveryPrice
  /** The truck's price for this job, typed on the quote. */
  truckCents?: number | null | undefined
  /** What the quote says; left out, it's what the job starts on. */
  by?: DeliveryBy | null | undefined
  id: string | undefined
  newId: () => string
}): Delivery {
  const from = warehouseFrom(o.warehouse)
  const hire = o.job.kind === 'hire'
  const h = o.job.hire
  const to: Delivery['to'] = hire ? 'address' : 'venue'
  const by = o.by ?? deliveryByDefault(o.job)
  const nothing = { line: undefined, km: null, fromWarehouse: from.set, to, how: '' } as const
  // A dry hire the client collects (or one from before the question) has nobody to deliver it.
  if (hire && h?.handover !== 'delivery') return { ...nothing, shown: false, by, none: null }
  if (by === 'none') return { ...nothing, shown: true, by, none: null }
  const pin = hire ? (h!.address?.trim() ? h!.pin : null) : (o.venue ?? null)
  const km = pin ? Math.max(1, roadKm(from.pin, pin)) : null
  const at = km === null ? '' : `, ${km} km from ${from.set ? 'the warehouse' : 'Dublin'}`
  const lineOf = (what: string, qty: number, unitCents: number): QuoteLine => ({
    id: o.id ?? o.newId(),
    kind: 'other',
    what,
    ref: null,
    group: DELIVERY_GROUP,
    qty,
    days: 1,
    unitCents,
    vat: STANDARD_VAT,
    per: 'once',
    extra: 'delivery',
  })
  const missing = hire && !h!.address?.trim() ? 'No delivery address yet: add it under Change details.' : null
  // A truck is priced for each job, as the office types it, so it needs no distance: the km are said when they're known.
  if (by === 'truck') {
    const none = missing ?? (o.truckCents == null ? "No price for the truck yet: trucks are priced for each job, so type this one's." : null)
    if (none) return { shown: true, by, line: undefined, km, fromWarehouse: from.set, to, none, how: '' }
    return { shown: true, by, line: lineOf(`Delivery and collection by truck${at}`, 1, o.truckCents!), km, fromWarehouse: from.set, to, none: null, how: 'Priced for this job' }
  }
  const { baseCents, centsPerKm: rate } = o.price
  const baseKm = baseCents == null ? 0 : (o.price.baseKm ?? 0)
  const over = km === null ? 0 : Math.max(0, km - baseKm)
  const none =
    missing ??
    (km === null
      ? hire
        ? "The delivery address isn't on the map, so the distance isn't known: find it under Change details."
        : "The venue isn't on the map, so the distance isn't known: put it on the map under Change details."
      : baseCents == null && rate == null
        ? `No van delivery price set yet: set it in ${DELIVERY_WHERE}.`
        : over > 0 && rate == null
          ? `No van price a km past the first ${baseKm} km set yet: set it in ${DELIVERY_WHERE}.`
          : null)
  if (none || km === null) return { shown: true, by, line: undefined, km, fromWarehouse: from.set, to, none, how: '' }
  const each = (n: number) => `${n} km at ${money(rate ?? 0)} a km`
  // No set amount: every km at the price a km, as a line of so many km.
  const byTheKm = baseCents == null
  const how = byTheKm ? `${km} km × ${money(rate!)} a km` : over > 0 ? `${money(baseCents)} for the first ${baseKm} km, then ${each(over)}` : `${money(baseCents)} for up to ${baseKm} km`
  const what = `Delivery and collection by van${at}`
  const line = byTheKm
    ? lineOf(what, Math.min(km, 10_000), rate!)
    : lineOf(over > 0 ? `${what}: the first ${baseKm} km, then ${each(over)}` : what, 1, baseCents + over * (rate ?? 0))
  return { shown: true, by, line, km, fromWarehouse: from.set, to, none: null, how }
}
