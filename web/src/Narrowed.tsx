import { useEffect, useState } from 'react'
import { bothNames, DEPARTMENT_LABELS, kitOf, narrower, type Department } from '@sh/shared'
import { arrival } from './arrival.ts'
import { listOpened, openedList } from './places.ts'
import { useAccess } from './role.ts'
import { useView } from './view.ts'

/**
 * A head of department's own department (ADR 0046), from their card or
 * what the server reads them as; '' for anyone else. The lists they open
 * start on it, as Crew needed always has (audit, 5 November 2026, batch 4),
 * with the way to the rest.
 */
export function useMyDepartment(): string {
  const access = useAccess()
  const view = useView()
  if (access.role !== 'head') return ''
  const me = access.personId ? view.crew.people.find((p) => p.id === access.personId) : undefined
  return me?.department?.trim() || view.reading.department || ''
}

/**
 * A head's own department where it has kit on the stock list, LX's being
 * the lighting: Stock's lists and the counts on its row start on it, as
 * Crew's start on their people (Move 3 of the sweep of 6 November 2026).
 * '' for anyone else, and for a department with no kit of its own
 * (production, transport), whose Stock lists would otherwise start empty.
 */
export function useMyKitDepartment(): string {
  const department = useMyDepartment()
  return kitOf(department) ? department : ''
}

/**
 * A list a count on Home opened starts where the count was made (audit, 20
 * October 2026, finding 4), so it shows what was counted: on the department
 * it counted for, saying so with the way to the rest, or on every
 * department for the company's and the warehouse's counts. Opened any
 * other way, it starts on `start`, a head's own department (audit, 5
 * November 2026, finding 6), as its row counts it, or shows them all.
 * Widened, it's kept so on that step, as a list opened in full is
 * (places.ts): Back finds it as it was left, and a new move to its screen
 * starts it where its row's count does (Move 3 of the sweep of 6 November
 * 2026).
 */
export function useNarrowed(hash: string, start?: string): [department: string | undefined, widen: () => void] {
  const [came] = useState(() => arrival(hash))
  const everyone = `${hash} every department`
  const [wide, setWide] = useState(() => (came ? !came.department : listOpened(everyone)))
  // Kept on whichever step it's drawn on: a screen that stays drawn from one step to the next (Crew's pages) keeps it as it was.
  useEffect(() => {
    if (wide) openedList(everyone)
  })
  // The start is read as it's known: a head's department can come with the first copy, after the screen first drew.
  return [wide ? undefined : came?.department || start || undefined, () => setWide(true)]
}

/** Whether someone is in the department a list is narrowed to: everyone, when it isn't. */
export const inDepartment = (department: string | undefined) => (p: { department?: string | null } | undefined) =>
  !department || p?.department?.trim().toLowerCase() === department.trim().toLowerCase()

/** Whether kit is in the department a list is narrowed to, by the stock list's department for it (Home's own reading): all of it, when it isn't. */
export const inKitOf = (department: string | undefined) => {
  const kit = narrower(department).kit
  return (model: { department?: Department } | undefined) => kit(model?.department)
}

/**
 * The line over a narrowed list. On a list of kit, a department whose crew name isn't its stock name says both, "LX
 * (Lighting)", so a head who reads LX on Crew knows it's the Lighting kit (UX sweep, 6 November 2026, move 4).
 */
export function Narrowed({ department, onWiden, kit = false }: { department: string | undefined; onWiden: () => void; kit?: boolean }) {
  if (!department) return null
  const stock = kitOf(department)
  return (
    <p className="hint narrowed">
      Showing {kit ? bothNames(department, stock && DEPARTMENT_LABELS[stock]) : department} only.{' '}
      <button type="button" className="link" onClick={onWiden}>
        Show all departments
      </button>
    </p>
  )
}
