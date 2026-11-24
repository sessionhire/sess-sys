import { describe, expect, it } from 'vitest'
import { clearUnneededDetails } from '../src/crew/keeping.ts'
import { sealPayment } from '../src/crew/payment.ts'
import { IPHONE, server, staff } from './people.ts'

/**
 * Keeping people's details no longer than they're needed (ADR 0193): applications nobody acted on for 6 months go,
 * and payment details go when someone leaves the crew list or nobody has booked or asked for them in 12 months.
 */

const KEY = 'k'.repeat(40)
const DETAILS = { ppsn: '1234567T', vatNumber: '', accountName: 'Test', iban: 'IE29AIBK93115212345678', bic: '' }

async function person(db: Awaited<ReturnType<typeof server>>['db'], id: string, detailsGiven: string) {
  await db.query(`INSERT INTO people (id, name, kind, link_token) VALUES ($1, $1, 'freelancer', $2)`, [id, `${id}-link-token-0000000000000000`])
  await db.query(`INSERT INTO payment_details (person_id, sealed, changed_at, changed_by) VALUES ($1, $2, now() - $3::interval, 'The office')`, [id, sealPayment(KEY, DETAILS), detailsGiven])
}

const kept = async (db: Awaited<ReturnType<typeof server>>['db']) =>
  (await db.query<{ person_id: string }>('SELECT person_id FROM payment_details ORDER BY person_id')).rows.map((r) => r.person_id)

describe('keeping details only while they are needed', () => {
  it('deletes applications nobody acted on for 6 months, and keeps newer ones', async () => {
    const { db } = await server()
    const apply = (id: string, ago: string) =>
      db.query(
        `INSERT INTO applications (id, first_name, last_name, email, phone, skills, applied_at) VALUES ($1, 'Cian', 'Test', $1 || '@example.com', '+353871234567', '["Rigger"]', now() - $2::interval)`,
        [id, ago]
      )
    await apply('old', '7 months')
    await apply('new', '5 months')
    expect(await clearUnneededDetails(db)).toEqual({ applications: 1, payments: 0 })
    expect((await db.query<{ id: string }>('SELECT id FROM applications')).rows.map((r) => r.id)).toEqual(['new'])
    const history = await db.query<{ args: unknown }>(`SELECT args FROM mutations WHERE name = 'applications.expire'`)
    expect(history.rows.map((r) => r.args)).toEqual([{ count: 1 }])
    // The second day there's nothing, and no history entry.
    expect(await clearUnneededDetails(db)).toEqual({ applications: 0, payments: 0 })
    expect((await db.query(`SELECT 1 FROM mutations WHERE name = 'applications.expire'`)).rows).toHaveLength(1)
  })

  it('clears payment details of someone not booked or asked for in 12 months, and keeps those given or booked lately', async () => {
    const { db } = await server()
    await person(db, 'idle', '13 months')
    await person(db, 'given', '2 months')
    await person(db, 'booked', '13 months')
    await person(db, 'gone', '1 day')
    await db.query(`UPDATE people SET archived = true WHERE id = 'gone'`)
    await db.query(`INSERT INTO crew_calls (id, project, role, start_day, end_day, needed, status) VALUES ('c1', 'Gig', 'Rigger', current_date - 60, current_date - 59, 1, 'open')`)
    await db.query(`INSERT INTO offers (id, call_id, person_id, status, days) VALUES ('o1', 'c1', 'booked', 'confirmed', '[]')`)
    expect(await clearUnneededDetails(db)).toEqual({ applications: 0, payments: 2 })
    expect(await kept(db)).toEqual(['booked', 'given'])
  })

  it('clears payment details at once when someone is taken off the crew list', async () => {
    const { app, db } = await server()
    const colly = await staff(app, db, 'Colly Hewson', IPHONE, 'phone-c0ffee')
    await colly.send('person.upsert', { id: 'p1', name: 'Aoife Byrne', kind: 'freelancer', email: null, phone: '+353871234567', skills: [], dayRateCents: null, notes: '' })
    await db.query(`INSERT INTO payment_details (person_id, sealed) VALUES ('p1', $1)`, [sealPayment(KEY, DETAILS)])
    expect((await colly.send('person.archive', { id: 'p1', archived: true })).status).toBe('applied')
    expect(await kept(db)).toEqual([])
  })
})
