import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Scanning in the iPhone or Android app (ADR 0112): the phone's own barcode
 * reader (Apple's and Google's, through ML Kit) in place of the one in the
 * page, which reads faster, in poorer light and from further away. It
 * behaves as the page's camera does (ADR 0016): it stays on, reads each new
 * code once, only counts a code wholly inside the frame, and turns itself
 * off while the app is out of sight.
 *
 * The phone draws its camera behind the page, so while it's on the page
 * makes room for it: a band across the top of the screen shows the camera
 * and the frame, and the page carries on below it, so a form a read opens
 * (claiming a label, a count) is still there to fill in.
 */

/** A code that hasn't been seen for this long has left the picture, and is read again when it's back. */
const GONE_AFTER = 1_200
const SOUND_KEY = 'sh.scan.sound'

type Plugin = typeof import('@capacitor-mlkit/barcode-scanning')

const soundOn = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Every corner inside the frame on screen. The phone gives corners in the screen's pixels; the page works in its own. */
function inside(corners: [number, number][] | undefined, frame: DOMRect | undefined) {
  if (!frame) return false
  // A code the reader can't place is taken: the reader only looks at what the camera sees, and the band is most of that.
  if (!corners?.length) return true
  const scale = devicePixelRatio || 1
  return corners.every(([x, y]) => x / scale >= frame.left && x / scale <= frame.right && y / scale >= frame.top && y / scale <= frame.bottom)
}

export function NativeScanner({ onRead, onStop, beep }: { onRead: (code: string) => void; onStop: () => void; beep: () => void }) {
  const latest = useRef(onRead)
  latest.current = onRead
  const frame = useRef<HTMLDivElement>(null)
  const [problem, setProblem] = useState<'blocked' | 'failed' | ''>('')
  const [read, setRead] = useState<{ code: string; at: number }>()
  const [torch, setTorch] = useState<boolean>()
  const [sound, setSound] = useState(soundOn)
  const soundRef = useRef(sound)
  soundRef.current = sound
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  const [attempt, setAttempt] = useState(0)
  const plugin = useRef<Plugin>(undefined)

  useEffect(() => {
    const seen = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', seen)
    return () => document.removeEventListener('visibilitychange', seen)
  }, [])

  useEffect(() => {
    if (!visible) return
    let alive = true
    const lastSeen = new Map<string, number>()
    const root = document.getElementById('root')
    const scrolled = scrollY
    setProblem('')
    void (async () => {
      try {
        const p = (plugin.current ??= await import('@capacitor-mlkit/barcode-scanning'))
        const { BarcodeScanner, BarcodeFormat } = p
        let { camera } = await BarcodeScanner.checkPermissions()
        if (camera !== 'granted' && camera !== 'limited') camera = (await BarcodeScanner.requestPermissions()).camera
        if (camera !== 'granted' && camera !== 'limited') return alive && setProblem('blocked')
        if (!alive) return
        await BarcodeScanner.addListener('barcodesScanned', ({ barcodes }) => {
          const now = performance.now()
          const box = frame.current?.getBoundingClientRect()
          for (const b of barcodes) {
            const code = b.rawValue?.trim()
            if (!code || !inside(b.cornerPoints, box)) continue
            const before = lastSeen.get(code)
            lastSeen.set(code, now)
            if (before !== undefined && now - before < GONE_AFTER) continue
            setRead({ code, at: now })
            navigator.vibrate?.(60)
            if (soundRef.current) beep()
            latest.current(code)
          }
        })
        // The page makes room: the camera in a band at the top, the page below it (native.css).
        document.body.classList.add('native-scan')
        if (root) root.scrollTop = scrolled
        if (!alive) return
        await BarcodeScanner.startScan({ formats: [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.DataMatrix, BarcodeFormat.Ean13] })
        if (alive) setTorch((await BarcodeScanner.isTorchAvailable()).available ? false : undefined)
      } catch {
        if (alive) setProblem('failed')
      }
    })()
    return () => {
      alive = false
      setTorch(undefined)
      const back = root?.scrollTop ?? scrolled
      document.body.classList.remove('native-scan')
      scrollTo(0, back)
      const s = plugin.current?.BarcodeScanner
      if (s) void s.removeAllListeners().then(() => s.stopScan()).catch(() => undefined)
    }
  }, [visible, attempt, beep])

  const switchTorch = () => {
    const s = plugin.current?.BarcodeScanner
    if (!s || torch === undefined) return
    void s.toggleTorch().then(() => setTorch(!torch), () => setTorch(undefined))
  }
  const switchSound = () => {
    const on = !sound
    setSound(on)
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
    } catch {
      // Only for this visit, then.
    }
  }

  const status = read ? `Read ${read.code}` : 'Point the camera at a label.'
  const controls = (
    <div className="scan-controls">
      {torch !== undefined && (
        <button type="button" aria-pressed={torch} onClick={switchTorch}>
          Light
        </button>
      )}
      <button type="button" aria-pressed={sound} onClick={switchSound}>
        Sound
      </button>
      <button type="button" onClick={onStop}>
        Stop camera
      </button>
    </div>
  )

  if (problem)
    return (
      <div className="scanner" aria-label="Camera">
        <div className="alert" role="alert">
          <p>
            {problem === 'blocked'
              ? "The camera is blocked for Session Hire. Allow the camera for it in the phone's Settings, then turn it on again."
              : "The camera didn't start. Turn it on again, or type the number in the field above."}
          </p>
          <div className="actions">
            {problem === 'blocked' && (
              <button type="button" onClick={() => void plugin.current?.BarcodeScanner.openSettings()}>
                Open Settings
              </button>
            )}
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )

  return (
    <div className="scanner native">
      <p className="scan-status" role="status">
        {status}
      </p>
      {createPortal(
        <div className="cam-band" role="group" aria-label="Camera">
          {/* Flashes on each read. */}
          <div className="frame" ref={frame} key={read?.at} data-read={read ? '' : undefined} />
          <div className="cam-strip">
            <p className="scan-status">{status}</p>
            {controls}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
