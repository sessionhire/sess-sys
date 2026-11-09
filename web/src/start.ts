import { asStartScreen } from '@sh/shared'
import { currentAuth, onAuth } from './auth.ts'

/** The app's own address with nothing after it: what a phone's icon, a bookmark of the app and typing its name open. */
const bare = () => location.hash === '' || location.hash === '#'

/**
 * The app's opening load goes to the screen the person chose under You (ADR 0122), when they chose one other than Home.
 * Only the bare address: a link to a job, a shared planner week or Home itself still lands where it points, and so does
 * anywhere the person has moved to since. Replaced rather than added, so Back doesn't land on a Home they never saw.
 *
 * Who they are is on the device from the last time; the first time on a new device it comes from the server a moment
 * later, and is still followed if nothing has moved by then.
 */
export function openOnStart() {
  if (!bare()) return
  const go = (): boolean => {
    const auth = currentAuth()
    if (auth.status !== 'signed-in') return false
    const start = asStartScreen(auth.user.start)
    if (start && bare()) location.replace(start)
    return true
  }
  if (go()) return
  const off = onAuth(() => {
    if (go() || !bare()) off()
  })
  setTimeout(off, 8_000)
}
