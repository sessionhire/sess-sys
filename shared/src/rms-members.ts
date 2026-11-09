import { contact as contactSchema, type Contact } from './jobs.ts'

/**
 * Clients and venues from Current RMS (ADR 0136). The server reads Current
 * RMS's organisations, venues and contacts and keeps a copy; this works out,
 * from that copy and the clients and venues here, what filling them in would
 * change, so the office sees it before anything changes and the server does
 * exactly what was shown.
 *
 * A client or venue here is matched to Current RMS's by its name. Filling in
 * only ever fills a gap: an address where there's none, a contact who isn't
 * on the client yet, a contact for a venue with none. Nothing typed here is
 * changed. Clients and venues not here yet are added only when ticked, and
 * only those that have been on a Current RMS quote, so years of one-off
 * names don't flood the lists.
 */

export type RmsMemberKind = 'organisation' | 'venue' | 'contact'

/** A member as Current RMS keeps it, from the last read. */
export interface RmsMember {
  id: number
  kind: RmsMemberKind
  name: string
  active: boolean
  /** Its primary address, a line each. */
  address: string
  email: string
  phone: string
}

/** A contact belonging to an organisation or a venue in Current RMS. */
export interface RmsMemberLink {
  parentId: number
  contactId: number
}

export interface ClientHere {
  id: string
  name: string
  address: string
  contacts: readonly Contact[]
}

export interface VenueHere {
  id: string
  name: string
  address: string
  contact: Contact | null
}

export interface RmsMemberFill {
  /** The client or venue here. */
  id: string
  name: string
  rmsId: number
  /** The address to put in, where there's none here. */
  address?: string
  /** Contacts to add: those not on the client yet, or the venue's one where it has none. */
  contacts: Contact[]
}

export interface RmsMemberAdd {
  rmsId: number
  name: string
  address: string
  contacts: Contact[]
}

export interface RmsMemberSide {
  /** Matched by name, with something here to fill in. */
  fill: RmsMemberFill[]
  /** In Current RMS and on one of its quotes, not here yet: added only when ticked. */
  add: RmsMemberAdd[]
  /** Matched, with nothing to fill in. */
  same: number
  /** In Current RMS, not here, and never on one of its quotes: left out. */
  neverQuoted: number
}

export interface RmsMemberPlan {
  clients: RmsMemberSide
  venues: RmsMemberSide
}

