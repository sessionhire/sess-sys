import { LOGO_SIDE, mayChangeLogo, PHOTOS_WAIT, type OfficeView } from '@sh/shared'
import { useRef, useState } from 'react'
import { Confirm, Refusal, useAct } from './act.tsx'
import { refusal, useDocumentStorage } from './crew/Documents.tsx'
import { Icon } from './Icon.tsx'
import { measurePicture, shrinkPhoto } from './photo-file.ts'
import { logoOf } from './Picture.tsx'
import { useAccess } from './role.ts'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'
import { useLate } from './useLate.ts'

/**
 * The company's logo, in one place (ADR 0155): put up once here, it heads
 * every printed quote and its PDF and prints on every stock and cable label
 * (ADR 0106, ADR 0128, ADR 0139). The card shows it as each of those has it,
 * says what kind of file works best before anyone goes looking for one, and
 * says so when the one sent is small or the wrong shape, rather than
 * refusing it. The file goes straight to the server, as a product's photo
 * does, made a 1200-pixel PNG on white on the device first.
 */

const base = import.meta.env.VITE_API_BASE ?? ''

async function call(init: RequestInit) {
  let res: Response
  try {
    res = await fetch(`${base}/api/settings/logo/photo?${new URLSearchParams({ client: client.clientId })}`, {
      ...init,
      signal: AbortSignal.timeout(120_000),
    })
  } catch {
    throw new Error('Not changed: the logo needs signal. Try again when you have it.')
  }
  if (!res.ok) throw await refusal(res)
}

/** Below this many pixels across, a logo prints soft on a quote: 67 mm at about 200 dpi. */
export const LOGO_SHARP_WIDTH = 600

/** What's worth saying about the file just sent, if anything: too few pixels, or a shape that leaves it small on the quote. */
export function logoAdvice({ w, h, drawing }: { w: number; h: number; drawing: boolean }): string | undefined {
  if (!w || !h) return undefined
  const notes: string[] = []
  if (!drawing && w < LOGO_SHARP_WIDTH)
    notes.push(`It's ${w} pixels across, so it may print soft. One ${LOGO_SIDE} pixels across or more, or an SVG, prints sharp.`)
  if (w / h < 1.5)
    notes.push(
      'It is nearly square or tall, so it shows small at the top of a quote. A wide version, about three or four times as wide as it is tall, fills it.',
    )
  return notes.length ? `It's up. ${notes.join(' ')}` : undefined
}

export function LogoCard({ office }: { office: OfficeView }) {
  const access = useAccess()
  const storage = useDocumentStorage()
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const late = useLate(busy)
  const [removing, setRemoving] = useState(false)
  const [advice, setAdvice] = useState<string>()
  const { run, error } = useAct()
  const src = logoOf(office)
  const waits = !!storage && !storage.files
  const may = mayChangeLogo(access.role) && !waits
  const pure = office.logoBlackWhite

  const send = async (file: File | undefined) => {
    if (picker.current) picker.current.value = ''
    if (!file) return
    setBusy(true)
    setAdvice(undefined)
    const size = await measurePicture(file)
    const sent = await run(async () =>
      call({
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: await shrinkPhoto(file, { side: LOGO_SIDE, square: false, png: true }),
      }),
    )
    if (sent) setAdvice(logoAdvice(size))
    setBusy(false)
  }

  return (
    <section className="card logo-card" aria-labelledby="logo-card-head">
      <h2 id="logo-card-head">
        Logo <Pending pending={office.logoPending} />
      </h2>
      <p className="hint">Put up once, it heads every printed quote and its PDF, and prints on every stock and cable label.</p>

      {src ? (
        <div className="logo-places">
          <figure>
            <div className="on-quote">
              <img src={src} alt="The company logo, as a quote has it" />
            </div>
            <figcaption>On a quote, in colour</figcaption>
          </figure>
          <figure>
            <div className="on-label">
              <img src={src} alt="The company logo, as a label printer prints it" className={pure ? 'pure' : undefined} />
            </div>
            <figcaption>{pure ? 'On a label, pure black and white' : 'On a label, in black'}</figcaption>
          </figure>
        </div>
      ) : (
        <p className="empty">None yet. Quotes and labels say Session Hire in words until there is one.</p>
      )}

      {src && mayChangeLogo(access.role) && (
        <label className="signal">
          <input type="checkbox" role="switch" checked={pure} onChange={(e) => void run(() => client.mutate('logo.blackWhite', { on: e.target.checked }))} />
          <span>
            <b>Pure black and white on labels</b>
            <small>
              {pure
                ? 'Every grey and colour in the logo prints as solid black or white, for the sharpest print on a label printer. Pale parts drop out.'
                : 'Off: labels print the logo in shades of grey. Quotes are in colour either way.'}
            </small>
          </span>
        </label>
      )}

      {advice && (
        <p className="warn-line" role="status">
          {advice}
        </p>
      )}

      {waits ? (
        <p className="hint">{PHOTOS_WAIT}</p>
      ) : may && removing ? (
        <Confirm
          question="Take the logo down? Quotes and labels say Session Hire in words again."
          yes="Take it down"
          loss
          onYes={() => {
            setRemoving(false)
            setAdvice(undefined)
            void run(() => call({ method: 'DELETE' }))
          }}
          onNo={() => setRemoving(false)}
        />
      ) : may ? (
        <div className="actions">
          <label className="button" aria-busy={busy}>
            <Icon name="camera" />
            {late ? 'Sending…' : src ? 'Change logo' : 'Add the logo'}
            <input
              ref={picker}
              type="file"
              accept="image/svg+xml,.svg,image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => void send(e.target.files?.[0])}
            />
          </label>
          {src && (
            <button type="button" onClick={() => setRemoving(true)} disabled={busy}>
              Remove logo
            </button>
          )}
        </div>
      ) : null}
      <Refusal error={error} />

      <h3>What works best</h3>
      <dl className="logo-advice">
        <div>
          <dt>Kind of file</dt>
          <dd>SVG or PNG. A JPEG or WebP works too, and so does a photo from an iPhone, but its edges are less crisp.</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>
            At least {LOGO_SIDE} pixels across, or an SVG, which is sharp at any size. The app keeps it at {LOGO_SIDE} pixels on its longer side,
            enough for print.
          </dd>
        </div>
        <div>
          <dt>Shape</dt>
          <dd>Wide, about three or four times as wide as it is tall. A quote gives it up to 67 by 19 mm at the top left.</dd>
        </div>
        <div>
          <dt>Background</dt>
          <dd>See-through or white, with the logo in dark colours. It always sits on white paper, so a white or light logo would vanish.</dd>
        </div>
        <div>
          <dt>Edges</dt>
          <dd>Cropped close, with little empty space around it, so it fills the room it's given.</dd>
        </div>
        <div>
          <dt>Colours</dt>
          <dd>
            Quotes print it in colour. A label printer prints black only, so fine detail and pale colours drop out: see it above as a label has it.
          </dd>
        </div>
      </dl>
    </section>
  )
}
