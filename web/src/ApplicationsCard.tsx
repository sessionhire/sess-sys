import type { MailboxStatus, OfficeView } from '@sh/shared'
import { useState } from 'react'
import { Refusal, useAct } from './act.tsx'
import { applyAddress } from './crew/Applications.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'
import { getJson, useAsked } from './jobs/rms.ts'

/**
 * Applications to join (ADR 0190), for the office: whether the public Apply page takes them. Off until the office says,
 * so the page isn't open to anyone until someone is ready to read what comes in. Turning it off keeps every application
 * already in. Emailing them when they're taken on or turned down (ADR 0193) is a switch of its own, off until launch, as
 * every way the app reaches anyone outside it is (ADR 0048).
 */
export function ApplicationsCard({ office }: { office: OfficeView }) {
  const { run, error } = useAct()
  const [copied, setCopied] = useState(false)
  const on = office.takeApplications
  // Whether the mailbox the emails go from can send (user flows of 24 November 2026, gap 7): said on the switch, as a quote's
  // Send says it, so "On" isn't read as "they're being told" while nothing can go.
  const mailbox = useAsked(office.emailApplicants, 'mailbox', () => getJson<MailboxStatus>('/api/assistant/mailbox'))
  const cantSend = office.emailApplicants && mailbox.state === 'ready' && !(mailbox.data.available && mailbox.data.state === 'on' && !!mailbox.data.canSend)
  const address = applyAddress()
  return (
    <section className="card" aria-label="Applications to join">
      <h2>
        Applications to join <Pending pending={office.applicationsPending} />
      </h2>
      <p>
        A page anyone can open to apply to join the crew, with no sign-in: their name, contact details, what they do, their day rate, experience and,
        if they like, their payment details. Each one waits under Crew › Applications, where you take them on as an applicant or turn them down.
      </p>
      <label className="signal">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => void run(() => client.mutate('applications.use', { on: e.target.checked }))} />
        <span>
          <b>Take applications</b>
          <small>{on ? `On: anyone with the address can apply, at ${address}.` : 'Off: the page says to get in touch with the office instead.'}</small>
        </span>
      </label>
      <label className="signal">
        <input
          type="checkbox"
          role="switch"
          checked={office.emailApplicants}
          onChange={(e) => void run(() => client.mutate('applications.email', { on: e.target.checked }))}
        />
        <span>
          <b>Email people who apply</b>
          <small>
            {office.emailApplicants
              ? 'On: taken on, they get an email with the link to their own page; turned down, a polite one. Sent from the operations mailbox, and the Apply page says so before they send.'
              : 'Off: nothing is sent to them, and you get in touch the usual way. Turn it on at launch.'}
          </small>
          {cantSend && (
            <small className="warn-line" role="note">
              The operations mailbox can't send just now, so these emails wait, and are given up on after a day. Connect it under <a href="#admin/connections">Admin › Connections</a>;
              any that didn't go are listed on <a href="#crew/applications">Crew › Applications</a>.
            </small>
          )}
        </span>
      </label>
      <label className="signal">
        <input type="checkbox" role="switch" checked={office.askPpsn} onChange={(e) => void run(() => client.mutate('applications.ppsn', { on: e.target.checked }))} />
        <span>
          <b>Ask for PPS numbers</b>
          <small>
            {office.askPpsn
              ? 'On: the Apply page, their own page and the Payment details card ask for one. Keep it on only if you use them with Revenue, such as for payroll or Form 46G: the law allows nothing else.'
              : 'Off: nobody is asked for a PPS number. Any already kept stay until changed.'}
          </small>
        </span>
      </label>
      {on && (
        <div className="actions">
          <a className="button" href="#crew/applications">
            See applications
          </a>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(address).then(() => setCopied(true))}>
            {copied ? 'Copied' : 'Copy address'}
          </button>
        </div>
      )}
      <Refusal error={error} />
    </section>
  )
}
