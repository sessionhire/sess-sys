import { createHmac } from 'node:crypto'
import { newId, type CommandInput, type CommandName, type MutationResult } from '@sh/shared'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { pgliteDb, type Db } from '../src/db.ts'
import type { WhatsAppConfig } from '../src/whatsapp/api.ts'

/**
 * Offers on WhatsApp (ADR 0125): with the office's switch on, an offer goes to its person on WhatsApp by itself as
 * it's made, straight to Meta. Off, which is how it starts, nothing goes; in test mode only the numbers listed get
 * them; and each person can turn them off, and only they can turn them back on. Meta is a stand-in here.
 */

let cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn()
  cleanup = []
})

interface Sent {
  url: string
  body: any
}

/** Meta, as far as the app talks to it: the number's state, and taking a message, or saying no as told. */
function fakeMeta() {
  const sent: Sent[] = []
  let answer: { status: number; error?: string } = { status: 200 }
  const fetch: typeof globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      sent.push({ url: u, body })
      if (answer.status !== 200) return new Response(JSON.stringify({ error: { message: answer.error ?? 'No', code: 131026 } }), { status: answer.status })
      return new Response(JSON.stringify({ messages: [{ id: `wamid.${sent.length}` }] }), { status: 200 })
    }
    return new Response(JSON.stringify({ display_phone_number: '+353 1 555 0100', verified_name: 'Session Hire', quality_rating: 'GREEN', name_status: 'APPROVED' }), { status: 200 })
  }) as typeof globalThis.fetch
  return { fetch, sent, answer: (a: typeof answer) => (answer = a) }
}

async function setUp({ configured = true }: { configured?: boolean } = {}) {
  const db = await pgliteDb()
  const meta = fakeMeta()
  const config: WhatsAppConfig = { token: 't', phoneNumberId: '1234', apiUrl: 'https://meta.test/v23.0', language: 'en_GB', appSecret: 's', verifyToken: 'v', fetch: meta.fetch }
  const app = await buildApp({ db, ...(configured ? { whatsapp: config } : {}) })
  cleanup.push(async () => {
    await app.close()
    await db.close()
  })
  const send = async <N extends CommandName>(name: N, args: CommandInput<N>): Promise<MutationResult> => {
    const res = await app.inject({ method: 'POST', url: '/api/sync/push', payload: { clientId: 'ops-laptop', mutations: [{ id: newId(), name, args, createdAt: new Date().toISOString() }] } })
    // What the push queued goes now: wait for it, as the office never has to.
    await app.whatsappSender.kick()
    return res.json().results[0]
  }
  const person = async (name: string, phone: string | null) => {
    const id = newId()
    expect(await send('person.upsert', { id, name, kind: 'freelancer', email: null, phone, skills: [], dayRateCents: 25000, notes: '' })).toMatchObject({ status: 'applied' })
    return id
  }
  const call = async () => {
    const id = newId()
    const at = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
    expect(
      await send('call.create', { id, project: 'Electric Picnic', phase: 'Build', venue: 'Stradbally Hall', role: 'Audio tech', start: at, end: at, callTime: '08:00', needed: 2, dayRateCents: 25000, details: '', replyBy: null })
    ).toMatchObject({ status: 'applied' })
    return id
  }
  const offer = async (callId: string, personId: string) => {
    const id = newId()
    expect(await send('offer.send', { id, callId, personId, override: false })).toMatchObject({ status: 'applied' })
    return id
  }
  const messages = async () =>
    (await db.query<{ offer_id: string; to_number: string; state: string; wamid: string | null; problem: string | null; tries: number }>(`SELECT offer_id, to_number, state, wamid, problem, tries FROM whatsapp_messages ORDER BY made_at`)).rows
  const token = async (id: string) => (await db.query<{ link_token: string }>('SELECT link_token FROM people WHERE id = $1', [id])).rows[0]!.link_token
  return { app, db, meta, send, person, call, offer, messages, token }
}

