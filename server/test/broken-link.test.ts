import { describe, expect, it } from 'vitest'
import { flashOf, server, staff, WINDOWS } from './people.ts'

/**
 * Broken or missing kit, reported from a freelancer's private link (audit,
 * 5 November 2026, finding 75): their role can report a fault, and with no
 * sign-in their link is the only way they have, so it lands on Repairs as
 * the app's Report damage does, with their name on it.
 */

const PERSON = { phone: null, skills: [], dayRateCents: null, notes: '' }
const FORM = { 'content-type': 'application/x-www-form-urlencoded' }

async function setUp() {
  const { app, db } = await server()
  const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
  await colly.send('person.upsert', { id: 'dara', name: 'Dara Kelly', kind: 'freelancer', email: null, department: 'Audio', ...PERSON })
  await colly.send('model.create', { id: 'sm58', name: 'Shure SM58', department: 'audio', category: 'Microphones', tracking: 'serialised', isCase: false, valueCents: null, notes: '' })
  expect(await colly.send('asset.add', { id: 'mic-1', modelId: 'sm58', number: 'SH-000042', serial: '', placeId: null, caseId: null, notes: '', fromCount: false })).toMatchObject({
    status: 'applied',
  })
  const token = (await db.query<{ link_token: string }>('SELECT link_token FROM people WHERE id = $1', ['dara'])).rows[0]!.link_token
  const dara = `/f/${token}`
  const post = (fields: Record<string, string>) => app.inject({ method: 'POST', url: `${dara}/broken`, headers: FORM, payload: new URLSearchParams(fields).toString() })
  const faults = async () =>
    (await db.query<{ kind: string; asset_id: string | null; model_id: string; usable: boolean; note: string }>('SELECT kind, asset_id, model_id, usable, note FROM faults ORDER BY at')).rows
  return { app, dara, post, faults }
}

describe('broken or missing kit from a freelancer’s link', () => {
  it('is reached from their page, and a number from the label reports that item, held back, with their name', async () => {
    const { app, dara, post, faults } = await setUp()
    expect((await app.inject({ url: dara })).body).toMatch(/href="[^"]*\/broken">Tell the warehouse ›<\/a>/)
    const res = await post({ id: 'abcdef1234', number: 'sh 42', kind: 'damaged', note: 'Crackles when the cable moves' })
    expect(res.statusCode).toBe(303)
    const to = new URL(res.headers.location as string, 'http://x')
    expect(flashOf((await app.inject({ url: to.pathname + to.search })).body)).toEqual({ ok: true, message: "Thanks, the warehouse has it. It's on their repairs list with your name on it." })
    // The same form again reports once.
    await post({ id: 'abcdef1234', number: 'sh 42', kind: 'damaged', note: 'Crackles when the cable moves' })
    expect(await faults()).toEqual([{ kind: 'damaged', asset_id: 'mic-1', model_id: 'sm58', usable: false, note: "From Dara Kelly's link: Crackles when the cable moves" }])
  })

  it('takes a product by name when there is no label, and says what to fix when nothing matches', async () => {
    const { post, faults } = await setUp()
    expect((await post({ id: 'abcdef5678', product: 'shure sm58', kind: 'missing', usable: 'yes' })).statusCode).toBe(303)
    expect(await faults()).toEqual([{ kind: 'missing', asset_id: null, model_id: 'sm58', usable: false, note: "From Dara Kelly's link." }])

    const unknown = await post({ id: 'abcdef9999', number: 'SH-999999', kind: 'damaged', note: 'Bent' })
    expect(unknown.statusCode).toBe(422)
    expect(flashOf(unknown.body)).toEqual({ ok: false, message: "Nothing here has that number. Check the label, or give the product's name instead." })
    expect(unknown.body).toContain('value="SH-999999"')
    expect(unknown.body).toContain('>Bent</textarea>')
    // Said under the field it's about, which is marked and joined to it, and which the page drawn again lands on.
    expect(unknown.body).toMatch(/<label id="refused">Its number, from the label <input name="number"[^>]* aria-invalid="true" aria-describedby="number-error" value="SH-999999"><\/label><p class="field-error" id="number-error" role="alert">Nothing here has that number/)
    expect(unknown.body).toContain('action="http://localhost:80/f/')
    expect(unknown.body).toMatch(/\/broken#refused">/)
    expect(unknown.body).toContain('<title>Error: Session Hire: broken or missing kit</title>')
    const noProduct = await post({ id: 'abcdef7777', product: 'Shure SM99', kind: 'damaged' })
    expect(noProduct.body).toMatch(/<label id="refused">Or, with no label, the product <input name="product"[^>]* aria-invalid="true" aria-describedby="product-error" value="Shure SM99"><\/label><p class="field-error" id="product-error" role="alert">There&#39;s no product called that/)
    // Neither given: said under the number, the first question, which says to give one or the other.
    const neither = (await post({ id: 'abcdef8888', kind: 'damaged' })).body
    expect(flashOf(neither)).toMatchObject({ ok: false, message: "Give its number from the label, or the product's name if it has no label." })
    expect(neither).toContain('<p class="field-error" id="number-error" role="alert">')
    expect(await faults()).toHaveLength(1)
  })
})
