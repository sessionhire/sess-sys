import {
  changesFromJob,
  dayLabel,
  DEPARTMENT_LABELS,
  packageSaving,
  packageWorth,
  holdOf,
  kitPencilled,
  workDays,
  euroText,
  irishToday,
  linesByGroup,
  linesUnder,
  moveGroup,
  moveLine,
  inRacks,
  lineCents,
  needsPrice,
  MAX_LINES,
  MOST_PACKAGE_ITEMS,
  type Department,
  money,
  newId,
  parseEuro,
  pctWord,
  plural,
  quoteTotals,
  STANDARD_VAT,
  type JobView,
  type QuoteLine,
  type QuoteView,
  type View,
  DEFAULT_VALID_DAYS,
  depositCents,
  validUntil,
  packageIncludes,
  extrasFor,
  travelSettingsOf,
  kindOf,
  type Pin,
  lineCostOf,
  quoteKit,
  kitFree,
  RATE_LABELS,
  ownKitUncosted,
  quoteMargin,
  quoteWants,
  suggestionLine,
  type AskedLine,
  MOST_LAST_CHARGED_NAMES,
  draftBase,
} from '@sh/shared'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Confirm, Refusal, useAct } from '../act.tsx'
import { Empty } from '../Empty.tsx'
import { Icon } from '../Icon.tsx'
import { ProductPicker } from '../ProductPicker.tsx'
import { useAccess } from '../role.ts'
import { client } from '../sync.ts'
import { useLate } from '../useLate.ts'
import { useToday } from '../view.ts'
import { glideTo } from '../glide.ts'
import { useUnderTop } from '../useUnderTop.ts'
import { usePhone } from '../foot.tsx'
import { MailOnQuote, useClaude, type Advice } from './Claude.tsx'
import { useLastCharged } from './rms.ts'
import { QuotePill } from './QuoteStatus.tsx'
import { checkLine, num, sameLine, toDraft, type LineDraft } from './lineDraft.ts'
import { matchKitToQuote } from './Kit.tsx'
import { GroupDiscount, KitNote, LastCharged, lastOf, LineEditor, lineMargin, linesShort, LineSummary, rmsNames, UnitBox } from './QuoteLine.tsx'
import { Totals } from './QuoteSheet.tsx'
import { SendQuote } from './QuoteEmail.tsx'
import { useQuotesByEmail } from '../MailboxCard.tsx'
import { PackageEditor, type PackageStart } from './Packages.tsx'
import { AddCrew, AddPackage, AddTransport, JobChangesCard, transportWords, TRAVEL_ROW, TravelAndSubsistence } from './QuoteAdd.tsx'

/**
 * A quote while it's a draft (ADR 0042, redrawn in ADR 0100): the lines as
 * rows that open one at a time to change, a readout of what it comes to that
 * stays in view with what needs a look, the terms and the sending beside
 * them, saving itself as it's typed, and marked sent when it goes to the
 * client.
 */

/** More lines than this on a phone, and the draft opens with its groups folded (finding 15 of the quote flow audit). */
const FOLD_FROM = 12

/**
 * Sent to the client, and so the job is quoted (ADR 0081): an enquiry moves on by itself, since that's all "quoted"
 * means. A job already confirmed, or stopped, stays as it is.
 */
async function markSent(id: string, job: JobView, on: string) {
  await client.mutate('quote.sent', { id, on })
  if (job.status === 'enquiry') await client.mutate('project.update', { id: job.id, status: 'quoted' })
}

/** How long the draft waits after the last key before it saves itself. */
const SAVE_AFTER_MS = 1_200

/**
 * What's typed on a draft that can't save yet (a line with nothing to say what it's for, a price that isn't one) is kept on
 * this device for the tab's life, as places.ts keeps scroll places, so going to another screen and coming back doesn't
 * lose it (audit, 20 October 2026, finding 27). Kept against the draft as it's saved: once that changes, from here or
 * another device, what was typed over the older one is let go. What can save saves itself, so nothing is kept for it.
 */
const TYPED_STORE = 'session-hire-quote-typed'
interface Typed {
  base: string
  lines: LineDraft[]
  meals: boolean
  kmTyped: string
  discount: string
  agreed: string
  notes: string
  validFor: string
  deposit: string
  forName?: string
}
const baseOf = (q: QuoteView) =>
  JSON.stringify([q.lines, q.discountPct, q.agreedCents ?? null, q.notes, q.validDays ?? null, q.depositPct ?? null, q.mealsProvided ?? false, q.travelKm ?? null, q.forName ?? ''])
function readTyped(): Record<string, Typed> {
  try {
    return JSON.parse(sessionStorage.getItem(TYPED_STORE) ?? '{}') as Record<string, Typed>
  } catch {
    return {}
  }
}
function typedOf(q: QuoteView): Typed | undefined {
  const t = readTyped()[q.id]
  return t && t.base === baseOf(q) && Array.isArray(t.lines) ? t : undefined
}
function keepTyped(id: string, t: Typed | undefined) {
  const all = readTyped()
  if (!t && !(id in all)) return
  if (t) all[id] = t
  else delete all[id]
  try {
    sessionStorage.setItem(TYPED_STORE, JSON.stringify(all))
  } catch {
    // Storage that's off or full keeps it for as long as the quote stays open.
  }
}

/** A draft's terms as they're typed, to tell one changed here from one left as it was (ADR 0113). */
const termsText = (q: QuoteView) => ({
  meals: q.mealsProvided ?? false,
  kmTyped: q.travelKm == null ? '' : String(q.travelKm),
  discount: q.discountPct ? String(q.discountPct) : '',
  agreed: q.agreedCents == null ? '' : euroText(q.agreedCents),
  notes: q.notes,
  validFor: String(q.validDays ?? DEFAULT_VALID_DAYS),
  deposit: q.depositPct ? String(q.depositPct) : '',
  forName: q.forName ?? '',
})

/**
 * The days the job works, which a line added on the quote is charged for until changed: each day of its phases, not the
 * gap between a build and a show (ADR 0126; audit of the quote flow, 8 November 2026, finding 9).
 */
const jobDays = (job: JobView) => workDays(job)

/** A package offered in Add kit (ADR 0129), told from a product by the start of its id. */
const PACKAGE_PICK = 'package:'

/** The fields of the terms that can be wrong, in the order their faults are said; `km` is the distance on the travel row. */
type TermKey = 'agreed' | 'km' | 'discount' | 'validFor' | 'deposit'
const TERM_KEYS: readonly TermKey[] = ['agreed', 'km', 'discount', 'validFor', 'deposit']

