import { plural, printerWords, ZPL_LAYOUTS, zplLabels, type ZplLabel, type ZplLayout } from '@sh/shared'
import { useState } from 'react'
import { useAccess } from '../role.ts'
import { StatusPill } from '../StatusPill.tsx'
import { printOnline, usePrinter } from './printer.ts'
import { sendToZebra, useZebra, useZplLogo } from './zebra.ts'

/**
 * Printing on the Zebra ZT411 (ADR 0178): the labels in the printer's own
 * language, sent to it over the internet by the app's server, which the
 * printer connects to itself (ADR 0191), so a phone prints too; or straight
 * to it through Zebra Browser Print on the computer it's set up on; or
 * downloaded as a file for it. Whichever way, the printer draws them itself,
 * so nothing is fitted to a page, and a whole run goes in one go. While it
 * prints over the internet, how it is (ready, head open, out of labels) sits
 * beside Print, so nobody sends a run to a printer that can't take it
 * without knowing.
 */

const ZPL_LAYOUT_KEY = 'sh.labels.zt411'
/** The label size used last on the ZT411 from this device. */
function savedLayout(): ZplLayout {
  try {
    const saved = localStorage.getItem(ZPL_LAYOUT_KEY)
    if (saved && saved in ZPL_LAYOUTS) return saved as ZplLayout
  } catch {
    // Storage blocked: the first size, then.
  }
  return 'wide'
}

/** Labels a job: small enough that the printer starts on the first while the rest are on their way. */
const PER_JOB = 100

export function ZebraPrint({ labels, file }: { labels: readonly ZplLabel[]; file: string }) {
  const [layout, setLayout] = useState<ZplLayout>(savedLayout)
  const logo = useZplLogo(layout)
  const { zebra, looking, again } = useZebra()
  const { printer, set: setPrinter } = usePrinter()
  const mayPrint = useAccess().can('stock')
  const set = !!printer?.on && printer.paired
  const online = set && printer.connected && mayPrint
  const words = printer && set ? printerWords(printer) : undefined
  const [sending, setSending] = useState<{ done: number; of: number }>()
  const [result, setResult] = useState<{ ok: boolean; words: string }>()
  const choose = (l: ZplLayout) => {
    setLayout(l)
    setResult(undefined)
    try {
      localStorage.setItem(ZPL_LAYOUT_KEY, l)
    } catch {
      // Remembered for this page only.
    }
  }
  const jobs = () => {
    const out: string[] = []
    for (let i = 0; i < labels.length; i += PER_JOB) out.push(zplLabels(labels.slice(i, i + PER_JOB), layout, logo))
    return out
  }
  const count = plural(labels.length, 'label')
  const send = async () => {
    if (!zebra) return
    const parts = jobs()
    setResult(undefined)
    setSending({ done: 0, of: labels.length })
    try {
      await sendToZebra(zebra, parts, (n) => setSending({ done: Math.min(n * PER_JOB, labels.length), of: labels.length }))
      setResult({ ok: true, words: `${count} sent to ${zebra.device.name || 'the ZT411'}.` })
    } catch (e) {
      setResult({
        ok: false,
        words: e instanceof Error && e.message.startsWith('The ZT411') ? e.message : "The ZT411 couldn't be reached. Check Zebra Browser Print is running, then Look again.",
      })
      again()
    } finally {
      setSending(undefined)
    }
  }
  const sendOnline = async () => {
    const parts = jobs()
    setResult(undefined)
    setSending({ done: 0, of: labels.length })
    try {
      const after = await printOnline(parts, (n) => setSending({ done: Math.min(n * PER_JOB, labels.length), of: labels.length }))
      setPrinter(after)
      const waits = after.status && !after.status.ready
      setResult({ ok: true, words: waits ? `${count} sent. They wait in the printer until it's put right.` : `${count} sent to ${after.name || 'the ZT411'}.` })
    } catch (e) {
      setResult({ ok: false, words: e instanceof Error ? e.message : "The ZT411 couldn't be reached." })
    } finally {
      setSending(undefined)
    }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob(jobs(), { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${file}.zpl`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const none = labels.length === 0
  return (
    <div className="zebra-print">
      <fieldset className="layouts">
        <legend>Label size</legend>
        {(Object.keys(ZPL_LAYOUTS) as ZplLayout[]).map((l) => (
          <label key={l} className="tick">
            <input type="radio" name="zt411-layout" checked={layout === l} onChange={() => choose(l)} />
            <span>{ZPL_LAYOUTS[l].name}</span>
          </label>
        ))}
      </fieldset>
      {words && (
        <p className="printer-line">
          <StatusPill tone={words.tone}>{words.pill}</StatusPill>
          <span>
            {printer?.name || 'ZT411'}
            {words.help && <small>{words.help}</small>}
          </span>
        </p>
      )}
      {sending ? (
        <p className="hint" role="status">
          Sending {sending.done.toLocaleString('en-IE')} of {plural(sending.of, 'label')}…
          <progress max={sending.of} value={sending.done} />
        </p>
      ) : (
        result && (
          <p className={result.ok ? 'hint' : 'alert'} role="status">
            {result.words}
          </p>
        )
      )}
      <div className="actions">
        {online && (
          <button type="button" className="primary" disabled={none || !!sending} aria-busy={!!sending} onClick={() => void sendOnline()}>
            {`Print ${count}`}
          </button>
        )}
        {zebra && (
          <button type="button" className={online ? undefined : 'primary'} disabled={none || !!sending} aria-busy={!online && !!sending} onClick={() => void send()}>
            {online ? 'Print from this computer' : `Print ${count}`}
          </button>
        )}
        <button type="button" className={zebra || online ? undefined : 'primary'} disabled={none} onClick={download}>
          Download for the ZT411
        </button>
      </div>
      {!zebra && !looking && !online && !set && (
        <p className="hint">
          To print straight from this computer, install Zebra Browser Print on it with the ZT411 as its default printer, then{' '}
          <button type="button" className="link" onClick={again}>
            look again
          </button>
          . The file prints from Zebra's own tools, or from a phone with Zebra's printing app.
        </p>
      )}
    </div>
  )
}
