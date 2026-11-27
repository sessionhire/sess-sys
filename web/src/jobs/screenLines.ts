import { euroText, lineCents, nameWithLength, SCREEN_GROUP, STANDARD_VAT, type LineScreen, type Model, type RateRule } from '@sh/shared'
import { checkLine, type LineDraft } from './lineDraft.ts'

/**
 * An LED screen as lines of a quote (ADR 0207): its own line, named for its size and how it stands, and under it the
 * kit that makes it, each an ordinary kit line at the price list's price, as a package's kit is (ADR 0116). The
 * builder shows these lines before they're added, so what it says a screen comes to is what the quote then says.
 */

/** A screen on a quote: its line, and its kit under it. */
export interface ScreenSet {
  head: LineDraft
  under: LineDraft[]
}

export interface BuiltScreen {
  screen: LineScreen
  /** How many screens like it: its line's How many. The kit's counts are already for all of them. */
  count: number
  /** "LED screen 5 × 3 m, hung", and what's printed under it. */
  what: string
  includes: string
  /** The kit in the order it's listed, each product once. */
  items: readonly { modelId: string; qty: number }[]
}

export interface ScreenPrices {
  /** The days the job works, which a new line is charged for. */
  days: number
  model: (id: string) => Pick<Model, 'name' | 'lengthM'> | undefined
  /** The price list's price in cents and its rule, as Add kit reads them. */
  price: (id: string) => number | undefined
  rate: (id: string) => RateRule | undefined
  newId: () => string
}

/**
 * The lines a built screen makes. Changing a screen that's already on the quote (`was`), its line keeps its place and
 * a line whose product stays keeps what the office did to it (its price, discount, days and what it costs) and takes
 * the builder's count; a product no longer wanted goes, and a new one comes in at the price list's price.
 */
export function screenLines(built: BuiltScreen, look: ScreenPrices, was?: ScreenSet): ScreenSet {
  const days = String(look.days)
  const head: LineDraft = {
    ref: null,
    vat: STANDARD_VAT,
    per: 'day',
    rate: null,
    days,
    out: days,
    discount: '',
    subhire: '',
    supplier: '',
    cost: '',
    group: SCREEN_GROUP,
    ...was?.head,
    id: was?.head.id ?? look.newId(),
    kind: 'kit',
    what: built.what,
    includes: built.includes,
    qty: String(built.count),
    modelId: null,
    packageId: null,
    // Charged by its kit: each line under it has its own price.
    price: euroText(0),
    screen: built.screen,
  }
  const under = built.items.flatMap((i): LineDraft[] => {
    const kept = was?.under.find((u) => u.modelId === i.modelId)
    if (kept) {
      // No more hired in than there are now.
      const hired = Number(kept.subhire)
      return [{ ...kept, qty: String(i.qty), under: head.id, ...(hired > i.qty ? { subhire: String(i.qty) } : {}) }]
    }
    const model = look.model(i.modelId)
    if (!model) return []
    const cents = look.price(i.modelId)
    const rate = look.rate(i.modelId)
    return [
      {
        id: look.newId(),
        kind: 'kit',
        what: nameWithLength(model),
        ref: null,
        modelId: i.modelId,
        group: head.group,
        qty: String(i.qty),
        days,
        out: days,
        price: cents === undefined || cents === 0 ? '' : euroText(cents),
        vat: STANDARD_VAT,
        per: 'day',
        // Charged by the product's rule (ADR 0085), as Add kit charges it.
        rate: rate && rate !== 'daily' ? rate : null,
        discount: '',
        packageId: null,
        includes: '',
        subhire: '',
        supplier: '',
        cost: '',
        under: head.id,
        // Priced at €0 on the price list, it's given at no charge.
        ...(cents === 0 ? { included: true } : {}),
      },
    ]
  })
  return { head, under }
}

/** What a line of a screen comes to as typed, in cents, and whether it has no price yet: undefined while it can't be read as a line. */
export function lineStands(d: LineDraft): { cents: number; unpriced: boolean } | undefined {
  const line = checkLine(d, 1).line
  return line ? { cents: lineCents(line), unpriced: line.unitCents === 0 && !line.included } : undefined
}

/** What a screen's kit comes to, and how many of its lines have no price yet. */
export function screenComesTo(set: ScreenSet): { cents: number; unpriced: number } {
  let cents = 0
  let unpriced = 0
  for (const u of set.under) {
    const stands = lineStands(u)
    if (!stands) continue
    cents += stands.cents
    if (stands.unpriced) unpriced++
  }
  return { cents, unpriced }
}

/**
 * What changing a screen does to the quote, said before it's done: what's added, what's taken off and which counts
 * change, each in a line. Nothing where the quote would stay as it is.
 */
export function screenChanges(was: ScreenSet, now: ScreenSet): string[] {
  const said: string[] = []
  const many = (set: ScreenSet) => (Number(set.head.qty) > 1 ? `${set.head.qty} × ` : '')
  if (was.head.what !== now.head.what || was.head.qty !== now.head.qty) said.push(`Its line reads “${many(now)}${now.head.what}”, where it read “${many(was)}${was.head.what}”.`)
  for (const u of now.under) {
    const had = was.under.find((x) => x.modelId === u.modelId)
    if (!had) said.push(`Added: ${u.qty} × ${u.what}.`)
    else if (had.qty !== u.qty) said.push(`${u.what}: ${u.qty}, where there ${had.qty === '1' ? 'was' : 'were'} ${had.qty}.`)
  }
  for (const u of was.under) if (!now.under.some((x) => x.modelId === u.modelId)) said.push(`Taken off: ${u.qty} × ${u.what}.`)
  return said
}
