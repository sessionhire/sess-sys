import { glideTo } from '../glide.ts'

/**
 * Takes the person to a call's card on the same page after a form changed it or made it: glided to, marked where it lands, and
 * its line takes the focus so a screen reader reads out what is now there (glide.ts). On a phone the card is usually off the
 * top of the screen while the form is at the bottom, and a press whose result lands out of sight looks like nothing happened
 * (Colly, 13 November 2026). A card still on its way to the page is waited for, a few frames at most.
 */
export function landOnCall(id: string, frames = 10) {
  const go = (left: number) => {
    const card = document.getElementById(`call-${id}`)
    if (!card) {
      if (left > 0) requestAnimationFrame(() => go(left - 1))
      return
    }
    glideTo(card, { mark: card, focus: card.querySelector<HTMLElement>('.call-line') ?? undefined })
  }
  requestAnimationFrame(() => go(frames))
}
