import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { registerAdrLink } from '../src/adr-link.ts'

describe("a decision's link from What's changed (audit, 5 November 2026, finding 80)", () => {
  const app = Fastify()
  registerAdrLink(app)

  it('opens the decision itself, found by its number', async () => {
    const res = await app.inject({ url: '/adr/71' })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('https://github.com/sessionhire/sess-sys/blob/main/docs/adr/0071-whats-changed-and-version-numbers.md')
  })

  it('sends a number it has no decision for, or no number, to the folder of them all', async () => {
    for (const url of ['/adr/9999', '/adr/x', '/adr/..%2F..%2Fpackage.json'])
      expect((await app.inject({ url })).headers.location).toBe('https://github.com/sessionhire/sess-sys/tree/main/docs/adr')
  })
})
