import { APP_VERSION, dsTiming, plural, releasesSince } from '@sh/shared'
import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import type { Toast } from './notices.ts'

/**
 * A deploy while the app is open. The new version is fetched in the
 * background and then waits: the page that's open keeps the files it was
 * built with until someone taps Reload, so a screen opened later (the
 * camera's QR reader, say) still loads. A tab left open asks whether
 * there's anything new once an hour, and whenever it comes back to the
 * front. Should a file still be missing, the page starts again on the new
 * version rather than sitting broken.
 */

const RELOADED = 'sh.reloadedAt'
/** Set as the page starts again on its own, read once as it comes back, so the bar can say why. */
const RESTARTED = 'sh.restarted'
/** The version this tab was on as it went to load the new one, read once as it comes back, so a toast can say what changed. */
const LOADED_FROM = 'sh.loadedFrom'
const listeners = new Set<(ready: boolean) => void>()
let ready = false
let reload: (() => Promise<void>) | undefined
let restarted = false

export function watchForUpdates() {
  // The page started again on its own a moment ago: say so, once.
  try {
    restarted = sessionStorage.getItem(RESTARTED) !== null
    sessionStorage.removeItem(RESTARTED)
  } catch {
    // Storage blocked: nothing to say it by.
  }
  const update = registerSW({
    onNeedRefresh() {
      ready = true
      for (const fn of listeners) fn(true)
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Browsers look for a new version on a page load, which a tab left open never does: so once an hour, and each time
      // the page comes back to the front (a phone picked up, a laptop tab clicked), not more than once a minute.
      let looked = 0
      const look = () => {
        if (Date.now() - looked < 60_000) return
        looked = Date.now()
        registration.update().catch(() => {})
      }
      setInterval(look, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && look())
      addEventListener('focus', look)
    },
  })
  reload = () => update(true)

  addEventListener('vite:preloadError', (event) => {
    // With no signal the file isn't gone, only out of reach: a reload would lose the page for nothing.
    if (!navigator.onLine) return
    // A file this page was built with has gone, most likely because a new version
    // replaced it before the bar was answered. Not twice in a minute, so a build
    // that really is missing a file doesn't reload for ever.
    let last = 0
    try {
      last = Number(sessionStorage.getItem(RELOADED)) || 0
    } catch {
      // Storage blocked: reload anyway.
    }
    if (Date.now() - last < 60_000) return
    event.preventDefault()
    try {
      sessionStorage.setItem(RELOADED, String(Date.now()))
      sessionStorage.setItem(RESTARTED, '1')
      sessionStorage.setItem(LOADED_FROM, APP_VERSION)
    } catch {
      // Storage blocked: nothing to remember the reload by, but reload anyway.
    }
    location.reload()
  })
}

function useUpdateReady() {
  const [state, setState] = useState(ready)
  useEffect(() => {
    listeners.add(setState)
    setState(ready)
    return () => void listeners.delete(setState)
  }, [])
  return state
}

/**
 * One line at the top until they reload; the page below moves down so it
 * hides nothing. `unkept` is how many changes waiting to sync a reload
 * would lose, because this browser keeps nothing between reloads: said
 * before they press. And when the page started again on its own, the same
 * line says so until it's dismissed.
 */
export function UpdateBar({ unkept = 0 }: { unkept?: number }) {
  const ready = useUpdateReady()
  const [said, setSaid] = useState(restarted)
  if (!ready && said)
    return (
      <div className="update">
        <span role="status">Started again on the new version: the old one's files had gone.</span>
        <button
          type="button"
          onClick={() => {
            restarted = false
            setSaid(false)
          }}
        >
          Dismiss
        </button>
      </div>
    )
  if (!ready) return null
  const onReload = () => {
    try {
      sessionStorage.setItem(LOADED_FROM, APP_VERSION)
    } catch {
      // Storage blocked: the new version loads all the same, without saying what changed.
    }
    void reload?.()
    // The new version takes the page over and reloads it. Should it not (an older browser, say), start again anyway.
    setTimeout(() => location.reload(), 2000)
  }
  return (
    <div className="update">
      {/* A status, so a screen reader is told a reload waits, not only shown it (audit, 20 October 2026, finding 60b). */}
      <span role="status">
        A new version is ready.
        {unkept > 0 &&
          ` ${unkept === 1 ? "1 change hasn't" : `${unkept} changes haven't`} synced yet, and this browser keeps nothing over a reload, so loading it now loses ${unkept === 1 ? 'it' : 'them'}. It can wait until ${unkept === 1 ? "it's" : "they've"} gone.`}
      </span>
      <button type="button" className="primary" onClick={onReload}>
        Load the new version
      </button>
    </div>
  )
}

let told = false

/**
 * Back from loading a new version: the toast at the screen's edge with what
 * came in since the version this tab was on, from the changelog (ADR 0071),
 * the newest by name and how many more, and What's changed for the whole
 * of each. Asked for as the toaster first draws, so its timer starts when it
 * can be seen. It stays `timing.undo` rather than `timing.notice`: a
 * sentence of news someone asked for takes longer than four seconds to
 * read, and it waits while the pointer or the keyboard is on it. Nothing
 * when the version didn't change (a rebuild with no entry).
 */
export function whatChanged(): { toast: Toast; stay: number } | undefined {
  if (told) return undefined
  told = true
  let from: string | null = null
  try {
    from = sessionStorage.getItem(LOADED_FROM)
    sessionStorage.removeItem(LOADED_FROM)
  } catch {
    return undefined
  }
  if (!from) return undefined
  const came = releasesSince(from)
  if (came.length === 0) return undefined
  const more = came.length - 1
  return {
    toast: {
      id: `version-${APP_VERSION}`,
      title: `Updated to ${APP_VERSION}`,
      body: more === 0 ? came[0]!.title : `${came[0]!.title}, and ${plural(more, 'other change')}`,
      href: '#admin/changes',
      action: "What's changed",
    },
    stay: dsTiming.undo,
  }
}
