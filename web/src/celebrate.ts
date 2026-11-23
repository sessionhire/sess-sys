import { sparks } from '@sh/shared'

/**
 * Where the last press was, so the sparks for a booking can start at the button that made it (23 November 2026) when
 * nothing else says it. A press by keyboard starts them from the button that had the focus.
 */
let pressed: { x: number; y: number; at: number } | undefined
if (typeof document !== 'undefined')
  document.addEventListener(
    'pointerdown',
    (e) => {
      pressed = { x: e.clientX, y: e.clientY, at: Date.now() }
    },
    { capture: true, passive: true }
  )

/** How long the panel that says what was done takes to glide into view (the system's slow duration, and a frame). */
const SETTLED_MS = 280

function centre(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

const onScreen = (r: DOMRect) => r.height > 0 && r.bottom > 0 && r.top < window.innerHeight

/**
 * Where the sparks start: over the words that say what was done ("Ciarán Walsh is booked"), in the panel a confirm
 * opens and glides to, once it's there; or else where Confirm was pressed.
 */
function from(): { x: number; y: number } {
  const heading = document.querySelector('.card.share h2')
  if (heading) {
    const words = document.createRange()
    words.selectNodeContents(heading)
    const r = words.getBoundingClientRect()
    if (onScreen(r)) return centre(r)
  }
  if (pressed && Date.now() - pressed.at < 15_000) return pressed
  const focused = document.activeElement
  if (focused instanceof HTMLElement && focused !== document.body) return centre(focused.getBoundingClientRect())
  return { x: window.innerWidth / 2, y: window.innerHeight / 3 }
}

/**
 * A small burst once the office's Confirm or Agree on someone's yes is kept: the person is booked. The freelancer's
 * own page has the larger one when they say yes (server/src/crew/page.ts).
 */
export function celebrateBooked(): void {
  window.setTimeout(() => {
    const at = from()
    pressed = undefined
    sparks(at.x, at.y, 'small')
  }, SETTLED_MS)
}
