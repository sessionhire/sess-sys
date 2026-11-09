import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import PDFDocument from 'pdfkit'
import {
  depositCents,
  paymentTermsLine,
  letterDay,
  lineCents,
  lineSaving,
  linesByGroup,
  linesUnder,
  setCents,
  money,
  pctWord,
  quoteContact,
  quoteNumberLabel,
  RATE_UNIT,
  spanLabel,
  validUntil,
  VAT_LABELS,
  venueLabel,
  type Client,
  type LineKind,
  type Quote,
  type QuoteLine,
  type QuoteSettings,
  type QuoteTotals,
  type Setting,
  type Venue,
} from '@sh/shared'

/**
 * The quote as a PDF, made on the server (ADR 0101) to go with the email,
 * and the PDF the office opens to print or save (ADR 0139). It says what the
 * A4 page the device prints says (web/src/jobs/QuoteSheet.tsx), in the same
 * order and the same look: the two are kept together, so a client sent the
 * PDF and one handed the printed page read the same quote. Drawn with pdfkit
 * rather than a browser: the server has none, and a browser's print puts its
 * own address, title and date round the page.
 *
 * Laid out as a company's document (ADR 0139): the brand's red band along
 * the top, the logo and "Quote" with its number, who it's for, the job and
 * the dates in three columns, the lines under a shaded head that comes again
 * on every page, the total in the brand's red, and the company's address,
 * phone, email and VAT number along the foot of every page as letterhead.
 * In the design system's type: IBM Plex Sans to read, Archivo for the title
 * and the total.
 */

/** Everything the sheet shows, gathered by the caller. */
export interface Sheet {
  q: Quote
  totals: QuoteTotals
  job: { name: string; span: { start: string; end: string } | undefined; venue: Pick<Venue, 'name' | 'address'> | undefined; client: Client | undefined }
  /** Admin's office details: the address, phone, email and VAT number printed along the foot. */
  office: Setting | undefined
  quoting: Pick<QuoteSettings, 'terms' | 'bank'>
  /** Today in Ireland, for a draft's date and how long it holds. */
  today: string
  /** The company's logo (ADR 0128): drawn in place of its name when it's a PNG or a JPEG, which is what a PDF can carry. */
  logo?: { data: Buffer; type: string }
}

const KIND_WORDS: Record<LineKind, string> = { kit: 'Kit', crew: 'Crew', other: 'Other' }

/** Session Hire's red: the band, the group heads and the total, as on the printed page. */
const BRAND = '#ee3744'
const INK = '#16181d'
const MUTED = '#5c636e'
const FAINT = '#868d97'
const RULE = '#e2e4e8'
const PANEL = '#f4f5f7'

/** 15 mm at the sides; the foot keeps the bottom 22 mm for the letterhead. */
const SIDE = 42.5
const TOP = 40
const FOOT = 62

/** Sizes in points: the body, a row's second line, a label in capitals. */
const BODY = 9
const SMALL = 7.6
const LABEL = 6.8

/**
 * The design system's faces, from the same @fontsource files the app bundles, so the PDF reads as the app's printed page.
 * Kept once read. Helvetica stands in if they can't be read, so a quote always goes.
 */
interface Faces { regular: string; medium: string; bold: string; display: string }
let faces: { regular: Buffer; medium: Buffer; bold: Buffer; display: Buffer } | null | undefined
function readFaces() {
  if (faces !== undefined) return faces
  try {
    const require = createRequire(import.meta.url)
    const files = (pkg: string) => join(dirname(require.resolve(`${pkg}/LICENSE`)), 'files')
    const plex = files('@fontsource/ibm-plex-sans')
    const archivo = files('@fontsource/archivo')
    faces = {
      regular: readFileSync(join(plex, 'ibm-plex-sans-latin-400-normal.woff')),
      medium: readFileSync(join(plex, 'ibm-plex-sans-latin-500-normal.woff')),
      bold: readFileSync(join(plex, 'ibm-plex-sans-latin-600-normal.woff')),
      display: readFileSync(join(archivo, 'archivo-latin-800-normal.woff')),
    }
  } catch {
    faces = null
  }
  return faces
}

/**
 * The faces carry Latin letters, the euro sign and the usual punctuation, and nothing else: an emoji or a letter from
 * another alphabet would come out as a blank box, so it's left out rather than drawn.
 */