const page = async (app: FastifyInstance, token: string) => (await app.inject({ url: `/f/${token}` })).body
const post = (app: FastifyInstance, url: string, fields: Record<string, string>) =>
  app.inject({ method: 'POST', url, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams(fields).toString() })

describe('offers on WhatsApp (ADR 0125)', () => {
  it('sends nothing while the switch is off, as it starts, and says nothing about WhatsApp on their page', async () => {
    const { app, meta, person, call, offer, messages, token } = await setUp()
    const aoife = await person('Aoife Byrne', '087 123 4567')
    await offer(await call(), aoife)
    expect(await messages()).toEqual([])
    expect(meta.sent).toEqual([])
    expect(await page(app, await token(aoife))).not.toContain('Offers on WhatsApp')
  })

  it('in test mode sends only to the numbers listed, with the job in the blanks and the offer in the buttons', async () => {
    const { app, meta, send, person, call, offer, messages, token } = await setUp()
    const aoife = await person('Aoife Byrne', '087 123 4567')
    const dara = await person('Dara Kelly', '+353 86 765 4321')
    expect(await send('whatsapp.use', { mode: 'test', testTo: ['+353871234567'] })).toMatchObject({ status: 'applied' })
    const c = await call()
    const toAoife = await offer(c, aoife)
    await offer(c, dara)
    expect(await messages()).toEqual([expect.objectContaining({ offer_id: toAoife, to_number: '353871234567', state: 'sent', wamid: 'wamid.1' })])
    const body = meta.sent[0]!.body
    expect(meta.sent[0]!.url).toBe('https://meta.test/v23.0/1234/messages')
    expect(body).toMatchObject({ to: '353871234567', type: 'template', template: { name: 'job_offer', language: { code: 'en_GB' } } })
    const blanks = body.template.components[0].parameters.map((p: { text: string }) => p.text)
    expect(blanks.slice(0, 3)).toEqual(['Aoife', 'Electric Picnic (Build)', 'Audio tech'])
    expect(blanks).toContain('€250 a day')
    expect(blanks.every((t: string) => t.length > 0 && !t.includes('\n'))).toBe(true)
    expect(body.template.components.slice(1)).toEqual([
      { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `yes:${toAoife}` }] },
      { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: `no:${toAoife}` }] },
      { type: 'button', sub_type: 'url', index: '2', parameters: [{ type: 'text', text: await token(aoife) }] },
    ])
    // Only the number being tried sees it on their page.
    expect(await page(app, await token(aoife))).toContain('Offers on WhatsApp')
    expect(await page(app, await token(dara))).not.toContain('Offers on WhatsApp')
  })

  it('is theirs to turn off on their page, and only theirs to turn back on', async () => {
    const { app, meta, send, person, call, offer, messages, token } = await setUp()
    const aoife = await person('Aoife Byrne', '087 123 4567')
    await send('whatsapp.use', { mode: 'on', testTo: [] })
    const link = await token(aoife)
    expect(await page(app, link)).toContain('Stop offers on WhatsApp')
    const off = await post(app, `/f/${link}/whatsapp`, { on: 'no' })
    expect(off.statusCode).toBe(303)
    expect(await page(app, link)).toContain('Send my offers on WhatsApp')
    const c = await call()
    await offer(c, aoife)
    expect(meta.sent).toEqual([])
    expect(await messages()).toEqual([])
    // The office can't put them back on.
    expect(await send('person.whatsapp', { id: aoife, on: true })).toMatchObject({ status: 'rejected', reason: { code: 'forbidden' } })
    await post(app, `/f/${link}/whatsapp`, { on: 'yes' })
    await offer(await call(), aoife)
    expect(meta.sent).toHaveLength(1)
    // The office can turn them off, when someone asks.
    expect(await send('person.whatsapp', { id: aoife, on: false })).toMatchObject({ status: 'applied' })
    const history = await app.inject({ url: '/api/history' })
    const said = history.json().entries.map((e: { what: string }) => e.what)
    expect(said).toEqual(expect.arrayContaining(['Aoife Byrne turned off offers on WhatsApp', 'Aoife Byrne turned on offers on WhatsApp', 'Turned off offers on WhatsApp for Aoife Byrne', 'Turned on offers on WhatsApp']))
  })

  it('leaves out anyone with no mobile, and sends nothing for an offer withdrawn before it went', async () => {
    const { db, app, meta, send, person, call, offer, messages } = await setUp()
    await send('whatsapp.use', { mode: 'on', testTo: [] })
    const noel = await person('Noel Byrne', null)
    await offer(await call(), noel)
    expect(await messages()).toEqual([])
    // Queued, then withdrawn before the server got to it.
    const aoife = await person('Aoife Byrne', '087 123 4567')
    const c = await call()
    await app.whatsappSender.kick()
    const id = newId()
    await db.query(`INSERT INTO offers (id, call_id, person_id, status, days) VALUES ($1, $2, $3, 'cancelled', '[]')`, [id, c, aoife])
    await db.query(`INSERT INTO whatsapp_messages (id, offer_id, person_id, kind, to_number, state) VALUES ($1, $2, $3, 'offer', '353871234567', 'queued')`, [`offer-${id}`, id, aoife])
    await app.whatsappSender.kick()
    expect(await messages()).toEqual([expect.objectContaining({ state: 'failed', problem: 'The offer was answered or withdrawn before it went.' })])
    expect(meta.sent).toEqual([])
  })

  it('keeps trying while Meta is away, and stops at Meta’s no', async () => {
    const { db, meta, send, person, call, offer, messages } = await setUp()
    await send('whatsapp.use', { mode: 'on', testTo: [] })
    const aoife = await person('Aoife Byrne', '087 123 4567')
    meta.answer({ status: 503, error: 'Service unavailable' })
    await offer(await call(), aoife)
    expect(await messages()).toEqual([expect.objectContaining({ state: 'queued', problem: 'Service unavailable', tries: 1 })])
    // Tried again a minute on, not at once.
    await send('messages.prompt', { on: false })
    expect(await messages()).toEqual([expect.objectContaining({ tries: 1 })])
    await db.query(`UPDATE whatsapp_messages SET tried_at = tried_at - interval '1 minute'`)
    meta.answer({ status: 400, error: 'Recipient phone number not in allowed list' })
    await send('messages.prompt', { on: false })
    expect(await messages()).toEqual([expect.objectContaining({ state: 'failed', problem: 'Recipient phone number not in allowed list', tries: 2 })])
  })

  it('says how the number is under Admin, and that it isn’t set up without the key', async () => {
    const set = await setUp()
    expect((await set.app.inject({ url: '/api/whatsapp' })).json()).toMatchObject({ configured: true, number: '+353 1 555 0100', name: 'Session Hire', quality: 'GREEN', missing: [] })
    const bare = await setUp({ configured: false })
    expect((await bare.app.inject({ url: '/api/whatsapp' })).json()).toMatchObject({ configured: false })
    // Without the key the switch stays off in practice: nothing is queued that could ever go, and nothing is looked for.
    await bare.send('whatsapp.use', { mode: 'on', testTo: [] })
    const aoife = await bare.person('Aoife Byrne', '087 123 4567')
    await bare.offer(await bare.call(), aoife)
    expect(await bare.messages()).toEqual([expect.objectContaining({ state: 'queued' })])
    expect(bare.meta.sent).toEqual([])
  })

  it('refuses a test number with no country code it can work out', async () => {
    const { send } = await setUp()
    expect(await send('whatsapp.use', { mode: 'test', testTo: ['12'] })).toMatchObject({ status: 'rejected', reason: { code: 'invalid' } })
  })
})

