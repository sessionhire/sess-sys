import type { View, Where } from '@sh/shared'

/** A place counted kit can be taken from: its name and how many of the product it holds. */
export interface Source {
  placeId: string
  name: string
  qty: number
}

/**
 * Where counted kit found at a place but not on its record most likely
 * came from (ADR 0176): a place that holds some of it and has never been
 * counted, such as the one place a whole stock list came in at from
 * Current RMS, the one holding most first. A place counted already is never
 * taken from, since its count says what's there; nor is a case.
 */
export function holdingPlace(view: Pick<View, 'warehouse' | 'counts'>, modelId: string, at: Where): Source | undefined {
  const m = view.warehouse.models.find((x) => x.id === modelId)
  if (!m) return undefined
  const from = m.counted
    .filter((s) => s.placeId && s.placeId !== at.placeId && s.qty > 0 && view.counts.of({ placeId: s.placeId }).length === 0)
    .sort((a, b) => b.qty - a.qty)[0]
  return from?.placeId ? { placeId: from.placeId, name: from.place?.name ?? 'another place', qty: from.qty } : undefined
}
