import { labelPayload } from './labels.ts'

/**
 * Labels for the Zebra ZT411 (ADR 0178), written in ZPL, the printer's own
 * language, so it prints them as they are: no print dialog, no page size to
 * get right, no fitting to the page, and a whole roll in one go. Its print
 * head is 300 dots an inch, about 11.8 dots a millimetre. The layouts are
 * the ones the browser prints (ADR 0015, ADR 0106): the QR code, drawn by
 * the printer itself and holding just the number at the most error
 * correction, the number in large type, the company's logo (or its name in
 * words), and on an item's own label its product and stock code.
 */

/** Dots a millimetre on a 300 dpi print head. */
export const ZPL_DOTS_PER_MM = 300 / 25.4

/** The label sizes a ZT411 prints, as the browser's label printer layouts. */
export const ZPL_LAYOUTS = {
  wide: { name: '50 × 25 mm', width: 50, height: 25 },
  long: { name: '100 × 25 mm, bigger type', width: 100, height: 25 },
  square: { name: '25 × 25 mm', width: 25, height: 25 },
} as const
export type ZplLayout = keyof typeof ZPL_LAYOUTS

/** A picture in the printer's own form, black dots and white: `^GFA` with its rows as hex. */
export interface ZplGraphic {
  /** Width in dots, a whole number of bytes' worth (a multiple of 8). */
  width: number
  height: number
  /** The rows top to bottom, each width / 8 bytes, as upper-case hex. */
  hex: string
}

export interface ZplLabel {
  number: string
  /** The product's name, on an item's own label. */
  caption?: string
  /** The product's stock code. */
  code?: string
}

const dots = (mm: number) => Math.round(mm * ZPL_DOTS_PER_MM)

/**
 * Text as a field holds it: `^FH` reads `_` and two hex digits as that byte,
 * so the three characters ZPL itself uses (^ ~ _) are written that way, and
 * control characters (a scanner's separators) are dropped. Cut to `max`.
 */
