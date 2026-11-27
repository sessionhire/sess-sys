import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../Icon.tsx'
import { inApp } from '../native.ts'

/**
 * A laptop's or desktop's own camera, for taking a photo in the page.
 *
 * On a phone a file field opens the camera by itself (`capture`), so a phone
 * never needs this. On a laptop the same field only opens the files, so
 * Add products offers the webcam beside it: a live picture and Take photo.
 */

/** A fine pointer (a mouse or trackpad) is what tells a laptop or desktop from a phone or tablet. */
const laptopHere = () =>
  !inApp() && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches

/**
 * Whether to offer the webcam: on a laptop or desktop that has a camera.
 * Browsers list a camera before they're allowed to use it (without its
 * name), so one with none plugged in isn't offered it.
 */
export function useWebcam(): boolean {
  const [has, setHas] = useState(false)
  useEffect(() => {
    if (!laptopHere()) return
    let alive = true
    const look = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((ds) => alive && setHas(ds.some((d) => d.kind === 'videoinput')))
        .catch(() => alive && setHas(false))
    void look()
    // A camera plugged in, or taken out, while the page is open.
    navigator.mediaDevices.addEventListener?.('devicechange', look)
    return () => {
      alive = false
      navigator.mediaDevices.removeEventListener?.('devicechange', look)
    }
  }, [])
  return has
}

/** What went wrong turning the webcam on, in words that say what to do. */
function webcamProblem(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return "The camera is blocked for this site. Allow it from the camera icon in the address bar, then press Try again. Upload photos works meanwhile."
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found. Plug one in and press Try again, or upload photos instead.'
  if (name === 'NotReadableError' || name === 'AbortError')
    return 'Another app is using the camera (a video call, perhaps). Close it, then press Try again.'
  return "The camera didn't start. Press Try again, or upload photos instead."
}

/**
 * The webcam's live picture, with Take photo under it. Each photo taken
 * goes to `onTake` as a JPEG file, as a file field would give it. The
 * camera stays on for the next one until Close camera, and is off while
 * the page is out of sight. `children` go beside Take photo.
 */
export function Webcam({
  onTake,
  onClose,
  canTake = true,
  status,
  children,
}: {
  onTake: (photo: File) => void
  onClose: () => void
  canTake?: boolean
  /** Said under the picture once it's on: what to photograph, or what was taken. */
  status?: string
  children?: ReactNode
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [problem, setProblem] = useState('')
  const [starting, setStarting] = useState(true)
  const [taken, setTaken] = useState(0)
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const seen = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', seen)
    return () => document.removeEventListener('visibilitychange', seen)
  }, [])

  useEffect(() => {
    if (!visible) return
    let alive = true
    let stream: MediaStream | undefined
    setProblem('')
    setStarting(true)
    void (async () => {
      try {
        // As sharp as the camera goes, up to full HD, so a maker's label can be read.
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1920 }, height: { ideal: 1080 } } })
        stream = s
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        const v = video.current!
        v.srcObject = s
        await v.play().catch(() => undefined)
        if (alive) setStarting(false)
      } catch (err) {
        if (alive) {
          setStarting(false)
          setProblem(webcamProblem(err))
        }
      }
    })()
    return () => {
      alive = false
      stream?.getTracks().forEach((t) => t.stop())
      if (video.current) video.current.srcObject = null
    }
  }, [visible, attempt])

  const take = () => {
    const v = video.current
    if (!v || v.readyState < 2 || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0)
    c.toBlob(
      (b) => {
        if (!b) return
        setTaken((n) => n + 1)
        onTake(new File([b], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92
    )
  }

  const ready = !starting && !problem
  return (
    <div className="webcam" aria-label="Webcam" role="group">
      {problem ? (
        <div className="alert" role="alert">
          <p>{problem}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="webcam-picture">
          {/* Not mirrored, as a selfie view would be: a label reads the right way round. */}
          <video ref={video} muted playsInline autoPlay aria-hidden="true" />
          {/* Flashes on each photo taken. */}
          <div className="webcam-flash" key={taken} data-taken={taken ? '' : undefined} />
          {starting && <p className="starting">Turning the camera on…</p>}
        </div>
      )}
      {ready && status && (
        <p className="hint webcam-status" role="status">
          {status}
        </p>
      )}
      <div className="webcam-controls">
        <button type="button" className="primary" onClick={take} disabled={!ready || !canTake}>
          <Icon name="camera" />
          Take photo
        </button>
        {children}
        <button type="button" onClick={onClose}>
          Close camera
        </button>
      </div>
    </div>
  )
}
