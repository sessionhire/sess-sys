import { rmsMemberPlan, type Contact, type RmsMember, type RmsMemberKind, type RmsMemberLink, type RmsMemberPlan, type RmsMemberProgress, type RmsMemberRun } from '@sh/shared'
import { faultForLog, type Db, type Queryable } from '../db.ts'
import { RmsRefused, type RmsApi } from './api.ts'

/**
 * Reading Current RMS's organisations, venues and contacts (ADR 0136), for
 * filling clients and venues in. Current RMS lists its members a hundred a
 * request, one kind at a time, each with its primary address, emails,
 * phones and who it's related to; a request a second, so a few thousand
 * contacts take a minute or two. It runs in the background, says how far
 * it's got, and can be stopped; only a read that finishes replaces the copy
 * kept here, so a stopped one leaves the last whole read in place.
 */

type Log = { info(obj: object, msg: string): void; warn(obj: object, msg: string): void }

interface ApiAddress {
  street?: string | null
  postcode?: string | null
  city?: string | null
  county?: string | null
  country_name?: string | null
}
interface ApiRelation {
  relatable_id?: number | null
  relatable_membership_type?: string | null
  related_id?: number | null
  related_membership_type?: string | null
}
interface ApiMember {
  id: number
  name?: string | null
  active?: boolean | null
  membership_type?: string | null
  primary_address?: ApiAddress | null
  emails?: { address?: string | null; email_type_name?: string | null }[] | null
  phones?: { number?: string | null; phone_type_name?: string | null }[] | null
  child_members?: ApiRelation[] | null
  parent_members?: ApiRelation[] | null
}

const PER_PAGE = 100
/** Current RMS's filter for each kind, in the order they're read. */
const KINDS: { kind: RmsMemberKind; filtermode: string }[] = [
  { kind: 'organisation', filtermode: 'organisation' },
  { kind: 'venue', filtermode: 'venue' },
  { kind: 'contact', filtermode: 'contact' },
]

const clean = (s: string | null | undefined, n: number) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/** The address a line each, as on a letter: street (its own lines kept), town, county, postcode, country. */
export function addressLines(a: ApiAddress | null | undefined): string {
  if (!a) return ''
  const street = (a.street ?? '')
    .split(/\r?\n/)
    .map((l) => clean(l, 200))
    .filter(Boolean)
  const rest = [a.city, a.county, a.postcode, a.country_name].map((x) => clean(x, 100)).filter(Boolean)
  const lines: string[] = []
  for (const l of [...street, ...rest]) if (!lines.some((x) => x.toLowerCase() === l.toLowerCase())) lines.push(l)
  return lines.join('\n').slice(0, 500)
}

/** The work one first, else the first. */
const pick = <T extends Record<string, unknown>>(list: T[] | null | undefined, typeKey: keyof T, valueKey: keyof T) => {
  const l = (list ?? []).filter((x) => typeof x[valueKey] === 'string' && (x[valueKey] as string).trim())
  const work = l.find((x) => /work/i.test(String(x[typeKey] ?? '')))
  return clean((work ?? l[0])?.[valueKey] as string | undefined, 200)
}

export function memberOf(m: ApiMember, kind: RmsMemberKind): RmsMember {
  return {
    id: m.id,
    kind,
    name: clean(m.name, 200),
    active: m.active !== false,
    address: addressLines(m.primary_address),
    email: pick(m.emails, 'email_type_name', 'address'),
    phone: pick(m.phones, 'phone_type_name', 'number'),
  }
}

/** Which contacts belong to which organisation or venue, from either side of a relation. */
export function linksOf(m: ApiMember): RmsMemberLink[] {
  const out: RmsMemberLink[] = []
  for (const r of [...(m.child_members ?? []), ...(m.parent_members ?? [])]) {
    if (typeof r.relatable_id !== 'number' || typeof r.related_id !== 'number') continue
    const a = (r.relatable_membership_type ?? '').toLowerCase()
    const b = (r.related_membership_type ?? '').toLowerCase()
    if ((a === 'organisation' || a === 'venue') && b === 'contact') out.push({ parentId: r.relatable_id, contactId: r.related_id })
    else if ((b === 'organisation' || b === 'venue') && a === 'contact') out.push({ parentId: r.related_id, contactId: r.relatable_id })
  }
  return out
}

class Stopped extends Error {}

export class RmsMemberReader {
  private progress: RmsMemberProgress | null = null
  private stopping = false
  /** The read under way, for tests and for closing the server. */
  done: Promise<void> | undefined

  constructor(
    private readonly db: Db,
    private readonly api: RmsApi | undefined,
    private readonly log?: Log
  ) {}

  get configured() {
    return this.api !== undefined
  }

  get running(): RmsMemberProgress | null {
    return this.progress && { ...this.progress }
  }

  async last(): Promise<RmsMemberRun | null> {
    const { rows } = await this.db.reads.query<Record<string, any>>('SELECT started_at, finished_at, members, error, stopped FROM rms_member_reads ORDER BY id DESC LIMIT 1')
    const r = rows[0]
    return r
      ? { startedAt: new Date(r.started_at).toISOString(), finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null, members: r.members, error: r.error, stopped: r.stopped }
      : null
  }

  /** The copy from the last whole read. */
  async kept(): Promise<{ members: RmsMember[]; links: RmsMemberLink[] }> {
    const { rows } = await this.db.reads.query<{ id: number; kind: RmsMemberKind; name: string; active: boolean; address: string; email: string; phone: string }>(
      'SELECT id, kind, name, active, address, email, phone FROM rms_members ORDER BY id'
    )
    const { rows: links } = await this.db.reads.query<{ parent_id: number; contact_id: number }>('SELECT parent_id, contact_id FROM rms_member_links')
    return { members: rows, links: links.map((l) => ({ parentId: l.parent_id, contactId: l.contact_id })) }
  }

