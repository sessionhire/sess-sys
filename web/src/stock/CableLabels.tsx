import { barcode, barcodeFits, CABLE_COLOURS, colourForLength, lengthFromName, lengthLabel, plural, qrCode, type CableColour, type ModelView } from '@sh/shared'
import { useMemo, useState } from 'react'
import { Heading } from '../Icon.tsx'
import { Swatch } from '../LabelsCard.tsx'
import { useLabelLogo } from '../Picture.tsx'
import { useView } from '../view.ts'
import { PrintSheet, usePrinting } from './Labels.tsx'

/**
 * Cable labels (ADR 0095): what a cable is, such as "10 m XLR", in big
 * type, printed here for any product, as many as asked for. Everyday
 * cables are counted rather than numbered, so these carry the product, not
 * an item's number: its name or other words typed, and if wanted its stock
 * code as a QR code or as a long thin barcode, which scanned in the Stock
 * search opens the product. They print through the browser's print dialog
 * on a label printer, as an item's labels do (ADR 0015).
 *
 * Its length goes on in big type with the colour the company gives that
 * length (ADR 0106), and the company's logo once there is one. A label
 * printer prints black only, so the colour is a word in a black band, read
 * in black alone; on a colour printer, ticked as one, the band prints in
 * the colour itself.
 */

/** The labels a cable takes, each one to a page on a label printer. */
export const CABLE_LAYOUTS = {
  wrap: { name: 'Wrap round, 50 × 25 mm', hint: 'Self-laminating: the clear tail wraps over the print.', page: '50mm 25mm' },
  flag: { name: 'Flag, 100 × 25 mm', hint: 'Round the cable and stuck to itself: it says it on both sides.', page: '100mm 25mm' },
  bag: { name: 'Bag or bin, 50 × 25 mm', hint: 'For the bag, bin or tub the cables are kept in.', page: '50mm 25mm' },
  bigbag: { name: 'Bag or bin, 100 × 25 mm', hint: 'The same, with room for bigger type.', page: '100mm 25mm' },
} as const
export type CableLayout = keyof typeof CABLE_LAYOUTS

/** What goes in the code on a cable label. */
export const CABLE_CODES = { barcode: 'Barcode', qr: 'QR code', none: 'No code' } as const
export type CableCode = keyof typeof CABLE_CODES

/** The most printed at once, as for an item's labels. */
const MOST = 500

const KEY = 'sh.cableLabels'
interface Saved {
  layout: CableLayout
  code: CableCode
  /** This device's printer prints colour (ADR 0106), so the length's band is printed in its colour. */
  colour: boolean
}
/** The layout, code and printer used last on this device, since it's usually the same printer and labels. */
function saved(): Saved {
  const out: Saved = { layout: 'wrap', code: 'barcode', colour: false }
  try {
    const was = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    if (typeof was.layout === 'string' && was.layout in CABLE_LAYOUTS) out.layout = was.layout as CableLayout
    if (typeof was.code === 'string' && was.code in CABLE_CODES) out.code = was.code as CableCode
    out.colour = was.colour === true
  } catch {
    // Storage blocked or spoilt: the first of each, then.
  }
  return out
}

/** Type as big as fits the room on one line, in millimetres: a bold letter is about 0.7 of its height wide; no bigger than `most`, and long words go onto a second line rather than very small. */
const fit = (words: string, widthMm: number, most: number) => Math.max(3.2, Math.min(most, widthMm / (Math.max(words.length, 1) * 0.7)))

/** A Code 128 barcode, its bars a module apart, with its words under it. */
function Bars({ text }: { text: string }) {
  const b = useMemo(() => barcode(text), [text])
  if (!b) return null
  // The white a scanner needs either side, in modules.
  const quiet = 10
  return (
    <div className="bars">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${-quiet} 0 ${b.width + quiet * 2} 1`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Barcode for ${text}`}
      >
        <rect x={-quiet} y={0} width={b.width + quiet * 2} height={1} fill="#fff" />
        <path d={b.path} fill="#000" />
      </svg>
      <small>{text}</small>
    </div>
  )
}

function Qr({ text }: { text: string }) {
  const { size, path } = useMemo(() => qrCode(text), [text])
  const quiet = 2
  const side = size + quiet * 2
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="qr"
      viewBox={`${-quiet} ${-quiet} ${side} ${side}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${text}`}
    >
      <rect x={-quiet} y={-quiet} width={side} height={side} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}

