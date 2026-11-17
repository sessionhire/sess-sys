import { activeFilters, optionCounts, sortOf, type ListChoices, type ListFilter, type ListSort } from '@sh/shared'
import { useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon.tsx'

/**
 * Filter and sort on a long list (ADR 0099), the same on every one: under
 * the list's search, a Sort select and a Filter button that opens a select
 * for each filter, each choice with how many it would show. A filter that's
 * on shows itself twice: in the button's count, and as a chip under it that
 * takes it off, with how many of how many are showing and Clear filters. So
 * a list that looks short never hides why.
 *
 * What's chosen is kept for the tab's life, so Back from a job finds the
 * same list (places.ts), and the order is kept on this device too, as a
 * person's way of reading a list rarely changes. Filters aren't kept past
 * the tab: a list opened another day starts whole, rather than missing
 * something nobody remembers narrowing it to.
 */

const kept = new Map<string, ListChoices>()
const openPanels = new Set<string>()
const sortKey = (name: string) => `sh.sort.${name}`

function savedSort(name: string): string {
  try {
    return localStorage.getItem(sortKey(name)) ?? ''
  } catch {
    return ''
  }
}

/**
 * A list's choices, kept for the tab's life under `name`. `start` sets
 * filters as the list opens, such as the department a count on Home asked
 * for, over whatever was kept.
 */
/** Whether this list's choices were made this visit, so a start a screen would give it doesn't undo them. */
export const listChoicesKept = (name: string) => kept.has(name)

export function useListChoices(name: string, start?: Readonly<Record<string, string>>): [ListChoices, (next: ListChoices) => void] {
  const [choices, setChoices] = useState<ListChoices>(() => {
    const was = kept.get(name) ?? { sort: savedSort(name), filters: {} }
    return start ? { ...was, filters: { ...was.filters, ...start } } : was
  })
  const set = (next: ListChoices) => {
    kept.set(name, next)
    if (next.sort !== choices.sort)
      try {
        localStorage.setItem(sortKey(name), next.sort)
      } catch {
        // Kept for the tab's life all the same.
      }
    setChoices(next)
  }
  return [choices, set]
}

export function ListTools<T>({
  name,
  items,
  filters,
  sorts,
  choices,
  onChange,
  shown,
  what,
  lead,
  leadActive = [],
  onClear,
  pills = [],
  total,
  start,
}: {
  /** The list's name, as given to useListChoices. */
  name: string
  /** The list as its search and tabs leave it, before these filters: what the counts count. */
  items: readonly T[]
  filters: readonly ListFilter<T>[]
  sorts: readonly ListSort<T>[]
  choices: ListChoices
  onChange: (next: ListChoices) => void
  /** How many the filters leave; left out where the view isn't a list to count (Board, Calendar, Week, Month). */
  shown?: number
  /** What the list is of, in the plural: "jobs". */
  what: string
  /**
   * The list's own choices that aren't filters here, drawn first in the panel as pills (Colly, 10 November 2026): the Jobs list's
   * when and departments. Each one on is in `leadActive`, to be counted on the button and shown as a chip that takes it off.
   */
  lead?: ReactNode
  leadActive?: readonly { key: string; label: string; off: () => void }[]
  /** Clear filters puts the lead's choices back too. */
  onClear?: () => void
  /** The filters drawn as pills rather than a select: one or two choices that read at a glance, as Mine. */
  pills?: readonly string[]
  /** How many the "of" counts, where the lead narrows before `items`: every job, not only this tab's. */
  total?: number
  /** First on the Sort and Filter row, where a view has no sort: the calendar's Today and arrows, the planner's rows. */
  start?: ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(() => openPanels.has(name))
  const offered = filters.filter((f) => f.options.length > 0)
  const active = activeFilters(offered, choices.filters)
  const sort = sortOf(sorts, choices.sort)
  const setFilter = (key: string, value: string) => onChange({ ...choices, filters: { ...choices.filters, [key]: value } })
  const on = active.length + leadActive.length
  const toggle = () => {
    if (open) openPanels.delete(name)
    else openPanels.add(name)
    setOpen(!open)
  }
  return (
    <div className="list-tools">
      <div className={start ? 'list-tools-row with-start' : 'list-tools-row'}>
        {start}
        {sorts.length > 1 && (
          <label className="list-sort">
            <Icon name="sort" />
            <span>Sort</span>
            {/* Named by its label's word alone, not the word and every order in it. */}
            <select aria-label="Sort" value={sort?.key ?? ''} onChange={(e) => onChange({ ...choices, sort: e.target.value })}>
              {sorts.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {(offered.length > 0 || lead) && (
          <button type="button" className="list-filter-button" aria-expanded={open} aria-controls={`${id}-filters`} onClick={toggle}>
            <Icon name="filter" />
            Filter{on > 0 && ` (${on})`}
          </button>
        )}
      </div>
      {(offered.length > 0 || lead) && (
        <div className="list-filters" id={`${id}-filters`} hidden={!open} role="group" aria-label={`Filter the ${what}`}>
          {lead}
          {/* Pills first, after the lead's, so every choice that's a press is together above the selects. */}
          {[...offered.filter((f) => pills.includes(f.key)), ...offered.filter((f) => !pills.includes(f.key))].map((f) => {
            const { any, counts } = optionCounts(items, offered, choices.filters, f)
            const value = active.find((a) => a.filter.key === f.key)?.option.key ?? ''
            if (pills.includes(f.key))
              return (
                <PillGroup key={f.key} label={f.label}>
                  {f.options.map((o) => (
                    <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => setFilter(f.key, value === o.key ? '' : o.key)}>
                      {o.label} ({(counts.get(o.key) ?? 0).toLocaleString('en-IE')})
                    </button>
                  ))}
                </PillGroup>
              )
            return (
              <label key={f.key}>
                {f.label}
                <select aria-label={f.label} value={value} onChange={(e) => setFilter(f.key, e.target.value)}>
                  <option value="">
                    {f.any} ({any.toLocaleString('en-IE')})
                  </option>
                  {f.options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label} ({(counts.get(o.key) ?? 0).toLocaleString('en-IE')})
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
        </div>
      )}
      {/* Read out as it changes: the list under it is shorter or longer than it was. */}
      <div aria-live="polite">
        {on > 0 && (
          <div className="list-active">
            {leadActive.map((a) => (
              <button key={a.key} type="button" className="list-chip" onClick={a.off} aria-label={`Take off the filter ${a.label}`}>
                {a.label}
                <Icon name="close" />
              </button>
            ))}
            {active.map(({ filter, option }) => (
              <button key={filter.key} type="button" className="list-chip" onClick={() => setFilter(filter.key, '')} aria-label={`Take off the filter ${filter.label}: ${option.label}`}>
                {option.label}
                <Icon name="close" />
              </button>
            ))}
            {shown !== undefined && (
              <span className="list-count">
                {shown.toLocaleString('en-IE')} of {(total ?? items.length).toLocaleString('en-IE')} {what}.
              </span>
            )}
            <button type="button" className="link" onClick={() => {
                onClear?.()
                onChange({ ...choices, filters: {} })
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The same Filter on a view of a list that isn't the list (Jobs' Board, Calendar, Week and Month; Colly, 10 November 2026): the
 * button at the right of its row, the view's own choices as pills in its panel, and each one on as a chip above the view. No sort,
 * as each orders itself by time or stage.
 */
export function ViewFilter({
  name,
  what,
  pills,
  active,
  onClear,
  start,
}: {
  name: string
  what: string
  /** Left out where the view has nothing to filter just now, and Filter with it. */
  pills?: ReactNode
  active: readonly { key: string; label: string; off: () => void }[]
  onClear: () => void
  start?: ReactNode
}) {
  return <ListTools name={name} items={[]} filters={[]} sorts={[]} choices={NO_CHOICES} onChange={() => {}} what={what} lead={pills} leadActive={active} onClear={onClear} start={start} />
}
const NO_CHOICES: ListChoices = { sort: '', filters: {} }

/** A row of pills in the filter panel, under its name: a few choices pressed on and off, as many as wanted. */
export function PillGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pill-group">
      <span className="pill-label" aria-hidden="true">
        {label}
      </span>
      <div className="pills" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  )
}
