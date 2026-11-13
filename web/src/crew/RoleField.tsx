import { plural, rolesInUse, type RoleInUse } from '@sh/shared'
import { useMemo } from 'react'
import { NameField } from '../NameField.tsx'
import { useView } from '../view.ts'

/** Offered with nothing typed: the most asked for. */
const FIRST = 6

/**
 * The role on a crew call (or on the price list): the design system's
 * combobox with one value, as the client and venue fields are, offering the
 * roles the app already knows (rolesInUse: those calls asked for, the crew
 * list's skills, the price list's), so "LX op" is picked rather than typed
 * again as "Lx Operator". A role that isn't one yet is typed and kept, the
 * last row saying so: a job can need a role nobody has asked for before.
 */
export function RoleField({
  value,
  onChange,
  placeholder,
  label = 'Role',
  className,
  maxLength = 100,
}: {
  value: string
  onChange: (role: string) => void
  placeholder?: string
  label?: string
  className?: string
  maxLength?: number
}) {
  const view = useView()
  const calls = view.crew.calls
  const people = view.crew.people
  const priced = view.money.roles
  const roles = useMemo(() => rolesInUse({ calls, people, priced: priced.map((r) => r.role) }), [calls, people, priced])
  return (
    <NameField<RoleInUse>
      label={label}
      name="role"
      what="role"
      value={value}
      onChange={onChange}
      records={roles}
      first={roles.slice(0, FIRST)}
      firstLabel="Most asked for"
      meta={(f) => roleLine(f.record)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
    />
  )
}

/** The line under an offered role: how often it's been asked for and how many on the crew list do it. */
export function roleLine(r: RoleInUse): string {
  const said = [r.calls ? `Asked for ${plural(r.calls, 'time')}` : '', r.people ? `${plural(r.people, 'person', 'people')} on the crew list` : '']
  return said.filter(Boolean).join(' · ') || (r.priced ? 'On the price list' : '')
}
