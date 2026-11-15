import { describe, expect, it } from 'vitest'
import { quoteTotals } from '@sh/shared'
import { datesLine, logoBox, messageParagraphs, pictureSize, quoteEmailHtml } from '../src/finance/quote-email-html.ts'
import { mime } from '../src/finance/quote-email.ts'

const q = {
  id: 'q1', projectId: 'p', version: 1, status: 'sent', number: 1115, sentOn: '2026-11-15', validDays: 30, depositPct: 50, discountPct: 0, notes: '',
  lines: [{ id: 'a', kind: 'other', what: 'Delivery', ref: null, group: '', qty: 1, days: 1, per: 'once', unitCents: 10000, vat: '23', discountPct: 0 }],
} as never
const sheet = {
  q,
  totals: quoteTotals(q),
  job: { name: 'Launch <b>party</b>', span: { start: '2027-03-04', end: '2027-03-04' }, venue: { name: 'The Venue', address: 'Spencer Dock\nDublin 1' }, client: undefined },
  office: { phone: '+353 (0)1 234 5678', email: 'office@sessionhire.com', vatNumber: 'IE 1234567T', address: 'Unit 4\nDublin 3', legalName: 'Session Hire Productions Limited', croNumber: '612345', registeredAddress: null, directors: 'Aoife Byrne\nColm Hewson' },
  quoting: { terms: '', bank: '' },
  today: '2026-11-15',
} as never

describe('the quote email laid out (ADR 0187)', () => {
  it('puts the message, the summary, the button and the company foot in, everything typed escaped', () => {
    const url = 'https://app.example/q/abc'
    const html = quoteEmailHtml({ sheet, number: 1115, message: 'Hi <Ruairí>,\n\nSee https://example.ie/x.\nLine two\n\nTo accept it, use this link: https://app.example/q/abc\n\nThanks', fileName: 'Quote 1115 - Launch.pdf', acceptUrl: url, logoSrc: 'cid:logo@sessionhire', logoSize: { w: 764, h: 501 } })
    expect(html).toContain('Hi &lt;Ruairí&gt;,')
    expect(html).toContain('Launch &lt;b&gt;party&lt;/b&gt;')
    expect(html).not.toContain('<b>party')
    expect(html).toContain('<a href="https://example.ie/x" style=')
    expect(html).toContain('Line two')
    // The link's own paragraph gives way to the button.
    expect(html).not.toContain('To accept it, use this link')
    expect(html).toContain(`<a href="${url}" target="_blank"`)
    expect(html).toContain('€123.00')
    expect(html).toContain('A deposit of <span class="sh-ink" style="color:#16181d;font-weight:600;">€61.50</span>')
    expect(html).toContain('Thu 4 March 2027')
    expect(html).toContain('The Venue, Spencer Dock, Dublin 1')
    expect(html).toContain('href="tel:+35312345678"')
    expect(html).toContain('Session Hire is a trading name of Session Hire Productions Limited, registered in Ireland, number 612345.')
    expect(html).toContain('src="cid:logo@sessionhire" alt="Session Hire" height="44" width="67"')
    expect(html).toContain('prefers-color-scheme: dark')
  })

  it('leaves the button out while answers are not taken online, and writes the name where there is no logo', () => {
    const html = quoteEmailHtml({ sheet, number: 1115, message: 'Hi', fileName: 'Q.pdf' })
    expect(html).not.toContain('View and accept')
    expect(html).toContain('font-weight:800;color:#16181d;">Session Hire</span>')
  })

  it('says the days with the month and year once', () => {
    expect(datesLine({ start: '2027-03-04', end: '2027-03-05' })).toBe('Thu 4 to Fri 5 March 2027')
    expect(datesLine({ start: '2027-03-31', end: '2027-04-01' })).toBe('Wed 31 March to Thu 1 April 2027')
    expect(datesLine({ start: '2027-12-31', end: '2028-01-01' })).toBe('Fri 31 December 2027 to Sat 1 January 2028')
    expect(messageParagraphs('a\r\n\r\n\r\nb\nc')).toEqual(['a', 'b<br>c'])
  })

  it('reads a picture’s size, and draws a wide logo no wider than 200', () => {
    const png = Buffer.alloc(33)
    png.writeUInt32BE(0x89504e47, 0)
    png.writeUInt32BE(800, 16)
    png.writeUInt32BE(100, 20)
    expect(pictureSize(png)).toEqual({ w: 800, h: 100 })
    expect(logoBox({ w: 800, h: 100 })).toEqual({ w: 200, h: 25 })
    expect(logoBox({ w: 100, h: 100 })).toEqual({ w: 44, h: 44 })
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 50, 0, 120, 3, 0, 0, 0])
    expect(pictureSize(jpeg)).toEqual({ w: 120, h: 50 })
  })

  it('carries the logo inside the email beside the HTML, with the text first and the PDF after', () => {
    const raw = mime({
      from: { name: 'Session Hire', address: 'operations@sessionhire.com' },
      to: ['a@example.com'],
      replyTo: [],
      subject: 'Quote 1',
      text: 'Hi',
      html: '<p>Hi</p><img src="cid:logo@sessionhire">',
      inline: [{ cid: 'logo@sessionhire', name: 'logo.png', type: 'image/png', bytes: Buffer.from('PNG') }],
      attachment: { name: 'Quote 1.pdf', type: 'application/pdf', bytes: Buffer.from('%PDF-1.7') },
      date: new Date('2026-10-30T12:00:00Z'),
    }).toString('utf8')
    const order = ['multipart/mixed', 'multipart/alternative', 'text/plain', 'multipart/related', 'text/html', 'Content-Disposition: inline; filename="logo.png"', 'Content-ID: <logo@sessionhire>', 'application/pdf']
    const at = order.map((s) => raw.indexOf(s))
    expect(at.every((n) => n > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // Every boundary opened is closed.
    for (const b of raw.matchAll(/boundary="([^"]+)"/g)) expect(raw).toContain(`--${b[1]}--`)
  })
})
