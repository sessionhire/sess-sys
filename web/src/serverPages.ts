/**
 * Addresses the server answers itself, never the app (ADR 0186): the API,
 * a freelancer's link (ADR 0002), their lost-link page (ADR 0114), a
 * client's quote (ADR 0121), calendar feeds and the decision records. The
 * service worker leaves them to the network (vite.config.ts), so a phone
 * or laptop that has opened the app before still gets the page a client
 * or freelancer gets, with no sign-in.
 */
export const SERVER_PAGES: RegExp[] = [/^\/api\//, /^\/f\//, /^\/q\//, /^\/cal\//, /^\/adr\//, /^\/link(\/|\?|$)/]

const SHELL_LEFT = 'sh.shellLeftFor'

/**
 * The app's shell was drawn at one of those addresses: a service worker from before the address was on the list (an
 * older version, still in charge until the app reloads) answered for the server. Its registration goes, and the page
 * loads again from the network, as it would on a device that never opened the app; the next time the app itself is
 * opened, it puts its worker back. Once only for the same address within a minute, so a page that still comes back
 * as the shell never reloads for ever. True when it's leaving, so nothing else starts.
 */
export function leaveShellForServerPage(): boolean {
  const here = location.pathname + location.search
  if (!SERVER_PAGES.some((p) => p.test(here)) || !('serviceWorker' in navigator)) return false
  try {
    const [path, at] = (sessionStorage.getItem(SHELL_LEFT) ?? '').split(' ')
    if (path === location.pathname && Date.now() - Number(at) < 60_000) return false
    sessionStorage.setItem(SHELL_LEFT, `${location.pathname} ${Date.now()}`)
  } catch {
    // Storage blocked: nothing to remember it by, so the shell stays rather than risk reloading for ever.
    return false
  }
  void navigator.serviceWorker
    .getRegistrations()
    .then((all) => Promise.all(all.map((r) => r.unregister())))
    .catch(() => {})
    .then(() => location.reload())
  return true
}
