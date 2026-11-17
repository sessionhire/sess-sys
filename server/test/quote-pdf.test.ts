import { quoteTotals, type Quote, type QuoteLine } from '@sh/shared'
import { describe, expect, it } from 'vitest'
import { quotePdf, type Sheet } from '../src/finance/quote-pdf.ts'

/** The emailed PDF with the company's logo and the office's own words on it (ADR 0128). */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const lines: QuoteLine[] = [
  { id: 'w', kind: 'other', what: 'All cabling and power included', ref: null, group: 'PA', qty: 1, days: 1, unitCents: 0, vat: '23', per: 'once', modelId: null, words: true },
  { id: 'a', kind: 'other', what: 'PA speakers', ref: null, group: 'PA', qty: 2, days: 1, unitCents: 5_000, vat: '23', per: 'once', modelId: null },
]
const q = { id: 'q', projectId: 'p', version: 1, status: 'draft', lines, discountPct: 0, notes: '', forName: 'Ciarán Walsh' } as unknown as Quote
const sheet = (logo?: Sheet['logo']): Sheet => ({
  q,
  totals: quoteTotals(q),
  job: { name: 'Wedding', span: { start: '2026-12-01', end: '2026-12-02' }, venue: undefined, client: { id: 'c', name: 'Bright Events', notes: '', contacts: [{ name: 'Aoife Byrne', role: 'Producer', email: null, phone: null }] } },
  office: undefined,
  quoting: { terms: '', bank: '' },
  today: '2026-11-09',
  ...(logo ? { logo } : {}),
})

describe('quotePdf', () => {
  it('draws the logo, a line of words and who it is for', async () => {
    const pdf = await quotePdf(sheet({ data: PNG, type: 'png' }))
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString('latin1')).toContain('/Subtype /Image')
  })
  it('prints the name in words when the logo is a kind a PDF cannot carry, or not a picture at all', async () => {
    for (const logo of [{ data: PNG, type: 'webp' }, { data: Buffer.from('not a picture'), type: 'png' }]) {
      const pdf = await quotePdf(sheet(logo))
      expect(pdf.toString('latin1')).not.toContain('/Subtype /Image')
    }
  })
  it('carries the company as the law names it along the foot, on a quote long enough for two pages (ADR 0181)', async () => {
    const long = { ...q, lines: Array.from({ length: 60 }, (_, i) => ({ ...lines[1], id: `l${i}`, what: `Item ${i}` })) } as Quote
    const office = { id: 'office', name: 'Session Hire office', phone: null, email: null, tradingName: 'Session Hire', legalName: 'Session Hire Productions Limited', croNumber: '612345', registeredAddress: 'Unit 4\nDublin 12', directors: 'Aoife Byrne, Sam Lee (British)', vatNumber: 'IE 1234567T' }
    const pdf = await quotePdf({ ...sheet(), q: long, totals: quoteTotals(long), office })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString('latin1')).toMatch(/\/Count [2-9]/)
  })
})
