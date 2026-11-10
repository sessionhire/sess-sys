import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { scrollerOf } from './windowed.ts'
import { listOpened, openedList } from './places.ts'
import { addButton, isPending, tookPending, useAddAsked } from './pageAdd.ts'

/**
 * Two ways to keep a screen short on a phone (audit finding 16): a form
 * stays behind its button until it's wanted, and a long list shows its
 * first few with the rest a tap away.
 */

/**
 * The form behind a button: "Add person" opens it in place, with the cursor
 * in its first field, and Close puts it away. Put away, not thrown away:
 * once opened the form stays, hidden, so whatever was typed is still there
 * when it opens again.
 */
export function Fold({
  label,
  children,
  className,
  opened,
  from,
}: {
  label: string
  children: ReactNode
  className?: string
  /** Opens it from outside, each time it changes to a new number: the job's Next button opening the offer it names (ADR 0140). */
  opened?: number
  /**
   * The list's add on the page's title line (pageAdd.ts), by its name: the form has no button of its own, and opens each time the
   * title's is pressed. Only presses from now on: one made on an earlier visit doesn't open it as the page comes back.
   */
  from?: string
}) {
  const asked = useAddAsked(from)
  // Pressed on another view on the way here: open, as if pressed here (pageAdd.ts). Taken once it has opened, as the list can be
  // drawn more than once as it arrives.
  const [askedBefore] = useState(() => asked - (isPending(from) ? 1 : 0))
  const [open, setOpen] = useState(!!opened)
  // Opened at least once: from then on the form is kept, open or not.
  const [kept, setKept] = useState(!!opened)
  useEffect(() => {
    if (!opened) return
    setKept(true)
    setOpen(true)
  }, [opened])
  const box = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const closed = useRef(false)
  const first = () => box.current?.querySelector<HTMLElement>('input, select, textarea')?.focus()
  useEffect(() => {
    if (asked <= askedBefore) return
    tookPending(from)
    setKept(true)
    setOpen(true)
    // Pressed again while it's open: back to its first field, wherever the page has been scrolled to.
    first()
  }, [asked, askedBefore, from])
  useEffect(() => {
    if (open) first()
    // Close goes as the form does, so on a keyboard the focus goes back to the button rather than being lost.
    else if (closed.current) (from ? addButton(from) : opener.current)?.focus()
  }, [open, from])
  return (
    <>
      {!open && !from && (
        <button
          type="button"
          className={className}
          onClick={() => {
            setKept(true)
            setOpen(true)
          }}
          ref={opener}
        >
          {label}
        </button>
      )}
      {kept && (
        <div className="fold" ref={box} hidden={!open}>
          {children}
          <button
            type="button"
            className="link"
            onClick={() => {
              closed.current = true
              setOpen(false)
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  )
}

/**
 * The first few of a list, and "Show all 42 products" for the rest; `what`
 * names them. Anything `keep` picks out, such as kit that's short, stays in
 * view wherever it is in the list, so nothing to act on is a tap away.
 */
export function ShowAll<T>({
  items,
  limit = 5,
  what,
  keep,
  name,
  children,
}: {
  items: readonly T[]
  limit?: number
  what: string
  /** Which list it is, for Back to open it again; its `what` unless two lists on a screen share one. */
  name?: string
  keep?: (item: T) => boolean
  children: (shown: readonly T[]) => ReactNode
}) {
  // Back to a list opened in full opens it again, by its name on this step (places.ts).
  const [all, setAll] = useState(() => listOpened(name ?? what))
  const shown = all || items.length <= limit ? items : items.filter((x, i) => i < limit || keep?.(x))
  // Where the page was when Show all was tapped (audit, 20 October 2026, finding 97): the rest of the list opens below what was
  // being read. Left to itself the browser keeps whatever was under the list on the screen, which carries the page to the list's end.
  const was = useRef<{ scroller: HTMLElement | null; top: number } | null>(null)
  useLayoutEffect(() => {
    const at = was.current
    if (!all || !at) return
    was.current = null
    const back = () => (at.scroller ? (at.scroller.scrollTop = at.top) : scrollTo(scrollX, at.top))
    back()
    const frame = requestAnimationFrame(back)
    return () => cancelAnimationFrame(frame)
  }, [all])
  const showAll = (button: HTMLElement) => {
    const scroller = scrollerOf(button)
    was.current = { scroller, top: scroller ? scroller.scrollTop : scrollY }
    openedList(name ?? what)
    setAll(true)
  }
  return (
    <>
      {children(shown)}
      {shown.length < items.length && (
        <button type="button" className="link show-all" onClick={(e) => showAll(e.currentTarget)}>
          Show all {items.length.toLocaleString('en-IE')} {what}
        </button>
      )}
    </>
  )
}

