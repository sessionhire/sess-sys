import { NOTICE_ENTITIES, type NoticesPage, type Person } from '@sh/shared'
import { describe, expect, it } from 'vitest'
import { handOffs, readNotices } from '../src/notices.ts'
import { IPHONE, onLink, server, staff, WINDOWS } from './people.ts'

/**
 * Notifications (ADR 0058): what others changed, lately, on what's someone's
 * own, in the history's words, with why it's theirs; never their own changes.
 */

const call = {
  id: 'c1',
  projectId: 'j1',
  phaseId: 'build',
  project: 'Electric Picnic',
  phase: 'Build',
  venue: 'Stradbally Hall',
  role: 'Audio tech',
  start: '2026-10-02',
  end: '2026-10-04',
  callTime: '08:00',
  needed: 2,
  dayRateCents: 25000,
  details: '',
  replyBy: null,
}

async function setUp() {
  const { app, db } = await server()
  const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
  const aoife = await staff(app, db, 'Aoife Byrne', IPHONE, 'phone-a1b2c3')
  const notices = async (who: { cookies: Record<string, string> }, client = ''): Promise<NoticesPage> => {
    const res = await app.inject({ url: `/api/notices${client ? `?client=${client}` : ''}`, cookies: who.cookies })
    expect(res.statusCode).toBe(200)
    return res.json()
  }
  const person = { phone: null, skills: [], dayRateCents: 25000, notes: '' }
  await colly.send('person.upsert', { id: 'aoife', name: 'Aoife Byrne', kind: 'staff', email: 'Aoife@sessionhire.com', ...person })
  await colly.send('person.upsert', { id: 'dara', name: 'Dara Kelly', kind: 'freelancer', email: null, ...person, phone: '+353871234567' })
  await colly.send('project.create', { id: 'j1', name: 'Electric Picnic', clientId: null, venueId: null, status: 'confirmed', notes: '' })
  await colly.send('phase.add', { id: 'build', projectId: 'j1', name: 'Build', start: '2026-10-02', end: '2026-10-04', venueId: null, notes: '' })
  await colly.send('call.create', call)
  return { app, db, colly, aoife, notices }
}

