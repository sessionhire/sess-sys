/**
 * A jump to a part of the screen already open glides there, so it reads as
 * the same page moving rather than a new one arriving (Colly, 7 November
 * 2026): a part on "On this screen", a job's Next, a check on the Status
 * page. A move to another screen still starts it at its place at once, as
 * places.ts does, so the two can be told apart by how they move.
 *
 * Within the design system's ceiling for a transition (motion.md): the page
 * travels at most about a screen, over `--ds-duration-slow` on the standard
 * curve; a part further away is jumped to most of the way first, so the
 * glide still says which way it went without a long scroll to sit through.
 * A hand on the page (a wheel, a touch, a key, a press) stops it where it
 * is. Under reduced motion nothing travels: the page is put there at once.
 *
 * What was landed on is marked for a moment by an edge in the accent, the
 * app's "you are here", that fades: so the eye finds it at the end of the
 * glide, and under reduced motion, where it's the only sign of the jump,
 * it stays (a colour, not movement).
 */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** What stays at the top (the bar and the strip of parts) as the page's own scroll padding says it (app.css). */
const heldTop = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0

/** The page's place that brings `el` under what's held at the top, or to the middle of what's left of the screen. */
function placeFor(el: HTMLElement, block: 'start' | 'center'): number {
  const top = el.getBoundingClientRect().top + scrollY
  const held = heldTop()
  const y = block === 'center' ? top - held - (innerHeight - held - el.offsetHeight) / 2 : top - held
  return Math.round(Math.min(Math.max(0, y), document.documentElement.scrollHeight - innerHeight))
}

/** The design system's standard curve, cubic-bezier(0.2, 0, 0, 1), solved for progress at time t (0..1). */
function standard(t: number): number {
  const [x1, y1, x2, y2] = [0.2, 0, 0, 1]
  const bez = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (bez(x1, x2, mid) < t) lo = mid
    else hi = mid
  }
  return bez(y1, y2, (lo + hi) / 2)
}

const durationMs = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ds-duration-slow')) || 240

let stopLast: (() => void) | undefined

/** Marks a part as just landed on: the edge fades by itself (app.css, .landed). */
export function markLanded(el: HTMLElement) {
  el.classList.remove('landed')
  // Read between, so a second jump to the same part starts the fade again.
  void el.offsetWidth
  el.classList.add('landed')
  el.addEventListener('animationend', () => el.classList.remove('landed'), { once: true })
}

export interface GlideOptions {
  /** Where the part comes to: its top under the bar (the default), or the middle of the screen, as a field does. */
  block?: 'start' | 'center'
  /** What takes the focus, without the browser scrolling for it: a heading takes it without joining the Tab order. */
  focus?: HTMLElement
  /** What's marked as landed on; none for a form opening in place, which is its own sign. */
  mark?: HTMLElement
}

/** Glides the page to `el`, on the screen already open. */
export function glideTo(el: HTMLElement, { block = 'start', focus, mark }: GlideOptions = {}) {
  stopLast?.()
  if (focus) {
    if (!focus.matches('a[href], button, input, select, textarea, [tabindex]')) focus.tabIndex = -1
    focus.focus({ preventScroll: true })
  }
  if (mark) markLanded(mark)
  const from = scrollY
  const to = placeFor(el, block)
  if (Math.abs(to - from) < 2) return
  if (reduced()) return void scrollTo(0, to)
  // At most about a screen of travel: further than that is jumped, the rest glided, so the direction is seen.
  const reach = Math.round(innerHeight * 0.75)
  const start = Math.abs(to - from) > reach ? to - Math.sign(to - from) * reach : from
  if (start !== from) scrollTo(0, start)
  const length = durationMs()
  let began = 0
  let frame = 0
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
  const stop = () => {
    cancelAnimationFrame(frame)
    for (const e of events) removeEventListener(e, stop)
    if (stopLast === stop) stopLast = undefined
  }
  for (const e of events) addEventListener(e, stop, { passive: true })
  stopLast = stop
  const step = (now: number) => {
    began ||= now
    const t = Math.min(1, (now - began) / length)
    // Found again each frame: a long list's rows take their own height as they're drawn near the screen, moving the part.
    const end = placeFor(el, block)
    scrollTo(0, Math.round(start + (end - start) * standard(t)))
    if (t < 1) frame = requestAnimationFrame(step)
    else stop()
  }
  frame = requestAnimationFrame(step)
}
