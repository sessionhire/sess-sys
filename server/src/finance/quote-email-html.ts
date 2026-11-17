import { addressOnOneLine, depositCents, legalLine, money, tradingNameOf, validUntil, letterDay, VAT_LABELS } from '@sh/shared'
import type { Sheet } from './quote-pdf.ts'

/**
 * The quote email as the client sees it (ADR 0187): the office's own message, as typed in the compose box, set inside
 * the company's letterhead, with what the quote is for and comes to at a glance, a button to open it and accept it
 * when the office takes answers online (ADR 0121), and the company's details along the foot as the PDF has them
 * (ADR 0181). The PDF goes with it as before; the plain text part is the message exactly as typed, for mail programs
 * that show no HTML.
 *
 * Written the way email has to be: tables for the layout, every style inline, nothing fetched from outside. The logo is
 * carried in the email itself and named by its content id, as Gmail shows no picture written into the page. Mail
 * programs that take a style block (Apple Mail, iOS, Outlook on the web) get a narrow layout on phones and their own
 * dark colours; the rest are drawn so that a mail program that darkens the email by itself still reads, with the logo
 * on its own white tile.
 */

/** Session Hire's red, as on the PDF's band and total. */
const BRAND = '#ee3744'
const INK = '#16181d'
const MUTED = '#5c636e'
const RULE = '#e2e4e8'
const PANEL = '#f4f5f7'
const PAGE = '#eceef1'
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const DISPLAY = "Archivo, 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** The content id the logo goes by, inside the email. */
export const LOGO_CID = 'logo@sessionhire'

/** Pictures every mail program shows: a WebP logo is left out for the company's name in words. */
export const EMAIL_PICTURE_TYPES: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif' }

export interface QuoteEmailHtml {
  sheet: Sheet
  /** The number it goes as. */
  number: number
  /** The office's message, as typed. */
  message: string
  /** The PDF's name as attached. */
  fileName: string
  /** The client's own link to look at it and accept it (ADR 0121), while the office takes answers online. */
  acceptUrl?: string | null
  /** Where the logo's picture is: its content id in the email, or a data address for a preview in the app. Left out for no logo. */
  logoSrc?: string | null
  /** The logo's own width and height in pixels, when they could be read, so Outlook draws it the right shape. */
  logoSize?: { w: number; h: number } | null
}

/** A PNG's, GIF's or JPEG's width and height, read from its first bytes; undefined for anything else. */
export function pictureSize(b: Buffer): { w: number; h: number } | undefined {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  if (b.length > 10 && b.subarray(0, 3).toString('latin1') === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return undefined
      const marker = b[i + 1]!
      const len = b.readUInt16BE(i + 2)
      // A start-of-frame marker (C0 to CF, except the table markers C4, C8 and CC) carries the size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }
      i += 2 + len
    }
  }
  return undefined
}

/** How big the logo is drawn: 44 pixels tall, no wider than 200. */
export function logoBox(size: { w: number; h: number } | null | undefined): { w: number; h: number } {
  if (!size || !size.w || !size.h) return { w: 0, h: 44 }
  const ratio = size.w / size.h
  const h = Math.max(1, Math.round(Math.min(44, 200 / ratio)))
  return { w: Math.round(h * ratio), h }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "Thu 4", "Thu 4 March" or "Thu 4 March 2027", for a day in a letter. */
function dayWords(d: string, upTo: 'day' | 'month' | 'year' = 'year'): string {
  const at = new Date(`${d}T12:00:00Z`)
  const day = `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()}`
  if (upTo === 'day') return day
  const month = `${day} ${MONTHS[at.getUTCMonth()]}`
  return upTo === 'month' ? month : `${month} ${at.getUTCFullYear()}`
}

/** The days as a client reads them: one day, or the first to the last, the month and year said once where they're shared. */
export function datesLine(span: { start: string; end: string } | undefined): string {
  if (!span) return ''
  if (span.start === span.end) return dayWords(span.start)
  const sameYear = span.start.slice(0, 4) === span.end.slice(0, 4)
  const sameMonth = sameYear && span.start.slice(0, 7) === span.end.slice(0, 7)
  return `${dayWords(span.start, sameMonth ? 'day' : sameYear ? 'month' : 'year')} to ${dayWords(span.end)}`
}

/** A web address or an email address in the message, made a link; everything else as written. */
function linked(text: string): string {
  const out: string[] = []
  const re = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'’])|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g
  let at = 0
  for (const m of text.matchAll(re)) {
    out.push(esc(text.slice(at, m.index)))
    const [whole, url, mail] = m
    const href = url ?? `mailto:${mail}`
    out.push(`<a href="${esc(href)}" style="color:${BRAND};text-decoration:underline;">${esc(whole)}</a>`)
    at = m.index! + whole.length
  }
  out.push(esc(text.slice(at)))
  return out.join('')
}

/**
 * The message as paragraphs: a blank line between them, a single line break kept. A paragraph that only gives the
 * client's link is left out where the button stands for it, so it isn't said twice.
 */
export function messageParagraphs(message: string, acceptUrl?: string | null): string[] {
  return message
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !(acceptUrl && p.includes(acceptUrl)))
    .map((p) => p.split('\n').map(linked).join('<br>'))
}

