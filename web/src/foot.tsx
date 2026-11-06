import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * The foot of the screen (Shell.tsx): on a phone one fixed footer that holds
 * a page's one action, when it has one, over the places; from 900px the
 * places are the rail down the left and the foot is that rail. A page's
 * action is drawn once: in the foot on a phone, in the page head from 640px,
 * so the footer knows both of its jobs and nothing stacks two bars.
 */
export const FootContext = createContext<HTMLElement | null>(null)

const phoneWide = typeof matchMedia === 'function' ? matchMedia('(max-width: 639px)') : undefined

/** True on a phone's width, where the foot holds the page's action. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(phoneWide?.matches ?? false)
  useEffect(() => {
    if (!phoneWide) return
    const look = () => setPhone(phoneWide.matches)
    phoneWide.addEventListener('change', look)
    return () => phoneWide.removeEventListener('change', look)
  }, [])
  return phone
}

/** A page's one action (ADR 0104): into the foot on a phone, in place (the page head) otherwise. */
export function PageAction({ children }: { children: ReactNode }) {
  const foot = useContext(FootContext)
  const phone = usePhone()
  if (phone && foot) return createPortal(children, foot)
  return <>{children}</>
}

/** From 900px across the places are a sidebar (ADR 0036), with room for more than a phone's bar. */
const deskWide = typeof matchMedia === 'function' ? matchMedia('(min-width: 900px)') : undefined
export function useDesk(): boolean {
  const [desk, setDesk] = useState(deskWide?.matches ?? false)
  useEffect(() => {
    const on = () => setDesk(deskWide?.matches ?? false)
    deskWide?.addEventListener('change', on)
    return () => deskWide?.removeEventListener('change', on)
  }, [])
  return desk
}
