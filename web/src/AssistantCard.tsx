import type { AssistantStatus, MailboxStatus, OfficeView } from '@sh/shared'
import { Refusal, useAct } from './act.tsx'
import { when } from './format.ts'
import { getJson, useAsked, type Loaded } from './jobs/rms.ts'
import { Pending, StatusPill, type PillTone } from './StatusPill.tsx'
import { client } from './sync.ts'

/**
 * Claude inside the app (ADR 0096, 0098), for the office, at the top of Admin › Claude. On, Claude reads the mail
 * cc'd to operations@ and drafts a quote for each new enquiry, keeping it up to date with the thread until someone
 * changes it; the office and directors can also paste an enquiry into New quote. It contacts nobody, and only reads
 * the mailbox, which is connected under Connections (MailboxCard.tsx). Off to start, since what it reads is sent to
 * Anthropic.
 *
 * Under the switch, one line says what it's doing now (ADR 0200): reading the mailbox and when it last looked, or why
 * it isn't, with this month's spend; the log below it says what it read.
 */
const dollars = (c: number) => `$${(c / 100).toFixed(2)}`

export function AssistantCard({ office }: { office: OfficeView }) {
  const { run, error } = useAct()
  const on = office.useAssistant
  const status = useAsked(true, `assistant-${on}`, () => getJson<AssistantStatus>('/api/assistant'))
  const mailbox = useAsked(true, `assistant-mailbox-${on}`, () => getJson<MailboxStatus>('/api/assistant/mailbox'))
  const s = status.state === 'ready' ? status.data : undefined
  const now = nowLine(on, s, mailbox)
  return (
    <section className="card" aria-label="Claude">
      <h2>
        Claude <Pending pending={office.assistantPending} />
      </h2>
      <p>
        Claude reads the mail cc’d to the operations mailbox. For each new enquiry it adds the job and drafts its quote, and keeps the draft up to date with the
        thread until someone changes it; after that, what the mail asks for is offered on the quote to take or leave. Leave operations@ off a mail to keep it
        private. It can only read the mailbox, and contacts nobody. What it reads is sent to Anthropic: Anthropic doesn’t learn from it and deletes it within 30
        days.
      </p>
      <label className="signal">
        {/* Offered once the server is set up, so it's never on with nothing behind it; always there to turn off (audit, 5 November 2026, finding 81). */}
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={!on && !!s && !s.configured}
          onChange={(e) => void run(() => client.mutate('assistant.use', { on: e.target.checked }))}
        />
        <span>
          <b>Turn Claude on</b>
          <small>{on ? 'On.' : 'Off: Claude reads nothing and isn’t offered anywhere.'}</small>
        </span>
      </label>
      {now && (
        <p className="claude-now" role="status">
          <StatusPill tone={now.tone}>{now.word}</StatusPill> <span>{now.says}</span>
        </p>
      )}
      {s?.configured && (
        <p className="hint">
          This month: {dollars(s.spentCents)} of {dollars(s.limitCents)}, asked {s.uses === 1 ? 'once' : `${s.uses} times`}. In US dollars, as Anthropic bills it. It
          stops for the month at the limit.
        </p>
      )}
      <p className="hint">
        It reads the operations mailbox once that’s connected under <a href="#admin/connections">Connections</a>, from the moment it’s turned on: mail that came
        before, or while it was off, is left alone. Turning it off and on again skips the mail between.
      </p>
      <Refusal error={error} />
    </section>
  )
}

/** What Claude is doing now, in a word and a sentence, as Admin › Status would say it; nothing while it's off or still asking. */
function nowLine(on: boolean, s: AssistantStatus | undefined, mailbox: Loaded<MailboxStatus>): { word: string; tone: PillTone; says: string } | undefined {
  if (!on || !s) return undefined
  if (!s.configured) return { word: 'Waiting', tone: 'pending', says: 'On, but the server isn’t set up yet: whoever looks after it adds the Anthropic key (ANTHROPIC_API_KEY in Railway). Claude reads nothing until then.' }
  if (s.spentCents >= s.limitCents) return { word: 'Stopped', tone: 'pending', says: 'This month’s limit is used, so Claude reads nothing until the 1st. New enquiries are quoted by hand until then.' }
  if (mailbox.state === 'offline') return { word: 'Not known', tone: 'cancelled', says: 'Needs signal to say whether Claude is reading the mailbox.' }
  if (mailbox.state !== 'ready') return undefined
  const m = mailbox.data
  if (!m.available || m.state === 'off') return { word: 'Not reading', tone: 'pending', says: 'The operations mailbox isn’t connected, so Claude has nothing to read. Connect it under Connections.' }
  if (m.state === 'reconnect') return { word: 'Not reading', tone: 'bad', says: `${m.problem ?? 'Google stopped letting the app read the mailbox.'} Connect it again under Connections.` }
  const looked = m.lookedAt ? `last looked ${when(m.lookedAt)}` : 'not looked yet: the first look is within five minutes'
  const failing = m.failing.length
  if (failing)
    return {
      word: 'Needs a look',
      tone: 'pending',
      says: `Reading ${m.account}, ${looked}. ${failing === 1 ? 'One thread' : `${failing} threads`} couldn’t be read this week: see Problems below.`,
    }
  return { word: 'Reading', tone: 'confirmed', says: `Reading ${m.account} every five minutes, ${looked}.` }
}
