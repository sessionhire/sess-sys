import type { View } from '@sh/shared'
import { useEffect, useRef } from 'react'
import { Icon } from '../Icon.tsx'
import { ProductScreen } from './ProductScreen.tsx'

/**
 * A product's page in a sheet over the quote (the design system's sheet), so the office can look at what it is, the jobs it's
 * on, its items and its faults without losing their place on the quote: from the end at a desk, the whole screen on a phone,
 * where the sheet is the page and scrolls as one (no captive scroll). Escape, Close or the veil shut it and focus goes back to
 * the button that opened it. Its tabs change without changing the quote's address; "Full page" goes to the product's own page,
 * and a link in it to somewhere else (a job it's on, an item) goes there, as on its page.
 */
export function ProductSheet({ view, id, onClose }: { view: View; id: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const name = view.warehouse.models.find((m) => m.id === id)?.name ?? 'Product'
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  // A link in it goes to another page: the sheet goes with the quote it was over.
  useEffect(() => {
    const away = () => ref.current?.close()
    addEventListener('hashchange', away)
    return () => removeEventListener('hashchange', away)
  }, [])
  return (
    <dialog
      className="product-sheet"
      ref={ref}
      aria-label={name}
      onClose={onClose}
      // A press on the veil (outside the sheet's box) closes it, as the system's sheet() does.
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect()
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) ref.current.close()
        }
      }}
    >
      <div className="product-sheet-bar">
        <a className="button" href={`#stock/product/${encodeURIComponent(id)}`}>
          Full page
        </a>
        <button type="button" onClick={() => ref.current?.close()} autoFocus>
          <Icon name="close" />
          Close
        </button>
      </div>
      <div className="app warehouse in-sheet">
        <ProductScreen view={view} id={id} inSheet />
      </div>
    </dialog>
  )
}
