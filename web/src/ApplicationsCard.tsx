import type { OfficeView } from '@sh/shared'
import { useState } from 'react'
import { Refusal, useAct } from './act.tsx'
import { applyAddress } from './crew/Applications.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * Applications to join (ADR 0190), for the office: whether the public Apply page takes them. Off until the office says,
 * so the page isn't open to anyone until someone is ready to read what comes in. Nothing is ever sent to whoever applies,
 * so it doesn't wait on launch. Turning it off keeps every application already in.
 */
export function ApplicationsCard({ office }: { office: OfficeView }) {
  const { run, error } = useAct()
  const [copied, setCopied] = useState(false)
  const on = office.takeApplications
  const address = applyAddress()
  return (
    <section className="card" aria-label="Applications to join">
      <h2>
        Applications to join <Pending pending={office.applicationsPending} />
      </h2>
      <p>
        A page anyone can open to apply to join the crew, with no sign-in: their name, contact details, department, what they do, their day rate and
        experience. Each one waits under Crew › Applications, where you take them on as an applicant or turn them down. Nothing is sent to them.
      </p>
      <label className="signal">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => void run(() => client.mutate('applications.use', { on: e.target.checked }))} />
        <span>
          <b>Take applications</b>
          <small>{on ? `On: anyone with the address can apply, at ${address}.` : 'Off: the page says to get in touch with the office instead.'}</small>
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
