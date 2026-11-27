import type { Model, PanelFacts } from './stock.ts'

/**
 * LED panels in the stock list (ADR 0207). A product is a panel once it has a panel's size (stock.ts, `panel`), which
 * the screen builder on a quote asks for once. Until then a panel can only be guessed at from its name, so that the
 * builder can offer the likely ones first with "size not given yet" rather than a search of the whole list.
 *
 * The screen's own sums (how many panels, what hangs or stands it) are in led-screen.ts, which only the builder loads.
 */

type Named = Pick<Model, 'name' | 'department' | 'category'> & { aliases?: readonly string[]; panel?: PanelFacts | null }

/** "LED panel", "led 1m x 0.5m led panel", "LED wall tile", "video wall". */
const PANEL_WORDS = /\bled\b[^,;]*\b(panels?|walls?|screens?|tiles?|cabinets?)\b|\b(panels?|tiles?|cabinets?)\b[^,;]*\bled\b|\bvideo ?walls?\b/i
/** The makers whose panels are hired out, for a name that's only the maker and the series: "Absen NT 3.9". */
const PANEL_MAKERS = /\b(absen|gloshine|roe|unilumin|infiled|leyard|desay|aoto|digiled|esdlumen|yes ?tech|lightlink|glux|liantronics|dicolor|vanguard|pixelflex)\b/i
/** A pixel pitch as panels are named by it: "3.9", "P2.6", "4.81". Not a length, a weight or a screen size in inches. */
const PITCH = /(?:^|[^\d.,])p?\s?\d{1,2}[.,]\d{1,2}(?![\d.,])(?!\s*(?:m|mm|cm|kg|k|w|kw|a|v|inch|in)\b)/i
/** What goes with panels and isn't one: the bar they hang from, what drives them, what carries them. */
const NOT_A_PANEL =
  /\b(fly ?bars?|bars?|bumpers?|processors?|controllers?|control|scalers?|switchers?|mixers?|cases?|doll(?:y|ies)|cables?|looms?|leads?|distros?|tvs?|televisions?|monitors?|projectors?|brackets?|stands?|truss|motors?|frames?|spares?|psu|receiving cards?|sending (?:cards?|box(?:es)?))\b/i

/**
 * Whether a product reads like an LED panel that hasn't been given its size yet: video kit named as a panel, or by a
 * panel maker with a pixel pitch. A guess, used only to put likely panels first in the builder's list; anything it
 * misses is still found there under Another product.
 */
export function looksLikePanel(m: Named): boolean {
  if (m.department !== 'video') return false
  const said = [m.name, ...(m.aliases ?? [])].join(', ')
  if (NOT_A_PANEL.test(m.name)) return false
  return PANEL_WORDS.test(said) || PANEL_WORDS.test(m.category) || (PANEL_MAKERS.test(said) && PITCH.test(said))
}

const n = (x: number) => x.toLocaleString('en-IE')

/** A panel's size as it's read back: "500 × 500 mm", and "128 × 128 pixels" where they're given. */
export function panelWords(p: PanelFacts): string {
  const size = `${n(p.widthMm)} × ${n(p.heightMm)} mm`
  return p.pixelsW && p.pixelsH ? `${size}, ${n(p.pixelsW)} × ${n(p.pixelsH)} pixels` : size
}

/** The pixel pitch a panel's size and pixels come to, in mm to one decimal place, as panels are called by it: 3.9. */
export function panelPitch(p: PanelFacts): number | null {
  if (!p.pixelsW) return null
  return Math.round((p.widthMm / p.pixelsW) * 10) / 10
}
