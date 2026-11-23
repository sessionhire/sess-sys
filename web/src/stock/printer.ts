import type { PrinterState } from '@sh/shared'
import { useCallback, useEffect, useState } from 'react'
import { ask, post } from '../server.ts'

/**
 * The label printer over the internet (ADR 0191), as the server sees it:
 * whether it's on and paired, connected, and how it said it was. Asked when
 * the page opens and every 10 seconds while it's in view, so a head opened
 * at the printer shows beside Print within moments, without anyone pressing
 * anything. Nothing is kept: with no signal it simply isn't shown.
 */

const EVERY_MS = 10_000

export function usePrinter(): { printer: PrinterState | undefined; set: (s: PrinterState) => void; again: () => void } {
  const [printer, setPrinter] = useState<PrinterState>()
  const [round, setRound] = useState(0)
  useEffect(() => {
    let gone = false
    const look = () => {
      if (document.visibilityState !== 'visible') return
      ask<PrinterState>('/api/printer', undefined, 8_000).then(
        (s) => !gone && setPrinter(s),
        () => undefined
      )
    }
    look()
    const timer = setInterval(look, EVERY_MS)
    document.addEventListener('visibilitychange', look)
    return () => {
      gone = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', look)
    }
  }, [round])
  const again = useCallback(() => setRound((n) => n + 1), [])
  return { printer, set: setPrinter, again }
}

/** Labels to the printer through the server, a few jobs a request so no one request is too big; how far it's got after each. */
export async function printOnline(jobs: readonly string[], onSent?: (done: number) => void): Promise<PrinterState> {
  let state: PrinterState | undefined
  const PER_REQUEST = 5
  for (let i = 0; i < jobs.length; i += PER_REQUEST) {
    state = await post<PrinterState>('/api/printer/print', { jobs: jobs.slice(i, i + PER_REQUEST) })
    onSent?.(Math.min(i + PER_REQUEST, jobs.length))
  }
  return state!
}
