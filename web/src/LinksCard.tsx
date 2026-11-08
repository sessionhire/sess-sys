import type { OfficeView } from '@sh/shared'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * Freelancers' links, made safer (ADR 0114), for the office. A link
 * remembers every phone it's opened on, whether this is on or off. On, a
 * phone the link hasn't seen asks for a code by email before it opens, and
 * a freelancer who lost their link can have it emailed. Both send from the
 * operations mailbox, so it stays off until the company is contacting
 * people (launch), and a freelancer's link works exactly as before.
 */
export function LinksCard({ office }: { office: OfficeView }) {
  const { run, error } = useAct()
  const on = office.checkLinks
  return (
    <section className="card" aria-label="Freelancers' links">
      <h2>
        Freelancers' links <Pending pending={office.linksPending} />
      </h2>
      <p>
        Each link already remembers the phones it's opened on. With this on, a new phone is asked for a code, emailed to the freelancer from the
        operations mailbox, so a forwarded link can't be used by someone else. A freelancer who has lost their link can have it emailed from the
        "Lost your link?" page. With no email for them, or no mailbox, they ring the office for a new link, which opens on the first phone to use it.
      </p>
      <label className="signal">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => void run(() => client.mutate('links.check', { on: e.target.checked }))} />
        <span>
          <b>Check new phones</b>
          <small>{on ? 'A new phone needs a code by email, and lost links can be emailed.' : 'Off: a link opens on any phone, as before, and nothing is emailed.'}</small>
        </span>
      </label>
      <Refusal error={error} />
    </section>
  )
}