  /** Start a read in the background. False when one is already running or there's no key. */
  start(): boolean {
    if (!this.api || this.progress) return false
    this.stopping = false
    this.progress = { stage: 'organisation', done: 0, total: 0, startedAt: new Date().toISOString() }
    this.done = this.run(this.api, this.progress).finally(() => {
      this.progress = null
    })
    return true
  }

  /** Stop after the request in hand; the last whole read stays. */
  stop(): boolean {
    if (!this.progress) return false
    this.stopping = true
    return true
  }

  private async run(api: RmsApi, progress: RmsMemberProgress) {
    const { rows } = await this.db.query<{ id: string }>('INSERT INTO rms_member_reads (started_at) VALUES ($1) RETURNING id', [progress.startedAt])
    const runId = rows[0]!.id
    let read = 0
    let error: string | null = null
    try {
      const members = new Map<number, RmsMember>()
      const links: RmsMemberLink[] = []
      for (const { kind, filtermode } of KINDS) {
        progress.stage = kind
        progress.done = 0
        progress.total = 0
        let got = 0
        for (let page = 1; ; page++) {
          if (this.stopping) throw new Stopped()
          const res = await api.read<{ members?: ApiMember[]; meta?: { total_row_count?: number } }>('/members', {
            page,
            per_page: PER_PAGE,
            filtermode,
            'q[s][]': ['id asc'],
          })
          const list = (res.members ?? []).filter((m) => typeof m.id === 'number')
          for (const m of list) {
            // A member listed under another kind's filter keeps the kind it says it is.
            const own = (m.membership_type ?? '').toLowerCase()
            const k = own === 'organisation' || own === 'venue' || own === 'contact' ? own : kind
            if (!members.has(m.id)) {
              members.set(m.id, memberOf(m, k))
              read++
            }
            links.push(...linksOf(m))
          }
          got += list.length
          progress.done = got
          progress.total = res.meta?.total_row_count ?? got
          if (list.length < PER_PAGE || (res.meta?.total_row_count !== undefined && got >= res.meta.total_row_count) || page >= 200) break
        }
      }

      // A whole read replaces the copy. A contact is kept only when they belong to an organisation or venue: the
      // rest are nobody's contact here, and their details stay in Current RMS.
      const seen = new Set<string>()
      const pairs = links.filter((l) => {
        const k = `${l.parentId}:${l.contactId}`
        if (seen.has(k) || members.get(l.parentId)?.kind === 'contact' || members.get(l.contactId)?.kind !== 'contact' || !members.has(l.parentId)) return false
        seen.add(k)
        return true
      })
      const linked = new Set(pairs.map((l) => l.contactId))
      for (const [id, m] of members) if (m.kind === 'contact' && !linked.has(id)) members.delete(id)
      await this.db.transaction(async (tx) => {
        await tx.query('DELETE FROM rms_member_links')
        await tx.query('DELETE FROM rms_members')
        for (const m of members.values())
          await tx.query('INSERT INTO rms_members (id, kind, name, active, address, email, phone) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
            m.id,
            m.kind,
            m.name,
            m.active,
            m.address,
            m.email,
            m.phone,
          ])
        for (const l of pairs) await tx.query('INSERT INTO rms_member_links (parent_id, contact_id) VALUES ($1, $2)', [l.parentId, l.contactId])
      })
      this.log?.info({ members: read, kept: members.size }, "Read Current RMS's clients and venues")
    } catch (err) {
      if (err instanceof Stopped) error = null
      else {
        error = err instanceof RmsRefused ? err.message : "Something went wrong reading Current RMS's clients and venues; the last whole read is kept."
        this.log?.warn({ err: faultForLog(err) }, "Reading Current RMS's clients and venues failed")
      }
    } finally {
      await this.db
        .query('UPDATE rms_member_reads SET finished_at = now(), members = $2, error = $3, stopped = $4 WHERE id = $1', [runId, read, error, this.stopping])
        .catch(() => {})
    }
  }
}

/**
 * What filling clients and venues in would do now, from the copy kept here and the clients and venues as they are:
 * the same for the card's preview and the fill-in itself. Null before the first whole read.
 */
export async function memberPlan(q: Queryable): Promise<RmsMemberPlan | null> {
  const { rows: members } = await q.query<RmsMember>('SELECT id, kind, name, active, address, email, phone FROM rms_members')
  if (!members.length) return null
  const { rows: links } = await q.query<{ parent_id: number; contact_id: number }>('SELECT parent_id, contact_id FROM rms_member_links')
  const { rows: clients } = await q.query<{ id: string; name: string; address: string; contacts: Contact[] }>('SELECT id, name, address, contacts FROM clients')
  const { rows: venues } = await q.query<{ id: string; name: string; address: string; contact: Contact | null }>('SELECT id, name, address, contact FROM venues')
  const { rows: quoted } = await q.query<{ client: string; venue: string }>('SELECT DISTINCT client, venue FROM rms_opportunities')
  return rmsMemberPlan(
    members,
    links.map((l) => ({ parentId: l.parent_id, contactId: l.contact_id })),
    clients,
    venues,
    { clients: quoted.map((r) => r.client).filter(Boolean), venues: quoted.map((r) => r.venue).filter(Boolean) }
  )
}
