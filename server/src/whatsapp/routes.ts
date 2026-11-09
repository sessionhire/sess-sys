import type { FastifyInstance } from 'fastify'
import { publicOrigin } from '../http.ts'
import type { WhatsApp } from './whatsapp.ts'

/**
 * WhatsApp's state for Admin › Connections (ADR 0125), for those who look after the company's settings: whether the
 * server is set up, the number as Meta has it, and the address to give Meta for answers. Nothing is sent.
 */
export function registerWhatsAppRoutes(app: FastifyInstance, { whatsapp }: { whatsapp: WhatsApp }) {
  app.get('/api/whatsapp', { config: { needs: 'settings' } }, async (req, reply) => {
    reply.header('cache-control', 'no-store')
    return whatsapp.status(publicOrigin(req))
  })
}
