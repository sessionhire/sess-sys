import { alreadyHave, type Application, type ApplicationEntities } from '../applications.ts'
import type { Mutation } from '../commands.ts'
import type { CrewView, PersonView } from './crew-view.ts'

/**
 * Applications to join the crew (ADR 0190) as a device sees them: what the server has sent, less any this device has
 * taken on or turned down and not yet heard back about, each with anyone already on the Crew tab by the same email or
 * phone, so nobody is taken on twice.
 */

export interface ApplicationView extends Application {
  /** Their whole name, first and last. */
  name: string
  /** Someone on the Crew tab with the same email or phone, archived too. */
  known: PersonView | undefined
}

export interface ApplicationsView {
  /** Every application waiting, newest first. */
  all: ApplicationView[]
  get(id: string): ApplicationView | undefined
}

type Tables = { [E in keyof ApplicationEntities]: Record<string, ApplicationEntities[E]> }

export function applicationsView(entities: Partial<Tables>, outbox: readonly (Mutation & { appliedSeq?: number })[], cursor: number, crew: CrewView): ApplicationsView {
  const gone = new Set<string>()
  for (const m of outbox) {
    if (m.appliedSeq !== undefined && m.appliedSeq <= cursor) continue
    if (m.name === 'application.take' || m.name === 'application.drop') gone.add((m.args as { id: string }).id)
  }
  // Snapshots saved before applications existed have no table for them.
  const all = Object.values(entities.application ?? {})
    .filter((a) => !gone.has(a.id))
    .map((a) => ({ ...a, name: `${a.firstName} ${a.lastName}`.trim(), known: alreadyHave(a, crew.people) }))
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt) || b.id.localeCompare(a.id))
  const byId = new Map(all.map((a) => [a.id, a]))
  return { all, get: (id) => byId.get(id) }
}