export function zplText(text: string, max = 120): string {
  const clean = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
  const cut = clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
  return cut.replace(/[_^~]/g, (c) => `_${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
}

/** A text field: at x, y, in the printer's scalable font `h` dots high, in a block `w` wide, one line, cut at its end. */
const field = (x: number, y: number, h: number, w: number, text: string, align: 'L' | 'C' = 'L') =>
  `^FO${x},${y}^A0N,${h},${Math.round(h * 0.9)}^FB${w},1,0,${align}^FH^FD${zplText(text)}^FS`

/**
 * The QR code for a number, drawn by the printer: model 2, the most error
 * correction (H, up to 30% can be scuffed off), the number as the data, each
 * module `mag` dots. "SH-000123" fits the smallest code there is, 21 modules
 * a side. `^BQ` sets its top a little below the field's origin, so it's
 * placed that much higher.
 */
const qr = (x: number, y: number, mag: number, number: string) => `^FO${x},${Math.max(0, y - 10)}^BQN,2,${mag}^FDHA,${zplText(labelPayload(number))}^FS`

/** The modules a side of a number's QR code: 21 for "SH-000123" at the most error correction. */
const QR_MODULES = 21

/** The biggest module size, in dots, that fits a QR code into `mm`. */
const magFor = (mm: number) => Math.max(1, Math.min(10, Math.floor(dots(mm) / QR_MODULES)))

const graphic = (x: number, y: number, g: ZplGraphic) => {
  const bytes = g.hex.length / 2
  return `^FO${x},${y}^GFA,${bytes},${bytes},${g.width / 8},${g.hex}^FS`
}

/**
 * One label in ZPL, `^XA` to `^XZ`, for a layout: the same parts, placed as
 * the browser's layouts place them.
 */
export function zplLabel(label: ZplLabel, layout: ZplLayout, logo?: ZplGraphic): string {
  const { width, height } = ZPL_LAYOUTS[layout]
  const pw = dots(width)
  const ll = dots(height)
  const pad = dots(1.5)
  const parts = [`^XA^CI28^PW${pw}^LL${ll}^LH0,0`]
  if (layout === 'square') {
    const foot = !!(logo || label.code)
    const mag = magFor(foot ? 15 : 19)
    const side = mag * QR_MODULES
    const top = foot ? dots(1) : Math.round((ll - side - dots(3.4)) / 2)
    parts.push(qr(Math.round((pw - side) / 2), top, mag, label.number))
    const numberY = top + side + dots(0.4)
    parts.push(field(0, numberY, dots(3), pw, label.number, 'C'))
    if (foot) {
      const footY = numberY + dots(3.2)
      if (logo && label.code) {
        // Side by side, the pair centred: the logo, then the stock code.
        const logoW = Math.min(logo.width, dots(11))
        const codeW = dots(10)
        const x = Math.max(0, Math.round((pw - logoW - dots(1) - codeW) / 2))
        parts.push(graphic(x, footY, logo))
        parts.push(field(x + logoW + dots(1), footY + dots(0.3), dots(2), codeW, label.code))
      } else if (logo) parts.push(graphic(Math.max(0, Math.round((pw - logo.width) / 2)), footY, logo))
      else if (label.code) parts.push(field(0, footY, dots(2), pw, label.code, 'C'))
    }
  } else {
    const long = layout === 'long'
    const mag = magFor(21)
    const side = mag * QR_MODULES
    parts.push(qr(pad, Math.round((ll - side) / 2), mag, label.number))
    const x = pad + side + dots(long ? 3 : 1.5)
    const w = pw - x - (long ? dots(3) : pad)
    const big = dots(long ? 7.5 : 3.8)
    const small = dots(long ? 3.2 : 2.4)
    const code = long ? dots(3.6) : small
    const gap = dots(long ? 0.6 : 0.5)
    const logoH = logo ? logo.height : small
    const lines = big + gap + logoH + (label.caption ? gap + small : 0) + (label.code ? gap + code : 0)
    let y = Math.max(pad, Math.round((ll - lines) / 2))
    parts.push(field(x, y, big, w, label.number))
    y += big + gap
    if (logo) parts.push(graphic(x, y, logo))
    else parts.push(field(x, y, small, w, 'Session Hire'))
    y += logoH + gap
    if (label.caption) {
      parts.push(field(x, y, small, w, label.caption))
      y += small + gap
    }
    if (label.code) parts.push(field(x, y, code, w, label.code))
  }
  parts.push('^PQ1^XZ')
  return parts.join('\n')
}

/** Labels one after another, as one file or one job for the printer. */
export function zplLabels(labels: readonly ZplLabel[], layout: ZplLayout, logo?: ZplGraphic): string {
  return labels.map((l) => zplLabel(l, layout, logo)).join('\n') + '\n'
}

/** How big a logo is drawn on each layout, in dots: its height, and the most width it may take. */
export function zplLogoBox(layout: ZplLayout): { height: number; maxWidth: number } {
  if (layout === 'square') return { height: dots(2.6), maxWidth: dots(11) }
  if (layout === 'long') return { height: dots(5), maxWidth: dots(40) }
  return { height: dots(2.4), maxWidth: dots(26) }
}

/**
 * A picture as the printer takes it, from its dots: `dark(x, y)` says
 * whether a dot is black. Each row is padded with white to a whole byte.
 */
export function zplGraphic(width: number, height: number, dark: (x: number, y: number) => boolean): ZplGraphic {
  const bytesPerRow = Math.ceil(width / 8)
  let hex = ''
  for (let y = 0; y < height; y++)
    for (let b = 0; b < bytesPerRow; b++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const x = b * 8 + bit
        if (x < width && dark(x, y)) byte |= 0x80 >> bit
      }
      hex += byte.toString(16).toUpperCase().padStart(2, '0')
    }
  return { width: bytesPerRow * 8, height, hex }
}
