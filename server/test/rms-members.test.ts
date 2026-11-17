import { memberKey, rmsMemberPlan, type Client, type CommandInput, type CommandName, type HistoryPage, type RmsMembersStatus, type Venue } from '@sh/shared'
import { describe, expect, it } from 'vitest'
import { addressLines, linksOf } from '../src/rms/members.ts'
import { IPHONE, server, staff } from './people.ts'

/**
 * Clients and venues from Current RMS (ADR 0136). Nothing here reaches the
 * real Current RMS: a stand-in answers as its documentation says, members a
 * hundred a page, one kind at a time. A read keeps organisations, venues and
 * the contacts that belong to them; the card's plan says what filling in
 * would do; the fill-in fills gaps only, adds those on Current RMS's quotes
 * only when ticked, and is in History.
 */

interface Asked {
  method: string
  path: string
  query: URLSearchParams
}

const rel = (orgId: number, orgType: string, contactId: number) => ({
  relatable_id: orgId,
  relatable_type: 'Member',
  related_id: contactId,
  related_type: 'Member',
  relatable_membership_type: orgType,
  related_membership_type: 'Contact',
})

const address = (street: string, city: string, postcode = '') => ({ street, city, county: 'Dublin', postcode, country_name: 'Ireland' })

function fakeRms() {
  const asked: Asked[] = []
  const members: Record<string, object[]> = {
    organisation: [
      // Here already, with no address and one of its two contacts.
      { id: 11, name: 'Aiken Promotions Ltd', membership_type: 'Organisation', primary_address: address('Unit 4, Docklands', 'Dublin 1', 'D01 X2Y3'), child_members: [rel(11, 'Organisation', 31), rel(11, 'Organisation', 32)] },
      // Here with an address of its own, kept.
      { id: 12, name: 'MCD', membership_type: 'Organisation', primary_address: address('1 Somewhere', 'Dublin 2') },
      // Not here, on a quote: offered.
      { id: 13, name: 'Wexford Arts Centre', membership_type: 'Organisation', primary_address: address('Cornmarket', 'Wexford'), child_members: [rel(13, 'Organisation', 33)] },
      // Not here, never quoted: left out.
      { id: 14, name: 'Once Off Wedding', membership_type: 'Organisation' },
    ],
    venue: [
      // Here, with no contact: gets one.
      { id: 21, name: 'The 3Arena', membership_type: 'Venue', primary_address: address('North Wall Quay', 'Dublin 1'), child_members: [rel(21, 'Venue', 34)] },
      // Not here, on a quote: offered.
      { id: 22, name: 'Vicar Street', membership_type: 'Venue', primary_address: address('58-59 Thomas St', 'Dublin 8') },
    ],
    contact: [
      { id: 31, name: 'Peter Aiken', membership_type: 'Contact', emails: [{ address: 'peter@aiken.ie', email_type_name: 'Work' }], phones: [{ number: '+353 1 555 0101', phone_type_name: 'Work' }], parent_members: [rel(11, 'Organisation', 31)] },
      { id: 32, name: 'Accounts', membership_type: 'Contact', emails: [{ address: 'not an email', email_type_name: 'Work' }], parent_members: [rel(11, 'Organisation', 32)] },
      { id: 33, name: 'Box office', membership_type: 'Contact', phones: [{ number: '053 912 3764', phone_type_name: 'Work' }] },
      { id: 34, name: 'Production office', membership_type: 'Contact', emails: [{ address: 'production@3arena.ie' }] },
      // Nobody's contact: not kept.
      { id: 35, name: 'A stranger', membership_type: 'Contact', emails: [{ address: 'stranger@example.com' }] },
    ],
  }
  const fetch = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname.replace('/api/v1', '')
    asked.push({ method: init?.method ?? 'GET', path, query: url.searchParams })
    if (path === '/members') {
      const list = members[url.searchParams.get('filtermode') ?? ''] ?? []
      const page = Number(url.searchParams.get('page'))
      const per = Number(url.searchParams.get('per_page'))
      return Response.json({ members: list.slice((page - 1) * per, page * per), meta: { total_row_count: list.length } })
    }
    return new Response('{}', { status: 404 })
  }) as typeof globalThis.fetch
  return { fetch, asked }
}

