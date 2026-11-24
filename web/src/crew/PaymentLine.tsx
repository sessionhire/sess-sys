import { dayLabel, paymentLine, type MoneyView, type PaymentStanding } from '@sh/shared'
import { getJson, useAsked } from '../jobs/rms.ts'
import { useAccess } from '../role.ts'

/**
 * Where each person's payment details stand (user flows of 24 November 2026, gap 8), asked of the server by those who
 * see money: the details stay locked there, and only whether any are held and when they changed comes here. Undefined
 * while it isn't known (no signal, or a role that doesn't see money), when the rows say nothing rather than guess.
 */
export function usePaymentStanding(): ReadonlyMap<string, PaymentStanding> | undefined {
  const sees = useAccess().can('money')
  const asked = useAsked<{ people: PaymentStanding[] }>(sees, 'payment-standing', () => getJson('/api/payment/standing'))
  return sees && asked.state === 'ready' ? new Map(asked.data.people.map((p) => [p.personId, p])) : undefined
}

/** The day each person was last marked paid, from the timesheets paid. */
export function lastPaidBy(money: Pick<MoneyView, 'costsPaid'>): ReadonlyMap<string, string> {
  const out = new Map<string, string>()
  for (const c of money.costsPaid) {
    const id = c.row.person?.id
    if (id && c.paidOn && (out.get(id) ?? '') < c.paidOn) out.set(id, c.paidOn)
  }
  return out
}

/**
 * The line under a row where someone decides to pay: held, none yet, or changed on their own page and not paid to
 * since, which is the one that asks for a phone call first. `onlyWarn` keeps only that one, for a list where nothing
 * is being paid yet and a line on every row would be noise.
 */
export function PaymentLine({ standing, personId, lastPaid, onlyWarn = false }: { standing: ReadonlyMap<string, PaymentStanding> | undefined; personId: string | undefined; lastPaid?: string | undefined; onlyWarn?: boolean }) {
  if (!standing || !personId) return null
  const line = paymentLine(standing.get(personId), lastPaid, (d) => dayLabel(d))
  if (onlyWarn && line.tone !== 'warn') return null
  const text = <a href={`#crew/person/${encodeURIComponent(personId)}/details`}>{line.text}</a>
  return line.tone === 'warn' ? <p className="warn-line pay-line">{text}</p> : <p className="hint pay-line">{text}</p>
}