/** One row of the summary: a small label above what it is. */
const fact = (label: string, value: string) =>
  `<tr><td class="sh-rule" style="padding:12px 0;border-bottom:1px solid ${RULE};">` +
  `<div class="sh-muted" style="font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">${esc(label)}</div>` +
  `<div class="sh-ink" style="font-family:${FONT};font-size:16px;line-height:24px;color:${INK};padding-top:2px;">${value}</div>` +
  `</td></tr>`

/** The quote email's HTML part. */
export function quoteEmailHtml(e: QuoteEmailHtml): string {
  const { sheet, number, fileName } = e
  const { q, totals, job, office } = sheet
  const trade = tradingNameOf(office)
  const legal = legalLine(office)
  const acceptUrl = e.acceptUrl || null
  const title = `Quote ${number} from ${trade}`
  const dates = datesLine(job.span)
  const venue = job.venue ? [job.venue.name, addressOnOneLine(job.venue.address)].filter(Boolean).join(', ') : ''
  const holds = letterDay(validUntil({ sentOn: q.sentOn, validDays: q.validDays }, sheet.today))
  const deposit = q.depositPct ? depositCents(totals.gross, q.depositPct) : 0
  const vatWords = totals.rates.length === 1 ? `VAT at ${VAT_LABELS[totals.rates[0]!.rate]}` : 'VAT'
  const preheader = `${job.name}${dates ? `, ${dates}` : ''}: ${money(totals.gross)} including VAT.`

  const box = logoBox(e.logoSize)
  const logo = e.logoSrc
    ? `<img src="${esc(e.logoSrc)}" alt="${esc(trade)}" height="${box.h}"${box.w ? ` width="${box.w}"` : ''} style="display:block;height:${box.h}px;width:${box.w ? `${box.w}px` : 'auto'};max-width:200px;border:0;outline:none;text-decoration:none;">`
    : `<span class="sh-ink" style="font-family:${DISPLAY};font-size:22px;line-height:28px;font-weight:800;color:${INK};">${esc(trade)}</span>`

  const facts = [fact('The job', esc(job.name)), dates ? fact(job.span && job.span.start !== job.span.end ? 'Dates' : 'Date', esc(dates)) : '', venue ? fact('Venue', esc(venue)) : '']
    .filter(Boolean)
    .join('')

  const button = acceptUrl
    ? `<tr><td class="sh-px" align="center" style="padding:28px 32px 4px 32px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>
<td align="center" bgcolor="${BRAND}" style="border-radius:8px;background-color:${BRAND};">
<a href="${esc(acceptUrl)}" target="_blank" style="display:inline-block;padding:15px 32px;font-family:${FONT};font-size:17px;line-height:22px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View and accept the quote</a>
</td></tr></table>
</td></tr>
<tr><td class="sh-px sh-muted" align="center" style="padding:10px 32px 0 32px;font-family:${FONT};font-size:13px;line-height:19px;color:${MUTED};">See every line, and accept it online with your name.<br>Or copy this link: <a href="${esc(acceptUrl)}" style="color:${MUTED};text-decoration:underline;word-break:break-all;">${esc(acceptUrl.replace(/^https?:\/\//, ''))}</a></td></tr>`
    : ''

  const reach = [
    office?.phone ? `<a href="tel:${esc(office.phone.replace(/\(0\)/g, '').replace(/[^\d+]/g, ''))}" style="color:${MUTED};text-decoration:none;">${esc(office.phone)}</a>` : '',
    office?.email ? `<a href="mailto:${esc(office.email)}" style="color:${MUTED};text-decoration:none;">${esc(office.email)}</a>` : '',
    office?.vatNumber?.trim() ? `VAT number ${esc(office.vatNumber.trim())}` : '',
  ].filter(Boolean)
  const address = addressOnOneLine(office?.address)

  const paragraphs = messageParagraphs(e.message, acceptUrl)
    .map((p) => `<p class="sh-ink" style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:25px;color:${INK};">${p}</p>`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><style>table,td,p,a,span,div{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin:0 !important; padding:0 !important; width:100% !important; }
a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
@media screen and (max-width:620px) {
  .sh-wrap { width:100% !important; }
  .sh-px { padding-left:20px !important; padding-right:20px !important; }
  .sh-outer { padding:0 !important; }
  .sh-card { border-radius:0 !important; }
  .sh-total { font-size:30px !important; line-height:36px !important; }
}
@media (prefers-color-scheme: dark) {
  .sh-page, .sh-outer { background-color:#0e1013 !important; }
  .sh-card { background-color:#1a1d22 !important; }
  .sh-panel { background-color:#23272e !important; }
  .sh-ink { color:#eef0f3 !important; }
  .sh-muted, .sh-muted a { color:#a4abb5 !important; }
  .sh-rule { border-color:#343a43 !important; }
  .sh-red { color:#ff6b75 !important; }
}
[data-ogsc] .sh-ink { color:#eef0f3 !important; }
[data-ogsc] .sh-muted { color:#a4abb5 !important; }
[data-ogsc] .sh-red { color:#ff6b75 !important; }
[data-ogsb] .sh-page, [data-ogsb] .sh-outer { background-color:#0e1013 !important; }
[data-ogsb] .sh-card { background-color:#1a1d22 !important; }
[data-ogsb] .sh-panel { background-color:#23272e !important; }
</style>
</head>
<body class="sh-page" style="margin:0;padding:0;background-color:${PAGE};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};opacity:0;">${esc(preheader)}${'&#8199;&#65279;&#847; '.repeat(40)}</div>
<table role="presentation" class="sh-page" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${PAGE}" style="background-color:${PAGE};">
<tr><td class="sh-outer" align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
<table role="presentation" class="sh-wrap" width="600" border="0" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
<tr><td class="sh-card" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
<tr><td height="6" bgcolor="${BRAND}" style="height:6px;line-height:6px;font-size:6px;background-color:${BRAND};">&nbsp;</td></tr>
<tr><td class="sh-px" style="padding:24px 32px 20px 32px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
<td valign="middle" align="left"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:6px;padding:${e.logoSrc ? '6px' : '0'};">${logo}</td></tr></table></td>
<td valign="middle" align="right" style="text-align:right;">
<div class="sh-muted" style="font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">Quote</div>
<div class="sh-ink" style="font-family:${DISPLAY};font-size:24px;line-height:30px;font-weight:800;color:${INK};">${number}</div>
</td></tr></table>
</td></tr>
<tr><td class="sh-px" style="padding:8px 32px 4px 32px;">
${paragraphs}
</td></tr>
<tr><td class="sh-px" style="padding:4px 32px 0 32px;">
<table role="presentation" class="sh-panel" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${PANEL}" style="background-color:${PANEL};border-radius:10px;">
<tr><td style="padding:8px 20px 20px 20px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
${facts}
<tr><td style="padding:16px 0 0 0;">
<div class="sh-muted" style="font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">Total including VAT</div>
<div class="sh-red sh-total" style="font-family:${DISPLAY};font-size:34px;line-height:42px;font-weight:800;color:${BRAND};padding-top:2px;">${esc(money(totals.gross))}</div>
<div class="sh-muted" style="font-family:${FONT};font-size:14px;line-height:21px;color:${MUTED};">${esc(money(totals.net))} plus ${esc(money(totals.vat))} ${esc(vatWords)}${deposit ? `<br>A deposit of <span class="sh-ink" style="color:${INK};font-weight:600;">${esc(money(deposit))}</span> confirms the booking` : ''}<br>Prices held until ${esc(holds)}</div>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
${button}
<tr><td class="sh-px sh-muted" style="padding:24px 32px 28px 32px;font-family:${FONT};font-size:14px;line-height:21px;color:${MUTED};">The full quote, with every line and our terms, is attached as a PDF: <span class="sh-ink" style="color:${INK};">${esc(fileName)}</span>.</td></tr>
</table>
</td></tr>
<tr><td class="sh-px sh-muted" align="left" style="padding:20px 32px 8px 32px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
<div class="sh-ink" style="font-weight:600;color:${INK};">${esc([trade, address].filter(Boolean).join(' · '))}</div>
${reach.length ? `<div>${reach.join(' · ')}</div>` : ''}
${legal ? `<div style="padding-top:8px;">${esc(legal)}</div>` : ''}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`
}