const noWait = { gapMs: 0, sleep: async () => {} }

type Cmd = { [N in CommandName]: [N, CommandInput<N>] }[CommandName]

async function office(withRms = true) {
  const rms = fakeRms()
  const { app, db } = await server(withRms ? { currentRms: { subdomain: 'sessionhire', apiKey: 'key-123', fetch: rms.fetch, ...noWait } } : {})
  const colly = await staff(app, db, 'Colly Hewson', IPHONE, 'phone-c0ffee')
  const get = async <T>(url: string) => {
    const res = await app.inject({ url, cookies: colly.cookies })
    expect(res.statusCode).toBe(200)
    return res.json() as T
  }
  const post = (url: string) => app.inject({ method: 'POST', url, cookies: colly.cookies })
  const send = async (...cmds: Cmd[]) => {
    for (const [name, args] of cmds) expect((await colly.send(name, args)).status).toBe('applied')
  }
  const pulled = async () => {
    const changes = (await get<{ changes: { entity: string; id: string; data: unknown }[] }>('/api/sync/pull?after=0')).changes
    const clients: Record<string, Client> = {}
    const venues: Record<string, Venue> = {}
    for (const c of changes) {
      if (c.entity === 'client') clients[c.id] = c.data as Client
      if (c.entity === 'venue') venues[c.id] = c.data as Venue
    }
    return { clients, venues }
  }
  // Current RMS's quotes, as the quote read keeps them: who and where only.
  const quoted = async (rows: [number, string, string][]) => {
    for (const [id, client, venue] of rows) await db.query('INSERT INTO rms_opportunities (id, client, venue) VALUES ($1, $2, $3)', [id, client, venue])
  }
  return { app, rms, get, post, send, pulled, quoted, colly }
}

const client = (id: string, name: string, more: Partial<Client> = {}): Cmd => ['client.upsert', { id, name, contacts: [], notes: '', ...more }]
const venue = (id: string, name: string, more: Partial<Venue> = {}): Cmd => ['venue.upsert', { id, name, address: '', notes: '', ...more }]

