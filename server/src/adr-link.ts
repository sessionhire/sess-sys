import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'

/**
 * /adr/<number>: a decision record on GitHub, by its number. What's changed
 * names the decisions behind each version, and each "Decision 0108" went to
 * the folder of them all rather than the one (audit, 5 November 2026,
 * finding 80). The app doesn't know the files' names; the server reads
 * them from docs/adr, and sends anything it can't find to the folder.
 */

const REPO = 'https://github.com/sessionhire/sess-sys'
const FOLDER = fileURLToPath(new URL('../../docs/adr', import.meta.url))

export function registerAdrLink(app: FastifyInstance, folder = FOLDER) {
  app.get<{ Params: { n: string } }>('/adr/:n', async (req, reply) => {
    const n = /^\d{1,4}$/.test(req.params.n) ? req.params.n.padStart(4, '0') : ''
    const files = n ? await readdir(folder).catch(() => [] as string[]) : []
    const file = files.find((f) => f.startsWith(`${n}-`) && f.endsWith('.md'))
    return reply.redirect(file ? `${REPO}/blob/main/docs/adr/${encodeURIComponent(file)}` : `${REPO}/tree/main/docs/adr`, 302)
  })
}