/** The same name however it's spaced, cased or punctuated, without "Ltd" and the like. */
export const memberKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\b(ltd|limited|dac|teo|plc|llc|inc)\b/g, ' ')
    .replace(/^the\b/, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** A Current RMS contact as a contact here, its email or phone left off where they don't pass as one. */
export function contactOf(m: RmsMember, role = ''): Contact | null {
  const phone = m.phone.replace(/[^0-9+ ()-]/g, '').trim()
  const tries: Contact[] = [
    { name: m.name.trim().slice(0, 200), role, email: m.email.trim() || null, phone: phone || null },
    { name: m.name.trim().slice(0, 200), role, email: m.email.trim() || null, phone: null },
    { name: m.name.trim().slice(0, 200), role, email: null, phone: phone || null },
    { name: m.name.trim().slice(0, 200), role, email: null, phone: null },
  ]
  for (const t of tries) {
    const ok = contactSchema.safeParse(t)
    if (ok.success) return ok.data
  }
  return null
}

const MAX_CONTACTS = 20

const sameContact = (a: Contact, b: Contact) =>
  (!!a.email && !!b.email && a.email.toLowerCase() === b.email.toLowerCase()) || memberKey(a.name) === memberKey(b.name)

/** What filling in from Current RMS would do, to the clients and venues as they are now. */
export function rmsMemberPlan(
  members: readonly RmsMember[],
  links: readonly RmsMemberLink[],
  clients: readonly ClientHere[],
  venues: readonly VenueHere[],
  /** The client and venue names on Current RMS's quotes. */
  quoted: { clients: readonly string[]; venues: readonly string[] }
): RmsMemberPlan {
  const byId = new Map(members.map((m) => [m.id, m]))
  const contactsOf = (id: number) =>
    links
      .filter((l) => l.parentId === id)
      .map((l) => byId.get(l.contactId))
      .filter((c): c is RmsMember => !!c && c.kind === 'contact')
      .sort((a, b) => Number(b.active) - Number(a.active) || a.id - b.id)
      .map((c) => contactOf(c))
      .filter((c): c is Contact => !!c)

  const side = <H extends { id: string; name: string; address: string }>(
    kind: 'organisation' | 'venue',
    here: readonly H[],
    quotedNames: readonly string[],
    toAdd: (have: H, offered: Contact[]) => Contact[]
  ): RmsMemberSide => {
    const out: RmsMemberSide = { fill: [], add: [], same: 0, neverQuoted: 0 }
    const hereByKey = new Map<string, H>()
    for (const h of here) if (!hereByKey.has(memberKey(h.name))) hereByKey.set(memberKey(h.name), h)
    const onQuote = new Set(quotedNames.map(memberKey))
    // One Current RMS member to a name: the active one first, then the oldest.
    const theirs = new Map<string, RmsMember>()
    for (const m of [...members].filter((x) => x.kind === kind).sort((a, b) => Number(b.active) - Number(a.active) || a.id - b.id)) {
      const k = memberKey(m.name)
      if (k && !theirs.has(k)) theirs.set(k, m)
    }
    for (const [k, m] of theirs) {
      const h = hereByKey.get(k)
      const offered = contactsOf(m.id)
      if (h) {
        const address = !h.address.trim() && m.address.trim() ? m.address.trim().slice(0, 500) : undefined
        const contacts = toAdd(h, offered)
        if (address || contacts.length) out.fill.push({ id: h.id, name: h.name, rmsId: m.id, ...(address ? { address } : {}), contacts })
        else out.same++
      } else if (m.active && onQuote.has(k)) out.add.push({ rmsId: m.id, name: m.name.trim().slice(0, 200), address: m.address.trim().slice(0, 500), contacts: offered.slice(0, kind === 'venue' ? 1 : MAX_CONTACTS) })
      else out.neverQuoted++
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
    out.fill.sort(byName)
    out.add.sort(byName)
    return out
  }

  return {
    clients: side('organisation', clients, quoted.clients, (c, offered) => {
      const have = [...c.contacts]
      const added: Contact[] = []
      for (const o of offered) {
        if (have.length >= MAX_CONTACTS) break
        if (have.some((x) => sameContact(x, o))) continue
        have.push(o)
        added.push(o)
      }
      return added
    }),
    venues: side('venue', venues, quoted.venues, (v, offered) => (v.contact || !offered[0] ? [] : [offered[0]])),
  }
}

/** How many clients and venues a fill-in changes. */
export const rmsMemberWrites = (plan: RmsMemberPlan, add: boolean) =>
  plan.clients.fill.length + plan.venues.fill.length + (add ? plan.clients.add.length + plan.venues.add.length : 0)

/** Where reading Current RMS's clients and venues has got to. */
export interface RmsMemberProgress {
  stage: RmsMemberKind
  done: number
  total: number
  startedAt: string
}

export interface RmsMemberRun {
  startedAt: string
  finishedAt: string | null
  /** Members read. */
  members: number
  error: string | null
  stopped: boolean
}

/** Clients and venues from Current RMS, on Admin: whether it can be read, how far a read has got, and what filling in would do. */
export interface RmsMembersStatus {
  configured: boolean
  running: RmsMemberProgress | null
  last: RmsMemberRun | null
  /** Organisations, venues and contacts kept from the last whole read. */
  counts: { organisations: number; venues: number; contacts: number }
  /** Null until they have been read once. */
  plan: RmsMemberPlan | null
}
