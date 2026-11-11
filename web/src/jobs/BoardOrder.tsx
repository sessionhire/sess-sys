import { moved, type JobSteps } from '@sh/shared'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../Icon.tsx'

/**
 * A group of the Board's cards a person can put in order (ADR 0143): a column, or one of Planning's weeks. Each card has
 * a Move button, the one handle for every way of moving it, after the design system's drag and drop and its list:
 *
 * - Dragged with a mouse, a pen or a finger: only the button takes the drag, so a phone still scrolls the column by the
 *   card. Nothing moves while it's held; a line shows where it will land, and it lands when let go.
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
  // Dragged: where it would land, as an index in the group as it stands; nothing else moves until it's let go.
  const [drag, setDrag] = useState<{ id: string; at: number }>()
  const box = useRef<HTMLDivElement>(null)
  const press = useRef<{ id: string; x: number; y: number; moved: boolean; pointer: number } | undefined>(undefined)
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

  /** Where a drag would land: before the first card whose middle is below the pointer. */
  const landing = (y: number) => {
    const cards = [...(box.current?.querySelectorAll<HTMLElement>(':scope > [data-card]') ?? [])]
    const i = cards.findIndex((c) => {
      const r = c.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    return i < 0 ? cards.length : i
  }

  return (
    <div
      ref={box}
      className="board-cards"
      data-holding={held ? 'true' : undefined}
      // A press on another card while one is held is where it goes, not a way into that job.
      onClickCapture={(e) => {
        if (!held) return
        const target = (e.target as HTMLElement).closest<HTMLElement>('[data-card]')
        if (!target || target.dataset.card === held.id || (e.target as HTMLElement).closest('.board-grip, .stage-owner')) return
        e.preventDefault()
        e.stopPropagation()
        into(target.dataset.card!)
      }}
    >
      {shown.map((id, i) => {
        const s = byId.get(id)!
        const isHeld = held?.id === id
        return (
          <div
            key={id}
            className="board-item"
            data-card={id}
            data-dragging={isHeld || drag?.id === id ? 'true' : undefined}
            data-drop={drag && drag.at === i && drag.id !== id && ids[i - 1] !== drag.id ? 'before' : drag && i === shown.length - 1 && drag.at === shown.length && drag.id !== id ? 'after' : undefined}
          >
            {card(s)}
            {canOrder && (
              <button
                type="button"
                className="board-grip"
                aria-label={held && !isHeld ? `Put ${name(held.id)} here, in place of ${s.job.name}` : `Move ${s.job.name}`}
                aria-pressed={isHeld}
                aria-describedby={held ? undefined : 'board-order-help'}
                title={held ? undefined : 'Drag it, or press it and move it with the arrow keys. Cards not put in order go soonest first.'}
                onPointerDown={(e) => {
                  if (held || e.button !== 0) return
                  press.current = { id, x: e.clientX, y: e.clientY, moved: false, pointer: e.pointerId }
                  e.currentTarget.setPointerCapture(e.pointerId)
                }}
                onPointerMove={(e) => {
                  const p = press.current
                  if (!p || p.pointer !== e.pointerId) return
                  if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return
                  p.moved = true
                  setDrag({ id, at: landing(e.clientY) })
                }}
                onPointerUp={(e) => {
                  const p = press.current
                  if (!p || p.pointer !== e.pointerId || !p.moved) return
                  const at = landing(e.clientY)
                  const from = ids.indexOf(id)
                  // Counted without the card itself, which comes out of its own place first.
                  putDown(moved(ids, from, at > from ? at - 1 : at), id)
                }}
                onPointerCancel={() => {
                  press.current = undefined
                  setDrag(undefined)
                }}
                onLostPointerCapture={() => {
                  if (press.current?.moved) setDrag(undefined)
                }}
                onClick={() => {
                  // The click that ends a drag has already been dealt with.
                  if (press.current?.moved) {
                    press.current = undefined
                    return
                  }
                  press.current = undefined
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
