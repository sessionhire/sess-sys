import { dayLabel, newId, type View } from '@sh/shared'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Refusal, useAct } from '../act.tsx'
import { client } from '../sync.ts'
import { useToday } from '../view.ts'
import { ClientField, clientNamed, NewOrNear, newQuoteHref, VenueField, venueNamed } from './common.tsx'

/**
 * A quote started on a day of the planner (ADR 0124), the way a calendar
 * makes an event: a card opens on the day with the job's name as its big
 * field, the day filled in, the client and venue under it, and two ways
 * out: Start the quote here, or More options, which carries what was typed
 * to the full New quote form on that day. The week stays where it was
 * behind the card, so the day it's about is still in view.
 *
 * At a desk the card hangs under the day's button (the design system's
 * popover: no veil, a click outside or Escape closes it); on a phone it's a
 * sheet up from the foot over the veil (jobs.css). One native dialog does
 * both, so Escape, the focus trap and focus going back to the day's button
 * come from the browser.
 */

/** Which day the card is for, and the button it opened from, which it hangs under at a desk. */
export interface QuickAt {
  day: string
  anchor: HTMLElement
}

/** What the card had typed, kept for the full form across the move to it. */
const DRAFT = 'sh.quickQuote'
export interface QuickDraft {
  name: string
  client: string
  venue: string
  start: string
  end: string
}

/** The card's draft, once, for New quote to start from: gone after it's read, so a later New quote starts clean. */
export function takeQuickDraft(): QuickDraft | undefined {
  try {
    const raw = sessionStorage.getItem(DRAFT)
    if (!raw) return undefined
    sessionStorage.removeItem(DRAFT)
    return JSON.parse(raw) as QuickDraft
  } catch {
    return undefined
  }
}

const GAP = 8
const EDGE = 16

export function QuickQuote({ view, at, onClose }: { view: View; at: QuickAt; onClose: () => void }) {
  const today = useToday()
  const { clients, venues } = view.jobs
  const first = at.day >= today ? at.day : today
  const [f, setF] = useState<QuickDraft>({ name: '', client: '', venue: '', start: first, end: first })
  const ref = useRef<HTMLDialogElement>(null)
  const { run, error } = useAct()

  // Open as a modal, so Escape closes it and focus comes back to the day; at a desk, hang it under the day, kept inside the window.
  useLayoutEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    const place = () => {
      if (!matchMedia('(min-width: 600px)').matches) {
        d.style.top = d.style.left = ''
        return
      }
      const a = at.anchor.getBoundingClientRect()
      const w = d.offsetWidth
      const h = d.offsetHeight
      const left = Math.max(EDGE, Math.min(a.left, innerWidth - w - EDGE))
      // Below the day when it fits, else above it, else as low as fits.
      let top = a.bottom + GAP
      if (top + h > innerHeight - EDGE) top = a.top - GAP - h
      if (top < EDGE) top = Math.max(EDGE, innerHeight - EDGE - h)
      d.style.left = `${left}px`
      d.style.top = `${top}px`
    }
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [at])
  // Once open, the name takes focus: it's the field the card is for.
  useEffect(() => {
    ref.current?.querySelector<HTMLInputElement>('.quick-title')?.focus()
  }, [])

  const dates = (start: string, end: string) => setF({ ...f, start, end: end < start ? start : end })
  const draft = { ...f, name: f.name.trim(), client: f.client.trim(), venue: f.venue.trim() }

  /** The full form, on the day, with what's typed here carried over. The day goes in the address only as a date, never as typed. */
  const more = (e: MouseEvent) => {
    e.preventDefault()
    try {
      sessionStorage.setItem(DRAFT, JSON.stringify(draft))
    } catch {
      /* then the form starts on the day alone */
    }
    location.hash = newQuoteHref(/^\d{4}-\d{2}-\d{2}$/.test(draft.start) ? draft.start : at.day)
  }

  /** The job as an enquiry with one Show across the days, and an empty quote on it, as New quote makes them, then the quote. */
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.name) return
    const id = newId()
    void run(async () => {
      const clientId = await clientNamed(draft.client, clients)
      const venueId = await venueNamed(draft.venue, venues)
      await client.mutate('project.create', { id, name: draft.name, clientId, venueId, status: 'enquiry', kind: 'gig', notes: '' })
      await client.mutate('phase.add', { id: newId(), projectId: id, name: 'Show', start: draft.start, end: draft.end, venueId: null, notes: '' })
      await client.mutate('quote.save', { id: newId(), projectId: id, lines: [], discountPct: view.money.discountOf(clientId) ?? 0, notes: '' })
    }).then((ok) => {
      if (!ok) return
      ref.current?.close()
      location.hash = `#jobs/${encodeURIComponent(id)}/quote`
    })
  }

  const title = `Quote starting ${dayLabel(f.start)}`
  return (
    <dialog
      className="quick-quote"
      ref={ref}
      aria-labelledby="quick-quote-title"
      onClose={onClose}
      // A press on the veil, or beside the card at a desk, is a press outside: the card goes, as a popover does.
      onClick={(e) => e.target === ref.current && ref.current.close()}
    >
      <form onSubmit={submit} aria-label="New quote on this day">
        <div className="quick-head">
          <h2 id="quick-quote-title">{title}</h2>
          <button type="button" className="quick-close" aria-label="Close" onClick={() => ref.current?.close()}>
            ×
          </button>
        </div>
        <input className="quick-title" aria-label="What's the job?" placeholder="What's the job?" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <div className="quick-dates">
          <label>
            From <input type="date" value={f.start} min={today} onChange={(e) => dates(e.target.value, f.end)} required />
          </label>
          <label>
            To <input type="date" value={f.end} min={f.start} onChange={(e) => dates(f.start, e.target.value)} required />
          </label>
        </div>
        <ClientField jobs={view.jobs} optional value={f.client} onChange={(c) => setF((now) => ({ ...now, client: c }))} />
        <NewOrNear value={f.client} names={clients} what="client" onPick={(n) => setF({ ...f, client: n })} />
        <VenueField jobs={view.jobs} optional value={f.venue} onChange={(v) => setF((now) => ({ ...now, venue: v }))} />
        <NewOrNear value={f.venue} names={venues} what="venue" onPick={(n) => setF({ ...f, venue: n })} />
        <p className="hint">Added to Jobs as an enquiry. Kit, crew, who asked and the rest go on the quote.</p>
        <Refusal error={error} />
        <div className="actions">
          <a className="link" href={newQuoteHref()} onClick={more}>
            More options
          </a>
          <button type="submit" className="primary">
            Start the quote
          </button>
        </div>
      </form>
    </dialog>
  )
}
