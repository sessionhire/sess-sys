import { describe, expect, it } from 'vitest'
import { zplGraphic, zplLabel, zplLabels, zplLogoBox, zplText } from '../src/zpl.ts'

describe('labels for the ZT411', () => {
  it('sizes each layout in 300 dpi dots', () => {
    expect(zplLabel({ number: 'SH-000123' }, 'wide')).toMatch(/^\^XA\^CI28\^PW591\^LL295\^LH0,0\n/)
    expect(zplLabel({ number: 'SH-000123' }, 'long')).toContain('^PW1181^LL295')
    expect(zplLabel({ number: 'SH-000123' }, 'square')).toContain('^PW295^LL295')
  })

  it('draws the QR code from the number, at the most error correction, and prints it once', () => {
    const z = zplLabel({ number: 'SH-000123', caption: 'd&b Y10P', code: 'Y10P' }, 'wide')
    expect(z).toMatch(/\^BQN,2,\d+\^FDHA,SH-000123\^FS/)
    expect(z).toContain('^FDd&b Y10P^FS')
    expect(z.trimEnd().endsWith('^PQ1^XZ')).toBe(true)
  })

  it('writes the name in words with no logo, and the logo as a graphic when there is one', () => {
    expect(zplLabel({ number: 'SH-000001' }, 'wide')).toContain('^FDSession Hire^FS')
    const logo = zplGraphic(16, 2, (x) => x < 8)
    const z = zplLabel({ number: 'SH-000001' }, 'wide', logo)
    expect(z).not.toContain('Session Hire')
    expect(z).toContain('^GFA,4,4,2,FF00FF00^FS')
  })

  it("keeps ZPL's own characters and a scanner's separators out of a field", () => {
    expect(zplText('Amp ^rack~ 2_b')).toBe('Amp _5Erack_7E 2_5Fb')
    expect(zplText('a\u001db')).toBe('a b')
    expect(zplText('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`)
  })

  it('pads a graphic to whole bytes, white', () => {
    const g = zplGraphic(10, 1, () => true)
    expect(g).toEqual({ width: 16, height: 1, hex: 'FFC0' })
  })

  it('puts many labels one after another', () => {
    const all = zplLabels([{ number: 'SH-000001' }, { number: 'SH-000002' }, { number: 'SH-000003' }], 'square')
    expect(all.match(/\^XA/g)).toHaveLength(3)
    expect(all.match(/\^XZ/g)).toHaveLength(3)
  })

  it('fits the logo into each layout', () => {
    for (const l of ['wide', 'long', 'square'] as const) expect(zplLogoBox(l).maxWidth).toBeGreaterThan(zplLogoBox(l).height)
  })
})
