import type { FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/**
 * IBM Plex Sans for the pages the server draws (a freelancer's link, a client's quote, a timesheet), from the same
 * @fontsource files the app bundles, so crew and clients read one face in the app and on their link (Colly's call of
 * 30 October 2026, carried to these pages after the design system audit of 16 November 2026). The pages have no build,
 * so the server hands the files out itself, at addresses that never change, and the page's policy lets them in
 * (`font-src 'self'`). Latin and Latin Extended, as the app loads them, so a Polish or Czech name keeps its letters.
 */
const WEIGHTS = [400, 500, 600, 700] as const
const SUBSETS = {
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext':
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
} as const

/** Where the pages fetch a face from. */
export const PAGE_FONTS = '/page-fonts'

const fileName = (subset: keyof typeof SUBSETS, weight: number) => `ibm-plex-sans-${subset}-${weight}-normal.woff2`

/** The faces as a page's style declares them. */
export const FONT_FACES = WEIGHTS.flatMap((weight) =>
  (Object.keys(SUBSETS) as (keyof typeof SUBSETS)[]).map(
    (subset) =>
      `@font-face{font-family:'IBM Plex Sans';font-style:normal;font-display:swap;font-weight:${weight};src:url(${PAGE_FONTS}/${fileName(subset, weight)}) format('woff2');unicode-range:${SUBSETS[subset]}}`,
  ),
).join('')

/** The face first, then the phone's own while it loads or if it can't. */
export const FONT_STACK = `'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif`

/** Hands out the faces, read once. A file the list doesn't name is a 404, so nothing else in the package can be asked for. */
export function registerPageFonts(app: FastifyInstance) {
  const files = new Map<string, Buffer | null>()
  for (const weight of WEIGHTS) for (const subset of Object.keys(SUBSETS) as (keyof typeof SUBSETS)[]) files.set(fileName(subset, weight), null)
  let folder: string | null | undefined
  const read = (name: string): Buffer | null => {
    if (!files.has(name)) return null
    const kept = files.get(name)
    if (kept) return kept
    try {
      folder ??= join(dirname(createRequire(import.meta.url).resolve('@fontsource/ibm-plex-sans/LICENSE')), 'files')
      const data = readFileSync(join(folder, name))
      files.set(name, data)
      return data
    } catch {
      return null
    }
  }
  app.get<{ Params: { file: string } }>(`${PAGE_FONTS}/:file`, { config: { public: true } }, async (request, reply) => {
    const data = read(request.params.file)
    if (!data) return reply.code(404).send({ error: 'Not found' })
    return reply.header('content-type', 'font/woff2').header('cache-control', 'public, max-age=2592000').send(data)
  })
}
