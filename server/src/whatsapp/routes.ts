import type { FastifyInstance } from 'fastify'
import { publicOrigin } from '../http.ts'
import { signedByMeta, type HookBody, type WhatsAppAnswers } from './answers.ts'
import type { WhatsApp } from './whatsapp.ts'

/** What Meta posts is small; anything far bigger isn't Meta's. */
const HOOK_LIMIT = 1_000_000

/**
 * WhatsApp's state for Admin › Connections (ADR 0125), for those who look after the company's settings: whether the
 * server is set up, the number as Meta has it, and the address to give Meta for answers. Nothing is sent.
 *
 * And the address itself, /whatsapp/hook: Meta checks it once with the verify token, then posts receipts and what
 * crew send, each signed with the app's secret. Without the secret nothing posted is believed.
 */
export function registerWhatsAppRoutes(app: FastifyInstance, { whatsapp, answers }: { whatsapp: WhatsApp; answers: WhatsAppAnswers }) {
  app.get('/api/whatsapp', { config: { needs: 'settings' } }, async (req, reply) => {
    reply.header('cache-control', 'no-store')
    return whatsapp.status(publicOrigin(req))
  })

  app.register(async (scope) => {
    // The signature is over the body exactly as sent, so it's kept as bytes and read after it's checked.
    scope.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: HOOK_LIMIT }, (_req, body, done) => done(null, body))

    // Meta registering the address: it sends the verify token and wants its challenge back.
    scope.get<{ Querystring: Record<string, string | undefined> }>('/whatsapp/hook', async (req, reply) => {
      const q = req.query
      const token = whatsapp.config?.verifyToken
      if (!token || q['hub.mode'] !== 'subscribe' || q['hub.verify_token'] !== token) return reply.code(403).send('Not this one.')
      return reply.header('content-type', 'text/plain').send(q['hub.challenge'] ?? '')
    })

    scope.post('/whatsapp/hook', async (req, reply) => {
      const secret = whatsapp.config?.appSecret
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
      if (!secret || !signedByMeta(secret, raw, req.headers['x-hub-signature-256'] as string | undefined)) return reply.code(403).send('Not signed.')
      let body: HookBody
      try {
        body = JSON.parse(raw.toString('utf8')) as HookBody
      } catch {
        return reply.code(400).send('Not JSON.')
      }
      // Acted on before Meta hears back: if it fails, Meta sends it again, and each answer is taken once.
      await answers.take(body, publicOrigin(req))
      return reply.code(200).send('OK')
    })
  })
}