describe('clients and venues from Current RMS', () => {
  it('says nothing to do without a key, and turns a read down', async () => {
    const { get, post } = await office(false)
    expect(await get<RmsMembersStatus>('/api/rms/members')).toMatchObject({ configured: false, running: null, last: null, plan: null })
    expect((await post('/api/rms/members/read')).statusCode).toBe(409)
  })

  it('reads organisations, venues and their contacts, only ever asking', async () => {
    const { app, rms, get, post } = await office()
    expect((await post('/api/rms/members/read')).statusCode).toBe(202)
    await app.rmsMembers.done
    expect(rms.asked.every((a) => a.method === 'GET')).toBe(true)
    expect(rms.asked.map((a) => a.query.get('filtermode'))).toEqual(['organisation', 'venue', 'contact'])
    const status = await get<RmsMembersStatus>('/api/rms/members')
    // The stranger belongs to nobody, so isn't kept.
    expect(status).toMatchObject({ configured: true, running: null, counts: { organisations: 4, venues: 2, contacts: 4 }, last: { error: null, stopped: false } })
  })

  it('fills gaps only, adds those on its quotes when ticked, and says so in History', async () => {
    const { app, get, post, send, pulled, quoted } = await office()
    await send(
      client('aiken', 'Aiken Promotions', { contacts: [{ name: 'Peter Aiken', role: 'Promoter', email: null, phone: null }] }),
      client('mcd', 'MCD', { address: 'MCD House\nDublin' }),
      venue('3arena', '3Arena'),
      venue('olympia', 'Olympia Theatre', { address: '72 Dame St' })
    )
    await quoted([
      [901, 'Wexford Arts Centre', 'Vicar Street'],
      [902, 'Aiken Promotions Ltd', 'The 3Arena'],
    ])
    await post('/api/rms/members/read')
    await app.rmsMembers.done

    const { plan } = await get<RmsMembersStatus>('/api/rms/members')
    // Aiken: the address and only the contact it hasn't got, its bad email left off.
    expect(plan!.clients.fill).toEqual([
      {
        id: 'aiken',
        name: 'Aiken Promotions',
        rmsId: 11,
        address: 'Unit 4, Docklands\nDublin 1\nDublin\nD01 X2Y3\nIreland',
        contacts: [{ name: 'Accounts', role: '', email: null, phone: null }],
      },
    ])
    expect(plan!.clients.same).toBe(1)
    expect(plan!.clients.add.map((a) => a.name)).toEqual(['Wexford Arts Centre'])
    expect(plan!.clients.add[0]!.contacts).toEqual([{ name: 'Box office', role: '', email: null, phone: '053 912 3764' }])
    expect(plan!.clients.neverQuoted).toBe(1)
    // "The 3Arena" is "3Arena" here: an address and its contact.
    expect(plan!.venues.fill).toMatchObject([{ id: '3arena', address: 'North Wall Quay\nDublin 1\nDublin\nIreland', contacts: [{ name: 'Production office', email: 'production@3arena.ie' }] }])
    expect(plan!.venues.add.map((a) => a.name)).toEqual(['Vicar Street'])

    await send(['rms.fillMembers', { add: false }])
    let now = await pulled()
    expect(now.clients.aiken!.contacts.map((c) => c.name)).toEqual(['Peter Aiken', 'Accounts'])
    expect(now.clients.aiken!.address).toContain('Docklands')
    // Set here, kept.
    expect(now.clients.mcd!.address).toBe('MCD House\nDublin')
    expect(now.venues['3arena']!.contact).toMatchObject({ name: 'Production office' })
    expect(now.venues.olympia!.address).toBe('72 Dame St')
    expect(now.clients['rms-client-13']).toBeUndefined()

    const again = (await get<RmsMembersStatus>('/api/rms/members')).plan!
    expect(again.clients.fill).toEqual([])
    expect(again.venues.fill).toEqual([])

    await send(['rms.fillMembers', { add: true }])
    now = await pulled()
    expect(now.clients['rms-client-13']).toMatchObject({ name: 'Wexford Arts Centre', address: 'Cornmarket\nWexford\nDublin\nIreland' })
    expect(now.venues['rms-venue-22']).toMatchObject({ name: 'Vicar Street', address: '58-59 Thomas St\nDublin 8\nDublin\nIreland' })
    expect((await get<RmsMembersStatus>('/api/rms/members')).plan!.clients.add).toEqual([])

    const history: HistoryPage = await get('/api/history?limit=20')
    expect(history.entries.filter((e) => e.command === 'rms.fillMembers').map((e) => e.what)).toEqual([
      'Filled in clients and venues from Current RMS, and added the ones on its quotes',
      'Filled in clients and venues from Current RMS',
    ])
  })

  it('turns a fill-in down before they have been read', async () => {
    const { colly } = await office()
    expect(await colly.send('rms.fillMembers', { add: false })).toMatchObject({ status: 'rejected' })
  })
})

describe('reading a member', () => {
  it('writes the address a line each, without repeats', () => {
    expect(addressLines({ street: '1 Main St\r\nSwords', city: 'Swords', county: 'Dublin', postcode: 'K67 A1B2', country_name: 'Ireland' })).toBe('1 Main St\nSwords\nDublin\nK67 A1B2\nIreland')
    expect(addressLines(null)).toBe('')
  })

  it('takes contacts from either side of a relation', () => {
    expect(linksOf({ id: 31, parent_members: [rel(11, 'Organisation', 31)], child_members: [{ ...rel(11, 'Organisation', 31), relatable_membership_type: 'Contact', related_membership_type: 'Organisation', relatable_id: 31, related_id: 11 }] })).toEqual([
      { parentId: 11, contactId: 31 },
      { parentId: 11, contactId: 31 },
    ])
  })

  it('matches names however they are written', () => {
    expect(memberKey('The 3Arena')).toBe(memberKey('3arena'))
    expect(memberKey('Aiken Promotions Ltd.')).toBe(memberKey('aiken promotions'))
    expect(memberKey('Smith & Sons')).toBe(memberKey('Smith and Sons'))
    const plan = rmsMemberPlan([{ id: 1, kind: 'organisation', name: 'X', active: false, address: '', email: '', phone: '' }], [], [], [], { clients: ['X'], venues: [] })
    // An inactive one isn't offered.
    expect(plan.clients.add).toEqual([])
  })
})
