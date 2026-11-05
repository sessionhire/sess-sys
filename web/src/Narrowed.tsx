import { useState } from 'react'
import type { Department } from '@sh/shared'
import { arrival } from './arrival.ts'
import { narrower } from './home/standing.ts'
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
 * A list a count on Home opened for one department (audit, 20 October
 * 2026, finding 4) starts narrowed to it, so it shows what was counted, and
 * says so with the way to the rest. Opened any other way, it starts on
 * `start`, a head's own department (audit, 5 November 2026, finding 6), or
 * shows them all.
 */
export function useNarrowed(hash: string, start?: string): [department: string | undefined, widen: () => void] {
  const [arrived] = useState(() => arrival(hash)?.department)
  // The start is read as it's known: a head's department can come with the first copy, after the screen first drew.
  const [wide, setWide] = useState(false)
  return [wide ? undefined : (arrived ?? (start || undefined)), () => setWide(true)]
}

/** Whether someone is in the department a list is narrowed to: everyone, when it isn't. */
export const inDepartment = (department: string | undefined) => (p: { department?: string | null } | undefined) =>
  !department || p?.department?.trim().toLowerCase() === department.trim().toLowerCase()

/** Whether kit is in the department a list is narrowed to, by the stock list's department for it (Home's own reading): all of it, when it isn't. */
export const inKitOf = (department: string | undefined) => {
  const kit = narrower(department).kit
  return (model: { department?: Department } | undefined) => kit(model?.department)
}

export function Narrowed({ department, onWiden }: { department: string | undefined; onWiden: () => void }) {
  if (!department) return null
  return (
    <p className="hint narrowed">
      Showing {department} only.{' '}
      <button type="button" className="link" onClick={onWiden}>
        Show all departments
      </button>
    </p>
  )
}
