import type { ModelView, PanelFacts } from '@sh/shared'
import { wholeIn } from '../required.ts'

/**
 * An LED panel's facts as they're typed and as they're read (ADR 0207), for the two places that ask for them: the screen
 * builder on a quote the first time a panel is used (ScreenBuilder.tsx), and the panel's own product page (PanelFact.tsx).
 * One reading, so both refuse the same things in the same words.
 */

/** A panel's facts as they're typed, before they're numbers. */
export interface PanelTyped {
  widthMm: string
  heightMm: string
  pixelsW: string
  pixelsH: string
  weightKg: string
  powerW: string
}
export type PanelField = keyof PanelTyped
export const typedFrom = (m: ModelView): PanelTyped => ({
  widthMm: m.panel ? String(m.panel.widthMm) : '',
  heightMm: m.panel ? String(m.panel.heightMm) : '',
  pixelsW: m.panel?.pixelsW ? String(m.panel.pixelsW) : '',
  pixelsH: m.panel?.pixelsH ? String(m.panel.pixelsH) : '',
  weightKg: m.weightKg ? String(m.weightKg) : '',
  powerW: m.powerW ? String(m.powerW) : '',
})

export interface PanelRead {
  facts?: PanelFacts
  weightKg: number | null
  powerW: number | null
  fault?: { field: PanelField; why: string }
}

/** What's typed of a panel, read: its size, and its pixels, weight and power where they're given. A blank is not a zero. */
export function readPanel(t: PanelTyped): PanelRead {
  const fault = (field: PanelField, why: string): PanelRead => ({ weightKg: null, powerW: null, fault: { field, why } })
  const widthMm = wholeIn(t.widthMm, 50, 3000)
  if (widthMm === undefined) return fault('widthMm', t.widthMm.trim() ? "A panel's width is a whole number of mm from 50 to 3,000." : "Give the panel's width in mm, such as 500.")
  const heightMm = wholeIn(t.heightMm, 50, 3000)
  if (heightMm === undefined) return fault('heightMm', t.heightMm.trim() ? "A panel's height is a whole number of mm from 50 to 3,000." : "Give the panel's height in mm, such as 500.")
  let pixelsW: number | null = null
  let pixelsH: number | null = null
  if (t.pixelsW.trim() || t.pixelsH.trim()) {
    if (!t.pixelsW.trim() || !t.pixelsH.trim()) return fault(t.pixelsW.trim() ? 'pixelsH' : 'pixelsW', 'Give the pixels both across and down, or neither.')
    const across = wholeIn(t.pixelsW, 1, 4000)
    if (across === undefined) return fault('pixelsW', 'The pixels across is a whole number from 1 to 4,000.')
    const down = wholeIn(t.pixelsH, 1, 4000)
    if (down === undefined) return fault('pixelsH', 'The pixels down is a whole number from 1 to 4,000.')
    pixelsW = across
    pixelsH = down
  }
  let weightKg: number | null = null
  if (t.weightKg.trim()) {
    const kg = Number(t.weightKg.trim().replace(',', '.'))
    if (!(kg >= 0.1 && kg <= 5000)) return fault('weightKg', "A panel's weight is a number of kilos, such as 8.5.")
    weightKg = Math.round(kg * 10) / 10
  }
  let powerW: number | null = null
  if (t.powerW.trim()) {
    const watts = wholeIn(t.powerW, 1, 100_000)
    if (watts === undefined) return fault('powerW', "A panel's power is a whole number of watts, such as 150.")
    powerW = watts
  }
  return { facts: { widthMm, heightMm, pixelsW, pixelsH }, weightKg, powerW }
}
