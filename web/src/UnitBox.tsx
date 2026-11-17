import type { ReactNode } from 'react'

/**
 * A number with its unit in the box (€ before it, % or km after), never typed. The unit stays in the field's accessible
 * name, since what's drawn beside the input isn't read out with it.
 */
export function UnitBox({ unit, before, needs, children }: { unit: string; before?: boolean; needs?: boolean; children: ReactNode }) {
  return (
    <span className={`unit-box${before ? ' before' : ''}${needs ? ' needs' : ''}`}>
      {before && (
        <span className="unit" aria-hidden="true">
          {unit}
        </span>
      )}
      {children}
      {!before && (
        <span className="unit" aria-hidden="true">
          {unit}
        </span>
      )}
    </span>
  )
}
