import { useState } from 'react'
import { markSignedOut } from './auth.ts'
import { inApp } from './native.ts'
import { useLate } from './useLate.ts'

/**
 * A file the server makes on asking, such as a quote's PDF, got with a press that shows it's working (Colly, 13 November 2026:
 * "on a phone when you click download the quote there's a delay"). The press is busy at once, so a second one does nothing;
 * past the design system's wait (a second) it spins and says what is working. Once the file is here:
 *
 * - on a phone it opens the phone's own share sheet, which prints, saves to Files, or sends it on, and leaves you where you
 *   were. A plain link to the PDF opened it full screen in the app on the iPhone's home screen, with no way back (same day).
 * - on a laptop it saves, as a download does.
 *
 * Safari lets a page open the share sheet only straight after a press. A slow file can outlast that, so then the file waits
 * here, said in a line, with its own button to share it: one more press, which is a fresh one.
 */
export function GetFile({
  href,
  name,
  label,
  working,
  className,
}: {
  /** Where the server makes it. */
  href: string
  /** What it's saved as when the server doesn't say. */
  name: string
  label: string
  /** What is working, said once it's been a second: "Getting the PDF…". */
  working: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const late = useLate(busy)
  const [ready, setReady] = useState<File>()
  const [error, setError] = useState('')

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file], title: file.name })
      setReady(undefined)
    } catch (err) {
      const why = (err as { name?: string }).name
      // Put away without choosing: nothing to say. Too long after the press: the file waits for a press of its own.
      if (why === 'AbortError') return setReady(undefined)
      if (why === 'NotAllowedError') return setReady(file)
      setReady(undefined)
      save(file)
    }
  }

  const press = async () => {
    if (busy) return // Enter and Space still reach a busy button (the design system's busy rule).
    setBusy(true)
    setError('')
    setReady(undefined)
    try {
      const res = await fetch(href, { cache: 'no-store', signal: AbortSignal.timeout(60_000) })
      if (res.status === 401) return markSignedOut()
      if (!res.ok) return setError(`That didn't work: the server answered ${res.status}. Try again in a minute.`)
      const blob = await res.blob()
      const file = new File([blob], fileNameOf(res) ?? name, { type: blob.type || 'application/pdf' })
      if (onPhone() && canShare(file)) return void (await share(file))
      // Inside the iPhone or Android app a download goes nowhere, so the file opens to look at instead.
      if (inApp()) return void open(href, '_blank')
      save(file)
    } catch {
      setError("Couldn't reach the server. Try again when you have signal.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => void press()} aria-busy={busy || undefined}>
        {late ? working : label}
      </button>
      {ready && (
        <p className="get-file-ready" role="status">
          <span>{ready.name} is ready.</span>
          {/* Plain: the page's one red stays what to do next (ADR 0104); this is the press that was already made, finished. */}
          <button type="button" onClick={() => void share(ready)}>
            Share, print or save
          </button>
          <button type="button" className="quiet" onClick={() => setReady(undefined)}>
            Not now
          </button>
        </p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

/** A phone or tablet: a touch screen, where the share sheet is how a file is kept. A laptop saves it as a download. */
const onPhone = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

const canShare = (file: File) => {
  try {
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [file] })
  } catch {
    return false
  }
}

function fileNameOf(res: Response): string | undefined {
  const header = res.headers.get('content-disposition') ?? ''
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1]
  if (star) {
    try {
      return decodeURIComponent(star)
    } catch {
      // Fall through to the plain name.
    }
  }
  return /filename="([^"]+)"/.exec(header)?.[1]
}

/** Saved as a download, from the file in hand rather than its address, so it isn't made twice. */
function save(file: File) {
  const url = URL.createObjectURL(file)
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
