import type { CommandArgs, Mutation } from '../commands.ts'
import { byWhen, jobSpan, type Client, type JobEntities, type Phase, type Project, type Venue } from '../jobs.ts'
import { joinedPhaseName, tailOf } from '../tidy.ts'
import type { CallView, OfferView } from './crew-view.ts'

/**
 * The Jobs tab's view of a device's data: what the server has said, with
 * this person's own waiting changes laid over it, as for bookings and crew.
 */

export interface ClientView extends Client {
  pending: boolean
}
export interface VenueView extends Venue {
  pending: boolean
}
export interface PhaseView extends Phase {
  pending: boolean
  /** Its own venue, or else the job's. */
  venue: Venue | undefined
  /** Crew calls for this phase. */
  calls: CallView[]
}
export interface JobView extends Project {
  pending: boolean
  client: Client | undefined
  venue: Venue | undefined
  /** In the order they happen. */
  phases: PhaseView[]
  /** The first to the last day of its phases; undefined while it has none. */
  span: { start: string; end: string } | undefined
  /** Every crew call that is part of the job. */
  calls: CallView[]
  /** The job's calls that aren't for one of its phases. */
  otherCalls: CallView[]
}

export interface JobsView {
  /** Jobs with no dates yet first, so they aren't forgotten, then by first day. */
  jobs: JobView[]
  clients: ClientView[]
  venues: VenueView[]
}

type Tables = { [E in keyof JobEntities]: Record<string, JobEntities[E]> }

/** Copy only the fields a change names; the rest stay as they are. */
function patch<T extends object>(target: T, changes: object): T {
  const out = { ...target }
  for (const [k, v] of Object.entries(changes)) if (k !== 'id' && v !== undefined) (out as Record<string, unknown>)[k] = v
  return out
}

