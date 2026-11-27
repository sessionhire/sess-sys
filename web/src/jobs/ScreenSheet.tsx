import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Icon } from '../Icon.tsx'
import { ScreenBuilder, type ScreenBuilderProps } from './ScreenBuilder.tsx'

/**
 * The LED screen builder's sheet over the quote (ADR 0207): the design system's sheet, as a line's product page is
 * (ProductSheet.tsx). From the end at a desk, wide enough there for the questions and their answer side by side; the
 * whole screen on a phone, where it scrolls as one with its name and Close held at the top and what the screen comes to,
 * with Add to quote, held at the foot. Escape, Close, Cancel or a press on the veil shut it and the focus goes back to the
 * button that opened it; what was typed of a new screen is kept for the next time it's opened, so none of those loses it.
 */
export function ScreenSheet({ kept, onKeep, onDone, onRemove, onClose, ...rest }: Omit<ScreenBuilderProps, 'onFresh'>) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  // Start again: the builder is made anew with nothing kept.
  const [fresh, setFresh] = useState(0)
  // Opened before the builder's own effects run: opening puts the focus on Close, and the builder then moves it to its
  // first question where there's a keyboard (ScreenBuilder.tsx).
  useLayoutEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  // Leaving the quote's page takes the sheet with it.
  useEffect(() => {
    const away = () => ref.current?.close()
    addEventListener('hashchange', away)
    return () => removeEventListener('hashchange', away)
  }, [])
  // Shut the browser's way, so the focus goes back to what opened it before the quote moves it on.
  const shut = () => ref.current?.close()
  // A press on the veil closes it, as the system's sheet() does: one that both starts and ends there, so text selected by a
  // drag that runs off the sheet's edge doesn't.
  const onVeil = (e: MouseEvent) => {
    const d = ref.current
    if (!d || e.target !== d) return false
    const r = d.getBoundingClientRect()
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
  }
  const pressed = useRef(false)
  return (
    <dialog
      className="product-sheet screen-sheet"
      ref={ref}
      aria-labelledby={id}
      onClose={onClose}
      onMouseDown={(e) => {
        pressed.current = onVeil(e)
      }}
      onClick={(e) => {
        if (pressed.current && onVeil(e)) shut()
        pressed.current = false
      }}
    >
      <div className="product-sheet-bar screen-sheet-bar">
        <h2 id={id}>{rest.was ? 'Change the LED screen' : 'Add an LED screen'}</h2>
        <button type="button" onClick={shut}>
          <Icon name="close" />
          Close
        </button>
      </div>
      <div className="screen-sheet-body">
        <ScreenBuilder
          key={fresh}
          {...rest}
          kept={fresh ? undefined : kept}
          onKeep={onKeep}
          onFresh={() => {
            onKeep(undefined)
            setFresh((n) => n + 1)
          }}
          onDone={(set) => {
            shut()
            onDone(set)
          }}
          onRemove={
            onRemove &&
            (() => {
              shut()
              onRemove()
            })
          }
          onClose={shut}
        />
      </div>
    </dialog>
  )
}
