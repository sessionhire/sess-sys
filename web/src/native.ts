/**
 * The app on a phone, inside the iPhone or Android app (ADR 0112): the same
 * pages, given a few things a browser can't do. Everything here is fetched
 * only inside the app; in a browser none of it loads and nothing changes.
 */

interface Bridge {
  isNativePlatform?: () => boolean
}

/** Inside the iPhone or Android app, rather than a browser. The app's shell puts its bridge on the page. */
export const inApp = (): boolean => !!(globalThis as unknown as { Capacitor?: Bridge }).Capacitor?.isNativePlatform?.()

const VERIFIER_KEY = 'sh.app.signin'

/**
 * Sign in from the app: Google won't sign in inside an app, so the phone's
 * own browser opens, and the server sends it back to the app with a code
 * that only this app, holding the secret behind the challenge it left with,
 * can swap for its session.
 */
export async function signInFromApp(area: string) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  try {
    localStorage.setItem(VERIFIER_KEY, verifier)
  } catch {
    // Kept for this visit only; the swap comes back within seconds.
  }
  memory = verifier
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url: `${location.origin}/api/auth/google/start?${new URLSearchParams({ next: area, app: challenge })}` })
}
let memory: string | undefined

/**
 * Listens for the phone handing the app back its sign-in. Says why when it
 * didn't work, in the words the sign-in screen already uses.
 */
export async function listenForSignIn(done: (outcome: { next: string } | { problem: 'denied' | 'cancelled' | 'failed' }) => void) {
  if (!inApp()) return
  const [{ App }, { Browser }] = await Promise.all([import('@capacitor/app'), import('@capacitor/browser')])
  await App.addListener('appUrlOpen', ({ url }) => {
    let back: URL
    try {
      back = new URL(url)
    } catch {
      return
    }
    if (back.hostname !== 'signed-in' && !back.pathname.endsWith('signed-in')) return
    void Browser.close().catch(() => undefined)
    const problem = back.searchParams.get('signin')
    const code = back.searchParams.get('code')
    if (problem || !code) return done({ problem: problem === 'denied' || problem === 'cancelled' ? problem : 'failed' })
    let verifier = memory
    try {
      verifier ??= localStorage.getItem(VERIFIER_KEY) ?? undefined
      localStorage.removeItem(VERIFIER_KEY)
    } catch {
      // Only the one in memory, then.
    }
    memory = undefined
    void fetch('/api/auth/app/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, verifier }),
      signal: AbortSignal.timeout(8_000),
    })
      .then(async (res) => (res.ok ? done((await res.json()) as { next: string }) : done({ problem: 'failed' })))
      .catch(() => done({ problem: 'failed' }))
  })
}

function base64url(bytes: Uint8Array) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