/** What Meta posts to the hook, signed with the app's secret ('s' here) unless told otherwise. */
const hook = (app: FastifyInstance, value: object, secret = 's') => {
  const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'waba', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '1234' }, ...value } }] }] })
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
  return app.inject({ method: 'POST', url: '/whatsapp/hook', headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature }, payload })
}
let inbound = 0
const pressed = (from: string, payload: string) => ({ messages: [{ id: `wamid.in.${++inbound}`, from, timestamp: '1', type: 'button', button: { payload, text: 'x' } }] })
const replied = (from: string, id: string) => ({ messages: [{ id: `wamid.in.${++inbound}`, from, timestamp: '1', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id, title: 'x' } } }] })
const wrote = (from: string, body: string) => ({ messages: [{ id: `wamid.in.${++inbound}`, from, timestamp: '1', type: 'text', text: { body } }] })

describe('answers on WhatsApp (ADR 0125, part 3)', () => {
  const offered = async () => {
    const set = await setUp()
    await set.send('whatsapp.use', { mode: 'on', testTo: [] })
    const aoife = await set.person('Aoife Byrne', '087 123 4567')
    const callId = await set.call()
    const offerId = await set.offer(callId, aoife)
    const offerRow = async () => (await set.db.query<{ status: string; responded_via: string | null }>('SELECT status, responded_via FROM offers WHERE id = $1', [offerId])).rows[0]!
    const said = () => set.meta.sent.slice(1).map((s) => s.body)
    return { ...set, aoife, callId, offerId, offerRow, said }
  }

  it('lets Meta register the address only with the verify token', async () => {
    const { app } = await setUp()
    const ok = await app.inject({ url: '/whatsapp/hook?hub.mode=subscribe&hub.verify_token=v&hub.challenge=12345' })
    expect(ok.statusCode).toBe(200)
    expect(ok.body).toBe('12345')
    expect((await app.inject({ url: '/whatsapp/hook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=1' })).statusCode).toBe(403)
  })

  it('believes nothing not signed with the app’s secret', async () => {
    const { app, offerId, offerRow, meta } = await offered()
    const res = await hook(app, pressed('353871234567', `yes:${offerId}`), 'not-the-secret')
    expect(res.statusCode).toBe(403)
    expect((await offerRow()).status).toBe('offered')
    expect(meta.sent).toHaveLength(1)
  })

  it('shows sent, delivered and read on the offer, never going back', async () => {
    const { app, offerId, db } = await offered()
    const state = async () => (await db.query<{ state: string }>('SELECT state FROM whatsapp_messages WHERE offer_id = $1', [offerId])).rows[0]!.state
    const offerView = async () => (await app.inject({ url: '/api/sync/pull?since=0' })).json().changes.filter((c: { entity: string; id: string }) => c.entity === 'offer' && c.id === offerId).at(-1).data
    expect((await offerView()).whatsapp).toMatchObject({ state: 'sent', problem: null })
    await hook(app, { statuses: [{ id: 'wamid.1', status: 'read', timestamp: '1700000000', recipient_id: '353871234567' }] })
    expect(await state()).toBe('read')
    await hook(app, { statuses: [{ id: 'wamid.1', status: 'delivered', timestamp: '1700000001', recipient_id: '353871234567' }] })
    expect(await state()).toBe('read')
    expect((await offerView()).whatsapp).toMatchObject({ state: 'read' })
  })

  it('says why a message wasn’t delivered', async () => {
    const { app, db, offerId } = await offered()
    await hook(app, { statuses: [{ id: 'wamid.1', status: 'failed', timestamp: '1700000000', errors: [{ code: 131026, title: 'Message undeliverable', error_data: { details: 'Not on WhatsApp' } }] }] })
    expect((await db.query('SELECT state, problem FROM whatsapp_messages WHERE offer_id = $1', [offerId])).rows[0]).toEqual({ state: 'failed', problem: 'Not on WhatsApp' })
  })

  it('takes Yes as accepting the offer, once, as their answer on WhatsApp', async () => {
    const { app, offerId, offerRow, said } = await offered()
    const yes = pressed('353871234567', `yes:${offerId}`)
    expect((await hook(app, yes)).statusCode).toBe(200)
    expect(await offerRow()).toEqual({ status: 'accepted', responded_via: 'whatsapp' })
    expect(said()).toEqual([expect.objectContaining({ to: '353871234567', type: 'text', text: expect.objectContaining({ body: expect.stringContaining('You’re down for Electric Picnic (Build)') }) })])
    // Meta sending it again changes nothing and says nothing more.
    await hook(app, yes)
    expect(said()).toHaveLength(1)
    const history = (await app.inject({ url: '/api/history' })).json().entries
    expect(history).toContainEqual(expect.objectContaining({ what: expect.stringContaining('Aoife Byrne accepted'), who: expect.objectContaining({ kind: 'whatsapp', name: 'Aoife Byrne' }) }))
  })

  it('asks again on No, and declines only on Decline it', async () => {
    const { app, offerId, offerRow, said } = await offered()
    await hook(app, pressed('353871234567', `no:${offerId}`))
    expect((await offerRow()).status).toBe('offered')
    expect(said()[0]).toMatchObject({ type: 'interactive', interactive: { action: { buttons: [{ reply: { id: `decline:${offerId}`, title: 'Decline it' } }, { reply: { id: `keep:${offerId}`, title: 'Keep it open' } }] } } })
    await hook(app, replied('353871234567', `keep:${offerId}`))
    expect((await offerRow()).status).toBe('offered')
    await hook(app, replied('353871234567', `decline:${offerId}`))
    expect(await offerRow()).toEqual({ status: 'declined', responded_via: 'whatsapp' })
    expect(said().at(-1)!.text.body).toContain('You’ve declined Electric Picnic (Build)')
  })

  it('ignores a press from any number but the one the offer went to', async () => {
    const { app, offerId, offerRow, said } = await offered()
    await hook(app, pressed('353860000000', `yes:${offerId}`))
    expect((await offerRow()).status).toBe('offered')
    expect(said()).toEqual([])
  })

  it('tells them when the job was filled before they said yes', async () => {
    const { app, send, offerId, offerRow, said } = await offered()
    await send('offer.cancel', { id: offerId })
    await hook(app, pressed('353871234567', `yes:${offerId}`))
    expect((await offerRow()).status).toBe('cancelled')
    expect(said()[0].text.body).toContain('the office has withdrawn')
  })

  it('turns them off on STOP, and answers anything else with where to answer', async () => {
    const { app, db, aoife, said } = await offered()
    await hook(app, wrote('353871234567', 'Running late, sorry'))
    expect(said()[0].text.body).toContain('Nobody reads messages written to this number')
    expect((await db.query('SELECT whatsapp_off FROM people WHERE id = $1', [aoife])).rows[0]).toEqual({ whatsapp_off: false })
    await hook(app, wrote('353871234567', ' Stop! '))
    expect((await db.query('SELECT whatsapp_off FROM people WHERE id = $1', [aoife])).rows[0]).toEqual({ whatsapp_off: true })
    expect(said()[1].text.body).toContain('no more offers on WhatsApp')
    // Someone the app never messaged hears nothing.
    await hook(app, wrote('353860000000', 'Hello?'))
    expect(said()).toHaveLength(2)
  })
})

