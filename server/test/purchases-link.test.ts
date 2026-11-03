import type { PurchaseRequest, PurchaseVote } from '@sh/shared'
import { describe, expect, it } from 'vitest'
import { flashOf, server, staff, WINDOWS } from './people.ts'

/**
 * The purchase list on a freelancer's private link (ADR 0108): with no
 * sign-in, they see the list, ask for something and vote as themselves,
 * through the same rules as the app's Stock › Purchase list (ADR 0077).
 */

const PERSON = { phone: null, skills: [], dayRateCents: null, notes: '' }
const FORM = { 'content-type': 'application/x-www-form-urlencoded' }

async function setUp() {
  const { app, db } = await server()
  const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
  await colly.send('person.upsert', { id: 'colly', name: 'Colly Hewson', kind: 'staff', email: 'colly@sessionhire.com', ...PERSON })
  await colly.send('person.upsert', { id: 'dara', name: 'Dara Kelly', kind: 'freelancer', email: null, department: 'Audio', ...PERSON })
  const token = async (id: string) => (await db.query<{ link_token: string }>('SELECT link_token FROM people WHERE id = $1', [id])).rows[0]!.link_token
  const dara = `/f/${await token('dara')}`
  const post = (url: string, fields: Record<string, string>) => app.inject({ method: 'POST', url, headers: FORM, payload: new URLSearchParams(fields).toString() })
  /** Where a post went, and what the page there says. */
  const follow = async (res: Awaited<ReturnType<typeof post>>) => {
    expect(res.statusCode).toBe(303)
    const to = new URL(res.headers.location as string, 'http://x')
    return { to, body: (await app.inject({ url: to.pathname + to.search })).body }
  }
  return { app, db, colly, dara, post, follow, token }
}

describe('the purchase list on a freelancer’s link', () => {
  it('is reached from their page and lists what was asked for, most votes first', async () => {
    const { app, colly, dara } = await setUp()
    await colly.send('purchase.ask', { id: 'nl4t', title: 'NL4T connectors', details: '20', link: '', department: 'Audio' })
    await colly.send('purchase.ask', { id: 'gaff', title: 'Gaffer tape', details: '', link: '', department: null })
    expect(await colly.send('purchase.vote', { requestId: 'gaff', vote: true })).toMatchObject({ status: 'applied' })
    const home = (await app.inject({ url: dara })).body
    expect(home).toMatch(/href="[^"]*\/buy">The purchase list: 2 asked for ›<\/a>/)
    const page = await app.inject({ url: `${dara}/buy` })
    expect(page.statusCode).toBe(200)
    expect(page.headers['cache-control']).toBe('no-store')
    expect(page.body.indexOf('<b>Gaffer tape')).toBeLessThan(page.body.indexOf('<b>NL4T connectors'))
    expect(page.body).toContain('Colly Hewson')
  })

  it('takes a request as them, in their department, once however often the form is sent', async () => {
    const { db, colly, dara, post, follow } = await setUp()
    const fields = { id: 'abcdef1234', title: '  DI boxes ', details: '4, passive', link: 'thomann.de/ie/di.htm' }
    const { to, body } = await follow(await post(`${dara}/buy`, fields))
    expect(to.pathname).toBe(`${dara}/buy`)
    expect(flashOf(body)).toEqual({ ok: true, message: "Thanks, it's on the list. The office will see it, and you'll see here where it's at." })
    await follow(await post(`${dara}/buy`, fields))
    const r = await colly.record<PurchaseRequest>('purchaseRequest', 'abcdef1234')
    expect(r).toMatchObject({ title: 'DI boxes', details: '4, passive', link: 'https://thomann.de/ie/di.htm', department: 'Audio', askedBy: 'dara', status: 'asked' })
    expect((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM purchase_requests')).rows[0]!.n).toBe(1)
  })

  it('says why a request is turned down, with what was typed still in the form', async () => {
    const { dara, post } = await setUp()
    const res = await post(`${dara}/buy`, { id: 'abcdef9999', title: 'Mics', details: 'SM58s', link: 'not a link' })
    expect(res.statusCode).toBe(422)
    expect(flashOf(res.body)).toEqual({ ok: false, message: "The link isn't a web address. Copy it from the shop's page." })
    expect(res.body).toContain('value="Mics"')
    expect(res.body).toContain('>SM58s</textarea>')
  })

  it('votes as them, once, and takes the vote back; nothing settled takes a vote', async () => {
    const { app, colly, dara, post, follow } = await setUp()
    await colly.send('purchase.ask', { id: 'nl4t', title: 'NL4T connectors', details: '', link: '', department: null })
    await colly.send('purchase.ask', { id: 'old', title: 'Old desk', details: '', link: '', department: null })
    await colly.send('purchase.status', { id: 'old', status: 'arrived', notes: '' })

    const voted = await follow(await post(`${dara}/buy/nl4t/vote`, { vote: 'yes' }))
    expect(flashOf(voted.body)).toMatchObject({ ok: true, message: 'Thanks, your vote is in.' })
    expect(voted.body).toContain('aria-pressed="true"')
    await post(`${dara}/buy/nl4t/vote`, { vote: 'yes' })
    expect(await colly.record<PurchaseVote>('purchaseVote', 'nl4t.dara')).toEqual({ id: 'nl4t.dara', requestId: 'nl4t', personId: 'dara' })

    const back = await follow(await post(`${dara}/buy/nl4t/vote`, { vote: 'no' }))
    expect(flashOf(back.body)).toMatchObject({ ok: true, message: 'Your vote is taken back.' })
    const pull = await app.inject({ url: '/api/sync/pull?after=0', cookies: colly.cookies })
    expect(pull.json().changes.filter((c: { id: string }) => c.id === 'nl4t.dara').at(-1).op).toBe('delete')

    const settled = await follow(await post(`${dara}/buy/old/vote`, { vote: 'yes' }))
    expect(flashOf(settled.body)).toMatchObject({ ok: false, message: "That one's been ordered or settled, so it can't be voted for now." })
    const gone = await follow(await post(`${dara}/buy/nothing/vote`, { vote: 'yes' }))
    expect(flashOf(gone.body)).toMatchObject({ ok: false, message: "That request isn't on the purchase list any more." })
  })

  it('needs a link that works, and a member of staff’s link still needs their Google sign-in', async () => {
    const { app, token } = await setUp()
    expect((await app.inject({ url: '/f/not-a-real-token/buy' })).statusCode).toBe(404)
    expect((await app.inject({ url: `/f/${await token('colly')}/buy` })).statusCode).toBe(401)
  })
})
