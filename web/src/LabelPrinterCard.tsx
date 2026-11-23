import { printerWords, type PrinterSetup, type PrinterState } from '@sh/shared'
import { useState } from 'react'
import { Confirm, Refusal, useAct } from './act.tsx'
import { when } from './format.ts'
import { Heading } from './Icon.tsx'
import { post } from './server.ts'
import { usePrinter } from './stock/printer.ts'
import { sendToZebra, useZebra } from './stock/zebra.ts'
import { StatusPill } from './StatusPill.tsx'

/**
 * The label printer over the internet (ADR 0191), under Admin › Connections:
 * the switch, the setup file that pairs the ZT411 with the app, and how the
 * printer is. The printer connects out to the app by itself once it has the
 * file, so any device signed in can print on it, a phone too; Zebra Browser
 * Print and the downloaded file still work beside it.
 *
 * The setup file holds a new password, made when it's asked for and kept
 * nowhere the app can read it back, so it's shown once: sent to the printer
 * straight away through Browser Print, or downloaded. A new file stops the
 * old password working.
 */

export const SETUP_GUIDE = 'https://github.com/sessionhire/sess-sys/blob/main/docs/zt411-weblink-setup.md'

const save = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function LabelPrinterCard() {
  const { printer, set } = usePrinter()
  const { run, error } = useAct()
  // Shown turned at once, while the server is asked; back as it was if it says no.
  const [turning, setTurning] = useState<boolean>()
  const on = turning ?? !!printer?.on
  const turn = (to: boolean) => {
    setTurning(to)
    void run(async () => set(await post<PrinterState>('/api/printer/use', { on: to }))).finally(() => setTurning(undefined))
  }
  return (
    <section className="card" aria-labelledby="label-printer-card">
      <Heading icon="print" id="label-printer-card">
        Label printer
      </Heading>
      <p>
        The Zebra ZT411 connects to the app over the internet by itself, so labels print from any phone or computer signed in, with whether it's
        ready, out of labels or has its head open shown beside Print. Zebra Browser Print and the downloaded file still work as before.
      </p>
      {!printer ? (
        <p className="hint">This needs signal: it's asked of the server.</p>
      ) : (
        <label className="signal">
          <input type="checkbox" role="switch" checked={on} onChange={(e) => turn(e.target.checked)} />
          <span>
            <b>Print over the internet</b>
            <small>{on ? 'The paired printer may connect, and Print sends labels to it.' : 'Off: no printer may connect, and Print uses this computer or the file.'}</small>
          </span>
        </label>
      )}
      <Refusal error={error} />
      {printer && printer.on && on && <Pairing printer={printer} set={set} />}
    </section>
  )
}

function Pairing({ printer, set }: { printer: PrinterState; set: (s: PrinterState) => void }) {
  const { run, error } = useAct()
  const [setup, setSetup] = useState<PrinterSetup>()
  const [asking, setAsking] = useState<'pair' | 'forget'>()
  const [making, setMaking] = useState(false)
  const words = printerWords(printer)
  const moved = printer.paired && printer.pairedAddress && printer.pairedAddress !== printer.address
  const make = () => {
    setAsking(undefined)
    setMaking(true)
    void run(async () => {
      const made = await post<PrinterSetup>('/api/printer/pair')
      setSetup(made)
      set(made.state)
    }).finally(() => setMaking(false))
  }
  const forget = () => {
    setAsking(undefined)
    setSetup(undefined)
    void run(async () => set(await post<PrinterState>('/api/printer/forget')))
  }
  return (
    <>
      {printer.paired && (
        <div className="printer-status">
          <p className="printer-line">
            <StatusPill tone={words.tone}>{words.pill}</StatusPill>
            <span>
              {printer.name || 'ZT411'}
              {printer.serial ? `, serial ${printer.serial}` : ', not connected yet'}
              <small>
                {words.help ? `${words.help} ` : ''}
                {printer.lastSeen ? `Last heard from ${when(printer.lastSeen)}.` : 'Waiting for it to connect with its setup file.'}
              </small>
            </span>
          </p>
        </div>
      )}
      {moved && (
        <p className="alert" role="status">
          The app's address has changed since the setup file was made: the printer still goes to {printer.pairedAddress}. Make a new setup file and send
          it to the printer.
        </p>
      )}
      <p className="hint">
        The printer connects to <b className="printer-address">{printer.address}</b>. Setting it up the first time, and what to do when the app's address
        changes: <a href={SETUP_GUIDE} target="_blank" rel="noreferrer">the ZT411 setup guide</a>.
      </p>
      {asking === 'pair' ? (
        <Confirm question="Make a new setup file?" yes="Make a new file" no="Keep the old one" onYes={make} onNo={() => setAsking(undefined)}>
          <p>The printer's present password stops working, so it disconnects until it's sent the new file.</p>
        </Confirm>
      ) : asking === 'forget' ? (
        <Confirm question="Forget this printer?" yes="Forget it" no="Keep it" loss onYes={forget} onNo={() => setAsking(undefined)}>
          <p>It disconnects, and can't connect again until it's sent a new setup file.</p>
        </Confirm>
      ) : (
        <div className="actions">
          <button type="button" className={printer.paired ? undefined : 'primary'} aria-busy={making} disabled={making} onClick={() => (printer.paired ? setAsking('pair') : make())}>
            {printer.paired ? 'Make a new setup file' : 'Make the setup file'}
          </button>
          {printer.paired && (
            <button type="button" onClick={() => setAsking('forget')}>
              Forget the printer
            </button>
          )}
        </div>
      )}
      <Refusal error={error} />
      {setup && <SetupFile setup={setup} />}
    </>
  )
}

/** The file, shown once: sent to the printer through Browser Print, or saved to send another way. */
function SetupFile({ setup }: { setup: PrinterSetup }) {
  const { zebra } = useZebra()
  const [sent, setSent] = useState<{ ok: boolean; words: string }>()
  const [sending, setSending] = useState(false)
  const send = async () => {
    if (!zebra) return
    setSending(true)
    try {
      await sendToZebra(zebra, [setup.file])
      setSent({ ok: true, words: `Sent to ${zebra.device.name || 'the ZT411'}. It restarts, then connects within a minute.` })
    } catch (e) {
      setSent({ ok: false, words: e instanceof Error ? e.message : "The ZT411 couldn't be reached through Browser Print." })
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="printer-setup" role="group" aria-label="The setup file">
      <p className="warn-line">
        The setup file holds the printer's password and is shown only now. Send it to the printer, or save it somewhere safe until you do.
      </p>
      {setup.noCertificate && (
        <p className="hint">
          It has no certificate in it: {setup.noCertificate} The guide says what to send the printer instead.
        </p>
      )}
      {sent && (
        <p className={sent.ok ? 'hint' : 'alert'} role="status">
          {sent.words}
        </p>
      )}
      <div className="actions">
        {zebra && (
          <button type="button" className="primary" aria-busy={sending} disabled={sending} onClick={() => void send()}>
            Send to the printer
          </button>
        )}
        <button type="button" className={zebra ? undefined : 'primary'} onClick={() => save('zt411-setup.zpl', setup.file)}>
          Download the setup file
        </button>
        {setup.certificate && (
          <button type="button" onClick={() => save('WEBLINK1_CA.NRD', setup.certificate!)}>
            Download the certificate
          </button>
        )}
      </div>
    </div>
  )
}
