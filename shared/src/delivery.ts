import type { HireTerms, Pin, ProjectKind } from './jobs.ts'
import { STANDARD_VAT, type QuoteLine } from './quotes.ts'
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
 */

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
}

export function deliveryFor(o: {
  job: { kind?: ProjectKind; hire?: HireTerms | null | undefined }
  warehouse: Pin | null | undefined
  centsPerKm: number | null | undefined
  id: string | undefined
  newId: () => string
}): Delivery {
  const from = warehouseFrom(o.warehouse)
  const h = o.job.hire
  if (o.job.kind !== 'hire' || h?.handover !== 'delivery') return { shown: false, line: undefined, km: null, fromWarehouse: from.set, none: null }
  const pin = h.address?.trim() ? h.pin : null
  const km = pin ? Math.max(1, roadKm(from.pin, pin)) : null
  const none = !h.address?.trim()
    ? 'No delivery address yet: add it under Change details.'
    : km === null
      ? "The delivery address isn't on the map, so the distance isn't known: find it under Change details."
      : o.centsPerKm == null
        ? 'No price a km set yet: set it in Admin › Company › Dry hire delivery.'
        : null
  const line: QuoteLine | undefined =
    none || km === null
      ? undefined
      : {
          id: o.id ?? o.newId(),
          kind: 'other',
          what: `Delivery, ${km} km from ${from.set ? 'the warehouse' : 'Dublin'}`,
          ref: null,
          group: DELIVERY_GROUP,
          qty: Math.min(km, 10_000),
          days: 1,
          unitCents: o.centsPerKm!,
          vat: STANDARD_VAT,
          per: 'once',
          extra: 'delivery',
        }
  return { shown: true, line, km, fromWarehouse: from.set, none }
}
