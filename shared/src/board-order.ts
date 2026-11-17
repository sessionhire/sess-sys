/**
 * The Board's order (ADR 0143). A column shows the jobs put in order by hand first, in that order, then everyone else's
 * by their days, soonest first. Dropping a card puts it, and every card above it in its group, in order as they now
 * stand, so the column reads after the drop exactly as it did when the card was let go.
 */

/** Hand-ordered first, by their place; then by the first day, soonest first; then by name. */
export function byBoardOrder<T extends { rank: number | undefined; job: { name: string; span?: { start: string } } }>(a: T, b: T): number {
  if (a.rank !== undefined || b.rank !== undefined) {
    if (a.rank === undefined) return 1
    if (b.rank === undefined) return -1
    if (a.rank !== b.rank) return a.rank - b.rank
  }
  return (a.job.span?.start ?? '').localeCompare(b.job.span?.start ?? '') || a.job.name.localeCompare(b.job.name)
}

/** Take the card at `from` out of a group and put it at `to`, counted in the group as it would be without it. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice()
  const [card] = out.splice(from, 1)
  out.splice(Math.max(0, Math.min(to, out.length)), 0, card!)
  return out
}

/**
 * What to send once a card is dropped: the column's cards to put in order, top first. `groups` are the column's groups as
 * drawn (Planning's weeks; one for every other column), with the group the card was dropped in already in its new order.
 * Every card already in order stays in order, at its new place; the card dropped and every card above it in its group
 * join them.
 */
export function rankedAfterDrop(groups: readonly (readonly string[])[], group: number, id: string, ranked: ReadonlySet<string>): string[] {
  const inGroup = groups[group] ?? []
  const above = new Set(inGroup.slice(0, inGroup.indexOf(id) + 1))
  return groups.flat().filter((j) => ranked.has(j) || above.has(j))
}
