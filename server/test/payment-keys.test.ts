import { describe, expect, it } from 'vitest'
import { openPayment, openWithKeys, paymentKeysFromEnv, resealPayments, sealPayment } from '../src/crew/payment.ts'
import { server } from './people.ts'

/**
 * The key that locks payment details (ADR 0193): a long one of its own, never the Google client secret; and changing
 * it without losing what the old one locked.
 */

const NEW = 'n'.repeat(40)
const OLD = 'o'.repeat(40)
const DETAILS = { ppsn: '1234567FA', vatNumber: '', accountName: 'Aoife Test', iban: 'IE29AIBK93115212345678', bic: '' }

describe('the payment details key', () => {
  it('is PAYMENT_DETAILS_KEY alone, and the Google client secret only unlocks', () => {
    expect(paymentKeysFromEnv({}, 'google')).toEqual({ keys: { current: undefined, old: ['google'] } })
    expect(paymentKeysFromEnv({ PAYMENT_DETAILS_KEY: NEW, PAYMENT_DETAILS_KEY_OLD: OLD }, 'google')).toEqual({ keys: { current: NEW, old: [OLD, 'google'] } })
  })

  it('is not used when it is short, and says why', () => {
    const { keys, problem } = paymentKeysFromEnv({ PAYMENT_DETAILS_KEY: 'hunter2' })
    expect(keys.current).toBeUndefined()
    expect(problem).toMatch(/shorter than 32 characters/)
  })

  it('unlocks with an old key and says so', () => {
    const sealed = sealPayment(OLD, DETAILS)
    expect(openWithKeys({ current: NEW, old: [OLD] }, sealed)).toEqual({ details: DETAILS, old: true })
    expect(openWithKeys({ current: OLD }, sealed)).toEqual({ details: DETAILS, old: false })
    expect(openWithKeys({ current: NEW }, sealed)).toBeUndefined()
  })

  it('locks again with the new key what the old one locked, kept or still on an application', async () => {
    const { db } = await server()
    await db.query(`INSERT INTO people (id, name, kind, link_token) VALUES ('aoife', 'Aoife Test', 'freelancer', 'aoife-link-token-000000000000')`)
    await db.query(`INSERT INTO payment_details (person_id, sealed, changed_at, changed_by) VALUES ('aoife', $1, now(), 'The office')`, [sealPayment(OLD, DETAILS)])
    await db.query(
      `INSERT INTO applications (id, first_name, last_name, email, phone, skills, payment_sealed, applied_at) VALUES ('a1', 'Cian', 'Test', 'cian@example.com', '+353871234567', '["Rigger"]', $1, now())`,
      [sealPayment(OLD, DETAILS)]
    )
    expect(await resealPayments(db, { current: NEW, old: [OLD] })).toEqual({ resealed: 2, unreadable: 0 })
    const kept = (await db.query<{ sealed: string }>('SELECT sealed FROM payment_details')).rows[0]!.sealed
    const applied = (await db.query<{ payment_sealed: string }>('SELECT payment_sealed FROM applications')).rows[0]!.payment_sealed
    expect(openPayment(NEW, kept)).toEqual(DETAILS)
    expect(openPayment(NEW, applied)).toEqual(DETAILS)
    expect(openPayment(OLD, kept)).toBeUndefined()
    // Done once: the second time there's nothing left on the old key.
    expect(await resealPayments(db, { current: NEW, old: [OLD] })).toEqual({ resealed: 0, unreadable: 0 })
  })
})