/** What's on every label of a run: the words, the code, and the length with its colour. */
interface Says {
  words: string
  code: string
  kind: CableCode
  /** The length in metres, when it's to go on. */
  length: number | null
  colour: CableColour | undefined
  /** Print the band in its colour, on a colour printer; black otherwise. */
  inColour: boolean
  logo: string | undefined
}

/** The length's colour as a word in a band: black with white type on a label printer, the colour itself on a colour one. */
function Band({ colour, inColour }: { colour: CableColour; inColour: boolean }) {
  const { name, hex } = CABLE_COLOURS[colour]
  const light = colour === 'white' || colour === 'yellow' || colour === 'pink' || colour === 'orange' || colour === 'grey' || colour === 'sky'
  return (
    <span className={`band${inColour ? ' in-colour' : ''}`} style={inColour ? { background: hex, color: light ? '#000' : '#fff' } : undefined}>
      {name.toUpperCase()}
    </span>
  )
}

/** What one end of a label says: the length and its colour, the words, the code if there is one (written out too, under a barcode or beside a QR code), and the logo. */
function Face({ s, widthMm }: { s: Says; widthMm: number }) {
  const qr = s.kind === 'qr' && s.code
  const bars = s.kind === 'barcode' && s.code
  // A QR code takes 19 mm of the width; a barcode a row under the words.
  const room = qr ? widthMm - 21 : widthMm - 3
  const head = s.length !== null || s.logo
  return (
    <div className={`face${qr ? ' with-qr' : ''}`}>
      {qr && <Qr text={s.code} />}
      <div className="words">
        {head && (
          <span className="head">
            {s.length !== null && <span className="length">{lengthLabel(s.length)}</span>}
            {s.length !== null && s.colour && <Band colour={s.colour} inColour={s.inColour} />}
            {s.logo && <img className="logo" src={s.logo} alt="Session Hire" />}
          </span>
        )}
        <b style={{ fontSize: `${fit(s.words, room, head ? (bars ? 4.2 : 5.5) : bars ? 6.5 : qr ? 7 : 10)}mm` }}>{s.words}</b>
        {bars && <Bars text={s.code} />}
        {/* The stock code in words; not the name again when the QR code holds the name, as a product without a code has. */}
        {qr && s.code !== s.words && <small className="code">{s.code}</small>}
      </div>
    </div>
  )
}

/** One cable label, as it prints: a flag says it at both ends, the middle round the cable left blank. */
export function CableLabel({ s, layout }: { s: Says; layout: CableLayout }) {
  return (
    <div className={`label cable ${layout}`}>
      <Face s={s} widthMm={layout === 'flag' ? 40 : layout === 'bigbag' ? 100 : 50} />
      {layout === 'flag' && (
        <>
          <span className="round" aria-hidden />
          <Face s={s} widthMm={40} />
        </>
      )}
    </div>
  )
}