describe('offers on hold, and what follows (ADR 0125, HOLD)', () => {
  async function onHold() {
    const s = await setUp()
    const job = newId()
    expect(await s.send('project.create', { id: job, name: 'Nissan', clientId: null, venueId: null, status: 'quoted', notes: '' })).toMatchObject({ status: 'applied' })
    const at = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
    const callId = newId()
    expect(
      await s.send('call.create', { id: callId, projectId: job, project: 'Nissan', phase: 'Build', venue: 'RDS', role: 'Audio tech', start: at, end: at, callTime: '08:00', needed: 3, dayRateCents: 25000, details: '', replyBy: null })
    ).toMatchObject({ status: 'applied' })
    expect(await s.send('whatsapp.use', { mode: 'on', testTo: [] })).toMatchObject({ status: 'applied' })
    const aoife = await s.person('Aoife Byrne', '087 123 4567')
    const dara = await s.person('Dara Kelly', '086 765 4321')
    const sean = await s.person('Seán Murphy', null)
    const offers = { aoife: await s.offer(callId, aoife), dara: await s.offer(callId, dara), sean: await s.offer(callId, sean) }
    /** The messages went this long ago, as Meta would have them. */
    const age = (ms: number) => s.db.query(`UPDATE whatsapp_messages SET sent_at = $1`, [new Date(Date.now() - ms)])
    const kinds = async () => (await s.db.query<{ kind: string; offer_id: string; state: string; hold: boolean; problem: string | null }>(`SELECT kind, offer_id, state, hold, problem FROM whatsapp_messages ORDER BY made_at, id`)).rows
    const blanks = (i: number) => s.meta.sent[i]!.body.template.components[0].parameters.map((p: { text: string }) => p.text)
    return { ...s, job, callId, at, offers, age, kinds, blanks }
  }

  it('says HOLD in the offer before the client has said yes, and not after', async () => {
    const s = await onHold()
    expect(s.blanks(0)[1]).toBe('HOLD Nissan (Build)')
    expect((await s.kinds()).map((k) => k.hold)).toEqual([true, true])
    expect(await s.send('project.update', { id: s.job, status: 'confirmed' })).toMatchObject({ status: 'applied' })
    const late = await s.person('Niall Kerr', '085 111 2222')
    await s.offer(s.callId, late)
    expect(s.blanks(s.meta.sent.length - 1)[1]).toBe('Nissan (Build)')
  })

  it('sends no follow-up when the job is confirmed within the hour', async () => {
    const s = await onHold()
    const before = s.meta.sent.length
    await s.send('project.update', { id: s.job, status: 'confirmed' })
    expect(s.meta.sent.length).toBe(before)
    expect((await s.kinds()).filter((k) => k.kind === 'confirmed')).toEqual([])
  })

  it('tells those still asked that it is confirmed, once, when time has passed since the HOLD', async () => {
    const s = await onHold()
    await s.age(2 * 60 * 60_000)
    expect(await s.send('offer.respond', { id: s.offers.dara, answer: 'decline', note: '' })).toMatchObject({ status: 'applied' })
    const before = s.meta.sent.length
    await s.send('project.update', { id: s.job, status: 'confirmed' })
    const sent = s.meta.sent.slice(before)
    // Aoife only: Dara said no, and Seán has no mobile.
    expect(sent.map((m) => [m.body.to, m.body.template.name])).toEqual([['353871234567', 'job_confirmed']])
    expect(s.blanks(before).slice(0, 2)).toEqual(['Aoife', 'Nissan (Build)'])
    expect(sent[0]!.body.template.components[1]).toEqual({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: await s.token((await s.db.query<{ person_id: string }>('SELECT person_id FROM offers WHERE id = $1', [s.offers.aoife])).rows[0]!.person_id) }] })
    // Back on hold and confirmed again: nothing more.
    await s.send('project.update', { id: s.job, status: 'quoted' })
    await s.send('project.update', { id: s.job, status: 'confirmed' })
    expect(s.meta.sent.length).toBe(before + 1)
  })

  it('tells everyone asked or booked when the job is cancelled, and nobody it never reached', async () => {
    const s = await onHold()
    expect(await s.send('offer.respond', { id: s.offers.aoife, answer: 'accept', days: [s.at], note: '' })).toMatchObject({ status: 'applied' })
    expect(await s.send('offer.respond', { id: s.offers.dara, answer: 'decline', note: '' })).toMatchObject({ status: 'applied' })
    const before = s.meta.sent.length
    await s.send('project.update', { id: s.job, status: 'cancelled' })
    const sent = s.meta.sent.slice(before)
    expect(sent.map((m) => [m.body.to, m.body.template.name])).toEqual([['353871234567', 'job_cancelled']])
    expect(sent[0]!.body.template.components).toHaveLength(1)
    expect(s.blanks(before).slice(0, 2)).toEqual(['Aoife', 'Nissan (Build)'])
  })

  it('sends nothing on confirm or cancel while WhatsApp is off', async () => {
    const s = await onHold()
    await s.age(2 * 60 * 60_000)
    await s.send('whatsapp.use', { mode: 'off', testTo: [] })
    const before = s.meta.sent.length
    await s.send('project.update', { id: s.job, status: 'confirmed' })
    await s.send('project.update', { id: s.job, status: 'cancelled' })
    expect(s.meta.sent.length).toBe(before)
  })
})
