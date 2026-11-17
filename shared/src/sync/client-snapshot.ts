import { ENTITY_NAMES } from '../model.ts'
import type { Change } from '../protocol.ts'
import type { Snapshot, Storage } from './client-types.ts'

/**
 * The device's copy of the server's data: an empty one, one kept in memory
 * for tests, and a change from the server applied to it.
 */

export function emptySnapshot(clientId: string): Snapshot {
  return {
    clientId,
    cursor: 0,
    entities: Object.fromEntries(ENTITY_NAMES.map((n) => [n, {}])) as Snapshot['entities'],
    outbox: [],
    problems: [],
  }
}

export class MemoryStorage implements Storage {
  private snapshot: Snapshot | undefined
  async load() {
    return this.snapshot ? structuredClone(this.snapshot) : undefined
  }
  async save(snapshot: Snapshot, changed?: ReadonlySet<string> | 'all') {
    if (!this.snapshot || !changed || changed === 'all') {
      this.snapshot = structuredClone(snapshot)
      return
    }
    // The tables not changed are as they were kept.
    const { entities, ...rest } = snapshot
    const kept = { ...this.snapshot.entities } as Record<string, unknown>
    for (const name of changed) kept[name] = structuredClone((entities as Record<string, unknown>)[name])
    this.snapshot = { ...structuredClone(rest), entities: kept as Snapshot['entities'] }
  }
}

export function applyChange(state: Snapshot, change: Change) {
  const entity: string = change.entity
  const id: string = change.id
  // A name a plain object treats specially would reach every object, not a table or a row.
  if (entity === '__proto__' || entity === 'constructor' || entity === 'prototype') return
  if (id === '__proto__' || id === 'constructor' || id === 'prototype') return
  const tables = state.entities as Record<string, Record<string, unknown>>
  // A change for an entity this build doesn't know is kept under its name, not
  // dropped: a phone open during a deploy that adds one would otherwise move its
  // cursor past those rows and never see them. The views only read the tables
  // they know, and the next build reads the rest like any other table.
  // Snapshots saved before a module existed have no table for it yet.
  if (!Object.hasOwn(tables, entity)) tables[entity] = {}
  const table = tables[entity]!
  if (change.op === 'delete') delete table[id]
  else table[id] = change.data
}
