import { describe, expect, it } from 'vitest'
import { server, staff, WINDOWS } from './people.ts'

/**
 * A freelancer's link as it arrives from a message (audit, 5 November 2026,
 * finding 66): with a slash on the end, a full stop or bracket picked up
 * with it, or a part of the address that isn't one, it still opens their
 * page rather than a bare "Not found" in code or "This link doesn't work".
 */

const PERSON = { phone: null, skills: [], dayRateCents: null, notes: '' }

describe('a link with something stuck on it', () => {
  it('opens their page, and a stranger’s token is still gone', async () => {
    const { app, db } = await server()
    const colly = await staff(app, db, 'Colly Hewson', WINDOWS, 'office-c0ffee')
    await colly.send('person.upsert', { id: 'dara', name: 'Dara Kelly', kind: 'freelancer', email: null, ...PERSON })
    const token = (await db.query<{ link_token: string }>('SELECT link_token FROM people WHERE id = $1', ['dara'])).rows[0]!.link_token
    const to = async (url: string) => {
      const res = await app.inject({ url })
      return [res.statusCode, res.headers.location ?? null]
    }
    expect(await to(`/f/${token}/`)).toEqual([303, `/f/${token}`])
    expect(await to(`/f/${token}/buy/`)).toEqual([303, `/f/${token}/buy`])
    expect(await to(`/f/${token}.`)).toEqual([303, `/f/${token}`])
    expect(await to(`/f/${encodeURIComponent(`${token})`)}`)).toEqual([303, `/f/${token}`])
    expect(await to(`/f/${token}/timesheet`)).toEqual([303, `/f/${token}`])
    expect(await to(`/f/${token}/sheet`)).toEqual([303, `/f/${token}`])
    const stranger = await app.inject({ url: '/f/abcdefghijklmnopqrstuvwx/' })
    expect(stranger.statusCode).toBe(303)
    const gone = await app.inject({ url: stranger.headers.location as string })
    expect(gone.statusCode).toBe(404)
    expect(gone.headers['content-type']).toContain('text/html')
    const deeper = await app.inject({ url: '/f/abcdefghijklmnopqrstuvwx/nothing' })
    expect([deeper.statusCode, deeper.headers['content-type']]).toEqual([404, expect.stringContaining('text/html')])
  })
})
