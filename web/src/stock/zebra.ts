import { zplGraphic, zplLogoBox, type ZplGraphic, type ZplLayout } from '@sh/shared'
import { useEffect, useState } from 'react'
import { useLabelLogo } from '../Picture.tsx'
import { useView } from '../view.ts'

/**
 * Talking to the Zebra ZT411 (ADR 0178) through Zebra Browser Print, Zebra's
 * own small program on the computer the printer is plugged into or can reach
 * on the network. It answers on this computer only, at two addresses: plain
 * on port 9100 and secure on 9101 (whose certificate the browser is asked to
 * accept once). The first time, it asks on screen whether this app may use
 * the printer. Nothing here reaches the printer any other way, and a phone,
 * which can't run it, downloads the file or sends the labels to a computer
 * that can.
 */

const BASES = ['http://127.0.0.1:9100', 'https://127.0.0.1:9101'] as const

/** A printer as Browser Print describes it; sent back as it is with each job. */
export interface ZebraDevice {
  name: string
  uid: string
  connection: string
  deviceType: string
  version?: number
  provider?: string
  manufacturer?: string
}

export interface Zebra {
  base: string
  device: ZebraDevice
}

async function within<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), ms)
  try {
    return await work(stop.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** The printer Browser Print has as its default on this computer, or undefined when it isn't running or has none. */
export async function findZebra(): Promise<Zebra | undefined> {
  for (const base of BASES) {
    try {
      const device = await within(2500, async (signal) => {
        const res = await fetch(`${base}/default?type=printer`, { signal })
        if (!res.ok) return undefined
        const text = (await res.text()).trim()
        return text ? (JSON.parse(text) as ZebraDevice) : undefined
      })
      if (device?.uid) return { base, device }
    } catch {
      // Not running here, not allowed yet, or not at this address: try the next.
    }
  }
  return undefined
}

/**
 * Labels to the printer. Sent as plain text, as Zebra's own page does, so
 * the browser asks Browser Print nothing first; in parts, so a whole roll
 * never waits on one long request, with how far it's got after each.
 */
export async function sendToZebra(z: Zebra, jobs: readonly string[], onSent?: (done: number) => void): Promise<void> {
  for (let i = 0; i < jobs.length; i++) {
    const res = await within(30_000, (signal) => fetch(`${z.base}/write`, { method: 'POST', body: JSON.stringify({ device: z.device, data: jobs[i] }), signal }))
    if (!res.ok) throw new Error(`The ZT411 didn't take the labels (${res.status}). Check it's on, with labels in, and try again.`)
    onSent?.(i + 1)
  }
}

/** Whether Browser Print and its printer can be reached from here, looked for once a page. */
export function useZebra(): { zebra: Zebra | undefined; looking: boolean; again: () => void } {
  const [state, setState] = useState<{ zebra: Zebra | undefined; looking: boolean }>({ zebra: undefined, looking: true })
  const [round, setRound] = useState(0)
  useEffect(() => {
    let gone = false
    setState((s) => ({ ...s, looking: true }))
    void findZebra().then((zebra) => !gone && setState({ zebra, looking: false }))
    return () => {
      gone = true
    }
  }, [round])
  return { ...state, again: () => setRound((n) => n + 1) }
}

/**
 * The company's logo in pure black and white at its size on a layout, as
 * the printer draws it: a canvas the size in dots, the logo fitted in, each
 * dot black where it's darker than half.
 */
export function useZplLogo(layout: ZplLayout): ZplGraphic | undefined {
  const { office } = useView()
  const url = useLabelLogo(office, { pure: true })
  const [made, setMade] = useState<{ key: string; logo: ZplGraphic }>()
  const key = `${url}|${layout}`
  useEffect(() => {
    if (!url) return
    let gone = false
    const img = new Image()
    img.src = url
    img
      .decode()
      .then(() => {
        const box = zplLogoBox(layout)
        const scale = Math.min(box.height / img.naturalHeight, box.maxWidth / img.naturalWidth)
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const g = canvas.getContext('2d')
        if (!g) return
        g.fillStyle = '#fff'
        g.fillRect(0, 0, w, h)
        g.drawImage(img, 0, 0, w, h)
        const px = g.getImageData(0, 0, w, h).data
        const logo = zplGraphic(w, h, (x, y) => px[(y * w + x) * 4]! < 128)
        if (!gone) setMade({ key, logo })
      })
      .catch(() => undefined)
    return () => {
      gone = true
    }
  }, [url, layout, key])
  return url && made?.key === key ? made.logo : undefined
}