const ENCODABLE = /[ -~ -ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ\n\t]/u
export const drawable = (s: string) => [...s].filter((c) => ENCODABLE.test(c)).join('')

/** How a line's days read: blank once, "2 wk" by the week, else the count. */
const daysWord = (l: QuoteLine) => (l.per === 'once' ? '' : l.rate === 'weekly' ? `${l.days} wk` : l.days.toLocaleString('en-IE'))

export function quotePdf(d: Sheet): Promise<Buffer> {
  const { q, totals, job, office, quoting, today } = d
  const draft = q.status === 'draft'
  const number = quoteNumberLabel(q)
  const title = draft ? `Draft quote for ${job.name}` : `Quote ${q.number ?? ''} for ${job.name}`.replace('  ', ' ')
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: TOP, bottom: FOOT, left: SIDE, right: SIDE },
    bufferPages: true,
    info: { Title: drawable(title), Author: 'Session Hire', Creator: 'Session Hire' },
  })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const read = readFaces()
  const F: Faces = read
    ? (doc.registerFont('plex', read.regular), doc.registerFont('plex-medium', read.medium), doc.registerFont('plex-bold', read.bold), doc.registerFont('archivo', read.display), { regular: 'plex', medium: 'plex-medium', bold: 'plex-bold', display: 'archivo' })
    : { regular: 'Helvetica', medium: 'Helvetica', bold: 'Helvetica-Bold', display: 'Helvetica-Bold' }

  const pageW = doc.page.width
  const pageH = doc.page.height
  const left = SIDE
  const width = pageW - SIDE * 2
  const right = left + width
  /** The lowest a line of the body may sit before the foot. */
  const floor = pageH - FOOT

  type Style = { size?: number; font?: string; color?: string; align?: 'left' | 'right' | 'center'; spacing?: number; gap?: number }
  const style = ({ size = BODY, font = F.regular, color = INK }: Style) => doc.font(font).fontSize(size).fillColor(color)
  const opts = ({ align = 'left', spacing = 0, gap = 1.2 }: Style, w: number): PDFKit.Mixins.TextOptions => ({ width: w, align, characterSpacing: spacing, lineGap: gap })
  /** Words in a box at x, y, as wide as w: the height they took. */
  const put = (s: string, x: number, y: number, w: number, st: Style = {}) => {
    const words = drawable(s)
    if (!words) return 0
    style(st)
    const o = opts(st, w)
    const h = doc.heightOfString(words, o)
    doc.text(words, x, y, o)
    return h
  }
  const tall = (s: string, w: number, st: Style = {}) => {
    const words = drawable(s)
    if (!words) return 0
    style(st)
    return doc.heightOfString(words, opts(st, w))
  }
  /** A label in small capitals, as a column's or a block's name. */
  const label = (s: string, x: number, y: number, w: number, st: Style = {}) => put(s.toUpperCase(), x, y, w, { size: LABEL, font: F.bold, color: FAINT, spacing: 0.7, ...st })
  const rule = (y: number, color = RULE, weight = 0.6, x0 = left, x1 = right) => {
    doc.save().moveTo(x0, y).lineTo(x1, y).lineWidth(weight).strokeColor(color).stroke().restore()
  }
  /** The brand's band along the top edge of a page. */
  const band = () => doc.save().rect(0, 0, pageW, 7).fill(BRAND).restore()

  // The head: the logo (or the name) at the left, "Quote" and its number at the right.
  band()
  let y = TOP
  const logo = d.logo && (d.logo.type === 'png' || d.logo.type === 'jpeg') ? d.logo.data : undefined
  let headBottom = y
  let drawn = false
  if (logo) {
    try {
      doc.image(logo, left, y, { fit: [190, 54] })
      headBottom = y + 54
      drawn = true
    } catch {
      // A file pdfkit can't read: the name in words, as with none.
    }
  }
  if (!drawn) headBottom = y + put('Session Hire', left, y + 4, width / 2, { size: 22, font: F.display }) + 4
  const kicker = draft ? 'Draft quote' : 'Quote'
  const titleH = put(kicker, left + width / 2, y - 2, width / 2, { size: 26, font: F.display, align: 'right' })
  put(number || (draft ? 'Not sent yet' : ''), left + width / 2, y - 2 + titleH, width / 2, { size: 10, font: F.medium, color: draft ? MUTED : BRAND, align: 'right' })
  y = Math.max(headBottom, y + titleH + 16) + 16
  rule(y, INK, 0.9)
  y += 12

  // Who it's for, the job, and the quote's dates: three columns under the head.
  const gutter = 18
  const colFor = width * 0.33
  const colJob = width * 0.4
  const colWhen = width - colFor - colJob - gutter * 2
  const xJob = left + colFor + gutter
  const xWhen = xJob + colJob + gutter
  const client = job.client
  const contact = client ? quoteContact(client.contacts, q.forName) : undefined
  let yFor = y
  if (client) {
    yFor += label('Prepared for', left, yFor, colFor) + 3
    yFor += put(client.name, left, yFor, colFor, { size: 10.5, font: F.bold })
    if (contact) yFor += put(contact.name, left, yFor, colFor)
    if (client.address?.trim()) yFor += put(client.address.trim(), left, yFor + 2, colFor, { color: MUTED }) + 2
  }
  let yJob = y
  yJob += label('The job', xJob, yJob, colJob) + 3
  yJob += put(job.name, xJob, yJob, colJob, { size: 10.5, font: F.bold })
  if (job.span) yJob += put(spanLabel(job.span), xJob, yJob, colJob)
  if (job.venue) yJob += put(venueLabel(job.venue), xJob, yJob + 2, colJob, { color: MUTED }) + 2
  let yWhen = y
  const fact = (name: string, value: string) => {
    yWhen += label(name, xWhen, yWhen, colWhen, { align: 'right' }) + 2
    yWhen += put(value, xWhen, yWhen, colWhen, { font: F.medium, align: 'right' }) + 7
  }
  fact('Date', letterDay(q.sentOn ?? today))
  fact('Valid until', letterDay(validUntil(q, today)))
  y = Math.max(yFor, yJob, yWhen) + 18

  // The lines, grouped as on the page, under a shaded head that comes again at the top of each new page.
  const cols = [
    { name: 'What', w: 0, align: 'left' as const },
    { name: 'How many', w: 58, align: 'right' as const },
    { name: 'Days', w: 34, align: 'right' as const },
    { name: 'Price', w: 84, align: 'right' as const },
    { name: 'VAT', w: 34, align: 'right' as const },
    { name: 'Amount', w: 76, align: 'right' as const },
  ]
  const pad = 6
  cols[0]!.w = width - cols.slice(1).reduce((s, c) => s + c.w, 0)
  const xs = cols.reduce<number[]>((a, c, i) => [...a, i ? a[i - 1]! + cols[i - 1]!.w : left], [])
  const cellW = (i: number) => cols[i]!.w - pad * 2
  const head = () => {
    doc.save().rect(left, y, width, 20).fill(PANEL).restore()
    cols.forEach((c, i) => label(c.name, xs[i]! + pad, y + 7, cellW(i), { align: c.align, color: MUTED }))
    y += 20
  }
  /** Room for h more on this page, or a new page with the band and the head again. */
  const room = (h: number, withHead = true) => {
    if (y + h <= floor) return
    doc.addPage()
    band()
    y = TOP
    if (withHead) head()
  }
  head()

  type Cell = { s: string; st?: Style }
  /** One row: each cell's words, a column each, and the second line under the first cell. */
  const row = (cells: Cell[], under: Cell[] = [], o: { indent?: number; top?: number; line?: boolean } = {}) => {
    const indent = o.indent ?? 0
    const top = o.top ?? 5
    const firstW = cellW(0) - indent
    const heights = cells.map((c, i) => (i ? tall(c.s, cellW(i), { align: 'right', ...c.st }) : tall(c.s, firstW, c.st)))
    const underH = under.reduce((s, c) => s + tall(c.s, firstW, { size: SMALL, color: MUTED, ...c.st }) + 1, 0)
    const h = top + Math.max(heights[0]! + underH, ...heights.slice(1)) + 5
    room(h)
    if (indent) doc.save().moveTo(left + pad + 2, y + 3).lineTo(left + pad + 2, y + h - 3).lineWidth(1).strokeColor(RULE).stroke().restore()
    cells.forEach((c, i) => {
      if (!c.s) return
      const x = xs[i]! + pad + (i ? 0 : indent)
      put(c.s, x, y + top, i ? cellW(i) : firstW, { align: i ? 'right' : 'left', ...c.st })
    })
    let yu = y + top + heights[0]!
    for (const c of under) yu += put(c.s, xs[0]! + pad + indent, yu + 1, firstW, { size: SMALL, color: MUTED, ...c.st }) + 1
    y += h
    if (o.line !== false) rule(y)
  }

  const groups = linesByGroup(q.lines)
  for (const g of groups) {
    // A group's name in the brand's red, kept with its first line.
    room(16 + 26)
    y += 8
    y += label(g.group || KIND_WORDS[g.lines[0]!.kind], left + pad, y + 4, width - pad * 2, { color: BRAND, size: 7.2 }) + 6
    rule(y, BRAND, 0.8, left + pad, left + pad + 18)
    for (const l of g.lines) {
      // Words only (ADR 0128): a heading or a note as written, across the row, with no numbers.
      if (l.words) {
        row([{ s: l.what, st: { color: MUTED } }])
        continue
      }
      const under = linesUnder(q.lines, l.id)
      // A package with its kit under it (ADR 0116) comes to its own price and its kit's, and its kit is printed under it.
      const byKit = under.length > 0 && !l.unitCents && !!l.packageId
      // Given at no charge on purpose (audit of the quote flow, 8 November 2026, finding 1).
      const free = !!l.included && !under.length
      const price = `${money(l.unitCents)} ${l.per === 'once' ? 'once' : `a ${RATE_UNIT[l.rate ?? 'daily']}`}`
      // Priced below what its items come to (ADR 0116): the client sees what the package saves them.
      const saved = lineSaving(l)
      const second: Cell[] = []
      if (l.includes) second.push({ s: l.includes })
      if (saved) second.push({ s: `${money(saved)} off its items’ ${money(lineCents({ ...l, discountPct: undefined, unitCents: l.fullCents! }))}`, st: { color: BRAND } })
      const amount: Cell = { s: free ? 'Included' : money(under.length ? setCents(l, q.lines) : lineCents(l)), st: free ? { color: MUTED } : { font: F.medium } }
      const amountCell: Cell = l.discountPct ? { s: `${amount.s}\nless ${pctWord(l.discountPct)}`, st: amount.st } : amount
      row(
        [{ s: l.what, st: { font: F.medium } }, { s: String(l.qty) }, { s: byKit ? '' : daysWord(l) }, { s: byKit || free ? '' : price }, { s: VAT_LABELS[l.vat], st: { color: MUTED } }, amountCell],
        second,
        { line: !under.length }
      )
      for (const [i, u] of under.entries()) {
        const priced = u.unitCents > 0 && !u.included
        const small = { size: SMALL, color: MUTED }
        row(
          [
            { s: u.what, st: small },
            { s: String(u.qty), st: small },
            { s: priced ? daysWord(u) : '', st: small },
            { s: priced ? `${money(u.unitCents)} a ${RATE_UNIT[u.rate ?? 'daily']}` : '', st: small },
            { s: '' },
            { s: priced ? money(lineCents(u)) : 'Included', st: small },
          ],
          [],
          { indent: 12, top: i ? 2 : 0, line: i === under.length - 1 }
        )
      }
    }
  }

  // What it comes to, at the right; how the booking is confirmed and paid, beside it at the left.
  const sums: [string, string][] = []
  if (totals.discount > 0) {
    sums.push(['Subtotal', money(totals.subtotal)])
    sums.push([q.agreedCents != null ? `Agreed discount, ${pctWord(totals.discountPct)}` : `Discount, ${pctWord(totals.discountPct)}`, `-${money(totals.discount)}`])
  }
  sums.push(['Before VAT', money(totals.net)])
  for (const r of totals.rates) sums.push([`VAT at ${VAT_LABELS[r.rate]}${totals.rates.length > 1 ? ` on ${money(r.net)}` : ''}`, money(r.vat)])
  const sumsW = 230
  const sumsX = right - sumsW
  const sumsH = sums.length * 16 + 46
  const deposit = q.depositPct ? `A deposit of ${pctWord(q.depositPct)}, ${money(depositCents(totals.gross, q.depositPct))}, confirms the booking.` : ''
  // When this client pays (ADR 0119), under the deposit, as the printed page has it.
  const pays = paymentTermsLine(job.client?.paymentTerms) ?? ''
  const asideW = width - sumsW - 28
  const asideH = deposit || pays ? 36 + tall(deposit, asideW - 24) + tall(pays, asideW - 24) + (deposit && pays ? 4 : 0) : 0
  y += 14
  room(Math.max(sumsH, asideH), false)
  const top = y
  let ys = top
  for (const [name, value] of sums) {
    put(name, sumsX, ys, sumsW - 96, { color: MUTED })
    put(value, sumsX + sumsW - 110, ys, 110, { align: 'right' })
    ys += 16
  }
  ys += 2
  doc.save().rect(sumsX, ys, sumsW, 36).fill(BRAND).restore()
  put('Total', sumsX + 12, ys + 12, 80, { size: 10, font: F.bold, color: '#ffffff' })
  put(money(totals.gross), sumsX + 70, ys + 8, sumsW - 82, { size: 17, font: F.display, color: '#ffffff', align: 'right' })
  ys += 36
  if (asideH) {
    doc.save().roundedRect(left, top, asideW, asideH, 4).fill(PANEL).restore()
    let ya = top + 12
    ya += label(deposit ? 'Deposit' : 'Paying', left + 12, ya, asideW - 24) + 4
    if (deposit) ya += put(deposit, left + 12, ya, asideW - 24, { font: F.medium }) + 4
    if (pays) put(pays, left + 12, ya, asideW - 24, { color: MUTED })
  }
  y = Math.max(ys, top + asideH) + 22

  // The office's words for this quote, then the terms and bank details side by side.
  const block = (heading: string, body: string, x: number, at: number, w: number, st: Style = {}) => {
    let yb = at + label(heading, x, at, w) + 3
    yb += put(body, x, yb, w, st)
    return yb
  }
  if (q.notes.trim()) {
    const h = 12 + tall(q.notes.trim(), width)
    room(h, false)
    y = block('Notes', q.notes.trim(), left, y, width) + 18
  }
  const terms = quoting.terms.trim()
  const bank = quoting.bank.trim()
  const reference = bank && q.number ? `Please give quote ${q.number} as the reference.` : ''
  if (terms || bank) {
    const both = terms && bank
    const termsW = both ? width * 0.6 - 12 : width
    const bankW = both ? width - termsW - 24 : width
    const small: Style = { size: SMALL, color: MUTED, gap: 1.6 }
    const bankBody = [bank, reference].filter(Boolean).join('\n\n')
    const h = 14 + Math.max(terms ? tall(terms, termsW, small) : 0, bank ? tall(bankBody, bankW, small) : 0)
    room(h + 10, false)
    rule(y - 8)
    y += 4
    let yt = y
    if (terms) yt = block('Terms', terms, left, y, termsW, small)
    if (bank) yt = Math.max(yt, block('Paying by bank transfer', bankBody, both ? left + termsW + 24 : left, y, bankW, { ...small, color: INK }))
    y = yt + 14
  }
  const reach = [office?.phone, office?.email].filter(Boolean).join(' · ')
  const closing = `Prices are in euro: each line is how many, at its price, for the days charged or once.${reach ? ` Questions: ${reach}.` : ''}`
  room(tall(closing, width, { size: SMALL }) + 4, false)
  put(closing, left, y, width, { size: SMALL, color: FAINT })

  // The letterhead along the foot of every page: who it's from, and the page and quote when there's more than one page.
  const address = office?.address?.trim().split(/\s*\n\s*/).filter(Boolean).join(', ')
  const vat = office?.vatNumber?.trim()
  const from = ['Session Hire', address].filter(Boolean).join(' · ')
  const reachVat = [reach, vat && `VAT number ${vat}`].filter(Boolean).join(' · ')
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i)
    const bottom = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    const yf = pageH - FOOT + 22
    rule(yf - 8)
    const where = pages.count > 1 ? `${number ? `Quote ${number} · ` : ''}Page ${i + 1} of ${pages.count}` : ''
    const textW = width - (where ? 140 : 0)
    style({ size: SMALL, font: F.medium, color: INK })
    doc.text(drawable(from), left, yf, { width: textW, lineBreak: false, ellipsis: true })
    if (reachVat) {
      style({ size: SMALL, color: MUTED })
      doc.text(drawable(reachVat), left, yf + 11, { width: textW, lineBreak: false, ellipsis: true })
    }
    if (where) {
      style({ size: SMALL, color: MUTED })
      doc.text(drawable(where), right - 140, yf, { width: 140, align: 'right', lineBreak: false })
    }
    doc.page.margins.bottom = bottom
  }
  doc.end()
  return done
}
