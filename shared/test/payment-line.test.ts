import { describe, expect, it } from 'vitest'
import { paymentLine } from '../src/index.ts'

/** The line where someone decides to pay (user flows of 24 November 2026, gap 8). */
describe('where payment details stand', () => {
  const day = (d: string) => d
  const own = { personId: 'a', changedAt: '2031-03-04T10:00:00.000Z', own: true }
  it('asks for them when none are held', () => expect(paymentLine(undefined, '2031-03-01', day)).toEqual({ text: 'No payment details yet: ask for them', tone: 'ask' }))
  it('is quiet when the office or the Apply page gave them', () => expect(paymentLine({ ...own, own: false }, undefined, day)).toEqual({ text: 'Payment details held', tone: 'quiet' }))
  it('warns when changed on their own page and not paid to since, the day of the change included', () => {
    const warn = { text: 'Payment details changed on their own page 2031-03-04: ring before paying', tone: 'warn' }
    expect(paymentLine(own, undefined, day)).toEqual(warn)
    expect(paymentLine(own, '2031-03-01', day)).toEqual(warn)
    expect(paymentLine(own, '2031-03-04', day)).toEqual(warn)
  })
  it('is quiet again once a payment is marked paid after the change', () => expect(paymentLine(own, '2031-03-05', day).tone).toBe('quiet'))
})
