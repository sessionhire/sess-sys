import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PriceCheck } from '@sh/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { dirStore } from '../src/backup/store.ts'
import type { Ask, Asked } from '../src/assistant/claude.ts'
import { IPHONE, server, staff } from './people.ts'

/**
 * Claude checks replacement values on the web (ADR 0206): one product an ask,
 * read from the stock list by its id, only for whoever runs the stock, and
 * turned down as every ask is unless Claude is set up, on and within the
 * month's limit. Nothing is set by it.
 */

const folders: string[] = []
afterEach(() => {
  for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true })
})

const PERSON = { phone: null, skills: [], dayRateCents: null, notes: '' }
const answer = {
  found: true,
  euro: 2399,
  confidence: 'high',
  shop: 'Thomann',
  priced: '',
  said: 'Thomann sells it to Ireland.',
  sources: [{ title: 'Thomann', url: 'https://www.thomann.de/ie/yamaha_dm3.htm' }],
}

async function company() {
  const dir = mkdtempSync(join(tmpdir(), 'sh-price-check-'))
  folders.push(dir)
  const asked: Asked[] = []
  const ask: Ask = async (a) => {
    asked.push(a)
    return {
      json: answer,
      model: 'claude-opus-5-5',
      inputTokens: 6_000,
      outputTokens: 800,
      searches: 2,
    }
  }
  const { app, db } = await server({
    documentStore: dirStore(dir),
    claude: {
      apiKey: 'test',
      model: 'claude-opus-5-5',
      limitCents: 5_000,
      ask,
    },
  })
  const colly = await staff(app, db, 'Colly Hewson', IPHONE, 'phonec0ffee')
  const sean = await staff(app, db, 'Sean Walsh', IPHONE, 'phonebeef')
  for (const [id, name] of [
    ['colly', 'Colly Hewson'],
    ['sean', 'Sean Walsh'],
  ] as const)
    expect(
      await colly.send('person.upsert', {
        id,
        name,
        kind: 'staff',
        email: `${id}@sessionhire.com`,
        ...PERSON,
      })
    ).toMatchObject({ status: 'applied' })
  expect(await colly.send('person.role', { id: 'colly', role: 'director' })).toMatchObject({ status: 'applied' })
  expect(await colly.send('person.role', { id: 'sean', role: 'crew' })).toMatchObject({ status: 'applied' })
  expect(
    await colly.send('model.create', {
      id: 'dm3',
      name: 'Yamaha DM3',
      department: 'audio',
      category: 'Desks',
      tracking: 'serialised',
      isCase: false,
      valueCents: 2300_00,
      notes: '',
      aliases: ['DM3 desk'],
    })
  ).toMatchObject({ status: 'applied' })
  return { app, db, colly, sean, asked }
}

describe('checking prices with Claude (ADR 0206)', () => {
  it('asks about one product from the list, with a few searches, and sets nothing', async () => {
    const { app, db, colly, sean, asked } = await company()
    const check = (who: typeof colly, modelId = 'dm3') =>
      app.inject({
        method: 'POST',
        url: '/api/assistant/price',
        cookies: who.cookies,
        payload: { modelId },
      })

    expect(
      (
        await app.inject({
          url: '/api/assistant/price',
          cookies: colly.cookies,
        })
      ).json()
    ).toMatchObject({ ok: false, leftCents: 5_000 })
    expect((await check(colly)).statusCode).toBe(409)
    expect(asked).toHaveLength(0)

    expect(await colly.send('assistant.use', { on: true })).toMatchObject({
      status: 'applied',
    })
    expect(
      (
        await app.inject({
          url: '/api/assistant/price',
          cookies: colly.cookies,
        })
      ).json()
    ).toEqual({ ok: true, leftCents: 5_000 })
    const res = await check(colly)
    expect(res.statusCode).toBe(200)
    const got = res.json() as PriceCheck
    expect(got).toMatchObject({
      modelId: 'dm3',
      reading: { found: true, euro: 2399, confidence: 'high' },
      cents: 6,
    })
    expect(asked[0]!.searches).toBe(3)
    expect(asked[0]!.user).toContain('Yamaha DM3')
    expect(asked[0]!.user).toContain('DM3 desk')
    expect(asked[0]!.user).toContain('€2300')
    expect(asked[0]!.system).toMatch(/Thomann/)
    expect((await db.query(`SELECT kind, cost_cents FROM assistant_uses`)).rows[0]).toMatchObject({ kind: 'price', cost_cents: 6 })
    // Nothing is set by a check: that's for a person, through the list.
    expect((await db.query(`SELECT value_cents FROM models WHERE id = 'dm3'`)).rows[0]).toMatchObject({ value_cents: 2300_00 })

    // A product that isn't there, or no product, is turned down before asking.
    expect((await check(colly, 'nope')).statusCode).toBe(404)
    expect((await check(colly, '')).statusCode).toBe(400)
    expect(asked).toHaveLength(1)
    // Only whoever runs the stock checks prices.
    expect((await check(sean)).statusCode).toBe(403)
  })
})
