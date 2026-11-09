import type { MoneyView } from '@sh/shared'
import { Refusal, useAct } from './act.tsx'
import { Pending } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * Clients accepting quotes online (ADR 0121), for the office. Each quote
 * already has its own link; with this on, the link shows the client the
 * quote and lets them accept it with their name and a tick, and an emailed
 * quote carries it. Off until the company is contacting clients (launch),
 * as every way the app reaches anyone outside is (ADR 0048): until then a
 * link shows nothing and takes nothing.
 */
export function OnlineCard({ money }: { money: MoneyView }) {
  const { run, error } = useAct()
  const on = !!money.quoting.acceptOnline
  return (
    <section className="card" aria-label="Quotes accepted online">
      <h2>
        Quotes accepted online <Pending pending={money.quoting.pending} />
      </h2>
      <p>
        Each quote sent has a link of its own for the client. With this on, the link shows them the quote, as a page and a PDF, and they accept it by typing
        their name and ticking a box. The quote is then marked accepted, with their name and the time, and the office is told. An emailed quote carries the
        link; a quote sent another way has it to copy, on its page.
      </p>
      <label className="signal">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => void run(() => client.mutate('quoting.online', { on: e.target.checked }))} />
        <span>
          <b>Let clients accept quotes online</b>
          <small>{on ? 'On: each quote with the client has its link, and an accept there marks it accepted.' : "Off: links show nothing of any quote, and clients answer by email or phone, as before."}</small>
        </span>
      </label>
      <Refusal error={error} />
    </section>
  )
}