/** Cable labels for a product: what they say, which label, the code on them, how many, and Print. */
export function CableLabels({ m }: { m: ModelView }) {
  const office = useView().office
  const logo = useLabelLogo(office)
  const first = useMemo(saved, [])
  const [words, setWords] = useState(m.name)
  const [layout, setLayout] = useState<CableLayout>(first.layout)
  // A barcode with nothing to hold prints no code, so a product without a stock code a barcode takes starts on a QR code,
  // keeping the device's own choice otherwise (audit, 5 November 2026, finding 72).
  const [kind, setKind] = useState<CableCode>(() => (first.code === 'barcode' && !barcodeFits(m.code.trim()) ? 'qr' : first.code))
  const [inColour, setInColour] = useState(first.colour)
  // Its own length, or one read from its name, such as "XLR 10m", until one is given.
  const named = m.lengthM === null ? lengthFromName(m.name) : null
  const length = m.lengthM ?? named
  const [showLength, setShowLength] = useState(true)
  const colour = colourForLength(length, office.cableColours)
  const [count, setCount] = useState('2')
  const [printing, setPrinting] = usePrinting()
  const remember = (next: Partial<Saved>) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ layout, code: kind, colour: inColour, ...next }))
    } catch {
      // Remembered for this page only.
    }
  }
  const stockCode = m.code.trim()
  // A barcode holds the stock code, which the Stock search finds; a QR code holds it too, or the name where there's none.
  const code = kind === 'barcode' ? (barcodeFits(stockCode) ? stockCode : '') : kind === 'qr' ? stockCode || m.name : ''
  const noBarcode = kind === 'barcode' && !code
  const said = words.trim()
  const n = Number(count)
  const many = Number.isInteger(n) && n >= 1 && n <= MOST ? n : 0
  const says: Says = { words: said, code, kind, length: showLength ? length : null, colour, inColour, logo }
  return (
    <section className="card cable-labels" aria-label="Cable labels">
      <Heading icon="label">Cable labels</Heading>
      <p className="hint">Big type saying what it is, for each end of a cable or the bag it lives in.</p>
      <div className="grid-form">
        <label className="wide">
          What they say <input value={words} maxLength={40} onChange={(e) => setWords(e.target.value)} placeholder="Such as 10 m XLR" />
        </label>
        <label>
          How many{' '}
          <input type="number" inputMode="numeric" min={1} max={MOST} value={count} onChange={(e) => setCount(e.target.value)} aria-invalid={!many} />
        </label>
      </div>
      <fieldset className="layouts">
        <legend>Label</legend>
        {(Object.keys(CABLE_LAYOUTS) as CableLayout[]).map((l) => (
          <label key={l} className="tick">
            <input
              type="radio"
              name="cable-layout"
              checked={layout === l}
              onChange={() => {
                setLayout(l)
                remember({ layout: l })
              }}
            />
            <span>
              {CABLE_LAYOUTS[l].name}
              <small>{CABLE_LAYOUTS[l].hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="layouts">
        <legend>Code on it</legend>
        {(Object.keys(CABLE_CODES) as CableCode[]).map((c) => (
          <label key={c} className="tick">
            <input
              type="radio"
              name="cable-code"
              checked={kind === c}
              onChange={() => {
                setKind(c)
                remember({ code: c })
              }}
            />
            <span>{CABLE_CODES[c]}</span>
          </label>
        ))}
      </fieldset>
      {length !== null && (
        <fieldset className="layouts">
          <legend>Length</legend>
          <label className="tick">
            <input type="checkbox" checked={showLength} onChange={(e) => setShowLength(e.target.checked)} />
            <span>
              {lengthLabel(length)} in big type{colour ? `, and ${CABLE_COLOURS[colour].name.toLowerCase()} for its length` : ''}
              <small>
                {named !== null
                  ? 'Read from its name. Give its length under Details to be sure.'
                  : colour
                    ? `Put ${CABLE_COLOURS[colour].name.toLowerCase()} tape or heat-shrink on it too: the label says the colour, the tape shows it.`
                    : 'Longer than any length given a colour under Admin › Company › Labels.'}
              </small>
            </span>
            {colour && <Swatch colour={colour} />}
          </label>
          {colour && (
            <label className="tick">
              <input
                type="checkbox"
                checked={inColour}
                onChange={(e) => {
                  setInColour(e.target.checked)
                  remember({ colour: e.target.checked })
                }}
              />
              <span>
                This printer prints colour
                <small>Then the band prints in {CABLE_COLOURS[colour].name.toLowerCase()}. A label printer such as a Zebra prints black only, so leave this off.</small>
              </span>
            </label>
          )}
        </fieldset>
      )}
      {length === null && <p className="hint">Give it a length under Details, such as 10, and its labels say it in big type with its colour.</p>}
      {noBarcode ? (
        <p className="hint" role="note">
          {stockCode
            ? 'Its stock code has letters a barcode can’t hold. Give it one of plain letters, numbers and dashes under Details, or print a QR code.'
            : 'A barcode holds the product’s stock code, and it has none yet. Give it one under Details, such as XLR-10M, or print a QR code.'}
        </p>
      ) : kind !== 'none' ? (
        <p className="hint">
          {kind === 'barcode'
            ? 'Run the barcode along the cable. Scanned in the Stock search, it opens this product.'
            : 'Scanned in the Stock search, it opens this product.'}
        </p>
      ) : null}
      <div className="preview" aria-label="Preview">
        {said && <CableLabel s={says} layout={layout} />}
      </div>
      <p className="hint">Print at actual size, not fitted to the page.</p>
      <button type="button" className="primary" disabled={!said || !many || printing} onClick={() => setPrinting(true)}>
        {(many === 1 ? 'Print the label' : `Print ${plural(many || 0, 'label')}`) + (code ? '' : ' without a code')}
      </button>
      {printing && (
        <PrintSheet className={`cable ${layout}`} page={CABLE_LAYOUTS[layout].page}>
          {Array.from({ length: many }, (_, i) => (
            <div key={i} className="page">
              <CableLabel s={says} layout={layout} />
            </div>
          ))}
        </PrintSheet>
      )}
    </section>
  )
}