export function jobsView(
  entities: Partial<Tables>,
  outbox: readonly (Mutation & { appliedSeq?: number })[],
  cursor: number,
  calls: readonly CallView[]
): JobsView {
  const clients = new Map<string, ClientView>()
  for (const c of Object.values(entities.client ?? {})) clients.set(c.id, { ...c, pending: false })
  const venues = new Map<string, VenueView>()
  for (const v of Object.values(entities.venue ?? {})) venues.set(v.id, { ...v, pending: false })
  const projects = new Map<string, Project & { pending: boolean }>()
  for (const p of Object.values(entities.project ?? {})) projects.set(p.id, { ...p, pending: false })
  const phases = new Map<string, Phase & { pending: boolean }>()
  for (const p of Object.values(entities.phase ?? {})) phases.set(p.id, { ...p, pending: false })

  /** Jobs made part of another, waiting to be sent: their phases and calls show under it. */
  const joined = new Map<string, string>()
  for (const m of outbox) {
    if (m.appliedSeq !== undefined && m.appliedSeq <= cursor) continue
    switch (m.name) {
      case 'client.upsert': {
        const a = m.args as CommandArgs<'client.upsert'>
        // A save that doesn't say the address keeps it, as the server does (ADR 0084).
        const was = clients.get(a.id)
        clients.set(a.id, {
          ...a,
          ...(a.address === undefined && was?.address ? { address: was.address } : {}),
          // And the payment terms (ADR 0119).
          ...(a.paymentTerms === undefined && was?.paymentTerms !== undefined ? { paymentTerms: was.paymentTerms } : {}),
          pending: true,
        })
        break
      }
      case 'venue.upsert': {
        const a = m.args as CommandArgs<'venue.upsert'>
        // Saving the details leaves the pin where it is (ADR 0057).
        // A save that doesn't say the contact keeps it (ADR 0119).
        const was = venues.get(a.id)
        venues.set(a.id, { ...a, ...(a.contact === undefined && was?.contact ? { contact: was.contact } : {}), pin: was?.pin ?? null, pending: true })
        break
      }
      case 'venue.pin': {
        const a = m.args as CommandArgs<'venue.pin'>
        const v = venues.get(a.id)
        if (v) venues.set(a.id, { ...v, pin: a.pin, pending: true })
        break
      }
      case 'project.create': {
        const a = m.args as CommandArgs<'project.create'>
        if (!projects.has(a.id)) projects.set(a.id, { ...a, pending: true })
        break
      }
      case 'project.update': {
        const a = m.args as CommandArgs<'project.update'>
        const p = projects.get(a.id)
        if (p) projects.set(a.id, { ...patch(p, a), pending: true })
        break
      }
      case 'phase.add': {
        const a = m.args as CommandArgs<'phase.add'>
        // The whole shape of a synced phase, so the screens treat it as one: its Change form reads every field.
        if (!phases.has(a.id)) phases.set(a.id, { ...a, contactId: a.contactId ?? null, localCrew: a.localCrew ?? 0, pending: true })
        break
      }
      case 'phase.update': {
        const a = m.args as CommandArgs<'phase.update'>
        const p = phases.get(a.id)
        // Whether to move the crew is an instruction, not a field of the phase.
        if (p) phases.set(a.id, { ...patch(p, { ...a, moveCrew: undefined }), pending: true })
        break
      }
      case 'phase.remove':
        phases.delete((m.args as CommandArgs<'phase.remove'>).id)
        break
      case 'project.merge': {
        // Shown as one straight away, each day named as the server will name it (audit, 20 October 2026, finding 108); the server moves the rest.
        const a = m.args as CommandArgs<'project.merge'>
        const p = projects.get(a.id)
        if (!p) break
        for (const job of [p, ...a.from.map((id) => projects.get(id))]) {
          if (!job) continue
          const tail = tailOf(job.name, a.name)
          for (const ph of phases.values()) {
            if (ph.projectId !== job.id) continue
            const name = joinedPhaseName(ph.name, tail, job.kind)
            if (name !== ph.name) phases.set(ph.id, { ...ph, name, pending: true })
          }
        }
        projects.set(a.id, { ...p, name: a.name, pending: true })
        for (const id of a.from) {
          projects.delete(id)
          joined.set(id, a.id)
        }
        break
      }
    }
  }
  for (const p of phases.values()) {
    const into = joined.get(p.projectId)
    if (into) phases.set(p.id, { ...p, projectId: into, pending: true })
  }

  const callsByJob = new Map<string, CallView[]>()
  for (const c of calls) {
    if (!c.projectId) continue
    const job = joined.get(c.projectId) ?? c.projectId
    const list = callsByJob.get(job) ?? []
    list.push(c)
    callsByJob.set(job, list)
  }
  const phasesByJob = new Map<string, (Phase & { pending: boolean })[]>()
  for (const p of phases.values()) {
    const list = phasesByJob.get(p.projectId) ?? []
    list.push(p)
    phasesByJob.set(p.projectId, list)
  }

  const jobs: JobView[] = [...projects.values()].map((p) => {
    const venue = p.venueId ? venues.get(p.venueId) : undefined
    const own = callsByJob.get(p.id) ?? []
    const phaseViews = (phasesByJob.get(p.id) ?? []).sort(byWhen).map((ph) => ({
      ...ph,
      venue: ph.venueId ? venues.get(ph.venueId) : venue,
      calls: own.filter((c) => c.phaseId === ph.id),
    }))
    const phaseIds = new Set(phaseViews.map((ph) => ph.id))
    return {
      ...p,
      client: p.clientId ? clients.get(p.clientId) : undefined,
      venue,
      phases: phaseViews,
      span: jobSpan(phaseViews),
      calls: own,
      otherCalls: own.filter((c) => !c.phaseId || !phaseIds.has(c.phaseId)),
    }
  })
  // Every order ends on the id, so two devices holding the same data show the same order whatever order it arrived in.
  jobs.sort((a, b) => (a.span ? 1 : 0) - (b.span ? 1 : 0) || (a.span?.start ?? '').localeCompare(b.span?.start ?? '') || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

  const byName = (a: { id: string; name: string }, b: { id: string; name: string }) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  return { jobs, clients: [...clients.values()].sort(byName), venues: [...venues.values()].sort(byName) }
}

/**
 * What booking a job's crew waits on next (ADR 0140, part 5), so the job's Next can do that one thing and its count moves on
 * with each press: a yes to confirm, then a call with places nobody has been offered, then the answers still out. Only open
 * calls; a person counts once a day, as the server counts them.
 */
export interface CrewNext {
  /** The first yes waiting on the office to confirm it. */
  yes?: { call: CallView; offer: OfferView }
  /** The first call with places nobody's been offered: how many, and how many of its places are offered or held already. */
  ask?: { call: CallView; places: number; asked: number }
  /** Someone asking a different rate, which the office settles with the rate in view. */
  counter?: { call: CallView; offer: OfferView }
  /** Offers out without an answer. */
  waiting: number
}

export function crewNext(calls: readonly CallView[]): CrewNext {
  const out: CrewNext = { waiting: 0 }
  for (const c of calls) {
    if (c.status !== 'open') continue
    // A yes holds its place already, so it's found on a call whose places are all held, as "to confirm" counts it.
    for (const o of c.offers) if (o.status === 'accepted' && o.person && !out.yes) out.yes = { call: c, offer: o }
    if (c.openDays.length === 0) continue
    for (const o of c.offers) {
      if (o.status === 'countered' && o.person && !out.counter) out.counter = { call: c, offer: o }
      if (o.status === 'offered') out.waiting++
    }
    if (out.ask) continue
    const asked = Math.min(
      ...c.openDays.map(
        (d) => new Set(c.offers.filter((o) => ['offered', 'countered', 'accepted', 'confirmed'].includes(o.status) && o.days.includes(d)).map((o) => o.personId)).size
      )
    )
    if (asked < c.needed) out.ask = { call: c, places: c.needed - asked, asked }
  }
  return out
}

/**
 * How many of the people a job's open crew calls need are booked (confirmed
 * for every day of the call), and how many more have said yes and wait on
 * the office (accepted for every day). "Booked" means confirmed everywhere
 * in the app, as the call sheet says it.
 */
export function crewFill(calls: readonly CallView[]): { needed: number; booked: number; toConfirm: number } {
  let needed = 0
  let booked = 0
  let toConfirm = 0
  for (const c of calls) {
    if (c.status !== 'open') continue
    needed += c.needed
    const confirmed = Math.min(c.needed, ...c.days.map((d) => c.offers.filter((o) => o.status === 'confirmed' && o.days.includes(d)).length))
    const holding = Math.min(c.needed, ...c.days.map((d) => c.heldByDay[d] ?? 0))
    booked += confirmed
    toConfirm += holding - confirmed
  }
  return { needed, booked, toConfirm }
}