export function Draft({ q, view, job, onPrint, plain }: { q: QuoteView; view: View; job: JobView; onPrint: () => void; /** The job's Next holds the page's red (ADR 0140, part 4). */ plain?: boolean }) {
  const today = useToday()
  const m = view.money
  const under = useUnderTop<HTMLFormElement>(true)
  // What was typed and couldn't save yet, when the quote was left (finding 27).
  const [kept] = useState(() => typedOf(q))
  // Travel and subsistence (ADR 0086) aren't typed: they're worked out below from the rest, so they're kept apart.
  const [lines, setLines] = useState<LineDraft[]>(() => kept?.lines ?? q.lines.filter((l) => !l.extra).map(toDraft))
  const [meals, setMeals] = useState(kept?.meals ?? q.mealsProvided ?? false)
  const [kmTyped, setKmTyped] = useState(kept?.kmTyped ?? (q.travelKm == null ? '' : String(q.travelKm)))
  const [discount, setDiscount] = useState(kept?.discount ?? (q.discountPct ? String(q.discountPct) : ''))
  // A price agreed for the whole (ADR 0085) stands in for the discount percentage while it's there.
  const [agreed, setAgreed] = useState(kept?.agreed ?? (q.agreedCents == null ? '' : euroText(q.agreedCents)))
  const [notes, setNotes] = useState(kept?.notes ?? q.notes)
  const [validFor, setValidFor] = useState(kept?.validFor ?? String(q.validDays ?? DEFAULT_VALID_DAYS))
  const [deposit, setDeposit] = useState(kept?.deposit ?? (q.depositPct ? String(q.depositPct) : ''))
  // Who at the client it's for (ADR 0128): one of their contacts, printed under the client's name.
  const [forName, setForName] = useState(kept?.forName ?? q.forName ?? '')
  const [kitDays, setKitDays] = useState('')
  const [kitDaysOpen, setKitDaysOpen] = useState(false)
  const [discounting, setDiscounting] = useState<string>()
  const [sentOn, setSentOn] = useState(today)
  const [answering, setAnswering] = useState(false)
  // A line with no price goes to the client as €0.00: sending with one is asked first (audit, 5 November 2026, finding 26),
  // and so is anything else on the list of what to look at before it goes (research/quoting.md, feature 3).
  const [free, setFree] = useState<'mark' | 'email' | 'accept'>()
  // Sending by email (ADR 0101), once the office has turned it on: the compose box, or the quiet way to say it went another way.
  const canEmail = useQuotesByEmail(m)
  const [sending, setSending] = useState<'email' | 'other'>()
  // One row is open to change at a time, a line's or a worked-out one's; the rest read as a list, as they'll print.
  const [open, setOpen] = useState<string>()
  // Which field the open line starts on, and whether its cost fold is wanted open: set by whatever opened it.
  const [focusField, setFocusField] = useState<'what' | 'price'>('what')
  const [wantCost, setWantCost] = useState(false)
  // The line just shut, which keeps the focus so the keyboard carries on from it.
  const [shut, setShut] = useState<string>()
  const [removed, setRemoved] = useState<{ line: LineDraft; at: number; under: LineDraft[] }>()
  // The packages whose kit is shown under their line (ADR 0116); folded otherwise.
  const [shownSets, setShownSets] = useState<ReadonlySet<string>>(() => new Set())
  // A long draft on a phone opens with each group folded to its title and total, a tap to open (audit of the quote flow,
  // 8 November 2026, finding 15): checking a festival's quote is then a screen of groups, not eight of lines.
  // A group a line has been added to since opens, unless it's folded again by hand.
  const phone = usePhone()
  const [firstLines] = useState(() => q.lines.filter((l) => !l.extra))
  const [autoFolded] = useState<ReadonlySet<string>>(() => (phone && firstLines.length > FOLD_FROM ? new Set(linesByGroup(firstLines).map((g) => g.group)) : new Set()))
  const [foldedByHand, setFoldedByHand] = useState<ReadonlyMap<string, boolean>>(() => new Map())
  const fold = (group: string, shut: boolean) => setFoldedByHand((f) => new Map(f).set(group, shut))
  const isFolded = (group: string, groupLines: readonly LineDraft[]) =>
    foldedByHand.get(group) ?? (autoFolded.has(group) && groupLines.every((l) => firstLines.some((f) => f.id === l.id)))
  const toggleSet = (id: string) =>
    setShownSets((now) => {
      const next = new Set(now)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const [adding, setAddingTo] = useState<'kit' | 'crew' | 'package' | 'transport' | 'save-package'>()
  // Kit lines added since Add kit was pressed, while its picker stays open for the next.
  const [kitPicks, setKitPicks] = useState(0)
  const setAdding = (to: typeof adding) => {
    setKitPicks(0)
    setAddingTo(to)
  }
  // A fault shows only once what holds it has been left (design system rule 18): a line left, or a terms field left. What
  // came back from the device's keeping was left when the screen was, so it shows at once.
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set(kept ? [...kept.lines.map((l) => l.id), ...TERM_KEYS] : []))
  const touch = (k: string) => setTouched((s) => (s.has(k) ? s : new Set(s).add(k)))
  const { run, error, refuse } = useAct()
  const set = (id: string, changes: Partial<LineDraft>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...changes } : l)))

  // Two people on one draft (ADR 0113). `opened` is the draft as this device's typing began from: when the draft changes
  // elsewhere, what wasn't touched here takes the change, and what was is kept, so neither person's work is lost. A line
  // changed on both keeps what's typed here, and says so. Saves carry `opened` so the server does the same.
  const opened = useRef(q)
  const [bothChanged, setBothChanged] = useState<string[]>([])
  const drawn = baseOf(q)
  useEffect(() => {
    const was = opened.current
    if (baseOf(was) === drawn) return
    opened.current = q
    // As saving reads it: a line typed here reads as the saved one when it would save as it.
    const same = (d: LineDraft, l: QuoteLine) => {
      const c = checkLine(d, 1)
      return !!c.line && sameLine(c.line, l)
    }
    const before = new Map(was.lines.filter((l) => !l.extra).map((l) => [l.id, l]))
    const now = q.lines.filter((l) => !l.extra)
    const theirs = new Map(now.map((l) => [l.id, l]))
    const here = new Set(lines.map((d) => d.id))
    const clash: string[] = []
    const next: LineDraft[] = []
    for (const d of lines) {
      const b = before.get(d.id)
      const t = theirs.get(d.id)
      if (!b) next.push(d) // added here, not saved yet
      else if (same(d, b)) {
        if (t) next.push(toDraft(t)) // untouched here: theirs, or gone if they took it off
      } else {
        next.push(d)
        if (t && !same(d, t) && !sameLine(t, b)) clash.push(d.what.trim() || 'A line')
      }
    }
    now.forEach((t, i) => {
      if (here.has(t.id) || before.has(t.id)) return
      const after = now.slice(0, i).reverse().find((x) => next.some((d) => d.id === x.id))
      next.splice(after ? next.findIndex((d) => d.id === after.id) + 1 : 0, 0, toDraft(t))
    })
    setLines(next)
    const a = termsText(was)
    const z = termsText(q)
    if (meals === a.meals) setMeals(z.meals)
    if (kmTyped === a.kmTyped) setKmTyped(z.kmTyped)
    if (discount === a.discount) setDiscount(z.discount)
    if (agreed === a.agreed) setAgreed(z.agreed)
    if (notes.trim() === a.notes.trim()) setNotes(z.notes)
    if (validFor === a.validFor) setValidFor(z.validFor)
    if (deposit === a.deposit) setDeposit(z.deposit)
    if (forName === a.forName) setForName(z.forName)
    if (clash.length) setBothChanged(clash)
  }, [drawn])
  const openLine = (id: string | undefined, focus: 'what' | 'price' = 'what', cost = false) => {
    if (open && open !== id) touch(open)
    setFocusField(focus)
    setWantCost(cost)
    setOpen(id)
  }
  const termIds = useId()
  const termRefs = useRef<Partial<Record<TermKey, HTMLInputElement | null>>>({})

  // What it comes to as typed, with anything not yet a number left out.
  const parsed = lines.map((l, i) => checkLine(l, i + 1))
  const faultAt = parsed.findIndex((c) => c.fault)
  const pct = num(discount)
  const pctOk = pct >= 0 && pct <= 100 && Number.isInteger(pct * 10)
  const good = parsed.flatMap((c) => (c.line ? [c.line] : []))
  const agreedRead = agreed.trim() ? parseEuro(agreed) : undefined
  const agreedCents = agreedRead?.cents ?? null
  const kmRead = kmTyped.trim() ? num(kmTyped) : null
  const kmOk = kmRead === null || (Number.isInteger(kmRead) && kmRead >= 0 && kmRead <= 2000)
  const extras = extrasFor({
    lines: good,
    settings: travelSettingsOf(m.quoting),
    pin: pinOf(job),
    typedKm: kmOk ? kmRead : null,
    mealsProvided: meals,
    ids: Object.fromEntries(q.lines.filter((l) => l.extra).map((l) => [l.extra!, l.id])),
    newId: useStableIds(),
  })
  const all = [...good, ...extras.lines]
  const totals = quoteTotals({ lines: all, discountPct: pctOk ? pct : 0, agreedCents })
  const valid = num(validFor)
  const validOk = Number.isInteger(valid) && valid >= 1 && valid <= 365
  const dep = deposit.trim() ? num(deposit) : null
  const depOk = dep === null || (Number.isInteger(dep) && dep >= 1 && dep <= 100)
  const termProblems: Partial<Record<TermKey, string>> = {}
  if (agreedRead?.reason) termProblems.agreed = `The price agreed: ${agreedRead.reason}`
  else if (agreedCents !== null && agreedCents > totals.subtotal) termProblems.agreed = `The price agreed is more than the lines come to (${money(totals.subtotal)}). Agree a lower price, or change the lines.`
  if (!kmOk) termProblems.km = 'The distance is a whole number of km from 0 to 2,000, or nothing to take it from the map.'
  if (!pctOk) termProblems.discount = 'A discount is a percentage from 0 to 100, such as 10 or 12.5.'
  if (!validOk) termProblems.validFor = 'Prices hold for a whole number of days from 1 to 365.'
  if (!depOk) termProblems.deposit = 'A deposit is a whole percentage from 1 to 100, such as 25 or 50, or nothing for none.'
  const termKey = TERM_KEYS.find((k) => termProblems[k])
  // The first thing that stops the draft saving, where it is, and whether it's been left so it may be said.
  const problem = parsed[faultAt]?.fault?.why ?? (termKey ? termProblems[termKey] : undefined)
  const problemKey = faultAt >= 0 ? lines[faultAt]!.id : termKey
  const problemShown = problemKey !== undefined && touched.has(problemKey)
  const termErr = (k: TermKey) => (touched.has(k) ? termProblems[k] : undefined)
  const bad = (k: TermKey) => (termErr(k) ? { 'aria-invalid': true, 'aria-describedby': `${termIds}-${k}` } : {})
  const termNote = (k: TermKey, hint: ReactNode) => {
    const err = termErr(k)
    if (err)
      return (
        <small className="error" id={`${termIds}-${k}`}>
          {err}
        </small>
      )
    return hint ? <small>{hint}</small> : null
  }
  // What saves (audit of the quote flow, 8 November 2026, finding 13): every whole line, and for one not finished, what it
  // was when last saved, or nothing if it's new. So one half-made line holds back only itself, never the rest.
  const sendable = parsed.flatMap((c, i) => {
    if (c.line) return [c.line]
    const was = q.lines.find((l) => !l.extra && l.id === lines[i]!.id)
    return was ? [was] : []
  })
  const stored = [...sendable, ...extras.lines]
  // Stored: what can save is what the draft holds. Saved: and nothing is held back.
  const storedSame =
    stored.length === q.lines.length &&
    stored.every((l, i) => sameLine(l, q.lines[i]!)) &&
    meals === (q.mealsProvided ?? false) &&
    kmRead === (q.travelKm ?? null) &&
    pct === q.discountPct &&
    agreedCents === (q.agreedCents ?? null) &&
    q.notes.trim() === notes.trim() &&
    valid === (q.validDays ?? DEFAULT_VALID_DAYS) &&
    dep === (q.depositPct ?? null) &&
    forName.trim() === (q.forName ?? '')
  const saved = storedSame && faultAt < 0
  const unpricedLines = good.filter((l) => needsPrice(l, good))
  // Whether there's enough of each product on the job's days (ADR 0089), as the job's kit is checked.
  const checks = quoteKit(job, quoteWants(good, (id) => m.package(id)?.items), today, {
    kit: view.kit,
    models: (id) => view.warehouse.models.find((x) => x.id === id),
    unusable: view.faults.unusable,
    lateOut: view.moves.lateOut,
  })
  // What the kit picker says of each product (research/quoting.md, feature 2): its price and rule, and how many are free
  // on the job's days beyond what the quote already wants, so a product that's short is seen before it's added.
  const kitInputs = { kit: view.kit, models: (id: string) => view.warehouse.models.find((x) => x.id === id), unusable: view.faults.unusable, lateOut: view.moves.lateOut }
  const wantedNow = quoteWants(good, (id) => m.package(id)?.items)
  const aboutKit = (modelId: string) => {
    // A package (ADR 0129): what it holds and what it's charged.
    if (modelId.startsWith(PACKAGE_PICK)) {
      const p = m.package(modelId.slice(PACKAGE_PICK.length))
      if (!p) return ''
      const holds = packageIncludes(p, (id) => view.warehouse.models.find((x) => x.id === id)?.name)
      const price = p.dayCents ? `${money(p.dayCents)} ${p.rate === 'weekly' ? 'a week' : 'a day'}` : 'its kit at its own prices'
      return [price, holds && `holds ${holds}`].filter(Boolean).join(' · ')
    }
    // A rack (ADR 0074) says what's built into it.
    const built = view.racks.of(modelId)?.slots ?? []
    const rack = built.length ? `a rack with ${plural(built.reduce((n, s) => n + s.qty, 0), 'thing')} in it` : ''
    const cents = m.productPrice(modelId)
    const rate = m.productRate(modelId)
    const price = cents === undefined ? 'No price yet' : cents === 0 ? 'Included at no charge' : `${money(cents)} ${rate === 'weekly' ? 'a week' : 'a day'}${rate && rate !== 'daily' ? `, ${RATE_LABELS[rate]}` : ''}`
    const free = kitFree(job, modelId, wantedNow.get(modelId) ?? 0, today, kitInputs)
    const freeWords = free === undefined ? '' : free === 0 ? (wantedNow.get(modelId) ? 'no more free' : 'none free') : wantedNow.get(modelId) ? `${free} more free` : `${free} free`
    // Other quotes for the same days (ADR 0126): said beside what's free, since pencilled kit isn't taken until confirmed.
    const pencilled = free === undefined ? 0 : kitPencilled(job, modelId, today, kitInputs)
    return [rack, price, freeWords, pencilled ? `${pencilled} pencilled for other quotes` : ''].filter(Boolean).join(' · ')
  }
  const shortLines = good.filter((l) => linesShort(l, checks, m.package(l.packageId ?? '')?.items).length > 0)
  // What it makes (ADR 0089), for the office and directors, who see quotes at all.
  const boss = useAccess().can('money')
  const ownPct = m.quoting.ownKitCostPct
  const costOf = (l: QuoteLine) => lineCostOf(l, l.kind === 'crew' ? m.bookedRate(job.id, l) : undefined, ownPct)
  const margin = quoteMargin(totals.net, all.map(costOf), ownKitUncosted(all, ownPct))
  const noCostLines = boss ? good.filter((l) => costOf(l) === undefined) : []
  // What to look at before a quote goes (research/quoting.md, feature 3), gathered at the moment it's sent or marked
  // sent, each opening where it's put right: what the client would see wrong, not the cost side, which isn't printed.
  const beforeItGoes: { key: string; words: string; look?: () => void }[] = []
  if (unpricedLines.length)
    beforeItGoes.push({ key: 'price', words: `${plural(unpricedLines.length, 'line')} with no price, which ${unpricedLines.length === 1 ? 'goes' : 'go'} to the client as €0.00`, look: () => openLine(unpricedLines[0]!.id, 'price') })
  if (shortLines.length)
    beforeItGoes.push({ key: 'short', words: `${plural(shortLines.length, 'line')} short of kit on the job's days`, look: () => openLine(shortLines[0]!.id) })
  if (extras.travel.km === null && good.some((l) => l.kind === 'crew'))
    beforeItGoes.push({ key: 'travel', words: "No travel for the crew: the venue isn't on the map, so the distance isn't known", look: () => openLine(TRAVEL_ROW) })
  if (job.span && job.span.start < today) beforeItGoes.push({ key: 'past', words: `The job's first day, ${dayLabel(job.span.start)}, has passed` })
  // What each line was last charged in Current RMS (ADR 0092), by the names it goes by there.
  const namesOf = (l: LineDraft) => rmsNames(l, (id) => view.warehouse.models.find((x) => x.id === id))
  const last = useLastCharged(boss, job.id, lines.flatMap(namesOf).slice(0, MOST_LAST_CHARGED_NAMES))

  // The draft saves itself a moment after typing stops, once it reads as a quote: there's no Save to forget. Leaving
  // the page saves what's waiting at once. Saving goes through the device's queue, so it works with no signal.
  const payload =
    !storedSame && !termKey
      ? { id: q.id, projectId: job.id, lines: stored.slice(0, MAX_LINES), discountPct: pct, agreedCents, notes, validDays: valid, depositPct: dep, mealsProvided: meals, travelKm: kmRead, forName: forName.trim(), base: draftBase(opened.current) }
      : undefined
  const waiting = useRef(payload)
  waiting.current = payload
  // While the job is pencilled in, its kit list follows the draft (ADR 0126), so another quote for the same days sees it
  // and confirming the job holds it. Done by whoever may change the kit, as they save; the rest leave it to the Kit tab.
  const mayKit = useAccess().can('kit')
  const following = useRef({ view, job, mayKit })
  following.current = { view, job, mayKit }
  const flush = () => {
    const p = waiting.current
    if (!p) return
    waiting.current = undefined
    void run(async () => {
      await client.mutate('quote.save', p)
      const f = following.current
      if (f.mayKit && holdOf(f.job.status) === 'pencilled') await matchKitToQuote(f.view, f.job.id, p.lines)
    })
  }
  const key = payload ? JSON.stringify(payload) : ''
  useEffect(() => {
    if (!key) return
    const t = setTimeout(flush, SAVE_AFTER_MS)
    return () => clearTimeout(t)
  }, [key])
  useEffect(() => () => flush(), [])
  // With email off, sending is getting the numbered PDF (audit of the quote flow, 8 November 2026, finding 14): one press
  // marks it sent, which gives it its number, and opens it to print or save, so it's never marked sent with nothing to send.
  const markAndPrint = () => void run(() => markSent(q.id, job, sentOn || today)).then((ok) => ok && !canEmail && onPrint())
  // Accepted by phone gets the same last look as sending (finding 18): it's the quote that becomes the invoice.
  const accept = () => void run(() => client.mutate('quote.answer', { id: q.id, answer: 'accepted', on: sentOn || today }))
  const late = useLate(!!payload)
  // Kept on the device while it can't save (finding 27), and let go once it can.
  const typed = !saved && problem ? JSON.stringify({ base: baseOf(q), lines, meals, kmTyped, discount, agreed, notes, validFor, deposit, forName } satisfies Typed) : ''
  useEffect(() => keepTyped(q.id, typed ? (JSON.parse(typed) as Typed) : undefined), [typed])

  const days = jobDays(job)
  const addLine = (
    l: Omit<LineDraft, 'id' | 'rate' | 'out' | 'discount' | 'packageId' | 'includes' | 'subhire' | 'supplier' | 'cost'> & Partial<Pick<LineDraft, 'rate' | 'packageId' | 'includes' | 'cost'>>,
    keepAdding = false
  ) => {
    const id = newId()
    setLines((ls) => [...ls, { rate: null, out: l.days, discount: '', packageId: null, includes: '', subhire: '', supplier: '', cost: '', id, ...l }])
    // Kit is picked one product after another (audit, 5 November 2026, finding 58): the picker stays open with the cursor in it for the
    // next, and the line it added waits closed, its How many a tap away.
    if (keepAdding) return setKitPicks((n) => n + 1)
    openLine(id)
    setAdding(undefined)
  }
  const addKit = (modelId: string, count = 1) => {
    const model = view.warehouse.models.find((x) => x.id === modelId)
    if (!model) return
    const cents = m.productPrice(modelId)
    // Charged by the product's rule (ADR 0085), for the job's days out.
    const rate = m.productRate(modelId)
    addLine({
      kind: 'kit',
      what: model.name,
      ref: null,
      modelId,
      group: DEPARTMENT_LABELS[model.department],
      qty: String(count),
      days: String(days),
      price: cents === undefined || cents === 0 ? '' : euroText(cents),
      vat: STANDARD_VAT,
      per: 'day',
      rate: rate && rate !== 'daily' ? rate : null,
      // Priced at €0 on the price list, it's given at no charge (audit of the quote flow, 8 November 2026, finding 1).
      ...(cents === 0 ? { included: true } : {}),
    }, true)
    // A rack (ADR 0074) goes with what's built into it, listed under it as a package's kit is (ADR 0116), included in its price.
    const slots = view.racks.of(modelId)?.slots ?? []
    if (model.isRack && slots.length) {
      const inIt = new Map<string, number>()
      for (const sl of slots) inIt.set(sl.modelId, (inIt.get(sl.modelId) ?? 0) + sl.qty)
      setLines((ls) => {
        const rackLine = ls.at(-1)
        if (!rackLine || rackLine.modelId !== modelId) return ls
        const kids = [...inIt].flatMap(([id, n]): LineDraft[] => {
          const x = view.warehouse.models.find((y) => y.id === id)
          if (!x) return []
          return [
            { ...rackLine, id: newId(), what: x.name, modelId: id, group: DEPARTMENT_LABELS[x.department], qty: String(n * count), price: euroText(0), rate: null, under: rackLine.id },
          ]
        })
        return [...ls, ...kids].slice(0, MAX_LINES)
      })
    }
  }
  // A package (ADR 0087) is a shortcut for adding its kit (ADR 0116): its line, named for it, and each product it holds as a
  // line under it, to change for this job. A package with its own price is charged at that, with its kit included; one
  // without is its kit at the price list's prices. What else it includes in words is written on its line.
  const addPackage = (packageId: string, count = 1, keepAdding = false) => {
    const p = m.package(packageId)
    if (!p) return
    const whole = p.dayCents > 0
    // What its items come to, which its own price is a discount from (ADR 0116): kept on its line for the quote to show.
    const worth = packageWorth(p, (id) => ({ cents: m.productPrice(id), rate: m.productRate(id) }))
    const full = whole && !worth.unpriced && packageSaving(worth.cents, p.dayCents) ? worth.cents : undefined
    const titleId = newId()
    const blank = { ref: null, vat: STANDARD_VAT, per: 'day' as const, discount: '', includes: '', subhire: '', supplier: '', cost: '', days: String(days), out: String(days) }
    const title: LineDraft = {
      ...blank,
      id: titleId,
      kind: 'kit',
      what: p.name,
      modelId: null,
      group: DEPARTMENT_LABELS[p.department],
      qty: String(count),
      price: euroText(whole ? p.dayCents : 0),
      rate: whole && p.rate && p.rate !== 'daily' ? p.rate : null,
      packageId: p.id,
      includes: p.notes.trim(),
      ...(full ? { full } : {}),
    }
    const kids = p.items.flatMap((i): LineDraft[] => {
      const model = view.warehouse.models.find((x) => x.id === i.modelId)
      if (!model) return []
      const cents = whole ? 0 : m.productPrice(i.modelId)
      const rate = whole ? undefined : m.productRate(i.modelId)
      return [
        {
          ...blank,
          id: newId(),
          kind: 'kit',
          what: model.name,
          modelId: i.modelId,
          group: DEPARTMENT_LABELS[model.department],
          qty: String(i.qty * count),
          price: cents === undefined || cents === 0 ? '' : euroText(cents),
          rate: rate && rate !== 'daily' ? rate : null,
          packageId: null,
          under: titleId,
          ...(!whole && cents === 0 ? { included: true } : {}),
        },
      ]
    })
    setLines((ls) => [...ls, title, ...kids].slice(0, MAX_LINES))
    // Found in Add kit (ADR 0129), it waits closed like any kit picked there, the picker open for the next.
    if (keepAdding) return setKitPicks((n) => n + 1)
    setShownSets((now) => new Set(now).add(titleId))
    openLine(titleId)
    setAdding(undefined)
  }
  // Packages are found in Add kit with the products (ADR 0129; audit of the quote flow, finding 12), each marked as one.
  const kitFinds = useMemo(
    () => [...view.warehouse.models, ...m.packages.map((p) => ({ id: PACKAGE_PICK + p.id, name: p.name, department: p.department, category: 'Package', aliases: [] }))],
    [view.warehouse.models, m.packages]
  )
  const pickKit = (id: string, count = 1) => (id.startsWith(PACKAGE_PICK) ? addPackage(id.slice(PACKAGE_PICK.length), count, true) : addKit(id, count))
  // The quote's kit, as a package to start the next one from (ADR 0116): each product once, with how many.
  const kitStart = (): PackageStart => {
    const qty = new Map<string, number>()
    for (const l of lines) if (l.kind === 'kit' && l.modelId) qty.set(l.modelId, (qty.get(l.modelId) ?? 0) + Math.max(1, Math.round(Number(l.qty)) || 1))
    const items = [...qty].map(([modelId, n]) => ({ modelId, qty: Math.min(10_000, n) })).slice(0, MOST_PACKAGE_ITEMS)
    const depts = new Map<Department, number>()
    for (const i of items) {
      const d = view.warehouse.models.find((x) => x.id === i.modelId)?.department
      if (d) depts.set(d, (depts.get(d) ?? 0) + 1)
    }
    return { items, department: [...depts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'audio' }
  }
  const addCrew = (role: string, count = 1) => {
    const r = m.roles.find((x) => x.role === role)
    const cents = r?.cents ?? r?.booked
    addLine({ kind: 'crew', what: role, ref: null, modelId: null, group: 'Crew', qty: String(count), days: String(days), price: cents === undefined ? '' : euroText(cents), vat: STANDARD_VAT, per: 'day' })
  }
  const addOther = () => addLine({ kind: 'other', what: '', ref: null, modelId: null, group: '', qty: '1', days: '1', price: '', vat: STANDARD_VAT, per: 'once' })
  // Words only (ADR 0128; finding 11): a heading or a note, under the last group until it's moved.
  const addWords = () => addLine({ kind: 'other', what: '', ref: null, modelId: null, group: groups.at(-1)?.group ?? '', qty: '1', days: '1', price: '', vat: STANDARD_VAT, per: 'once', words: true })
  // The office's order (ADR 0128): a line up or down its group, a group up or down among its kind.
  const moved = (next: LineDraft[] | undefined) => (next ? () => setLines(next) : undefined)
  // Transport (ADR 0089): charged once, with what it costs us beside it; named for a van booked on the job when there is one.
  const addTransport = (what: string, ref: string | null) =>
    addLine({ kind: 'other', what, ref, modelId: null, group: 'Transport', qty: '1', days: '1', price: '', vat: STANDARD_VAT, per: 'once' })
  const vans = view.vehicles.ofJob(job.id).filter((b) => b.vehicle && !lines.some((l) => l.ref === b.id))
  // A package's line goes with its kit, and comes back with it.
  const remove = (l: LineDraft) => {
    const under = linesUnder(lines, l.id)
    setRemoved({ line: l, at: lines.indexOf(l), under })
    setLines((ls) => ls.filter((x) => x.id !== l.id && x.under !== l.id))
    if (open === l.id) setOpen(undefined)
  }
  // A short line hires in what it's short of (ADR 0089), then opens for who from and what it costs.
  const hireIn = (l: LineDraft, n: number) => {
    set(l.id, { subhire: String(Math.min(num(l.qty), (num(l.subhire) || 0) + n)) })
    openLine(l.id, 'what', true)
  }
  const undoRemove = () => {
    if (!removed) return
    setLines((ls) => [...ls.slice(0, removed.at), removed.line, ...removed.under, ...ls.slice(removed.at)])
    setRemoved(undefined)
  }
  const allKitDays = () => {
    const d = num(kitDays)
    if (!(d >= 0.5 && d <= 365 && Number.isInteger(d * 2))) return refuse('Days charged is a number of days, in halves, from 0.5 to 365.')
    // Lines charged by a rule work theirs out from their days out (ADR 0085), so this is for those charged by the day.
    setLines((ls) => ls.map((l) => (l.kind === 'kit' && l.per === 'day' && !l.rate ? { ...l, days: String(d) } : l)))
    setKitDays('')
    setKitDaysOpen(false)
  }
  // A department's discount (ADR 0085) is put on each of its lines, so each line still says what it's charged.
  const groupDiscount = (group: string, off: string) => {
    setLines((ls) => ls.map((l) => (l.group === group ? { ...l, discount: off } : l)))
    setDiscounting(undefined)
  }
  const groups = linesByGroup(lines)
  // Groups to pick from for a line: the quote's own, then the departments not used yet.
  const groupNames = [...new Set([...groups.map((g) => g.group), ...Object.values(DEPARTMENT_LABELS), 'Crew', 'Transport'])]
  const kitLines = lines.filter((l) => l.kind === 'kit' && l.per === 'day' && !l.rate).length
  const source = m.sourceOf(job.id)
  // Every line counts here, finished or not, so one being typed isn't offered again as new on the job.
  // What's built into a rack goes with the rack (ADR 0116), so isn't kit of its own to keep up with the job.
  const racked = inRacks(lines)
  const asLines = lines.filter((l) => !racked.has(l)).map((l): QuoteLine => ({ id: l.id, kind: l.kind, what: l.what, ref: l.ref, group: l.group, qty: num(l.qty), days: 1, unitCents: 0, vat: l.vat, modelId: l.modelId }))
  // The products in the quote's packages, so kit put on the job from them isn't offered again (ADR 0102).
  const packaged = new Set(lines.flatMap((l) => (l.packageId ? (m.package(l.packageId)?.items ?? []).map((i) => i.modelId) : [])))
  const changes = changesFromJob(asLines, source.kit, source.crew, { product: m.productPrice, role: m.rolePrice, rate: m.productRate }, newId, packaged)
  // What the mail asks for since the draft was changed (ADR 0098) is shown against the lines as they read, and taken here as if typed.
  const claude = useClaude(view)
  const asked: AskedLine[] = good.map((l) => ({ id: l.id, kind: l.kind, what: l.what, group: l.group, qty: l.qty, days: l.out ?? l.days, per: l.per ?? 'day', unitCents: l.unitCents, discountPct: l.discountPct ?? 0 }))
  const takeAdvice = (a: Advice) => {
    setLines((ls) => [
      ...ls
        .filter((l) => !a.remove[l.id])
        .map((l) => {
          const c = a.change[l.id] ? a.advice.change.find((x) => x.lineId === l.id) : undefined
          if (!c) return l
          return {
            ...l,
            ...(c.qty != null ? { qty: String(c.qty) } : {}),
            // A line charged by a rule (ADR 0085) is shown its days out, so those are what change.
            ...(c.days != null && l.per === 'day' ? (l.rate ? { out: String(c.days) } : { days: String(c.days) }) : {}),
            ...(c.discountPct != null ? { discount: c.discountPct ? String(c.discountPct) : '' } : {}),
            ...(c.priceCents != null ? { price: euroText(c.priceCents) } : {}),
          }
        }),
      ...a.add.filter((x) => x.take).map((x) => toDraft(suggestionLine(x.s, newId()))),
    ])
    if (a.discount && a.advice.discountPct !== null) setDiscount(String(a.advice.discountPct))
  }
  // "Not saved yet" leads to what stops it: the line opens, or the terms field takes the focus, and its fault is said.
  const goToProblem = () => {
    if (problemKey === undefined) return
    touch(problemKey)
    if (faultAt >= 0) {
      if (open !== problemKey) return openLine(problemKey)
      // Already open, perhaps scrolled away (Send in the strip leads here too): to its first field at fault, once said.
      const n = faultAt + 1
      return void requestAnimationFrame(() => {
        const at = under.current?.querySelector<HTMLElement>(`[aria-invalid="true"][aria-label^="Line ${n}:"]`) ?? under.current?.querySelector<HTMLElement>(`[aria-label="Line ${n}: what"]`)
        if (at) glideTo(at, { block: 'center', focus: at })
      })
    }
    if (problemKey === 'km') return openLine(TRAVEL_ROW)
    termRefs.current[problemKey as TermKey]?.focus()
  }
  const full = lines.length >= MAX_LINES
  const nextNumber = m.quotesOf(job.id).find((v) => v.number)?.number ?? m.nextNumber
  // Send never leaves the strip (ADR 0140, part 2): one press does it, or says what stops it and takes you there. What
  // it starts, the last look or the email box, opens under Send at the foot, and the page glides there to show it.
  const sendHead = useRef<HTMLHeadingElement>(null)
  const [toFoot, setToFoot] = useState(0)
  useEffect(() => {
    if (toFoot && sendHead.current) glideTo(sendHead.current, { mark: sendHead.current })
  }, [toFoot])
  const send = () => {
    if (canEmail) {
      if (beforeItGoes.length) setFree('email')
      else setSending('email')
    } else if (beforeItGoes.length) setFree('mark')
    else return markAndPrint()
    setToFoot((n) => n + 1)
  }
  // Pressed while the last change is still saving: it saves at once, and sends once it has.
  const [sendSaved, setSendSaved] = useState(false)
  useEffect(() => {
    if (sendSaved && saved) {
      setSendSaved(false)
      send()
    } else if (sendSaved && (error || problem)) setSendSaved(false)
  }, [sendSaved, saved, error, problem])
  const sendWord = canEmail ? 'Send to the client' : 'Get the PDF to send'
  const unfinished = parsed.filter((c) => !c.line).length
  // One line, shut or open to change. A package's line (ADR 0116) comes to its own price and its kit's, and kit in a package
  // priced as a whole is included in it.
  const row = (l: LineDraft, under: readonly LineDraft[] = []) => {
    const n = lines.indexOf(l) + 1
    const c = parsed[n - 1]!
    const done = c.line
    const underDone = under.map((u) => parsed[lines.indexOf(u)]?.line)
    const setTotal = done && under.length && underDone.every(Boolean) ? lineCents(done) + underDone.reduce((t, u) => t + lineCents(u!), 0) : undefined
    const included = !!done && !needsPrice(done, good) && done.unitCents === 0 && !!l.under
    const kit = done && <KitNote l={done} checks={checks} items={under.length ? undefined : m.package(l.packageId ?? '')?.items} names={(id) => view.warehouse.models.find((x) => x.id === id)?.name} onHire={l.modelId ? (k) => hireIn(l, k) : undefined} full={open === l.id} span={job.span} />
    const cost = done ? costOf(done) : undefined
    return open !== l.id ? (
      <div key={l.id} className="quote-line-row">
        <LineSummary l={l} n={n} done={done} onOpen={() => openLine(l.id)} focus={shut === l.id} margin={boss && done ? lineMargin(done, cost) : undefined} total={setTotal} included={included} heads={under.length > 0} />
        {kit}
      </div>
    ) : (
      <div key={l.id} className="quote-line-row open">
        <LineEditor
          l={l}
          n={n}
          done={done}
          fault={c.fault}
          left={touched.has(l.id)}
          focus={focusField}
          set={(ch) => set(l.id, ch)}
          onRemove={() => remove(l)}
          onDone={() => {
            touch(l.id)
            setShut(l.id)
            setOpen(undefined)
          }}
          onLeave={() => touch(l.id)}
          kit={kit}
          last={<LastCharged found={lastOf(last, namesOf(l))} n={n} price={l.price} onUse={(cents) => set(l.id, { price: euroText(cents) })} />}
          cost={cost}
          boss={boss}
          suppliers={view.kit.suppliers}
          wantCost={wantCost}
          included={included || (under.length > 0 && !!l.packageId)}
          {...(l.under ? {} : { groups: groupNames, onMove: { up: moved(moveLine(lines, l.id, -1)), down: moved(moveLine(lines, l.id, 1)) } })}
        />
      </div>
    )
  }
  const undoLine = removed && (
    <p className="undo-line" aria-live="polite">
      Removed “{removed.line.what || 'a line'}”.{' '}
      <button type="button" className="link" onClick={undoRemove}>
        Undo
      </button>
    </p>
  )
  const removedGroup = removed ? linesByGroup([removed.line])[0]!.group : undefined

  return (
    <form
      ref={under}
      className={`quote-draft${adding === 'kit' || adding === 'crew' ? ' picking' : ''}`}
      aria-label={`Version ${q.version}, a draft`}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        flush()
      }}
    >
      <section className="card quote-main">
        <header className="title">
          <h2>Version {q.version}</h2>
          <QuotePill q={q} />
        </header>
        {/* What it comes to, in view while the lines are changed below, with what needs a look: each a way to the first such line. */}
        <div className="quote-summary" role="group" aria-label="What it comes to">
          <div className="figures">
            <span className="figure lead">
              <small>Before VAT</small> <b>{money(totals.net)}</b>
            </span>
            <span className="figure">
              <small>Total</small> <b>{money(totals.gross)}</b>
            </span>
            {boss && (
              <span className={`figure${margin.margin < 0 ? ' bad' : ''}`}>
                <small>Expected margin</small> <b>{money(margin.margin)}</b>
                {margin.pct !== null && <span className="pct">{pctWord(margin.pct)}</span>}
                {/* Said beside it, so own kit at no cost doesn't read as a margin that high (finding 19 of the quote flow audit). */}
                {margin.ownUncosted && (
                  <a className="pct" href="#admin/company">
                    own kit not costed
                  </a>
                )}
              </span>
            )}
            <span className="send-state">
            <span className="save-state" aria-live="polite">
              {termKey ? (
                'Not saved yet'
              ) : faultAt >= 0 ? (
                `Line ${faultAt + 1} not saved`
              ) : payload ? (
                late ? (
                  'Saving…'
                ) : (
                  ''
                )
              ) : q.pending ? (
                'Saved on this device'
              ) : (
                'Saved'
              )}
            </span>
            {lines.length > 0 &&
              (problem ? (
                <button type="button" className="send-now" onClick={goToProblem}>
                  {termKey ? 'Send: a term to put right' : `Send: ${plural(unfinished, 'line')} to finish`}
                </button>
              ) : (
                <button
                  type="button"
                  className={plain ? 'send-now' : 'primary send-now'}
                  disabled={sendSaved}
                  onClick={() => {
                    if (saved) return send()
                    flush()
                    setSendSaved(true)
                  }}
                >
                  {sendSaved ? 'Saving…' : sendWord}
                </button>
              ))}
            </span>
          </div>
          {unpricedLines.length + shortLines.length + noCostLines.length > 0 && (
            <div className="chips">
              {unpricedLines.length > 0 && (
                <button type="button" className="chip" onClick={() => openLine(unpricedLines[0]!.id, 'price')}>
                  {plural(unpricedLines.length, 'line')} with no price
                </button>
              )}
              {shortLines.length > 0 && (
                <button type="button" className="chip" onClick={() => openLine(shortLines[0]!.id)}>
                  {plural(shortLines.length, 'line')} short of kit
                </button>
              )}
              {noCostLines.length > 0 && (
                <button type="button" className="chip" onClick={() => openLine(noCostLines[0]!.id, 'what', true)}>
                  {plural(noCostLines.length, 'line')} with no cost yet
                </button>
              )}
            </div>
          )}
        </div>

        <JobChangesCard changes={changes} quoteId={q.id} onTake={(next) => setLines((ls) => next(ls))} />
        {bothChanged.length > 0 && (
          <p className="warn-line both-changed" role="status">
            Someone else changed {bothChanged.length === 1 ? `“${bothChanged[0]}”` : `${bothChanged.length} of the same lines`} while you were on it. Yours is kept, and the rest of their changes are in.{' '}
            <button type="button" className="link" onClick={() => setBothChanged([])}>
              OK
            </button>
          </p>
        )}
        {claude.offered && <MailOnQuote view={view} projectId={job.id} jobDays={days} lines={asked} discountPct={pctOk ? pct : 0} onTake={takeAdvice} />}

        {lines.length === 0 && <Empty>No lines yet. Add kit, crew or anything else the quote is for.</Empty>}
        {groups.map((g) => {
          // Folded, unless a line in it is open: one being changed, or just added, is never hidden.
          const shut = isFolded(g.group, g.lines) && !g.lines.some((l) => l.id === open)
          const groupCents = g.lines.reduce((t, l) => t + (parsed[lines.indexOf(l)]?.line ? lineCents(parsed[lines.indexOf(l)]!.line!) : 0), 0)
          return (
          <section key={g.group} className={`quote-group${shut ? ' folded' : ''}`} role="group" aria-label={g.group}>
            <div className="group-head">
              <h3 className="group">
                <button type="button" className="fold" aria-expanded={!shut} onClick={() => fold(g.group, !shut)}>
                  {g.group}
                  {shut && (
                    <small>
                      {' '}
                      {plural(g.lines.length, 'line')} · {money(groupCents)}
                    </small>
                  )}
                </button>
              </h3>
              {groups.length > 1 && (moveGroup(lines, g.group, -1) || moveGroup(lines, g.group, 1)) && (
                <span className="group-move">
                  <button type="button" className="link quiet" onClick={moved(moveGroup(lines, g.group, -1))} disabled={!moveGroup(lines, g.group, -1)} aria-label={`Move ${g.group} up`}>
                    Up
                  </button>
                  <button type="button" className="link quiet" onClick={moved(moveGroup(lines, g.group, 1))} disabled={!moveGroup(lines, g.group, 1)} aria-label={`Move ${g.group} down`}>
                    Down
                  </button>
                </span>
              )}
              {g.lines.length > 1 && discounting !== g.group && (
                <button type="button" className="link quiet" onClick={() => setDiscounting(g.group)}>
                  Discount every line…
                </button>
              )}
            </div>
            {discounting === g.group && <GroupDiscount group={g.group} onApply={(off) => groupDiscount(g.group, off)} onCancel={() => setDiscounting(undefined)} refuse={refuse} />}
            {!shut && g.lines.map((l) => {
              const under = linesUnder(lines, l.id)
              if (!under.length) return row(l)
              const shown = shownSets.has(l.id) || under.some((u) => u.id === open)
              return (
                <div key={l.id} className="quote-set">
                  {row(l, under)}
                  <button type="button" className="link quiet set-toggle" aria-expanded={shown} onClick={() => toggleSet(l.id)}>
                    {shown ? 'Hide what’s in it' : `What’s in it (${plural(under.length, 'line')})`}
                  </button>
                  {shown && <div className="set-lines">{under.map((u) => row(u))}</div>}
                </div>
              )
            })}
            {removedGroup === g.group && undoLine}
          </section>
          )
        })}
        {removed && !groups.some((g) => g.group === removedGroup) && undoLine}
        {/* A dry hire has no travel or subsistence to charge (ADR 0128; finding 10), until it has crew on it after all. */}
        {(kindOf(job) !== 'hire' || good.some((l) => l.kind === 'crew')) && (
          <TravelAndSubsistence
            extras={extras}
            meals={meals}
            setMeals={setMeals}
            km={kmTyped}
            setKm={setKmTyped}
            kmProblem={termErr('km')}
            onLeaveKm={() => touch('km')}
            fuelSetOn={m.quoting.fuelSetOn ?? null}
            today={today}
            open={open}
            setOpen={openLine}
          />
        )}

        <div className="quote-add" role="group" aria-label="Add to the quote">
          {adding === 'kit' ? (
            <div
              className="adding"
              onKeyDown={(e) => {
                // An Escape the picker didn't use (nothing typed, its list shut) closes it.
                if (e.key === 'Escape') setAdding(undefined)
              }}
            >
              <ProductPicker
                key={kitPicks}
                autoFocus
                label="Kit to add"
                products={kitFinds}
                value=""
                onPick={pickKit}
                counted
                about={aboutKit}
                hint={
                  kitPicks
                    ? `${plural(kitPicks, 'line')} added. Pick the next, or Done.`
                    : `Type how many first, as 12 y10. Priced from the price list; free counts are for the job's days.${m.packages.length ? ' Packages are found here too.' : ''}`
                }
              />
              <button type="button" className="link" onClick={() => setAdding(undefined)}>
                {kitPicks ? 'Done' : 'Cancel'}
              </button>
            </div>
          ) : adding === 'package' ? (
            <AddPackage packages={m.packages} onAdd={addPackage} onCancel={() => setAdding(undefined)} />
          ) : adding === 'save-package' ? (
            <PackageEditor view={view} start={kitStart()} onDone={() => setAdding(undefined)} />
          ) : adding === 'transport' ? (
            <AddTransport
              vans={vans.map((b) => ({ id: b.id, what: transportWords(b.vehicle!.kind, !!b.driver), name: `${b.vehicle!.name}${b.driver ? `, ${b.driver.name} driving` : ''}` }))}
              onAdd={addTransport}
              onCancel={() => setAdding(undefined)}
            />
          ) : adding === 'crew' ? (
            <AddCrew roles={m.roles.map((r) => r.role)} onAdd={addCrew} onCancel={() => setAdding(undefined)} />
          ) : (
            <>
              <button type="button" onClick={() => setAdding('kit')} disabled={full}>
                <Icon name="add" />
                Add kit
              </button>
              <button type="button" onClick={() => setAdding('crew')} disabled={full}>
                <Icon name="add" />
                Add crew
              </button>
              {m.packages.length > 0 && (
                <button type="button" onClick={() => setAdding('package')} disabled={full}>
                  <Icon name="add" />
                  Add a package
                </button>
              )}
              <button type="button" onClick={() => setAdding('transport')} disabled={full}>
                <Icon name="add" />
                Add transport
              </button>
              <button type="button" onClick={addOther} disabled={full}>
                <Icon name="add" />
                Add something else
              </button>
              <button type="button" onClick={addWords} disabled={full}>
                <Icon name="add" />
                Add words
              </button>
              {lines.some((l) => l.kind === 'kit' && l.modelId) && (
                <button type="button" className="link" onClick={() => setAdding('save-package')}>
                  Save the kit as a package
                </button>
              )}
            </>
          )}
        </div>
        {kitLines > 0 &&
          (kitDaysOpen ? (
            <div className="kit-days-all">
              <label>
                Charge all kit for
                <UnitBox unit="days">
                  <input
                    inputMode="decimal"
                    value={kitDays}
                    onChange={(e) => setKitDays(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        allKitDays()
                      }
                    }}
                    placeholder="3"
                    aria-label="Days charged for all kit"
                    autoFocus
                  />
                </UnitBox>
              </label>
              <button type="button" onClick={allKitDays} disabled={!kitDays.trim()}>
                Apply
              </button>
              <button type="button" className="link" onClick={() => setKitDaysOpen(false)}>
                Cancel
              </button>
              <p className="hint">A week's hire charged as three days, say. Each line's days can still be changed on its own.</p>
            </div>
          ) : (
            <button type="button" className="link quiet" onClick={() => setKitDaysOpen(true)}>
              Charge all kit for the same days…
            </button>
          ))}
      </section>

      <section className="card quote-side">
        <h3 className="quote-head group">Terms</h3>
        <div className="quote-terms quote-discount">
          {agreedCents === null ? (
            <label className="field">
              Discount
              <UnitBox unit="%">
                <input
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  onBlur={() => touch('discount')}
                  ref={(el) => {
                    termRefs.current.discount = el
                  }}
                  // None, as Deposit says it, rather than a 0 (audit, 5 November 2026, finding 89).
                  placeholder="None"
                  aria-label="Discount, %"
                  {...bad('discount')}
                />
              </UnitBox>
              {termNote('discount', m.discountOf(job.clientId) !== undefined && `${job.client?.name} usually gets ${pctWord(m.discountOf(job.clientId)!)} off.`)}
            </label>
          ) : (
            <div className="field">
              Discount
              <p className="agreed-note">
                {money(totals.discount)} off, {pctWord(totals.discountPct)}, to come to the price agreed.
              </p>
            </div>
          )}
          <label className="field">
            Agree a total
            <UnitBox unit="€" before>
              <input
                inputMode="decimal"
                value={agreed}
                onChange={(e) => setAgreed(e.target.value)}
                onBlur={() => touch('agreed')}
                ref={(el) => {
                  termRefs.current.agreed = el
                }}
                placeholder="None"
                aria-label="Agreed price before VAT, €"
                {...bad('agreed')}
              />
            </UnitBox>
            {termNote('agreed', agreed.trim() ? 'Before VAT. Clear it to go back to a percentage.' : 'Before VAT: the discount becomes whatever comes to it.')}
          </label>
        </div>
        <div className="quote-terms">
          <label className="field">
            Prices hold for
            <UnitBox unit="days">
              <input
                inputMode="numeric"
                value={validFor}
                onChange={(e) => setValidFor(e.target.value)}
                onBlur={() => touch('validFor')}
                ref={(el) => {
                  termRefs.current.validFor = el
                }}
                aria-label="Prices hold for, days"
                {...bad('validFor')}
              />
            </UnitBox>
            {termNote('validFor', `Printed as valid until ${dayLabel(validUntil({ sentOn: null, validDays: validOk ? valid : DEFAULT_VALID_DAYS }, today))} if sent today.`)}
          </label>
          <label className="field">
            Deposit
            <UnitBox unit="%">
              <input
                inputMode="numeric"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                onBlur={() => touch('deposit')}
                ref={(el) => {
                  termRefs.current.deposit = el
                }}
                placeholder="None"
                aria-label="Deposit, %"
                {...bad('deposit')}
              />
            </UnitBox>
            {termNote('deposit', dep !== null && depOk && `${money(depositCents(totals.gross, dep))} before the job, of ${money(totals.gross)}.`)}
          </label>
        </div>
        {/* Who at the client it's for (ADR 0128; audit of the quote flow, finding 6): printed under the client's name. */}
        {job.client && (job.client.contacts.length > 0 || forName) && (
          <label className="field">
            For
            <select value={forName} onChange={(e) => setForName(e.target.value)} aria-label="Who at the client it's for">
              <option value="">{job.client.contacts[0] ? `${job.client.contacts[0].name} (their first contact)` : 'Nobody named'}</option>
              {job.client.contacts.slice(1).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                  {c.role ? `, ${c.role}` : ''}
                </option>
              ))}
              {forName && !job.client.contacts.slice(1).some((c) => c.name === forName) && <option value={forName}>{forName}</option>}
            </select>
          </label>
        )}
        <label className="field">
          Notes for the client
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} placeholder="Load in from 8am. Prices include delivery to the venue." />
        </label>

        <Totals totals={totals} agreed={agreedCents !== null} />

        <h3 className="quote-head group" ref={sendHead}>
          Send
        </h3>
        <Refusal error={error} />
        {!saved &&
          problem &&
          (termKey ? (
            problemShown ? <p className="warn-line">{problem} It saves once that's put right.</p> : <p className="hint">Not saved yet.</p>
          ) : problemShown ? (
            <p className="warn-line">{problem} The rest is saved; this line saves once it's put right.</p>
          ) : (
            <p className="hint">Line {faultAt + 1} isn't finished, so it isn't saved. The rest is.</p>
          ))}
        {saved && q.lines.length > 0 && sending === 'email' ? (
          <SendQuote q={q} onSent={() => setSending(undefined)} onCancel={() => setSending(undefined)} />
        ) : (
          <>
            {saved && q.lines.length > 0 && (!canEmail || sending === 'other') && (
              <div className="quote-send">
                <label>
                  Sent to the client on
                  <input type="date" value={sentOn} max={irishToday()} onChange={(e) => setSentOn(e.target.value)} />
                </label>
                {canEmail && (
                  <button type="button" onClick={() => (beforeItGoes.length ? setFree('mark') : markAndPrint())}>
                    Mark as sent
                  </button>
                )}
              </div>
            )}
            {free && beforeItGoes.length > 0 && (
              <Confirm
                className="before-it-goes"
                question={beforeItGoes.length === 1 ? `Before it goes: ${beforeItGoes[0]!.words}.` : `Before it goes, ${beforeItGoes.length} things to look at.`}
                yes={free === 'email' ? 'Send it anyway' : free === 'accept' ? 'Record it anyway' : canEmail ? 'Mark it sent anyway' : 'Get the PDF anyway'}
                no="Look first"
                onYes={() => {
                  setFree(undefined)
                  if (free === 'email') setSending('email')
                  else if (free === 'accept') accept()
                  else markAndPrint()
                }}
                onNo={() => {
                  setFree(undefined)
                  beforeItGoes.find((b) => b.look)?.look?.()
                }}
              >
                {beforeItGoes.length > 1 && (
                  <ul>
                    {beforeItGoes.map((b) => (
                      <li key={b.key}>
                        {b.look ? (
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              setFree(undefined)
                              b.look!()
                            }}
                          >
                            {b.words}
                          </button>
                        ) : (
                          b.words
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Confirm>
            )}
            <div className="actions">
              <button type="button" onClick={onPrint} disabled={!saved}>
                Print a draft
              </button>
              {saved && q.lines.length > 0 && canEmail && sending !== 'other' && (
                <button type="button" className="link quiet" onClick={() => setSending('other')}>
                  Sent another way? Mark as sent
                </button>
              )}
              {saved &&
                q.lines.length > 0 &&
                (!answering ? (
                  <button type="button" className="link quiet" onClick={() => setAnswering(true)}>
                    Accepted already, by phone?
                  </button>
                ) : (
                  <button type="button" onClick={() => (beforeItGoes.length ? setFree('accept') : accept())}>
                    Record it as accepted
                  </button>
                ))}
            </div>
            {saved && q.lines.length > 0 && (
              <p className="hint">
                {canEmail
                  ? `Sent to the client, it goes by email from the operations mailbox with the quote as a PDF, becomes quote ${nextNumber}, and stays as it is.`
                  : `${sendWord}, at the top, marks it sent on that day: it becomes quote ${nextNumber}, stays as it is, and opens to print or save as a PDF for you to send. The app sends nothing.`}
              </p>
            )}
          </>
        )}
      </section>
    </form>
  )
}

/** Where a job is on the map: its venue's pin, or else the first of its phases' venues that has one. */
const pinOf = (job: JobView): Pin | null => job.venue?.pin ?? job.phases.find((p) => p.venue?.pin)?.venue?.pin ?? null

/** New ids that stay the same from one draw to the next, so a line worked out afresh isn't a change each time. */
function useStableIds() {
  const made = useRef<string[]>([])
  let n = 0
  return () => (made.current[n++] ??= newId())
}