describe('notifications', () => {
  it("tells someone what others changed on what's theirs, and why it's theirs, never their own changes", async () => {
    const { app, colly, aoife, notices } = await setUp()
    // A job Aoife has nothing to do with.
    await colly.send('project.create', { id: 'j2', name: 'Harbour Lights', clientId: null, venueId: null, status: 'enquiry', notes: '' })
    await colly.send('offer.send', { id: 'o1', callId: 'c1', personId: 'aoife', override: false })
    await colly.send('offer.send', { id: 'o2', callId: 'c1', personId: 'dara', override: false })
    const dara = await colly.record<Person>('person', 'dara')
    await onLink(app, `/f/${dara.linkToken}/offers/o2`, { answer: 'accept' })
    await colly.send('project.update', { id: 'j1', name: 'Electric Picnic 2026' })

    const hers = await notices(aoife)
    expect(hers.found).toBe(true)
    expect(hers.readUpTo).toBeNull()
    expect(hers.notices.map((n) => [n.who.name, n.what, n.why, n.about])).toEqual([
      ['Colly Hewson', 'Changed the job Electric Picnic 2026: name to Electric Picnic 2026', 'on', { entity: 'project', id: 'j1' }],
      ['Colly Hewson', 'Offered Audio tech on Electric Picnic 2026 to Aoife Byrne', 'you', { entity: 'offer', id: 'o1' }],
      ['Colly Hewson', expect.stringContaining('Audio tech'), 'on', { entity: 'crewCall', id: 'c1' }],
      ['Colly Hewson', expect.stringContaining('Build'), 'on', { entity: 'phase', id: 'build' }],
      ['Colly Hewson', expect.stringContaining('Electric Picnic'), 'on', { entity: 'project', id: 'j1' }],
      ['Colly Hewson', "Saved Aoife Byrne's details", 'you', { entity: 'person', id: 'aoife' }],
    ])
    // Someone else's offer on her job, and a job she isn't on, aren't hers.
    expect(hers.notices.some((n) => n.what.includes('Dara') || n.what.includes('Harbour'))).toBe(false)

    // Colly made the job and sent the offers: Dara's answer, on her link, comes back to Colly, and none of Colly's own changes do.
    const his = await notices(colly)
    expect(his.found).toBe(false)
    expect(his.notices.map((n) => [n.who.name, n.what, n.why])).toEqual([
      ['Dara Kelly', 'Dara Kelly accepted Audio tech on Electric Picnic 2026', 'sent'],
    ])

    // Her answer, in the app, goes to Colly and not back to her.
    await aoife.send('offer.respond', { id: 'o1', answer: 'accept', days: null, note: '' } as never)
    expect((await notices(colly)).notices[0]).toMatchObject({ who: { name: 'Aoife Byrne' }, why: 'sent' })
    expect((await notices(aoife)).notices.some((n) => n.who.name === 'Aoife Byrne')).toBe(false)
  })

  it('leaves out what someone answered on their own link, which is their own change (UX sweep, 6 November 2026, move 6)', async () => {
    // Proves: Aoife's yes on her own page is hers, so it isn't news to her, as her answer in the app isn't; it goes to Colly, who sent the offer.
    const { app, colly, aoife, notices } = await setUp()
    await colly.send('offer.send', { id: 'o1', callId: 'c1', personId: 'aoife', override: false })
    const token = (await colly.record<Person>('person', 'aoife')).linkToken
    // Hers is a member of staff's page, so it opens for her Google sign-in (ADR 0052).
    const res = await app.inject({
      method: 'POST',
      url: `/f/${token}/offers/o1`,
      cookies: aoife.cookies,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'answer=accept',
    })
    expect(res.statusCode).toBe(303)
    expect((await notices(colly)).notices[0]).toMatchObject({ who: { kind: 'link', name: 'Aoife Byrne' }, what: 'Aoife Byrne accepted Audio tech on Electric Picnic', why: 'sent' })
    const hers = (await notices(aoife)).notices
    expect(hers.find((n) => n.about.id === 'o1')).toMatchObject({ command: 'offer.send', why: 'you' })
    expect(hers.some((n) => n.command === 'offer.respond' || n.who.name === 'Aoife Byrne')).toBe(false)
  })

  it("says what someone else's yes means for an offer of theirs it closed", async () => {
    // Proves: Dara's yes filled the one place left, closing Aoife's open offer with it, and her list says her offer is closed, not only that
    // Dara accepted (audit, 5 November 2026, finding 61).
    const { app, colly, aoife, notices } = await setUp()
    await colly.send('call.update', { id: 'c1', needed: 1 } as never)
    await colly.send('offer.send', { id: 'o1', callId: 'c1', personId: 'aoife', override: false })
    await colly.send('offer.send', { id: 'o2', callId: 'c1', personId: 'dara', override: false })
    const dara = await colly.record<Person>('person', 'dara')
    await onLink(app, `/f/${dara.linkToken}/offers/o2`, { answer: 'accept' })
    const yes = (await notices(aoife)).notices.find((n) => n.who.name === 'Dara Kelly')
    expect(yes).toMatchObject({ why: 'you', forYou: 'Your offer for Audio tech on Electric Picnic is closed: the call filled.' })
    // Nobody else's list says it's theirs.
    expect((await notices(colly)).notices.some((n) => n.forYou)).toBe(false)
  })

  it("tells the heads of a job's departments and the warehouse's that it's confirmed, and the office that its kit went out, once each", async () => {
    // Proves: move 12 of the UX sweep of 6 November 2026: the two hand-offs reach the people whose turn it is, in the app, once per transition per job, never to the one who did it.
    const { app, db, colly, notices } = await setUp()
    const sean = await staff(app, db, 'Sean Walsh', IPHONE, 'phone-5ea4')
    const nora = await staff(app, db, 'Nora Quinn', IPHONE, 'phone-n0ra')
    const liam = await staff(app, db, 'Liam Doyle', IPHONE, 'phone-l1am')
    const person = { phone: null, skills: [], dayRateCents: 25000, notes: '' }
    await colly.send('person.upsert', { id: 'sean', name: 'Seán Walsh', kind: 'staff', email: 'sean@sessionhire.com', ...person, department: 'Audio' } as never)
    await colly.send('person.upsert', { id: 'nora', name: 'Nora Quinn', kind: 'staff', email: 'nora@sessionhire.com', ...person, department: 'Warehouse' } as never)
    await colly.send('person.upsert', { id: 'liam', name: 'Liam Doyle', kind: 'staff', email: 'liam@sessionhire.com', ...person, department: 'Video' } as never)
    for (const id of ['sean', 'nora', 'liam']) expect((await colly.send('person.role', { id, role: 'head' })).status).toBe('applied')
    // An enquiry with an audio call: confirmed, back to quoted, confirmed again.
    await colly.send('project.create', { id: 'j3', name: 'Harbour Lights', clientId: null, venueId: null, status: 'enquiry', notes: '' })
    await colly.send('phase.add', { id: 'show3', projectId: 'j3', name: 'Show', start: '2026-11-09', end: '2026-11-09', venueId: null, notes: '' })
    expect((await colly.send('call.create', { ...call, id: 'c3', projectId: 'j3', phaseId: 'show3', project: 'Harbour Lights', department: 'Audio' } as never)).status).toBe('applied')
    await colly.send('project.update', { id: 'j3', status: 'confirmed' })
    await colly.send('project.update', { id: 'j3', name: 'Harbour Lights Festival' })
    await colly.send('project.update', { id: 'j3', status: 'quoted' })
    await colly.send('project.update', { id: 'j3', status: 'confirmed' })
    const confirmed = (n: { forYou?: string }) => n.forYou?.startsWith('Confirmed: Harbour')
    const seans = (await notices(sean)).notices.filter(confirmed)
    expect(seans.map((n) => [n.forYou, n.why])).toEqual([
      ['Confirmed: Harbour Lights Festival, Mon 9 Nov', 'turn'],
      ['Confirmed: Harbour Lights Festival, Mon 9 Nov', 'turn'],
    ])
    expect((await notices(nora)).notices.filter(confirmed)).toHaveLength(2)
    // Video has nothing on it.
    expect((await notices(liam)).notices.filter(confirmed)).toHaveLength(0)

    // The first kit out, by the warehouse, is the office's news; the second scan isn't, and Nora's own isn't hers.
    const scan = (id: string) => ({ id, projectId: 'j3', direction: 'out', assetId: null, modelId: 'm1', qty: 1, at: '2026-11-08T08:00:00.000Z' })
    await colly.send('person.upsert', { id: 'colly', name: 'Colly Hewson', kind: 'staff', email: 'colly@sessionhire.com', ...person } as never)
    expect((await colly.send('person.role', { id: 'colly', role: 'office' })).status).toBe('applied')
    const rm = await colly.send('model.create', { id: 'm1', name: 'Shure SM58', department: 'audio', category: '', tracking: 'bulk', isCase: false, valueCents: null, notes: '' } as never)
    expect(rm, JSON.stringify(rm)).toMatchObject({ status: 'applied' })
    const r1 = await nora.send('move.record', scan('s1') as never)
    expect(r1, JSON.stringify(r1)).toMatchObject({ status: 'applied' })
    await nora.send('move.record', scan('s2') as never)
    const gone = (await notices(colly)).notices.filter((n) => n.forYou?.startsWith('Gone out'))
    expect(gone.map((n) => n.forYou)).toEqual(['Gone out: Harbour Lights Festival'])
    expect((await notices(nora)).notices.filter((n) => n.forYou?.startsWith('Gone out'))).toHaveLength(0)
  })

  it('keeps how far each person has read, on every device, and never goes back', async () => {
    const { app, colly, aoife, notices } = await setUp()
    await colly.send('offer.send', { id: 'o1', callId: 'c1', personId: 'aoife', override: false })
    const newest = (await notices(aoife)).notices[0]!.arrivedAt
    const read = (upTo: string) => app.inject({ method: 'POST', url: '/api/notices/read', cookies: aoife.cookies, payload: { upTo } })
    expect((await read(newest)).statusCode).toBe(200)
    expect((await notices(aoife)).readUpTo).toBe(newest)
    // A slower device saying it read less leaves it where it was.
    await read('2020-01-01T00:00:00.000Z')
    expect((await notices(aoife)).readUpTo).toBe(newest)
    // Colly's is Colly's own.
    expect((await notices(colly)).readUpTo).toBeNull()
    expect((await read('not a time')).statusCode).toBe(400)
  })

  it("leaves out noting an answer, which is the office's housekeeping", async () => {
    const { colly, aoife, notices } = await setUp()
    await colly.send('offer.send', { id: 'o1', callId: 'c1', personId: 'aoife', override: false })
    await aoife.send('offer.respond', { id: 'o1', answer: 'decline', note: '' } as never)
    await colly.send('offer.seen', { id: 'o1' })
    expect((await notices(aoife)).notices.map((n) => n.command)).not.toContain('offer.seen')
  })

  it('reads changes to the tables the phone is told to look again for, and to no others', () => {
    // Proves: the list of tables a notification can be about, which a phone uses to skip looking after a pull that brought none of them (audit, 20 October 2026, finding 14), is the one the server's query reads: a table added there and not here would be news the phone never looked for.
    const read = new Set([
      ...[...readNotices.toString().matchAll(/SELECT '(\w+)'/g)].map((m) => m[1]),
      ...[...handOffs.toString().matchAll(/c\.entity = '(\w+)'/g)].map((m) => m[1]),
    ])
    expect(read).toEqual(new Set(NOTICE_ENTITIES))
  })
})
