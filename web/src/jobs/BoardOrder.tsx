import { moved, type JobSteps } from '@sh/shared'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../Icon.tsx'

/**
 * A group of the Board's cards a person can put in order (ADR 0143): a column, or one of Planning's weeks. After the design
 * system's drag and drop and its list:
 *
 * - Dragged by the card itself, as on any kanban board (Colly, 11 November 2026): with a mouse, once it has moved a few
 *   pixels, so a click still opens the job; with a finger, after holding it still for a moment, so a swipe still scrolls the
 *   page. Its Move button drags at once. As on Trello (Colly, 12 November 2026) the card lifts and follows the pointer, and
 *   the cards around it slide aside to open a gap where it will land; the page scrolls when it's held near the top or the
 *   bottom of the screen, and it lands in the gap when let go.
 * - Pressed (or Space or Enter): the card is picked up. The arrows move it, Home and End to the ends, Space or Enter puts it
 *   down, Escape puts it back. Or press another card, or its Move, and it takes that card's place: the press twin of a drag.
 *
 * Each move is said in the live region. Only the order inside the group changes: a job changes column when its records do.
 */
export function OrderedCards({
  jobs,
  where,
  canOrder,
  card,
  onOrder,
  say,
}: {
  jobs: JobSteps[]
  /** The group's name in a sentence: "Planning", "Planning, next week". */
  where: string
  canOrder: boolean
  card: (s: JobSteps) => ReactNode
  /** The group's new order, top first, and the job moved. */
  onOrder: (ids: string[], id: string) => void
  say: (words: string) => void
}) {
  const ids = jobs.map((s) => s.job.id)
  const byId = new Map(jobs.map((s) => [s.job.id, s]))
  const name = (id: string) => byId.get(id)?.job.name ?? 'The job'
  // Picked up by a press or a key: the order as it would be put down, drawn as it goes.
  const [held, setHeld] = useState<{ id: string; order: string[] }>()
  // Dragged: the card that's lifted. Where it goes is drawn straight onto the cards (below), as it follows the pointer.
  const [drag, setDrag] = useState<{ id: string }>()
  const box = useRef<HTMLDivElement>(null)
  /** A press that may become a drag: armed until it moves (or, by a finger on the card, until it has been held still). */
  const press = useRef<
    | {
        id: string
        x: number
        y: number
        x0: number
        y0: number
        pointer: number
        mode: 'armed' | 'drag'
        touch: boolean
        grip: boolean
        timer?: number
        target: Element
        lift?: Lift
      }
    | undefined
  >(undefined)
  // Cards moved aside by the drag that ended, to set straight once the new order is drawn.
  const settle = useRef<HTMLElement[] | undefined>(undefined)
  useLayoutEffect(() => {
    if (!settle.current || drag) return
    unshift(settle.current)
    settle.current = undefined
  })
  // The click that ends a drag lands on the card's link or its Move button: it's the drag's, not a way into the job.
  const dragged = useRef(false)
  const focusOn = useRef<string | undefined>(undefined)
  // A card the arrows moved is drawn again elsewhere in the list, so its Move button gets the focus back.
  useLayoutEffect(() => {
    if (!focusOn.current) return
    box.current?.querySelector<HTMLButtonElement>(`[data-card="${CSS.escape(focusOn.current)}"] .board-grip`)?.focus()
    focusOn.current = undefined
  })

  const shown = held ? held.order.filter((id) => byId.has(id)) : ids
  const place = (order: string[], id: string) => `${order.indexOf(id) + 1} of ${order.length}`

  const pickUp = (id: string) => {
    setHeld({ id, order: ids })
    say(`${name(id)} picked up, ${place(ids, id)} in ${where}. The arrows move it, Space puts it down, Escape puts it back.`)
  }
  const putDown = (order: string[], id: string) => {
    setHeld(undefined)
    setDrag(undefined)
    if (order.join() === ids.join()) {
      say(`${name(id)} put back where it was.`)
      return
    }
    say(`${name(id)} put down, ${place(order, id)} in ${where}.`)
    onOrder(order, id)
  }
  const putBack = () => {
    if (!held) return
    focusOn.current = held.id
    say(`${name(held.id)} put back where it was.`)
    setHeld(undefined)
  }
  /** Into the place of another card, as a press does while one is held. */
  const into = (target: string) => {
    if (!held) return
    const from = held.order.indexOf(held.id)
    const to = held.order.indexOf(target)
    putDown(moved(held.order, from, to), held.id)
  }
  const step = (by: number | 'top' | 'end') => {
    if (!held) return
    const from = held.order.indexOf(held.id)
    const to = by === 'top' ? 0 : by === 'end' ? held.order.length - 1 : Math.max(0, Math.min(held.order.length - 1, from + by))
    if (to === from) return
    const order = moved(held.order, from, to)
    focusOn.current = held.id
    setHeld({ id: held.id, order })
    say(`${place(order, held.id)}.`)
  }

  // What the drag's listeners read, as this render has it.
  const live = useRef({ ids, held, canOrder, putDown })
  live.current = { ids, held, canOrder, putDown }

  // The drag, on the group itself, so the whole card takes it (Colly, 11 November 2026). Listeners of the page's own, as a finger's
  // drag has to stop the page scrolling under it, which only a touchmove that isn't passive can do.
  useEffect(() => {
    const el = box.current
    if (!el) return
    let scrolling = 0
    const stop = () => {
      const p = press.current
      if (p?.timer) clearTimeout(p.timer)
      cancelAnimationFrame(scrolling)
      scrolling = 0
      press.current = undefined
    }
    const begin = () => {
      const p = press.current
      if (!p) return
      p.mode = 'drag'
      p.timer = undefined
      try {
        p.target.setPointerCapture(p.pointer)
      } catch {
        // The pointer may already be gone; the drag still ends on the next up.
      }
      if (p.touch && !p.grip) navigator.vibrate?.(10)
      p.lift = lift(el, p.id)
      setDrag({ id: p.id })
      follow(p)
      // Held near the top or the bottom of the screen, the page scrolls, so a card can go anywhere in a long column.
      const edge = Math.max(80, innerHeight * 0.15)
      const tick = () => {
        const q = press.current
        if (!q || q.mode !== 'drag') return
        // Only once it's been taken towards that edge, so a card picked up near one doesn't set the page off at once.
        const by = q.y < edge && q.y < q.y0 - 24 ? -(edge - q.y) / 4 : q.y > innerHeight - edge && q.y > q.y0 + 24 ? (q.y - (innerHeight - edge)) / 4 : 0
        if (by) {
          scrollBy(0, by)
          follow(q)
        }
        scrolling = requestAnimationFrame(tick)
      }
      scrolling = requestAnimationFrame(tick)
    }
    const down = (e: PointerEvent) => {
      const { held, canOrder } = live.current
      const t = e.target as HTMLElement
      const item = t.closest<HTMLElement>('[data-card]')
      if (!canOrder || held || press.current || e.button !== 0 || !item || !el.contains(item)) return
      // Choosing who has the stage is its own control, never a drag.
      if (t.closest('.stage-owner, select, input, textarea, label')) return
      const grip = !!t.closest('.board-grip')
      const touch = e.pointerType === 'touch'
      press.current = { id: item.dataset.card!, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, pointer: e.pointerId, mode: 'armed', touch, grip, target: grip ? t.closest('.board-grip')! : item }
      // A finger on the card has to be held still first, as a swipe is the page scrolling.
      if (touch && !grip) press.current.timer = window.setTimeout(begin, 380)
    }
    const move = (e: PointerEvent) => {
      const p = press.current
      if (!p || p.pointer !== e.pointerId) return
      p.x = e.clientX
      p.y = e.clientY
      if (p.mode === 'armed') {
        const far = Math.hypot(e.clientX - p.x0, e.clientY - p.y0)
        if (p.touch && !p.grip) {
          // Moved before it was held long enough: it's a scroll.
          if (far > 10) stop()
          return
        }
        if (far < 6) return
        begin()
        return
      }
      follow(p)
    }
    const up = (e: PointerEvent) => {
      const p = press.current
      if (!p || p.pointer !== e.pointerId) return
      if (p.mode === 'drag' && p.lift) {
        const { ids, putDown } = live.current
        // The click the browser sends after letting go is the end of the drag, not a way into the job.
        dragged.current = true
        setTimeout(() => (dragged.current = false))
        // The cards stay where the drag left them until the new order is drawn, so nothing jumps.
        settle.current = p.lift.items
        putDown(moved(ids, p.lift.from, p.lift.to), p.id)
      }
      stop()
    }
    const cancel = (e: PointerEvent) => {
      if (press.current?.pointer !== e.pointerId) return
      if (press.current.mode === 'drag') {
        if (press.current.lift) unshift(press.current.lift.items)
        setDrag(undefined)
      }
      stop()
    }
    // Once a finger's drag has begun, the page stays where it is under it (it scrolls only by the edges, above).
    const touchMove = (e: TouchEvent) => {
      if (press.current?.mode === 'drag' && e.cancelable) e.preventDefault()
    }
    // A finger held on a card is a drag, not the link's menu.
    const menu = (e: Event) => {
      if (press.current) e.preventDefault()
    }
    // A card is a link, which a browser would otherwise drag as a link.
    const nativeDrag = (e: DragEvent) => {
      if (live.current.canOrder) e.preventDefault()
    }
    el.addEventListener('pointerdown', down)
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', cancel)
    addEventListener('touchmove', touchMove, { passive: false })
    el.addEventListener('contextmenu', menu)
    el.addEventListener('dragstart', nativeDrag)
    return () => {
      stop()
      el.removeEventListener('pointerdown', down)
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', cancel)
      removeEventListener('touchmove', touchMove)
      el.removeEventListener('contextmenu', menu)
      el.removeEventListener('dragstart', nativeDrag)
    }
  }, [])

  return (
    <div
      ref={box}
      className="board-cards"
      data-holding={held ? 'true' : undefined}
      data-orderable={canOrder ? 'true' : undefined}
      data-sorting={drag ? 'true' : undefined}
      // A press on another card while one is held is where it goes, not a way into that job.
      onClickCapture={(e) => {
        // The click a drag ends with is the drag's: it neither opens the job nor picks the card up.
        if (dragged.current) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        if (!held) return
        const target = (e.target as HTMLElement).closest<HTMLElement>('[data-card]')
        if (!target || target.dataset.card === held.id || (e.target as HTMLElement).closest('.board-grip, .stage-owner')) return
        e.preventDefault()
        e.stopPropagation()
        into(target.dataset.card!)
      }}
    >
      {shown.map((id) => {
        const s = byId.get(id)!
        const isHeld = held?.id === id
        return (
          <div
            key={id}
            className="board-item"
            data-card={id}
            data-dragging={isHeld || drag?.id === id ? 'true' : undefined}
          >
            {card(s)}
            {canOrder && (
              <button
                type="button"
                className="board-grip"
                aria-label={held && !isHeld ? `Put ${name(held.id)} here, in place of ${s.job.name}` : `Move ${s.job.name}`}
                aria-pressed={isHeld}
                aria-describedby={held ? undefined : 'board-order-help'}
                title={held ? undefined : 'Drag the card, or press this and move it with the arrow keys. Cards not put in order go soonest first.'}
                onClick={() => {
                  if (!held) pickUp(id)
                  else if (isHeld) putDown(held.order, id)
                  else into(id)
                }}
                onKeyDown={(e) => {
                  if (!isHeld) return
                  const keys: Record<string, number | 'top' | 'end'> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1, Home: 'top', End: 'end' }
                  if (e.key in keys) {
                    e.preventDefault()
                    step(keys[e.key]!)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    putBack()
                  }
                }}
                onBlur={(e) => {
                  // Leaving the group puts a held card back; moving between its own buttons doesn't.
                  if (isHeld && !focusOn.current && !box.current?.contains(e.relatedTarget as Node | null)) putBack()
                }}
              >
                <Icon name="sort" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** A card lifted by a drag: where the group's cards stood when it was picked up, and where it would land now. */
interface Lift {
  items: HTMLElement[]
  from: number
  to: number
  /** Each card's middle, down the page (so the page can scroll under the drag). */
  mids: number[]
  /** How far a card moves aside: the lifted card's height and the gap below it. */
  size: number
  scroll0: number
}

function lift(group: HTMLElement, id: string): Lift {
  const items = [...group.querySelectorAll<HTMLElement>(':scope > [data-card]')]
  const from = items.findIndex((c) => c.dataset.card === id)
  const rects = items.map((c) => c.getBoundingClientRect())
  const gap = parseFloat(getComputedStyle(group).rowGap) || 0
  return { items, from, to: from, mids: rects.map((r) => r.top + scrollY + r.height / 2), size: rects[from]!.height + gap, scroll0: scrollY }
}

/** The lifted card under the pointer, and the others slid aside to open its gap. */
function follow(p: { x: number; y: number; x0: number; y0: number; lift?: Lift }) {
  const l = p.lift
  if (!l) return
  const dx = p.x - p.x0
  const dy = p.y + scrollY - (p.y0 + l.scroll0)
  l.items[l.from]!.style.transform = `translate(${dx}px, ${dy}px) rotate(1.5deg)`
  // It lands below every other card whose middle its own middle has passed.
  const mid = l.mids[l.from]! + dy
  l.to = l.mids.filter((m, k) => k !== l.from && m < mid).length
  l.items.forEach((c, k) => {
    if (k === l.from) return
    const by = l.from < k && k <= l.to ? -l.size : l.to <= k && k < l.from ? l.size : 0
    c.style.transform = by ? `translateY(${by}px)` : ''
    if (by) c.dataset.shift = by < 0 ? 'up' : 'down'
    else delete c.dataset.shift
  })
}

/** Back to their places, all at once (the new order is drawn in the same frame). */
function unshift(items: HTMLElement[]) {
  for (const c of items) {
    c.style.transition = 'none'
    c.style.transform = ''
    delete c.dataset.shift
  }
  requestAnimationFrame(() => {
    for (const c of items) c.style.transition = ''
  })
}
